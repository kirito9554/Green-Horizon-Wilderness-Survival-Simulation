import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  establishPrimitiveAquaticHabitat,
  establishPrimitiveCultivationArea,
  establishPrimitiveTerrestrialHabitat,
  introduceTerrestrialAnimal,
  queueAgricultureCareJob,
  queuePlanting,
  stockAquaticAnimal,
  tickAgriculture,
} from '../src/simulation/agricultureSystem';
import { getAvailableInventoryStock } from '../src/simulation/inventorySystem';
import { migrateGameState, LATEST_SAVE_VERSION } from '../src/save/migrations';
import { AQUATIC_SPECIES, PLANT_SPECIES } from '../src/data/agricultureSpecies';

function freshState(): GameState {
  return JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
}

function runAgriculture(state: GameState, seconds = 90): void {
  // A generous game-minute delta lets physiology update while deltaGameSeconds
  // advances persistent worker jobs to completion in a deterministic test.
  tickAgriculture(state, seconds / 2, seconds);
}

function itemQuantityAtPoi(state: GameState, poiId: string, itemId: string): number {
  return (state.poiStorages?.[poiId]?.items || []).filter(item => item.itemId === itemId).reduce((sum, item) => sum + item.quantity, 0);
}

function testPlantingConsumesReservedSeedAndCreatesIndividuals(): GameState {
  let state = freshState();
  state = establishPrimitiveCultivationArea(state, 'AREA_CAMP_CLEARING');
  const area = state.agricultureSystem?.cultivationAreas[0];
  assert.ok(area, 'primitive cultivation must create a managed area');
  assert.ok(area.cellIds.length > 0, 'cultivation area must own physical build-grid cells');

  const campStorage = state.poiStorages?.AREA_CAMP_CLEARING;
  assert.ok(campStorage, 'camp POI storage must exist');
  const physicalBefore = itemQuantityAtPoi(state, 'AREA_CAMP_CLEARING', 'ITEM_CASSAVA_CUTTING');
  const availableBefore = getAvailableInventoryStock(campStorage, 'ITEM_CASSAVA_CUTTING');

  state = queuePlanting(state, area.id, 'PLANT_CASSAVA', 3);
  const job = state.agricultureSystem?.jobs.find(candidate => candidate.kind === 'plant');
  assert.ok(job, 'planting should create a persistent agriculture job');
  assert.equal(itemQuantityAtPoi(state, 'AREA_CAMP_CLEARING', 'ITEM_CASSAVA_CUTTING'), physicalBefore, 'reservation must not remove physical seed before work starts');
  assert.equal(getAvailableInventoryStock(state.poiStorages!.AREA_CAMP_CLEARING, 'ITEM_CASSAVA_CUTTING'), availableBefore - 3, 'reserved seed must become unavailable to competing systems');

  runAgriculture(state, 120);
  assert.equal(state.agricultureSystem?.plants.length, 3, 'completed planting must create three distinct plant entities');
  assert.equal(new Set(state.agricultureSystem?.plants.map(plant => plant.id)).size, 3, 'plant entities require unique persistent IDs');
  assert.equal(itemQuantityAtPoi(state, 'AREA_CAMP_CLEARING', 'ITEM_CASSAVA_CUTTING'), physicalBefore - 3, 'seed must only be physically consumed after work starts');
  assert.ok(state.agricultureSystem?.plants.every(plant => plant.cultivationAreaId === area.id), 'plants must live inside the cultivation habitat');
  return state;
}

function testHarvestEmergesFromPlantAndLandsInGroundCache(): void {
  let state = testPlantingConsumesReservedSeedAndCreatesIndividuals();
  const area = state.agricultureSystem!.cultivationAreas[0];
  const plant = state.agricultureSystem!.plants[0];
  const species = PLANT_SPECIES[plant.speciesId];
  plant.ageHours = species.maturityHours * 1.2;
  plant.lifeStage = 'fruiting';
  plant.health = 91;
  plant.harvestableUnits = 4.4;

  const partyBefore = state.inventory.items.filter(item => item.itemId === species.harvestItemId).reduce((sum, item) => sum + item.quantity, 0);
  const poiBefore = itemQuantityAtPoi(state, area.poiId, species.harvestItemId);
  state = queueAgricultureCareJob(state, 'harvest', area.id);
  runAgriculture(state, 120);

  assert.equal(state.inventory.items.filter(item => item.itemId === species.harvestItemId).reduce((sum, item) => sum + item.quantity, 0), partyBefore, 'harvest must not teleport into party inventory');
  assert.ok(itemQuantityAtPoi(state, area.poiId, species.harvestItemId) >= poiBefore + 4, 'harvest must land in the source POI ground cache for storage logistics');
  const harvested = state.agricultureSystem!.plants.find(candidate => candidate.id === plant.id);
  assert.equal(harvested?.lifeStage, 'dead', 'destructive cassava harvest must terminate that individual plant');
  assert.ok(state.agricultureSystem!.productionHistory.some(record => record.sourceId === plant.id && record.itemId === species.harvestItemId), 'production history must point back to the living source entity');
}

