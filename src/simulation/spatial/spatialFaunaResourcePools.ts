import {
  SPATIAL_FAUNA_SPECIES_BY_ID,
  type SpatialFaunaSpeciesDefinition,
} from '../../data/spatialFauna';
import type { WildFoodResource } from '../../types/ecologySimulation';
import type {
  SpatialFaunaPatchCohortState,
  SpatialFaunaPatchResourceStockState,
  SpatialFaunaRuntimeState,
  SpatialFaunaSeason,
} from '../../types/spatialFaunaSimulation';
import { SPATIAL_FAUNA_FOOD_RESOURCE_ORDER } from '../../types/spatialFaunaSimulation';
import type { HabitatPatch } from './habitatPatches';
import type { GeneratedSpatialWorld } from './worldGeneration';
import { spatialUnitRandom } from './spatialRandom';

const JUVENILES = 0;
const ADULTS = 1;
const OLD = 2;
const CONDITION = 3;
const STRESS_DAYS = 4;
const FRESH_WATER = 8;

const FOOD_INDEX: Readonly<Record<WildFoodResource, number>> = Object.freeze({
  fruit: 0,
  seeds: 1,
  browse: 2,
  ground_vegetation: 3,
  roots_tubers: 4,
  insects: 5,
  aquatic_plants: 6,
  carrion: 7,
});

/**
 * Game-scale edible standing crop per square kilometre of good habitat.
 * Tropical vegetation biomass is much larger than this; these values represent
 * the fraction accessible to the tracked fauna, not total plant biomass.
 */
const STANDING_KG_PER_KM2: Readonly<Record<WildFoodResource, number>> = Object.freeze({
  fruit: 36_000,
  seeds: 22_000,
  browse: 360_000,
  ground_vegetation: 220_000,
  roots_tubers: 110_000,
  insects: 48_000,
  aquatic_plants: 190_000,
  carrion: 4_500,
});

/** Neutral-season accessible production per km² per day. */
const DAILY_PRODUCTION_KG_PER_KM2: Readonly<Record<WildFoodResource, number>> = Object.freeze({
  fruit: 520,
  seeds: 240,
  browse: 1_850,
  ground_vegetation: 1_950,
  roots_tubers: 360,
  insects: 2_300,
  aquatic_plants: 2_450,
  carrion: 72,
});

/** Minimum standing-stock days at census K after habitat-area scaling. */
const MIN_RESERVE_DAYS_AT_K: Readonly<Record<WildFoodResource, number>> = Object.freeze({
  fruit: 45,
  seeds: 60,
  browse: 120,
  ground_vegetation: 90,
  roots_tubers: 120,
  insects: 24,
  aquatic_plants: 75,
  carrion: 8,
});

const MIN_NEUTRAL_PRODUCTION_HEADROOM_AT_K = 1.35;
const MIN_WATER_RESERVE_DAYS_AT_K = 45;
const MIN_WATER_RECHARGE_HEADROOM_AT_K = 1.5;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const roundStock = (value: number): number => Math.max(0, Math.round(value * 1000) / 1000);

export interface SpatialFaunaPatchResourceProfile {
  patchId: string;
  areaKm2: number;
  foodCapacityKg: Readonly<Record<WildFoodResource, number>>;
  neutralFoodProductionKgPerDay: Readonly<Record<WildFoodResource, number>>;
  baselineFoodDemandAtKPerDay: Readonly<Record<WildFoodResource, number>>;
  freshWaterCapacityUnits: number;
  neutralFreshWaterRechargeUnitsPerDay: number;
  baselineWaterDemandAtKPerDay: number;
}

export interface SpatialFaunaResourceModel {
  byPatchId: Readonly<Record<string, SpatialFaunaPatchResourceProfile>>;
  totalFoodCapacityKg: number;
  totalNeutralFoodProductionKgPerDay: number;
  totalBaselineFoodDemandAtKPerDay: number;
  totalFreshWaterCapacityUnits: number;
  totalNeutralFreshWaterRechargeUnitsPerDay: number;
  totalBaselineWaterDemandAtKPerDay: number;
}

