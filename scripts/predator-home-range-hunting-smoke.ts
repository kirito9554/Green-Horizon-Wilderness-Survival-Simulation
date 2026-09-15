import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { WildPredatorPopulation } from '../src/types/ecologySimulation';
import '../src/types/ecologySimulation';
import { WILD_FAUNA_SPECIES } from '../src/data/ecologyFauna';
import { WILD_PREDATOR_SPECIES } from '../src/data/ecologyPredators';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import { createWorldEcologyState, discoverEcologySubarea, ensureRegionEcology } from '../src/simulation/ecologySystem';
import { ensureRegionWildFauna } from '../src/simulation/ecologyFaunaSystem';
import {
  ensurePredatorEnergyState,
  ensureWildPredators,
  getPredatorHuntingAccessibility,
  tickWildPredators,
} from '../src/simulation/ecologyPredatorSystem';

function advanceMinutes(state: GameState, minutes: number): void {
  const total = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay + minutes;
  state.gameTime.day = Math.floor(total / 1440) + 1;
  state.gameTime.minuteOfDay = total % 1440;
}

function makeFixture() {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = 'predator-home-range-hunting';
  building.gridsByPoiId = {};
  building.clusters = [];
  building.preparationJobs = [];
  state.ecologySystem = createWorldEcologyState();

  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
  ensureRegionWildFauna(state, region.poiId);
  const system = ensureWildPredators(state);
  const connection = system.connections.find(link => link.poiId === region.poiId);
  assert.ok(connection, 'forest fixture needs at least one ecology connection');
  const currentId = connection.fromSubareaId;
  const remoteId = connection.toSubareaId;
  const current = system.subareasById[currentId];
  const remote = system.subareasById[remoteId];
  assert.ok(current && remote);
  current.foodWeb ||= { insectBiomassKg: 0, carrionBiomassKg: 0, aquaticPlantBiomassKg: 0 };
  remote.foodWeb ||= { insectBiomassKg: 0, carrionBiomassKg: 0, aquaticPlantBiomassKg: 0 };

  const species = WILD_PREDATOR_SPECIES.PREDATOR_MONITOR_LIZARD;
  const target = (system.animalPopulations || []).find(prey => {
    const preySpecies = WILD_FAUNA_SPECIES[prey.speciesId];
    return Boolean(
      preySpecies
      && (species.preyWeights[prey.speciesId] || 0) > 0
      && preySpecies.adultWeightKg <= species.maxAdultPreyKg,
    );
  });
  assert.ok(target, 'forest fixture needs monitor-compatible prey');

  // Put all compatible prey away from the predator's resting patch so a kill can
  // only happen through the P3 home-range hunting path.
  for (const prey of system.animalPopulations || []) {
    if ((species.preyWeights[prey.speciesId] || 0) > 0) prey.currentSubareaId = remoteId;
  }
  const preySpecies = WILD_FAUNA_SPECIES[target.speciesId];
  target.currentSubareaId = remoteId;
  target.homeRangeSubareaIds = Array.from(new Set([...target.homeRangeSubareaIds, remoteId]));
  target.juveniles = 12;
  target.adults = 28;
  target.old = 0;
  target.population = 40;
  target.biomassKg = preySpecies.adultWeightKg * (target.adults + target.juveniles * 0.45);
  target.bodyCondition = 90;

  const now = (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay;
  const predator: WildPredatorPopulation = {
    id: 'predator_home_range_fixture',
    speciesId: species.id,
    poiId: region.poiId,
    currentSubareaId: currentId,
    homeRangeSubareaIds: [currentId, remoteId],
    population: 1,
    juveniles: 0,
    adults: 1,
    old: 0,
    maleRatio: 0.5,
    biomassKg: species.adultWeightKg,
    averageHealth: 88,
    bodyCondition: 82,
    hungerStress: 20,
    waterStress: 5,
    reproductionPressure: 35,
    migrationPressure: 0,
    humanFear: 0,
    geneticDiversity: 72,
    reproductionProgress: 0,
    maturationProgress: 0,
    agingProgress: 0,
    mortalityProgress: 0,
    movementProgress: 0,
    predationProgressByPreySpecies: { [target.speciesId]: 0.99 },
    lastMoveGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  ensurePredatorEnergyState(predator, species, 0);
  predator.energyReserveKg = 0;
  system.predatorPopulations = [predator];
  system.significantPredators = [];
  region.predatorsSeeded = true;

  return { state, system, region, connection, current, remote, predator, species, target };
}

function testAccessibilityUsesHomeRangeGraphCost(): void {
  const fixture = makeFixture();
  const { system, predator, species, connection, remoteId } = {
    ...fixture,
    remoteId: fixture.remote.id,
  };
  const local = getPredatorHuntingAccessibility(system, predator, species, predator.currentSubareaId);
  const remote = getPredatorHuntingAccessibility(system, predator, species, remoteId);
  assert.equal(local, 1, 'current patch should have full hunting accessibility');
  assert.ok(remote > 0 && remote < 1, 'connected home-range prey should be reachable with a travel discount');

  const originalCost = connection.movementCost;
  connection.movementCost = originalCost * 8;
  const expensive = getPredatorHuntingAccessibility(system, predator, species, remoteId);
  connection.movementCost = originalCost;
  assert.ok(expensive < remote, 'harder travel must reduce remote hunting accessibility');

  const outside = fixture.region.subareaIds.find(id => !predator.homeRangeSubareaIds.includes(id));
  if (outside) {
    assert.equal(
      getPredatorHuntingAccessibility(system, predator, species, outside),
      0,
      'patches outside the established home range must not be hunted',
    );
  }
}

function testRemotePreyCanBeHuntedWithoutTeleportingPredator(): void {
  const fixture = makeFixture();
  const { state, predator, target, current, remote } = fixture;
  const predatorPatchBefore = predator.currentSubareaId;
  const preyBefore = target.population;
  const currentCarrionBefore = current.foodWeb?.carrionBiomassKg || 0;
  const remoteCarrionBefore = remote.foodWeb?.carrionBiomassKg || 0;

  advanceMinutes(state, 1440);
  tickWildPredators(state, 1440);

  assert.ok(target.population < preyBefore, 'predator must be able to kill compatible prey in another home-range patch');
  assert.equal(predator.currentSubareaId, predatorPatchBefore, 'short hunting excursion must not teleport the predator resting location');
  assert.ok((remote.foodWeb?.carrionBiomassKg || 0) > remoteCarrionBefore, 'kill remains must enter the prey patch food web');
  assert.equal(current.foodWeb?.carrionBiomassKg || 0, currentCarrionBefore, 'remote kill carrion must not appear at the predator resting patch');
  assert.ok((predator.lastEnergyIntakeKg || 0) > 0, 'remote kill must feed the P2 energy accounting path');
}

function main(): void {
  testAccessibilityUsesHomeRangeGraphCost();
  testRemotePreyCanBeHuntedWithoutTeleportingPredator();
  console.log('Predator home-range hunting smoke tests passed.');
}

main();
