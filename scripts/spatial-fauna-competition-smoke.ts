import assert from 'node:assert/strict';
import { SPATIAL_FAUNA_SPECIES_BY_ID } from '../src/data/spatialFauna';
import {
  applySpatialFaunaCompetitionPressure,
  buildSpatialFaunaCompetitionSnapshot,
  spatialFaunaDietOverlap,
} from '../src/simulation/spatial/spatialFaunaCompetition';
import { tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import {
  createSpatialFaunaRuntimeState,
  getSpatialFaunaCohortPopulation,
  getSpatialFaunaRuntimePopulation,
} from '../src/simulation/spatial/spatialFaunaRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

function findCompetitionPair(seed: string): {
  patchId: string;
  focalSpeciesId: string;
  competitorSpeciesId: string;
  competitorK: number;
} {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaRuntimeState(seed, 1, world);
  const speciesByPatch = new Map<string, string[]>();
  for (const speciesState of runtime.species) {
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      if (getSpatialFaunaCohortPopulation(cohort) <= 0) continue;
      const ids = speciesByPatch.get(patchId) ?? [];
      ids.push(speciesState.speciesId);
      speciesByPatch.set(patchId, ids);
    }
  }

  for (const [patchId, ids] of speciesByPatch) {
    for (const focalSpeciesId of ids) {
      for (const competitorSpeciesId of ids) {
        if (focalSpeciesId === competitorSpeciesId) continue;
        const focal = SPATIAL_FAUNA_SPECIES_BY_ID[focalSpeciesId];
        const competitor = SPATIAL_FAUNA_SPECIES_BY_ID[competitorSpeciesId];
        if (!focal || !competitor || spatialFaunaDietOverlap(focal, competitor) < .45) continue;
        const competitorPlan = world.faunaCommunity.species.find(plan => plan.speciesId === competitorSpeciesId);
        const competitorK = competitorPlan?.patchAllocations.find(allocation => allocation.patchId === patchId)?.carryingCapacity ?? 0;
        if (competitorK >= 3) return { patchId, focalSpeciesId, competitorSpeciesId, competitorK };
      }
    }
  }
  throw new Error(`${seed}: unable to find a co-located high-overlap competition pair`);
}

function assertArtificialCompetitionResponse(seed: string): void {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaRuntimeState(seed, 1, world);
  const pair = findCompetitionPair(seed);
  const focalState = runtime.species.find(species => species.speciesId === pair.focalSpeciesId)!;
  const competitorState = runtime.species.find(species => species.speciesId === pair.competitorSpeciesId)!;
  const focalCohort = focalState.cohortsByPatch[pair.patchId];
  const competitorCohort = competitorState.cohortsByPatch[pair.patchId];
  assert.ok(focalCohort && competitorCohort, 'chosen competition pair must occupy the same patch');

  const baseline = buildSpatialFaunaCompetitionSnapshot(runtime, world).get(pair.patchId)?.get(pair.focalSpeciesId);
  assert.ok(baseline, 'baseline focal competition pressure missing');

  // Inflate only the overlapping competitor. The focal cohort itself is left
  // untouched, so a response proves pressure is truly interspecific.
  competitorCohort[1] += Math.max(20, pair.competitorK * 12);
  const stressed = buildSpatialFaunaCompetitionSnapshot(runtime, world).get(pair.patchId)?.get(pair.focalSpeciesId);
  assert.ok(stressed, 'stressed focal competition pressure missing');
  assert.ok(
    stressed!.foodPressure > baseline!.foodPressure + .15,
    `overlapping competitor should increase focal food pressure (${baseline!.foodPressure} -> ${stressed!.foodPressure})`,
  );
  assert.ok(stressed!.foodPressure > 1, 'artificial competitor overload should exceed calibrated food baseline');
  assert.ok(stressed!.foodFactor < 1, 'food pressure above baseline must reduce effective food sufficiency');

  const conditionBefore = focalCohort[3];
  const summary = applySpatialFaunaCompetitionPressure(runtime, world);
  assert.ok(focalCohort[3] < conditionBefore, 'shared competition must reduce focal condition before demographic tick');
  assert.ok(summary.limitedPopulation > 0 && summary.limitedCohortCount > 0, 'overload must be visible in competition telemetry');

  console.log(
    `[${seed}] competition pair ${pair.focalSpeciesId}/${pair.competitorSpeciesId} @ ${pair.patchId}: `
      + `food pressure ${baseline!.foodPressure.toFixed(3)} -> ${stressed!.foodPressure.toFixed(3)}, `
      + `factor=${stressed!.foodFactor.toFixed(3)}`,
  );
}

function assertOneYearCommunity(seed: string): void {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaRuntimeState(seed, 1, world);
  const initialPopulation = getSpatialFaunaRuntimePopulation(runtime);
  const initialSpecies = runtime.species.length;
  let maxLimitedPopulation = 0;
  let peakFoodPressure = 0;
  let peakWaterPressure = 0;
  let peakRefugePressure = 0;

  for (let day = 2; day <= 365; day += 1) {
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day);
    assert.ok(telemetry.meanFoodCompetitionPressure !== undefined);
    assert.ok(telemetry.meanWaterCompetitionPressure !== undefined);
    assert.ok(telemetry.meanRefugeCompetitionPressure !== undefined);
    assert.ok(telemetry.competitionLimitedPopulation !== undefined);
    assert.ok(telemetry.meanFoodSufficiency >= 0 && telemetry.meanFoodSufficiency <= 1);
    assert.ok(telemetry.meanWaterSufficiency >= 0 && telemetry.meanWaterSufficiency <= 1);
    assert.ok(telemetry.meanRefugeSufficiency >= 0 && telemetry.meanRefugeSufficiency <= 1);
    maxLimitedPopulation = Math.max(maxLimitedPopulation, telemetry.competitionLimitedPopulation ?? 0);
    peakFoodPressure = Math.max(peakFoodPressure, telemetry.meanFoodCompetitionPressure ?? 0);
    peakWaterPressure = Math.max(peakWaterPressure, telemetry.meanWaterCompetitionPressure ?? 0);
    peakRefugePressure = Math.max(peakRefugePressure, telemetry.meanRefugeCompetitionPressure ?? 0);
  }

  const finalPopulation = getSpatialFaunaRuntimePopulation(runtime);
  assert.ok(finalPopulation >= initialPopulation * .48, `${seed}: shared competition caused whole-community collapse (${initialPopulation} -> ${finalPopulation})`);
  assert.ok(finalPopulation <= world.faunaCommunity.totalCarryingCapacity * 1.12, `${seed}: population escaped metric K too far`);
  assert.ok(runtime.telemetry.presentSpeciesCount >= initialSpecies - 2, `${seed}: too many species vanished before predators were migrated`);
  assert.ok(runtime.history.length <= 30, `${seed}: rolling telemetry history must remain bounded`);

  console.log(
    `[${seed}] shared competition day365 pop=${finalPopulation}/${world.faunaCommunity.totalCarryingCapacity} `
      + `species=${runtime.telemetry.presentSpeciesCount}/${initialSpecies} `
      + `peakMeanPressure food=${peakFoodPressure.toFixed(3)} water=${peakWaterPressure.toFixed(3)} refuge=${peakRefugePressure.toFixed(3)} `
      + `maxLimitedPop=${maxLimitedPopulation}`,
  );
}

function main(): void {
  assertArtificialCompetitionResponse('spatial-fauna-alpha');
  assertOneYearCommunity('spatial-fauna-alpha');
  assertOneYearCommunity('spatial-fauna-beta');
  console.log('Shared spatial fauna competition regression passed.');
}

main();
