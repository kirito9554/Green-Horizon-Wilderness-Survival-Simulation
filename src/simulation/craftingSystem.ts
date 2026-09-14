import type { CraftingQueueItem, GameState, ItemQuality, RecipeDefinition, SurvivorState } from '../types';
import '../types/craftingSimulation';
import { RECIPES_DATABASE } from '../data/recipes';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { QUALITY_CONFIG } from '../utils/qualityUtils';
import { calculateToolWear, applyToolWear } from './itemSimulation';
import {
  consumeReservedMaterialsForUnit,
  getAvailableItemStock,
  releaseCraftingReservations,
  reserveRecipeMaterialsForJob,
} from './materialReservationSystem';
import { deriveCraftQuality, deterministicRoll } from './craftQualitySystem';
import { ensureToolComponentInstances } from './componentSystem';

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

/** Physical stock, including reserved material. Research discovery cares about possession. */
export function getItemStockInInventory(state: GameState, itemId: string): number {
  return state.inventory.items.reduce((total, item) => total + (item.itemId === itemId ? item.quantity : 0), 0);
}

export function checkRecipeDiscoveries(state: GameState): boolean {
  if (!state.researches) state.researches = {};
  if (!state.discoveredRecipeIds) state.discoveredRecipeIds = [];
  if (!state.craftingQueue) state.craftingQueue = [];

  let anyNewDiscovery = false;

  for (const recipe of Object.values(RECIPES_DATABASE)) {
    if (recipe.type !== 'crafting') continue;

    if (recipe.unlockedByDefault) {
      if (!state.researches[recipe.id]) {
        state.researches[recipe.id] = {
          recipeId: recipe.id,
          status: 'completed',
          progressSeconds: recipe.researchTimeSeconds || 15,
          totalSeconds: recipe.researchTimeSeconds || 15,
        };
      }
      continue;
    }

    const currentResearch = state.researches[recipe.id];
    if (currentResearch && ['completed', 'in_progress', 'paused', 'discovered'].includes(currentResearch.status)) continue;

    const totalIngredients = recipe.ingredients.length;
    let ownedDistinctCount = 0;
    for (const ingredient of recipe.ingredients) {
      if (getItemStockInInventory(state, ingredient.itemId) >= 1) ownedDistinctCount++;
    }

    const threshold = totalIngredients === 1
      ? 1
      : totalIngredients === 2
        ? 2
        : Math.max(1, Math.floor(totalIngredients * 0.8));

    if (ownedDistinctCount >= threshold) {
      state.researches[recipe.id] = {
        recipeId: recipe.id,
        status: 'discovered',
        progressSeconds: 0,
        totalSeconds: recipe.researchTimeSeconds || 25,
      };
      if (!state.discoveredRecipeIds.includes(recipe.id)) state.discoveredRecipeIds.push(recipe.id);
      state.logs.unshift({
        id: `disc_${Date.now()}_${recipe.id}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `[Ý niệm mới] Vật liệu thu thập được gợi mở bản vẽ "${recipe.name}". Hãy phân công nghiên cứu để hoàn thiện quy trình.`,
        type: 'success',
      });
      anyNewDiscovery = true;
    }
  }

  return anyNewDiscovery;
}

export function startOrResumeResearch(state: GameState, recipeId: string, survivorId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.researches) next.researches = {};

  const survivor = next.survivors.find(s => s.id === survivorId);
  const recipe = RECIPES_DATABASE[recipeId];
  if (!survivor || !recipe || survivor.currentAction.type !== 'idle') return state;

  let research = next.researches[recipeId];
  if (!research) {
    research = {
      recipeId,
      status: 'discovered',
      progressSeconds: 0,
      totalSeconds: recipe.researchTimeSeconds || 25,
    };
    next.researches[recipeId] = research;
  }
  if (research.status === 'completed') return state;

  research.status = 'in_progress';
  research.assignedSurvivorId = survivorId;
  survivor.currentAction = {
    type: 'researching',
    description: `Nghiên cứu bản vẽ: ${recipe.name}`,
    targetId: recipeId,
    progressSeconds: research.progressSeconds,
    totalSeconds: research.totalSeconds,
    resultPayload: { recipeId },
  };

  next.logs.unshift({
    id: `res_start_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `${survivor.name} bắt đầu nghiên cứu "${recipe.name}" (${Math.round((research.progressSeconds / research.totalSeconds) * 100)}%).`,
    type: 'info',
  });
  return next;
}

export function pauseResearch(state: GameState, recipeId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const research = next.researches?.[recipeId];
  if (!research || research.status !== 'in_progress') return state;

  if (research.assignedSurvivorId) {
    const survivor = next.survivors.find(s => s.id === research.assignedSurvivorId);
    if (survivor?.currentAction.type === 'researching' && survivor.currentAction.targetId === recipeId) {
      research.progressSeconds = Math.max(research.progressSeconds, survivor.currentAction.progressSeconds);
      setIdle(survivor);
    }
  }
  research.status = 'paused';

  next.logs.unshift({
    id: `res_pause_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `Đã tạm dừng nghiên cứu "${RECIPES_DATABASE[recipeId]?.name || recipeId}". Tiến độ được bảo lưu.`,
    type: 'info',
  });
  return next;
}

export function addCraftingQueueItem(
  state: GameState,
  recipeId: string,
  quantity: number = 1,
  assignedSurvivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) next.craftingQueue = [];
  const recipe = RECIPES_DATABASE[recipeId];
  if (!recipe) return state;
  if (next.craftingQueue.length >= MAX_CRAFT_QUEUE_SLOTS) return state;

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

  const assignedSurvivor = next.survivors.find(s => s.id === assignedSurvivorId);
  next.logs.unshift({
    id: `q_add_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: reservation.success
      ? `Đã giữ nguyên liệu và thêm: ${cleanQuantity}x ${recipe.name}${assignedSurvivor ? ` (${assignedSurvivor.name})` : ''}.`
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

  // Unconsumed reservations were never removed from inventory, so releasing is exact.
  releaseCraftingReservations(next, queueItem);
  next.craftingQueue.splice(index, 1);

  next.logs.unshift({
    id: `q_cancel_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: hadConsumedWork
      ? `Đã hủy ${recipe?.name || queueItem.recipeId}. Vật liệu chưa dùng được giải phóng; vật liệu của công đoạn đang làm đã trở thành phế hao.`
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

function builtRequirementExists(state: GameState, recipe: RecipeDefinition): boolean {
  if (recipe.requiredBuildingId) {
    return state.buildings.some(building => building.buildingId === recipe.requiredBuildingId && building.isBuilt && building.condition > 0);
  }
  if (recipe.id === 'RECIPE_BOIL_WATER' || recipe.id === 'RECIPE_GRILL_FISH') {
    return state.buildings.some(building => building.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && building.isBuilt && building.condition > 0);
  }
  return true;
}

function calculateEffectiveCraftTime(state: GameState, recipe: RecipeDefinition, worker: SurvivorState): number {
  const skill = Math.max(0.5, worker.skills.crafting || 1);
  const skillFactor = 1 / (1 + Math.max(0, skill - 1) * 0.10);
  const fatigueFactor = worker.fatigue > 75 ? 1.38 : worker.fatigue > 55 ? 1.16 : 1;
  const needsFactor = worker.hunger > 75 || worker.thirst > 70 ? 1.18 : 1;
  const moraleFactor = worker.morale < 30 ? 1.14 : worker.morale > 75 ? 0.94 : 1;
  const weatherFactor =
    recipe.workstationName?.toLowerCase().includes('handcraft') &&
    (state.weather.current === 'heavy_rain' || state.weather.current === 'storm')
      ? 1.22
      : 1;
  return Math.max(1, Math.round(recipe.craftTimeSeconds * skillFactor * fatigueFactor * needsFactor * moraleFactor * weatherFactor * 10) / 10);
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

function completeResearchIfReady(state: GameState, deltaGameSeconds: number): void {
  if (!state.researches) return;

  for (const research of Object.values(state.researches)) {
    if (research.status !== 'in_progress' || !research.assignedSurvivorId) continue;
    const survivor = state.survivors.find(s => s.id === research.assignedSurvivorId);
    if (!survivor) {
      research.status = 'paused';
      continue;
    }

    const actionStillResearching = survivor.currentAction.type === 'researching' && survivor.currentAction.targetId === research.recipeId;
    // survivorSystem may reset the action on the exact final tick. In that case
    // the research object is still one delta short, so allow the final delta.
    if (!actionStillResearching && research.progressSeconds + deltaGameSeconds < research.totalSeconds) {
      research.status = 'paused';
      continue;
    }

    research.progressSeconds = Math.min(research.totalSeconds, research.progressSeconds + deltaGameSeconds);
    if (actionStillResearching) survivor.currentAction.progressSeconds = research.progressSeconds;

    if (research.progressSeconds >= research.totalSeconds) {
      research.status = 'completed';
      survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.12;
      setIdle(survivor);
      state.logs.unshift({
        id: `res_done_${Date.now()}_${research.recipeId}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `[Nghiên cứu hoàn tất] ${survivor.name} đã hoàn thiện bản vẽ "${RECIPES_DATABASE[research.recipeId]?.name || research.recipeId}".`,
        type: 'success',
      });
    }
  }
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
  const qualityResult = deriveCraftQuality(ingredientQualities, survivor, seed, unitIndex);
  const craftQuality = qualityResult.quality;

  addCraftOutputs(state, recipe, craftQuality, qualityResult.profile, queueItem, unitIndex);

  const tool = recipe.requiredToolTag ? findToolWithTag(state, recipe.requiredToolTag) : undefined;
  if (tool) {
    const wear = calculateToolWear(tool, 'crafting', survivor, state);
    applyToolWear(state, tool.instanceId, wear.wearAmount, survivor);
  }

  survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.08;
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

  state.recentlyCrafted = state.recentlyCrafted || [];
  state.recentlyCrafted.unshift({
    id: `recent_${Date.now()}_${queueItem.id}_${unitIndex}`,
    recipeId: recipe.id,
    name: recipe.name,
    quantity: 1,
    timestamp: Date.now(),
    timeAgoText: 'Just now',
  });
  state.recentlyCrafted = state.recentlyCrafted.slice(0, 12);

  if (queueItem.completedCount >= queueItem.quantity) {
    releaseCraftingReservations(state, queueItem);
    setIdle(survivor);
    return true;
  }

  // A migrated legacy job only had the active unit consumed. Reserve the rest now.
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
      continue;
    }

    const actionStillCrafting = survivor.currentAction.type === 'crafting' && survivor.currentAction.targetId === queueItem.id;
    if (!actionStillCrafting && queueItem.progressSeconds + deltaGameSeconds < queueItem.totalSeconds) {
      queueItem.status = 'pending';
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
    if (!builtRequirementExists(state, recipe)) {
      queueItem.blockedReasons.push(recipe.requiredBuildingId ? `Requires building: ${recipe.requiredBuildingId}` : 'Requires a functioning Campfire');
      continue;
    }

    const worker = selectCraftWorker(state, queueItem, recipe);
    if (!worker) {
      queueItem.blockedReasons.push(queueItem.assignedSurvivorId ? 'Assigned crafter is busy or under-skilled' : 'No eligible idle crafter');
      continue;
    }

    if (!hasCurrentConsumedUnit) {
      if (queueItem.reservationStatus === 'legacy_consumed' && queueItem.activeIngredientQualities?.length) {
        queueItem.currentUnitIngredientQualities = [...queueItem.activeIngredientQualities];
      } else {
        const consume = consumeReservedMaterialsForUnit(state, queueItem, recipe);
        if (!consume.success) {
          queueItem.blockedReasons.push(consume.reason || 'Reserved materials are invalid');
          continue;
        }
        queueItem.currentUnitIngredientQualities = consume.qualities;
      }
      queueItem.progressSeconds = 0;
      queueItem.totalSeconds = calculateEffectiveCraftTime(state, recipe, worker);
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
      resultPayload: { queueItemId: queueItem.id, recipeId: recipe.id },
    };

    state.logs.unshift({
      id: `q_start_${Date.now()}_${queueItem.id}_${queueItem.completedCount}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `${worker.name} bắt đầu ${recipe.name} (${queueItem.completedCount + 1}/${queueItem.quantity}), thời gian dự kiến ${queueItem.totalSeconds.toFixed(1)}s.`,
      type: 'info',
    });
  }
}

export function tickCraftingAndResearch(state: GameState, deltaGameSeconds: number): void {
  checkRecipeDiscoveries(state);
  if (!state.researches) state.researches = {};
  if (!state.craftingQueue) state.craftingQueue = [];

  completeResearchIfReady(state, deltaGameSeconds);
  advanceRunningCrafts(state, deltaGameSeconds);
  activatePendingCrafts(state);
}
