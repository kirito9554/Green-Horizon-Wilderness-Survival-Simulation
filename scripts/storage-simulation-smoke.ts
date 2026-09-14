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
import { queueStorageHaul, tickStorageHauling } from '../src/simulation/storageHaulSystem';
import { addItemToInventory, getAvailableInventoryStock } from '../src/simulation/inventorySystem';
import { migrateGameState } from '../src/save/migrations';

function fresh(): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  ensureStorageSystem(state);
  return state;
}

function addStorageBuilding(state: GameState, buildingId: string, id: string, condition = 88) {
  state.buildings.push({
    id,
    buildingId,
    condition,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId: 'AREA_CAMP_CLEARING',
  });
  const location = ensureStorageSystem(state).locations.find(candidate => candidate.buildingInstanceId === id)!;
  location.policy.autoHaul = false;
  return location;
}

function addRack(state: GameState, id = 'storage_rack_smoke') {
  return addStorageBuilding(state, 'BUILDING_WOVEN_BASKET_RACK', id);
}

function physicalPoiQuantity(state: GameState, itemId: string): number {
  return state.poiStorages!.AREA_CAMP_CLEARING.items
    .filter(item => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
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
  assert.equal(migrated.saveVersion, 9);
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

function testPersistentHaulMovesLocationWithoutChangingPhysicalQuantity(): void {
  let state = fresh();
  const rack = addRack(state, 'rack_haul_smoke');
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  const beforePhysical = physicalPoiQuantity(state, 'ITEM_DRIFTWOOD_BRANCH');

  state = queueStorageHaul(state, ground.id, rack.id, 'ITEM_DRIFTWOOD_BRANCH', 2, state.survivors[0].id);
  const job = state.storageSystem!.haulJobs[0];
  assert.ok(job, 'haul request must become a persistent job');
  assert.equal(job.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0), 2, 'haul job must reserve exact source quantity');
  assert.equal(physicalPoiQuantity(state, 'ITEM_DRIFTWOOD_BRANCH'), beforePhysical, 'planning a haul must not move or consume stock');

  tickStorageHauling(state, 0.1);
  assert.equal(job.status, 'in_progress');
  const worker = state.survivors.find(candidate => candidate.id === job.assignedSurvivorId)!;
  assert.equal(worker.currentAction.type, 'hauling', 'real survivor must own the logistics task');

  tickStorageHauling(state, job.totalSeconds + 0.1);
  assert.equal(job.status, 'completed');
  assert.equal(physicalPoiQuantity(state, 'ITEM_DRIFTWOOD_BRANCH'), beforePhysical, 'hauling changes physical location, never total stock');
  assert.equal(
    getStorageLocationItems(state, rack.id).filter(item => item.itemId === 'ITEM_DRIFTWOOD_BRANCH').reduce((sum, item) => sum + item.quantity, 0),
    2,
    'completed haul must deposit the reserved quantity in the destination location',
  );
  assert.equal(worker.currentAction.type, 'idle', 'completed haul must release its worker');
}

function testSaveLoadRebuildsHaulReservation(): void {
  let state = fresh();
  const rack = addRack(state, 'rack_save_smoke');
  const ground = state.storageSystem!.locations.find(location => location.id === 'storage_ground_AREA_CAMP_CLEARING')!;
  state = queueStorageHaul(state, ground.id, rack.id, 'ITEM_PALM_LEAF', 2);
  const queued = state.storageSystem!.haulJobs[0];
  assert.ok(queued?.materialReservations.length);

  const migrated = migrateGameState(JSON.parse(JSON.stringify(state)) as GameState);
  const restored = migrated.storageSystem!.haulJobs.find(job => job.id === queued.id)!;
  assert.equal(restored.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0), 2, 'load must rebuild exact haul reservations');
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
  testPersistentHaulMovesLocationWithoutChangingPhysicalQuantity();
  testSaveLoadRebuildsHaulReservation();
  console.log('Storage simulation smoke tests passed.');
}

main();