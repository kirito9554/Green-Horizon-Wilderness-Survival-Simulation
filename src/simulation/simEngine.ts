import { GameState } from '../types';
import '../types/craftingSimulation';
import '../types/researchSimulation';
import '../types/maintenanceSimulation';
import '../types/upgradeSimulation';
import '../types/buildingSimulation';
import '../types/structureSimulation';
import '../types/structureMaintenanceSimulation';
import '../types/storageSimulation';
import '../types/agricultureSimulation';
import '../types/ecologySimulation';
import '../types/hydrologySimulation';
import { INITIAL_SURVIVORS } from '../data/survivors';
import { getDefaultResourcePools } from './resourcePools';
import { advanceTime } from './timeSystem';
import { tickWeather } from './weatherSystem';
import { tickResourceSystem } from './resourceSystem';
import { tickSurvivors } from './survivorSystem';
import { tickExpeditions } from './expeditionSystem';
import { tickItemSimulation } from './itemSimulation';
import { tickCraftingAndResearch } from './craftingSystem';
import { tickComponentBootstrap } from './componentBootstrapSystem';
import { tickMaintenanceSystem } from './maintenanceSystem';
import { tickUpgradeSystem } from './upgradeSystem';
import { createBuildingSimulationState } from './buildGridSystem';
import { tickBuildingPreparationRuntime } from './buildingPreparationRuntime';
import { tickBuildingConstructionRuntime } from './buildingConstructionSystem';
import { tickStructureLifecycle } from './structureLifecycleSystem';
import { tickStructureWorkRuntime } from './structureMaintenanceSystem';
import { createStorageSystemState, tickStorageSimulation } from './storageSystem';
import { tickStorageHauling } from './storageHaulSystem';
import { createAgricultureSystemState, tickAgriculture } from './agricultureSystem';
import { createWorldEcologyState, tickWorldEcology } from './ecologySystem';
import { tickWildFauna } from './ecologyFaunaSystem';
import { tickWildPredators } from './ecologyPredatorSystem';
import { createWorldHydrologyState, tickWorldHydrology } from './hydrologySystem';
import { tickSurfaceWaterHydrology } from './hydrologySurfaceWaterSystem';
import { tickWaterManagement } from './waterManagementSystem';
import {
  finalizeLivingHydrologyState,
  prepareLivingHydrologyState,
  syncLivingWaterDemands,
} from './livingHydrologyBridge';
import {
  prepareMaintenanceWorkstations,
  prepareUpgradeWorkstations,
} from './productionWorkstationCoordinator';

export * from './inventorySystem';
export * from './timeSystem';
export * from './weatherSystem';
export * from './resourceSystem';
export * from './survivorSystem';
export * from './expeditionSystem';
export * from './taskHandlers';
export * from './itemSimulation';
export * from './craftingSystem';
export * from './materialReservationSystem';
export * from './jobReservationSystem';
export * from './componentSystem';
export * from './componentWearSystem';
export * from './craftQualitySystem';
export * from './workstationSystem';
export * from './productionWorkstationCoordinator';
export * from './researchSystem';
export * from './maintenanceSystem';
export * from './upgradeSystem';
export * from './buildGridSystem';
export * from './buildingClusterSystem';
export * from './buildingPreparationRuntime';
export * from './buildingConstructionSystem';
export * from './structureComponentSystem';
export * from './structureLifecycleSystem';
export * from './structureMaintenanceSystem';
export * from './storageSystem';
export * from './storageHaulSystem';
export * from './storageRouteSystem';
export * from './agricultureSystem';
export * from './ecologySystem';
export * from './ecologyFaunaSystem';
export * from './ecologyPredatorSystem';
export * from './hydrologySystem';
export * from './hydrologySurfaceWaterSystem';
export * from './waterManagementSystem';
export * from './livingHydrologyBridge';

const campGroundStorageId = 'storage_ground_AREA_CAMP_CLEARING';
const rockyShoreGroundStorageId = 'storage_ground_AREA_FISHING_LAGOON';
const riverGorgeGroundStorageId = 'storage_ground_AREA_WATERFALL_BASIN';

