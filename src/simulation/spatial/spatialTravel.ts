import {
  distanceMeters,
  getRegionAtWorldPoint,
  type WorldPointMeters,
} from '../../data/worldGeometry';
import {
  HABITAT_PATCH_CELL_SIZE_METERS,
  MAIN_HABITAT_PATCHES,
  findHabitatPatchAtPoint,
  type HabitatPatch,
} from './habitatPatches';

export interface SpatialRouteEdge {
  toPatchId: string;
  distanceMeters: number;
  weightedDistanceMeters: number;
}

export interface SpatialRouteGraph {
  patchesById: Readonly<Record<string, HabitatPatch>>;
  edgesByPatchId: Readonly<Record<string, readonly SpatialRouteEdge[]>>;
}

export interface SpatialRouteEstimate {
  startPatchId: string;
  endPatchId: string;
  patchIds: readonly string[];
  straightLineDistanceMeters: number;
  routeDistanceMeters: number;
  weightedDistanceMeters: number;
  /** Read-only estimate; current gameplay expedition timing still uses legacy values. */
  estimatedTravelMinutes: number;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function addUndirectedEdge(
  edgesByPatchId: Record<string, SpatialRouteEdge[]>,
  a: HabitatPatch,
  b: HabitatPatch,
): void {
  const distance = Math.max(1, distanceMeters(a.centroid, b.centroid));
  const movementCost = (a.movementCost + b.movementCost) / 2;
  const weightedDistance = distance * movementCost;
  edgesByPatchId[a.id].push({ toPatchId: b.id, distanceMeters: distance, weightedDistanceMeters: weightedDistance });
  edgesByPatchId[b.id].push({ toPatchId: a.id, distanceMeters: distance, weightedDistanceMeters: weightedDistance });
}

/**
 * Build a lightweight graph over one generated world's shared shifted lattice.
 * Same-cell pieces connect across macro-region borders; neighboring cells connect
 * when their representative centroids are locally reachable. Because every macro
 * region uses the same per-seed lattice origin, the graph remains continuous even
 * though another save seed produces different local patch geometry.
 *
 * This is a routing foundation, not the final trail/river/slope navigation model.
 */
export function buildSpatialRouteGraph(patches: readonly HabitatPatch[] = MAIN_HABITAT_PATCHES): SpatialRouteGraph {
  const patchesById: Record<string, HabitatPatch> = {};
  const edgesByPatchId: Record<string, SpatialRouteEdge[]> = {};
  const patchesByCell = new Map<string, HabitatPatch[]>();

  for (const patch of patches) {
    patchesById[patch.id] = patch;
    edgesByPatchId[patch.id] = [];
    const key = cellKey(patch.gridX, patch.gridY);
    const bucket = patchesByCell.get(key) ?? [];
    bucket.push(patch);
    patchesByCell.set(key, bucket);
  }

  const linkedPairs = new Set<string>();
  const maxNeighborDistance = HABITAT_PATCH_CELL_SIZE_METERS * 1.8;

  for (const patch of patches) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const candidates = patchesByCell.get(cellKey(patch.gridX + dx, patch.gridY + dy)) ?? [];
        for (const candidate of candidates) {
          if (candidate.id === patch.id) continue;
          const pairKey = patch.id < candidate.id ? `${patch.id}|${candidate.id}` : `${candidate.id}|${patch.id}`;
          if (linkedPairs.has(pairKey)) continue;
          const localDistance = distanceMeters(patch.centroid, candidate.centroid);
          if (localDistance > maxNeighborDistance) continue;
          linkedPairs.add(pairKey);
          addUndirectedEdge(edgesByPatchId, patch, candidate);
        }
      }
    }
  }

  return { patchesById, edgesByPatchId };
}

export const MAIN_SPATIAL_ROUTE_GRAPH = buildSpatialRouteGraph();

