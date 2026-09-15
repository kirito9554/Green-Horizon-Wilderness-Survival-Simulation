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
import { collectPredatorHungerTelemetry } from '../src/simulation/predatorHungerTelemetry';
import { advanceTime } from '../src/simulation/timeSystem';
import { getCardinalDirection, WEATHER_BASELINES } from '../src/simulation/weatherSystem';

const DAYS_PER_YEAR = 365;
const MINUTES_PER_DAY = 1440;
const STEP_MINUTES = 360;
const WEATHER_SAMPLE_MINUTES = 360;
const WARMUP_DAYS = 30;
const DEFAULT_SEED = 'predator-long-run-p5';

interface EnergyPredator extends WildPredatorPopulation {
  energyReserveKg?: number;
  maxEnergyReserveKg?: number;
  lastEnergyIntakeKg?: number;
  lastEnergyDemandKg?: number;
}

interface SpeciesAccumulator {
  speciesId: string;
  observedPopulationTicks: number;
  feedingPopulationTicks: number;
  zeroIntakePopulationTicks: number;
  totalDemandKg: number;
  totalIntakeKg: number;
  coveredDemandKg: number;
  reserveRatioSum: number;
  reserveRatioSamples: number;
  minReserveRatio: number;
  hungerWeightedSum: number;
  huntingOpportunityWeightedSum: number;
  weightSum: number;
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

function parseStringArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || fallback;
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

function deterministicWeather(state: GameState, minutes: number): void {
  const sampleCount = Math.max(1, Math.ceil(minutes / WEATHER_SAMPLE_MINUTES));
  const samples: WeatherSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = ((index + 0.5) / sampleCount) * minutes;
    const absoluteMinutes = state.gameTime.minuteOfDay + offset;
    const dayOffset = Math.floor(absoluteMinutes / MINUTES_PER_DAY);
    const minuteOfDay = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    samples.push(weatherSampleAt(state.gameTime.day + dayOffset, minuteOfDay));
  }
  const representative = samples[Math.floor(samples.length / 2)];
  const average = (read: (sample: WeatherSample) => number) => samples.reduce((sum, sample) => sum + read(sample), 0) / samples.length;
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

function tickPipeline(state: GameState, minutes: number): void {
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

function ensureAccumulator(map: Map<string, SpeciesAccumulator>, speciesId: string): SpeciesAccumulator {
  let row = map.get(speciesId);
  if (!row) {
    row = {
      speciesId,
      observedPopulationTicks: 0,
      feedingPopulationTicks: 0,
      zeroIntakePopulationTicks: 0,
      totalDemandKg: 0,
      totalIntakeKg: 0,
      coveredDemandKg: 0,
      reserveRatioSum: 0,
      reserveRatioSamples: 0,
      minReserveRatio: 1,
      hungerWeightedSum: 0,
      huntingOpportunityWeightedSum: 0,
      weightSum: 0,
    };
    map.set(speciesId, row);
  }
  return row;
}

function snapshotReserve(state: GameState): Map<string, number> {
  return new Map(((state.ecologySystem?.predatorPopulations || []) as EnergyPredator[]).map(pop => [pop.id, Math.max(0, pop.energyReserveKg || 0)]));
}

function collectTick(state: GameState, reserveBefore: Map<string, number>, totals: Map<string, SpeciesAccumulator>): void {
  const populations = (state.ecologySystem?.predatorPopulations || []).filter(pop => pop.population > 0) as EnergyPredator[];
  const hungerRows = collectPredatorHungerTelemetry(state);
  const hungerByPopulation = new Map(hungerRows.map(row => [row.populationId, row]));
  for (const pop of populations) {
    const row = ensureAccumulator(totals, pop.speciesId);
    const demand = Math.max(0, pop.lastEnergyDemandKg || 0);
    const intake = Math.max(0, pop.lastEnergyIntakeKg || 0);
    const before = Math.max(0, reserveBefore.get(pop.id) || 0);
    const coverage = demand > 0 ? Math.min(1, (before + intake) / demand) : 1;
    const reserveCapacity = Math.max(0, pop.maxEnergyReserveKg || 0);
    const reserveRatio = reserveCapacity > 0 ? Math.max(0, pop.energyReserveKg || 0) / reserveCapacity : 0;
    const telemetry = hungerByPopulation.get(pop.id);
    row.observedPopulationTicks += pop.population;
    if (intake > 0) row.feedingPopulationTicks += pop.population;
    else row.zeroIntakePopulationTicks += pop.population;
    row.totalDemandKg += demand;
    row.totalIntakeKg += intake;
    row.coveredDemandKg += demand * coverage;
    row.reserveRatioSum += reserveRatio * pop.population;
    row.reserveRatioSamples += pop.population;
    row.minReserveRatio = Math.min(row.minReserveRatio, reserveRatio);
    row.hungerWeightedSum += (telemetry?.hungerStress || pop.hungerStress) * pop.population;
    row.huntingOpportunityWeightedSum += (telemetry?.huntingOpportunityRatio || 0) * pop.population;
    row.weightSum += pop.population;
  }
}

function runTicks(state: GameState, days: number, totals?: Map<string, SpeciesAccumulator>): number {
  const ticks = Math.ceil(days * MINUTES_PER_DAY / STEP_MINUTES);
  for (let i = 0; i < ticks; i += 1) {
    const before = snapshotReserve(state);
    tickPipeline(state, STEP_MINUTES);
    if (totals) collectTick(state, before, totals);
  }
  return ticks;
}

function main(): void {
  const seed = parseStringArg('seed', DEFAULT_SEED);
  const outputDir = parseStringArg('out', 'artifacts/predator-energy-probe');
  mkdirSync(outputDir, { recursive: true });
  const startedAt = performance.now();
  const state = freshState(seed);
  const warmupTicks = runTicks(state, WARMUP_DAYS);
  const baselinePredators = (state.ecologySystem?.predatorPopulations || []).filter(pop => pop.population > 0).reduce((sum, pop) => sum + pop.population, 0);
  const totals = new Map<string, SpeciesAccumulator>();
  const validationTicks = runTicks(state, DAYS_PER_YEAR, totals);
  const pressure = getPredatorPressureResponseDiagnostics(state);
  const pressureBySpecies = new Map<string, typeof pressure>();
  for (const row of pressure) {
    const values = pressureBySpecies.get(row.speciesId) || [];
    values.push(row);
    pressureBySpecies.set(row.speciesId, values);
  }
  const species = [...totals.values()].sort((a, b) => a.speciesId.localeCompare(b.speciesId)).map(row => {
    const pressureRows = pressureBySpecies.get(row.speciesId) || [];
    const currentPopulation = (state.ecologySystem?.predatorPopulations || []).filter(pop => pop.population > 0 && pop.speciesId === row.speciesId).reduce((sum, pop) => sum + pop.population, 0);
    const weight = Math.max(1, row.weightSum);
    return {
      speciesId: row.speciesId,
      currentPopulation,
      totalDemandKg: round3(row.totalDemandKg),
      totalIntakeKg: round3(row.totalIntakeKg),
      intakeDemandRatio: round3(row.totalDemandKg > 0 ? row.totalIntakeKg / row.totalDemandKg : 0),
      energyCoverageRatio: round3(row.totalDemandKg > 0 ? row.coveredDemandKg / row.totalDemandKg : 0),
      feedingPopulationTickShare: round3(row.observedPopulationTicks > 0 ? row.feedingPopulationTicks / row.observedPopulationTicks : 0),
      zeroIntakePopulationTickShare: round3(row.observedPopulationTicks > 0 ? row.zeroIntakePopulationTicks / row.observedPopulationTicks : 0),
      averageReserveRatio: round3(row.reserveRatioSamples > 0 ? row.reserveRatioSum / row.reserveRatioSamples : 0),
      minReserveRatio: round3(row.minReserveRatio === 1 && row.reserveRatioSamples === 0 ? 0 : row.minReserveRatio),
      averageHunger: round3(row.hungerWeightedSum / weight),
      averageHuntingOpportunity: round3(row.huntingOpportunityWeightedSum / weight),
      chronicStressDays: round3(pressureRows.length ? pressureRows.reduce((sum, item) => sum + item.chronicStressDays * item.population, 0) / Math.max(1, pressureRows.reduce((sum, item) => sum + item.population, 0)) : 0),
      totalEmigrants: pressureRows.reduce((sum, item) => sum + item.totalEmigrants, 0),
    };
  });
  const currentPredators = (state.ecologySystem?.predatorPopulations || []).filter(pop => pop.population > 0).reduce((sum, pop) => sum + pop.population, 0);
  const report = {
    seed,
    warmupDays: WARMUP_DAYS,
    validationDays: DAYS_PER_YEAR,
    stepMinutes: STEP_MINUTES,
    warmupTicks,
    validationTicks,
    elapsedMs: round3(performance.now() - startedAt),
    baselinePredators,
    currentPredators,
    survivalShare: round3(baselinePredators > 0 ? currentPredators / baselinePredators : 0),
    species,
  };
  const path = join(outputDir, 'predator-energy-throughput-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Predator energy throughput report written to ${path}`);
}

main();
