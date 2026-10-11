export interface PredatorHuntCandidatePlanInput {
  encounterScore: number;
  expectedEdibleKg: number;
  successProbability: number;
}

export interface PredatorHuntPlanInput {
  metabolicHeads: number;
  dailyNeedKg: number;
  reserveBeforeKg: number;
  reserveCapacityKg: number;
  maxKillsPerAdultPerDay: number;
  candidates: readonly PredatorHuntCandidatePlanInput[];
}

export interface PredatorHuntPlan {
  freshFoodTargetKg: number;
  usableEnergyCapacityKg: number;
  expectedEnergyPerAttemptKg: number;
  meanSuccessProbability: number;
  authoredCadenceAttempts: number;
  requiredAttempts: number;
  retryBufferAttempts: number;
  huntLimit: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const nonNegative = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

/**
 * Energy utility is bounded by what the predator can either use today or store.
 * A carcass much larger than the remaining usable capacity is therefore not treated
 * as proportionally more desirable solely because of biomass that would be wasted.
 */
export function getPredatorEnergyWeightedTargetScore(
  encounterScore: number,
  expectedEdibleKg: number,
  usableEnergyCapacityKg = Number.POSITIVE_INFINITY,
): number {
  const encounter = nonNegative(encounterScore);
  const edible = nonNegative(expectedEdibleKg);
  const capacity = Number.isFinite(usableEnergyCapacityKg)
    ? nonNegative(usableEnergyCapacityKg)
    : edible;
  return encounter * Math.min(edible, capacity);
}

/**
 * Preserve intermittent feeding instead of forcing predators to hunt every day.
 * Reserve covers today's demand first; hunting begins only for the uncovered part.
 *
 * The inherited maxKillsPerAdultPerDay value remains an activity cadence rather
 * than becoming a global hard cap across all prey species. When accessible prey are
 * small, a feeding bout may make multiple attempts, but it ends as soon as today's
 * uncovered energy requirement is met.
 */
export function calculatePredatorHuntPlan(input: PredatorHuntPlanInput): PredatorHuntPlan {
  const metabolicHeads = nonNegative(input.metabolicHeads);
  const dailyNeedKg = nonNegative(input.dailyNeedKg);
  const reserveCapacityKg = nonNegative(input.reserveCapacityKg);
  const reserveBeforeKg = Math.min(reserveCapacityKg, nonNegative(input.reserveBeforeKg));
  const freshFoodTargetKg = Math.max(0, dailyNeedKg - reserveBeforeKg);
  const reserveHeadroomKg = Math.max(0, reserveCapacityKg - reserveBeforeKg);
  const usableEnergyCapacityKg = freshFoodTargetKg + reserveHeadroomKg;

  if (freshFoodTargetKg <= 1e-9 || input.candidates.length === 0) {
    return {
      freshFoodTargetKg,
      usableEnergyCapacityKg,
      expectedEnergyPerAttemptKg: 0,
      meanSuccessProbability: 0,
      authoredCadenceAttempts: 0,
      requiredAttempts: 0,
      retryBufferAttempts: 0,
      huntLimit: 0,
    };
  }

  let weightSum = 0;
  let successWeighted = 0;
  let progressWeighted = 0;
  for (const candidate of input.candidates) {
    const weight = getPredatorEnergyWeightedTargetScore(
      candidate.encounterScore,
      candidate.expectedEdibleKg,
      usableEnergyCapacityKg,
    );
    if (weight <= 0) continue;
    const success = clamp01(candidate.successProbability);
    const progressKg = Math.min(nonNegative(candidate.expectedEdibleKg), freshFoodTargetKg);
    weightSum += weight;
    successWeighted += weight * success;
    progressWeighted += weight * success * progressKg;
  }

  if (weightSum <= 0) {
    return {
      freshFoodTargetKg,
      usableEnergyCapacityKg,
      expectedEnergyPerAttemptKg: 0,
      meanSuccessProbability: 0,
      authoredCadenceAttempts: 0,
      requiredAttempts: 0,
      retryBufferAttempts: 0,
      huntLimit: 0,
    };
  }

  const meanSuccessProbability = clamp01(successWeighted / weightSum);
  const expectedEnergyPerAttemptKg = Math.max(0, progressWeighted / weightSum);
  const effectiveSuccess = Math.max(.05, meanSuccessProbability);
  const authoredCadenceAttempts = metabolicHeads * nonNegative(input.maxKillsPerAdultPerDay) / effectiveSuccess;
  const requiredAttempts = freshFoodTargetKg / Math.max(.001, expectedEnergyPerAttemptKg);
  const retryBufferAttempts = 1 / effectiveSuccess;
  const huntLimit = Math.min(
    24,
    Math.max(1, Math.ceil(Math.max(authoredCadenceAttempts, requiredAttempts) + retryBufferAttempts)),
  );

  return {
    freshFoodTargetKg,
    usableEnergyCapacityKg,
    expectedEnergyPerAttemptKg,
    meanSuccessProbability,
    authoredCadenceAttempts,
    requiredAttempts,
    retryBufferAttempts,
    huntLimit,
  };
}
