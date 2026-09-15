import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { MainWorldAreaId } from '../src/data/mainWorldAreas';
import '../src/types/hydrologySimulation';
import { MAIN_WORLD_AREA_IDS } from '../src/data/mainWorldAreas';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldHydrologyState, materializeRegionHydrology, tickWorldHydrology } from '../src/simulation/hydrologySystem';
import {
  addCellContaminationLoad,
  ensureSurfaceWaterNetwork,
  getCurrentTideLevelM,
  getRegionSurfaceWaterEdges,
  tickSurfaceWaterHydrology,
} from '../src/simulation/hydrologySurfaceWaterSystem';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';

function fresh(seed = 'surface-water-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  state.hydrologySystem = createWorldHydrologyState();
  return state;
}

function totalSurfaceDepth(state: GameState, poiId: MainWorldAreaId): number {
  const region = state.hydrologySystem!.regionsByPoiId[poiId];
  return (region?.cellStateIds || []).reduce((sum, id) => sum + (state.hydrologySystem!.cellStatesById[id]?.surfaceWaterDepthM || 0), 0);
}

function totalSediment(state: GameState, poiId: MainWorldAreaId): number {
  const region = state.hydrologySystem!.regionsByPoiId[poiId];
  return (region?.cellStateIds || []).reduce((sum, id) => sum + (state.hydrologySystem!.cellStatesById[id]?.sedimentKg || 0), 0);
}

function testRiverGorgeMajorTopology(): void {
  const state = fresh('major-river-topology');
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  const system = state.hydrologySystem!;
  assert.ok(system.edgesById.HYDRO_EDGE_GORGE_ENTRY_TO_FALL, 'River Gorge must have an anchored entry -> waterfall reach');
  assert.ok(system.edgesById.HYDRO_EDGE_GORGE_FALL_TO_EXIT, 'River Gorge must have an anchored waterfall -> exit reach');
  assert.equal(system.edgesById.HYDRO_EDGE_GORGE_ENTRY_TO_FALL.kind, 'river');
  assert.equal(system.edgesById.HYDRO_EDGE_GORGE_FALL_TO_EXIT.kind, 'waterfall');
  assert.ok(getRegionSurfaceWaterEdges(state, 'AREA_WATERFALL_BASIN').length > 0, 'terrain must also derive local stream/channel reaches');

  const repeat = fresh('major-river-topology');
  ensureSurfaceWaterNetwork(repeat, 'AREA_WATERFALL_BASIN');
  const a = getRegionSurfaceWaterEdges(state, 'AREA_WATERFALL_BASIN').map(edge => [edge.id, edge.fromNodeId, edge.toNodeId, edge.channelCapacityM3H]);
  const b = getRegionSurfaceWaterEdges(repeat, 'AREA_WATERFALL_BASIN').map(edge => [edge.id, edge.fromNodeId, edge.toNodeId, edge.channelCapacityM3H]);
  assert.deepEqual(a, b, 'surface-water topology must be deterministic for the same world seed');
}

function testAquiferCreatesDryWeatherBaseflow(): void {
  const state = fresh('baseflow-seed');
  const region = ensureSurfaceWaterNetwork(state, 'AREA_STONE_RIDGE')!;
  const system = state.hydrologySystem!;
  const aquifer = system.aquifersById[`AQ_${region.watershedId}`];
  const spring = system.nodesById.HYDRO_SPRING_HIGHLANDS;
  assert.ok(aquifer && spring?.cellId);
  const hydro = system.cellStatesById[`AREA_STONE_RIDGE:${spring.cellId}`];
  const beforeStorage = aquifer.storageM3;
  const beforeDepth = hydro.surfaceWaterDepthM;
  state.weather.rainIntensity = 0;
  state.weather.current = 'clear';
  tickSurfaceWaterHydrology(state, 60);
  assert.ok(aquifer.storageM3 < beforeStorage, 'spring baseflow must be withdrawn from real groundwater storage');
  assert.ok(spring.outflowM3H > 0, 'wet aquifer must sustain spring discharge without current rain');
  assert.ok(hydro.surfaceWaterDepthM > beforeDepth, 'baseflow must enter the physical source cell rather than exist only as metadata');
}

function findStateWithDepression(): { state: GameState; poiId: MainWorldAreaId } {
  for (let seed = 0; seed < 30; seed++) {
    for (const poiId of MAIN_WORLD_AREA_IDS) {
      const state = fresh(`depression-spill-${seed}`);
      const region = ensureSurfaceWaterNetwork(state, poiId);
      if (region?.spillwayEdgeIds?.length) return { state, poiId };
    }
  }
  throw new Error('expected procedural terrain to produce at least one local depression/spillway');
}

