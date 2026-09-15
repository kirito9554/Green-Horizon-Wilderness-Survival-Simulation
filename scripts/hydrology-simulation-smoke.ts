import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/hydrologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  getCellFloodRisk,
  getCellMoisture,
  getCellWaterAccess,
  getTotalHydrologyWaterM3,
  materializeRegionHydrology,
  tickWorldHydrology,
} from '../src/simulation/hydrologySystem';
import { getPoiBuildGridView } from '../src/simulation/buildGridSystem';
import { SOIL_HYDROLOGY_PROFILES } from '../src/data/hydrologyProfiles';
import { migrateGameState } from '../src/save/migrations';

function cloneState(): GameState {
  return JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
}

function testV14MigrationIsLazy(): void {
  const state = cloneState();
  state.saveVersion = 13;
  delete state.hydrologySystem;
  const migrated = migrateGameState(state);
  assert.equal(migrated.saveVersion, 14);
  assert.ok(migrated.hydrologySystem);
  assert.equal(Object.keys(migrated.hydrologySystem!.regionsByPoiId).length, 0, 'migration must not fabricate regional water networks');
  assert.equal(Object.keys(migrated.hydrologySystem!.cellStatesById).length, 0, 'migration must not fabricate cell water state');
}

function testLegacyCompatibilityBeforeMaterialization(): void {
  const state = cloneState();
  state.hydrologySystem = undefined;
  const grid = getPoiBuildGridView(state, 'AREA_FOREST_EDGE');
  const cell = grid.cells[0];
  assert.equal(getCellMoisture(state, 'AREA_FOREST_EDGE', cell.id), cell.moisture);
  assert.equal(getCellFloodRisk(state, 'AREA_FOREST_EDGE', cell.id), cell.floodRisk);
  assert.equal(getCellWaterAccess(state, 'AREA_FOREST_EDGE', cell.id), cell.resources.waterAccess);
}

function testDeterministicDrainageAndNoCycles(): void {
  const a = cloneState();
  const b = cloneState();
  a.buildingSimulation!.worldSeed = 'hydrology_same_seed';
  b.buildingSimulation!.worldSeed = 'hydrology_same_seed';
  a.buildingSimulation!.gridsByPoiId = {};
  b.buildingSimulation!.gridsByPoiId = {};
  a.hydrologySystem = undefined;
  b.hydrologySystem = undefined;

  const regionA = materializeRegionHydrology(a, 'AREA_FOREST_EDGE');
  const regionB = materializeRegionHydrology(b, 'AREA_FOREST_EDGE');
  assert.ok(regionA && regionB);
  assert.deepEqual(regionA!.drainageLinks, regionB!.drainageLinks, 'same world seed must yield identical drainage topology');
  assert.equal(regionA!.generationSeed, regionB!.generationSeed);

  const links = new Map(regionA!.drainageLinks.map(link => [link.cellId, link]));
  for (const link of regionA!.drainageLinks) {
    if (link.downstreamCellId) assert.ok(links.has(link.downstreamCellId), 'downstream references must stay inside the local grid');
    const visited = new Set<string>();
    let cursor: string | undefined = link.cellId;
    while (cursor) {
      assert.ok(!visited.has(cursor), `drainage cycle detected from ${link.cellId}`);
      visited.add(cursor);
      cursor = links.get(cursor)?.downstreamCellId;
      assert.ok(visited.size <= links.size, 'drainage chain exceeded cell count');
    }
  }

  const c = cloneState();
  c.buildingSimulation!.worldSeed = 'hydrology_different_seed';
  c.buildingSimulation!.gridsByPoiId = {};
  c.hydrologySystem = undefined;
  const regionC = materializeRegionHydrology(c, 'AREA_FOREST_EDGE');
  assert.ok(regionC);
  assert.notEqual(regionA!.generationSeed, regionC!.generationSeed, 'different world seeds must not share hydrology generation identity');
}

function testSoilHydrologyContrasts(): void {
  assert.ok(SOIL_HYDROLOGY_PROFILES.sand.infiltrationMmH > SOIL_HYDROLOGY_PROFILES.clay.infiltrationMmH);
  assert.ok(SOIL_HYDROLOGY_PROFILES.clay.fieldCapacityMm > SOIL_HYDROLOGY_PROFILES.sand.fieldCapacityMm);
  assert.ok(SOIL_HYDROLOGY_PROFILES.rock.runoffCoefficient > SOIL_HYDROLOGY_PROFILES.loam.runoffCoefficient);
  assert.ok(SOIL_HYDROLOGY_PROFILES.organic.saturationCapacityMm > SOIL_HYDROLOGY_PROFILES.gravel.saturationCapacityMm);
}

function testRainRechargeAndDrydown(): void {
  const state = cloneState();
  state.buildingSimulation!.worldSeed = 'hydrology_balance_seed';
  state.buildingSimulation!.gridsByPoiId = {};
  state.hydrologySystem = undefined;
  const region = materializeRegionHydrology(state, 'AREA_FOREST_EDGE');
  assert.ok(region);
  const aquiferId = `AQ_${region!.watershedId}`;
  const beforeAquifer = state.hydrologySystem!.aquifersById[aquiferId].storageM3;
  const beforeRainWater = getTotalHydrologyWaterM3(state);

  state.weather.current = 'heavy_rain';
  state.weather.rainIntensity = 0.78;
  state.weather.temperatureC = 24;
  state.weather.humidityPercent = 96;
  tickWorldHydrology(state, 180);

  const afterRainWater = getTotalHydrologyWaterM3(state);
  const afterAquifer = state.hydrologySystem!.aquifersById[aquiferId].storageM3;
  assert.ok(afterRainWater > beforeRainWater, 'sustained heavy rain should increase stored water');
  assert.ok(afterAquifer > beforeAquifer, 'deep infiltration should recharge the aquifer');

  state.weather.current = 'heat_wave';
  state.weather.rainIntensity = 0;
  state.weather.temperatureC = 38;
  state.weather.humidityPercent = 42;
  state.weather.wind.speedKmh = 10;
  const beforeDry = getTotalHydrologyWaterM3(state);
  tickWorldHydrology(state, 720);
  const afterDry = getTotalHydrologyWaterM3(state);
  assert.ok(afterDry < beforeDry, 'dry hot weather should remove surface/root-zone water rather than create it');
}

function testRuntimeOnlyBootstrapsStartRegion(): void {
  const state = cloneState();
  state.buildingSimulation!.gridsByPoiId = {};
  state.hydrologySystem = undefined;
  tickWorldHydrology(state, 30);
  const ids = Object.keys(state.hydrologySystem!.regionsByPoiId);
  assert.deepEqual(ids, ['AREA_CAMP_CLEARING'], 'runtime bootstrap must stay lazy and materialize only Plane Wreck');
  const region = state.hydrologySystem!.regionsByPoiId.AREA_CAMP_CLEARING;
  assert.ok(region);
  assert.ok(region!.drainageLinks.length > 0);
  assert.ok(region!.anchorNodeIds.length > 0, 'canonical coast anchor should be represented in the start region');
}

function main(): void {
  testV14MigrationIsLazy();
  testLegacyCompatibilityBeforeMaterialization();
  testDeterministicDrainageAndNoCycles();
  testSoilHydrologyContrasts();
  testRainRechargeAndDrydown();
  testRuntimeOnlyBootstrapsStartRegion();
  console.log('World hydrology foundation smoke tests passed.');
}

main();
