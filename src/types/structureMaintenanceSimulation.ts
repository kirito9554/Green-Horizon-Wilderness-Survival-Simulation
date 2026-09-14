import type { ItemQuality } from './index';
import type { MaterialReservation } from './craftingSimulation';

export type StructureMaintenanceMode = 'patch' | 'repair' | 'replace';
export type StructureWorkJobKind = 'maintenance' | 'modification';
export type StructureWorkJobStatus =
  | 'waiting_materials'
  | 'waiting_worker'
  | 'in_progress'
  | 'paused'
  | 'completed';

export interface StructureWorkJob {
  id: string;
  kind: StructureWorkJobKind;
  buildingInstanceId: string;
  componentId?: string;
  maintenanceMode?: StructureMaintenanceMode;
  modificationId?: string;
  status: StructureWorkJobStatus;
  assignedSurvivorId?: string;
  progressSeconds: number;
  totalSeconds: number;
  materialsConsumed: boolean;
  consumedQualities: ItemQuality[];
  materialReservations: MaterialReservation[];
  blockedReasons: string[];
  createdAtGameMinute: number;
}

export interface StructureWorkHistoryRecord {
  id: string;
  jobKind: StructureWorkJobKind;
  buildingInstanceId: string;
  componentId?: string;
  maintenanceMode?: StructureMaintenanceMode;
  modificationId?: string;
  survivorId?: string;
  gameMinute: number;
  restoredCondition?: number;
  ceilingChange?: number;
}

declare module './buildingSimulation' {
  interface BuildingSimulationState {
    structureWorkJobs?: StructureWorkJob[];
    structureWorkHistory?: StructureWorkHistoryRecord[];
  }
}

export {};