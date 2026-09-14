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
import { migrateGameState } from '../src/save/migrations';

function freshState(seed = 'building-smoke-seed'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const sim = ensureBuildingSimulation(state);
  sim.worldSeed = seed;
  sim.gridsByPoiId = {};
  sim.clusters = [];
  sim.preparationJobs = [];
  return state;
}

function testDeterministicGrid(): void {
  const a = generatePoiBuildGrid('same-seed', 'AREA_CAMP_CLEARING');
  const b = generatePoiBuildGrid('same-seed', 'AREA_CAMP_CLEARING');
  const c = generatePoiBuildGrid('different-seed', 'AREA_CAMP_CLEARING');

  assert.deepEqual(a, b, 'same world seed + POI must generate byte-equivalent build grids');
  assert.notDeepEqual(a.cells, c.cells, 'different world seeds should vary micro terrain');
}

function establishFirstUsableShelter(state: GameState): GameState {
  getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const candidates = getClusterSiteCandidates(state, 'AREA_CAMP_CLEARING', 'shelter');
  const candidate = candidates.find(entry => entry.rating !== 'unsuitable');
  assert.ok(candidate, 'camp clearing should expose at least one usable shelter candidate');
  return establishClusterAtCandidate(
    state,
    'AREA_CAMP_CLEARING',
    'shelter',
    candidate.id,
    state.survivors[0]?.id,
  );
}

function testClusterClaimsCellsWithoutOverlap(): void {
  let state = freshState('cluster-claim-seed');
  state = establishFirstUsableShelter(state);
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
  state = establishFirstUsableShelter(state);
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

function testV6MigrationCreatesSpatialState(): void {
  const legacy = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  legacy.saveVersion = 5;
  delete legacy.buildingSimulation;
  const migrated = migrateGameState(legacy);
  assert.equal(migrated.saveVersion, 6);
  assert.ok(migrated.buildingSimulation?.worldSeed, 'migration must create a persistent world seed');
  assert.ok(migrated.buildingSimulation?.gridsByPoiId.AREA_CAMP_CLEARING, 'migration should materialize the camp grid');
}

function main(): void {
  testDeterministicGrid();
  testClusterClaimsCellsWithoutOverlap();
  testStructureFootprintReservation();
  testPreparationRuntimeReleasesWorker();
  testV6MigrationCreatesSpatialState();
  console.log('Building simulation smoke tests passed.');
}

main();