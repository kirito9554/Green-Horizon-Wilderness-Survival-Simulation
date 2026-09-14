import type {
  CraftingQueueItem,
  GameState,
  InventoryItem,
  ItemQuality,
  QualityBreakdown,
  RecipeDefinition,
  StorageInventory,
} from '../types';
import type {
  MaterialReservation,
  MaterialReservationSource,
} from '../types/craftingSimulation';
import { deductFromQualityBreakdown } from '../utils/qualityUtils';

const QUALITY_ORDER: ItemQuality[] = ['crude', 'standard', 'prime', 'masterwork'];

function emptyBreakdown(): QualityBreakdown {
  return { crude: 0, standard: 0, prime: 0, masterwork: 0 };
}

function sumBreakdown(value?: QualityBreakdown): number {
  if (!value) return 0;
  return QUALITY_ORDER.reduce((sum, q) => sum + (value[q] || 0), 0);
}

function normalizeItemBreakdown(item: InventoryItem): QualityBreakdown {
  if (item.qualityBreakdown && sumBreakdown(item.qualityBreakdown) > 0) {
    return {
      crude: item.qualityBreakdown.crude || 0,
      standard: item.qualityBreakdown.standard || 0,
      prime: item.qualityBreakdown.prime || 0,
      masterwork: item.qualityBreakdown.masterwork || 0,
    };
  }

  const result = emptyBreakdown();
  result[item.quality || 'standard'] = item.quantity;
  return result;
}

function subtractBreakdown(base: QualityBreakdown, subtract?: QualityBreakdown): QualityBreakdown {
  const result = emptyBreakdown();
  for (const quality of QUALITY_ORDER) {
    result[quality] = Math.max(0, (base[quality] || 0) - (subtract?.[quality] || 0));
  }
  return result;
}

function addBreakdown(base: QualityBreakdown | undefined, addition: QualityBreakdown): QualityBreakdown {
  const result = emptyBreakdown();
  for (const quality of QUALITY_ORDER) {
    result[quality] = (base?.[quality] || 0) + (addition[quality] || 0);
  }
  return result;
}

function subtractBreakdownExact(base: QualityBreakdown | undefined, subtraction: QualityBreakdown): QualityBreakdown {
  const result = emptyBreakdown();
  for (const quality of QUALITY_ORDER) {
    result[quality] = Math.max(0, (base?.[quality] || 0) - (subtraction[quality] || 0));
  }
  return result;
}

