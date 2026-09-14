import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/storageSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureStorageSystem } from '../src/simulation/storageSystem';

function fresh(): GameState {
  return JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
}

function addCrate(state: GameState) {
  state.buildings.push({
    id: 'storage_mod_crate',
    buildingId: 'BUILDING_BAMBOO_SUPPLY_CRATE',
    condition: 100,
    isBuilt: true,
    buildProgressSeconds: 34,
    totalBuildSeconds: 34,
    areaId: 'AREA_CAMP_CLEARING',
    structureModifications: [],
  });
  ensureStorageSystem(state);
  return state.buildings.find(building => building.id === 'storage_mod_crate')!;
}

function location(state: GameState) {
  return state.storageSystem!.locations.find(entry => entry.buildingInstanceId === 'storage_mod_crate')!;
}

function testStorageModificationDerivationIsStable(): void {
  const state = fresh();
  const building = addCrate(state);
  const base = location(state);
  const baseWeight = base.capacity.maxWeightKg;
  const baseVolume = base.capacity.maxVolumeL;
  const basePest = base.environment.pestProtection;
  const baseAccess = base.environment.accessibility;

  building.structureModifications = [
    {
      id: 'mod_record_reinforced',
      modificationId: 'MOD_STORAGE_REINFORCED_FRAME',
      appliedAtGameMinute: 0,
      workmanship: 75,
    },
    {
      id: 'mod_record_pest',
      modificationId: 'MOD_STORAGE_PEST_SCREEN',
      appliedAtGameMinute: 0,
      workmanship: 75,
    },
    {
      id: 'mod_record_dividers',
      modificationId: 'MOD_STORAGE_DIVIDERS',
      appliedAtGameMinute: 0,
      workmanship: 75,
    },
  ];

  ensureStorageSystem(state);
  const modified = location(state);
  assert.ok(modified.capacity.maxWeightKg > baseWeight, 'reinforced frame must increase physical weight capacity');
  assert.ok(modified.capacity.maxVolumeL < baseVolume * 1.05, 'internal dividers must consume some of the reinforced volume gain');
  assert.ok(modified.environment.pestProtection > basePest, 'pest screen must increase pest protection');
  assert.ok(modified.environment.accessibility > baseAccess, 'dividers should net improve access even with pest screen penalty');

  const snapshot = {
    weight: modified.capacity.maxWeightKg,
    volume: modified.capacity.maxVolumeL,
    pest: modified.environment.pestProtection,
    access: modified.environment.accessibility,
  };
  ensureStorageSystem(state);
  ensureStorageSystem(state);
  const repeated = location(state);
  assert.deepEqual(
    {
      weight: repeated.capacity.maxWeightKg,
      volume: repeated.capacity.maxVolumeL,
      pest: repeated.environment.pestProtection,
      access: repeated.environment.accessibility,
    },
    snapshot,
    'derived storage modifications must never ratchet on repeated ensure/tick calls',
  );
}

function main(): void {
  testStorageModificationDerivationIsStable();
  console.log('Storage modification smoke tests passed.');
}

main();