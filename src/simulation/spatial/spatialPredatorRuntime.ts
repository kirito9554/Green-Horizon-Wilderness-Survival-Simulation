import { SPATIAL_PREDATOR_BY_ID, SPATIAL_PREDATOR_SPECIES, type SpatialPredatorSpeciesDefinition } from '../../data/spatialPredators';
import { SPATIAL_FAUNA_SPECIES_BY_ID } from '../../data/spatialFauna';
import type {
  SpatialPredatorPatchCohortState,
  SpatialPredatorRuntimeState,
  SpatialPredatorSpeciesTelemetry,
  SpatialPredatorTelemetry,
} from '../../types/spatialEcologySimulation';
import type { SpatialFaunaRuntimeState, SpatialFaunaSeason, SpatialFaunaPatchCohortState } from '../../types/spatialFaunaSimulation';
import type { EcologyTargetProfile } from '../../data/ecologyProfiles';
import type { HabitatPatch } from './habitatPatches';
import type { GeneratedSpatialWorld } from './worldGeneration';
import { spatialUnitRandom } from './spatialRandom';
import {
  conditionFertilityFactor,
  densityFertilityFactor,
  deterministicFounderCount,
  distanceAccessFactor,
  estimateReachableBreeders,
  getBehaviorPatchesWithinRange,
  getPredatorBehaviorProfile,
  mateAvailabilityFactor,
  recolonizationReadiness,
  type SpatialAnimalMovementReason,
} from './spatialAnimalBehavior';
import {
  PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS,
  advancePredatorRecoveryClock,
  buildPredatorBreederHeadMap,
  extractPredatorCohortTransfer,
  getPredatorBreedingStatus,
  getPredatorMateAccessScore,
  getPredatorMateSearchAccessChange,
  mergePredatorCohortTransfer,
  predatorBreederHeads,
  predatorCohortPopulation,
  predatorNeedsMateSearch,
  registerPredatorImmigrationPulse,
} from './spatialPredatorP6';

export const SPATIAL_PREDATOR_RUNTIME_VERSION = 7;
const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const RESERVE = 4;
const CARRION_STOCK_INDEX = 7;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

export interface SpatialPredatorRuntimeOptions {
  /** P6: separate mate reachability from the continuous fertility curve and preserve valid breeding units. */
  maintainMateConnectivity?: boolean;
  /** P6: retain under-MVP recovery pressure across pulses and enforce a separate pulse cooldown. */
  controlledRecovery?: boolean;
}

function normalizedOptions(options?: SpatialPredatorRuntimeOptions): Required<SpatialPredatorRuntimeOptions> {
  return {
    maintainMateConnectivity: options?.maintainMateConnectivity ?? true,
    controlledRecovery: options?.controlledRecovery ?? true,
  };
}

function deterministicRound(worldSeed: string, key: string, value: number): number {
  if (value <= 0) return 0;
  const whole = Math.floor(value);
  const fraction = value - whole;
  return whole + (spatialUnitRandom(worldSeed, key) < fraction ? 1 : 0);
}

function patchValue(patch: HabitatPatch, world: GeneratedSpatialWorld, key: keyof EcologyTargetProfile): number | undefined {
  const site = world.localSiteInfluenceByPatchId[patch.id];
  const hydro = world.hydrology.byPatchId[patch.id];
  if (key === 'canopy') return patch.suitability.canopy * 100;
  if (key === 'moisture') return patch.suitability.moisture * 100;
  if (key === 'waterAccess') return clamp01((hydro?.waterIndex ?? patch.suitability.aquatic) * .75 + (site?.water ?? .25) * .25) * 100;
  if (key === 'slope') return patch.terrain.slope * 100;
  if (key === 'floodRisk') return clamp01((hydro?.waterIndex ?? 0) * .72 + patch.terrain.wetness * .28) * 100;
  if (key === 'sunlight') return (1 - patch.suitability.canopy * .82) * 100;
  if (key === 'rocks') return patch.terrain.roughness * 100;
  if (key === 'fertileSoil') return patch.suitability.forage * 100;
  if (key === 'vegetation') return clamp01(patch.suitability.cover * .62 + patch.suitability.canopy * .22 + patch.suitability.forage * .16) * 100;
  return undefined;
}

function predatorSuitability(species: SpatialPredatorSpeciesDefinition, patch: HabitatPatch, world: GeneratedSpatialWorld): number {
  const entries = Object.entries(species.targets) as Array<[keyof EcologyTargetProfile, number]>;
  let score = 0;
  let used = 0;
  for (const [key, target] of entries) {
    const value = patchValue(patch, world, key);
    if (value === undefined) continue;
    const tolerance = key === 'slope' ? Math.max(8, species.tolerance * .55) : Math.max(10, species.tolerance);
    score += Math.max(0, 1 - Math.abs(value - target) / tolerance);
    used += 1;
  }
  const fit = used ? score / used : .5;
  const affinity = species.regionAffinity[patch.parentRegionId] ?? .06;
  const site = world.localSiteInfluenceByPatchId[patch.id];
  return clamp01(fit * .66 + affinity * .25 + (site?.predatorOpportunity ?? .25) * .09);
}

function cohortPopulation(cohort: SpatialPredatorPatchCohortState | SpatialFaunaPatchCohortState): number {
  return Math.max(0, Math.round(cohort[0] + cohort[1] + cohort[2]));
}

function effectivePredatorBreeders(cohort: SpatialPredatorPatchCohortState): number {
  return cohort[ADULTS] + cohort[OLD] * .3;
}

function metabolicPredatorHeads(cohort: SpatialPredatorPatchCohortState): number {
  return cohort[ADULTS] + cohort[OLD] * .9 + cohort[JUVENILES] * .55;
}

function speciesPopulation(cohortsByPatch: Readonly<Record<string, SpatialPredatorPatchCohortState>>): number {
  return Object.values(cohortsByPatch).reduce((sum, cohort) => sum + predatorCohortPopulation(cohort), 0);
}