export function findNearestHabitatPatch(
  point: WorldPointMeters,
  patches: readonly HabitatPatch[] = MAIN_HABITAT_PATCHES,
): HabitatPatch | undefined {
  const exact = findHabitatPatchAtPoint(point, patches);
  if (exact) return exact;

  const region = getRegionAtWorldPoint(point);
  if (!region) return undefined;
  let best: HabitatPatch | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const patch of patches) {
    if (patch.parentRegionId !== region.id) continue;
    const distance = distanceMeters(point, patch.centroid);
    if (distance < bestDistance) {
      best = patch;
      bestDistance = distance;
    }
  }
  return best;
}

interface QueueEntry {
  patchId: string;
  cost: number;
}

/**
 * Dijkstra over generated habitat impedance. A future trail/navmesh layer can
 * replace the graph builder without changing callers of this estimator.
 */
export function estimateSpatialRoute(
  start: WorldPointMeters,
  end: WorldPointMeters,
  options?: {
    graph?: SpatialRouteGraph;
    baseOpenTerrainSpeedKmh?: number;
  },
): SpatialRouteEstimate | undefined {
  const graph = options?.graph ?? MAIN_SPATIAL_ROUTE_GRAPH;
  const patches = Object.values(graph.patchesById);
  const startPatch = findNearestHabitatPatch(start, patches);
  const endPatch = findNearestHabitatPatch(end, patches);
  if (!startPatch || !endPatch) return undefined;

  if (startPatch.id === endPatch.id) {
    const direct = distanceMeters(start, end);
    const weighted = direct * startPatch.movementCost;
    const speedMPerMinute = Math.max(1, (options?.baseOpenTerrainSpeedKmh ?? 4.5) * 1000 / 60);
    return {
      startPatchId: startPatch.id,
      endPatchId: endPatch.id,
      patchIds: [startPatch.id],
      straightLineDistanceMeters: direct,
      routeDistanceMeters: direct,
      weightedDistanceMeters: weighted,
      estimatedTravelMinutes: weighted / speedMPerMinute,
    };
  }

  const distanceById = new Map<string, number>([[startPatch.id, 0]]);
  const previousById = new Map<string, string>();
  const queue: QueueEntry[] = [{ patchId: startPatch.id, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost !== distanceById.get(current.patchId)) continue;
    if (current.patchId === endPatch.id) break;

    for (const edge of graph.edgesByPatchId[current.patchId] ?? []) {
      const nextCost = current.cost + edge.weightedDistanceMeters;
      if (nextCost >= (distanceById.get(edge.toPatchId) ?? Number.POSITIVE_INFINITY)) continue;
      distanceById.set(edge.toPatchId, nextCost);
      previousById.set(edge.toPatchId, current.patchId);
      queue.push({ patchId: edge.toPatchId, cost: nextCost });
    }
  }

  const finalCost = distanceById.get(endPatch.id);
  if (finalCost === undefined) return undefined;

  const patchIds: string[] = [];
  let cursor: string | undefined = endPatch.id;
  while (cursor) {
    patchIds.push(cursor);
    if (cursor === startPatch.id) break;
    cursor = previousById.get(cursor);
  }
  patchIds.reverse();
  if (patchIds[0] !== startPatch.id) return undefined;

  let routeDistance = distanceMeters(start, startPatch.centroid)
    + distanceMeters(endPatch.centroid, end);
  for (let i = 0; i < patchIds.length - 1; i += 1) {
    const edge = (graph.edgesByPatchId[patchIds[i]] ?? []).find(candidate => candidate.toPatchId === patchIds[i + 1]);
    if (edge) routeDistance += edge.distanceMeters;
  }

  const startAccessCost = distanceMeters(start, startPatch.centroid) * startPatch.movementCost;
  const endAccessCost = distanceMeters(endPatch.centroid, end) * endPatch.movementCost;
  const weightedDistance = finalCost + startAccessCost + endAccessCost;
  const speedMPerMinute = Math.max(1, (options?.baseOpenTerrainSpeedKmh ?? 4.5) * 1000 / 60);

  return {
    startPatchId: startPatch.id,
    endPatchId: endPatch.id,
    patchIds,
    straightLineDistanceMeters: distanceMeters(start, end),
    routeDistanceMeters: routeDistance,
    weightedDistanceMeters: weightedDistance,
    estimatedTravelMinutes: weightedDistance / speedMPerMinute,
  };
}
