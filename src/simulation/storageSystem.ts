import type { GameState, InventoryItem } from '../types';
import type {
  StorageAcceptanceResult,
  StorageLocation,
  StorageLocationSummary,
  StorageSystemState,
} from '../types/storageSimulation';
import '../types/storageSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { STORAGE_TYPES, inferStorageForm, storageTypeForBuilding } from '../data/storageDefinitions';
import {
  calculateInventoryOccupancy,
  getAvailableInventoryItemQuantity,
  getOrCreatePoiStorage,
  transferItemBetweenInventories,
} from './inventorySystem';
import { analyzeItemSpoilage } from './itemSimulation';
import { formatTimeOfDay } from './timeSystem';

const CAMP_POI_ID = 'AREA_CAMP_CLEARING';

function clonePolicy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function groundLocationId(poiId: string): string {
  return `storage_ground_${poiId}`;
}

function createGroundLocation(poiId: string): StorageLocation {
  const def = STORAGE_TYPES.STORAGE_GROUND_CACHE;
  return {
    id: groundLocationId(poiId),
    poiId,
    name: poiId === CAMP_POI_ID ? 'Kho tạm doanh trại' : 'Điểm tập kết',
    typeId: def.id,
    kind: def.kind,
    isGroundCache: true,
    capacity: { ...def.capacity },
    environment: { ...def.environment },
    policy: clonePolicy(def.policy),
    condition: 100,
  };
}

export function createStorageSystemState(): StorageSystemState {
  return {
    version: 1,
    locations: [createGroundLocation(CAMP_POI_ID)],
    alerts: [],
  };
}

export function ensureStorageSystem(state: GameState): StorageSystemState {
  state.poiStorages ||= {};
  state.storageSystem ||= createStorageSystemState();
  state.storageSystem.version = Math.max(1, state.storageSystem.version || 1);
  state.storageSystem.locations ||= [];
  state.storageSystem.alerts ||= [];

  const poiIds = new Set<string>([CAMP_POI_ID, ...Object.keys(state.poiStorages)]);
  for (const poiId of poiIds) {
    if (!state.storageSystem.locations.some(location => location.id === groundLocationId(poiId))) {
      state.storageSystem.locations.push(createGroundLocation(poiId));
    }
  }

  // New physical storage structures register as locations, but items remain in
  // the canonical POI inventory so production reservations can still find them.
  for (const building of state.buildings || []) {
    if (!building.isBuilt) continue;
    const type = storageTypeForBuilding(building.buildingId);
    if (!type) continue;
    const locationId = `storage_building_${building.id}`;
    if (state.storageSystem.locations.some(location => location.id === locationId)) continue;
    state.storageSystem.locations.push({
      id: locationId,
      poiId: building.areaId || CAMP_POI_ID,
      name: type.name,
      typeId: type.id,
      kind: type.kind,
      buildingInstanceId: building.id,
      parentStructureId: building.clusterId,
      capacity: { ...type.capacity },
      environment: { ...type.environment },
      policy: clonePolicy(type.policy),
      condition: Math.max(0, Math.min(100, building.condition || 100)),
    });
  }

  // Legacy/unassigned POI stock becomes ground cache stock without moving or
  // duplicating the underlying inventory instances.
  for (const [poiId, inventory] of Object.entries(state.poiStorages)) {
    const fallbackId = groundLocationId(poiId);
    for (const item of inventory.items || []) {
      if (!item.storageLocationId || !state.storageSystem.locations.some(location => location.id === item.storageLocationId)) {
        item.storageLocationId = fallbackId;
      }
    }
  }

  syncPoiAggregateCapacity(state);
  return state.storageSystem;
}

function syncPoiAggregateCapacity(state: GameState): void {
  if (!state.storageSystem) return;
  const byPoi = new Map<string, { weight: number; volume: number }>();
  for (const location of state.storageSystem.locations) {
    const current = byPoi.get(location.poiId) || { weight: 0, volume: 0 };
    current.weight += location.capacity.maxWeightKg;
    current.volume += location.capacity.maxVolumeL;
    byPoi.set(location.poiId, current);
  }
  for (const [poiId, totals] of byPoi.entries()) {
    const inventory = getOrCreatePoiStorage(state, poiId);
    inventory.maxWeightKg = Math.max(inventory.maxWeightKg, totals.weight);
    inventory.maxVolumeL = Math.max(inventory.maxVolumeL, totals.volume);
  }
}

export function getStorageLocationItems(state: GameState, locationId: string): InventoryItem[] {
  const system = state.storageSystem;
  const location = system?.locations.find(candidate => candidate.id === locationId);
  if (!location) return [];
  const inventory = state.poiStorages?.[location.poiId];
  if (!inventory) return [];
  return inventory.items.filter(item => item.storageLocationId === locationId);
}

