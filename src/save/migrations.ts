import type { GameState, InventoryItem } from '../types';
import '../types/craftingSimulation';
import '../types/researchSimulation';
import '../types/maintenanceSimulation';
import '../types/upgradeSimulation';
import '../types/buildingSimulation';
import '../types/structureMaintenanceSimulation';
import '../types/storageSimulation';
import '../types/agricultureSimulation';
import '../types/ecologySimulation';
import '../types/hydrologySimulation';
import { ITEMS_DATABASE } from '../data/items';
import { ensureToolComponentInstances } from '../simulation/componentSystem';
import { rebuildReservationCounters } from '../simulation/materialReservationSystem';
import { ensureResearchSystem, refreshResearchEvidence } from '../simulation/researchSystem';
import { ensureMaintenanceSystem, rebuildMaintenanceLocks } from '../simulation/maintenanceSystem';
import { ensureUpgradeSystem, rebuildUpgradeLocks } from '../simulation/upgradeSystem';
import { rebuildJobReservationCounters } from '../simulation/jobReservationSystem';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../simulation/buildGridSystem';
import { ensureStorageSystem } from '../simulation/storageSystem';
import { calculateStorageRoute } from '../simulation/storageRouteSystem';
import { ensureAgricultureSystem, rebuildAgricultureReservations } from '../simulation/agricultureSystem';
import { ensureWorldEcology } from '../simulation/ecologySystem';
import { ensureWorldHydrology } from '../simulation/hydrologySystem';
import { migrateLegacyMainWorldAreas } from './mainWorldAreaMigration';

export const LATEST_SAVE_VERSION = 14;

function stableStringSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeInventoryItem(item: InventoryItem): void {
  item.reservedQuantity = Math.max(0, Math.min(item.quantity, item.reservedQuantity || 0));
  item.reservedQualityBreakdown = item.reservedQualityBreakdown || { crude: 0, standard: 0, prime: 0, masterwork: 0 };
  const def = ITEMS_DATABASE[item.itemId];
  if (def?.toolProperties || def?.category === 'tool') {
    const fallbackMax = def.toolProperties?.durabilityMax || 100;
    item.conditionMax = item.conditionMax || fallbackMax;
    item.condition = item.condition === undefined ? item.conditionMax : item.condition;
    item.originalConditionMax = item.originalConditionMax || item.conditionMax;
    ensureToolComponentInstances(item, def);
  }
  if (def && (def.category === 'water' || def.tags.includes('liquid'))) item.liquidLiters = Math.max(0, item.liquidLiters ?? def.volume * item.quantity);
  if (def?.category === 'medicine') item.medicinePotency = clamp(item.medicinePotency ?? 100);
  if (item.moisture !== undefined) item.moisture = clamp(item.moisture);
  if (item.contamination !== undefined) item.contamination = clamp(item.contamination);
  if (item.pestDamage !== undefined) item.pestDamage = clamp(item.pestDamage);
  if (item.mold !== undefined) item.mold = clamp(item.mold);
  if (item.corrosion !== undefined) item.corrosion = clamp(item.corrosion);
}

function migrateToV2(state: GameState): void {
  state.poiStorages = state.poiStorages || {};
  for (const item of state.inventory.items || []) normalizeInventoryItem(item);
  for (const storage of Object.values(state.poiStorages)) for (const item of storage.items || []) normalizeInventoryItem(item);
  for (const building of state.buildings || []) if (!building.areaId) building.areaId = 'AREA_CAMP_CLEARING';
  state.craftingQueue = state.craftingQueue || [];
  for (const queueItem of state.craftingQueue) {
    queueItem.materialReservations ||= [];
    queueItem.blockedReasons ||= [];
    queueItem.deterministicSeed = queueItem.deterministicSeed ?? stableStringSeed(queueItem.id);
    if (!queueItem.reservationStatus) queueItem.reservationStatus = (queueItem.activeIngredientQualities?.length || 0) > 0 ? 'legacy_consumed' : 'unreserved';
  }
  state.saveVersion = 2;
}

