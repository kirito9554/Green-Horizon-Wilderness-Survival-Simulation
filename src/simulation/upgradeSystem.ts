import type { GameState, InventoryItem, ItemQuality, RecipeDefinition, SurvivorState } from '../types';
import '../types/craftingSimulation';
import '../types/upgradeSimulation';
import type { ComponentInstance } from '../types/craftingSimulation';
import type {
  ComponentModification,
  DerivedToolStats,
  UpgradeJob,
  UpgradeSystemState,
} from '../types/upgradeSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { RECIPES_DATABASE } from '../data/recipes';
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

const MAX_UPGRADE_QUEUE = 3;

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
  survivor.currentAction = { type: 'idle', description: 'Ready for new assignment', progressSeconds: 0, totalSeconds: 0 };
}

export function ensureUpgradeSystem(state: GameState): UpgradeSystemState {
  if (!state.upgradeSystem) state.upgradeSystem = { queue: [], history: [] };
  state.upgradeSystem.queue ||= [];
  state.upgradeSystem.history ||= [];
  return state.upgradeSystem;
}

function lockBreakdown(item: InventoryItem) {
  const quality = item.quality || 'standard';
  return {
    crude: quality === 'crude' ? 1 : 0,
    standard: quality === 'standard' ? 1 : 0,
    prime: quality === 'prime' ? 1 : 0,
    masterwork: quality === 'masterwork' ? 1 : 0,
  };
}

function lockTarget(item: InventoryItem): boolean {
  if ((item.reservedQuantity || 0) > 0) return false;
  item.reservedQuantity = 1;
  item.reservedQualityBreakdown = lockBreakdown(item);
  return true;
}

function unlockTarget(item: InventoryItem | undefined): void {
  if (!item) return;
  item.reservedQuantity = 0;
  item.reservedQualityBreakdown = { crude: 0, standard: 0, prime: 0, masterwork: 0 };
}

export function rebuildUpgradeLocks(state: GameState): void {
  for (const job of ensureUpgradeSystem(state).queue) {
    const item = state.inventory.items.find(candidate => candidate.instanceId === job.targetInstanceId);
    if (item && (item.reservedQuantity || 0) === 0) {
      item.reservedQuantity = 1;
      item.reservedQualityBreakdown = lockBreakdown(item);
    }
  }
}

function qualityScalar(quality: ItemQuality): number {
  return quality === 'masterwork' ? 1.35 : quality === 'prime' ? 1.16 : quality === 'crude' ? 0.80 : 1;
}

function dominantQuality(qualities: ItemQuality[] | undefined): ItemQuality {
  if (!qualities?.length) return 'standard';
  const counts: Record<ItemQuality, number> = { crude: 0, standard: 0, prime: 0, masterwork: 0 };
  for (const quality of qualities) counts[quality] += 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ItemQuality) || 'standard';
}

function sourceRecipeForItem(itemId: string): RecipeDefinition | undefined {
  return Object.values(RECIPES_DATABASE).find(recipe => recipe.outputs.some(output => output.itemId === itemId));
}

export function getNextTierRecipeForItem(itemId: string): RecipeDefinition | undefined {
  const sourceRecipe = sourceRecipeForItem(itemId);
  const nextId = sourceRecipe?.progression?.nextRecipeId;
  return nextId ? RECIPES_DATABASE[nextId] : undefined;
}

function tierRequirements(item: InventoryItem, recipe: RecipeDefinition): JobMaterialRequirement[] {
  let consumedTarget = false;
  const result: JobMaterialRequirement[] = [];
  for (const ingredient of recipe.ingredients) {
    let quantity = ingredient.quantity;
    if (!consumedTarget && ingredient.itemId === item.itemId) {
      quantity -= 1;
      consumedTarget = true;
    }
    if (quantity > 0) result.push({ itemId: ingredient.itemId, quantity });
  }
  return result;
}

function chooseAvailable(state: GameState, alternatives: string[], fallback: string): string {
  return alternatives.find(itemId => getAvailableInventoryStock(state.inventory, itemId) > 0) || fallback;
}

