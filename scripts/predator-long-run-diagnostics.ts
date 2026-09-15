import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { GameState, WeatherType } from '../src/types';
import type { WildPredatorPopulation } from '../src/types/ecologySimulation';
import { MAIN_WORLD_AREA_IDS } from '../src/data/mainWorldAreas';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import {
  createWorldEcologyState,
  discoverEcologySubarea,
  ensureRegionEcology,
  tickWorldEcology,
} from '../src/simulation/ecologySystem';
import { createWorldHydrologyState, tickWorldHydrology } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork, tickSurfaceWaterHydrology } from '../src/simulation/hydrologySurfaceWaterSystem';
import {
  finalizeTerrestrialEcologyScale,
  prepareTerrestrialEcologyScale,
  reconcileTerrestrialEcologyScale,
} from '../src/simulation/terrestrialEcologyScaleSystem';
import { finalizeLivingHydrologyState, prepareLivingHydrologyState } from '../src/simulation/livingHydrologyBridge';
import { tickLongRunEcosystemBalance, tickWildFaunaWithStableFoodWebClock } from '../src/simulation/longRunEcosystemSystem';
import {
  getPredatorPressureResponseDiagnostics,
  tickWildPredatorsWithPressureResponse,
} from '../src/simulation/predatorPressureResponseSystem';
import {
  collectPredatorHungerTelemetry,
  summarizePredatorHungerTelemetry,
} from '../src/simulation/predatorHungerTelemetry';
import { advanceTime } from '../src/simulation/timeSystem';
import { getCardinalDirection, WEATHER_BASELINES } from '../src/simulation/weatherSystem';

const DAYS_PER_YEAR = 365;
const MINUTES_PER_DAY = 1440;
const FINE_STEP_MINUTES = 360;
const MID_STEP_MINUTES = 720;
const COARSE_STEP_MINUTES = 1440;
const WEATHER_SAMPLE_MINUTES = 360;
const WARMUP_DAYS = 30;
const VERIFICATION_DAYS = 30;
const TARGET_YEARS = [1, 5, 20] as const;
const DEFAULT_SEED = 'predator-long-run-p5';

type RunMode = 'fast' | 'canonical';

type EnergyAwarePredator = WildPredatorPopulation & {
  energyReserveKg?: number;
  maxEnergyReserveKg?: number;
};

interface SpeciesDiagnostics {
  speciesId: string;
  population: number;
  biomassKg: number;
  populationWeightedHunger: number;
  highStressIndividuals: number;
  averageBodyCondition: number;
  averageMigrationPressure: number;
  reserveRatio: number;
  huntingOpportunityRatio: number;
  competitionMultiplier: number;
  chronicStressDays: number;
  totalEmigrants: number;
  averageHomeRangeSize: number;
}

interface PredatorCheckpoint {
  year: number;
  gameDay: number;
  predatorPopulation: number;
  predatorBiomassKg: number;
  faunaPopulation: number;
  faunaBiomassKg: number;
  populationWeightedHunger: number;
  biomassWeightedHunger: number;
  highStressIndividuals: number;
  highStressShare: number;
  reserveRatio: number;
  huntingOpportunityRatio: number;
  chronicStressDays: number;
  maxChronicStressDays: number;
  totalEmigrants: number;
  competitionMultiplier: number;
  species: SpeciesDiagnostics[];
  warnings: string[];
}

interface PhaseExecution {
  fromYear: number;
  toYear: number;
  days: number;
  coarseStepMinutes: number;
  verificationDays: number;
  verificationStepMinutes: number;
  ticks: number;
  elapsedMs: number;
}

interface PredatorLongRunReport {
  seed: string;
  mode: RunMode;
  profile: 'multi-resolution' | 'full-resolution';
  warmupDays: number;
  warmupStepMinutes: number;
  verificationDays: number;
  executedTicks: number;
  canonicalEquivalentTicks: number;
  tickReductionRatio: number;
  elapsedMs: number;
  phases: PhaseExecution[];
  baseline: PredatorCheckpoint;
  checkpoints: PredatorCheckpoint[];
  warnings: string[];
  abortedAfterYear?: number;
  abortReason?: string;
}

