/**
 * Geometry calibration for public/maps/main.png (1672 x 941).
 * All coordinates are percentages of the source image so they stay aligned
 * with the raster while the map is scaled and panned.
 */

export type MainMapPoint = readonly [number, number];
export type MainMapStream = { points: readonly MainMapPoint[]; width: number };
export type MainMapPoolKind = 'lake' | 'ocean';

export interface MainMapWaterfallDescriptor {
  id: string;
  points: readonly MainMapPoint[];
  widthTop: number;
  widthBottom: number;
  seed: number;
}

export interface MainMapWaterfallImpact {
  center: MainMapPoint;
  radius: MainMapPoint;
  seed: number;
}

export interface MainMapLabelExclusion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Only these compact POIs are exposed on the current main map. */
export const MAIN_MAP_AREA_IDS = [
  'AREA_CAVE_ENTRANCE',       // Limestone Cave
  'AREA_STONE_RIDGE',         // Misty Highlands
  'AREA_BAMBOO_GROVE',        // Bamboo Valley
  'AREA_ANCIENT_RUINS',       // Ancient Ruins
  'AREA_CAMP_CLEARING',       // Plane Wreck (start)
  'AREA_MANGROVE_EDGE',       // Mangrove Delta
  'AREA_FOREST_EDGE',         // Deep Rainforest
  'AREA_SWAMP_CROSSING',      // Flooded Forest
  'AREA_WATERFALL_BASIN',     // River Gorge
  'AREA_FISHING_LAGOON',      // Rocky Shore
] as const;

export const MAIN_MAP_START_AREA_ID = 'AREA_CAMP_CLEARING' as const;

/**
 * Flow spines follow visible channels rather than POI labels. Width is a
 * percentage of source-image width and point order is downstream direction.
 */
export const MAIN_MAP_STREAMS: readonly MainMapStream[] = [
  // Northwest waterfall basin -> mangrove wetland.
  {
    points: [
      [12.1, 18.0], [14.0, 20.7], [15.6, 23.8], [14.8, 27.0], [16.0, 30.0],
      [15.2, 33.5], [16.0, 37.0], [15.2, 40.5], [16.2, 44.0], [15.4, 47.5],
      [14.0, 50.5], [13.2, 54.0], [13.9, 57.5], [15.6, 60.5], [17.8, 63.5],
    ],
    width: 2.6,
  },
  // Broad lower western wetland channel toward the coast.
  {
    points: [
      [17.8, 63.5], [19.5, 67.0], [21.5, 70.5], [24.0, 73.0], [27.0, 76.0],
      [30.0, 79.0], [33.0, 82.0], [36.5, 85.5], [40.5, 89.0], [44.0, 92.0],
    ],
    width: 3.0,
  },
  // Highland / Bamboo Valley stream.
  {
    points: [
      [71.0, 12.0], [70.3, 16.0], [69.0, 20.0], [67.4, 24.0], [66.0, 28.0],
      [65.8, 32.0], [66.8, 35.5], [68.0, 38.5], [69.2, 42.0], [70.5, 45.0],
    ],
    width: 1.75,
  },
  // River Gorge: starts below the twin cascades and runs to the southeast sea.
  {
    points: [
      [83.4, 59.0], [83.2, 62.5], [83.8, 66.0], [84.8, 69.5], [85.4, 73.0],
      [86.1, 76.5], [86.8, 80.0], [87.8, 84.0], [89.0, 88.0], [90.2, 92.0],
      [91.5, 96.0], [92.5, 100.0],
    ],
    width: 4.1,
  },
];

/**
 * Tight candidate polygons around visible water. The runtime color gate trims
 * shore vegetation and rocks, so these polygons intentionally overlap only a
 * small amount of surrounding terrain.
 */
