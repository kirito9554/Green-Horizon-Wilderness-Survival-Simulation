import type { MainWorldAreaId } from '../data/mainWorldAreas';

export type EcologySubareaKind = 'physical' | 'ecological' | 'ephemeral';
export type EcologyMaterializationState = 'latent' | 'materialized';
export type WildFoodResource =
  | 'fruit'
  | 'seeds'
  | 'browse'
  | 'ground_vegetation'
  | 'roots_tubers'
  | 'insects'
  | 'aquatic_plants'
  | 'carrion';
export type WildAnimalLifeStage = 'juvenile' | 'adult' | 'old';

export interface EcologyTerrainState {
  elevation: number;
  slope: number;
  drainage: number;
  floodRisk: number;
  soilDepth: number;
}

export interface EcologyEnvironmentState {
  canopyCover: number;
  sunlight: number;
  humidity: number;
  moisture: number;
  windExposure: number;
  waterAccess: number;
}

export interface EcologyResourceState {
  fruitPotential: number;
  ediblePlantPotential: number;
  medicinalPlantPotential: number;
  timberPotential: number;
  freshwaterPotential: number;
}

export interface EcologyPressureState {
  biomass: number;
  plantDiversity: number;
  preyDensity: number;
  predatorPressure: number;
  decompositionRate: number;
  diseasePressure: number;
}

export interface EcologyDisturbanceState {
  floodDamage: number;
  fireDamage: number;
  stormDamage: number;
  humanPressure: number;
  loggingPressure: number;
  foragingPressure: number;
}

export interface EcologyFoodWebState {
  insectBiomassKg: number;
  carrionBiomassKg: number;
  aquaticPlantBiomassKg: number;
}

export interface EcologicalSubarea {
  id: string;
  poiId: MainWorldAreaId;
  archetypeId: string;
  kind: EcologySubareaKind;
  name: string;
  cellIds: string[];
  areaM2: number;
  materializationState: EcologyMaterializationState;
  discovered: boolean;
  terrain: EcologyTerrainState;
  environment: EcologyEnvironmentState;
  resources: EcologyResourceState;
  ecology: EcologyPressureState;
  disturbance: EcologyDisturbanceState;
  foodWeb?: EcologyFoodWebState;
  plantPopulationIds: string[];
  generatedAtGameMinute: number;
}

export interface EcologyConnection {
  id: string;
  poiId: MainWorldAreaId;
  fromSubareaId: string;
  toSubareaId: string;
  distanceM: number;
  movementCost: number;
  waterBarrier: number;
  slopeBarrier: number;
  vegetationBarrier: number;
  visibility: number;
}

export interface WildPlantPopulation {
  id: string;
  speciesId: string;
  poiId: MainWorldAreaId;
  subareaId: string;
  biomassKg: number;
  estimatedIndividuals: number;
  juvenileRatio: number;
  matureRatio: number;
  health: number;
  regeneration: number;
  fruitBiomassKg: number;
  seedBank: number;
  geneticDiversity: number;
  lastUpdatedGameMinute: number;
}

export interface SignificantWildPlant {
  id: string;
  speciesId: string;
  poiId: MainWorldAreaId;
  subareaId: string;
  sourcePopulationId: string;
  ageHours: number;
  health: number;
  biomassKg: number;
  reproductiveState: 'juvenile' | 'mature' | 'flowering' | 'fruiting' | 'senescent';
  genetics: Record<string, number>;
}

export interface WildAnimalPopulation {
  id: string;
  speciesId: string;
  poiId: MainWorldAreaId;
  currentSubareaId: string;
  homeRangeSubareaIds: string[];
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  maleRatio: number;
  biomassKg: number;
  averageHealth: number;
  bodyCondition: number;
  foodStress: number;
  waterStress: number;
  reproductionPressure: number;
  migrationPressure: number;
  humanFear: number;
  geneticDiversity: number;
  reproductionProgress: number;
  maturationProgress: number;
  agingProgress: number;
  mortalityProgress: number;
  movementProgress: number;
  lastMoveGameMinute: number;
  lastUpdatedGameMinute: number;
}

export interface SignificantWildAnimal {
  id: string;
  speciesId: string;
  poiId: MainWorldAreaId;
  currentSubareaId: string;
  homeRangeSubareaIds: string[];
  sourcePopulationId: string;
  lifeStage: WildAnimalLifeStage;
  sex: 'male' | 'female';
  ageHours: number;
  weightKg: number;
  health: number;
  bodyCondition: number;
  hunger: number;
  thirst: number;
  stress: number;
  humanFear: number;
  genetics: Record<string, number>;
  lastMoveGameMinute: number;
  lastUpdatedGameMinute: number;
}

export interface PredatorHuntPreyTelemetry {
  encounters: number;
  attacks: number;
  successfulKills: number;
}