function migrateToV3(state: GameState): void { ensureResearchSystem(state); state.craftedRecipeCounts ||= {}; refreshResearchEvidence(state, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false }); state.saveVersion = 3; }
function migrateToV4(state: GameState): void { const system = ensureMaintenanceSystem(state); system.queue ||= []; system.history ||= []; for (const job of system.queue) { job.materialReservations ||= []; job.blockedReasons ||= []; job.materialsConsumed = Boolean(job.materialsConsumed); job.deterministicSeed = job.deterministicSeed ?? stableStringSeed(job.id); } state.saveVersion = 4; }
function migrateToV5(state: GameState): void { const system = ensureUpgradeSystem(state); system.queue ||= []; system.history ||= []; for (const job of system.queue) { job.materialReservations ||= []; job.blockedReasons ||= []; job.materialsConsumed = Boolean(job.materialsConsumed); job.deterministicSeed = job.deterministicSeed ?? stableStringSeed(job.id); } state.saveVersion = 5; }
function migrateToV6(state: GameState): void { const simulation = ensureBuildingSimulation(state); simulation.version = 1; simulation.clusters ||= []; simulation.preparationJobs ||= []; simulation.gridsByPoiId ||= {}; getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING'); state.saveVersion = 6; }
function migrateToV7(state: GameState): void { const simulation = ensureBuildingSimulation(state); simulation.version = 2; simulation.constructionJobs ||= []; for (const job of simulation.constructionJobs) { job.materialReservations ||= []; job.blockedReasons ||= []; job.materialQualityByItemId ||= {}; job.phases ||= []; job.currentPhaseIndex ||= 0; job.haulProgressSeconds ||= 0; job.haulTotalSeconds ||= 0; job.materialsDelivered = Boolean(job.materialsDelivered); } state.saveVersion = 7; }
function migrateToV8(state: GameState): void { const simulation = ensureBuildingSimulation(state); simulation.version = 3; simulation.structureWorkJobs ||= []; simulation.structureWorkHistory ||= []; for (const job of simulation.structureWorkJobs) { job.materialReservations ||= []; job.blockedReasons ||= []; job.consumedQualities ||= []; job.materialsConsumed = Boolean(job.materialsConsumed); job.progressSeconds ||= 0; } state.saveVersion = 8; }
function migrateToV9(state: GameState): void { ensureStorageSystem(state); state.saveVersion = 9; }
function migrateToV10(state: GameState): void {
  const system = ensureStorageSystem(state);
  system.version = Math.max(3, system.version || 1);
  for (const job of system.haulJobs) {
    const source = system.locations.find(location => location.id === job.sourceLocationId);
    const target = system.locations.find(location => location.id === job.targetLocationId);
    if (source) { job.poiId = source.poiId; job.sourcePoiId = source.poiId; }
    if (target) job.targetPoiId = target.poiId;
    if (source && target && !job.route) job.route = calculateStorageRoute(state, source, target);
  }
  state.saveVersion = 10;
}
function migrateToV11(state: GameState): void {
  const system = ensureAgricultureSystem(state);
  system.version = Math.max(1, system.version || 1);
  system.cultivationAreas ||= [];
  system.plants ||= [];
  system.terrestrialHabitats ||= [];
  system.terrestrialAnimals ||= [];
  system.aquaticHabitats ||= [];
  system.aquaticAnimals ||= [];
  system.jobs ||= [];
  system.productionHistory ||= [];
  for (const job of system.jobs) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.materialsConsumed = Boolean(job.materialsConsumed);
    if (job.status === 'in_progress') { job.status = 'waiting_worker'; job.assignedSurvivorId = undefined; }
  }
  state.saveVersion = 11;
}
function migrateToV12(state: GameState): void {
  migrateLegacyMainWorldAreas(state);
  state.saveVersion = 12;
}
function migrateToV13(state: GameState): void {
  // Ecology is lazy by design. Old saves receive an empty persistent container;
  // macro regions/subareas are generated deterministically only when observed.
  ensureWorldEcology(state);
  state.saveVersion = 13;
}
function migrateToV14(state: GameState): void {
  // Hydrology follows the same lazy rule as ecology. Legacy moisture/flood/water
  // fields stay available as bootstrap priors, but migration never fabricates a
  // river, lake or aquifer network before the relevant macro region is simulated.
  ensureWorldHydrology(state);
  state.saveVersion = 14;
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
  if (fromVersion < 10) migrateToV10(state);
  if (fromVersion < 11) migrateToV11(state);
  if (fromVersion < 12) migrateToV12(state);
  if (fromVersion < 13) migrateToV13(state);
  if (fromVersion < 14) migrateToV14(state);

  // Idempotent repair pass: if a newer subsystem accidentally persisted a known
  // retired main-map alias, normalize it on load without touching archived
  // up/down/left/right sector data.
  migrateLegacyMainWorldAreas(state);

  state.poiStorages ||= {};
  state.craftingQueue ||= [];
  for (const item of state.inventory.items || []) normalizeInventoryItem(item);
  for (const storage of Object.values(state.poiStorages)) for (const item of storage.items || []) normalizeInventoryItem(item);
  for (const building of state.buildings || []) {
    if (!building.areaId) building.areaId = 'AREA_CAMP_CLEARING';
    if (building.stagingInventory) for (const item of building.stagingInventory.items || []) normalizeInventoryItem(item);
  }
  for (const queueItem of state.craftingQueue) {
    queueItem.materialReservations ||= [];
    queueItem.blockedReasons ||= [];
    queueItem.deterministicSeed = queueItem.deterministicSeed ?? stableStringSeed(queueItem.id);
    queueItem.reservationStatus ||= 'unreserved';
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
  const storageSystem = ensureStorageSystem(state);
  ensureAgricultureSystem(state);
  ensureWorldEcology(state);
  ensureWorldHydrology(state);

  // Crafting owns the first reservation rebuild. Every later system then reapplies
  // its persistent exact slices in deterministic ownership order.
  rebuildReservationCounters(state);
  for (const job of maintenance.queue) {
    if (!job.materialsConsumed) { job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations || []); if (!job.materialReservations.length && job.status !== 'in_progress' && job.status !== 'paused') job.status = 'waiting_materials'; }
    else job.materialReservations = [];
  }
  for (const job of upgrades.queue) {
    if (!job.materialsConsumed) { job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations || []); if (!job.materialReservations.length && job.status !== 'in_progress' && job.status !== 'paused') job.status = 'waiting_materials'; }
    else job.materialReservations = [];
  }
  for (const job of buildingSimulation.constructionJobs) {
    job.materialReservations ||= []; job.blockedReasons ||= []; job.materialQualityByItemId ||= {};
    if (job.materialsDelivered) job.materialReservations = [];
    else { job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations); if (!job.materialReservations.length && job.status !== 'paused') { job.status = 'waiting_materials'; if (!job.blockedReasons.length) job.blockedReasons = ['Vật liệu đã thay đổi sau khi tải save']; } }
  }
  for (const job of buildingSimulation.structureWorkJobs) {
    job.materialReservations ||= []; job.blockedReasons ||= []; job.consumedQualities ||= []; job.materialsConsumed = Boolean(job.materialsConsumed);
    if (job.materialsConsumed) { job.materialReservations = []; continue; }
    job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations);
    if (!job.materialReservations.length && job.status !== 'in_progress' && job.status !== 'paused') { job.status = 'waiting_materials'; if (!job.blockedReasons.length) job.blockedReasons = ['Vật liệu đã thay đổi sau khi tải save']; }
  }
  for (const job of storageSystem.haulJobs) {
    job.materialReservations ||= []; job.blockedReasons ||= [];
    const source = storageSystem.locations.find(location => location.id === job.sourceLocationId);
    const target = storageSystem.locations.find(location => location.id === job.targetLocationId);
    if (source) { job.poiId = source.poiId; job.sourcePoiId = source.poiId; }
    if (target) job.targetPoiId = target.poiId;
    if (source && target && !job.route) job.route = calculateStorageRoute(state, source, target);
    if (job.status === 'completed') { job.materialReservations = []; continue; }
    job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations);
    job.quantity = job.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0);
    if (!job.materialReservations.length) { job.status = 'blocked'; job.blockedReasons = ['Vật phẩm nguồn đã thay đổi sau khi tải save']; job.assignedSurvivorId = undefined; }
    else if (job.status === 'in_progress') { job.status = 'waiting_worker'; job.assignedSurvivorId = undefined; }
  }

  // Agriculture is rebuilt after production, construction and logistics so seed/feed
  // jobs can never steal an exact stack already promised to a higher-priority system.
  rebuildAgricultureReservations(state);
  rebuildMaintenanceLocks(state);
  rebuildUpgradeLocks(state);
  refreshResearchEvidence(state, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false });
  state.saveVersion = LATEST_SAVE_VERSION;
  return state;
}
