import type { GameState } from '../types';
import type { EcologyReproductionProfile } from '../data/ecologyDemography';
import { WILD_FAUNA_SPECIES, type WildFaunaSpeciesDefinition } from '../data/ecologyFauna';
import type { WildAnimalPopulation } from '../types/ecologySimulation';
import * as base from './ecologyFaunaSystem.p39base';
import {
  accumulateDemographyMortality,
  advanceDemographyTelemetry,
  consumeDemographyMortality,
  demographicBalance,
  effectiveBreedingState,
  ensureDemographyTelemetry,
  eventRecruitmentCount,
  mateAvailabilityFromBreeders,
  recordDemographyDeaths,
  recordDemographyMaturation,
  recordDemographyRecruitment,
  resolveReproductionProfile,
  softBreedingFitness,
  syncDemographyTelemetry,
} from './ecologyDemographySystem';

export * from './ecologyFaunaSystem.p39base';

interface FaunaTickSnapshot {
  juveniles: number;
  adults: number;
  old: number;
  population: number;
  maleRatio: number;
  reproductionProgress: number;
  maturationProgress: number;
  agingProgress: number;
  mortalityProgress: number;
  lastUpdatedGameMinute: number;
  homeRangeSubareaIds: string[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value * 1000) / 1000));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function snapshotPopulation(population: WildAnimalPopulation): FaunaTickSnapshot {
  return {
    juveniles: population.juveniles,
    adults: population.adults,
    old: population.old,
    population: population.population,
    maleRatio: population.maleRatio,
    reproductionProgress: population.reproductionProgress,
    maturationProgress: population.maturationProgress,
    agingProgress: population.agingProgress,
    mortalityProgress: population.mortalityProgress,
    lastUpdatedGameMinute: population.lastUpdatedGameMinute,
    homeRangeSubareaIds: [...population.homeRangeSubareaIds],
  };
}

function eventRecruitmentTotal(
  profile: EcologyReproductionProfile,
  populationId: string,
  now: number,
  tickIndex: number,
  events: number,
): number {
  let recruits = 0;
  for (let eventIndex = 0; eventIndex < events; eventIndex += 1) {
    const random = mulberry32(hashString(`${populationId}:${now}:${tickIndex}:${eventIndex}:breeding`));
    recruits += eventRecruitmentCount(profile, random);
  }
  return recruits;
}

function recomputeBiomass(population: WildAnimalPopulation, species: WildFaunaSpeciesDefinition): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(
    species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45),
  );
}

