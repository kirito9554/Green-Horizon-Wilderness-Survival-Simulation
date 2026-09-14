import type { GameState, ItemQuality, SurvivorState } from '../types';
import type { MaterialReservation, MaterialReservationOwnerType, MaterialReservationSource } from '../types/craftingSimulation';
import type { StructureComponentInstance } from '../types/structureSimulation';
import type {
  StructureMaintenanceMode,
  StructureWorkHistoryRecord,
  StructureWorkJob,
} from '../types/structureMaintenanceSimulation';
import '../types/buildingSimulation';
import '../types/structureSimulation';
import '../types/structureMaintenanceSimulation';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { ITEMS_DATABASE } from '../data/items';
import {
  STRUCTURE_MODIFICATIONS,
  getAvailableStructureModifications,
} from '../data/structureModifications';
import { getAvailableInventoryStock } from './inventorySystem';
import {
  consumeJobReservations,
  releaseJobReservations,
  reserveJobMaterials,
} from './jobReservationSystem';
import { ensureBuildingSimulation } from './buildGridSystem';
import { syncStructureAggregateState } from './structureComponentSystem';
import { formatTimeOfDay } from './timeSystem';

const ACTION_SENTINEL_SECONDS = 1_000_000_000;
const QUALITY_SCORE: Record<ItemQuality, number> = {
  crude: 42,
  standard: 65,
  prime: 82,
  masterwork: 95,
};

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function setIdle(worker: SurvivorState): void {
  worker.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function ensureStructureWorkState(state: GameState) {
  const simulation = ensureBuildingSimulation(state);
  simulation.structureWorkJobs ||= [];
  simulation.structureWorkHistory ||= [];
  return simulation;
}

function fallbackMaterialForComponent(component: StructureComponentInstance): string {
  if (component.materialItemIds[0]) return component.materialItemIds[0];
  if (component.kind === 'bindings') return 'ITEM_VINE_FIBER';
  if (component.kind === 'roof') return 'ITEM_PALM_LEAF';
  if (component.kind === 'foundation' || component.kind === 'ground' || component.kind === 'drainage' || component.kind === 'hearth') return 'ITEM_RIVER_PEBBLE';
  return 'ITEM_DRIFTWOOD_BRANCH';
}

function maintenanceRequirements(component: StructureComponentInstance, mode: StructureMaintenanceMode) {
  const materialId = fallbackMaterialForComponent(component);
  const damageRatio = component.conditionMax > 0
    ? Math.max(0, 1 - component.condition / component.conditionMax)
    : 1;
  const quantity = mode === 'patch'
    ? 1
    : mode === 'repair'
      ? Math.max(1, Math.min(3, Math.ceil(damageRatio * 3)))
      : Math.max(2, Math.min(4, Math.ceil(component.originalConditionMax / 45)));
  return [{ itemId: materialId, quantity }];
}

function resolveSource(state: GameState, source: MaterialReservationSource) {
  if (source.kind === 'party') return state.inventory;
  return source.areaId ? state.poiStorages?.[source.areaId] : undefined;
}

function reserveAcrossCamp(
  state: GameState,
  ownerType: MaterialReservationOwnerType,
  ownerId: string,
  poiId: string,
  requirements: Array<{ itemId: string; quantity: number }>,
): { reservations: MaterialReservation[]; missing: Array<{ itemId: string; quantity: number }> } {
  const created: MaterialReservation[] = [];
  const sources: MaterialReservationSource[] = [{ kind: 'poi', areaId: poiId }, { kind: 'party' }];

  for (const requirement of requirements) {
    let remaining = requirement.quantity;
    for (const source of sources) {
      if (remaining <= 0) break;
      const inventory = resolveSource(state, source);
      if (!inventory) continue;
      const take = Math.min(remaining, getAvailableInventoryStock(inventory, requirement.itemId));
      if (take <= 0) continue;
      const result = reserveJobMaterials(state, ownerType, ownerId, [{ itemId: requirement.itemId, quantity: take }], source);
      if (result.reservations.length) {
        created.push(...result.reservations);
        remaining -= take;
      }
    }
    if (remaining > 0) {
      releaseJobReservations(state, created);
      return { reservations: [], missing: [{ itemId: requirement.itemId, quantity: remaining }] };
    }
  }
  return { reservations: created, missing: [] };
}

function averageQuality(qualities: ItemQuality[]): number {
  if (!qualities.length) return 65;
  return qualities.reduce((sum, quality) => sum + QUALITY_SCORE[quality], 0) / qualities.length;
}

function effectiveWorkmanship(worker: SurvivorState, qualities: ItemQuality[]): number {
  const skill = Math.min(100, 38 + (worker.skills.building || 1) * 10);
  const fatigue = worker.fatigue > 75 ? 16 : worker.fatigue > 55 ? 8 : 0;
  const needs = worker.hunger > 75 || worker.thirst > 70 ? 8 : 0;
  const morale = worker.morale > 75 ? 5 : worker.morale < 30 ? -6 : 0;
  return Math.max(20, Math.min(100, Math.round(skill * 0.62 + averageQuality(qualities) * 0.38 - fatigue - needs + morale)));
}

function activeWorkExists(state: GameState, buildingId: string, componentId?: string): boolean {
  const jobs = state.buildingSimulation?.structureWorkJobs || [];
  return jobs.some(job =>
    job.status !== 'completed' &&
    job.buildingInstanceId === buildingId &&
    (!componentId || !job.componentId || job.componentId === componentId)
  );
}

function missingLabels(items: Array<{ itemId: string; quantity: number }>): string[] {
  return items.map(item => `Thiếu ${ITEMS_DATABASE[item.itemId]?.name || item.itemId} x${item.quantity}`);
}

export function queueStructureMaintenance(
  state: GameState,
  buildingInstanceId: string,
  componentId: string,
  mode: StructureMaintenanceMode,
  survivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureStructureWorkState(next);
  const building = next.buildings.find(candidate => candidate.id === buildingInstanceId && candidate.isBuilt);
  const component = building?.structureComponents?.find(candidate => candidate.id === componentId);
  if (!building || !component || activeWorkExists(next, buildingInstanceId, componentId)) return state;
  if (component.condition >= component.conditionMax && component.permanentDamage <= 0 && mode !== 'replace') return state;

  const id = `structure_work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const requirements = maintenanceRequirements(component, mode);
  const reservation = reserveAcrossCamp(next, 'structure_maintenance', id, building.areaId || 'AREA_CAMP_CLEARING', requirements);
  const damageRatio = component.conditionMax > 0 ? Math.max(0, 1 - component.condition / component.conditionMax) : 1;
  const totalSeconds = mode === 'patch'
    ? 8 + damageRatio * 8
    : mode === 'repair'
      ? 14 + damageRatio * 18
      : 24 + component.originalConditionMax / 12;

  simulation.structureWorkJobs!.push({
    id,
    kind: 'maintenance',
    buildingInstanceId,
    componentId,
    maintenanceMode: mode,
    status: reservation.missing.length ? 'waiting_materials' : 'waiting_worker',
    assignedSurvivorId: survivorId,
    progressSeconds: 0,
    totalSeconds: Math.round(totalSeconds * 10) / 10,
    materialsConsumed: false,
    consumedQualities: [],
    materialReservations: reservation.reservations,
    blockedReasons: missingLabels(reservation.missing),
    createdAtGameMinute: gameMinute(next),
  });
  return next;
}

export function queueStructureModification(
  state: GameState,
  buildingInstanceId: string,
  modificationId: string,
  survivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureStructureWorkState(next);
  const building = next.buildings.find(candidate => candidate.id === buildingInstanceId && candidate.isBuilt);
  const buildingDefinition = building ? BUILDINGS_DATABASE[building.buildingId] : undefined;
  const modification = STRUCTURE_MODIFICATIONS[modificationId];
  if (!building || !buildingDefinition || !modification || activeWorkExists(next, buildingInstanceId)) return state;
  if (building.structureModifications?.some(record => record.modificationId === modificationId)) return state;
  if (!getAvailableStructureModifications(building.buildingId, buildingDefinition.category).some(candidate => candidate.id === modificationId)) return state;

  const id = `structure_mod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reservation = reserveAcrossCamp(next, 'structure_modify', id, building.areaId || 'AREA_CAMP_CLEARING', modification.cost);
  simulation.structureWorkJobs!.push({
    id,
    kind: 'modification',
    buildingInstanceId,
    modificationId,
    status: reservation.missing.length ? 'waiting_materials' : 'waiting_worker',
    assignedSurvivorId: survivorId,
    progressSeconds: 0,
    totalSeconds: modification.durationSeconds,
    materialsConsumed: false,
    consumedQualities: [],
    materialReservations: reservation.reservations,
    blockedReasons: missingLabels(reservation.missing),
    createdAtGameMinute: gameMinute(next),
  });
  return next;
}

export function cancelStructureWorkJob(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureStructureWorkState(next);
  const index = simulation.structureWorkJobs!.findIndex(job => job.id === jobId);
  if (index < 0) return state;
  const job = simulation.structureWorkJobs![index];

  if (!job.materialsConsumed) releaseJobReservations(next, job.materialReservations);
  if (job.assignedSurvivorId) {
    const worker = next.survivors.find(candidate => candidate.id === job.assignedSurvivorId);
    if (worker?.currentAction.type === 'building' && worker.currentAction.resultPayload?.structureWorkJobId === job.id) setIdle(worker);
  }
  simulation.structureWorkJobs!.splice(index, 1);
  return next;
}

export function togglePauseStructureWorkJob(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const job = ensureStructureWorkState(next).structureWorkJobs!.find(candidate => candidate.id === jobId);
  if (!job) return state;
  if (job.status === 'in_progress') {
    if (job.assignedSurvivorId) {
      const worker = next.survivors.find(candidate => candidate.id === job.assignedSurvivorId);
      if (worker?.currentAction.type === 'building' && worker.currentAction.resultPayload?.structureWorkJobId === job.id) setIdle(worker);
    }
    job.assignedSurvivorId = undefined;
    job.status = 'paused';
  } else if (job.status === 'paused') {
    job.status = job.materialsConsumed || job.materialReservations.length ? 'waiting_worker' : 'waiting_materials';
  }
  return next;
}

function retryReservation(state: GameState, job: StructureWorkJob): void {
  if (job.materialsConsumed || job.materialReservations.length) return;
  const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
  if (!building) return;

  let requirements: Array<{ itemId: string; quantity: number }> = [];
  let ownerType: MaterialReservationOwnerType = 'structure_maintenance';
  if (job.kind === 'maintenance') {
    const component = building.structureComponents?.find(candidate => candidate.id === job.componentId);
    if (!component || !job.maintenanceMode) return;
    requirements = maintenanceRequirements(component, job.maintenanceMode);
  } else {
    const modification = job.modificationId ? STRUCTURE_MODIFICATIONS[job.modificationId] : undefined;
    if (!modification) return;
    ownerType = 'structure_modify';
    requirements = modification.cost;
  }

  const result = reserveAcrossCamp(state, ownerType, job.id, building.areaId || 'AREA_CAMP_CLEARING', requirements);
  if (result.missing.length) {
    job.status = 'waiting_materials';
    job.blockedReasons = missingLabels(result.missing);
  } else {
    job.materialReservations = result.reservations;
    job.status = 'waiting_worker';
    job.blockedReasons = [];
  }
}

function applyMaintenance(
  component: StructureComponentInstance,
  mode: StructureMaintenanceMode,
  qualities: ItemQuality[],
): { restored: number; ceilingChange: number } {
  const before = component.condition;
  const beforeCeiling = component.conditionMax;
  const quality = averageQuality(qualities) / 65;

  if (mode === 'patch') {
    const ceilingLoss = component.originalConditionMax * 0.025;
    component.conditionMax = Math.max(component.originalConditionMax * 0.55, component.conditionMax - ceilingLoss);
    component.permanentDamage = Math.max(0, component.originalConditionMax - component.conditionMax);
    component.condition = Math.min(component.conditionMax, component.condition + component.originalConditionMax * 0.24 * quality);
    component.moisture = Math.max(0, component.moisture - 8);
  } else if (mode === 'repair') {
    component.condition = Math.min(component.conditionMax, component.condition + component.conditionMax * 0.55 * quality);
    component.moisture = Math.max(0, component.moisture - 18);
    component.rot = Math.max(0, component.rot - 5 * quality);
    component.fireDamage = Math.max(0, component.fireDamage - 4 * quality);
  } else {
    const materialScale = Math.max(0.85, Math.min(1.18, quality));
    component.conditionMax = Math.round(component.originalConditionMax * materialScale * 10) / 10;
    component.originalConditionMax = component.conditionMax;
    component.condition = component.conditionMax;
    component.permanentDamage = 0;
    component.rot = 0;
    component.fireDamage = 0;
    component.moisture = Math.min(component.moisture, 25);
    if (qualities.length) component.materialQualities = [...qualities];
  }

  return {
    restored: Math.max(0, component.condition - before),
    ceilingChange: component.conditionMax - beforeCeiling,
  };
}

function newModificationComponent(
  buildingId: string,
  modificationId: string,
  kind: StructureComponentInstance['kind'],
  name: string,
  workmanship: number,
  qualities: ItemQuality[],
): StructureComponentInstance {
  const material = averageQuality(qualities);
  const max = Math.max(45, Math.round(55 + workmanship * 0.35 + material * 0.18));
  return {
    id: `${buildingId}_${modificationId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    name,
    sourcePhaseKind: kind === 'drainage' ? 'groundwork' : kind === 'surface' ? 'surface' : 'installation',
    materialItemIds: [],
    materialQualities: [...qualities],
    workmanship,
    condition: max,
    conditionMax: max,
    originalConditionMax: max,
    moisture: 20,
    rot: 0,
    fireDamage: 0,
    permanentDamage: 0,
  };
}

function applyModification(
  state: GameState,
  building: GameState['buildings'][number],
  modificationId: string,
  worker: SurvivorState,
  qualities: ItemQuality[],
): number {
  const definition = STRUCTURE_MODIFICATIONS[modificationId];
  if (!definition) return 0;
  const workmanship = effectiveWorkmanship(worker, qualities);
  const components = building.structureComponents ||= [];
  const effects = definition.effects;

  if (effects.frameReinforcement) {
    const frame = components.find(component => component.kind === 'frame');
    if (frame) {
      const increase = frame.originalConditionMax * effects.frameReinforcement / 100;
      frame.originalConditionMax += increase;
      frame.conditionMax += increase;
      frame.condition = Math.min(frame.conditionMax, frame.condition + increase);
    }
  }
  if (effects.roofReinforcement) {
    const roof = components.find(component => component.kind === 'roof');
    if (roof) {
      const increase = roof.originalConditionMax * effects.roofReinforcement / 100;
      roof.originalConditionMax += increase;
      roof.conditionMax += increase;
      roof.condition = Math.min(roof.conditionMax, roof.condition + increase);
      roof.moisture = Math.max(0, roof.moisture - 12);
    }
  }
  if (effects.addDrainageComponent && !components.some(component => component.kind === 'drainage')) {
    components.push(newModificationComponent(building.id, modificationId, 'drainage', 'Drainage Ditch', workmanship, qualities));
  }
  if (effects.addRaisedSurface) {
    components.push(newModificationComponent(building.id, modificationId, 'surface', 'Raised Floor', workmanship, qualities));
  }
  if (effects.windProtection) {
    components.push(newModificationComponent(building.id, modificationId, 'fixture', 'Windbreak', workmanship, qualities));
  }

  building.structureModifications ||= [];
  building.structureModifications.push({
    id: `structure_mod_record_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    modificationId,
    appliedAtGameMinute: gameMinute(state),
    workmanship,
  });
  return workmanship;
}

