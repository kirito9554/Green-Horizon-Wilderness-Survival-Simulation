import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import '../src/types/ecologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldEcologyState, discoverEcologySubarea, ensureRegionEcology, getRegionSubareas, tickWorldEcology } from '../src/simulation/ecologySystem';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import {
  ensureRegionWildFauna,
  ensureWildFauna,
  getSubareaWildFoodPool,
  getWildFaunaFingerprint,
  promoteWildAnimalIndividual,
  tickWildFauna,
} from '../src/simulation/ecologyFaunaSystem';

function fresh(seed: string): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.clusters = [];
  building.preparationJobs = [];
  state.ecologySystem = createWorldEcologyState();
  return state;
}

function materializeRegion(state: GameState, poiId = 'AREA_FOREST_EDGE'): void {
  const region = ensureRegionEcology(state, poiId)!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
}

function advanceMinutes(state: GameState, minutes: number): void {
  const total = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay + minutes;
  state.gameTime.day = Math.floor(total / 1440) + 1;
  state.gameTime.minuteOfDay = total % 1440;
}

function testDeterministicFaunaSeeding(): void {
  const a = fresh('fauna-seed-A');
  const b = fresh('fauna-seed-A');
  const c = fresh('fauna-seed-B');
  materializeRegion(a);
  materializeRegion(b);
  materializeRegion(c);

  const fingerprintA = getWildFaunaFingerprint(a, 'AREA_FOREST_EDGE');
  const fingerprintB = getWildFaunaFingerprint(b, 'AREA_FOREST_EDGE');
  const fingerprintC = getWildFaunaFingerprint(c, 'AREA_FOREST_EDGE');

  assert.ok(fingerprintA.length > 0, 'a viable Deep Rainforest must seed at least one herbivore/omnivore population');
  assert.equal(fingerprintA, fingerprintB, 'same world seed must reproduce the same wild-fauna populations and home ranges');
  assert.notEqual(fingerprintA, fingerprintC, 'different world seeds should vary wild-fauna distribution');
}

function testHomeRangesStayInsideMacroRegion(): GameState {
  const state = fresh('fauna-home-range-seed');
  materializeRegion(state);
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  const populations = ensureRegionWildFauna(state, 'AREA_FOREST_EDGE');
  const allowed = new Set(region.subareaIds);

  assert.ok(populations.length > 0);
  for (const population of populations) {
    assert.equal(population.poiId, 'AREA_FOREST_EDGE');
    assert.ok(allowed.has(population.currentSubareaId), 'current habitat must belong to the population macro-region');
    assert.ok(population.homeRangeSubareaIds.length > 0, 'wild populations require a persistent home range');
    assert.ok(population.homeRangeSubareaIds.every(id => allowed.has(id)), 'home range must not teleport across macro-regions');
    assert.equal(population.population, population.juveniles + population.adults + population.old, 'age structure must conserve head count');
  }
  return state;
}

function totalFood(state: GameState, subareaId: string): number {
  const pool = getSubareaWildFoodPool(state, subareaId);
  return (Object.values(pool) as number[]).reduce((sum, value) => sum + value, 0);
}

function testAnimalsConsumeRealFoodBiomass(): void {
  const state = testHomeRangesStayInsideMacroRegion();
  const population = state.ecologySystem!.animalPopulations![0];
  const subarea = state.ecologySystem!.subareasById[population.currentSubareaId];
  assert.ok(subarea.materializationState === 'materialized');

  // A larger temporary test cohort makes ecological consumption visible above rounding noise.
  population.juveniles = 2;
  population.adults = 8;
  population.old = 1;
  population.population = 11;
  population.lastUpdatedGameMinute = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay;
  const before = totalFood(state, subarea.id);

  advanceMinutes(state, 720);
  tickWildFauna(state, 720);
  const after = totalFood(state, subarea.id);

  assert.ok(after < before, 'wild animals must consume persistent fruit/seed/vegetation/insect biomass rather than a virtual feeding timer');
  assert.ok(subarea.disturbance.foragingPressure > 0, 'feeding must leave ecological pressure on the occupied subarea');
}

