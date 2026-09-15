import { GameState, ItemQuality } from '../types';
import type { MaintenanceMode } from '../types/maintenanceSimulation';
import type { ComponentModification } from '../types/upgradeSimulation';
import type { ClusterType } from '../types/buildingSimulation';
import type { StructureMaintenanceMode } from '../types/structureMaintenanceSimulation';
import type { StoragePriority } from '../types/storageSimulation';
import '../types/buildingSimulation';
import '../types/structureMaintenanceSimulation';
import '../types/storageSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { AREAS_DATABASE } from '../data/areas';
import { RECIPES_DATABASE } from '../data/recipes';
import {
  deductItemFromInventory,
  getAvailableInventoryStock,
  getOrCreatePoiStorage,
} from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { analyzeResearchEvidence, toggleTrackResearch } from './researchSystem';
import { cancelMaintenanceJob, queueMaintenanceJob, togglePauseMaintenanceJob } from './maintenanceSystem';
import { cancelUpgradeJob, queueComponentModification, queueTierUpgrade, togglePauseUpgradeJob } from './upgradeSystem';
import { dismantleTool } from './dismantleSystem';
import { establishClusterAtCandidate } from './buildingClusterSystem';
import { planSpatialConstruction } from './buildingConstructionSystem';
import {
  cancelSpatialConstruction,
  togglePauseSpatialConstruction,
} from './buildingConstructionCommands';
import {
  cancelStructureWorkJob,
  queueStructureMaintenance,
  queueStructureModification,
  togglePauseStructureWorkJob,
} from './structureMaintenanceSystem';
import {
  storeAllInLocation,
  storeItemInLocation,
  takeItemFromLocation,
} from './storageSystem';
import {
  cancelStorageHaul,
  queueStorageHaul,
  queueStorageOptimizationPass,
  togglePauseStorageHaul,
} from './storageHaulSystem';
import {
  removeStorageStockRule,
  setStorageAutoHaul,
  setStoragePriority,
  setStorageStockRule,
} from './storagePolicySystem';

