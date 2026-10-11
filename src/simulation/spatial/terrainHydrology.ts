import type { HabitatPatch } from './habitatPatches';
import {
  buildSpatialRouteGraph,
  type SpatialRouteGraph,
} from './spatialTravel';

export type GeneratedWatercourseClass =
  | 'none'
  | 'seasonal_stream'
  | 'stream'
  | 'river'
  | 'wetland_channel';

export interface PatchHydrologyState {
  patchId: string;
  downstreamPatchId?: string;
  /** Total upstream land area feeding this patch, including the patch itself. */
  flowAccumulationKm2: number;
  /** 0..1 combined terrain wetness and accumulated-flow signal. */
  waterIndex: number;
  watercourse: GeneratedWatercourseClass;
  isHeadwater: boolean;
  isSink: boolean;
}

export interface GeneratedTerrainHydrology {
  byPatchId: Readonly<Record<string, PatchHydrologyState>>;
  streamPatchIds: readonly string[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function chooseDownstreamPatch(
  patch: HabitatPatch,
  graph: SpatialRouteGraph,
): HabitatPatch | undefined {
  let best: HabitatPatch | undefined;
  let bestScore = 0;

  for (const edge of graph.edgesByPatchId[patch.id] ?? []) {
    const candidate = graph.patchesById[edge.toPatchId];
    if (!candidate) continue;
    const dropMeters = patch.terrain.elevationMeters - candidate.terrain.elevationMeters;
    if (dropMeters <= 0.35) continue;

    // Prefer meaningful downhill grade but allow wet receiving terrain to attract
    // flow when two downhill routes are otherwise similar.
    const grade = dropMeters / Math.max(1, edge.distanceMeters);
    const score = grade + candidate.terrain.wetness * 0.0007 + (1 - candidate.terrain.drainage) * 0.00025;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function classifyWatercourse(patch: HabitatPatch, accumulationKm2: number, waterIndex: number): GeneratedWatercourseClass {
  if (
    patch.habitat === 'wetland_channel'
    || patch.habitat === 'tidal_creek'
    || patch.habitat === 'rocky_channel'
    || patch.terrainTags.includes('shallow_water')
  ) return 'wetland_channel';

  if (accumulationKm2 >= 7.5 && waterIndex >= .52) return 'river';
  if (accumulationKm2 >= 2.2 && waterIndex >= .48) return 'stream';
  if (accumulationKm2 >= .7 && waterIndex >= .42) return 'seasonal_stream';
  return 'none';
}

/**
 * Derive a drainage network from the generated terrain instead of placing rivers
 * as independent random POIs. Each patch drains to a lower adjacent patch; flow
 * accumulation then creates headwaters, streams and larger channels.
 */
export function generateTerrainHydrology(
  patches: readonly HabitatPatch[],
  graph: SpatialRouteGraph = buildSpatialRouteGraph(patches),
): GeneratedTerrainHydrology {
  const downstreamByPatchId = new Map<string, string>();
  const flowByPatchId = new Map<string, number>();
  const upstreamCountByPatchId = new Map<string, number>();

  for (const patch of patches) {
    flowByPatchId.set(patch.id, patch.areaKm2);
    upstreamCountByPatchId.set(patch.id, 0);
    const downstream = chooseDownstreamPatch(patch, graph);
    if (downstream) {
      downstreamByPatchId.set(patch.id, downstream.id);
      upstreamCountByPatchId.set(downstream.id, (upstreamCountByPatchId.get(downstream.id) ?? 0) + 1);
    }
  }

  // Downstream always has lower elevation, so descending elevation is a valid
  // topological order and cannot create a drainage cycle.
  const highToLow = [...patches].sort((a, b) => b.terrain.elevationMeters - a.terrain.elevationMeters);
  for (const patch of highToLow) {
    const downstreamId = downstreamByPatchId.get(patch.id);
    if (!downstreamId) continue;
    flowByPatchId.set(
      downstreamId,
      (flowByPatchId.get(downstreamId) ?? 0) + (flowByPatchId.get(patch.id) ?? patch.areaKm2),
    );
  }

  const byPatchId: Record<string, PatchHydrologyState> = {};
  const streamPatchIds: string[] = [];
  for (const patch of patches) {
    const accumulation = flowByPatchId.get(patch.id) ?? patch.areaKm2;
    const flowSignal = clamp01(Math.log2(1 + accumulation) / 4);
    const waterIndex = clamp01(
      patch.terrain.wetness * .48
      + patch.suitability.aquatic * .24
      + flowSignal * .2
      + (1 - patch.terrain.drainage) * .08,
    );
    const watercourse = classifyWatercourse(patch, accumulation, waterIndex);
    if (watercourse !== 'none') streamPatchIds.push(patch.id);
    byPatchId[patch.id] = Object.freeze({
      patchId: patch.id,
      downstreamPatchId: downstreamByPatchId.get(patch.id),
      flowAccumulationKm2: accumulation,
      waterIndex,
      watercourse,
      isHeadwater: (upstreamCountByPatchId.get(patch.id) ?? 0) === 0 && Boolean(downstreamByPatchId.get(patch.id)),
      isSink: !downstreamByPatchId.has(patch.id),
    });
  }

  return Object.freeze({ byPatchId, streamPatchIds: Object.freeze(streamPatchIds) });
}