export interface SpatialFaunaPatchResourceSufficiency {
  food: number;
  water: number;
}

export type SpatialFaunaResourceSufficiencyByPatch = ReadonlyMap<
  string,
  ReadonlyMap<string, SpatialFaunaPatchResourceSufficiency>
>;

export interface SpatialFaunaResourceDaySummary {
  foodStockKg: number;
  foodCapacityKg: number;
  foodRecoveredKg: number;
  foodConsumedKg: number;
  waterStockUnits: number;
  waterCapacityUnits: number;
  waterRecoveredUnits: number;
  waterConsumedUnits: number;
  meanFoodPoolFill: number;
  meanWaterPoolFill: number;
  meanFoodSufficiency: number;
  meanWaterSufficiency: number;
  resourceLimitedCohortCount: number;
  resourceLimitedPopulation: number;
  affectedPopulation: number;
  sufficiencyByPatch: SpatialFaunaResourceSufficiencyByPatch;
}

interface MutableDemand {
  food: Record<WildFoodResource, number>;
  water: number;
}

const resourceModelCache = new WeakMap<GeneratedSpatialWorld, SpatialFaunaResourceModel>();
const normalizedDietCache = new Map<string, Readonly<Record<WildFoodResource, number>>>();
const metabolicFactorCache = new Map<string, number>();

function emptyFoodRecord(): Record<WildFoodResource, number> {
  return {
    fruit: 0,
    seeds: 0,
    browse: 0,
    ground_vegetation: 0,
    roots_tubers: 0,
    insects: 0,
    aquatic_plants: 0,
    carrion: 0,
  };
}

function normalizedDiet(species: SpatialFaunaSpeciesDefinition): Readonly<Record<WildFoodResource, number>> {
  const cached = normalizedDietCache.get(species.id);
  if (cached) return cached;
  const result = emptyFoodRecord();
  let total = 0;
  for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
    total += Math.max(0, species.diet[resource] ?? 0);
  }
  if (total > 0) {
    for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      result[resource] = Math.max(0, species.diet[resource] ?? 0) / total;
    }
  }
  const frozen = Object.freeze(result);
  normalizedDietCache.set(species.id, frozen);
  return frozen;
}

function expectedMetabolicHeadFactor(species: SpatialFaunaSpeciesDefinition): number {
  const cached = metabolicFactorCache.get(species.id);
  if (cached !== undefined) return cached;
  const juvenileShare = Math.max(.1, Math.min(.34, .1 + species.offspringPerAdultFemalePerYear * .018));
  const oldShare = Math.max(.06, Math.min(.18, .18 - species.offspringPerAdultFemalePerYear * .007));
  const adultShare = Math.max(.45, 1 - juvenileShare - oldShare);
  const factor = adultShare + oldShare * .9 + juvenileShare * .55;
  metabolicFactorCache.set(species.id, factor);
  return factor;
}

function metabolicHeads(cohort: SpatialFaunaPatchCohortState): number {
  return cohort[ADULTS] + cohort[OLD] * .9 + cohort[JUVENILES] * .55;
}

function cohortPopulation(cohort: SpatialFaunaPatchCohortState): number {
  return cohort[JUVENILES] + cohort[ADULTS] + cohort[OLD];
}

function localResourcePotential(world: GeneratedSpatialWorld, patchId: string, key: string): number {
  return clamp01(world.localSiteInfluenceByPatchId[patchId]?.resourcePotential[key as never] ?? 0);
}

