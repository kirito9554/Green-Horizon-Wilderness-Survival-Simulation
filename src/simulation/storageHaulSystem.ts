import type { GameState, InventoryItem, StorageInventory, SurvivorState } from '../types';
import type { MaterialReservation } from '../types/craftingSimulation';
import type { StorageHaulJob, StorageLocation, StoragePriority } from '../types/storageSimulation';
import '../types/storageSimulation';
import { ITEMS_DATABASE } from '../data/items';
import {
  getAvailableInventoryItemQuantity,
  getOrCreatePoiStorage,
  transferItemBetweenInventories,
} from './inventorySystem';
import { rebuildJobReservationCounters, releaseJobReservations, reserveJobMaterials } from './jobReservationSystem';
import {
  canStoreItemInLocation,
  ensureStorageSystem,
  getStorageLocationItems,
} from './storageSystem';
import { calculateStorageRoute } from './storageRouteSystem';
import { formatTimeOfDay } from './timeSystem';

const PRIORITY_RANK: Record<StoragePriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setIdle(worker: SurvivorState): void {
  worker.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function releaseWorker(state: GameState, job: StorageHaulJob): void {
  if (!job.assignedSurvivorId) return;
  const worker = state.survivors.find(candidate => candidate.id === job.assignedSurvivorId);
  if (worker?.currentAction.type === 'hauling' && worker.currentAction.targetId === job.id) setIdle(worker);
  job.assignedSurvivorId = undefined;
}

function locationView(storage: StorageInventory, location: StorageLocation): StorageInventory {
  return {
    maxWeightKg: location.capacity.maxWeightKg,
    maxVolumeL: location.capacity.maxVolumeL,
    items: storage.items.filter(item => item.storageLocationId === location.id),
  };
}

function replaceLocationView(storage: StorageInventory, locationId: string, locationItems: InventoryItem[]): void {
  const others = storage.items.filter(item => item.storageLocationId !== locationId);
  for (const item of locationItems) item.storageLocationId = locationId;
  storage.items = [...others, ...locationItems];
}

function replaceTwoLocationViews(
  storage: StorageInventory,
  sourceId: string,
  sourceItems: InventoryItem[],
  targetId: string,
  targetItems: InventoryItem[],
): void {
  const others = storage.items.filter(item => item.storageLocationId !== sourceId && item.storageLocationId !== targetId);
  for (const item of sourceItems) item.storageLocationId = sourceId;
  for (const item of targetItems) item.storageLocationId = targetId;
  storage.items = [...others, ...sourceItems, ...targetItems];
}

function sourcePoiId(job: StorageHaulJob): string {
  return job.sourcePoiId || job.poiId;
}

function representativeReservedItem(state: GameState, job: StorageHaulJob): InventoryItem | undefined {
  const first = job.materialReservations[0];
  const poiId = first?.source.areaId || sourcePoiId(job);
  const storage = poiId ? state.poiStorages?.[poiId] : undefined;
  return first ? storage?.items.find(item => item.instanceId === first.instanceId) : undefined;
}

function totalReserved(job: StorageHaulJob): number {
  return job.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0);
}

/**
 * Destination capacity must be checked against cargo already owned by this haul,
 * not against the source stack's currently-unreserved quantity. Otherwise a haul
 * that reserved an entire stack would block itself at completion.
 */
function reservedCargoProbe(item: InventoryItem, quantity: number): InventoryItem {
  const perUnitLiquid = item.liquidLiters !== undefined && item.quantity > 0
    ? item.liquidLiters / item.quantity
    : undefined;
  return {
    ...item,
    quantity,
    reservedQuantity: 0,
    reservedQualityBreakdown: { crude: 0, standard: 0, prime: 0, masterwork: 0 },
    liquidLiters: perUnitLiquid === undefined ? undefined : perUnitLiquid * quantity,
  };
}

function activeJobForTarget(state: GameState, targetLocationId: string): boolean {
  return Boolean(state.storageSystem?.haulJobs.some(job =>
    job.targetLocationId === targetLocationId && job.status !== 'completed'
  ));
}

