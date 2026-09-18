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


export interface PredatorFeedingCandidateInput {
  encounterScore: number;
  expectedEdibleKg: number;
  successProbability: number;
}

export interface PredatorFeedingBoutPlanInput {
  speciesId: string;
  metabolicHeads: number;
  fmrDemandKJ: number;
  bioReserveKJ: number;
  gutEnergyKJ: number;
  maxKillsPerAdultPerDay: number;
  candidates: readonly PredatorFeedingCandidateInput[];
}

export interface PredatorFeedingBoutPlan {
  storedUsableEnergyKJ: number;
  feedingTriggerKJ: number;
  mealTargetKJ: number;
  feedingGapKJ: number;
  mealUtilityCapacityKg: number;
  meanSuccessProbability: number;
  authoredCadenceAttempts: number;
  huntLimit: number;
}

export interface PredatorBioenergeticLedger {
  demandKJ: number;
  reserveBeforeKJ: number;
  assimilatedKJ: number;
  availableKJ: number;
  coveredDemandKJ: number;
  shortfallKJ: number;
  reserveGainKJ: number;
  reserveDrawKJ: number;
  reserveAfterKJ: number;
  overflowKJ: number;
}

/**
 * Meal target horizon for the first authoritative feeding-bout pass.
 *
 * Python: seven days is the midpoint of the observed 6-8 day return to
 * prefeeding metabolism after a 25%-body-mass meal.
 * Crocodilian: four days follows the documented multi-day postprandial
 * response after a ~7.5%-body-mass meal.
 *
 * Other taxa deliberately use a one-day target until species calibration.
 * This is not a claim that they physiologically empty the gut in one day;
 * it prevents unsourced multi-day satiation constants from entering P9.3.
 */
export function predatorFeedingTargetHorizonDays(speciesId: string): number {
  if (speciesId === 'PREDATOR_PYTHON') return 7;
  if (speciesId === 'PREDATOR_ESTUARINE_CROCODILE') return 4;
  return 1;
}

export function predatorNetGutEnergyKJ(speciesId: string, grossGutEnergyKJ: number): number {
  return nonNegative(grossGutEnergyKJ) * (1 - predatorShadowSdaFraction(speciesId));
}

/**
 * P9.3 feeding-bout planner.
 *
 * Critical distinction from P8:
 * - energy deficit decides whether a bout is needed and when it can stop;
 * - energy deficit NEVER increases the number of hunt attempts.
 *
 * Attempt budget comes only from the inherited feeding-activity cadence and
 * encounter success. This removes the P8 positive feedback where tiny prey
 * created 10-20+ attempts simply because each kill yielded little energy.
 */
export function calculatePredatorFeedingBoutPlan(
  input: PredatorFeedingBoutPlanInput,
): PredatorFeedingBoutPlan {
  const metabolicHeads = nonNegative(input.metabolicHeads);
  const fmrDemandKJ = nonNegative(input.fmrDemandKJ);
  const reserveKJ = nonNegative(input.bioReserveKJ);
  const netGutKJ = predatorNetGutEnergyKJ(input.speciesId, input.gutEnergyKJ);
  const storedUsableEnergyKJ = reserveKJ + netGutKJ;
  const feedingTriggerKJ = fmrDemandKJ;
  const mealTargetKJ = fmrDemandKJ * predatorFeedingTargetHorizonDays(input.speciesId);
  const feedingGapKJ = Math.max(0, mealTargetKJ - storedUsableEnergyKJ);
  const mealUtilityCapacityKg = feedingGapKJ / REFERENCE_WET_PREY_ENERGY_KJ_PER_KG;

  if (
    fmrDemandKJ <= 1e-9
    || storedUsableEnergyKJ >= feedingTriggerKJ
    || input.candidates.length === 0
  ) {
    return {
      storedUsableEnergyKJ,
      feedingTriggerKJ,
      mealTargetKJ,
      feedingGapKJ,
      mealUtilityCapacityKg,
      meanSuccessProbability: 0,
      authoredCadenceAttempts: 0,
      huntLimit: 0,
    };
  }

  let weightSum = 0;
  let successWeighted = 0;
  for (const candidate of input.candidates) {
    const encounter = nonNegative(candidate.encounterScore);
    const expectedEdibleKg = nonNegative(candidate.expectedEdibleKg);
    const capacityKg = Math.max(.001, mealUtilityCapacityKg);
    const weight = encounter * Math.min(expectedEdibleKg, capacityKg);
    if (weight <= 0) continue;
    const success = clamp(candidate.successProbability, 0, 1);
    weightSum += weight;
    successWeighted += weight * success;
  }

  if (weightSum <= 0) {
    return {
      storedUsableEnergyKJ,
      feedingTriggerKJ,
      mealTargetKJ,
      feedingGapKJ,
      mealUtilityCapacityKg,
      meanSuccessProbability: 0,
      authoredCadenceAttempts: 0,
      huntLimit: 0,
    };
  }

  const meanSuccessProbability = clamp(successWeighted / weightSum, 0, 1);
  const effectiveSuccess = Math.max(.05, meanSuccessProbability);
  const authoredCadenceAttempts = metabolicHeads
    * nonNegative(input.maxKillsPerAdultPerDay)
    / effectiveSuccess;
  const huntLimit = Math.min(24, Math.max(1, Math.ceil(authoredCadenceAttempts)));

  return {
    storedUsableEnergyKJ,
    feedingTriggerKJ,
    mealTargetKJ,
    feedingGapKJ,
    mealUtilityCapacityKg,
    meanSuccessProbability,
    authoredCadenceAttempts,
    huntLimit,
  };
}

