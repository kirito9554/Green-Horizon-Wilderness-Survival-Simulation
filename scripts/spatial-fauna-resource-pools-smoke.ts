import assert from 'node:assert/strict';
import { SPATIAL_FAUNA_SPECIES_BY_ID } from '../src/data/spatialFauna';
import { SPATIAL_FAUNA_FOOD_RESOURCE_ORDER } from '../src/types/spatialFaunaSimulation';
import {
  createSpatialFaunaRuntimeState,
  getSpatialFaunaCohortPopulation,
  getSpatialFaunaRuntimePopulation,
} from '../src/simulation/spatial/spatialFaunaRuntime';
import { tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import {
  ensureSpatialFaunaResourcePools,
  getSpatialFaunaResourceModel,
  tickSpatialFaunaResourcePools,
} from '../src/simulation/spatial/spatialFaunaResourcePools';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

const MIN_AREA_SCALED_STANDING_KG_PER_KM2 = 50_000;
const MIN_AREA_SCALED_PRODUCTION_KG_PER_KM2_DAY = 500;

function validateResourceModel(seed: string): void {
  const world = generateSpatialWorld(seed);
  const model = getSpatialFaunaResourceModel(world);
  const totalAreaKm2 = world.habitatPatches.reduce((sum, patch) => sum + patch.areaKm2, 0);
  assert.ok(Math.abs(totalAreaKm2 - 120) < .001, `${seed}: resource model must cover the full 120 km² island`);
  assert.equal(Object.keys(model.byPatchId).length, world.habitatPatches.length, `${seed}: every patch needs a resource profile`);

  let minimumStandingDensity = Number.POSITIVE_INFINITY;
  let minimumProductionDensity = Number.POSITIVE_INFINITY;
  for (const patch of world.habitatPatches) {
    const profile = model.byPatchId[patch.id];
    assert.ok(profile, `${seed}: missing profile for ${patch.id}`);
    assert.ok(Math.abs(profile.areaKm2 - patch.areaKm2) < 1e-9, `${seed}: profile area must equal geometric patch area`);
    let patchFoodCapacity = 0;
    let patchProduction = 0;
    let patchBaselineDemand = 0;
    for (const resource of SPATIAL_FAUNA_FOOD_RESOURCE_ORDER) {
      const capacity = profile.foodCapacityKg[resource];
      const production = profile.neutralFoodProductionKgPerDay[resource];
      const demandAtK = profile.baselineFoodDemandAtKPerDay[resource];
      assert.ok(capacity >= 0 && production >= 0 && demandAtK >= 0, `${seed}:${patch.id}:${resource}: negative resource quantity`);
      if (demandAtK > 0) {
        assert.ok(capacity + 1e-6 >= demandAtK * 8, `${seed}:${patch.id}:${resource}: standing stock must retain at least the minimum eight-day K reserve`);
        assert.ok(production + 1e-6 >= demandAtK * 1.35, `${seed}:${patch.id}:${resource}: neutral production must exceed census-K demand by 35%`);
      }
      patchFoodCapacity += capacity;
      patchProduction += production;
      patchBaselineDemand += demandAtK;
    }
    const standingDensity = patchFoodCapacity / Math.max(1e-9, patch.areaKm2);
    const productionDensity = patchProduction / Math.max(1e-9, patch.areaKm2);
    minimumStandingDensity = Math.min(minimumStandingDensity, standingDensity);
    minimumProductionDensity = Math.min(minimumProductionDensity, productionDensity);
    assert.ok(standingDensity >= MIN_AREA_SCALED_STANDING_KG_PER_KM2, `${seed}:${patch.id}: resource pool too small for its area (${standingDensity.toFixed(0)} kg/km²)`);
    assert.ok(productionDensity >= MIN_AREA_SCALED_PRODUCTION_KG_PER_KM2_DAY, `${seed}:${patch.id}: resource productivity too small for its area (${productionDensity.toFixed(0)} kg/km²/day)`);
    if (patchBaselineDemand > 0) assert.ok(patchFoodCapacity > patchBaselineDemand * 8, `${seed}:${patch.id}: patch standing food reserve too shallow at K`);
    if (profile.baselineWaterDemandAtKPerDay > 0) {
      assert.ok(profile.freshWaterCapacityUnits + 1e-6 >= profile.baselineWaterDemandAtKPerDay * 45, `${seed}:${patch.id}: water storage must cover at least 45 K-demand days`);
      assert.ok(profile.neutralFreshWaterRechargeUnitsPerDay + 1e-6 >= profile.baselineWaterDemandAtKPerDay * 1.5, `${seed}:${patch.id}: neutral water recharge must exceed K demand by 50%`);
    }
  }
  assert.ok(model.totalFoodCapacityKg >= totalAreaKm2 * MIN_AREA_SCALED_STANDING_KG_PER_KM2, `${seed}: island food stock must scale with the full land area`);
  assert.ok(model.totalNeutralFoodProductionKgPerDay >= model.totalBaselineFoodDemandAtKPerDay * 1.35, `${seed}: island neutral production must support full census K with headroom`);
  assert.ok(model.totalFreshWaterCapacityUnits >= model.totalBaselineWaterDemandAtKPerDay * 45, `${seed}: island freshwater storage too small for full K`);
  console.log(
    `[${seed}] resource model area=${totalAreaKm2.toFixed(2)}km² `
      + `foodCapacity=${(model.totalFoodCapacityKg / 1_000_000).toFixed(2)}Mkg `
      + `neutralProduction=${model.totalNeutralFoodProductionKgPerDay.toFixed(0)}kg/day `
      + `KDemand=${model.totalBaselineFoodDemandAtKPerDay.toFixed(0)}kg/day `
      + `minPatchDensity=${minimumStandingDensity.toFixed(0)}kg/km² `
      + `minPatchProduction=${minimumProductionDensity.toFixed(0)}kg/km²/day`,
  );
}

function assertPersistentStocksAndConsumption(seed: string): void {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaRuntimeState(seed, 1, world);
  ensureSpatialFaunaResourcePools(runtime, world, 'dry');
  assert.ok(runtime.resourceStocksByPatch, `${seed}: resource stocks should materialize into persistent runtime state`);
  assert.equal(Object.keys(runtime.resourceStocksByPatch!).length, world.habitatPatches.length, `${seed}: every generated patch must persist one compact shared stock tuple`);
  const model = getSpatialFaunaResourceModel(world);
  let initialFoodStock = 0;
  for (const patch of world.habitatPatches) {
    const stock = runtime.resourceStocksByPatch![patch.id];
    const profile = model.byPatchId[patch.id];
    assert.ok(stock && profile, `${seed}: missing persistent resource tuple`);
    for (let i = 0; i < 8; i += 1) { assert.ok(stock[i] >= 0, `${seed}:${patch.id}: negative initial food stock`); initialFoodStock += stock[i]; }
    assert.ok(stock[8] >= 0 && stock[8] <= profile.freshWaterCapacityUnits + 1e-6, `${seed}:${patch.id}: invalid water stock`);
  }
  assert.ok(initialFoodStock > model.totalFoodCapacityKg * .6, `${seed}: campaign should not begin with an implausibly empty island`);
  const initialPopulation = getSpatialFaunaRuntimePopulation(runtime);
  let consumed = 0;
  let recovered = 0;
  for (let day = 2; day <= 31; day += 1) {
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day);
    consumed += telemetry.foodPoolConsumedKg ?? 0;
    recovered += telemetry.foodPoolRecoveredKg ?? 0;
    assert.ok((telemetry.foodPoolCapacityKg ?? 0) > 0, `${seed}: pool capacity telemetry missing`);
    assert.ok((telemetry.waterPoolCapacityUnits ?? 0) > 0, `${seed}: water capacity telemetry missing`);
    assert.ok((telemetry.meanFoodPoolFill ?? -1) >= 0 && (telemetry.meanFoodPoolFill ?? 2) <= 1, `${seed}: food fill telemetry invalid`);
    assert.ok((telemetry.meanWaterPoolFill ?? -1) >= 0 && (telemetry.meanWaterPoolFill ?? 2) <= 1, `${seed}: water fill telemetry invalid`);
  }
  assert.ok(consumed > 0 && recovered > 0, `${seed}: living fauna must both consume and regenerate shared stock`);
  assert.ok(getSpatialFaunaRuntimePopulation(runtime) >= initialPopulation * .8, `${seed}: one month of area-scaled pools should not collapse fauna`);
  const serializedBytes = Buffer.byteLength(JSON.stringify(runtime), 'utf8');
  assert.ok(serializedBytes < 5 * 1024 * 1024, `${seed}: full trophic save state too large (${(serializedBytes / 1024).toFixed(1)} KiB)`);
  console.log(
    `[${seed}] day31 consumed=${consumed.toFixed(0)}kg recovered=${recovered.toFixed(0)}kg `
      + `foodFill=${(runtime.telemetry.meanFoodPoolFill ?? 0).toFixed(3)} `
      + `waterFill=${(runtime.telemetry.meanWaterPoolFill ?? 0).toFixed(3)} `
      + `runtimeState=${(serializedBytes / 1024).toFixed(1)}KiB`,
  );
}

