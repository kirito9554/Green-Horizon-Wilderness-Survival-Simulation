import assert from 'node:assert/strict';
import { SPATIAL_PREDATOR_SPECIES } from '../src/data/spatialPredators';
import {
  createSpatialPredatorRuntimeState,
  getSpatialPredatorMinimumFounderUnits,
  getSpatialPredatorMinimumViablePopulation,
} from '../src/simulation/spatial/spatialPredatorRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

for (const seed of ['spatial-trophic-alpha', 'spatial-trophic-beta', 'predator-founder-gamma']) {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialPredatorRuntimeState(world, 1);
  let present = 0;
  for (const def of SPATIAL_PREDATOR_SPECIES) {
    const state = runtime.species.find(entry => entry.speciesId === def.id)!;
    const cohorts = Object.values(state.cohortsByPatch);
    const population = cohorts.reduce((sum, cohort) => sum + cohort[0] + cohort[1] + cohort[2], 0);
    if (population <= 0) continue;
    present += 1;
    const minimumUnits = getSpatialPredatorMinimumFounderUnits(def);
    const minimumPopulation = getSpatialPredatorMinimumViablePopulation(def);
    assert.ok(population >= minimumPopulation, seed + ' ' + def.name + ': population ' + population + ' below viable founder floor ' + minimumPopulation);
    assert.ok(cohorts.length >= minimumUnits, seed + ' ' + def.name + ': expected at least ' + minimumUnits + ' founder units, got ' + cohorts.length);
    for (const cohort of cohorts) {
      const unitPopulation = cohort[0] + cohort[1] + cohort[2];
      assert.ok(unitPopulation >= 2, seed + ' ' + def.name + ': initial singleton founder unit detected');
      assert.ok(cohort[1] >= 2, seed + ' ' + def.name + ': founder unit must begin with at least two adults');
    }
    console.log('[' + seed + '] ' + def.name + ': population=' + population + ' units=' + cohorts.length + ' sizes=' + cohorts.map(c => c[0] + c[1] + c[2]).join(','));
  }
  assert.ok(present >= 4, seed + ': expected at least four predator species, got ' + present);
  assert.ok(runtime.telemetry.totalPopulation < 400, seed + ': founder seeding unexpectedly exceeds conservative island envelope (' + runtime.telemetry.totalPopulation + ')');
}

console.log('spatial predator founder smoke passed');
