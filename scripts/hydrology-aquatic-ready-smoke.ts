import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/hydrologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldHydrologyState } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork } from '../src/simulation/hydrologySurfaceWaterSystem';
import {
  getAquaticBarriers,
  getAquaticConnectivityLinks,
  getCellHydroperiod,
  getConnectedAquaticWaterBody,
  queryAquaticHabitatCandidates,
  queryAquaticWaterBodies,
} from '../src/simulation/aquaticHydrologySystem';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';

function fresh(seed = 'aquatic-ready-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  state.hydrologySystem = createWorldHydrologyState();
  return state;
}

function primeRiverGorge(state: GameState): { edgeId: string; fromNodeId: string; toNodeId: string; fromCellId: string; toCellId: string } {
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  const system = state.hydrologySystem!;
  const edge = system.edgesById.HYDRO_EDGE_GORGE_ENTRY_TO_FALL;
  assert.ok(edge, 'anchored River Gorge reach must exist');
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
    node.storageM3 = Math.max(12, node.storageM3);
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
    hydro.observedHours = 100;
    hydro.floodedHours = 82;
    hydro.reliableWaterAccess = 94;
    hydro.dissolvedOxygenMgL = 8.7;
    hydro.turbidity = 12;
    hydro.contamination = 3;
    hydro.salinityPpt = 0;
  }
  return { edgeId: edge.id, fromNodeId: from.id, toNodeId: to.id, fromCellId: from.cellId, toCellId: to.cellId };
}

function testHydroperiodUsesObservedWaterHistory(): void {
  const state = fresh('hydroperiod-history');
  const primed = primeRiverGorge(state);
  const period = getCellHydroperiod(state, 'AREA_WATERFALL_BASIN', primed.fromCellId)!;
  assert.equal(period.currentWet, true);
  assert.ok(period.wetFraction >= 0.8, 'hydroperiod must retain observed flooded-time history');
  assert.equal(period.classification, 'perennial', 'high historical presence/reliability should classify as perennial');
}

function testHabitatCriteriaCloseUnsuitableReach(): void {
  const state = fresh('aquatic-criteria');
  const primed = primeRiverGorge(state);
  const edge = state.hydrologySystem!.edgesById[primed.edgeId];
  edge.dissolvedOxygenMgL = 1.4;
  const lowOxygen = getAquaticConnectivityLinks(state, 'AREA_WATERFALL_BASIN', { minDissolvedOxygenMgL: 4.5 })
    .find(link => link.edgeId === primed.edgeId)!;
  assert.equal(lowOxygen.hydraulicOpen, false);
  assert.ok(lowOxygen.limitingFactors.includes('low_oxygen'));

  edge.dissolvedOxygenMgL = 8.7;
  edge.flowVelocityMps = 4.1;
  const tooFast = getAquaticConnectivityLinks(state, 'AREA_WATERFALL_BASIN', { maxVelocityMps: 1.5 })
    .find(link => link.edgeId === primed.edgeId)!;
  assert.equal(tooFast.hydraulicOpen, false);
  assert.ok(tooFast.limitingFactors.includes('flow_too_fast'));
}