/** Preserve the P2 intermittent-feeder semantics using the authored kill cadence. */
export function getSpatialPredatorEnergyReserveDays(species: SpatialPredatorSpeciesDefinition): number {
  const expectedKillIntervalDays = 1 / Math.max(.03, species.maxKillsPerAdultPerDay);
  return round3(Math.max(1.75, Math.min(14, expectedKillIntervalDays * .9)));
}

function predatorReserveCapacityKg(cohort: SpatialPredatorPatchCohortState, species: SpatialPredatorSpeciesDefinition): number {
  return Math.max(0, metabolicPredatorHeads(cohort) * species.dailyFoodKgPerAdult * getSpatialPredatorEnergyReserveDays(species));
}

function initializePredatorReserve(cohort: SpatialPredatorPatchCohortState, species: SpatialPredatorSpeciesDefinition, fraction: number): void {
  cohort[RESERVE] = predatorReserveCapacityKg(cohort, species) * clamp01(fraction);
}

function clampPredatorReserve(cohort: SpatialPredatorPatchCohortState, species: SpatialPredatorSpeciesDefinition): number {
  const capacity = predatorReserveCapacityKg(cohort, species);
  cohort[RESERVE] = Math.min(capacity, Math.max(0, cohort[RESERVE]));
  return capacity;
}

export function getSpatialPredatorMinimumFounderUnits(species: SpatialPredatorSpeciesDefinition): number {
  switch (species.socialMode) {
    case 'family_group': return 3;
    case 'breeding_pair': return 2;
    case 'loose_aggregation': return 2;
    case 'solitary_territory': return 3;
  }
}

export function getSpatialPredatorMinimumViablePopulation(species: SpatialPredatorSpeciesDefinition): number {
  return Math.max(species.minIslandCapacity, getSpatialPredatorMinimumFounderUnits(species) * 2);
}

function preferredInitialFounderUnitSize(species: SpatialPredatorSpeciesDefinition): number {
  if (species.socialMode === 'family_group') return 4;
  if (species.socialMode === 'loose_aggregation') return 4;
  return 2;
}

function createInitialFounderCohort(
  species: SpatialPredatorSpeciesDefinition,
  count: number,
  suitability: number,
  reserveFraction: number,
): SpatialPredatorPatchCohortState {
  const extraBeyondPair = Math.max(0, count - 2);
  const juveniles = Math.min(extraBeyondPair, Math.floor(count * .18));
  const old = Math.min(Math.max(0, extraBeyondPair - juveniles), Math.floor(count * .08));
  const adults = Math.max(2, count - juveniles - old);
  const cohort: SpatialPredatorPatchCohortState = [juveniles, adults, old, .82 + suitability * .14, 0];
  initializePredatorReserve(cohort, species, reserveFraction);
  return cohort;
}

export function createSpatialPredatorRuntimeState(world: GeneratedSpatialWorld, day = 1): SpatialPredatorRuntimeState {
  const speciesStates = SPATIAL_PREDATOR_SPECIES.map(def => {
    const cohortsByPatch: Record<string, SpatialPredatorPatchCohortState> = {};
    if (spatialUnitRandom(world.worldSeed, 'predator-presence|' + def.id) <= def.worldPresence) {
      const minimumFounderUnits = getSpatialPredatorMinimumFounderUnits(def);
      const minimumViablePopulation = getSpatialPredatorMinimumViablePopulation(def);
      const candidates: Array<{ patch: HabitatPatch; suitability: number; expectedContribution: number; anchorScore: number }> = [];
      let expectedIslandPopulation = 0;
      for (const patch of world.habitatPatches) {
        const suitability = predatorSuitability(def, patch, world);
        if (suitability < def.minPatchSuitability * .9) continue;
        const occupancy = def.initialOccupancy[0]
          + spatialUnitRandom(world.worldSeed, 'predator-occ|' + def.id + '|' + patch.id) * (def.initialOccupancy[1] - def.initialOccupancy[0]);
        const densityExpectation = patch.areaKm2 * def.densityPerKm2 * Math.pow(suitability, 1.45);
        const expectedContribution = suitability >= def.minPatchSuitability ? densityExpectation * occupancy : 0;
        expectedIslandPopulation += expectedContribution;
        const anchorScore = suitability * .55
          + (1 - Math.exp(-expectedContribution * 4)) * .35
          + spatialUnitRandom(world.worldSeed, 'predator-anchor|' + def.id + '|' + patch.id) * .1;
        candidates.push({ patch, suitability, expectedContribution, anchorScore });
      }
      if (candidates.length > 0) {
        const ecologicalTarget = deterministicRound(world.worldSeed, 'predator-island-target|' + def.id, expectedIslandPopulation);
        const targetPopulation = Math.max(minimumViablePopulation, ecologicalTarget);
        const preferredUnitSize = preferredInitialFounderUnitSize(def);
        const maximumUnitCount = Math.max(1, Math.floor(targetPopulation / 2));
        const desiredUnitCount = Math.min(
          candidates.length,
          maximumUnitCount,
          Math.max(minimumFounderUnits, Math.ceil(targetPopulation / preferredUnitSize)),
        );
        candidates.sort((a, b) => b.anchorScore - a.anchorScore || b.expectedContribution - a.expectedContribution || a.patch.id.localeCompare(b.patch.id));
        const unitSizes = Array.from({ length: desiredUnitCount }, () => 2);
        let remaining = targetPopulation - desiredUnitCount * 2;
        for (let cursor = 0; remaining > 0; cursor += 1) {
          unitSizes[cursor % desiredUnitCount] += 1;
          remaining -= 1;
        }
        for (let index = 0; index < desiredUnitCount; index += 1) {
          const anchor = candidates[index];
          const count = unitSizes[index];
          const reserveFraction = .52 + spatialUnitRandom(world.worldSeed, 'predator-reserve|' + def.id + '|' + anchor.patch.id) * .18;
          cohortsByPatch[anchor.patch.id] = createInitialFounderCohort(def, count, anchor.suitability, reserveFraction);
        }
      }
    }
    return {
      speciesId: def.id,
      cohortsByPatch,
      globalAbsenceDays: 0,
      belowMvpDays: 0,
      recoveryPressure: 0,
      recoveredDays: 0,
      nextEligibleImmigrationDay: day,
    };
  });
  const runtime: SpatialPredatorRuntimeState = {
    version: SPATIAL_PREDATOR_RUNTIME_VERSION,
    worldSeed: world.worldSeed,
    lastProcessedDay: day,
    species: speciesStates,
    telemetry: {
      day, season: 'dry', totalPopulation: 0, presentSpecies: 0, occupiedCohorts: 0,
      preyKilled: 0, preyBiomassKilledKg: 0, carrionAddedKg: 0, births: 0, deaths: 0,
      hungerDeaths: 0, naturalDeaths: 0, matured: 0, aged: 0, moved: 0,
      mateSearchMoved: 0, mateSearchProposed: 0, mateSearchExecuted: 0, mateSearchBlocked: 0,
      natalDispersed: 0, territorySettled: 0, groupSplitMoved: 0, immigrants: 0, immigrationPulses: 0,
      meanCondition: 0, unsuccessfulHunts: 0, bySpecies: {},
    },
  };
  runtime.telemetry = summarizePredators(runtime, world, day, 'dry');
  return runtime;
}

