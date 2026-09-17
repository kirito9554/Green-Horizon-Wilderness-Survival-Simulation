import { SPATIAL_PREDATOR_BY_ID, SPATIAL_PREDATOR_SPECIES, type SpatialPredatorSpeciesDefinition } from '../../data/spatialPredators';
import { SPATIAL_FAUNA_SPECIES_BY_ID } from '../../data/spatialFauna';
import type {
  SpatialPredatorPatchCohortState,
  SpatialPredatorRuntimeState,
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

export const SPATIAL_PREDATOR_RUNTIME_VERSION = 5;
const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const RESERVE = 4;
const CARRION_STOCK_INDEX = 7;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

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

export function createSpatialPredatorRuntimeState(world: GeneratedSpatialWorld, day = 1): SpatialPredatorRuntimeState {
  const speciesStates = SPATIAL_PREDATOR_SPECIES.map(def => {
    const cohortsByPatch: Record<string, SpatialPredatorPatchCohortState> = {};
    if (spatialUnitRandom(world.worldSeed, `predator-presence|${def.id}`) <= def.worldPresence) {
      let total = 0;
      let bestPatch: HabitatPatch | undefined;
      let bestSuitability = 0;
      for (const patch of world.habitatPatches) {
        const suitability = predatorSuitability(def, patch, world);
        if (suitability > bestSuitability) { bestSuitability = suitability; bestPatch = patch; }
        if (suitability < def.minPatchSuitability) continue;
        const expected = patch.areaKm2 * def.densityPerKm2 * Math.pow(suitability, 1.45);
        const base = Math.floor(expected);
        const fractional = expected - base;
        let count = base + (spatialUnitRandom(world.worldSeed, `predator-count|${def.id}|${patch.id}`) < fractional ? 1 : 0);
        const occupancy = def.initialOccupancy[0] + spatialUnitRandom(world.worldSeed, `predator-occ|${def.id}|${patch.id}`) * (def.initialOccupancy[1] - def.initialOccupancy[0]);
        count = Math.round(count * occupancy);
        if (count <= 0) continue;
        const juveniles = Math.floor(count * .18);
        const old = Math.floor(count * .08);
        const adults = Math.max(0, count - juveniles - old);
        const cohort: SpatialPredatorPatchCohortState = [juveniles, adults, old, .82 + suitability * .14, 0];
        initializePredatorReserve(cohort, def, .52 + spatialUnitRandom(world.worldSeed, `predator-reserve|${def.id}|${patch.id}`) * .18);
        cohortsByPatch[patch.id] = cohort;
        total += count;
      }
      if (total < def.minIslandCapacity && bestPatch && bestSuitability >= def.minPatchSuitability * .9) {
        const count = def.minIslandCapacity;
        const cohort: SpatialPredatorPatchCohortState = [Math.max(0, Math.floor(count * .15)), Math.max(1, Math.ceil(count * .77)), Math.floor(count * .08), .86, 0];
        initializePredatorReserve(cohort, def, .62);
        cohortsByPatch[bestPatch.id] = cohort;
      }
    }
    return { speciesId: def.id, cohortsByPatch, globalAbsenceDays: 0 };
  });
  const runtime: SpatialPredatorRuntimeState = {
    version: SPATIAL_PREDATOR_RUNTIME_VERSION,
    worldSeed: world.worldSeed,
    lastProcessedDay: day,
    species: speciesStates,
    telemetry: {
      day, season: 'dry', totalPopulation: 0, presentSpecies: 0, occupiedCohorts: 0,
      preyKilled: 0, preyBiomassKilledKg: 0, carrionAddedKg: 0, births: 0, deaths: 0, moved: 0,
      mateSearchMoved: 0, natalDispersed: 0, territorySettled: 0, groupSplitMoved: 0, immigrants: 0,
      meanCondition: 0, unsuccessfulHunts: 0,
    },
  };
  runtime.telemetry = summarizePredators(runtime, day, 'dry');
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
    population += cohortPopulation(cohortsByPatch[entry.patchId] ?? [0, 0, 0, 0, 0]);
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

function extractPredatorTransfer(
  cohort: SpatialPredatorPatchCohortState,
  requested: number,
  adultFirst: boolean,
): SpatialPredatorPatchCohortState {
  const transfer: SpatialPredatorPatchCohortState = [0, 0, 0, cohort[CONDITION], 0];
  let remaining = Math.min(Math.max(0, requested), cohortPopulation(cohort));
  const order = adultFirst ? [ADULTS, OLD, JUVENILES] as const : [JUVENILES, ADULTS, OLD] as const;
  for (const stage of order) {
    const taken = Math.min(cohort[stage], remaining);
    cohort[stage] -= taken;
    transfer[stage] += taken;
    remaining -= taken;
  }
  const heads = cohortPopulation(transfer);
  if (heads > 0) {
    const reserveShare = Math.min(cohort[RESERVE], Math.max(0, cohort[RESERVE]) * heads / Math.max(1, heads + cohortPopulation(cohort)));
    cohort[RESERVE] -= reserveShare;
    transfer[RESERVE] = reserveShare;
  }
  return transfer;
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
      // The dispersing breeder itself is implicit at the candidate destination. One reachable
      // other breeder is therefore enough to make a true pair; an isolated mover remains at 1.
      score += mateAvailabilityFactor(reachableOthers + 1) * .32;
    }
    if (score > bestScore) { bestScore = score; bestPatchId = entry.patchId; }
  }
  return bestScore > .28 ? bestPatchId : undefined;
}

