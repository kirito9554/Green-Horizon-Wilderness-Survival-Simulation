import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { WildPredatorPopulation } from '../src/types/ecologySimulation';
import '../src/types/ecologySimulation';
import { WILD_PREDATOR_SPECIES } from '../src/data/ecologyPredators';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import { createWorldEcologyState, discoverEcologySubarea, ensureRegionEcology } from '../src/simulation/ecologySystem';
import { ensureRegionWildFauna, ensureWildFauna } from '../src/simulation/ecologyFaunaSystem';
import { ensurePredatorEnergyState, ensureWildPredators } from '../src/simulation/ecologyPredatorSystem';
import {
  getPredatorPressureResponseDiagnostics,
  tickPredatorPressureResponse,
  tickWildPredatorsWithPressureResponse,
} from '../src/simulation/predatorPressureResponseSystem';

function advanceMinutes(state: GameState, minutes: number): void {
  const total = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay + minutes;
  state.gameTime.day = Math.floor(total / 1440) + 1;
  state.gameTime.minuteOfDay = total % 1440;
}

function baseState(seed: string): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.clusters = [];
  building.preparationJobs = [];
  state.ecologySystem = createWorldEcologyState();
  return state;
}

function makePredator(
  state: GameState,
  populationCount: number,
  homeRangeIds?: string[],
): { predator: WildPredatorPopulation; regionId: string } {
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
  const system = ensureWildPredators(state);
  const species = WILD_PREDATOR_SPECIES.PREDATOR_MONITOR_LIZARD;
  const range = homeRangeIds || region.subareaIds.slice(0, Math.min(species.homeRangeMax, region.subareaIds.length));
  const currentSubareaId = range[0] || region.subareaIds[0];
  assert.ok(currentSubareaId);
  const now = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay;
  const predator: WildPredatorPopulation = {
    id: `pressure_fixture_${populationCount}_${range.length}`,
    speciesId: species.id,
    poiId: region.poiId,
    currentSubareaId,
    homeRangeSubareaIds: [...range],
    population: populationCount,
    juveniles: 0,
    adults: populationCount,
    old: 0,
    maleRatio: 0.5,
    biomassKg: species.adultWeightKg * populationCount,
    averageHealth: 88,
    bodyCondition: 82,
    hungerStress: 18,
    waterStress: 5,
    reproductionPressure: 35,
    migrationPressure: 8,
    humanFear: 0,
    geneticDiversity: 72,
    reproductionProgress: 0,
    maturationProgress: 0,
    agingProgress: 0,
    mortalityProgress: 0,
    movementProgress: 0,
    predationProgressByPreySpecies: {},
    lastMoveGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  ensurePredatorEnergyState(predator, species, 0);
  predator.energyReserveKg = 0;
  system.predatorPopulations = [predator];
  system.significantPredators = [];
  region.predatorsSeeded = true;
  return { predator, regionId: region.poiId };
}

function testChronicStressReducesLocalDensity(): void {
  const state = baseState('p4-chronic-pressure');
  const { predator, regionId } = makePredator(state, 12);
  const system = ensureWildPredators(state);
  const region = system.regionsByPoiId[regionId]!;
  system.animalPopulations = [];
  system.significantAnimals = [];
  region.faunaSeeded = true;
  const initialPopulation = predator.population;

  // Prime P4 metadata at the current game minute, then run a genuinely sustained
  // prey-free state. P2 reserve is intentionally empty, so hunger/competition
  // pressure must eventually resolve through dispersal and chronic mortality.
  tickPredatorPressureResponse(state, 0);
  for (let day = 0; day < 60 && predator.population > 1; day++) {
    advanceMinutes(state, 1440);
    tickWildPredatorsWithPressureResponse(state, 1440);
  }

  const diagnostic = getPredatorPressureResponseDiagnostics(state)[0];
  assert.ok(diagnostic, 'stressed predator population should remain diagnosable');
  assert.ok(diagnostic.chronicStressDays >= 7, 'sustained prey failure must accumulate chronic stress');
  assert.ok(diagnostic.totalEmigrants > 0, 'chronic migration pressure must produce real local dispersal');
  assert.ok(predator.population < initialPopulation, 'local predator density must fall instead of hanging indefinitely at maximum hunger');
  assert.ok(predator.reproductionPressure <= 5, 'severe chronic hunger must keep reproduction strongly suppressed');
  assert.ok(predator.mortalityProgress > 0 || diagnostic.totalEmigrants >= 2, 'chronic stress must create a second density-response path beyond reproduction suppression');
}

function testPressureExpandsHomeRangeBeforeEmigration(): void {
  const state = baseState('p4-range-expansion');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
  const { predator } = makePredator(state, 2, [region.subareaIds[0]]);
  const system = ensureWildPredators(state);
  system.animalPopulations = [];
  system.significantAnimals = [];
  region.faunaSeeded = true;
  predator.hungerStress = 100;
  predator.migrationPressure = 100;
  const initialRange = predator.homeRangeSubareaIds.length;

  tickPredatorPressureResponse(state, 0);
  for (let day = 0; day < 6; day++) {
    advanceMinutes(state, 1440);
    predator.hungerStress = 100;
    predator.migrationPressure = 100;
    tickPredatorPressureResponse(state, 1440);
  }

  const diagnostic = getPredatorPressureResponseDiagnostics(state)[0];
  assert.ok(predator.homeRangeSubareaIds.length > initialRange, 'stressed predator should first search adjacent habitat when home-range capacity remains');
  assert.equal(diagnostic.totalEmigrants, 0, 'range expansion should be attempted before local emigration in the early chronic-stress window');
}

function testHealthySupportedPopulationDoesNotDisperse(): void {
  const state = baseState('p4-healthy-control');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
  ensureRegionWildFauna(state, region.poiId);
  const system = ensureWildFauna(state);
  const { predator } = makePredator(state, 1, region.subareaIds.slice(0, Math.min(6, region.subareaIds.length)));
  const species = WILD_PREDATOR_SPECIES[predator.speciesId];
  const compatible = (system.animalPopulations || []).filter(prey => (species.preyWeights[prey.speciesId] || 0) > 0);
  assert.ok(compatible.length > 0, 'healthy control needs compatible prey');
  for (const prey of compatible) {
    prey.currentSubareaId = predator.currentSubareaId;
    prey.population = Math.max(prey.population, 200);
    prey.adults = Math.max(prey.adults, 180);
    prey.juveniles = Math.max(prey.juveniles, 20);
    prey.old = 0;
    prey.biomassKg = Math.max(prey.biomassKg, 1800);
  }
  predator.hungerStress = 5;
  predator.waterStress = 2;
  predator.bodyCondition = 90;
  predator.migrationPressure = 5;

  tickPredatorPressureResponse(state, 0);
  for (let day = 0; day < 30; day++) {
    advanceMinutes(state, 1440);
    predator.hungerStress = 5;
    predator.waterStress = 2;
    predator.bodyCondition = 90;
    predator.migrationPressure = 5;
    tickPredatorPressureResponse(state, 1440);
  }

  const diagnostic = getPredatorPressureResponseDiagnostics(state)[0];
  assert.equal(diagnostic.totalEmigrants, 0, 'well-supported predators must not leak population through the P4 response');
  assert.ok(diagnostic.chronicStressDays < 0.5, 'healthy supported populations should not accumulate chronic stress');
  assert.equal(predator.population, 1);
}

function main(): void {
  testChronicStressReducesLocalDensity();
  testPressureExpandsHomeRangeBeforeEmigration();
  testHealthySupportedPopulationDoesNotDisperse();
  console.log('Predator pressure response smoke tests passed.');
}

main();
