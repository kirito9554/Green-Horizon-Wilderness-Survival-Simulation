export type SpatialFaunaSeason = 'dry' | 'wet' | 'monsoon';

export interface SpatialFaunaStageCounts {
  juveniles: number;
  adults: number;
  old: number;
}

/**
 * Sparse, serializable cohort state for one species in one habitat patch.
 * Counts remain aggregate individuals; no per-animal runtime entity is created.
 */
export interface SpatialFaunaPatchCohortState {
  patchId: string;
  stages: SpatialFaunaStageCounts;
  /** 0..1 rolling body-condition / resource-health proxy. */
  condition: number;
  stressDays: number;
  /** Last processed day telemetry. */
  foodSufficiency: number;
  waterSufficiency: number;
  refugeSufficiency: number;
  breedingReadiness: number;
  lastBirths: number;
  lastDeaths: number;
  lastImmigrants: number;
  lastEmigrants: number;
}

export interface SpatialFaunaSpeciesRuntimeState {
  speciesId: string;
  cohorts: SpatialFaunaPatchCohortState[];
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
