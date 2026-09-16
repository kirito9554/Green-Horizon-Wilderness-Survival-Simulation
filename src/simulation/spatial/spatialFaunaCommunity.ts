import type { MainWorldAreaId } from '../../data/mainWorldAreas';
import type { EcologyTargetProfile } from '../../data/ecologyProfiles';
import {
  SPATIAL_FAUNA_SPECIES,
  type SpatialFaunaGuild,
  type SpatialFaunaSpeciesDefinition,
} from '../../data/spatialFauna';
import type { HabitatPatch } from './habitatPatches';
import type { LocalSitePatchInfluence } from './localSiteProfiles';
import { spatialUnitRandom } from './spatialRandom';

export const SPATIAL_FAUNA_COMMUNITY_VERSION = 1;

export interface SpatialFaunaPatchAllocation {
  patchId: string;
  regionId: MainWorldAreaId;
  suitability: number;
  carryingCapacity: number;
  initialPopulation: number;
}

export interface SpatialFaunaRegionAllocation {
  regionId: MainWorldAreaId;
  carryingCapacity: number;
  initialPopulation: number;
  occupiedPatchCount: number;
}

export interface SpatialFaunaSpeciesPlan {
  speciesId: string;
  name: string;
  guild: SpatialFaunaGuild;
  present: boolean;
  islandCarryingCapacity: number;
  initialPopulation: number;
  occupiedPatchCount: number;
  patchAllocations: readonly SpatialFaunaPatchAllocation[];
  regionAllocations: readonly SpatialFaunaRegionAllocation[];
}

