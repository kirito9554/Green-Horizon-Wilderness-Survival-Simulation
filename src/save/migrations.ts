import type { GameState, InventoryItem } from '../types';
import '../types/craftingSimulation';
import '../types/researchSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { ensureToolComponentInstances } from '../simulation/componentSystem';
import { rebuildReservationCounters } from '../simulation/materialReservationSystem';
import { ensureResearchSystem, refreshResearchEvidence } from '../simulation/researchSystem';

export const LATEST_SAVE_VERSION = 3;

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

    if (!queueItem.reservationStatus) {
      queueItem.reservationStatus = (queueItem.activeIngredientQualities?.length || 0) > 0
        ? 'legacy_consumed'
        : 'unreserved';
    }
  }

  state.saveVersion = 2;
}

function migrateToV3(state: GameState): void {
  ensureResearchSystem(state);
  state.craftedRecipeCounts ||= {};

  // Existing completed research is treated as prior process experience. We do
  // not fabricate production counts, but it still contributes through research
  // status when evidence is recalculated.
  refreshResearchEvidence(state, {
    recordMaterialDiscoveries: false,
    recordIdeaDiscoveries: false,
  });

  state.saveVersion = 3;
}

/**
 * Central save migration entry point. Migrations mutate the parsed save once,
 * then canonical reservation/evidence caches are rebuilt so stale derived data
 * cannot survive a load.
 */
export function migrateGameState(rawState: GameState): GameState {
  const state = rawState;
  const fromVersion = Math.max(1, state.saveVersion || 1);

  if (fromVersion < 2) migrateToV2(state);
  if (fromVersion < 3) migrateToV3(state);

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

  ensureResearchSystem(state);
  state.craftedRecipeCounts ||= {};
  rebuildReservationCounters(state);
  refreshResearchEvidence(state, {
    recordMaterialDiscoveries: false,
    recordIdeaDiscoveries: false,
  });

  state.saveVersion = LATEST_SAVE_VERSION;
  return state;
}
