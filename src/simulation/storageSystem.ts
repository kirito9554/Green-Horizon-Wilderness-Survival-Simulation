import type { GameState, InventoryItem, StorageInventory } from '../types';
import type {
  StorageAcceptanceResult,
  StorageLocation,
  StorageLocationSummary,
  StorageSystemState,
} from '../types/storageSimulation';
import '../types/storageSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { STORAGE_TYPES, inferStorageForm, storageTypeForBuilding } from '../data/storageDefinitions';
import { STRUCTURE_MODIFICATIONS } from '../data/structureModifications';
import {
  calculateInventoryOccupancy,
  getAvailableInventoryItemQuantity,
  getOrCreatePoiStorage,
  transferItemBetweenInventories,
} from './inventorySystem';
import { analyzeItemSpoilage } from './itemSimulation';
import { formatTimeOfDay } from './timeSystem';

const CAMP_POI_ID = 'AREA_CAMP_CLEARING';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function groundLocationId(poiId: string): string {
  return `storage_ground_${poiId}`;
}

function normalizePolicy(location: StorageLocation): void {
  location.policy.priority ||= location.isGroundCache ? 'low' : 'normal';
  location.policy.autoHaul = Boolean(location.policy.autoHaul);
  location.policy.allowCategories ||= [];
  location.policy.preferredTags ||= [];
  location.policy.forbiddenTags ||= [];
  location.policy.stockRules ||= [];
  location.policy.acceptDamaged = location.policy.acceptDamaged !== false;
  location.policy.acceptSpoiled = Boolean(location.policy.acceptSpoiled);
}

function createGroundLocation(poiId: string): StorageLocation {
  const def = STORAGE_TYPES.STORAGE_GROUND_CACHE;
  const isCamp = poiId === CAMP_POI_ID;
  return {
    id: groundLocationId(poiId),
    poiId,
    name: isCamp ? 'Kho tạm doanh trại' : 'Điểm tập kết',
    typeId: def.id,
    kind: def.kind,
    isGroundCache: true,
    capacity: isCamp ? { ...def.capacity } : { maxWeightKg: 45, maxVolumeL: 70 },
    environment: { ...def.environment },
    policy: cloneValue(def.policy),
    condition: 100,
  };
}

function refreshBuiltStorageProfile(
  location: StorageLocation,
  building: GameState['buildings'][number],
): void {
  const type = storageTypeForBuilding(building.buildingId);
  if (!type) return;

  let weightPct = 0;
  let volumePct = 0;
  let moisture = 0;
  let rain = 0;
  let pest = 0;
  let contamination = 0;
  let accessibility = 0;

  for (const record of building.structureModifications || []) {
    const effects = STRUCTURE_MODIFICATIONS[record.modificationId]?.effects;
    if (!effects) continue;
    weightPct += effects.storageWeightPercent || 0;
    volumePct += effects.storageVolumePercent || 0;
    moisture += effects.storageMoistureProtection || 0;
    rain += effects.storageRainProtection || 0;
    pest += effects.storagePestProtection || 0;
    contamination += effects.storageContaminationProtection || 0;
    accessibility += effects.storageAccessibility || 0;
  }

  location.typeId = type.id;
  location.kind = type.kind;
  location.poiId = building.areaId || CAMP_POI_ID;
  location.parentStructureId = building.clusterId;
  location.capacity = {
    ...type.capacity,
    maxWeightKg: Math.max(1, type.capacity.maxWeightKg * (1 + weightPct / 100)),
    maxVolumeL: Math.max(1, type.capacity.maxVolumeL * (1 + volumePct / 100)),
  };
  location.environment = {
    ...type.environment,
    moistureProtection: clamp(type.environment.moistureProtection + moisture),
    rainProtection: clamp(type.environment.rainProtection + rain),
    pestProtection: clamp(type.environment.pestProtection + pest),
    contaminationProtection: clamp(type.environment.contaminationProtection + contamination),
    accessibility: clamp(type.environment.accessibility + accessibility),
  };
  location.condition = clamp(building.condition || 100);
}

export function createStorageSystemState(): StorageSystemState {
  return { version: 2, locations: [createGroundLocation(CAMP_POI_ID)], alerts: [], haulJobs: [] };
}

