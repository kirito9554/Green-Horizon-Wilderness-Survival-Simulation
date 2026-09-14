export type TerritoryPoint = [number, number];

export interface PoiTerritory {
  areaId: string;
  name: string;
  /** Subtitle or descriptor in explorer style */
  subtitle?: string;
  /** Polygon vertices in percentage [xPercent, yPercent] (0-100) */
  points: readonly TerritoryPoint[];
  /** Label anchor point in percentage [xPercent, yPercent] placed at center of region */
  labelPos: TerritoryPoint;
}

// Shared topological nodes for seamless contiguous borders
const NODES = {
  // Coastline perimeters
  COAST_NW: [30.0, 14.0] as TerritoryPoint,
  COAST_N_MID: [53.0, 3.5] as TerritoryPoint,
  COAST_NE_TOP: [71.0, 3.0] as TerritoryPoint,
  COAST_NE_TIP: [92.0, 5.0] as TerritoryPoint,
  COAST_E_TOP: [99.5, 21.0] as TerritoryPoint,
  COAST_E_MID_HIGH: [100.0, 33.0] as TerritoryPoint,
  COAST_E_MID: [100.0, 45.0] as TerritoryPoint,
  COAST_E_BOT: [99.5, 57.5] as TerritoryPoint,
  COAST_SE_TIP: [99.0, 75.0] as TerritoryPoint,
  COAST_SE_BOT: [91.0, 84.0] as TerritoryPoint,
  COAST_S_MID: [56.0, 80.5] as TerritoryPoint,
  COAST_S_DEEP: [35.0, 81.5] as TerritoryPoint,
  COAST_SW_BOT: [16.0, 95.0] as TerritoryPoint,
  COAST_SW_TIP: [2.5, 82.0] as TerritoryPoint,
  COAST_W_MID: [2.0, 58.0] as TerritoryPoint,
  COAST_W_TOP: [5.0, 42.0] as TerritoryPoint,
  COAST_W_INLET: [20.0, 32.0] as TerritoryPoint,

  // Interior boundary junctions
  J_CAVE_MIST_BAMBOO: [65.0, 16.5] as TerritoryPoint,
  J_CAVE_RUINS_BAMBOO: [55.0, 22.0] as TerritoryPoint,
  J_MIST_BAMBOO_CAMP: [79.0, 24.5] as TerritoryPoint,
  J_RUINS_BAMBOO_SWAMP: [57.5, 38.0] as TerritoryPoint,
  J_BAMBOO_CAMP_SWAMP: [77.0, 38.5] as TerritoryPoint,
  J_RUINS_MANGROVE_FOREST: [26.0, 48.5] as TerritoryPoint,
  J_RUINS_FOREST_SWAMP: [49.0, 47.0] as TerritoryPoint,
  J_MANGROVE_LAGOON_FOREST: [22.0, 68.5] as TerritoryPoint,
  J_CAMP_SWAMP_GORGE: [82.5, 58.5] as TerritoryPoint,
  J_FOREST_SWAMP_COAST: [54.0, 78.0] as TerritoryPoint,
  J_SWAMP_GORGE_COAST: [83.0, 80.0] as TerritoryPoint,
};

/**
 * 10 Contiguous provinces dividing the entire island like a jigsaw puzzle map.
 * All adjacent pairs share mathematically exact boundary vertices, eliminating gaps.
 * Labels are positioned at the optical/geometric centroid of each zone.
 */
