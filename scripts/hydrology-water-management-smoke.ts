import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { MainWorldAreaId } from '../src/data/mainWorldAreas';
import '../src/types/hydrologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';
import { createWorldHydrologyState } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork } from '../src/simulation/hydrologySurfaceWaterSystem';
import {
  configureWaterInfrastructure,
  createWaterManagementNetwork,
  ensureWaterInfrastructureBindings,
  getWaterInfrastructureByStructure,
  registerWaterDemand,
  setWaterAllocationPolicy,
  tickWaterManagement,
} from '../src/simulation/waterManagementSystem';
import { SOIL_HYDROLOGY_PROFILES } from '../src/data/hydrologyProfiles';
import { migrateGameState } from '../src/save/migrations';

function fresh(seed = 'water-management-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.constructionJobs = [];
  state.hydrologySystem = createWorldHydrologyState();
  state.weather.current = 'clear';
  state.weather.rainIntensity = 0;
  return state;
}

function addBuiltWaterStructure(
  state: GameState,
  buildingId: string,
  structureId: string,
  poiId: MainWorldAreaId,
  cellId?: string,
  condition = 100,
): string {
  const grid = getOrCreatePoiBuildGrid(state, poiId);
  const chosen = cellId || grid.cells[0].id;
  state.buildings.push({
    id: structureId,
    buildingId,
    condition,
    isBuilt: true,
    buildProgressSeconds: 100,
    totalBuildSeconds: 100,
    areaId: poiId,
    placement: [{ cellId: chosen, areaM2: Math.min(8, grid.cells.find(cell => cell.id === chosen)?.areaM2 || 8) }],
    footprintAreaM2: 8,
  });
  return chosen;
}

function managedNode(state: GameState, structureId: string) {
  return state.hydrologySystem!.nodesById[`HYDRO_MANAGED_${structureId}`];
}

function testBindingsUseRealStructuresAndDoNotCreateConstructionJobs(): void {
  const state = fresh('binding-seed');
  const jobsBefore = state.buildingSimulation!.constructionJobs!.length;
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'pond_binding', 'AREA_CAMP_CLEARING');
  ensureWaterInfrastructureBindings(state);
  ensureWaterInfrastructureBindings(state);
  const bindings = state.hydrologySystem!.infrastructure.filter(infrastructure => infrastructure.structureId === 'pond_binding');
  assert.equal(bindings.length, 1, 'one completed structure must map to exactly one hydraulic binding');
  assert.equal(state.buildingSimulation!.constructionJobs!.length, jobsBefore, 'Hydrology must never create a parallel construction queue');
  assert.equal(managedNode(state, 'pond_binding').storageM3, 0, 'new earthen pond must start physically empty');
  state.buildings.find(building => building.id === 'pond_binding')!.condition = 0;
  ensureWaterInfrastructureBindings(state);
  assert.equal(bindings[0].active, false, 'binding availability must follow the real structure condition');
}

function testRainCollectorOnlyCollectsActualRain(): void {
  const state = fresh('rain-collector-seed');
  addBuiltWaterStructure(state, 'BUILDING_RAIN_COLLECTOR', 'collector_1', 'AREA_CAMP_CLEARING');
  ensureWaterInfrastructureBindings(state);
  const node = managedNode(state, 'collector_1');
  assert.ok(node && node.capacityM3 > 0);
  tickWaterManagement(state, 60);
  assert.equal(node.storageM3, 0, 'collector must not create water under clear dry weather');
  state.weather.current = 'heavy_rain';
  state.weather.rainIntensity = 0.7;
  tickWaterManagement(state, 30);
  assert.ok(node.storageM3 > 0, 'collector must gain water from actual rain forcing');
  assert.ok(node.storageM3 <= node.capacityM3, 'collector storage must respect physical capacity');
}

