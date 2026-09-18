export type PredatorBioenergeticClass = 'mammal' | 'bird' | 'reptile';

export interface PredatorBioenergeticShadowInput {
  speciesId: string;
  adultWeightKg: number;
  metabolicHeads: number;
  legacyDailyFoodKgPerAdult: number;
  edibleBiomassFromKillsKg: number;
}

export interface PredatorBioenergeticShadow {
  taxonomicClass: PredatorBioenergeticClass;
  fmrDemandKJ: number;
  legacyDemandEquivalentKJ: number;
  ingestedPreyEnergyKJ: number;
  fmrCoverageRatio: number;
  legacyVsFmrDemandRatio: number;
}

export interface PredatorShadowDigestionState {
  gutEnergyKJ: number;
  gutMassKg: number;
  daysRemaining: number;
  daysSinceMeal: number;
  lastMealEnergyKJ: number;
}

export interface PredatorShadowDigestionStep {
  state: PredatorShadowDigestionState;
  grossReleasedKJ: number;
  grossReleasedMassKg: number;
  digestionCostKJ: number;
  assimilatedEnergyKJ: number;
}

/**
 * Nagy et al. field-metabolic-rate allometries.
 * Body mass is expressed in grams and output is kJ/day.
 *
 * These are broad taxonomic baselines, not species-specific calibration.
 * P9.1 deliberately keeps them in shadow telemetry so existing P8 behavior
 * remains authoritative until later P9 phases are validated.
 */
const FMR: Readonly<Record<PredatorBioenergeticClass, { coefficient: number; exponent: number }>> = Object.freeze({
  mammal: { coefficient: 4.82, exponent: .734 },
  bird: { coefficient: 10.5, exponent: .681 },
  reptile: { coefficient: .196, exponent: .889 },
});

/**
 * Reference wet whole-prey energy density used only to express legacy kg-food
 * demand and P8 edible kills on the same shadow-energy axis.
 *
 * 3,929 kcal/kg dry matter at 32.65% dry matter is about 5.37 MJ/kg wet mass.
 * This is intentionally a generic reference; later P9 phases can attach
 * prey-specific proximate composition / metabolizable-energy values.
 */
export const REFERENCE_WET_PREY_ENERGY_KJ_PER_KG = 5370;

const nonNegative = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function getPredatorBioenergeticClass(speciesId: string): PredatorBioenergeticClass {
  if (speciesId === 'PREDATOR_RAPTOR') return 'bird';
  if (speciesId === 'PREDATOR_CIVET') return 'mammal';
  return 'reptile';
}

export function calculateFieldMetabolicRateKJPerDay(
  adultWeightKg: number,
  taxonomicClass: PredatorBioenergeticClass,
): number {
  const grams = nonNegative(adultWeightKg) * 1000;
  if (grams <= 0) return 0;
  const { coefficient, exponent } = FMR[taxonomicClass];
  return coefficient * Math.pow(grams, exponent);
}

export function calculatePredatorBioenergeticShadow(
  input: PredatorBioenergeticShadowInput,
): PredatorBioenergeticShadow {
  const taxonomicClass = getPredatorBioenergeticClass(input.speciesId);
  const heads = nonNegative(input.metabolicHeads);
  const fmrDemandKJ = heads * calculateFieldMetabolicRateKJPerDay(input.adultWeightKg, taxonomicClass);
  const legacyDemandEquivalentKJ = heads
    * nonNegative(input.legacyDailyFoodKgPerAdult)
    * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG;
  const ingestedPreyEnergyKJ = nonNegative(input.edibleBiomassFromKillsKg)
    * REFERENCE_WET_PREY_ENERGY_KJ_PER_KG;

  return {
    taxonomicClass,
    fmrDemandKJ,
    legacyDemandEquivalentKJ,
    ingestedPreyEnergyKJ,
    fmrCoverageRatio: fmrDemandKJ > 0 ? ingestedPreyEnergyKJ / fmrDemandKJ : 1,
    legacyVsFmrDemandRatio: fmrDemandKJ > 0 ? legacyDemandEquivalentKJ / fmrDemandKJ : 1,
  };
}

