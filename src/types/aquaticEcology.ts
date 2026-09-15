import type { MainWorldAreaId } from '../data/mainWorldAreas';

export type WildAquaticLifeStage = 'juvenile' | 'adult' | 'old';

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
  lastUpdatedGameMinute: number;
}

declare module './ecologySimulation' {
  interface RegionEcology {
    aquaticSeeded?: boolean;
  }

  interface WorldEcologyState {
    aquaticPopulations?: WildAquaticPopulation[];
  }
}

export {};
