import type { EcologyReproductionProfile } from '../data/ecologyDemography';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface DemographicBalance {
  densityRatio: number;
  lowPopulationIntensity: number;
  overcrowdingIntensity: number;
  reproductionMultiplier: number;
  vulnerableMortalityMultiplier: number;
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
    lowPopulationRecoveryBoost: 0.45,
    overcrowdingSuppressionStart: 0.82,
    criticalMortalityBuffer: 0.35,
    initialPopulationMinFraction: 0.4,
    initialPopulationMaxFraction: 0.7,
  };
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

/**
 * Avoid the old multiplicative death spiral where several merely-imperfect
 * factors collapsed fertility to near zero. Mate availability remains a hard
 * gate, while condition/resource state are blended as soft constraints.
 */
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
