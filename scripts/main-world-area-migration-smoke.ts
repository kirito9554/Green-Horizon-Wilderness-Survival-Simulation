import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';
import { ensureStorageSystem } from '../src/simulation/storageSystem';
import { migrateGameState, LATEST_SAVE_VERSION } from '../src/save/migrations';
import {
  LEGACY_MAIN_AREA_IDS,
  MAIN_WORLD_AREA_IDS,
  isArchivedLegacyAreaId,
  resolveMainWorldAreaId,
} from '../src/data/mainWorldAreas';

function fresh(): GameState {
  return JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
}

function worldQuantity(state: GameState, itemId: string): number {
  return Object.values(state.poiStorages || {}).reduce((sum, storage) =>
    sum + (storage.items || [])
      .filter(item => item.itemId === itemId)
      .reduce((nested, item) => nested + item.quantity, 0), 0);
}

function testCanonicalRegistry(): void {
  assert.equal(MAIN_WORLD_AREA_IDS.length, 10, 'main world must expose exactly ten macro regions');
  assert.equal(new Set(MAIN_WORLD_AREA_IDS).size, 10, 'canonical macro region IDs must be unique');
  assert.equal(resolveMainWorldAreaId('AREA_RIVERBANK'), 'AREA_WATERFALL_BASIN');
  assert.equal(resolveMainWorldAreaId('AREA_COASTAL_SHALLOWS'), 'AREA_FISHING_LAGOON');
  assert.equal(resolveMainWorldAreaId('AREA_FORAGING_GROUNDS'), 'AREA_FOREST_EDGE');
  assert.equal(resolveMainWorldAreaId('AREA_CLOUD_PEAK'), undefined, 'future/archived sectors must never be guessed into the main map');
  assert.equal(isArchivedLegacyAreaId('AREA_CLOUD_PEAK'), true);
}

function testNewGameContainsNoRetiredMainAliases(): void {
  const state = fresh();
  assert.equal(state.saveVersion, 13);
  for (const legacyId of LEGACY_MAIN_AREA_IDS) {
    assert.equal(state.areasProgress[legacyId], undefined, `new game progress must not expose ${legacyId}`);
    assert.equal(state.poiStorages?.[legacyId], undefined, `new game storage must not expose ${legacyId}`);
  }
}

