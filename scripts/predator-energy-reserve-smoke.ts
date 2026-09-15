import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { WildPredatorPopulation } from '../src/types/ecologySimulation';
import '../src/types/ecologySimulation';
import { WILD_PREDATOR_SPECIES } from '../src/data/ecologyPredators';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldEcologyState, discoverEcologySubarea, ensureRegionEcology } from '../src/simulation/ecologySystem';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import {
  applyPredatorEnergyAccounting,
  ensurePredatorEnergyState,
  getPredatorEnergyReserveDays,
  tickWildPredators,
} from '../src/simulation/ecologyPredatorSystem';

function makePopulation(speciesId: string, hungerStress = 30): WildPredatorPopulation {
  const species = WILD_PREDATOR_SPECIES[speciesId];
  assert.ok(species, `missing predator species ${speciesId}`);
  return {
    id: `energy_${speciesId}`,
    speciesId,
    poiId: 'AREA_FOREST_EDGE',
    currentSubareaId: 'energy_subarea',
    homeRangeSubareaIds: ['energy_subarea'],
    population: 1,
    juveniles: 0,
    adults: 1,
    old: 0,
    maleRatio: 0.5,
    biomassKg: species.adultWeightKg,
    averageHealth: 85,
    bodyCondition: 78,
    hungerStress,
    waterStress: 5,
    reproductionPressure: 20,
    migrationPressure: 10,
    humanFear: 0,
    geneticDiversity: 70,
    reproductionProgress: 0,
    maturationProgress: 0,
    agingProgress: 0,
    mortalityProgress: 0,
    movementProgress: 0,
    predationProgressByPreySpecies: {},
    lastMoveGameMinute: 0,
    lastUpdatedGameMinute: 0,
  };
}

function testReserveHorizonMatchesFeedingCadence(): void {
  const monitor = getPredatorEnergyReserveDays(WILD_PREDATOR_SPECIES.PREDATOR_MONITOR_LIZARD);
  const python = getPredatorEnergyReserveDays(WILD_PREDATOR_SPECIES.PREDATOR_PYTHON);
  const crocodile = getPredatorEnergyReserveDays(WILD_PREDATOR_SPECIES.PREDATOR_ESTUARINE_CROCODILE);
  assert.ok(monitor >= 3.5 && monitor < 6, 'frequent monitor hunters should keep a bounded multi-day reserve');
  assert.ok(python > monitor, 'python should bridge more kill-free days than monitor lizards');
  assert.ok(crocodile > python && crocodile <= 24, 'crocodiles should have the longest bounded reserve horizon');
}

function testLegacySaveMigrationIsFiniteAndConservative(): void {
  const species = WILD_PREDATOR_SPECIES.PREDATOR_PYTHON;
  const legacy = makePopulation(species.id, 82);
  ensurePredatorEnergyState(legacy, species);
  assert.ok((legacy.maxEnergyReserveKg || 0) > 0, 'legacy population must gain a valid reserve capacity');
  assert.ok((legacy.energyReserveKg || 0) > 0, 'legacy population should not migrate as instantly empty');
  assert.ok((legacy.energyReserveKg || 0) < (legacy.maxEnergyReserveKg || 0), 'high legacy hunger should migrate to a conservative partial reserve');
  assert.equal(legacy.lastEnergyIntakeKg, 0);
  assert.equal(legacy.lastEnergyDemandKg, 0);
}

function testLargeMealBanksSurplusAcrossDays(): void {
  const species = WILD_PREDATOR_SPECIES.PREDATOR_PYTHON;
  const population = makePopulation(species.id, 50);
  ensurePredatorEnergyState(population, species, 0);
  const dailyDemand = species.dailyFoodKgPerAdult;
  const firstCoverage = applyPredatorEnergyAccounting(population, species, 1, dailyDemand * 9);
  assert.equal(firstCoverage, 1, 'large kill must fully cover the current day');
  assert.ok((population.energyReserveKg || 0) >= dailyDemand * 4, 'surplus kill mass must remain available for later days');

  let fullyCoveredDays = 0;
  for (let day = 0; day < 12; day++) {
    const coverage = applyPredatorEnergyAccounting(population, species, 1, 0);
    if (coverage >= 0.999) fullyCoveredDays++;
    else break;
  }
  assert.ok(fullyCoveredDays >= 4, 'python reserve should bridge several no-kill days after a large meal');
  assert.ok(fullyCoveredDays < 12, 'reserve must remain finite rather than becoming permanent food');
}