interface PreyCandidate {
  speciesId: string;
  patchId: string;
  cohort: SpatialFaunaPatchCohortState;
  score: number;
  adultWeightKg: number;
}

function preyCandidates(
  predator: SpatialPredatorSpeciesDefinition,
  startPatchId: string,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
): PreyCandidate[] {
  const accessible = getBehaviorPatchesWithinRange(world, startPatchId, predator.homeRangeKm);
  const distanceByPatch = new Map(accessible.map(entry => [entry.patchId, entry.distanceKm]));
  const result: PreyCandidate[] = [];
  for (const preyState of fauna.species) {
    const preyDef = SPATIAL_FAUNA_SPECIES_BY_ID[preyState.speciesId];
    const preference = predator.preyWeights[preyState.speciesId] ?? 0;
    if (!preyDef || preference <= 0) continue;
    for (const [patchId, cohort] of Object.entries(preyState.cohortsByPatch)) {
      const distanceKm = distanceByPatch.get(patchId);
      if (distanceKm === undefined) continue;
      const population = cohortPopulation(cohort);
      if (population <= 0) continue;
      const juvenileShare = population > 0 ? cohort[0] / population : 0;
      const preyMass = preyDef.adultWeightKg * (1 - juvenileShare * .35);
      if (preyMass > predator.maxAdultPreyKg * 1.3) continue;
      const sizeFit = preyMass <= predator.maxAdultPreyKg ? 1 : .22;
      const distanceFit = 1 / (1 + distanceKm * .75);
      const refuge = world.localSiteInfluenceByPatchId[patchId]?.preyRefuge ?? .25;
      const encounter = world.localSiteInfluenceByPatchId[patchId]?.predatorOpportunity ?? .25;
      const score = population * preference * sizeFit * distanceFit * (.78 + encounter * .38) * (1 - refuge * .32);
      if (score > 0) result.push({ speciesId: preyDef.id, patchId, cohort, score, adultWeightKg: preyDef.adultWeightKg });
    }
  }
  return result.sort((a, b) => b.score - a.score);
}

function removeOnePrey(candidate: PreyCandidate, predator: SpatialPredatorSpeciesDefinition, random: number): { biomassKg: number; killed: boolean } {
  const cohort = candidate.cohort;
  const population = cohortPopulation(cohort);
  if (population <= 0) return { biomassKg: 0, killed: false };
  const juvenileWeight = cohort[0] * (1 + predator.juvenilePreference);
  const adultWeight = cohort[1];
  const oldWeight = cohort[2] * .9;
  const total = juvenileWeight + adultWeight + oldWeight;
  let stage = ADULTS;
  if (total > 0) {
    const roll = random * total;
    if (roll < juvenileWeight && cohort[JUVENILES] > 0) stage = JUVENILES;
    else if (roll < juvenileWeight + adultWeight && cohort[ADULTS] > 0) stage = ADULTS;
    else if (cohort[OLD] > 0) stage = OLD;
    else if (cohort[ADULTS] > 0) stage = ADULTS;
    else stage = JUVENILES;
  }
  if (cohort[stage] <= 0) return { biomassKg: 0, killed: false };
  cohort[stage] -= 1;
  const massFactor = stage === JUVENILES ? .48 : stage === OLD ? .88 : 1;
  return { biomassKg: candidate.adultWeightKg * massFactor, killed: true };
}

function addCarrion(fauna: SpatialFaunaRuntimeState, patchId: string, kg: number): number {
  const stock = fauna.resourceStocksByPatch?.[patchId];
  if (!stock || kg <= 0) return 0;
  stock[CARRION_STOCK_INDEX] = Math.max(0, (stock[CARRION_STOCK_INDEX] ?? 0) + kg);
  return kg;
}

function localPredatorPressure(
  predator: SpatialPredatorSpeciesDefinition,
  cohortsByPatch: Readonly<Record<string, SpatialPredatorPatchCohortState>>,
  patchId: string,
  world: GeneratedSpatialWorld,
): { population: number; capacity: number } {
  let population = 0;
  let capacity = 0;
  for (const entry of getBehaviorPatchesWithinRange(world, patchId, predator.homeRangeKm)) {
    const patch = world.routeGraph.patchesById[entry.patchId];
    if (!patch) continue;
    population += predatorCohortPopulation(cohortsByPatch[entry.patchId] ?? [0, 0, 0, 0, 0]);
    const suitability = predatorSuitability(predator, patch, world);
    if (suitability >= predator.minPatchSuitability * .8) {
      capacity += patch.areaKm2 * predator.densityPerKm2 * Math.pow(suitability, 1.35);
    }
  }
  return { population, capacity: Math.max(1, capacity) };
}

interface PredatorMove {
  from: string;
  to: string;
  cohort: SpatialPredatorPatchCohortState;
  reason: SpatialAnimalMovementReason;
}

