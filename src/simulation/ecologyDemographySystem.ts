import type { EcologyReproductionProfile } from '../data/ecologyDemography';
import type { WildAnimalLifeStage } from '../types/ecologySimulation';
import type {
  DemographyDeathCause,
  PopulationDemographyTelemetry,
} from '../types/ecologyDemographyTelemetry';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

interface DemographyPopulationLike {
  juveniles: number;
  adults: number;
  old: number;
  maleRatio: number;
  demographyTelemetry?: PopulationDemographyTelemetry;
}

type StageCounts = Partial<Record<WildAnimalLifeStage, number>>;
type CauseCounts = Partial<Record<DemographyDeathCause, number>>;

export interface EffectiveBreedingState {
  oldFertilityFactor: number;
  effectiveBreeders: number;
  effectiveBreedingFemales: number;
}

export interface DemographicBalance {
  densityRatio: number;
  lowPopulationIntensity: number;
  overcrowdingIntensity: number;
  reproductionMultiplier: number;
  vulnerableMortalityMultiplier: number;
}

export interface BreederProtectedDispersalPlan extends StageCounts {
  total: number;
}

export function resolveReproductionProfile(
  profile: EcologyReproductionProfile | undefined,
  legacyOffspringPerFemalePerYear: number,
): EcologyReproductionProfile {
  if (profile) return profile;
  return {
    mode: 'live_birth',
    eventsPerAdultFemalePerYear: Math.max(0.05, legacyOffspringPerFemalePerYear),
    minOffspringPerEvent: 1,
    maxOffspringPerEvent: 1,
    juvenileRecruitmentRate: 1,
    oldFertilityFactor: 0.35,
    lowPopulationRecoveryBoost: 0.45,
    overcrowdingSuppressionStart: 0.82,
    criticalMortalityBuffer: 0.35,
    initialPopulationMinFraction: 0.4,
    initialPopulationMaxFraction: 0.7,
  };
}

export function effectiveBreedingState(
  population: Pick<DemographyPopulationLike, 'adults' | 'old' | 'maleRatio'>,
  profile: EcologyReproductionProfile,
): EffectiveBreedingState {
  const oldFertilityFactor = clamp01(profile.oldFertilityFactor ?? 0.35);
  const effectiveBreeders = Math.max(0, population.adults + population.old * oldFertilityFactor);
  const femaleShare = clamp01(1 - population.maleRatio);
  return {
    oldFertilityFactor,
    effectiveBreeders,
    effectiveBreedingFemales: effectiveBreeders * femaleShare,
  };
}

/**
 * Uses the same effective breeder state as breeding-female accounting. The
 * curve preserves the existing partial-mate abstraction for one represented
 * adult while allowing a reduced-fertility old cohort to recover slowly.
 */
export function mateAvailabilityFromBreeders(effectiveBreeders: number): number {
  const breeders = Math.max(0, effectiveBreeders);
  if (breeders <= 0) return 0;
  if (breeders < 1) return clamp01(breeders * 0.42);
  if (breeders < 2) return clamp01(1 - 0.58 * Math.pow(2 - breeders, 2));
  return 1;
}

function updateDerivedTelemetry(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  telemetry: PopulationDemographyTelemetry,
): void {
  const breeders = effectiveBreedingState(population, profile);
  telemetry.juveniles = population.juveniles;
  telemetry.adults = population.adults;
  telemetry.old = population.old;
  telemetry.effectiveBreeders = breeders.effectiveBreeders;
  telemetry.effectiveBreedingFemales = breeders.effectiveBreedingFemales;
  const recruitmentPool = telemetry.openingJuveniles + telemetry.recruits;
  telemetry.recruitmentEfficiency = recruitmentPool > 0
    ? telemetry.maturedJuveniles / recruitmentPool
    : 0;
  telemetry.replacementRatio = telemetry.adultAndOldLosses > 0
    ? telemetry.maturedJuveniles / telemetry.adultAndOldLosses
    : 1;
}

export function ensureDemographyTelemetry(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
): PopulationDemographyTelemetry {
  if (!population.demographyTelemetry) {
    population.demographyTelemetry = {
      juveniles: population.juveniles,
      adults: population.adults,
      old: population.old,
      effectiveBreeders: 0,
      effectiveBreedingFemales: 0,
      breedingEvents: 0,
      recruits: 0,
      maturedJuveniles: 0,
      openingJuveniles: population.juveniles,
      deathsByCause: {},
      deathsByLifeStage: {},
      predationDeathsByLifeStage: {},
      pendingDeathCauseWeights: {},
      adultAndOldLosses: 0,
      emigrants: 0,
      daysSinceRecruitment: 0,
      daysWithoutBreeder: 0,
      recruitmentEfficiency: 0,
      replacementRatio: 1,
    };
  }
  updateDerivedTelemetry(population, profile, population.demographyTelemetry);
  return population.demographyTelemetry;
}

