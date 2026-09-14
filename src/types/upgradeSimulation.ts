import type { ItemQuality } from './index';
import type { MaterialReservation, ToolComponentSlot } from './craftingSimulation';

export type UpgradeMode = 'tier' | 'component';
export type ComponentModification = 'sharpen' | 'reinforce' | 'rebalance' | 'weatherproof';
export type UpgradeJobStatus = 'waiting_materials' | 'waiting_worker' | 'pending' | 'in_progress' | 'paused';

export interface UpgradeJob {
  id: string;
  targetInstanceId: string;
  sourceItemId: string;
  mode: UpgradeMode;
  targetRecipeId?: string;
  targetItemId?: string;
  targetComponentInstanceId?: string;
  targetComponentSlot?: ToolComponentSlot;
  modification?: ComponentModification;
  assignedSurvivorId?: string;
  progressSeconds: number;
  totalSeconds: number;
  status: UpgradeJobStatus;
  createdAt: number;
  materialReservations: MaterialReservation[];
  materialsConsumed: boolean;
  consumedMaterialQualities?: ItemQuality[];
  blockedReasons: string[];
  deterministicSeed: number;
}

export interface UpgradeHistoryRecord {
  id: string;
  targetInstanceId: string;
  fromItemId: string;
  toItemId: string;
  mode: UpgradeMode;
  modification?: ComponentModification;
  componentName?: string;
  survivorId?: string;
  gameMinute: number;
}

export interface UpgradeSystemState {
  queue: UpgradeJob[];
  history: UpgradeHistoryRecord[];
}

export interface DerivedToolStats {
  durability: number;
  conditionPct: number;
  cuttingPower: number;
  efficiency: number;
  handling: number;
  reachM: number;
  reliability: number;
}

declare module './index' {
  interface InventoryItem {
    modifications?: string[];
  }

  interface GameState {
    upgradeSystem?: UpgradeSystemState;
  }
}

export {};