function applyPredatorMove(
  speciesCohorts: Record<string, SpatialPredatorPatchCohortState>,
  move: PredatorMove,
): number {
  const moved = cohortPopulation(move.cohort);
  if (moved <= 0) return 0;
  const existing = speciesCohorts[move.to];
  if (existing) {
    const existingPop = cohortPopulation(existing);
    existing[JUVENILES] += move.cohort[JUVENILES];
    existing[ADULTS] += move.cohort[ADULTS];
    existing[OLD] += move.cohort[OLD];
    existing[RESERVE] += move.cohort[RESERVE];
    existing[CONDITION] = (existing[CONDITION] * existingPop + move.cohort[CONDITION] * moved) / Math.max(1, existingPop + moved);
  } else speciesCohorts[move.to] = move.cohort;
  return moved;
}

function maybeRecolonizePredator(
  speciesState: SpatialPredatorRuntimeState['species'][number],
  predator: SpatialPredatorSpeciesDefinition,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
): number {
  const total = Object.values(speciesState.cohortsByPatch).reduce((sum, cohort) => sum + cohortPopulation(cohort), 0);
  const minimumViable = Math.min(3, Math.max(2, predator.minIslandCapacity));
  if (total >= minimumViable) {
    speciesState.globalAbsenceDays = 0;
    return 0;
  }
  speciesState.globalAbsenceDays = (speciesState.globalAbsenceDays ?? 0) + 1;
  const profile = getPredatorBehaviorProfile(predator);
  const readiness = recolonizationReadiness(speciesState.globalAbsenceDays, profile.recolonizationDelayDays);
  if (readiness <= 0) return 0;
  const opportunity = readiness >= 1
    || spatialUnitRandom(world.worldSeed, `predator-immigration-opportunity|${predator.id}|${day}`) < readiness * .018;
  if (!opportunity) return 0;

  let best: { patchId: string; score: number } | undefined;
  for (const patch of world.habitatPatches) {
    const suitability = predatorSuitability(predator, patch, world);
    if (suitability < predator.minPatchSuitability) continue;
    const preyScore = preyCandidates(predator, patch.id, fauna, world).reduce((sum, candidate) => sum + candidate.score, 0);
    if (preyScore <= 0) continue;
    const edgeSignal = 1 / Math.max(2, (world.routeGraph.edgesByPatchId[patch.id]?.length ?? 0) + 1);
    const score = suitability * .58 + (1 - Math.exp(-preyScore / 40)) * .32 + edgeSignal * .1;
    if (!best || score > best.score) best = { patchId: patch.id, score };
  }
  if (!best) return 0;
  const founders = deterministicFounderCount(
    spatialUnitRandom(world.worldSeed, `predator-immigration-count|${predator.id}|${day}`),
    profile.recolonizationFounderCount,
  );
  const needed = Math.max(1, minimumViable - total);
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
  speciesState.lastImmigrationDay = day;
  speciesState.globalAbsenceDays = 0;
  return count;
}

