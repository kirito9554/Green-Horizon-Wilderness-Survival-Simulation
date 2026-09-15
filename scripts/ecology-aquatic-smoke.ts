import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/hydrologySimulation';
import '../src/types/aquaticEcology';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldHydrologyState } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork } from '../src/simulation/hydrologySurfaceWaterSystem';
import { getConnectedAquaticWaterBody } from '../src/simulation/aquaticHydrologySystem';
import { createWorldEcologyState, ensureRegionEcology } from '../src/simulation/ecologySystem';
import {
  ensureAquaticEcology,
  ensureRegionAquaticEcology,
  estimateAquaticCarryingCapacity,
  getAquaticPopulations,
  tickAquaticEcology,
} from '../src/simulation/ecologyAquaticSystem';
import { WILD_AQUATIC_SPECIES } from '../src/data/ecologyAquatic';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';

function fresh(seed = 'aquatic-ecology-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  state.hydrologySystem = createWorldHydrologyState();
  state.ecologySystem = createWorldEcologyState();
  return state;
}

function primeRiverGorge(state: GameState): { edgeId: string; fromNodeId: string; toNodeId: string; fromCellId: string; toCellId: string } {
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
    node.storageM3 = 24;
    node.capacityM3 = Math.max(node.capacityM3, 30);
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
    hydro.floodedHours = 210;
    hydro.reliableWaterAccess = 96;
    hydro.dissolvedOxygenMgL = 8.7;
    hydro.turbidity = 12;
    hydro.contamination = 3;
    hydro.salinityPpt = 0;
  }
  return { edgeId: edge.id, fromNodeId: from.id, toNodeId: to.id, fromCellId: from.cellId, toCellId: to.cellId };
}

function seedRiver(state: GameState): void {
  primeRiverGorge(state);
  ensureRegionEcology(state, 'AREA_WATERFALL_BASIN');
  ensureRegionAquaticEcology(state, 'AREA_WATERFALL_BASIN');
}

function testWetHydrologySeedsRealPopulations(): void {
  const state = fresh('aquatic-seeding');
  const primed = primeRiverGorge(state);
  ensureRegionEcology(state, 'AREA_WATERFALL_BASIN');
  ensureRegionAquaticEcology(state, 'AREA_WATERFALL_BASIN');
  const populations = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN');
  assert.ok(populations.length > 0, 'strong perennial river habitat should materialize at least one natural aquatic population');
  for (const population of populations) {
    assert.equal(population.population, population.juveniles + population.adults + population.old, 'aquatic age structure must conserve head count');
    assert.ok(population.biomassKg > 0 && population.occupiedNodeIds.length > 0);
  }
  const carp = populations.find(population => population.speciesId === 'AQUATIC_RIVER_CARP');
  assert.ok(carp, 'high-quality freshwater river should deterministically support river carp for this seed');
  const body = getConnectedAquaticWaterBody(state, 'AREA_WATERFALL_BASIN', primed.fromNodeId, WILD_AQUATIC_SPECIES.AQUATIC_RIVER_CARP.hydrologyCriteria, 'biological')!;
  assert.ok(estimateAquaticCarryingCapacity(body, WILD_AQUATIC_SPECIES.AQUATIC_RIVER_CARP) >= carp.population, 'initial population must not exceed physical carrying capacity');
}

function testLowOxygenCreatesRealStressAndMortality(): void {
  const state = fresh('aquatic-low-oxygen');
  seedRiver(state);
  const population = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN').find(entry => entry.speciesId === 'AQUATIC_RIVER_CARP')!;
  assert.ok(population);
  const before = population.population;
  for (const nodeId of population.occupiedNodeIds) {
    const node = state.hydrologySystem!.nodesById[nodeId];
    if (!node) continue;
    node.dissolvedOxygenMgL = 0.8;
    if (node.cellId) state.hydrologySystem!.cellStatesById[`${node.poiId}:${node.cellId}`].dissolvedOxygenMgL = 0.8;
  }
  for (const edge of Object.values(state.hydrologySystem!.edgesById)) {
    if (population.occupiedNodeIds.includes(edge.fromNodeId) || population.occupiedNodeIds.includes(edge.toNodeId)) edge.dissolvedOxygenMgL = 0.8;
  }
  state.gameTime.day += 30;
  tickAquaticEcology(state, 30 * 1440);
  const after = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN').find(entry => entry.id === population.id);
  assert.ok(!after || after.population < before, 'sustained hypoxia must kill real individuals rather than only set a cosmetic status');
  if (after) assert.ok(after.oxygenStress > 50 && after.averageHealth < population.averageHealth + 0.001);
}

