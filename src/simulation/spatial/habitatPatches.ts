import {
  MAIN_WORLD_AREA_IDS,
  type MainWorldAreaId,
} from '../../data/mainWorldAreas';
import {
  MAIN_WORLD_REGIONS,
  type WorldBoundsMeters,
  type WorldPointMeters,
  type WorldPolygon,
  getPolygonBounds,
  getPolygonCentroid,
  pointInPolygon,
  polygonArea,
} from '../../data/worldGeometry';

/**
 * A 600 m authored-space lattice gives the 120 km² island a few hundred
 * ecological patches: detailed enough for habitat/travel/ecology without
 * pretending to simulate every square metre.
 */
export const HABITAT_PATCH_CELL_SIZE_METERS = 600;
export const DEFAULT_SPATIAL_WORLD_SEED = 'green-horizon-main-v1';

export type HabitatTag =
  | 'karst_forest'
  | 'cave_mouth'
  | 'wet_highland'
  | 'cloud_forest'
  | 'rocky_ridge'
  | 'montane_scrub'
  | 'bamboo_forest'
  | 'stream_valley'
  | 'steep_secondary_forest'
  | 'old_growth'
  | 'rocky_plateau'
  | 'ruin_edge'
  | 'coastal_forest'
  | 'disturbed_forest'
  | 'beach_scrub'
  | 'mangrove'
  | 'tidal_creek'
  | 'brackish_forest'
  | 'mudflat'
  | 'dense_understory'
  | 'creek_forest'
  | 'canopy_gap'
  | 'flooded_forest'
  | 'swamp'
  | 'wetland_channel'
  | 'raised_island'
  | 'riverine_forest'
  | 'gorge_slope'
  | 'waterfall_spray'
  | 'rocky_channel'
  | 'rocky_shore'
  | 'tidepool'
  | 'littoral_forest';

export type TerrainTag =
  | 'forest'
  | 'dense_vegetation'
  | 'rock'
  | 'steep'
  | 'wet'
  | 'mud'
  | 'shallow_water'
  | 'tidal'
  | 'coastal'
  | 'disturbed'
  | 'open_ground';

export interface HabitatSuitability {
  canopy: number;
  cover: number;
  moisture: number;
  aquatic: number;
  elevation: number;
  disturbance: number;
  forage: number;
}

interface HabitatVariant {
  habitat: HabitatTag;
  weight: number;
  terrainTags: readonly TerrainTag[];
  movementCost: number;
  suitability: HabitatSuitability;
}

export interface HabitatPatch {
  id: string;
  seed: number;
  parentRegionId: MainWorldAreaId;
  gridX: number;
  gridY: number;
  polygon: WorldPolygon;
  centroid: WorldPointMeters;
  bounds: WorldBoundsMeters;
  areaM2: number;
  areaKm2: number;
  /** Portion of the 600 m lattice cell occupied by this clipped land patch. */
  coverageFraction: number;
  habitat: HabitatTag;
  terrainTags: readonly TerrainTag[];
  /** Relative route impedance. 1 = easy open terrain; larger = slower/harder. */
  movementCost: number;
  suitability: HabitatSuitability;
}

const V = (
  habitat: HabitatTag,
  weight: number,
  terrainTags: readonly TerrainTag[],
  movementCost: number,
  suitability: HabitatSuitability,
): HabitatVariant => ({ habitat, weight, terrainTags, movementCost, suitability });

