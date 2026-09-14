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

/** Width is percentage of source-image width. Point order is downstream. */
export const MAIN_MAP_STREAMS: readonly MainMapStream[] = [
  {
    points: [
      [11.2, 7.5], [11.6, 11.0], [12.2, 15.2], [13.8, 18.0], [16.5, 21.0],
      [18.4, 24.0], [17.7, 28.0], [19.2, 31.5], [22.0, 34.0], [25.0, 37.0],
      [27.0, 41.0], [29.5, 44.5], [31.0, 49.0], [30.5, 54.0],
    ],
    width: 3.0,
  },
  {
    points: [
      [23.0, 26.0], [25.0, 30.0], [28.0, 33.0], [31.0, 36.0], [34.0, 39.0],
      [36.0, 43.0], [39.0, 47.0], [43.0, 50.0], [47.0, 53.0],
    ],
    width: 2.2,
  },
  {
    points: [
      [71.8, 11.0], [72.0, 15.0], [70.8, 19.5], [69.3, 23.0], [68.2, 28.0],
      [67.5, 33.0], [65.7, 37.5], [63.7, 40.5], [61.5, 44.0], [59.6, 48.0],
      [58.7, 52.0], [59.5, 56.0], [61.8, 59.5],
    ],
    width: 2.3,
  },
  {
    points: [
      [93.5, 45.0], [91.5, 49.0], [89.0, 52.0], [86.5, 55.0], [84.8, 58.0],
      [85.5, 62.0], [87.5, 65.5], [89.5, 69.0], [91.0, 73.0], [93.0, 77.5],
      [95.0, 82.0], [97.0, 87.0], [98.5, 93.0], [99.6, 99.0],
    ],
    width: 4.0,
  },
];

/** Broad candidate regions; color gating in the shader trims these to painted water. */
export const MAIN_MAP_POOLS: readonly (readonly MainMapPoint[])[] = [
  [
    [0, 34], [8, 34], [17, 36], [26, 38], [34, 43], [35, 52],
    [31, 59], [24, 64], [13, 65], [4, 61], [0, 57],
  ],
  [
    [49, 47], [56, 46], [63, 48], [70, 49], [76, 53],
    [75, 60], [69, 67], [60, 69], [54, 66], [50, 60],
  ],
  [
    [9, 14], [13, 13], [17, 15], [19, 18], [18, 21], [14, 22], [10, 20],
  ],
  [
    [0, 60], [4, 61], [8, 68], [15, 75], [24, 80], [34, 86],
    [46, 92], [55, 95], [62, 92], [70, 90], [77, 93], [83, 100], [0, 100],
  ],
  [
    [90, 88], [94, 83], [98, 79], [100, 77], [100, 100], [83, 100], [84, 97],
  ],
];

export const MAIN_MAP_POOL_KINDS: readonly MainMapPoolKind[] = [
  'lake', 'lake', 'lake', 'ocean', 'ocean',
];

/** Waterfall curtains traced from the two visible cascade systems on main.png. */
export const MAIN_MAP_WATERFALLS: readonly MainMapWaterfallDescriptor[] = [
  {
    id: 'northwest-west-curtain',
    points: [[9.8, 10.5], [10.2, 15.5]],
    widthTop: 1.8,
    widthBottom: 2.8,
    seed: 0.13,
  },
  {
    id: 'northwest-main-curtain',
    points: [[11.5, 9.8], [12.0, 15.8]],
    widthTop: 2.2,
    widthBottom: 3.2,
    seed: 0.37,
  },
  {
    id: 'northwest-east-curtain',
    points: [[13.2, 10.4], [13.6, 15.2]],
    widthTop: 1.4,
    widthBottom: 2.2,
    seed: 0.53,
  },
  {
    id: 'river-gorge-main',
    points: [[84.2, 54.2], [84.3, 58.0], [84.8, 61.0]],
    widthTop: 1.4,
    widthBottom: 2.5,
    seed: 0.71,
  },
  {
    id: 'river-gorge-east',
    points: [[87.4, 55.5], [86.8, 59.0], [86.3, 61.8]],
    widthTop: 0.9,
    widthBottom: 1.7,
    seed: 0.89,
  },
];

/** Keep exactly three impacts because the current WebGL program exposes three uniforms. */
export const MAIN_MAP_WATERFALL_IMPACTS: readonly MainMapWaterfallImpact[] = [
  { center: [12.1, 18.0], radius: [5.0, 2.6], seed: 0.17 },
  { center: [85.5, 63.0], radius: [4.0, 2.2], seed: 0.61 },
  { center: [87.3, 60.5], radius: [2.5, 1.4], seed: 0.83 },
];

/**
 * Baked label rectangles expanded slightly beyond the visible text.
 * Water displacement is cleared here so POI labels stay perfectly readable.
 */
export const MAIN_MAP_LABEL_EXCLUSIONS: readonly MainMapLabelExclusion[] = [
  { x: 44.5, y: 9.5, w: 11.8, h: 5.0 },  // Limestone Cave
  { x: 71.1, y: 7.9, w: 14.6, h: 5.1 },  // Misty Highlands
  { x: 61.6, y: 24.4, w: 13.6, h: 5.2 }, // Bamboo Valley
  { x: 35.6, y: 31.5, w: 12.8, h: 5.1 }, // Ancient Ruins
  { x: 78.5, y: 46.2, w: 12.0, h: 5.2 }, // Plane Wreck
  { x: 7.0, y: 51.4, w: 13.6, h: 5.2 },  // Mangrove Delta
  { x: 33.2, y: 62.6, w: 14.6, h: 5.2 }, // Deep Rainforest
  { x: 56.9, y: 59.5, w: 13.2, h: 5.2 }, // Flooded Forest
  { x: 86.3, y: 63.1, w: 13.0, h: 5.2 }, // River Gorge
  { x: 4.7, y: 79.5, w: 12.8, h: 5.2 },  // Rocky Shore
];