export function ensureStorageSystem(state: GameState): StorageSystemState {
  state.poiStorages ||= {};
  state.storageSystem ||= createStorageSystemState();
  state.storageSystem.version = Math.max(2, state.storageSystem.version || 1);
  state.storageSystem.locations ||= [];
  state.storageSystem.alerts ||= [];
  state.storageSystem.haulJobs ||= [];

  const poiIds = new Set<string>([CAMP_POI_ID, ...Object.keys(state.poiStorages)]);
  for (const poiId of poiIds) {
    if (!state.storageSystem.locations.some(location => location.id === groundLocationId(poiId))) {
      state.storageSystem.locations.push(createGroundLocation(poiId));
    }
  }

  for (const location of state.storageSystem.locations) normalizePolicy(location);

  for (const building of state.buildings || []) {
    if (!building.isBuilt) continue;
    const type = storageTypeForBuilding(building.buildingId);
    if (!type) continue;
    const locationId = `storage_building_${building.id}`;
    const existing = state.storageSystem.locations.find(location => location.id === locationId);
    if (existing) {
      refreshBuiltStorageProfile(existing, building);
      normalizePolicy(existing);
      continue;
    }
    const created: StorageLocation = {
      id: locationId,
      poiId: building.areaId || CAMP_POI_ID,
      name: type.name,
      typeId: type.id,
      kind: type.kind,
      buildingInstanceId: building.id,
      parentStructureId: building.clusterId,
      capacity: { ...type.capacity },
      environment: { ...type.environment },
      policy: cloneValue(type.policy),
      condition: clamp(building.condition || 100),
    };
    refreshBuiltStorageProfile(created, building);
    normalizePolicy(created);
    state.storageSystem.locations.push(created);
  }

  // Existing POI stock remains in the canonical inventory used by production;
  // only its physical location metadata is migrated.
  for (const [poiId, inventory] of Object.entries(state.poiStorages)) {
    const fallbackId = groundLocationId(poiId);
    for (const item of inventory.items || []) {
      const validLocation = item.storageLocationId && state.storageSystem.locations.some(location => location.id === item.storageLocationId && location.poiId === poiId);
      if (!validLocation) item.storageLocationId = fallbackId;
    }
  }

  syncPoiAggregateCapacity(state);
  return state.storageSystem;
}

function syncPoiAggregateCapacity(state: GameState): void {
  if (!state.storageSystem) return;
  const totals = new Map<string, { weight: number; volume: number }>();
  for (const location of state.storageSystem.locations) {
    const current = totals.get(location.poiId) || { weight: 0, volume: 0 };
    current.weight += location.capacity.maxWeightKg;
    current.volume += location.capacity.maxVolumeL;
    totals.set(location.poiId, current);
  }
  for (const [poiId, total] of totals.entries()) {
    const inventory = getOrCreatePoiStorage(state, poiId);
    inventory.maxWeightKg = total.weight;
    inventory.maxVolumeL = total.volume;
  }
}

export function getStorageLocationItems(state: GameState, locationId: string): InventoryItem[] {
  const location = state.storageSystem?.locations.find(candidate => candidate.id === locationId);
  if (!location) return [];
  return (state.poiStorages?.[location.poiId]?.items || []).filter(item => item.storageLocationId === locationId);
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
  return {
    location,
    usedWeightKg: occupancy.weight,
    usedVolumeL: occupancy.volume,
    usedPercent: Math.round(Math.max(weightPct, volumePct) * 100),
    itemStacks: items.length,
    availableUnits: Math.max(0, totalUnits - reservedUnits),
    reservedUnits,
    isFull: occupancy.weight >= location.capacity.maxWeightKg - 0.001 || occupancy.volume >= location.capacity.maxVolumeL - 0.001,
  };
}

