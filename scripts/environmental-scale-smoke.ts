import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { MainWorldAreaId } from '../src/data/mainWorldAreas';
import '../src/types/hydrologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';
import { createWorldHydrologyState, tickWorldHydrology } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork } from '../src/simulation/hydrologySurfaceWaterSystem';
import {
  configureWaterInfrastructure,
  ensureWaterInfrastructureBindings,
  getWaterInfrastructureByStructure,
  tickWaterManagement,
} from '../src/simulation/waterManagementSystem';
import {
  finalizeEnvironmentalWaterManagementScale,
  getAquaticEcologicalRepresentationScale,
  getEffectiveEnvironmentalStorageM3,
  getEnvironmentalWaterManagementScale,
  prepareEnvironmentalWaterManagementScale,
  tickAquaticEcologyAtEnvironmentalScale,
} from '../src/simulation/environmentalScaleSystem';
import { createWorldEcologyState, ensureRegionEcology } from '../src/simulation/ecologySystem';

function fresh(seed = 'environmental-scale-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.constructionJobs = [];
  state.hydrologySystem = createWorldHydrologyState();
  state.ecologySystem = createWorldEcologyState();
  state.buildings = [];
  state.weather.current = 'clear';
  state.weather.rainIntensity = 0;
  return state;
}

function addBuiltWaterStructure(
  state: GameState,
  buildingId: string,
  structureId: string,
  poiId: MainWorldAreaId,
  cellId: string,
): void {
  const grid = getOrCreatePoiBuildGrid(state, poiId);
  state.buildings.push({
    id: structureId,
    buildingId,
    condition: 100,
    isBuilt: true,
    buildProgressSeconds: 100,
    totalBuildSeconds: 100,
    areaId: poiId,
    placement: [{ cellId, areaM2: Math.min(8, grid.cells.find(cell => cell.id === cellId)?.areaM2 || 8) }],
    footprintAreaM2: 8,
  });
}

function managedNode(state: GameState, structureId: string) {
  return state.hydrologySystem!.nodesById[`HYDRO_MANAGED_${structureId}`];
}

function prepareReceiver(
  state: GameState,
  poiId: MainWorldAreaId,
  sourceElevationM: number,
  prefix: string,
) {
  const grid = getOrCreatePoiBuildGrid(state, poiId);
  const low = [...grid.cells].sort((a, b) => a.elevation - b.elevation)[0];
  const high = [...grid.cells].sort((a, b) => b.elevation - a.elevation)[0];
  addBuiltWaterStructure(state, 'BUILDING_BAMBOO_WATER_CHANNEL', `${prefix}_channel`, poiId, high.id);
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', `${prefix}_pond`, poiId, low.id);
  ensureWaterInfrastructureBindings(state);
  const channel = getWaterInfrastructureByStructure(state, `${prefix}_channel`)!;
  const pond = managedNode(state, `${prefix}_pond`);
  pond.elevationM = Math.min(pond.elevationM, sourceElevationM - 2);
  return { channel, pond };
}

function runScaledManagement(state: GameState, minutes = 60): void {
  const snapshot = prepareEnvironmentalWaterManagementScale(state);
  try {
    tickWaterManagement(state, minutes);
  } finally {
    finalizeEnvironmentalWaterManagementScale(state, snapshot);
  }
}

function testMacroNaturalStorageIsRepresentativeNotABucket(): void {
  const state = fresh('macro-water-scale');
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  const source = state.hydrologySystem!.nodesById.HYDRO_GORGE_EXIT;
  source.storageM3 = 1;
  source.outflowM3H = 0;
  source.elevationM = 100;
  const { channel, pond } = prepareReceiver(state, 'AREA_WATERFALL_BASIN', source.elevationM, 'macro');
  configureWaterInfrastructure(state, channel.id, {
    inputNodeIds: [source.id],
    outputNodeIds: [pond.id],
    desiredFlowM3H: 0.3,
  });

  const scale = getEnvironmentalWaterManagementScale(source);
  const effectiveBefore = getEffectiveEnvironmentalStorageM3(source);
  const representativeBefore = source.storageM3;
  runScaledManagement(state, 60);
  const representativeDepletion = representativeBefore - source.storageM3;
  const effectiveDepletion = representativeDepletion * scale;

  assert.ok(scale >= 100, 'macro natural water must use landscape-scale storage accounting');
  assert.ok(pond.storageM3 > 0.2, 'real diverted water must still arrive in player storage');
  assert.ok(representativeDepletion > 0 && representativeDepletion < 0.002, 'hundreds of liters must be only a tiny change to a macro representative control volume');
  assert.ok(effectiveDepletion > 0.2, 'representative depletion multiplied by landscape scale must account for the real withdrawn volume');
  assert.ok(effectiveBefore >= 100, 'effective environmental storage must be much larger than the representative node value');
}

