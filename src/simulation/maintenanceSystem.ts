import type { GameState, InventoryItem, ItemQuality, SurvivorState } from '../types';
import '../types/craftingSimulation';
import '../types/maintenanceSimulation';
import type { ComponentInstance } from '../types/craftingSimulation';
import type {
  MaintenanceJob,
  MaintenanceMode,
  MaintenanceSystemState,
} from '../types/maintenanceSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { formatTimeOfDay } from './timeSystem';
import {
  ensureToolComponentInstances,
  syncAggregateConditionFromComponents,
} from './componentSystem';
import {
  consumeJobReservations,
  releaseJobReservations,
  reserveJobMaterials,
  type JobMaterialRequirement,
} from './jobReservationSystem';
import { getAvailableInventoryStock } from './inventorySystem';

const MAX_MAINTENANCE_QUEUE = 3;

function stableStringSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function setIdle(survivor: SurvivorState): void {
  survivor.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

export function ensureMaintenanceSystem(state: GameState): MaintenanceSystemState {
  if (!state.maintenanceSystem) state.maintenanceSystem = { queue: [], history: [] };
  state.maintenanceSystem.queue ||= [];
  state.maintenanceSystem.history ||= [];
  return state.maintenanceSystem;
}

function qualityBreakdownForLock(item: InventoryItem) {
  const quality = item.quality || 'standard';
  return {
    crude: quality === 'crude' ? 1 : 0,
    standard: quality === 'standard' ? 1 : 0,
    prime: quality === 'prime' ? 1 : 0,
    masterwork: quality === 'masterwork' ? 1 : 0,
  };
}

function lockTargetItem(item: InventoryItem): boolean {
  if ((item.reservedQuantity || 0) > 0) return false;
  item.reservedQuantity = 1;
  item.reservedQualityBreakdown = qualityBreakdownForLock(item);
  return true;
}

function unlockTargetItem(item: InventoryItem | undefined): void {
  if (!item) return;
  item.reservedQuantity = 0;
  item.reservedQualityBreakdown = { crude: 0, standard: 0, prime: 0, masterwork: 0 };
}

export function rebuildMaintenanceLocks(state: GameState): void {
  const system = ensureMaintenanceSystem(state);
  for (const job of system.queue) {
    const item = state.inventory.items.find(candidate => candidate.instanceId === job.targetInstanceId);
    if (!item) continue;
    if ((item.reservedQuantity || 0) === 0) {
      item.reservedQuantity = 1;
      item.reservedQualityBreakdown = qualityBreakdownForLock(item);
    }
  }
}

function chooseAvailable(alternatives: string[], state: GameState, fallback: string): string {
  return alternatives.find(itemId => getAvailableInventoryStock(state.inventory, itemId) > 0) || fallback;
}

function requirementsForComponent(
  state: GameState,
  component: ComponentInstance,
  mode: MaintenanceMode,
): JobMaterialRequirement[] {
  if (mode === 'quick_patch') {
    return [{ itemId: chooseAvailable(['ITEM_VINE_FIBER', 'ITEM_CORD_ROPE'], state, 'ITEM_VINE_FIBER'), quantity: 1 }];
  }

  const slot = component.slot;
  if (mode === 'maintenance') {
    if (slot === 'blade' || slot === 'head') return [{ itemId: 'ITEM_RIVER_PEBBLE', quantity: 1 }];
    if (slot === 'binding' || slot === 'string') return [{ itemId: chooseAvailable(['ITEM_VINE_FIBER', 'ITEM_CORD_ROPE'], state, 'ITEM_VINE_FIBER'), quantity: 1 }];
    return [{ itemId: chooseAvailable(['ITEM_VINE_FIBER', 'ITEM_DRIFTWOOD_BRANCH'], state, 'ITEM_VINE_FIBER'), quantity: 1 }];
  }

  if (mode === 'repair') {
    if (slot === 'blade' || slot === 'head') return [{ itemId: chooseAvailable(['ITEM_SHARP_STONE', 'ITEM_RIVER_PEBBLE'], state, 'ITEM_SHARP_STONE'), quantity: 1 }];
    if (slot === 'binding' || slot === 'string') return [{ itemId: chooseAvailable(['ITEM_CORD_ROPE', 'ITEM_VINE_FIBER'], state, 'ITEM_VINE_FIBER'), quantity: 1 }];
    if (slot === 'handle' || slot === 'shaft' || slot === 'frame') return [{ itemId: chooseAvailable(['ITEM_WOODEN_HANDLE', 'ITEM_DRIFTWOOD_BRANCH'], state, 'ITEM_DRIFTWOOD_BRANCH'), quantity: 1 }];
    return [{ itemId: 'ITEM_VINE_FIBER', quantity: 1 }];
  }

  // replace
  if (slot === 'blade') return [{ itemId: 'ITEM_SHARP_STONE', quantity: 2 }];
  if (slot === 'head') return [{ itemId: chooseAvailable(['ITEM_SHAPED_AXE_HEAD', 'ITEM_SHARP_STONE'], state, 'ITEM_SHARP_STONE'), quantity: 1 }];
  if (slot === 'handle') return [{ itemId: chooseAvailable(['ITEM_WOODEN_HANDLE', 'ITEM_DRIFTWOOD_BRANCH'], state, 'ITEM_DRIFTWOOD_BRANCH'), quantity: 1 }];
  if (slot === 'shaft' || slot === 'frame') return [{ itemId: chooseAvailable(['ITEM_DRIFTWOOD_BRANCH', 'ITEM_BAMBOO_STALK'], state, 'ITEM_DRIFTWOOD_BRANCH'), quantity: 2 }];
  if (slot === 'binding' || slot === 'string') return [{ itemId: chooseAvailable(['ITEM_CORD_ROPE', 'ITEM_VINE_FIBER'], state, 'ITEM_VINE_FIBER'), quantity: 2 }];
  if (slot === 'grip') return [{ itemId: 'ITEM_VINE_FIBER', quantity: 2 }];
  return [{ itemId: 'ITEM_VINE_FIBER', quantity: 1 }];
}

function componentRatio(component: ComponentInstance): number {
  return component.conditionMax > 0 ? component.condition / component.conditionMax : 0;
}

function defaultTargetComponent(item: InventoryItem): ComponentInstance | undefined {
  return [...(item.components || [])].sort((a, b) => componentRatio(a) - componentRatio(b))[0];
}

function calculateMaintenanceTime(component: ComponentInstance, mode: MaintenanceMode, survivor?: SurvivorState): number {
  const damage = 1 - componentRatio(component);
  const base = mode === 'maintenance'
    ? 8 + damage * 10
    : mode === 'quick_patch'
      ? 6 + damage * 6
      : mode === 'replace'
        ? 25 + damage * 8
        : 14 + damage * 22;
  if (!survivor) return Math.round(base * 10) / 10;
  const skill = Math.max(0.5, survivor.skills.crafting || 1);
  const skillFactor = 1 / (1 + Math.max(0, skill - 1) * 0.10);
  const fatigueFactor = survivor.fatigue > 75 ? 1.35 : survivor.fatigue > 55 ? 1.15 : 1;
  return Math.max(3, Math.round(base * skillFactor * fatigueFactor * 10) / 10);
}

function bestMaintenanceWorker(state: GameState, assignedSurvivorId?: string): SurvivorState | undefined {
  if (assignedSurvivorId) {
    const assigned = state.survivors.find(survivor => survivor.id === assignedSurvivorId);
    return assigned?.currentAction.type === 'idle' ? assigned : undefined;
  }
  return state.survivors
    .filter(survivor => survivor.currentAction.type === 'idle' && survivor.jobPriorities.craft !== 'disabled')
    .sort((a, b) => (b.skills.crafting || 1) - (a.skills.crafting || 1))[0];
}

export function queueMaintenanceJob(
  state: GameState,
  targetInstanceId: string,
  mode: MaintenanceMode,
  targetComponentInstanceId?: string,
  assignedSurvivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureMaintenanceSystem(next);
  if (system.queue.length >= MAX_MAINTENANCE_QUEUE) return state;

  const item = next.inventory.items.find(candidate => candidate.instanceId === targetInstanceId);
  const def = item ? ITEMS_DATABASE[item.itemId] : undefined;
  if (!item || !def || (!def.toolProperties && def.category !== 'tool')) return state;
  ensureToolComponentInstances(item, def);
  if ((item.reservedQuantity || 0) > 0) return state;
  if (system.queue.some(job => job.targetInstanceId === targetInstanceId)) return state;

  const component = item.components?.find(part => part.instanceId === targetComponentInstanceId) || defaultTargetComponent(item);
  if (!component) return state;
  if (!lockTargetItem(item)) return state;

  const id = `maint_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const requirements = requirementsForComponent(next, component, mode);
  const reserved = reserveJobMaterials(next, 'repair', id, requirements);
  const worker = bestMaintenanceWorker(next, assignedSurvivorId);
  const job: MaintenanceJob = {
    id,
    targetInstanceId,
    targetItemId: item.itemId,
    targetComponentInstanceId: component.instanceId,
    mode,
    assignedSurvivorId,
    progressSeconds: 0,
    totalSeconds: calculateMaintenanceTime(component, mode, worker),
    status: reserved.missing.length > 0 ? 'waiting_materials' : 'pending',
    createdAt: Date.now(),
    materialReservations: reserved.reservations,
    materialsConsumed: false,
    blockedReasons: reserved.missing.map(entry => `Missing ${ITEMS_DATABASE[entry.itemId]?.name || entry.itemId} x${entry.quantity}`),
    deterministicSeed: stableStringSeed(id),
  };
  system.queue.push(job);

  next.logs.unshift({
    id: `maint_queue_${Date.now()}_${id}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `[Maintenance] ${def.name} · ${component.name} queued for ${mode.replace('_', ' ')}.`,
    type: job.status === 'waiting_materials' ? 'warning' : 'info',
  });
  return next;
}

