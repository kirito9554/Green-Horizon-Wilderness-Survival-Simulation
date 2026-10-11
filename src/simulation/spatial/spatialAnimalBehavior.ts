import type { SpatialFaunaGuild, SpatialFaunaSocialMode, SpatialFaunaSpeciesDefinition } from '../../data/spatialFauna';
import type { SpatialPredatorSpeciesDefinition } from '../../data/spatialPredators';
import type { GeneratedSpatialWorld } from './worldGeneration';

export type SpatialAnimalOrganizationMode =
  | 'aggregate_local'
  | 'solitary_territory'
  | 'breeding_pair'
  | 'family_group'
  | 'herd'
  | 'flock'
  | 'colony'
  | 'loose_group'
  | 'loose_aggregation';

export type SpatialAnimalMovementReason =
  | 'resource'
  | 'mate_search'
  | 'natal_dispersal'
  | 'group_split'
  | 'territory_settlement'
  | 'recolonization';

export interface SpatialAnimalBehaviorProfile {
  organization: SpatialAnimalOrganizationMode;
  matingRangeKm: number;
  foragingRangeKm: number;
  dispersalRangeKm: number;
  mateSearchRatePerDay: number;
  natalDispersalFraction: number;
  groupTargetSize: number;
  groupSplitRatio: number;
  recolonizationDelayDays: readonly [number, number];
  recolonizationFounderCount: readonly [number, number];
}