export function summarizeStorageLocation(state: GameState, locationId: string): StorageLocationSummary | null {
  const location = state.storageSystem?.locations.find(candidate => candidate.id === locationId);
  if (!location) return null;
  const items = getStorageLocationItems(state, locationId);
  const occupancy = calculateInventoryOccupancy(items);
  const weightPct = location.capacity.maxWeightKg > 0 ? occupancy.weight / location.capacity.maxWeightKg : 1;
  const volumePct = location.capacity.maxVolumeL > 0 ? occupancy.volume / location.capacity.maxVolumeL : 1;
  const reservedUnits = items.reduce((sum, item) => sum + (item.reservedQuantity || 0), 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const usedPercent = Math.round(Math.max(weightPct, volumePct) * 100);
  return {
    location,
    usedWeightKg: occupancy.weight,
    usedVolumeL: occupancy.volume,
    usedPercent,
    itemStacks: items.length,
    availableUnits: Math.max(0, totalUnits - reservedUnits),
    reservedUnits,
    isFull: occupancy.weight >= location.capacity.maxWeightKg - 0.001 || occupancy.volume >= location.capacity.maxVolumeL - 0.001,
  };
}

function itemAllowedByPolicy(location: StorageLocation, item: InventoryItem): string[] {
  const def = ITEMS_DATABASE[item.itemId];
  if (!def) return ['Không có dữ liệu vật phẩm'];
  const type = STORAGE_TYPES[location.typeId];
  if (!type) return [];
  const form = inferStorageForm(def);
  const reasons: string[] = [];
  if (!type.allowedForms.includes(form)) reasons.push(`Dạng ${form} không phù hợp với nơi chứa này`);
  if (location.policy.allowCategories.length > 0 && !location.policy.allowCategories.includes(def.category)) reasons.push('Nhóm vật phẩm bị policy chặn');
  if (location.policy.forbiddenTags.some(tag => def.tags.includes(tag))) reasons.push('Vật phẩm có thuộc tính bị cấm tại nơi chứa này');
  return reasons;
}

export function canStoreItemInLocation(
  state: GameState,
  locationId: string,
  item: InventoryItem,
  requestedQuantity = item.quantity,
): StorageAcceptanceResult {
  const location = state.storageSystem?.locations.find(candidate => candidate.id === locationId);
  const def = ITEMS_DATABASE[item.itemId];
  if (!location || !def) {
    return { accepted: false, maxAcceptableQuantity: 0, reasons: ['Nơi chứa hoặc vật phẩm không hợp lệ'], remainingWeightKg: 0, remainingVolumeL: 0 };
  }

  const summary = summarizeStorageLocation(state, locationId);
  const usedWeight = summary?.usedWeightKg || 0;
  const usedVolume = summary?.usedVolumeL || 0;
  const remainingWeightKg = Math.max(0, location.capacity.maxWeightKg - usedWeight);
  const remainingVolumeL = Math.max(0, location.capacity.maxVolumeL - usedVolume);
  const maxByWeight = def.weight > 0 ? Math.floor((remainingWeightKg + 1e-6) / def.weight) : requestedQuantity;
  const maxByVolume = def.volume > 0 ? Math.floor((remainingVolumeL + 1e-6) / def.volume) : requestedQuantity;
  const maxAcceptableQuantity = Math.max(0, Math.min(requestedQuantity, maxByWeight, maxByVolume, getAvailableInventoryItemQuantity(item)));
  const reasons = itemAllowedByPolicy(location, item);
  if (maxByWeight <= 0) reasons.push('Không đủ tải trọng còn lại');
  if (maxByVolume <= 0) reasons.push('Không đủ dung tích còn lại');

  return {
    accepted: reasons.length === 0 && maxAcceptableQuantity > 0,
    maxAcceptableQuantity: reasons.length === 0 ? maxAcceptableQuantity : 0,
    reasons,
    remainingWeightKg,
    remainingVolumeL,
  };
}

function performPartyToLocation(next: GameState, locationId: string, instanceId: string, quantity?: number): { success: boolean; moved: number; message: string } {
  const system = ensureStorageSystem(next);
  const location = system.locations.find(candidate => candidate.id === locationId);
  if (!location) return { success: false, moved: 0, message: 'Không tìm thấy nơi chứa' };
  const sourceItem = next.inventory.items.find(item => item.instanceId === instanceId);
  if (!sourceItem) return { success: false, moved: 0, message: 'Không tìm thấy vật phẩm đang mang' };
  const acceptance = canStoreItemInLocation(next, locationId, sourceItem, quantity ?? sourceItem.quantity);
  if (!acceptance.accepted) return { success: false, moved: 0, message: acceptance.reasons[0] || 'Không thể cất vật phẩm' };

  const target = getOrCreatePoiStorage(next, location.poiId);
  const originalLocation = sourceItem.storageLocationId;
  sourceItem.storageLocationId = locationId;
  const result = transferItemBetweenInventories(next.inventory, target, instanceId, acceptance.maxAcceptableQuantity);
  const remainingSource = next.inventory.items.find(item => item.instanceId === instanceId);
  if (remainingSource) remainingSource.storageLocationId = originalLocation;
  return result;
}

export function storeItemInLocation(state: GameState, locationId: string, instanceId: string, quantity?: number): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const result = performPartyToLocation(next, locationId, instanceId, quantity);
  next.logs.unshift({
    id: `storage_store_${Date.now()}_${instanceId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: result.success ? `[Storage] ${result.message}` : `[Storage] ${result.message}`,
    type: result.success ? 'info' : 'warning',
  });
  return next;
}

export function storeAllInLocation(state: GameState, locationId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  ensureStorageSystem(next);
  let moved = 0;
  for (const instanceId of [...next.inventory.items.map(item => item.instanceId)]) {
    const result = performPartyToLocation(next, locationId, instanceId);
    if (result.success) moved += result.moved;
  }
  next.logs.unshift({
    id: `storage_store_all_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: moved > 0 ? `[Storage] Đã cất ${moved} đơn vị vật phẩm.` : '[Storage] Không có vật phẩm phù hợp hoặc nơi chứa đã đầy.',
    type: moved > 0 ? 'success' : 'warning',
  });
  return next;
}

