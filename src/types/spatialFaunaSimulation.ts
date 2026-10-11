import type { WildFoodResource } from './ecologySimulation';
import type {
  SpatialFloraRuntimeState,
  SpatialInsectRuntimeState,
  SpatialPredatorRuntimeState,
} from './spatialEcologySimulation';

export type SpatialFaunaSeason = 'dry' | 'wet' | 'monsoon';

export interface SpatialFaunaStageCounts {
  juveniles: number;
  adults: number;
  old: number;
}

/** Compact cohort: [juveniles, adults, old, condition(0..1), consecutiveStressDays]. */
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
  /** Consecutive globally absent days, used only by the slow external recolonization safety net. */
  globalAbsenceDays?: number;
  lastImmigrationDay?: number;
}

export const SPATIAL_FAUNA_FOOD_RESOURCE_ORDER: readonly WildFoodResource[] = [
  'fruit', 'seeds', 'browse', 'ground_vegetation', 'roots_tubers', 'insects', 'aquatic_plants', 'carrion',
] as const;

/** [fruit, seeds, browse, ground vegetation, roots/tubers, insects, aquatic plants, carrion, fresh water]. */
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
  mateSearchMoved?: number;
  natalDispersed?: number;
  groupSplitMoved?: number;
  resourceMoved?: number;
  recolonizedIndividuals?: number;
  foodDemandKg: number;
  waterDemandUnits: number;
  meanCondition: number;
  meanFoodSufficiency: number;
  meanWaterSufficiency: number;
  meanRefugeSufficiency: number;
  meanFoodCompetitionPressure?: number;
  meanWaterCompetitionPressure?: number;
  meanRefugeCompetitionPressure?: number;
  competitionLimitedCohortCount?: number;
  competitionLimitedPopulation?: number;
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
  /** Authoritative spatial trophic-layer diagnostics. */
  floraBiomassKg?: number;
  insectBiomassKg?: number;
  insectConsumedKg?: number;
  predatorPopulation?: number;
  predatorKills?: number;
  predatorKillBiomassKg?: number;
}

export interface SpatialFaunaRuntimeState {
  /** Cohort/runtime serialization version. */
  version: number;
  /** Whole food-web interaction version. Old saves without/currently below this are deterministically regenerated. */
  interactionVersion?: number;
  worldSeed: string;
  communitySignature: string;
  lastProcessedDay: number;
  season: SpatialFaunaSeason;
  species: SpatialFaunaSpeciesRuntimeState[];
  resourceStocksByPatch?: Record<string, SpatialFaunaPatchResourceStockState>;
  /** These nested states make the metric patch world the terrestrial ecology authority. */
  floraSystem?: SpatialFloraRuntimeState;
  insectSystem?: SpatialInsectRuntimeState;
  predatorSystem?: SpatialPredatorRuntimeState;
  telemetry: SpatialFaunaDailyTelemetry;
  history: SpatialFaunaDailyTelemetry[];
}

declare module './index' {
  interface GameState {
    spatialFaunaSystem?: SpatialFaunaRuntimeState;
  }
}

export {};