function testDepressionFillsAndSpills(): void {
  const { state, poiId } = findStateWithDepression();
  const region = state.hydrologySystem!.regionsByPoiId[poiId]!;
  const edge = state.hydrologySystem!.edgesById[region.spillwayEdgeIds![0]];
  const sourceNode = state.hydrologySystem!.nodesById[edge.fromNodeId];
  const targetNode = state.hydrologySystem!.nodesById[edge.toNodeId];
  assert.ok(sourceNode.cellId && targetNode.cellId);
  const grid = getOrCreatePoiBuildGrid(state, poiId);
  const sourceCell = grid.cells.find(cell => cell.id === sourceNode.cellId)!;
  const source = state.hydrologySystem!.cellStatesById[`${poiId}:${sourceNode.cellId}`];
  const target = state.hydrologySystem!.cellStatesById[`${poiId}:${targetNode.cellId}`];
  sourceNode.storageM3 = sourceNode.capacityM3;
  source.surfaceWaterDepthM = sourceNode.capacityM3 / sourceCell.areaM2;
  source.inflowM3H = 9;
  const targetBefore = target.surfaceWaterDepthM;
  const sourceBefore = source.surfaceWaterDepthM;
  tickSurfaceWaterHydrology(state, 60);
  assert.ok(edge.dischargeM3H > 0, 'a full depression with continuing inflow must use its physical spillway');
  assert.ok(target.surfaceWaterDepthM > targetBefore, 'spillwater must reach a neighboring terrain cell');
  assert.ok(source.surfaceWaterDepthM < sourceBefore, 'spillwater must be removed from the source pool, not duplicated');
}

function testBankfullOverflowAndDryRecession(): void {
  const state = fresh('floodplain-seed');
  const region = ensureSurfaceWaterNetwork(state, 'AREA_SWAMP_CROSSING')!;
  const system = state.hydrologySystem!;
  const scale = 980;
  const outlets = region.drainageLinks.filter(link => link.isOutlet);
  assert.ok(outlets.length > 0);
  for (const outlet of outlets) system.cellStatesById[`AREA_SWAMP_CROSSING:${outlet.cellId}`].outflowM3H = 22;
  const before = totalSurfaceDepth(state, 'AREA_SWAMP_CROSSING');
  tickSurfaceWaterHydrology(state, 60);
  const flooded = totalSurfaceDepth(state, 'AREA_SWAMP_CROSSING');
  assert.ok(flooded > before, 'discharge above bankfull must be stored on the physical floodplain');
  assert.ok((region.surfaceDischargeM3H || 0) < outlets.length * 22 * scale, 'floodplain storage must reduce immediate downstream discharge');
  assert.ok(region.cellStateIds.some(id => system.cellStatesById[id].maxObservedFloodDepthM > 0), 'flood history must retain maximum observed depth');

  state.weather.current = 'heat_wave';
  state.weather.rainIntensity = 0;
  state.weather.temperatureC = 38;
  state.weather.humidityPercent = 42;
  tickWorldHydrology(state, 1440);
  tickSurfaceWaterHydrology(state, 1440);
  const afterDry = totalSurfaceDepth(state, 'AREA_SWAMP_CROSSING');
  assert.ok(afterDry < flooded, 'stored floodwater must recede under a long dry interval');
}

function testClearingRaisesSedimentProduction(): void {
  const vegetated = fresh('erosion-seed');
  const cleared = fresh('erosion-seed');
  ensureSurfaceWaterNetwork(vegetated, 'AREA_FOREST_EDGE');
  ensureSurfaceWaterNetwork(cleared, 'AREA_FOREST_EDGE');
  const gridA = getOrCreatePoiBuildGrid(vegetated, 'AREA_FOREST_EDGE');
  const gridB = getOrCreatePoiBuildGrid(cleared, 'AREA_FOREST_EDGE');
  for (const cell of gridA.cells) {
    const hydro = vegetated.hydrologySystem!.cellStatesById[`AREA_FOREST_EDGE:${cell.id}`];
    hydro.runoffMmH = 18;
    hydro.outflowM3H = 0;
    cell.vegetation = 95;
    cell.roots = 90;
  }
  for (const cell of gridB.cells) {
    const hydro = cleared.hydrologySystem!.cellStatesById[`AREA_FOREST_EDGE:${cell.id}`];
    hydro.runoffMmH = 18;
    hydro.outflowM3H = 0;
    cell.vegetation = 0;
    cell.roots = 0;
  }
  tickSurfaceWaterHydrology(vegetated, 60);
  tickSurfaceWaterHydrology(cleared, 60);
  assert.ok(totalSediment(cleared, 'AREA_FOREST_EDGE') > totalSediment(vegetated, 'AREA_FOREST_EDGE') * 1.2, 'cleared terrain must erode substantially more than rooted forest under equal runoff');
}