function settlementScore(
  predator: SpatialPredatorSpeciesDefinition,
  patchId: string,
  sourcePatchId: string,
  speciesCohorts: Readonly<Record<string, SpatialPredatorPatchCohortState>>,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  rangeKm: number,
): number {
  const patch = world.routeGraph.patchesById[patchId];
  if (!patch) return -Infinity;
  const suitability = predatorSuitability(predator, patch, world);
  if (suitability < predator.minPatchSuitability * .82) return -Infinity;
  const entry = getBehaviorPatchesWithinRange(world, sourcePatchId, rangeKm).find(item => item.patchId === patchId);
  if (!entry) return -Infinity;
  const preyScore = preyCandidates(predator, patchId, fauna, world).reduce((sum, candidate) => sum + candidate.score, 0);
  const prey = 1 - Math.exp(-preyScore / 45);
  const local = localPredatorPressure(predator, speciesCohorts, patchId, world);
  const freeTerritory = clamp01(1 - local.population / Math.max(1, local.capacity));
  return suitability * .46 + prey * .3 + freeTerritory * .18 + distanceAccessFactor(entry.weightedDistanceKm, rangeKm) * .06;
}

function chooseSettlementPatch(
  predator: SpatialPredatorSpeciesDefinition,
  sourcePatchId: string,
  speciesCohorts: Readonly<Record<string, SpatialPredatorPatchCohortState>>,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  rangeKm: number,
  breederSnapshot?: ReadonlyMap<string, number>,
): string | undefined {
  let bestPatchId: string | undefined;
  let bestScore = -Infinity;
  let otherBreeders: ReadonlyMap<string, number> | undefined;
  if (breederSnapshot) {
    const adjusted = new Map(breederSnapshot);
    adjusted.set(sourcePatchId, Math.max(0, (adjusted.get(sourcePatchId) ?? 0) - 1));
    otherBreeders = adjusted;
  }
  for (const entry of getBehaviorPatchesWithinRange(world, sourcePatchId, rangeKm)) {
    if (entry.patchId === sourcePatchId) continue;
    let score = settlementScore(predator, entry.patchId, sourcePatchId, speciesCohorts, fauna, world, rangeKm);
    if (otherBreeders) {
      const reachableOthers = estimateReachableBreeders(world, entry.patchId, predator.matingRangeKm, otherBreeders);
      score += mateAvailabilityFactor(reachableOthers + 1) * .32;
    }
    if (score > bestScore) { bestScore = score; bestPatchId = entry.patchId; }
  }
  return bestScore > .28 ? bestPatchId : undefined;
}

function chooseMateSearchPatch(
  predator: SpatialPredatorSpeciesDefinition,
  sourcePatchId: string,
  speciesCohorts: Readonly<Record<string, SpatialPredatorPatchCohortState>>,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  rangeKm: number,
): string | undefined {
  const breeders = buildPredatorBreederHeadMap(speciesCohorts);
  let bestPatchId: string | undefined;
  let bestScore = -Infinity;
  for (const entry of getBehaviorPatchesWithinRange(world, sourcePatchId, rangeKm)) {
    if (entry.patchId === sourcePatchId) continue;
    const access = getPredatorMateSearchAccessChange(world, sourcePatchId, entry.patchId, predator.matingRangeKm, breeders);
    if (!access.hasMateAtDestination || !access.improves) continue;
    const habitat = settlementScore(predator, entry.patchId, sourcePatchId, speciesCohorts, fauna, world, rangeKm);
    if (!Number.isFinite(habitat)) continue;
    const score = habitat + access.after * .34;
    if (score > bestScore || (score === bestScore && entry.patchId.localeCompare(bestPatchId ?? '') < 0)) {
      bestScore = score;
      bestPatchId = entry.patchId;
    }
  }
  return bestPatchId;
}

function applyPredatorMove(
  speciesCohorts: Record<string, SpatialPredatorPatchCohortState>,
  move: PredatorMove,
): number {
  const moved = predatorCohortPopulation(move.cohort);
  if (moved <= 0) return 0;
  const existing = speciesCohorts[move.to];
  if (existing) mergePredatorCohortTransfer(existing, move.cohort);
  else speciesCohorts[move.to] = move.cohort;
  return moved;
}

function restorePredatorMove(
  speciesCohorts: Record<string, SpatialPredatorPatchCohortState>,
  move: PredatorMove,
): void {
  const source = speciesCohorts[move.from];
  if (source) mergePredatorCohortTransfer(source, move.cohort);
  else speciesCohorts[move.from] = move.cohort;
}

function removePredatorDeaths(
  cohort: SpatialPredatorPatchCohortState,
  count: number,
  order: readonly [typeof OLD | typeof JUVENILES | typeof ADULTS, typeof OLD | typeof JUVENILES | typeof ADULTS, typeof OLD | typeof JUVENILES | typeof ADULTS],
): { juveniles: number; adults: number; old: number } {
  let left = count;
  const removed = { juveniles: 0, adults: 0, old: 0 };
  for (const stage of order) {
    const taken = Math.min(cohort[stage], left);
    cohort[stage] -= taken;
    if (stage === JUVENILES) removed.juveniles += taken;
    else if (stage === ADULTS) removed.adults += taken;
    else removed.old += taken;
    left -= taken;
  }
  return removed;
}

function blankSpeciesTelemetry(speciesId: string, startPopulation: number): SpatialPredatorSpeciesTelemetry {
  return {
    speciesId,
    startPopulation,
    endPopulation: startPopulation,
    juveniles: 0,
    adults: 0,
    old: 0,
    births: 0,
    immigrants: 0,
    deaths: 0,
    hungerDeaths: 0,
    naturalDeaths: 0,
    deathJuveniles: 0,
    deathAdults: 0,
    deathOld: 0,
    matured: 0,
    aged: 0,
    preyKilled: 0,
    predatorDays: 0,
    foodCoveragePredatorDays: 0,
    reserveFillPredatorDays: 0,
    breedingCapableCohorts: 0,
    isolatedBreeders: 0,
    mateSearchProposed: 0,
    mateSearchExecuted: 0,
    mateSearchBlocked: 0,
    mateAccessBeforeSum: 0,
    mateAccessAfterSum: 0,
    belowMvpDays: 0,
    recoveryPressure: 0,
    recoveredDays: 0,
    immigrationPulses: 0,
    extinctionEvents: 0,
    recolonizationEvents: 0,
    globalAbsenceDays: 0,
  };
}