function sourceCandidates(state: GameState, target: StorageLocation): Array<{ location: StorageLocation; item: InventoryItem }> {
  const system = ensureStorageSystem(state);
  const sources = system.locations.filter(location => location.id !== target.id);
  const result: Array<{ location: StorageLocation; item: InventoryItem }> = [];
  for (const source of sources) {
    for (const item of getStorageLocationItems(state, source.id)) {
      if (getAvailableInventoryItemQuantity(item) <= 0) continue;
      result.push({ location: source, item });
    }
  }
  return result;
}

function targetStockQuantity(state: GameState, targetId: string, itemId: string): number {
  return getStorageLocationItems(state, targetId)
    .filter(item => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function scoreCandidate(state: GameState, source: StorageLocation, target: StorageLocation, item: InventoryItem): number {
  const def = ITEMS_DATABASE[item.itemId];
  if (!def) return -Infinity;
  const rule = target.policy.stockRules.find(candidate => candidate.itemId === item.itemId);
  const current = targetStockQuantity(state, target.id, item.itemId);
  if (rule?.maxQuantity !== undefined && current >= rule.maxQuantity) return -Infinity;

  const acceptance = canStoreItemInLocation(state, target.id, item, Math.max(1, getAvailableInventoryItemQuantity(item)));
  if (!acceptance.accepted) return -Infinity;

  let score = PRIORITY_RANK[target.policy.priority] * 100;
  if (rule && current < rule.minQuantity) score += 500 + (rule.minQuantity - current) * 8;
  if (target.policy.preferredTags.some(tag => def.tags.includes(tag))) score += 80;
  if (target.policy.allowCategories.includes(def.category)) score += 35;
  if (item.freshness !== undefined && item.freshness < 35) score += target.environment.moistureProtection > 25 ? 30 : -30;

  const route = calculateStorageRoute(state, source, target);
  score += route.crossesPoi ? -Math.min(240, route.distanceM / 18) : 70 - Math.min(50, route.distanceM / 3);
  return score;
}

function calculateHaulSeconds(
  state: GameState,
  source: StorageLocation,
  target: StorageLocation,
  quantity: number,
  item: InventoryItem,
): { totalSeconds: number; route: StorageHaulJob['route'] } {
  const def = ITEMS_DATABASE[item.itemId];
  const mass = (def?.weight || 0.1) * quantity;
  const route = calculateStorageRoute(state, source, target);
  const metersPerSimulationSecond = route.crossesPoi ? 11 : 4.5;
  const travelSeconds = route.distanceM / metersPerSimulationSecond;
  const handlingSeconds = 3 + quantity * 0.6 + mass * 0.32;
  const totalSeconds = Math.max(4, Math.round((travelSeconds + handlingSeconds) * 10) / 10);
  return { totalSeconds, route };
}

export function queueStorageHaul(
  state: GameState,
  sourceLocationId: string,
  targetLocationId: string,
  itemId: string,
  requestedQuantity: number,
  assignedSurvivorId?: string,
): GameState {
  const next = clone(state);
  const system = ensureStorageSystem(next);
  const source = system.locations.find(location => location.id === sourceLocationId);
  const target = system.locations.find(location => location.id === targetLocationId);
  if (!source || !target || source.id === target.id) return state;
  if (activeJobForTarget(next, target.id)) return state;

  const candidate = getStorageLocationItems(next, source.id).find(item => item.itemId === itemId && getAvailableInventoryItemQuantity(item) > 0);
  if (!candidate) return state;
  const acceptance = canStoreItemInLocation(next, target.id, candidate, Math.max(1, requestedQuantity));
  if (!acceptance.accepted) return state;
  const quantity = Math.min(requestedQuantity, acceptance.maxAcceptableQuantity, getAvailableInventoryItemQuantity(candidate));
  if (quantity <= 0) return state;

  const jobId = `storage_haul_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reserved = reserveJobMaterials(
    next,
    'storage_haul',
    jobId,
    [{ itemId, quantity }],
    { kind: 'poi', areaId: source.poiId, storageLocationId: source.id },
  );
  if (reserved.missing.length > 0 || reserved.reservations.length === 0) return state;

  const timing = calculateHaulSeconds(next, source, target, quantity, candidate);
  const job: StorageHaulJob = {
    id: jobId,
    poiId: source.poiId,
    sourcePoiId: source.poiId,
    targetPoiId: target.poiId,
    sourceLocationId: source.id,
    targetLocationId: target.id,
    itemId,
    quantity: reserved.reservations.reduce((sum, reservation) => sum + reservation.quantity, 0),
    materialReservations: reserved.reservations,
    assignedSurvivorId,
    progressSeconds: 0,
    totalSeconds: timing.totalSeconds,
    route: timing.route,
    status: 'waiting_worker',
    blockedReasons: [],
    createdAtGameMinute: (next.gameTime.day - 1) * 1440 + next.gameTime.minuteOfDay,
  };
  system.haulJobs.push(job);
  return next;
}

export function cancelStorageHaul(state: GameState, jobId: string): GameState {
  const next = clone(state);
  const system = ensureStorageSystem(next);
  const index = system.haulJobs.findIndex(job => job.id === jobId);
  if (index < 0) return state;
  const job = system.haulJobs[index];
  if (job.status === 'completed') return state;
  releaseWorker(next, job);
  releaseJobReservations(next, job.materialReservations);
  system.haulJobs.splice(index, 1);
  return next;
}

export function togglePauseStorageHaul(state: GameState, jobId: string): GameState {
  const next = clone(state);
  const job = ensureStorageSystem(next).haulJobs.find(candidate => candidate.id === jobId);
  if (!job || job.status === 'completed') return state;
  if (job.status === 'paused') {
    job.status = 'waiting_worker';
    job.blockedReasons = [];
  } else {
    releaseWorker(next, job);
    job.status = 'paused';
    job.blockedReasons = ['Tạm dừng theo lệnh người chơi'];
  }
  return next;
}

function chooseWorker(state: GameState, preferredId?: string): SurvivorState | undefined {
  if (preferredId) {
    const preferred = state.survivors.find(worker => worker.id === preferredId && worker.currentAction.type === 'idle' && worker.jobPriorities.haul !== 'disabled');
    if (preferred) return preferred;
  }
  const rank = { highest: 4, high: 3, normal: 2, low: 1, disabled: 0 } as const;
  return state.survivors
    .filter(worker => worker.currentAction.type === 'idle' && worker.jobPriorities.haul !== 'disabled')
    .sort((a, b) => rank[b.jobPriorities.haul] - rank[a.jobPriorities.haul] || a.fatigue - b.fatigue)[0];
}

function assignWorker(job: StorageHaulJob, worker: SurvivorState): void {
  job.assignedSurvivorId = worker.id;
  job.status = 'in_progress';
  job.blockedReasons = [];
  worker.currentAction = {
    type: 'hauling',
    description: job.route?.crossesPoi ? 'Đang vận chuyển vật tư giữa các địa điểm' : 'Đang vận chuyển vật tư giữa các kho',
    targetId: job.id,
    progressSeconds: job.progressSeconds,
    totalSeconds: job.totalSeconds,
    resultPayload: {
      storageHaulJobId: job.id,
      sourceLocationId: job.sourceLocationId,
      targetLocationId: job.targetLocationId,
      sourcePoiId: job.sourcePoiId || job.poiId,
      targetPoiId: job.targetPoiId || job.poiId,
      distanceM: job.route?.distanceM || 0,
    },
  };
}

function transferReservation(
  state: GameState,
  job: StorageHaulJob,
  source: StorageLocation,
  target: StorageLocation,
  reservation: MaterialReservation,
): { success: boolean; message: string } {
  const sourceStorage = getOrCreatePoiStorage(state, source.poiId);
  const targetStorage = getOrCreatePoiStorage(state, target.poiId);
  const sourceView = locationView(sourceStorage, source);
  const targetView = locationView(targetStorage, target);
  const result = transferItemBetweenInventories(sourceView, targetView, reservation.instanceId, reservation.quantity);

  if (source.poiId === target.poiId) {
    replaceTwoLocationViews(sourceStorage, source.id, sourceView.items, target.id, targetView.items);
  } else {
    replaceLocationView(sourceStorage, source.id, sourceView.items);
    replaceLocationView(targetStorage, target.id, targetView.items);
  }
  return { success: result.success, message: result.message };
}

function applyHaulExertion(worker: SurvivorState, job: StorageHaulJob): void {
  const def = ITEMS_DATABASE[job.itemId];
  const mass = (def?.weight || 0.1) * job.quantity;
  const distance = job.route?.distanceM || 0;
  const effort = Math.min(9, distance / 650 + mass * 0.06);
  worker.fatigue = Math.min(100, worker.fatigue + effort);
  worker.thirst = Math.min(100, worker.thirst + Math.min(3.5, effort * 0.35));
  worker.hunger = Math.min(100, worker.hunger + Math.min(2.5, effort * 0.22));
}

function completeHaul(state: GameState, job: StorageHaulJob): boolean {
  const system = ensureStorageSystem(state);
  const source = system.locations.find(location => location.id === job.sourceLocationId);
  const target = system.locations.find(location => location.id === job.targetLocationId);
  const sample = representativeReservedItem(state, job);
  const quantity = totalReserved(job);
  if (!source || !target || !sample || quantity <= 0) return false;

  const acceptance = canStoreItemInLocation(state, target.id, reservedCargoProbe(sample, quantity), quantity);
  if (!acceptance.accepted || acceptance.maxAcceptableQuantity < quantity) {
    job.status = 'blocked';
    job.blockedReasons = [acceptance.reasons[0] || 'Kho đích không còn đủ dung tích'];
    releaseWorker(state, job);
    return false;
  }

  const reservations = [...job.materialReservations];
  releaseJobReservations(state, reservations);

  for (const reservation of reservations) {
    const result = transferReservation(state, job, source, target, reservation);
    if (!result.success) {
      const remaining = reservations.filter(entry => entry.id !== reservation.id);
      job.materialReservations = rebuildJobReservationCounters(state, remaining);
      job.quantity = totalReserved(job);
      job.status = 'blocked';
      job.blockedReasons = [result.message || 'Không thể hoàn tất vận chuyển'];
      releaseWorker(state, job);
      return false;
    }
  }

  const worker = job.assignedSurvivorId ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId) : undefined;
  if (worker) applyHaulExertion(worker, job);
  job.materialReservations = [];
  job.status = 'completed';
  job.progressSeconds = job.totalSeconds;
  releaseWorker(state, job);
  state.logs.unshift({
    id: `storage_haul_done_${Date.now()}_${job.id}`,
    day: state.gameTime.day,
    timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
    text: `[Storage] Đã vận chuyển ${job.quantity}x ${ITEMS_DATABASE[job.itemId]?.name || job.itemId} tới ${target.name}${job.route?.crossesPoi ? ` (${Math.round(job.route.distanceM)} m)` : ''}.`,
    type: 'success',
  });
  return true;
}

function chooseAutomaticCandidate(state: GameState, target: StorageLocation) {
  return sourceCandidates(state, target)
    .map(candidate => ({ ...candidate, score: scoreCandidate(state, candidate.location, target, candidate.item) }))
    .filter(candidate => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score)[0];
}

function maybeQueueAutomaticHaul(state: GameState): void {
  const system = ensureStorageSystem(state);
  const targets = [...system.locations]
    .filter(location => !location.isGroundCache && location.policy.autoHaul && !activeJobForTarget(state, location.id))
    .sort((a, b) => PRIORITY_RANK[b.policy.priority] - PRIORITY_RANK[a.policy.priority]);

  for (const target of targets) {
    const candidate = chooseAutomaticCandidate(state, target);
    if (!candidate) continue;
    const available = getAvailableInventoryItemQuantity(candidate.item);
    const rule = target.policy.stockRules.find(entry => entry.itemId === candidate.item.itemId);
    const current = targetStockQuantity(state, target.id, candidate.item.itemId);
    const desired = rule ? Math.max(0, rule.minQuantity - current) : Math.min(available, Math.max(1, Math.min(candidate.item.quantity, 6)));
    const quantity = Math.max(1, Math.min(available, desired || available));
    const next = queueStorageHaul(state, candidate.location.id, target.id, candidate.item.itemId, quantity);
    if (next !== state) {
      state.storageSystem = next.storageSystem;
      state.poiStorages = next.poiStorages;
    }
  }
}

/**
 * Manual network optimization respects each location's policy and stock rules.
 * It only creates persistent haul jobs; no item is teleported by this command.
 */
export function queueStorageOptimizationPass(state: GameState, poiId?: string): GameState {
  let next = clone(state);
  const system = ensureStorageSystem(next);
  const targets = [...system.locations]
    .filter(location =>
      !location.isGroundCache &&
      (!poiId || location.poiId === poiId) &&
      (location.policy.autoHaul || location.policy.stockRules.length > 0) &&
      !activeJobForTarget(next, location.id)
    )
    .sort((a, b) => PRIORITY_RANK[b.policy.priority] - PRIORITY_RANK[a.policy.priority]);

  let created = 0;
  for (const target of targets) {
    const candidate = chooseAutomaticCandidate(next, target);
    if (!candidate) continue;
    const available = getAvailableInventoryItemQuantity(candidate.item);
    const rule = target.policy.stockRules.find(entry => entry.itemId === candidate.item.itemId);
    const current = targetStockQuantity(next, target.id, candidate.item.itemId);
    const desired = rule ? Math.max(0, rule.minQuantity - current) : Math.min(available, 6);
    if (desired <= 0 && rule) continue;
    const queued = queueStorageHaul(next, candidate.location.id, target.id, candidate.item.itemId, Math.max(1, desired || Math.min(available, 6)));
    if (queued !== next) {
      next = queued;
      created += 1;
    }
  }

  next.logs.unshift({
    id: `storage_optimize_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: created > 0
      ? `[Storage] Đã lập ${created} lệnh vận chuyển để cân bằng mạng kho.`
      : '[Storage] Mạng kho hiện không có nhu cầu vận chuyển phù hợp policy.',
    type: created > 0 ? 'success' : 'info',
  });
  return next;
}

