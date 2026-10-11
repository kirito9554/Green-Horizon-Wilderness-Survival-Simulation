import type { GameState } from '../../types';
import '../../types/buildingSimulation';
import '../../types/spatialFaunaSimulation';
import {
  SPATIAL_FAUNA_SPECIES_BY_ID,
  type SpatialFaunaGuild,
  type SpatialFaunaSpeciesDefinition,
} from '../../data/spatialFauna';
import type {
  SpatialFaunaDailyTelemetry,
  SpatialFaunaPatchCohortState,
  SpatialFaunaRuntimeState,
  SpatialFaunaSeason,
  SpatialFaunaSpeciesRuntimeState,
  SpatialFaunaStageCounts,
} from '../../types/spatialFaunaSimulation';
import type { HabitatPatch } from './habitatPatches';
import type { LocalSitePatchInfluence } from './localSiteProfiles';
import type { SpatialFaunaPatchAllocation } from './spatialFaunaCommunity';
import type { SpatialFaunaResourceSufficiencyByPatch } from './spatialFaunaResourcePools';
import { spatialUnitRandom } from './spatialRandom';
import {
  conditionFertilityFactor,
  densityFertilityFactor,
  deterministicFounderCount,
  distanceAccessFactor,
  estimateReachableBreeders,
  getBehaviorPatchesWithinRange,
  getFaunaBehaviorProfile,
  mateAvailabilityFactor,
  recolonizationReadiness,
  type SpatialAnimalMovementReason,
} from './spatialAnimalBehavior';
import { generateSpatialWorld, getSpatialWorldSeed, type GeneratedSpatialWorld } from './worldGeneration';

export const SPATIAL_FAUNA_RUNTIME_VERSION = 5;
export const SPATIAL_FAUNA_HISTORY_DAYS = 30;

const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const STRESS_DAYS = 4;
const STAGE_INDEXES = [[JUVENILES, 'juveniles'], [ADULTS, 'adults'], [OLD, 'old']] as const;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function getSpatialFaunaSeason(day: number): SpatialFaunaSeason {
  const dayOfYear = ((Math.max(1, day) - 1) % 360) + 1;
  if (dayOfYear <= 120) return 'dry';
  if (dayOfYear <= 270) return 'wet';
  return 'monsoon';
}

export function getSpatialFaunaCohortPopulation(cohort: SpatialFaunaPatchCohortState): number {
  return cohort[JUVENILES] + cohort[ADULTS] + cohort[OLD];
}

export function getSpatialFaunaRuntimePopulation(runtime: SpatialFaunaRuntimeState): number {
  return runtime.species.reduce((sum, species) => sum + Object.values(species.cohortsByPatch)
    .reduce((cohortSum, cohort) => cohortSum + getSpatialFaunaCohortPopulation(cohort), 0), 0);
}

function deterministicRound(worldSeed: string, key: string, value: number): number {
  if (value <= 0) return 0;
  const whole = Math.floor(value);
  return whole + (spatialUnitRandom(worldSeed, key) < value - whole ? 1 : 0);
}

function allocateIntegerByWeights(total: number, weights: readonly number[]): number[] {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const sum = weights.reduce((value, weight) => value + Math.max(0, weight), 0);
  if (sum <= 0) return weights.map(() => 0);
  const values = weights.map(weight => total * Math.max(0, weight) / sum);
  const result = values.map(Math.floor);
  let remaining = total - result.reduce((value, count) => value + count, 0);
  const order = values.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let cursor = 0; remaining > 0; cursor += 1, remaining -= 1) result[order[cursor % order.length].index] += 1;
  return result;
}

function initialCohortState(population: number, species: SpatialFaunaSpeciesDefinition, condition: number): SpatialFaunaPatchCohortState {
  const juvenileShare = clamp(.1 + species.offspringPerAdultFemalePerYear * .018, .1, .34);
  const oldShare = clamp(.18 - species.offspringPerAdultFemalePerYear * .007, .06, .18);
  const adultShare = Math.max(.45, 1 - juvenileShare - oldShare);
  const [juveniles, adults, old] = allocateIntegerByWeights(population, [juvenileShare, adultShare, oldShare]);
  return [juveniles, adults, old, clamp01(condition), 0];
}

interface PatchResourceScores { food: number; water: number; refuge: number; breeding: number }

