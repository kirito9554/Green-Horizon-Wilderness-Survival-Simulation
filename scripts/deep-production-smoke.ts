import assert from 'node:assert/strict';
import type { GameState, SurvivorState } from '../src/types';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  addItemToInventory,
  getAvailableInventoryStock,
} from '../src/simulation/inventorySystem';
import { tickComponentBootstrap } from '../src/simulation/componentBootstrapSystem';
import { syncAggregateConditionFromComponents } from '../src/simulation/componentSystem';
import {
  cancelMaintenanceJob,
  queueMaintenanceJob,
  tickMaintenanceSystem,
} from '../src/simulation/maintenanceSystem';
import { queueComponentModification } from '../src/simulation/upgradeSystem';
import {
  prepareMaintenanceWorkstations,
  prepareUpgradeWorkstations,
} from '../src/simulation/productionWorkstationCoordinator';

function freshState(): GameState {
  return JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
}

function addSecondCrafter(state: GameState): void {
  const source = state.survivors[0];
  assert.ok(source, 'initial survivor must exist');
  const second = JSON.parse(JSON.stringify(source)) as SurvivorState;
  second.id = 'SURVIVOR_SMOKE_2';
  second.name = 'Smoke Test Crafter';
  second.skills.crafting = Math.max(2, second.skills.crafting || 1);
  second.currentAction = {
    type: 'idle',
    description: 'Ready for smoke test',
    progressSeconds: 0,
    totalSeconds: 0,
  };
  state.survivors.push(second);
}

function addWorkbench(state: GameState): void {
  state.buildings.push({
    id: 'smoke_workbench',
    buildingId: 'BUILDING_CARPENTER_BENCH',
    condition: 100,
    isBuilt: true,
    buildProgressSeconds: 40,
    totalBuildSeconds: 40,
    areaId: 'AREA_CAMP_CLEARING',
  });
}

function addStoneKnives(state: GameState, count: number): void {
  const result = addItemToInventory(state.inventory, 'ITEM_STONE_KNIFE', count, 'standard');
  assert.equal(result.success, true, 'test knives should fit in inventory');
  tickComponentBootstrap(state);
}

function getKnives(state: GameState) {
  return state.inventory.items.filter(item => item.itemId === 'ITEM_STONE_KNIFE');
}

function testPermanentDamageCeilingDoesNotRatchet(): void {
  const state = freshState();
  addStoneKnives(state, 1);
  const knife = getKnives(state)[0];
  assert.ok(knife?.components?.length, 'knife must have physical components');

  const blade = knife.components!.find(component => component.slot === 'blade');
  assert.ok(blade, 'knife must have a blade');
  blade.conditionMax *= 0.8;
  blade.condition = Math.min(blade.condition, blade.conditionMax);
  blade.permanentDamage = (blade.permanentDamage || 0) + blade.originalConditionMax * 0.2;
  syncAggregateConditionFromComponents(knife);

  const firstCeiling = knife.conditionMax!;
  tickComponentBootstrap(state);
  const secondCeiling = knife.conditionMax!;
  tickComponentBootstrap(state);
  const thirdCeiling = knife.conditionMax!;

  assert.ok(firstCeiling < (knife.originalConditionMax || Infinity), 'component damage must lower aggregate max durability');
  assert.equal(secondCeiling, firstCeiling, 'first bootstrap must not ratchet max durability');
  assert.equal(thirdCeiling, firstCeiling, 'repeated bootstrap must remain stable');
}

function testCriticalFailureDisablesLegacyConditionGate(): void {
  const state = freshState();
  addStoneKnives(state, 1);
  const knife = getKnives(state)[0];
  const blade = knife.components!.find(component => component.slot === 'blade');
  assert.ok(blade, 'knife must have a critical blade');

  blade.condition = 0;
  tickComponentBootstrap(state);
  assert.equal(knife.condition, 0, 'critical component failure must expose condition=0 to legacy schedulers');
}

