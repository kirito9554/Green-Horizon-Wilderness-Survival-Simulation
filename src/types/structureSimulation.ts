import type { ItemQuality } from './index';
import type { ConstructionPhaseKind } from './buildingSimulation';

export type StructureComponentKind =
  | 'ground'
  | 'foundation'
  | 'posts'
  | 'frame'
  | 'bindings'
  | 'surface'
  | 'roof'
  | 'fixture'
  | 'drainage'
  | 'hearth'
  | 'other';

export interface StructureComponentInstance {
  id: string;
  kind: StructureComponentKind;
  name: string;
  sourcePhaseKind: ConstructionPhaseKind;
  materialItemIds: string[];
  materialQualities: ItemQuality[];
  workmanship: number;
  condition: number;
  conditionMax: number;
  originalConditionMax: number;
  moisture: number;
  rot: number;
  fireDamage: number;
  permanentDamage: number;
}

export interface StructureModificationRecord {
  id: string;
  modificationId: string;
  appliedAtGameMinute: number;
  workmanship: number;
}

export interface StructureDerivedPerformance {
  structuralIntegrity: number;
  weatherProtection: number;
  fireSafety: number;
  functionality: number;
  cleanliness: number;
}

declare module './index' {
  interface ConstructedBuilding {
    structureComponents?: StructureComponentInstance[];
    structureModifications?: StructureModificationRecord[];
    structurePerformance?: StructureDerivedPerformance;
  }
}

export {};