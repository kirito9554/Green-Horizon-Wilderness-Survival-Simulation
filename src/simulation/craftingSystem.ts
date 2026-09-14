import type { CraftingQueueItem, GameState, ItemQuality, RecipeDefinition, SurvivorState } from '../types';
import '../types/craftingSimulation';
import '../types/researchSimulation';
import { RECIPES_DATABASE } from '../data/recipes';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { QUALITY_CONFIG } from '../utils/qualityUtils';
import { calculateToolWear, applyToolWear } from './itemSimulation';
import {
  consumeReservedMaterialsForUnit,
  releaseCraftingReservations,
  reserveRecipeMaterialsForJob,
} from './materialReservationSystem';
import { deriveCraftQuality, deterministicRoll } from './craftQualitySystem';
import { ensureToolComponentInstances } from './componentSystem';
import {
  assignWorkstation,
  findAvailableWorkstation,
  releaseWorkstation,
} from './workstationSystem';
import {
  pauseEvidenceResearch,
  refreshResearchEvidence,
  startEvidenceResearch,
  tickResearchEvidence,
} from './researchSystem';

const MAX_CRAFT_QUEUE_SLOTS = 3;

function stableStringSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function setIdle(survivor: SurvivorState): void {
  survivor.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function itemName(itemId: string): string {
  return ITEMS_DATABASE[itemId]?.name || itemId;
}

function formatReservationMissing(missing: Array<{ itemId: string; needed: number; available: number }>): string[] {
  return missing.map(entry => `Missing ${itemName(entry.itemId)}: ${entry.available}/${entry.needed}`);
}

export function hasToolWithTag(state: GameState, tag: string): boolean {
  return state.inventory.items.some(item => {
    const def = ITEMS_DATABASE[item.itemId];
    return Boolean(
      def &&
      def.tags.includes(tag) &&
      (item.condition === undefined || item.condition > 0) &&
      item.quantity > (item.reservedQuantity || 0)
    );
  });
}

function findToolWithTag(state: GameState, tag: string) {
  return state.inventory.items.find(item => {
    const def = ITEMS_DATABASE[item.itemId];
    return Boolean(
      def &&
      def.tags.includes(tag) &&
      (item.condition === undefined || item.condition > 0) &&
      item.quantity > (item.reservedQuantity || 0)
    );
  });
}

export function getItemStockInInventory(state: GameState, itemId: string): number {
  return state.inventory.items.reduce((total, item) => total + (item.itemId === itemId ? item.quantity : 0), 0);
}

// Public compatibility wrappers. The real implementation now lives in researchSystem.
export function checkRecipeDiscoveries(state: GameState): boolean {
  return refreshResearchEvidence(state, { recordMaterialDiscoveries: true, recordIdeaDiscoveries: true });
}

export function startOrResumeResearch(state: GameState, recipeId: string, survivorId: string): GameState {
  return startEvidenceResearch(state, recipeId, survivorId);
}

export function pauseResearch(state: GameState, recipeId: string): GameState {
  return pauseEvidenceResearch(state, recipeId);
}

// ---------------------------------------------------------------------------
// Reservation-backed crafting scheduler
// ---------------------------------------------------------------------------
export function addCraftingQueueItem(
  state: GameState,
  recipeId: string,
  quantity: number = 1,
  assignedSurvivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) next.craftingQueue = [];
  const recipe = RECIPES_DATABASE[recipeId];
  if (!recipe || next.craftingQueue.length >= MAX_CRAFT_QUEUE_SLOTS) return state;

  if (recipe.type === 'crafting') {
    const research = next.researches?.[recipeId];
    if (!(research?.status === 'completed' || recipe.unlockedByDefault)) return state;
  }

  const cleanQuantity = Math.max(1, Math.min(20, Math.floor(quantity)));
  const id = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newItem: CraftingQueueItem = {
    id,
    recipeId,
    quantity: cleanQuantity,
    completedCount: 0,
    assignedSurvivorId: assignedSurvivorId || undefined,
    progressSeconds: 0,
    totalSeconds: recipe.craftTimeSeconds,
    status: 'pending',
    createdAt: Date.now(),
    materialReservations: [],
    reservationStatus: 'unreserved',
    blockedReasons: [],
    deterministicSeed: stableStringSeed(id),
  };

  next.craftingQueue.push(newItem);
  const reservation = reserveRecipeMaterialsForJob(next, newItem, recipe);
  if (!reservation.success) newItem.blockedReasons = formatReservationMissing(reservation.missing);

  const assigned = next.survivors.find(s => s.id === assignedSurvivorId);
  next.logs.unshift({
    id: `q_add_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: reservation.success
      ? `Đã giữ nguyên liệu và thêm: ${cleanQuantity}x ${recipe.name}${assigned ? ` (${assigned.name})` : ''}.`
      : `Đã thêm ${cleanQuantity}x ${recipe.name} vào hàng đợi, nhưng đang chờ đủ nguyên liệu.`,
    type: reservation.success ? 'info' : 'warning',
  });
  return next;
}

export function cancelCraftingQueueItem(state: GameState, queueItemId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) return state;
  const index = next.craftingQueue.findIndex(item => item.id === queueItemId);
  if (index < 0) return state;

  const queueItem = next.craftingQueue[index];
  const recipe = RECIPES_DATABASE[queueItem.recipeId];
  const hadConsumedWork = Boolean(queueItem.currentUnitIngredientQualities?.length || queueItem.activeIngredientQualities?.length);

  if (queueItem.assignedSurvivorId) {
    const survivor = next.survivors.find(s => s.id === queueItem.assignedSurvivorId);
    if (survivor?.currentAction.type === 'crafting' && survivor.currentAction.targetId === queueItem.id) setIdle(survivor);
  }
  releaseWorkstation(queueItem);
  releaseCraftingReservations(next, queueItem);
  next.craftingQueue.splice(index, 1);

  next.logs.unshift({
    id: `q_cancel_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: hadConsumedWork
      ? `Đã hủy ${recipe?.name || queueItem.recipeId}. Vật liệu chưa dùng được giải phóng; vật liệu công đoạn đang làm đã thành phế hao.`
      : `Đã hủy ${recipe?.name || queueItem.recipeId}; toàn bộ vật liệu đang giữ đã được giải phóng.`,
    type: hadConsumedWork ? 'warning' : 'info',
  });
  return next;
}

