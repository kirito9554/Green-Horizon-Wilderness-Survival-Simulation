import type { GameState, SurvivorState } from '../types';
import type { WorkstationKind } from '../types/craftingSimulation';
import type { MaintenanceJob } from '../types/maintenanceSimulation';
import type { UpgradeJob } from '../types/upgradeSimulation';
import {
  assignWorkstation,
  findAvailableWorkstationByKind,
  isAssignedWorkstationOperational,
  releaseWorkstation,
} from './workstationSystem';

function setIdle(survivor: SurvivorState): void {
  survivor.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function releaseOwnedWorker(state: GameState, jobId: string, survivorId?: string): void {
  if (!survivorId) return;
  const worker = state.survivors.find(candidate => candidate.id === survivorId);
  if (worker?.currentAction.type === 'crafting' && worker.currentAction.targetId === jobId) setIdle(worker);
}

function hasEligibleIdleWorker(state: GameState, assignedSurvivorId?: string): boolean {
  if (assignedSurvivorId) {
    const assigned = state.survivors.find(candidate => candidate.id === assignedSurvivorId);
    return assigned?.currentAction.type === 'idle';
  }
  return state.survivors.some(survivor =>
    survivor.currentAction.type === 'idle' && survivor.jobPriorities.craft !== 'disabled'
  );
}

function maintenanceStationKind(job: MaintenanceJob): WorkstationKind {
  return job.mode === 'repair' || job.mode === 'replace' ? 'workbench' : 'handcraft';
}

function upgradeStationKind(job: UpgradeJob): WorkstationKind {
  if (job.mode === 'tier') return 'workbench';
  return job.modification === 'sharpen' ? 'handcraft' : 'workbench';
}

type CoordinatedJob = MaintenanceJob | UpgradeJob;

function runningStationMatches(state: GameState, job: CoordinatedJob, requiredKind: WorkstationKind): boolean {
  if (requiredKind === 'handcraft') {
    return !job.assignedWorkstationId &&
      (job.assignedWorkstationKind === undefined || job.assignedWorkstationKind === 'handcraft');
  }
  return job.assignedWorkstationKind === requiredKind &&
    Boolean(job.assignedWorkstationId) &&
    isAssignedWorkstationOperational(state, job);
}

function prepareJobWorkstation(state: GameState, job: CoordinatedJob, requiredKind: WorkstationKind): void {
  if (job.status === 'paused' || job.status === 'waiting_materials') {
    releaseWorkstation(job);
    return;
  }

  if (job.status === 'in_progress') {
    if (runningStationMatches(state, job, requiredKind)) return;
    releaseOwnedWorker(state, job.id, job.assignedSurvivorId);
    releaseWorkstation(job);
    job.status = 'waiting_workstation';
    job.blockedReasons = [requiredKind === 'workbench'
      ? 'Assigned workbench is unavailable or damaged'
      : 'Work area is unavailable'];
    return;
  }

  if (!hasEligibleIdleWorker(state, job.assignedSurvivorId)) {
    releaseWorkstation(job);
    job.status = 'waiting_worker';
    job.blockedReasons = ['No eligible idle production worker'];
    return;
  }

  const result = findAvailableWorkstationByKind(state, requiredKind, job.id);
  if (!result.assignment) {
    releaseWorkstation(job);
    job.status = 'waiting_workstation';
    job.blockedReasons = [result.reason || `Requires ${requiredKind}`];
    return;
  }

  assignWorkstation(job, result.assignment);
  job.status = 'pending';
  job.blockedReasons = [];
}

/**
 * Heavy repair and part replacement are bench jobs. Field maintenance and quick
 * patches remain handcraft operations so the player can recover before a bench
 * exists, but they retain their weaker/permanent-damage trade-offs.
 */
export function prepareMaintenanceWorkstations(state: GameState): void {
  for (const job of state.maintenanceSystem?.queue || []) {
    prepareJobWorkstation(state, job, maintenanceStationKind(job));
  }
}

/**
 * Tier upgrades and structural component modifications require a real bench.
 * Sharpening is intentionally allowed as a field handcraft operation.
 */
export function prepareUpgradeWorkstations(state: GameState): void {
  for (const job of state.upgradeSystem?.queue || []) {
    prepareJobWorkstation(state, job, upgradeStationKind(job));
  }
}