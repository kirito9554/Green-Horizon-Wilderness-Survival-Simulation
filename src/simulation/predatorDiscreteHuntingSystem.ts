import type { GameState } from '../types';
import type { EcologyReproductionProfile } from '../data/ecologyDemography';
import type {
  EcologicalSubarea,
  WildAnimalLifeStage,
  WildAnimalPopulation,
  WildPredatorPopulation,
  WorldEcologyState,
} from '../types/ecologySimulation';
import { WILD_FAUNA_SPECIES } from '../data/ecologyFauna';
import { WILD_PREDATOR_SPECIES, type WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import * as base from './predatorDiscreteHuntingSystem.p39base';
import {
  ensurePredatorEnergyState,
  ensureWildPredators,
  getPredatorHabitatSuitability,
} from './ecologyPredatorSystem';
import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport } from './predatorResourceAccess';
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

export * from './predatorDiscreteHuntingSystem.p39base';

interface PredatorTickSnapshot {
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

interface PreyStageSnapshot {
  juveniles: number;
  adults: number;
  old: number;
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

function snapshotPredator(population: WildPredatorPopulation): PredatorTickSnapshot {
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

function snapshotPrey(population: WildAnimalPopulation): PreyStageSnapshot {
  return {
    juveniles: population.juveniles,
    adults: population.adults,
    old: population.old,
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
    const random = mulberry32(hashString(`${populationId}:${now}:${tickIndex}:${eventIndex}:predator-breeding`));
    recruits += eventRecruitmentCount(profile, random);
  }
  return recruits;
}

function estimatePredatorCarryingCapacity(
  state: GameState,
  system: WorldEcologyState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const subareas = subareaIds
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const areaM2 = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.25, areaM2 / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce(
    (sum, subarea) => sum + getPredatorHabitatSuitability(subarea, species),
    0,
  ) / subareas.length;
  const foodSupport = getPredatorFoodSupport(system, subareaIds, species, subareas[0].poiId);
  const preySupport = foodSupport.supportedAdultEquivalents;
  const water = getPredatorAccessibleWaterRatio(state, system, subareaIds, species, subareas[0].poiId);
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 125);
  }, 0) / subareas.length;
  return Math.max(
    0,
    Math.floor(
      Math.min(baseK * (0.45 + habitat * 0.95) * (0.5 + water * 0.5), preySupport * 0.75)
        * Math.max(0.2, disturbance),
    ),
  );
}

function recomputePredatorBiomass(
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(
    species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45),
  );
}

