import type {
  SpatialPredatorPatchCohortState,
  SpatialPredatorSpeciesRuntimeState,
} from '../../types/spatialEcologySimulation';
import { getBehaviorPatchesWithinRange, recolonizationReadiness } from './spatialAnimalBehavior';
import type { GeneratedSpatialWorld } from './worldGeneration';

const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const RESERVE = 4;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Recovery must remain stable above MVP before accumulated rescue pressure is cleared. */
export const PREDATOR_RECOVERY_STABILITY_DAYS = 60;
/** Separate from recolonization onset delay: once rescue is active, pulses are never daily. */
export const PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS = 120;

export function predatorCohortPopulation(cohort: SpatialPredatorPatchCohortState): number {
  return Math.max(0, Math.round(cohort[JUVENILES] + cohort[ADULTS] + cohort[OLD]));
}

export function predatorBreederHeads(cohort: SpatialPredatorPatchCohortState): number {
  return Math.max(0, Math.round(cohort[ADULTS] + cohort[OLD]));
}

export function buildPredatorBreederHeadMap(
  cohortsByPatch: Readonly<Record<string, SpatialPredatorPatchCohortState>>,
): Map<string, number> {
  return new Map(
    Object.entries(cohortsByPatch)
      .map(([patchId, cohort]) => [patchId, predatorBreederHeads(cohort)] as const)
      .filter(([, breeders]) => breeders > 0),
  );
}

/**
 * Presence/access decision for mate search. This is intentionally not the fertility curve:
 * one real breeder reachable inside mating range is a mate even if distance weighting would
 * make an aggregate breeder score smaller than two.
 */
export function getPredatorMateAccessScore(
  world: GeneratedSpatialWorld,
  patchId: string,
  matingRangeKm: number,
  breederHeadsByPatch: ReadonlyMap<string, number>,
  excludePatchId?: string,
  excludeCount = 0,
): number {
  let best = 0;
  for (const entry of getBehaviorPatchesWithinRange(world, patchId, matingRangeKm)) {
    let breeders = breederHeadsByPatch.get(entry.patchId) ?? 0;
    if (entry.patchId === excludePatchId) breeders = Math.max(0, breeders - excludeCount);
    if (breeders <= 0) continue;
    const proximity = clamp01(1 - entry.weightedDistanceKm / Math.max(.05, matingRangeKm));
    const access = entry.patchId === patchId ? 1 : .18 + proximity * .82;
    best = Math.max(best, access);
  }
  return best;
}

export function predatorNeedsMateSearch(
  world: GeneratedSpatialWorld,
  sourcePatchId: string,
  matingRangeKm: number,
  breederHeadsByPatch: ReadonlyMap<string, number>,
): boolean {
  if ((breederHeadsByPatch.get(sourcePatchId) ?? 0) <= 0) return false;
  return getPredatorMateAccessScore(
    world,
    sourcePatchId,
    matingRangeKm,
    breederHeadsByPatch,
    sourcePatchId,
    1,
  ) <= 0;
}

export interface PredatorMateSearchAccessChange {
  before: number;
  after: number;
  hasMateAtDestination: boolean;
  improves: boolean;
}

/** Evaluate a one-breeder move after excluding the mover from its source patch. */
export function getPredatorMateSearchAccessChange(
  world: GeneratedSpatialWorld,
  sourcePatchId: string,
  destinationPatchId: string,
  matingRangeKm: number,
  breederHeadsByPatch: ReadonlyMap<string, number>,
): PredatorMateSearchAccessChange {
  const before = getPredatorMateAccessScore(
    world,
    sourcePatchId,
    matingRangeKm,
    breederHeadsByPatch,
    sourcePatchId,
    1,
  );
  const after = getPredatorMateAccessScore(
    world,
    destinationPatchId,
    matingRangeKm,
    breederHeadsByPatch,
    sourcePatchId,
    1,
  );
  return {
    before,
    after,
    hasMateAtDestination: after > 0,
    improves: after > before + 1e-6,
  };
}

