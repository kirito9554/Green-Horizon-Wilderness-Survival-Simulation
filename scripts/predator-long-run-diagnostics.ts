import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
const STEP_MINUTES = 360;
const WARMUP_DAYS = 30;
const TARGET_YEARS = [1, 5, 20] as const;
const DEFAULT_SEED = 'predator-long-run-p5';

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

interface PredatorLongRunReport {
  seed: string;
  stepMinutes: number;
  warmupDays: number;
  baseline: PredatorCheckpoint;
  checkpoints: PredatorCheckpoint[];
  warnings: string[];
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

function deterministicWeather(state: GameState): void {
  const dayOfYear = ((state.gameTime.day - 1) % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const slot = Math.floor(state.gameTime.minuteOfDay / 360);
  const wetness = (Math.sin(((dayOfYear - 135) / DAYS_PER_YEAR) * Math.PI * 2) + 1) / 2;
  const pulse = (dayOfYear * 7 + slot * 13) % 31;

  let current: WeatherType = 'clear';
  if (wetness < 0.16 && pulse <= 2) current = 'heat_wave';
  else if (wetness > 0.78 && pulse <= 2) current = 'storm';
  else if (wetness > 0.58 && pulse <= 8) current = 'heavy_rain';
  else if (wetness > 0.28 && pulse <= 14) current = 'light_rain';
  else if (pulse <= 20) current = 'cloudy';

  const base = WEATHER_BASELINES[current];
  state.weather.previous = current;
  state.weather.current = current;
  state.weather.next = current;
  state.weather.temperatureC = round3(base.temperatureC + (0.5 - wetness) * 2.2);
  state.weather.humidityPercent = clamp(base.humidityPercent + (wetness - 0.5) * 8);
  state.weather.rainIntensity = base.rainIntensity;
  state.weather.cloudCover = base.cloudCover;
  state.weather.totalDurationMinutes = 360;
  state.weather.durationRemainingMinutes = 360;
  state.weather.transitionProgress = 0;
  state.weather.wind = {
    speedKmh: base.windSpeedKmh,
    gustKmh: round3(base.windSpeedKmh * (current === 'storm' ? 1.55 : 1.25)),
    directionDeg: base.windDirectionDeg,
    cardinal: getCardinalDirection(base.windDirectionDeg),
  };
}

function tickTerrestrialEcosystem(state: GameState, minutes: number): void {
  deterministicWeather(state);
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

function simulateDays(state: GameState, days: number): void {
  const targetMinutes = days * MINUTES_PER_DAY;
  let elapsed = 0;
  while (elapsed < targetMinutes) {
    const step = Math.min(STEP_MINUTES, targetMinutes - elapsed);
    tickTerrestrialEcosystem(state, step);
    elapsed += step;
  }
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

  const pressureById = new Map(pressureRows.map(row => [row.populationId, row]));
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

function parseStringArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function main(): void {
  const seed = parseStringArg('seed', DEFAULT_SEED);
  const outputDir = parseStringArg('out', 'artifacts/predator-long-run');
  mkdirSync(outputDir, { recursive: true });

  const state = freshState(seed);
  simulateDays(state, WARMUP_DAYS);
  const baseline = captureCheckpoint(state, 0);
  assert.ok(baseline.predatorPopulation > 0, 'predators must seed during warmup before P5 validation');

  const checkpoints: PredatorCheckpoint[] = [];
  let elapsedYears = 0;
  for (const targetYear of TARGET_YEARS) {
    simulateDays(state, (targetYear - elapsedYears) * DAYS_PER_YEAR);
    const checkpoint = captureCheckpoint(state, targetYear);
    checkpoint.warnings.push(...compareExtinctions(baseline, checkpoint));
    checkpoints.push(checkpoint);
    elapsedYears = targetYear;
    console.log(`P5 ${targetYear}y: predators=${checkpoint.predatorPopulation} hunger=${checkpoint.populationWeightedHunger} reserve=${checkpoint.reserveRatio} chronic=${checkpoint.chronicStressDays} emigrants=${checkpoint.totalEmigrants} warnings=${checkpoint.warnings.length}`);
  }

  const report: PredatorLongRunReport = {
    seed,
    stepMinutes: STEP_MINUTES,
    warmupDays: WARMUP_DAYS,
    baseline,
    checkpoints,
    warnings: checkpoints.flatMap(checkpoint => checkpoint.warnings.map(warning => `${checkpoint.year}y: ${warning}`)),
  };

  const path = join(outputDir, 'predator-long-run-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`Predator long-run report written to ${path}`);
}

main();