function prepareGorgeSource(state: GameState): void {
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  ensureSurfaceWaterNetwork(state, 'AREA_MANGROVE_EDGE');
  const source = state.hydrologySystem!.nodesById.HYDRO_GORGE_EXIT;
  source.outflowM3H = 2;
  source.storageM3 = 0;
  const edge = state.hydrologySystem!.edgesById.HYDRO_EDGE_GORGE_TO_ESTUARY;
  assert.ok(edge);
  edge.dischargeM3H = 2;
}

function testDiversionConservesWithdrawnWaterAndReducesDownstreamFlow(): void {
  const state = fresh('diversion-seed');
  prepareGorgeSource(state);
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_WATERFALL_BASIN');
  const low = [...grid.cells].sort((a, b) => a.elevation - b.elevation)[0];
  addBuiltWaterStructure(state, 'BUILDING_SMALL_DIVERSION_WEIR', 'weir_1', 'AREA_WATERFALL_BASIN', grid.cells[0].id);
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'pond_diversion', 'AREA_WATERFALL_BASIN', low.id);
  ensureWaterInfrastructureBindings(state);
  const weir = getWaterInfrastructureByStructure(state, 'weir_1')!;
  const pondNode = managedNode(state, 'pond_diversion');
  const source = state.hydrologySystem!.nodesById.HYDRO_GORGE_EXIT;
  source.elevationM = Math.max(source.elevationM, pondNode.elevationM + 3);
  configureWaterInfrastructure(state, weir.id, {
    inputNodeIds: [source.id],
    outputNodeIds: [pondNode.id],
    desiredFlowM3H: 0.9,
  });
  const beforeDownstream = state.hydrologySystem!.edgesById.HYDRO_EDGE_GORGE_TO_ESTUARY.dischargeM3H;
  const terrainBefore = state.hydrologySystem!.cellStatesById[`AREA_WATERFALL_BASIN:${weir.cellIds![0]}`].surfaceWaterDepthM;
  tickWaterManagement(state, 60);
  const afterDownstream = state.hydrologySystem!.edgesById.HYDRO_EDGE_GORGE_TO_ESTUARY.dischargeM3H;
  const leakedDepth = state.hydrologySystem!.cellStatesById[`AREA_WATERFALL_BASIN:${weir.cellIds![0]}`].surfaceWaterDepthM - terrainBefore;
  const grossWithdrawn = beforeDownstream - afterDownstream;
  const leakedM3 = leakedDepth * grid.cells.find(cell => cell.id === weir.cellIds![0])!.areaM2;
  assert.ok(grossWithdrawn > 0, 'weir must withdraw from real source discharge');
  assert.ok(afterDownstream < beforeDownstream, 'diversion must reduce downstream river flow');
  assert.ok(pondNode.storageM3 > 0, 'diverted water must arrive in the configured storage pond');
  assert.ok(leakedM3 > 0, 'primitive diversion loss must return to physical terrain');
  assert.ok(Math.abs(grossWithdrawn - (pondNode.storageM3 + leakedM3)) < 0.03, 'withdrawn water must equal stored plus returned leakage within rounding tolerance');
}

function runChannelTransfer(condition: number): { stored: number; leakedDepth: number } {
  const state = fresh(`channel-condition-${condition}`);
  prepareGorgeSource(state);
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_WATERFALL_BASIN');
  const low = [...grid.cells].sort((a, b) => a.elevation - b.elevation)[0];
  addBuiltWaterStructure(state, 'BUILDING_BAMBOO_WATER_CHANNEL', `channel_${condition}`, 'AREA_WATERFALL_BASIN', grid.cells[0].id, condition);
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', `pond_${condition}`, 'AREA_WATERFALL_BASIN', low.id);
  ensureWaterInfrastructureBindings(state);
  const channel = getWaterInfrastructureByStructure(state, `channel_${condition}`)!;
  const pond = managedNode(state, `pond_${condition}`);
  const source = state.hydrologySystem!.nodesById.HYDRO_GORGE_EXIT;
  source.elevationM = pond.elevationM + 4;
  configureWaterInfrastructure(state, channel.id, { inputNodeIds: [source.id], outputNodeIds: [pond.id], desiredFlowM3H: 0.5 });
  const hydro = state.hydrologySystem!.cellStatesById[`AREA_WATERFALL_BASIN:${channel.cellIds![0]}`];
  const before = hydro.surfaceWaterDepthM;
  tickWaterManagement(state, 60);
  return { stored: pond.storageM3, leakedDepth: hydro.surfaceWaterDepthM - before };
}

