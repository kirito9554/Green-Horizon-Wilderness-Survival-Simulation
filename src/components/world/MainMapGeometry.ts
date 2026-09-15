import {
  MAIN_WORLD_AREA_IDS,
  MAIN_WORLD_START_AREA_ID,
} from '../../data/mainWorldAreas';

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

/** Backward-compatible map exports; canonical IDs live in data/mainWorldAreas.ts. */
export const MAIN_MAP_AREA_IDS = MAIN_WORLD_AREA_IDS;
export const MAIN_MAP_START_AREA_ID = MAIN_WORLD_START_AREA_ID;

/**
 * Flow spines follow visible channels rather than POI labels. Width is a
 * percentage of source-image width and point order is downstream direction.
 */
export const MAIN_MAP_STREAMS: readonly MainMapStream[] = [
  // 1. Northwest waterfall basin -> Mangrove Delta channel
  {
    points: [
      [13.2, 18.5], [14.5, 22.0], [15.8, 25.5], [16.2, 29.0], [16.0, 33.0],
      [15.5, 37.0], [14.8, 41.0], [14.0, 45.0], [13.2, 49.0], [13.2, 54.5],
    ],
    width: 3.2,
  },
  // 2. Mangrove Delta -> South Coast / Rocky Shore channel
  {
    points: [
      [13.2, 54.5], [14.0, 58.0], [15.2, 62.0], [16.8, 66.0], [18.5, 70.0],
      [21.0, 74.0], [24.5, 78.0], [28.5, 82.0], [33.0, 85.5], [37.5, 88.5],
      [42.0, 92.0],
    ],
    width: 3.8,
  },
  // 3. Highland / Bamboo Valley mountain stream
  {
    points: [
      [72.0, 13.0], [70.5, 17.0], [68.5, 21.0], [67.0, 25.0], [65.5, 29.0],
      [66.0, 33.0], [68.0, 37.0], [69.5, 41.0], [70.5, 45.0],
    ],
    width: 2.2,
  },
  // 4. River Gorge: flows from the lower plunge pool down to the southeast sea
  {
    points: [
      [87.0, 72.5], [87.5, 76.0], [89.0, 79.5], [91.0, 83.0], [92.0, 86.5],
      [93.5, 90.0], [95.0, 93.0], [96.5, 96.0], [98.0, 99.0],
    ],
    width: 4.8,
  },
];

/**
 * Polygons covering visible water bodies across the island.
 * The runtime color gate filters dry terrain, foliage, and sand.
 */
export const MAIN_MAP_POOLS: readonly (readonly MainMapPoint[])[] = [
  // 1. Northwest waterfall plunge pool & upper basin
  [
    [8.0, 14.0], [12.0, 12.5], [17.5, 13.5], [21.0, 16.5], [21.5, 21.5],
    [19.0, 25.5], [16.5, 29.0], [12.5, 30.0], [9.0, 27.0], [7.5, 21.0],
  ],
  // 2. Mangrove tidal delta & flooded channels
  [
    [7.0, 46.0], [12.0, 44.0], [18.0, 45.0], [22.5, 49.0], [24.0, 55.0],
    [23.0, 62.0], [19.5, 67.0], [14.0, 67.5], [8.5, 63.5], [5.5, 55.5],
  ],
  // 3. Flooded Forest basin
  [
    [53.0, 49.0], [59.0, 47.5], [66.0, 48.0], [71.5, 51.5], [73.5, 56.5],
    [71.5, 62.5], [67.0, 67.0], [61.0, 68.0], [55.0, 65.0], [52.0, 58.5],
  ],
  // 4. Southern ocean & southwest coastal waters
  [
    [0, 66], [4, 68], [9, 72], [14, 73], [19, 78], [25, 82], [31, 84],
    [37, 87], [43, 90], [50, 94], [57, 95], [65, 96], [72, 97], [80, 99],
    [88, 100], [100, 100], [0, 100],
  ],
  // 5. Southeast & East ocean extending from River Gorge mouth
  [
    [88, 70], [92, 66], [96, 64], [100, 64], [100, 100], [88, 100],
  ],
  // 6. Northern sea coastal waters
  [
    [0, 0], [100, 0], [100, 5.5], [85, 4], [70, 3], [55, 4], [40, 3],
    [25, 4], [10, 5], [0, 5.5],
  ],
];

export const MAIN_MAP_POOL_KINDS: readonly MainMapPoolKind[] = [
  'lake', 'lake', 'lake', 'ocean', 'ocean', 'ocean',
];

/** Waterfall curtains calibrated directly against cascades in main.png */
export const MAIN_MAP_WATERFALLS: readonly MainMapWaterfallDescriptor[] = [
  // Northwest twin waterfall curtains
  {
    id: 'northwest-west-curtain',
    points: [[11.2, 9.0], [11.5, 13.5], [11.8, 17.5]],
    widthTop: 1.8,
    widthBottom: 2.8,
    seed: 0.23,
  },
  {
    id: 'northwest-east-curtain',
    points: [[13.8, 9.5], [14.4, 13.5], [14.8, 18.0]],
    widthTop: 1.6,
    widthBottom: 2.6,
    seed: 0.47,
  },
  // River Gorge two-tier cascading waterfall system
  {
    id: 'river-gorge-upper-cascade',
    points: [[87.2, 56.5], [86.8, 61.0], [87.5, 65.5]],
    widthTop: 2.2,
    widthBottom: 3.2,
    seed: 0.71,
  },
  {
    id: 'river-gorge-lower-plunge',
    points: [[87.5, 65.5], [87.0, 68.5], [86.8, 72.0]],
    widthTop: 2.8,
    widthBottom: 3.8,
    seed: 0.89,
  },
  {
    id: 'river-gorge-east-chute',
    points: [[89.5, 65.5], [89.2, 67.5], [88.8, 69.5]],
    widthTop: 1.2,
    widthBottom: 2.0,
    seed: 0.62,
  },
];

/** Impact ellipses for plunge pools (center.xy, radius.xy, seed) */
export const MAIN_MAP_WATERFALL_IMPACTS: readonly MainMapWaterfallImpact[] = [
  // Northwest main plunge pool basin
  { center: [13.2, 18.5], radius: [4.8, 2.8], seed: 0.28 },
  // River Gorge lower plunge pool basin
  { center: [87.0, 72.5], radius: [4.2, 2.6], seed: 0.74 },
  // River Gorge mid-tier plunge pool basin
  { center: [87.8, 66.0], radius: [3.2, 2.0], seed: 0.55 },
];

/**
 * HTML POI markers are layered above the WebGL canvas, so we do not
 * clear any water from the shader mask.
 */
export const MAIN_MAP_LABEL_EXCLUSIONS: readonly MainMapLabelExclusion[] = [];
