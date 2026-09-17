import assert from 'node:assert/strict';
import { SPATIAL_FAUNA_SPECIES_BY_ID } from '../src/data/spatialFauna';
import {
  createSpatialFaunaRuntimeState,
  getSpatialFaunaCohortPopulation,
  getSpatialFaunaRuntimePopulation,
  getSpatialFaunaSeason,
  tickSpatialFaunaDay,
} from '../src/simulation/spatial/spatialFaunaRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

interface RuntimeValidationOptions {
  minPopulationFraction?: number;
  maxSpeciesLoss?: number;
}

function assertRuntimeInvariants(seed: string, days: number, options: RuntimeValidationOptions = {}): {
  population: number;
  births: number;
  deaths: number;
  moved: number;
  crossRegionMoved: number;
  presentSpecies: number;
  signature: string;
} {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaRuntimeState(seed, 1, world);
  const initialPopulation = getSpatialFaunaRuntimePopulation(runtime);
  const initialSpeciesCount = runtime.species.length;
  assert.equal(initialPopulation, world.faunaCommunity.totalInitialIndividuals, `${seed}: runtime must materialize the census exactly`);
  assert.equal(runtime.communitySignature, world.faunaCommunity.signature);
  assert.equal(runtime.lastProcessedDay, 1);
  assert.equal(runtime.season, 'dry');
  assert.ok(runtime.species.length >= 18, `${seed}: broad fauna community should materialize into runtime state`);

  const patchIds = new Set(world.habitatPatches.map(patch => patch.id));
  let initialCohorts = 0;
  for (const speciesState of runtime.species) {
    assert.ok(SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId], `${seed}: unknown runtime species ${speciesState.speciesId}`);
    for (const cohort of speciesState.cohorts) {
      initialCohorts += 1;
      assert.ok(patchIds.has(cohort.patchId), `${seed}: cohort references missing patch ${cohort.patchId}`);
      const population = getSpatialFaunaCohortPopulation(cohort);
      assert.ok(Number.isInteger(population) && population > 0, `${seed}: initial cohort headcount must be a positive integer`);
      assert.equal(cohort.stages.juveniles + cohort.stages.adults + cohort.stages.old, population);
      assert.ok(cohort.condition >= 0 && cohort.condition <= 1);
    }
  }
  assert.ok(initialCohorts > 200, `${seed}: census should be spatially distributed across many occupied patch cohorts`);

  let births = 0;
  let deaths = 0;
  let moved = 0;
  let crossRegionMoved = 0;
  for (let day = 2; day <= days; day += 1) {
    const telemetry = tickSpatialFaunaDay(runtime, world, day);
    births += telemetry.births;
    deaths += telemetry.deaths;
    moved += telemetry.moved;
    crossRegionMoved += telemetry.crossRegionMoved;
    assert.equal(telemetry.day, day);
    assert.equal(telemetry.season, getSpatialFaunaSeason(day));
    assert.ok(telemetry.totalPopulation > 0, `${seed}: tracked fauna cannot disappear wholesale`);
    assert.ok(telemetry.meanCondition >= 0 && telemetry.meanCondition <= 1);
    assert.ok(telemetry.meanFoodSufficiency >= 0 && telemetry.meanFoodSufficiency <= 1);
    assert.ok(telemetry.meanWaterSufficiency >= 0 && telemetry.meanWaterSufficiency <= 1);
    assert.ok(telemetry.foodDemandKg > 0 && telemetry.waterDemandUnits > 0, `${seed}: living fauna must publish resource demand`);
  }

  const population = getSpatialFaunaRuntimePopulation(runtime);
  assert.ok(births > 0, `${seed}: living cohorts should reproduce over ${days} days`);
  assert.ok(deaths > 0, `${seed}: living cohorts should experience natural mortality over ${days} days`);
  assert.ok(moved > 0, `${seed}: adjacency dispersal should move animals over ${days} days`);
  assert.ok(
    population >= initialPopulation * (options.minPopulationFraction ?? .55),
    `${seed}: first-pass demography should not collapse the entire fauna community (${initialPopulation} -> ${population})`,
  );
  assert.ok(population <= world.faunaCommunity.totalCarryingCapacity * 1.12, `${seed}: first-pass demography should remain bounded near metric carrying capacity`);
  assert.ok(runtime.history.length <= 30, `${seed}: diagnostic history must remain bounded`);
  assert.ok(
    runtime.telemetry.presentSpeciesCount >= initialSpeciesCount - (options.maxSpeciesLoss ?? 2),
    `${seed}: too many tracked species disappeared without a predator runtime (${initialSpeciesCount} -> ${runtime.telemetry.presentSpeciesCount})`,
  );

  const finalSpecies: Array<{ id: string; population: number; k: number }> = [];
  for (const speciesState of runtime.species) {
    const plan = world.faunaCommunity.species.find(candidate => candidate.speciesId === speciesState.speciesId);
    assert.ok(plan?.present, `${seed}: runtime species must belong to the generated census`);
    const allocationByPatch = new Map(plan!.patchAllocations.map(allocation => [allocation.patchId, allocation] as const));
    let speciesPopulation = 0;
    for (const cohort of speciesState.cohorts) {
      const populationHere = getSpatialFaunaCohortPopulation(cohort);
      speciesPopulation += populationHere;
      const allocation = allocationByPatch.get(cohort.patchId);
      assert.ok(populationHere > 0 && Number.isInteger(populationHere), `${seed}: sparse runtime must not retain empty/fractional cohorts`);
      assert.ok(allocation, `${seed}: dispersal entered unsupported habitat for ${speciesState.speciesId}`);
      // Birth pulses can briefly put a local cohort above K, but simultaneous
      // dispersal must not stack arbitrary immigration into the same destination.
      assert.ok(
        populationHere <= allocation!.carryingCapacity * 1.25 + 2,
        `${seed}: ${speciesState.speciesId} overcrowded patch ${cohort.patchId} (${populationHere}/${allocation!.carryingCapacity})`,
      );
      assert.ok(cohort.stages.juveniles >= 0 && cohort.stages.adults >= 0 && cohort.stages.old >= 0);
      assert.ok(cohort.condition >= 0 && cohort.condition <= 1);
      assert.ok(cohort.foodSufficiency >= 0 && cohort.foodSufficiency <= 1);
      assert.ok(cohort.waterSufficiency >= 0 && cohort.waterSufficiency <= 1);
      assert.ok(cohort.refugeSufficiency >= 0 && cohort.refugeSufficiency <= 1);
      assert.ok(cohort.breedingReadiness >= 0 && cohort.breedingReadiness <= 1);
    }
    assert.ok(speciesPopulation <= plan!.islandCarryingCapacity * 1.25 + 4, `${seed}: ${speciesState.speciesId} escaped its island-scale K too far`);
    finalSpecies.push({ id: speciesState.speciesId, population: speciesPopulation, k: plan!.islandCarryingCapacity });
  }

  const weakest = finalSpecies
    .sort((a, b) => a.population - b.population)
    .slice(0, 6)
    .map(entry => `${entry.id.replace('FAUNA_', '')}=${entry.population}/${entry.k}`)
    .join(', ');
  const signature = JSON.stringify(runtime.species);
  console.log(`[${seed}] day=${days} population=${population}/${world.faunaCommunity.totalCarryingCapacity} species=${runtime.telemetry.presentSpeciesCount}/${initialSpeciesCount} births=${births} deaths=${deaths} moved=${moved} crossRegion=${crossRegionMoved} condition=${runtime.telemetry.meanCondition.toFixed(3)}`);
  console.log(`[${seed}] weakest: ${weakest}`);
  return { population, births, deaths, moved, crossRegionMoved, presentSpecies: runtime.telemetry.presentSpeciesCount, signature };
}