function resourceHabitatPotential(
  resource: WildFoodResource,
  patch: HabitatPatch,
  world: GeneratedSpatialWorld,
): number {
  const site = world.localSiteInfluenceByPatchId[patch.id];
  const forage = patch.suitability.forage;
  const canopy = patch.suitability.canopy;
  const cover = patch.suitability.cover;
  const moisture = patch.suitability.moisture;
  const aquatic = patch.suitability.aquatic;
  const wetness = patch.terrain.wetness;
  const decomposition = site?.decomposition ?? .35;

  switch (resource) {
    case 'fruit':
      return clamp01(.08 + forage * .42 + canopy * .24 + localResourcePotential(world, patch.id, 'fruit') * .26);
    case 'seeds':
      return clamp01(.1 + forage * .38 + canopy * .18 + cover * .12 + (1 - patch.suitability.disturbance) * .12);
    case 'browse':
      return clamp01(.1 + cover * .3 + canopy * .22 + forage * .3 + moisture * .08);
    case 'ground_vegetation':
      return clamp01(.08 + forage * .44 + (1 - canopy) * .25 + moisture * .12 + localResourcePotential(world, patch.id, 'edible_plants') * .11);
    case 'roots_tubers':
      return clamp01(.08 + forage * .3 + moisture * .18 + patch.terrain.drainage * .16 + localResourcePotential(world, patch.id, 'tubers') * .28);
    case 'insects':
      return clamp01(.1 + decomposition * .3 + moisture * .2 + cover * .15 + canopy * .1 + localResourcePotential(world, patch.id, 'insects') * .15);
    case 'aquatic_plants': {
      const waterIndex = world.hydrology.byPatchId[patch.id]?.waterIndex ?? 0;
      const nursery = site?.aquaticNursery ?? .2;
      return clamp01(.03 + aquatic * .36 + wetness * .22 + waterIndex * .24 + nursery * .15);
    }
    case 'carrion':
      return clamp01(.05 + decomposition * .34 + (site?.predatorOpportunity ?? .25) * .2 + cover * .16);
  }
}

function buildBaselineDemandAtK(world: GeneratedSpatialWorld): Map<string, MutableDemand> {
  const demandByPatch = new Map<string, MutableDemand>();
  for (const plan of world.faunaCommunity.species) {
    if (!plan.present) continue;
    const species = SPATIAL_FAUNA_SPECIES_BY_ID[plan.speciesId];
    if (!species) continue;
    const metabolicFactor = expectedMetabolicHeadFactor(species);
    const diet = normalizedDiet(species);
    for (const allocation of plan.patchAllocations) {
      if (allocation.carryingCapacity <= 0) continue;
      const demand = demandByPatch.get(allocation.patchId) ?? { food: emptyFoodRecord(), water: 0 };
      const metabolicAtK = allocation.carryingCapacity * metabolicFactor;
      const totalFood = metabolicAtK * species.dailyFoodKgPerAdult;
      for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
        demand.food[resource] += totalFood * diet[resource];
      }
      demand.water += metabolicAtK * species.dailyWaterNeed;
      demandByPatch.set(allocation.patchId, demand);
    }
  }
  return demandByPatch;
}

