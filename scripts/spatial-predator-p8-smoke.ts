import assert from 'node:assert/strict';
import {
  calculatePredatorHuntPlan,
  getPredatorEnergyWeightedTargetScore,
} from '../src/simulation/spatial/spatialPredatorP8';

assert.equal(
  calculatePredatorHuntPlan({
    metabolicHeads: 1,
    dailyNeedKg: .72,
    reserveBeforeKg: 1,
    reserveCapacityKg: 4,
    maxKillsPerAdultPerDay: .16,
    candidates: [{ encounterScore: 10, expectedEdibleKg: .4, successProbability: .25 }],
  }).huntLimit,
  0,
  'reserve sufficient for today must suppress hunting',
);

const smallPrey = calculatePredatorHuntPlan({
  metabolicHeads: 1,
  dailyNeedKg: .55,
  reserveBeforeKg: 0,
  reserveCapacityKg: 1.2,
  maxKillsPerAdultPerDay: .42,
  candidates: [{ encounterScore: 10, expectedEdibleKg: .11, successProbability: .27 }],
});
assert.ok(smallPrey.requiredAttempts > 1, 'small prey must permit a multi-attempt feeding bout');
assert.ok(
  smallPrey.huntLimit > smallPrey.authoredCadenceAttempts,
  'energy deficit must not be truncated by legacy global-cap semantics',
);

const largePrey = calculatePredatorHuntPlan({
  metabolicHeads: 1,
  dailyNeedKg: 1.65,
  reserveBeforeKg: 0,
  reserveCapacityKg: 18,
  maxKillsPerAdultPerDay: .08,
  candidates: [{ encounterScore: 10, expectedEdibleKg: 8, successProbability: .2 }],
});
assert.ok(largePrey.requiredAttempts <= 5, 'large prey should require few expected attempts');

assert.ok(
  getPredatorEnergyWeightedTargetScore(10, 2, 3) > getPredatorEnergyWeightedTargetScore(10, .2, 3),
  'usable larger prey should have greater energy utility at equal encounter opportunity',
);
assert.equal(
  getPredatorEnergyWeightedTargetScore(10, 20, 3),
  getPredatorEnergyWeightedTargetScore(10, 3, 3),
  'prey biomass beyond usable/storage capacity must not receive unlimited target preference',
);
assert.equal(
  getPredatorEnergyWeightedTargetScore(0, 5, 3),
  0,
  'zero encounter opportunity must remain unselectable',
);

console.log('spatial predator P8 intermittent-feeding/hunt-plan regression passed');