function testDamageUsesStructureConditionAndIncreasesLeakage(): void {
  const healthy = runChannelTransfer(100);
  const damaged = runChannelTransfer(30);
  assert.ok(healthy.stored > damaged.stored, 'damaged real structure condition must reduce delivered flow');
  assert.ok(damaged.leakedDepth > healthy.leakedDepth, 'damaged channel must leak more water onto terrain');
}

function testGravityCannotMoveWaterUphill(): void {
  const state = fresh('gravity-seed');
  ensureSurfaceWaterNetwork(state, 'AREA_WATERFALL_BASIN');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_WATERFALL_BASIN');
  const high = [...grid.cells].sort((a, b) => b.elevation - a.elevation)[0];
  addBuiltWaterStructure(state, 'BUILDING_IRRIGATION_DITCH', 'ditch_uphill', 'AREA_WATERFALL_BASIN', high.id);
  ensureWaterInfrastructureBindings(state);
  const ditch = getWaterInfrastructureByStructure(state, 'ditch_uphill')!;
  const source = state.hydrologySystem!.nodesById.HYDRO_GORGE_EXIT;
  source.elevationM = high.elevation - 2;
  source.outflowM3H = 1;
  configureWaterInfrastructure(state, ditch.id, { inputNodeIds: [source.id], targetCellIds: [high.id], desiredFlowM3H: 0.5, waterUseClass: 'normal_crops' });
  const network = createWaterManagementNetwork(state, 'AREA_WATERFALL_BASIN', [ditch.id], 'balanced')!;
  registerWaterDemand(state, { id: 'uphill_demand', poiId: 'AREA_WATERFALL_BASIN', targetType: 'cells', targetCellIds: [high.id], useClass: 'normal_crops', demandM3H: 0.4, minimumM3H: 0, networkId: network.id, active: true });
  const before = source.outflowM3H;
  tickWaterManagement(state, 60);
  assert.equal(state.hydrologySystem!.demands!.find(demand => demand.id === 'uphill_demand')!.deliveredM3H, 0, 'gravity irrigation must refuse an uphill destination');
  assert.equal(source.outflowM3H, before, 'failed gravity transfer must not consume source water');
}

function testIrrigationConsumesStorageAndRaisesRealSoilWater(): void {
  const state = fresh('irrigation-seed');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const low = [...grid.cells].sort((a, b) => a.elevation - b.elevation)[0];
  const high = [...grid.cells].sort((a, b) => b.elevation - a.elevation)[0];
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'pond_irrigation', 'AREA_CAMP_CLEARING', high.id);
  addBuiltWaterStructure(state, 'BUILDING_IRRIGATION_DITCH', 'ditch_irrigation', 'AREA_CAMP_CLEARING', high.id);
  ensureWaterInfrastructureBindings(state);
  const pond = managedNode(state, 'pond_irrigation');
  pond.storageM3 = 1;
  const ditch = getWaterInfrastructureByStructure(state, 'ditch_irrigation')!;
  configureWaterInfrastructure(state, ditch.id, { inputNodeIds: [pond.id], targetCellIds: [low.id], desiredFlowM3H: 0.3, waterUseClass: 'normal_crops' });
  const network = createWaterManagementNetwork(state, 'AREA_CAMP_CLEARING', [ditch.id], 'balanced')!;
  registerWaterDemand(state, { id: 'crop_water', poiId: 'AREA_CAMP_CLEARING', targetType: 'cells', targetCellIds: [low.id], useClass: 'normal_crops', demandM3H: 0.25, minimumM3H: 0.1, networkId: network.id, active: true });
  const hydro = state.hydrologySystem!.cellStatesById[`AREA_CAMP_CLEARING:${low.id}`];
  const beforeSoil = hydro.soilWaterMm;
  const beforeStorage = pond.storageM3;
  tickWaterManagement(state, 60);
  assert.ok(pond.storageM3 < beforeStorage, 'irrigation must consume physical stored water');
  assert.ok(hydro.soilWaterMm > beforeSoil || hydro.surfaceWaterDepthM > 0, 'irrigation must alter the real hydrology cell, not a farm-only moisture number');
  assert.ok(state.hydrologySystem!.demands!.find(demand => demand.id === 'crop_water')!.deliveredM3H > 0);
}