function countItemAtLocation(state: GameState, locationId: string, itemId: string): number {
  return getStorageLocationItems(state, locationId)
    .filter(item => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function itemPolicyProblems(state: GameState, location: StorageLocation, item: InventoryItem, quantity: number): string[] {
  const def = ITEMS_DATABASE[item.itemId];
  if (!def) return ['Không có dữ liệu vật phẩm'];
  const type = STORAGE_TYPES[location.typeId];
  if (!type) return [];
  const form = inferStorageForm(def);
  const reasons: string[] = [];
  if (!type.allowedForms.includes(form)) reasons.push(`Dạng ${form} không phù hợp với nơi chứa này`);
  if (location.policy.allowCategories.length > 0 && !location.policy.allowCategories.includes(def.category)) reasons.push('Nhóm vật phẩm bị policy chặn');
  if (location.policy.forbiddenTags.some(tag => def.tags.includes(tag))) reasons.push('Vật phẩm có thuộc tính bị cấm tại nơi chứa này');
  if (!location.policy.acceptDamaged && item.condition !== undefined && item.conditionMax && item.condition / item.conditionMax < 0.5) reasons.push('Policy không nhận vật phẩm hư hỏng nặng');
  if (!location.policy.acceptSpoiled && item.freshness !== undefined && item.freshness <= 5) reasons.push('Policy không nhận vật phẩm đã hỏng');
  const rule = location.policy.stockRules.find(entry => entry.itemId === item.itemId);
  if (rule?.maxQuantity !== undefined && countItemAtLocation(state, location.id, item.itemId) + quantity > rule.maxQuantity) reasons.push(`Đã đạt mức tối đa policy (${rule.maxQuantity})`);
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
  if (!location || !def) return { accepted: false, maxAcceptableQuantity: 0, reasons: ['Nơi chứa hoặc vật phẩm không hợp lệ'], remainingWeightKg: 0, remainingVolumeL: 0 };

  const summary = summarizeStorageLocation(state, locationId);
  const remainingWeightKg = Math.max(0, location.capacity.maxWeightKg - (summary?.usedWeightKg || 0));
  const remainingVolumeL = Math.max(0, location.capacity.maxVolumeL - (summary?.usedVolumeL || 0));
  const maxByWeight = def.weight > 0 ? Math.floor((remainingWeightKg + 1e-6) / def.weight) : requestedQuantity;
  const maxByVolume = def.volume > 0 ? Math.floor((remainingVolumeL + 1e-6) / def.volume) : requestedQuantity;
  const rule = location.policy.stockRules.find(entry => entry.itemId === item.itemId);
  const byRule = rule?.maxQuantity === undefined ? requestedQuantity : Math.max(0, rule.maxQuantity - countItemAtLocation(state, location.id, item.itemId));
  const maxAcceptableQuantity = Math.max(0, Math.min(requestedQuantity, maxByWeight, maxByVolume, byRule, getAvailableInventoryItemQuantity(item)));
  const reasons = itemPolicyProblems(state, location, item, Math.max(1, maxAcceptableQuantity));
  if (maxByWeight <= 0) reasons.push('Không đủ tải trọng còn lại');
  if (maxByVolume <= 0) reasons.push('Không đủ dung tích còn lại');
  if (byRule <= 0) reasons.push('Đã đạt giới hạn stock policy');
  return {
    accepted: reasons.length === 0 && maxAcceptableQuantity > 0,
    maxAcceptableQuantity: reasons.length === 0 ? maxAcceptableQuantity : 0,
    reasons: [...new Set(reasons)],
    remainingWeightKg,
    remainingVolumeL,
  };
}

function locationInventoryView(poiStorage: StorageInventory, location: StorageLocation): StorageInventory {
  return {
    maxWeightKg: location.capacity.maxWeightKg,
    maxVolumeL: location.capacity.maxVolumeL,
    items: poiStorage.items.filter(item => item.storageLocationId === location.id),
  };
}

function replaceLocationItems(poiStorage: StorageInventory, locationId: string, locationItems: InventoryItem[]): void {
  const others = poiStorage.items.filter(item => item.storageLocationId !== locationId);
  for (const item of locationItems) item.storageLocationId = locationId;
  poiStorage.items = [...others, ...locationItems];
}

function performPartyToLocation(next: GameState, locationId: string, instanceId: string, quantity?: number) {
  const system = ensureStorageSystem(next);
  const location = system.locations.find(candidate => candidate.id === locationId);
  if (!location) return { success: false, moved: 0, message: 'Không tìm thấy nơi chứa' };
  const sourceItem = next.inventory.items.find(item => item.instanceId === instanceId);
  if (!sourceItem) return { success: false, moved: 0, message: 'Không tìm thấy vật phẩm đang mang' };
  const acceptance = canStoreItemInLocation(next, locationId, sourceItem, quantity ?? sourceItem.quantity);
  if (!acceptance.accepted) return { success: false, moved: 0, message: acceptance.reasons[0] || 'Không thể cất vật phẩm' };

  const poiStorage = getOrCreatePoiStorage(next, location.poiId);
  const targetView = locationInventoryView(poiStorage, location);
  const result = transferItemBetweenInventories(next.inventory, targetView, instanceId, acceptance.maxAcceptableQuantity);
  replaceLocationItems(poiStorage, locationId, targetView.items);
  return result;
}

export function storeItemInLocation(state: GameState, locationId: string, instanceId: string, quantity?: number): GameState {
  const next = cloneValue(state);
  const result = performPartyToLocation(next, locationId, instanceId, quantity);
  next.logs.unshift({
    id: `storage_store_${Date.now()}_${instanceId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `[Storage] ${result.message}`,
    type: result.success ? 'info' : 'warning',
  });
  return next;
}

export function storeAllInLocation(state: GameState, locationId: string): GameState {
  const next = cloneValue(state);
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
  const next = cloneValue(state);
  const system = ensureStorageSystem(next);
  const location = system.locations.find(candidate => candidate.id === locationId);
  if (!location) return state;
  const poiStorage = getOrCreatePoiStorage(next, location.poiId);
  const sourceView = locationInventoryView(poiStorage, location);
  const sourceItem = sourceView.items.find(item => item.instanceId === instanceId);
  if (!sourceItem) return state;
  const result = transferItemBetweenInventories(sourceView, next.inventory, instanceId, quantity);
  replaceLocationItems(poiStorage, locationId, sourceView.items);
  if (result.success) {
    for (const item of next.inventory.items) {
      if (item.instanceId === instanceId) item.storageLocationId = undefined;
    }
  }
  next.logs.unshift({
    id: `storage_take_${Date.now()}_${instanceId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `[Storage] ${result.message}`,
    type: result.success ? 'info' : 'warning',
  });
  return next;
}

/** Slot count is presentation-only. Full physical storage exposes no active empty drop slots. */
export function getDynamicStorageSlotCount(itemStackCount: number, columns: number, isFull: boolean): number {
  if (isFull) return Math.max(0, itemStackCount);
  const safeColumns = Math.max(1, Math.floor(columns));
  const occupiedRows = Math.ceil(itemStackCount / safeColumns);
  return Math.max(safeColumns, (occupiedRows + 1) * safeColumns);
}

export function tickStorageSimulation(state: GameState, deltaGameMinutes: number): void {
  const system = ensureStorageSystem(state);
  const alerts: StorageSystemState['alerts'] = [];

  for (const location of system.locations) {
    const conditionRatio = Math.max(0.15, location.condition / 100);
    const moistureProtection = location.environment.moistureProtection * conditionRatio;
    const pestProtection = location.environment.pestProtection * conditionRatio;
    const contaminationProtection = location.environment.contaminationProtection * conditionRatio;
    const temperatureBuffer = location.environment.temperatureBuffer * conditionRatio;
    const preservationMultiplier = Math.max(0.36, 1.16 - moistureProtection * 0.0032 - pestProtection * 0.0014 - temperatureBuffer * 0.0022);

    const items = getStorageLocationItems(state, location.id);
    for (const item of items) {
      const def = ITEMS_DATABASE[item.itemId];
      if (!def) continue;
      const targetMoisture = Math.max(4, state.weather.humidityPercent * (1 - moistureProtection / 135));
      const currentMoisture = item.moisture ?? targetMoisture;
      item.moisture = clamp(currentMoisture + (targetMoisture - currentMoisture) * Math.min(1, deltaGameMinutes / 180));
      item.pestDamage = clamp((item.pestDamage || 0) + Math.max(0, 35 - pestProtection) * deltaGameMinutes / 30000);
      const contaminationPressure = Math.max(0, 42 - contaminationProtection) + (item.pestDamage || 0) * 0.08;
      item.contamination = clamp((item.contamination || 0) + contaminationPressure * deltaGameMinutes / 35000);
      item.spoilageMultiplier = preservationMultiplier * (1 + (item.contamination || 0) / 240);

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
    if (items.some(item => (item.contamination || 0) > 55)) alerts.push({ id: `dirty_${location.id}`, locationId: location.id, severity: 'warning', message: `${location.name} có vật phẩm đang có nguy cơ nhiễm bẩn cao.` });
  }

  system.alerts = alerts.slice(0, 20);
}