function patchResourceScores(
  species: SpatialFaunaSpeciesDefinition,
  patch: HabitatPatch,
  influence: LocalSitePatchInfluence | undefined,
  season: SpatialFaunaSeason,
): PatchResourceScores {
  const siteForage = influence?.forage ?? .5;
  const siteWater = influence?.water ?? .4;
  const siteCover = influence?.cover ?? .5;
  const siteRefuge = influence?.preyRefuge ?? .45;
  const siteBreeding = influence?.breedingHabitat ?? .45;
  const decomposition = influence?.decomposition ?? .35;
  let food = clamp01(patch.suitability.forage * .72 + siteForage * .22 + decomposition * .06);
  let water = clamp01(Math.max(patch.suitability.aquatic, patch.terrain.wetness) * .72 + siteWater * .28);
  let refuge = clamp01(patch.suitability.cover * .52 + siteCover * .18 + siteRefuge * .24 + siteBreeding * .06);
  let breeding = clamp01(siteBreeding * .46 + patch.suitability.cover * .2 + patch.suitability.forage * .18 + water * .16);
  if (species.guild === 'canopy_bird' || species.guild === 'bat') {
    refuge = clamp01(refuge * .68 + patch.suitability.canopy * .32);
    breeding = clamp01(breeding * .7 + patch.suitability.canopy * .3);
  } else if (species.guild === 'amphibian') {
    food = clamp01(food * .62 + decomposition * .18 + patch.suitability.moisture * .2);
    refuge = clamp01(refuge * .58 + water * .42);
    breeding = clamp01(breeding * .5 + water * .5);
  } else if (species.guild === 'reptile') {
    refuge = clamp01(refuge * .72 + patch.terrain.roughness * .18 + patch.suitability.aquatic * .1);
  } else if (species.guild === 'invertebrate') {
    food = clamp01(food * .62 + decomposition * .38);
    refuge = clamp01(refuge * .72 + patch.suitability.moisture * .28);
  }
  if (season === 'dry') {
    food *= .8; water *= .62; breeding *= species.guild === 'reptile' ? .86 : .7;
  } else if (season === 'wet') {
    food *= 1.06; water *= 1.08; breeding *= 1.12;
  } else {
    food *= .94; water *= 1.16;
    breeding *= species.guild === 'amphibian' || species.guild === 'ground_bird' ? 1.18 : .96;
    const floodExposure = clamp01(patch.terrain.wetness * .65 + patch.suitability.aquatic * .35);
    if (species.guild !== 'amphibian' && species.guild !== 'reptile') refuge *= 1 - floodExposure * .24;
  }
  return { food: clamp01(food), water: clamp01(water), refuge: clamp01(refuge), breeding: clamp01(breeding) };
}

function dailyResourceState(
  species: SpatialFaunaSpeciesDefinition,
  patch: HabitatPatch,
  influence: LocalSitePatchInfluence | undefined,
  season: SpatialFaunaSeason,
  population: number,
  carryingCapacity: number,
): PatchResourceScores {
  const base = patchResourceScores(species, patch, influence, season);
  const density = carryingCapacity > 0 ? population / carryingCapacity : 2;
  return {
    food: clamp01((base.food * 1.25 + .18) / (.48 + density * .67)),
    water: clamp01((base.water * 1.18 + .2) / (.46 + density * .62)),
    refuge: clamp01(base.refuge / (.82 + Math.max(0, density - .65) * .36)),
    breeding: base.breeding,
  };
}

function effectiveBreeders(cohort: SpatialFaunaPatchCohortState): number { return cohort[ADULTS] + cohort[OLD] * .32; }

function dailyMortalityRates(species: SpatialFaunaSpeciesDefinition, condition: number, refuge: number, densityRatio: number): SpatialFaunaStageCounts {
  const adultBase = 1 / Math.max(730, species.maxAgeDays * 1.8);
  const juvenileBase = adultBase * 2.1 + 1 / Math.max(800, species.maturityDays * 7);
  const oldBase = 1 / Math.max(120, species.maxAgeDays * .16);
  const stress = Math.pow(Math.max(0, .68 - condition), 2) * .032;
  const refugePenalty = Math.max(0, .42 - refuge) * .0025;
  const crowding = Math.pow(Math.max(0, densityRatio - 1), 2) * .018;
  return {
    juveniles: clamp(juvenileBase + stress * 1.3 + refugePenalty * 1.25 + crowding, 0, .18),
    adults: clamp(adultBase + stress + refugePenalty + crowding, 0, .12),
    old: clamp(oldBase + stress * 1.15 + refugePenalty + crowding, 0, .2),
  };
}