export function advanceDemographyTelemetry(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  elapsedDays: number,
  breedingState?: EffectiveBreedingState,
): PopulationDemographyTelemetry {
  const telemetry = ensureDemographyTelemetry(population, profile);
  const days = Math.max(0, elapsedDays);
  telemetry.daysSinceRecruitment += days;
  const breeders = breedingState || effectiveBreedingState(population, profile);
  telemetry.daysWithoutBreeder = breeders.effectiveBreedingFemales > 0
    ? 0
    : telemetry.daysWithoutBreeder + days;
  updateDerivedTelemetry(population, profile, telemetry);
  return telemetry;
}

export function syncDemographyTelemetry(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
): PopulationDemographyTelemetry {
  const telemetry = ensureDemographyTelemetry(population, profile);
  updateDerivedTelemetry(population, profile, telemetry);
  return telemetry;
}

export function recordDemographyRecruitment(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  breedingEvents: number,
  recruits: number,
  currentGameMinute: number,
): void {
  const telemetry = ensureDemographyTelemetry(population, profile);
  telemetry.breedingEvents += Math.max(0, breedingEvents);
  telemetry.recruits += Math.max(0, recruits);
  if (recruits > 0) {
    telemetry.daysSinceRecruitment = 0;
    telemetry.lastRecruitmentGameMinute = currentGameMinute;
  }
  updateDerivedTelemetry(population, profile, telemetry);
}

export function recordDemographyMaturation(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  matured: number,
): void {
  if (matured <= 0) return;
  const telemetry = ensureDemographyTelemetry(population, profile);
  telemetry.maturedJuveniles += matured;
  updateDerivedTelemetry(population, profile, telemetry);
}

export function accumulateDemographyMortality(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  causes: CauseCounts,
): void {
  const telemetry = ensureDemographyTelemetry(population, profile);
  for (const [cause, value] of Object.entries(causes) as Array<[DemographyDeathCause, number]>) {
    if (!Number.isFinite(value) || value <= 0) continue;
    telemetry.pendingDeathCauseWeights[cause] = (telemetry.pendingDeathCauseWeights[cause] || 0) + value;
  }
}

export function consumeDemographyMortality(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  deaths: number,
): CauseCounts {
  if (deaths <= 0) return {};
  const telemetry = ensureDemographyTelemetry(population, profile);
  const pending = Object.entries(telemetry.pendingDeathCauseWeights)
    .filter((entry): entry is [DemographyDeathCause, number] => Number.isFinite(entry[1]) && entry[1] > 0);
  const totalPending = pending.reduce((sum, [, value]) => sum + value, 0);
  if (totalPending <= 0) return { unattributed: deaths };
  const result: CauseCounts = {};
  for (const [cause, weight] of pending) {
    const allocated = deaths * weight / totalPending;
    result[cause] = allocated;
    telemetry.pendingDeathCauseWeights[cause] = Math.max(0, weight - allocated);
  }
  return result;
}

export function recordDemographyDeaths(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  causes: CauseCounts,
  stages: StageCounts,
): void {
  const telemetry = ensureDemographyTelemetry(population, profile);
  for (const [cause, value] of Object.entries(causes) as Array<[DemographyDeathCause, number]>) {
    if (!Number.isFinite(value) || value <= 0) continue;
    telemetry.deathsByCause[cause] = (telemetry.deathsByCause[cause] || 0) + value;
  }
  const predation = Math.max(0, causes.predation || 0);
  for (const [stage, value] of Object.entries(stages) as Array<[WildAnimalLifeStage, number]>) {
    if (!Number.isFinite(value) || value <= 0) continue;
    telemetry.deathsByLifeStage[stage] = (telemetry.deathsByLifeStage[stage] || 0) + value;
    if (predation > 0) {
      telemetry.predationDeathsByLifeStage[stage] = (telemetry.predationDeathsByLifeStage[stage] || 0) + value;
    }
  }
  telemetry.adultAndOldLosses += Math.max(0, stages.adult || 0) + Math.max(0, stages.old || 0);
  updateDerivedTelemetry(population, profile, telemetry);
}

export function recordDemographyEmigration(
  population: DemographyPopulationLike,
  profile: EcologyReproductionProfile,
  stages: StageCounts,
): void {
  const telemetry = ensureDemographyTelemetry(population, profile);
  const total = Math.max(0, stages.juvenile || 0)
    + Math.max(0, stages.adult || 0)
    + Math.max(0, stages.old || 0);
  telemetry.emigrants += total;
  telemetry.adultAndOldLosses += Math.max(0, stages.adult || 0) + Math.max(0, stages.old || 0);
  updateDerivedTelemetry(population, profile, telemetry);
}

