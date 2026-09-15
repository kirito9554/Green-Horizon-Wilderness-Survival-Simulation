import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/hydrologySimulation';
import '../src/types/aquaticEcology';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldHydrologyState } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork } from '../src/simulation/hydrologySurfaceWaterSystem';
import { createWorldEcologyState, ensureRegionEcology } from '../src/simulation/ecologySystem';
import {
  ensureRegionAquaticEcology,
  getAquaticPopulations,
  tickAquaticEcology,
} from '../src/simulation/ecologyAquaticSystem';
import {
  ensureAquaticFoodWebForNodes,
  ensureAquaticFoodWebNode,
  feedAquaticPopulation,
  getAquaticFoodPoolForNodes,
  getAquaticFoodWebNodeStates,
} from '../src/simulation/aquaticFoodWebSystem';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';

function fresh(seed = 'aquatic-food-web-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  state.hydrologySystem = createWorldHydrologyState();
  state.ecologySystem = createWorldEcologyState();
  return state;
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function primeRiverGorge(state: GameState): void {
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  const system = state.hydrologySystem!;
  const edge = system.edgesById.HYDRO_EDGE_GORGE_ENTRY_TO_FALL;
  assert.ok(edge);
  const from = system.nodesById[edge.fromNodeId];
  const to = system.nodesById[edge.toNodeId];
  assert.ok(from?.cellId && to?.cellId);
  edge.dischargeM3H = 420;
  edge.depthM = 0.82;
  edge.flowVelocityMps = 0.72;
  edge.temperatureC = 24;
  edge.dissolvedOxygenMgL = 8.7;
  edge.turbidity = 12;
  edge.contaminationLoad = 3;
  edge.salinityPpt = 0;
  for (const node of [from, to]) {
    node.active = true;
    node.storageM3 = 34;
    node.capacityM3 = Math.max(node.capacityM3, 42);
    node.inflowM3H = 420;
    node.outflowM3H = 420;
    node.waterLevelM = 0.82;
    node.temperatureC = 24;
    node.dissolvedOxygenMgL = 8.7;
    node.turbidity = 12;
    node.contamination = 3;
    node.salinityPpt = 0;
    const hydro = system.cellStatesById[`AREA_WATERFALL_BASIN:${node.cellId}`];
    hydro.surfaceWaterDepthM = 0.82;
    hydro.observedHours = 240;
    hydro.floodedHours = 220;
    hydro.reliableWaterAccess = 96;
    hydro.dissolvedOxygenMgL = 8.7;
    hydro.turbidity = 12;
    hydro.contamination = 3;
    hydro.salinityPpt = 0;
  }
}

function seedRiver(state: GameState): void {
  primeRiverGorge(state);
  ensureRegionEcology(state, 'AREA_WATERFALL_BASIN');
  ensureRegionAquaticEcology(state, 'AREA_WATERFALL_BASIN');
}

function totalPool(pool: ReturnType<typeof getAquaticFoodPoolForNodes>): number {
  return pool.phytoplankton
    + pool.periphyton
    + pool.aquatic_vegetation
    + pool.zooplankton
    + pool.benthic_invertebrates
    + pool.detritus
    + pool.carrion;
}

function zeroFood(state: GameState, nodeIds: string[]): void {
  for (const entry of ensureAquaticFoodWebForNodes(state, nodeIds)) {
    entry.phytoplanktonKg = 0;
    entry.periphytonKg = 0;
    entry.aquaticVegetationKg = 0;
    entry.zooplanktonKg = 0;
    entry.benthicInvertebratesKg = 0;
    entry.detritusKg = 0;
    entry.carrionKg = 0;
  }
}

function testFoodWebMaterializesOnlyOnRealWater(): void {
  const wet = fresh('food-web-wet');
  seedRiver(wet);
  const populations = getAquaticPopulations(wet, 'AREA_WATERFALL_BASIN');
  assert.ok(populations.length > 0);
  const nodes = [...new Set(populations.flatMap(population => population.occupiedNodeIds))];
  const states = ensureAquaticFoodWebForNodes(wet, nodes);
  assert.ok(states.length > 0, 'real occupied water nodes must own persistent food-web biomass');
  assert.ok(totalPool(getAquaticFoodPoolForNodes(wet, nodes)) > 0, 'wet waterbody must contain producer/detrital/invertebrate biomass');

  const dry = fresh('food-web-dry');
  ensureSurfaceWaterNetwork(dry, 'AREA_ANCIENT_RUINS');
  const hydro = dry.hydrologySystem!;
  const node = Object.values(hydro.nodesById).find(entry => entry.poiId === 'AREA_ANCIENT_RUINS');
  assert.ok(node);
  node.active = false;
  node.storageM3 = 0;
  node.inflowM3H = 0;
  node.outflowM3H = 0;
  node.waterLevelM = 0;
  assert.equal(ensureAquaticFoodWebNode(dry, node.id), undefined, 'dry inactive hydrology must not fabricate an aquatic food web');
}

function testConsumersRemoveRealResourceBiomass(): void {
  const state = fresh('food-web-consumption');
  seedRiver(state);
  const population = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN').find(entry => entry.speciesId === 'AQUATIC_RIVER_CARP');
  assert.ok(population, 'high-quality river should contain a carp consumer');
  const before = totalPool(getAquaticFoodPoolForNodes(state, population.occupiedNodeIds));
  const feeding = feedAquaticPopulation(state, population, 1440, getAquaticPopulations(state));
  const after = totalPool(getAquaticFoodPoolForNodes(state, population.occupiedNodeIds));
  assert.ok(feeding.intakeKg > 0 && feeding.foodSatisfaction > 0, 'consumer must obtain food from actual aquatic biomass');
  assert.ok(after < before, 'feeding must reduce physical food biomass rather than only calculate a score');
}

function testStarvationUsesFoodAvailabilityNotDensityProxy(): void {
  const state = fresh('food-web-starvation');
  seedRiver(state);
  const population = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN').find(entry => entry.speciesId === 'AQUATIC_RIVER_CARP');
  assert.ok(population);
  ensureAquaticFoodWebForNodes(state, population.occupiedNodeIds);
  zeroFood(state, population.occupiedNodeIds);
  const beforeCondition = population.bodyCondition;
  state.gameTime.day += 5;
  const now = gameMinute(state);
  for (const entry of getAquaticFoodWebNodeStates(state, population.occupiedNodeIds)) entry.lastUpdatedGameMinute = now;
  tickAquaticEcology(state, 5 * 1440);
  const after = getAquaticPopulations(state).find(entry => entry.id === population.id);
  assert.ok(after);
  assert.ok(after.foodStress >= 95, 'empty real food pools must create severe food stress even when water volume remains healthy');
  assert.ok((after.lastFoodIntakeKg || 0) < (after.lastFoodDemandKg || 0) * 0.1);
  assert.ok(after.bodyCondition < beforeCondition, 'sustained starvation must reduce body condition');
}

function testMesopredatorConsumesRealPrey(): void {
  const state = fresh('food-web-predation');
  seedRiver(state);
  const populations = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN');
  const eel = populations.find(entry => entry.speciesId === 'AQUATIC_FRESHWATER_EEL');
  const forage = populations.find(entry => entry.speciesId === 'AQUATIC_FORAGE_FISH');
  assert.ok(eel && forage, 'perennial river fixture should support eel and forage fish trophic levels');
  assert.ok(eel.occupiedNodeIds.some(nodeId => forage.occupiedNodeIds.includes(nodeId)));
  const beforeCount = forage.population;
  const result = feedAquaticPopulation(state, eel, 7 * 1440, populations);
  assert.ok(result.preyKilled > 0 && result.preyIntakeKg > 0, 'mesopredator must consume real prey individuals when prey is abundant');
  assert.ok(forage.population < beforeCount, 'predation must remove individuals from the real forage population');
  assert.equal(forage.population, forage.juveniles + forage.adults + forage.old, 'predation must preserve prey age-structure accounting');
}

function testNaturalMortalityReturnsBiomassToFoodWeb(): void {
  const state = fresh('food-web-carrion');
  seedRiver(state);
  const population = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN').find(entry => entry.speciesId === 'AQUATIC_RIVER_CARP');
  assert.ok(population && population.population > 5);
  ensureAquaticFoodWebForNodes(state, population.occupiedNodeIds);
  const beforeCarrion = getAquaticFoodWebNodeStates(state, population.occupiedNodeIds).reduce((sum, entry) => sum + entry.carrionKg + entry.detritusKg, 0);
  population.mortalityProgress += 3.2;
  state.gameTime.minuteOfDay += 120;
  const now = gameMinute(state);
  for (const entry of getAquaticFoodWebNodeStates(state, population.occupiedNodeIds)) entry.lastUpdatedGameMinute = now;
  tickAquaticEcology(state, 120);
  const afterCarrion = getAquaticFoodWebNodeStates(state, population.occupiedNodeIds).reduce((sum, entry) => sum + entry.carrionKg + entry.detritusKg, 0);
  assert.ok(afterCarrion > beforeCarrion, 'natural deaths must become carrion/detritus instead of disappearing from the ecosystem');
}

function main(): void {
  testFoodWebMaterializesOnlyOnRealWater();
  testConsumersRemoveRealResourceBiomass();
  testStarvationUsesFoodAvailabilityNotDensityProxy();
  testMesopredatorConsumesRealPrey();
  testNaturalMortalityReturnsBiomassToFoodWeb();
  console.log('Aquatic food-web smoke tests passed.');
}

main();
