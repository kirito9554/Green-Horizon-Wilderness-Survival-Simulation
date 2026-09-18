import assert from 'node:assert/strict';
import type { SpatialPredatorPatchCohortState } from '../src/types/spatialEcologySimulation';
import { extractPredatorCohortTransfer, mergePredatorCohortTransfer } from '../src/simulation/spatial/spatialPredatorP6';
import {
  REFERENCE_WET_PREY_ENERGY_KJ_PER_KG,
  advancePredatorShadowDigestion,
  calculateFieldMetabolicRateKJPerDay,
  calculatePredatorBioenergeticLedger,
  calculatePredatorFeedingBoutPlan,
  calculatePredatorBioenergeticShadow,
  estimatePredatorShadowDigestionDays,
} from '../src/simulation/spatial/spatialPredatorP9';

const close = (actual: number, expected: number, tolerance: number, message: string): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
};

close(calculateFieldMetabolicRateKJPerDay(5.4, 'mammal'), 2646, 10, '5.4 kg mammal FMR baseline');
close(calculateFieldMetabolicRateKJPerDay(4.8, 'bird'), 3374, 10, '4.8 kg bird FMR baseline');
close(calculateFieldMetabolicRateKJPerDay(24, 'reptile'), 1536, 10, '24 kg reptile FMR baseline');

const monitorShadow = calculatePredatorBioenergeticShadow({
  speciesId: 'PREDATOR_MONITOR_LIZARD',
  adultWeightKg: 8.5,
  metabolicHeads: 1,
  legacyDailyFoodKgPerAdult: .55,
  edibleBiomassFromKillsKg: .08,
});
assert.ok(monitorShadow.legacyVsFmrDemandRatio > 4, 'legacy monitor kg-food demand should visibly exceed broad reptile FMR baseline');
assert.equal(monitorShadow.ingestedPreyEnergyKJ, .08 * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG);

close(
  estimatePredatorShadowDigestionDays('PREDATOR_PYTHON', 6, 24),
  7,
  1e-9,
  '25%-body-mass python meal should map to a seven-day shadow digestion horizon',
);
close(
  estimatePredatorShadowDigestionDays('PREDATOR_ESTUARINE_CROCODILE', 13.5, 180),
  4,
  1e-9,
  '7.5%-body-mass crocodilian meal should map to a four-day shadow digestion horizon',
);

const initial = { gutEnergyKJ: 0, gutMassKg: 0, daysRemaining: 0, daysSinceMeal: 5, lastMealEnergyKJ: 0 };
const mealEnergy = 6 * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG;
const day1 = advancePredatorShadowDigestion(initial, 'PREDATOR_PYTHON', 24, 6, mealEnergy);
close(
  day1.state.gutEnergyKJ + day1.assimilatedEnergyKJ + day1.digestionCostKJ,
  mealEnergy,
  1e-6,
  'shadow gut step must conserve incoming meal energy',
);
close(
  day1.state.gutMassKg + day1.grossReleasedMassKg,
  6,
  1e-9,
  'shadow gut step must conserve incoming meal mass',
);
assert.ok(day1.state.daysRemaining >= 6 && day1.state.daysRemaining <= 7, 'python meal must retain multi-day gut state after day one');
assert.ok(day1.digestionCostKJ > 0 && day1.assimilatedEnergyKJ > 0, 'digestion must split released energy into SDA cost and assimilated energy');

const p93SmallPrey = calculatePredatorFeedingBoutPlan({
  speciesId: 'PREDATOR_MONITOR_LIZARD',
  metabolicHeads: 1,
  fmrDemandKJ: calculateFieldMetabolicRateKJPerDay(8.5, 'reptile'),
  bioReserveKJ: 0,
  gutEnergyKJ: 0,
  maxKillsPerAdultPerDay: .42,
  candidates: [{ encounterScore: 10, expectedEdibleKg: .11, successProbability: .27 }],
});
assert.ok(p93SmallPrey.huntLimit >= 1 && p93SmallPrey.huntLimit <= 2,
  'P9.3 small-prey deficit must not expand into P8-style 20+ attempt budgets');

const pythonDemand = calculateFieldMetabolicRateKJPerDay(24, 'reptile');
const fedPython = calculatePredatorFeedingBoutPlan({
  speciesId: 'PREDATOR_PYTHON',
  metabolicHeads: 1,
  fmrDemandKJ: pythonDemand,
  bioReserveKJ: 0,
  gutEnergyKJ: pythonDemand * 4 / .75,
  maxKillsPerAdultPerDay: .16,
  candidates: [{ encounterScore: 10, expectedEdibleKg: 3, successProbability: .25 }],
});
assert.equal(fedPython.huntLimit, 0, 'python with more than one usable FMR-day in gut must not hunt');
const hungryPython = calculatePredatorFeedingBoutPlan({
  speciesId: 'PREDATOR_PYTHON',
  metabolicHeads: 1,
  fmrDemandKJ: pythonDemand,
  bioReserveKJ: 0,
  gutEnergyKJ: 0,
  maxKillsPerAdultPerDay: .16,
  candidates: [{ encounterScore: 10, expectedEdibleKg: 3, successProbability: .25 }],
});
close(hungryPython.mealTargetKJ, pythonDemand * 7, 1e-9,
  'empty python feeding bout should seek the seven-day empirical meal horizon');

const bioLedger = calculatePredatorBioenergeticLedger(1000, 400, 2000, 900);
assert.equal(bioLedger.coveredDemandKJ, 1000);
assert.equal(bioLedger.reserveDrawKJ, 100);
assert.equal(bioLedger.reserveAfterKJ, 300);
close(
  bioLedger.reserveBeforeKJ + bioLedger.assimilatedKJ,
  bioLedger.coveredDemandKJ + bioLedger.reserveAfterKJ + bioLedger.overflowKJ,
  1e-9,
  'P9.3 authoritative energy ledger must conserve energy',
);

const source: SpatialPredatorPatchCohortState = [0, 4, 0, .9, 8, 1000, 2, 5, 1];
const transfer = extractPredatorCohortTransfer(source, 1, true);
close((source[5] ?? 0) + (transfer[5] ?? 0), 1000, 1e-9, 'cohort movement must conserve shadow gut energy');
close((source[6] ?? 0) + (transfer[6] ?? 0), 2, 1e-9, 'cohort movement must conserve shadow gut mass');
const target: SpatialPredatorPatchCohortState = [0, 1, 0, .8, 1, 100, .2, 2, 3];
const targetGutBefore = target[5] ?? 0;
mergePredatorCohortTransfer(target, transfer);
close(target[5] ?? 0, targetGutBefore + (transfer[5] ?? 0), 1e-9, 'cohort merge must preserve transferred shadow gut energy');

console.log('spatial predator P9 bioenergetic-shadow regression passed');
