import type { MainWorldAreaId } from '../data/mainWorldAreas';

export type EcologySubareaKind = 'physical' | 'ecological' | 'ephemeral';
export type EcologyMaterializationState = 'latent' | 'materialized';

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

export interface RegionEcology {
  poiId: MainWorldAreaId;
  generationVersion: number;
  generationSeed: number;
  profileId: string;
  subareaIds: string[];
  connectionIds: string[];
  discoveredSubareaIds: string[];
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
  ecologyTickIndex: number;
}

declare module './index' {
  interface GameState {
    ecologySystem?: WorldEcologyState;
  }
}

export {};
