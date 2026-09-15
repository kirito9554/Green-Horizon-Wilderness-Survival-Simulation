import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { CultivationArea, PlantEntity, AquaticHabitat } from '../src/types/agricultureSimulation';
import '../src/types/agricultureSimulation';
import '../src/types/ecologySimulation';
import '../src/types/hydrologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';
import { createWorldHydrologyState, materializeRegionHydrology } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork } from '../src/simulation/hydrologySurfaceWaterSystem';
import {
  configureWaterInfrastructure,
  ensureWaterInfrastructureBindings,
  tickWaterManagement,
} from '../src/simulation/waterManagementSystem';
import {
  finalizeLivingHydrologyState,
  prepareLivingHydrologyState,
  syncLivingWaterDemands,
} from '../src/simulation/livingHydrologyBridge';
import { tickAgriculture } from '../src/simulation/agricultureSystem';
import { ensureRegionEcology, materializeEcologySubarea, tickWorldEcology } from '../src/simulation/ecologySystem';
import { SOIL_HYDROLOGY_PROFILES } from '../src/data/hydrologyProfiles';

function fresh(seed = 'living-hydrology-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.constructionJobs = [];
  state.hydrologySystem = createWorldHydrologyState();
  state.agricultureSystem = {
    version: 1,
    cultivationAreas: [],
    plants: [],
    terrestrialHabitats: [],
    terrestrialAnimals: [],
    aquaticHabitats: [],
    aquaticAnimals: [],
    jobs: [],
    productionHistory: [],
  };
  state.weather.current = 'clear';
  state.weather.rainIntensity = 0;
  state.weather.temperatureC = 29;
  state.weather.humidityPercent = 72;
  return state;
}

function addBuiltWaterStructure(
  state: GameState,
  buildingId: string,
  structureId: string,
  cellId: string,
  condition = 100,
): void {
  state.buildings.push({
    id: structureId,
    buildingId,
    condition,
    isBuilt: true,
    buildProgressSeconds: 100,
    totalBuildSeconds: 100,
    areaId: 'AREA_CAMP_CLEARING',
    placement: [{ cellId, areaM2: 8 }],
    footprintAreaM2: 8,
  });
}

function addCultivation(state: GameState, cellId: string): CultivationArea {
  const area: CultivationArea = {
    id: 'cult_hydro_bridge',
    poiId: 'AREA_CAMP_CLEARING',
    name: 'Hydrology test plot',
    cellIds: [cellId],
    usableAreaM2: 30,
    carePolicy: 'normal',
    soil: {
      moisture: 95,
      fertility: 72,
      organicMatter: 55,
      nitrogen: 65,
      phosphorus: 62,
      potassium: 64,
      compaction: 12,
      erosion: 4,
      contamination: 0,
    },
    plantIds: ['plant_hydro_bridge'],
    modifications: ['primitive_boundary'],
    createdAtGameMinute: 0,
  };
  const plant: PlantEntity = {
    id: 'plant_hydro_bridge',
    speciesId: 'PLANT_CASSAVA',
    cultivationAreaId: area.id,
    cellId,
    ageHours: 24 * 20,
    lifeStage: 'vegetative',
    health: 90,
    stress: 10,
    rootHealth: 90,
    stemHealth: 90,
    foliageHealth: 90,
    hydration: 90,
    nutrientStatus: 70,
    pestDamage: 0,
    diseaseLoad: 0,
    floweringProgress: 0,
    fruitLoad: 0,
    seedLoad: 0,
    harvestableUnits: 0,
    genetics: {
      yield: 1,
      growth: 1,
      droughtTolerance: 1,
      floodTolerance: 1,
      diseaseResistance: 1,
      quality: 1,
    },
    plantedAtGameMinute: 0,
  };
  state.agricultureSystem!.cultivationAreas.push(area);
  state.agricultureSystem!.plants.push(plant);
  return area;
}

function setCellRootMoisture(state: GameState, cellId: string, moisture: number): void {
  materializeRegionHydrology(state, 'AREA_CAMP_CLEARING');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const cell = grid.cells.find(candidate => candidate.id === cellId)!;
  const hydro = state.hydrologySystem!.cellStatesById[`AREA_CAMP_CLEARING:${cellId}`];
  const soil = SOIL_HYDROLOGY_PROFILES[cell.soilType];
  hydro.rootZoneMoisture = moisture;
  hydro.soilWaterMm = soil.fieldCapacityMm * moisture / 100;
  hydro.saturation = hydro.soilWaterMm / soil.saturationCapacityMm * 100;
}

function testCultivationUsesHydrologyInsteadOfLegacyCellMoisture(): void {
  const state = fresh('crop-source-of-truth');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const cell = grid.cells[0];
  cell.moisture = 96;
  const area = addCultivation(state, cell.id);
  setCellRootMoisture(state, cell.id, 24);

  prepareLivingHydrologyState(state, 60);
  tickAgriculture(state, 60, 60);
  finalizeLivingHydrologyState(state);

  assert.ok(Math.abs(area.soil.moisture - 24) < 0.01, 'cultivation moisture mirror must finish on CellHydrologyState, not static BuildCell.moisture');
  assert.ok(area.soil.moisture < cell.moisture - 50, 'legacy terrain moisture must not overwrite the physical hydrology state');
}

