import type { EcologyReproductionProfile } from '../data/ecologyDemography';
import type { WildAnimalLifeStage } from './ecologySimulation';

export type DemographyDeathCause =
  | 'old_age'
  | 'stress'
  | 'health'
  | 'starvation'
  | 'dehydration'
  | 'predation'
  | 'pressure'
  | 'unattributed';

export interface PopulationDemographyTelemetry {
  juveniles: number;
  adults: number;
  old: number;
  effectiveBreeders: number;
  effectiveBreedingFemales: number;
  breedingEvents: number;
  recruits: number;
  maturedJuveniles: number;
  openingJuveniles: number;
  deathsByCause: Partial<Record<DemographyDeathCause, number>>;
  deathsByLifeStage: Partial<Record<WildAnimalLifeStage, number>>;
  predationDeathsByLifeStage: Partial<Record<WildAnimalLifeStage, number>>;
  pendingDeathCauseWeights: Partial<Record<DemographyDeathCause, number>>;
  adultAndOldLosses: number;
  emigrants: number;
  daysSinceRecruitment: number;
  daysWithoutBreeder: number;
  recruitmentEfficiency: number;
  replacementRatio: number;
  lastRecruitmentGameMinute?: number;
}

export type ExistingEcologyReproductionProfile = EcologyReproductionProfile;

declare module './ecologySimulation' {
  interface WildAnimalPopulation {
    demographyTelemetry?: PopulationDemographyTelemetry;
  }

  interface WildPredatorPopulation {
    demographyTelemetry?: PopulationDemographyTelemetry;
  }
}

declare module '../data/ecologyDemography' {
  interface EcologyReproductionProfile {
    /** Aggregate fertility of the old cohort relative to a prime-age adult. */
    oldFertilityFactor?: number;
  }
}
