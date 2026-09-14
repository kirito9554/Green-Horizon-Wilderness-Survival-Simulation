import type { GameState, ItemQuality, SurvivorState } from '../types';
import '../types/buildingSimulation';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { addItemToInventory } from './inventorySystem';
import { releaseJobReservations } from './jobReservationSystem';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from './buildGridSystem';
import { formatTimeOfDay } from './timeSystem';

const QUALITY_ORDER: ItemQuality[] = ['crude', 'standard', 'prime', 'masterwork'];

function setIdle(worker: SurvivorState): void {
  worker.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function releaseWorkerForJob(state: GameState, jobId: string, survivorId?: string): void {
  if (!survivorId) return;
  const worker = state.survivors.find(candidate => candidate.id === survivorId);
  if (worker?.currentAction.type === 'building' && worker.currentAction.resultPayload?.constructionJobId === jobId) {
    setIdle(worker);
  }
}

function returnStagingToPoi(state: GameState, building: GameState['buildings'][number]): void {
  if (!building.stagingInventory?.items.length) return;
  const poiId = building.areaId || 'AREA_CAMP_CLEARING';
  const storage = state.poiStorages?.[poiId];
  if (!storage) return;

  for (const item of building.stagingInventory.items) {
    if (item.quantity <= 0) continue;
    if (item.qualityBreakdown) {
      for (const quality of QUALITY_ORDER) {
        const quantity = Math.floor(item.qualityBreakdown[quality] || 0);
        if (quantity > 0) addItemToInventory(storage, item.itemId, quantity, quality);
      }
    } else {
      addItemToInventory(storage, item.itemId, item.quantity, item.quality || 'standard');
    }
  }
  building.stagingInventory.items = [];
}

function releaseFootprint(state: GameState, building: GameState['buildings'][number]): void {
  if (!building.clusterId || !building.placement?.length) return;
  const simulation = ensureBuildingSimulation(state);
  const cluster = simulation.clusters.find(candidate => candidate.id === building.clusterId);
  if (!cluster) return;
  const grid = getOrCreatePoiBuildGrid(state, cluster.poiId);

  for (const allocation of building.placement) {
    const cell = grid.cells.find(candidate => candidate.id === allocation.cellId);
    if (cell) cell.reservedAreaM2 = Math.max(0, cell.reservedAreaM2 - allocation.areaM2);
  }
  cluster.occupiedAreaM2 = Math.max(0, cluster.occupiedAreaM2 - (building.footprintAreaM2 || 0));
}

/**
 * Cancellation respects physical state:
 * - before hauling, exact source reservations are simply released;
 * - after hauling, only material still in staging is returned;
 * - materials already consumed by completed/in-progress phases are not refunded;
 * - the spatial footprint is released because the unfinished structure is
 *   considered dismantled/cleared by this command.
 */
export function cancelSpatialConstruction(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureBuildingSimulation(next);
  simulation.constructionJobs ||= [];
  const jobIndex = simulation.constructionJobs.findIndex(candidate => candidate.id === jobId);
  if (jobIndex < 0) return state;
  const job = simulation.constructionJobs[jobIndex];
  if (job.status === 'completed') return state;

  const buildingIndex = next.buildings.findIndex(candidate => candidate.id === job.buildingInstanceId);
  const building = buildingIndex >= 0 ? next.buildings[buildingIndex] : undefined;
  releaseWorkerForJob(next, job.id, job.assignedSurvivorId);

  if (!job.materialsDelivered) {
    releaseJobReservations(next, job.materialReservations || []);
  } else if (building) {
    returnStagingToPoi(next, building);
  }

  if (building) {
    releaseFootprint(next, building);
    next.buildings.splice(buildingIndex, 1);
  }
  simulation.constructionJobs.splice(jobIndex, 1);

  next.logs.unshift({
    id: `construction_cancel_${Date.now()}_${job.id}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `Đã hủy ${BUILDINGS_DATABASE[job.buildingId]?.name || job.buildingId}. Vật liệu chưa sử dụng được thu hồi; phần đã thi công không được hoàn lại.`,
    type: 'warning',
  });
  return next;
}

export function togglePauseSpatialConstruction(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureBuildingSimulation(next);
  const job = simulation.constructionJobs?.find(candidate => candidate.id === jobId);
  if (!job || job.status === 'completed') return state;

  if (job.status === 'paused') {
    job.status = !job.materialsDelivered
      ? job.materialReservations.length ? 'waiting_hauling' : 'waiting_materials'
      : 'waiting_worker';
    job.blockedReasons = [];
    return next;
  }

  releaseWorkerForJob(next, job.id, job.assignedSurvivorId);
  job.assignedSurvivorId = undefined;
  job.status = 'paused';
  job.blockedReasons = ['Tạm dừng theo lệnh người chơi'];
  return next;
}