function testHumanPressureDrivesPatchMovement(): void {
  const state = fresh('fauna-movement-seed');
  materializeRegion(state);
  const populations = ensureRegionWildFauna(state, 'AREA_FOREST_EDGE');
  const system = ensureWildFauna(state);
  const population = populations.find(entry => entry.homeRangeSubareaIds.length > 1) || populations[0];
  assert.ok(population, 'test needs at least one mobile population');

  const connection = system.connections.find(link =>
    link.poiId === 'AREA_FOREST_EDGE'
    && (link.fromSubareaId === population.currentSubareaId || link.toSubareaId === population.currentSubareaId),
  );
  assert.ok(connection, 'population habitat should have a graph neighbor');
  const currentId = population.currentSubareaId;
  const neighborId = connection!.fromSubareaId === currentId ? connection!.toSubareaId : connection!.fromSubareaId;
  population.homeRangeSubareaIds = Array.from(new Set([...population.homeRangeSubareaIds, currentId, neighborId]));
  system.subareasById[currentId].disturbance.humanPressure = 100;
  system.subareasById[neighborId].disturbance.humanPressure = 0;
  population.humanFear = 100;
  population.migrationPressure = 100;
  population.foodStress = 85;
  population.movementProgress = 1.2;
  population.lastUpdatedGameMinute = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay;

  advanceMinutes(state, 120);
  tickWildFauna(state, 120);
  assert.notEqual(population.currentSubareaId, currentId, 'severe human/food pressure should make a mobile population leave the disturbed patch when a connected refuge exists');
}

function testIndividualPromotionConservesAnimals(): void {
  const state = fresh('fauna-promotion-seed');
  materializeRegion(state);
  const populations = ensureRegionWildFauna(state, 'AREA_FOREST_EDGE');
  const population = populations.find(entry => entry.population > 0)!;
  assert.ok(population);
  const system = ensureWildFauna(state);
  const beforePopulation = system.animalPopulations!.reduce((sum, entry) => sum + entry.population, 0);
  const beforeIndividuals = system.significantAnimals!.length;

  const animal = promoteWildAnimalIndividual(state, population.id, 'adult') || promoteWildAnimalIndividual(state, population.id);
  assert.ok(animal, 'an aggregate wild population must be promotable into a persistent individual');
  const afterPopulation = system.animalPopulations!.reduce((sum, entry) => sum + entry.population, 0);
  const afterIndividuals = system.significantAnimals!.length;

  assert.equal(afterPopulation, beforePopulation - 1, 'promotion must extract exactly one animal from aggregate population');
  assert.equal(afterIndividuals, beforeIndividuals + 1, 'promotion must create exactly one persistent individual');
  assert.equal(afterPopulation + afterIndividuals, beforePopulation + beforeIndividuals, 'promotion must conserve total living animals');
  assert.equal(animal!.sourcePopulationId, population.id);
  assert.ok(animal!.homeRangeSubareaIds.includes(animal!.currentSubareaId));
}

function testRuntimeSeedsOnlyObservedRegion(): void {
  const state = fresh('fauna-runtime-seed');
  tickWildFauna(state, 60);
  assert.equal(state.ecologySystem!.animalPopulations?.length || 0, 0, 'fauna must not generate before any region has been observed');

  tickWorldEcology(state, 60);
  tickWildFauna(state, 60);
  const system = ensureWildFauna(state);
  assert.ok((system.animalPopulations?.length || 0) > 0, 'the observed Plane Wreck region should seed wild fauna');
  assert.ok(system.animalPopulations!.every(population => population.poiId === 'AREA_CAMP_CLEARING'), 'runtime must not populate unobserved macro-regions');
}

function main(): void {
  testDeterministicFaunaSeeding();
  testHomeRangesStayInsideMacroRegion();
  testAnimalsConsumeRealFoodBiomass();
  testHumanPressureDrivesPatchMovement();
  testIndividualPromotionConservesAnimals();
  testRuntimeSeedsOnlyObservedRegion();
  console.log('World ecology herbivore/omnivore smoke tests passed.');
}

main();