function testCropDemandWithdrawsPhysicalStoredWater(): void {
  const state = fresh('crop-water-demand');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const low = [...grid.cells].sort((a, b) => a.elevation - b.elevation)[0];
  const high = [...grid.cells].sort((a, b) => b.elevation - a.elevation)[0];
  addCultivation(state, low.id);
  setCellRootMoisture(state, low.id, 15);
  ensureSurfaceWaterNetwork(state, 'AREA_CAMP_CLEARING');

  addBuiltWaterStructure(state, 'BUILDING_EARTHEN_POND', 'living_pond', high.id);
  addBuiltWaterStructure(state, 'BUILDING_IRRIGATION_DITCH', 'living_ditch', high.id);
  ensureWaterInfrastructureBindings(state);
  const system = state.hydrologySystem!;
  const pondNode = system.nodesById.HYDRO_MANAGED_living_pond;
  const ditch = system.infrastructure.find(infrastructure => infrastructure.structureId === 'living_ditch')!;
  assert.ok(pondNode && ditch);
  pondNode.storageM3 = 1;
  pondNode.elevationM = low.elevation + 4;
  configureWaterInfrastructure(state, ditch.id, {
    inputNodeIds: [pondNode.id],
    targetCellIds: [low.id],
    desiredFlowM3H: 0.5,
    waterUseClass: 'normal_crops',
  });

  const hydro = system.cellStatesById[`AREA_CAMP_CLEARING:${low.id}`];
  const beforeSoil = hydro.soilWaterMm;
  const beforeStorage = pondNode.storageM3;
  syncLivingWaterDemands(state);
  const demand = system.demands!.find(candidate => candidate.id === 'living_crop_water_cult_hydro_bridge');
  assert.ok(demand?.active && demand.demandM3H > 0, 'dry planted plot must publish a real water demand');
  tickWaterManagement(state, 60);

  assert.ok(demand!.deliveredM3H > 0, 'configured irrigation network must deliver the agriculture demand');
  assert.ok(pondNode.storageM3 < beforeStorage, 'agriculture irrigation must withdraw physical managed storage');
  assert.ok(hydro.soilWaterMm > beforeSoil, 'delivered agriculture water must enter CellHydrologyState soil water');
}

function testEcologyMirrorsDynamicHydrology(): void {
  const state = fresh('ecology-water-bridge');
  const region = ensureRegionEcology(state, 'AREA_CAMP_CLEARING')!;
  const subarea = materializeEcologySubarea(state, region.subareaIds[0])!;
  materializeRegionHydrology(state, 'AREA_CAMP_CLEARING');
  for (const cellId of subarea.cellIds) {
    const hydro = state.hydrologySystem!.cellStatesById[`AREA_CAMP_CLEARING:${cellId}`];
    hydro.rootZoneMoisture = 33;
    hydro.reliableWaterAccess = 76;
    hydro.currentFloodRisk = 61;
  }

  prepareLivingHydrologyState(state, 60);
  tickWorldEcology(state, 60);
  finalizeLivingHydrologyState(state);

  assert.ok(Math.abs(subarea.environment.moisture - 33) < 0.01, 'ecology moisture must mirror hydrology after its compatibility tick');
  assert.ok(Math.abs(subarea.environment.waterAccess - 76) < 0.01, 'wildlife water access must derive from dynamic hydrology');
  assert.ok(Math.abs(subarea.terrain.floodRisk - 61) < 0.01, 'ecology flood risk must derive from dynamic hydrology');
}

function testAquacultureReceivesHydrologyQuality(): void {
  const state = fresh('aquatic-water-quality');
  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const cell = grid.cells[0];
  materializeRegionHydrology(state, 'AREA_CAMP_CLEARING');
  const hydro = state.hydrologySystem!.cellStatesById[`AREA_CAMP_CLEARING:${cell.id}`];
  hydro.temperatureC = 24;
  hydro.turbidity = 67;
  hydro.contamination = 41;
  hydro.dissolvedOxygenMgL = 5.4;
  hydro.surfaceWaterDepthM = 0.42;
  hydro.reliableWaterAccess = 82;
  hydro.outflowM3H = 1.8;

  const habitat: AquaticHabitat = {
    id: 'aqua_hydrology_bridge',
    poiId: 'AREA_CAMP_CLEARING',
    name: 'River enclosure test',
    siteType: 'river_segment',
    cellIds: [cell.id],
    areaM2: 24,
    carePolicy: 'normal',
    aquaticAnimalIds: [],
    water: {
      temperatureC: 30,
      oxygen: 90,
      turbidity: 2,
      wasteLoad: 0,
      pathogenLoad: 4,
      flowRate: 4,
      depthM: 1,
      contamination: 0,
    },
    modifications: ['simple_net_barrier'],
    barrierCondition: 70,
    predatorProtection: 50,
    escapeRisk: 20,
    createdAtGameMinute: 0,
  };
  state.agricultureSystem!.aquaticHabitats.push(habitat);
  prepareLivingHydrologyState(state, 30);

  assert.ok(Math.abs(habitat.water.temperatureC - 24) < 0.01);
  assert.ok(Math.abs(habitat.water.turbidity - 67) < 0.01);
  assert.ok(Math.abs(habitat.water.contamination - 41) < 0.01);
  assert.ok(Math.abs(habitat.water.oxygen - 54) < 0.01, 'dissolved oxygen mg/L must feed the existing 0-100 aquaculture oxygen scale');
  assert.ok(Math.abs(habitat.water.depthM - 0.42) < 0.01);
  assert.ok(habitat.water.flowRate > 20, 'real cell discharge and water access must drive aquatic flow conditions');
}

function main(): void {
  testCultivationUsesHydrologyInsteadOfLegacyCellMoisture();
  testCropDemandWithdrawsPhysicalStoredWater();
  testEcologyMirrorsDynamicHydrology();
  testAquacultureReceivesHydrologyQuality();
  console.log('Hydrology living-system integration smoke tests passed.');
}

main();
