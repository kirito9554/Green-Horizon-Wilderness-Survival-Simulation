import {
  SPATIAL_FAUNA_SPECIES_BY_ID,
  type SpatialFaunaGuild,
  type SpatialFaunaSpeciesDefinition,
} from '../../data/spatialFauna';
import type {
  SpatialFaunaPatchCohortState,
  SpatialFaunaRuntimeState,
} from '../../types/spatialFaunaSimulation';
import type { GeneratedSpatialWorld } from './worldGeneration';

const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const STRESS_DAYS = 4;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * The census K already represents a calibrated coexistence baseline. Shared
 * competition therefore compares today's community load with the load implied
 * by those patch Ks rather than summing K again or inventing another global cap.
 * At or below the designed community composition there is no extra penalty;
 * niche-skew and over-crowding create pressure above 1.
 */
export interface SpatialFaunaCompetitionPressure {
  foodPressure: number;
  waterPressure: number;
  refugePressure: number;
  foodFactor: number;
  waterFactor: number;
  refugeFactor: number;
  combinedFactor: number;
}

export interface SpatialFaunaCompetitionSummary {
  meanFoodPressure: number;
  meanWaterPressure: number;
  meanRefugePressure: number;
  meanFoodFactor: number;
  meanWaterFactor: number;
  meanRefugeFactor: number;
  meanCombinedFactor: number;
  limitedCohortCount: number;
  limitedPopulation: number;
  affectedPopulation: number;
}

interface PatchSpeciesLoad {
  speciesId: string;
  definition: SpatialFaunaSpeciesDefinition;
  cohort: SpatialFaunaPatchCohortState;
  population: number;
  actualMetabolicHeads: number;
  baselinePopulation: number;
  baselineMetabolicHeads: number;
}

export type SpatialFaunaCompetitionByPatch = ReadonlyMap<
  string,
  ReadonlyMap<string, SpatialFaunaCompetitionPressure>
>;

function populationOf(cohort: SpatialFaunaPatchCohortState): number {
  return cohort[JUVENILES] + cohort[ADULTS] + cohort[OLD];
}

function metabolicHeads(cohort: SpatialFaunaPatchCohortState): number {
  return cohort[ADULTS] + cohort[OLD] * .9 + cohort[JUVENILES] * .55;
}

function expectedMetabolicHeadFactor(species: SpatialFaunaSpeciesDefinition): number {
  const juvenileShare = Math.max(.1, Math.min(.34, .1 + species.offspringPerAdultFemalePerYear * .018));
  const oldShare = Math.max(.06, Math.min(.18, .18 - species.offspringPerAdultFemalePerYear * .007));
  const adultShare = Math.max(.45, 1 - juvenileShare - oldShare);
  return adultShare + oldShare * .9 + juvenileShare * .55;
}