function assertMaterialScarcityResponse(seed: string): void {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaRuntimeState(seed, 1, world);
  ensureSpatialFaunaResourcePools(runtime, world, 'dry');
  const model = getSpatialFaunaResourceModel(world);
  let chosen: { patchId: string; speciesId: string; cohort: [number, number, number, number, number]; k: number } | undefined;
  for (const speciesState of runtime.species) {
    const plan = world.faunaCommunity.species.find(candidate => candidate.speciesId === speciesState.speciesId);
    if (!plan?.present) continue;
    for (const [patchId, cohort] of Object.entries(speciesState.cohortsByPatch)) {
      const k = plan.patchAllocations.find(allocation => allocation.patchId === patchId)?.carryingCapacity ?? 0;
      if (k >= 5 && getSpatialFaunaCohortPopulation(cohort) > 0) { chosen = { patchId, speciesId: speciesState.speciesId, cohort, k }; break; }
    }
    if (chosen) break;
  }
  assert.ok(chosen, `${seed}: need a populated patch to test material scarcity`);
  const species = SPATIAL_FAUNA_SPECIES_BY_ID[chosen!.speciesId];
  const profile = model.byPatchId[chosen!.patchId];
  assert.ok(species && profile, `${seed}: scarcity test needs species and patch resource profile`);
  const dietEntries = SPATIAL_FAUNA_FOOD_RESOURCE_ORDER.map(resource => ({ resource, share: Math.max(0, species!.diet[resource] ?? 0) })).filter(entry => entry.share > 0);
  const dietTotal = dietEntries.reduce((sum, entry) => sum + entry.share, 0);
  assert.ok(dietTotal > 0, `${seed}: scarcity test species needs a food diet`);
  let adultsNeededForFood = 0;
  for (const entry of dietEntries) {
    const normalizedShare = entry.share / dietTotal;
    const upperDailySupply = profile!.neutralFoodProductionKgPerDay[entry.resource] * 1.1;
    adultsNeededForFood = Math.max(adultsNeededForFood, upperDailySupply * 4 / Math.max(1e-9, species!.dailyFoodKgPerAdult * normalizedShare));
  }
  const adultsNeededForWater = profile!.neutralFreshWaterRechargeUnitsPerDay * 1.5 * 4 / Math.max(1e-9, species!.dailyWaterNeed);
  const artificialAdults = Math.ceil(Math.max(chosen!.k * 20, adultsNeededForFood, adultsNeededForWater));
  const stock = runtime.resourceStocksByPatch![chosen!.patchId];
  for (let i = 0; i < stock.length; i += 1) stock[i] = 0;
  chosen!.cohort[1] += artificialAdults;
  const conditionBefore = chosen!.cohort[3];
  const summary = tickSpatialFaunaResourcePools(runtime, world, 'dry');
  assert.ok(summary.resourceLimitedPopulation > 0, `${seed}: depleted overloaded patch should create resource-limited fauna`);
  assert.ok(summary.meanFoodSufficiency < 1 || summary.meanWaterSufficiency < 1, `${seed}: material depletion should reduce real sufficiency`);
  assert.ok(chosen!.cohort[3] < conditionBefore, `${seed}: material shortage must reduce cohort condition before demography`);
  console.log(
    `[${seed}] scarcity ${chosen!.speciesId} @ ${chosen!.patchId}: artificialAdults=${artificialAdults} `
      + `foodSuff=${summary.meanFoodSufficiency.toFixed(3)} waterSuff=${summary.meanWaterSufficiency.toFixed(3)} `
      + `limitedPop=${summary.resourceLimitedPopulation}`,
  );
}

function main(): void {
  validateResourceModel('spatial-fauna-alpha');
  validateResourceModel('spatial-fauna-beta');
  assertPersistentStocksAndConsumption('spatial-fauna-alpha');
  assertMaterialScarcityResponse('spatial-fauna-alpha');
  console.log('Area-scaled persistent spatial fauna resource-pool regression passed.');
}

main();
