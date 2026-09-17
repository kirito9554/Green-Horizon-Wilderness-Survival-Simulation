import type { WildFoodResource } from './ecologySimulation';

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

export const SPATIAL_FAUNA_FOOD_RESOURCE_ORDER: readonly WildFoodResource[] = [
  'fruit',
  'seeds',
  'browse',
  'ground_vegetation',
  'roots_tubers',
  'insects',
  'aquatic_plants',
  'carrion',
] as const;

/**
 * Persistent shared patch stock in physical/ecological units:
 * [fruit kg, seeds kg, browse kg, ground vegetation kg, roots/tubers kg,
 * insects kg, aquatic plants kg, carrion kg, fresh-water demand units].
 *
 * Capacity and productivity are regenerated deterministically from patch area,
 * habitat, hydrology, Local Sites and the census K. Only changing stock is saved.
 */
export type SpatialFaunaPatchResourceStockState = [
  fruitKg: number,
  seedsKg: number,
  browseKg: number,
  groundVegetationKg: number,
  rootsTubersKg: number,
  insectsKg: number,
  aquaticPlantsKg: number,
  carrionKg: number,
  freshWaterUnits: number,
];

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
  /** Persistent patch resource-pool diagnostics. */
  foodPoolStockKg?: number;
  foodPoolCapacityKg?: number;
  foodPoolRecoveredKg?: number;
  foodPoolConsumedKg?: number;
  waterPoolStockUnits?: number;
  waterPoolCapacityUnits?: number;
  waterPoolRecoveredUnits?: number;
  waterPoolConsumedUnits?: number;
  meanFoodPoolFill?: number;
  meanWaterPoolFill?: number;
  resourceLimitedCohortCount?: number;
  resourceLimitedPopulation?: number;
}

export interface SpatialFaunaRuntimeState {
  version: number;
  worldSeed: string;
  communitySignature: string;
  /** Latest in-game day fully processed by the daily fauna runtime. */
  lastProcessedDay: number;
  season: SpatialFaunaSeason;
  species: SpatialFaunaSpeciesRuntimeState[];
  /**
   * Shared food/water stocks keyed by generated habitat patch. Optional so old
   * saves and the low-level demographic tests can lazily materialize the pools.
   */
  resourceStocksByPatch?: Record<string, SpatialFaunaPatchResourceStockState>;
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
