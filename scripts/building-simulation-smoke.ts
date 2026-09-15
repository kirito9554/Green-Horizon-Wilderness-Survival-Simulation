import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { SitePreparationJob } from '../src/types/buildingSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  ensureBuildingSimulation,
  generatePoiBuildGrid,
  getOrCreatePoiBuildGrid,
} from '../src/simulation/buildGridSystem';
import {
  completeSitePreparationJob,
  establishClusterAtCandidate,
  findStructurePlacement,
  getClusterSiteCandidates,
  reserveStructurePlacement,
} from '../src/simulation/buildingClusterSystem';
import { tickBuildingPreparationRuntime } from '../src/simulation/buildingPreparationRuntime';
import {
  planSpatialConstruction,
  tickBuildingConstructionRuntime,
} from '../src/simulation/buildingConstructionSystem';
import {
  cancelSpatialConstruction,
  togglePauseSpatialConstruction,
} from '../src/simulation/buildingConstructionCommands';
import {
  addItemToInventory,
  getAvailableInventoryStock,
  getOrCreatePoiStorage,
} from '../src/simulation/inventorySystem';
import { migrateGameState } from '../src/save/migrations';

function freshState(seed = 'building-smoke-seed'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const sim = ensureBuildingSimulation(state);
  sim.worldSeed = seed;
  sim.gridsByPoiId = {};
  sim.clusters = [];
  sim.preparationJobs = [];
  sim.constructionJobs = [];
  sim.structureWorkJobs = [];
  sim.structureWorkHistory = [];
  return state;
}

