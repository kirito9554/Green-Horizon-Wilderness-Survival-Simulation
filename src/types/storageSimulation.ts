import type { ItemQuality } from './index';
import type { MaterialReservation } from './craftingSimulation';

export type StorageKind = 'ground_cache' | 'container' | 'rack' | 'bulk' | 'liquid' | 'structure';
export type StoragePriority = 'low' | 'normal' | 'high' | 'critical';
export type StorageForm = 'loose' | 'stackable' | 'bundle' | 'long' | 'liquid' | 'fragile' | 'bulk';

export interface StorageCapacity {
  maxWeightKg: number;
  maxVolumeL: number;
  maxItemLengthCm?: number;
  liquidCapacityL?: number;
}

export interface StorageEnvironmentProfile {
  moistureProtection: number;
  rainProtection: number;
  pestProtection: number;
  ventilation: number;
  temperatureBuffer: number;
  contaminationProtection: number;
  fireProtection: number;
  accessibility: number;
}

export interface StorageStockRule {
  itemId: string;
  minQuantity: number;
  maxQuantity?: number;
}

export interface StoragePolicy {
  priority: StoragePriority;
  autoHaul: boolean;
  allowCategories: string[];
  preferredTags: string[];
  forbiddenTags: string[];
  acceptDamaged: boolean;
  acceptSpoiled: boolean;
  stockRules: StorageStockRule[];
}

export interface StorageLocation {
  id: string;
  poiId: string;
  name: string;
  typeId: string;
  kind: StorageKind;
  buildingInstanceId?: string;
  parentStructureId?: string;
  isGroundCache?: boolean;
  capacity: StorageCapacity;
  environment: StorageEnvironmentProfile;
  policy: StoragePolicy;
  condition: number;
}

export interface StorageAlert {
  id: string;
  locationId: string;
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

export interface StorageRouteMetrics {
  distanceM: number;
  pathFactor: number;
  terrainPenalty: number;
  sourceAccessibility: number;
  targetAccessibility: number;
  crossesPoi: boolean;
}

export type StorageHaulJobStatus = 'waiting_worker' | 'in_progress' | 'blocked' | 'paused' | 'completed';

export interface StorageHaulJob {
  id: string;
  /** Legacy/source POI field retained for old saves. */
  poiId: string;
  sourcePoiId?: string;
  targetPoiId?: string;
  sourceLocationId: string;
  targetLocationId: string;
  itemId: string;
  quantity: number;
  materialReservations: MaterialReservation[];
  assignedSurvivorId?: string;
  progressSeconds: number;
  totalSeconds: number;
  route?: StorageRouteMetrics;
  status: StorageHaulJobStatus;
  blockedReasons: string[];
  createdAtGameMinute: number;
}

export interface StorageSystemState {
  version: number;
  locations: StorageLocation[];
  alerts: StorageAlert[];
  haulJobs: StorageHaulJob[];
}

export interface StorageAcceptanceResult {
  accepted: boolean;
  maxAcceptableQuantity: number;
  reasons: string[];
  remainingWeightKg: number;
  remainingVolumeL: number;
  remainingLiquidL?: number;
}

export interface StorageLocationSummary {
  location: StorageLocation;
  usedWeightKg: number;
  usedVolumeL: number;
  usedLiquidL: number;
  usedPercent: number;
  itemStacks: number;
  availableUnits: number;
  reservedUnits: number;
  isFull: boolean;
}

export interface StorageNetworkSummary {
  poiId?: string;
  locationCount: number;
  protectedLocationCount: number;
  totalWeightCapacityKg: number;
  usedWeightKg: number;
  totalVolumeCapacityL: number;
  usedVolumeL: number;
  totalLiquidCapacityL: number;
  usedLiquidL: number;
  groundCacheUnits: number;
  protectedUnits: number;
  reservedUnits: number;
  activeHauls: number;
  blockedHauls: number;
  alertCount: number;
  averagePreservationScore: number;
}

export interface StorageItemEnvironmentState {
  moisture: number;
  contamination: number;
  pestDamage: number;
  mold: number;
  corrosion: number;
  medicinePotency: number;
  lastStorageQuality?: ItemQuality;
}

declare module './index' {
  interface InventoryItem {
    storageLocationId?: string;
    moisture?: number;
    contamination?: number;
    pestDamage?: number;
    mold?: number;
    corrosion?: number;
    medicinePotency?: number;
    /** Physical liquid carried by this stack. Defaults to quantity * item volume. */
    liquidLiters?: number;
  }

  interface GameState {
    storageSystem?: StorageSystemState;
  }
}

export {};