function testDrainageRemovesWaterAndStoresItElsewhere(): void {
  const state = fresh('drainage-seed');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const high = [...grid.cells].sort((a, b) => b.elevation - a.elevation)[0];
  const low = [...grid.cells].sort((a, b) => a.elevation - b.elevation)[0];
  addBuiltWaterStructure(state, 'BUILDING_DRAINAGE_DITCH', 'drain_1', 'AREA_CAMP_CLEARING', high.id);
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'pond_drain', 'AREA_CAMP_CLEARING', low.id);
  ensureWaterInfrastructureBindings(state);
  const drain = getWaterInfrastructureByStructure(state, 'drain_1')!;
  const pond = managedNode(state, 'pond_drain');
  const hydro = state.hydrologySystem!.cellStatesById[`AREA_CAMP_CLEARING:${high.id}`];
  const soil = SOIL_HYDROLOGY_PROFILES[high.soilType];
  hydro.surfaceWaterDepthM = 0.05;
  hydro.soilWaterMm = soil.saturationCapacityMm;
  configureWaterInfrastructure(state, drain.id, { targetCellIds: [high.id], outputNodeIds: [pond.id] });
  const beforeWater = hydro.surfaceWaterDepthM * high.areaM2 + hydro.soilWaterMm * high.areaM2 / 1000;
  tickWaterManagement(state, 60);
  const afterWater = hydro.surfaceWaterDepthM * high.areaM2 + hydro.soilWaterMm * high.areaM2 / 1000;
  assert.ok(afterWater < beforeWater, 'drainage must remove actual water from the saturated source cell');
  assert.ok(pond.storageM3 > 0, 'drained water must reach the configured receiving pond');
}

function testAllocationPriorityAndReservePolicy(): void {
  const state = fresh('allocation-seed');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const sorted = [...grid.cells].sort((a, b) => a.elevation - b.elevation);
  const sourceCell = sorted[sorted.length - 1];
  const drinkingCell = sorted[0];
  const cropCell = sorted[1];
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'pond_policy', 'AREA_CAMP_CLEARING', sourceCell.id);
  addBuiltWaterStructure(state, 'BUILDING_IRRIGATION_DITCH', 'ditch_drinking', 'AREA_CAMP_CLEARING', sourceCell.id);
  addBuiltWaterStructure(state, 'BUILDING_IRRIGATION_DITCH', 'ditch_crop', 'AREA_CAMP_CLEARING', sourceCell.id);
  ensureWaterInfrastructureBindings(state);
  const pond = managedNode(state, 'pond_policy');
  pond.storageM3 = 0.5;
  const drinking = getWaterInfrastructureByStructure(state, 'ditch_drinking')!;
  const crop = getWaterInfrastructureByStructure(state, 'ditch_crop')!;
  configureWaterInfrastructure(state, drinking.id, { inputNodeIds: [pond.id], targetCellIds: [drinkingCell.id], waterUseClass: 'drinking' });
  configureWaterInfrastructure(state, crop.id, { inputNodeIds: [pond.id], targetCellIds: [cropCell.id], waterUseClass: 'normal_crops' });
  const network = createWaterManagementNetwork(state, 'AREA_CAMP_CLEARING', [drinking.id, crop.id], 'drinking_first')!;
  registerWaterDemand(state, { id: 'drink', poiId: 'AREA_CAMP_CLEARING', targetType: 'cells', targetCellIds: [drinkingCell.id], useClass: 'drinking', demandM3H: 0.4, minimumM3H: 0, networkId: network.id, active: true });
  registerWaterDemand(state, { id: 'crop', poiId: 'AREA_CAMP_CLEARING', targetType: 'cells', targetCellIds: [cropCell.id], useClass: 'normal_crops', demandM3H: 0.4, minimumM3H: 0, networkId: network.id, active: true });
  tickWaterManagement(state, 60);
  const drinkDelivered = state.hydrologySystem!.demands!.find(demand => demand.id === 'drink')!.deliveredM3H;
  const cropDelivered = state.hydrologySystem!.demands!.find(demand => demand.id === 'crop')!.deliveredM3H;
  assert.ok(drinkDelivered > cropDelivered, 'drinking-first policy must protect drinking demand before normal crops under scarcity');

  pond.storageM3 = 10;
  setWaterAllocationPolicy(state, network.id, 'reserve_first', 0.5);
  state.hydrologySystem!.demands!.find(demand => demand.id === 'drink')!.active = false;
  state.hydrologySystem!.demands!.find(demand => demand.id === 'crop')!.demandM3H = 4;
  tickWaterManagement(state, 60);
  assert.ok(pond.storageM3 >= pond.capacityM3 * 0.5 - 0.0001, 'reserve-first policy must preserve configured storage reserve');
}

