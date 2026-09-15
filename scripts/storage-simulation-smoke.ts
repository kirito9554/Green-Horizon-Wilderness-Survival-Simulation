import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/storageSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  canStoreItemInLocation,
  ensureStorageSystem,
  getDynamicStorageSlotCount,
  getItemLiquidLiters,
  getStorageLocationItems,
  storeItemInLocation,
  summarizeStorageLocation,
  summarizeStorageNetwork,
  takeItemFromLocation,
  tickStorageSimulation,
} from '../src/simulation/storageSystem';
import { queueStorageHaul, tickStorageHauling } from '../src/simulation/storageHaulSystem';
import { addItemToInventory, getAvailableInventoryStock } from '../src/simulation/inventorySystem';
import { migrateGameState } from '../src/save/migrations';

function fresh(): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  ensureStorageSystem(state);
  return state;
}

function addStorageBuilding(
  state: GameState,
  buildingId: string,
  id: string,
  condition = 88,
  areaId = 'AREA_CAMP_CLEARING',
) {
  state.buildings.push({
    id,
    buildingId,
    condition,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId,
  });
  const location = ensureStorageSystem(state).locations.find(candidate => candidate.buildingInstanceId === id)!;
  location.policy.autoHaul = false;
  return location;
}

function addRack(state: GameState, id = 'storage_rack_smoke', areaId = 'AREA_CAMP_CLEARING') {
  return addStorageBuilding(state, 'BUILDING_WOVEN_BASKET_RACK', id, 88, areaId);
}

