import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/ecologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';
import {
  applyEcologyDisturbance,
  createWorldEcologyState,
  discoverEcologySubarea,
  ensureRegionEcology,
  getEcologyGenerationFingerprint,
  getRegionSubareas,
  getSubareaPlantPopulations,
  tickWorldEcology,
} from '../src/simulation/ecologySystem';
import { ECOLOGY_REGION_PROFILES } from '../src/data/ecologyProfiles';
import { migrateGameState, LATEST_SAVE_VERSION } from '../src/save/migrations';

function fresh(seed: string): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.clusters = [];
  building.preparationJobs = [];
  state.ecologySystem = createWorldEcologyState();
  return state;
}

function testDeterministicProceduralSubareas(): void {
  const a = fresh('ecology-seed-A');
  const b = fresh('ecology-seed-A');
  const c = fresh('ecology-seed-B');

  const fingerprintA = getEcologyGenerationFingerprint(a, 'AREA_FOREST_EDGE');
  const fingerprintB = getEcologyGenerationFingerprint(b, 'AREA_FOREST_EDGE');
  const fingerprintC = getEcologyGenerationFingerprint(c, 'AREA_FOREST_EDGE');

  assert.ok(fingerprintA, 'Deep Rainforest should generate an ecology layout');
  assert.equal(fingerprintA, fingerprintB, 'same world seed + macro region must generate the same ecology layout');
  assert.notEqual(fingerprintA, fingerprintC, 'different world seeds should produce a different Deep Rainforest layout');
}

function testSubareasPartitionPhysicalBuildGridAndGraphIsConnected(): GameState {
  const state = fresh('ecology-partition-seed');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  const subareas = getRegionSubareas(state, 'AREA_FOREST_EDGE');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_FOREST_EDGE');
  const profile = ECOLOGY_REGION_PROFILES.AREA_FOREST_EDGE;

  assert.ok(subareas.length >= profile.minSubareas && subareas.length <= profile.maxSubareas, 'subarea count must stay inside the macro-region profile');
  assert.equal(region.connectionIds.length, Math.max(0, subareas.length - 1), 'initial subarea graph must contain a connected spanning tree');

  const ownedCellIds = subareas.flatMap(subarea => subarea.cellIds);
  assert.equal(ownedCellIds.length, grid.cells.length, 'every BuildGrid cell must belong to one ecological subarea');
  assert.equal(new Set(ownedCellIds).size, grid.cells.length, 'ecological subareas may not overlap physical BuildGrid cells');
  assert.deepEqual(new Set(ownedCellIds), new Set(grid.cells.map(cell => cell.id)), 'ecology must overlay the same physical ground used by Building');

  const allowed = new Set(profile.archetypes.map(entry => entry.archetypeId));
  assert.ok(subareas.every(subarea => allowed.has(subarea.archetypeId)), 'Deep Rainforest must only roll archetypes allowed by its ecological envelope');
  assert.ok(subareas.every(subarea => subarea.materializationState === 'latent'), 'unobserved subareas must remain lazy/latent');
  assert.equal(state.ecologySystem!.plantPopulations.length, 0, 'latent subareas must not allocate detailed flora populations');
  return state;
}

function testMaterializationCreatesPersistentWildFlora(): GameState {
  const state = testSubareasPartitionPhysicalBuildGridAndGraphIsConnected();
  const subarea = getRegionSubareas(state, 'AREA_FOREST_EDGE')[0];
  assert.ok(subarea, 'test region needs at least one subarea');

  const materialized = discoverEcologySubarea(state, subarea.id)!;
  const populations = getSubareaPlantPopulations(state, subarea.id);

  assert.equal(materialized.materializationState, 'materialized');
  assert.equal(materialized.discovered, true);
  assert.ok(populations.length >= 1, 'observing a viable rainforest subarea should materialize wild flora');
  assert.ok(populations.every(population => population.subareaId === subarea.id && population.poiId === 'AREA_FOREST_EDGE'));
  assert.ok(populations.every(population => population.biomassKg > 0 && population.estimatedIndividuals > 0));
  assert.ok(state.ecologySystem!.regionsByPoiId.AREA_FOREST_EDGE!.discoveredSubareaIds.includes(subarea.id));
  return state;
}

