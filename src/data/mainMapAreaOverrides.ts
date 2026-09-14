import { AREAS_DATABASE } from './areas';
import type { AreaDefinition } from '../types';

/**
 * Display/calibration overrides for public/maps/main.png.
 *
 * We intentionally reuse existing area IDs so saves, POI storage, construction,
 * resource nodes and expedition references remain backward-compatible. The old
 * sector data stays in areas.ts for future multi-map expansion.
 */
type AreaOverride = Partial<AreaDefinition> & Pick<AreaDefinition, 'name' | 'mapX' | 'mapY'>;

export const MAIN_MAP_AREA_OVERRIDES: Record<string, AreaOverride> = {
  AREA_CAVE_ENTRANCE: {
    name: 'Limestone Cave',
    mapX: 50.39,
    mapY: 11.74,
    boxW: 8.9,
    boxH: 3.2,
    iconType: 'cave',
    description: 'A limestone cave system hidden in the wet northern highlands, with cold air rising from deep chambers.',
  },
  AREA_STONE_RIDGE: {
    name: 'Misty Highlands',
    mapX: 78.47,
    mapY: 10.41,
    boxW: 10.7,
    boxH: 3.2,
    iconType: 'mountain',
    description: 'A rain-soaked highland ridge wrapped in cloud and exposed to violent tropical weather.',
  },
  AREA_BAMBOO_GROVE: {
    name: 'Bamboo Valley',
    mapX: 68.45,
    mapY: 26.99,
    boxW: 9.7,
    boxH: 3.2,
    iconType: 'bamboo',
    description: 'A steep green valley packed with mature bamboo and narrow, slippery paths between limestone walls.',
  },
  AREA_ANCIENT_RUINS: {
    name: 'Ancient Ruins',
    mapX: 42.05,
    mapY: 33.10,
    boxW: 9.1,
    boxH: 3.2,
    iconType: 'ruins',
  },
  AREA_CAMP_CLEARING: {
    name: 'Plane Wreck',
    mapX: 84.03,
    mapY: 47.08,
    boxW: 8.8,
    boxH: 3.2,
    iconType: 'camp',
    description: 'The shattered aircraft wreck where the survivors first regrouped. Salvage and scattered supplies make it the natural starting point.',
    distanceKm: 0,
    baseTravelMinutes: 0,
    baseDanger: 5,
    flavorText: 'Twisted aluminum, torn luggage and a broken fuselage mark the beginning of the struggle to survive.',
  },
  AREA_MANGROVE_EDGE: {
    name: 'Mangrove Delta',
    mapX: 13.16,
    mapY: 54.89,
    boxW: 9.9,
    boxH: 3.2,
    iconType: 'river',
    description: 'A tangled tidal delta where brackish channels disappear beneath interlocking mangrove roots.',
  },
  AREA_FOREST_EDGE: {
    name: 'Deep Rainforest',
    mapX: 40.19,
    mapY: 65.46,
    boxW: 10.8,
    boxH: 3.2,
    iconType: 'trail',
    description: 'Dense old-growth rainforest with almost no clear route through the layered canopy and giant roots.',
  },
  AREA_SWAMP_CROSSING: {
    name: 'Flooded Forest',
    mapX: 63.25,
    mapY: 62.38,
    boxW: 10.0,
    boxH: 3.2,
    iconType: 'river',
    description: 'Seasonally flooded rainforest where dark water covers the forest floor and movement is slow and dangerous.',
  },
  AREA_WATERFALL_BASIN: {
    name: 'River Gorge',
    mapX: 92.76,
    mapY: 65.09,
    boxW: 9.4,
    boxH: 3.2,
    iconType: 'water',
    description: 'A steep gorge where several cascades feed a fast river before it drops toward the coast.',
  },
  AREA_FISHING_LAGOON: {
    name: 'Rocky Shore',
    mapX: 11.06,
    mapY: 81.88,
    boxW: 8.7,
    boxH: 3.2,
    iconType: 'beach',
    description: 'An exposed rocky shoreline battered by surf, with tide pools and narrow strips of usable beach.',
  },
};

/**
 * ESM modules are singletons. Applying these shallow overrides mutates the same
 * AREAS_DATABASE object imported by App, Inspect Location and simulation code,
 * while retaining every existing node and gameplay reference.
 */
export function applyMainMapAreaOverrides(): void {
  for (const [areaId, override] of Object.entries(MAIN_MAP_AREA_OVERRIDES)) {
    const target = AREAS_DATABASE[areaId];
    if (!target) continue;
    Object.assign(target, override, { sector: 'center' as const });
  }
}

applyMainMapAreaOverrides();