export function tickStorageHauling(state: GameState, deltaGameSeconds: number): void {
  const system = ensureStorageSystem(state);
  maybeQueueAutomaticHaul(state);

  for (const job of system.haulJobs) {
    if (job.status === 'completed' || job.status === 'paused') continue;
    const source = system.locations.find(location => location.id === job.sourceLocationId);
    const target = system.locations.find(location => location.id === job.targetLocationId);
    if (!source || !target) {
      job.status = 'blocked';
      job.blockedReasons = ['Nơi chứa nguồn hoặc đích không còn tồn tại'];
      releaseWorker(state, job);
      continue;
    }

    job.sourcePoiId ||= source.poiId;
    job.targetPoiId ||= target.poiId;
    job.poiId = job.sourcePoiId;
    job.route ||= calculateStorageRoute(state, source, target);

    if (job.status === 'blocked') {
      const sample = representativeReservedItem(state, job);
      const quantity = totalReserved(job);
      if (sample && quantity > 0 && canStoreItemInLocation(state, target.id, reservedCargoProbe(sample, quantity), quantity).accepted) {
        job.status = 'waiting_worker';
        job.blockedReasons = [];
      } else continue;
    }

    if (job.status === 'waiting_worker') {
      const worker = chooseWorker(state, job.assignedSurvivorId);
      if (!worker) {
        job.blockedReasons = ['Không có người vận chuyển đang rảnh'];
        continue;
      }
      assignWorker(job, worker);
    }

    if (job.status !== 'in_progress') continue;
    const worker = job.assignedSurvivorId ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId) : undefined;
    if (!worker) {
      job.status = 'waiting_worker';
      job.assignedSurvivorId = undefined;
      continue;
    }

    job.progressSeconds = Math.min(job.totalSeconds, job.progressSeconds + deltaGameSeconds);
    if (job.progressSeconds >= job.totalSeconds) {
      completeHaul(state, job);
      continue;
    }

    if (worker.currentAction.type === 'idle') assignWorker(job, worker);
    if (worker.currentAction.type === 'hauling' && worker.currentAction.targetId === job.id) {
      worker.currentAction.progressSeconds = job.progressSeconds;
      worker.currentAction.totalSeconds = job.totalSeconds;
    }
  }

  const completed = system.haulJobs.filter(job => job.status === 'completed').slice(-12);
  const active = system.haulJobs.filter(job => job.status !== 'completed');
  system.haulJobs = [...active, ...completed];
}