/**
 * P9.2 shadow digestion horizon.
 *
 * Python calibration is anchored so a 25%-body-mass meal resolves to seven
 * days, inside the observed 6-8 day return-to-prefeeding metabolic window.
 * Crocodilian calibration is anchored so a 7.5%-body-mass meal resolves to
 * four days, matching the multi-day postprandial response reported for
 * crocodilians/alligators. Other profiles are deliberately conservative
 * placeholders and remain non-authoritative.
 */
export function estimatePredatorShadowDigestionDays(
  speciesId: string,
  mealMassKg: number,
  adultWeightKg: number,
): number {
  const fraction = adultWeightKg > 0 ? nonNegative(mealMassKg) / adultWeightKg : 0;
  if (speciesId === 'PREDATOR_PYTHON') return clamp(2 + fraction * 20, 2, 10);
  if (speciesId === 'PREDATOR_ESTUARINE_CROCODILE') return clamp(2.5 + fraction * 20, 2.5, 7);
  if (speciesId === 'PREDATOR_MONITOR_LIZARD') return clamp(1 + fraction * 8, 1, 4);
  return clamp(1 + fraction * 2, 1, 2);
}

export function predatorShadowSdaFraction(speciesId: string): number {
  if (speciesId === 'PREDATOR_PYTHON') return .25;
  if (speciesId === 'PREDATOR_ESTUARINE_CROCODILE') return .32;
  if (speciesId === 'PREDATOR_MONITOR_LIZARD') return .18;
  return .10;
}

/**
 * Advances a non-authoritative gut-energy pool by one simulation day.
 * It exists to validate conservation and digestion times before gut state is
 * allowed to suppress or trigger hunting in P9.3.
 */
export function advancePredatorShadowDigestion(
  previous: PredatorShadowDigestionState,
  speciesId: string,
  adultWeightKg: number,
  newMealMassKg = 0,
  newMealEnergyKJ = 0,
): PredatorShadowDigestionStep {
  const addedEnergy = nonNegative(newMealEnergyKJ);
  const addedMealMass = nonNegative(newMealMassKg);
  const incomingGutEnergy = nonNegative(previous.gutEnergyKJ) + addedEnergy;
  const incomingGutMass = nonNegative(previous.gutMassKg) + addedMealMass;
  const newMealDays = addedEnergy > 0
    ? estimatePredatorShadowDigestionDays(speciesId, addedMealMass, adultWeightKg)
    : 0;
  const daysRemaining = Math.max(nonNegative(previous.daysRemaining), newMealDays);

  if (incomingGutEnergy <= 0 || daysRemaining <= 0) {
    return {
      state: {
        gutEnergyKJ: 0,
        gutMassKg: 0,
        daysRemaining: 0,
        daysSinceMeal: addedEnergy > 0 ? 0 : nonNegative(previous.daysSinceMeal) + 1,
        lastMealEnergyKJ: addedEnergy > 0 ? addedEnergy : nonNegative(previous.lastMealEnergyKJ),
      },
      grossReleasedKJ: 0,
      grossReleasedMassKg: 0,
      digestionCostKJ: 0,
      assimilatedEnergyKJ: 0,
    };
  }

  const grossReleasedKJ = Math.min(incomingGutEnergy, incomingGutEnergy / Math.max(1, daysRemaining));
  const grossReleasedMassKg = Math.min(incomingGutMass, incomingGutMass / Math.max(1, daysRemaining));
  const digestionCostKJ = grossReleasedKJ * predatorShadowSdaFraction(speciesId);
  const assimilatedEnergyKJ = grossReleasedKJ - digestionCostKJ;
  const nextGutEnergyKJ = Math.max(0, incomingGutEnergy - grossReleasedKJ);
  const nextGutMassKg = Math.max(0, incomingGutMass - grossReleasedMassKg);
  const nextDaysRemaining = nextGutEnergyKJ > 1e-9 ? Math.max(0, daysRemaining - 1) : 0;

  return {
    state: {
      gutEnergyKJ: nextGutEnergyKJ,
      gutMassKg: nextGutMassKg,
      daysRemaining: nextDaysRemaining,
      daysSinceMeal: addedEnergy > 0 ? 0 : nonNegative(previous.daysSinceMeal) + 1,
      lastMealEnergyKJ: addedEnergy > 0 ? addedEnergy : nonNegative(previous.lastMealEnergyKJ),
    },
    grossReleasedKJ,
    grossReleasedMassKg,
    digestionCostKJ,
    assimilatedEnergyKJ,
  };
}