function buildPatchProfile(
  patch: HabitatPatch,
  world: GeneratedSpatialWorld,
  baseline: MutableDemand | undefined,
): SpatialFaunaPatchResourceProfile {
  const foodCapacityKg = emptyFoodRecord();
  const neutralFoodProductionKgPerDay = emptyFoodRecord();
  const baselineFoodDemandAtKPerDay = baseline?.food ?? emptyFoodRecord();

  for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
    const potential = resourceHabitatPotential(resource, patch, world);
    const areaCapacity = patch.areaKm2 * STANDING_KG_PER_KM2[resource] * potential;
    const demandCapacity = baselineFoodDemandAtKPerDay[resource] * MIN_RESERVE_DAYS_AT_K[resource];
    foodCapacityKg[resource] = Math.max(areaCapacity, demandCapacity);

    const areaProduction = patch.areaKm2 * DAILY_PRODUCTION_KG_PER_KM2[resource] * potential;
    const demandProduction = baselineFoodDemandAtKPerDay[resource] * MIN_NEUTRAL_PRODUCTION_HEADROOM_AT_K;
    neutralFoodProductionKgPerDay[resource] = Math.max(areaProduction, demandProduction);
  }

  const hydrology = world.hydrology.byPatchId[patch.id];
  const localWater = world.localSiteInfluenceByPatchId[patch.id]?.water ?? .25;
  const directFreshWater = localResourcePotential(world, patch.id, 'fresh_water');
  const waterIndex = hydrology?.waterIndex ?? 0;
  const flowSignal = clamp01(Math.log1p(hydrology?.flowAccumulationKm2 ?? patch.areaKm2) / Math.log(10));
  const waterPotential = clamp01(
    .05
      + waterIndex * .42
      + patch.terrain.wetness * .18
      + localWater * .13
      + directFreshWater * .12
      + flowSignal * .1,
  );
  const baselineWaterDemandAtKPerDay = baseline?.water ?? 0;
  const areaWaterCapacity = patch.areaKm2 * 2_500_000 * Math.max(.05, waterPotential) * (1 + flowSignal * 1.5);
  const freshWaterCapacityUnits = Math.max(
    areaWaterCapacity,
    baselineWaterDemandAtKPerDay * MIN_WATER_RESERVE_DAYS_AT_K,
  );
  const areaWaterRecharge = patch.areaKm2 * 120_000 * Math.max(.05, waterPotential) * (1 + flowSignal * 2.5);
  const neutralFreshWaterRechargeUnitsPerDay = Math.max(
    areaWaterRecharge,
    baselineWaterDemandAtKPerDay * MIN_WATER_RECHARGE_HEADROOM_AT_K,
  );

  return Object.freeze({
    patchId: patch.id,
    areaKm2: patch.areaKm2,
    foodCapacityKg: Object.freeze(foodCapacityKg),
    neutralFoodProductionKgPerDay: Object.freeze(neutralFoodProductionKgPerDay),
    baselineFoodDemandAtKPerDay: Object.freeze({ ...baselineFoodDemandAtKPerDay }),
    freshWaterCapacityUnits,
    neutralFreshWaterRechargeUnitsPerDay,
    baselineWaterDemandAtKPerDay,
  });
}

export function getSpatialFaunaResourceModel(world: GeneratedSpatialWorld): SpatialFaunaResourceModel {
  const cached = resourceModelCache.get(world);
  if (cached) return cached;

  const baselineByPatch = buildBaselineDemandAtK(world);
  const byPatchId: Record<string, SpatialFaunaPatchResourceProfile> = {};
  let totalFoodCapacityKg = 0;
  let totalNeutralFoodProductionKgPerDay = 0;
  let totalBaselineFoodDemandAtKPerDay = 0;
  let totalFreshWaterCapacityUnits = 0;
  let totalNeutralFreshWaterRechargeUnitsPerDay = 0;
  let totalBaselineWaterDemandAtKPerDay = 0;

  for (const patch of world.habitatPatches) {
    const profile = buildPatchProfile(patch, world, baselineByPatch.get(patch.id));
    byPatchId[patch.id] = profile;
    for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      totalFoodCapacityKg += profile.foodCapacityKg[resource];
      totalNeutralFoodProductionKgPerDay += profile.neutralFoodProductionKgPerDay[resource];
      totalBaselineFoodDemandAtKPerDay += profile.baselineFoodDemandAtKPerDay[resource];
    }
    totalFreshWaterCapacityUnits += profile.freshWaterCapacityUnits;
    totalNeutralFreshWaterRechargeUnitsPerDay += profile.neutralFreshWaterRechargeUnitsPerDay;
    totalBaselineWaterDemandAtKPerDay += profile.baselineWaterDemandAtKPerDay;
  }

  const model: SpatialFaunaResourceModel = Object.freeze({
    byPatchId: Object.freeze(byPatchId),
    totalFoodCapacityKg,
    totalNeutralFoodProductionKgPerDay,
    totalBaselineFoodDemandAtKPerDay,
    totalFreshWaterCapacityUnits,
    totalNeutralFreshWaterRechargeUnitsPerDay,
    totalBaselineWaterDemandAtKPerDay,
  });
  resourceModelCache.set(world, model);
  return model;
}