function testDisturbanceMutatesSharedGroundAndSurvivesLoad(): void {
  const state = testMaterializationCreatesPersistentWildFlora();
  const subarea = getRegionSubareas(state, 'AREA_FOREST_EDGE').find(entry => entry.materializationState === 'materialized')!;
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_FOREST_EDGE');
  const cell = grid.cells.find(entry => entry.id === subarea.cellIds[0])!;
  const population = getSubareaPlantPopulations(state, subarea.id)[0];
  const before = {
    vegetation: cell.vegetation,
    canopy: cell.canopy,
    biomass: population.biomassKg,
  };

  applyEcologyDisturbance(state, subarea.id, {
    vegetationLoss: 18,
    canopyLoss: 12,
    humanPressure: 28,
    loggingPressure: 22,
  });

  assert.ok(cell.vegetation < before.vegetation, 'ecological clearing must mutate the shared BuildGrid vegetation');
  assert.ok(cell.canopy < before.canopy, 'ecological clearing must mutate the shared BuildGrid canopy');
  assert.ok(population.biomassKg < before.biomass, 'wild plant biomass must respond to physical disturbance');
  assert.ok(subarea.disturbance.humanPressure > 0 && subarea.disturbance.loggingPressure > 0);

  const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
  const loaded = migrateGameState(snapshot);
  const loadedSubarea = loaded.ecologySystem!.subareasById[subarea.id];
  const loadedCell = loaded.buildingSimulation!.gridsByPoiId.AREA_FOREST_EDGE.cells.find(entry => entry.id === cell.id)!;
  const loadedPopulation = loaded.ecologySystem!.plantPopulations.find(entry => entry.id === population.id)!;

  assert.equal(loadedSubarea.disturbance.humanPressure, subarea.disturbance.humanPressure, 'load must preserve observed ecological history');
  assert.equal(loadedCell.vegetation, cell.vegetation, 'load must not regenerate disturbed physical ground');
  assert.equal(loadedPopulation.biomassKg, population.biomassKg, 'load must not reroll a materialized wild population');
}

function testV12MigrationIsLazy(): void {
  const legacy = fresh('ecology-migration-seed');
  legacy.saveVersion = 12;
  delete legacy.ecologySystem;
  const migrated = migrateGameState(legacy);

  assert.equal(LATEST_SAVE_VERSION, 13);
  assert.equal(migrated.saveVersion, 13);
  assert.ok(migrated.ecologySystem, 'V13 migration must add persistent ecology state');
  assert.deepEqual(migrated.ecologySystem!.regionsByPoiId, {}, 'migration must not fabricate the whole ecosystem before it is observed');
  assert.equal(migrated.ecologySystem!.plantPopulations.length, 0);
}

function testRuntimeBootstrapsOnlyStartingLandscape(): void {
  const state = fresh('ecology-runtime-seed');
  tickWorldEcology(state, 60);
  const start = state.ecologySystem!.regionsByPoiId.AREA_CAMP_CLEARING;
  assert.ok(start, 'runtime should lazily bootstrap the Plane Wreck landscape');
  assert.equal(Object.keys(state.ecologySystem!.regionsByPoiId).length, 1, 'runtime must not generate all ten macro regions at once');
  assert.equal(start!.discoveredSubareaIds.length, 1, 'only the immediate starting subarea should be observed initially');
  assert.ok(state.ecologySystem!.plantPopulations.length > 0, 'the observed starting patch should contain materialized wild flora');
}

function main(): void {
  testDeterministicProceduralSubareas();
  testSubareasPartitionPhysicalBuildGridAndGraphIsConnected();
  testMaterializationCreatesPersistentWildFlora();
  testDisturbanceMutatesSharedGroundAndSurvivesLoad();
  testV12MigrationIsLazy();
  testRuntimeBootstrapsOnlyStartingLandscape();
  console.log('World ecology foundation smoke tests passed.');
}

main();
