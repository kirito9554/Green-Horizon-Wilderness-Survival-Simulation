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

export const SPATIAL_PREDATOR_RUNTIME_VERSION = 2;
const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const RESERVE = 4;
const CARRION_STOCK_INDEX = 7;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

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
        cohortsByPatch[patch.id] = [juveniles, adults, old, .82 + suitability * .14, def.dailyFoodKgPerAdult * count * 1.2];
        total += count;
      }
      if (total < def.minIslandCapacity && bestPatch && bestSuitability >= def.minPatchSuitability * .9) {
        const count = def.minIslandCapacity;
        cohortsByPatch[bestPatch.id] = [Math.max(0, Math.floor(count * .15)), Math.max(1, Math.ceil(count * .77)), Math.floor(count * .08), .86, def.dailyFoodKgPerAdult * count * 1.5];
      }
    }
    return { speciesId: def.id, cohortsByPatch };
  });
  const runtime: SpatialPredatorRuntimeState = {
    version: SPATIAL_PREDATOR_RUNTIME_VERSION,
    worldSeed: world.worldSeed,
    lastProcessedDay: day,
    species: speciesStates,
    telemetry: { day, season: 'dry', totalPopulation: 0, presentSpecies: 0, occupiedCohorts: 0, preyKilled: 0, preyBiomassKilledKg: 0, carrionAddedKg: 0, births: 0, deaths: 0, moved: 0, meanCondition: 0, unsuccessfulHunts: 0 },
  };
  runtime.telemetry = summarizePredators(runtime, day, 'dry');
  return runtime;
}

function patchesWithinHomeRange(startPatchId: string, homeRangeKm: number, world: GeneratedSpatialWorld): Array<{ patchId: string; distanceKm: number }> {
  const maxMeters = homeRangeKm * 1000;
  const best = new Map<string, number>([[startPatchId, 0]]);
  const queue: Array<{ patchId: string; distance: number }> = [{ patchId: startPatchId, distance: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    if (current.distance > (best.get(current.patchId) ?? Number.POSITIVE_INFINITY)) continue;
    for (const edge of world.routeGraph.edgesByPatchId[current.patchId] ?? []) {
      const distance = current.distance + edge.distanceMeters;
      if (distance > maxMeters) continue;
      if (distance >= (best.get(edge.toPatchId) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(edge.toPatchId, distance);
      queue.push({ patchId: edge.toPatchId, distance });
    }
  }
  return [...best.entries()].map(([patchId, distance]) => ({ patchId, distanceKm: distance / 1000 }));
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
  const accessible = patchesWithinHomeRange(startPatchId, predator.homeRangeKm, world);
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
  let unsuccessfulHunts = 0;

  for (const speciesState of predators.species) {
    const predator = SPATIAL_PREDATOR_BY_ID[speciesState.speciesId];
    if (!predator) continue;
    const moves: Array<{ from: string; to: string; cohort: SpatialPredatorPatchCohortState }> = [];
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      let population = cohortPopulation(cohort);
      if (population <= 0) continue;
      const metabolicHeads = cohort[ADULTS] + cohort[OLD] * .9 + cohort[JUVENILES] * .55;
      const dailyNeed = metabolicHeads * predator.dailyFoodKgPerAdult;
      let shortfall = Math.max(0, dailyNeed - cohort[RESERVE]);
      cohort[RESERVE] = Math.max(0, cohort[RESERVE] - dailyNeed);
      const candidates = preyCandidates(predator, patchId, fauna, world);
      let huntIndex = 0;
      const huntLimit = Math.max(1, Math.min(24, Math.ceil(shortfall / Math.max(.08, predator.dailyFoodKgPerAdult * 2.5))));
      while (shortfall > .01 && huntIndex < huntLimit && candidates.length) {
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
            const consumed = Math.min(edible, shortfall + dailyNeed * .7);
            cohort[RESERVE] += consumed;
            shortfall = Math.max(0, shortfall - consumed);
            const carrion = Math.max(0, removed.biomassKg - consumed);
            carrionAddedKg += addCarrion(fauna, candidate.patchId, carrion);
            preyKilled += 1;
            preyBiomassKilledKg += removed.biomassKg;
          }
        } else unsuccessfulHunts += 1;
        huntIndex += 1;
      }

      const foodRatio = dailyNeed > 0 ? clamp01((dailyNeed - shortfall) / dailyNeed) : 1;
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
      if (population > 1 && cohort[CONDITION] > .68) {
        const expected = cohort[ADULTS] * .5 * predator.offspringPerAdultFemalePerYear / 365 * (.55 + cohort[CONDITION] * .45);
        const whole = Math.floor(expected);
        const extra = spatialUnitRandom(world.worldSeed, `predator-birth|${predator.id}|${patchId}|${day}`) < expected - whole ? 1 : 0;
        const born = whole + extra;
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

      if ((foodRatio < .62 || cohort[CONDITION] < .55) && cohortPopulation(cohort) > 0) {
        const nearby = patchesWithinHomeRange(patchId, Math.min(predator.homeRangeKm, 1.5), world)
          .filter(entry => entry.patchId !== patchId)
          .map(entry => ({ ...entry, candidates: preyCandidates(predator, entry.patchId, fauna, world) }))
          .sort((a, b) => b.candidates.reduce((s, c) => s + c.score, 0) - a.candidates.reduce((s, c) => s + c.score, 0));
        const destination = nearby[0];
        if (destination && destination.candidates.length) {
          const migrants = Math.max(1, Math.floor(cohortPopulation(cohort) * .12));
          const transfer: SpatialPredatorPatchCohortState = [0, 0, 0, cohort[CONDITION], 0];
          let remaining = migrants;
          for (const stage of [JUVENILES, ADULTS, OLD] as const) {
            const taken = Math.min(cohort[stage], remaining);
            cohort[stage] -= taken;
            transfer[stage] += taken;
            remaining -= taken;
          }
          if (cohortPopulation(transfer) > 0) { moves.push({ from: patchId, to: destination.patchId, cohort: transfer }); moved += cohortPopulation(transfer); }
        }
      }
    }
    for (const move of moves) {
      const existing = speciesState.cohortsByPatch[move.to];
      if (existing) {
        existing[JUVENILES] += move.cohort[JUVENILES]; existing[ADULTS] += move.cohort[ADULTS]; existing[OLD] += move.cohort[OLD];
        existing[CONDITION] = (existing[CONDITION] + move.cohort[CONDITION]) / 2;
      } else speciesState.cohortsByPatch[move.to] = move.cohort;
    }
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) if (cohortPopulation(cohort) <= 0) delete speciesState.cohortsByPatch[patchId];
  }

  predators.lastProcessedDay = day;
  predators.telemetry = summarizePredators(predators, day, season, { preyKilled, preyBiomassKilledKg, carrionAddedKg, births, deaths, moved, unsuccessfulHunts });
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
    meanCondition: totalPopulation > 0 ? conditionWeighted / totalPopulation : 0,
    unsuccessfulHunts: event.unsuccessfulHunts ?? 0,
  };
}