function foodSeasonMultiplier(resource: WildFoodResource, season: SpatialFaunaSeason): number {
  if (season === 'dry') {
    switch (resource) {
      case 'fruit': return .58;
      case 'seeds': return 1.08;
      case 'browse': return .82;
      case 'ground_vegetation': return .58;
      case 'roots_tubers': return .78;
      case 'insects': return .54;
      case 'aquatic_plants': return .56;
      case 'carrion': return .96;
    }
  }
  if (season === 'wet') {
    switch (resource) {
      case 'fruit': return 1.18;
      case 'seeds': return 1.04;
      case 'browse': return 1.08;
      case 'ground_vegetation': return 1.2;
      case 'roots_tubers': return 1.12;
      case 'insects': return 1.24;
      case 'aquatic_plants': return 1.16;
      case 'carrion': return 1;
    }
  }
  switch (resource) {
    case 'fruit': return .92;
    case 'seeds': return .78;
    case 'browse': return 1.02;
    case 'ground_vegetation': return 1.08;
    case 'roots_tubers': return 1.06;
    case 'insects': return 1.16;
    case 'aquatic_plants': return 1.38;
    case 'carrion': return 1.06;
  }
}

function waterSeasonMultiplier(profile: SpatialFaunaPatchResourceProfile, world: GeneratedSpatialWorld, season: SpatialFaunaSeason): number {
  const waterIndex = world.hydrology.byPatchId[profile.patchId]?.waterIndex ?? 0;
  if (season === 'dry') return .28 + waterIndex * .62;
  if (season === 'wet') return 1.22;
  return 1.5;
}

function initialFoodFill(resource: WildFoodResource, season: SpatialFaunaSeason): number {
  const seasonal = foodSeasonMultiplier(resource, season);
  return clamp01(.72 + Math.min(1.2, seasonal) * .18);
}

function initialWaterFill(profile: SpatialFaunaPatchResourceProfile, world: GeneratedSpatialWorld, season: SpatialFaunaSeason): number {
  if (season !== 'dry') return .92;
  const waterIndex = world.hydrology.byPatchId[profile.patchId]?.waterIndex ?? 0;
  return .62 + waterIndex * .28;
}

export function ensureSpatialFaunaResourcePools(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
): void {
  const model = getSpatialFaunaResourceModel(world);
  const stocks = runtime.resourceStocksByPatch ?? {};
  const livePatchIds = new Set(world.habitatPatches.map(patch => patch.id));

  for (const patchId of Object.keys(stocks)) {
    if (!livePatchIds.has(patchId)) delete stocks[patchId];
  }

  for (const patch of world.habitatPatches) {
    const profile = model.byPatchId[patch.id];
    if (!profile) continue;
    let stock = stocks[patch.id];
    if (!stock) {
      stock = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
        const index = FOOD_INDEX[resource];
        const jitter = .96 + spatialUnitRandom(runtime.worldSeed, `fauna-resource-fill|${patch.id}|${resource}`) * .08;
        stock[index] = roundStock(profile.foodCapacityKg[resource] * initialFoodFill(resource, season) * jitter);
      }
      const waterJitter = .97 + spatialUnitRandom(runtime.worldSeed, `fauna-resource-fill|${patch.id}|water`) * .06;
      stock[FRESH_WATER] = roundStock(profile.freshWaterCapacityUnits * initialWaterFill(profile, world, season) * waterJitter);
      stocks[patch.id] = stock;
    } else {
      for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
        const index = FOOD_INDEX[resource];
        stock[index] = roundStock(Math.min(profile.foodCapacityKg[resource], Math.max(0, stock[index] ?? 0)));
      }
      stock[FRESH_WATER] = roundStock(Math.min(profile.freshWaterCapacityUnits, Math.max(0, stock[FRESH_WATER] ?? 0)));
    }
  }

  runtime.resourceStocksByPatch = stocks;
}

