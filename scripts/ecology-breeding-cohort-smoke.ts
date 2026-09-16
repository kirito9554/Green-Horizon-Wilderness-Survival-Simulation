import assert from 'node:assert/strict';
import type { EcologyReproductionProfile } from '../src/data/ecologyDemography';
import {
  accumulateDemographyMortality,
  breederProtectedDispersalPlan,
  consumeDemographyMortality,
  demographicBalance,
  effectiveBreedingState,
  ensureDemographyTelemetry,
  mateAvailabilityFromBreeders,
  recordDemographyDeaths,
  softBreedingFitness,
} from '../src/simulation/ecologyDemographySystem';

const profile: EcologyReproductionProfile = {
  mode: 'live_birth',
  eventsPerAdultFemalePerYear: 2,
  minOffspringPerEvent: 1,
  maxOffspringPerEvent: 3,
  juvenileRecruitmentRate: 0.6,
  oldFertilityFactor: 0.35,
  lowPopulationRecoveryBoost: 0.5,
  overcrowdingSuppressionStart: 0.82,
  criticalMortalityBuffer: 0.35,
};

const oldOnly = { juveniles: 0, adults: 0, old: 2, maleRatio: 0.5 };
const oldState = effectiveBreedingState(oldOnly, profile);
assert.ok(oldState.effectiveBreeders > 0, 'old-only cohort retains reduced breeder capacity');
assert.ok(oldState.effectiveBreedingFemales > 0, 'old-only cohort retains reduced breeding females');
assert.ok(
  mateAvailabilityFromBreeders(oldState.effectiveBreeders) > 0,
  'old-only cohort is no longer hard mate-gated to zero',
);

const juvenileOnly = { juveniles: 4, adults: 0, old: 0, maleRatio: 0.5 };
const juvenileState = effectiveBreedingState(juvenileOnly, profile);
assert.equal(juvenileState.effectiveBreeders, 0, 'juvenile-only cohort cannot breed');
assert.equal(
  mateAvailabilityFromBreeders(juvenileState.effectiveBreeders),
  0,
  'juvenile-only cohort has no mate availability',
);

const oneAdult = { juveniles: 0, adults: 1, old: 0, maleRatio: 0.5 };
const singleAvailability = mateAvailabilityFromBreeders(effectiveBreedingState(oneAdult, profile).effectiveBreeders);
assert.ok(singleAvailability > 0 && singleAvailability < 1, 'one represented adult keeps partial external-mate availability');

const oneAdultTwoOld = { juveniles: 0, adults: 1, old: 2, maleRatio: 0.5 };
const dispersal = breederProtectedDispersalPlan(oneAdultTwoOld, 3, profile);
assert.equal(dispersal.adult, 0, 'pressure dispersal cannot delete the final prime-age breeder first');
assert.equal(dispersal.old, 2, 'lower-fertility old animals may disperse before the final adult breeder');
assert.equal(dispersal.total, 2, 'breeder protection stops removal before effective breeder capacity is erased');

const oldPairDispersal = breederProtectedDispersalPlan(oldOnly, 1, profile);
assert.equal(oldPairDispersal.total, 0, 'an old-only remnant is protected when dispersal would erase its remaining breeder capacity');

const dense = demographicBalance(150, 100, profile);
const sparse = demographicBalance(10, 100, profile);
assert.ok(
  dense.reproductionMultiplier < sparse.reproductionMultiplier,
  'overcrowding remains more suppressive than low-population recovery',
);
const resourcePoor = softBreedingFitness(1, 0.2, 0.1);
const healthy = softBreedingFitness(1, 0.9, 0.9);
assert.ok(
  resourcePoor > 0 && resourcePoor < healthy,
  'resource-poor breeders remain constrained without a new hard reproductive lock',
);

const mortalityPopulation = {
  juveniles: 2,
  adults: 2,
  old: 1,
  maleRatio: 0.5,
};
const telemetry = ensureDemographyTelemetry(mortalityPopulation, profile);
accumulateDemographyMortality(mortalityPopulation, profile, { old_age: 0.6, stress: 0.4 });
const causes = consumeDemographyMortality(mortalityPopulation, profile, 1);
const attributed = Object.values(causes).reduce((sum, value) => sum + (value || 0), 0);
assert.ok(Math.abs(attributed - 1) < 1e-9, 'whole emitted mortality is attributed across pending cause hazards');
mortalityPopulation.old -= 1;
recordDemographyDeaths(mortalityPopulation, profile, causes, { old: 1 });
assert.equal(
  telemetry.adultAndOldLosses,
  1,
  'replacement denominator includes mature-cohort losses',
);

console.log('ecology breeding-cohort regression: ok');
