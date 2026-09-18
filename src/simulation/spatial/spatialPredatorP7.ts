export interface PredatorEnergyLedger {
  reserveBeforeKg: number;
  reserveCapacityKg: number;
  huntedEdibleKg: number;
  demandKg: number;
  freshConsumedKg: number;
  reserveDrawKg: number;
  reserveGainKg: number;
  coveredDemandKg: number;
  shortfallKg: number;
  reserveAfterKg: number;
  overflowKg: number;
}

const nonNegative = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

/**
 * Diagnostic decomposition of the existing predator reserve equation.
 * Fresh edible biomass is consumed first, reserve covers any remaining demand,
 * and only surplus fresh biomass can refill reserve. This is algebraically
 * equivalent to min(demand, reserve + fresh food) and does not tune balance.
 */
export function calculatePredatorEnergyLedger(
  reserveBeforeInputKg: number,
  reserveCapacityInputKg: number,
  huntedEdibleInputKg: number,
  dailyNeedInputKg: number,
): PredatorEnergyLedger {
  const reserveCapacityKg = nonNegative(reserveCapacityInputKg);
  const reserveBeforeKg = Math.min(reserveCapacityKg, nonNegative(reserveBeforeInputKg));
  const huntedEdibleKg = nonNegative(huntedEdibleInputKg);
  const demandKg = nonNegative(dailyNeedInputKg);
  const freshConsumedKg = Math.min(demandKg, huntedEdibleKg);
  const remainingDemandKg = Math.max(0, demandKg - freshConsumedKg);
  const reserveDrawKg = Math.min(reserveBeforeKg, remainingDemandKg);
  const coveredDemandKg = freshConsumedKg + reserveDrawKg;
  const shortfallKg = Math.max(0, demandKg - coveredDemandKg);
  const reserveAfterDrawKg = reserveBeforeKg - reserveDrawKg;
  const freshSurplusKg = Math.max(0, huntedEdibleKg - freshConsumedKg);
  const reserveGainKg = Math.min(Math.max(0, reserveCapacityKg - reserveAfterDrawKg), freshSurplusKg);
  const reserveAfterKg = reserveAfterDrawKg + reserveGainKg;
  const overflowKg = Math.max(0, freshSurplusKg - reserveGainKg);
  return {
    reserveBeforeKg,
    reserveCapacityKg,
    huntedEdibleKg,
    demandKg,
    freshConsumedKg,
    reserveDrawKg,
    reserveGainKg,
    coveredDemandKg,
    shortfallKg,
    reserveAfterKg,
    overflowKg,
  };
}