function recoverResourcePools(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
): { foodRecoveredKg: number; waterRecoveredUnits: number } {
  ensureSpatialFaunaResourcePools(runtime, world, season);
  const model = getSpatialFaunaResourceModel(world);
  let foodRecoveredKg = 0;
  let waterRecoveredUnits = 0;

  for (const patch of world.habitatPatches) {
    const stock = runtime.resourceStocksByPatch?.[patch.id];
    const profile = model.byPatchId[patch.id];
    if (!stock || !profile) continue;

    for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      const index = FOOD_INDEX[resource];
      const capacity = profile.foodCapacityKg[resource];
      const fill = capacity > 0 ? clamp01(stock[index] / capacity) : 0;
      const recovery = Math.min(
        Math.max(0, capacity - stock[index]),
        profile.neutralFoodProductionKgPerDay[resource]
          * foodSeasonMultiplier(resource, season)
          * (.45 + (1 - fill) * .55),
      );
      stock[index] = roundStock(stock[index] + recovery);
      foodRecoveredKg += recovery;
    }

    const waterFill = profile.freshWaterCapacityUnits > 0
      ? clamp01(stock[FRESH_WATER] / profile.freshWaterCapacityUnits)
      : 0;
    const waterRecovery = Math.min(
      Math.max(0, profile.freshWaterCapacityUnits - stock[FRESH_WATER]),
      profile.neutralFreshWaterRechargeUnitsPerDay
        * waterSeasonMultiplier(profile, world, season)
        * (.5 + (1 - waterFill) * .5),
    );
    stock[FRESH_WATER] = roundStock(stock[FRESH_WATER] + waterRecovery);
    waterRecoveredUnits += waterRecovery;
  }

  return { foodRecoveredKg, waterRecoveredUnits };
}