export function takeItemFromLocation(state: GameState, locationId: string, instanceId: string, quantity?: number): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureStorageSystem(next);
  const location = system.locations.find(candidate => candidate.id === locationId);
  if (!location) return state;
  const source = getOrCreatePoiStorage(next, location.poiId);
  const sourceItem = source.items.find(item => item.instanceId === instanceId && item.storageLocationId === locationId);
  if (!sourceItem) return state;

  const originalLocation = sourceItem.storageLocationId;
  sourceItem.storageLocationId = undefined;
  const result = transferItemBetweenInventories(source, next.inventory, instanceId, quantity);
  const remaining = source.items.find(item => item.instanceId === instanceId);
  if (remaining) remaining.storageLocationId = originalLocation;
  next.logs.unshift({
    id: `storage_take_${Date.now()}_${instanceId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: result.success ? `[Storage] ${result.message}` : `[Storage] ${result.message}`,
    type: result.success ? 'info' : 'warning',
  });
  return next;
}

/** Presentation slots are derived only. One empty row is shown while capacity remains. */
export function getDynamicStorageSlotCount(itemStackCount: number, columns: number, isFull: boolean): number {
  const safeColumns = Math.max(1, Math.floor(columns));
  const occupiedRows = Math.ceil(itemStackCount / safeColumns);
  const rows = Math.max(1, occupiedRows + (isFull ? 0 : 1));
  return Math.max(itemStackCount, rows * safeColumns);
}

export function tickStorageSimulation(state: GameState, deltaGameMinutes: number): void {
  const system = ensureStorageSystem(state);
  const alerts = [] as StorageSystemState['alerts'];

  for (const location of system.locations) {
    const building = location.buildingInstanceId ? state.buildings.find(candidate => candidate.id === location.buildingInstanceId) : undefined;
    if (building) location.condition = Math.max(0, Math.min(100, building.condition));
    const conditionRatio = Math.max(0.15, location.condition / 100);
    const moistureProtection = location.environment.moistureProtection * conditionRatio;
    const pestProtection = location.environment.pestProtection * conditionRatio;
    const temperatureBuffer = location.environment.temperatureBuffer * conditionRatio;
    const preservationMultiplier = Math.max(0.38, 1.16 - moistureProtection * 0.0032 - pestProtection * 0.0014 - temperatureBuffer * 0.0022);

    const items = getStorageLocationItems(state, location.id);
    for (const item of items) {
      const def = ITEMS_DATABASE[item.itemId];
      if (!def) continue;
      const targetMoisture = Math.max(4, state.weather.humidityPercent * (1 - moistureProtection / 135));
      const currentMoisture = item.moisture ?? targetMoisture;
      item.moisture = Math.max(0, Math.min(100, currentMoisture + (targetMoisture - currentMoisture) * Math.min(1, deltaGameMinutes / 180)));
      item.pestDamage = Math.max(0, Math.min(100, (item.pestDamage || 0) + Math.max(0, 35 - pestProtection) * deltaGameMinutes / 30000));
      item.spoilageMultiplier = preservationMultiplier;

      if (def.freshnessMaxDays && item.freshness !== undefined) {
        const analysis = analyzeItemSpoilage(item, def, state);
        if (analysis) item.freshness = Math.max(0, item.freshness - (analysis.effectiveDailyRate / 1440) * deltaGameMinutes);
        if (item.freshness <= 0) {
          item.itemId = 'ITEM_ORGANIC_ROT';
          item.freshness = undefined;
          item.spoilageMultiplier = undefined;
          alerts.push({ id: `spoil_${location.id}_${item.instanceId}`, locationId: location.id, severity: 'warning', message: `${def.name} đã phân hủy trong ${location.name}.` });
        }
      }
    }

    const summary = summarizeStorageLocation(state, location.id);
    if (summary?.isFull) alerts.push({ id: `full_${location.id}`, locationId: location.id, severity: 'warning', message: `${location.name} đã đầy dung tích hoặc tải trọng.` });
    if (items.some(item => (item.moisture || 0) > 75)) alerts.push({ id: `wet_${location.id}`, locationId: location.id, severity: 'warning', message: `${location.name} có vật phẩm đang quá ẩm.` });
  }

  system.alerts = alerts.slice(0, 20);
}