function testContaminationOnlyAdvectsDownstream(): void {
  const state = fresh('contamination-seed');
  const region = ensureSurfaceWaterNetwork(state, 'AREA_FOREST_EDGE')!;
  const link = region.drainageLinks.find(candidate => candidate.downstreamCellId && candidate.upstreamCellIds.length > 0)
    || region.drainageLinks.find(candidate => candidate.downstreamCellId)!;
  assert.ok(link?.downstreamCellId);
  for (const id of region.cellStateIds) {
    const hydro = state.hydrologySystem!.cellStatesById[id];
    hydro.contaminantLoad = 0;
  }
  const source = state.hydrologySystem!.cellStatesById[`AREA_FOREST_EDGE:${link.cellId}`];
  source.outflowM3H = 12;
  addCellContaminationLoad(state, 'AREA_FOREST_EDGE', link.cellId, 100);
  const upstreamIds = [...link.upstreamCellIds];
  tickSurfaceWaterHydrology(state, 60);
  assert.ok((source.contaminantLoad || 0) < 100, 'flowing water must export part of a contaminant load');
  let cursor: string | undefined = link.downstreamCellId;
  let downstreamLoad = 0;
  const links = new Map(region.drainageLinks.map(entry => [entry.cellId, entry]));
  while (cursor) {
    downstreamLoad += state.hydrologySystem!.cellStatesById[`AREA_FOREST_EDGE:${cursor}`]?.contaminantLoad || 0;
    cursor = links.get(cursor)?.downstreamCellId;
  }
  assert.ok(downstreamLoad > 0, 'contaminant mass must appear downstream');
  for (const upstreamId of upstreamIds) assert.equal(state.hydrologySystem!.cellStatesById[`AREA_FOREST_EDGE:${upstreamId}`]?.contaminantLoad || 0, 0, 'contamination must not travel upstream magically');
}

function testTideIsDynamicBoundaryNotRandomWaterSite(): void {
  const state = fresh('tide-seed');
  ensureSurfaceWaterNetwork(state, 'AREA_CAMP_CLEARING');
  const coast = state.hydrologySystem!.nodesById.HYDRO_PLANE_WRECK_COAST;
  assert.ok(coast.cellId);
  const hydro = state.hydrologySystem!.cellStatesById[`AREA_CAMP_CLEARING:${coast.cellId}`];
  state.gameTime.day = 1;
  state.gameTime.minuteOfDay = 0;
  tickSurfaceWaterHydrology(state, 5);
  const lowPhaseLevel = getCurrentTideLevelM(state);
  const firstDepth = hydro.tidalSurfaceWaterDepthM || 0;
  state.gameTime.minuteOfDay = Math.floor(745 / 4);
  tickSurfaceWaterHydrology(state, 5);
  const highPhaseLevel = getCurrentTideLevelM(state);
  const secondDepth = hydro.tidalSurfaceWaterDepthM || 0;
  assert.notEqual(highPhaseLevel, lowPhaseLevel);
  assert.notEqual(secondDepth, firstDepth, 'coastal water depth must follow tide phase instead of an immutable spawn value');
  assert.ok((hydro.salinityPpt || 0) > 20, 'coastal boundary water must carry marine salinity');
}

function testQualityStateStaysFinite(): void {
  const state = fresh('quality-finite-seed');
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  state.weather.current = 'heavy_rain';
  state.weather.rainIntensity = 0.85;
  tickWorldHydrology(state, 180);
  tickSurfaceWaterHydrology(state, 180);
  const region = state.hydrologySystem!.regionsByPoiId.AREA_WATERFALL_BASIN!;
  for (const id of region.cellStateIds) {
    const hydro = state.hydrologySystem!.cellStatesById[id];
    for (const value of [hydro.surfaceWaterDepthM, hydro.soilWaterMm, hydro.turbidity, hydro.contamination, hydro.dissolvedOxygenMgL || 0, hydro.sedimentKg || 0, hydro.contaminantLoad || 0]) {
      assert.ok(Number.isFinite(value) && value >= 0, `hydrology state must remain finite/non-negative, got ${value}`);
    }
  }
  const waterfall = state.hydrologySystem!.nodesById.HYDRO_GORGE_FALL;
  const waterfallHydro = waterfall.cellId ? state.hydrologySystem!.cellStatesById[`AREA_WATERFALL_BASIN:${waterfall.cellId}`] : undefined;
  assert.ok((waterfallHydro?.dissolvedOxygenMgL || 0) >= 8, 'waterfall aeration should sustain oxygen-rich water');
}

function main(): void {
  testRiverGorgeMajorTopology();
  testAquiferCreatesDryWeatherBaseflow();
  testDepressionFillsAndSpills();
  testBankfullOverflowAndDryRecession();
  testClearingRaisesSedimentProduction();
  testContaminationOnlyAdvectsDownstream();
  testTideIsDynamicBoundaryNotRandomWaterSite();
  testQualityStateStaysFinite();
  console.log('Surface-water hydrology smoke tests passed.');
}

main();