export interface SpatialBehaviorPatchDistance {
  patchId: string;
  distanceKm: number;
  weightedDistanceKm: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const rangeCache = new WeakMap<GeneratedSpatialWorld, Map<string, SpatialBehaviorPatchDistance[]>>();

function faunaOrganization(socialMode: SpatialFaunaSocialMode, guild: SpatialFaunaGuild): SpatialAnimalOrganizationMode {
  if (socialMode === 'pair') return 'breeding_pair';
  if (socialMode === 'herd' || socialMode === 'sounder') return 'herd';
  if (socialMode === 'flock') return 'flock';
  if (socialMode === 'colony') return 'colony';
  if (socialMode === 'loose_group') return 'loose_group';
  if (socialMode === 'solitary' && (guild === 'large_herbivore' || guild === 'omnivore' || guild === 'reptile')) return 'solitary_territory';
  return 'aggregate_local';
}

function guildRanges(guild: SpatialFaunaGuild): readonly [number, number, number] {
  switch (guild) {
    case 'bat': return [2.4, 2.6, 5.5];
    case 'canopy_bird': return [2.0, 2.3, 4.8];
    case 'ground_bird': return [1.35, 1.45, 3.0];
    case 'large_herbivore': return [2.0, 2.2, 5.0];
    case 'omnivore': return [1.8, 2.0, 4.2];
    case 'small_mammal': return [1.15, 1.05, 2.2];
    case 'reptile': return [1.1, 1.1, 2.6];
    case 'amphibian': return [.8, .75, 1.5];
    case 'invertebrate': return [.65, .65, 1.1];
  }
}

function socialGroupTarget(mode: SpatialAnimalOrganizationMode, guild: SpatialFaunaGuild): number {
  switch (mode) {
    case 'breeding_pair': return 4;
    case 'herd': return guild === 'large_herbivore' ? 10 : 8;
    case 'flock': return 18;
    case 'colony': return 45;
    case 'loose_group': return 12;
    case 'family_group': return 6;
    case 'solitary_territory': return 2;
    case 'loose_aggregation': return 8;
    case 'aggregate_local': return guild === 'small_mammal' ? 26 : guild === 'amphibian' || guild === 'invertebrate' ? 45 : 16;
  }
}

function faunaSplitRatio(mode: SpatialAnimalOrganizationMode): number {
  // A patch cohort is often an aggregate of several real groups. Only genuinely social
  // organizations use the group-split channel; solitary/aggregate/pair populations expand
  // through natal dispersal, mate search and resource/territory settlement instead.
  switch (mode) {
    case 'herd': return 2.2;
    case 'flock': return 2.8;
    case 'colony': return 3.2;
    case 'loose_group': return 2.5;
    case 'family_group': return 2.4;
    case 'loose_aggregation': return 3.0;
    case 'breeding_pair': return 100;
    case 'solitary_territory': return 100;
    case 'aggregate_local': return 100;
  }
}

export function getFaunaBehaviorProfile(species: SpatialFaunaSpeciesDefinition): SpatialAnimalBehaviorProfile {
  const organization = faunaOrganization(species.socialMode, species.guild);
  const [matingRangeKm, foragingRangeKm, dispersalRangeKm] = guildRanges(species.guild);
  const groupTargetSize = socialGroupTarget(organization, species.guild);
  const mobile = species.guild === 'bat' || species.guild === 'canopy_bird';
  const slow = species.guild === 'amphibian' || species.guild === 'invertebrate';
  return {
    organization,
    matingRangeKm,
    foragingRangeKm,
    dispersalRangeKm,
    mateSearchRatePerDay: organization === 'breeding_pair' || organization === 'solitary_territory' ? .022 : mobile ? .018 : .012,
    natalDispersalFraction: mobile ? .48 : slow ? .18 : species.guild === 'large_herbivore' || species.guild === 'omnivore' ? .42 : .32,
    groupTargetSize,
    groupSplitRatio: faunaSplitRatio(organization),
    recolonizationDelayDays: mobile ? [90, 360] : slow ? [240, 900] : [150, 600],
    recolonizationFounderCount: organization === 'colony' || organization === 'flock' ? [3, 7] : organization === 'herd' ? [2, 5] : [1, 3],
  };
}

export function getPredatorBehaviorProfile(species: SpatialPredatorSpeciesDefinition): SpatialAnimalBehaviorProfile {
  const organization = species.socialMode;
  const target = organization === 'breeding_pair' ? 3 : organization === 'family_group' ? 5 : organization === 'loose_aggregation' ? 6 : 2;
  const splitRatio = organization === 'family_group' ? 2.5
    : organization === 'loose_aggregation' ? 3.0
      : 100;
  return {
    organization,
    matingRangeKm: species.matingRangeKm,
    foragingRangeKm: species.homeRangeKm,
    dispersalRangeKm: Math.max(species.homeRangeKm * 1.8, species.matingRangeKm * 1.3),
    mateSearchRatePerDay: organization === 'breeding_pair' ? .035 : .026,
    natalDispersalFraction: organization === 'family_group' ? .62 : .72,
    groupTargetSize: target,
    groupSplitRatio: splitRatio,
    recolonizationDelayDays: species.recolonizationDelayDays,
    recolonizationFounderCount: species.recolonizationFounderCount,
  };
}

/** Multi-hop route-graph neighborhood. Patch is a spatial cell, not a permanent animal container. */
export function getBehaviorPatchesWithinRange(
  world: GeneratedSpatialWorld,
  startPatchId: string,
  rangeKm: number,
): SpatialBehaviorPatchDistance[] {
  const normalizedRange = Math.round(Math.max(0, rangeKm) * 1000) / 1000;
  const cacheKey = `${startPatchId}|${normalizedRange}`;
  let worldCache = rangeCache.get(world);
  if (!worldCache) {
    worldCache = new Map();
    rangeCache.set(world, worldCache);
  }
  const cached = worldCache.get(cacheKey);
  if (cached) return cached;

  const maxMeters = normalizedRange * 1000;
  const bestDistance = new Map<string, number>([[startPatchId, 0]]);
  const bestWeighted = new Map<string, number>([[startPatchId, 0]]);
  const queue: Array<{ patchId: string; distance: number; weighted: number }> = [{ patchId: startPatchId, distance: 0, weighted: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.weighted - b.weighted || a.distance - b.distance);
    const current = queue.shift()!;
    if (current.distance > (bestDistance.get(current.patchId) ?? Number.POSITIVE_INFINITY) + 1e-6) continue;
    for (const edge of world.routeGraph.edgesByPatchId[current.patchId] ?? []) {
      const distance = current.distance + edge.distanceMeters;
      if (distance > maxMeters) continue;
      const weighted = current.weighted + edge.weightedDistanceMeters;
      const previousWeighted = bestWeighted.get(edge.toPatchId) ?? Number.POSITIVE_INFINITY;
      if (weighted >= previousWeighted) continue;
      bestDistance.set(edge.toPatchId, distance);
      bestWeighted.set(edge.toPatchId, weighted);
      queue.push({ patchId: edge.toPatchId, distance, weighted });
    }
  }
  const result = [...bestDistance.entries()]
    .map(([patchId, distance]) => ({
      patchId,
      distanceKm: distance / 1000,
      weightedDistanceKm: (bestWeighted.get(patchId) ?? distance) / 1000,
    }))
    .sort((a, b) => a.weightedDistanceKm - b.weightedDistanceKm || a.patchId.localeCompare(b.patchId));
  worldCache.set(cacheKey, result);
  return result;
}

export function estimateReachableBreeders(
  world: GeneratedSpatialWorld,
  startPatchId: string,
  matingRangeKm: number,
  breederSnapshotByPatch: ReadonlyMap<string, number>,
): number {
  let breeders = 0;
  for (const entry of getBehaviorPatchesWithinRange(world, startPatchId, matingRangeKm)) {
    const local = breederSnapshotByPatch.get(entry.patchId) ?? 0;
    if (local <= 0) continue;
    const proximity = clamp01(1 - entry.weightedDistanceKm / Math.max(.05, matingRangeKm));
    const access = entry.patchId === startPatchId ? 1 : .18 + proximity * .82;
    breeders += local * access;
  }
  return breeders;
}

/** Smooth Allee effect: one effective breeder cannot reproduce; access quickly saturates above a pair. */
export function mateAvailabilityFactor(localBreeders: number): number {
  if (localBreeders <= 1) return 0;
  return clamp01(1 - Math.exp(-(localBreeders - 1) * .82));
}

/** Avoid hard condition cutoffs. Poor-condition animals fade out of breeding rather than becoming instantly sterile. */
export function conditionFertilityFactor(condition: number): number {
  const normalized = clamp01((condition - .38) / .46);
  return normalized * normalized * (3 - 2 * normalized);
}

/** Single density feedback for breeding. This must not be applied again elsewhere for the same population signal. */
export function densityFertilityFactor(densityRatio: number): number {
  if (densityRatio <= .45) return 1;
  if (densityRatio >= 1.2) return .04;
  const normalized = clamp01((densityRatio - .45) / .75);
  return Math.max(.04, 1 - normalized * normalized * .96);
}

export function distanceAccessFactor(distanceKm: number, rangeKm: number): number {
  if (rangeKm <= 0) return 0;
  const ratio = clamp01(distanceKm / rangeKm);
  return Math.max(.08, 1 - ratio * ratio * .92);
}

export function recolonizationReadiness(absenceDays: number, delay: readonly [number, number]): number {
  const [minimum, maximum] = delay;
  if (absenceDays < minimum) return 0;
  if (absenceDays >= maximum) return 1;
  return clamp01((absenceDays - minimum) / Math.max(1, maximum - minimum));
}

export function deterministicFounderCount(unitRandom: number, range: readonly [number, number]): number {
  const low = Math.max(1, Math.floor(range[0]));
  const high = Math.max(low, Math.floor(range[1]));
  return low + Math.min(high - low, Math.floor(unitRandom * (high - low + 1)));
}
