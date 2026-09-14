import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { StructureComponentInstance } from '../src/types/structureSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import {
  queueStructureMaintenance,
  queueStructureModification,
  tickStructureWorkRuntime,
} from '../src/simulation/structureMaintenanceSystem';
import { getAvailableInventoryStock, getOrCreatePoiStorage } from '../src/simulation/inventorySystem';

function component(
  id: string,
  kind: StructureComponentInstance['kind'],
  materialItemId: string,
  condition = 100,
  max = 100,
): StructureComponentInstance {
  return {
    id,
    kind,
    name: kind,
    sourcePhaseKind: kind === 'roof' ? 'cover' : kind === 'frame' ? 'frame' : 'binding',
    materialItemIds: [materialItemId],
    materialQualities: ['standard'],
    workmanship: 70,
    condition,
    conditionMax: max,
    originalConditionMax: max,
    moisture: 45,
    rot: 0,
    fireDamage: 0,
    permanentDamage: 0,
  };
}

function freshState(): { state: GameState; buildingId: string } {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const simulation = ensureBuildingSimulation(state);
  simulation.structureWorkJobs = [];
  simulation.structureWorkHistory = [];

  // Remove the legacy under-construction campfire so only the smoke structure is relevant.
  state.buildings = [];
  const buildingId = 'structure_work_smoke';
  state.buildings.push({
    id: buildingId,
    buildingId: 'BUILDING_LEAF_SHELTER',
    condition: 72,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId: 'AREA_CAMP_CLEARING',
    clusterId: 'cluster_structure_work_smoke',
    footprintAreaM2: 18,
    placementScore: 72,
    structureComponents: [
      component('frame_smoke', 'frame', 'ITEM_DRIFTWOOD_BRANCH', 72, 100),
      component('binding_smoke', 'bindings', 'ITEM_VINE_FIBER', 62, 90),
      component('roof_smoke', 'roof', 'ITEM_PALM_LEAF', 38, 100),
    ],
    structureModifications: [],
  });
  return { state, buildingId };
}

function finishActiveJob(state: GameState): void {
  tickStructureWorkRuntime(state);
  const job = state.buildingSimulation!.structureWorkJobs!.find(candidate => candidate.status === 'in_progress');
  assert.ok(job, 'queued structure work should acquire a real worker');
  const worker = state.survivors.find(candidate => candidate.id === job.assignedSurvivorId);
  assert.ok(worker, 'in-progress structure work must own a real survivor');
  worker.currentAction.progressSeconds = job.totalSeconds;
  tickStructureWorkRuntime(state);
  assert.equal(job.status, 'completed');
  assert.equal(worker.currentAction.type, 'idle');
}

function testPatchConsumesAtStartAndLowersCeiling(): void {
  let { state, buildingId } = freshState();
  const roof = state.buildings[0].structureComponents!.find(entry => entry.id === 'roof_smoke')!;
  const storage = getOrCreatePoiStorage(state, 'AREA_CAMP_CLEARING');
  const availableBefore = getAvailableInventoryStock(state.inventory, 'ITEM_PALM_LEAF') + getAvailableInventoryStock(storage, 'ITEM_PALM_LEAF');
  const physicalBefore = state.inventory.items.filter(item => item.itemId === 'ITEM_PALM_LEAF').reduce((sum, item) => sum + item.quantity, 0) +
    storage.items.filter(item => item.itemId === 'ITEM_PALM_LEAF').reduce((sum, item) => sum + item.quantity, 0);

  state = queueStructureMaintenance(state, buildingId, roof.id, 'patch', state.survivors[0].id);
  const job = state.buildingSimulation!.structureWorkJobs![0];
  assert.equal(job.status, 'waiting_worker');
  const afterQueueStorage = getOrCreatePoiStorage(state, 'AREA_CAMP_CLEARING');
  const availableAfterQueue = getAvailableInventoryStock(state.inventory, 'ITEM_PALM_LEAF') + getAvailableInventoryStock(afterQueueStorage, 'ITEM_PALM_LEAF');
  assert.equal(availableAfterQueue, availableBefore - 1, 'patch material should be reserved but not physically consumed at planning');

  tickStructureWorkRuntime(state);
  assert.equal(job.materialsConsumed, true, 'structure material should be consumed when work actually starts');
  const physicalAfterStart = state.inventory.items.filter(item => item.itemId === 'ITEM_PALM_LEAF').reduce((sum, item) => sum + item.quantity, 0) +
    getOrCreatePoiStorage(state, 'AREA_CAMP_CLEARING').items.filter(item => item.itemId === 'ITEM_PALM_LEAF').reduce((sum, item) => sum + item.quantity, 0);
  assert.equal(physicalAfterStart, physicalBefore - 1);

  const worker = state.survivors.find(candidate => candidate.id === job.assignedSurvivorId)!;
  worker.currentAction.progressSeconds = job.totalSeconds;
  tickStructureWorkRuntime(state);
  const patched = state.buildings[0].structureComponents!.find(entry => entry.id === 'roof_smoke')!;
  assert.ok(patched.condition > 38, 'patch should restore current condition');
  assert.ok(patched.conditionMax < 100, 'quick patch must trade permanent ceiling for speed');
  assert.ok(patched.permanentDamage > 0);
}

function testReplaceRemovesPermanentDamage(): void {
  let { state, buildingId } = freshState();
  const roof = state.buildings[0].structureComponents!.find(entry => entry.id === 'roof_smoke')!;
  roof.condition = 30;
  roof.conditionMax = 74;
  roof.originalConditionMax = 100;
  roof.permanentDamage = 26;
  roof.rot = 68;

  state = queueStructureMaintenance(state, buildingId, roof.id, 'replace', state.survivors[0].id);
  finishActiveJob(state);
  const replaced = state.buildings[0].structureComponents!.find(entry => entry.id === 'roof_smoke')!;
  assert.equal(replaced.permanentDamage, 0, 'replace should reset permanent damage');
  assert.equal(replaced.rot, 0, 'replace should remove rotten physical section');
  assert.equal(replaced.condition, replaced.conditionMax, 'new component section should start at its new ceiling');
  assert.ok(replaced.conditionMax >= 85, 'standard replacement material should restore a realistic structural ceiling');
}

function testPhysicalModificationChangesAssembly(): void {
  let { state, buildingId } = freshState();
  const frameBefore = state.buildings[0].structureComponents!.find(entry => entry.id === 'frame_smoke')!.conditionMax;

  state = queueStructureModification(state, buildingId, 'MOD_CROSS_BRACING', state.survivors[0].id);
  finishActiveJob(state);
  const building = state.buildings[0];
  const frameAfter = building.structureComponents!.find(entry => entry.id === 'frame_smoke')!.conditionMax;
  assert.ok(frameAfter > frameBefore, 'cross bracing must physically raise frame ceiling');
  assert.ok(building.structureModifications?.some(record => record.modificationId === 'MOD_CROSS_BRACING'));

  // A completed modification cannot be queued twice on the same structure.
  const countBefore = state.buildingSimulation!.structureWorkJobs!.length;
  const duplicate = queueStructureModification(state, buildingId, 'MOD_CROSS_BRACING', state.survivors[0].id);
  assert.equal(duplicate.buildingSimulation!.structureWorkJobs!.length, countBefore, 'same modification must not stack infinitely');
}

function main(): void {
  testPatchConsumesAtStartAndLowersCeiling();
  testReplaceRemovesPermanentDamage();
  testPhysicalModificationChangesAssembly();
  console.log('Structure maintenance smoke tests passed.');
}

main();