function testBarrierSplitsAndReconnectsWithoutDuplication(): void {
  const state = fresh('aquatic-split-merge');
  const primed = primeRiverGorge(state);
  ensureRegionEcology(state, 'AREA_WATERFALL_BASIN');
  ensureRegionAquaticEcology(state, 'AREA_WATERFALL_BASIN');
  const original = getAquaticPopulations(state, 'AREA_WATERFALL_BASIN').find(entry => entry.speciesId === 'AQUATIC_RIVER_CARP')!;
  assert.ok(original && original.occupiedNodeIds.includes(primed.fromNodeId) && original.occupiedNodeIds.includes(primed.toNodeId));
  const total = original.population;
  ensureAquaticEcology(state).aquaticPopulations = [original];

  state.buildings.push({
    id: 'aquatic_test_weir_structure', buildingId: 'BUILDING_SMALL_DIVERSION_WEIR', condition: 100, isBuilt: true,
    buildProgressSeconds: 1, totalBuildSeconds: 1, areaId: 'AREA_WATERFALL_BASIN',
  } as GameState['buildings'][number]);
  state.hydrologySystem!.infrastructure.push({
    id: 'aquatic_test_weir', structureId: 'aquatic_test_weir_structure', poiId: 'AREA_WATERFALL_BASIN', kind: 'weir', purpose: 'diversion',
    cellIds: [primed.fromCellId], inputNodeIds: [primed.fromNodeId], outputNodeIds: [], targetCellIds: [],
    capacityM3H: 2.4, desiredFlowM3H: 0.9, currentFlowM3H: 0.9, leakage: 0.03, blockage: 0.95, gravityRequired: true, active: true,
  });
  tickAquaticEcology(state, 0);
  const split = getAquaticPopulations(state).filter(entry => entry.speciesId === original.speciesId);
  assert.ok(split.length >= 2, 'an impassable biological barrier must split a previously connected population');
  assert.equal(split.reduce((sum, entry) => sum + entry.population, 0), total, 'connectivity split must conserve every individual');

  state.hydrologySystem!.infrastructure[0].active = false;
  tickAquaticEcology(state, 0);
  const merged = getAquaticPopulations(state).filter(entry => entry.speciesId === original.speciesId);
  assert.equal(merged.length, 1, 'removing the barrier must allow compatible daughter populations to reconnect');
  assert.equal(merged[0].population, total, 'reconnection must merge without duplicating or deleting individuals');
}

function testDryRegionDoesNotFabricateFish(): void {
  const state = fresh('aquatic-dry-region');
  ensureSurfaceWaterNetwork(state, 'AREA_ANCIENT_RUINS');
  const system = state.hydrologySystem!;
  const region = system.regionsByPoiId.AREA_ANCIENT_RUINS!;
  for (const id of region.cellStateIds) {
    const hydro = system.cellStatesById[id];
    hydro.surfaceWaterDepthM = 0;
    hydro.inflowM3H = 0;
    hydro.outflowM3H = 0;
    hydro.reliableWaterAccess = 0;
    hydro.observedHours = 120;
    hydro.floodedHours = 0;
  }
  for (const node of Object.values(system.nodesById).filter(node => node.poiId === 'AREA_ANCIENT_RUINS')) {
    node.active = false; node.storageM3 = 0; node.inflowM3H = 0; node.outflowM3H = 0; node.waterLevelM = 0;
  }
  for (const edge of Object.values(system.edgesById).filter(edge => edge.fromPoiId === 'AREA_ANCIENT_RUINS' || edge.toPoiId === 'AREA_ANCIENT_RUINS')) {
    edge.dischargeM3H = 0; edge.depthM = 0;
  }
  ensureRegionEcology(state, 'AREA_ANCIENT_RUINS');
  ensureRegionAquaticEcology(state, 'AREA_ANCIENT_RUINS');
  assert.equal(getAquaticPopulations(state, 'AREA_ANCIENT_RUINS').length, 0, 'dry terrain must not spawn aquatic populations from biome labels or legacy waterAccess');
}

function main(): void {
  testWetHydrologySeedsRealPopulations();
  testLowOxygenCreatesRealStressAndMortality();
  testBarrierSplitsAndReconnectsWithoutDuplication();
  testDryRegionDoesNotFabricateFish();
  console.log('Aquatic ecology foundation smoke tests passed.');
}

main();