export function calculatePredatorBioenergeticLedger(
  demandKJ: number,
  reserveBeforeKJ: number,
  reserveCapacityKJ: number,
  assimilatedKJ: number,
): PredatorBioenergeticLedger {
  const demand = nonNegative(demandKJ);
  const capacity = nonNegative(reserveCapacityKJ);
  const reserveBefore = Math.min(capacity, nonNegative(reserveBeforeKJ));
  const assimilated = nonNegative(assimilatedKJ);

  // Newly assimilated energy serves current expenditure before body reserve is
  // drawn. Surplus assimilation can refill reserve up to its capacity.
  const freshToDemandKJ = Math.min(assimilated, demand);
  const remainingDemandKJ = Math.max(0, demand - freshToDemandKJ);
  const reserveDrawKJ = Math.min(reserveBefore, remainingDemandKJ);
  const coveredDemandKJ = freshToDemandKJ + reserveDrawKJ;
  const shortfallKJ = Math.max(0, demand - coveredDemandKJ);

  const reserveAfterDrawKJ = Math.max(0, reserveBefore - reserveDrawKJ);
  const freshSurplusKJ = Math.max(0, assimilated - freshToDemandKJ);
  const reserveGainKJ = Math.min(
    Math.max(0, capacity - reserveAfterDrawKJ),
    freshSurplusKJ,
  );
  const reserveAfterKJ = reserveAfterDrawKJ + reserveGainKJ;
  const overflowKJ = Math.max(0, freshSurplusKJ - reserveGainKJ);
  const availableKJ = reserveBefore + assimilated;

  return {
    demandKJ: demand,
    reserveBeforeKJ: reserveBefore,
    assimilatedKJ: assimilated,
    availableKJ,
    coveredDemandKJ,
    shortfallKJ,
    reserveGainKJ,
    reserveDrawKJ,
    reserveAfterKJ,
    overflowKJ,
  };
}

/** Authority-friendly name; the old shadow name is retained for P9.1/P9.2 reports. */
export const advancePredatorDigestion = advancePredatorShadowDigestion;


export type PredatorAlternativeFoodResource = 'fruit' | 'insects' | 'carrion';

/**
 * Wet-mass energy densities for P9.4 alternative foods.
 *
 * Fruit is deliberately conservative at 2 MJ/kg fresh mass: published wild
 * fruits span widely with many values around ~0.5-4 MJ/kg fresh mass.
 * Insects use 6 MJ/kg fresh mass, derived from ~19-26 MJ/kg dry arthropod
 * energy density and roughly 30% dry matter in fresh larvae.
 * Carrion reuses the whole-prey reference axis.
 */
export const PREDATOR_ALTERNATIVE_FOOD_ENERGY_KJ_PER_KG: Readonly<Record<PredatorAlternativeFoodResource, number>> =
  Object.freeze({
    fruit: 2000,
    insects: 6000,
    carrion: REFERENCE_WET_PREY_ENERGY_KJ_PER_KG,
  });

/**
 * Eligibility, not a fixed diet fraction.
 * Actual composition emerges from local stock and energetic profitability.
 */
export function predatorAlternativeFoodResources(speciesId: string): readonly PredatorAlternativeFoodResource[] {
  if (speciesId === 'PREDATOR_MONITOR_LIZARD') return ['insects', 'carrion'];
  if (speciesId === 'PREDATOR_CIVET') return ['fruit', 'insects', 'carrion'];
  return [];
}


/**
 * P9.5 local-density switching.
 *
 * The response uses local N/K instead of absolute head count so naturally
 * low-density large prey are not treated as "rare" merely because rats have
 * higher carrying density. At K the multiplier is 1; below K it falls
 * sigmoid-like and approaches a quadratic response once multiplied by the
 * existing encounter score (which already contains N).
 *
 * h=0.5 means half-saturation at half of authored local carrying capacity.
 * This remains a generic functional-response parameter pending species-level
 * calibration; it is deliberately not tied to the global prey-collapse gate.
 */
export function predatorLocalDensitySwitchFactor(
  population: number,
  localCarryingCapacity: number,
  halfSaturationFraction = .5,
): number {
  const k = Math.max(1e-9, nonNegative(localCarryingCapacity));
  const h = Math.max(.01, nonNegative(halfSaturationFraction));
  const relativeDensity = nonNegative(population) / k;
  if (relativeDensity <= 0) return 0;
  return clamp((relativeDensity / (relativeDensity + h)) * (1 + h), 0, 1.5);
}

export interface PredatorP95TargetScoreInput {
  encounterScore: number;
  successProbability: number;
  expectedEdibleKg: number;
  mealUtilityCapacityKg: number;
  localPopulation: number;
  localCarryingCapacity: number;
}

/**
 * Expected usable return per encounter, modulated by local density switching.
 * No global population/K knowledge is used.
 */
export function getPredatorP95TargetScore(input: PredatorP95TargetScoreInput): number {
  const encounter = nonNegative(input.encounterScore);
  const success = clamp(input.successProbability, 0, 1);
  const edible = nonNegative(input.expectedEdibleKg);
  const capacity = Math.max(.001, nonNegative(input.mealUtilityCapacityKg));
  const densitySwitch = predatorLocalDensitySwitchFactor(
    input.localPopulation,
    input.localCarryingCapacity,
  );
  return encounter * densitySwitch * success * Math.min(edible, capacity);
}
