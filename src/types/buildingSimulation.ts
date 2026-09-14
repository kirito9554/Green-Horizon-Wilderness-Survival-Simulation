import type { ItemQuality, StorageInventory } from './index';
import type { MaterialReservation } from './craftingSimulation';

export type BuildSoilType = 'sand' | 'loam' | 'clay' | 'rock' | 'mud' | 'gravel' | 'organic';
export type ClusterType = 'shelter' | 'storage' | 'cooking' | 'farming' | 'utility' | 'defense' | 'livestock' | 'research';
export type ClusterState = 'planned' | 'preparing' | 'active' | 'degraded';
export type SiteRating = 'excellent' | 'suitable' | 'preparation_required' | 'unsuitable';
export type SitePreparationType =
  | 'clear_vegetation'
  | 'remove_roots'
  | 'remove_rocks'
  | 'clear_debris'
  | 'drain_ground'
  | 'level_ground'
  | 'compact_ground';

export interface BuildCellResourceProfile {
  fertileSoil: number;
  stoneYield: number;
  timberYield: number;
  fiberYield: number;
  clayYield: number;
  waterAccess: number;
}

export interface BuildCell {
  id: string;
  row: number;
  column: number;
  areaM2: number;
  elevation: number;
  slope: number;
  soilType: BuildSoilType;
  bearingCapacity: number;
  drainage: number;
  moisture: number;
  floodRisk: number;
  vegetation: number;
  roots: number;
  rocks: number;
  debris: number;
  canopy: number;
  sunlight: number;
  windExposure: number;
  fireRisk: number;
  wildlifeTraffic: number;
  resources: BuildCellResourceProfile;
  cleared: number;
  leveled: number;
  drained: number;
  compacted: number;
  clusterId?: string;
  reservedAreaM2: number;
}

export interface PoiBuildGrid {
  poiId: string;
  generationVersion: number;
  seed: number;
  rows: number;
  columns: number;
  cellSizeM: number;
  cells: BuildCell[];
}

export interface SitePreparationRequirement {
  type: SitePreparationType;
  severity: number;
  estimatedSeconds: number;
}

export interface ClusterSiteCandidate {
  id: string;
  poiId: string;
  clusterType: ClusterType;
  cellIds: string[];
  usableAreaM2: number;
  score: number;
  rating: SiteRating;
  advantages: string[];
  warnings: string[];
  preparation: SitePreparationRequirement[];
}

export interface CampCluster {
  id: string;
  poiId: string;
  type: ClusterType;
  name: string;
  cellIds: string[];
  usableAreaM2: number;
  occupiedAreaM2: number;
  state: ClusterState;
  siteScore: number;
  createdAtGameMinute: number;
  maintenancePolicy: 'ignore' | 'critical' | 'normal' | 'preventive' | 'high';
}

export type SitePreparationJobStatus = 'waiting_worker' | 'in_progress' | 'completed';

export interface SitePreparationJob {
  id: string;
  clusterId: string;
  poiId: string;
  type: SitePreparationType;
  cellIds: string[];
  severity: number;
  progressSeconds: number;
  totalSeconds: number;
  status: SitePreparationJobStatus;
  assignedSurvivorId?: string;
  recovered: Array<{ itemId: string; quantity: number }>;
}

export interface StructurePlacementAllocation {
  cellId: string;
  areaM2: number;
}

export type ConstructionPhaseKind =
  | 'groundwork'
  | 'foundation'
  | 'frame'
  | 'binding'
  | 'surface'
  | 'cover'
  | 'installation'
  | 'finish';

export interface ConstructionMaterialRequirement {
  itemId: string;
  quantity: number;
}

export type ConstructionPhaseStatus = 'pending' | 'in_progress' | 'completed';

export interface StructureConstructionPhase {
  id: string;
  name: string;
  kind: ConstructionPhaseKind;
  requirements: ConstructionMaterialRequirement[];
  progressSeconds: number;
  totalSeconds: number;
  status: ConstructionPhaseStatus;
  materialsConsumed: boolean;
  consumedQualities: ItemQuality[];
  workmanshipScore?: number;
  requiredToolTags?: string[];
  weatherSensitive?: boolean;
}

export type StructureConstructionJobStatus =
  | 'waiting_materials'
  | 'waiting_hauling'
  | 'hauling'
  | 'waiting_worker'
  | 'waiting_tool'
  | 'waiting_weather'
  | 'in_progress'
  | 'paused'
  | 'completed';

export interface StructureConstructionJob {
  id: string;
  buildingInstanceId: string;
  buildingId: string;
  clusterId: string;
  poiId: string;
  status: StructureConstructionJobStatus;
  assignedSurvivorId?: string;
  createdAtGameMinute: number;
  materialReservations: MaterialReservation[];
  blockedReasons: string[];
  haulProgressSeconds: number;
  haulTotalSeconds: number;
  materialsDelivered: boolean;
  materialQualityByItemId: Record<string, ItemQuality[]>;
  phases: StructureConstructionPhase[];
  currentPhaseIndex: number;
}

export interface BuildingSimulationState {
  version: number;
  worldSeed: string;
  gridsByPoiId: Record<string, PoiBuildGrid>;
  clusters: CampCluster[];
  preparationJobs: SitePreparationJob[];
  constructionJobs?: StructureConstructionJob[];
}

export interface ClusterDerivedStats {
  usableAreaM2: number;
  occupiedAreaM2: number;
  freeAreaM2: number;
  structureCount: number;
  activeStructureCount: number;
  averageCondition: number;
  fireSafety: number;
  drainage: number;
  accessibility: number;
}

declare module './index' {
  interface ConstructedBuilding {
    clusterId?: string;
    placement?: StructurePlacementAllocation[];
    footprintAreaM2?: number;
    placementScore?: number;
    stagingInventory?: StorageInventory;
    constructionJobId?: string;
  }

  interface GameState {
    buildingSimulation?: BuildingSimulationState;
  }
}

export {};