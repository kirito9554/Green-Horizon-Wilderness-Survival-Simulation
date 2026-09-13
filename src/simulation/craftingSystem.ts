import { GameState, ItemQuality, RecipeDefinition, RecipeResearchState, CraftingQueueItem } from '../types';
import { RECIPES_DATABASE } from '../data/recipes';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory, deductItemFromInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { QUALITY_CONFIG } from '../utils/qualityUtils';
import { calculateToolWear, applyToolWear, synthesizeCraftedQuality } from './itemSimulation';

/**
 * Kiểm tra xem kho đồ có đủ công cụ yêu cầu bởi thẻ tag (ví dụ: 'sharp') không
 */
export function hasToolWithTag(state: GameState, tag: string): boolean {
  return state.inventory.items.some(item => {
    const def = ITEMS_DATABASE[item.itemId];
    return def && def.tags.includes(tag) && (item.condition === undefined || item.condition > 0);
  });
}

/**
 * Đếm số lượng tồn kho của một nguyên liệu
 */
export function getItemStockInInventory(state: GameState, itemId: string): number {
  let total = 0;
  for (const item of state.inventory.items) {
    if (item.itemId === itemId) total += item.quantity;
  }
  return total;
}

/**
 * 1. HỆ THỐNG KHÁM PHÁ Ý NIỆM CÔNG THỨC (DISCOVERY SYSTEM)
 * Tự động quét kho đồ: khi sở hữu >= 80% (hoặc 2/3) chủng loại nguyên liệu của công thức chế tạo,
 * người chơi sẽ nảy ra ý niệm bản vẽ và mở trạng thái 'discovered' để nghiên cứu.
 */