function reconcilePopulationDemography(
  state: GameState,
  population: WildAnimalPopulation,
  before: FaunaTickSnapshot,
  species: WildFaunaSpeciesDefinition,
  now: number,
  tickIndex: number,
): void {
  const elapsedDays = Math.max(0, now - before.lastUpdatedGameMinute) / 1440;
  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
  if (elapsedDays <= 0) {
    syncDemographyTelemetry(population, reproduction);
    return;
  }

  const postBase = {
    juveniles: population.juveniles,
    adults: population.adults,
    old: population.old,
  };
  const breederState = effectiveBreedingState(before, reproduction);
  advanceDemographyTelemetry(population, reproduction, elapsedDays, breederState);

  const carryingCapacity = Math.max(
    1,
    base.estimateWildAnimalCarryingCapacity(state, before.homeRangeSubareaIds, species),
  );
  const balance = demographicBalance(before.population, carryingCapacity, reproduction);
  const conditionFactor = clamp01(
    clamp01((population.bodyCondition - 32) / 60) * 0.55
      + clamp01((population.averageHealth - 34) / 58) * 0.45,
  );
  const resourceState = clamp01(1 - (population.foodStress + population.waterStress) / 185);
  const matureAnimals = before.adults + before.old;
  const baseMateAvailability = matureAnimals <= 0 ? 0 : matureAnimals === 1 ? 0.38 : 1;
  const baseBreedingFitness = softBreedingFitness(baseMateAvailability, conditionFactor, resourceState);
  const desiredBreedingFitness = softBreedingFitness(
    mateAvailabilityFromBreeders(breederState.effectiveBreeders),
    conditionFactor,
    resourceState,
  );
  const femaleShare = clamp01(1 - before.maleRatio);
  const baseIncrement = before.adults
    * femaleShare
    * reproduction.eventsPerAdultFemalePerYear / 365
    * elapsedDays
    * baseBreedingFitness
    * balance.reproductionMultiplier;
  const desiredIncrement = Math.max(
    baseIncrement,
    breederState.effectiveBreedingFemales
      * reproduction.eventsPerAdultFemalePerYear / 365
      * elapsedDays
      * desiredBreedingFitness
      * balance.reproductionMultiplier,
  );

  const baseTotalProgress = before.reproductionProgress + baseIncrement;
  const desiredTotalProgress = before.reproductionProgress + desiredIncrement;
  const baseEvents = Math.max(0, Math.floor(baseTotalProgress + 1e-9));
  const desiredEvents = Math.max(baseEvents, Math.floor(desiredTotalProgress + 1e-9));
  const baseRawRecruits = eventRecruitmentTotal(reproduction, population.id, now, tickIndex, baseEvents);
  const desiredRawRecruits = eventRecruitmentTotal(reproduction, population.id, now, tickIndex, desiredEvents);
  const burstCapacity = Math.max(0, Math.ceil(carryingCapacity * 1.22 - before.population));
  const baseAcceptedRecruits = Math.min(baseRawRecruits, burstCapacity);
  const desiredAcceptedRecruits = Math.min(desiredRawRecruits, burstCapacity);
  const extraRecruits = Math.max(0, desiredAcceptedRecruits - baseAcceptedRecruits);

  const juvenilesBeforeMaturation = before.juveniles + baseAcceptedRecruits;
  const matured = Math.min(
    juvenilesBeforeMaturation,
    Math.max(0, Math.floor(
      before.maturationProgress
        + juvenilesBeforeMaturation / Math.max(45, species.maturityDays) * elapsedDays
        + 1e-9,
    )),
  );
  const adultsBeforeAging = before.adults + matured;
  const aged = Math.min(
    adultsBeforeAging,
    Math.max(0, Math.floor(
      before.agingProgress
        + adultsBeforeAging / Math.max(365, species.maxAgeDays * 0.55) * elapsedDays
        + 1e-9,
    )),
  );
  const juvenilesBeforeDeath = Math.max(0, juvenilesBeforeMaturation - matured);
  const adultsBeforeDeath = Math.max(0, adultsBeforeAging - aged);
  const oldBeforeDeath = Math.max(0, before.old + aged);
  const oldDeaths = Math.max(0, oldBeforeDeath - postBase.old);
  const juvenileDeaths = Math.max(0, juvenilesBeforeDeath - postBase.juveniles);
  const adultDeaths = Math.max(0, adultsBeforeDeath - postBase.adults);
  const totalDeaths = oldDeaths + juvenileDeaths + adultDeaths;

  const mortalityPopulation = before.population + baseAcceptedRecruits;
  const mortalityCauses = {
    old_age: oldBeforeDeath / Math.max(90, species.maxAgeDays * 0.28) * elapsedDays,
    stress: Math.max(0, population.foodStress + population.waterStress - 125) / 100
      * mortalityPopulation * 0.004 * balance.vulnerableMortalityMultiplier * elapsedDays,
    health: Math.max(0, 32 - population.averageHealth) / 100
      * mortalityPopulation * 0.006 * balance.vulnerableMortalityMultiplier * elapsedDays,
  };
  accumulateDemographyMortality(population, reproduction, mortalityCauses);
  if (totalDeaths > 0) {
    const causes = consumeDemographyMortality(population, reproduction, totalDeaths);
    recordDemographyDeaths(population, reproduction, causes, {
      old: oldDeaths,
      juvenile: juvenileDeaths,
      adult: adultDeaths,
    });
  }
  recordDemographyMaturation(population, reproduction, matured);
  recordDemographyRecruitment(
    population,
    reproduction,
    desiredEvents,
    desiredAcceptedRecruits,
    now,
  );

  population.reproductionProgress = Math.max(0, desiredTotalProgress - desiredEvents);
  population.reproductionPressure = clamp100(
    desiredBreedingFitness * Math.min(1.35, balance.reproductionMultiplier) * 100,
  );
  if (extraRecruits > 0) {
    population.juveniles += extraRecruits;
    recomputeBiomass(population, species);
  }
  syncDemographyTelemetry(population, reproduction);
}

/**
 * P3.9b-1 wrapper: preserve the calibrated P3.9 fauna tick, then reconcile its
 * reproduction accumulator to the shared effective-breeder definition and
 * attach causal demography telemetry. No emergency recruitment is introduced.
 */
export function tickWildFauna(state: GameState, deltaGameMinutes: number): void {
  const systemBefore = base.ensureWildFauna(state);
  const snapshots = new Map<string, FaunaTickSnapshot>();
  for (const population of systemBefore.animalPopulations || []) {
    const species = WILD_FAUNA_SPECIES[population.speciesId];
    if (species) {
      const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
      ensureDemographyTelemetry(population, reproduction);
    }
    snapshots.set(population.id, snapshotPopulation(population));
  }

  base.tickWildFauna(state, deltaGameMinutes);

  const system = base.ensureWildFauna(state);
  const now = gameMinute(state);
  const tickIndex = system.ecologyTickIndex;
  for (const population of system.animalPopulations || []) {
    const species = WILD_FAUNA_SPECIES[population.speciesId];
    if (!species) continue;
    const before = snapshots.get(population.id);
    if (!before) {
      const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
      ensureDemographyTelemetry(population, reproduction);
      syncDemographyTelemetry(population, reproduction);
      continue;
    }
    reconcilePopulationDemography(state, population, before, species, now, tickIndex);
  }
}
