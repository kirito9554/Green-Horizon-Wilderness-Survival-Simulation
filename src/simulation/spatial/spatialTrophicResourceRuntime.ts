import { SPATIAL_FAUNA_SPECIES_BY_ID, type SpatialFaunaSpeciesDefinition } from '../../data/spatialFauna';
import type { WildFoodResource } from '../../types/ecologySimulation';
import { SPATIAL_FAUNA_FOOD_RESOURCE_ORDER, type SpatialFaunaRuntimeState, type SpatialFaunaSeason, type SpatialFaunaPatchCohortState } from '../../types/spatialFaunaSimulation';
import type { SpatialFloraRuntimeState, SpatialInsectRuntimeState } from '../../types/spatialEcologySimulation';
import { applySpatialFloraConsumption, getSpatialFloraProductionByPatch } from './spatialFloraRuntime';
import { consumeSpatialInsectBiomass, getSpatialInsectAccessibleBiomassByPatch, getSpatialPollinationByPatch } from './spatialInsectRuntime';
import {
  ensureSpatialFaunaResourcePools,
  getSpatialFaunaResourceModel,
  type SpatialFaunaResourceDaySummary,
  type SpatialFaunaPatchResourceSufficiency,
  type SpatialFaunaResourceSufficiencyByPatch,
} from './spatialFaunaResourcePools';
import type { GeneratedSpatialWorld } from './worldGeneration';

const JUVENILES = 0, ADULTS = 1, OLD = 2, CONDITION = 3, STRESS_DAYS = 4, FRESH_WATER = 8;
const FOOD_INDEX: Readonly<Record<WildFoodResource, number>> = Object.freeze({ fruit: 0, seeds: 1, browse: 2, ground_vegetation: 3, roots_tubers: 4, insects: 5, aquatic_plants: 6, carrion: 7 });
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round3 = (v: number): number => Math.max(0, Math.round(v * 1000) / 1000);

interface MutableDemand { food: Record<WildFoodResource, number>; water: number }
function emptyFood(): Record<WildFoodResource, number> { return { fruit: 0, seeds: 0, browse: 0, ground_vegetation: 0, roots_tubers: 0, insects: 0, aquatic_plants: 0, carrion: 0 }; }
function population(c: SpatialFaunaPatchCohortState): number { return c[JUVENILES] + c[ADULTS] + c[OLD]; }
function metabolicHeads(c: SpatialFaunaPatchCohortState): number { return c[ADULTS] + c[OLD] * .9 + c[JUVENILES] * .55; }
function diet(def: SpatialFaunaSpeciesDefinition): Record<WildFoodResource, number> {
  const out = emptyFood();
  let total = 0;
  for (const r of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) total += Math.max(0, def.diet[r] ?? 0);
  if (total > 0) for (const r of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) out[r] = Math.max(0, def.diet[r] ?? 0) / total;
  return out;
}
function waterSeason(season: SpatialFaunaSeason, waterIndex: number): number { return season === 'dry' ? .28 + waterIndex * .62 : season === 'wet' ? 1.22 : 1.5; }
function plantSeason(resource: WildFoodResource, season: SpatialFaunaSeason): number {
  if (season === 'dry') return ({ fruit:.58,seeds:1.08,browse:.82,ground_vegetation:.58,roots_tubers:.78,insects:0,aquatic_plants:.56,carrion:0 } as Record<WildFoodResource,number>)[resource];
  if (season === 'wet') return ({ fruit:1.18,seeds:1.04,browse:1.08,ground_vegetation:1.2,roots_tubers:1.12,insects:0,aquatic_plants:1.16,carrion:0 } as Record<WildFoodResource,number>)[resource];
  return ({ fruit:.92,seeds:.78,browse:1.02,ground_vegetation:1.08,roots_tubers:1.06,insects:0,aquatic_plants:1.38,carrion:0 } as Record<WildFoodResource,number>)[resource];
}