function testLocalNaturalPoolRemainsExhaustible(): void {
  const state = fresh('local-pool-scale');
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_WATERFALL_BASIN');
  const sourceCell = [...grid.cells].sort((a, b) => b.elevation - a.elevation)[0];
  const sourceId = 'TEST_LOCAL_DEPRESSION';
  state.hydrologySystem!.nodesById[sourceId] = {
    id: sourceId,
    kind: 'depression',
    poiId: 'AREA_WATERFALL_BASIN',
    cellId: sourceCell.id,
    elevationM: sourceCell.elevation + 4,
    storageM3: 0.2,
    capacityM3: 0.2,
    waterLevelM: 0.18,
    inflowM3H: 0,
    outflowM3H: 0,
    active: true,
  };
  const source = state.hydrologySystem!.nodesById[sourceId];
  const { channel, pond } = prepareReceiver(state, 'AREA_WATERFALL_BASIN', source.elevationM, 'local');
  configureWaterInfrastructure(state, channel.id, {
    inputNodeIds: [source.id],
    outputNodeIds: [pond.id],
    desiredFlowM3H: 0.1,
  });

  const before = source.storageM3;
  runScaledManagement(state, 60);
  assert.equal(getEnvironmentalWaterManagementScale(source), 1, 'local depressions must remain literal physical water');
  assert.ok(source.storageM3 < before - 0.08, 'a small isolated pool must be meaningfully depleted by a 100 L withdrawal');
  assert.ok(pond.storageM3 > 0.08, 'withdrawn local water must physically arrive downstream after primitive leakage');
}

function testCoastIsBoundaryNotExhaustibleStorage(): void {
  const state = fresh('coastal-boundary-scale');
  ensureSurfaceWaterNetwork(state, 'AREA_FISHING_LAGOON');
  const source = state.hydrologySystem!.nodesById.HYDRO_ROCKY_SHORE_COAST;
  source.storageM3 = 0.05;
  source.outflowM3H = 0;
  source.elevationM = 100;
  const { channel, pond } = prepareReceiver(state, 'AREA_FISHING_LAGOON', source.elevationM, 'coast');
  configureWaterInfrastructure(state, channel.id, {
    inputNodeIds: [source.id],
    outputNodeIds: [pond.id],
    desiredFlowM3H: 0.25,
  });

  const before = source.storageM3;
  runScaledManagement(state, 60);
  assert.equal(source.storageM3, before, 'coastal boundary storage must not be depleted by player withdrawal bookkeeping');
  assert.ok(pond.storageM3 > 0.2, 'boundary source may still feed a configured transfer within infrastructure capacity');
  assert.equal(getEffectiveEnvironmentalStorageM3(source), Number.POSITIVE_INFINITY, 'coast must expose non-exhaustible boundary semantics at this simulation scale');
}

function testAquaticEcologyUsesReachScaleButRestoresHydrology(): void {
  const state = fresh('aquatic-ecological-scale');
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  ensureRegionEcology(state, 'AREA_WATERFALL_BASIN');
  const river = state.hydrologySystem!.nodesById.HYDRO_GORGE_EXIT;
  river.storageM3 = 2;
  river.outflowM3H = 4;
  river.active = true;
  const beforeStorage = river.storageM3;
  const beforeCapacity = river.capacityM3;
  const scale = getAquaticEcologicalRepresentationScale(river);
  tickAquaticEcologyAtEnvironmentalScale(state, 60);

  assert.ok(scale > 8, 'macro river ecology must see a reach-scale volume rather than a tiny grid control volume');
  assert.equal(river.storageM3, beforeStorage, 'temporary ecological scaling must not fabricate physical hydrology storage');
  assert.equal(river.capacityM3, beforeCapacity, 'temporary ecological scaling must restore hydrology capacity exactly');
}

function testWeatherFluxDominatesHumanScaleUse(): void {
  const state = fresh('weather-dominance');
  ensureSurfaceWaterNetwork(state, 'AREA_FOREST_EDGE');
  state.weather.current = 'heavy_rain';
  state.weather.rainIntensity = 0.55;
  const watershedId = state.hydrologySystem!.regionsByPoiId.AREA_FOREST_EDGE!.watershedId;
  const before = state.hydrologySystem!.watershedsById[watershedId].rainfallInputM3;
  tickWorldHydrology(state, 60);
  const rainInput = state.hydrologySystem!.watershedsById[watershedId].rainfallInputM3 - before;
  const onePersonThirtyDaysM3 = 0.005 * 30;

  assert.ok(rainInput > onePersonThirtyDaysM3 * 100, 'one tropical rain hour should dwarf a survivor-scale month of drinking water in watershed accounting');
}

function run(): void {
  testMacroNaturalStorageIsRepresentativeNotABucket();
  testLocalNaturalPoolRemainsExhaustible();
  testCoastIsBoundaryNotExhaustibleStorage();
  testAquaticEcologyUsesReachScaleButRestoresHydrology();
  testWeatherFluxDominatesHumanScaleUse();
  console.log('environmental scale smoke: ok');
}

run();