function chooseWorker(state: GameState, preferredId?: string): SurvivorState | undefined {
  const preferred = preferredId
    ? state.survivors.find(candidate => candidate.id === preferredId && candidate.currentAction.type === 'idle')
    : undefined;
  return preferred || state.survivors
    .filter(candidate => candidate.currentAction.type === 'idle' && candidate.jobPriorities.build !== 'disabled')
    .sort((a, b) => (b.skills.building || 0) - (a.skills.building || 0))[0];
}

function completeWorkJob(state: GameState, job: StructureWorkJob, worker: SurvivorState): void {
  const simulation = ensureStructureWorkState(state);
  const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
  if (!building) return;

  let restored = 0;
  let ceilingChange = 0;
  if (job.kind === 'maintenance') {
    const component = building.structureComponents?.find(candidate => candidate.id === job.componentId);
    if (component && job.maintenanceMode) {
      const result = applyMaintenance(component, job.maintenanceMode, job.consumedQualities);
      restored = result.restored;
      ceilingChange = result.ceilingChange;
    }
  } else if (job.modificationId) {
    applyModification(state, building, job.modificationId, worker, job.consumedQualities);
  }

  syncStructureAggregateState(state, building);
  worker.skills.building = (worker.skills.building || 1) + (job.kind === 'modification' ? 0.08 : 0.045);
  setIdle(worker);
  job.status = 'completed';
  job.progressSeconds = job.totalSeconds;
  job.assignedSurvivorId = undefined;

  const history: StructureWorkHistoryRecord = {
    id: `structure_history_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    jobKind: job.kind,
    buildingInstanceId: job.buildingInstanceId,
    componentId: job.componentId,
    maintenanceMode: job.maintenanceMode,
    modificationId: job.modificationId,
    survivorId: worker.id,
    gameMinute: gameMinute(state),
    restoredCondition: restored,
    ceilingChange,
  };
  simulation.structureWorkHistory!.unshift(history);
  simulation.structureWorkHistory = simulation.structureWorkHistory!.slice(0, 80);

  const structureName = BUILDINGS_DATABASE[building.buildingId]?.name || building.buildingId;
  const action = job.kind === 'modification'
    ? STRUCTURE_MODIFICATIONS[job.modificationId || '']?.name || 'Modification'
    : job.maintenanceMode === 'replace' ? 'thay thế bộ phận' : job.maintenanceMode === 'repair' ? 'sửa chữa' : 'vá tạm';
  state.logs.unshift({
    id: `structure_work_done_${Date.now()}_${job.id}`,
    day: state.gameTime.day,
    timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
    text: `${worker.name} hoàn tất ${action} cho ${structureName}.`,
    type: 'success',
  });
}

/** Runs after SurvivorSystem; sentinel build actions are owned here. */
export function tickStructureWorkRuntime(state: GameState): void {
  const simulation = ensureStructureWorkState(state);

  for (const job of simulation.structureWorkJobs!) {
    if (job.status === 'completed' || job.status === 'paused') continue;

    if (job.status === 'waiting_materials') {
      retryReservation(state, job);
      if (job.status === 'waiting_materials') continue;
    }

    if (job.status === 'in_progress') {
      const worker = job.assignedSurvivorId
        ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId)
        : undefined;
      const owns = worker?.currentAction.type === 'building' && worker.currentAction.resultPayload?.structureWorkJobId === job.id;
      if (!worker || !owns) {
        job.status = 'waiting_worker';
        job.assignedSurvivorId = undefined;
        continue;
      }

      job.progressSeconds = Math.min(job.totalSeconds, worker.currentAction.progressSeconds);
      if (job.progressSeconds >= job.totalSeconds) completeWorkJob(state, job, worker);
      continue;
    }

    const worker = chooseWorker(state, job.assignedSurvivorId);
    if (!worker) {
      job.status = 'waiting_worker';
      job.blockedReasons = ['Chờ thợ xây rảnh'];
      continue;
    }

    if (!job.materialsConsumed) {
      if (job.materialReservations.length) {
        const consumed = consumeJobReservations(state, job.materialReservations);
        if (!consumed.success) {
          job.materialReservations = [];
          job.status = 'waiting_materials';
          job.blockedReasons = ['Nguồn vật liệu đã thay đổi; cần giữ lại vật liệu'];
          continue;
        }
        job.consumedQualities = consumed.qualities;
        job.materialReservations = [];
      }
      job.materialsConsumed = true;
    }

    job.status = 'in_progress';
    job.assignedSurvivorId = worker.id;
    job.blockedReasons = [];
    worker.currentAction = {
      type: 'building',
      description: job.kind === 'modification'
        ? `Cải tạo: ${STRUCTURE_MODIFICATIONS[job.modificationId || '']?.name || 'công trình'}`
        : `${job.maintenanceMode === 'replace' ? 'Thay thế' : job.maintenanceMode === 'repair' ? 'Sửa chữa' : 'Vá'} kết cấu`,
      targetId: job.id,
      progressSeconds: job.progressSeconds,
      totalSeconds: ACTION_SENTINEL_SECONDS,
      resultPayload: { structureWorkJobId: job.id, structureWorkTotalSeconds: job.totalSeconds },
    };
  }
}
