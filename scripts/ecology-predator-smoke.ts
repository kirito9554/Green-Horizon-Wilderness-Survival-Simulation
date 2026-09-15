import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { WildPredatorPopulation } from '../src/types/ecologySimulation';
import '../src/types/ecologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { createWorldEcologyState, discoverEcologySubarea, ensureRegionEcology } from '../src/simulation/ecologySystem';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import { ensureRegionWildFauna, ensureWildFauna } from '../src/simulation/ecologyFaunaSystem';
import {
  ensureRegionWildPredators,
  ensureWildPredators,
  getPredatorGenerationFingerprint,
  predatorCompetitionMultiplier,
  preyRefugiaMultiplier,
  promoteWildPredatorIndividual,
  tickWildPredators,
  typeIIIPredationResponse,
} from '../src/simulation/ecologyPredatorSystem';
import { WILD_PREDATOR_SPECIES } from '../src/data/ecologyPredators';

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
  ensureRegionWildFauna(state, poiId);
}

function advanceMinutes(state: GameState, minutes: number): void {
  const total = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay + minutes;
  state.gameTime.day = Math.floor(total / 1440) + 1;
  state.gameTime.minuteOfDay = total % 1440;
}

function testFunctionalResponseAndCompetitionBalancePatch(): void {
  const low = typeIIIPredationResponse(2, 10);
  const medium = typeIIIPredationResponse(10, 10);
  const high = typeIIIPredationResponse(40, 10);
  assert.ok(low < 0.06, 'Type III response must nearly switch predation off when prey is rare');
  assert.ok(medium > low * 5, 'predation should accelerate only after prey leaves the rarity refuge');
  assert.ok(high > medium, 'abundant prey should support more hunting than medium prey');

  const normalCompetition = predatorCompetitionMultiplier(10, 100, 0.1);
  const overloadedCompetition = predatorCompetitionMultiplier(45, 100, 0.1);
  assert.equal(normalCompetition, 1, 'predator/prey biomass near the ideal ratio should not be penalized');
  assert.ok(overloadedCompetition < 0.45, 'predator surplus must sharply reduce per-predator hunting efficiency');

  const hiddenRare = preyRefugiaMultiplier(2, 5, 90);
  const abundant = preyRefugiaMultiplier(12, 5, 90);
  assert.ok(hiddenRare < abundant, 'rare prey in dense cover must gain a refugia advantage');
}

function findSeedWithNaturalPredators(): { seed: string; fingerprint: string } {
  for (let index = 0; index < 30; index++) {
    const seed = `predator-procedural-${index}`;
    const state = fresh(seed);
    materializeRegion(state);
    const fingerprint = getPredatorGenerationFingerprint(state, 'AREA_FOREST_EDGE');
    if (fingerprint.length > 0) return { seed, fingerprint };
  }
  throw new Error('expected at least one viable Deep Rainforest seed to support a predator guild');
}

function testPredatorSeedingIsDeterministicButOptional(): void {
  const found = findSeedWithNaturalPredators();
  const a = fresh(found.seed);
  const b = fresh(found.seed);
  materializeRegion(a);
  materializeRegion(b);
  assert.equal(getPredatorGenerationFingerprint(a, 'AREA_FOREST_EDGE'), found.fingerprint);
  assert.equal(getPredatorGenerationFingerprint(b, 'AREA_FOREST_EDGE'), found.fingerprint, 'same seed must recreate the same predator guild');
}