const REGION_HABITAT_PROFILES: Readonly<Record<MainWorldAreaId, readonly HabitatVariant[]>> = {
  AREA_CAVE_ENTRANCE: [
    V('karst_forest', 0.46, ['forest', 'rock', 'steep'], 2.2, { canopy: .78, cover: .82, moisture: .72, aquatic: .18, elevation: .66, disturbance: .08, forage: .52 }),
    V('cave_mouth', 0.16, ['rock', 'open_ground'], 1.8, { canopy: .24, cover: .86, moisture: .64, aquatic: .12, elevation: .55, disturbance: .04, forage: .18 }),
    V('wet_highland', 0.38, ['forest', 'wet', 'steep'], 2.35, { canopy: .7, cover: .73, moisture: .88, aquatic: .3, elevation: .76, disturbance: .05, forage: .56 }),
  ],
  AREA_STONE_RIDGE: [
    V('cloud_forest', 0.42, ['forest', 'wet', 'steep'], 2.45, { canopy: .74, cover: .7, moisture: .85, aquatic: .12, elevation: .9, disturbance: .04, forage: .48 }),
    V('rocky_ridge', 0.38, ['rock', 'steep', 'open_ground'], 2.6, { canopy: .2, cover: .44, moisture: .46, aquatic: .04, elevation: .96, disturbance: .06, forage: .18 }),
    V('montane_scrub', 0.2, ['dense_vegetation', 'rock', 'steep'], 2.05, { canopy: .38, cover: .68, moisture: .62, aquatic: .05, elevation: .83, disturbance: .08, forage: .42 }),
  ],
  AREA_BAMBOO_GROVE: [
    V('bamboo_forest', 0.56, ['forest', 'dense_vegetation'], 2.0, { canopy: .76, cover: .84, moisture: .68, aquatic: .08, elevation: .52, disturbance: .16, forage: .55 }),
    V('stream_valley', 0.2, ['forest', 'wet'], 1.75, { canopy: .68, cover: .72, moisture: .9, aquatic: .5, elevation: .38, disturbance: .08, forage: .72 }),
    V('steep_secondary_forest', 0.24, ['forest', 'dense_vegetation', 'steep'], 2.45, { canopy: .64, cover: .8, moisture: .65, aquatic: .08, elevation: .7, disturbance: .22, forage: .56 }),
  ],
  AREA_ANCIENT_RUINS: [
    V('old_growth', 0.46, ['forest', 'dense_vegetation'], 2.15, { canopy: .91, cover: .88, moisture: .69, aquatic: .06, elevation: .46, disturbance: .05, forage: .7 }),
    V('rocky_plateau', 0.3, ['rock', 'forest'], 1.9, { canopy: .54, cover: .62, moisture: .52, aquatic: .03, elevation: .57, disturbance: .08, forage: .42 }),
    V('ruin_edge', 0.24, ['forest', 'rock', 'disturbed'], 1.7, { canopy: .52, cover: .71, moisture: .58, aquatic: .03, elevation: .48, disturbance: .38, forage: .54 }),
  ],
  AREA_CAMP_CLEARING: [
    V('coastal_forest', 0.42, ['forest', 'coastal'], 1.55, { canopy: .66, cover: .64, moisture: .58, aquatic: .12, elevation: .16, disturbance: .2, forage: .58 }),
    V('disturbed_forest', 0.36, ['forest', 'disturbed', 'open_ground'], 1.35, { canopy: .46, cover: .52, moisture: .48, aquatic: .06, elevation: .18, disturbance: .68, forage: .48 }),
    V('beach_scrub', 0.22, ['coastal', 'open_ground'], 1.15, { canopy: .16, cover: .28, moisture: .36, aquatic: .28, elevation: .08, disturbance: .42, forage: .32 }),
  ],
  AREA_MANGROVE_EDGE: [
    V('mangrove', 0.44, ['forest', 'wet', 'tidal', 'mud'], 3.0, { canopy: .68, cover: .86, moisture: 1, aquatic: .82, elevation: .03, disturbance: .06, forage: .7 }),
    V('tidal_creek', 0.2, ['wet', 'tidal', 'shallow_water', 'mud'], 3.8, { canopy: .28, cover: .48, moisture: 1, aquatic: 1, elevation: .01, disturbance: .04, forage: .76 }),
    V('brackish_forest', 0.25, ['forest', 'wet', 'mud'], 2.55, { canopy: .78, cover: .81, moisture: .95, aquatic: .55, elevation: .08, disturbance: .05, forage: .72 }),
    V('mudflat', 0.11, ['wet', 'tidal', 'mud', 'open_ground'], 3.25, { canopy: .03, cover: .16, moisture: 1, aquatic: .74, elevation: .01, disturbance: .12, forage: .46 }),
  ],
  AREA_FOREST_EDGE: [
    V('old_growth', 0.46, ['forest', 'dense_vegetation'], 2.25, { canopy: .96, cover: .92, moisture: .73, aquatic: .06, elevation: .34, disturbance: .02, forage: .76 }),
    V('dense_understory', 0.28, ['forest', 'dense_vegetation'], 2.55, { canopy: .88, cover: .97, moisture: .76, aquatic: .05, elevation: .3, disturbance: .03, forage: .7 }),
    V('creek_forest', 0.18, ['forest', 'wet'], 1.95, { canopy: .86, cover: .84, moisture: .93, aquatic: .48, elevation: .22, disturbance: .04, forage: .84 }),
    V('canopy_gap', 0.08, ['forest', 'open_ground', 'disturbed'], 1.45, { canopy: .32, cover: .46, moisture: .62, aquatic: .05, elevation: .3, disturbance: .42, forage: .86 }),
  ],
  AREA_SWAMP_CROSSING: [
    V('flooded_forest', 0.46, ['forest', 'wet', 'shallow_water'], 3.0, { canopy: .8, cover: .84, moisture: 1, aquatic: .82, elevation: .05, disturbance: .03, forage: .72 }),
    V('swamp', 0.22, ['wet', 'mud', 'shallow_water'], 3.65, { canopy: .28, cover: .58, moisture: 1, aquatic: .93, elevation: .02, disturbance: .04, forage: .66 }),
    V('wetland_channel', 0.18, ['wet', 'shallow_water'], 4.0, { canopy: .16, cover: .36, moisture: 1, aquatic: 1, elevation: .01, disturbance: .03, forage: .78 }),
    V('raised_island', 0.14, ['forest', 'open_ground'], 1.65, { canopy: .64, cover: .65, moisture: .76, aquatic: .26, elevation: .14, disturbance: .05, forage: .8 }),
  ],
  AREA_WATERFALL_BASIN: [
    V('riverine_forest', 0.36, ['forest', 'wet', 'steep'], 2.35, { canopy: .74, cover: .76, moisture: .94, aquatic: .62, elevation: .42, disturbance: .03, forage: .72 }),
    V('gorge_slope', 0.32, ['rock', 'steep'], 3.1, { canopy: .36, cover: .62, moisture: .7, aquatic: .16, elevation: .62, disturbance: .03, forage: .3 }),
    V('waterfall_spray', 0.18, ['wet', 'rock', 'steep'], 2.7, { canopy: .42, cover: .66, moisture: 1, aquatic: .72, elevation: .5, disturbance: .02, forage: .58 }),
    V('rocky_channel', 0.14, ['rock', 'wet', 'shallow_water'], 3.5, { canopy: .08, cover: .24, moisture: 1, aquatic: .96, elevation: .28, disturbance: .04, forage: .36 }),
  ],
  AREA_FISHING_LAGOON: [
    V('rocky_shore', 0.42, ['rock', 'coastal', 'open_ground'], 1.8, { canopy: .08, cover: .38, moisture: .52, aquatic: .52, elevation: .06, disturbance: .16, forage: .28 }),
    V('tidepool', 0.2, ['rock', 'coastal', 'tidal', 'shallow_water'], 2.6, { canopy: .01, cover: .22, moisture: 1, aquatic: .96, elevation: .01, disturbance: .08, forage: .62 }),
    V('littoral_forest', 0.38, ['forest', 'coastal'], 1.65, { canopy: .66, cover: .68, moisture: .58, aquatic: .18, elevation: .12, disturbance: .12, forage: .54 }),
  ],
};

