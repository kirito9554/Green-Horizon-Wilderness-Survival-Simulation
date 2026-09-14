import type { MaterialReservation } from './craftingSimulation';

export type MaintenanceMode = 'maintenance' | 'repair' | 'replace' | 'quick_patch';
export type MaintenanceJobStatus = 'waiting_materials' | 'waiting_worker' | 'pending' | 'in_progress' | 'paused';

export interface MaintenanceJob {
  id: string;
  targetInstanceId: string;
  targetItemId: string;
  targetComponentInstanceId?: string;
  mode: MaintenanceMode;
  assignedSurvivorId?: string;
  progressSeconds: number;
  totalSeconds: number;
  status: MaintenanceJobStatus;
  createdAt: number;
  materialReservations: MaterialReservation[];
  materialsConsumed: boolean;
  blockedReasons: string[];
  deterministicSeed: number;
}

export interface MaintenanceHistoryRecord {
  id: string;
  targetItemId: string;
  targetInstanceId: string;
  componentName?: string;
  mode: MaintenanceMode;
  restoredCondition: number;
  permanentConditionMaxLoss: number;
  survivorId?: string;
  gameMinute: number;
}

export interface MaintenanceSystemState {
  queue: MaintenanceJob[];
  history: MaintenanceHistoryRecord[];
}

declare module './index' {
  interface GameState {
    maintenanceSystem?: MaintenanceSystemState;
  }
}

export {};
