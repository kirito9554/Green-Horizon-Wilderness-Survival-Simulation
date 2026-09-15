import type { MainWorldAreaId } from '../data/mainWorldAreas';

export type WildAquaticLifeStage = 'juvenile' | 'adult' | 'old';

export type AquaticFoodResource =
  | 'phytoplankton'
  | 'periphyton'
  | 'aquatic_vegetation'
  | 'zooplankton'
  | 'benthic_invertebrates'
  | 'detritus'
  | 'carrion';

export interface AquaticFoodWebNodeState {
  nodeId: string;
  poiId: MainWorldAreaId;
  phytoplanktonKg: number;
  periphytonKg: number;
  aquaticVegetationKg: number;
  zooplanktonKg: number;
  benthicInvertebratesKg: number;
  detritusKg: number;
  carrionKg: number;
  productivity: number;
  lastUpdatedGameMinute: number;
}

export interface WildAquaticPopulation {
  id: string;
  speciesId: string;
  currentWaterBodyId: string;
  anchorNodeId: string;
  occupiedNodeIds: string[];
  poiIds: MainWorldAreaId[];
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  biomassKg: number;
  averageHealth: number;
  bodyCondition: number;
  habitatStress: number;
  oxygenStress: number;
  foodStress: number;
  reproductionPressure: number;
  migrationPressure: number;
  geneticDiversity: number;
  reproductionProgress: number;
  maturationProgress: number;
  agingProgress: number;
  mortalityProgress: number;
  lastFoodDemandKg?: number;
  lastFoodIntakeKg?: number;
  lastUpdatedGameMinute: number;
}

declare module './ecologySimulation' {
  interface RegionEcology {
    aquaticSeeded?: boolean;
  }

  interface WorldEcologyState {
    aquaticPopulations?: WildAquaticPopulation[];
    aquaticFoodWebByNodeId?: Record<string, AquaticFoodWebNodeState>;
    aquaticFoodWebTickIndex?: number;
  }
}

export {};