export function cancelMaintenanceJob(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureMaintenanceSystem(next);
  const index = system.queue.findIndex(job => job.id === jobId);
  if (index < 0) return state;
  const job = system.queue[index];
  const item = next.inventory.items.find(candidate => candidate.instanceId === job.targetInstanceId);

  if (job.assignedSurvivorId) {
    const worker = next.survivors.find(survivor => survivor.id === job.assignedSurvivorId);
    if (worker?.currentAction.type === 'crafting' && worker.currentAction.targetId === job.id) setIdle(worker);
  }
  if (!job.materialsConsumed) releaseJobReservations(next, job.materialReservations);
  unlockTargetItem(item);
  system.queue.splice(index, 1);

  next.logs.unshift({
    id: `maint_cancel_${Date.now()}_${job.id}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: job.materialsConsumed
      ? `[Maintenance cancelled] Materials already applied to ${ITEMS_DATABASE[job.targetItemId]?.name || job.targetItemId} were lost.`
      : `[Maintenance cancelled] Reserved materials were released.`,
    type: job.materialsConsumed ? 'warning' : 'info',
  });
  return next;
}

export function togglePauseMaintenanceJob(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const job = ensureMaintenanceSystem(next).queue.find(candidate => candidate.id === jobId);
  if (!job) return state;
  if (job.status === 'in_progress') {
    job.status = 'paused';
    if (job.assignedSurvivorId) {
      const worker = next.survivors.find(survivor => survivor.id === job.assignedSurvivorId);
      if (worker?.currentAction.type === 'crafting' && worker.currentAction.targetId === job.id) setIdle(worker);
    }
  } else if (job.status === 'paused') {
    job.status = 'pending';
  }
  return next;
}

function qualityScalar(quality: ItemQuality): number {
  return quality === 'masterwork' ? 1.4 : quality === 'prime' ? 1.18 : quality === 'crude' ? 0.78 : 1;
}

function dominantQuality(qualities: ItemQuality[] | undefined): ItemQuality {
  if (!qualities || qualities.length === 0) return 'standard';
  const score: Record<ItemQuality, number> = { crude: 0, standard: 0, prime: 0, masterwork: 0 };
  for (const quality of qualities) score[quality] += 1;
  return (Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] as ItemQuality) || 'standard';
}

function applyMaintenanceResult(
  item: InventoryItem,
  component: ComponentInstance,
  job: MaintenanceJob,
  worker: SurvivorState,
): { restored: number; maxLoss: number } {
  const oldCondition = component.condition;
  const oldMax = component.conditionMax;
  const originalMax = Math.max(1, component.originalConditionMax);
  const skill = Math.max(0.5, worker.skills.crafting || 1);
  let maxLoss = 0;

  if (job.mode === 'maintenance') {
    const restoration = originalMax * (0.12 + Math.min(0.08, skill * 0.015));
    component.condition = Math.min(component.conditionMax, component.condition + restoration);
    if (component.properties.edgeSharpness !== undefined) component.properties.edgeSharpness = Math.min(100, component.properties.edgeSharpness + 12 + skill * 2);
    if (component.properties.tension !== undefined) component.properties.tension = Math.min(100, component.properties.tension + 10 + skill * 2);
  } else if (job.mode === 'quick_patch') {
    maxLoss = originalMax * 0.06;
    component.conditionMax = Math.max(originalMax * 0.5, component.conditionMax - maxLoss);
    component.permanentDamage = (component.permanentDamage || 0) + maxLoss;
    component.condition = Math.min(component.conditionMax, component.condition + originalMax * 0.30);
    if (component.properties.moistureResistance !== undefined) component.properties.moistureResistance = Math.max(0, component.properties.moistureResistance - 5);
    if (component.properties.gripComfort !== undefined) component.properties.gripComfort = Math.max(0, component.properties.gripComfort - 3);
  } else if (job.mode === 'repair') {
    const severe = oldCondition / Math.max(1, oldMax) < 0.25;
    maxLoss = severe ? originalMax * 0.04 : oldCondition / Math.max(1, oldMax) < 0.5 ? originalMax * 0.015 : 0;
    component.conditionMax = Math.max(originalMax * 0.58, component.conditionMax - maxLoss);
    component.permanentDamage = (component.permanentDamage || 0) + maxLoss;
    const targetRatio = Math.min(0.96, 0.72 + skill * 0.045);
    component.condition = Math.max(component.condition, component.conditionMax * targetRatio);
    if (component.properties.edgeSharpness !== undefined) component.properties.edgeSharpness = Math.min(100, component.properties.edgeSharpness + 18 + skill * 2);
    if (component.properties.tension !== undefined) component.properties.tension = Math.min(100, component.properties.tension + 20 + skill * 2);
  } else {
    const replacementQuality = dominantQuality(job.consumedMaterialQualities);
    const oldQualityScalar = qualityScalar(component.quality);
    const neutralBase = originalMax / Math.max(0.1, oldQualityScalar);
    const newOriginal = Math.max(20, neutralBase * qualityScalar(replacementQuality));
    component.instanceId = `${component.instanceId.split('_repl_')[0]}_repl_${Date.now().toString(36)}`;
    component.quality = replacementQuality;
    component.originalConditionMax = newOriginal;
    component.conditionMax = newOriginal;
    component.condition = newOriginal;
    component.permanentDamage = 0;
    if (component.properties.edgeSharpness !== undefined) component.properties.edgeSharpness = replacementQuality === 'masterwork' ? 92 : replacementQuality === 'prime' ? 82 : replacementQuality === 'crude' ? 52 : 70;
    if (component.properties.tension !== undefined) component.properties.tension = replacementQuality === 'masterwork' ? 92 : replacementQuality === 'prime' ? 84 : replacementQuality === 'crude' ? 52 : 72;
  }

  component.condition = Math.round(component.condition * 10) / 10;
  component.conditionMax = Math.round(component.conditionMax * 10) / 10;
  syncAggregateConditionFromComponents(item);
  return {
    restored: Math.max(0, Math.round((component.condition - oldCondition) * 10) / 10),
    maxLoss: Math.max(0, Math.round((oldMax - component.conditionMax) * 10) / 10),
  };
}

function tryReserveWaitingJob(state: GameState, job: MaintenanceJob, item: InventoryItem, component: ComponentInstance): boolean {
  if (job.materialReservations.length > 0) return true;
  const requirements = requirementsForComponent(state, component, job.mode);
  const result = reserveJobMaterials(state, 'repair', job.id, requirements);
  job.materialReservations = result.reservations;
  job.blockedReasons = result.missing.map(entry => `Missing ${ITEMS_DATABASE[entry.itemId]?.name || entry.itemId} x${entry.quantity}`);
  job.status = result.missing.length > 0 ? 'waiting_materials' : 'pending';
  return result.missing.length === 0;
}

export function tickMaintenanceSystem(state: GameState, deltaGameSeconds: number): void {
  const system = ensureMaintenanceSystem(state);
  for (let index = system.queue.length - 1; index >= 0; index--) {
    const job = system.queue[index];
    const item = state.inventory.items.find(candidate => candidate.instanceId === job.targetInstanceId);
    const def = item ? ITEMS_DATABASE[item.itemId] : undefined;
    if (!item || !def) {
      if (!job.materialsConsumed) releaseJobReservations(state, job.materialReservations);
      system.queue.splice(index, 1);
      continue;
    }
    ensureToolComponentInstances(item, def);
    const component = item.components?.find(part => part.instanceId === job.targetComponentInstanceId) || defaultTargetComponent(item);
    if (!component) continue;

    if (job.status === 'waiting_materials') {
      if (!tryReserveWaitingJob(state, job, item, component)) continue;
    }
    if (job.status === 'paused') continue;

    if (job.status === 'pending' || job.status === 'waiting_worker') {
      if (!job.materialsConsumed && job.materialReservations.length === 0 && !tryReserveWaitingJob(state, job, item, component)) continue;
      const worker = bestMaintenanceWorker(state, job.assignedSurvivorId);
      if (!worker) {
        job.status = 'waiting_worker';
        job.blockedReasons = ['No eligible idle maintenance worker'];
        continue;
      }

      if (!job.materialsConsumed) {
        const consumed = consumeJobReservations(state, job.materialReservations);
        if (!consumed.success) {
          job.status = 'waiting_materials';
          job.materialReservations = [];
          job.blockedReasons = ['Reserved maintenance materials became invalid'];
          continue;
        }
        job.materialsConsumed = true;
        job.consumedMaterialQualities = consumed.qualities;
        job.materialReservations = [];
      }

      const oldTotal = Math.max(1, job.totalSeconds);
      const fraction = Math.max(0, Math.min(1, job.progressSeconds / oldTotal));
      job.totalSeconds = calculateMaintenanceTime(component, job.mode, worker);
      job.progressSeconds = job.totalSeconds * fraction;
      job.status = 'in_progress';
      job.assignedSurvivorId = worker.id;
      job.blockedReasons = [];
      worker.currentAction = {
        type: 'crafting',
        description: `${job.mode.replace('_', ' ')}: ${def.name} / ${component.name}`,
        targetId: job.id,
        progressSeconds: job.progressSeconds,
        totalSeconds: job.totalSeconds,
        resultPayload: { maintenanceJobId: job.id, targetInstanceId: item.instanceId },
      };
    }

    if (job.status !== 'in_progress' || !job.assignedSurvivorId) continue;
    const worker = state.survivors.find(survivor => survivor.id === job.assignedSurvivorId);
    if (!worker) {
      job.status = 'waiting_worker';
      continue;
    }

    const stillWorking = worker.currentAction.type === 'crafting' && worker.currentAction.targetId === job.id;
    if (!stillWorking && job.progressSeconds + deltaGameSeconds < job.totalSeconds) {
      job.status = 'waiting_worker';
      continue;
    }

    job.progressSeconds = Math.min(job.totalSeconds, job.progressSeconds + deltaGameSeconds);
    if (stillWorking) worker.currentAction.progressSeconds = job.progressSeconds;
    if (job.progressSeconds < job.totalSeconds) continue;

    const result = applyMaintenanceResult(item, component, job, worker);
    worker.skills.crafting = (worker.skills.crafting || 1) + (job.mode === 'replace' ? 0.08 : 0.04);
    setIdle(worker);
    unlockTargetItem(item);

    system.history.unshift({
      id: `maint_hist_${Date.now()}_${job.id}`,
      targetItemId: item.itemId,
      targetInstanceId: item.instanceId,
      componentName: component.name,
      mode: job.mode,
      restoredCondition: result.restored,
      permanentConditionMaxLoss: result.maxLoss,
      survivorId: worker.id,
      gameMinute: gameMinute(state),
    });
    system.history = system.history.slice(0, 30);

    state.logs.unshift({
      id: `maint_done_${Date.now()}_${job.id}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `[Maintenance complete] ${worker.name}: ${def.name} / ${component.name} ${job.mode.replace('_', ' ')}; +${result.restored.toFixed(1)} condition${result.maxLoss > 0 ? `, -${result.maxLoss.toFixed(1)} max condition` : ''}.`,
      type: result.maxLoss > 0 ? 'warning' : 'success',
    });
    system.queue.splice(index, 1);
  }
}