interface WeatherSample {
  type: WeatherType;
  temperatureC: number;
  humidityPercent: number;
  rainIntensity: number;
  cloudCover: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function weightedAverage<T>(rows: T[], weight: (row: T) => number, value: (row: T) => number): number {
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(0, weight(row)), 0);
  if (totalWeight <= 0) return 0;
  return rows.reduce((sum, row) => sum + value(row) * Math.max(0, weight(row)), 0) / totalWeight;
}

function freshState(seed: string): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const building = ensureBuildingSimulation(state);
  building.worldSeed = seed;
  building.gridsByPoiId = {};
  building.clusters = [];
  building.preparationJobs = [];
  building.constructionJobs = [];
  state.ecologySystem = createWorldEcologyState();
  state.hydrologySystem = createWorldHydrologyState();
  state.buildings = [];
  state.expeditions = [];
  state.logs = [];

  for (const poiId of MAIN_WORLD_AREA_IDS) {
    const region = ensureRegionEcology(state, poiId);
    if (!region) continue;
    for (const subareaId of region.subareaIds) discoverEcologySubarea(state, subareaId);
    ensureSurfaceWaterNetwork(state, poiId);
  }
  return state;
}

function weatherTypeAt(day: number, minuteOfDay: number): WeatherType {
  const dayOfYear = ((day - 1) % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const slot = Math.floor(minuteOfDay / WEATHER_SAMPLE_MINUTES);
  const wetness = (Math.sin(((dayOfYear - 135) / DAYS_PER_YEAR) * Math.PI * 2) + 1) / 2;
  const pulse = (dayOfYear * 7 + slot * 13) % 31;

  if (wetness < 0.16 && pulse <= 2) return 'heat_wave';
  if (wetness > 0.78 && pulse <= 2) return 'storm';
  if (wetness > 0.58 && pulse <= 8) return 'heavy_rain';
  if (wetness > 0.28 && pulse <= 14) return 'light_rain';
  if (pulse <= 20) return 'cloudy';
  return 'clear';
}

function weatherSampleAt(day: number, minuteOfDay: number): WeatherSample {
  const type = weatherTypeAt(day, minuteOfDay);
  const dayOfYear = ((day - 1) % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const wetness = (Math.sin(((dayOfYear - 135) / DAYS_PER_YEAR) * Math.PI * 2) + 1) / 2;
  const base = WEATHER_BASELINES[type];
  return {
    type,
    temperatureC: base.temperatureC + (0.5 - wetness) * 2.2,
    humidityPercent: clamp(base.humidityPercent + (wetness - 0.5) * 8),
    rainIntensity: base.rainIntensity,
    cloudCover: base.cloudCover,
    windSpeedKmh: base.windSpeedKmh,
    windDirectionDeg: base.windDirectionDeg,
  };
}

function sampleWeatherInterval(state: GameState, minutes: number): WeatherSample[] {
  const sampleCount = Math.max(1, Math.ceil(minutes / WEATHER_SAMPLE_MINUTES));
  const samples: WeatherSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = ((index + 0.5) / sampleCount) * minutes;
    const absoluteMinutes = state.gameTime.minuteOfDay + offset;
    const dayOffset = Math.floor(absoluteMinutes / MINUTES_PER_DAY);
    const minuteOfDay = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    samples.push(weatherSampleAt(state.gameTime.day + dayOffset, minuteOfDay));
  }
  return samples;
}

function deterministicWeather(state: GameState, minutes: number): void {
  const samples = sampleWeatherInterval(state, minutes);
  const representative = samples[Math.floor(samples.length / 2)];
  const average = (read: (sample: WeatherSample) => number) =>
    samples.reduce((sum, sample) => sum + read(sample), 0) / samples.length;

  state.weather.previous = state.weather.current;
  state.weather.current = representative.type;
  state.weather.next = representative.type;
  state.weather.temperatureC = round3(average(sample => sample.temperatureC));
  state.weather.humidityPercent = round3(average(sample => sample.humidityPercent));
  state.weather.rainIntensity = round3(average(sample => sample.rainIntensity));
  state.weather.cloudCover = round3(average(sample => sample.cloudCover));
  state.weather.totalDurationMinutes = minutes;
  state.weather.durationRemainingMinutes = minutes;
  state.weather.transitionProgress = 0;
  const windSpeedKmh = average(sample => sample.windSpeedKmh);
  state.weather.wind = {
    speedKmh: round3(windSpeedKmh),
    gustKmh: round3(average(sample => sample.windSpeedKmh * (sample.type === 'storm' ? 1.55 : 1.25))),
    directionDeg: representative.windDirectionDeg,
    cardinal: getCardinalDirection(representative.windDirectionDeg),
  };
}

function tickTerrestrialEcosystem(state: GameState, minutes: number): void {
  deterministicWeather(state, minutes);
  advanceTime(state, minutes);
  tickWorldHydrology(state, minutes);
  tickSurfaceWaterHydrology(state, minutes);
  prepareLivingHydrologyState(state, minutes);

  const scaleSnapshot = prepareTerrestrialEcologyScale(state);
  try {
    tickWorldEcology(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    finalizeLivingHydrologyState(state);
    tickWildFaunaWithStableFoodWebClock(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    tickWildPredatorsWithPressureResponse(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    tickLongRunEcosystemBalance(state, minutes);
  } finally {
    finalizeTerrestrialEcologyScale(state, scaleSnapshot);
  }
}

function simulateDays(state: GameState, days: number, stepMinutes: number): number {
  const targetMinutes = days * MINUTES_PER_DAY;
  let elapsed = 0;
  let ticks = 0;
  while (elapsed < targetMinutes) {
    const step = Math.min(stepMinutes, targetMinutes - elapsed);
    tickTerrestrialEcosystem(state, step);
    elapsed += step;
    ticks += 1;
  }
  return ticks;
}

function phaseStepMinutes(mode: RunMode, targetYear: number): number {
  if (mode === 'canonical' || targetYear <= 1) return FINE_STEP_MINUTES;
  if (targetYear <= 5) return MID_STEP_MINUTES;
  return COARSE_STEP_MINUTES;
}

function simulatePhase(
  state: GameState,
  mode: RunMode,
  fromYear: number,
  toYear: number,
): PhaseExecution {
  const startedAt = performance.now();
  const days = (toYear - fromYear) * DAYS_PER_YEAR;
  const coarseStepMinutes = phaseStepMinutes(mode, toYear);
  const verificationDays = mode === 'fast' && coarseStepMinutes > FINE_STEP_MINUTES
    ? Math.min(VERIFICATION_DAYS, days)
    : 0;
  const coarseDays = days - verificationDays;
  let ticks = 0;

  if (coarseDays > 0) ticks += simulateDays(state, coarseDays, coarseStepMinutes);
  if (verificationDays > 0) ticks += simulateDays(state, verificationDays, FINE_STEP_MINUTES);

  return {
    fromYear,
    toYear,
    days,
    coarseStepMinutes,
    verificationDays,
    verificationStepMinutes: FINE_STEP_MINUTES,
    ticks,
    elapsedMs: round3(performance.now() - startedAt),
  };
}

function energyRatio(populations: EnergyAwarePredator[]): number {
  const reserve = populations.reduce((sum, population) => sum + Math.max(0, population.energyReserveKg || 0), 0);
  const capacity = populations.reduce((sum, population) => sum + Math.max(0, population.maxEnergyReserveKg || 0), 0);
  return capacity > 0 ? reserve / capacity : 0;
}

function captureCheckpoint(state: GameState, year: number): PredatorCheckpoint {
  const system = state.ecologySystem!;
  const predators = (system.predatorPopulations || []).filter(population => population.population > 0) as EnergyAwarePredator[];
  const fauna = (system.animalPopulations || []).filter(population => population.population > 0);
  const hungerRows = collectPredatorHungerTelemetry(state);
  const hungerSummary = summarizePredatorHungerTelemetry(hungerRows);
  const pressureRows = getPredatorPressureResponseDiagnostics(state);

  const hungerBySpecies = new Map(hungerSummary.bySpecies.map(row => [row.key, row]));
  const speciesIds = [...new Set(predators.map(population => population.speciesId))].sort();

  const species: SpeciesDiagnostics[] = speciesIds.map(speciesId => {
    const populations = predators.filter(population => population.speciesId === speciesId);
    const speciesHungerRows = hungerRows.filter(row => row.speciesId === speciesId);
    const speciesPressureRows = pressureRows.filter(row => row.speciesId === speciesId);
    const hunger = hungerBySpecies.get(speciesId);
    return {
      speciesId,
      population: round3(populations.reduce((sum, population) => sum + population.population, 0)),
      biomassKg: round3(populations.reduce((sum, population) => sum + population.biomassKg, 0)),
      populationWeightedHunger: round3(hunger?.populationWeightedHunger || 0),
      highStressIndividuals: round3(hunger?.highStressIndividuals || 0),
      averageBodyCondition: round3(weightedAverage(speciesHungerRows, row => row.population, row => row.bodyCondition)),
      averageMigrationPressure: round3(weightedAverage(speciesHungerRows, row => row.population, row => row.migrationPressure)),
      reserveRatio: round3(energyRatio(populations)),
      huntingOpportunityRatio: round3(weightedAverage(speciesHungerRows, row => row.population, row => row.huntingOpportunityRatio)),
      competitionMultiplier: round3(weightedAverage(speciesPressureRows, row => row.population, row => row.competitionMultiplier)),
      chronicStressDays: round3(weightedAverage(speciesPressureRows, row => row.population, row => row.chronicStressDays)),
      totalEmigrants: round3(speciesPressureRows.reduce((sum, row) => sum + row.totalEmigrants, 0)),
      averageHomeRangeSize: round3(weightedAverage(speciesPressureRows, row => row.population, row => row.homeRangeSize)),
    };
  });

  const predatorPopulation = predators.reduce((sum, population) => sum + population.population, 0);
  const highStressIndividuals = hungerSummary.highStressIndividuals;
  const checkpoint: PredatorCheckpoint = {
    year,
    gameDay: state.gameTime.day,
    predatorPopulation: round3(predatorPopulation),
    predatorBiomassKg: round3(predators.reduce((sum, population) => sum + population.biomassKg, 0)),
    faunaPopulation: round3(fauna.reduce((sum, population) => sum + population.population, 0)),
    faunaBiomassKg: round3(fauna.reduce((sum, population) => sum + population.biomassKg, 0)),
    populationWeightedHunger: round3(hungerSummary.populationWeightedHunger),
    biomassWeightedHunger: round3(hungerSummary.biomassWeightedHunger),
    highStressIndividuals: round3(highStressIndividuals),
    highStressShare: round3(predatorPopulation > 0 ? highStressIndividuals / predatorPopulation : 0),
    reserveRatio: round3(energyRatio(predators)),
    huntingOpportunityRatio: round3(weightedAverage(hungerRows, row => row.population, row => row.huntingOpportunityRatio)),
    chronicStressDays: round3(weightedAverage(pressureRows, row => row.population, row => row.chronicStressDays)),
    maxChronicStressDays: round3(pressureRows.reduce((max, row) => Math.max(max, row.chronicStressDays), 0)),
    totalEmigrants: round3(pressureRows.reduce((sum, row) => sum + row.totalEmigrants, 0)),
    competitionMultiplier: round3(weightedAverage(pressureRows, row => row.population, row => row.competitionMultiplier)),
    species,
    warnings: [],
  };

  if (checkpoint.predatorPopulation <= 0) checkpoint.warnings.push('all predator populations collapsed');
  if (checkpoint.populationWeightedHunger >= 80 && checkpoint.highStressShare >= 0.5) {
    checkpoint.warnings.push('majority of predators remain in critical hunger stress');
  }
  if (checkpoint.chronicStressDays >= 30) checkpoint.warnings.push('population-weighted chronic stress exceeds 30 days');
  if (checkpoint.maxChronicStressDays >= 75) checkpoint.warnings.push('at least one predator population has extreme chronic stress');
  if (checkpoint.reserveRatio <= 0.03 && checkpoint.populationWeightedHunger >= 75) {
    checkpoint.warnings.push('predator energy reserves remain nearly empty under high hunger');
  }

  return checkpoint;
}

function compareExtinctions(baseline: PredatorCheckpoint, checkpoint: PredatorCheckpoint): string[] {
  const warnings: string[] = [];
  const current = new Map(checkpoint.species.map(row => [row.speciesId, row]));
  for (const initial of baseline.species) {
    if (initial.population < 2) continue;
    if ((current.get(initial.speciesId)?.population || 0) <= 0) {
      warnings.push(`${initial.speciesId} locally collapsed from baseline population ${initial.population}`);
    }
  }
  return warnings;
}

function getFastGateAbortReason(baseline: PredatorCheckpoint, checkpoint: PredatorCheckpoint): string | undefined {
  if (checkpoint.year !== 1 || baseline.predatorPopulation <= 0) return undefined;
  const survivalShare = checkpoint.predatorPopulation / baseline.predatorPopulation;
  const speciesShare = checkpoint.species.length / Math.max(1, baseline.species.length);
  if (survivalShare < 0.25) return `1y predator survival fell to ${round3(survivalShare * 100)}% of baseline`;
  if (speciesShare < 0.5) return `1y surviving predator guild fell to ${round3(speciesShare * 100)}% of baseline species`;
  if (checkpoint.populationWeightedHunger >= 90 && checkpoint.chronicStressDays >= 60) {
    return `1y predators remain critically hungry (${checkpoint.populationWeightedHunger}) under chronic stress (${checkpoint.chronicStressDays}d)`;
  }
  return undefined;
}

function parseStringArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function parseMode(): RunMode {
  const mode = parseStringArg('mode', 'fast');
  assert.ok(mode === 'fast' || mode === 'canonical', `unsupported P5 mode: ${mode}`);
  return mode;
}

function main(): void {
  const seed = parseStringArg('seed', DEFAULT_SEED);
  const outputDir = parseStringArg('out', 'artifacts/predator-long-run');
  const mode = parseMode();
  mkdirSync(outputDir, { recursive: true });

  const startedAt = performance.now();
  const state = freshState(seed);
  const warmupTicks = simulateDays(state, WARMUP_DAYS, FINE_STEP_MINUTES);
  const baseline = captureCheckpoint(state, 0);
  assert.ok(baseline.predatorPopulation > 0, 'predators must seed during warmup before P5 validation');

  console.log(`P5 mode=${mode} warmup=${WARMUP_DAYS}d@${FINE_STEP_MINUTES}m ticks=${warmupTicks}`);

  const checkpoints: PredatorCheckpoint[] = [];
  const phases: PhaseExecution[] = [];
  let elapsedYears = 0;
  let abortedAfterYear: number | undefined;
  let abortReason: string | undefined;
  for (const targetYear of TARGET_YEARS) {
    const phase = simulatePhase(state, mode, elapsedYears, targetYear);
    phases.push(phase);
    const checkpoint = captureCheckpoint(state, targetYear);
    checkpoint.warnings.push(...compareExtinctions(baseline, checkpoint));
    if (mode === 'fast') {
      const reason = getFastGateAbortReason(baseline, checkpoint);
      if (reason) {
        abortedAfterYear = targetYear;
        abortReason = reason;
        checkpoint.warnings.push(`fast validation aborted: ${reason}`);
      }
    }
    checkpoints.push(checkpoint);
    elapsedYears = targetYear;
    console.log(
      `P5 ${targetYear}y: step=${phase.coarseStepMinutes}m verify=${phase.verificationDays}d ticks=${phase.ticks} ` +
      `predators=${checkpoint.predatorPopulation} hunger=${checkpoint.populationWeightedHunger} ` +
      `reserve=${checkpoint.reserveRatio} chronic=${checkpoint.chronicStressDays} ` +
      `emigrants=${checkpoint.totalEmigrants} warnings=${checkpoint.warnings.length}`,
    );
    if (abortReason) {
      console.log(`P5 fast gate abort after ${targetYear}y: ${abortReason}`);
      break;
    }
  }

  const executedTicks = warmupTicks + phases.reduce((sum, phase) => sum + phase.ticks, 0);
  const canonicalEquivalentTicks = Math.ceil(((WARMUP_DAYS + TARGET_YEARS[TARGET_YEARS.length - 1] * DAYS_PER_YEAR) * MINUTES_PER_DAY) / FINE_STEP_MINUTES);
  const report: PredatorLongRunReport = {
    seed,
    mode,
    profile: mode === 'fast' ? 'multi-resolution' : 'full-resolution',
    warmupDays: WARMUP_DAYS,
    warmupStepMinutes: FINE_STEP_MINUTES,
    verificationDays: mode === 'fast' ? VERIFICATION_DAYS : 0,
    executedTicks,
    canonicalEquivalentTicks,
    tickReductionRatio: round3(1 - executedTicks / canonicalEquivalentTicks),
    elapsedMs: round3(performance.now() - startedAt),
    phases,
    baseline,
    checkpoints,
    warnings: checkpoints.flatMap(checkpoint => checkpoint.warnings.map(warning => `${checkpoint.year}y: ${warning}`)),
    abortedAfterYear,
    abortReason,
  };

  const path = join(outputDir, 'predator-long-run-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Predator long-run report written to ${path}`);
}

main();
