import type { GameState, InventoryItem } from '../types';
import '../types/craftingSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { ensureToolComponentInstances } from '../simulation/componentSystem';
import { rebuildReservationCounters } from '../simulation/materialReservationSystem';

export const LATEST_SAVE_VERSION = 2;

function stableStringSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeInventoryItem(item: InventoryItem): void {
  item.reservedQuantity = Math.max(0, Math.min(item.quantity, item.reservedQuantity || 0));
  item.reservedQualityBreakdown = item.reservedQualityBreakdown || {
    crude: 0,
    standard: 0,
    prime: 0,
    masterwork: 0,
  };

  const def = ITEMS_DATABASE[item.itemId];
  if (def?.toolProperties || def?.category === 'tool') {
    const fallbackMax = def.toolProperties?.durabilityMax || 100;
    item.conditionMax = item.conditionMax || fallbackMax;
    item.condition = item.condition === undefined ? item.conditionMax : item.condition;
    item.originalConditionMax = item.originalConditionMax || item.conditionMax;
    ensureToolComponentInstances(item, def);
  }
}

function migrateToV2(state: GameState): void {
  state.poiStorages = state.poiStorages || {};

  for (const item of state.inventory.items || []) normalizeInventoryItem(item);
  for (const storage of Object.values(state.poiStorages)) {
    for (const item of storage.items || []) normalizeInventoryItem(item);
  }

  for (const building of state.buildings || []) {
    if (!building.areaId) building.areaId = 'AREA_CAMP_CLEARING';
  }

  state.craftingQueue = state.craftingQueue || [];
  for (const queueItem of state.craftingQueue) {
    queueItem.materialReservations = queueItem.materialReservations || [];
    queueItem.blockedReasons = queueItem.blockedReasons || [];
    queueItem.deterministicSeed = queueItem.deterministicSeed ?? stableStringSeed(queueItem.id);

    // Old queue implementation consumed the active unit up front. Preserve that
    // fact so loading an old save never charges the same materials twice.
    if (!queueItem.reservationStatus) {
      queueItem.reservationStatus = (queueItem.activeIngredientQualities?.length || 0) > 0
        ? 'legacy_consumed'
        : 'unreserved';
    }
  }

  state.saveVersion = 2;
}

/**
 * Central save migration entry point. Migrations are intentionally mutative on
 * the parsed save object, then reservation counters are rebuilt from canonical
 * queue reservations so stale denormalized counters cannot survive a load.
 */
export function migrateGameState(rawState: GameState): GameState {
  const state = rawState;
  const fromVersion = Math.max(1, state.saveVersion || 1);

  if (fromVersion < 2) migrateToV2(state);

  // Defensive normalization also applies to malformed/current-version saves.
  state.poiStorages = state.poiStorages || {};
  state.craftingQueue = state.craftingQueue || [];
  for (const item of state.inventory.items || []) normalizeInventoryItem(item);
  for (const storage of Object.values(state.poiStorages)) {
    for (const item of storage.items || []) normalizeInventoryItem(item);
  }
  for (const building of state.buildings || []) {
    if (!building.areaId) building.areaId = 'AREA_CAMP_CLEARING';
  }
  for (const queueItem of state.craftingQueue) {
    queueItem.materialReservations = queueItem.materialReservations || [];
    queueItem.blockedReasons = queueItem.blockedReasons || [];
    queueItem.deterministicSeed = queueItem.deterministicSeed ?? stableStringSeed(queueItem.id);
    queueItem.reservationStatus = queueItem.reservationStatus || 'unreserved';
  }

  rebuildReservationCounters(state);
  state.saveVersion = LATEST_SAVE_VERSION;
  return state;
}