function normalizedDiet(species: SpatialFaunaSpeciesDefinition): Readonly<Record<string, number>> {
  const entries = Object.entries(species.diet).filter(([, value]) => (value ?? 0) > 0) as Array<[string, number]>;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

/** 0 = no shared food niche, 1 = identical diet composition. */
export function spatialFaunaDietOverlap(
  a: SpatialFaunaSpeciesDefinition,
  b: SpatialFaunaSpeciesDefinition,
): number {
  if (a.id === b.id) return 1;
  const dietA = normalizedDiet(a);
  const dietB = normalizedDiet(b);
  const keys = new Set([...Object.keys(dietA), ...Object.keys(dietB)]);
  let overlap = 0;
  for (const key of keys) overlap += Math.min(dietA[key] ?? 0, dietB[key] ?? 0);
  return clamp01(overlap);
}

function refugeOverlap(a: SpatialFaunaGuild, b: SpatialFaunaGuild): number {
  if (a === b) return 1;
  const pair = [a, b].sort().join('|');
  switch (pair) {
    case 'bat|canopy_bird': return .62;
    case 'bat|small_mammal': return .32;
    case 'canopy_bird|small_mammal': return .42;
    case 'ground_bird|small_mammal': return .46;
    case 'ground_bird|omnivore': return .52;
    case 'large_herbivore|omnivore': return .48;
    case 'large_herbivore|small_mammal': return .22;
    case 'omnivore|small_mammal': return .44;
    case 'amphibian|reptile': return .5;
    case 'amphibian|ground_bird': return .26;
    case 'ground_bird|reptile': return .34;
    case 'invertebrate|small_mammal': return .28;
    case 'amphibian|invertebrate': return .32;
    case 'invertebrate|reptile': return .3;
    default: return .12;
  }
}

function pressureFactor(pressure: number, sensitivity: number): number {
  if (!Number.isFinite(pressure) || pressure <= 1) return 1;
  return clamp01(1 / (1 + (pressure - 1) * sensitivity));
}

function safePressure(actual: number, baseline: number): number {
  if (baseline <= 1e-9) return actual > 0 ? 4 : 0;
  return Math.max(0, actual / baseline);
}

function buildPatchLoads(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
): Map<string, PatchSpeciesLoad[]> {
  const loadsByPatch = new Map<string, PatchSpeciesLoad[]>();
  const planBySpecies = new Map(world.faunaCommunity.species.map(plan => [plan.speciesId, plan] as const));

  for (const speciesState of runtime.species) {
    const definition = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    const plan = planBySpecies.get(speciesState.speciesId);
    if (!definition || !plan?.present) continue;
    const kByPatch = new Map(plan.patchAllocations.map(allocation => [allocation.patchId, allocation.carryingCapacity] as const));
    const baselineFactor = expectedMetabolicHeadFactor(definition);

    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const population = populationOf(cohort);
      const baselinePopulation = kByPatch.get(patchId) ?? 0;
      if (population <= 0 || baselinePopulation <= 0) continue;
      const load: PatchSpeciesLoad = {
        speciesId: speciesState.speciesId,
        definition,
        cohort,
        population,
        actualMetabolicHeads: metabolicHeads(cohort),
        baselinePopulation,
        baselineMetabolicHeads: baselinePopulation * baselineFactor,
      };
      const patchLoads = loadsByPatch.get(patchId) ?? [];
      patchLoads.push(load);
      loadsByPatch.set(patchId, patchLoads);
    }
  }

  return loadsByPatch;
}

export function buildSpatialFaunaCompetitionSnapshot(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
): SpatialFaunaCompetitionByPatch {
  const loadsByPatch = buildPatchLoads(runtime, world);
  const result = new Map<string, ReadonlyMap<string, SpatialFaunaCompetitionPressure>>();

  for (const [patchId, loads] of loadsByPatch) {
    const waterActual = loads.reduce(
      (sum, load) => sum + load.actualMetabolicHeads * load.definition.dailyWaterNeed,
      0,
    );
    const waterBaseline = loads.reduce(
      (sum, load) => sum + load.baselineMetabolicHeads * load.definition.dailyWaterNeed,
      0,
    );
    const waterPressure = safePressure(waterActual, waterBaseline);
    const waterFactor = pressureFactor(waterPressure, 1.25);
    const bySpecies = new Map<string, SpatialFaunaCompetitionPressure>();

    for (const focal of loads) {
      let foodActual = 0;
      let foodBaseline = 0;
      let refugeActual = 0;
      let refugeBaseline = 0;

      for (const competitor of loads) {
        const dietOverlap = spatialFaunaDietOverlap(focal.definition, competitor.definition);
        if (dietOverlap > 0) {
          foodActual += competitor.actualMetabolicHeads
            * competitor.definition.dailyFoodKgPerAdult
            * dietOverlap;
          foodBaseline += competitor.baselineMetabolicHeads
            * competitor.definition.dailyFoodKgPerAdult
            * dietOverlap;
        }

        const sharedRefuge = refugeOverlap(focal.definition.guild, competitor.definition.guild);
        refugeActual += competitor.population * sharedRefuge;
        refugeBaseline += competitor.baselinePopulation * sharedRefuge;
      }

      const foodPressure = safePressure(foodActual, foodBaseline);
      const refugePressure = safePressure(refugeActual, refugeBaseline);
      const foodFactor = pressureFactor(foodPressure, 1.1);
      const refugeFactor = pressureFactor(refugePressure, .8);
      const combinedFactor = clamp01(foodFactor * .5 + waterFactor * .3 + refugeFactor * .2);
      bySpecies.set(focal.speciesId, {
        foodPressure,
        waterPressure,
        refugePressure,
        foodFactor,
        waterFactor,
        refugeFactor,
        combinedFactor,
      });
    }

    result.set(patchId, bySpecies);
  }

  return result;
}