export function tickSpatialTrophicResources(
  fauna: SpatialFaunaRuntimeState,
  flora: SpatialFloraRuntimeState,
  insects: SpatialInsectRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
): SpatialFaunaResourceDaySummary {
  ensureSpatialFaunaResourcePools(fauna, world, season);
  const model = getSpatialFaunaResourceModel(world);
  const pollination = getSpatialPollinationByPatch(insects);
  const floraProduction = getSpatialFloraProductionByPatch(flora, world, season, pollination);
  const insectAccessible = getSpatialInsectAccessibleBiomassByPatch(insects);
  let foodRecoveredKg = 0, waterRecoveredUnits = 0;

  for (const patch of world.habitatPatches) {
    const stock = fauna.resourceStocksByPatch?.[patch.id];
    const profile = model.byPatchId[patch.id];
    if (!stock || !profile) continue;
    const dynamic = floraProduction[patch.id];
    const dynamicByResource: Partial<Record<WildFoodResource, number>> = {
      fruit: dynamic?.fruit ?? 0, seeds: dynamic?.seeds ?? 0, browse: dynamic?.browse ?? 0,
      ground_vegetation: dynamic?.ground_vegetation ?? 0, roots_tubers: dynamic?.roots_tubers ?? 0,
      aquatic_plants: dynamic?.aquatic_plants ?? 0,
    };
    for (const resource of ['fruit','seeds','browse','ground_vegetation','roots_tubers','aquatic_plants'] as const) {
      const index = FOOD_INDEX[resource];
      const capacity = profile.foodCapacityKg[resource];
      const demandFloor = profile.baselineFoodDemandAtKPerDay[resource] * 1.22;
      const livingProduction = (dynamicByResource[resource] ?? 0) * plantSeason(resource, season);
      const background = profile.neutralFoodProductionKgPerDay[resource] * .035;
      const recoveryRate = Math.max(demandFloor, livingProduction + background);
      const fill = capacity > 0 ? clamp01(stock[index] / capacity) : 0;
      const recovery = Math.min(Math.max(0, capacity - stock[index]), recoveryRate * (.42 + (1 - fill) * .58));
      stock[index] = round3(stock[index] + recovery);
      foodRecoveredKg += recovery;
    }
    // Only exposed live insect biomass is edible. Egg/larval/refugial reserve stays
    // inside the insect community and can rebuild visible biomass after depletion.
    stock[FOOD_INDEX.insects] = round3(Math.min(profile.foodCapacityKg.insects, insectAccessible[patch.id] ?? 0));
    const carrionLoss = stock[FOOD_INDEX.carrion] * (season === 'dry' ? .035 : season === 'wet' ? .055 : .07);
    stock[FOOD_INDEX.carrion] = round3(Math.max(0, stock[FOOD_INDEX.carrion] - carrionLoss));
    const waterIndex = world.hydrology.byPatchId[patch.id]?.waterIndex ?? 0;
    const waterFill = profile.freshWaterCapacityUnits > 0 ? clamp01(stock[FRESH_WATER] / profile.freshWaterCapacityUnits) : 0;
    const waterRecovery = Math.min(Math.max(0, profile.freshWaterCapacityUnits - stock[FRESH_WATER]), profile.neutralFreshWaterRechargeUnitsPerDay * waterSeason(season, waterIndex) * (.5 + (1-waterFill)*.5));
    stock[FRESH_WATER] = round3(stock[FRESH_WATER] + waterRecovery);
    waterRecoveredUnits += waterRecovery;
  }

  const demands = new Map<string, MutableDemand>();
  const perSpeciesPatch = new Map<string, { totalFood:number; water:number }>();
  for (const speciesState of fauna.species) {
    const def = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    if (!def) continue;
    const normalized = diet(def);
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      if (population(cohort) <= 0 || !model.byPatchId[patchId]) continue;
      const metabolic = metabolicHeads(cohort);
      const totalFood = metabolic * def.dailyFoodKgPerAdult;
      const water = metabolic * def.dailyWaterNeed;
      const entry = demands.get(patchId) ?? { food: emptyFood(), water: 0 };
      for (const r of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) entry.food[r] += totalFood * normalized[r];
      entry.water += water;
      demands.set(patchId, entry);
      perSpeciesPatch.set(`${patchId}|${def.id}`, { totalFood, water });
    }
  }

  const foodSat = new Map<string, Record<WildFoodResource, number>>();
  const waterSat = new Map<string, number>();
  let foodConsumedKg = 0, waterConsumedUnits = 0, insectConsumedKg = 0;
  for (const [patchId, demand] of demands) {
    const stock = fauna.resourceStocksByPatch?.[patchId];
    if (!stock) continue;
    const sat = emptyFood();
    for (const r of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      const index = FOOD_INDEX[r];
      const needed = demand.food[r];
      if (r === 'insects') {
        const requested = Math.min(stock[index], needed);
        const actual = requested > 0 ? consumeSpatialInsectBiomass(insects, patchId, requested) : 0;
        sat[r] = needed > 1e-9 ? clamp01(actual / needed) : 1;
        insectConsumedKg += actual;
        foodConsumedKg += actual;
        stock[index] = round3(getSpatialInsectAccessibleBiomassByPatch(insects)[patchId] ?? 0);
        continue;
      }
      const consumed = Math.min(stock[index], needed);
      sat[r] = needed > 1e-9 ? clamp01(consumed / needed) : 1;
      stock[index] = round3(stock[index] - consumed);
      foodConsumedKg += consumed;
      if (r !== 'carrion' && consumed > 0) applySpatialFloraConsumption(flora, patchId, r as 'fruit'|'seeds'|'browse'|'ground_vegetation'|'roots_tubers'|'aquatic_plants', consumed);
    }
    const consumedWater = Math.min(stock[FRESH_WATER], demand.water);
    stock[FRESH_WATER] = round3(stock[FRESH_WATER] - consumedWater);
    waterConsumedUnits += consumedWater;
    waterSat.set(patchId, demand.water > 1e-9 ? clamp01(consumedWater / demand.water) : 1);
    foodSat.set(patchId, sat);
  }

  const sufficiencyByPatch = new Map<string, ReadonlyMap<string, SpatialFaunaPatchResourceSufficiency>>();
  let affectedPopulation = 0, foodWeighted = 0, waterWeighted = 0, resourceLimitedCohortCount = 0, resourceLimitedPopulation = 0;
  for (const speciesState of fauna.species) {
    const def = SPATIAL_FAUNA_SPECIES_BY_ID[speciesState.speciesId];
    if (!def) continue;
    const normalized = diet(def);
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const pop = population(cohort);
      if (pop <= 0) continue;
      const sat = foodSat.get(patchId), demand = perSpeciesPatch.get(`${patchId}|${def.id}`);
      if (!sat || !demand) continue;
      let food = 0;
      for (const r of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) food += normalized[r] * sat[r];
      food = clamp01(food);
      const water = waterSat.get(patchId) ?? 1;
      const effective = clamp01(food*.68 + water*.32);
      if (effective < .999) { cohort[CONDITION] = clamp01(cohort[CONDITION] * (.86 + effective*.14)); if (food < .78 || water < .72) cohort[STRESS_DAYS] += 1; }
      const perSpecies = new Map(sufficiencyByPatch.get(patchId) ?? []);
      perSpecies.set(def.id, { food, water }); sufficiencyByPatch.set(patchId, perSpecies);
      affectedPopulation += pop; foodWeighted += food*pop; waterWeighted += water*pop;
      if (food < .92 || water < .9) { resourceLimitedCohortCount++; resourceLimitedPopulation += pop; }
    }
  }

  let foodStockKg=0, waterStockUnits=0, foodFillWeighted=0, foodCapacityWeight=0, waterFillWeighted=0, waterCapacityWeight=0;
  for (const patch of world.habitatPatches) {
    const stock = fauna.resourceStocksByPatch?.[patch.id], profile=model.byPatchId[patch.id]; if (!stock || !profile) continue;
    for (const r of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) { const cap=profile.foodCapacityKg[r], val=stock[FOOD_INDEX[r]]; foodStockKg+=val; foodFillWeighted+=(cap>0?val/cap:0)*cap; foodCapacityWeight+=cap; }
    waterStockUnits+=stock[FRESH_WATER]; waterFillWeighted+=(profile.freshWaterCapacityUnits>0?stock[FRESH_WATER]/profile.freshWaterCapacityUnits:0)*profile.freshWaterCapacityUnits; waterCapacityWeight+=profile.freshWaterCapacityUnits;
  }
  insects.telemetry.consumedByFaunaKg = insectConsumedKg;
  return {
    foodStockKg, foodCapacityKg:model.totalFoodCapacityKg, foodRecoveredKg, foodConsumedKg,
    waterStockUnits, waterCapacityUnits:model.totalFreshWaterCapacityUnits, waterRecoveredUnits, waterConsumedUnits,
    meanFoodPoolFill: foodCapacityWeight>0?clamp01(foodFillWeighted/foodCapacityWeight):0,
    meanWaterPoolFill: waterCapacityWeight>0?clamp01(waterFillWeighted/waterCapacityWeight):0,
    meanFoodSufficiency: affectedPopulation>0?clamp01(foodWeighted/affectedPopulation):1,
    meanWaterSufficiency: affectedPopulation>0?clamp01(waterWeighted/affectedPopulation):1,
    resourceLimitedCohortCount, resourceLimitedPopulation, affectedPopulation,
    sufficiencyByPatch: sufficiencyByPatch as SpatialFaunaResourceSufficiencyByPatch,
  };
}