function testWeirSeparatesHydraulicAndBiologicalConnectivity(): void {
  const state = fresh('weir-barrier');
  const primed = primeRiverGorge(state);
  state.buildings.push({
    id: 'test_weir_structure', buildingId: 'BUILDING_SMALL_DIVERSION_WEIR', condition: 100, isBuilt: true,
    buildProgressSeconds: 1, totalBuildSeconds: 1, areaId: 'AREA_WATERFALL_BASIN',
  } as GameState['buildings'][number]);
  state.hydrologySystem!.infrastructure.push({
    id: 'test_weir_infra', structureId: 'test_weir_structure', poiId: 'AREA_WATERFALL_BASIN', kind: 'weir', purpose: 'diversion',
    cellIds: [primed.fromCellId], inputNodeIds: [primed.fromNodeId], outputNodeIds: [], targetCellIds: [],
    capacityM3H: 2.4, desiredFlowM3H: 0.9, currentFlowM3H: 0.9, leakage: 0.03, blockage: 0, gravityRequired: true, active: true,
  });
  const barriers = getAquaticBarriers(state, 'AREA_WATERFALL_BASIN');
  assert.ok(barriers.some(barrier => barrier.affectedEdgeIds.includes(primed.edgeId) && barrier.passability < 0.5), 'weir must create a partial biological barrier on the physical reach');

  const links = getAquaticConnectivityLinks(state, 'AREA_WATERFALL_BASIN', { minimumPassability: 0.5 });
  const reach = links.find(link => link.edgeId === primed.edgeId)!;
  assert.equal(reach.hydraulicOpen, true, 'weir does not erase hydraulic connection');
  assert.equal(reach.biologicalOpen, false, 'species requiring stronger passage must be blocked biologically');
  assert.ok(reach.limitingFactors.includes('biological_barrier'));

  const hydraulicBody = getConnectedAquaticWaterBody(state, 'AREA_WATERFALL_BASIN', primed.fromNodeId, { minimumPassability: 0.5 }, 'hydraulic')!;
  const biologicalBody = getConnectedAquaticWaterBody(state, 'AREA_WATERFALL_BASIN', primed.fromNodeId, { minimumPassability: 0.5 }, 'biological')!;
  assert.ok(hydraulicBody.nodeIds.includes(primed.toNodeId));
  assert.ok(!biologicalBody.nodeIds.includes(primed.toNodeId), 'biological graph must split at an impassable barrier without splitting the hydraulic graph');
}

function testCandidatesComeFromRealWetWaterBodies(): void {
  const wet = fresh('real-water-candidates');
  primeRiverGorge(wet);
  const bodies = queryAquaticWaterBodies(wet, 'AREA_WATERFALL_BASIN', { minDepthM: 0.2, minDissolvedOxygenMgL: 4 });
  assert.ok(bodies.length > 0, 'a physically wet connected river must be queryable as a water body');
  const candidates = queryAquaticHabitatCandidates(wet, 'AREA_WATERFALL_BASIN', {
    minDepthM: 0.2,
    maxDepthM: 3,
    minDissolvedOxygenMgL: 4,
    maxVelocityMps: 2,
    maxSalinityPpt: 2,
    maxTurbidity: 80,
    maxContamination: 60,
  });
  assert.ok(candidates.length > 0, 'aquatic candidate must be derived from real hydrology');
  assert.ok(candidates[0].cellIds.length > 0 && candidates[0].currentVolumeM3 > 0);

  const dry = fresh('dry-water-candidates');
  ensureSurfaceWaterNetwork(dry, 'AREA_ANCIENT_RUINS');
  const system = dry.hydrologySystem!;
  const region = system.regionsByPoiId.AREA_ANCIENT_RUINS!;
  for (const id of region.cellStateIds) {
    const hydro = system.cellStatesById[id];
    hydro.surfaceWaterDepthM = 0;
    hydro.inflowM3H = 0;
    hydro.outflowM3H = 0;
    hydro.reliableWaterAccess = 0;
    hydro.observedHours = 100;
    hydro.floodedHours = 0;
  }
  for (const node of Object.values(system.nodesById).filter(node => node.poiId === 'AREA_ANCIENT_RUINS')) {
    node.active = false;
    node.storageM3 = 0;
    node.inflowM3H = 0;
    node.outflowM3H = 0;
    node.waterLevelM = 0;
  }
  for (const edge of Object.values(system.edgesById).filter(edge => edge.fromPoiId === 'AREA_ANCIENT_RUINS' || edge.toPoiId === 'AREA_ANCIENT_RUINS')) {
    edge.dischargeM3H = 0;
    edge.depthM = 0;
  }
  assert.equal(queryAquaticHabitatCandidates(dry, 'AREA_ANCIENT_RUINS', { minDepthM: 0.1 }).length, 0, 'dry terrain must not fabricate an aquatic site from biome or legacy water-access priors');
}

function main(): void {
  testHydroperiodUsesObservedWaterHistory();
  testHabitatCriteriaCloseUnsuitableReach();
  testWeirSeparatesHydraulicAndBiologicalConnectivity();
  testCandidatesComeFromRealWetWaterBodies();
  console.log('Aquatic-ready hydrology smoke tests passed.');
}

main();