function removeDeaths(runtimeSeed: string, day: number, speciesId: string, patchId: string, cohort: SpatialFaunaPatchCohortState, rates: SpatialFaunaStageCounts): number {
  let deaths = 0;
  for (const [index, stage] of STAGE_INDEXES) {
    const count = cohort[index];
    const dead = Math.min(count, deterministicRound(runtimeSeed, `${day}|${speciesId}|${patchId}|death|${stage}`, count * rates[stage]));
    cohort[index] -= dead;
    deaths += dead;
  }
  return deaths;
}

function transitionStages(runtimeSeed: string, day: number, species: SpatialFaunaSpeciesDefinition, patchId: string, cohort: SpatialFaunaPatchCohortState): { matured: number; aged: number } {
  const matured = Math.min(cohort[JUVENILES], deterministicRound(runtimeSeed, `${day}|${species.id}|${patchId}|mature`, cohort[JUVENILES] / Math.max(30, species.maturityDays)));
  cohort[JUVENILES] -= matured; cohort[ADULTS] += matured;
  const adultDurationDays = Math.max(180, species.maxAgeDays * .78 - species.maturityDays);
  const aged = Math.min(cohort[ADULTS], deterministicRound(runtimeSeed, `${day}|${species.id}|${patchId}|old`, cohort[ADULTS] / adultDurationDays));
  cohort[ADULTS] -= aged; cohort[OLD] += aged;
  return { matured, aged };
}

function stageSliceForMovement(cohort: SpatialFaunaPatchCohortState, totalToMove: number, adultFirst = false): SpatialFaunaStageCounts {
  const population = getSpatialFaunaCohortPopulation(cohort);
  if (population <= 0 || totalToMove <= 0) return { juveniles: 0, adults: 0, old: 0 };
  const move = Math.min(population, totalToMove);
  if (adultFirst) {
    let remaining = move;
    const adults = Math.min(cohort[ADULTS], remaining); remaining -= adults;
    const old = Math.min(cohort[OLD], remaining); remaining -= old;
    const juveniles = Math.min(cohort[JUVENILES], remaining);
    return { juveniles, adults, old };
  }
  const [juveniles, adults, old] = allocateIntegerByWeights(move, [cohort[JUVENILES], cohort[ADULTS], cohort[OLD]]);
  return { juveniles: Math.min(cohort[JUVENILES], juveniles), adults: Math.min(cohort[ADULTS], adults), old: Math.min(cohort[OLD], old) };
}

function addStages(cohort: SpatialFaunaPatchCohortState, addition: SpatialFaunaStageCounts): void {
  cohort[JUVENILES] += addition.juveniles; cohort[ADULTS] += addition.adults; cohort[OLD] += addition.old;
}
function subtractStages(cohort: SpatialFaunaPatchCohortState, removal: SpatialFaunaStageCounts): void {
  cohort[JUVENILES] -= removal.juveniles; cohort[ADULTS] -= removal.adults; cohort[OLD] -= removal.old;
}

function movementBaseRate(guild: SpatialFaunaGuild): number {
  switch (guild) {
    case 'bat': return .045; case 'canopy_bird': return .04; case 'ground_bird': return .028;
    case 'large_herbivore': return .026; case 'omnivore': return .024; case 'small_mammal': return .02;
    case 'reptile': return .014; case 'amphibian': return .012; case 'invertebrate': return .008;
  }
}

function movementScore(species: SpatialFaunaSpeciesDefinition, allocation: SpatialFaunaPatchAllocation, patch: HabitatPatch, influence: LocalSitePatchInfluence | undefined, season: SpatialFaunaSeason, currentPopulation: number): number {
  const resources = patchResourceScores(species, patch, influence, season);
  const freeCapacity = allocation.carryingCapacity > 0 ? clamp01(1 - currentPopulation / allocation.carryingCapacity) : 0;
  return allocation.suitability * .42 + resources.food * .2 + resources.water * .14 + resources.refuge * .14 + freeCapacity * .1;
}

function createEmptyCohort(condition = .78): SpatialFaunaPatchCohortState { return [0, 0, 0, clamp01(condition), 0]; }
function metabolicAdults(cohort: SpatialFaunaPatchCohortState): number { return cohort[ADULTS] + cohort[OLD] * .9 + cohort[JUVENILES] * .55; }

