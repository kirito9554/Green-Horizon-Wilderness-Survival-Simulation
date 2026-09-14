import type { GameState, SurvivorState } from '../types';
import '../types/buildingSimulation';
import { ensureBuildingSimulation } from './buildGridSystem';
import { completeSitePreparationJob } from './buildingClusterSystem';

const ACTION_SENTINEL_SECONDS = 1_000_000_000;

const PREP_LABELS = {
  clear_vegetation: 'Dọn thảm thực vật',
  remove_roots: 'Đào bỏ rễ cây',
  remove_rocks: 'Dọn đá',
  clear_debris: 'Dọn mảnh vụn',
  drain_ground: 'Thoát nước mặt bằng',
  level_ground: 'San nền',
  compact_ground: 'Đầm nền',
} as const;

function setIdle(worker: SurvivorState): void {
  worker.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

/**
 * Site preparation deliberately reuses the legacy `building` survivor action
 * so existing survivor/assignment UI needs no special case. The action gets a
 * very large sentinel duration; this runtime owns the real job duration and
 * completes/resets it before SurvivorSystem can mistake the preparation job for
 * a ConstructedBuilding id.
 */
export function tickBuildingPreparationRuntime(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);

  for (const job of simulation.preparationJobs) {
    if (job.status === 'completed') continue;

    if (job.status === 'in_progress') {
      const worker = job.assignedSurvivorId
        ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId)
        : undefined;
      const ownsJob = worker?.currentAction.type === 'building' &&
        worker.currentAction.resultPayload?.sitePreparationJobId === job.id;

      if (!worker || !ownsJob) {
        job.status = 'waiting_worker';
        job.assignedSurvivorId = undefined;
        continue;
      }

      job.progressSeconds = Math.min(job.totalSeconds, worker.currentAction.progressSeconds);
      if (job.progressSeconds >= job.totalSeconds) {
        completeSitePreparationJob(state, job.id, worker.id);
        setIdle(worker);
      }
      continue;
    }

    const preferred = job.assignedSurvivorId
      ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId && candidate.currentAction.type === 'idle')
      : undefined;
    const worker = preferred || state.survivors
      .filter(candidate => candidate.currentAction.type === 'idle' && candidate.jobPriorities.build !== 'disabled')
      .sort((a, b) => (b.skills.building || 0) - (a.skills.building || 0))[0];
    if (!worker) continue;

    job.status = 'in_progress';
    job.assignedSurvivorId = worker.id;
    worker.currentAction = {
      type: 'building',
      description: `${PREP_LABELS[job.type]}: ${simulation.clusters.find(cluster => cluster.id === job.clusterId)?.name || 'khu trại'}`,
      targetId: job.id,
      progressSeconds: job.progressSeconds,
      totalSeconds: ACTION_SENTINEL_SECONDS,
      resultPayload: {
        sitePreparationJobId: job.id,
        sitePreparationTotalSeconds: job.totalSeconds,
      },
    };
  }
}