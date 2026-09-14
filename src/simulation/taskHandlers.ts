import { GameState, ItemQuality } from '../types';
import type { MaintenanceMode } from '../types/maintenanceSimulation';
import type { ComponentModification } from '../types/upgradeSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { AREAS_DATABASE } from '../data/areas';
import { RECIPES_DATABASE } from '../data/recipes';
import { deductItemFromInventory, getOrCreatePoiStorage } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { analyzeResearchEvidence, toggleTrackResearch } from './researchSystem';
import {
  cancelMaintenanceJob,
  queueMaintenanceJob,
  togglePauseMaintenanceJob,
} from './maintenanceSystem';
import {
  cancelUpgradeJob,
  queueComponentModification,
  queueTierUpgrade,
  togglePauseUpgradeJob,
} from './upgradeSystem';
import { dismantleTool } from './dismantleSystem';

export function startGatheringTask(
  state: GameState,
  survivorId: string,
  nodeId: string,
  targetAreaId?: string
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(s => s.id === survivorId);
  if (!survivor || survivor.currentAction.type !== 'idle') return state;

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

/**
 * Compatibility production command gateway.
 *
 * App and ManageCampModal historically expose one direct-craft callback. Deep
 * production systems reuse that callback for commands so the simulation stays
 * reducer-driven without forcing a breaking prop migration across the whole app.
 */
function handleProductionCommand(state: GameState, survivorId: string, command: string): GameState | null {
  if (!command.startsWith('__')) return null;
  const parts = command.split(':');
  const opcode = parts[0];

  if (opcode === '__research_analyze__') {
    const recipeId = parts[1];
    return recipeId ? analyzeResearchEvidence(state, recipeId, survivorId || undefined) : state;
  }
  if (opcode === '__research_track__') {
    const recipeId = parts[1];
    return recipeId ? toggleTrackResearch(state, recipeId) : state;
  }

  if (opcode === '__maintenance__') {
    const mode = parts[1] as MaintenanceMode;
    const instanceId = parts[2];
    const componentId = parts[3] || undefined;
    return instanceId
      ? queueMaintenanceJob(state, instanceId, mode, componentId, survivorId || undefined)
      : state;
  }
  if (opcode === '__maintenance_cancel__') {
    return parts[1] ? cancelMaintenanceJob(state, parts[1]) : state;
  }
  if (opcode === '__maintenance_pause__') {
    return parts[1] ? togglePauseMaintenanceJob(state, parts[1]) : state;
  }

  if (opcode === '__upgrade_tier__') {
    return parts[1] ? queueTierUpgrade(state, parts[1], survivorId || undefined) : state;
  }
  if (opcode === '__upgrade_mod__') {
    const modification = parts[1] as ComponentModification;
    const instanceId = parts[2];
    const componentId = parts[3] || undefined;
    return instanceId
      ? queueComponentModification(state, instanceId, modification, componentId, survivorId || undefined)
      : state;
  }
  if (opcode === '__upgrade_cancel__') {
    return parts[1] ? cancelUpgradeJob(state, parts[1]) : state;
  }
  if (opcode === '__upgrade_pause__') {
    return parts[1] ? togglePauseUpgradeJob(state, parts[1]) : state;
  }

  if (opcode === '__dismantle__') {
    const result = parts[1] ? dismantleTool(state, parts[1], survivorId || undefined) : null;
    return result?.state || state;
  }

  return state;
}

export function startCraftingTask(
  state: GameState,
  survivorId: string,
  recipeId: string
): GameState {
  const routed = handleProductionCommand(state, survivorId, recipeId);
  if (routed) return routed;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(s => s.id === survivorId);
  const recipe = RECIPES_DATABASE[recipeId];
  if (!survivor || !recipe || survivor.currentAction.type !== 'idle') return state;

  const ingredientQualities: ItemQuality[] = [];
  for (const ing of recipe.ingredients) {
    const matching = next.inventory.items.find(i => i.itemId === ing.itemId && i.quantity > (i.reservedQuantity || 0));
    if (matching) {
      const q = matching.quality || (matching.qualityBreakdown?.masterwork ? 'masterwork' : matching.qualityBreakdown?.prime ? 'prime' : matching.qualityBreakdown?.crude ? 'crude' : 'standard');
      ingredientQualities.push(q);
    }
    const success = deductItemFromInventory(next.inventory, ing.itemId, ing.quantity);
    if (!success) return state;
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

  const poiStorage = getOrCreatePoiStorage(next, areaId);
  let building = next.buildings.find(
    b => b.buildingId === buildingId && (b.areaId === areaId || (!b.areaId && areaId === 'AREA_CAMP_CLEARING'))
  );

  if (!building) {
    for (const cost of blueprint.cost) {
      let needed = cost.quantity;
      const poiCount = poiStorage.items
        .filter(i => i.itemId === cost.itemId)
        .reduce((sum, i) => sum + Math.max(0, i.quantity - (i.reservedQuantity || 0)), 0);
      const fromPoi = Math.min(poiCount, needed);
      if (fromPoi > 0) {
        deductItemFromInventory(poiStorage, cost.itemId, fromPoi);
        needed -= fromPoi;
      }

      if (needed > 0) {
        const partyOk = deductItemFromInventory(next.inventory, cost.itemId, needed);
        if (!partyOk) return state;
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