function buildInitialTelemetry(day: number, season: SpatialFaunaSeason, speciesStates: readonly SpatialFaunaSpeciesRuntimeState[], world: GeneratedSpatialWorld): SpatialFaunaDailyTelemetry {
  const planBySpecies = new Map(world.faunaCommunity.species.map(plan => [plan.speciesId, plan] as const));
  let totalPopulation = 0, occupied = 0, conditionWeighted = 0, foodWeighted = 0, waterWeighted = 0, refugeWeighted = 0, foodDemandKg = 0, waterDemandUnits = 0;
  for (const speciesState of speciesStates) {
    const definition = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    const plan = planBySpecies.get(speciesState.speciesId);
    if (!definition || !plan) continue;
    const allocationByPatch = new Map(plan.patchAllocations.map(allocation => [allocation.patchId, allocation] as const));
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const population = getSpatialFaunaCohortPopulation(cohort);
      const patch = world.routeGraph.patchesById[patchId];
      const allocation = allocationByPatch.get(patchId);
      if (population <= 0 || !patch || !allocation) continue;
      const resources = dailyResourceState(definition, patch, world.localSiteInfluenceByPatchId[patchId], season, population, allocation.carryingCapacity);
      occupied += 1; totalPopulation += population; conditionWeighted += cohort[CONDITION] * population;
      foodWeighted += resources.food * population; waterWeighted += resources.water * population; refugeWeighted += resources.refuge * population;
      foodDemandKg += metabolicAdults(cohort) * definition.dailyFoodKgPerAdult; waterDemandUnits += metabolicAdults(cohort) * definition.dailyWaterNeed;
    }
  }
  return {
    day, season, totalPopulation,
    presentSpeciesCount: speciesStates.filter(species => Object.keys(species.cohortsByPatch).length > 0).length,
    occupiedCohortCount: occupied, births: 0, deaths: 0, matured: 0, agedIntoOld: 0, moved: 0, crossRegionMoved: 0,
    mateSearchMoved: 0, natalDispersed: 0, groupSplitMoved: 0, resourceMoved: 0, recolonizedIndividuals: 0,
    foodDemandKg, waterDemandUnits,
    meanCondition: totalPopulation > 0 ? conditionWeighted / totalPopulation : 0,
    meanFoodSufficiency: totalPopulation > 0 ? foodWeighted / totalPopulation : 0,
    meanWaterSufficiency: totalPopulation > 0 ? waterWeighted / totalPopulation : 0,
    meanRefugeSufficiency: totalPopulation > 0 ? refugeWeighted / totalPopulation : 0,
  };
}

export function createSpatialFaunaRuntimeState(worldSeed: string, initialDay = 1, world: GeneratedSpatialWorld = generateSpatialWorld(worldSeed)): SpatialFaunaRuntimeState {
  const season = getSpatialFaunaSeason(initialDay);
  const speciesStates: SpatialFaunaSpeciesRuntimeState[] = [];
  for (const plan of world.faunaCommunity.species) {
    if (!plan.present || plan.initialPopulation <= 0) continue;
    const definition = SPATIAL_FAUNA_SPECIES_BY_ID[plan.speciesId];
    if (!definition) continue;
    const cohortsByPatch: Record<string, SpatialFaunaPatchCohortState> = {};
    for (const allocation of plan.patchAllocations) {
      if (allocation.initialPopulation <= 0) continue;
      cohortsByPatch[allocation.patchId] = initialCohortState(allocation.initialPopulation, definition, .76 + allocation.suitability * .16);
    }
    speciesStates.push({ speciesId: plan.speciesId, cohortsByPatch, globalAbsenceDays: 0 });
  }
  const telemetry = buildInitialTelemetry(initialDay, season, speciesStates, world);
  return { version: SPATIAL_FAUNA_RUNTIME_VERSION, worldSeed, communitySignature: world.faunaCommunity.signature, lastProcessedDay: initialDay, season, species: speciesStates, telemetry, history: [telemetry] };
}

interface PendingMovement {
  speciesId: string;
  fromPatchId: string;
  toPatchId: string;
  stages: SpatialFaunaStageCounts;
  count: number;
  crossRegion: boolean;
  reason: SpatialAnimalMovementReason;
}