export function togglePauseCraftingQueueItem(state: GameState, queueItemId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const item = next.craftingQueue?.find(q => q.id === queueItemId);
  if (!item) return state;

  if (item.status === 'in_progress') {
    item.status = 'paused';
    if (item.assignedSurvivorId) {
      const survivor = next.survivors.find(s => s.id === item.assignedSurvivorId);
      if (survivor?.currentAction.type === 'crafting' && survivor.currentAction.targetId === item.id) setIdle(survivor);
    }
    releaseWorkstation(item);
  } else if (item.status === 'paused') {
    item.status = 'pending';
  }
  return next;
}

export function reorderCraftingQueue(state: GameState, queueItemId: string, direction: 'up' | 'down'): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) return state;
  const index = next.craftingQueue.findIndex(q => q.id === queueItemId);
  if (index < 0) return state;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= next.craftingQueue.length) return state;
  [next.craftingQueue[index], next.craftingQueue[targetIndex]] = [next.craftingQueue[targetIndex], next.craftingQueue[index]];
  return next;
}

export function assignArtisanToQueueItem(state: GameState, queueItemId: string, survivorId?: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const item = next.craftingQueue?.find(q => q.id === queueItemId);
  if (!item) return state;

  if (item.status === 'in_progress' && item.assignedSurvivorId) {
    const previous = next.survivors.find(s => s.id === item.assignedSurvivorId);
    if (previous?.currentAction.type === 'crafting' && previous.currentAction.targetId === item.id) setIdle(previous);
    item.status = 'pending';
    releaseWorkstation(item);
  }
  item.assignedSurvivorId = survivorId || undefined;
  return next;
}

function workerMeetsRecipeSkill(worker: SurvivorState, recipe: RecipeDefinition): boolean {
  if (!recipe.requiredSkill) return true;
  return (worker.skills[recipe.requiredSkill.skill] || 0) >= recipe.requiredSkill.level;
}

