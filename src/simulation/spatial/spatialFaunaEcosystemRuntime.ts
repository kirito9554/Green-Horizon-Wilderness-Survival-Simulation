import type { GameState } from '../../types';
import '../../types/buildingSimulation';
import '../../types/spatialFaunaSimulation';
import type {
  SpatialFaunaDailyTelemetry,
  SpatialFaunaRuntimeState,
} from '../../types/spatialFaunaSimulation';
import {
  applySpatialFaunaCompetitionPressure,
  type SpatialFaunaCompetitionSummary,
} from './spatialFaunaCompetition';
import {
  SPATIAL_FAUNA_RUNTIME_VERSION,
  createSpatialFaunaRuntimeState,
  getSpatialFaunaSeason,
  tickSpatialFaunaDay,
} from './spatialFaunaRuntime';
import {
  ensureSpatialFaunaResourcePools,
  tickSpatialFaunaResourcePools,
  type SpatialFaunaResourceDaySummary,
} from './spatialFaunaResourcePools';
import {
  generateSpatialWorld,
  getSpatialWorldSeed,
  type GeneratedSpatialWorld,
} from './worldGeneration';

export const SPATIAL_FAUNA_INTERACTION_VERSION = 2;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function attachEcosystemTelemetry(
  runtime: SpatialFaunaRuntimeState,
  telemetry: SpatialFaunaDailyTelemetry,
  competition: SpatialFaunaCompetitionSummary,
  resources: SpatialFaunaResourceDaySummary,
): void {
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

  // The lower-level demographic tick still supplies habitat/access quality.
  // Conserved patch stocks now own food/water abundance, while refuge remains a
  // non-consumable shared-space constraint. Combine the independent factors once.
  telemetry.meanFoodSufficiency = clamp01(telemetry.meanFoodSufficiency * resources.meanFoodSufficiency);
  telemetry.meanWaterSufficiency = clamp01(telemetry.meanWaterSufficiency * resources.meanWaterSufficiency);
  telemetry.meanRefugeSufficiency = clamp01(telemetry.meanRefugeSufficiency * competition.meanRefugeFactor);
  runtime.telemetry = telemetry;

  const latest = runtime.history[runtime.history.length - 1];
  if (latest?.day === telemetry.day) Object.assign(latest, telemetry);
}

export function createSpatialFaunaEcosystemState(
  worldSeed: string,
  initialDay: number,
  world: GeneratedSpatialWorld,
): SpatialFaunaRuntimeState {
  const runtime = createSpatialFaunaRuntimeState(worldSeed, initialDay, world);
  ensureSpatialFaunaResourcePools(runtime, world, getSpatialFaunaSeason(initialDay));
  return runtime;
}

/**
 * Full metric-fauna day:
 * 1) area-scaled patch pools recover and the whole community consumes them;
 * 2) shared refuge/niche competition is evaluated, with food/water left to the
 *    material pool so scarcity is not double-counted;
 * 3) demography sees the resulting condition/stress on the same simulated day.
 */
export function tickSpatialFaunaEcosystemDay(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
): SpatialFaunaDailyTelemetry {
  const season = getSpatialFaunaSeason(day);
  const resources = tickSpatialFaunaResourcePools(runtime, world, season);
  const competition = applySpatialFaunaCompetitionPressure(runtime, world, {
    resourcePoolsOwnFoodWater: true,
  });
  const telemetry = tickSpatialFaunaDay(runtime, world, day);
  attachEcosystemTelemetry(runtime, telemetry, competition, resources);
  return telemetry;
}

/**
 * GameState bridge for the full metric fauna ecosystem. The static 120 km²
 * world is regenerated deterministically from the save seed, while compact
 * patch cohorts plus changing shared food/water stocks remain persistent.
 */
export function tickSpatialFaunaRuntime(state: GameState, _deltaGameMinutes: number): void {
  const day = Math.max(1, Math.floor(state.gameTime.day));
  const worldSeed = getSpatialWorldSeed(state);

  if (!state.spatialFaunaSystem || state.spatialFaunaSystem.worldSeed !== worldSeed) {
    const world = generateSpatialWorld(worldSeed);
    state.spatialFaunaSystem = createSpatialFaunaEcosystemState(worldSeed, day, world);
    return;
  }

  if (state.spatialFaunaSystem.lastProcessedDay >= day) return;
  const world = generateSpatialWorld(worldSeed);
  if (
    state.spatialFaunaSystem.version !== SPATIAL_FAUNA_RUNTIME_VERSION
    || state.spatialFaunaSystem.communitySignature !== world.faunaCommunity.signature
  ) {
    state.spatialFaunaSystem = createSpatialFaunaEcosystemState(worldSeed, day, world);
    return;
  }

  ensureSpatialFaunaResourcePools(
    state.spatialFaunaSystem,
    world,
    getSpatialFaunaSeason(state.spatialFaunaSystem.lastProcessedDay),
  );
  for (let processDay = state.spatialFaunaSystem.lastProcessedDay + 1; processDay <= day; processDay += 1) {
    tickSpatialFaunaEcosystemDay(state.spatialFaunaSystem, world, processDay);
  }
}
