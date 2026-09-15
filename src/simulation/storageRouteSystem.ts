import type { GameState } from '../types';
import type { BuildCell, PoiBuildGrid } from '../types/buildingSimulation';
import type { StorageLocation, StorageRouteMetrics } from '../types/storageSimulation';
import '../types/buildingSimulation';
import '../types/storageSimulation';
import '../data/mainMapAreaOverrides';
import { AREAS_DATABASE } from '../data/areas';

interface PointM {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cellCenter(grid: PoiBuildGrid, cell: BuildCell): PointM {
  return {
    x: (cell.column + 0.5) * grid.cellSizeM,
    y: (cell.row + 0.5) * grid.cellSizeM,
  };
}

function centroid(points: Array<PointM & { weight?: number }>): PointM | null {
  if (!points.length) return null;
  let sumWeight = 0;
  let x = 0;
  let y = 0;
  for (const point of points) {
    const weight = Math.max(0.001, point.weight ?? 1);
    sumWeight += weight;
    x += point.x * weight;
    y += point.y * weight;
  }
  return { x: x / sumWeight, y: y / sumWeight };
}

function gridCenter(grid: PoiBuildGrid): PointM {
  return {
    x: grid.columns * grid.cellSizeM * 0.5,
    y: grid.rows * grid.cellSizeM * 0.5,
  };
}

function locationPoint(state: GameState, location: StorageLocation): PointM | null {
  const grid = state.buildingSimulation?.gridsByPoiId?.[location.poiId];
  if (!grid) return null;

  const building = location.buildingInstanceId
    ? state.buildings.find(candidate => candidate.id === location.buildingInstanceId)
    : undefined;
  if (building?.placement?.length) {
    const points = building.placement
      .map(allocation => {
        const cell = grid.cells.find(candidate => candidate.id === allocation.cellId);
        if (!cell) return null;
        return { ...cellCenter(grid, cell), weight: allocation.areaM2 || 1 };
      })
      .filter((value): value is PointM & { weight: number } => Boolean(value));
    const result = centroid(points);
    if (result) return result;
  }

  const clusterId = building?.clusterId || location.parentStructureId;
  const cluster = clusterId
    ? state.buildingSimulation?.clusters?.find(candidate => candidate.id === clusterId && candidate.poiId === location.poiId)
    : undefined;
  if (cluster?.cellIds.length) {
    const points = cluster.cellIds
      .map(cellId => grid.cells.find(candidate => candidate.id === cellId))
      .filter((cell): cell is BuildCell => Boolean(cell))
      .map(cell => cellCenter(grid, cell));
    const result = centroid(points);
    if (result) return result;
  }

  return gridCenter(grid);
}

function nearestCell(grid: PoiBuildGrid, point: PointM | null): BuildCell | undefined {
  if (!point) return undefined;
  let best: BuildCell | undefined;
  let bestDistance = Infinity;
  for (const cell of grid.cells) {
    const center = cellCenter(grid, cell);
    const distance = (center.x - point.x) ** 2 + (center.y - point.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }
  return best;
}

function localTerrainPenalty(state: GameState, location: StorageLocation, point: PointM | null): number {
  const grid = state.buildingSimulation?.gridsByPoiId?.[location.poiId];
  if (!grid) return 0;
  const cell = nearestCell(grid, point);
  if (!cell) return 0;
  return clamp(
    cell.slope * 1.25 + cell.moisture * 0.22 + cell.floodRisk * 0.28 + cell.vegetation * 0.12 + cell.debris * 0.08,
    0,
    100,
  );
}

function calibratedMapMetersPerPoint(): number {
  const camp = AREAS_DATABASE.AREA_CAMP_CLEARING;
  if (camp?.mapX === undefined || camp?.mapY === undefined) return 60;
  const samples: number[] = [];
  for (const area of Object.values(AREAS_DATABASE)) {
    if (area.id === camp.id || area.mapX === undefined || area.mapY === undefined || !area.distanceKm || area.distanceKm <= 0) continue;
    const mapDistance = Math.hypot(area.mapX - camp.mapX, area.mapY - camp.mapY);
    if (mapDistance < 1) continue;
    const ratio = area.distanceKm * 1000 / mapDistance;
    if (Number.isFinite(ratio) && ratio > 0) samples.push(ratio);
  }
  if (!samples.length) return 60;
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return clamp(median, 35, 120);
}

function localLegDistance(state: GameState, location: StorageLocation): number {
  const grid = state.buildingSimulation?.gridsByPoiId?.[location.poiId];
  if (!grid) return 0;
  const point = locationPoint(state, location);
  if (!point) return 0;
  const center = gridCenter(grid);
  return Math.hypot(point.x - center.x, point.y - center.y);
}

function crossPoiBaseDistance(state: GameState, source: StorageLocation, target: StorageLocation): number {
  const sourceArea = AREAS_DATABASE[source.poiId];
  const targetArea = AREAS_DATABASE[target.poiId];
  if (
    sourceArea?.mapX !== undefined && sourceArea.mapY !== undefined &&
    targetArea?.mapX !== undefined && targetArea.mapY !== undefined
  ) {
    const mapDistance = Math.hypot(sourceArea.mapX - targetArea.mapX, sourceArea.mapY - targetArea.mapY);
    return Math.max(80, mapDistance * calibratedMapMetersPerPoint());
  }

  const sourceMinutes = sourceArea?.baseTravelMinutes || 0;
  const targetMinutes = targetArea?.baseTravelMinutes || 0;
  return Math.max(120, Math.max(sourceMinutes, targetMinutes, Math.abs(sourceMinutes - targetMinutes)) * 55);
}

/**
 * Storage routing uses the actual build-grid placement for intra-POI movement.
 * Cross-POI routes use calibrated world-map coordinates plus each endpoint's
 * local build-grid leg so remote logistics never collapse into a constant timer.
 */
export function calculateStorageRoute(
  state: GameState,
  source: StorageLocation,
  target: StorageLocation,
): StorageRouteMetrics {
  const sourcePoint = locationPoint(state, source);
  const targetPoint = locationPoint(state, target);
  const sourceTerrain = localTerrainPenalty(state, source, sourcePoint);
  const targetTerrain = localTerrainPenalty(state, target, targetPoint);
  const accessibilityPenalty = clamp(
    (200 - source.environment.accessibility - target.environment.accessibility) / 200,
    0,
    1,
  );

  if (source.poiId === target.poiId) {
    const grid = state.buildingSimulation?.gridsByPoiId?.[source.poiId];
    const directDistance = grid && sourcePoint && targetPoint
      ? Math.max(grid.cellSizeM * 0.5, Math.hypot(sourcePoint.x - targetPoint.x, sourcePoint.y - targetPoint.y))
      : 12;
    const terrainPenalty = (sourceTerrain + targetTerrain) * 0.5;
    const pathFactor = 1 + accessibilityPenalty * 0.45 + terrainPenalty / 260;
    return {
      distanceM: Math.round(directDistance * pathFactor * 10) / 10,
      pathFactor: Math.round(pathFactor * 100) / 100,
      terrainPenalty: Math.round(terrainPenalty),
      sourceAccessibility: source.environment.accessibility,
      targetAccessibility: target.environment.accessibility,
      crossesPoi: false,
    };
  }

  const sourceArea = AREAS_DATABASE[source.poiId];
  const targetArea = AREAS_DATABASE[target.poiId];
  const dangerPenalty = ((sourceArea?.baseDanger || 0) + (targetArea?.baseDanger || 0)) * 0.5;
  const terrainPenalty = clamp((sourceTerrain + targetTerrain) * 0.25 + dangerPenalty * 0.75, 0, 100);
  const pathFactor = 1.12 + accessibilityPenalty * 0.35 + terrainPenalty / 300;
  const directDistance = crossPoiBaseDistance(state, source, target) + localLegDistance(state, source) + localLegDistance(state, target);

  return {
    distanceM: Math.round(directDistance * pathFactor),
    pathFactor: Math.round(pathFactor * 100) / 100,
    terrainPenalty: Math.round(terrainPenalty),
    sourceAccessibility: source.environment.accessibility,
    targetAccessibility: target.environment.accessibility,
    crossesPoi: true,
  };
}
