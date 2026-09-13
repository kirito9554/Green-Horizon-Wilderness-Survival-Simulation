import { GameState } from '../types';
import { INITIAL_SURVIVORS } from '../data/survivors';
import { getDefaultResourcePools } from './resourcePools';
import { advanceTime } from './timeSystem';
import { tickWeather } from './weatherSystem';
import { tickResourceSystem } from './resourceSystem';
import { tickSurvivors } from './survivorSystem';
import { tickExpeditions } from './expeditionSystem';
import { tickItemSimulation } from './itemSimulation';
import { tickCraftingAndResearch } from './craftingSystem';

// Re-export subsystems to maintain complete backward compatibility across components
export * from './inventorySystem';
export * from './timeSystem';
export * from './weatherSystem';
export * from './resourceSystem';
export * from './survivorSystem';
export * from './expeditionSystem';
export * from './taskHandlers';
export * from './itemSimulation';
export * from './craftingSystem';

export const INITIAL_GAME_STATE: GameState = {
  saveVersion: 1,
  campName: 'Canopy Bay Settlement',
  gameTime: {
    day: 1,
    minuteOfDay: 510, // 08:30 AM
    speed: 1,
  },
  weather: {
    current: 'clear',
    previous: 'clear',
    next: 'cloudy',
    temperatureC: 29,
    humidityPercent: 72,
    totalDurationMinutes: 180,
    durationRemainingMinutes: 180,
    transitionProgress: 0,
    rainIntensity: 0,
    cloudCover: 0.1,
    wind: {
      speedKmh: 8,
      gustKmh: 12,
      directionDeg: 45,
      cardinal: 'NE',
    },
  },
  survivors: JSON.parse(JSON.stringify(INITIAL_SURVIVORS)),
  inventory: {
    maxWeightKg: 50,
    maxVolumeL: 80,
    items: [
      { 
        instanceId: 'init_1', 
        itemId: 'ITEM_WILD_COCONUT', 
        quantity: 3, 
        qualityBreakdown: { standard: 2, prime: 1 } 
      },
      { 
        instanceId: 'init_2', 
        itemId: 'ITEM_OPEN_COCONUT', 
        quantity: 2, 
        freshness: 100, 
        qualityBreakdown: { standard: 2 } 
      },
      { 
        instanceId: 'init_3', 
        itemId: 'ITEM_DRIFTWOOD_BRANCH', 
        quantity: 6, 
        qualityBreakdown: { crude: 2, standard: 3, prime: 1 } 
      },
      { 
        instanceId: 'init_4', 
        itemId: 'ITEM_RIVER_PEBBLE', 
        quantity: 4, 
        qualityBreakdown: { crude: 1, standard: 3 } 
      },
      { 
        instanceId: 'init_5', 
        itemId: 'ITEM_PALM_LEAF', 
        quantity: 4, 
        qualityBreakdown: { standard: 3, prime: 1 } 
      },
      { 
        instanceId: 'init_6', 
        itemId: 'ITEM_VINE_FIBER', 
        quantity: 3, 
        qualityBreakdown: { crude: 1, standard: 2 } 
      },
      { 
        instanceId: 'init_7', 
        itemId: 'ITEM_SHARP_STONE', 
        quantity: 1, 
        quality: 'standard', 
        condition: 100,
        conditionMax: 100
      },
    ],
  },
  areasProgress: {
    AREA_CAMP_CLEARING: { knowledgePercent: 100, lastGatheredTime: {} },
    AREA_COASTAL_SHALLOWS: { knowledgePercent: 20, lastGatheredTime: {} },
    AREA_RIVERBANK: { knowledgePercent: 10, lastGatheredTime: {} },
    AREA_BAMBOO_GROVE: { knowledgePercent: 0, lastGatheredTime: {} },
  },
  buildings: [
    // Pre-seed a blueprint ready for construction
    {
      id: 'bld_campfire',
      buildingId: 'BUILDING_CAMPFIRE_HEARTH',
      condition: 100,
      isBuilt: false,
      buildProgressSeconds: 0,
      totalBuildSeconds: 20,
      areaId: 'AREA_CAMP_CLEARING',
    },
  ],
  poiStorages: {
    AREA_CAMP_CLEARING: {
      maxWeightKg: 120,
      maxVolumeL: 180,
      items: [
        {
          instanceId: 'poi_camp_1',
          itemId: 'ITEM_DRIFTWOOD_BRANCH',
          quantity: 12,
          quality: 'standard',
          qualityBreakdown: { crude: 4, standard: 8 },
        },
        {
          instanceId: 'poi_camp_2',
          itemId: 'ITEM_RIVER_PEBBLE',
          quantity: 8,
          quality: 'standard',
          qualityBreakdown: { standard: 8 },
        },
        {
          instanceId: 'poi_camp_3',
          itemId: 'ITEM_PALM_LEAF',
          quantity: 10,
          quality: 'standard',
          qualityBreakdown: { standard: 10 },
        },
      ],
    },
    AREA_COASTAL_SHALLOWS: {
      maxWeightKg: 45,
      maxVolumeL: 70,
      items: [
        {
          instanceId: 'poi_coast_1',
          itemId: 'ITEM_WILD_COCONUT',
          quantity: 4,
          quality: 'standard',
          qualityBreakdown: { standard: 4 },
        },
      ],
    },
    AREA_RIVERBANK: {
      maxWeightKg: 45,
      maxVolumeL: 70,
      items: [
        {
          instanceId: 'poi_river_1',
          itemId: 'ITEM_RIVER_PEBBLE',
          quantity: 6,
          quality: 'standard',
          qualityBreakdown: { standard: 6 },
        },
      ],
    },
    AREA_BAMBOO_GROVE: {
      maxWeightKg: 45,
      maxVolumeL: 70,
      items: [],
    },
  },
  expeditions: [],
  resourcePools: getDefaultResourcePools(),
  researches: {
    RECIPE_BRAID_CORD: {
      recipeId: 'RECIPE_BRAID_CORD',
      status: 'completed',
      progressSeconds: 15,
      totalSeconds: 15,
    },
  },
  craftingQueue: [],
  discoveredRecipeIds: ['RECIPE_BRAID_CORD'],
  logs: [
    {
      id: 'log_0',
      day: 1,
      timeStr: '08:30',
      text: 'The tide has washed our wreckage ashore. We must secure drinking water and build a campfire before nightfall.',
      type: 'info',
    },
  ],
  settings: {
    autoConsumeFood: true,
    autoConsumeWater: true,
    foodPolicy: 'normal',
    waterPolicy: 'normal',
    soundEnabled: true,
    gameSpeedMultiplier: 1,
  },
};

