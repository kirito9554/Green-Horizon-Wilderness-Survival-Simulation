import {
  MAIN_WORLD_AREA_IDS,
  type MainWorldAreaId,
} from './mainWorldAreas';
import {
  MAIN_MAP_TERRITORIES,
  type TerritoryPoint,
} from './poiTerritories';

/**
 * Spatial calibration for the current canonical island map.
 *
 * The authored territory polygons remain the source of truth. We only choose a
 * physical land-area target here, then derive the metric world bounds from the
 * raster aspect ratio and the fraction of that raster occupied by the ten
 * canonical territory polygons.
 */
export const MAIN_MAP_SOURCE_WIDTH_PX = 1672;
export const MAIN_MAP_SOURCE_HEIGHT_PX = 941;
export const MAIN_MAP_ASPECT_RATIO = MAIN_MAP_SOURCE_WIDTH_PX / MAIN_MAP_SOURCE_HEIGHT_PX;
export const MAIN_ISLAND_LAND_AREA_KM2 = 120;
export const MAIN_ISLAND_LAND_AREA_M2 = MAIN_ISLAND_LAND_AREA_KM2 * 1_000_000;

export interface WorldPointMeters {
  x: number;
  y: number;
}

export type WorldPolygon = readonly WorldPointMeters[];

export interface WorldBoundsMeters {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface MacroRegionGeometry {
  id: MainWorldAreaId;
  name: string;
  polygon: WorldPolygon;
  centroid: WorldPointMeters;
  bounds: WorldBoundsMeters;
  areaM2: number;
  areaKm2: number;
  areaShare: number;
}

function signedPolygonArea(points: readonly { x: number; y: number }[]): number {
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return twiceArea / 2;
}

export function polygonArea(points: readonly { x: number; y: number }[]): number {
  return Math.abs(signedPolygonArea(points));
}

function percentPolygonArea(points: readonly TerritoryPoint[]): number {
  return polygonArea(points.map(([x, y]) => ({ x, y })));
}

const CANONICAL_POLYGON_AREA_PERCENT2 = MAIN_WORLD_AREA_IDS.reduce((sum, areaId) => {
  const territory = MAIN_MAP_TERRITORIES[areaId];
  if (!territory) throw new Error(`Missing canonical territory geometry for ${areaId}`);
  return sum + percentPolygonArea(territory.points);
}, 0);

/** Fraction of the full source-image rectangle represented by canonical land polygons. */
export const MAIN_ISLAND_LAND_FRACTION_OF_MAP = CANONICAL_POLYGON_AREA_PERCENT2 / 10_000;

/**
 * Rectangle dimensions are derived rather than hand-authored:
 *   width / height = source raster aspect ratio
 *   polygon land area = exactly MAIN_ISLAND_LAND_AREA_M2
 */
const WORLD_RECTANGLE_AREA_M2 = MAIN_ISLAND_LAND_AREA_M2 / MAIN_ISLAND_LAND_FRACTION_OF_MAP;
export const MAIN_WORLD_HEIGHT_METERS = Math.sqrt(WORLD_RECTANGLE_AREA_M2 / MAIN_MAP_ASPECT_RATIO);
export const MAIN_WORLD_WIDTH_METERS = MAIN_WORLD_HEIGHT_METERS * MAIN_MAP_ASPECT_RATIO;

export const MAIN_WORLD_BOUNDS_METERS: WorldBoundsMeters = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: MAIN_WORLD_WIDTH_METERS,
  maxY: MAIN_WORLD_HEIGHT_METERS,
  width: MAIN_WORLD_WIDTH_METERS,
  height: MAIN_WORLD_HEIGHT_METERS,
});

export function percentPointToWorld(point: TerritoryPoint): WorldPointMeters {
  return {
    x: (point[0] / 100) * MAIN_WORLD_WIDTH_METERS,
    y: (point[1] / 100) * MAIN_WORLD_HEIGHT_METERS,
  };
}

export function worldPointToPercent(point: WorldPointMeters): TerritoryPoint {
  return [
    (point.x / MAIN_WORLD_WIDTH_METERS) * 100,
    (point.y / MAIN_WORLD_HEIGHT_METERS) * 100,
  ];
}