function componentRequirements(state: GameState, modification: ComponentModification, component: ComponentInstance): JobMaterialRequirement[] {
  if (modification === 'sharpen') {
    return [{ itemId: chooseAvailable(state, ['ITEM_RIVER_PEBBLE', 'ITEM_SHARP_STONE'], 'ITEM_RIVER_PEBBLE'), quantity: 1 }];
  }
  if (modification === 'reinforce') {
    return [{ itemId: chooseAvailable(state, ['ITEM_CORD_ROPE', 'ITEM_VINE_FIBER'], 'ITEM_VINE_FIBER'), quantity: 1 }];
  }
  if (modification === 'weatherproof') {
    return [{ itemId: chooseAvailable(state, ['ITEM_COCONUT_CHARCOAL', 'ITEM_COCONUT_HUSK', 'ITEM_VINE_FIBER'], 'ITEM_COCONUT_HUSK'), quantity: 1 }];
  }
  if (component.slot === 'handle' || component.slot === 'shaft' || component.slot === 'frame') {
    return [{ itemId: chooseAvailable(state, ['ITEM_VINE_FIBER', 'ITEM_DRIFTWOOD_BRANCH'], 'ITEM_VINE_FIBER'), quantity: 1 }];
  }
  return [{ itemId: 'ITEM_VINE_FIBER', quantity: 1 }];
}

function bestWorker(state: GameState, assignedId?: string): SurvivorState | undefined {
  if (assignedId) {
    const assigned = state.survivors.find(survivor => survivor.id === assignedId);
    return assigned?.currentAction.type === 'idle' ? assigned : undefined;
  }
  return state.survivors
    .filter(survivor => survivor.currentAction.type === 'idle' && survivor.jobPriorities.craft !== 'disabled')
    .sort((a, b) => (b.skills.crafting || 1) - (a.skills.crafting || 1))[0];
}

function effectiveTime(base: number, worker?: SurvivorState): number {
  if (!worker) return base;
  const skill = Math.max(0.5, worker.skills.crafting || 1);
  const skillFactor = 1 / (1 + Math.max(0, skill - 1) * 0.09);
  const fatigueFactor = worker.fatigue > 75 ? 1.35 : worker.fatigue > 55 ? 1.15 : 1;
  return Math.max(5, Math.round(base * skillFactor * fatigueFactor * 10) / 10);
}