function chooseFaunaDestination(
  definition: SpatialFaunaSpeciesDefinition,
  patchId: string,
  speciesState: SpatialFaunaSpeciesRuntimeState,
  allocationByPatch: ReadonlyMap<string, SpatialFaunaPatchAllocation>,
  pendingIncomingByPatch: ReadonlyMap<string, number>,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
  rangeKm: number,
  reason: SpatialAnimalMovementReason,
  breederSnapshotByPatch?: ReadonlyMap<string, number>,
): { allocation: SpatialFaunaPatchAllocation; patch: HabitatPatch; score: number } | undefined {
  let best: { allocation: SpatialFaunaPatchAllocation; patch: HabitatPatch; score: number } | undefined;
  for (const entry of getBehaviorPatchesWithinRange(world, patchId, rangeKm)) {
    if (entry.patchId === patchId) continue;
    const allocation = allocationByPatch.get(entry.patchId);
    const patch = world.routeGraph.patchesById[entry.patchId];
    if (!allocation || !patch || allocation.carryingCapacity <= 0) continue;
    const destinationCohort = speciesState.cohortsByPatch[entry.patchId];
    const destinationPopulation = (destinationCohort ? getSpatialFaunaCohortPopulation(destinationCohort) : 0) + (pendingIncomingByPatch.get(entry.patchId) ?? 0);
    if (destinationPopulation >= allocation.carryingCapacity) continue;
    let score = movementScore(definition, allocation, patch, world.localSiteInfluenceByPatchId[entry.patchId], season, destinationPopulation);
    score += distanceAccessFactor(entry.weightedDistanceKm, rangeKm) * .08;
    if (reason === 'mate_search') score += clamp01((breederSnapshotByPatch?.get(entry.patchId) ?? 0) / 3) * .38;
    if (reason === 'natal_dispersal' || reason === 'group_split' || reason === 'territory_settlement') {
      score += clamp01(1 - destinationPopulation / Math.max(1, allocation.carryingCapacity)) * .18;
    }
    if (!best || score > best.score) best = { allocation, patch, score };
  }
  return best;
}

function maybeRecolonizeFauna(
  speciesState: SpatialFaunaSpeciesRuntimeState,
  definition: SpatialFaunaSpeciesDefinition,
  plan: { patchAllocations: readonly SpatialFaunaPatchAllocation[] },
  world: GeneratedSpatialWorld,
  day: number,
): { patchId: string; count: number } | undefined {
  const total = Object.values(speciesState.cohortsByPatch).reduce((sum, cohort) => sum + getSpatialFaunaCohortPopulation(cohort), 0);
  if (total > 0) { speciesState.globalAbsenceDays = 0; return undefined; }
  speciesState.globalAbsenceDays = (speciesState.globalAbsenceDays ?? 0) + 1;
  const profile = getFaunaBehaviorProfile(definition);
  const readiness = recolonizationReadiness(speciesState.globalAbsenceDays, profile.recolonizationDelayDays);
  if (readiness <= 0) return undefined;
  if (readiness < 1 && spatialUnitRandom(world.worldSeed, `fauna-recolonization|${definition.id}|${day}`) >= readiness * .015) return undefined;
  let best: SpatialFaunaPatchAllocation | undefined;
  let bestScore = -Infinity;
  for (const allocation of plan.patchAllocations) {
    if (allocation.carryingCapacity <= 0 || allocation.suitability < definition.minPatchSuitability) continue;
    const degree = world.routeGraph.edgesByPatchId[allocation.patchId]?.length ?? 0;
    const score = allocation.suitability * .78 + (1 / Math.max(2, degree + 1)) * .22;
    if (score > bestScore) { best = allocation; bestScore = score; }
  }
  if (!best) return undefined;
  const founders = Math.min(best.carryingCapacity, deterministicFounderCount(spatialUnitRandom(world.worldSeed, `fauna-founder-count|${definition.id}|${day}`), profile.recolonizationFounderCount));
  if (founders <= 0) return undefined;
  speciesState.cohortsByPatch[best.patchId] = initialCohortState(founders, definition, .8);
  speciesState.globalAbsenceDays = 0;
  speciesState.lastImmigrationDay = day;
  return { patchId: best.patchId, count: founders };
}