export const INITIAL_GAME_STATE: GameState = {
  saveVersion: 14,
  campName: 'Canopy Bay Settlement',
  gameTime: { day: 1, minuteOfDay: 510, speed: 1 },
  weather: {
    current: 'clear', previous: 'clear', next: 'cloudy', temperatureC: 29, humidityPercent: 72,
    totalDurationMinutes: 180, durationRemainingMinutes: 180, transitionProgress: 0, rainIntensity: 0, cloudCover: 0.1,
    wind: { speedKmh: 8, gustKmh: 12, directionDeg: 45, cardinal: 'NE' },
  },
  survivors: JSON.parse(JSON.stringify(INITIAL_SURVIVORS)),
  inventory: {
    maxWeightKg: 50,
    maxVolumeL: 80,
    items: [
      { instanceId: 'init_1', itemId: 'ITEM_WILD_COCONUT', quantity: 3, qualityBreakdown: { standard: 2, prime: 1 } },
      { instanceId: 'init_2', itemId: 'ITEM_OPEN_COCONUT', quantity: 2, freshness: 100, qualityBreakdown: { standard: 2 } },
      { instanceId: 'init_3', itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 6, qualityBreakdown: { crude: 2, standard: 3, prime: 1 } },
      { instanceId: 'init_4', itemId: 'ITEM_RIVER_PEBBLE', quantity: 4, qualityBreakdown: { crude: 1, standard: 3 } },
      { instanceId: 'init_5', itemId: 'ITEM_PALM_LEAF', quantity: 4, qualityBreakdown: { standard: 3, prime: 1 } },
      { instanceId: 'init_6', itemId: 'ITEM_VINE_FIBER', quantity: 3, qualityBreakdown: { crude: 1, standard: 2 } },
      {
        instanceId: 'init_7', itemId: 'ITEM_SHARP_STONE', quantity: 1, quality: 'standard',
        condition: 100, conditionMax: 100, originalConditionMax: 100, reservedQuantity: 0,
        reservedQualityBreakdown: { crude: 0, standard: 0, prime: 0, masterwork: 0 },
      },
    ],
  },
  areasProgress: {
    AREA_CAMP_CLEARING: { knowledgePercent: 100, lastGatheredTime: {} },
    AREA_FISHING_LAGOON: { knowledgePercent: 20, lastGatheredTime: {} },
    AREA_WATERFALL_BASIN: { knowledgePercent: 10, lastGatheredTime: {} },
    AREA_BAMBOO_GROVE: { knowledgePercent: 0, lastGatheredTime: {} },
  },
  buildings: [{
    id: 'bld_campfire', buildingId: 'BUILDING_CAMPFIRE_HEARTH', condition: 100, isBuilt: false,
    buildProgressSeconds: 0, totalBuildSeconds: 20, areaId: 'AREA_CAMP_CLEARING',
  }],
  buildingSimulation: createBuildingSimulationState(),
  storageSystem: createStorageSystemState(),
  agricultureSystem: createAgricultureSystemState(),
  ecologySystem: createWorldEcologyState(),
  hydrologySystem: createWorldHydrologyState(),
  poiStorages: {
    AREA_CAMP_CLEARING: {
      maxWeightKg: 120, maxVolumeL: 180,
      items: [
        { instanceId: 'poi_camp_1', itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 12, quality: 'standard', qualityBreakdown: { crude: 4, standard: 8 }, storageLocationId: campGroundStorageId },
        { instanceId: 'poi_camp_2', itemId: 'ITEM_RIVER_PEBBLE', quantity: 8, quality: 'standard', qualityBreakdown: { standard: 8 }, storageLocationId: campGroundStorageId },
        { instanceId: 'poi_camp_3', itemId: 'ITEM_PALM_LEAF', quantity: 10, quality: 'standard', qualityBreakdown: { standard: 10 }, storageLocationId: campGroundStorageId },
        { instanceId: 'poi_seed_cassava', itemId: 'ITEM_CASSAVA_CUTTING', quantity: 6, quality: 'standard', qualityBreakdown: { standard: 6 }, storageLocationId: campGroundStorageId },
        { instanceId: 'poi_seed_chili', itemId: 'ITEM_CHILI_SEED', quantity: 10, quality: 'standard', qualityBreakdown: { standard: 10 }, storageLocationId: campGroundStorageId },
      ],
    },
    AREA_FISHING_LAGOON: {
      maxWeightKg: 45,
      maxVolumeL: 70,
      items: [{ instanceId: 'poi_coast_1', itemId: 'ITEM_WILD_COCONUT', quantity: 4, quality: 'standard', qualityBreakdown: { standard: 4 }, storageLocationId: rockyShoreGroundStorageId }],
    },
    AREA_WATERFALL_BASIN: {
      maxWeightKg: 45,
      maxVolumeL: 70,
      items: [{ instanceId: 'poi_river_1', itemId: 'ITEM_RIVER_PEBBLE', quantity: 6, quality: 'standard', qualityBreakdown: { standard: 6 }, storageLocationId: riverGorgeGroundStorageId }],
    },
    AREA_BAMBOO_GROVE: { maxWeightKg: 45, maxVolumeL: 70, items: [] },
  },
  expeditions: [],
  resourcePools: getDefaultResourcePools(),
  researches: {
    RECIPE_BRAID_CORD: { recipeId: 'RECIPE_BRAID_CORD', status: 'completed', progressSeconds: 15, totalSeconds: 15, evidenceScoreAtStart: 100 },
  },
  researchSystem: { evidenceByRecipeId: {}, identifiedMaterialIds: [], trackedRecipeIds: [], recentDiscoveries: [], knowledgePoints: 0 },
  craftedRecipeCounts: {},
  maintenanceSystem: { queue: [], history: [] },
  upgradeSystem: { queue: [], history: [] },
  craftingQueue: [],
  discoveredRecipeIds: ['RECIPE_BRAID_CORD'],
  logs: [{
    id: 'log_0', day: 1, timeStr: '08:30',
    text: 'The tide has washed our wreckage ashore. We must secure drinking water and build a campfire before nightfall.',
    type: 'info',
  }],
  settings: {
    autoConsumeFood: true, autoConsumeWater: true, foodPolicy: 'normal', waterPolicy: 'normal',
    soundEnabled: true, gameSpeedMultiplier: 1,
  },
};