function makePredatorFixture(seed = 'predator-integration-seed') {
  const state = fresh(seed);
  materializeRegion(state);
  const system = ensureWildPredators(state);
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  const prey = system.animalPopulations!.find(candidate =>
    Object.values(WILD_PREDATOR_SPECIES).some(predator => (predator.preyWeights[candidate.speciesId] || 0) > 0),
  );
  assert.ok(prey, 'Deep Rainforest fauna should expose at least one predator-compatible prey population');

  const species = Object.values(WILD_PREDATOR_SPECIES)
    .filter(candidate => (candidate.regionAffinity.AREA_FOREST_EDGE || 0) > 0)
    .find(candidate => (candidate.preyWeights[prey!.speciesId] || 0) > 0 && candidate.maxAdultPreyKg >= 0.4);
  assert.ok(species, `no predator profile can consume ${prey!.speciesId}`);

  const subareaId = prey!.currentSubareaId;
  const neighbor = system.connections.find(link =>
    link.poiId === 'AREA_FOREST_EDGE'
    && (link.fromSubareaId === subareaId || link.toSubareaId === subareaId),
  );
  const neighborId = neighbor
    ? (neighbor.fromSubareaId === subareaId ? neighbor.toSubareaId : neighbor.fromSubareaId)
    : subareaId;
  const now = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay;
  const predator: WildPredatorPopulation = {
    id: 'predator_fixture',
    speciesId: species!.id,
    poiId: 'AREA_FOREST_EDGE',
    currentSubareaId: subareaId,
    homeRangeSubareaIds: Array.from(new Set([subareaId, neighborId])),
    population: 4,
    juveniles: 0,
    adults: 4,
    old: 0,
    maleRatio: 0.5,
    biomassKg: species!.adultWeightKg * 4,
    averageHealth: 88,
    bodyCondition: 82,
    hungerStress: 8,
    waterStress: 5,
    reproductionPressure: 35,
    migrationPressure: 10,
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
  system.predatorPopulations = [predator];
  system.significantPredators = [];
  region.predatorsSeeded = true;
  return { state, system, region, prey: prey!, predator, species: species!, neighborId };
}

function testPredationKillsRealPreyAndCreatesCarrion(): void {
  const fixture = makePredatorFixture('predator-kill-seed');
  const { state, prey, predator } = fixture;
  // Make prey abundant so Type III response is high and adults are available.
  prey.juveniles = 8;
  prey.adults = 30;
  prey.old = 4;
  prey.population = 42;
  prey.biomassKg = 120;
  const subarea = state.ecologySystem!.subareasById[predator.currentSubareaId];
  const before = prey.population;
  const carrionBefore = subarea.foodWeb?.carrionBiomassKg || 0;

  advanceMinutes(state, 1440 * 14);
  tickWildPredators(state, 1440 * 14);

  assert.ok(prey.population < before, 'background predation must remove real individuals from the prey population');
  assert.equal(prey.population, prey.juveniles + prey.adults + prey.old, 'predation must preserve prey age-structure accounting');
  assert.ok((subarea.foodWeb?.carrionBiomassKg || 0) > carrionBefore, 'unused parts of natural kills should enter the carrion/decomposer food web');
}

function testMinimumViablePreyGetsBackgroundRefuge(): void {
  const fixture = makePredatorFixture('predator-refuge-seed');
  const { state, prey, predator, species } = fixture;
  prey.juveniles = Math.min(2, species.minimumViablePreyCount);
  prey.adults = Math.max(0, species.minimumViablePreyCount - prey.juveniles);
  prey.old = 0;
  prey.population = prey.juveniles + prey.adults;
  prey.biomassKg = Math.max(1, prey.population * 1.5);
  predator.population = 18;
  predator.juveniles = 0;
  predator.adults = 18;
  predator.old = 0;
  predator.biomassKg = species.adultWeightKg * 18;

  advanceMinutes(state, 1440 * 120);
  tickWildPredators(state, 1440 * 120);
  assert.ok(prey.population >= 1, 'natural predator simulation must not mechanically erase the final local prey refugium');
  assert.ok(predator.hungerStress > 8 || predator.migrationPressure > 10, 'predator surplus should turn into hunger/migration pressure instead of infinite kills');
}

function testDietSwitchingUsesAlternativePrey(): void {
  const fixture = makePredatorFixture('predator-switch-seed');
  const { state, system, predator, species, prey } = fixture;
  const samePatch = system.animalPopulations!.filter(candidate =>
    candidate.currentSubareaId === predator.currentSubareaId && (species.preyWeights[candidate.speciesId] || 0) > 0,
  );
  let alternative = samePatch.find(candidate => candidate.id !== prey.id);
  if (!alternative) {
    const source = system.animalPopulations!.find(candidate => candidate.id !== prey.id && (species.preyWeights[candidate.speciesId] || 0) > 0);
    if (source) {
      source.currentSubareaId = predator.currentSubareaId;
      source.homeRangeSubareaIds = Array.from(new Set([...source.homeRangeSubareaIds, predator.currentSubareaId]));
      alternative = source;
    }
  }
  if (!alternative) return; // Some procedural seeds legitimately expose only one compatible prey species.

  prey.juveniles = 1;
  prey.adults = 0;
  prey.old = 0;
  prey.population = 1;
  prey.biomassKg = 0.5;
  alternative.juveniles = 4;
  alternative.adults = 24;
  alternative.old = 2;
  alternative.population = 30;
  alternative.biomassKg = 80;
  const alternativeBefore = alternative.population;

  advanceMinutes(state, 1440 * 20);
  tickWildPredators(state, 1440 * 20);
  assert.equal(prey.population, 1, 'scarce primary prey should remain protected by Type III/refugia behavior');
  assert.ok(alternative.population < alternativeBefore, 'predator should switch hunting pressure onto an abundant compatible prey species');
}

function testStarvingPredatorMovesTowardPrey(): void {
  const fixture = makePredatorFixture('predator-move-seed');
  const { state, system, predator, species, neighborId } = fixture;
  if (neighborId === predator.currentSubareaId) return;
  const current = system.subareasById[predator.currentSubareaId];
  const neighbor = system.subareasById[neighborId];
  assert.ok(current && neighbor);

  for (const prey of system.animalPopulations!.filter(candidate => (species.preyWeights[candidate.speciesId] || 0) > 0)) {
    if (prey.currentSubareaId === current.id) {
      prey.currentSubareaId = neighbor.id;
      prey.homeRangeSubareaIds = Array.from(new Set([...prey.homeRangeSubareaIds, neighbor.id]));
    }
  }
  current.disturbance.humanPressure = 100;
  neighbor.disturbance.humanPressure = 0;
  predator.hungerStress = 100;
  predator.migrationPressure = 100;
  predator.humanFear = 100;
  predator.movementProgress = 1.2;
  const oldPatch = predator.currentSubareaId;

  advanceMinutes(state, 180);
  tickWildPredators(state, 180);
  assert.notEqual(predator.currentSubareaId, oldPatch, 'hungry overcrowded predators should move through the subarea graph instead of hunting an empty patch forever');
}

function testPredatorPromotionConservesHeadcount(): void {
  const fixture = makePredatorFixture('predator-promote-seed');
  const { state, system, predator } = fixture;
  const beforeAggregate = system.predatorPopulations!.reduce((sum, entry) => sum + entry.population, 0);
  const beforeIndividuals = system.significantPredators!.length;
  const individual = promoteWildPredatorIndividual(state, predator.id, 'adult');
  assert.ok(individual);
  const afterAggregate = system.predatorPopulations!.reduce((sum, entry) => sum + entry.population, 0);
  assert.equal(afterAggregate, beforeAggregate - 1);
  assert.equal(system.significantPredators!.length, beforeIndividuals + 1);
  assert.equal(afterAggregate + system.significantPredators!.length, beforeAggregate + beforeIndividuals, 'promoting an encounter predator must never duplicate wildlife');
}

function main(): void {
  testFunctionalResponseAndCompetitionBalancePatch();
  testPredatorSeedingIsDeterministicButOptional();
  testPredationKillsRealPreyAndCreatesCarrion();
  testMinimumViablePreyGetsBackgroundRefuge();
  testDietSwitchingUsesAlternativePrey();
  testStarvingPredatorMovesTowardPrey();
  testPredatorPromotionConservesHeadcount();
  console.log('World ecology predator balance smoke tests passed.');
}

main();
