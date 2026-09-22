import type { AreaDefinition } from '../types';
import { AREAS_DATABASE } from './areas';

/**
 * Canonical macro regions exposed by public/maps/main.png.
 *
 * Several IDs intentionally reuse old area IDs so existing saves and simulation
 * references remain compatible while the old many-POI world is retired.
 */
export const MAIN_WORLD_AREA_IDS = [
  'AREA_CAVE_ENTRANCE',       // Limestone Cave
  'AREA_STONE_RIDGE',         // Misty Highlands
  'AREA_BAMBOO_GROVE',        // Bamboo Valley
  'AREA_ANCIENT_RUINS',       // Ancient Ruins
  'AREA_CAMP_CLEARING',       // Plane Wreck
  'AREA_MANGROVE_EDGE',       // Mangrove Delta
  'AREA_FOREST_EDGE',         // Deep Rainforest
  'AREA_SWAMP_CROSSING',      // Flooded Forest
  'AREA_WATERFALL_BASIN',     // River Gorge
  'AREA_FISHING_LAGOON',      // Rocky Shore
] as const;

export type MainWorldAreaId = (typeof MAIN_WORLD_AREA_IDS)[number];

export const MAIN_WORLD_START_AREA_ID: MainWorldAreaId = 'AREA_CAMP_CLEARING';
export const MAIN_WORLD_AREA_SET: ReadonlySet<string> = new Set(MAIN_WORLD_AREA_IDS);

/**
 * Old main-map/synthetic IDs that now represent habitat patches or features
 * inside one of the ten macro regions. Only IDs in this table are redirected.
 *
 * IMPORTANT: old up/down/left/right sector areas are deliberately NOT listed.
 * They are archived for future multi-map expansion and must not be collapsed
 * into the current island map.
 */
export const LEGACY_MAIN_AREA_REDIRECTS: Readonly<Record<string, MainWorldAreaId>> = {
  AREA_HILL_LOOKOUT: 'AREA_STONE_RIDGE',
  AREA_WILDLIFE_NEST: 'AREA_STONE_RIDGE',

  AREA_JUNGLE_TRAIL: 'AREA_FOREST_EDGE',
  AREA_ABANDONED_HUT: 'AREA_FOREST_EDGE',
  AREA_FORAGING_GROUNDS: 'AREA_FOREST_EDGE',
  AREA_MEDICINAL_GLADE: 'AREA_FOREST_EDGE',
  AREA_KAPOK_GROVE: 'AREA_FOREST_EDGE',

  AREA_CLAY_PIT: 'AREA_MANGROVE_EDGE',

  // Synthetic/early-prototype save aliases that were never part of the current map.
  AREA_COASTAL_SHALLOWS: 'AREA_FISHING_LAGOON',
  AREA_RIVERBANK: 'AREA_WATERFALL_BASIN',
};

export const LEGACY_MAIN_AREA_IDS = Object.freeze(Object.keys(LEGACY_MAIN_AREA_REDIRECTS));

export function isMainWorldAreaId(areaId: string): areaId is MainWorldAreaId {
  return MAIN_WORLD_AREA_SET.has(areaId);
}

export function isLegacyMainAreaId(areaId: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEGACY_MAIN_AREA_REDIRECTS, areaId);
}

/**
 * Resolve a current-main-world reference. Unknown IDs return undefined instead
 * of being guessed, which preserves archived/future sector data safely.
 */
export function resolveMainWorldAreaId(areaId: string | undefined): MainWorldAreaId | undefined {
  if (!areaId) return undefined;
  if (isMainWorldAreaId(areaId)) return areaId;
  return LEGACY_MAIN_AREA_REDIRECTS[areaId];
}

export function getMainWorldAreas(): AreaDefinition[] {
  return MAIN_WORLD_AREA_IDS
    .map(areaId => AREAS_DATABASE[areaId])
    .filter((area): area is AreaDefinition => Boolean(area));
}

/**
 * An area in areas.ts that is neither canonical nor a redirect alias is legacy
 * sector/archive data. Keeping this classification explicit prevents new systems
 * from accidentally treating the old database as the current main world.
 */
export function isArchivedLegacyAreaId(areaId: string): boolean {
  return Boolean(AREAS_DATABASE[areaId]) && !isMainWorldAreaId(areaId) && !isLegacyMainAreaId(areaId);
}

export type WorldAreaLifecycle = 'active' | 'redirect-legacy' | 'archived-legacy' | 'unknown';

/** Explicit snapshots used by new world systems; neither list may enter macro geometry. */
export const ARCHIVED_LEGACY_AREA_IDS = Object.freeze(
  Object.keys(AREAS_DATABASE).filter(isArchivedLegacyAreaId),
);

/** Every non-canonical entry that actually exists in the current area database. */
export const ALL_LEGACY_AREA_IDS = Object.freeze(
  Object.keys(AREAS_DATABASE).filter(areaId => !isMainWorldAreaId(areaId)),
);

export function getWorldAreaLifecycle(areaId: string): WorldAreaLifecycle {
  if (isMainWorldAreaId(areaId)) return 'active';
  if (isLegacyMainAreaId(areaId)) return 'redirect-legacy';
  if (isArchivedLegacyAreaId(areaId)) return 'archived-legacy';
  return 'unknown';
}
