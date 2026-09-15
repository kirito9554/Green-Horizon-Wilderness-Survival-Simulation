import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { GameState, WeatherType } from '../src/types';
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
import { tickWildPredatorsWithPressureResponse } from '../src/simulation/predatorPressureResponseSystem';
import { collectPredatorHungerTelemetry } from '../src/simulation/predatorHungerTelemetry';
import { getPredatorHuntDiagnostics } from '../src/simulation/predatorDiscreteHuntingSystem';
import { advanceTime } from '../src/simulation/timeSystem';
import { getCardinalDirection, WEATHER_BASELINES } from '../src/simulation/weatherSystem';

const MINUTES_PER_DAY = 1440;
const STEP_MINUTES = 360;
const WEATHER_SAMPLE_MINUTES = 360;
const WARMUP_DAYS = 30;
const VALIDATION_DAYS = 90;
const DEFAULT_SEED = 'predator-long-run-p5';

interface WeatherSample {
  type: WeatherType;
  temperatureC: number;
  humidityPercent: number;
  rainIntensity: number;
  cloudCover: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
}

interface EnergyTotals {
  demandKg: number;
  intakeKg: number;
  populationTicks: number;
}

interface HuntTotals {
  attempts: number;
  encounters: number;
  attacks: number;
  successfulKills: number;
  carcassBiomassCreatedKg: number;
  activeOwnedCarcasses: number;
  remainingOwnedCarcassKg: number;
  killsByPreySpecies: Record<string, number>;
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
  const dayOfYear = ((day - 1) % 365 + 365) % 365;
  const slot = Math.floor(minuteOfDay / WEATHER_SAMPLE_MINUTES);
  const wetness = (Math.sin(((dayOfYear - 135) / 365) * Math.PI * 2) + 1) / 2;
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
  const dayOfYear = ((day - 1) % 365 + 365) % 365;
  const wetness = (Math.sin(((dayOfYear - 135) / 365) * Math.PI * 2) + 1) / 2;
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

function runWarmup(state: GameState): number {
  const ticks = WARMUP_DAYS * MINUTES_PER_DAY / STEP_MINUTES;
  for (let index = 0; index < ticks; index += 1) tickPipeline(state, STEP_MINUTES);
  return ticks;
}

function runValidation(state: GameState, energy: Map<string, EnergyTotals>): number {
  const ticks = VALIDATION_DAYS * MINUTES_PER_DAY / STEP_MINUTES;
  for (let index = 0; index < ticks; index += 1) {
    tickPipeline(state, STEP_MINUTES);
    for (const population of state.ecologySystem?.predatorPopulations || []) {
      const row = energy.get(population.speciesId) || { demandKg: 0, intakeKg: 0, populationTicks: 0 };
      row.demandKg += Math.max(0, population.lastEnergyDemandKg || 0);
      row.intakeKg += Math.max(0, population.lastEnergyIntakeKg || 0);
      row.populationTicks += Math.max(0, population.population);
      energy.set(population.speciesId, row);
    }
  }
  return ticks;
}

function huntSnapshot(state: GameState) {
  return new Map(getPredatorHuntDiagnostics(state).map(row => [row.populationId, row]));
}

function huntDeltas(state: GameState, baseline: ReturnType<typeof huntSnapshot>): Map<string, HuntTotals> {
  const result = new Map<string, HuntTotals>();
  for (const row of getPredatorHuntDiagnostics(state)) {
    const before = baseline.get(row.populationId);
    const totals = result.get(row.speciesId) || {
      attempts: 0,
      encounters: 0,
      attacks: 0,
      successfulKills: 0,
      carcassBiomassCreatedKg: 0,
      activeOwnedCarcasses: 0,
      remainingOwnedCarcassKg: 0,
      killsByPreySpecies: {},
    };
    totals.attempts += Math.max(0, row.attempts - (before?.attempts || 0));
    totals.encounters += Math.max(0, row.encounters - (before?.encounters || 0));
    totals.attacks += Math.max(0, row.attacks - (before?.attacks || 0));
    totals.successfulKills += Math.max(0, row.successfulKills - (before?.successfulKills || 0));
    totals.carcassBiomassCreatedKg += Math.max(0, row.carcassBiomassCreatedKg - (before?.carcassBiomassCreatedKg || 0));
    totals.activeOwnedCarcasses += row.activeOwnedCarcasses;
    totals.remainingOwnedCarcassKg += row.remainingOwnedCarcassKg;
    for (const [preySpeciesId, preyRow] of Object.entries(row.byPreySpecies)) {
      const beforePrey = before?.byPreySpecies[preySpeciesId];
      const kills = Math.max(0, preyRow.successfulKills - (beforePrey?.successfulKills || 0));
      if (kills > 0) totals.killsByPreySpecies[preySpeciesId] = (totals.killsByPreySpecies[preySpeciesId] || 0) + kills;
    }
    result.set(row.speciesId, totals);
  }
  return result;
}

function main(): void {
  const seed = parseStringArg('seed', DEFAULT_SEED);
  const outputDir = parseStringArg('out', 'artifacts/predator-hunt-events');
  mkdirSync(outputDir, { recursive: true });
  const startedAt = performance.now();
  const state = freshState(seed);
  const warmupTicks = runWarmup(state);
  const baselinePredators = (state.ecologySystem?.predatorPopulations || []).reduce((sum, population) => sum + Math.max(0, population.population), 0);
  const baselineHunts = huntSnapshot(state);
  const energy = new Map<string, EnergyTotals>();
  const validationTicks = runValidation(state, energy);
  const hunts = huntDeltas(state, baselineHunts);
  const hungerRows = collectPredatorHungerTelemetry(state);
  const speciesIds = [...new Set([...energy.keys(), ...hunts.keys(), ...hungerRows.map(row => row.speciesId)])].sort();
  const species = speciesIds.map(speciesId => {
    const energyRow = energy.get(speciesId) || { demandKg: 0, intakeKg: 0, populationTicks: 0 };
    const hunt = hunts.get(speciesId) || {
      attempts: 0, encounters: 0, attacks: 0, successfulKills: 0, carcassBiomassCreatedKg: 0,
      activeOwnedCarcasses: 0, remainingOwnedCarcassKg: 0, killsByPreySpecies: {},
    };
    const hunger = hungerRows.filter(row => row.speciesId === speciesId);
    const currentPopulation = hunger.reduce((sum, row) => sum + row.population, 0);
    const weightedHunger = currentPopulation > 0
      ? hunger.reduce((sum, row) => sum + row.hungerStress * row.population, 0) / currentPopulation
      : 0;
    return {
      speciesId,
      currentPopulation: round3(currentPopulation),
      demandKg: round3(energyRow.demandKg),
      intakeKg: round3(energyRow.intakeKg),
      intakeDemandRatio: round3(energyRow.demandKg > 0 ? energyRow.intakeKg / energyRow.demandKg : 0),
      hunger: round3(weightedHunger),
      huntAttempts: hunt.attempts,
      huntEncounters: hunt.encounters,
      huntAttacks: hunt.attacks,
      successfulKills: hunt.successfulKills,
      encounterRate: round3(hunt.attempts > 0 ? hunt.encounters / hunt.attempts : 0),
      attackSuccessRate: round3(hunt.attacks > 0 ? hunt.successfulKills / hunt.attacks : 0),
      overallHuntSuccessRate: round3(hunt.attempts > 0 ? hunt.successfulKills / hunt.attempts : 0),
      carcassBiomassCreatedKg: round3(hunt.carcassBiomassCreatedKg),
      activeOwnedCarcasses: hunt.activeOwnedCarcasses,
      remainingOwnedCarcassKg: round3(hunt.remainingOwnedCarcassKg),
      killsByPreySpecies: hunt.killsByPreySpecies,
    };
  });
  const carcasses = state.ecologySystem?.wildCarcasses || [];
  const activeCarcassesBySource = carcasses.reduce<Record<string, number>>((acc, carcass) => {
    const key = `${carcass.sourceSpeciesId}:${carcass.sourceLifeStage}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const currentPredators = species.reduce((sum, row) => sum + row.currentPopulation, 0);
  const report = {
    seed,
    warmupDays: WARMUP_DAYS,
    validationDays: VALIDATION_DAYS,
    stepMinutes: STEP_MINUTES,
    warmupTicks,
    validationTicks,
    elapsedMs: round3(performance.now() - startedAt),
    baselinePredators,
    currentPredators: round3(currentPredators),
    survivalShare: round3(baselinePredators > 0 ? currentPredators / baselinePredators : 0),
    activeCarcasses: carcasses.length,
    remainingCarcassBiomassKg: round3(carcasses.reduce((sum, carcass) => sum + carcass.remainingMassKg, 0)),
    remainingCarcassEdibleKg: round3(carcasses.reduce((sum, carcass) => sum + carcass.remainingEdibleKg, 0)),
    activeCarcassesBySource,
    species,
  };
  const path = join(outputDir, 'predator-hunt-event-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Predator hunt event report written to ${path}`);
}

main();