function selectCraftWorker(state: GameState, queueItem: CraftingQueueItem, recipe: RecipeDefinition): SurvivorState | null {
  if (queueItem.assignedSurvivorId) {
    const assigned = state.survivors.find(s => s.id === queueItem.assignedSurvivorId);
    if (assigned && assigned.currentAction.type === 'idle' && workerMeetsRecipeSkill(assigned, recipe)) return assigned;
    return null;
  }
  return state.survivors
    .filter(s => s.currentAction.type === 'idle' && s.jobPriorities.craft !== 'disabled' && workerMeetsRecipeSkill(s, recipe))
    .sort((a, b) => (b.skills.crafting || 0) - (a.skills.crafting || 0))[0] || null;
}

function calculateEnvironmentalPenalty(state: GameState, queueItem: CraftingQueueItem): number {
  const protection = Math.max(0, Math.min(1, queueItem.workstationWeatherProtection || 0));
  const exposure = 1 - protection;
  switch (state.weather.current) {
    case 'storm': return 12 * exposure;
    case 'heavy_rain': return 8 * exposure;
    case 'light_rain': return 4 * exposure;
    case 'heat_wave': return 3 * exposure;
    default: return 0;
  }
}

function calculateEffectiveCraftTime(
  state: GameState,
  recipe: RecipeDefinition,
  worker: SurvivorState,
  queueItem: CraftingQueueItem,
): number {
  const skill = Math.max(0.5, worker.skills.crafting || 1);
  const skillFactor = 1 / (1 + Math.max(0, skill - 1) * 0.10);
  const fatigueFactor = worker.fatigue > 75 ? 1.38 : worker.fatigue > 55 ? 1.16 : 1;
  const needsFactor = worker.hunger > 75 || worker.thirst > 70 ? 1.18 : 1;
  const moraleFactor = worker.morale < 30 ? 1.14 : worker.morale > 75 ? 0.94 : 1;
  const environmentPenalty = calculateEnvironmentalPenalty(state, queueItem);
  const weatherFactor = 1 + environmentPenalty / 45;
  const workstationSpeed = Math.max(0.35, queueItem.workstationSpeedMultiplier || 1);
  return Math.max(1, Math.round(recipe.craftTimeSeconds * skillFactor * fatigueFactor * needsFactor * moraleFactor * weatherFactor / workstationSpeed * 10) / 10);
}