export function checkRecipeDiscoveries(state: GameState): boolean {
  if (!state.researches) state.researches = {};
  if (!state.discoveredRecipeIds) state.discoveredRecipeIds = [];
  if (!state.craftingQueue) state.craftingQueue = [];

  let anyNewDiscovery = false;

  for (const recipe of Object.values(RECIPES_DATABASE)) {
    // Chỉ các công thức chế tạo/lắp ráp (crafting) mới cần quy trình nghiên cứu bản vẽ
    if (recipe.type !== 'crafting') continue;

    // Nếu công thức được đánh dấu mở sẵn từ đầu (ví dụ: bện dây thừng)
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
    // Nếu đã hoàn thành hoặc đang nghiên cứu dở dang thì bỏ qua
    if (currentResearch && (currentResearch.status === 'completed' || currentResearch.status === 'in_progress' || currentResearch.status === 'paused' || currentResearch.status === 'discovered')) {
      continue;
    }

    // Tính tỷ lệ chủng loại nguyên liệu đang có trong kho đồ
    const totalIngredients = recipe.ingredients.length;
    let ownedDistinctCount = 0;

    for (const ing of recipe.ingredients) {
      const stock = getItemStockInInventory(state, ing.itemId);
      if (stock >= 1) {
        ownedDistinctCount++;
      }
    }

    // Quy tắc 80% chủng loại nguyên liệu:
    // 1 nguyên liệu: cần 1 (100%)
    // 2 nguyên liệu: cần 2 (100% >= 80%)
    // 3 nguyên liệu: cần >= 2 (2/3 = 66.7% ~ 80% cận biên, đủ để nảy sinh ý tưởng kết hợp)
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

      if (!state.discoveredRecipeIds.includes(recipe.id)) {
        state.discoveredRecipeIds.push(recipe.id);
      }

      state.logs.unshift({
        id: `disc_${Date.now()}_${recipe.id}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `[Ý niệm mới] Thu thập đủ vật liệu khơi gợi ý tưởng: Bản vẽ "${recipe.name}" đã được phát hiện! Hãy phân công thợ nghiên cứu để mở khóa chế tác.`,
        type: 'success',
      });

      anyNewDiscovery = true;
    }
  }

  return anyNewDiscovery;
}

/**
 * 2. BẮT ĐẦU HOẶC TIẾP TỤC NGHIÊN CỨU BẢN VẼ (RESEARCH)
 */
export function startOrResumeResearch(
  state: GameState,
  recipeId: string,
  survivorId: string
): GameState {
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
    text: `${survivor.name} đã bắt đầu nghiên cứu bản vẽ "${recipe.name}" (${Math.round((research.progressSeconds / research.totalSeconds) * 100)}%).`,
    type: 'info',
  });

  return next;
}

/**
 * 3. TẠM DỪNG TIẾN TRÌNH NGHIÊN CỨU (PAUSE RESEARCH)
 * Giữ nguyên tiến độ đã đạt được, trả thợ về trạng thái rảnh rỗi để làm việc khác
 */
export function pauseResearch(state: GameState, recipeId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.researches || !next.researches[recipeId]) return state;

  const research = next.researches[recipeId];
  const recipe = RECIPES_DATABASE[recipeId];
  if (research.status !== 'in_progress') return state;

  // Đồng bộ tiến độ từ người thực hiện nếu đang thao tác
  if (research.assignedSurvivorId) {
    const survivor = next.survivors.find(s => s.id === research.assignedSurvivorId);
    if (survivor && survivor.currentAction.type === 'researching' && survivor.currentAction.targetId === recipeId) {
      research.progressSeconds = survivor.currentAction.progressSeconds;
      survivor.currentAction = {
        type: 'idle',
        description: 'Nghỉ ngơi',
        progressSeconds: 0,
        totalSeconds: 0,
      };
    }
  }

  research.status = 'paused';

  next.logs.unshift({
    id: `res_pause_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `Đã tạm dừng nghiên cứu bản vẽ "${recipe ? recipe.name : recipeId}". Tiến độ đạt ${Math.round((research.progressSeconds / research.totalSeconds) * 100)}% được bảo lưu an toàn.`,
    type: 'info',
  });

  return next;
}

/**
 * 4. THÊM MỤC VÀO HÀNG ĐỢI CHẾ TÁC (ADD TO CRAFTING QUEUE)
 */
export function addCraftingQueueItem(
  state: GameState,
  recipeId: string,
  quantity: number = 1,
  assignedSurvivorId?: string
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) next.craftingQueue = [];

  const recipe = RECIPES_DATABASE[recipeId];
  if (!recipe) return state;

  // Kiểm tra điều kiện mở khoá đối với công thức chế tạo phức tạp
  if (recipe.type === 'crafting') {
    const research = next.researches ? next.researches[recipeId] : null;
    const isCompleted = research?.status === 'completed' || recipe.unlockedByDefault;
    if (!isCompleted) {
      return state;
    }
  }

  const cleanQuantity = Math.max(1, Math.min(20, Math.floor(quantity)));

  const newItem: CraftingQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    recipeId,
    quantity: cleanQuantity,
    completedCount: 0,
    assignedSurvivorId: assignedSurvivorId || undefined,
    progressSeconds: 0,
    totalSeconds: recipe.craftTimeSeconds,
    status: 'pending',
    createdAt: Date.now(),
  };

  next.craftingQueue.push(newItem);

  const assignedSurvivor = next.survivors.find(s => s.id === assignedSurvivorId);
  next.logs.unshift({
    id: `q_add_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `Đã thêm vào hàng đợi: ${cleanQuantity}x ${recipe.name}${assignedSurvivor ? ` (Phụ trách: ${assignedSurvivor.name})` : ' (Tự động nhận thợ)'}.`,
    type: 'info',
  });

  return next;
}

/**
 * 5. HỦY MỤC TRONG HÀNG ĐỢI (CANCEL QUEUE ITEM)
 * Hoàn lại nguyên liệu đang tạm giữ của đơn vị đang dở nếu có
 */
export function cancelCraftingQueueItem(state: GameState, queueItemId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) return state;

  const itemIdx = next.craftingQueue.findIndex(q => q.id === queueItemId);
  if (itemIdx === -1) return state;

  const queueItem = next.craftingQueue[itemIdx];
  const recipe = RECIPES_DATABASE[queueItem.recipeId];

  // Nếu đang chế tạo dở, trả thợ về idle và hoàn trả nguyên liệu của lượt hiện tại
  if (queueItem.status === 'in_progress' && queueItem.assignedSurvivorId) {
    const survivor = next.survivors.find(s => s.id === queueItem.assignedSurvivorId);
    if (survivor && survivor.currentAction.type === 'crafting') {
      survivor.currentAction = {
        type: 'idle',
        description: 'Nghỉ ngơi',
        progressSeconds: 0,
        totalSeconds: 0,
      };
    }

    if (recipe) {
      for (const ing of recipe.ingredients) {
        addItemToInventory(next.inventory, ing.itemId, ing.quantity);
      }
    }
  }

  next.craftingQueue.splice(itemIdx, 1);

  next.logs.unshift({
    id: `q_cancel_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `Đã hủy công việc trong hàng đợi: ${recipe ? recipe.name : queueItem.recipeId}.`,
    type: 'info',
  });

  return next;
}

