import type { GameState } from '../../types';
import '../../types/buildingSimulation';
import {
  DEFAULT_SPATIAL_WORLD_SEED,
  SPATIAL_TERRAIN_GENERATION_VERSION,
  generateHabitatPatches,
  type HabitatPatch,
} from './habitatPatches';
import {
  buildSpatialRouteGraph,
  type SpatialRouteGraph,
} from './spatialTravel';
import {
  generateTerrainHydrology,
  type GeneratedTerrainHydrology,
} from './terrainHydrology';
import {
  generateLocalSites,
  type GeneratedLocalSite,
} from './localSiteGeneration';

export const SPATIAL_WORLD_GENERATION_VERSION = 2;

export interface GeneratedSpatialWorld {
  generationVersion: number;
  terrainGenerationVersion: number;
  worldSeed: string;
  habitatPatches: readonly HabitatPatch[];
  routeGraph: SpatialRouteGraph;
  hydrology: GeneratedTerrainHydrology;
  localSites: readonly GeneratedLocalSite[];
}

/**
 * The building simulation already owns a persistent per-run seed. Spatial world
 * generation deliberately reuses that root seed so a save has one world DNA
 * rather than unrelated random streams for construction, terrain and ecology.
 */
export function getSpatialWorldSeed(state: GameState): string {
  return state.buildingSimulation?.worldSeed || DEFAULT_SPATIAL_WORLD_SEED;
}

export function generateSpatialWorld(worldSeed: string): GeneratedSpatialWorld {
  const habitatPatches = Object.freeze(generateHabitatPatches(worldSeed));
  const routeGraph = buildSpatialRouteGraph(habitatPatches);
  const hydrology = generateTerrainHydrology(habitatPatches, routeGraph);
  const localSites = Object.freeze(generateLocalSites(worldSeed, habitatPatches, hydrology));

  return Object.freeze({
    generationVersion: SPATIAL_WORLD_GENERATION_VERSION,
    terrainGenerationVersion: SPATIAL_TERRAIN_GENERATION_VERSION,
    worldSeed,
    habitatPatches,
    routeGraph,
    hydrology,
    localSites,
  });
}

export function generateSpatialWorldForState(state: GameState): GeneratedSpatialWorld {
  return generateSpatialWorld(getSpatialWorldSeed(state));
}
