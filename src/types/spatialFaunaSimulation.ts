export type SpatialFaunaSeason = 'dry' | 'wet' | 'monsoon';

export interface SpatialFaunaStageCounts {
  juveniles: number;
  adults: number;
  old: number;
}

/**
 * Compact persistent cohort tuple:
 * [juveniles, adults, old, condition(0..1), consecutiveStressDays].
 *
 * patchId is intentionally the key in cohortsByPatch instead of being repeated
 * inside every cohort. Food/water/refuge/breeding and per-day event counters are
 * derived during the daily tick and are not persisted on thousands of cohorts.
 */
export type SpatialFaunaPatchCohortState = [
  juveniles: number,
  adults: number,
  old: number,
  condition: number,
  stressDays: number,
];

export interface SpatialFaunaSpeciesRuntimeState {
  speciesId: string;
  cohortsByPatch: Record<string, SpatialFaunaPatchCohortState>;
}

export interface SpatialFaunaDailyTelemetry {
  day: number;
  season: SpatialFaunaSeason;
  totalPopulation: number;
  presentSpeciesCount: number;
  occupiedCohortCount: number;
  births: number;
  deaths: number;
  matured: number;
  agedIntoOld: number;
  moved: number;
  crossRegionMoved: number;
  foodDemandKg: number;
  waterDemandUnits: number;
  meanCondition: number;
  meanFoodSufficiency: number;
  meanWaterSufficiency: number;
  meanRefugeSufficiency: number;
  /**
   * Shared-patch competition diagnostics are added by the metric ecosystem
   * interaction pass. They are optional for backward-compatible saves and for
   * the lower-level cohort tick when it is exercised in isolation.
   */
  meanFoodCompetitionPressure?: number;
  meanWaterCompetitionPressure?: number;
  meanRefugeCompetitionPressure?: number;
  competitionLimitedCohortCount?: number;
  competitionLimitedPopulation?: number;
}

export interface SpatialFaunaRuntimeState {
  version: number;
  worldSeed: string;
  communitySignature: string;
  /** Latest in-game day fully processed by the daily fauna runtime. */
  lastProcessedDay: number;
  season: SpatialFaunaSeason;
  species: SpatialFaunaSpeciesRuntimeState[];
  telemetry: SpatialFaunaDailyTelemetry;
  /** Small rolling history for diagnostics/UI; deliberately bounded. */
  history: SpatialFaunaDailyTelemetry[];
}

declare module './index' {
  interface GameState {
    spatialFaunaSystem?: SpatialFaunaRuntimeState;
  }
}

export {};