export const MAIN_MAP_TERRITORIES: Record<string, PoiTerritory> = {
  // 1. Northern Karst Cave Ridge
  AREA_CAVE_ENTRANCE: {
    areaId: 'AREA_CAVE_ENTRANCE',
    name: 'Limestone Cave',
    subtitle: 'Northern Karst Caverns',
    labelPos: [52.3, 12.3],
    points: [
      NODES.COAST_NW,
      [41.0, 8.0],
      NODES.COAST_N_MID,
      [62.0, 4.0],
      NODES.COAST_NE_TOP,
      [68.0, 10.0],
      NODES.J_CAVE_MIST_BAMBOO,
      [60.0, 19.5],
      NODES.J_CAVE_RUINS_BAMBOO,
      [47.0, 21.0],
      [38.0, 18.0],
    ],
  },

  // 2. Northeast Misty Peaks
  AREA_STONE_RIDGE: {
    areaId: 'AREA_STONE_RIDGE',
    name: 'Misty Highlands',
    subtitle: 'Jagged Cloud Peaks',
    labelPos: [82.1, 13.5],
    points: [
      NODES.COAST_NE_TOP,
      [81.0, 3.5],
      NODES.COAST_NE_TIP,
      [96.0, 11.0],
      NODES.COAST_E_TOP,
      [88.0, 22.0],
      NODES.J_MIST_BAMBOO_CAMP,
      [72.0, 20.0],
      NODES.J_CAVE_MIST_BAMBOO,
      [68.0, 10.0],
    ],
  },

  // 3. Bamboo Slopes & Stream Valley
  AREA_BAMBOO_GROVE: {
    areaId: 'AREA_BAMBOO_GROVE',
    name: 'Bamboo Valley',
    subtitle: 'Bamboo Grove Slopes',
    labelPos: [66.8, 28.7],
    points: [
      NODES.J_CAVE_MIST_BAMBOO,
      [72.0, 20.0],
      NODES.J_MIST_BAMBOO_CAMP,
      [78.0, 31.0],
      NODES.J_BAMBOO_CAMP_SWAMP,
      [67.0, 38.5],
      NODES.J_RUINS_BAMBOO_SWAMP,
      [56.0, 30.0],
      NODES.J_CAVE_RUINS_BAMBOO,
      [60.0, 19.5],
    ],
  },

  // 4. West-Central Monolith Plateau
  AREA_ANCIENT_RUINS: {
    areaId: 'AREA_ANCIENT_RUINS',
    name: 'Ancient Ruins',
    subtitle: 'Megalithic Plateau',
    labelPos: [38.4, 33.0],
    points: [
      NODES.COAST_NW,
      [38.0, 18.0],
      [47.0, 21.0],
      NODES.J_CAVE_RUINS_BAMBOO,
      [56.0, 30.0],
      NODES.J_RUINS_BAMBOO_SWAMP,
      [53.0, 42.5],
      NODES.J_RUINS_FOREST_SWAMP,
      [37.0, 48.0],
      NODES.J_RUINS_MANGROVE_FOREST,
      [23.0, 41.0],
      NODES.COAST_W_INLET,
      [25.0, 23.0],
    ],
  },

  // 5. Eastern Coast Crash Beach & Camp (Expanded to right edge and deep into Flooded Forest, cleanly bounded above River Gorge)
  AREA_CAMP_CLEARING: {
    areaId: 'AREA_CAMP_CLEARING',
    name: 'Plane Wreck',
    subtitle: 'East Shore Base Camp',
    labelPos: [89.0, 40.5],
    points: [
      NODES.J_MIST_BAMBOO_CAMP,
      [88.0, 22.0],
      NODES.COAST_E_TOP,
      NODES.COAST_E_MID_HIGH,
      NODES.COAST_E_MID,
      NODES.COAST_E_BOT,
      [90.0, 57.5],
      NODES.J_CAMP_SWAMP_GORGE,
      [78.0, 55.0],
      NODES.J_BAMBOO_CAMP_SWAMP,
      [78.0, 31.0],
    ],
  },

  // 6. Western Tidal Delta & Estuary
  AREA_MANGROVE_EDGE: {
    areaId: 'AREA_MANGROVE_EDGE',
    name: 'Mangrove Delta',
    subtitle: 'Tidal Root Estuary',
    labelPos: [14.1, 52.5],
    points: [
      NODES.COAST_W_INLET,
      [23.0, 41.0],
      NODES.J_RUINS_MANGROVE_FOREST,
      [24.0, 58.5],
      NODES.J_MANGROVE_LAGOON_FOREST,
      [13.0, 68.0],
      [4.0, 68.0],
      NODES.COAST_W_MID,
      NODES.COAST_W_TOP,
      [12.0, 37.0],
    ],
  },

  // 7. South-Central Primary Canopy
  AREA_FOREST_EDGE: {
    areaId: 'AREA_FOREST_EDGE',
    name: 'Deep Rainforest',
    subtitle: 'Primeval Jungle Canopy',
    labelPos: [38.1, 64.4],
    points: [
      NODES.J_RUINS_MANGROVE_FOREST,
      [37.0, 48.0],
      NODES.J_RUINS_FOREST_SWAMP,
      [51.5, 62.5],
      NODES.J_FOREST_SWAMP_COAST,
      [45.0, 80.0],
      NODES.COAST_S_DEEP,
      [29.0, 80.0],
      NODES.J_MANGROVE_LAGOON_FOREST,
      [24.0, 58.5],
    ],
  },

  // 8. Wetland Marsh & Flooded Crossing
  AREA_SWAMP_CROSSING: {
    areaId: 'AREA_SWAMP_CROSSING',
    name: 'Flooded Forest',
    subtitle: 'Wetland Basin Crossing',
    labelPos: [66.4, 59.7],
    points: [
      NODES.J_RUINS_BAMBOO_SWAMP,
      [67.0, 38.5],
      NODES.J_BAMBOO_CAMP_SWAMP,
      [78.0, 55.0],
      NODES.J_CAMP_SWAMP_GORGE,
      [83.0, 69.0],
      NODES.J_SWAMP_GORGE_COAST,
      [69.0, 80.0],
      NODES.J_FOREST_SWAMP_COAST,
      [51.5, 62.5],
      NODES.J_RUINS_FOREST_SWAMP,
      [53.0, 42.5],
    ],
  },

  // 9. Southeastern Canyon & Cascades
  AREA_WATERFALL_BASIN: {
    areaId: 'AREA_WATERFALL_BASIN',
    name: 'River Gorge',
    subtitle: 'Cascade Canyon & Outflow',
    labelPos: [90.9, 69.3],
    points: [
      NODES.COAST_E_BOT,
      [99.5, 66.0],
      NODES.COAST_SE_TIP,
      [95.0, 80.0],
      NODES.COAST_SE_BOT,
      [87.0, 82.0],
      NODES.J_SWAMP_GORGE_COAST,
      [83.0, 69.0],
      NODES.J_CAMP_SWAMP_GORGE,
      [90.0, 57.5],
    ],
  },

  // 10. Southwestern Rocky Tidepools & Reef
  AREA_FISHING_LAGOON: {
    areaId: 'AREA_FISHING_LAGOON',
    name: 'Rocky Shore',
    subtitle: 'Reef Shallows & Tidepools',
    labelPos: [15.5, 80.3],
    points: [
      [4.0, 68.0],
      [13.0, 68.0],
      NODES.J_MANGROVE_LAGOON_FOREST,
      [29.0, 80.0],
      NODES.COAST_S_DEEP,
      [25.0, 88.0],
      NODES.COAST_SW_BOT,
      [9.0, 93.0],
      NODES.COAST_SW_TIP,
      [3.0, 75.0],
    ],
  },
};

/** Convert polygon vertices to SVG points attribute value */
export function territoryPointsToSvgString(points: readonly TerritoryPoint[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}
