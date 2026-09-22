import assert from 'node:assert/strict';
import { SPATIAL_FLORA_SPECIES } from '../src/data/spatialFlora';
import { SPATIAL_INSECT_SPECIES } from '../src/data/spatialInsects';
import { SPATIAL_PREDATOR_SPECIES } from '../src/data/spatialPredators';
import { SPATIAL_FAUNA_SPECIES } from '../src/data/spatialFauna';
import { createSpatialFaunaEcosystemState, tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import { getSpatialFaunaRuntimePopulation, tickSpatialFaunaDay } from '../src/simulation/spatial/spatialFaunaRuntime';
import { createSpatialFloraRuntimeState } from '../src/simulation/spatial/spatialFloraRuntime';
import { consumeSpatialInsectBiomass, createSpatialInsectRuntimeState, tickSpatialInsectsDay } from '../src/simulation/spatial/spatialInsectRuntime';
import { tickSpatialPredatorsDay } from '../src/simulation/spatial/spatialPredatorRuntime';
import { tickSpatialTrophicResources } from '../src/simulation/spatial/spatialTrophicResourceRuntime';
import {
  estimateReachableBreeders,
  getBehaviorPatchesWithinRange,
  getFaunaBehaviorProfile,
  getPredatorBehaviorProfile,
} from '../src/simulation/spatial/spatialAnimalBehavior';
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
  assert.ok(SPATIAL_PREDATOR_SPECIES.every(s => s.matingRangeKm >= s.homeRangeKm), 'predator mating ranges should span at least their normal home range');
  assert.ok(SPATIAL_FAUNA_SPECIES.filter(s => (s.diet.insects ?? 0) >= .25).length >= 8, 'insects should be a major diet component for many fauna species');
}

function multiHopBreedingNeighborhood(seed: string): void {
  const world = generateSpatialWorld(seed);
  const predator = [...SPATIAL_PREDATOR_SPECIES].sort((a, b) => b.matingRangeKm - a.matingRangeKm)[0];
  let selected: { start: string; target: string } | undefined;
  for (const patch of world.habitatPatches) {
    const direct = new Set((world.routeGraph.edgesByPatchId[patch.id] ?? []).map(edge => edge.toPatchId));
    const target = getBehaviorPatchesWithinRange(world, patch.id, predator.matingRangeKm)
      .find(entry => entry.patchId !== patch.id && !direct.has(entry.patchId));
    if (target) { selected = { start: patch.id, target: target.patchId }; break; }
  }
  assert.ok(selected, `${seed}: expected at least one multi-hop mating neighborhood`);
  const breeders = new Map<string, number>([[selected!.start, 1], [selected!.target, 1]]);
  const reachable = estimateReachableBreeders(world, selected!.start, predator.matingRangeKm, breeders);
  assert.ok(reachable > 1, `${seed}: predator breeder pool must include reachable mates beyond the immediate patch graph`);

  const mobileFauna = SPATIAL_FAUNA_SPECIES.find(species => species.guild === 'bat') ?? SPATIAL_FAUNA_SPECIES[0];
  const faunaProfile = getFaunaBehaviorProfile(mobileFauna);
  const faunaReach = getBehaviorPatchesWithinRange(world, selected!.start, faunaProfile.dispersalRangeKm);
  assert.ok(faunaReach.length > (world.routeGraph.edgesByPatchId[selected!.start]?.length ?? 0) + 1, `${seed}: fauna dispersal range must traverse multiple graph hops`);
}