export function tickSpatialFaunaResourcePools(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
): SpatialFaunaResourceDaySummary {
  const recovered = recoverResourcePools(runtime, world, season);
  const model = getSpatialFaunaResourceModel(world);
  const demandsByPatch = new Map<string, MutableDemand>();
  const demandBySpeciesPatch = new Map<string, { totalFood: number; water: number }>();

  for (const speciesState of runtime.species) {
    const species = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    if (!species) continue;
    const diet = normalizedDiet(species);
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const population = cohortPopulation(cohort);
      if (population <= 0 || !model.byPatchId[patchId]) continue;
      const metabolic = metabolicHeads(cohort);
      const totalFood = metabolic * species.dailyFoodKgPerAdult;
      const water = metabolic * species.dailyWaterNeed;
      const patchDemand = demandsByPatch.get(patchId) ?? { food: emptyFoodRecord(), water: 0 };
      for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
        patchDemand.food[resource] += totalFood * diet[resource];
      }
      patchDemand.water += water;
      demandsByPatch.set(patchId, patchDemand);
      demandBySpeciesPatch.set(`${patchId}|${species.id}`, { totalFood, water });
    }
  }

  const resourceSatisfactionByPatch = new Map<string, Record<WildFoodResource, number>>();
  const waterSatisfactionByPatch = new Map<string, number>();
  let foodConsumedKg = 0;
  let waterConsumedUnits = 0;

  for (const [patchId, demand] of demandsByPatch) {
    const stock = runtime.resourceStocksByPatch?.[patchId];
    if (!stock) continue;
    const foodSatisfaction = emptyFoodRecord();
    for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      const index = FOOD_INDEX[resource];
      const needed = demand.food[resource];
      const consumed = Math.min(stock[index], needed);
      foodSatisfaction[resource] = needed > 1e-9 ? clamp01(consumed / needed) : 1;
      stock[index] = roundStock(stock[index] - consumed);
      foodConsumedKg += consumed;
    }
    const waterConsumed = Math.min(stock[FRESH_WATER], demand.water);
    waterSatisfactionByPatch.set(patchId, demand.water > 1e-9 ? clamp01(waterConsumed / demand.water) : 1);
    stock[FRESH_WATER] = roundStock(stock[FRESH_WATER] - waterConsumed);
    waterConsumedUnits += waterConsumed;
    resourceSatisfactionByPatch.set(patchId, foodSatisfaction);
  }

  const sufficiencyByPatch = new Map<string, ReadonlyMap<string, SpatialFaunaPatchResourceSufficiency>>();
  let affectedPopulation = 0;
  let foodSufficiencyWeighted = 0;
  let waterSufficiencyWeighted = 0;
  let resourceLimitedCohortCount = 0;
  let resourceLimitedPopulation = 0;

  for (const speciesState of runtime.species) {
    const species = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    if (!species) continue;
    const diet = normalizedDiet(species);
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const population = cohortPopulation(cohort);
      if (population <= 0) continue;
      const resourceSatisfaction = resourceSatisfactionByPatch.get(patchId);
      const demand = demandBySpeciesPatch.get(`${patchId}|${species.id}`);
      if (!resourceSatisfaction || !demand) continue;
      let food = 0;
      for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
        food += diet[resource] * resourceSatisfaction[resource];
      }
      const water = waterSatisfactionByPatch.get(patchId) ?? 1;
      food = clamp01(food);
      const effective = clamp01(food * .68 + water * .32);

      // Actual shared stocks own food/water scarcity. Apply it before the core
      // demographic tick so mortality, breeding and stress movement react today.
      if (effective < .999) {
        cohort[CONDITION] = clamp01(cohort[CONDITION] * (.86 + effective * .14));
        if (food < .78 || water < .72) cohort[STRESS_DAYS] += 1;
      }

      const bySpecies = new Map(sufficiencyByPatch.get(patchId) ?? []);
      bySpecies.set(species.id, { food, water });
      sufficiencyByPatch.set(patchId, bySpecies);

      affectedPopulation += population;
      foodSufficiencyWeighted += food * population;
      waterSufficiencyWeighted += water * population;
      if (food < .92 || water < .9) {
        resourceLimitedCohortCount += 1;
        resourceLimitedPopulation += population;
      }
    }
  }

  let foodStockKg = 0;
  let waterStockUnits = 0;
  let foodFillWeighted = 0;
  let foodCapacityWeight = 0;
  let waterFillWeighted = 0;
  let waterCapacityWeight = 0;
  for (const patch of world.habitatPatches) {
    const stock = runtime.resourceStocksByPatch?.[patch.id];
    const profile = model.byPatchId[patch.id];
    if (!stock || !profile) continue;
    for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      const capacity = profile.foodCapacityKg[resource];
      const value = stock[FOOD_INDEX[resource]];
      foodStockKg += value;
      foodFillWeighted += (capacity > 0 ? value / capacity : 0) * capacity;
      foodCapacityWeight += capacity;
    }
    waterStockUnits += stock[FRESH_WATER];
    waterFillWeighted += (profile.freshWaterCapacityUnits > 0 ? stock[FRESH_WATER] / profile.freshWaterCapacityUnits : 0)
      * profile.freshWaterCapacityUnits;
    waterCapacityWeight += profile.freshWaterCapacityUnits;
  }

  return {
    foodStockKg,
    foodCapacityKg: model.totalFoodCapacityKg,
    foodRecoveredKg: recovered.foodRecoveredKg,
    foodConsumedKg,
    waterStockUnits,
    waterCapacityUnits: model.totalFreshWaterCapacityUnits,
    waterRecoveredUnits: recovered.waterRecoveredUnits,
    waterConsumedUnits,
    meanFoodPoolFill: foodCapacityWeight > 0 ? clamp01(foodFillWeighted / foodCapacityWeight) : 0,
    meanWaterPoolFill: waterCapacityWeight > 0 ? clamp01(waterFillWeighted / waterCapacityWeight) : 0,
    meanFoodSufficiency: affectedPopulation > 0 ? clamp01(foodSufficiencyWeighted / affectedPopulation) : 1,
    meanWaterSufficiency: affectedPopulation > 0 ? clamp01(waterSufficiencyWeighted / affectedPopulation) : 1,
    resourceLimitedCohortCount,
    resourceLimitedPopulation,
    affectedPopulation,
    sufficiencyByPatch,
  };
}