export function getPredatorBreedingStatus(
  world: GeneratedSpatialWorld,
  matingRangeKm: number,
  cohortsByPatch: Readonly<Record<string, SpatialPredatorPatchCohortState>>,
): { breedingCapableCohorts: number; isolatedBreeders: number } {
  const breeders = buildPredatorBreederHeadMap(cohortsByPatch);
  let breedingCapableCohorts = 0;
  let isolatedBreeders = 0;
  for (const [patchId, heads] of breeders) {
    const access = getPredatorMateAccessScore(world, patchId, matingRangeKm, breeders, patchId, 1);
    if (access > 0) breedingCapableCohorts += 1;
    else isolatedBreeders += heads;
  }
  return { breedingCapableCohorts, isolatedBreeders };
}

/** Remove a transfer while conserving age classes and proportional energy reserve. */
export function extractPredatorCohortTransfer(
  cohort: SpatialPredatorPatchCohortState,
  requested: number,
  adultFirst: boolean,
): SpatialPredatorPatchCohortState {
  const transfer: SpatialPredatorPatchCohortState = [0, 0, 0, cohort[CONDITION], 0];
  let remaining = Math.min(Math.max(0, requested), predatorCohortPopulation(cohort));
  const order = adultFirst ? [ADULTS, OLD, JUVENILES] as const : [JUVENILES, ADULTS, OLD] as const;
  for (const stage of order) {
    const taken = Math.min(cohort[stage], remaining);
    cohort[stage] -= taken;
    transfer[stage] += taken;
    remaining -= taken;
  }
  const heads = predatorCohortPopulation(transfer);
  if (heads > 0) {
    const sourceHeadsAfter = predatorCohortPopulation(cohort);
    const reserveShare = Math.min(
      cohort[RESERVE],
      Math.max(0, cohort[RESERVE]) * heads / Math.max(1, heads + sourceHeadsAfter),
    );
    cohort[RESERVE] -= reserveShare;
    transfer[RESERVE] = reserveShare;
  }
  return transfer;
}

/** Merge/restore a transfer without creating or destroying age classes or reserve. */
export function mergePredatorCohortTransfer(
  target: SpatialPredatorPatchCohortState,
  transfer: SpatialPredatorPatchCohortState,
): number {
  const moved = predatorCohortPopulation(transfer);
  if (moved <= 0) return 0;
  const existingPopulation = predatorCohortPopulation(target);
  target[JUVENILES] += transfer[JUVENILES];
  target[ADULTS] += transfer[ADULTS];
  target[OLD] += transfer[OLD];
  target[RESERVE] += transfer[RESERVE];
  target[CONDITION] = (
    target[CONDITION] * existingPopulation + transfer[CONDITION] * moved
  ) / Math.max(1, existingPopulation + moved);
  return moved;
}

export interface PredatorRecoveryClock {
  pressure: number;
  eligibleForPulse: boolean;
  stableRecovered: boolean;
}

/** Advance under-MVP pressure independently from immigration pulse cooldown. */
export function advancePredatorRecoveryClock(
  state: SpatialPredatorSpeciesRuntimeState,
  totalPopulation: number,
  minimumViablePopulation: number,
  day: number,
  recolonizationDelayDays: readonly [number, number],
): PredatorRecoveryClock {
  if (totalPopulation < minimumViablePopulation) {
    state.belowMvpDays = (state.belowMvpDays ?? 0) + 1;
    state.recoveredDays = 0;
    state.recoveryPressure = recolonizationReadiness(state.belowMvpDays, recolonizationDelayDays);
  } else {
    state.recoveredDays = (state.recoveredDays ?? 0) + 1;
    if (state.recoveredDays >= PREDATOR_RECOVERY_STABILITY_DAYS) {
      state.belowMvpDays = 0;
      state.recoveryPressure = 0;
    }
  }
  const pressure = state.recoveryPressure ?? 0;
  return {
    pressure,
    eligibleForPulse: totalPopulation < minimumViablePopulation
      && pressure > 0
      && day >= (state.nextEligibleImmigrationDay ?? 0),
    stableRecovered: totalPopulation >= minimumViablePopulation
      && (state.recoveredDays ?? 0) >= PREDATOR_RECOVERY_STABILITY_DAYS,
  };
}

export function registerPredatorImmigrationPulse(
  state: SpatialPredatorSpeciesRuntimeState,
  day: number,
  cooldownDays = PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS,
): void {
  state.lastImmigrationDay = day;
  state.nextEligibleImmigrationDay = day + Math.max(1, Math.floor(cooldownDays));
}