function addCraftOutputs(
  state: GameState,
  recipe: RecipeDefinition,
  quality: ItemQuality,
  profile: ReturnType<typeof deriveCraftQuality>['profile'],
  queueItem: CraftingQueueItem,
  unitIndex: number,
): void {
  const seed = queueItem.deterministicSeed || stableStringSeed(queueItem.id);
  recipe.outputs.forEach((output, outputIndex) => {
    if (output.chance !== undefined && deterministicRoll(seed, unitIndex, 20 + outputIndex) > output.chance) return;

    const beforeIds = new Set(state.inventory.items.map(item => item.instanceId));
    const result = addItemToInventory(state.inventory, output.itemId, output.quantity, quality);
    if (!result.success) {
      state.logs.unshift({
        id: `q_output_full_${Date.now()}_${queueItem.id}_${outputIndex}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `[Kho đầy] ${recipe.name} hoàn tất nhưng không đủ chỗ chứa ${output.quantity}x ${itemName(output.itemId)}.`,
        type: 'warning',
      });
      return;
    }

    const def = ITEMS_DATABASE[output.itemId];
    if (def?.toolProperties || def?.category === 'tool') {
      for (const item of state.inventory.items) {
        if (!beforeIds.has(item.instanceId) && item.itemId === output.itemId) {
          item.craftQualityProfile = { ...profile };
          ensureToolComponentInstances(item, def);
        }
      }
    }
  });
}

function finishCraftUnit(
  state: GameState,
  queueItem: CraftingQueueItem,
  recipe: RecipeDefinition,
  survivor: SurvivorState,
): boolean {
  const ingredientQualities = queueItem.currentUnitIngredientQualities || queueItem.activeIngredientQualities || [];
  const seed = queueItem.deterministicSeed || stableStringSeed(queueItem.id);
  const unitIndex = queueItem.completedCount;
  const qualityResult = deriveCraftQuality(ingredientQualities, survivor, seed, unitIndex, {
    workstationPrecisionBonus: queueItem.workstationPrecisionBonus || 0,
    environmentPenalty: calculateEnvironmentalPenalty(state, queueItem),
  });
  const craftQuality = qualityResult.quality;

  addCraftOutputs(state, recipe, craftQuality, qualityResult.profile, queueItem, unitIndex);

  const tool = recipe.requiredToolTag ? findToolWithTag(state, recipe.requiredToolTag) : undefined;
  if (tool) {
    const wear = calculateToolWear(tool, 'crafting', survivor, state);
    applyToolWear(state, tool.instanceId, wear.wearAmount, survivor);
  }

  survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.08;
  state.craftedRecipeCounts ||= {};
  state.craftedRecipeCounts[recipe.id] = (state.craftedRecipeCounts[recipe.id] || 0) + 1;

  queueItem.completedCount += 1;
  queueItem.progressSeconds = 0;
  queueItem.currentUnitIngredientQualities = undefined;
  queueItem.activeIngredientQualities = undefined;

  const qualitySuffix = craftQuality === 'standard' ? '' : ` [${QUALITY_CONFIG[craftQuality].nameVi}]`;
  state.logs.unshift({
    id: `q_finish_unit_${Date.now()}_${queueItem.id}_${unitIndex}`,
    day: state.gameTime.day,
    timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
    text: `${survivor.name} hoàn thành ${recipe.name}${qualitySuffix} (${queueItem.completedCount}/${queueItem.quantity}).`,
    type: craftQuality === 'masterwork' || craftQuality === 'prime' ? 'success' : 'info',
  });

  state.recentlyCrafted ||= [];
  state.recentlyCrafted.unshift({
    id: `recent_${Date.now()}_${queueItem.id}_${unitIndex}`,
    recipeId: recipe.id,
    name: recipe.name,
    quantity: 1,
    timestamp: Date.now(),
    timeAgoText: 'Just now',
  });
  state.recentlyCrafted = state.recentlyCrafted.slice(0, 12);

  releaseWorkstation(queueItem);
  if (queueItem.completedCount >= queueItem.quantity) {
    releaseCraftingReservations(state, queueItem);
    setIdle(survivor);
    return true;
  }

  if (queueItem.reservationStatus === 'legacy_consumed') {
    queueItem.reservationStatus = 'unreserved';
    queueItem.materialReservations = [];
  }
  queueItem.status = 'pending';
  setIdle(survivor);
  return false;
}

function advanceRunningCrafts(state: GameState, deltaGameSeconds: number): void {
  if (!state.craftingQueue) return;
  for (let i = state.craftingQueue.length - 1; i >= 0; i--) {
    const queueItem = state.craftingQueue[i];
    if (queueItem.status !== 'in_progress' || !queueItem.assignedSurvivorId) continue;
    const recipe = RECIPES_DATABASE[queueItem.recipeId];
    if (!recipe) continue;

    const survivor = state.survivors.find(s => s.id === queueItem.assignedSurvivorId);
    if (!survivor) {
      queueItem.status = 'pending';
      queueItem.blockedReasons = ['Assigned survivor no longer exists'];
      releaseWorkstation(queueItem);
      continue;
    }

    if (queueItem.assignedWorkstationId) {
      const station = state.buildings.find(building => building.id === queueItem.assignedWorkstationId);
      if (!station || !station.isBuilt || station.condition <= 0) {
        queueItem.status = 'pending';
        queueItem.blockedReasons = ['Assigned workstation is unavailable or broken'];
        if (survivor.currentAction.type === 'crafting' && survivor.currentAction.targetId === queueItem.id) setIdle(survivor);
        releaseWorkstation(queueItem);
        continue;
      }
    }

    const actionStillCrafting = survivor.currentAction.type === 'crafting' && survivor.currentAction.targetId === queueItem.id;
    if (!actionStillCrafting && queueItem.progressSeconds + deltaGameSeconds < queueItem.totalSeconds) {
      queueItem.status = 'pending';
      releaseWorkstation(queueItem);
      continue;
    }

    queueItem.progressSeconds = Math.min(queueItem.totalSeconds, queueItem.progressSeconds + deltaGameSeconds);
    if (actionStillCrafting) survivor.currentAction.progressSeconds = queueItem.progressSeconds;
    if (queueItem.progressSeconds >= queueItem.totalSeconds) {
      const done = finishCraftUnit(state, queueItem, recipe, survivor);
      if (done) state.craftingQueue.splice(i, 1);
    }
  }
}

function activatePendingCrafts(state: GameState): void {
  if (!state.craftingQueue) return;
  for (const queueItem of state.craftingQueue) {
    if (queueItem.status !== 'pending') continue;
    const recipe = RECIPES_DATABASE[queueItem.recipeId];
    if (!recipe) continue;
    queueItem.blockedReasons = [];

    const hasCurrentConsumedUnit = Boolean(queueItem.currentUnitIngredientQualities?.length || queueItem.activeIngredientQualities?.length);
    if (!hasCurrentConsumedUnit && queueItem.reservationStatus !== 'legacy_consumed') {
      if (!queueItem.materialReservations || queueItem.materialReservations.length === 0) {
        const reservation = reserveRecipeMaterialsForJob(state, queueItem, recipe);
        if (!reservation.success) {
          queueItem.blockedReasons = formatReservationMissing(reservation.missing);
          continue;
        }
      }
    }

    if (recipe.requiredToolTag && !hasToolWithTag(state, recipe.requiredToolTag)) {
      queueItem.blockedReasons.push(`Requires usable tool: ${recipe.requiredToolTag}`);
      continue;
    }

    const workstationResult = findAvailableWorkstation(state, recipe, queueItem.id);
    if (!workstationResult.assignment) {
      queueItem.blockedReasons.push(workstationResult.reason || 'Required workstation is unavailable');
      continue;
    }

    const worker = selectCraftWorker(state, queueItem, recipe);
    if (!worker) {
      queueItem.blockedReasons.push(queueItem.assignedSurvivorId ? 'Assigned crafter is busy or under-skilled' : 'No eligible idle crafter');
      continue;
    }

    const oldTotal = Math.max(1, queueItem.totalSeconds || recipe.craftTimeSeconds);
    const oldFraction = Math.max(0, Math.min(1, queueItem.progressSeconds / oldTotal));
    assignWorkstation(queueItem, workstationResult.assignment);

    if (!hasCurrentConsumedUnit) {
      if (queueItem.reservationStatus === 'legacy_consumed' && queueItem.activeIngredientQualities?.length) {
        queueItem.currentUnitIngredientQualities = [...queueItem.activeIngredientQualities];
      } else {
        const consume = consumeReservedMaterialsForUnit(state, queueItem, recipe);
        if (!consume.success) {
          queueItem.blockedReasons.push(consume.reason || 'Reserved materials are invalid');
          releaseWorkstation(queueItem);
          continue;
        }
        queueItem.currentUnitIngredientQualities = consume.qualities;
      }
      queueItem.progressSeconds = 0;
      queueItem.totalSeconds = calculateEffectiveCraftTime(state, recipe, worker, queueItem);
    } else {
      queueItem.totalSeconds = calculateEffectiveCraftTime(state, recipe, worker, queueItem);
      queueItem.progressSeconds = queueItem.totalSeconds * oldFraction;
    }

    queueItem.status = 'in_progress';
    queueItem.assignedSurvivorId = worker.id;
    queueItem.blockedReasons = [];
    worker.currentAction = {
      type: 'crafting',
      description: `Đang chế tác: ${recipe.name}`,
      targetId: queueItem.id,
      progressSeconds: queueItem.progressSeconds,
      totalSeconds: queueItem.totalSeconds,
      resultPayload: {
        queueItemId: queueItem.id,
        recipeId: recipe.id,
        workstationId: queueItem.assignedWorkstationId,
        workstationKind: queueItem.assignedWorkstationKind,
      },
    };

    state.logs.unshift({
      id: `q_start_${Date.now()}_${queueItem.id}_${queueItem.completedCount}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `${worker.name} bắt đầu ${recipe.name} (${queueItem.completedCount + 1}/${queueItem.quantity}) tại ${queueItem.assignedWorkstationKind || 'handcraft'}, ETA ${queueItem.totalSeconds.toFixed(1)}s.`,
      type: 'info',
    });
  }
}

export function tickCraftingAndResearch(state: GameState, deltaGameSeconds: number): void {
  if (!state.researches) state.researches = {};
  if (!state.craftingQueue) state.craftingQueue = [];
  tickResearchEvidence(state, deltaGameSeconds);
  advanceRunningCrafts(state, deltaGameSeconds);
  activatePendingCrafts(state);
}
