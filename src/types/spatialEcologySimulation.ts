import type { SpatialFaunaSeason } from './spatialFaunaSimulation';

export type SpatialFloraStratum =
  | 'emergent'
  | 'canopy'
  | 'subcanopy'
  | 'understory_tree'
  | 'shrub'
  | 'herb'
  | 'groundcover'
  | 'fern'
  | 'vine'
  | 'epiphyte'
  | 'reed_sedge'
  | 'mangrove'
  | 'aquatic';

export type SpatialFloraGrowthStrategy =
  | 'slow_woody'
  | 'fast_woody'
  | 'clonal'
  | 'herbaceous'
  | 'liana'
  | 'epiphyte'
  | 'wetland'
  | 'aquatic';

export type SpatialFloraRole =
  | 'canopy_structure'
  | 'shade'
  | 'fruit_source'
  | 'seed_source'
  | 'browse_source'
  | 'root_food'
  | 'ground_food'
  | 'timber'
  | 'fiber'
  | 'medicine'
  | 'nectar'
  | 'pollinator_host'
  | 'insect_host'
  | 'nitrogen_cycling'
  | 'erosion_control'
  | 'bank_stabilization'
  | 'wetland_structure'
  | 'aquatic_food'
  | 'water_capture'
  | 'refuge'
  | 'succession_pioneer'
  | 'old_growth_indicator';

/** Compact patch flora state: [standing biomass kg, seed/propagule reserve 0..1, condition 0..1, succession age days]. */
export type SpatialFloraPatchState = [
  biomassKg: number,
  propaguleReserve: number,
  condition: number,
  successionAgeDays: number,
];

export interface SpatialFloraSpeciesRuntimeState {
  speciesId: string;
  patches: Record<string, SpatialFloraPatchState>;
}

export interface SpatialFloraTelemetry {
  day: number;
  season: SpatialFaunaSeason;
  trackedSpecies: number;
  occupiedPopulations: number;
  totalBiomassKg: number;
  fruitProductionKg: number;
  seedProductionKg: number;
  browseProductionKg: number;
  groundProductionKg: number;
  rootProductionKg: number;
  aquaticPlantProductionKg: number;
  colonizedPatches: number;
  localExtirpations: number;
}

export interface SpatialFloraRuntimeState {
  version: number;
  worldSeed: string;
  lastProcessedDay: number;
  species: SpatialFloraSpeciesRuntimeState[];
  telemetry: SpatialFloraTelemetry;
}

export type SpatialInsectGuild =
  | 'pollinator'
  | 'folivore'
  | 'frugivore'
  | 'seed_feeder'
  | 'wood_borer'
  | 'detritivore'
  | 'dung_feeder'
  | 'carrion_feeder'
  | 'fungivore'
  | 'predator'
  | 'blood_feeder'
  | 'aquatic_larva';

export type SpatialInsectSubstrate =
  | 'canopy'
  | 'understory'
  | 'ground'
  | 'deadwood'
  | 'litter'
  | 'dung'
  | 'carrion'
  | 'flowers'
  | 'fruit'
  | 'freshwater'
  | 'wetland';

/** Compact patch insect state: [live biomass kg, egg/larval reserve 0..1, condition 0..1]. */
export type SpatialInsectPatchState = [
  biomassKg: number,
  recruitmentReserve: number,
  condition: number,
];

export interface SpatialInsectSpeciesRuntimeState {
  speciesId: string;
  patches: Record<string, SpatialInsectPatchState>;
}

export interface SpatialInsectTelemetry {
  day: number;
  season: SpatialFaunaSeason;
  trackedGuilds: number;
  occupiedPopulations: number;
  totalBiomassKg: number;
  producedBiomassKg: number;
  consumedByFaunaKg: number;
  pollinationIndex: number;
  decompositionIndex: number;
  herbivoryIndex: number;
}

export interface SpatialInsectRuntimeState {
  version: number;
  worldSeed: string;
  lastProcessedDay: number;
  species: SpatialInsectSpeciesRuntimeState[];
  telemetry: SpatialInsectTelemetry;
}

/**
 * Predator cohort.
 * P9.2 trailing digestion fields are optional for backward compatibility with
 * runtime/save state created before shadow gut telemetry existed.
 */
export type SpatialPredatorPatchCohortState = [
  juveniles: number,
  adults: number,
  old: number,
  condition: number,
  reserveKg: number,
  shadowGutEnergyKJ?: number,
  shadowGutMassKg?: number,
  shadowDigestionDaysRemaining?: number,
  shadowDaysSinceMeal?: number,
  bioReserveEnergyKJ?: number,
];

export interface SpatialPredatorSpeciesRuntimeState {
  speciesId: string;
  cohortsByPatch: Record<string, SpatialPredatorPatchCohortState>;
  /** Consecutive days with zero island population. Kept distinct from below-MVP recovery pressure. */
  globalAbsenceDays?: number;
  /** Consecutive/retained recovery pressure while below the minimum viable population. */
  belowMvpDays?: number;
  recoveryPressure?: number;
  recoveredDays?: number;
  lastImmigrationDay?: number;
  nextEligibleImmigrationDay?: number;
  lastExtinctionDay?: number;
  lastRecolonizationDay?: number;
}