function reconcilePredatorDemography(
  state: GameState,
  system: WorldEcologyState,
  population: WildPredatorPopulation,
  before: PredatorTickSnapshot,
  species: WildPredatorSpeciesDefinition,
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
    estimatePredatorCarryingCapacity(state, system, before.homeRangeSubareaIds, species),
  );
  const balance = demographicBalance(before.population, carryingCapacity, reproduction);
  const condition = clamp01(
    clamp01((population.bodyCondition - 38) / 56) * 0.55
      + clamp01((population.averageHealth - 38) / 56) * 0.45,
  );
  const foodState = clamp01(1 - population.hungerStress / 96);
  const mature = before.adults + before.old;
  const baseMateAvailability = mature <= 0 ? 0 : mature === 1 ? 0.42 : 1;
  const baseBreedingFitness = softBreedingFitness(baseMateAvailability, condition, foodState);
  const desiredBreedingFitness = softBreedingFitness(
    mateAvailabilityFromBreeders(breederState.effectiveBreeders),
    condition,
    foodState,
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
  const burstCapacity = Math.max(0, Math.ceil(carryingCapacity * 1.18 - before.population));
  const baseAcceptedRecruits = Math.min(baseRawRecruits, burstCapacity);
  const desiredAcceptedRecruits = Math.min(desiredRawRecruits, burstCapacity);
  const extraRecruits = Math.max(0, desiredAcceptedRecruits - baseAcceptedRecruits);

  const juvenilesBeforeMaturation = before.juveniles + baseAcceptedRecruits;
  const matured = Math.min(
    juvenilesBeforeMaturation,
    Math.max(0, Math.floor(
      before.maturationProgress
        + juvenilesBeforeMaturation / Math.max(90, species.maturityDays) * elapsedDays
        + 1e-9,
    )),
  );
  const adultsBeforeAging = before.adults + matured;
  const aged = Math.min(
    adultsBeforeAging,
    Math.max(0, Math.floor(
      before.agingProgress
        + adultsBeforeAging / Math.max(730, species.maxAgeDays * 0.6) * elapsedDays
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
    old_age: oldBeforeDeath / Math.max(180, species.maxAgeDays * 0.32) * elapsedDays,
    starvation: Math.max(0, population.hungerStress - 72) / 100
      * mortalityPopulation * 0.006 * balance.vulnerableMortalityMultiplier * elapsedDays,
    dehydration: Math.max(0, population.waterStress - 78) / 100
      * mortalityPopulation * 0.005 * balance.vulnerableMortalityMultiplier * elapsedDays,
    health: Math.max(0, 30 - population.averageHealth) / 100
      * mortalityPopulation * 0.005 * balance.vulnerableMortalityMultiplier * elapsedDays,
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
    recomputePredatorBiomass(population, species);
    ensurePredatorEnergyState(population, species);
  }
  syncDemographyTelemetry(population, reproduction);
}

function recordTerrestrialPredation(
  system: WorldEcologyState,
  beforePrey: Map<string, PreyStageSnapshot>,
): void {
  for (const prey of system.animalPopulations || []) {
    const before = beforePrey.get(prey.id);
    const species = WILD_FAUNA_SPECIES[prey.speciesId];
    if (!before || !species) continue;
    const stages: Partial<Record<WildAnimalLifeStage, number>> = {
      juvenile: Math.max(0, before.juveniles - prey.juveniles),
      adult: Math.max(0, before.adults - prey.adults),
      old: Math.max(0, before.old - prey.old),
    };
    const deaths = (stages.juvenile || 0) + (stages.adult || 0) + (stages.old || 0);
    if (deaths <= 0) continue;
    const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
    recordDemographyDeaths(prey, reproduction, { predation: deaths }, stages);
    syncDemographyTelemetry(prey, reproduction);
  }
}

/**
 * P3.9b-1 wrapper: keep P3.9 hunting untouched, record exact terrestrial prey
 * cohort losses as predation, then reconcile predator reproduction to the same
 * effective breeder semantics used by fauna.
 */
export function tickWildPredatorsDiscrete(state: GameState, deltaGameMinutes: number): void {
  const systemBefore = ensureWildPredators(state);
  const predatorSnapshots = new Map<string, PredatorTickSnapshot>();
  for (const population of systemBefore.predatorPopulations || []) {
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    if (species) {
      const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
      ensureDemographyTelemetry(population, reproduction);
    }
    predatorSnapshots.set(population.id, snapshotPredator(population));
  }
  const preySnapshots = new Map<string, PreyStageSnapshot>();
  for (const population of systemBefore.animalPopulations || []) {
    const species = WILD_FAUNA_SPECIES[population.speciesId];
    if (species) {
      const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
      ensureDemographyTelemetry(population, reproduction);
    }
    preySnapshots.set(population.id, snapshotPrey(population));
  }

  base.tickWildPredatorsDiscrete(state, deltaGameMinutes);

  const system = ensureWildPredators(state);
  recordTerrestrialPredation(system, preySnapshots);
  const now = gameMinute(state);
  const tickIndex = system.ecologyTickIndex;
  for (const population of system.predatorPopulations || []) {
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    if (!species) continue;
    const before = predatorSnapshots.get(population.id);
    if (!before) {
      const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
      ensureDemographyTelemetry(population, reproduction);
      syncDemographyTelemetry(population, reproduction);
      continue;
    }
    reconcilePredatorDemography(state, system, population, before, species, now, tickIndex);
  }
}
