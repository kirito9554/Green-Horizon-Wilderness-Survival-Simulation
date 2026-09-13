import { GameState, ItemQuality } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { AREAS_DATABASE } from '../data/areas';
import { RECIPES_DATABASE } from '../data/recipes';
import { deductItemFromInventory, getOrCreatePoiStorage } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';

export function startGatheringTask(
  state: GameState, 
  survivorId: string, 
  nodeId: string,
  targetAreaId?: string
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(s => s.id === survivorId);
  if (!survivor || survivor.currentAction.type !== 'idle') return state;

  // Find node definition in areas
  let targetNode = null;
  let resolvedAreaId = targetAreaId || '';
  for (const area of Object.values(AREAS_DATABASE)) {
    const found = area.nodes.find(n => n.id === nodeId);
    if (found) {
      targetNode = found;
      if (!resolvedAreaId) resolvedAreaId = area.id;
      break;
    }
  }
  if (!targetNode) return state;

  // Verify Resource Pool has harvestable stock
  if (next.resourcePools && next.resourcePools[nodeId]) {
    const pool = next.resourcePools[nodeId];
    if (pool.currentStock < 1) {
      next.logs.unshift({
        id: `act_depleted_${Date.now()}`,
        day: next.gameTime.day,
        timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
        text: `Bãi "${targetNode.name}" đã cạn kiệt (${Math.round(pool.currentStock * 10) / 10}/${pool.maxStock})! Hãy để hệ sinh thái phục hồi.`,
        type: 'warning',
      });
      return next;
    }
  }

  survivor.currentAction = {
    type: 'gathering',
    description: `Đang khai thác: ${targetNode.name}`,
    targetId: nodeId,
    progressSeconds: 0,
    totalSeconds: targetNode.gatherTimeSeconds,
    resultPayload: {
      nodeItemId: targetNode.itemId,
      minYield: targetNode.minYield,
      maxYield: targetNode.maxYield,
      nodeName: targetNode.name,
      targetAreaId: resolvedAreaId,
      deliverToPoiStorage: Boolean(resolvedAreaId),
    },
  };

  next.logs.unshift({
    id: `act_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `${survivor.name} bắt đầu khai thác ${targetNode.name} nhập kho địa điểm.`,
    type: 'info',
  });

  return next;
}

export function startCraftingTask(
  state: GameState, 
  survivorId: string, 
  recipeId: string
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(s => s.id === survivorId);
  const recipe = RECIPES_DATABASE[recipeId];
  if (!survivor || !recipe || survivor.currentAction.type !== 'idle') return state;

  const ingredientQualities: ItemQuality[] = [];

  // Deduct ingredients upfront and record their quality
  for (const ing of recipe.ingredients) {
    const matching = next.inventory.items.find(i => i.itemId === ing.itemId);
    if (matching) {
      const q = matching.quality || (matching.qualityBreakdown?.masterwork ? 'masterwork' : matching.qualityBreakdown?.prime ? 'prime' : matching.qualityBreakdown?.crude ? 'crude' : 'standard');
      ingredientQualities.push(q);
    }
    const success = deductItemFromInventory(next.inventory, ing.itemId, ing.quantity);
    if (!success) {
      // Not enough ingredients
      return state;
    }
  }

  survivor.currentAction = {
    type: 'crafting',
    description: `Đang chế tác: ${recipe.name}`,
    targetId: recipeId,
    progressSeconds: 0,
    totalSeconds: recipe.craftTimeSeconds,
    resultPayload: {
      recipeOutputs: recipe.outputs,
      recipeName: recipe.name,
      recipeId,
      ingredientQualities,
    },
  };

  next.logs.unshift({
    id: `craft_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `${survivor.name} bắt đầu chế tạo ${recipe.name}.`,
    type: 'info',
  });

  return next;
}

export function startConstructionTask(
  state: GameState, 
  survivorId: string, 
  buildingId: string,
  areaId: string = 'AREA_CAMP_CLEARING'
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(s => s.id === survivorId);
  const blueprint = BUILDINGS_DATABASE[buildingId];
  if (!survivor || !blueprint || survivor.currentAction.type !== 'idle') return state;

  // Lấy hoặc khởi tạo kho POI để có thể dùng tài nguyên tại chỗ
  const poiStorage = getOrCreatePoiStorage(next, areaId);

  // Find or create constructed building entry for this specific POI
  let building = next.buildings.find(
    b => b.buildingId === buildingId && (b.areaId === areaId || (!b.areaId && areaId === 'AREA_CAMP_CLEARING'))
  );

  if (!building) {
    // Kiểm tra và khấu trừ vật liệu (ưu tiên từ kho POI trước, nếu thiếu thì trừ từ túi Party)
    for (const cost of blueprint.cost) {
      let needed = cost.quantity;

      // 1. Thử trừ từ kho POI
      const poiCount = poiStorage.items
        .filter(i => i.itemId === cost.itemId)
        .reduce((sum, i) => sum + i.quantity, 0);
      const fromPoi = Math.min(poiCount, needed);
      if (fromPoi > 0) {
        deductItemFromInventory(poiStorage, cost.itemId, fromPoi);
        needed -= fromPoi;
      }

      // 2. Phần còn lại trừ từ túi party
      if (needed > 0) {
        const partyOk = deductItemFromInventory(next.inventory, cost.itemId, needed);
        if (!partyOk) {
          // Không đủ vật liệu, rollback và huỷ
          return state;
        }
      }
    }

    building = {
      id: `bld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      buildingId,
      condition: 100,
      isBuilt: false,
      buildProgressSeconds: 0,
      totalBuildSeconds: blueprint.buildTimeSeconds,
      areaId,
    };
    next.buildings.push(building);
  }

  if (building.isBuilt) return state;

  survivor.currentAction = {
    type: 'building',
    description: `Đang thi công: ${blueprint.name}`,
    targetId: building.id,
    progressSeconds: building.buildProgressSeconds,
    totalSeconds: building.totalBuildSeconds,
  };

  const areaName = AREAS_DATABASE[areaId]?.name || 'khu vực';
  next.logs.unshift({
    id: `bld_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `${survivor.name} đã bắt đầu xây dựng ${blueprint.name} tại ${areaName}.`,
    type: 'info',
  });

  return next;
}