function testTerrestrialHabitatContainsIndividualsAndProducesByAnimal(): void {
  let state = freshState();
  state = establishPrimitiveTerrestrialHabitat(state, 'AREA_CAMP_CLEARING');
  const habitat = state.agricultureSystem?.terrestrialHabitats[0];
  assert.ok(habitat, 'simple fenced ground must create a terrestrial habitat');
  assert.equal(habitat.animalIds.length, 0, 'a pen itself must never manufacture livestock');

  state = introduceTerrestrialAnimal(state, habitat.id, 'ANIMAL_CHICKEN', 'female', 1.1);
  const animal = state.agricultureSystem!.terrestrialAnimals[0];
  assert.ok(animal && habitat.id === animal.habitatId, 'introduced livestock must be an individual entity living in the habitat');
  animal.productProgress = 40;
  const eggsBefore = itemQuantityAtPoi(state, habitat.poiId, 'ITEM_EGG');
  state = queueAgricultureCareJob(state, 'collect_product', habitat.id);
  runAgriculture(state, 120);
  assert.ok(itemQuantityAtPoi(state, habitat.poiId, 'ITEM_EGG') > eggsBefore, 'eggs must emerge from a ready hen, not from the pen timer');
}

function testAquacultureUsesNaturalWaterAndIndividualAnimals(): void {
  let state = freshState();
  state = establishPrimitiveAquaticHabitat(state, 'AREA_WATERFALL_BASIN');
  const habitat = state.agricultureSystem?.aquaticHabitats[0];
  assert.ok(habitat, 'River Gorge should expose a usable natural-water aquaculture site');
  assert.ok(['river_segment', 'lake_edge', 'pond_site'].includes(habitat.siteType), 'aquaculture must record its physical water-site type');
  assert.equal(habitat.aquaticAnimalIds.length, 0, 'water enclosure must not spawn fish automatically');

  state = stockAquaticAnimal(state, habitat.id, 'AQUATIC_TILAPIA', 2);
  assert.equal(state.agricultureSystem?.aquaticAnimals.length, 2, 'stocking must create individual aquatic entities');
  const fish = state.agricultureSystem!.aquaticAnimals[0];
  const tilapia = AQUATIC_SPECIES.AQUATIC_TILAPIA;
  fish.ageHours = tilapia.maturityHours * 1.05;
  fish.lifeStage = 'adult';
  fish.weightKg = tilapia.adultWeightKg * 1.02;
  const before = itemQuantityAtPoi(state, habitat.poiId, 'ITEM_FRESH_FISH');
  state = queueAgricultureCareJob(state, 'harvest_aquatic', habitat.id);
  runAgriculture(state, 120);
  assert.ok(itemQuantityAtPoi(state, habitat.poiId, 'ITEM_FRESH_FISH') > before, 'aquatic harvest must remove real adults and create fresh fish stock');
  assert.ok((state.agricultureSystem?.aquaticAnimals.length || 0) < 2, 'harvested fish entity must be removed from the living population');
}

function testAgricultureMigrationSurvivesLatestSchema(): void {
  const legacy = freshState();
  legacy.saveVersion = 10;
  delete legacy.agricultureSystem;
  const migrated = migrateGameState(legacy);
  assert.equal(LATEST_SAVE_VERSION, 13, 'world ecology foundation must own save version 13');
  assert.equal(migrated.saveVersion, 13, 'older saves must reach the latest schema after agriculture initialization');
  assert.ok(migrated.agricultureSystem, 'migration must initialize persistent agriculture state');
  assert.deepEqual(migrated.agricultureSystem?.plants, [], 'migration must not fabricate living entities for old saves');
  assert.ok(migrated.ecologySystem, 'latest schema must add lazy world ecology without changing agriculture entities');
}

function main(): void {
  testPlantingConsumesReservedSeedAndCreatesIndividuals();
  testHarvestEmergesFromPlantAndLandsInGroundCache();
  testTerrestrialHabitatContainsIndividualsAndProducesByAnimal();
  testAquacultureUsesNaturalWaterAndIndividualAnimals();
  testAgricultureMigrationSurvivesLatestSchema();
  console.log('Agriculture simulation smoke tests passed.');
}

main();