export interface SpatialPredatorSpeciesTelemetry {
  speciesId: string;
  startPopulation: number;
  endPopulation: number;
  juveniles: number;
  adults: number;
  old: number;
  births: number;
  immigrants: number;
  deaths: number;
  hungerDeaths: number;
  naturalDeaths: number;
  deathJuveniles: number;
  deathAdults: number;
  deathOld: number;
  matured: number;
  aged: number;
  preyKilled: number;
  /** P9.5 audit: realized kill composition before changing target-selection semantics. */
  preyKillsBySpecies: Record<string, number>;
  preyKillBiomassBySpeciesKg: Record<string, number>;
  huntAttempts: number;
  successfulHunts: number;
  unsuccessfulHunts: number;
  /** Sum of modeled conditional capture probabilities for actual attack attempts. */
  modeledAttackSuccessProbabilitySum: number;
  /** Attack attempts included in modeledAttackSuccessProbabilitySum. */
  modeledAttackAttempts: number;
  /** Attacks whose RNG capture roll passed the modeled probability threshold. */
  captureRollPassed: number;
  /** Capture rolls that passed but could not remove a currently eligible prey stage. Must normally remain zero. */
  postCaptureRemovalFailed: number;
  /** Sum p(1-p) for modeled attack Bernoulli trials; used to audit calibration significance. */
  modeledAttackBernoulliVarianceSum: number;
  /** Sum of authoritative raw capture RNG rolls. A uniform stream should average near 0.5. */
  captureRollSum: number;
  /** Shadow-only Mulberry32-mixed roll sum using the same deterministic attack key. */
  mixedCaptureRollSum: number;
  /** Shadow-only captures that would pass if the same attack key were mixed through Mulberry32 first. */
  mixedCaptureRollPassedShadow: number;
  huntOpportunityPredatorDays: number;
  accessiblePreyHeadDays: number;
  accessiblePreyBiomassPredatorDaysKg: number;
  islandPreferredPreyHeadDays: number;
  islandPreferredPreyBiomassPredatorDaysKg: number;
  preyBiomassKilledKg: number;
  edibleBiomassFromKillsKg: number;
  dailyDemandKg: number;
  coveredDemandKg: number;
  energyShortfallKg: number;
  reserveStartKg: number;
  reserveEndKg: number;
  reserveDrawKg: number;
  reserveGainKg: number;
  edibleOverflowKg: number;
  /** P9.1 shadow-only broad-class field metabolic demand; not yet authoritative for behavior. */
  fmrDemandKJ: number;
  /** P9.1 legacy kg-food demand converted onto the reference wet-prey energy axis. */
  legacyDemandEquivalentKJ: number;
  /** P9.1 edible vertebrate kills converted onto the same reference energy axis. */
  ingestedPreyEnergyKJ: number;
  /** P9.2 non-authoritative gut state accounting. */
  shadowGutStartKJ: number;
  shadowGutEndKJ: number;
  shadowAssimilatedEnergyKJ: number;
  shadowDigestionCostKJ: number;
  shadowDigestingPredatorDays: number;
  /** P9.3 authoritative bioenergetic ledger, populated only when the feature flag is enabled. */
  bioDemandKJ: number;
  bioCoveredDemandKJ: number;
  bioShortfallKJ: number;
  bioReserveStartKJ: number;
  bioReserveEndKJ: number;
  bioReserveDrawKJ: number;
  bioReserveGainKJ: number;
  bioEnergyOverflowKJ: number;
  feedingBoutPredatorDays: number;
  alternativeFoodConsumedKg: number;
  alternativeFoodEnergyKJ: number;
  alternativeFruitKg: number;
  alternativeInsectKg: number;
  alternativeCarrionKg: number;
  hungerRiskPredatorDays: number;
  huntingPredatorDays: number;
  reserveCoveredPredatorDays: number;
  predatorDays: number;
  foodCoveragePredatorDays: number;
  reserveFillPredatorDays: number;
  breedingCapableCohorts: number;
  isolatedBreeders: number;
  mateSearchProposed: number;
  mateSearchExecuted: number;
  mateSearchBlocked: number;
  mateAccessEvaluated: number;
  mateAccessBeforeSum: number;
  mateAccessAfterSum: number;
  belowMvpDays: number;
  recoveryPressure: number;
  recoveredDays: number;
  nextEligibleImmigrationDay?: number;
  immigrationPulses: number;
  extinctionEvents: number;
  recolonizationEvents: number;
  globalAbsenceDays: number;
  lastExtinctionDay?: number;
  lastRecolonizationDay?: number;
}

export interface SpatialPredatorTelemetry {
  day: number;
  season: SpatialFaunaSeason;
  totalPopulation: number;
  presentSpecies: number;
  occupiedCohorts: number;
  preyKilled: number;
  preyBiomassKilledKg: number;
  carrionAddedKg: number;
  alternativeFoodConsumedKg?: number;
  alternativeFoodEnergyKJ?: number;
  births: number;
  deaths: number;
  hungerDeaths?: number;
  naturalDeaths?: number;
  matured?: number;
  aged?: number;
  moved: number;
  mateSearchMoved?: number;
  mateSearchProposed?: number;
  mateSearchExecuted?: number;
  mateSearchBlocked?: number;
  natalDispersed?: number;
  territorySettled?: number;
  groupSplitMoved?: number;
  immigrants?: number;
  immigrationPulses?: number;
  meanCondition: number;
  unsuccessfulHunts: number;
  bySpecies?: Record<string, SpatialPredatorSpeciesTelemetry>;
}

export interface SpatialPredatorRuntimeState {
  version: number;
  worldSeed: string;
  lastProcessedDay: number;
  species: SpatialPredatorSpeciesRuntimeState[];
  telemetry: SpatialPredatorTelemetry;
}

export interface SpatialPrimaryProductionSnapshot {
  /** Multipliers against the metric landscape substrate, keyed by generated patch. */
  byPatchId: Record<string, {
    fruit: number;
    seeds: number;
    browse: number;
    groundVegetation: number;
    rootsTubers: number;
    aquaticPlants: number;
    insectBiomassKg: number;
  }>;
}