/**
 * 6. TẠM DỪNG / TIẾP TỤC MỤC HÀNG ĐỢI (PAUSE / RESUME QUEUE ITEM)
 */
export function togglePauseCraftingQueueItem(state: GameState, queueItemId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) return state;

  const item = next.craftingQueue.find(q => q.id === queueItemId);
  if (!item) return state;

  if (item.status === 'in_progress') {
    // Tạm dừng
    item.status = 'paused';
    if (item.assignedSurvivorId) {
      const survivor = next.survivors.find(s => s.id === item.assignedSurvivorId);
      if (survivor && survivor.currentAction.type === 'crafting') {
        survivor.currentAction = {
          type: 'idle',
          description: 'Nghỉ ngơi',
          progressSeconds: 0,
          totalSeconds: 0,
        };
      }
    }
  } else if (item.status === 'paused') {
    item.status = 'pending';
  }

  return next;
}

/**
 * 7. THAY ĐỔI THỨ TỰ ƯU TIÊN TRONG HÀNG ĐỢI
 */
export function reorderCraftingQueue(state: GameState, queueItemId: string, direction: 'up' | 'down'): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) return state;

  const index = next.craftingQueue.findIndex(q => q.id === queueItemId);
  if (index === -1) return state;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= next.craftingQueue.length) return state;

  // Đổi chỗ
  const temp = next.craftingQueue[index];
  next.craftingQueue[index] = next.craftingQueue[targetIndex];
  next.craftingQueue[targetIndex] = temp;

  return next;
}

/**
 * 8. GÁN LẠI THỢ PHỤ TRÁCH MỤC TRONG HÀNG ĐỢI
 */
export function assignArtisanToQueueItem(state: GameState, queueItemId: string, survivorId?: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  if (!next.craftingQueue) return state;

  const item = next.craftingQueue.find(q => q.id === queueItemId);
  if (!item) return state;

  item.assignedSurvivorId = survivorId || undefined;
  return next;
}

/**
 * 9. TIẾN TRÌNH MÔ PHỎNG THỜI GIAN THỰC CHO NGHIÊN CỨU & HÀNG ĐỢI CHẾ TÁC
 * Được gọi trong mỗi tick của simEngine
 */