function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function chooseHabitat(regionId: MainWorldAreaId, gridX: number, gridY: number, worldSeed: string): { variant: HabitatVariant; seed: number } {
  const seed = hash32(`${worldSeed}|${regionId}|${gridX}|${gridY}`);
  // Two-cell blocks create broad habitat patches instead of visual-noise-like per-cell randomness.
  const habitatNoise = hash32(`${worldSeed}|habitat|${regionId}|${Math.floor(gridX / 2)}|${Math.floor(gridY / 2)}`) / 0x1_0000_0000;
  const variants = REGION_HABITAT_PROFILES[regionId];
  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
  let cursor = habitatNoise * totalWeight;
  for (const variant of variants) {
    cursor -= variant.weight;
    if (cursor <= 0) return { variant, seed };
  }
  return { variant: variants[variants.length - 1], seed };
}

function intersectionAtX(a: WorldPointMeters, b: WorldPointMeters, x: number): WorldPointMeters {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 1e-9) return { x, y: a.y };
  const t = (x - a.x) / dx;
  return { x, y: a.y + (b.y - a.y) * t };
}

function intersectionAtY(a: WorldPointMeters, b: WorldPointMeters, y: number): WorldPointMeters {
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-9) return { x: a.x, y };
  const t = (y - a.y) / dy;
  return { x: a.x + (b.x - a.x) * t, y };
}

function clipEdge(
  subject: readonly WorldPointMeters[],
  inside: (point: WorldPointMeters) => boolean,
  intersect: (a: WorldPointMeters, b: WorldPointMeters) => WorldPointMeters,
): WorldPointMeters[] {
  if (subject.length === 0) return [];
  const output: WorldPointMeters[] = [];
  let previous = subject[subject.length - 1];
  let previousInside = inside(previous);

  for (const current of subject) {
    const currentInside = inside(current);
    if (currentInside !== previousInside) output.push(intersect(previous, current));
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function removeDuplicateVertices(points: WorldPointMeters[]): WorldPointMeters[] {
  const cleaned: WorldPointMeters[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 1e-5) cleaned.push(point);
  }
  if (cleaned.length > 2) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 1e-5) cleaned.pop();
  }
  return cleaned;
}