function freshIntegrationState(): { state: GameState; predator: WildPredatorPopulation } {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = 'predator-energy-integration';
  building.gridsByPoiId = {};
  building.clusters = [];
  building.preparationJobs = [];
  state.ecologySystem = createWorldEcologyState();
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
  const subareaId = region.subareaIds[0];
  assert.ok(subareaId);

  // Keep this fixture intentionally prey-free. P2 should prove that previously
  // banked food, not a new hunt, controls short-term hunger.
  state.ecologySystem.animalPopulations = [];
  state.ecologySystem.significantAnimals = [];
  region.faunaSeeded = true;
  region.predatorsSeeded = true;

  const species = WILD_PREDATOR_SPECIES.PREDATOR_PYTHON;
  const predator = makePopulation(species.id, 50);
  predator.currentSubareaId = subareaId;
  predator.homeRangeSubareaIds = [subareaId];
  predator.lastUpdatedGameMinute = 0;
  predator.lastMoveGameMinute = 0;
  ensurePredatorEnergyState(predator, species, 1);
  state.ecologySystem.predatorPopulations = [predator];
  state.ecologySystem.significantPredators = [];
  return { state, predator };
}

function advanceMinutes(state: GameState, minutes: number): void {
  const total = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay + minutes;
  state.gameTime.day = Math.floor(total / 1440) + 1;
  state.gameTime.minuteOfDay = total % 1440;
}

function testReserveBuffersRealPredatorTick(): void {
  const buffered = freshIntegrationState();
  const bufferedBefore = buffered.predator.hungerStress;
  advanceMinutes(buffered.state, 1440);
  tickWildPredators(buffered.state, 1440);
  assert.ok(buffered.predator.hungerStress < bufferedBefore, 'one prey-free day with stored energy should reduce hunger stress');
  assert.ok((buffered.predator.energyReserveKg || 0) < (buffered.predator.maxEnergyReserveKg || 0), 'metabolism must consume reserve mass');
  assert.equal(buffered.predator.lastEnergyIntakeKg, 0, 'fixture must remain prey-free');

  const empty = freshIntegrationState();
  empty.predator.energyReserveKg = 0;
  empty.predator.hungerStress = 10;
  const emptyBefore = empty.predator.hungerStress;
  advanceMinutes(empty.state, 1440);
  tickWildPredators(empty.state, 1440);
  assert.ok(empty.predator.hungerStress > emptyBefore + 15, 'an empty reserve must still create clear hunger pressure after one prey-free day');
  assert.ok(empty.predator.hungerStress < 70, 'one prey-free day should not force a healthy predator directly into near-critical hunger');
}

function main(): void {
  testReserveHorizonMatchesFeedingCadence();
  testLegacySaveMigrationIsFiniteAndConservative();
  testLargeMealBanksSurplusAcrossDays();
  testReserveBuffersRealPredatorTick();
  console.log('Predator energy reserve smoke tests passed.');
  console.log(JSON.stringify({
    reserveDays: {
      monitor: getPredatorEnergyReserveDays(WILD_PREDATOR_SPECIES.PREDATOR_MONITOR_LIZARD),
      python: getPredatorEnergyReserveDays(WILD_PREDATOR_SPECIES.PREDATOR_PYTHON),
      crocodile: getPredatorEnergyReserveDays(WILD_PREDATOR_SPECIES.PREDATOR_ESTUARINE_CROCODILE),
    },
  }, null, 2));
}

main();