export function percentPolygonToWorld(points: readonly TerritoryPoint[]): WorldPolygon {
  return points.map(percentPointToWorld);
}

export function getPolygonBounds(points: WorldPolygon): WorldBoundsMeters {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getPolygonCentroid(points: WorldPolygon): WorldPointMeters {
  const signedArea = signedPolygonArea(points);
  if (Math.abs(signedArea) < 1e-9) {
    const fallback = points.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );
    return { x: fallback.x / points.length, y: fallback.y / points.length };
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }

  const divisor = 6 * signedArea;
  return { x: cx / divisor, y: cy / divisor };
}

function pointOnSegment(point: WorldPointMeters, a: WorldPointMeters, b: WorldPointMeters, epsilon = 1e-6): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -epsilon) return false;
  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= squaredLength + epsilon;
}

/** Boundary-inclusive point-in-polygon test. */
export function pointInPolygon(point: WorldPointMeters, polygon: WorldPolygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j];
    const b = polygon[i];
    if (pointOnSegment(point, a, b)) return true;

    const intersects = ((b.y > point.y) !== (a.y > point.y))
      && point.x < ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distanceMeters(a: WorldPointMeters, b: WorldPointMeters): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createMacroRegion(areaId: MainWorldAreaId): MacroRegionGeometry {
  const territory = MAIN_MAP_TERRITORIES[areaId];
  if (!territory) throw new Error(`Missing canonical territory geometry for ${areaId}`);
  const polygon = percentPolygonToWorld(territory.points);
  const areaM2 = polygonArea(polygon);
  return Object.freeze({
    id: areaId,
    name: territory.name,
    polygon,
    centroid: getPolygonCentroid(polygon),
    bounds: getPolygonBounds(polygon),
    areaM2,
    areaKm2: areaM2 / 1_000_000,
    areaShare: areaM2 / MAIN_ISLAND_LAND_AREA_M2,
  });
}

export const MAIN_WORLD_REGIONS: Readonly<Record<MainWorldAreaId, MacroRegionGeometry>> = Object.freeze(
  Object.fromEntries(MAIN_WORLD_AREA_IDS.map(areaId => [areaId, createMacroRegion(areaId)])) as Record<MainWorldAreaId, MacroRegionGeometry>,
);

export const MAIN_WORLD_REGION_LIST: readonly MacroRegionGeometry[] = Object.freeze(
  MAIN_WORLD_AREA_IDS.map(areaId => MAIN_WORLD_REGIONS[areaId]),
);

export function getRegionAtWorldPoint(point: WorldPointMeters): MacroRegionGeometry | undefined {
  return MAIN_WORLD_REGION_LIST.find(region => pointInPolygon(point, region.polygon));
}

export function getMainWorldGeometrySummary(): {
  landAreaKm2: number;
  worldWidthKm: number;
  worldHeightKm: number;
  landFractionOfMap: number;
  regions: readonly Pick<MacroRegionGeometry, 'id' | 'name' | 'areaKm2' | 'areaShare'>[];
} {
  return {
    landAreaKm2: MAIN_ISLAND_LAND_AREA_KM2,
    worldWidthKm: MAIN_WORLD_WIDTH_METERS / 1000,
    worldHeightKm: MAIN_WORLD_HEIGHT_METERS / 1000,
    landFractionOfMap: MAIN_ISLAND_LAND_FRACTION_OF_MAP,
    regions: MAIN_WORLD_REGION_LIST.map(({ id, name, areaKm2, areaShare }) => ({ id, name, areaKm2, areaShare })),
  };
}

const derivedLandAreaM2 = MAIN_WORLD_REGION_LIST.reduce((sum, region) => sum + region.areaM2, 0);
if (Math.abs(derivedLandAreaM2 - MAIN_ISLAND_LAND_AREA_M2) > 1) {
  throw new Error(`Canonical region geometry calibration drifted by ${derivedLandAreaM2 - MAIN_ISLAND_LAND_AREA_M2} m²`);
}