/** Clip an authored macro polygon to one axis-aligned lattice cell. */
export function clipPolygonToBounds(polygon: WorldPolygon, bounds: WorldBoundsMeters): WorldPointMeters[] {
  let clipped = [...polygon];
  clipped = clipEdge(clipped, p => p.x >= bounds.minX - 1e-7, (a, b) => intersectionAtX(a, b, bounds.minX));
  clipped = clipEdge(clipped, p => p.x <= bounds.maxX + 1e-7, (a, b) => intersectionAtX(a, b, bounds.maxX));
  clipped = clipEdge(clipped, p => p.y >= bounds.minY - 1e-7, (a, b) => intersectionAtY(a, b, bounds.minY));
  clipped = clipEdge(clipped, p => p.y <= bounds.maxY + 1e-7, (a, b) => intersectionAtY(a, b, bounds.maxY));
  return removeDuplicateVertices(clipped);
}

function makePatchCentroid(polygon: WorldPolygon, parentPolygon: WorldPolygon): WorldPointMeters {
  const centroid = getPolygonCentroid(polygon);
  if (pointInPolygon(centroid, polygon) && pointInPolygon(centroid, parentPolygon)) return centroid;
  const bounds = getPolygonBounds(polygon);
  const center = { x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 };
  if (pointInPolygon(center, polygon) && pointInPolygon(center, parentPolygon)) return center;
  return { ...polygon[0] };
}

export function generateHabitatPatches(worldSeed = DEFAULT_SPATIAL_WORLD_SEED): HabitatPatch[] {
  const patches: HabitatPatch[] = [];
  const cellAreaM2 = HABITAT_PATCH_CELL_SIZE_METERS ** 2;

  for (const regionId of MAIN_WORLD_AREA_IDS) {
    const region = MAIN_WORLD_REGIONS[regionId];
    const minGridX = Math.floor(region.bounds.minX / HABITAT_PATCH_CELL_SIZE_METERS);
    const maxGridX = Math.floor((region.bounds.maxX - 1e-7) / HABITAT_PATCH_CELL_SIZE_METERS);
    const minGridY = Math.floor(region.bounds.minY / HABITAT_PATCH_CELL_SIZE_METERS);
    const maxGridY = Math.floor((region.bounds.maxY - 1e-7) / HABITAT_PATCH_CELL_SIZE_METERS);

    for (let gridY = minGridY; gridY <= maxGridY; gridY += 1) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
        const minX = gridX * HABITAT_PATCH_CELL_SIZE_METERS;
        const minY = gridY * HABITAT_PATCH_CELL_SIZE_METERS;
        const cellBounds: WorldBoundsMeters = {
          minX,
          minY,
          maxX: minX + HABITAT_PATCH_CELL_SIZE_METERS,
          maxY: minY + HABITAT_PATCH_CELL_SIZE_METERS,
          width: HABITAT_PATCH_CELL_SIZE_METERS,
          height: HABITAT_PATCH_CELL_SIZE_METERS,
        };
        const polygon = clipPolygonToBounds(region.polygon, cellBounds);
        if (polygon.length < 3) continue;
        const areaM2 = polygonArea(polygon);
        if (areaM2 < 1) continue;

        const { variant, seed } = chooseHabitat(regionId, gridX, gridY, worldSeed);
        patches.push(Object.freeze({
          id: `HAB_${regionId.replace(/^AREA_/, '')}_${gridX}_${gridY}`,
          seed,
          parentRegionId: regionId,
          gridX,
          gridY,
          polygon,
          centroid: makePatchCentroid(polygon, region.polygon),
          bounds: getPolygonBounds(polygon),
          areaM2,
          areaKm2: areaM2 / 1_000_000,
          coverageFraction: Math.min(1, areaM2 / cellAreaM2),
          habitat: variant.habitat,
          terrainTags: variant.terrainTags,
          movementCost: variant.movementCost,
          suitability: { ...variant.suitability },
        }));
      }
    }
  }

  return patches;
}

export const MAIN_HABITAT_PATCHES: readonly HabitatPatch[] = Object.freeze(generateHabitatPatches());

export function getHabitatPatchesForRegion(regionId: MainWorldAreaId, patches: readonly HabitatPatch[] = MAIN_HABITAT_PATCHES): HabitatPatch[] {
  return patches.filter(patch => patch.parentRegionId === regionId);
}

export function findHabitatPatchAtPoint(point: WorldPointMeters, patches: readonly HabitatPatch[] = MAIN_HABITAT_PATCHES): HabitatPatch | undefined {
  return patches.find(patch =>
    point.x >= patch.bounds.minX
    && point.x <= patch.bounds.maxX
    && point.y >= patch.bounds.minY
    && point.y <= patch.bounds.maxY
    && pointInPolygon(point, patch.polygon));
}