function main(): void {
  assert.equal(getSpatialFaunaSeason(1), 'dry');
  assert.equal(getSpatialFaunaSeason(120), 'dry');
  assert.equal(getSpatialFaunaSeason(121), 'wet');
  assert.equal(getSpatialFaunaSeason(270), 'wet');
  assert.equal(getSpatialFaunaSeason(271), 'monsoon');
  assert.equal(getSpatialFaunaSeason(360), 'monsoon');
  assert.equal(getSpatialFaunaSeason(361), 'dry');

  const alpha = assertRuntimeInvariants('spatial-fauna-alpha', 365);
  const alphaAgain = assertRuntimeInvariants('spatial-fauna-alpha', 365);
  const beta = assertRuntimeInvariants('spatial-fauna-beta', 365);
  const longRun = assertRuntimeInvariants('spatial-fauna-alpha', 1800, { minPopulationFraction: .45, maxSpeciesLoss: 3 });

  assert.equal(alpha.population, alphaAgain.population, 'same seed/day horizon must reproduce population exactly');
  assert.equal(alpha.births, alphaAgain.births, 'same seed/day horizon must reproduce births exactly');
  assert.equal(alpha.deaths, alphaAgain.deaths, 'same seed/day horizon must reproduce deaths exactly');
  assert.equal(alpha.moved, alphaAgain.moved, 'same seed/day horizon must reproduce dispersal exactly');
  assert.equal(alpha.signature, alphaAgain.signature, 'same seed/day horizon must reproduce exact sparse cohort state');
  assert.notEqual(alpha.signature, beta.signature, 'different world seeds should retain different living fauna distributions');
  assert.ok(longRun.presentSpecies >= alpha.presentSpecies - 3, 'five-year runtime should retain most species without predator pressure');

  console.log('Living spatial fauna runtime regression passed.');
}

main();
