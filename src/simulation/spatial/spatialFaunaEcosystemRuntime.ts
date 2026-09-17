import type { GameState } from '../../types';
import '../../types/buildingSimulation';
import '../../types/spatialFaunaSimulation';
import type { SpatialFaunaDailyTelemetry, SpatialFaunaRuntimeState } from '../../types/spatialFaunaSimulation';
import { applySpatialFaunaCompetitionPressure, type SpatialFaunaCompetitionSummary } from './spatialFaunaCompetition';
import {
  SPATIAL_FAUNA_RUNTIME_VERSION,
  createSpatialFaunaRuntimeState,
  getSpatialFaunaRuntimePopulation,
  getSpatialFaunaSeason,
  tickSpatialFaunaDay,
} from './spatialFaunaRuntime';
import { ensureSpatialFaunaResourcePools, type SpatialFaunaResourceDaySummary } from './spatialFaunaResourcePools';
import { createSpatialFloraRuntimeState, summarizeSpatialFlora, tickSpatialFloraDay } from './spatialFloraRuntime';
import {
  createSpatialInsectRuntimeState,
  getSpatialPollinationByPatch,
  summarizeSpatialInsects,
  tickSpatialInsectsDay,
} from './spatialInsectRuntime';
import { applySpatialInsectPlantEffects } from './spatialInsectPlantBridge';
import { SPATIAL_PREDATOR_RUNTIME_VERSION, createSpatialPredatorRuntimeState, tickSpatialPredatorsDay } from './spatialPredatorRuntime';
import { tickSpatialTrophicResources } from './spatialTrophicResourceRuntime';
import { generateSpatialWorld, getSpatialWorldSeed, type GeneratedSpatialWorld } from './worldGeneration';

export const SPATIAL_FAUNA_INTERACTION_VERSION = 5;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function ensureSpatialTrophicLayers(runtime: SpatialFaunaRuntimeState, world: GeneratedSpatialWorld, day: number): void {
  runtime.floraSystem ??= createSpatialFloraRuntimeState(world, day);
  runtime.insectSystem ??= createSpatialInsectRuntimeState(world, runtime.floraSystem, day);
  if (!runtime.predatorSystem || runtime.predatorSystem.version !== SPATIAL_PREDATOR_RUNTIME_VERSION) {
    runtime.predatorSystem = createSpatialPredatorRuntimeState(world, day);
  }
  runtime.interactionVersion = SPATIAL_FAUNA_INTERACTION_VERSION;
}

function refreshLivingProducerTelemetry(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  season: ReturnType<typeof getSpatialFaunaSeason>,
): void {
  if (!runtime.floraSystem || !runtime.insectSystem) return;
  const pollination = getSpatialPollinationByPatch(runtime.insectSystem);
  const floraPrevious = runtime.floraSystem.telemetry;
  runtime.floraSystem.telemetry = summarizeSpatialFlora(
    runtime.floraSystem,
    world,
    season,
    pollination,
    floraPrevious.colonizedPatches,
    floraPrevious.localExtirpations,
  );
  const insectPrevious = runtime.insectSystem.telemetry;
  runtime.insectSystem.telemetry = summarizeSpatialInsects(
    runtime.insectSystem,
    season,
    insectPrevious.producedBiomassKg,
    insectPrevious.consumedByFaunaKg,
  );
}

function attachEcosystemTelemetry(runtime: SpatialFaunaRuntimeState, telemetry: SpatialFaunaDailyTelemetry, competition: SpatialFaunaCompetitionSummary, resources: SpatialFaunaResourceDaySummary): void {
  telemetry.meanFoodCompetitionPressure = competition.meanFoodPressure;
  telemetry.meanWaterCompetitionPressure = competition.meanWaterPressure;
  telemetry.meanRefugeCompetitionPressure = competition.meanRefugePressure;
  telemetry.competitionLimitedCohortCount = competition.limitedCohortCount;
  telemetry.competitionLimitedPopulation = competition.limitedPopulation;
  telemetry.foodPoolStockKg = resources.foodStockKg;
  telemetry.foodPoolCapacityKg = resources.foodCapacityKg;
  telemetry.foodPoolRecoveredKg = resources.foodRecoveredKg;
  telemetry.foodPoolConsumedKg = resources.foodConsumedKg;
  telemetry.waterPoolStockUnits = resources.waterStockUnits;
  telemetry.waterPoolCapacityUnits = resources.waterCapacityUnits;
  telemetry.waterPoolRecoveredUnits = resources.waterRecoveredUnits;
  telemetry.waterPoolConsumedUnits = resources.waterConsumedUnits;
  telemetry.meanFoodPoolFill = resources.meanFoodPoolFill;
  telemetry.meanWaterPoolFill = resources.meanWaterPoolFill;
  telemetry.resourceLimitedCohortCount = resources.resourceLimitedCohortCount;
  telemetry.resourceLimitedPopulation = resources.resourceLimitedPopulation;
  telemetry.meanFoodSufficiency = resources.meanFoodSufficiency;
  telemetry.meanWaterSufficiency = resources.meanWaterSufficiency;
  telemetry.meanRefugeSufficiency = clamp01(telemetry.meanRefugeSufficiency * competition.meanRefugeFactor);
  telemetry.floraBiomassKg = runtime.floraSystem?.telemetry.totalBiomassKg ?? 0;
  telemetry.insectBiomassKg = runtime.insectSystem?.telemetry.totalBiomassKg ?? 0;
  telemetry.insectConsumedKg = runtime.insectSystem?.telemetry.consumedByFaunaKg ?? 0;
  telemetry.predatorPopulation = runtime.predatorSystem?.telemetry.totalPopulation ?? 0;
  telemetry.predatorKills = runtime.predatorSystem?.telemetry.preyKilled ?? 0;
  telemetry.predatorKillBiomassKg = runtime.predatorSystem?.telemetry.preyBiomassKilledKg ?? 0;
  telemetry.totalPopulation = getSpatialFaunaRuntimePopulation(runtime);
  runtime.telemetry = telemetry;
  const latest = runtime.history[runtime.history.length - 1];
  if (latest?.day === telemetry.day) Object.assign(latest, telemetry);
}