function physicalQuantity(state: GameState, itemId: string): number {
  const party = state.inventory.items
    .filter(item => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
  const poi = Object.values(state.poiStorages || {}).reduce((sum, storage) =>
    sum + storage.items.filter(item => item.itemId === itemId).reduce((inner, item) => inner + item.quantity, 0), 0);
  return party + poi;
}

function availableAtCamp(state: GameState, itemId: string): number {
  const storage = getOrCreatePoiStorage(state, 'AREA_CAMP_CLEARING');
  return getAvailableInventoryStock(state.inventory, itemId) + getAvailableInventoryStock(storage, itemId);
}

function testDeterministicGrid(): void {
  const a = generatePoiBuildGrid('same-seed', 'AREA_CAMP_CLEARING');
  const b = generatePoiBuildGrid('same-seed', 'AREA_CAMP_CLEARING');
  const c = generatePoiBuildGrid('different-seed', 'AREA_CAMP_CLEARING');
  assert.deepEqual(a, b, 'same world seed + POI must generate byte-equivalent build grids');
  assert.notDeepEqual(a.cells, c.cells, 'different world seeds should vary micro terrain');
}

function establishFirstUsableCluster(state: GameState, type: 'shelter' | 'cooking'): GameState {
  getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const candidates = getClusterSiteCandidates(state, 'AREA_CAMP_CLEARING', type);
  const candidate = candidates.find(entry => entry.rating !== 'unsuitable');
  assert.ok(candidate, `camp clearing should expose at least one usable ${type} candidate`);
  return establishClusterAtCandidate(
    state,
    'AREA_CAMP_CLEARING',
    type,
    candidate.id,
    state.survivors[0]?.id,
  );
}

function testClusterClaimsCellsWithoutOverlap(): void {
  let state = freshState('cluster-claim-seed');
  state = establishFirstUsableCluster(state, 'shelter');
  const cluster = state.buildingSimulation?.clusters[0];
  assert.ok(cluster, 'cluster must be persisted after establishment');

  const grid = state.buildingSimulation!.gridsByPoiId.AREA_CAMP_CLEARING;
  assert.ok(grid, 'camp build grid must be persisted once used');
  for (const cellId of cluster.cellIds) {
    assert.equal(grid.cells.find(cell => cell.id === cellId)?.clusterId, cluster.id, 'every claimed cell must point to its owning cluster');
  }

  const nextCandidates = getClusterSiteCandidates(state, 'AREA_CAMP_CLEARING', 'storage');
  for (const candidate of nextCandidates) {
    assert.equal(
      candidate.cellIds.some(cellId => cluster.cellIds.includes(cellId)),
      false,
      'new cluster candidates may not overlap already claimed cells',
    );
  }
}

function finishClusterPreparation(state: GameState, clusterId: string): void {
  const jobs = state.buildingSimulation?.preparationJobs.filter(job => job.clusterId === clusterId) || [];
  for (const job of jobs) completeSitePreparationJob(state, job.id);
}

function testStructureFootprintReservation(): void {
  let state = freshState('placement-seed');
  state = establishFirstUsableCluster(state, 'shelter');
  const cluster = state.buildingSimulation!.clusters[0];
  finishClusterPreparation(state, cluster.id);
  assert.equal(cluster.state, 'active', 'finishing site preparation should activate cluster');

  const preview = findStructurePlacement(state, cluster.id, 'BUILDING_LEAF_SHELTER');
  assert.ok(
    preview.status === 'available' || preview.status === 'preparation_required',
    `leaf shelter should resolve a real spatial placement, got ${preview.status}`,
  );
  assert.ok(preview.allocations.length > 0, 'placement should allocate real grid area');

  const beforeOccupied = cluster.occupiedAreaM2;
  const beforeReserved = preview.allocations.reduce((sum, allocation) => {
    const cell = state.buildingSimulation!.gridsByPoiId.AREA_CAMP_CLEARING.cells.find(entry => entry.id === allocation.cellId);
    return sum + (cell?.reservedAreaM2 || 0);
  }, 0);

  const reserved = reserveStructurePlacement(state, cluster.id, 'BUILDING_LEAF_SHELTER');
  assert.ok(reserved.allocations.length > 0, 'reservation must preserve footprint allocations');
  assert.equal(
    Math.round((cluster.occupiedAreaM2 - beforeOccupied) * 10) / 10,
    Math.round(reserved.footprintAreaM2 * 10) / 10,
    'cluster occupied area must increase by the structure footprint',
  );

  const afterReserved = reserved.allocations.reduce((sum, allocation) => {
    const cell = state.buildingSimulation!.gridsByPoiId.AREA_CAMP_CLEARING.cells.find(entry => entry.id === allocation.cellId);
    return sum + (cell?.reservedAreaM2 || 0);
  }, 0);
  assert.ok(afterReserved > beforeReserved, 'physical cell reserved area must increase');
}

function testPreparationRuntimeReleasesWorker(): void {
  const state = freshState('prep-runtime-seed');
  const sim = ensureBuildingSimulation(state);
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const cell = grid.cells[0];
  assert.ok(cell, 'test grid needs at least one cell');

  sim.clusters.push({
    id: 'cluster_smoke_prep',
    poiId: 'AREA_CAMP_CLEARING',
    type: 'shelter',
    name: 'Smoke Prep Cluster',
    cellIds: [cell.id],
    usableAreaM2: cell.areaM2,
    occupiedAreaM2: 0,
    state: 'preparing',
    siteScore: 70,
    createdAtGameMinute: 0,
    maintenancePolicy: 'normal',
  });
  cell.clusterId = 'cluster_smoke_prep';

  const job: SitePreparationJob = {
    id: 'siteprep_smoke',
    clusterId: 'cluster_smoke_prep',
    poiId: 'AREA_CAMP_CLEARING',
    type: 'clear_debris',
    cellIds: [cell.id],
    severity: 50,
    progressSeconds: 0,
    totalSeconds: 5,
    status: 'waiting_worker',
    assignedSurvivorId: state.survivors[0]?.id,
    recovered: [],
  };
  sim.preparationJobs.push(job);

  tickBuildingPreparationRuntime(state);
  const worker = state.survivors[0];
  assert.equal(job.status, 'in_progress', 'runtime must assign a real build worker');
  assert.equal(worker.currentAction.type, 'building');
  assert.equal(worker.currentAction.resultPayload?.sitePreparationJobId, job.id);

  worker.currentAction.progressSeconds = 5;
  tickBuildingPreparationRuntime(state);
  assert.equal(job.status, 'completed', 'runtime must complete the real prep job');
  assert.equal(worker.currentAction.type, 'idle', 'completed prep job must release worker from sentinel building action');
  assert.equal(sim.clusters[0].state, 'active', 'last prep job completion must activate cluster');
}

function testConstructionReservationHaulingAndPhases(): void {
  let state = freshState('construction-runtime-seed');
  state = establishFirstUsableCluster(state, 'cooking');
  const cluster = state.buildingSimulation!.clusters[0];
  finishClusterPreparation(state, cluster.id);
  assert.equal(cluster.state, 'active');

  const storage = getOrCreatePoiStorage(state, 'AREA_CAMP_CLEARING');
  addItemToInventory(storage, 'ITEM_COCONUT_HUSK', 2, 'standard');
  const branchBeforePlan = physicalQuantity(state, 'ITEM_DRIFTWOOD_BRANCH');
  const huskBeforePlan = physicalQuantity(state, 'ITEM_COCONUT_HUSK');

  state = planSpatialConstruction(state, state.survivors[0].id, cluster.id, 'BUILDING_CAMPFIRE_HEARTH');
  const sim = ensureBuildingSimulation(state);
  const job = sim.constructionJobs?.[0];
  assert.ok(job, 'planning should create a persistent construction job');
  const building = state.buildings.find(entry => entry.id === job.buildingInstanceId);
  assert.ok(building, 'planning should create a planned structure instance');
  assert.equal(building.isBuilt, false);
  assert.equal(job.status, 'waiting_hauling', 'complete bill should be reserved before hauling');

  assert.equal(physicalQuantity(state, 'ITEM_DRIFTWOOD_BRANCH'), branchBeforePlan, 'planning must not physically consume branches');
  assert.equal(physicalQuantity(state, 'ITEM_COCONUT_HUSK'), huskBeforePlan, 'planning must not physically consume husk');
  assert.ok(availableAtCamp(state, 'ITEM_COCONUT_HUSK') < 2, 'reserved material must be unavailable to competing jobs');

  tickBuildingConstructionRuntime(state);
  assert.equal(job.status, 'hauling', 'an idle builder should begin hauling reserved material');
  const hauler = state.survivors.find(survivor => survivor.id === job.assignedSurvivorId);
  assert.ok(hauler && hauler.currentAction.resultPayload?.constructionStage === 'hauling');
  hauler.currentAction.progressSeconds = job.haulTotalSeconds;
  tickBuildingConstructionRuntime(state);

  assert.equal(job.materialsDelivered, true, 'completed haul should transfer reservations into staging');
  assert.equal(job.materialReservations.length, 0, 'delivered materials must no longer reserve source stacks');
  assert.equal(physicalQuantity(state, 'ITEM_DRIFTWOOD_BRANCH'), branchBeforePlan - 6, 'hauling is the point where source branches are consumed');
  assert.equal(physicalQuantity(state, 'ITEM_COCONUT_HUSK'), huskBeforePlan - 2, 'hauling is the point where source husk is consumed');
  assert.equal(getAvailableInventoryStock(building.stagingInventory!, 'ITEM_DRIFTWOOD_BRANCH'), 6);
  assert.equal(getAvailableInventoryStock(building.stagingInventory!, 'ITEM_COCONUT_HUSK'), 2);

  for (let guard = 0; guard < 30 && !building.isBuilt; guard++) {
    state.weather.current = 'clear';
    tickBuildingConstructionRuntime(state);
    const currentJob = state.buildingSimulation!.constructionJobs![0];
    if (currentJob.status === 'in_progress') {
      const worker = state.survivors.find(survivor => survivor.id === currentJob.assignedSurvivorId);
      const phase = currentJob.phases[currentJob.currentPhaseIndex];
      assert.ok(worker && phase, 'active phase must have a real worker and phase');
      worker.currentAction.progressSeconds = phase.totalSeconds;
    }
  }

  assert.equal(building.isBuilt, true, 'all physical construction phases should complete the structure');
  assert.equal(job.status, 'completed');
  assert.equal(getAvailableInventoryStock(building.stagingInventory!, 'ITEM_DRIFTWOOD_BRANCH'), 0, 'phase consumption must empty staged branch bill');
  assert.equal(getAvailableInventoryStock(building.stagingInventory!, 'ITEM_COCONUT_HUSK'), 0, 'phase consumption must empty staged husk bill');
  assert.ok(job.phases.every(phase => phase.status === 'completed' && phase.workmanshipScore !== undefined), 'each phase should record workmanship');
}

function testConstructionPauseAndCancel(): void {
  let state = freshState('construction-command-seed');
  state = establishFirstUsableCluster(state, 'cooking');
  const cluster = state.buildingSimulation!.clusters[0];
  finishClusterPreparation(state, cluster.id);
  const occupiedBefore = cluster.occupiedAreaM2;

  addItemToInventory(getOrCreatePoiStorage(state, 'AREA_CAMP_CLEARING'), 'ITEM_COCONUT_HUSK', 2, 'standard');
  const branchAvailableBefore = availableAtCamp(state, 'ITEM_DRIFTWOOD_BRANCH');
  const huskAvailableBefore = availableAtCamp(state, 'ITEM_COCONUT_HUSK');

  state = planSpatialConstruction(state, state.survivors[0].id, cluster.id, 'BUILDING_CAMPFIRE_HEARTH');
  let job = state.buildingSimulation!.constructionJobs![0];
  assert.ok(job);
  assert.ok(state.buildingSimulation!.clusters[0].occupiedAreaM2 > occupiedBefore, 'planning must reserve physical footprint');
  assert.ok(availableAtCamp(state, 'ITEM_DRIFTWOOD_BRANCH') < branchAvailableBefore, 'planning must reserve branch stock');
  assert.ok(availableAtCamp(state, 'ITEM_COCONUT_HUSK') < huskAvailableBefore, 'planning must reserve husk stock');

  state = togglePauseSpatialConstruction(state, job.id);
  job = state.buildingSimulation!.constructionJobs![0];
  assert.equal(job.status, 'paused');
  assert.ok(job.materialReservations.length > 0, 'pause must keep exact reservations');

  state = togglePauseSpatialConstruction(state, job.id);
  job = state.buildingSimulation!.constructionJobs![0];
  assert.equal(job.status, 'waiting_hauling');

  state = cancelSpatialConstruction(state, job.id);
  assert.equal(state.buildingSimulation!.constructionJobs!.length, 0, 'cancel must remove construction job');
  assert.equal(state.buildings.some(building => building.constructionJobId === job.id), false, 'cancel must remove unfinished structure instance');
  assert.equal(Math.round(state.buildingSimulation!.clusters[0].occupiedAreaM2 * 10), Math.round(occupiedBefore * 10), 'cancel must release cluster footprint');
  assert.equal(availableAtCamp(state, 'ITEM_DRIFTWOOD_BRANCH'), branchAvailableBefore, 'cancel before hauling must release branch reservation');
  assert.equal(availableAtCamp(state, 'ITEM_COCONUT_HUSK'), huskAvailableBefore, 'cancel before hauling must release husk reservation');
}

function testLatestMigrationCreatesSpatialAndStructureWorkState(): void {
  const legacy = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  legacy.saveVersion = 5;
  delete legacy.buildingSimulation;
  const migrated = migrateGameState(legacy);
  assert.equal(migrated.saveVersion, 12);
  assert.ok(migrated.buildingSimulation?.worldSeed, 'migration must create a persistent world seed');
  assert.ok(migrated.buildingSimulation?.gridsByPoiId.AREA_CAMP_CLEARING, 'migration should materialize the camp grid');
  assert.ok(Array.isArray(migrated.buildingSimulation?.constructionJobs), 'migration must initialize persistent construction queue');
  assert.ok(Array.isArray(migrated.buildingSimulation?.structureWorkJobs), 'migration must initialize structure work queue');
  assert.ok(Array.isArray(migrated.buildingSimulation?.structureWorkHistory), 'migration must initialize structure work history');
  assert.ok(migrated.storageSystem?.locations.length, 'latest migration should also preserve the storage schema layered over POI stock');
  assert.ok(migrated.agricultureSystem, 'latest migration should initialize agriculture without fabricating entities');
}

function main(): void {
  testDeterministicGrid();
  testClusterClaimsCellsWithoutOverlap();
  testStructureFootprintReservation();
  testPreparationRuntimeReleasesWorker();
  testConstructionReservationHaulingAndPhases();
  testConstructionPauseAndCancel();
  testLatestMigrationCreatesSpatialAndStructureWorkState();
  console.log('Building simulation smoke tests passed.');
}

main();