function maybeRecolonizePredator(
  speciesState: SpatialPredatorRuntimeState['species'][number],
  predator: SpatialPredatorSpeciesDefinition,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
  controlledRecovery: boolean,
): { count: number; pulse: boolean } {
  const total = speciesPopulation(speciesState.cohortsByPatch);
  const minimumViable = getSpatialPredatorMinimumViablePopulation(predator);
  const profile = getPredatorBehaviorProfile(predator);
  let readiness = 0;
  if (controlledRecovery) {
    const clock = advancePredatorRecoveryClock(speciesState, total, minimumViable, day, profile.recolonizationDelayDays);
    readiness = clock.pressure;
    if (!clock.eligibleForPulse) return { count: 0, pulse: false };
  } else {
    if (total >= minimumViable) {
      speciesState.belowMvpDays = 0;
      speciesState.recoveryPressure = 0;
      return { count: 0, pulse: false };
    }
    speciesState.belowMvpDays = (speciesState.belowMvpDays ?? 0) + 1;
    readiness = recolonizationReadiness(speciesState.belowMvpDays, profile.recolonizationDelayDays);
    speciesState.recoveryPressure = readiness;
    if (readiness <= 0) return { count: 0, pulse: false };
  }
  const opportunity = readiness >= 1
    || spatialUnitRandom(world.worldSeed, `predator-immigration-opportunity|${predator.id}|${day}`) < readiness * .018;
  if (!opportunity) return { count: 0, pulse: false };

  const breeders = buildPredatorBreederHeadMap(speciesState.cohortsByPatch);
  let best: { patchId: string; score: number } | undefined;
  for (const patch of world.habitatPatches) {
    const suitability = predatorSuitability(predator, patch, world);
    if (suitability < predator.minPatchSuitability) continue;
    const preyScore = preyCandidates(predator, patch.id, fauna, world).reduce((sum, candidate) => sum + candidate.score, 0);
    if (preyScore <= 0) continue;
    const edgeSignal = 1 / Math.max(2, (world.routeGraph.edgesByPatchId[patch.id]?.length ?? 0) + 1);
    let score = suitability * .58 + (1 - Math.exp(-preyScore / 40)) * .32 + edgeSignal * .1;
    if (controlledRecovery) {
      const local = localPredatorPressure(predator, speciesState.cohortsByPatch, patch.id, world);
      const capacityHeadroom = clamp01(1 - local.population / Math.max(1, local.capacity));
      const mateConnection = getPredatorMateAccessScore(world, patch.id, predator.matingRangeKm, breeders);
      score = suitability * .4 + (1 - Math.exp(-preyScore / 40)) * .25 + capacityHeadroom * .2 + mateConnection * .15;
    }
    if (!best || score > best.score || (score === best.score && patch.id.localeCompare(best.patchId) < 0)) best = { patchId: patch.id, score };
  }
  if (!best) return { count: 0, pulse: false };
  const founders = Math.max(2, deterministicFounderCount(
    spatialUnitRandom(world.worldSeed, 'predator-immigration-count|' + predator.id + '|' + day),
    profile.recolonizationFounderCount,
  ));
  const needed = Math.max(2, minimumViable - total);
  const count = Math.min(founders, needed);
  const existing = speciesState.cohortsByPatch[best.patchId];
  if (existing) {
    existing[ADULTS] += count;
    existing[CONDITION] = Math.max(existing[CONDITION], .78);
    clampPredatorReserve(existing, predator);
    existing[RESERVE] = Math.max(existing[RESERVE], predatorReserveCapacityKg(existing, predator) * .62);
  } else {
    const cohort: SpatialPredatorPatchCohortState = [0, count, 0, .8, 0];
    initializePredatorReserve(cohort, predator, .62);
    speciesState.cohortsByPatch[best.patchId] = cohort;
  }
  if (controlledRecovery) {
    registerPredatorImmigrationPulse(speciesState, day, PREDATOR_IMMIGRATION_PULSE_COOLDOWN_DAYS);
  } else {
    speciesState.lastImmigrationDay = day;
    speciesState.belowMvpDays = 0;
    speciesState.recoveryPressure = 0;
  }
  return { count, pulse: true };
}

