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

/** Predator cohort: [juveniles, adults, old, condition 0..1, reserve kg food-equivalent]. */
export type SpatialPredatorPatchCohortState = [
  juveniles: number,
  adults: number,
  old: number,
  condition: number,
  reserveKg: number,
];

export interface SpatialPredatorSpeciesRuntimeState {
  speciesId: string;
  cohortsByPatch: Record<string, SpatialPredatorPatchCohortState>;
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
  births: number;
  deaths: number;
  moved: number;
  meanCondition: number;
  unsuccessfulHunts: number;
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