export function queueTierUpgrade(
  state: GameState,
  targetInstanceId: string,
  assignedSurvivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureUpgradeSystem(next);
  if (system.queue.length >= MAX_UPGRADE_QUEUE) return state;

  const item = next.inventory.items.find(candidate => candidate.instanceId === targetInstanceId);
  const def = item ? ITEMS_DATABASE[item.itemId] : undefined;
  const recipe = item ? getNextTierRecipeForItem(item.itemId) : undefined;
  if (!item || !def || !recipe || (item.reservedQuantity || 0) > 0) return state;
  if (system.queue.some(job => job.targetInstanceId === targetInstanceId)) return state;
  if (!lockTarget(item)) return state;

  ensureToolComponentInstances(item, def);
  const id = `upgrade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const requirements = tierRequirements(item, recipe);
  const reserved = reserveJobMaterials(next, 'upgrade', id, requirements);
  const worker = bestWorker(next, assignedSurvivorId);
  const targetItemId = recipe.outputs[0]?.itemId;
  const job: UpgradeJob = {
    id,
    targetInstanceId,
    sourceItemId: item.itemId,
    mode: 'tier',
    targetRecipeId: recipe.id,
    targetItemId,
    assignedSurvivorId,
    progressSeconds: 0,
    totalSeconds: effectiveTime(Math.max(15, recipe.craftTimeSeconds * 0.85), worker),
    status: reserved.missing.length ? 'waiting_materials' : 'pending',
    createdAt: Date.now(),
    materialReservations: reserved.reservations,
    materialsConsumed: false,
    blockedReasons: reserved.missing.map(entry => `Missing ${ITEMS_DATABASE[entry.itemId]?.name || entry.itemId} x${entry.quantity}`),
    deterministicSeed: stableStringSeed(id),
  };
  system.queue.push(job);
  return next;
}

export function queueComponentModification(
  state: GameState,
  targetInstanceId: string,
  modification: ComponentModification,
  targetComponentInstanceId?: string,
  assignedSurvivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureUpgradeSystem(next);
  if (system.queue.length >= MAX_UPGRADE_QUEUE) return state;

  const item = next.inventory.items.find(candidate => candidate.instanceId === targetInstanceId);
  const def = item ? ITEMS_DATABASE[item.itemId] : undefined;
  if (!item || !def || (item.reservedQuantity || 0) > 0) return state;
  ensureToolComponentInstances(item, def);
  const component = item.components?.find(part => part.instanceId === targetComponentInstanceId)
    || item.components?.find(part => modification === 'sharpen' ? part.properties.edgeSharpness !== undefined : true);
  if (!component || system.queue.some(job => job.targetInstanceId === targetInstanceId)) return state;
  if (!lockTarget(item)) return state;

  const id = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const requirements = componentRequirements(next, modification, component);
  const reserved = reserveJobMaterials(next, 'upgrade', id, requirements);
  const worker = bestWorker(next, assignedSurvivorId);
  const job: UpgradeJob = {
    id,
    targetInstanceId,
    sourceItemId: item.itemId,
    mode: 'component',
    targetComponentInstanceId: component.instanceId,
    targetComponentSlot: component.slot,
    modification,
    assignedSurvivorId,
    progressSeconds: 0,
    totalSeconds: effectiveTime(modification === 'sharpen' ? 10 : modification === 'rebalance' ? 14 : 18, worker),
    status: reserved.missing.length ? 'waiting_materials' : 'pending',
    createdAt: Date.now(),
    materialReservations: reserved.reservations,
    materialsConsumed: false,
    blockedReasons: reserved.missing.map(entry => `Missing ${ITEMS_DATABASE[entry.itemId]?.name || entry.itemId} x${entry.quantity}`),
    deterministicSeed: stableStringSeed(id),
  };
  system.queue.push(job);
  return next;
}

export function cancelUpgradeJob(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureUpgradeSystem(next);
  const index = system.queue.findIndex(job => job.id === jobId);
  if (index < 0) return state;
  const job = system.queue[index];
  const item = next.inventory.items.find(candidate => candidate.instanceId === job.targetInstanceId);
  if (!job.materialsConsumed) releaseJobReservations(next, job.materialReservations);
  if (job.assignedSurvivorId) {
    const worker = next.survivors.find(survivor => survivor.id === job.assignedSurvivorId);
    if (worker?.currentAction.type === 'crafting' && worker.currentAction.targetId === job.id) setIdle(worker);
  }
  unlockTarget(item);
  system.queue.splice(index, 1);
  return next;
}

export function togglePauseUpgradeJob(state: GameState, jobId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const job = ensureUpgradeSystem(next).queue.find(candidate => candidate.id === jobId);
  if (!job) return state;
  if (job.status === 'in_progress') {
    job.status = 'paused';
    const worker = next.survivors.find(survivor => survivor.id === job.assignedSurvivorId);
    if (worker?.currentAction.type === 'crafting' && worker.currentAction.targetId === job.id) setIdle(worker);
  } else if (job.status === 'paused') job.status = 'pending';
  return next;
}

function applyTierUpgrade(item: InventoryItem, job: UpgradeJob): { fromItemId: string; toItemId: string } {
  const fromItemId = item.itemId;
  const targetItemId = job.targetItemId || fromItemId;
  const oldDef = ITEMS_DATABASE[fromItemId];
  const targetDef = ITEMS_DATABASE[targetItemId];
  const oldMax = item.conditionMax || oldDef?.toolProperties?.durabilityMax || 100;
  const conditionRatio = Math.max(0, Math.min(1, (item.condition || oldMax) / oldMax));
  const materialQuality = dominantQuality(job.consumedMaterialQualities);
  const targetBaseMax = targetDef?.toolProperties?.durabilityMax || oldMax;
  const upgradedMax = Math.round(targetBaseMax * Math.max(1, qualityScalar(materialQuality)));

  item.itemId = targetItemId;
  item.conditionMax = upgradedMax;
  item.originalConditionMax = Math.max(item.originalConditionMax || 0, upgradedMax);
  item.condition = Math.round(upgradedMax * conditionRatio * 10) / 10;
  item.modifications = Array.from(new Set([...(item.modifications || []), `tier:${job.targetRecipeId || targetItemId}`]));

  for (const component of item.components || []) {
    if (component.properties.edgeSharpness !== undefined) component.properties.edgeSharpness = Math.min(100, component.properties.edgeSharpness + 8);
    if (component.properties.tension !== undefined) component.properties.tension = Math.min(100, component.properties.tension + 12);
    if (component.properties.gripComfort !== undefined) component.properties.gripComfort = Math.min(100, component.properties.gripComfort + 10);
  }
  if (targetDef) ensureToolComponentInstances(item, targetDef);
  syncAggregateConditionFromComponents(item);
  return { fromItemId, toItemId: targetItemId };
}

function applyComponentModification(item: InventoryItem, component: ComponentInstance, job: UpgradeJob): void {
  const materialQuality = dominantQuality(job.consumedMaterialQualities);
  const scalar = qualityScalar(materialQuality);
  const modification = job.modification || 'reinforce';

  if (modification === 'sharpen') {
    if (component.properties.edgeSharpness !== undefined) component.properties.edgeSharpness = Math.min(100, component.properties.edgeSharpness + 16 * scalar);
    const materialRemoval = component.originalConditionMax * 0.012;
    component.conditionMax = Math.max(component.originalConditionMax * 0.62, component.conditionMax - materialRemoval);
    component.condition = Math.min(component.condition, component.conditionMax);
    component.permanentDamage = (component.permanentDamage || 0) + materialRemoval;
  } else if (modification === 'reinforce') {
    component.conditionMax = Math.min(component.originalConditionMax * 1.25, component.conditionMax + component.originalConditionMax * 0.08 * scalar);
    component.condition = Math.min(component.conditionMax, component.condition + component.originalConditionMax * 0.05 * scalar);
    if (component.properties.tension !== undefined) component.properties.tension = Math.min(100, component.properties.tension + 14 * scalar);
    if (component.properties.toughness !== undefined) component.properties.toughness = Math.min(100, component.properties.toughness + 8 * scalar);
  } else if (modification === 'rebalance') {
    if (component.properties.gripComfort !== undefined) component.properties.gripComfort = Math.min(100, component.properties.gripComfort + 18 * scalar);
    if (component.properties.tension !== undefined) component.properties.tension = Math.min(100, component.properties.tension + 8 * scalar);
  } else if (modification === 'weatherproof') {
    component.properties.moistureResistance = Math.min(100, (component.properties.moistureResistance || 25) + 28 * scalar);
  }

  item.modifications = Array.from(new Set([...(item.modifications || []), `${modification}:${component.slot}`]));
  syncAggregateConditionFromComponents(item);
}

function tryReserve(state: GameState, job: UpgradeJob, item: InventoryItem, component?: ComponentInstance): boolean {
  if (job.materialReservations.length) return true;
  const recipe = job.targetRecipeId ? RECIPES_DATABASE[job.targetRecipeId] : undefined;
  const requirements = job.mode === 'tier' && recipe
    ? tierRequirements(item, recipe)
    : component && job.modification
      ? componentRequirements(state, job.modification, component)
      : [];
  const result = reserveJobMaterials(state, 'upgrade', job.id, requirements);
  job.materialReservations = result.reservations;
  job.blockedReasons = result.missing.map(entry => `Missing ${ITEMS_DATABASE[entry.itemId]?.name || entry.itemId} x${entry.quantity}`);
  job.status = result.missing.length ? 'waiting_materials' : 'pending';
  return result.missing.length === 0;
}

export function tickUpgradeSystem(state: GameState, deltaGameSeconds: number): void {
  const system = ensureUpgradeSystem(state);
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
    const component = item.components?.find(part => part.instanceId === job.targetComponentInstanceId)
      || item.components?.find(part => part.slot === job.targetComponentSlot);

    if (job.status === 'waiting_materials' && !tryReserve(state, job, item, component)) continue;
    if (job.status === 'paused') continue;

    if (job.status === 'pending' || job.status === 'waiting_worker') {
      if (!job.materialsConsumed && !job.materialReservations.length && !tryReserve(state, job, item, component)) continue;
      const worker = bestWorker(state, job.assignedSurvivorId);
      if (!worker) {
        job.status = 'waiting_worker';
        job.blockedReasons = ['No eligible idle upgrade worker'];
        continue;
      }

      if (!job.materialsConsumed) {
        const consumed = consumeJobReservations(state, job.materialReservations);
        if (!consumed.success) {
          job.materialReservations = [];
          job.status = 'waiting_materials';
          job.blockedReasons = ['Reserved upgrade materials became invalid'];
          continue;
        }
        job.materialsConsumed = true;
        job.consumedMaterialQualities = consumed.qualities;
        job.materialReservations = [];
      }

      const oldTotal = Math.max(1, job.totalSeconds);
      const fraction = Math.max(0, Math.min(1, job.progressSeconds / oldTotal));
      const base = job.mode === 'tier' ? Math.max(15, (RECIPES_DATABASE[job.targetRecipeId || '']?.craftTimeSeconds || 25) * 0.85) : job.modification === 'sharpen' ? 10 : job.modification === 'rebalance' ? 14 : 18;
      job.totalSeconds = effectiveTime(base, worker);
      job.progressSeconds = job.totalSeconds * fraction;
      job.status = 'in_progress';
      job.assignedSurvivorId = worker.id;
      job.blockedReasons = [];
      worker.currentAction = {
        type: 'crafting',
        description: job.mode === 'tier' ? `Upgrading ${def.name}` : `${job.modification}: ${def.name}`,
        targetId: job.id,
        progressSeconds: job.progressSeconds,
        totalSeconds: job.totalSeconds,
        resultPayload: { upgradeJobId: job.id, targetInstanceId: item.instanceId },
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

    const fromItemId = item.itemId;
    let toItemId = item.itemId;
    let componentName: string | undefined;
    if (job.mode === 'tier') {
      const result = applyTierUpgrade(item, job);
      toItemId = result.toItemId;
    } else if (component) {
      componentName = component.name;
      applyComponentModification(item, component, job);
    }

    worker.skills.crafting = (worker.skills.crafting || 1) + (job.mode === 'tier' ? 0.12 : 0.05);
    setIdle(worker);
    unlockTarget(item);
    system.history.unshift({
      id: `upgrade_hist_${Date.now()}_${job.id}`,
      targetInstanceId: item.instanceId,
      fromItemId,
      toItemId,
      mode: job.mode,
      modification: job.modification,
      componentName,
      survivorId: worker.id,
      gameMinute: gameMinute(state),
    });
    system.history = system.history.slice(0, 30);

    state.logs.unshift({
      id: `upgrade_done_${Date.now()}_${job.id}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: job.mode === 'tier'
        ? `[Upgrade complete] ${ITEMS_DATABASE[fromItemId]?.name || fromItemId} → ${ITEMS_DATABASE[toItemId]?.name || toItemId}.`
        : `[Modification complete] ${ITEMS_DATABASE[item.itemId]?.name || item.itemId}: ${job.modification} ${componentName || ''}.`,
      type: 'success',
    });
    system.queue.splice(index, 1);
  }
}