export interface GeneratedSpatialFaunaCommunity {
  version: number;
  worldSeed: string;
  catalogSpeciesCount: number;
  presentSpeciesCount: number;
  totalCarryingCapacity: number;
  totalInitialIndividuals: number;
  legacyRuntimeSpeciesCount: number;
  species: readonly SpatialFaunaSpeciesPlan[];
  signature: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function targetValue(patch: HabitatPatch, key: keyof EcologyTargetProfile): number {
  switch (key) {
    case 'canopy': return patch.suitability.canopy * 100;
    case 'moisture': return patch.suitability.moisture * 100;
    case 'waterAccess': return Math.max(patch.suitability.aquatic, patch.terrain.wetness) * 100;
    case 'slope': return patch.terrain.slope * 100;
    case 'floodRisk': return Math.max(patch.suitability.aquatic, patch.terrain.wetness * .9) * 100;
    case 'sunlight': return (1 - patch.suitability.canopy) * 100;
    case 'rocks': return clamp01(patch.terrain.roughness * .7 + (patch.terrainTags.includes('rock') ? .3 : 0)) * 100;
    case 'fertileSoil': return clamp01(patch.suitability.forage * .62 + patch.suitability.moisture * .38) * 100;
    case 'vegetation': return clamp01(patch.suitability.cover * .5 + patch.suitability.forage * .5) * 100;
    default: return 50;
  }
}

function targetSuitability(species: SpatialFaunaSpeciesDefinition, patch: HabitatPatch): number {
  const targets = Object.entries(species.targets) as Array<[keyof EcologyTargetProfile, number]>;
  if (targets.length === 0) return .5;
  const tolerance = Math.max(12, species.tolerance);
  const scores = targets.map(([key, target]) => {
    const difference = Math.abs(targetValue(patch, key) - target);
    return clamp01(1 - difference / (tolerance * 1.65));
  });
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function habitatSignal(species: SpatialFaunaSpeciesDefinition, patch: HabitatPatch): number {
  const s = patch.suitability;
  switch (species.guild) {
    case 'large_herbivore': return clamp01(s.forage * .48 + s.cover * .24 + s.moisture * .14 + (1 - s.disturbance) * .14);
    case 'omnivore': return clamp01(s.forage * .38 + s.cover * .28 + s.moisture * .14 + s.aquatic * .08 + (1 - s.disturbance) * .12);
    case 'small_mammal': return clamp01(s.cover * .38 + s.forage * .34 + s.canopy * .16 + (1 - s.disturbance) * .12);
    case 'ground_bird': return clamp01(s.forage * .38 + s.cover * .28 + (1 - s.canopy) * .16 + s.moisture * .1 + (1 - s.disturbance) * .08);
    case 'canopy_bird': return clamp01(s.canopy * .46 + s.forage * .28 + s.cover * .18 + (1 - s.disturbance) * .08);
    case 'bat': return clamp01(s.canopy * .34 + s.forage * .3 + s.cover * .2 + s.moisture * .08 + (1 - s.disturbance) * .08);
    case 'reptile': return clamp01(s.cover * .3 + s.moisture * .2 + s.aquatic * .18 + (1 - s.canopy) * .12 + s.forage * .1 + (1 - s.disturbance) * .1);
    case 'amphibian': return clamp01(s.moisture * .4 + s.aquatic * .28 + s.cover * .18 + (1 - s.disturbance) * .14);
    case 'invertebrate': return clamp01(s.moisture * .24 + s.forage * .28 + s.cover * .2 + (1 - s.canopy) * .12 + (1 - s.disturbance) * .16);
  }
}

function siteSignal(guild: SpatialFaunaGuild, influence: LocalSitePatchInfluence | undefined): number {
  if (!influence) return .5;
  switch (guild) {
    case 'large_herbivore': return clamp01(influence.forage * .42 + influence.water * .24 + influence.cover * .12 + influence.breedingHabitat * .08 + influence.preyRefuge * .14);
    case 'omnivore': return clamp01(influence.forage * .36 + influence.water * .18 + influence.cover * .16 + influence.breedingHabitat * .08 + influence.preyRefuge * .1 + influence.decomposition * .12);
    case 'small_mammal': return clamp01(influence.forage * .3 + influence.cover * .24 + influence.breedingHabitat * .16 + influence.preyRefuge * .24 + influence.water * .06);
    case 'ground_bird': return clamp01(influence.forage * .32 + influence.cover * .2 + influence.breedingHabitat * .26 + influence.water * .1 + influence.preyRefuge * .12);
    case 'canopy_bird': return clamp01(influence.forage * .3 + influence.cover * .3 + influence.breedingHabitat * .3 + influence.water * .05 + influence.preyRefuge * .05);
    case 'bat': return clamp01(influence.forage * .28 + influence.cover * .28 + influence.breedingHabitat * .28 + influence.water * .08 + influence.preyRefuge * .08);
    case 'reptile': return clamp01(influence.cover * .24 + influence.water * .22 + influence.preyRefuge * .22 + influence.breedingHabitat * .12 + influence.forage * .08 + influence.decomposition * .12);
    case 'amphibian': return clamp01(influence.water * .34 + influence.breedingHabitat * .3 + influence.cover * .14 + influence.preyRefuge * .12 + influence.decomposition * .1);
    case 'invertebrate': return clamp01(influence.decomposition * .3 + influence.forage * .24 + influence.cover * .18 + influence.water * .14 + influence.breedingHabitat * .14);
  }
}

export function calculateSpatialFaunaPatchSuitability(
  species: SpatialFaunaSpeciesDefinition,
  patch: HabitatPatch,
  influence?: LocalSitePatchInfluence,
): number {
  const affinity = species.regionAffinity[patch.parentRegionId] ?? 0;
  if (affinity <= 0) return 0;
  const environmental = targetSuitability(species, patch) * .72 + habitatSignal(species, patch) * .28;
  const localSite = siteSignal(species.guild, influence);
  const disturbanceFit = clamp01(.45 + species.disturbanceTolerance / 100 * .55);
  const combined = environmental * .84 + localSite * .12 + disturbanceFit * .04;
  return clamp01(combined * (.4 + affinity * .6));
}

interface WeightedAllocation {
  key: string;
  weight: number;
}

function allocateIntegerTotal(total: number, weighted: readonly WeightedAllocation[]): Map<string, number> {
  const output = new Map<string, number>();
  if (total <= 0 || weighted.length === 0) return output;
  const weightSum = weighted.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (weightSum <= 0) return output;

  const remainders: Array<{ key: string; remainder: number }> = [];
  let assigned = 0;
  for (const entry of weighted) {
    const exact = total * Math.max(0, entry.weight) / weightSum;
    const whole = Math.floor(exact);
    output.set(entry.key, whole);
    assigned += whole;
    remainders.push({ key: entry.key, remainder: exact - whole });
  }
  remainders.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
  for (let index = 0; index < total - assigned; index += 1) {
    const key = remainders[index % remainders.length].key;
    output.set(key, (output.get(key) ?? 0) + 1);
  }
  return output;
}

function communitySignature(plans: readonly SpatialFaunaSpeciesPlan[]): string {
  const source = plans.map(plan => [
    plan.speciesId,
    plan.present ? 1 : 0,
    plan.islandCarryingCapacity,
    plan.initialPopulation,
    plan.patchAllocations.filter(entry => entry.initialPopulation > 0).map(entry => `${entry.patchId}:${entry.initialPopulation}`).join(','),
  ].join('|')).join('||');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fauna-${(hash >>> 0).toString(36)}`;
}

function buildSpeciesPlan(
  worldSeed: string,
  species: SpatialFaunaSpeciesDefinition,
  patches: readonly HabitatPatch[],
  influenceByPatchId: Readonly<Record<string, LocalSitePatchInfluence>>,
): SpatialFaunaSpeciesPlan {
  const raw = patches.map(patch => {
    const suitability = calculateSpatialFaunaPatchSuitability(species, patch, influenceByPatchId[patch.id]);
    if (suitability < species.minPatchSuitability) return { patch, suitability, rawCapacity: 0 };
    const affinity = species.regionAffinity[patch.parentRegionId] ?? 0;
    const rawCapacity = patch.areaKm2 * species.densityPerKm2 * Math.pow(suitability, 1.2) * (.45 + affinity * .55);
    return { patch, suitability, rawCapacity };
  }).filter(entry => entry.rawCapacity > 0);

  const potentialCapacity = Math.max(0, Math.round(raw.reduce((sum, entry) => sum + entry.rawCapacity, 0)));
  const supported = potentialCapacity >= species.minIslandCapacity;
  const presenceRoll = spatialUnitRandom(worldSeed, `spatial-fauna-presence|${species.id}`);
  const present = supported && presenceRoll <= species.worldPresence;
  const islandCarryingCapacity = present ? potentialCapacity : 0;
  const occupancyRandom = spatialUnitRandom(worldSeed, `spatial-fauna-occupancy|${species.id}`);
  const occupancy = species.initialOccupancy[0] + (species.initialOccupancy[1] - species.initialOccupancy[0]) * occupancyRandom;
  const initialPopulation = present ? Math.min(islandCarryingCapacity, Math.round(islandCarryingCapacity * occupancy)) : 0;

  if (!present || islandCarryingCapacity <= 0) {
    return Object.freeze({
      speciesId: species.id,
      name: species.name,
      guild: species.guild,
      present: false,
      islandCarryingCapacity: 0,
      initialPopulation: 0,
      occupiedPatchCount: 0,
      patchAllocations: Object.freeze([]),
      regionAllocations: Object.freeze([]),
    });
  }

  const carryingByPatch = allocateIntegerTotal(
    islandCarryingCapacity,
    raw.map(entry => ({ key: entry.patch.id, weight: entry.rawCapacity })),
  );
  const initialByPatch = allocateIntegerTotal(
    initialPopulation,
    raw.map(entry => ({ key: entry.patch.id, weight: carryingByPatch.get(entry.patch.id) ?? 0 })),
  );

  const patchAllocations = raw.map(entry => Object.freeze({
    patchId: entry.patch.id,
    regionId: entry.patch.parentRegionId,
    suitability: entry.suitability,
    carryingCapacity: carryingByPatch.get(entry.patch.id) ?? 0,
    initialPopulation: initialByPatch.get(entry.patch.id) ?? 0,
  })).filter(entry => entry.carryingCapacity > 0);

  const regionMap = new Map<MainWorldAreaId, { carryingCapacity: number; initialPopulation: number; occupiedPatchCount: number }>();
  for (const allocation of patchAllocations) {
    const current = regionMap.get(allocation.regionId) ?? { carryingCapacity: 0, initialPopulation: 0, occupiedPatchCount: 0 };
    current.carryingCapacity += allocation.carryingCapacity;
    current.initialPopulation += allocation.initialPopulation;
    if (allocation.initialPopulation > 0) current.occupiedPatchCount += 1;
    regionMap.set(allocation.regionId, current);
  }

  const regionAllocations = [...regionMap.entries()]
    .map(([regionId, value]) => Object.freeze({ regionId, ...value }))
    .sort((a, b) => a.regionId.localeCompare(b.regionId));

  return Object.freeze({
    speciesId: species.id,
    name: species.name,
    guild: species.guild,
    present: true,
    islandCarryingCapacity,
    initialPopulation,
    occupiedPatchCount: patchAllocations.filter(entry => entry.initialPopulation > 0).length,
    patchAllocations: Object.freeze(patchAllocations),
    regionAllocations: Object.freeze(regionAllocations),
  });
}

export function generateSpatialFaunaCommunity(
  worldSeed: string,
  patches: readonly HabitatPatch[],
  influenceByPatchId: Readonly<Record<string, LocalSitePatchInfluence>>,
): GeneratedSpatialFaunaCommunity {
  const plans = SPATIAL_FAUNA_SPECIES.map(species => buildSpeciesPlan(worldSeed, species, patches, influenceByPatchId));
  const present = plans.filter(plan => plan.present);
  return Object.freeze({
    version: SPATIAL_FAUNA_COMMUNITY_VERSION,
    worldSeed,
    catalogSpeciesCount: SPATIAL_FAUNA_SPECIES.length,
    presentSpeciesCount: present.length,
    totalCarryingCapacity: present.reduce((sum, plan) => sum + plan.islandCarryingCapacity, 0),
    totalInitialIndividuals: present.reduce((sum, plan) => sum + plan.initialPopulation, 0),
    legacyRuntimeSpeciesCount: SPATIAL_FAUNA_SPECIES.filter(species => species.legacyRuntime).length,
    species: Object.freeze(plans),
    signature: communitySignature(plans),
  });
}
