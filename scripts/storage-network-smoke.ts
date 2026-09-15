import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/storageSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureStorageSystem, getStorageLocationItems, summarizeStorageNetwork } from '../src/simulation/storageSystem';
import { queueStorageOptimizationPass, tickStorageHauling } from '../src/simulation/storageHaulSystem';
import { setStorageStockRule } from '../src/simulation/storagePolicySystem';

function fresh(): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  state.buildings.push({
    id: 'optimizer_rack_smoke',
    buildingId: 'BUILDING_WOVEN_BASKET_RACK',
    condition: 100,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId: 'AREA_CAMP_CLEARING',
  });
  ensureStorageSystem(state);
  return state;
}

function physicalQuantity(state: GameState, itemId: string): number {
  return Object.values(state.poiStorages || {}).reduce((sum, storage) =>
    sum + storage.items
      .filter(item => item.itemId === itemId)
      .reduce((nested, item) => nested + item.quantity, 0), 0);
}

function main(): void {
  let state = fresh();
  const rack = state.storageSystem!.locations.find(location => location.buildingInstanceId === 'optimizer_rack_smoke')!;
  assert.ok(rack, 'optimizer target rack must be registered');
  rack.policy.autoHaul = false;

  state = setStorageStockRule(state, rack.id, 'ITEM_PALM_LEAF', 4, 8);
  const beforeWorld = physicalQuantity(state, 'ITEM_PALM_LEAF');
  const beforeTarget = getStorageLocationItems(state, rack.id)
    .filter(item => item.itemId === 'ITEM_PALM_LEAF')
    .reduce((sum, item) => sum + item.quantity, 0);

  state = queueStorageOptimizationPass(state, 'AREA_CAMP_CLEARING');
  const jobs = state.storageSystem!.haulJobs.filter(job => job.status !== 'completed');
  assert.equal(jobs.length, 1, 'optimizer should create one persistent haul for the stock deficit');
  const job = jobs[0];
  assert.equal(job.targetLocationId, rack.id);
  assert.equal(job.itemId, 'ITEM_PALM_LEAF');
  assert.equal(job.quantity, 4);
  assert.equal(physicalQuantity(state, 'ITEM_PALM_LEAF'), beforeWorld, 'optimization planning must never teleport or consume physical stock');
  assert.equal(
    getStorageLocationItems(state, rack.id).filter(item => item.itemId === 'ITEM_PALM_LEAF').reduce((sum, item) => sum + item.quantity, 0),
    beforeTarget,
    'target stock must remain unchanged until the haul finishes',
  );
  assert.equal(job.materialReservations.reduce((sum, reservation) => sum + reservation.quantity, 0), 4, 'optimizer must reserve exact source cargo');

  tickStorageHauling(state, job.totalSeconds + 0.1);
  assert.equal(job.status, 'completed', 'optimized haul should complete through the normal worker runtime');
  assert.equal(physicalQuantity(state, 'ITEM_PALM_LEAF'), beforeWorld, 'completed optimization must conserve world stock');
  assert.equal(
    getStorageLocationItems(state, rack.id).filter(item => item.itemId === 'ITEM_PALM_LEAF').reduce((sum, item) => sum + item.quantity, 0),
    beforeTarget + 4,
    'completed optimizer job must physically deposit the requested stock',
  );

  const summary = summarizeStorageNetwork(state, 'AREA_CAMP_CLEARING');
  assert.equal(summary.activeHauls, 0, 'network overview should no longer count completed hauling');
  assert.ok(summary.protectedUnits >= 4, 'network overview should include stock moved into protected storage');
  console.log('Storage network optimizer smoke tests passed.');
}

main();