export function tickSpatialPredatorsDay(
  predators: SpatialPredatorRuntimeState,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
  season: SpatialFaunaSeason,
  options?: SpatialPredatorRuntimeOptions,
): SpatialPredatorTelemetry {
  const behavior = normalizedOptions(options);
  let preyKilled = 0;
  let preyBiomassKilledKg = 0;
  let carrionAddedKg = 0;
  let births = 0;
  let deaths = 0;
  let hungerDeaths = 0;
  let naturalDeaths = 0;
  let matured = 0;
  let aged = 0;
  let moved = 0;
  let mateSearchMoved = 0;
  let mateSearchProposed = 0;
  let mateSearchExecuted = 0;
  let mateSearchBlocked = 0;
  let natalDispersed = 0;
  let territorySettled = 0;
  let groupSplitMoved = 0;
  let immigrants = 0;
  let immigrationPulses = 0;
  let unsuccessfulHunts = 0;
  const bySpecies: Record<string, SpatialPredatorSpeciesTelemetry> = {};

  for (const speciesState of predators.species) {
    const predator = SPATIAL_PREDATOR_BY_ID[speciesState.speciesId];
    if (!predator) continue;
    const startPopulation = speciesPopulation(speciesState.cohortsByPatch);
    const speciesEvent = blankSpeciesTelemetry(predator.id, startPopulation);
    bySpecies[predator.id] = speciesEvent;
    const profile = getPredatorBehaviorProfile(predator);
    const breederSnapshotByPatch = new Map(
      Object.entries(speciesState.cohortsByPatch).map(([patchId, cohort]) => [patchId, effectivePredatorBreeders(cohort)] as const),
    );
    const moves: PredatorMove[] = [];
    const patchIds = Object.keys(speciesState.cohortsByPatch).sort();

    for (const patchId of patchIds) {
      const cohort = speciesState.cohortsByPatch[patchId];
      if (!cohort) continue;
      let population = predatorCohortPopulation(cohort);
      if (population <= 0) continue;
      const metabolicHeads = metabolicPredatorHeads(cohort);
      const dailyNeed = metabolicHeads * predator.dailyFoodKgPerAdult;
      const reserveCapacity = clampPredatorReserve(cohort, predator);
      const reserveBefore = cohort[RESERVE];
      const candidates = preyCandidates(predator, patchId, fauna, world);
      let huntIndex = 0;
      let huntedEdibleKg = 0;
      let lastKillPatchId: string | undefined;
      const expectedAttempts = metabolicHeads * predator.maxKillsPerAdultPerDay / Math.max(.12, predator.huntSuccessBase);
      const huntLimit = Math.min(24, deterministicRound(
        world.worldSeed,
        `predator-hunt-opportunities|${predator.id}|${patchId}|${day}`,
        expectedAttempts,
      ));
      while (huntedEdibleKg < dailyNeed * 1.05 && huntIndex < huntLimit && candidates.length) {
        const totalScore = candidates.reduce((sum, entry) => sum + entry.score, 0);
        let roll = spatialUnitRandom(world.worldSeed, `predator-target|${predator.id}|${patchId}|${day}|${huntIndex}`) * totalScore;
        let candidate = candidates[0];
        for (const entry of candidates) { roll -= entry.score; if (roll <= 0) { candidate = entry; break; } }
        const preyPopulation = cohortPopulation(candidate.cohort);
        if (preyPopulation <= 0) { huntIndex += 1; continue; }
        const encounterDensity = clamp01(Math.log1p(preyPopulation) / Math.log(80));
        const predatorOpportunity = world.localSiteInfluenceByPatchId[candidate.patchId]?.predatorOpportunity ?? .25;
        const refuge = world.localSiteInfluenceByPatchId[candidate.patchId]?.preyRefuge ?? .25;
        const success = clamp01(predator.huntSuccessBase * (.55 + encounterDensity * .75) * (.7 + cohort[CONDITION] * .3) * (1 + predatorOpportunity * .22) * (1 - refuge * .28));
        const successRoll = spatialUnitRandom(world.worldSeed, `predator-hunt|${predator.id}|${patchId}|${day}|${huntIndex}`);
        if (successRoll <= success) {
          const removed = removeOnePrey(candidate, predator, spatialUnitRandom(world.worldSeed, `predator-stage|${predator.id}|${candidate.speciesId}|${candidate.patchId}|${day}|${huntIndex}`));
          if (removed.killed) {
            const edible = removed.biomassKg * .62;
            huntedEdibleKg += edible;
            lastKillPatchId = candidate.patchId;
            carrionAddedKg += addCarrion(fauna, candidate.patchId, removed.biomassKg - edible);
            preyKilled += 1;
            speciesEvent.preyKilled += 1;
            preyBiomassKilledKg += removed.biomassKg;
          }
        } else unsuccessfulHunts += 1;
        huntIndex += 1;
      }

      const availableEnergyKg = reserveBefore + huntedEdibleKg;
      const coveredEnergyKg = Math.min(dailyNeed, availableEnergyKg);
      const shortfall = Math.max(0, dailyNeed - coveredEnergyKg);
      const reserveAfterDemand = Math.min(reserveCapacity, Math.max(0, availableEnergyKg - coveredEnergyKg));
      const edibleOverflowKg = Math.max(0, availableEnergyKg - coveredEnergyKg - reserveAfterDemand);
      cohort[RESERVE] = reserveAfterDemand;
      if (edibleOverflowKg > 0 && lastKillPatchId) carrionAddedKg += addCarrion(fauna, lastKillPatchId, edibleOverflowKg);

      const foodRatio = dailyNeed > 0 ? clamp01(coveredEnergyKg / dailyNeed) : 1;
      speciesEvent.predatorDays += population;
      speciesEvent.foodCoveragePredatorDays += foodRatio * population;
      speciesEvent.reserveFillPredatorDays += (reserveCapacity > 0 ? clamp01(reserveAfterDemand / reserveCapacity) : 1) * population;
      cohort[CONDITION] = clamp01(cohort[CONDITION] + (foodRatio - .72) * .045);
      if (shortfall > dailyNeed * .45) {
        const hungerRate = .0008 + (1 - foodRatio) * .004;
        const count = Math.min(
          population,
          deterministicRound(world.worldSeed, `predator-hunger-death|${predator.id}|${patchId}|${day}`, population * hungerRate),
        );
        const removed = removePredatorDeaths(cohort, count, [OLD, JUVENILES, ADULTS]);
        deaths += count;
        hungerDeaths += count;
        speciesEvent.deaths += count;
        speciesEvent.hungerDeaths += count;
        speciesEvent.deathJuveniles += removed.juveniles;
        speciesEvent.deathAdults += removed.adults;
        speciesEvent.deathOld += removed.old;
      }
      const remainingPopulation = predatorCohortPopulation(cohort);
      const naturalRate = .00015 + (1 - cohort[CONDITION]) * .0007;
      const naturalCount = Math.min(
        remainingPopulation,
        deterministicRound(world.worldSeed, `predator-natural-death|${predator.id}|${patchId}|${day}`, remainingPopulation * naturalRate),
      );
      if (naturalCount > 0) {
        const removed = removePredatorDeaths(cohort, naturalCount, [OLD, ADULTS, JUVENILES]);
        deaths += naturalCount;
        naturalDeaths += naturalCount;
        speciesEvent.deaths += naturalCount;
        speciesEvent.naturalDeaths += naturalCount;
        speciesEvent.deathJuveniles += removed.juveniles;
        speciesEvent.deathAdults += removed.adults;
        speciesEvent.deathOld += removed.old;
      }

      population = predatorCohortPopulation(cohort);
      if (population <= 0) continue;
      clampPredatorReserve(cohort, predator);
      const localBreeders = estimateReachableBreeders(world, patchId, profile.matingRangeKm, breederSnapshotByPatch);
      const mateFactor = mateAvailabilityFactor(localBreeders);
      const localPressure = localPredatorPressure(predator, speciesState.cohortsByPatch, patchId, world);
      const crowdingPopulation = Math.max(0, localPressure.population - 2);
      const densityFactor = densityFertilityFactor(crowdingPopulation / localPressure.capacity);
      const conditionFactor = conditionFertilityFactor(cohort[CONDITION]);
      if (cohort[ADULTS] > 0 && mateFactor > 0) {
        const expected = cohort[ADULTS] * .5 * predator.offspringPerAdultFemalePerYear / 365
          * mateFactor * conditionFactor * densityFactor;
        const born = deterministicRound(world.worldSeed, `predator-birth|${predator.id}|${patchId}|${day}`, expected);
        cohort[JUVENILES] += born;
        births += born;
        speciesEvent.births += born;
      }

      const mature = Math.min(
        cohort[JUVENILES],
        deterministicRound(world.worldSeed, `predator-mature|${predator.id}|${patchId}|${day}`, cohort[JUVENILES] / Math.max(60, predator.maturityDays)),
      );
      cohort[JUVENILES] -= mature;
      cohort[ADULTS] += mature;
      matured += mature;
      speciesEvent.matured += mature;
      const aging = Math.min(
        cohort[ADULTS],
        deterministicRound(world.worldSeed, `predator-aging|${predator.id}|${patchId}|${day}`, cohort[ADULTS] / Math.max(365, predator.maxAgeDays * .55)),
      );
      cohort[ADULTS] -= aging;
      cohort[OLD] += aging;
      aged += aging;
      speciesEvent.aged += aging;
      clampPredatorReserve(cohort, predator);

      let move: PredatorMove | undefined;
      if (mature > 0 && cohort[ADULTS] > 0) {
        const disperse = Math.min(cohort[ADULTS], deterministicRound(world.worldSeed, `predator-natal-dispersal|${predator.id}|${patchId}|${day}`, mature * profile.natalDispersalFraction));
        const destination = disperse > 0
          ? chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.dispersalRangeKm)
          : undefined;
        if (destination) {
          const transfer = extractPredatorCohortTransfer(cohort, disperse, true);
          if (predatorCohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'natal_dispersal' };
        }
      }

      if (!move && predatorBreederHeads(cohort) > 0) {
        if (behavior.maintainMateConnectivity) {
          const liveBreeders = buildPredatorBreederHeadMap(speciesState.cohortsByPatch);
          if (predatorNeedsMateSearch(world, patchId, predator.matingRangeKm, liveBreeders)) {
            const searches = spatialUnitRandom(world.worldSeed, `predator-mate-search|${predator.id}|${patchId}|${day}`) < profile.mateSearchRatePerDay;
            if (searches) {
              mateSearchProposed += 1;
              speciesEvent.mateSearchProposed += 1;
              const destination = chooseMateSearchPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.dispersalRangeKm);
              if (destination) {
                const transfer = extractPredatorCohortTransfer(cohort, 1, true);
                if (predatorCohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'mate_search' };
                else {
                  mateSearchBlocked += 1;
                  speciesEvent.mateSearchBlocked += 1;
                }
              } else {
                mateSearchBlocked += 1;
                speciesEvent.mateSearchBlocked += 1;
              }
            }
          }
        } else if (mateFactor < .58 && effectivePredatorBreeders(cohort) > 0) {
          const searchProbability = profile.mateSearchRatePerDay * (1 - mateFactor);
          const searches = spatialUnitRandom(world.worldSeed, `predator-mate-search|${predator.id}|${patchId}|${day}`) < searchProbability;
          if (searches) {
            mateSearchProposed += 1;
            speciesEvent.mateSearchProposed += 1;
            const destination = chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.dispersalRangeKm, breederSnapshotByPatch);
            if (destination && cohort[ADULTS] + cohort[OLD] > 0) {
              const transfer = extractPredatorCohortTransfer(cohort, 1, true);
              if (predatorCohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'mate_search' };
            } else {
              mateSearchBlocked += 1;
              speciesEvent.mateSearchBlocked += 1;
            }
          }
        }
      }

      const currentPopulation = predatorCohortPopulation(cohort);
      if (!move && currentPopulation > profile.groupTargetSize * profile.groupSplitRatio) {
        const requested = Math.max(1, Math.floor((currentPopulation - profile.groupTargetSize) * .35));
        const destination = chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.dispersalRangeKm);
        if (destination) {
          const transfer = extractPredatorCohortTransfer(cohort, requested, false);
          if (predatorCohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'group_split' };
        }
      }

      if (!move && (foodRatio < .62 || cohort[CONDITION] < .55) && predatorCohortPopulation(cohort) > 0) {
        const destination = chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, Math.min(profile.foragingRangeKm, 1.8));
        if (destination) {
          let migrants = Math.max(1, Math.floor(predatorCohortPopulation(cohort) * .12));
          let adultFirst = false;
          if (behavior.maintainMateConnectivity && predator.socialMode === 'breeding_pair' && predatorBreederHeads(cohort) === 2) {
            migrants = Math.max(2, migrants);
            adultFirst = true;
          }
          const transfer = extractPredatorCohortTransfer(cohort, migrants, adultFirst);
          if (predatorCohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'resource' };
        }
      }

      if (move) moves.push(move);
    }

    for (const move of moves) {
      if (behavior.maintainMateConnectivity && move.reason === 'mate_search') {
        const liveBreeders = buildPredatorBreederHeadMap(speciesState.cohortsByPatch);
        const before = getPredatorMateAccessScore(world, move.from, predator.matingRangeKm, liveBreeders);
        const after = getPredatorMateAccessScore(world, move.to, predator.matingRangeKm, liveBreeders);
        speciesEvent.mateAccessBeforeSum += before;
        speciesEvent.mateAccessAfterSum += after;
        if (after <= 0 || after <= before + 1e-6) {
          restorePredatorMove(speciesState.cohortsByPatch, move);
          mateSearchBlocked += 1;
          speciesEvent.mateSearchBlocked += 1;
          continue;
        }
      }
      const count = applyPredatorMove(speciesState.cohortsByPatch, move);
      moved += count;
      if (move.reason === 'mate_search') {
        mateSearchMoved += count;
        mateSearchExecuted += count > 0 ? 1 : 0;
        speciesEvent.mateSearchExecuted += count > 0 ? 1 : 0;
      } else if (move.reason === 'natal_dispersal') {
        natalDispersed += count;
        territorySettled += count;
      } else if (move.reason === 'group_split') {
        groupSplitMoved += count;
        territorySettled += count;
      } else if (move.reason === 'territory_settlement') territorySettled += count;
    }
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      if (predatorCohortPopulation(cohort) <= 0) delete speciesState.cohortsByPatch[patchId];
    }

    const preImmigrationPopulation = speciesPopulation(speciesState.cohortsByPatch);
    const wasAbsent = (speciesState.globalAbsenceDays ?? 0) > 0;
    if (preImmigrationPopulation <= 0) {
      if (startPopulation > 0 && !wasAbsent) {
        speciesState.lastExtinctionDay = day;
        speciesEvent.extinctionEvents += 1;
      }
      speciesState.globalAbsenceDays = (speciesState.globalAbsenceDays ?? 0) + 1;
    } else speciesState.globalAbsenceDays = 0;

    const immigration = maybeRecolonizePredator(speciesState, predator, fauna, world, day, behavior.controlledRecovery);
    immigrants += immigration.count;
    speciesEvent.immigrants += immigration.count;
    if (immigration.pulse) {
      immigrationPulses += 1;
      speciesEvent.immigrationPulses += 1;
    }
    if (preImmigrationPopulation <= 0 && immigration.count > 0) {
      speciesState.lastRecolonizationDay = day;
      speciesState.globalAbsenceDays = 0;
      speciesEvent.recolonizationEvents += 1;
    }
  }

  predators.lastProcessedDay = day;
  predators.telemetry = summarizePredators(predators, world, day, season, {
    preyKilled, preyBiomassKilledKg, carrionAddedKg, births, deaths, hungerDeaths, naturalDeaths,
    matured, aged, moved, mateSearchMoved, mateSearchProposed, mateSearchExecuted, mateSearchBlocked,
    natalDispersed, territorySettled, groupSplitMoved, immigrants, immigrationPulses, unsuccessfulHunts,
  }, bySpecies);
  return predators.telemetry;
}

