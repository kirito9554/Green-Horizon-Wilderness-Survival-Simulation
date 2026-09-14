import type { GameState, InventoryItem } from '../types';
import '../types/craftingSimulation';
import '../types/researchSimulation';
import '../types/maintenanceSimulation';
import '../types/upgradeSimulation';
import '../types/buildingSimulation';
import '../types/structureMaintenanceSimulation';
import '../types/storageSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { ensureToolComponentInstances } from '../simulation/componentSystem';
import { rebuildReservationCounters } from '../simulation/materialReservationSystem';
import { ensureResearchSystem, refreshResearchEvidence } from '../simulation/researchSystem';
import { ensureMaintenanceSystem, rebuildMaintenanceLocks } from '../simulation/maintenanceSystem';
import { ensureUpgradeSystem, rebuildUpgradeLocks } from '../simulation/upgradeSystem';
import { rebuildJobReservationCounters } from '../simulation/jobReservationSystem';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../simulation/buildGridSystem';
import { ensureStorageSystem } from '../simulation/storageSystem';

export const LATEST_SAVE_VERSION = 9;

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
  for (const building of state.buildings || []) if (!building.areaId) building.areaId = 'AREA_CAMP_CLEARING';
  state.craftingQueue = state.craftingQueue || [];
  for (const queueItem of state.craftingQueue) {
    queueItem.materialReservations = queueItem.materialReservations || [];
    queueItem.blockedReasons = queueItem.blockedReasons || [];
    queueItem.deterministicSeed = queueItem.deterministicSeed ?? stableStringSeed(queueItem.id);
    if (!queueItem.reservationStatus) {
      queueItem.reservationStatus = (queueItem.activeIngredientQualities?.length || 0) > 0 ? 'legacy_consumed' : 'unreserved';
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

function migrateToV5(state: GameState): void {
  const upgrades = ensureUpgradeSystem(state);
  upgrades.queue ||= [];
  upgrades.history ||= [];
  for (const job of upgrades.queue) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.materialsConsumed = Boolean(job.materialsConsumed);
    job.deterministicSeed = job.deterministicSeed ?? stableStringSeed(job.id);
  }
  state.saveVersion = 5;
}

function migrateToV6(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  simulation.version = 1;
  simulation.clusters ||= [];
  simulation.preparationJobs ||= [];
  simulation.gridsByPoiId ||= {};
  getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  state.saveVersion = 6;
}

function migrateToV7(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  simulation.version = 2;
  simulation.constructionJobs ||= [];
  for (const job of simulation.constructionJobs) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.materialQualityByItemId ||= {};
    job.phases ||= [];
    job.currentPhaseIndex ||= 0;
    job.haulProgressSeconds ||= 0;
    job.haulTotalSeconds ||= 0;
    job.materialsDelivered = Boolean(job.materialsDelivered);
  }
  state.saveVersion = 7;
}

function migrateToV8(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  simulation.version = 3;
  simulation.structureWorkJobs ||= [];
  simulation.structureWorkHistory ||= [];
  for (const job of simulation.structureWorkJobs) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.consumedQualities ||= [];
    job.materialsConsumed = Boolean(job.materialsConsumed);
    job.progressSeconds ||= 0;
  }
  state.saveVersion = 8;
}

function migrateToV9(state: GameState): void {
  ensureStorageSystem(state);
  state.saveVersion = 9;
}

export function migrateGameState(rawState: GameState): GameState {
  const state = rawState;
  const fromVersion = Math.max(1, state.saveVersion || 1);

  if (fromVersion < 2) migrateToV2(state);
  if (fromVersion < 3) migrateToV3(state);
  if (fromVersion < 4) migrateToV4(state);
  if (fromVersion < 5) migrateToV5(state);
  if (fromVersion < 6) migrateToV6(state);
  if (fromVersion < 7) migrateToV7(state);
  if (fromVersion < 8) migrateToV8(state);
  if (fromVersion < 9) migrateToV9(state);

  state.poiStorages = state.poiStorages || {};
  state.craftingQueue = state.craftingQueue || [];
  for (const item of state.inventory.items || []) normalizeInventoryItem(item);
  for (const storage of Object.values(state.poiStorages)) {
    for (const item of storage.items || []) normalizeInventoryItem(item);
  }
  for (const building of state.buildings || []) {
    if (!building.areaId) building.areaId = 'AREA_CAMP_CLEARING';
    if (building.stagingInventory) {
      for (const item of building.stagingInventory.items || []) normalizeInventoryItem(item);
    }
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
  const upgrades = ensureUpgradeSystem(state);
  const buildingSimulation = ensureBuildingSimulation(state);
  buildingSimulation.version = Math.max(3, buildingSimulation.version || 1);
  buildingSimulation.constructionJobs ||= [];
  buildingSimulation.structureWorkJobs ||= [];
  buildingSimulation.structureWorkHistory ||= [];
  getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  ensureStorageSystem(state);

  rebuildReservationCounters(state);

  for (const job of maintenance.queue) {
    if (!job.materialsConsumed) {
      job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations || []);
      if (job.materialReservations.length === 0 && job.status !== 'in_progress' && job.status !== 'paused') job.status = 'waiting_materials';
    } else job.materialReservations = [];
  }

  for (const job of upgrades.queue) {
    if (!job.materialsConsumed) {
      job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations || []);
      if (job.materialReservations.length === 0 && job.status !== 'in_progress' && job.status !== 'paused') job.status = 'waiting_materials';
    } else job.materialReservations = [];
  }

  for (const job of buildingSimulation.constructionJobs) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.materialQualityByItemId ||= {};
    if (job.materialsDelivered) {
      job.materialReservations = [];
    } else {
      job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations);
      if (job.materialReservations.length === 0 && job.status !== 'paused') {
        job.status = 'waiting_materials';
        if (!job.blockedReasons.length) job.blockedReasons = ['Vật liệu đã thay đổi sau khi tải save'];
      }
    }
  }

  for (const job of buildingSimulation.structureWorkJobs) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.consumedQualities ||= [];
    job.materialsConsumed = Boolean(job.materialsConsumed);
    if (job.materialsConsumed) {
      job.materialReservations = [];
      continue;
    }

    job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations);
    if (job.materialReservations.length === 0 && job.status !== 'in_progress' && job.status !== 'paused') {
      job.status = 'waiting_materials';
      if (!job.blockedReasons.length) job.blockedReasons = ['Vật liệu đã thay đổi sau khi tải save'];
    }
  }

  rebuildMaintenanceLocks(state);
  rebuildUpgradeLocks(state);
  refreshResearchEvidence(state, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false });

  state.saveVersion = LATEST_SAVE_VERSION;
  return state;
}