export const MAIN_MAP_POOLS: readonly (readonly MainMapPoint[])[] = [
  // Northwest waterfall basin and upper braided wetland.
  [
    [8.5, 15.0], [12.0, 13.7], [16.7, 14.4], [20.2, 17.0], [20.5, 21.2],
    [18.4, 24.8], [16.2, 28.5], [13.0, 29.5], [9.5, 27.0], [7.8, 22.0],
  ],
  // Mangrove / western flooded channels.
  [
    [7.0, 47.0], [11.0, 45.0], [16.5, 46.0], [20.5, 49.5], [22.0, 55.0],
    [21.0, 61.5], [18.0, 66.5], [13.0, 67.0], [8.0, 63.0], [5.5, 56.0],
  ],
  // Flooded Forest basin.
  [
    [55.0, 50.0], [60.0, 48.5], [66.0, 49.0], [70.5, 52.0], [72.0, 56.5],
    [70.0, 62.0], [66.0, 66.5], [60.5, 67.5], [56.0, 64.5], [53.5, 59.0],
  ],
  // Southern ocean beneath the long rocky / sandy coast.
  [
    [0, 66], [7, 68], [14, 72], [22, 77], [31, 83], [40, 88], [49, 93],
    [56, 96], [63, 94], [70, 91], [77, 91], [83, 95], [87, 100], [0, 100],
  ],
  // Southeast ocean beside the river mouth.
  [
    [90, 91], [93, 87], [96, 82], [100, 78], [100, 100], [87, 100],
  ],
];

export const MAIN_MAP_POOL_KINDS: readonly MainMapPoolKind[] = [
  'lake', 'lake', 'lake', 'ocean', 'ocean',
];

/** Waterfall curtains traced from the two visible cascade systems on main.png. */
export const MAIN_MAP_WATERFALLS: readonly MainMapWaterfallDescriptor[] = [
  {
    id: 'northwest-west-curtain',
    points: [[9.8, 10.4], [10.1, 14.6], [10.5, 17.0]],
    widthTop: 1.35,
    widthBottom: 2.1,
    seed: 0.13,
  },
  {
    id: 'northwest-main-curtain',
    points: [[11.4, 9.1], [11.7, 13.8], [12.0, 17.2]],
    widthTop: 1.8,
    widthBottom: 2.8,
    seed: 0.37,
  },
  {
    id: 'northwest-east-curtain',
    points: [[13.1, 10.4], [13.3, 14.0], [13.5, 16.7]],
    widthTop: 1.1,
    widthBottom: 1.8,
    seed: 0.53,
  },
  {
    id: 'river-gorge-main',
    points: [[82.1, 54.0], [82.3, 57.0], [82.8, 60.0]],
    widthTop: 1.35,
    widthBottom: 2.35,
    seed: 0.71,
  },
  {
    id: 'river-gorge-east',
    points: [[84.1, 54.8], [83.9, 57.7], [83.7, 60.5]],
    widthTop: 0.9,
    widthBottom: 1.55,
    seed: 0.89,
  },
];

/** Keep exactly three impacts because the current main-map WebGL program exposes three uniforms. */
export const MAIN_MAP_WATERFALL_IMPACTS: readonly MainMapWaterfallImpact[] = [
  { center: [12.0, 18.3], radius: [4.7, 2.5], seed: 0.17 },
  { center: [82.9, 61.3], radius: [3.6, 1.9], seed: 0.61 },
  { center: [84.2, 60.6], radius: [2.2, 1.3], seed: 0.83 },
];

/** Baked label rectangles expanded beyond the visible text and drop shadow. */
export const MAIN_MAP_LABEL_EXCLUSIONS: readonly MainMapLabelExclusion[] = [
  { x: 44.4, y: 7.3, w: 12.2, h: 9.0 },  // Limestone Cave
  { x: 70.3, y: 5.5, w: 16.5, h: 10.5 }, // Misty Highlands
  { x: 60.7, y: 21.0, w: 15.7, h: 11.5 },// Bamboo Valley
  { x: 34.5, y: 28.5, w: 15.0, h: 9.5 }, // Ancient Ruins
  { x: 77.5, y: 42.5, w: 13.0, h: 9.8 }, // Plane Wreck
  { x: 6.5, y: 49.8, w: 13.7, h: 10.5 }, // Mangrove Delta
  { x: 32.3, y: 58.8, w: 16.2, h: 13.0 },// Deep Rainforest
  { x: 55.5, y: 55.8, w: 15.4, h: 12.5 },// Flooded Forest
  { x: 85.4, y: 59.0, w: 14.4, h: 11.8 },// River Gorge
  { x: 3.3, y: 75.0, w: 15.6, h: 12.5 }, // Rocky Shore
];