export function tickSpatialFaunaDay(runtime: SpatialFaunaRuntimeState, world: GeneratedSpatialWorld, day: number, resourceSufficiencyByPatch?: SpatialFaunaResourceSufficiencyByPatch): SpatialFaunaDailyTelemetry {
  const season = getSpatialFaunaSeason(day);
  const planBySpecies = new Map(world.faunaCommunity.species.map(plan => [plan.speciesId, plan] as const));
  const telemetry: SpatialFaunaDailyTelemetry = {
    day, season, totalPopulation: 0, presentSpeciesCount: 0, occupiedCohortCount: 0, births: 0, deaths: 0, matured: 0, agedIntoOld: 0,
    moved: 0, crossRegionMoved: 0, mateSearchMoved: 0, natalDispersed: 0, groupSplitMoved: 0, resourceMoved: 0, recolonizedIndividuals: 0,
    foodDemandKg: 0, waterDemandUnits: 0, meanCondition: 0, meanFoodSufficiency: 0, meanWaterSufficiency: 0, meanRefugeSufficiency: 0,
  };
  let foodWeighted = 0, waterWeighted = 0, refugeWeighted = 0, resourceWeightPopulation = 0;
  const pendingMovements: PendingMovement[] = [];

  for (const speciesState of runtime.species) {
    const definition = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    const plan = planBySpecies.get(speciesState.speciesId);
    if (!definition || !plan?.present) continue;
    const profile = getFaunaBehaviorProfile(definition);
    const allocationByPatch = new Map(plan.patchAllocations.map(allocation => [allocation.patchId, allocation] as const));
    const breederSnapshotByPatch = new Map(Object.entries(speciesState.cohortsByPatch).map(([patchId, cohort]) => [patchId, effectiveBreeders(cohort)] as const));
    const pendingIncomingByPatch = new Map<string, number>();
    const patchIds = Object.keys(speciesState.cohortsByPatch).sort();

    for (const patchId of patchIds) {
      const cohort = speciesState.cohortsByPatch[patchId];
      const allocation = allocationByPatch.get(patchId);
      const patch = world.routeGraph.patchesById[patchId];
      if (!cohort || !allocation || !patch) continue;
      const startPopulation = getSpatialFaunaCohortPopulation(cohort);
      if (startPopulation <= 0) continue;
      const densityRatio = startPopulation / Math.max(1, allocation.carryingCapacity);
      const proxyResources = dailyResourceState(definition, patch, world.localSiteInfluenceByPatchId[patchId], season, startPopulation, allocation.carryingCapacity);
      const materialResources = resourceSufficiencyByPatch?.get(patchId)?.get(definition.id);
      const resources: PatchResourceScores = materialResources ? { ...proxyResources, food: materialResources.food, water: materialResources.water } : proxyResources;
      const targetCondition = clamp01(resources.food * .48 + resources.water * .3 + resources.refuge * .22);
      cohort[CONDITION] = clamp01(cohort[CONDITION] * .84 + targetCondition * .16);
      cohort[STRESS_DAYS] = cohort[CONDITION] < .56 ? cohort[STRESS_DAYS] + 1 : Math.max(0, cohort[STRESS_DAYS] - 1);
      telemetry.deaths += removeDeaths(runtime.worldSeed, day, definition.id, patchId, cohort, dailyMortalityRates(definition, cohort[CONDITION], resources.refuge, densityRatio));
      const transitions = transitionStages(runtime.worldSeed, day, definition, patchId, cohort);
      telemetry.matured += transitions.matured; telemetry.agedIntoOld += transitions.aged;

      const afterMortality = getSpatialFaunaCohortPopulation(cohort);
      const breeders = effectiveBreeders(cohort);
      const localBreeders = estimateReachableBreeders(world, patchId, profile.matingRangeKm, breederSnapshotByPatch);
      const mateFactor = mateAvailabilityFactor(localBreeders);
      const densityAfterMortality = afterMortality / Math.max(1, allocation.carryingCapacity);
      const breedingReadiness = clamp01(resources.breeding * conditionFertilityFactor(cohort[CONDITION]) * densityFertilityFactor(densityAfterMortality) * mateFactor);
      const expectedBirths = breeders * .5 * definition.offspringPerAdultFemalePerYear / 365 * breedingReadiness;
      const births = deterministicRound(runtime.worldSeed, `${day}|${definition.id}|${patchId}|birth`, expectedBirths);
      cohort[JUVENILES] += births; telemetry.births += births;

      const population = getSpatialFaunaCohortPopulation(cohort);
      const metabolic = metabolicAdults(cohort);
      telemetry.foodDemandKg += metabolic * definition.dailyFoodKgPerAdult; telemetry.waterDemandUnits += metabolic * definition.dailyWaterNeed;
      foodWeighted += resources.food * population; waterWeighted += resources.water * population; refugeWeighted += resources.refuge * population; resourceWeightPopulation += population;
      if (population <= 0) continue;

      let reason: SpatialAnimalMovementReason | undefined;
      let moveCount = 0;
      let adultFirst = false;
      let rangeKm = profile.foragingRangeKm;
      if (transitions.matured > 0) {
        moveCount = Math.min(cohort[ADULTS], deterministicRound(runtime.worldSeed, `${day}|${definition.id}|${patchId}|natal`, transitions.matured * profile.natalDispersalFraction));
        if (moveCount > 0) { reason = 'natal_dispersal'; adultFirst = true; rangeKm = profile.dispersalRangeKm; }
      }
      if (!reason && mateFactor < .55 && breeders > 0 && spatialUnitRandom(runtime.worldSeed, `${day}|${definition.id}|${patchId}|mate-search`) < profile.mateSearchRatePerDay * (1 - mateFactor)) {
        moveCount = 1; reason = 'mate_search'; adultFirst = true; rangeKm = profile.matingRangeKm;
      }
      const splitThreshold = Math.max(profile.groupTargetSize * profile.groupSplitRatio, allocation.carryingCapacity * .9);
      if (!reason && population > splitThreshold) {
        moveCount = Math.max(1, Math.floor((population - Math.min(profile.groupTargetSize, allocation.carryingCapacity * .72)) * .28));
        reason = 'group_split'; rangeKm = profile.dispersalRangeKm;
      }

      if (!reason) {
        const crowdingPressure = Math.max(0, densityAfterMortality - .78);
        const stressPressure = Math.max(0, .72 - cohort[CONDITION]);
        const scoutingProbability = clamp(movementBaseRate(definition.guild) * .35 + crowdingPressure * .12 + stressPressure * .1, 0, .16);
        const shouldScout = crowdingPressure >= .12 || stressPressure >= .08
          || spatialUnitRandom(runtime.worldSeed, `${day}|${definition.id}|${patchId}|resource-scout`) < scoutingProbability;
        if (shouldScout) {
          const currentScore = movementScore(definition, allocation, patch, world.localSiteInfluenceByPatchId[patchId], season, population);
          const exploratory = chooseFaunaDestination(definition, patchId, speciesState, allocationByPatch, pendingIncomingByPatch, world, season, profile.foragingRangeKm, 'resource');
          const gain = exploratory ? exploratory.score - currentScore : 0;
          if (exploratory && (gain > .025 || crowdingPressure >= .12 || stressPressure >= .08)) {
            const rate = clamp(movementBaseRate(definition.guild) + crowdingPressure * .075 + stressPressure * .06 + Math.max(0, gain) * .035, 0, .12);
            moveCount = deterministicRound(runtime.worldSeed, `${day}|${definition.id}|${patchId}|resource-move`, population * rate);
            if (moveCount > 0) { reason = 'resource'; rangeKm = profile.foragingRangeKm; }
          }
        }
      }
      if (!reason || moveCount <= 0) continue;
      const destination = chooseFaunaDestination(definition, patchId, speciesState, allocationByPatch, pendingIncomingByPatch, world, season, rangeKm, reason, breederSnapshotByPatch);
      if (!destination) continue;
      const destinationCohort = speciesState.cohortsByPatch[destination.patch.id];
      const destinationPopulation = (destinationCohort ? getSpatialFaunaCohortPopulation(destinationCohort) : 0) + (pendingIncomingByPatch.get(destination.patch.id) ?? 0);
      moveCount = Math.min(moveCount, Math.max(0, destination.allocation.carryingCapacity - destinationPopulation));
      const stages = stageSliceForMovement(cohort, moveCount, adultFirst);
      const actualMove = stages.juveniles + stages.adults + stages.old;
      if (actualMove <= 0) continue;
      pendingMovements.push({ speciesId: definition.id, fromPatchId: patchId, toPatchId: destination.patch.id, stages, count: actualMove, crossRegion: patch.parentRegionId !== destination.patch.parentRegionId, reason });
      pendingIncomingByPatch.set(destination.patch.id, (pendingIncomingByPatch.get(destination.patch.id) ?? 0) + actualMove);
    }

    const recolonized = maybeRecolonizeFauna(speciesState, definition, plan, world, day);
    if (recolonized) telemetry.recolonizedIndividuals = (telemetry.recolonizedIndividuals ?? 0) + recolonized.count;
  }

  const speciesStateById = new Map(runtime.species.map(species => [species.speciesId, species] as const));
  for (const move of pendingMovements) {
    const speciesState = speciesStateById.get(move.speciesId);
    if (!speciesState) continue;
    const source = speciesState.cohortsByPatch[move.fromPatchId];
    if (!source) continue;
    let destination = speciesState.cohortsByPatch[move.toPatchId];
    const destinationPopulationBefore = destination ? getSpatialFaunaCohortPopulation(destination) : 0;
    if (!destination) { destination = createEmptyCohort(source[CONDITION]); speciesState.cohortsByPatch[move.toPatchId] = destination; }
    subtractStages(source, move.stages);
    const mixedPopulation = destinationPopulationBefore + move.count;
    if (mixedPopulation > 0) {
      destination[CONDITION] = destinationPopulationBefore > 0 ? clamp01((destination[CONDITION] * destinationPopulationBefore + source[CONDITION] * move.count) / mixedPopulation) : source[CONDITION];
      destination[STRESS_DAYS] = destinationPopulationBefore > 0 ? Math.max(0, Math.round((destination[STRESS_DAYS] * destinationPopulationBefore + source[STRESS_DAYS] * move.count) / mixedPopulation)) : source[STRESS_DAYS];
    }
    addStages(destination, move.stages);
    telemetry.moved += move.count;
    if (move.crossRegion) telemetry.crossRegionMoved += move.count;
    if (move.reason === 'mate_search') telemetry.mateSearchMoved = (telemetry.mateSearchMoved ?? 0) + move.count;
    else if (move.reason === 'natal_dispersal') telemetry.natalDispersed = (telemetry.natalDispersed ?? 0) + move.count;
    else if (move.reason === 'group_split') telemetry.groupSplitMoved = (telemetry.groupSplitMoved ?? 0) + move.count;
    else if (move.reason === 'resource') telemetry.resourceMoved = (telemetry.resourceMoved ?? 0) + move.count;
  }

  let conditionWeighted = 0;
  for (const speciesState of runtime.species) {
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const population = getSpatialFaunaCohortPopulation(cohort);
      if (population <= 0) { delete speciesState.cohortsByPatch[patchId]; continue; }
      telemetry.occupiedCohortCount += 1; telemetry.totalPopulation += population; conditionWeighted += cohort[CONDITION] * population;
    }
    if (Object.keys(speciesState.cohortsByPatch).length > 0) telemetry.presentSpeciesCount += 1;
  }
  if (telemetry.totalPopulation > 0) telemetry.meanCondition = conditionWeighted / telemetry.totalPopulation;
  if (resourceWeightPopulation > 0) {
    telemetry.meanFoodSufficiency = foodWeighted / resourceWeightPopulation;
    telemetry.meanWaterSufficiency = waterWeighted / resourceWeightPopulation;
    telemetry.meanRefugeSufficiency = refugeWeighted / resourceWeightPopulation;
  }
  runtime.lastProcessedDay = day; runtime.season = season; runtime.telemetry = telemetry; runtime.history.push({ ...telemetry });
  if (runtime.history.length > SPATIAL_FAUNA_HISTORY_DAYS) runtime.history = runtime.history.slice(-SPATIAL_FAUNA_HISTORY_DAYS);
  return telemetry;
}