export function startGatheringTask(
  state: GameState,
  survivorId: string,
  nodeId: string,
  targetAreaId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(candidate => candidate.id === survivorId);
  if (!survivor || survivor.currentAction.type !== 'idle') return state;

  let targetNode = null;
  let resolvedAreaId = targetAreaId || '';
  for (const area of Object.values(AREAS_DATABASE)) {
    const found = area.nodes.find(node => node.id === nodeId);
    if (found) {
      targetNode = found;
      if (!resolvedAreaId) resolvedAreaId = area.id;
      break;
    }
  }
  if (!targetNode) return state;

  const pool = next.resourcePools?.[nodeId];
  if (pool && pool.currentStock < 1) {
    next.logs.unshift({
      id: `act_depleted_${Date.now()}`,
      day: next.gameTime.day,
      timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
      text: `Bãi "${targetNode.name}" đã cạn kiệt (${Math.round(pool.currentStock * 10) / 10}/${pool.maxStock})! Hãy để hệ sinh thái phục hồi.`,
      type: 'warning',
    });
    return next;
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

function handleProductionCommand(state: GameState, survivorId: string, command: string): GameState | null {
  if (!command.startsWith('__')) return null;
  const parts = command.split(':');
  const opcode = parts[0];

  if (opcode === '__research_analyze__') return parts[1] ? analyzeResearchEvidence(state, parts[1], survivorId || undefined) : state;
  if (opcode === '__research_track__') return parts[1] ? toggleTrackResearch(state, parts[1]) : state;

  if (opcode === '__maintenance__') {
    const mode = parts[1] as MaintenanceMode;
    return parts[2] ? queueMaintenanceJob(state, parts[2], mode, parts[3] || undefined, survivorId || undefined) : state;
  }
  if (opcode === '__maintenance_cancel__') return parts[1] ? cancelMaintenanceJob(state, parts[1]) : state;
  if (opcode === '__maintenance_pause__') return parts[1] ? togglePauseMaintenanceJob(state, parts[1]) : state;

  if (opcode === '__upgrade_tier__') return parts[1] ? queueTierUpgrade(state, parts[1], survivorId || undefined) : state;
  if (opcode === '__upgrade_mod__') {
    const modification = parts[1] as ComponentModification;
    return parts[2] ? queueComponentModification(state, parts[2], modification, parts[3] || undefined, survivorId || undefined) : state;
  }
  if (opcode === '__upgrade_cancel__') return parts[1] ? cancelUpgradeJob(state, parts[1]) : state;
  if (opcode === '__upgrade_pause__') return parts[1] ? togglePauseUpgradeJob(state, parts[1]) : state;

  if (opcode === '__dismantle__') {
    const result = parts[1] ? dismantleTool(state, parts[1], survivorId || undefined) : null;
    return result?.state || state;
  }

  if (opcode === '__storage_store__') {
    const locationId = parts[1];
    const instanceId = parts[2];
    const quantity = parts[3] ? Number(parts[3]) : undefined;
    return locationId && instanceId ? storeItemInLocation(state, locationId, instanceId, quantity) : state;
  }
  if (opcode === '__storage_take__') {
    const locationId = parts[1];
    const instanceId = parts[2];
    const quantity = parts[3] ? Number(parts[3]) : undefined;
    return locationId && instanceId ? takeItemFromLocation(state, locationId, instanceId, quantity) : state;
  }
  if (opcode === '__storage_store_all__') return parts[1] ? storeAllInLocation(state, parts[1]) : state;

  if (opcode === '__storage_haul__') {
    const source = parts[1];
    const target = parts[2];
    const itemId = parts[3];
    const quantity = Number(parts[4] || 1);
    return source && target && itemId ? queueStorageHaul(state, source, target, itemId, quantity, survivorId || undefined) : state;
  }
  if (opcode === '__storage_haul_pause__') return parts[1] ? togglePauseStorageHaul(state, parts[1]) : state;
  if (opcode === '__storage_haul_cancel__') return parts[1] ? cancelStorageHaul(state, parts[1]) : state;
  if (opcode === '__storage_optimize__') return queueStorageOptimizationPass(state, parts[1] && parts[1] !== 'all' ? parts[1] : undefined);
  if (opcode === '__storage_autohaul__') return parts[1] ? setStorageAutoHaul(state, parts[1], parts[2] === '1') : state;
  if (opcode === '__storage_priority__') return parts[1] && parts[2] ? setStoragePriority(state, parts[1], parts[2] as StoragePriority) : state;
  if (opcode === '__storage_stockrule__') {
    const locationId = parts[1];
    const itemId = parts[2];
    const min = Number(parts[3] || 0);
    const max = parts[4] === '' || parts[4] === undefined ? undefined : Number(parts[4]);
    return locationId && itemId ? setStorageStockRule(state, locationId, itemId, min, max) : state;
  }
  if (opcode === '__storage_stockrule_remove__') return parts[1] && parts[2] ? removeStorageStockRule(state, parts[1], parts[2]) : state;

  return state;
}

export function startCraftingTask(state: GameState, survivorId: string, recipeId: string): GameState {
  const routed = handleProductionCommand(state, survivorId, recipeId);
  if (routed) return routed;

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(candidate => candidate.id === survivorId);
  const recipe = RECIPES_DATABASE[recipeId];
  if (!survivor || !recipe || survivor.currentAction.type !== 'idle') return state;

  const ingredientQualities: ItemQuality[] = [];
  for (const ingredient of recipe.ingredients) {
    const matching = next.inventory.items.find(item => item.itemId === ingredient.itemId && item.quantity > (item.reservedQuantity || 0));
    if (matching) {
      ingredientQualities.push(
        matching.quality ||
        (matching.qualityBreakdown?.masterwork ? 'masterwork' :
          matching.qualityBreakdown?.prime ? 'prime' :
            matching.qualityBreakdown?.crude ? 'crude' : 'standard'),
      );
    }
    if (!deductItemFromInventory(next.inventory, ingredient.itemId, ingredient.quantity)) return state;
  }

  survivor.currentAction = {
    type: 'crafting',
    description: `Đang chế tác: ${recipe.name}`,
    targetId: recipeId,
    progressSeconds: 0,
    totalSeconds: recipe.craftTimeSeconds,
    resultPayload: { recipeOutputs: recipe.outputs, recipeName: recipe.name, recipeId, ingredientQualities },
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

function handleBuildingCommand(state: GameState, survivorId: string, command: string): GameState | null {
  if (!command.startsWith('__')) return null;
  const parts = command.split(':');
  const opcode = parts[0];

  if (opcode === '__cluster_establish__') {
    const poiId = parts[1];
    const type = parts[2] as ClusterType;
    const candidateId = parts[3];
    return poiId && type && candidateId
      ? establishClusterAtCandidate(state, poiId, type, candidateId, survivorId || undefined)
      : state;
  }

  if (opcode === '__cluster_build__') {
    const clusterId = parts[1];
    const buildingId = parts[2];
    return clusterId && buildingId
      ? planSpatialConstruction(state, survivorId || undefined, clusterId, buildingId)
      : state;
  }

  if (opcode === '__construction_pause__') return parts[1] ? togglePauseSpatialConstruction(state, parts[1]) : state;
  if (opcode === '__construction_cancel__') return parts[1] ? cancelSpatialConstruction(state, parts[1]) : state;

  if (opcode === '__structure_maintenance__') {
    const mode = parts[1] as StructureMaintenanceMode;
    const buildingInstanceId = parts[2];
    const componentId = parts[3];
    return buildingInstanceId && componentId
      ? queueStructureMaintenance(state, buildingInstanceId, componentId, mode, survivorId || undefined)
      : state;
  }
  if (opcode === '__structure_modify__') {
    const buildingInstanceId = parts[1];
    const modificationId = parts[2];
    return buildingInstanceId && modificationId
      ? queueStructureModification(state, buildingInstanceId, modificationId, survivorId || undefined)
      : state;
  }
  if (opcode === '__structure_work_pause__') return parts[1] ? togglePauseStructureWorkJob(state, parts[1]) : state;
  if (opcode === '__structure_work_cancel__') return parts[1] ? cancelStructureWorkJob(state, parts[1]) : state;

  return state;
}

function totalAvailableForConstruction(state: GameState, areaId: string, itemId: string): number {
  const poiStorage = getOrCreatePoiStorage(state, areaId);
  return getAvailableInventoryStock(poiStorage, itemId) + getAvailableInventoryStock(state.inventory, itemId);
}

export function startConstructionTask(
  state: GameState,
  survivorId: string,
  buildingId: string,
  areaOrClusterId: string = 'AREA_CAMP_CLEARING',
): GameState {
  const routed = handleBuildingCommand(state, survivorId, buildingId);
  if (routed) return routed;

  if (areaOrClusterId.startsWith('cluster_')) {
    return planSpatialConstruction(state, survivorId || undefined, areaOrClusterId, buildingId);
  }

  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const survivor = next.survivors.find(candidate => candidate.id === survivorId);
  const blueprint = BUILDINGS_DATABASE[buildingId];
  if (!survivor || !blueprint || survivor.currentAction.type !== 'idle') return state;

  const areaId = areaOrClusterId.startsWith('AREA_') ? areaOrClusterId : 'AREA_CAMP_CLEARING';
  const poiStorage = getOrCreatePoiStorage(next, areaId);
  let building = next.buildings.find(candidate => !candidate.isBuilt && candidate.buildingId === buildingId && candidate.areaId === areaId && !candidate.clusterId);

  if (!building) {
    const missing = blueprint.cost.filter(cost => totalAvailableForConstruction(next, areaId, cost.itemId) < cost.quantity);
    if (missing.length) {
      next.logs.unshift({
        id: `bld_missing_${Date.now()}`,
        day: next.gameTime.day,
        timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
        text: `Chưa đủ vật liệu để xây ${blueprint.name}: ${missing.map(cost => `${ITEMS_DATABASE[cost.itemId]?.name || cost.itemId} ${totalAvailableForConstruction(next, areaId, cost.itemId)}/${cost.quantity}`).join(', ')}.`,
        type: 'warning',
      });
      return next;
    }

    for (const cost of blueprint.cost) {
      let needed = cost.quantity;
      const fromPoi = Math.min(getAvailableInventoryStock(poiStorage, cost.itemId), needed);
      if (fromPoi > 0) {
        deductItemFromInventory(poiStorage, cost.itemId, fromPoi);
        needed -= fromPoi;
      }
      if (needed > 0) deductItemFromInventory(next.inventory, cost.itemId, needed);
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

  survivor.currentAction = {
    type: 'building',
    description: `Đang thi công: ${blueprint.name}`,
    targetId: building.id,
    progressSeconds: building.buildProgressSeconds,
    totalSeconds: building.totalBuildSeconds,
  };

  next.logs.unshift({
    id: `bld_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `${survivor.name} đã bắt đầu xây dựng ${blueprint.name} tại ${AREAS_DATABASE[areaId]?.name || 'khu vực'}.`,
    type: 'info',
  });
  return next;
}