export function deriveToolStats(item: InventoryItem): DerivedToolStats {
  const components = item.components || [];
  const conditionMax = item.conditionMax || item.originalConditionMax || 100;
  const condition = item.condition || 0;
  const conditionPct = conditionMax > 0 ? condition / conditionMax * 100 : 0;
  const edge = components.reduce((best, component) => Math.max(best, component.properties.edgeSharpness || 0), 0);
  const hardness = components.reduce((best, component) => Math.max(best, component.properties.hardness || 0), 0);
  const grip = components.reduce((best, component) => Math.max(best, component.properties.gripComfort || 0), 0);
  const tensionValues = components.map(component => component.properties.tension).filter((value): value is number => value !== undefined);
  const tension = tensionValues.length ? tensionValues.reduce((sum, value) => sum + value, 0) / tensionValues.length : 70;
  const length = components.reduce((best, component) => Math.max(best, component.properties.lengthCm || 0), 0);
  const fit = item.craftQualityProfile?.fit || 65;
  const workmanship = item.craftQualityProfile?.workmanship || 65;

  return {
    durability: Math.round(conditionMax),
    conditionPct: Math.round(conditionPct * 10) / 10,
    cuttingPower: Math.round((edge / 18) * (0.65 + hardness / 180) * (0.75 + fit / 400) * 10) / 10,
    efficiency: Math.round((50 + fit * 0.25 + workmanship * 0.18 + grip * 0.12) * (0.65 + conditionPct / 285) * 10) / 10,
    handling: Math.round((grip * 0.55 + tension * 0.25 + fit * 0.20) * 10) / 10,
    reachM: Math.round((length / 100) * 100) / 100,
    reliability: Math.round((conditionPct * 0.45 + tension * 0.25 + workmanship * 0.30) * 10) / 10,
  };
}
