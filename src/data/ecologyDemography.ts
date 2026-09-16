export type EcologyReproductionMode = 'live_birth' | 'egg_clutch';

/**
 * Event-based life history used by aggregate fauna/predator populations.
 * Offspring counts describe the litter/clutch event; juvenileRecruitmentRate
 * compresses egg/hatch/neonate loss into the number that joins the simulated
 * juvenile population.
 */
export interface EcologyReproductionProfile {
  mode: EcologyReproductionMode;
  eventsPerAdultFemalePerYear: number;
  minOffspringPerEvent: number;
  maxOffspringPerEvent: number;
  juvenileRecruitmentRate: number;
  /** Maximum multiplier added when a population is well below carrying capacity. */
  lowPopulationRecoveryBoost?: number;
  /** Density ratio (N/K) where fertility suppression begins. */
  overcrowdingSuppressionStart?: number;
  /** Maximum reduction applied to stress/health mortality at critically low density. */
  criticalMortalityBuffer?: number;
  /** Species-specific initialization range as a share of carrying capacity. */
  initialPopulationMinFraction?: number;
  initialPopulationMaxFraction?: number;
}