/**
 * Apply the shared-resource interaction before the core daily demographic tick.
 * This makes today's mortality, breeding readiness and stress-driven dispersal
 * see interspecific pressure without creating one entity per animal.
 *
 * This is a competition layer, not a conserved food-stock model. Living flora,
 * insects and local-resource stocks can later replace the K-derived baseline.
 */
export function applySpatialFaunaCompetitionPressure(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
): SpatialFaunaCompetitionSummary {
  const snapshot = buildSpatialFaunaCompetitionSnapshot(runtime, world);
  let weight = 0;
  let foodWeighted = 0;
  let waterWeighted = 0;
  let refugeWeighted = 0;
  let foodFactorWeighted = 0;
  let waterFactorWeighted = 0;
  let refugeFactorWeighted = 0;
  let combinedFactorWeighted = 0;
  let limitedCohortCount = 0;
  let limitedPopulation = 0;

  for (const speciesState of runtime.species) {
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const population = populationOf(cohort);
      if (population <= 0) continue;
      const pressure = snapshot.get(patchId)?.get(speciesState.speciesId);
      if (!pressure) continue;

      weight += population;
      foodWeighted += pressure.foodPressure * population;
      waterWeighted += pressure.waterPressure * population;
      refugeWeighted += pressure.refugePressure * population;
      foodFactorWeighted += pressure.foodFactor * population;
      waterFactorWeighted += pressure.waterFactor * population;
      refugeFactorWeighted += pressure.refugeFactor * population;
      combinedFactorWeighted += pressure.combinedFactor * population;

      const limited = pressure.foodPressure > 1.03
        || pressure.waterPressure > 1.03
        || pressure.refugePressure > 1.03;
      if (limited) {
        limitedCohortCount += 1;
        limitedPopulation += population;
      }

      // No boost below baseline K: ecological release is represented by the
      // absence of an extra penalty, while the ordinary patch resource model
      // remains responsible for positive condition recovery.
      if (pressure.combinedFactor < .999) {
        cohort[CONDITION] = clamp01(cohort[CONDITION] * (.86 + pressure.combinedFactor * .14));
        if (pressure.combinedFactor < .9) cohort[STRESS_DAYS] += 1;
      }
    }
  }

  return {
    meanFoodPressure: weight > 0 ? foodWeighted / weight : 0,
    meanWaterPressure: weight > 0 ? waterWeighted / weight : 0,
    meanRefugePressure: weight > 0 ? refugeWeighted / weight : 0,
    meanFoodFactor: weight > 0 ? foodFactorWeighted / weight : 1,
    meanWaterFactor: weight > 0 ? waterFactorWeighted / weight : 1,
    meanRefugeFactor: weight > 0 ? refugeFactorWeighted / weight : 1,
    meanCombinedFactor: weight > 0 ? combinedFactorWeighted / weight : 1,
    limitedCohortCount,
    limitedPopulation,
    affectedPopulation: weight,
  };
}
