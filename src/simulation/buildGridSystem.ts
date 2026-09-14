import type { AreaDefinition, GameState } from '../types';
import type {
  BuildCell,
  BuildSoilType,
  BuildingSimulationState,
  PoiBuildGrid,
} from '../types/buildingSimulation';
import '../types/buildingSimulation';
import { AREAS_DATABASE } from '../data/areas';

const GRID_GENERATION_VERSION = 1;

interface BiomeBuildProfile {
  rows: number;
  columns: number;
  cellSizeM: number;
  soilWeights: Array<[BuildSoilType, number]>;
  bearing: number;
  drainage: number;
  moisture: number;
  floodRisk: number;
  slope: number;
  vegetation: number;
  roots: number;
  rocks: number;
  debris: number;
  canopy: number;
  sunlight: number;
  windExposure: number;
  fireRisk: number;
  wildlifeTraffic: number;
  fertileSoil: number;
  stoneYield: number;
  timberYield: number;
  fiberYield: number;
  clayYield: number;
  waterAccess: number;
}

const BIOME_PROFILES: Record<AreaDefinition['biome'], BiomeBuildProfile> = {
  beach: {
    rows: 6, columns: 8, cellSizeM: 5,
    soilWeights: [['sand', 0.65], ['gravel', 0.2], ['loam', 0.15]],
    bearing: 48, drainage: 82, moisture: 34, floodRisk: 42, slope: 6,
    vegetation: 28, roots: 18, rocks: 32, debris: 26, canopy: 18, sunlight: 88,
    windExposure: 72, fireRisk: 48, wildlifeTraffic: 34,
    fertileSoil: 25, stoneYield: 42, timberYield: 22, fiberYield: 36, clayYield: 12, waterAccess: 54,
  },
  jungle: {
    rows: 7, columns: 7, cellSizeM: 5,
    soilWeights: [['loam', 0.45], ['organic', 0.28], ['clay', 0.18], ['rock', 0.09]],
    bearing: 58, drainage: 57, moisture: 68, floodRisk: 28, slope: 8,
    vegetation: 78, roots: 72, rocks: 24, debris: 38, canopy: 84, sunlight: 26,
    windExposure: 24, fireRisk: 26, wildlifeTraffic: 63,
    fertileSoil: 71, stoneYield: 28, timberYield: 86, fiberYield: 82, clayYield: 38, waterAccess: 38,
  },
  river: {
    rows: 6, columns: 7, cellSizeM: 5,
    soilWeights: [['loam', 0.38], ['clay', 0.32], ['gravel', 0.18], ['mud', 0.12]],
    bearing: 50, drainage: 54, moisture: 74, floodRisk: 54, slope: 5,
    vegetation: 58, roots: 48, rocks: 28, debris: 24, canopy: 56, sunlight: 48,
    windExposure: 31, fireRisk: 22, wildlifeTraffic: 58,
    fertileSoil: 78, stoneYield: 40, timberYield: 58, fiberYield: 70, clayYield: 66, waterAccess: 94,
  },
  bamboo: {
    rows: 7, columns: 7, cellSizeM: 5,
    soilWeights: [['loam', 0.5], ['clay', 0.23], ['organic', 0.2], ['rock', 0.07]],
    bearing: 61, drainage: 63, moisture: 58, floodRisk: 24, slope: 8,
    vegetation: 82, roots: 66, rocks: 18, debris: 25, canopy: 72, sunlight: 38,
    windExposure: 22, fireRisk: 34, wildlifeTraffic: 44,
    fertileSoil: 68, stoneYield: 20, timberYield: 78, fiberYield: 88, clayYield: 34, waterAccess: 35,
  },
  swamp: {
    rows: 6, columns: 7, cellSizeM: 5,
    soilWeights: [['mud', 0.48], ['organic', 0.3], ['clay', 0.17], ['loam', 0.05]],
    bearing: 28, drainage: 23, moisture: 91, floodRisk: 79, slope: 3,
    vegetation: 74, roots: 86, rocks: 10, debris: 32, canopy: 69, sunlight: 33,
    windExposure: 18, fireRisk: 12, wildlifeTraffic: 72,
    fertileSoil: 74, stoneYield: 12, timberYield: 62, fiberYield: 81, clayYield: 72, waterAccess: 97,
  },
  rocky: {
    rows: 6, columns: 6, cellSizeM: 5,
    soilWeights: [['rock', 0.55], ['gravel', 0.28], ['loam', 0.12], ['clay', 0.05]],
    bearing: 88, drainage: 86, moisture: 28, floodRisk: 10, slope: 17,
    vegetation: 31, roots: 24, rocks: 79, debris: 28, canopy: 24, sunlight: 80,
    windExposure: 76, fireRisk: 44, wildlifeTraffic: 30,
    fertileSoil: 21, stoneYield: 91, timberYield: 22, fiberYield: 28, clayYield: 18, waterAccess: 20,
  },
  cave: {
    rows: 5, columns: 5, cellSizeM: 5,
    soilWeights: [['rock', 0.78], ['gravel', 0.17], ['clay', 0.05]],
    bearing: 92, drainage: 61, moisture: 58, floodRisk: 18, slope: 9,
    vegetation: 5, roots: 6, rocks: 86, debris: 46, canopy: 100, sunlight: 2,
    windExposure: 8, fireRisk: 20, wildlifeTraffic: 35,
    fertileSoil: 2, stoneYield: 94, timberYield: 2, fiberYield: 4, clayYield: 28, waterAccess: 16,
  },
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function jitter(base: number, spread: number, random: () => number): number {
  return clamp(base + (random() * 2 - 1) * spread);
}

function weightedSoil(profile: BiomeBuildProfile, random: () => number): BuildSoilType {
  const roll = random();
  let cumulative = 0;
  for (const [soil, weight] of profile.soilWeights) {
    cumulative += weight;
    if (roll <= cumulative) return soil;
  }
  return profile.soilWeights[profile.soilWeights.length - 1][0];
}

function applyAreaFlavor(areaId: string, profile: BiomeBuildProfile): BiomeBuildProfile {
  const next = { ...profile, soilWeights: [...profile.soilWeights] };

  if (areaId === 'AREA_CAMP_CLEARING') {
    next.vegetation -= 26;
    next.roots -= 18;
    next.debris += 18;
    next.bearing += 8;
    next.slope = Math.max(3, next.slope - 3);
    next.sunlight += 18;
    next.canopy -= 16;
  }
  if (areaId === 'AREA_WATERFALL_BASIN') {
    next.moisture += 12;
    next.waterAccess += 30;
    next.rocks += 18;
    next.slope += 4;
  }
  if (areaId === 'AREA_STONE_RIDGE') {
    next.bearing += 14;
    next.rocks += 25;
    next.slope += 8;
    next.windExposure += 16;
  }
  if (areaId === 'AREA_MANGROVE_EDGE') {
    next.floodRisk += 18;
    next.moisture += 12;
    next.roots += 18;
    next.waterAccess += 20;
  }

  return next;
}

export function createBuildingSimulationState(): BuildingSimulationState {
  return {
    version: 1,
    worldSeed: `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    gridsByPoiId: {},
    clusters: [],
    preparationJobs: [],
  };
}

export function ensureBuildingSimulation(state: GameState): BuildingSimulationState {
  if (!state.buildingSimulation) state.buildingSimulation = createBuildingSimulationState();
  state.buildingSimulation.version ||= 1;
  state.buildingSimulation.worldSeed ||= createBuildingSimulationState().worldSeed;
  state.buildingSimulation.gridsByPoiId ||= {};
  state.buildingSimulation.clusters ||= [];
  state.buildingSimulation.preparationJobs ||= [];
  return state.buildingSimulation;
}

export function generatePoiBuildGrid(worldSeed: string, poiId: string): PoiBuildGrid {
  const area = AREAS_DATABASE[poiId] || AREAS_DATABASE.AREA_CAMP_CLEARING;
  const profile = applyAreaFlavor(poiId, BIOME_PROFILES[area.biome] || BIOME_PROFILES.jungle);
  const seed = hashString(`${worldSeed}:${poiId}:build-grid:v${GRID_GENERATION_VERSION}`);
  const random = mulberry32(seed);
  const cells: BuildCell[] = [];
  const areaM2 = profile.cellSizeM * profile.cellSizeM;

  for (let row = 0; row < profile.rows; row++) {
    for (let column = 0; column < profile.columns; column++) {
      const edgeFactor = Math.min(row, column, profile.rows - 1 - row, profile.columns - 1 - column) === 0 ? 1 : 0;
      const localFloodNoise = random() > 0.84 ? 18 : 0;
      const localRockNoise = random() > 0.86 ? 20 : 0;
      const localClearing = random() > 0.82 ? 22 : 0;

      cells.push({
        id: `${poiId}_R${row}_C${column}`,
        row,
        column,
        areaM2,
        elevation: Math.round((10 + row * 1.2 + jitter(0, 6, random)) * 10) / 10,
        slope: jitter(profile.slope + (edgeFactor ? 2 : 0), 7, random),
        soilType: weightedSoil(profile, random),
        bearingCapacity: jitter(profile.bearing + localRockNoise * 0.3, 16, random),
        drainage: jitter(profile.drainage, 18, random),
        moisture: jitter(profile.moisture + localFloodNoise * 0.3, 16, random),
        floodRisk: jitter(profile.floodRisk + localFloodNoise, 18, random),
        vegetation: jitter(profile.vegetation - localClearing, 20, random),
        roots: jitter(profile.roots - localClearing * 0.5, 18, random),
        rocks: jitter(profile.rocks + localRockNoise, 20, random),
        debris: jitter(profile.debris, 18, random),
        canopy: jitter(profile.canopy - localClearing * 0.5, 16, random),
        sunlight: jitter(profile.sunlight + localClearing * 0.5, 18, random),
        windExposure: jitter(profile.windExposure + edgeFactor * 8, 16, random),
        fireRisk: jitter(profile.fireRisk, 15, random),
        wildlifeTraffic: jitter(profile.wildlifeTraffic, 20, random),
        resources: {
          fertileSoil: jitter(profile.fertileSoil, 18, random),
          stoneYield: jitter(profile.stoneYield + localRockNoise * 0.5, 18, random),
          timberYield: jitter(profile.timberYield - localClearing * 0.4, 18, random),
          fiberYield: jitter(profile.fiberYield, 18, random),
          clayYield: jitter(profile.clayYield, 18, random),
          waterAccess: jitter(profile.waterAccess + localFloodNoise * 0.4, 18, random),
        },
        cleared: clamp(localClearing * 2.5),
        leveled: 0,
        drained: 0,
        compacted: 0,
        reservedAreaM2: 0,
      });
    }
  }

  return {
    poiId,
    generationVersion: GRID_GENERATION_VERSION,
    seed,
    rows: profile.rows,
    columns: profile.columns,
    cellSizeM: profile.cellSizeM,
    cells,
  };
}

export function getOrCreatePoiBuildGrid(state: GameState, poiId: string): PoiBuildGrid {
  const simulation = ensureBuildingSimulation(state);
  const existing = simulation.gridsByPoiId[poiId];
  if (existing && existing.generationVersion === GRID_GENERATION_VERSION) return existing;

  const grid = generatePoiBuildGrid(simulation.worldSeed, poiId);
  simulation.gridsByPoiId[poiId] = grid;
  return grid;
}

/** Pure read helper for UI/tests; it never mutates state. */
export function getPoiBuildGridView(state: GameState, poiId: string): PoiBuildGrid {
  const existing = state.buildingSimulation?.gridsByPoiId?.[poiId];
  if (existing) return existing;
  const seed = state.buildingSimulation?.worldSeed || 'legacy_preview_seed';
  return generatePoiBuildGrid(seed, poiId);
}