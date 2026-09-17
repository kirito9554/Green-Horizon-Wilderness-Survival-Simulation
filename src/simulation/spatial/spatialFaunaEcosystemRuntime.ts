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
  tickSpatialFaunaDay,
} from './spatialFaunaRuntime';
import {
  generateSpatialWorld,
  getSpatialWorldSeed,
  type GeneratedSpatialWorld,
} from './worldGeneration';

export const SPATIAL_FAUNA_INTERACTION_VERSION = 1;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function attachCompetitionTelemetry(
  runtime: SpatialFaunaRuntimeState,
  telemetry: SpatialFaunaDailyTelemetry,
  competition: SpatialFaunaCompetitionSummary,
): void {
  telemetry.meanFoodCompetitionPressure = competition.meanFoodPressure;
  telemetry.meanWaterCompetitionPressure = competition.meanWaterPressure;
  telemetry.meanRefugeCompetitionPressure = competition.meanRefugePressure;
  telemetry.competitionLimitedCohortCount = competition.limitedCohortCount;
  telemetry.competitionLimitedPopulation = competition.limitedPopulation;

  // The lower-level cohort tick reports abiotic/site sufficiency. Shared
  // competition is a second multiplicative ecological constraint, so expose
  // the effective sufficiency after both layers rather than hiding scarcity.
  telemetry.meanFoodSufficiency = clamp01(telemetry.meanFoodSufficiency * competition.meanFoodFactor);
  telemetry.meanWaterSufficiency = clamp01(telemetry.meanWaterSufficiency * competition.meanWaterFactor);
  telemetry.meanRefugeSufficiency = clamp01(telemetry.meanRefugeSufficiency * competition.meanRefugeFactor);
  runtime.telemetry = telemetry;

  const latest = runtime.history[runtime.history.length - 1];
  if (latest?.day === telemetry.day) Object.assign(latest, telemetry);
}

/**
 * Full metric-fauna day: first compute the shared community load using the
 * start-of-day cohorts, then let the existing demographic tick consume the
 * resulting condition/stress state. Mortality, breeding and stress-driven
 * movement therefore react to competition on the same simulated day.
 */
export function tickSpatialFaunaEcosystemDay(
  runtime: SpatialFaunaRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
): SpatialFaunaDailyTelemetry {
  const competition = applySpatialFaunaCompetitionPressure(runtime, world);
  const telemetry = tickSpatialFaunaDay(runtime, world, day);
  attachCompetitionTelemetry(runtime, telemetry, competition);
  return telemetry;
}

/**
 * GameState bridge for the full metric fauna ecosystem. The static 120 km²
 * world is regenerated deterministically from the save seed, while only the
 * compact patch cohorts remain persistent. Catch-up advances competition and
 * demography once for every missed in-game day, in order.
 */
export function tickSpatialFaunaRuntime(state: GameState, _deltaGameMinutes: number): void {
  const day = Math.max(1, Math.floor(state.gameTime.day));
  const worldSeed = getSpatialWorldSeed(state);

  if (!state.spatialFaunaSystem || state.spatialFaunaSystem.worldSeed !== worldSeed) {
    const world = generateSpatialWorld(worldSeed);
    state.spatialFaunaSystem = createSpatialFaunaRuntimeState(worldSeed, day, world);
    return;
  }

  if (state.spatialFaunaSystem.lastProcessedDay >= day) return;
  const world = generateSpatialWorld(worldSeed);
  if (
    state.spatialFaunaSystem.version !== SPATIAL_FAUNA_RUNTIME_VERSION
    || state.spatialFaunaSystem.communitySignature !== world.faunaCommunity.signature
  ) {
    state.spatialFaunaSystem = createSpatialFaunaRuntimeState(worldSeed, day, world);
    return;
  }

  for (let processDay = state.spatialFaunaSystem.lastProcessedDay + 1; processDay <= day; processDay += 1) {
    tickSpatialFaunaEcosystemDay(state.spatialFaunaSystem, world, processDay);
  }
}
