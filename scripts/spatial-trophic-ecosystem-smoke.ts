import assert from 'node:assert/strict';
import { SPATIAL_FLORA_SPECIES } from '../src/data/spatialFlora';
import { SPATIAL_INSECT_SPECIES } from '../src/data/spatialInsects';
import { SPATIAL_PREDATOR_SPECIES } from '../src/data/spatialPredators';
import { SPATIAL_FAUNA_SPECIES } from '../src/data/spatialFauna';
import { createSpatialFaunaEcosystemState, tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import { getSpatialFaunaRuntimePopulation } from '../src/simulation/spatial/spatialFaunaRuntime';
import { createSpatialFloraRuntimeState } from '../src/simulation/spatial/spatialFloraRuntime';
import { consumeSpatialInsectBiomass, createSpatialInsectRuntimeState, tickSpatialInsectsDay } from '../src/simulation/spatial/spatialInsectRuntime';
import { tickSpatialTrophicResources } from '../src/simulation/spatial/spatialTrophicResourceRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

const REQUIRED_FLORA_STRATA = ['emergent','canopy','subcanopy','understory_tree','shrub','herb','groundcover','fern','vine','epiphyte','reed_sedge','mangrove','aquatic'] as const;
const REQUIRED_INSECT_GUILDS = ['pollinator','folivore','frugivore','seed_feeder','wood_borer','detritivore','dung_feeder','carrion_feeder','fungivore','predator','blood_feeder','aquatic_larva'] as const;
const PLANT_RESOURCE_INDEXES = [0, 1, 2, 3, 4, 6] as const;

function catalogCoverage(): void {
  assert.ok(SPATIAL_FLORA_SPECIES.length >= 40, `expected >=40 spatial flora taxa/guilds, got ${SPATIAL_FLORA_SPECIES.length}`);
  assert.equal(new Set(SPATIAL_FLORA_SPECIES.map(s => s.id)).size, SPATIAL_FLORA_SPECIES.length, 'flora ids must be unique');
  const strata = new Set(SPATIAL_FLORA_SPECIES.map(s => s.stratum));
  for (const stratum of REQUIRED_FLORA_STRATA) assert.ok(strata.has(stratum), `flora stratum missing: ${stratum}`);
  assert.ok(SPATIAL_FLORA_SPECIES.filter(s => s.roles.includes('fruit_source')).length >= 8, 'need diverse fruit-producing flora');
  assert.ok(SPATIAL_FLORA_SPECIES.filter(s => s.roles.includes('pollinator_host')).length >= 8, 'need pollinator-host flora');
  assert.ok(SPATIAL_FLORA_SPECIES.filter(s => s.roles.includes('insect_host')).length >= 10, 'need insect-host flora');

  assert.ok(SPATIAL_INSECT_SPECIES.length >= 20, `expected >=20 insect taxa/guilds, got ${SPATIAL_INSECT_SPECIES.length}`);
  assert.equal(new Set(SPATIAL_INSECT_SPECIES.map(s => s.id)).size, SPATIAL_INSECT_SPECIES.length, 'insect ids must be unique');
  const guilds = new Set(SPATIAL_INSECT_SPECIES.map(s => s.guild));
  for (const guild of REQUIRED_INSECT_GUILDS) assert.ok(guilds.has(guild), `insect guild missing: ${guild}`);
  assert.ok(SPATIAL_INSECT_SPECIES.some(s => s.pollinationValue >= .9), 'strong pollinators required');
  assert.ok(SPATIAL_INSECT_SPECIES.some(s => s.decompositionValue >= .9), 'strong decomposers required');
  assert.ok(SPATIAL_INSECT_SPECIES.some(s => s.aquaticExportValue >= .9), 'aquatic insect export required');

  assert.equal(SPATIAL_PREDATOR_SPECIES.length, 5, 'all five terrestrial predator definitions should be metric spatial predators');
  assert.ok(SPATIAL_FAUNA_SPECIES.filter(s => (s.diet.insects ?? 0) >= .25).length >= 8, 'insects should be a major diet component for many fauna species');
}

function insectReserveRecovery(seed: string): void {
  const world = generateSpatialWorld(seed);
  const flora = createSpatialFloraRuntimeState(world, 1);
  const insects = createSpatialInsectRuntimeState(world, flora, 1);
  let target: { patchId: string; state: [number, number, number] } | undefined;
  for (const species of insects.species) {
    for (const [patchId, state] of Object.entries(species.patches)) {
      if (state[0] > 1) { target = { patchId, state }; break; }
    }
    if (target) break;
  }
  assert.ok(target, `${seed}: need an insect population for reserve test`);
  const starting = target!.state[0];
  target!.state[0] = Math.max(.001, starting * .00001);
  target!.state[1] = .92;
  target!.state[2] = .9;
  const depleted = target!.state[0];
  tickSpatialInsectsDay(insects, world, flora, 2, 'wet');
  assert.ok(target!.state[0] > depleted, `${seed}: egg/larval reserve must rebuild severely depleted live insect biomass`);
  const beforePredation = target!.state[0];
  const eaten = consumeSpatialInsectBiomass(insects, target!.patchId, 1e12);
  assert.ok(eaten > 0, `${seed}: live insects should be consumable by fauna`);
  assert.ok(target!.state[0] > 0 && target!.state[0] < beforePredation, `${seed}: predation must deplete live biomass but preserve hidden/refugial reserve`);
}

function floraOwnsPlantRenewal(seed: string): void {
  const world = generateSpatialWorld(seed);
  const healthy = createSpatialFaunaEcosystemState(seed, 1, world);
  const bare = structuredClone(healthy);
  assert.ok(healthy.floraSystem && healthy.insectSystem && bare.floraSystem && bare.insectSystem, `${seed}: trophic layers required`);

  for (const runtime of [healthy, bare]) {
    for (const stock of Object.values(runtime.resourceStocksByPatch ?? {})) {
      for (const index of PLANT_RESOURCE_INDEXES) stock[index] = 0;
    }
  }
  for (const species of bare.floraSystem!.species) {
    for (const state of Object.values(species.patches)) state[0] = 0;
  }

  const healthySummary = tickSpatialTrophicResources(healthy, healthy.floraSystem!, healthy.insectSystem!, world, 'wet');
  const bareSummary = tickSpatialTrophicResources(bare, bare.floraSystem!, bare.insectSystem!, world, 'wet');
  assert.ok(healthySummary.foodRecoveredKg > bareSummary.foodRecoveredKg * 1.05, `${seed}: living flora must materially raise plant-food renewal (${healthySummary.foodRecoveredKg.toFixed(1)} vs ${bareSummary.foodRecoveredKg.toFixed(1)}kg)`);
  assert.ok(bareSummary.foodRecoveredKg > 0, `${seed}: small untracked background flora should remain represented`);
}

function runWorld(seed: string, days = 90) {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaEcosystemState(seed, 1, world);
  assert.ok(runtime.floraSystem && runtime.insectSystem && runtime.predatorSystem, `${seed}: all trophic layers must persist in spatial state`);
  const initialPrey = getSpatialFaunaRuntimePopulation(runtime);
  const initialFlora = runtime.floraSystem!.telemetry.totalBiomassKg;
  const initialInsects = runtime.insectSystem!.telemetry.totalBiomassKg;
  const initialPredators = runtime.predatorSystem!.telemetry.totalPopulation;
  assert.ok(initialFlora > 20_000_000, `${seed}: metric flora biomass is too small for 120 km² (${initialFlora.toFixed(0)}kg)`);
  assert.ok(initialInsects > 40_000, `${seed}: insect biomass is too small to be a major trophic resource (${initialInsects.toFixed(0)}kg)`);
  assert.ok(initialPredators >= 10, `${seed}: spatial predator community failed to establish (${initialPredators})`);
  assert.ok(runtime.predatorSystem!.telemetry.presentSpecies >= 4, `${seed}: expected at least four predator species`);

  let kills = 0;
  let killedBiomass = 0;
  let insectConsumption = 0;
  let minimumInsectBiomass = initialInsects;
  for (let day = 2; day <= days; day += 1) {
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day);
    kills += telemetry.predatorKills ?? 0;
    killedBiomass += telemetry.predatorKillBiomassKg ?? 0;
    insectConsumption += telemetry.insectConsumedKg ?? 0;
    minimumInsectBiomass = Math.min(minimumInsectBiomass, runtime.insectSystem!.telemetry.totalBiomassKg);
  }
  const finalPrey = getSpatialFaunaRuntimePopulation(runtime);
  const finalFlora = runtime.floraSystem!.telemetry.totalBiomassKg;
  const finalInsects = runtime.insectSystem!.telemetry.totalBiomassKg;
  const finalPredators = runtime.predatorSystem!.telemetry.totalPopulation;
  assert.ok(kills > 0 && killedBiomass > 0, `${seed}: predators must search, encounter and remove real prey cohorts`);
  assert.ok(insectConsumption > 0, `${seed}: insectivorous fauna must consume live insect biomass`);
  assert.ok(finalInsects > initialInsects * .35 && minimumInsectBiomass > 0, `${seed}: insect trophic layer collapsed`);
  assert.ok(finalFlora > initialFlora * .65, `${seed}: flora layer collapsed in ${days} days`);
  assert.ok(finalPrey > initialPrey * .55, `${seed}: migrated food web caused prey collapse`);
  assert.ok(finalPredators > 0, `${seed}: predator community went extinct`);
  const serializedBytes = Buffer.byteLength(JSON.stringify(runtime), 'utf8');
  assert.ok(serializedBytes < 5 * 1024 * 1024, `${seed}: aggregate trophic state too large (${(serializedBytes/1024/1024).toFixed(2)}MiB)`);
  console.log(`[${seed}] day${days} flora=${(finalFlora/1e6).toFixed(1)}Mkg insects=${(finalInsects/1000).toFixed(1)}t prey=${finalPrey}/${world.faunaCommunity.totalCarryingCapacity} predators=${finalPredators} kills=${kills} killMass=${killedBiomass.toFixed(1)}kg insectEaten=${insectConsumption.toFixed(1)}kg state=${(serializedBytes/1024).toFixed(0)}KiB`);
  return { finalPrey, finalFlora, finalInsects, finalPredators, kills, killedBiomass };
}

function deterministicShortRun(seed: string): void {
  const worldA = generateSpatialWorld(seed);
  const worldB = generateSpatialWorld(seed);
  const a = createSpatialFaunaEcosystemState(seed, 1, worldA);
  const b = createSpatialFaunaEcosystemState(seed, 1, worldB);
  for (let day = 2; day <= 12; day += 1) {
    tickSpatialFaunaEcosystemDay(a, worldA, day);
    tickSpatialFaunaEcosystemDay(b, worldB, day);
  }
  assert.deepEqual(a, b, `${seed}: same seed/day must reproduce complete trophic state`);
}

catalogCoverage();
insectReserveRecovery('spatial-trophic-insect-reserve');
floraOwnsPlantRenewal('spatial-trophic-flora-ownership');
runWorld('spatial-trophic-alpha', 90);
runWorld('spatial-trophic-beta', 60);
deterministicShortRun('spatial-trophic-determinism');
console.log('Full spatial terrestrial trophic ecosystem regression passed.');