export function tickSpatialPredatorsDay(
  predators: SpatialPredatorRuntimeState,
  fauna: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
  season: SpatialFaunaSeason,
): SpatialPredatorTelemetry {
  let preyKilled = 0;
  let preyBiomassKilledKg = 0;
  let carrionAddedKg = 0;
  let births = 0;
  let deaths = 0;
  let moved = 0;
  let mateSearchMoved = 0;
  let natalDispersed = 0;
  let territorySettled = 0;
  let groupSplitMoved = 0;
  let immigrants = 0;
  let unsuccessfulHunts = 0;

  for (const speciesState of predators.species) {
    const predator = SPATIAL_PREDATOR_BY_ID[speciesState.speciesId];
    if (!predator) continue;
    const profile = getPredatorBehaviorProfile(predator);
    const breederSnapshotByPatch = new Map(
      Object.entries(speciesState.cohortsByPatch).map(([patchId, cohort]) => [patchId, effectivePredatorBreeders(cohort)] as const),
    );
    const moves: PredatorMove[] = [];
    const patchIds = Object.keys(speciesState.cohortsByPatch).sort();

    for (const patchId of patchIds) {
      const cohort = speciesState.cohortsByPatch[patchId];
      if (!cohort) continue;
      let population = cohortPopulation(cohort);
      if (population <= 0) continue;
      const metabolicHeads = metabolicPredatorHeads(cohort);
      const dailyNeed = metabolicHeads * predator.dailyFoodKgPerAdult;
      const reserveCapacity = clampPredatorReserve(cohort, predator);
      const reserveBefore = cohort[RESERVE];
      const candidates = preyCandidates(predator, patchId, fauna, world);
      let huntIndex = 0;
      let huntedEdibleKg = 0;
      let lastKillPatchId: string | undefined;
      // maxKillsPerAdultPerDay is an expected successful-kill cadence. Convert it to
      // encounter attempts through baseline hunt success, then let local density/refuge
      // modify the realized kill count. Fractional cadence is deterministic by seed/day.
      const expectedAttempts = metabolicHeads * predator.maxKillsPerAdultPerDay / Math.max(.12, predator.huntSuccessBase);
      const huntLimit = Math.min(24, deterministicRound(
        world.worldSeed,
        `predator-hunt-opportunities|${predator.id}|${patchId}|${day}`,
        expectedAttempts,
      ));
      // P2 semantics: predators attempt to meet this tick's demand. Existing reserve is
      // not a refill target; it only bridges unsuccessful/intermittent feeding days.
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
            // The non-edible fraction becomes carrion immediately. Any edible overflow
            // beyond metabolic demand + reserve capacity is conserved below as carrion.
            carrionAddedKg += addCarrion(fauna, candidate.patchId, removed.biomassKg - edible);
            preyKilled += 1;
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
      cohort[CONDITION] = clamp01(cohort[CONDITION] + (foodRatio - .72) * .045);
      if (shortfall > dailyNeed * .45) {
        const hungerRate = .0008 + (1 - foodRatio) * .004;
        const hungerDeaths = Math.min(
          population,
          deterministicRound(world.worldSeed, `predator-hunger-death|${predator.id}|${patchId}|${day}`, population * hungerRate),
        );
        let left = hungerDeaths;
        for (const stage of [OLD, JUVENILES, ADULTS] as const) {
          const taken = Math.min(cohort[stage], left);
          cohort[stage] -= taken;
          left -= taken;
        }
        deaths += hungerDeaths;
      }
      const remainingPopulation = cohortPopulation(cohort);
      const naturalRate = .00015 + (1 - cohort[CONDITION]) * .0007;
      const naturalDeaths = Math.min(
        remainingPopulation,
        deterministicRound(world.worldSeed, `predator-natural-death|${predator.id}|${patchId}|${day}`, remainingPopulation * naturalRate),
      );
      if (naturalDeaths > 0) {
        let left = naturalDeaths;
        for (const stage of [OLD, ADULTS, JUVENILES] as const) {
          const taken = Math.min(cohort[stage], left);
          cohort[stage] -= taken;
          left -= taken;
        }
        deaths += naturalDeaths;
      }

      population = cohortPopulation(cohort);
      if (population <= 0) continue;
      clampPredatorReserve(cohort, predator);
      const localBreeders = estimateReachableBreeders(world, patchId, profile.matingRangeKm, breederSnapshotByPatch);
      const mateFactor = mateAvailabilityFactor(localBreeders);
      const localPressure = localPredatorPressure(predator, speciesState.cohortsByPatch, patchId, world);
      const densityFactor = densityFertilityFactor(localPressure.population / localPressure.capacity);
      const conditionFactor = conditionFertilityFactor(cohort[CONDITION]);
      if (cohort[ADULTS] > 0 && mateFactor > 0) {
        const expected = cohort[ADULTS] * .5 * predator.offspringPerAdultFemalePerYear / 365
          * mateFactor * conditionFactor * densityFactor;
        const born = deterministicRound(world.worldSeed, `predator-birth|${predator.id}|${patchId}|${day}`, expected);
        cohort[JUVENILES] += born;
        births += born;
      }

      const mature = Math.min(
        cohort[JUVENILES],
        deterministicRound(world.worldSeed, `predator-mature|${predator.id}|${patchId}|${day}`, cohort[JUVENILES] / Math.max(60, predator.maturityDays)),
      );
      cohort[JUVENILES] -= mature;
      cohort[ADULTS] += mature;
      const aging = Math.min(
        cohort[ADULTS],
        deterministicRound(world.worldSeed, `predator-aging|${predator.id}|${patchId}|${day}`, cohort[ADULTS] / Math.max(365, predator.maxAgeDays * .55)),
      );
      cohort[ADULTS] -= aging;
      cohort[OLD] += aging;
      clampPredatorReserve(cohort, predator);

      let move: PredatorMove | undefined;
      if (mature > 0 && cohort[ADULTS] > 0) {
        const disperse = Math.min(cohort[ADULTS], deterministicRound(world.worldSeed, `predator-natal-dispersal|${predator.id}|${patchId}|${day}`, mature * profile.natalDispersalFraction));
        const destination = disperse > 0
          ? chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.dispersalRangeKm)
          : undefined;
        if (destination) {
          const transfer = extractPredatorTransfer(cohort, disperse, true);
          if (cohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'natal_dispersal' };
        }
      }

      if (!move && mateFactor < .58 && effectivePredatorBreeders(cohort) > 0) {
        const searchProbability = profile.mateSearchRatePerDay * (1 - mateFactor);
        const searches = spatialUnitRandom(world.worldSeed, `predator-mate-search|${predator.id}|${patchId}|${day}`) < searchProbability;
        if (searches) {
          const destination = chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.matingRangeKm, breederSnapshotByPatch);
          if (destination && cohort[ADULTS] + cohort[OLD] > 0) {
            const transfer = extractPredatorTransfer(cohort, 1, true);
            if (cohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'mate_search' };
          }
        }
      }

      const currentPopulation = cohortPopulation(cohort);
      if (!move && currentPopulation > profile.groupTargetSize * profile.groupSplitRatio) {
        const requested = Math.max(1, Math.floor((currentPopulation - profile.groupTargetSize) * .35));
        const destination = chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, profile.dispersalRangeKm);
        if (destination) {
          const transfer = extractPredatorTransfer(cohort, requested, false);
          if (cohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'group_split' };
        }
      }

      if (!move && (foodRatio < .62 || cohort[CONDITION] < .55) && cohortPopulation(cohort) > 0) {
        const destination = chooseSettlementPatch(predator, patchId, speciesState.cohortsByPatch, fauna, world, Math.min(profile.foragingRangeKm, 1.8));
        if (destination) {
          const migrants = Math.max(1, Math.floor(cohortPopulation(cohort) * .12));
          const transfer = extractPredatorTransfer(cohort, migrants, false);
          if (cohortPopulation(transfer) > 0) move = { from: patchId, to: destination, cohort: transfer, reason: 'resource' };
        }
      }

      if (move) moves.push(move);
    }

    for (const move of moves) {
      const count = applyPredatorMove(speciesState.cohortsByPatch, move);
      moved += count;
      if (move.reason === 'mate_search') mateSearchMoved += count;
      else if (move.reason === 'natal_dispersal') { natalDispersed += count; territorySettled += count; }
      else if (move.reason === 'group_split') { groupSplitMoved += count; territorySettled += count; }
      else if (move.reason === 'territory_settlement') territorySettled += count;
    }
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) if (cohortPopulation(cohort) <= 0) delete speciesState.cohortsByPatch[patchId];
    immigrants += maybeRecolonizePredator(speciesState, predator, fauna, world, day);
  }

  predators.lastProcessedDay = day;
  predators.telemetry = summarizePredators(predators, day, season, {
    preyKilled, preyBiomassKilledKg, carrionAddedKg, births, deaths, moved,
    mateSearchMoved, natalDispersed, territorySettled, groupSplitMoved, immigrants, unsuccessfulHunts,
  });
  return predators.telemetry;
}

