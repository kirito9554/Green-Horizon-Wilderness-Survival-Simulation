import assert from 'node:assert/strict';
import { SPATIAL_PREDATOR_BY_ID } from '../src/data/spatialPredators';
import { getBehaviorPatchesWithinRange } from '../src/simulation/spatial/spatialAnimalBehavior';
import {
  PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS,
  PREDATOR_RECOVERY_STABILITY_DAYS,
  advancePredatorRecoveryClock,
  extractPredatorCohortTransfer,
  getPredatorMateAccessScore,
  getPredatorMateSearchAccessChange,
  mergePredatorCohortTransfer,
  predatorCohortPopulation,
  predatorNeedsMateSearch,
  registerPredatorImmigrationPulse,
} from '../src/simulation/spatial/spatialPredatorP6';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';
import type { SpatialPredatorPatchCohortState, SpatialPredatorSpeciesRuntimeState } from '../src/types/spatialEcologySimulation';

const world = generateSpatialWorld('predator-p6-regression');
const raptor = SPATIAL_PREDATOR_BY_ID.PREDATOR_RAPTOR;
assert.ok(raptor, 'raptor definition missing');
const source = world.habitatPatches[0];
assert.ok(source, 'world has no habitat patches');
const neighbor = getBehaviorPatchesWithinRange(world, source.id, raptor.matingRangeKm)
  .find(entry => entry.patchId !== source.id);
assert.ok(neighbor, 'regression world needs a patch inside raptor mating range');

// A real pair on the same patch is a valid mating unit even though the continuous
// fertility curve for two effective breeders is below the old .58 movement threshold.
const pairBreeders = new Map<string, number>([[source.id, 2]]);
assert.equal(
  predatorNeedsMateSearch(world, source.id, raptor.matingRangeKm, pairBreeders),
  false,
  'valid same-patch pair must not launch mate-search',
);
assert.equal(
  getPredatorMateAccessScore(world, source.id, raptor.matingRangeKm, pairBreeders, source.id, 1),
  1,
  'remaining partner on the same patch must count as an accessible mate',
);

// One nearby breeder is a real mate even when distance weighting would make an aggregate
// breeder score lower than two.
const nearbyMate = new Map<string, number>([[source.id, 1], [neighbor.patchId, 1]]);
assert.equal(
  predatorNeedsMateSearch(world, source.id, raptor.matingRangeKm, nearbyMate),
  false,
  'reachable breeder on another patch must suppress mate-search',
);

const isolated = new Map<string, number>([[source.id, 1]]);
assert.equal(
  predatorNeedsMateSearch(world, source.id, raptor.matingRangeKm, isolated),
  true,
  'isolated singleton should be eligible for mate-search',
);
const noMateDestination = getPredatorMateSearchAccessChange(
  world,
  source.id,
  neighbor.patchId,
  raptor.matingRangeKm,
  isolated,
);
assert.equal(noMateDestination.hasMateAtDestination, false, 'destination without another breeder must be rejected');
assert.equal(noMateDestination.improves, false, 'destination without mate must not improve mate access');

const destinationMate = new Map<string, number>([[source.id, 1], [neighbor.patchId, 1]]);
const improved = getPredatorMateSearchAccessChange(
  world,
  source.id,
  neighbor.patchId,
  raptor.matingRangeKm,
  destinationMate,
);
assert.ok(improved.hasMateAtDestination, 'destination with a breeder must expose a real mate');
assert.ok(improved.after >= improved.before, 'mate-search destination must not make access worse');

// Transfers conserve age classes and food reserve. A blocked move can therefore be restored
// without demographic or energy loss.
const original: SpatialPredatorPatchCohortState = [2, 3, 1, .81, 12];
const sourceCohort: SpatialPredatorPatchCohortState = [...original];
const transfer = extractPredatorCohortTransfer(sourceCohort, 2, true);
assert.equal(predatorCohortPopulation(sourceCohort) + predatorCohortPopulation(transfer), predatorCohortPopulation(original));
for (const stage of [0, 1, 2] as const) assert.equal(sourceCohort[stage] + transfer[stage], original[stage], 'transfer changed age-class total');
assert.ok(Math.abs(sourceCohort[4] + transfer[4] - original[4]) < 1e-9, 'transfer changed total reserve');
mergePredatorCohortTransfer(sourceCohort, transfer);
for (const stage of [0, 1, 2] as const) assert.equal(sourceCohort[stage], original[stage], 'restored transfer changed age class');
assert.ok(Math.abs(sourceCohort[4] - original[4]) < 1e-9, 'restored transfer changed reserve');

// Recovery pressure survives a rescue pulse while cooldown prevents daily immigration.
const recoveryState: SpatialPredatorSpeciesRuntimeState = {
  speciesId: 'PREDATOR_RAPTOR',
  cohortsByPatch: {},
  belowMvpDays: raptor.recolonizationDelayDays[1] - 1,
  recoveryPressure: 0,
  recoveredDays: 0,
  nextEligibleImmigrationDay: 0,
};
const recoveryDay = 1000;
const ready = advancePredatorRecoveryClock(recoveryState, 1, 4, recoveryDay, raptor.recolonizationDelayDays);
assert.equal(ready.pressure, 1, 'recovery pressure should reach one at maximum onset delay');
assert.equal(ready.eligibleForPulse, true, 'fully ready under-MVP population should be pulse-eligible');
registerPredatorImmigrationPulse(recoveryState, recoveryDay);
assert.equal(recoveryState.recoveryPressure, 1, 'immigration pulse must not erase recovery pressure below MVP');
assert.equal(recoveryState.nextEligibleImmigrationDay, recoveryDay + PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS);
const cooldown = advancePredatorRecoveryClock(recoveryState, 3, 4, recoveryDay + 1, raptor.recolonizationDelayDays);
assert.equal(cooldown.pressure, 1, 'recovery pressure should persist after a partial rescue');
assert.equal(cooldown.eligibleForPulse, false, 'cooldown must prevent immigration on the next day');
assert.ok(PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS > 1, 'recovery pulse cooldown must be explicitly longer than one day');

for (let offset = 0; offset < PREDATOR_RECOVERY_STABILITY_DAYS; offset += 1) {
  advancePredatorRecoveryClock(recoveryState, 4, 4, recoveryDay + PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS + offset, raptor.recolonizationDelayDays);
}
assert.equal(recoveryState.recoveryPressure, 0, 'stable recovery should eventually clear accumulated pressure');
assert.equal(recoveryState.belowMvpDays, 0, 'stable recovery should reset below-MVP duration');

console.log('spatial predator P6 breeding-retention/recovery regression passed');