function testCancellationNeverRefundsConsumedMaterial(): void {
  let state = freshState();
  addStoneKnives(state, 1);
  addItemToInventory(state.inventory, 'ITEM_VINE_FIBER', 2, 'standard');
  const knife = getKnives(state)[0];
  const binding = knife.components!.find(component => component.slot === 'binding');
  assert.ok(binding, 'knife must have binding');
  binding.condition = Math.max(1, binding.conditionMax * 0.35);
  syncAggregateConditionFromComponents(knife);

  const before = getAvailableInventoryStock(state.inventory, 'ITEM_VINE_FIBER');
  state = queueMaintenanceJob(state, knife.instanceId, 'quick_patch', binding.instanceId, state.survivors[0].id);
  const job = state.maintenanceSystem?.queue[0];
  assert.ok(job, 'quick patch job should queue');

  // Reservation does not remove physical stock, but it does make one unit unavailable.
  assert.equal(getAvailableInventoryStock(state.inventory, 'ITEM_VINE_FIBER'), before - 1);

  prepareMaintenanceWorkstations(state);
  tickMaintenanceSystem(state, 0.1);
  assert.equal(state.maintenanceSystem?.queue[0]?.materialsConsumed, true, 'job start must consume its reserved phase materials');

  const physicalAfterConsume = state.inventory.items
    .filter(item => item.itemId === 'ITEM_VINE_FIBER')
    .reduce((sum, item) => sum + item.quantity, 0);

  state = cancelMaintenanceJob(state, job.id);
  const physicalAfterCancel = state.inventory.items
    .filter(item => item.itemId === 'ITEM_VINE_FIBER')
    .reduce((sum, item) => sum + item.quantity, 0);

  assert.equal(physicalAfterCancel, physicalAfterConsume, 'cancelling after consumption must not magically refund material');
  const cancelledKnife = state.inventory.items.find(item => item.instanceId === knife.instanceId);
  assert.equal(cancelledKnife?.reservedQuantity || 0, 0, 'cancel must release the exclusive target lock');
}

function testWorkbenchCapacitySharedAcrossRepairAndUpgrade(): void {
  let state = freshState();
  addSecondCrafter(state);
  addWorkbench(state);
  addStoneKnives(state, 2);
  addItemToInventory(state.inventory, 'ITEM_RIVER_PEBBLE', 4, 'standard');
  addItemToInventory(state.inventory, 'ITEM_VINE_FIBER', 4, 'standard');

  const [repairKnife, upgradeKnife] = getKnives(state);
  assert.ok(repairKnife && upgradeKnife, 'two distinct tool instances required');
  const repairBlade = repairKnife.components!.find(component => component.slot === 'blade');
  const upgradeHandle = upgradeKnife.components!.find(component => component.slot === 'handle');
  assert.ok(repairBlade && upgradeHandle, 'test components must exist');

  repairBlade.condition = Math.max(1, repairBlade.conditionMax * 0.3);
  syncAggregateConditionFromComponents(repairKnife);

  state = queueMaintenanceJob(
    state,
    repairKnife.instanceId,
    'repair',
    repairBlade.instanceId,
    state.survivors[0].id,
  );
  state = queueComponentModification(
    state,
    upgradeKnife.instanceId,
    'reinforce',
    upgradeHandle.instanceId,
    state.survivors[1].id,
  );

  prepareMaintenanceWorkstations(state);
  tickMaintenanceSystem(state, 0.1);
  const maintenance = state.maintenanceSystem?.queue[0];
  assert.equal(maintenance?.status, 'in_progress', 'heavy repair should start on workbench');
  assert.equal(maintenance?.assignedWorkstationId, 'smoke_workbench');

  prepareUpgradeWorkstations(state);
  const upgrade = state.upgradeSystem?.queue[0];
  assert.equal(upgrade?.status, 'waiting_workstation', 'upgrade must wait while repair occupies the only workbench');
  assert.equal(upgrade?.assignedWorkstationId, undefined, 'waiting upgrade must not double-claim the workbench');
}

function main(): void {
  testPermanentDamageCeilingDoesNotRatchet();
  testCriticalFailureDisablesLegacyConditionGate();
  testCancellationNeverRefundsConsumedMaterial();
  testWorkbenchCapacitySharedAcrossRepairAndUpgrade();
  console.log('Deep production smoke tests passed.');
}

main();