function allocateQualitySlice(item: InventoryItem, amount: number): QualityBreakdown | null {
  const physical = normalizeItemBreakdown(item);
  const available = subtractBreakdown(physical, item.reservedQualityBreakdown);
  const availableTotal = sumBreakdown(available);
  if (availableTotal < amount) return null;

  const slice = emptyBreakdown();
  let remaining = amount;
  for (const quality of QUALITY_ORDER) {
    if (remaining <= 0) break;
    const take = Math.min(available[quality] || 0, remaining);
    if (take > 0) {
      slice[quality] = take;
      remaining -= take;
    }
  }
  return remaining === 0 ? slice : null;
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

export function resolveReservationInventory(
  state: GameState,
  source: MaterialReservationSource,
): StorageInventory | GameState['inventory'] | null {
  if (source.kind === 'party') return state.inventory;
  if (!source.areaId) return null;
  return state.poiStorages?.[source.areaId] || null;
}

export function getAvailableQuantityForItemInstance(item: InventoryItem): number {
  return Math.max(0, item.quantity - (item.reservedQuantity || 0));
}

export function getAvailableItemStock(
  state: GameState,
  itemId: string,
  source: MaterialReservationSource = { kind: 'party' },
): number {
  const inventory = resolveReservationInventory(state, source);
  if (!inventory) return 0;
  return inventory.items.reduce((sum, item) => {
    if (item.itemId !== itemId) return sum;
    return sum + getAvailableQuantityForItemInstance(item);
  }, 0);
}

function applyReservationCounter(item: InventoryItem, quantity: number, qualities: QualityBreakdown): void {
  item.reservedQuantity = Math.min(item.quantity, Math.max(0, (item.reservedQuantity || 0) + quantity));
  item.reservedQualityBreakdown = addBreakdown(item.reservedQualityBreakdown, qualities);
}

function releaseReservationCounter(item: InventoryItem, quantity: number, qualities: QualityBreakdown): void {
  item.reservedQuantity = Math.max(0, (item.reservedQuantity || 0) - quantity);
  item.reservedQualityBreakdown = subtractBreakdownExact(item.reservedQualityBreakdown, qualities);
  if ((item.reservedQuantity || 0) <= 0) {
    item.reservedQuantity = 0;
    item.reservedQualityBreakdown = emptyBreakdown();
  }
}

function reserveExactItemSlice(
  state: GameState,
  ownerId: string,
  source: MaterialReservationSource,
  item: InventoryItem,
  quantity: number,
): MaterialReservation | null {
  if (quantity <= 0 || getAvailableQuantityForItemInstance(item) < quantity) return null;
  const qualityBreakdown = allocateQualitySlice(item, quantity);
  if (!qualityBreakdown) return null;

  applyReservationCounter(item, quantity, qualityBreakdown);

  return {
    id: `res_${ownerId}_${item.instanceId}_${Math.random().toString(36).slice(2, 8)}`,
    ownerType: 'crafting',
    ownerId,
    source,
    instanceId: item.instanceId,
    itemId: item.itemId,
    quantity,
    qualityBreakdown,
    freshness: item.freshness,
    condition: item.condition,
    conditionMax: item.conditionMax,
    reservedAtGameMinute: gameMinute(state),
  };
}

/**
 * Reserve every ingredient needed by the still-unfinished part of a queue job.
 * The operation is atomic: if any ingredient cannot be fully reserved, all
 * slices created by this call are rolled back.
 */
export function reserveRecipeMaterialsForJob(
  state: GameState,
  queueItem: CraftingQueueItem,
  recipe: RecipeDefinition,
  source: MaterialReservationSource = { kind: 'party' },
): { success: boolean; missing: Array<{ itemId: string; needed: number; available: number }> } {
  if (queueItem.materialReservations && queueItem.materialReservations.length > 0) {
    return { success: true, missing: [] };
  }

  const inventory = resolveReservationInventory(state, source);
  if (!inventory) {
    return {
      success: false,
      missing: recipe.ingredients.map(ingredient => ({
        itemId: ingredient.itemId,
        needed: ingredient.quantity * Math.max(0, queueItem.quantity - queueItem.completedCount),
        available: 0,
      })),
    };
  }

  const unitsRemaining = Math.max(0, queueItem.quantity - queueItem.completedCount);
  const created: MaterialReservation[] = [];
  const missing: Array<{ itemId: string; needed: number; available: number }> = [];

  for (const ingredient of recipe.ingredients) {
    let needed = ingredient.quantity * unitsRemaining;
    const totalNeeded = needed;
    const availableBefore = getAvailableItemStock(state, ingredient.itemId, source);

    const candidates = inventory.items.filter(item => item.itemId === ingredient.itemId);
    for (const item of candidates) {
      if (needed <= 0) break;
      const take = Math.min(needed, getAvailableQuantityForItemInstance(item));
      if (take <= 0) continue;
      const reservation = reserveExactItemSlice(state, queueItem.id, source, item, take);
      if (!reservation) continue;
      created.push(reservation);
      needed -= take;
    }

    if (needed > 0) {
      missing.push({ itemId: ingredient.itemId, needed: totalNeeded, available: availableBefore });
      break;
    }
  }

  if (missing.length > 0) {
    for (const reservation of created) {
      const inv = resolveReservationInventory(state, reservation.source);
      const item = inv?.items.find(candidate => candidate.instanceId === reservation.instanceId);
      if (item) releaseReservationCounter(item, reservation.quantity, reservation.qualityBreakdown);
    }
    queueItem.materialReservations = [];
    queueItem.reservationStatus = 'unreserved';
    return { success: false, missing };
  }

  queueItem.materialReservations = created;
  queueItem.reservationStatus = created.length > 0 ? 'reserved' : 'consumed';
  queueItem.blockedReasons = [];
  return { success: true, missing: [] };
}

/** Release still-unconsumed reservations. Physical inventory never moved. */
export function releaseCraftingReservations(state: GameState, queueItem: CraftingQueueItem): void {
  for (const reservation of queueItem.materialReservations || []) {
    const inventory = resolveReservationInventory(state, reservation.source);
    const item = inventory?.items.find(candidate => candidate.instanceId === reservation.instanceId);
    if (item) releaseReservationCounter(item, reservation.quantity, reservation.qualityBreakdown);
  }
  queueItem.materialReservations = [];
  queueItem.reservationStatus = 'unreserved';
}

function qualitiesFromBreakdown(breakdown: QualityBreakdown): ItemQuality[] {
  const result: ItemQuality[] = [];
  for (const quality of QUALITY_ORDER) {
    const count = Math.max(0, Math.floor(breakdown[quality] || 0));
    for (let i = 0; i < count; i++) result.push(quality);
  }
  return result;
}

/**
 * Consume exactly one output unit's worth of ingredients from already-reserved
 * slices. Returns the real quality composition that was consumed.
 */
export function consumeReservedMaterialsForUnit(
  state: GameState,
  queueItem: CraftingQueueItem,
  recipe: RecipeDefinition,
): { success: boolean; qualities: ItemQuality[]; reason?: string } {
  const reservations = queueItem.materialReservations || [];
  if (reservations.length === 0) {
    return { success: false, qualities: [], reason: 'No material reservation exists for this job.' };
  }

  // Verify first, so a corrupt save cannot partially consume a unit.
  for (const ingredient of recipe.ingredients) {
    const reserved = reservations
      .filter(r => r.itemId === ingredient.itemId)
      .reduce((sum, r) => sum + r.quantity, 0);
    if (reserved < ingredient.quantity) {
      return {
        success: false,
        qualities: [],
        reason: `Reserved ${ingredient.itemId} is insufficient (${reserved}/${ingredient.quantity}).`,
      };
    }
  }

  const qualities: ItemQuality[] = [];

  for (const ingredient of recipe.ingredients) {
    let needed = ingredient.quantity;
    for (const reservation of reservations) {
      if (needed <= 0) break;
      if (reservation.itemId !== ingredient.itemId || reservation.quantity <= 0) continue;

      const inventory = resolveReservationInventory(state, reservation.source);
      if (!inventory) {
        return { success: false, qualities: [], reason: `Reservation source vanished for ${ingredient.itemId}.` };
      }
      const itemIndex = inventory.items.findIndex(candidate => candidate.instanceId === reservation.instanceId);
      if (itemIndex < 0) {
        return { success: false, qualities: [], reason: `Reserved instance ${reservation.instanceId} vanished.` };
      }

      const item = inventory.items[itemIndex];
      const take = Math.min(needed, reservation.quantity, item.quantity);
      if (take <= 0) continue;

      const { updated: reservationUpdated, deducted } = deductFromQualityBreakdown(
        reservation.qualityBreakdown,
        take,
      );

      reservation.quantity -= take;
      reservation.qualityBreakdown = reservationUpdated;

      item.quantity -= take;
      item.reservedQuantity = Math.max(0, (item.reservedQuantity || 0) - take);
      item.reservedQualityBreakdown = subtractBreakdownExact(item.reservedQualityBreakdown, deducted);
      if (item.qualityBreakdown) {
        item.qualityBreakdown = subtractBreakdownExact(item.qualityBreakdown, deducted);
      }

      qualities.push(...qualitiesFromBreakdown(deducted));
      needed -= take;

      if (item.quantity <= 0) {
        inventory.items.splice(itemIndex, 1);
      }
    }
  }

  queueItem.materialReservations = reservations.filter(reservation => reservation.quantity > 0);
  queueItem.reservationStatus = queueItem.materialReservations.length > 0 ? 'partially_consumed' : 'consumed';
  return { success: true, qualities };
}

/**
 * Rebuild denormalized reservation counters after save migration/load. Invalid
 * reservations are dropped instead of creating phantom locked inventory.
 */
export function rebuildReservationCounters(state: GameState): void {
  const inventories: Array<StorageInventory | GameState['inventory']> = [state.inventory];
  if (state.poiStorages) inventories.push(...Object.values(state.poiStorages));

  for (const inventory of inventories) {
    for (const item of inventory.items) {
      item.reservedQuantity = 0;
      item.reservedQualityBreakdown = emptyBreakdown();
    }
  }

  for (const queueItem of state.craftingQueue || []) {
    const valid: MaterialReservation[] = [];
    for (const reservation of queueItem.materialReservations || []) {
      const inventory = resolveReservationInventory(state, reservation.source);
      const item = inventory?.items.find(candidate => candidate.instanceId === reservation.instanceId);
      if (!item || item.itemId !== reservation.itemId || reservation.quantity <= 0) continue;

      const remainingCapacity = Math.max(0, item.quantity - (item.reservedQuantity || 0));
      const quantity = Math.min(reservation.quantity, remainingCapacity);
      if (quantity <= 0) continue;

      const qualityBreakdown = allocateQualitySlice(item, quantity);
      if (!qualityBreakdown) continue;

      reservation.quantity = quantity;
      reservation.qualityBreakdown = qualityBreakdown;
      applyReservationCounter(item, quantity, qualityBreakdown);
      valid.push(reservation);
    }
    queueItem.materialReservations = valid;
    if (queueItem.reservationStatus !== 'legacy_consumed') {
      queueItem.reservationStatus = valid.length > 0 ? 'reserved' : 'unreserved';
    }
  }
}