function summarizePredators(
  runtime: SpatialPredatorRuntimeState,
  day: number,
  season: SpatialFaunaSeason,
  event: Partial<SpatialPredatorTelemetry> = {},
): SpatialPredatorTelemetry {
  let totalPopulation = 0;
  let presentSpecies = 0;
  let occupiedCohorts = 0;
  let conditionWeighted = 0;
  for (const speciesState of runtime.species) {
    let speciesPopulation = 0;
    for (const cohort of Object.values(speciesState.cohortsByPatch)) {
      const pop = cohortPopulation(cohort);
      speciesPopulation += pop;
      totalPopulation += pop;
      conditionWeighted += pop * cohort[CONDITION];
      if (pop > 0) occupiedCohorts += 1;
    }
    if (speciesPopulation > 0) presentSpecies += 1;
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
    moved: event.moved ?? 0,
    mateSearchMoved: event.mateSearchMoved ?? 0,
    natalDispersed: event.natalDispersed ?? 0,
    territorySettled: event.territorySettled ?? 0,
    groupSplitMoved: event.groupSplitMoved ?? 0,
    immigrants: event.immigrants ?? 0,
    meanCondition: totalPopulation > 0 ? conditionWeighted / totalPopulation : 0,
    unsuccessfulHunts: event.unsuccessfulHunts ?? 0,
  };
}
