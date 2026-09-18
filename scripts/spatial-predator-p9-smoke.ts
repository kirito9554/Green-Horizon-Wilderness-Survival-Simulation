import assert from 'node:assert/strict';
import {
  REFERENCE_WET_PREY_ENERGY_KJ_PER_KG,
  advancePredatorShadowDigestion,
  calculateFieldMetabolicRateKJPerDay,
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

const initial = { gutEnergyKJ: 0, daysRemaining: 0, daysSinceMeal: 5, lastMealEnergyKJ: 0 };
const mealEnergy = 6 * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG;
const day1 = advancePredatorShadowDigestion(initial, 'PREDATOR_PYTHON', 24, 6, mealEnergy);
close(
  day1.state.gutEnergyKJ + day1.assimilatedEnergyKJ + day1.digestionCostKJ,
  mealEnergy,
  1e-6,
  'shadow gut step must conserve incoming meal energy',
);
assert.ok(day1.state.daysRemaining >= 6 && day1.state.daysRemaining <= 7, 'python meal must retain multi-day gut state after day one');
assert.ok(day1.digestionCostKJ > 0 && day1.assimilatedEnergyKJ > 0, 'digestion must split released energy into SDA cost and assimilated energy');

console.log('spatial predator P9 bioenergetic-shadow regression passed');