function summarizePredators(
  runtime: SpatialPredatorRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
  season: SpatialFaunaSeason,
  event: Partial<SpatialPredatorTelemetry> = {},
  speciesEvents: Record<string, SpatialPredatorSpeciesTelemetry> = {},
): SpatialPredatorTelemetry {
  let totalPopulation = 0;
  let presentSpecies = 0;
  let occupiedCohorts = 0;
  let conditionWeighted = 0;
  const bySpecies: Record<string, SpatialPredatorSpeciesTelemetry> = {};
  for (const speciesState of runtime.species) {
    const predator = SPATIAL_PREDATOR_BY_ID[speciesState.speciesId];
    if (!predator) continue;
    const speciesEvent = speciesEvents[speciesState.speciesId]
      ?? blankSpeciesTelemetry(speciesState.speciesId, speciesPopulation(speciesState.cohortsByPatch));
    let speciesPopulationTotal = 0;
    let juveniles = 0;
    let adults = 0;
    let old = 0;
    for (const cohort of Object.values(speciesState.cohortsByPatch)) {
      const pop = predatorCohortPopulation(cohort);
      juveniles += cohort[JUVENILES];
      adults += cohort[ADULTS];
      old += cohort[OLD];
      speciesPopulationTotal += pop;
      totalPopulation += pop;
      conditionWeighted += pop * cohort[CONDITION];
      if (pop > 0) occupiedCohorts += 1;
    }
    if (speciesPopulationTotal > 0) presentSpecies += 1;
    const breeding = getPredatorBreedingStatus(world, predator.matingRangeKm, speciesState.cohortsByPatch);
    speciesEvent.endPopulation = speciesPopulationTotal;
    speciesEvent.juveniles = juveniles;
    speciesEvent.adults = adults;
    speciesEvent.old = old;
    speciesEvent.breedingCapableCohorts = breeding.breedingCapableCohorts;
    speciesEvent.isolatedBreeders = breeding.isolatedBreeders;
    speciesEvent.belowMvpDays = speciesState.belowMvpDays ?? 0;
    speciesEvent.recoveryPressure = speciesState.recoveryPressure ?? 0;
    speciesEvent.recoveredDays = speciesState.recoveredDays ?? 0;
    speciesEvent.nextEligibleImmigrationDay = speciesState.nextEligibleImmigrationDay;
    speciesEvent.globalAbsenceDays = speciesState.globalAbsenceDays ?? 0;
    speciesEvent.lastExtinctionDay = speciesState.lastExtinctionDay;
    speciesEvent.lastRecolonizationDay = speciesState.lastRecolonizationDay;
    bySpecies[speciesState.speciesId] = speciesEvent;
  }
  return {
    day,
    season,
    totalPopulation,
    presentSpecies,
    occupiedCohorts,
    preyKilled: event.preyKilled ?? 0,
    preyBiomassKilledKg: event.preyBiomassKilledKg ?? 0,
    carrionAddedKg: event.carrionAddedKg ?? 0,
    births: event.births ?? 0,
    deaths: event.deaths ?? 0,
    hungerDeaths: event.hungerDeaths ?? 0,
    naturalDeaths: event.naturalDeaths ?? 0,
    matured: event.matured ?? 0,
    aged: event.aged ?? 0,
    moved: event.moved ?? 0,
    mateSearchMoved: event.mateSearchMoved ?? 0,
    mateSearchProposed: event.mateSearchProposed ?? 0,
    mateSearchExecuted: event.mateSearchExecuted ?? 0,
    mateSearchBlocked: event.mateSearchBlocked ?? 0,
    natalDispersed: event.natalDispersed ?? 0,
    territorySettled: event.territorySettled ?? 0,
    groupSplitMoved: event.groupSplitMoved ?? 0,
    immigrants: event.immigrants ?? 0,
    immigrationPulses: event.immigrationPulses ?? 0,
    meanCondition: totalPopulation > 0 ? conditionWeighted / totalPopulation : 0,
    unsuccessfulHunts: event.unsuccessfulHunts ?? 0,
    bySpecies,
  };
}