export function tickSimulation(state: GameState, deltaRealSeconds: number): GameState {
  if (state.gameTime.speed === 0) return state;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const speedMult = state.gameTime.speed * (state.settings.gameSpeedMultiplier || 1);
  const deltaGameMinutes = deltaRealSeconds * 0.5 * speedMult;
  const deltaGameSeconds = deltaRealSeconds * speedMult;

  advanceTime(next, deltaGameMinutes);
  tickWeather(next, deltaGameMinutes);
  tickResourceSystem(next, deltaGameMinutes);
  tickComponentBootstrap(next);
  tickSurvivors(next, deltaGameMinutes, deltaGameSeconds);
  tickExpeditions(next, deltaGameMinutes);
  tickItemSimulation(next, deltaGameMinutes);

  tickBuildingPreparationRuntime(next);
  tickBuildingConstructionRuntime(next);
  tickStructureLifecycle(next, deltaGameMinutes);
  tickStructureWorkRuntime(next);

  // Natural hydrology resolves first. Living systems publish demand into the
  // same water network before player infrastructure allocates any volume.
  // Agriculture/Ecology then receive compatibility mirrors derived from that
  // final physical state instead of maintaining independent rainfall worlds.
  tickWorldHydrology(next, deltaGameMinutes);
  tickSurfaceWaterHydrology(next, deltaGameMinutes);
  syncLivingWaterDemands(next);
  tickWaterManagement(next, deltaGameMinutes);
  prepareLivingHydrologyState(next, deltaGameMinutes);

  tickStorageSimulation(next, deltaGameMinutes);
  tickStorageHauling(next, deltaGameSeconds);

  prepareMaintenanceWorkstations(next);
  tickMaintenanceSystem(next, deltaGameSeconds);
  prepareUpgradeWorkstations(next);
  tickUpgradeSystem(next, deltaGameSeconds);
  tickCraftingAndResearch(next, deltaGameSeconds);

  tickAgriculture(next, deltaGameMinutes, deltaGameSeconds);
  tickWorldEcology(next, deltaGameMinutes);
  finalizeLivingHydrologyState(next);
  tickWildFauna(next, deltaGameMinutes);
  tickWildPredators(next, deltaGameMinutes);

  if (next.logs.length > 35) next.logs = next.logs.slice(0, 35);
  return next;
}