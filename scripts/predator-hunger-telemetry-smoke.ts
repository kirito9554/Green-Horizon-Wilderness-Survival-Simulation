import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { WildPredatorPopulation } from '../src/types/ecologySimulation';
import '../src/types/ecologySimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import { createWorldEcologyState, discoverEcologySubarea, ensureRegionEcology } from '../src/simulation/ecologySystem';
import { ensureRegionWildFauna, ensureWildFauna } from '../src/simulation/ecologyFaunaSystem';
import { WILD_PREDATOR_SPECIES } from '../src/data/ecologyPredators';
import {
  collectPredatorHungerTelemetry,
  summarizePredatorHungerTelemetry,
  type PredatorHungerTelemetry,
} from '../src/simulation/predatorHungerTelemetry';

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

function makeFixture() {
  const state = fresh('predator-hunger-telemetry-seed');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
  ensureRegionWildFauna(state, 'AREA_FOREST_EDGE');
  const system = ensureWildFauna(state);

  const prey = system.animalPopulations!.find(candidate =>
    Object.values(WILD_PREDATOR_SPECIES).some(predator => (predator.preyWeights[candidate.speciesId] || 0) > 0),
  );
  assert.ok(prey, 'fixture needs at least one predator-compatible prey population');
  const species = Object.values(WILD_PREDATOR_SPECIES)
    .filter(candidate => (candidate.regionAffinity.AREA_FOREST_EDGE || 0) > 0)
    .find(candidate => (candidate.preyWeights[prey!.speciesId] || 0) > 0);
  assert.ok(species, 'fixture needs a predator profile compatible with seeded prey');

  const currentSubareaId = prey!.currentSubareaId;
  const connection = system.connections.find(link =>
    link.poiId === 'AREA_FOREST_EDGE'
    && (link.fromSubareaId === currentSubareaId || link.toSubareaId === currentSubareaId),
  );
  const neighborId = connection
    ? (connection.fromSubareaId === currentSubareaId ? connection.toSubareaId : connection.fromSubareaId)
    : currentSubareaId;
  const current = system.subareasById[currentSubareaId];
  assert.ok(current);
  current.environment.waterAccess = 100;

  const now = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay;
  const predator: WildPredatorPopulation = {
    id: 'predator_telemetry_fixture',
    speciesId: species!.id,
    poiId: 'AREA_FOREST_EDGE',
    currentSubareaId,
    homeRangeSubareaIds: Array.from(new Set([currentSubareaId, neighborId])),
    population: 4,
    juveniles: 0,
    adults: 4,
    old: 0,
    maleRatio: 0.5,
    biomassKg: species!.adultWeightKg * 4,
    averageHealth: 86,
    bodyCondition: 78,
    hungerStress: 80,
    waterStress: 4,
    reproductionPressure: 25,
    migrationPressure: 42,
    humanFear: 0,
    geneticDiversity: 70,
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
  region.predatorsSeeded = true;
  return { state, system, predator, species: species!, currentSubareaId, neighborId };
}

function assertFiniteRatio(value: number, label: string): void {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
  assert.ok(value >= 0 && value <= 1, `${label} must remain in [0, 1]`);
}

function testTelemetryIsReadOnlyAndDeterministic(): void {
  const fixture = makeFixture();
  const before = JSON.stringify(fixture.state.ecologySystem);
  const first = collectPredatorHungerTelemetry(fixture.state);
  const second = collectPredatorHungerTelemetry(fixture.state);
  assert.deepEqual(first, second, 'same ecology state must produce deterministic telemetry');
  assert.equal(JSON.stringify(fixture.state.ecologySystem), before, 'P1 telemetry must not mutate ecology state');
  assert.equal(first.length, 1);
  const row = first[0];
  assert.equal(row.populationId, fixture.predator.id);
  assert.equal(row.speciesId, fixture.species.id);
  assert.ok(row.homeRangePreferredPreyBiomassKg >= row.currentPreferredPreyBiomassKg);
  assertFiniteRatio(row.currentPatchPreyShare, 'currentPatchPreyShare');
  assertFiniteRatio(row.competitionMultiplier, 'competitionMultiplier');
  assertFiniteRatio(row.averageFunctionalResponse, 'averageFunctionalResponse');
  assertFiniteRatio(row.averageRefugiaMultiplier, 'averageRefugiaMultiplier');
  assertFiniteRatio(row.waterRatio, 'waterRatio');
  assertFiniteRatio(row.habitatSuitability, 'habitatSuitability');
  assertFiniteRatio(row.huntingOpportunityRatio, 'huntingOpportunityRatio');
}

function testPreyLocalizationIsVisible(): void {
  const fixture = makeFixture();
  if (fixture.neighborId === fixture.currentSubareaId) return;
  for (const prey of fixture.system.animalPopulations!.filter(entry => (fixture.species.preyWeights[entry.speciesId] || 0) > 0)) {
    if (prey.currentSubareaId !== fixture.currentSubareaId) continue;
    prey.currentSubareaId = fixture.neighborId;
  }
  const row = collectPredatorHungerTelemetry(fixture.state)[0];
  assert.equal(row.currentPreferredPreyBiomassKg, 0, 'current patch should report no compatible prey after relocation');
  assert.ok(row.homeRangePreferredPreyBiomassKg > 0, 'home range should still contain compatible prey');
  assert.equal(row.bottleneck, 'prey_localization', 'telemetry should distinguish prey elsewhere in the home range from true prey scarcity');
}

function testCompetitionDensityAndRefugiaSignals(): void {
  const fixture = makeFixture();
  const compatible = fixture.system.animalPopulations!.filter(entry =>
    entry.currentSubareaId === fixture.currentSubareaId && (fixture.species.preyWeights[entry.speciesId] || 0) > 0,
  );
  assert.ok(compatible.length > 0);
  for (const prey of compatible) {
    prey.juveniles = 1;
    prey.adults = 1;
    prey.old = 0;
    prey.population = 2;
    prey.biomassKg = 2;
  }
  fixture.predator.population = 20;
  fixture.predator.juveniles = 0;
  fixture.predator.adults = 20;
  fixture.predator.old = 0;
  fixture.predator.biomassKg = fixture.species.adultWeightKg * 20;
  fixture.predator.hungerStress = 95;

  const row = collectPredatorHungerTelemetry(fixture.state)[0];
  assert.ok(row.competitionMultiplier < 1, 'predator surplus should be visible as a competition penalty');
  assert.ok(row.averageFunctionalResponse < 1, 'rare prey should reduce Type III hunting response');
  assert.ok(row.averageRefugiaMultiplier < 1, 'rare prey should expose a refugia penalty');
  assert.ok(row.huntingOpportunityRatio < 0.5, 'combined hunting opportunity should visibly collapse under scarce/refuged prey and predator surplus');
}

function fakeRow(base: PredatorHungerTelemetry, overrides: Partial<PredatorHungerTelemetry>): PredatorHungerTelemetry {
  return { ...base, ...overrides };
}

function testWeightedSummaryAvoidsTinyPopulationBias(): void {
  const fixture = makeFixture();
  const base = collectPredatorHungerTelemetry(fixture.state)[0];
  const rows = [
    fakeRow(base, { populationId: 'large', population: 100, biomassKg: 100, hungerStress: 10, speciesId: 'LARGE_GUILD' }),
    fakeRow(base, { populationId: 'tiny', population: 1, biomassKg: 1, hungerStress: 100, speciesId: 'TINY_GUILD' }),
  ];
  const summary = summarizePredatorHungerTelemetry(rows);
  assert.equal(summary.unweightedHunger, 55, 'plain population-record average should expose its known bias');
  assert.ok(summary.populationWeightedHunger < 12, 'population-weighted hunger should not let one tiny population dominate the guild metric');
  assert.ok(summary.biomassWeightedHunger < 12, 'biomass-weighted hunger should not let one tiny population dominate the guild metric');
  assert.equal(summary.highStressIndividuals, 1);
  assert.equal(summary.bySpecies.length, 2);
}

function main(): void {
  testTelemetryIsReadOnlyAndDeterministic();
  testPreyLocalizationIsVisible();
  testCompetitionDensityAndRefugiaSignals();
  testWeightedSummaryAvoidsTinyPopulationBias();

  const fixture = makeFixture();
  const rows = collectPredatorHungerTelemetry(fixture.state);
  const summary = summarizePredatorHungerTelemetry(rows);
  console.log('Predator hunger telemetry smoke tests passed.');
  console.log(JSON.stringify({ rows, summary }, null, 2));
}

main();