function poiQuantity(state: GameState, poiId: string, itemId: string): number {
  return (state.poiStorages?.[poiId]?.items || [])
    .filter(item => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function worldQuantity(state: GameState, itemId: string): number {
  return Object.values(state.poiStorages || {}).reduce((sum, storage) =>
    sum + storage.items.filter(item => item.itemId === itemId).reduce((nested, item) => nested + item.quantity, 0), 0);
}

function carriedItem(state: GameState, itemId: string) {
  return state.inventory.items.find(item => item.itemId === itemId)!;
}

function testDynamicSlotsArePresentationOnly(): void {
  assert.equal(getDynamicStorageSlotCount(7, 5, false), 15, 'seven stacks should show occupied rows plus one empty row');
  assert.equal(getDynamicStorageSlotCount(10, 5, false), 15, 'full visual rows still get one empty drop row while capacity remains');
  assert.equal(getDynamicStorageSlotCount(10, 5, true), 10, 'full physical storage must not create active empty slots');
  assert.equal(getDynamicStorageSlotCount(0, 5, true), 0, 'a physically full edge-case exposes zero fake empty slots');
}

function testStoreUsesLocationCapacityAndCanonicalPoiInventory(): void {
  let state = fresh();
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  const carried = state.inventory.items.find(item => item.itemId === 'ITEM_DRIFTWOOD_BRANCH')!;
  const availableBefore = getAvailableInventoryStock(state.poiStorages!.AREA_CAMP_CLEARING, carried.itemId);

  const acceptance = canStoreItemInLocation(state, ground.id, carried, 2);
  assert.equal(acceptance.accepted, true);
  state = storeItemInLocation(state, ground.id, carried.instanceId, 2);

  const stored = getStorageLocationItems(state, ground.id).filter(item => item.itemId === carried.itemId);
  assert.ok(stored.length > 0, 'stored item must remain addressable through its physical location');
  assert.equal(getAvailableInventoryStock(state.poiStorages!.AREA_CAMP_CLEARING, carried.itemId), availableBefore + 2, 'canonical POI inventory must receive stored stock');
}

function testReservedStockCannotBeTaken(): void {
  let state = fresh();
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  const item = getStorageLocationItems(state, ground.id)[0];
  assert.ok(item, 'ground cache should contain migrated initial stock');
  item.reservedQuantity = item.quantity;
  const carryingBefore = state.inventory.items.reduce((sum, entry) => sum + entry.quantity, 0);
  state = takeItemFromLocation(state, ground.id, item.instanceId);
  const carryingAfter = state.inventory.items.reduce((sum, entry) => sum + entry.quantity, 0);
  assert.equal(carryingAfter, carryingBefore, 'fully reserved stack must not be removed from storage');
}

function testPhysicalStorageStructureRegistersLocation(): void {
  const state = fresh();
  const rack = addRack(state);
  assert.ok(rack, 'completed storage building should become a physical storage location');
  assert.equal(rack.capacity.maxVolumeL, 50);
  assert.equal(rack.condition, 88);
}

function testCapacityCanBeFullWithoutSlotLimit(): void {
  const state = fresh();
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  ground.capacity.maxWeightKg = 0.01;
  ground.capacity.maxVolumeL = 0.01;
  const summary = summarizeStorageLocation(state, ground.id)!;
  assert.equal(summary.isFull, true, 'physical capacity, not slot count, determines full state');
  const item = state.inventory.items[0];
  const acceptance = canStoreItemInLocation(state, ground.id, item, 1);
  assert.equal(acceptance.accepted, false);
}

function testV8MigrationCreatesStorageMetadataWithoutMovingItems(): void {
  const legacy = fresh();
  legacy.saveVersion = 8;
  legacy.storageSystem = undefined;
  for (const storage of Object.values(legacy.poiStorages || {})) {
    for (const item of storage.items) item.storageLocationId = undefined;
  }
  const before = getAvailableInventoryStock(legacy.poiStorages!.AREA_CAMP_CLEARING, 'ITEM_DRIFTWOOD_BRANCH');
  const migrated = migrateGameState(legacy);
  assert.equal(migrated.saveVersion, 12);
  assert.equal(migrated.storageSystem?.version, 3);
  assert.ok(migrated.storageSystem?.locations.length);
  assert.equal(getAvailableInventoryStock(migrated.poiStorages!.AREA_CAMP_CLEARING, 'ITEM_DRIFTWOOD_BRANCH'), before, 'migration must not duplicate or consume legacy stock');
  assert.ok(migrated.poiStorages!.AREA_CAMP_CLEARING.items.every(item => Boolean(item.storageLocationId)), 'legacy POI stacks must receive a physical storage location');
}

function testStoreAllRespectsCompatibility(): void {
  const state = fresh();
  const rack = addRack(state, 'rack_compat_smoke');
  addItemToInventory(state.inventory, 'ITEM_BOILED_WATER_BOWL', 1, 'standard');
  const water = carriedItem(state, 'ITEM_BOILED_WATER_BOWL');
  const acceptance = canStoreItemInLocation(state, rack.id, water, 1);
  assert.equal(acceptance.accepted, false, 'non-liquid rack must reject liquid-form storage');
}

function testSpecializedStorageProfiles(): void {
  const state = fresh();
  const crate = addStorageBuilding(state, 'BUILDING_BAMBOO_SUPPLY_CRATE', 'crate_profile_smoke');
  const bulk = addStorageBuilding(state, 'BUILDING_BULK_MATERIAL_RACK', 'bulk_profile_smoke');
  const medicine = addStorageBuilding(state, 'BUILDING_MEDICINE_STORAGE_CHEST', 'medicine_profile_smoke');
  const waterTank = addStorageBuilding(state, 'BUILDING_BAMBOO_WATER_TANK', 'water_profile_smoke');

  addItemToInventory(state.inventory, 'ITEM_BANDAGE', 2, 'standard');
  addItemToInventory(state.inventory, 'ITEM_WATER_FLASK', 1, 'standard');
  addItemToInventory(state.inventory, 'ITEM_BAMBOO_STALK', 2, 'standard');
  addItemToInventory(state.inventory, 'ITEM_ROPE', 2, 'standard');

  const bandage = carriedItem(state, 'ITEM_BANDAGE');
  const water = carriedItem(state, 'ITEM_WATER_FLASK');
  const bamboo = carriedItem(state, 'ITEM_BAMBOO_STALK');
  const rope = carriedItem(state, 'ITEM_ROPE');

  assert.equal(canStoreItemInLocation(state, medicine.id, bandage, 1).accepted, true, 'medicine chest must accept medicine');
  assert.equal(canStoreItemInLocation(state, medicine.id, rope, 1).accepted, false, 'medicine chest must reject general materials');
  assert.equal(canStoreItemInLocation(state, waterTank.id, water, 1).accepted, true, 'water tank must accept water/liquid-form stock');
  assert.equal(canStoreItemInLocation(state, waterTank.id, bandage, 1).accepted, false, 'water tank must reject dry medical stock');
  assert.equal(canStoreItemInLocation(state, bulk.id, bamboo, 1).accepted, true, 'bulk rack must accept long bamboo poles');
  assert.equal(canStoreItemInLocation(state, bulk.id, rope, 1).accepted, false, 'bulk rack must reject small bundled material');
  assert.equal(canStoreItemInLocation(state, crate.id, rope, 1).accepted, true, 'general supply crate must accept bundled material');
  assert.equal(canStoreItemInLocation(state, crate.id, water, 1).accepted, false, 'general supply crate must reject liquid stock');
}

function testLiquidCapacityUsesLiters(): void {
  let state = fresh();
  const tank = addStorageBuilding(state, 'BUILDING_BAMBOO_WATER_TANK', 'water_liters_smoke', 100);
  const liquidCapacity = tank.capacity.liquidCapacityL!;
  const prefilledLiters = Math.max(0, liquidCapacity - 1);
  state.poiStorages!.AREA_CAMP_CLEARING.items.push({
    instanceId: 'tank_prefill_smoke',
    itemId: 'ITEM_WATER_FLASK',
    quantity: prefilledLiters,
    quality: 'standard',
    qualityBreakdown: { standard: prefilledLiters },
    liquidLiters: prefilledLiters,
    storageLocationId: tank.id,
    reservedQuantity: 0,
    reservedQualityBreakdown: { crude: 0, standard: 0, prime: 0, masterwork: 0 },
  });

  addItemToInventory(state.inventory, 'ITEM_WATER_FLASK', 3, 'standard');
  const water = carriedItem(state, 'ITEM_WATER_FLASK');
  assert.equal(getItemLiquidLiters(water), 3, 'water stack must track its physical liquid liters');
  assert.equal(summarizeStorageLocation(state, tank.id)!.usedLiquidL, prefilledLiters);

  const acceptance = canStoreItemInLocation(state, tank.id, water, 3);
  assert.equal(acceptance.accepted, true);
  assert.equal(acceptance.maxAcceptableQuantity, 1, 'remaining liquid liters should cap the accepted units');
  assert.ok((acceptance.remainingLiquidL || 0) >= 0.99 && (acceptance.remainingLiquidL || 0) <= 1.01);

  state = storeItemInLocation(state, tank.id, water.instanceId, 3);
  const summary = summarizeStorageLocation(state, tank.id)!;
  assert.equal(summary.usedLiquidL, liquidCapacity);
  assert.equal(summary.isFull, true, 'liquid capacity alone can make a tank physically full');
}

function testPreservationMetadataSurvivesHauling(): void {
  let state = fresh();
  const medicine = addStorageBuilding(state, 'BUILDING_MEDICINE_STORAGE_CHEST', 'medicine_transfer_smoke', 100);
  const crate = addStorageBuilding(state, 'BUILDING_BAMBOO_SUPPLY_CRATE', 'crate_transfer_smoke', 100);
  addItemToInventory(state.inventory, 'ITEM_BANDAGE', 2, 'standard');
  const bandage = carriedItem(state, 'ITEM_BANDAGE');
  bandage.moisture = 38;
  bandage.contamination = 27;
  bandage.mold = 19;
  bandage.medicinePotency = 81;

  state = storeItemInLocation(state, medicine.id, bandage.instanceId, 1);
  const stored = getStorageLocationItems(state, medicine.id).find(item => item.itemId === 'ITEM_BANDAGE')!;
  assert.equal(Math.round(stored.contamination || 0), 27);
  assert.equal(Math.round(stored.mold || 0), 19);
  assert.equal(Math.round(stored.medicinePotency || 0), 81);

  state = queueStorageHaul(state, medicine.id, crate.id, 'ITEM_BANDAGE', 1, state.survivors[0].id);
  const job = state.storageSystem!.haulJobs.find(candidate => candidate.targetLocationId === crate.id)!;
  tickStorageHauling(state, job.totalSeconds + 0.1);
  const moved = getStorageLocationItems(state, crate.id).find(item => item.itemId === 'ITEM_BANDAGE')!;
  assert.ok(moved, 'haul should deposit the medical stack in the target');
  assert.equal(Math.round(moved.contamination || 0), 27, 'contamination must survive a physical transfer');
  assert.equal(Math.round(moved.mold || 0), 19, 'mold state must survive a physical transfer');
  assert.equal(Math.round(moved.medicinePotency || 0), 81, 'medicine potency must survive a physical transfer');
}

function testEnvironmentalDecayTracksMoldAndPotency(): void {
  let state = fresh();
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  addItemToInventory(state.inventory, 'ITEM_BANDAGE', 1, 'standard');
  const bandage = carriedItem(state, 'ITEM_BANDAGE');
  state = storeItemInLocation(state, ground.id, bandage.instanceId, 1);
  const stored = getStorageLocationItems(state, ground.id).find(item => item.itemId === 'ITEM_BANDAGE')!;
  stored.moisture = 90;
  stored.contamination = 20;
  stored.mold = 0;
  stored.medicinePotency = 100;
  state.weather.humidityPercent = 96;
  state.weather.temperatureC = 37;

  tickStorageSimulation(state, 1440);
  assert.ok((stored.mold || 0) > 0, 'hot humid unprotected storage must create mold pressure');
  assert.ok((stored.medicinePotency || 100) < 100, 'medicine potency must decay under poor storage conditions');
  assert.ok((stored.contamination || 0) >= 20, 'poor ground storage should not magically clean contamination');
}

function testPersistentHaulMovesLocationWithoutChangingPhysicalQuantity(): void {
  let state = fresh();
  const rack = addRack(state, 'rack_haul_smoke');
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  const beforePhysical = poiQuantity(state, 'AREA_CAMP_CLEARING', 'ITEM_DRIFTWOOD_BRANCH');

  state = queueStorageHaul(state, ground.id, rack.id, 'ITEM_DRIFTWOOD_BRANCH', 2, state.survivors[0].id);
  const job = state.storageSystem!.haulJobs[0];
  assert.ok(job, 'haul request must become a persistent job');
  assert.equal(job.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0), 2, 'haul job must reserve exact source quantity');
  assert.equal(poiQuantity(state, 'AREA_CAMP_CLEARING', 'ITEM_DRIFTWOOD_BRANCH'), beforePhysical, 'planning a haul must not move or consume stock');

  tickStorageHauling(state, 0.1);
  assert.equal(job.status, 'in_progress');
  const worker = state.survivors.find(candidate => candidate.id === job.assignedSurvivorId)!;
  assert.equal(worker.currentAction.type, 'hauling', 'real survivor must own the logistics task');

  tickStorageHauling(state, job.totalSeconds + 0.1);
  assert.equal(job.status, 'completed');
  assert.equal(poiQuantity(state, 'AREA_CAMP_CLEARING', 'ITEM_DRIFTWOOD_BRANCH'), beforePhysical, 'hauling changes physical location, never total stock');
  assert.equal(
    getStorageLocationItems(state, rack.id).filter(item => item.itemId === 'ITEM_DRIFTWOOD_BRANCH').reduce((sum, item) => sum + item.quantity, 0),
    2,
    'completed haul must deposit the reserved quantity in the destination location',
  );
  assert.equal(worker.currentAction.type, 'idle', 'completed haul must release its worker');
}

function testCrossPoiHaulUsesRouteAndCanonicalInventories(): void {
  let state = fresh();
  const rack = addRack(state, 'rack_cross_poi_smoke');
  const remoteGround = ensureStorageSystem(state).locations.find(location => location.id === 'storage_ground_AREA_WATERFALL_BASIN')!;
  const beforeWorld = worldQuantity(state, 'ITEM_RIVER_PEBBLE');
  const beforeRemote = poiQuantity(state, 'AREA_WATERFALL_BASIN', 'ITEM_RIVER_PEBBLE');
  const beforeCamp = poiQuantity(state, 'AREA_CAMP_CLEARING', 'ITEM_RIVER_PEBBLE');

  state = queueStorageHaul(state, remoteGround.id, rack.id, 'ITEM_RIVER_PEBBLE', 2, state.survivors[0].id);
  const job = state.storageSystem!.haulJobs.find(candidate => candidate.sourceLocationId === remoteGround.id && candidate.targetLocationId === rack.id)!;
  assert.ok(job, 'cross-POI transfer should create a persistent haul job');
  assert.equal(job.sourcePoiId, 'AREA_WATERFALL_BASIN');
  assert.equal(job.targetPoiId, 'AREA_CAMP_CLEARING');
  assert.equal(job.route?.crossesPoi, true);
  assert.ok((job.route?.distanceM || 0) > 50, 'cross-POI haul must have a real route distance');

  tickStorageHauling(state, job.totalSeconds + 0.1);
  assert.equal(job.status, 'completed');
  assert.equal(poiQuantity(state, 'AREA_WATERFALL_BASIN', 'ITEM_RIVER_PEBBLE'), beforeRemote - 2);
  assert.equal(poiQuantity(state, 'AREA_CAMP_CLEARING', 'ITEM_RIVER_PEBBLE'), beforeCamp + 2);
  assert.equal(worldQuantity(state, 'ITEM_RIVER_PEBBLE'), beforeWorld, 'cross-POI hauling must conserve world stock');
}

function testStorageNetworkSummary(): void {
  const state = fresh();
  addRack(state, 'rack_network_smoke');
  const campSummary = summarizeStorageNetwork(state, 'AREA_CAMP_CLEARING');
  const worldSummary = summarizeStorageNetwork(state);
  assert.ok(campSummary.locationCount >= 2);
  assert.ok(campSummary.protectedLocationCount >= 1);
  assert.ok(campSummary.groundCacheUnits > 0);
  assert.ok(worldSummary.locationCount >= campSummary.locationCount);
  assert.ok(worldSummary.totalVolumeCapacityL >= campSummary.totalVolumeCapacityL);
}

function testSaveLoadRebuildsHaulReservationAndRoute(): void {
  let state = fresh();
  const rack = addRack(state, 'rack_save_smoke');
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  state = queueStorageHaul(state, ground.id, rack.id, 'ITEM_PALM_LEAF', 2);
  const queued = state.storageSystem!.haulJobs[0];
  assert.ok(queued?.materialReservations.length);
  queued.route = undefined;
  queued.sourcePoiId = undefined;
  queued.targetPoiId = undefined;
  state.saveVersion = 9;

  const migrated = migrateGameState(JSON.parse(JSON.stringify(state)) as GameState);
  const restored = migrated.storageSystem!.haulJobs.find(job => job.id === queued.id)!;
  assert.equal(migrated.saveVersion, 12);
  assert.equal(restored.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0), 2, 'load must rebuild exact haul reservations');
  assert.ok(restored.route, 'V10 migration must reconstruct missing route data');
  assert.equal(restored.sourcePoiId, 'AREA_CAMP_CLEARING');
  assert.equal(restored.targetPoiId, 'AREA_CAMP_CLEARING');
  const sourceLeaf = getStorageLocationItems(migrated, ground.id).find(item => item.itemId === 'ITEM_PALM_LEAF')!;
  assert.ok((sourceLeaf.reservedQuantity || 0) >= 2, 'source stack must remain locked after load');
}

function main(): void {
  testDynamicSlotsArePresentationOnly();
  testStoreUsesLocationCapacityAndCanonicalPoiInventory();
  testReservedStockCannotBeTaken();
  testPhysicalStorageStructureRegistersLocation();
  testCapacityCanBeFullWithoutSlotLimit();
  testV8MigrationCreatesStorageMetadataWithoutMovingItems();
  testStoreAllRespectsCompatibility();
  testSpecializedStorageProfiles();
  testLiquidCapacityUsesLiters();
  testPreservationMetadataSurvivesHauling();
  testEnvironmentalDecayTracksMoldAndPotency();
  testPersistentHaulMovesLocationWithoutChangingPhysicalQuantity();
  testCrossPoiHaulUsesRouteAndCanonicalInventories();
  testStorageNetworkSummary();
  testSaveLoadRebuildsHaulReservationAndRoute();
  console.log('Storage simulation smoke tests passed.');
}

main();
