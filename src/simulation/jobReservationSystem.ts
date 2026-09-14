import type { GameState, InventoryItem, ItemQuality, QualityBreakdown } from '../types';
import type {
  MaterialReservation,
  MaterialReservationOwnerType,
  MaterialReservationSource,
} from '../types/craftingSimulation';
import { deductFromQualityBreakdown } from '../utils/qualityUtils';

const QUALITY_ORDER: ItemQuality[] = ['crude', 'standard', 'prime', 'masterwork'];

export interface JobMaterialRequirement {
  itemId: string;
  quantity: number;
}

function blankBreakdown(): QualityBreakdown {
  return { crude: 0, standard: 0, prime: 0, masterwork: 0 };
}

function sumBreakdown(value?: QualityBreakdown): number {
  return QUALITY_ORDER.reduce((sum, quality) => sum + (value?.[quality] || 0), 0);
}

function normalizedPhysicalBreakdown(item: InventoryItem): QualityBreakdown {
  if (sumBreakdown(item.qualityBreakdown) > 0) {
    return {
      crude: item.qualityBreakdown?.crude || 0,
      standard: item.qualityBreakdown?.standard || 0,
      prime: item.qualityBreakdown?.prime || 0,
      masterwork: item.qualityBreakdown?.masterwork || 0,
    };
  }
  const result = blankBreakdown();
  result[item.quality || 'standard'] = item.quantity;
  return result;
}

function subtractBreakdown(base: QualityBreakdown | undefined, subtraction: QualityBreakdown | undefined): QualityBreakdown {
  const result = blankBreakdown();
  for (const quality of QUALITY_ORDER) {
    result[quality] = Math.max(0, (base?.[quality] || 0) - (subtraction?.[quality] || 0));
  }
  return result;
}

function addBreakdown(base: QualityBreakdown | undefined, addition: QualityBreakdown): QualityBreakdown {
  const result = blankBreakdown();
  for (const quality of QUALITY_ORDER) result[quality] = (base?.[quality] || 0) + (addition[quality] || 0);
  return result;
}

function allocateSlice(item: InventoryItem, quantity: number): QualityBreakdown | null {
  const available = subtractBreakdown(normalizedPhysicalBreakdown(item), item.reservedQualityBreakdown);
  if (sumBreakdown(available) < quantity) return null;
  const result = blankBreakdown();
  let remaining = quantity;
  for (const quality of QUALITY_ORDER) {
    const take = Math.min(remaining, available[quality] || 0);
    result[quality] = take;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return remaining <= 0 ? result : null;
}

function resolveInventory(state: GameState, source: MaterialReservationSource) {
  if (source.kind === 'party') return state.inventory;
  return source.areaId ? state.poiStorages?.[source.areaId] || null : null;
}

function availableQuantity(item: InventoryItem): number {
  return Math.max(0, item.quantity - (item.reservedQuantity || 0));
}

function releaseOne(state: GameState, reservation: MaterialReservation): void {
  const inventory = resolveInventory(state, reservation.source);
  const item = inventory?.items.find(candidate => candidate.instanceId === reservation.instanceId);
  if (!item) return;
  item.reservedQuantity = Math.max(0, (item.reservedQuantity || 0) - reservation.quantity);
  item.reservedQualityBreakdown = subtractBreakdown(item.reservedQualityBreakdown, reservation.qualityBreakdown);
}

export function reserveJobMaterials(
  state: GameState,
  ownerType: MaterialReservationOwnerType,
  ownerId: string,
  requirements: JobMaterialRequirement[],
  source: MaterialReservationSource = { kind: 'party' },
): { reservations: MaterialReservation[]; missing: JobMaterialRequirement[] } {
  const inventory = resolveInventory(state, source);
  if (!inventory) return { reservations: [], missing: requirements.map(requirement => ({ ...requirement })) };

  const created: MaterialReservation[] = [];
  const missing: JobMaterialRequirement[] = [];
  const nowMinute = Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);

  for (const requirement of requirements) {
    let needed = requirement.quantity;
    for (const item of inventory.items) {
      if (item.itemId !== requirement.itemId || needed <= 0) continue;
      const take = Math.min(needed, availableQuantity(item));
      if (take <= 0) continue;
      const qualityBreakdown = allocateSlice(item, take);
      if (!qualityBreakdown) continue;

      item.reservedQuantity = (item.reservedQuantity || 0) + take;
      item.reservedQualityBreakdown = addBreakdown(item.reservedQualityBreakdown, qualityBreakdown);
      created.push({
        id: `jobres_${ownerId}_${item.instanceId}_${Math.random().toString(36).slice(2, 7)}`,
        ownerType,
        ownerId,
        source,
        instanceId: item.instanceId,
        itemId: item.itemId,
        quantity: take,
        qualityBreakdown,
        freshness: item.freshness,
        condition: item.condition,
        conditionMax: item.conditionMax,
        reservedAtGameMinute: nowMinute,
      });
      needed -= take;
    }
    if (needed > 0) {
      missing.push({ itemId: requirement.itemId, quantity: needed });
      break;
    }
  }

  if (missing.length > 0) {
    for (const reservation of created) releaseOne(state, reservation);
    return { reservations: [], missing };
  }
  return { reservations: created, missing: [] };
}

export function releaseJobReservations(state: GameState, reservations: MaterialReservation[]): void {
  for (const reservation of reservations) releaseOne(state, reservation);
}

/** Consume the exact reserved slices. Returns quality composition for later calculations. */
export function consumeJobReservations(
  state: GameState,
  reservations: MaterialReservation[],
): { success: boolean; qualities: ItemQuality[] } {
  // Validate first so corrupted saves cannot half-consume a repair/upgrade job.
  for (const reservation of reservations) {
    const inventory = resolveInventory(state, reservation.source);
    const item = inventory?.items.find(candidate => candidate.instanceId === reservation.instanceId);
    if (!item || item.quantity < reservation.quantity || (item.reservedQuantity || 0) < reservation.quantity) {
      return { success: false, qualities: [] };
    }
  }

  const qualities: ItemQuality[] = [];
  for (const reservation of reservations) {
    const inventory = resolveInventory(state, reservation.source)!;
    const index = inventory.items.findIndex(candidate => candidate.instanceId === reservation.instanceId);
    const item = inventory.items[index];
    const { deducted } = deductFromQualityBreakdown(reservation.qualityBreakdown, reservation.quantity);

    item.quantity -= reservation.quantity;
    item.reservedQuantity = Math.max(0, (item.reservedQuantity || 0) - reservation.quantity);
    item.reservedQualityBreakdown = subtractBreakdown(item.reservedQualityBreakdown, deducted);
    if (item.qualityBreakdown) item.qualityBreakdown = subtractBreakdown(item.qualityBreakdown, deducted);

    for (const quality of QUALITY_ORDER) {
      for (let i = 0; i < Math.floor(deducted[quality] || 0); i++) qualities.push(quality);
    }
    if (item.quantity <= 0) inventory.items.splice(index, 1);
  }
  return { success: true, qualities };
}