function testManagementStateSurvivesSaveLoad(): void {
  const state = fresh('save-water-management');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'pond_save', 'AREA_CAMP_CLEARING', grid.cells[0].id);
  addBuiltWaterStructure(state, 'BUILDING_IRRIGATION_DITCH', 'ditch_save', 'AREA_CAMP_CLEARING', grid.cells[1].id);
  ensureWaterInfrastructureBindings(state);
  const pond = managedNode(state, 'pond_save');
  pond.storageM3 = 3.25;
  const ditch = getWaterInfrastructureByStructure(state, 'ditch_save')!;
  configureWaterInfrastructure(state, ditch.id, { inputNodeIds: [pond.id], targetCellIds: [grid.cells[2].id], desiredFlowM3H: 0.22 });
  const network = createWaterManagementNetwork(state, 'AREA_CAMP_CLEARING', [ditch.id], 'balanced')!;
  registerWaterDemand(state, { id: 'save_demand', poiId: 'AREA_CAMP_CLEARING', targetType: 'cells', targetCellIds: [grid.cells[2].id], useClass: 'normal_crops', demandM3H: 0.2, minimumM3H: 0.08, networkId: network.id, active: true });
  const loaded = migrateGameState(JSON.parse(JSON.stringify(state)) as GameState);
  assert.equal(loaded.hydrologySystem!.nodesById[pond.id].storageM3, 3.25);
  assert.ok(loaded.hydrologySystem!.infrastructure.some(infrastructure => infrastructure.id === ditch.id && infrastructure.inputNodeIds.includes(pond.id)));
  assert.ok(loaded.hydrologySystem!.demands?.some(demand => demand.id === 'save_demand'));
  assert.ok(loaded.hydrologySystem!.networks.some(candidate => candidate.id === network.id));
}

function main(): void {
  testBindingsUseRealStructuresAndDoNotCreateConstructionJobs();
  testRainCollectorOnlyCollectsActualRain();
  testDiversionConservesWithdrawnWaterAndReducesDownstreamFlow();
  testDamageUsesStructureConditionAndIncreasesLeakage();
  testGravityCannotMoveWaterUphill();
  testIrrigationConsumesStorageAndRaisesRealSoilWater();
  testDrainageRemovesWaterAndStoresItElsewhere();
  testAllocationPriorityAndReservePolicy();
  testManagementStateSurvivesSaveLoad();
  console.log('Player water-management smoke tests passed.');
}

main();