function softRecolonizationSafetyNet(seed: string): void {
  const world = generateSpatialWorld(seed);
  const faunaRuntime = createSpatialFaunaEcosystemState(seed, 1, world);
  const faunaState = faunaRuntime.species[0];
  const faunaDef = SPATIAL_FAUNA_SPECIES.find(def => def.id === faunaState.speciesId)!;
  const faunaProfile = getFaunaBehaviorProfile(faunaDef);
  faunaState.cohortsByPatch = {};
  faunaState.globalAbsenceDays = faunaProfile.recolonizationDelayDays[1];
  const faunaTelemetry = tickSpatialFaunaDay(faunaRuntime, world, 5000);
  const faunaFounders = Object.values(faunaState.cohortsByPatch).reduce((sum, cohort) => sum + cohort[0] + cohort[1] + cohort[2], 0);
  assert.ok(faunaFounders > 0, `${seed}: globally extinct fauna should eventually receive ecological founders`);
  assert.ok(faunaFounders <= faunaProfile.recolonizationFounderCount[1], `${seed}: fauna recolonization must stay founder-sized, not refill population`);
  assert.ok((faunaTelemetry.recolonizedIndividuals ?? 0) > 0, `${seed}: fauna recolonization should be visible in telemetry`);

  const predatorRuntime = createSpatialFaunaEcosystemState(`${seed}-predator`, 1, generateSpatialWorld(`${seed}-predator`));
  const predatorWorld = generateSpatialWorld(`${seed}-predator`);
  const predatorState = predatorRuntime.predatorSystem!.species.find(state => state.speciesId === 'PREDATOR_MONITOR_LIZARD')!;
  const predatorDef = SPATIAL_PREDATOR_SPECIES.find(def => def.id === predatorState.speciesId)!;
  const predatorProfile = getPredatorBehaviorProfile(predatorDef);
  predatorState.cohortsByPatch = {};
  predatorState.globalAbsenceDays = predatorProfile.recolonizationDelayDays[1];
  const predatorTelemetry = tickSpatialPredatorsDay(predatorRuntime.predatorSystem!, predatorRuntime, predatorWorld, 5000, 'wet');
  const predatorFounders = Object.values(predatorState.cohortsByPatch).reduce((sum, cohort) => sum + cohort[0] + cohort[1] + cohort[2], 0);
  assert.ok(predatorFounders > 0, `${seed}: extinct predator should eventually receive external dispersing founders`);
  assert.ok(predatorFounders <= predatorProfile.recolonizationFounderCount[1], `${seed}: predator soft respawn must never refill a whole population`);
  assert.ok((predatorTelemetry.immigrants ?? 0) > 0, `${seed}: predator immigration should be visible in telemetry`);
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
  for (const runtime of [healthy, bare]) for (const stock of Object.values(runtime.resourceStocksByPatch ?? {})) for (const index of PLANT_RESOURCE_INDEXES) stock[index] = 0;
  for (const species of bare.floraSystem!.species) for (const state of Object.values(species.patches)) state[0] = 0;
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

  let kills = 0, killedBiomass = 0, insectConsumption = 0, predatorBirths = 0, predatorDeaths = 0;
  let faunaMateMoves = 0, faunaNatalMoves = 0, faunaGroupMoves = 0;
  let predatorMateMoves = 0, predatorNatalMoves = 0, predatorTerritoryMoves = 0, predatorImmigrants = 0;
  let minimumInsectBiomass = initialInsects;
  for (let day = 2; day <= days; day += 1) {
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day);
    kills += telemetry.predatorKills ?? 0;
    killedBiomass += telemetry.predatorKillBiomassKg ?? 0;
    insectConsumption += telemetry.insectConsumedKg ?? 0;
    faunaMateMoves += telemetry.mateSearchMoved ?? 0;
    faunaNatalMoves += telemetry.natalDispersed ?? 0;
    faunaGroupMoves += telemetry.groupSplitMoved ?? 0;
    predatorBirths += runtime.predatorSystem!.telemetry.births;
    predatorDeaths += runtime.predatorSystem!.telemetry.deaths;
    predatorMateMoves += runtime.predatorSystem!.telemetry.mateSearchMoved ?? 0;
    predatorNatalMoves += runtime.predatorSystem!.telemetry.natalDispersed ?? 0;
    predatorTerritoryMoves += runtime.predatorSystem!.telemetry.territorySettled ?? 0;
    predatorImmigrants += runtime.predatorSystem!.telemetry.immigrants ?? 0;
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
  console.log(`[${seed}] day${days} flora=${(finalFlora/1e6).toFixed(1)}Mkg insects=${(finalInsects/1000).toFixed(1)}t prey=${finalPrey}/${world.faunaCommunity.totalCarryingCapacity} predators=${finalPredators} kills=${kills} killMass=${killedBiomass.toFixed(1)}kg predBirths=${predatorBirths} predDeaths=${predatorDeaths} faunaMoves(mate/natal/group)=${faunaMateMoves}/${faunaNatalMoves}/${faunaGroupMoves} predatorMoves(mate/natal/settle)=${predatorMateMoves}/${predatorNatalMoves}/${predatorTerritoryMoves} immigrants=${predatorImmigrants} insectEaten=${insectConsumption.toFixed(1)}kg state=${(serializedBytes/1024).toFixed(0)}KiB`);
  return { finalPrey, finalFlora, finalInsects, finalPredators, kills, killedBiomass, predatorBirths, predatorDeaths, faunaMateMoves, faunaNatalMoves, faunaGroupMoves, predatorMateMoves, predatorNatalMoves, predatorTerritoryMoves };
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
multiHopBreedingNeighborhood('spatial-animal-behavior-range');
softRecolonizationSafetyNet('spatial-animal-recolonization');
insectReserveRecovery('spatial-trophic-insect-reserve');
floraOwnsPlantRenewal('spatial-trophic-flora-ownership');
const alpha = runWorld('spatial-trophic-alpha', 90);
const beta = runWorld('spatial-trophic-beta', 60);
assert.ok(alpha.predatorDeaths + beta.predatorDeaths > 0, 'small spatial predator cohorts must experience fractional natural/hunger mortality instead of flooring all expected deaths to zero');
assert.ok(alpha.faunaNatalMoves + beta.faunaNatalMoves > 0, 'maturing fauna should produce real natal dispersal between habitat patches');
assert.ok(alpha.predatorMateMoves + beta.predatorMateMoves + alpha.predatorNatalMoves + beta.predatorNatalMoves > 0, 'predators should move for social/territorial reasons, not only hunger');
deterministicShortRun('spatial-trophic-determinism');
console.log('Full spatial terrestrial trophic ecosystem regression passed.');