export interface PredatorHuntTelemetry {
  attempts: number;
  encounters: number;
  attacks: number;
  successfulKills: number;
  successfulKillsByLifeStage: Partial<Record<WildAnimalLifeStage, number>>;
  edibleConsumedKg: number;
  supplementalConsumedKg: number;
  supplementalByResource: Partial<Record<WildFoodResource, number>>;
  carcassBiomassCreatedKg: number;
  byPreySpecies: Record<string, PredatorHuntPreyTelemetry>;
  lastTargetSpeciesId?: string;
  lastTargetLifeStage?: WildAnimalLifeStage;
  lastEncounterChance?: number;
  lastAttackSuccessChance?: number;
  lastOutcome?: 'no_target' | 'no_encounter' | 'no_attack' | 'failed_attack' | 'success';
}

export interface WildPredatorPopulation {
  id: string;
  speciesId: string;
  poiId: MainWorldAreaId;
  currentSubareaId: string;
  homeRangeSubareaIds: string[];
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  maleRatio: number;
  biomassKg: number;
  averageHealth: number;
  bodyCondition: number;
  hungerStress: number;
  waterStress: number;
  reproductionPressure: number;
  migrationPressure: number;
  humanFear: number;
  geneticDiversity: number;
  reproductionProgress: number;
  maturationProgress: number;
  agingProgress: number;
  mortalityProgress: number;
  movementProgress: number;
  /** Legacy expected-kill accumulator retained for save compatibility. */
  predationProgressByPreySpecies: Record<string, number>;
  /** Fractional progress toward the next discrete hunt attempt. */
  huntAttemptProgress?: number;
  /** Cumulative discrete hunting diagnostics for this population. */
  huntTelemetry?: PredatorHuntTelemetry;
  /** Stored edible-energy buffer. Optional for backward-compatible save migration. */
  energyReserveKg?: number;
  /** Dynamic reserve ceiling for the current age structure. Optional on legacy saves. */
  maxEnergyReserveKg?: number;
  /** Diagnostic value from the latest predator tick. */
  lastEnergyIntakeKg?: number;
  /** Diagnostic metabolic demand from the latest predator tick. */
  lastEnergyDemandKg?: number;
  lastMoveGameMinute: number;
  lastUpdatedGameMinute: number;
}

export interface WildCarcass {
  id: string;
  poiId: MainWorldAreaId;
  subareaId: string;
  sourceSpeciesId: string;
  sourceLifeStage: WildAnimalLifeStage;
  cause: 'predation' | 'natural';
  killerSpeciesId?: string;
  killerPopulationId?: string;
  bodyMassKg: number;
  edibleMassKg: number;
  scavengeableMassKg: number;
  remainingMassKg: number;
  remainingEdibleKg: number;
  remainingScavengeableKg: number;
  mirroredCarrionKg: number;
  freshness: number;
  createdGameMinute: number;
  lastUpdatedGameMinute: number;
}

export interface SignificantWildPredator {
  id: string;
  speciesId: string;
  poiId: MainWorldAreaId;
  currentSubareaId: string;
  homeRangeSubareaIds: string[];
  sourcePopulationId: string;
  lifeStage: WildAnimalLifeStage;
  sex: 'male' | 'female';
  ageHours: number;
  weightKg: number;
  health: number;
  bodyCondition: number;
  hunger: number;
  thirst: number;
  stress: number;
  humanFear: number;
  genetics: Record<string, number>;
  lastMoveGameMinute: number;
  lastUpdatedGameMinute: number;
}

export interface RegionEcology {
  poiId: MainWorldAreaId;
  generationVersion: number;
  generationSeed: number;
  profileId: string;
  subareaIds: string[];
  connectionIds: string[];
  discoveredSubareaIds: string[];
  faunaSeeded?: boolean;
  predatorsSeeded?: boolean;
  humanPressure: number;
  huntingPressure: number;
  fishingPressure: number;
  loggingPressure: number;
  biodiversityIndex: number;
  productivity: number;
  lastEcologyTickGameMinute: number;
}

export interface WorldEcologyState {
  version: number;
  regionsByPoiId: Partial<Record<MainWorldAreaId, RegionEcology>>;
  subareasById: Record<string, EcologicalSubarea>;
  connections: EcologyConnection[];
  plantPopulations: WildPlantPopulation[];
  significantPlants: SignificantWildPlant[];
  animalPopulations?: WildAnimalPopulation[];
  significantAnimals?: SignificantWildAnimal[];
  predatorPopulations?: WildPredatorPopulation[];
  significantPredators?: SignificantWildPredator[];
  wildCarcasses?: WildCarcass[];
  ecologyTickIndex: number;
}

declare module './index' {
  interface GameState {
    ecologySystem?: WorldEcologyState;
  }
}

export {};