// Orchestration Engine: Ticks all simulation subsystems in sequence
export function tickSimulation(state: GameState, deltaRealSeconds: number): GameState {
  if (state.gameTime.speed === 0) return state;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const speedMult = state.gameTime.speed * (state.settings.gameSpeedMultiplier || 1);
  // 1 real second = 0.5 game minute at 1x speed (smooth simulation pace)
  const deltaGameMinutes = (deltaRealSeconds * 0.5) * speedMult;
  const deltaGameSeconds = deltaRealSeconds * speedMult;

  // 1. Time Advancement
  advanceTime(next, deltaGameMinutes);

  // 2. Weather Tick
  tickWeather(next, deltaGameMinutes);

  // 3. Resource Pools & Passive Collection
  tickResourceSystem(next, deltaGameMinutes);

  // 4. Survivor Needs & Task Progress
  tickSurvivors(next, deltaGameMinutes, deltaGameSeconds);

  // 5. Active Expeditions Tick
  tickExpeditions(next, deltaGameMinutes);

  // 6. Dynamic Item Spoilage & Environmental Decomposition
  tickItemSimulation(next, deltaGameMinutes);

  // 7. Crafting Queue & Blueprint Research Tick
  tickCraftingAndResearch(next, deltaGameSeconds);

  // Keep logs at max 35 entries
  if (next.logs.length > 35) {
    next.logs = next.logs.slice(0, 35);
  }

  return next;
}
