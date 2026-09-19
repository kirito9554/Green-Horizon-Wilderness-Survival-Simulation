import assert from 'node:assert/strict';
import type { SpatialPredatorPatchCohortState } from '../src/types/spatialEcologySimulation';
import { extractPredatorCohortTransfer, mergePredatorCohortTransfer } from '../src/simulation/spatial/spatialPredatorP6';
import {
  REFERENCE_WET_PREY_ENERGY_KJ_PER_KG,
  advancePredatorShadowDigestion,
  calculateFieldMetabolicRateKJPerDay,
  calculatePredatorBioenergeticLedger,
  calculatePredatorCalibratedEnergyDemandKJPerAdultDay,
  calculatePredatorCalibratedFmrKJPerAdultDay,
  calculatePredatorFeedingBoutPlan,
  getPredatorP95TargetScore,
  predatorAlternativeFoodResources,
  predatorCalibratedBioReserveDays,
  predatorCalibratedBoutAttemptsPerHead,
  predatorCalibratedMealTargetKg,
  predatorCalibratedMaxPreyMassKg,
  predatorCalibratedPreySizeProfitability,
  predatorConsumedPreyFraction,
  predatorLocalDensitySwitchFactor,
  PREDATOR_ALTERNATIVE_FOOD_ENERGY_KJ_PER_KG,
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

assert.equal(
  predatorCalibratedBoutAttemptsPerHead('PREDATOR_RAPTOR'),
  3,
  'P9.6 raptor should use the observed median three attacks per feeding bout',
);
assert.equal(
  predatorCalibratedBoutAttemptsPerHead('PREDATOR_PYTHON'),
  0,
  'P9.6 raptor effort calibration must not leak into ambush specialists',
);
const raptorBout = calculatePredatorFeedingBoutPlan({
  speciesId: 'PREDATOR_RAPTOR',
  metabolicHeads: 1,
  fmrDemandKJ: 1323,
  bioReserveKJ: 0,
  gutEnergyKJ: 0,
  maxKillsPerAdultPerDay: .34,
  calibratedBoutAttemptsPerHead: 3,
  candidates: [{ encounterScore: 10, expectedEdibleKg: .3, successProbability: .2 }],
});
assert.equal(raptorBout.huntLimit, 3,
  'P9.6 raptor effort must be a bounded three-attempt feeding bout, not deficit-driven spam');

close(
  calculatePredatorCalibratedFmrKJPerAdultDay('PREDATOR_RAPTOR', 4.8),
  1323,
  1e-9,
  'P9.6 raptor analogue demand should match adult Ferruginous Hawk expenditure calibration',
);
close(
  calculatePredatorCalibratedEnergyDemandKJPerAdultDay('PREDATOR_PYTHON', 24),
  24 * .25 * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG * .755 / 28,
  1e-9,
  'P9.6 python demand should follow the 25%-meal / 28-day feeding-cycle benchmark',
);
close(
  calculatePredatorCalibratedEnergyDemandKJPerAdultDay('PREDATOR_ESTUARINE_CROCODILE', 180),
  180 * .04 * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG * .68 / 7,
  1e-9,
  'P9.6 crocodilian demand should follow the 4%-body-mass-per-week maintenance benchmark',
);
close(
  predatorCalibratedMealTargetKg('PREDATOR_PYTHON', 24),
  6,
  1e-9,
  'P9.6 python gross meal target should be 25% body mass',
);
close(
  predatorCalibratedMaxPreyMassKg('PREDATOR_PYTHON', 24, 16),
  24,
  1e-9,
  'P9.6 python calibrated gape should conservatively allow a single prey item up to its own body mass',
);
close(
  predatorCalibratedMaxPreyMassKg('PREDATOR_RAPTOR', 4.8, 4.2),
  4.2,
  1e-9,
  'P9.6 raptor should retain the authored maximum until a stronger carrying/gape analogue exists',
);
close(
  predatorCalibratedMealTargetKg('PREDATOR_ESTUARINE_CROCODILE', 180),
  13.5,
  1e-9,
  'P9.6 crocodilian large-meal target should be 7.5% body mass',
);
assert.equal(
  predatorCalibratedBioReserveDays('PREDATOR_PYTHON', 5.625),
  60,
  'P9.6 python reserve must reflect documented prolonged-fasting physiology',
);
assert.equal(
  predatorCalibratedBioReserveDays('PREDATOR_ESTUARINE_CROCODILE', 11.25),
  30,
  'P9.6 crocodilian reserve must outlast the short inherited kill-cadence horizon',
);
assert.ok(
  predatorCalibratedPreySizeProfitability('PREDATOR_PYTHON', 6, 24)
    > predatorCalibratedPreySizeProfitability('PREDATOR_PYTHON', .28, 24) * 4,
  'P9.6 python should strongly prefer meal-sized prey over tiny rodents when both are available',
);
assert.ok(
  predatorCalibratedPreySizeProfitability('PREDATOR_RAPTOR', 1.2, 4.8)
    > predatorCalibratedPreySizeProfitability('PREDATOR_RAPTOR', .18, 4.8),
  'P9.6 large raptor should prefer the empirically optimal medium prey class',
);
assert.ok(
  predatorCalibratedPreySizeProfitability('PREDATOR_ESTUARINE_CROCODILE', 50, 180)
    > predatorCalibratedPreySizeProfitability('PREDATOR_ESTUARINE_CROCODILE', 1.2, 180),
  'P9.6 adult crocodilian should gain more profitability from large terrestrial prey than tiny prey',
);

const calibratedPythonDemand = calculatePredatorCalibratedEnergyDemandKJPerAdultDay('PREDATOR_PYTHON', 24);
const calibratedPythonBout = calculatePredatorFeedingBoutPlan({
  speciesId: 'PREDATOR_PYTHON',
  metabolicHeads: 1,
  fmrDemandKJ: calibratedPythonDemand,
  bioReserveKJ: 0,
  gutEnergyKJ: 0,
  maxKillsPerAdultPerDay: .16,
  calibratedMealTargetKg: predatorCalibratedMealTargetKg('PREDATOR_PYTHON', 24),
  candidates: [{ encounterScore: 10, expectedEdibleKg: 4.2, successProbability: .25 }],
});
close(
  calibratedPythonBout.mealUtilityCapacityKg,
  6,
  1e-9,
  'empty calibrated python should seek one 25%-body-mass gross meal',
);

assert.equal(
  predatorConsumedPreyFraction('PREDATOR_PYTHON', 3.6, 24),
  1,
  'P9.6 python must ingest whole prey rather than inherit the 0.62 carcass fraction',
);
assert.ok(
  predatorConsumedPreyFraction('PREDATOR_RAPTOR', .34, 4.8)
    > predatorConsumedPreyFraction('PREDATOR_RAPTOR', 3.6, 4.8),
  'P9.6 raptor should consume a larger fraction of small prey than large prey',
);
assert.ok(
  predatorConsumedPreyFraction('PREDATOR_ESTUARINE_CROCODILE', 1.25, 180)
    > predatorConsumedPreyFraction('PREDATOR_ESTUARINE_CROCODILE', 68, 180),
  'P9.6 crocodilian should swallow small prey more completely than large prey',
);

close(
  predatorLocalDensitySwitchFactor(100, 100),
  1,
  1e-9,
  'P9.5 density switching should be neutral at local K',
);
assert.ok(
  predatorLocalDensitySwitchFactor(10, 100) < predatorLocalDensitySwitchFactor(50, 100),
  'P9.5 density switching must reduce pressure as prey becomes locally rare',
);
close(
  predatorLocalDensitySwitchFactor(10, 100),
  predatorLocalDensitySwitchFactor(1, 10),
  1e-9,
  'P9.5 switching must depend on relative N/K rather than absolute head count',
);
const smallTarget = getPredatorP95TargetScore({
  encounterScore: 10,
  successProbability: .3,
  expectedEdibleKg: .2,
  mealUtilityCapacityKg: 3,
  localPopulation: 50,
  localCarryingCapacity: 100,
});
const largeTarget = getPredatorP95TargetScore({
  encounterScore: 10,
  successProbability: .3,
  expectedEdibleKg: 2,
  mealUtilityCapacityKg: 3,
  localPopulation: 50,
  localCarryingCapacity: 100,
});
assert.ok(largeTarget > smallTarget, 'P9.5 profitability should prefer more usable energy per comparable encounter');

assert.deepEqual(
  predatorAlternativeFoodResources('PREDATOR_MONITOR_LIZARD'),
  ['insects', 'carrion'],
  'monitor alternative diet must remain invertebrate/carrion rather than inventing plant feeding',
);
assert.deepEqual(
  predatorAlternativeFoodResources('PREDATOR_CIVET'),
  ['fruit', 'insects', 'carrion'],
  'civet alternative diet must expose generalist channels',
);
assert.ok(
  PREDATOR_ALTERNATIVE_FOOD_ENERGY_KJ_PER_KG.insects
    > PREDATOR_ALTERNATIVE_FOOD_ENERGY_KJ_PER_KG.fruit,
  'fresh insects should remain more energy dense than fruit in P9.4',
);

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
