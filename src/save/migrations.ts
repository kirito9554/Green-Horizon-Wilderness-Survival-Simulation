import type { GameState, InventoryItem } from '../types';
import '../types/craftingSimulation';
import '../types/researchSimulation';
import '../types/maintenanceSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { ensureToolComponentInstances } from '../simulation/componentSystem';
import { rebuildReservationCounters } from '../simulation/materialReservationSystem';
import { ensureResearchSystem, refreshResearchEvidence } from '../simulation/researchSystem';
import { ensureMaintenanceSystem, rebuildMaintenanceLocks } from '../simulation/maintenanceSystem';
import { rebuildJobReservationCounters } from '../simulation/jobReservationSystem';

export const LATEST_SAVE_VERSION = 4;

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
  refreshResearchEvidence(state, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false });
  state.saveVersion = 3;
}

function migrateToV4(state: GameState): void {
  const maintenance = ensureMaintenanceSystem(state);
  maintenance.queue ||= [];
  maintenance.history ||= [];
  for (const job of maintenance.queue) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.materialsConsumed = Boolean(job.materialsConsumed);
    job.deterministicSeed = job.deterministicSeed ?? stableStringSeed(job.id);
  }
  state.saveVersion = 4;
}

export function migrateGameState(rawState: GameState): GameState {
  const state = rawState;
  const fromVersion = Math.max(1, state.saveVersion || 1);

  if (fromVersion < 2) migrateToV2(state);
  if (fromVersion < 3) migrateToV3(state);
  if (fromVersion < 4) migrateToV4(state);

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
  const maintenance = ensureMaintenanceSystem(state);

  // Rebuild in deterministic order: crafting material reservations ->
  // maintenance/upgrade material reservations -> exclusive target locks.
  rebuildReservationCounters(state);
  for (const job of maintenance.queue) {
    if (!job.materialsConsumed) {
      job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations || []);
      if (job.materialReservations.length === 0 && job.status !== 'in_progress' && job.status !== 'paused') {
        job.status = 'waiting_materials';
      }
    } else {
      job.materialReservations = [];
    }
  }
  rebuildMaintenanceLocks(state);

  refreshResearchEvidence(state, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false });
  state.saveVersion = LATEST_SAVE_VERSION;
  return state;
}