/**
 * Preserve at least one adult-equivalent breeder when that capacity already
 * exists. Lower-fertility old animals and juveniles disperse before prime-age
 * adults. This is a guard only; it does not create immigration or new animals.
 */
export function breederProtectedDispersalPlan(
  population: Pick<DemographyPopulationLike, 'juveniles' | 'adults' | 'old' | 'maleRatio'>,
  requested: number,
  profile: EcologyReproductionProfile,
): BreederProtectedDispersalPlan {
  let remaining = Math.min(
    Math.max(0, Math.floor(requested)),
    Math.max(0, population.juveniles + population.adults + population.old - 1),
  );
  const plan: BreederProtectedDispersalPlan = { total: 0, juvenile: 0, adult: 0, old: 0 };
  if (remaining <= 0) return plan;

  const breederState = effectiveBreedingState(population, profile);
  const requiredBreeders = Math.min(1, breederState.effectiveBreeders);
  let availableBreeders = breederState.effectiveBreeders;
  const oldFactor = breederState.oldFertilityFactor;

  const removableOld = oldFactor > 0
    ? Math.min(population.old, Math.max(0, Math.floor((availableBreeders - requiredBreeders + 1e-9) / oldFactor)))
    : population.old;
  const old = Math.min(removableOld, remaining);
  plan.old = old;
  plan.total += old;
  remaining -= old;
  availableBreeders -= old * oldFactor;

  const juvenile = Math.min(population.juveniles, remaining);
  plan.juvenile = juvenile;
  plan.total += juvenile;
  remaining -= juvenile;

  const removableAdults = Math.min(
    population.adults,
    Math.max(0, Math.floor(availableBreeders - requiredBreeders + 1e-9)),
  );
  const adult = Math.min(removableAdults, remaining);
  plan.adult = adult;
  plan.total += adult;
  return plan;
}

export function demographicBalance(
  population: number,
  carryingCapacity: number,
  profile: EcologyReproductionProfile,
): DemographicBalance {
  const densityRatio = population / Math.max(1, carryingCapacity);
  const lowPopulationIntensity = clamp01((0.5 - densityRatio) / 0.42);
  const crowdingStart = Math.max(0.55, Math.min(1.05, profile.overcrowdingSuppressionStart ?? 0.82));
  const overcrowdingIntensity = clamp01((densityRatio - crowdingStart) / Math.max(0.15, 1.28 - crowdingStart));
  const recoveryBoost = Math.max(0, profile.lowPopulationRecoveryBoost ?? 0.45);
  const highDensitySuppression = 1 - overcrowdingIntensity * 0.9;
  const reproductionMultiplier = Math.max(0.08, (1 + lowPopulationIntensity * recoveryBoost) * highDensitySuppression);
  const mortalityBuffer = clamp01(profile.criticalMortalityBuffer ?? 0.35);
  const vulnerableMortalityMultiplier = 1 - lowPopulationIntensity * mortalityBuffer;
  return {
    densityRatio,
    lowPopulationIntensity,
    overcrowdingIntensity,
    reproductionMultiplier,
    vulnerableMortalityMultiplier,
  };
}

export function softBreedingFitness(
  mateAvailability: number,
  condition: number,
  resourceState: number,
): number {
  if (mateAvailability <= 0) return 0;
  const environmentalFitness = clamp01(condition * 0.55 + resourceState * 0.45);
  return clamp01(mateAvailability * (0.22 + environmentalFitness * 0.78));
}

export function eventRecruitmentCount(
  profile: EcologyReproductionProfile,
  random: () => number,
): number {
  const min = Math.max(1, Math.floor(profile.minOffspringPerEvent));
  const max = Math.max(min, Math.floor(profile.maxOffspringPerEvent));
  const raw = min + Math.floor(random() * (max - min + 1));
  const expected = raw * clamp01(profile.juvenileRecruitmentRate);
  const whole = Math.floor(expected);
  const fractional = expected - whole;
  return whole + (random() < fractional ? 1 : 0);
}

export function initialPopulationFraction(
  profile: EcologyReproductionProfile,
  random: () => number,
): number {
  const min = Math.max(0.2, Math.min(0.9, profile.initialPopulationMinFraction ?? 0.42));
  const max = Math.max(min, Math.min(0.98, profile.initialPopulationMaxFraction ?? 0.74));
  return min + random() * (max - min);
}