export function createSpatialFaunaEcosystemState(worldSeed: string, initialDay: number, world: GeneratedSpatialWorld): SpatialFaunaRuntimeState {
  const runtime = createSpatialFaunaRuntimeState(worldSeed, initialDay, world);
  runtime.interactionVersion = SPATIAL_FAUNA_INTERACTION_VERSION;
  runtime.floraSystem = createSpatialFloraRuntimeState(world, initialDay);
  runtime.insectSystem = createSpatialInsectRuntimeState(world, runtime.floraSystem, initialDay);
  runtime.predatorSystem = createSpatialPredatorRuntimeState(world, initialDay);
  ensureSpatialFaunaResourcePools(runtime, world, getSpatialFaunaSeason(initialDay));
  return runtime;
}

/** Authoritative metric terrestrial day: plants -> insects -> shared material -> prey -> predators. */
export function tickSpatialFaunaEcosystemDay(runtime: SpatialFaunaRuntimeState, world: GeneratedSpatialWorld, day: number): SpatialFaunaDailyTelemetry {
  const season = getSpatialFaunaSeason(day);
  ensureSpatialTrophicLayers(runtime, world, Math.max(1, day - 1));
  const pollination = getSpatialPollinationByPatch(runtime.insectSystem!);
  tickSpatialFloraDay(runtime.floraSystem!, world, day, season, pollination);
  tickSpatialInsectsDay(runtime.insectSystem!, world, runtime.floraSystem, day, season);
  applySpatialInsectPlantEffects(runtime.floraSystem!, runtime.insectSystem!, world);
  const resources = tickSpatialTrophicResources(runtime, runtime.floraSystem!, runtime.insectSystem!, world, season);
  refreshLivingProducerTelemetry(runtime, world, season);
  const competition = applySpatialFaunaCompetitionPressure(runtime, world, { resourcePoolsOwnFoodWater: true });
  const telemetry = tickSpatialFaunaDay(runtime, world, day, resources.sufficiencyByPatch);
  tickSpatialPredatorsDay(runtime.predatorSystem!, runtime, world, day, season);
  attachEcosystemTelemetry(runtime, telemetry, competition, resources);
  return telemetry;
}

/** GameState bridge for the authoritative 120 km² terrestrial ecosystem. */
export function tickSpatialFaunaRuntime(state: GameState, _deltaGameMinutes: number): void {
  const day = Math.max(1, Math.floor(state.gameTime.day));
  const worldSeed = getSpatialWorldSeed(state);
  if (!state.spatialFaunaSystem || state.spatialFaunaSystem.worldSeed !== worldSeed) {
    const world = generateSpatialWorld(worldSeed);
    state.spatialFaunaSystem = createSpatialFaunaEcosystemState(worldSeed, day, world);
    return;
  }
  const world = generateSpatialWorld(worldSeed);
  if (
    state.spatialFaunaSystem.version !== SPATIAL_FAUNA_RUNTIME_VERSION
    || state.spatialFaunaSystem.communitySignature !== world.faunaCommunity.signature
    || state.spatialFaunaSystem.interactionVersion !== SPATIAL_FAUNA_INTERACTION_VERSION
  ) {
    state.spatialFaunaSystem = createSpatialFaunaEcosystemState(worldSeed, day, world);
    return;
  }
  ensureSpatialTrophicLayers(state.spatialFaunaSystem, world, state.spatialFaunaSystem.lastProcessedDay);
  ensureSpatialFaunaResourcePools(state.spatialFaunaSystem, world, getSpatialFaunaSeason(state.spatialFaunaSystem.lastProcessedDay));
  if (state.spatialFaunaSystem.lastProcessedDay >= day) return;
  for (let processDay = state.spatialFaunaSystem.lastProcessedDay + 1; processDay <= day; processDay += 1) tickSpatialFaunaEcosystemDay(state.spatialFaunaSystem, world, processDay);
}