export function tickSpatialFaunaRuntime(state: GameState, _deltaGameMinutes: number): void {
  const day = Math.max(1, Math.floor(state.gameTime.day));
  const worldSeed = getSpatialWorldSeed(state);
  if (!state.spatialFaunaSystem || state.spatialFaunaSystem.worldSeed !== worldSeed) {
    const world = generateSpatialWorld(worldSeed); state.spatialFaunaSystem = createSpatialFaunaRuntimeState(worldSeed, day, world); return;
  }
  if (state.spatialFaunaSystem.lastProcessedDay >= day) return;
  const world = generateSpatialWorld(worldSeed);
  if (state.spatialFaunaSystem.version !== SPATIAL_FAUNA_RUNTIME_VERSION || state.spatialFaunaSystem.communitySignature !== world.faunaCommunity.signature) {
    state.spatialFaunaSystem = createSpatialFaunaRuntimeState(worldSeed, day, world); return;
  }
  for (let processDay = state.spatialFaunaSystem.lastProcessedDay + 1; processDay <= day; processDay += 1) tickSpatialFaunaDay(state.spatialFaunaSystem, world, processDay);
}

export function createSpatialFaunaRuntimeForState(state: GameState): SpatialFaunaRuntimeState {
  const worldSeed = getSpatialWorldSeed(state); const world = generateSpatialWorld(worldSeed);
  return createSpatialFaunaRuntimeState(worldSeed, Math.max(1, Math.floor(state.gameTime.day)), world);
}