export function tickCraftingAndResearch(state: GameState, deltaGameSeconds: number): void {
  // 1. Quét tự động phát hiện bản vẽ mới dựa trên 80% nguyên liệu
  checkRecipeDiscoveries(state);

  if (!state.researches) state.researches = {};
  if (!state.craftingQueue) state.craftingQueue = [];

  const hasCampfire = state.buildings.some(b => b.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && b.isBuilt);

  // 2. XỬ LÝ TIẾN TRÌNH NGHIÊN CỨU BẢN VẼ
  for (const survivor of state.survivors) {
    if (survivor.currentAction.type === 'researching' && survivor.currentAction.targetId) {
      const recipeId = survivor.currentAction.targetId;
      const research = state.researches[recipeId];
      const recipe = RECIPES_DATABASE[recipeId];

      if (research && research.status === 'in_progress') {
        survivor.currentAction.progressSeconds += deltaGameSeconds;
        research.progressSeconds = survivor.currentAction.progressSeconds;

        if (research.progressSeconds >= research.totalSeconds) {
          // Hoàn thành nghiên cứu!
          research.status = 'completed';
          research.progressSeconds = research.totalSeconds;
          survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.12;

          survivor.currentAction = {
            type: 'idle',
            description: 'Nghỉ ngơi',
            progressSeconds: 0,
            totalSeconds: 0,
          };

          state.logs.unshift({
            id: `res_done_${Date.now()}_${recipeId}`,
            day: state.gameTime.day,
            timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
            text: `[Nghiên cứu hoàn tất] ${survivor.name} đã hoàn thành bản vẽ "${recipe ? recipe.name : recipeId}"! Công thức hiện đã sẵn sàng để sản xuất trong xưởng.`,
            type: 'success',
          });
        }
      }
    }
  }

  // 3. XỬ LÝ HÀNG ĐỢI CHẾ TÁC (CRAFTING QUEUE)
  // Xử lý các món đang in_progress
  for (let i = state.craftingQueue.length - 1; i >= 0; i--) {
    const queueItem = state.craftingQueue[i];
    const recipe = RECIPES_DATABASE[queueItem.recipeId];
    if (!recipe) continue;

    if (queueItem.status === 'in_progress' && queueItem.assignedSurvivorId) {
      const survivor = state.survivors.find(s => s.id === queueItem.assignedSurvivorId);
      if (!survivor || survivor.currentAction.type !== 'crafting') {
        // Mất thợ hoặc thợ bị gián đoạn, đưa về pending
        queueItem.status = 'pending';
        continue;
      }

      queueItem.progressSeconds += deltaGameSeconds;
      survivor.currentAction.progressSeconds = queueItem.progressSeconds;

      if (queueItem.progressSeconds >= queueItem.totalSeconds) {
        // Hoàn tất chế tác 1 sản phẩm!
        const ingredientQualities = queueItem.activeIngredientQualities || [];
        const synth = synthesizeCraftedQuality(ingredientQualities, survivor);
        const craftQuality = synth.quality;

        for (const out of recipe.outputs) {
          addItemToInventory(state.inventory, out.itemId, out.quantity, craftQuality);
        }

        survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.08;
        const qMeta = QUALITY_CONFIG[craftQuality];
        const qualitySuffix = craftQuality !== 'standard' ? ` [${qMeta.nameVi}]` : '';

        // Hao mòn công cụ phụ trợ nếu có
        const knifeTool = state.inventory.items.find(it => {
          const td = ITEMS_DATABASE[it.itemId];
          return td && (td.tags.includes('knife') || td.tags.includes('sharp')) && (it.condition || 0) > 0;
        });
        if (knifeTool) {
          const wear = calculateToolWear(knifeTool, 'crafting', survivor, state);
          applyToolWear(state, knifeTool.instanceId, wear.wearAmount, survivor);
        }

        queueItem.completedCount += 1;
        queueItem.progressSeconds = 0;
        queueItem.activeIngredientQualities = undefined;

        state.logs.unshift({
          id: `q_finish_unit_${Date.now()}_${queueItem.id}`,
          day: state.gameTime.day,
          timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
          text: `${survivor.name} đã chế tác thành công: ${recipe.name}${qualitySuffix} (${queueItem.completedCount}/${queueItem.quantity}).`,
          type: craftQuality === 'masterwork' || craftQuality === 'prime' ? 'success' : 'info',
        });

        // Kiểm tra xem đã đủ số lượng yêu cầu của toàn bộ mục hàng đợi chưa
        if (queueItem.completedCount >= queueItem.quantity) {
          state.craftingQueue.splice(i, 1);
          survivor.currentAction = {
            type: 'idle',
            description: 'Nghỉ ngơi',
            progressSeconds: 0,
            totalSeconds: 0,
          };
          continue;
        }

        // Nếu còn số lượng tiếp theo, kiểm tra xem có đủ nguyên liệu cho món kế tiếp không
        let canAffordNext = true;
        for (const ing of recipe.ingredients) {
          if (getItemStockInInventory(state, ing.itemId) < ing.quantity) {
            canAffordNext = false;
            break;
          }
        }

        if (canAffordNext) {
          // Trừ nguyên liệu cho đơn vị tiếp theo
          const nextQualities: ItemQuality[] = [];
          for (const ing of recipe.ingredients) {
            const matching = state.inventory.items.find(it => it.itemId === ing.itemId);
            if (matching) {
              const q = matching.quality || (matching.qualityBreakdown?.masterwork ? 'masterwork' : matching.qualityBreakdown?.prime ? 'prime' : matching.qualityBreakdown?.crude ? 'crude' : 'standard');
              nextQualities.push(q);
            }
            deductItemFromInventory(state.inventory, ing.itemId, ing.quantity);
          }
          queueItem.activeIngredientQualities = nextQualities;
          survivor.currentAction.progressSeconds = 0;
        } else {
          // Thiếu nguyên liệu, tạm dừng hàng đợi và giải phóng thợ
          queueItem.status = 'paused';
          survivor.currentAction = {
            type: 'idle',
            description: 'Nghỉ ngơi',
            progressSeconds: 0,
            totalSeconds: 0,
          };
          state.logs.unshift({
            id: `q_pause_nomat_${Date.now()}`,
            day: state.gameTime.day,
            timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
            text: `[Hàng đợi tạm dừng] Không đủ nguyên liệu để chế tác chiếc tiếp theo của "${recipe.name}".`,
            type: 'warning',
          });
        }
      }
    }
  }

  // 4. KÍCH HOẠT CÁC MỤC ĐANG 'PENDING' TRONG HÀNG ĐỢI
  for (const queueItem of state.craftingQueue) {
    if (queueItem.status !== 'pending') continue;

    const recipe = RECIPES_DATABASE[queueItem.recipeId];
    if (!recipe) continue;

    // Kiểm tra thợ khả dụng
    let candidateSurvivor = null;
    if (queueItem.assignedSurvivorId) {
      const target = state.survivors.find(s => s.id === queueItem.assignedSurvivorId);
      if (target && target.currentAction.type === 'idle') {
        candidateSurvivor = target;
      }
    } else {
      // Tìm thợ đang rảnh có ưu tiên nghề craft hợp lệ
      candidateSurvivor = state.survivors.find(
        s => s.currentAction.type === 'idle' && s.jobPriorities.craft !== 'disabled'
      );
    }

    if (!candidateSurvivor) continue;

    // Kiểm tra công cụ cần thiết
    if (recipe.requiredToolTag && !hasToolWithTag(state, recipe.requiredToolTag)) {
      continue;
    }

    // Kiểm tra lửa trại nếu công thức cần nhiệt
    if ((recipe.id === 'RECIPE_BOIL_WATER' || recipe.id === 'RECIPE_GRILL_FISH') && !hasCampfire) {
      continue;
    }

    // Kiểm tra nguyên liệu
    let hasIngredients = true;
    for (const ing of recipe.ingredients) {
      if (getItemStockInInventory(state, ing.itemId) < ing.quantity) {
        hasIngredients = false;
        break;
      }
    }
    if (!hasIngredients) continue;

    // Đủ điều kiện -> Khấu trừ nguyên liệu cho 1 đơn vị và bắt đầu!
    const qualities: ItemQuality[] = [];
    for (const ing of recipe.ingredients) {
      const matching = state.inventory.items.find(it => it.itemId === ing.itemId);
      if (matching) {
        const q = matching.quality || (matching.qualityBreakdown?.masterwork ? 'masterwork' : matching.qualityBreakdown?.prime ? 'prime' : matching.qualityBreakdown?.crude ? 'crude' : 'standard');
        qualities.push(q);
      }
      deductItemFromInventory(state.inventory, ing.itemId, ing.quantity);
    }

    queueItem.status = 'in_progress';
    queueItem.assignedSurvivorId = candidateSurvivor.id;
    queueItem.activeIngredientQualities = qualities;
    queueItem.progressSeconds = 0;

    candidateSurvivor.currentAction = {
      type: 'crafting',
      description: `Đang chế tác: ${recipe.name}`,
      targetId: queueItem.id,
      progressSeconds: 0,
      totalSeconds: recipe.craftTimeSeconds,
      resultPayload: { queueItemId: queueItem.id, recipeId: recipe.id },
    };

    state.logs.unshift({
      id: `q_start_${Date.now()}_${queueItem.id}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `${candidateSurvivor.name} đã bắt đầu chế tạo ${recipe.name} (${queueItem.completedCount + 1}/${queueItem.quantity}).`,
      type: 'info',
    });
  }
}
