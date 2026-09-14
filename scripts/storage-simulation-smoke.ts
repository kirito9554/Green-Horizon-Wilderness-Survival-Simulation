import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/storageSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  canStoreItemInLocation,
  ensureStorageSystem,
  getDynamicStorageSlotCount,
  getStorageLocationItems,
  storeItemInLocation,
  summarizeStorageLocation,
  takeItemFromLocation,
} from '../src/simulation/storageSystem';
import { addItemToInventory, getAvailableInventoryStock } from '../src/simulation/inventorySystem';
import { migrateGameState } from '../src/save/migrations';

function fresh(): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  ensureStorageSystem(state);
  return state;
}

function testDynamicSlotsArePresentationOnly(): void {
  assert.equal(getDynamicStorageSlotCount(7, 5, false), 15, 'seven stacks should show occupied rows plus one empty row');
  assert.equal(getDynamicStorageSlotCount(10, 5, false), 15, 'full visual rows still get one empty drop row while capacity remains');
  assert.equal(getDynamicStorageSlotCount(10, 5, true), 10, 'full physical storage must not create active empty slots');
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
  state.buildings.push({
    id: 'storage_rack_smoke',
    buildingId: 'BUILDING_WOVEN_BASKET_RACK',
    condition: 88,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId: 'AREA_CAMP_CLEARING',
  });
  const system = ensureStorageSystem(state);
  const rack = system.locations.find(location => location.buildingInstanceId === 'storage_rack_smoke');
  assert.ok(rack, 'completed storage building should become a physical storage location');
  assert.equal(rack!.capacity.maxVolumeL, 50);
  assert.equal(rack!.condition, 88);
}

function testCapacityCanBeFullWithoutSlotLimit(): void {
  let state = fresh();
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
  assert.equal(migrated.saveVersion, 9);
  assert.ok(migrated.storageSystem?.locations.length);
  assert.equal(getAvailableInventoryStock(migrated.poiStorages!.AREA_CAMP_CLEARING, 'ITEM_DRIFTWOOD_BRANCH'), before, 'migration must not duplicate or consume legacy stock');
  assert.ok(migrated.poiStorages!.AREA_CAMP_CLEARING.items.every(item => Boolean(item.storageLocationId)), 'legacy POI stacks must receive a physical storage location');
}

function testStoreAllRespectsCompatibility(): void {
  const state = fresh();
  state.buildings.push({
    id: 'rack_compat_smoke',
    buildingId: 'BUILDING_WOVEN_BASKET_RACK',
    condition: 100,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId: 'AREA_CAMP_CLEARING',
  });
  const rack = ensureStorageSystem(state).locations.find(location => location.buildingInstanceId === 'rack_compat_smoke')!;
  addItemToInventory(state.inventory, 'ITEM_BOILED_WATER_BOWL', 1, 'standard');
  const water = state.inventory.items.find(item => item.itemId === 'ITEM_BOILED_WATER_BOWL')!;
  const acceptance = canStoreItemInLocation(state, rack.id, water, 1);
  assert.equal(acceptance.accepted, false, 'non-liquid rack must reject liquid-form storage');
}

function main(): void {
  testDynamicSlotsArePresentationOnly();
  testStoreUsesLocationCapacityAndCanonicalPoiInventory();
  testReservedStockCannotBeTaken();
  testPhysicalStorageStructureRegistersLocation();
  testCapacityCanBeFullWithoutSlotLimit();
  testV8MigrationCreatesStorageMetadataWithoutMovingItems();
  testStoreAllRespectsCompatibility();
  console.log('Storage simulation smoke tests passed.');
}

main();