function testV12CanonicalizesLegacyMainWorldReferences(): void {
  const legacy = fresh();
  legacy.saveVersion = 11;

  legacy.areasProgress.AREA_RIVERBANK = { knowledgePercent: 72, lastGatheredTime: { NODE_RIVER_OLD: 44 } };
  legacy.areasProgress.AREA_COASTAL_SHALLOWS = { knowledgePercent: 61, lastGatheredTime: { NODE_COAST_OLD: 31 } };
  legacy.areasProgress.AREA_FORAGING_GROUNDS = { knowledgePercent: 83, lastGatheredTime: { NODE_FORAGE_OLD: 77 } };
  legacy.areasProgress.AREA_CLOUD_PEAK = { knowledgePercent: 37, lastGatheredTime: {} };

  legacy.poiStorages ||= {};
  legacy.poiStorages.AREA_RIVERBANK = {
    maxWeightKg: 55,
    maxVolumeL: 80,
    items: [{
      instanceId: 'legacy_river_item',
      itemId: 'ITEM_RIVER_PEBBLE',
      quantity: 3,
      quality: 'standard',
      qualityBreakdown: { standard: 3 },
      storageLocationId: 'storage_ground_AREA_RIVERBANK',
    }],
  };
  legacy.poiStorages.AREA_COASTAL_SHALLOWS = {
    maxWeightKg: 55,
    maxVolumeL: 80,
    items: [{
      instanceId: 'legacy_coast_item',
      itemId: 'ITEM_WILD_COCONUT',
      quantity: 2,
      quality: 'standard',
      qualityBreakdown: { standard: 2 },
      storageLocationId: 'storage_ground_AREA_COASTAL_SHALLOWS',
    }],
  };

  legacy.buildings.push({
    id: 'legacy_forest_building',
    buildingId: 'BUILDING_LEAF_SHELTER',
    condition: 80,
    isBuilt: true,
    buildProgressSeconds: 20,
    totalBuildSeconds: 20,
    areaId: 'AREA_FORAGING_GROUNDS',
  });
  legacy.expeditions.push({ id: 'legacy_river_expedition', areaId: 'AREA_RIVERBANK' } as GameState['expeditions'][number]);

  const targetGrid = getOrCreatePoiBuildGrid(legacy, 'AREA_FOREST_EDGE');
  const legacyGrid = getOrCreatePoiBuildGrid(legacy, 'AREA_FORAGING_GROUNDS');
  const preservedCellId = legacyGrid.cells[0].id;
  legacyGrid.cells[0].reservedAreaM2 = 9;
  legacy.buildingSimulation!.clusters.push({
    id: 'legacy_farm_cluster',
    poiId: 'AREA_FORAGING_GROUNDS',
    type: 'farming',
    name: 'Legacy Farming Patch',
    cellIds: [preservedCellId],
    usableAreaM2: 20,
    occupiedAreaM2: 0,
    state: 'active',
    siteScore: 70,
    maintenancePolicy: 'normal',
    createdAtGameMinute: 0,
  });
  const originalTargetCellCount = targetGrid.cells.length;

  legacy.agricultureSystem!.cultivationAreas.push({
    id: 'legacy_plot',
    poiId: 'AREA_FORAGING_GROUNDS',
    name: 'Legacy Plot',
    cellIds: [preservedCellId],
    usableAreaM2: 9,
    carePolicy: 'normal',
    soil: {
      moisture: 50, fertility: 50, organicMatter: 50, nitrogen: 50,
      phosphorus: 50, potassium: 50, compaction: 0, erosion: 0, contamination: 0,
    },
    plantIds: [],
    modifications: [],
    createdAtGameMinute: 0,
  });

  ensureStorageSystem(legacy);
  assert.ok(legacy.storageSystem!.locations.some(location => location.id === 'storage_ground_AREA_RIVERBANK'));

  const riverPebblesBefore = worldQuantity(legacy, 'ITEM_RIVER_PEBBLE');
  const coconutsBefore = worldQuantity(legacy, 'ITEM_WILD_COCONUT');
  const migrated = migrateGameState(legacy);

  assert.equal(LATEST_SAVE_VERSION, 13);
  assert.equal(migrated.saveVersion, 13);

  assert.equal(migrated.areasProgress.AREA_RIVERBANK, undefined);
  assert.equal(migrated.areasProgress.AREA_COASTAL_SHALLOWS, undefined);
  assert.equal(migrated.areasProgress.AREA_FORAGING_GROUNDS, undefined);
  assert.ok(migrated.areasProgress.AREA_WATERFALL_BASIN.knowledgePercent >= 72);
  assert.ok(migrated.areasProgress.AREA_FISHING_LAGOON.knowledgePercent >= 61);
  assert.ok(migrated.areasProgress.AREA_FOREST_EDGE.knowledgePercent >= 83);
  assert.equal(migrated.areasProgress.AREA_CLOUD_PEAK.knowledgePercent, 37, 'archived sector progress must survive untouched');

  assert.equal(migrated.poiStorages?.AREA_RIVERBANK, undefined);
  assert.equal(migrated.poiStorages?.AREA_COASTAL_SHALLOWS, undefined);
  assert.equal(worldQuantity(migrated, 'ITEM_RIVER_PEBBLE'), riverPebblesBefore, 'POI merge must conserve river stock');
  assert.equal(worldQuantity(migrated, 'ITEM_WILD_COCONUT'), coconutsBefore, 'POI merge must conserve coastal stock');
  assert.ok(migrated.poiStorages!.AREA_WATERFALL_BASIN.items.some(item => item.instanceId === 'legacy_river_item'));
  assert.ok(migrated.poiStorages!.AREA_FISHING_LAGOON.items.some(item => item.instanceId === 'legacy_coast_item'));
  assert.equal(
    migrated.poiStorages!.AREA_WATERFALL_BASIN.items.find(item => item.instanceId === 'legacy_river_item')?.storageLocationId,
    'storage_ground_AREA_WATERFALL_BASIN',
  );

  assert.equal(migrated.buildings.find(building => building.id === 'legacy_forest_building')?.areaId, 'AREA_FOREST_EDGE');
  assert.equal(migrated.expeditions.find(expedition => expedition.id === 'legacy_river_expedition')?.areaId, 'AREA_WATERFALL_BASIN');

  assert.equal(migrated.buildingSimulation!.gridsByPoiId.AREA_FORAGING_GROUNDS, undefined);
  const mergedGrid = migrated.buildingSimulation!.gridsByPoiId.AREA_FOREST_EDGE;
  assert.ok(mergedGrid.cells.length > originalTargetCellCount, 'legacy physical patch should be appended to the macro-region grid');
  assert.ok(mergedGrid.cells.some(cell => cell.id === preservedCellId && cell.reservedAreaM2 === 9), 'claimed legacy cell must survive with its opaque ID');
  assert.equal(migrated.buildingSimulation!.clusters.find(cluster => cluster.id === 'legacy_farm_cluster')?.poiId, 'AREA_FOREST_EDGE');
  assert.equal(migrated.agricultureSystem!.cultivationAreas.find(area => area.id === 'legacy_plot')?.poiId, 'AREA_FOREST_EDGE');

  assert.equal(migrated.storageSystem!.locations.some(location => location.id === 'storage_ground_AREA_RIVERBANK'), false);
  assert.ok(migrated.storageSystem!.locations.some(location => location.id === 'storage_ground_AREA_WATERFALL_BASIN'));
  assert.ok(migrated.ecologySystem, 'latest migration must also initialize the lazy ecology container');
}

function main(): void {
  testCanonicalRegistry();
  testNewGameContainsNoRetiredMainAliases();
  testV12CanonicalizesLegacyMainWorldReferences();
  console.log('Canonical main-world POI migration smoke tests passed.');
}

main();
