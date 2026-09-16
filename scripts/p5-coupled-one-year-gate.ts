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
import { tickAquaticEcologyAtEnvironmentalScale } from '../src/simulation/environmentalScaleSystem';
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
const AQUATIC_SUBSTEP_MINUTES = 60;
const WEATHER_SAMPLE_MINUTES = 360;
const WARMUP_DAYS = 30;
const VALIDATION_DAYS = DAYS_PER_YEAR;
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

interface AquaticSpeciesDiagnostics {
  speciesId: string;
  population: number;
  biomassKg: number;
  populations: number;
}

interface AquaticFoodWebDiagnostics {
  nodes: number;
  detritusKg: number;
  benthicInvertebratesKg: number;
  zooplanktonKg: number;
  carrionKg: number;
}

interface Checkpoint {
  gameDay: number;
  predatorPopulation: number;
  predatorBiomassKg: number;
  predatorSpecies: number;
  faunaPopulation: number;
  faunaBiomassKg: number;
  faunaSpecies: number;
  aquaticPopulation: number;
  aquaticBiomassKg: number;
  aquaticSpecies: number;
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
  aquatic: AquaticSpeciesDiagnostics[];
  aquaticFoodWeb: AquaticFoodWebDiagnostics;
  warnings: string[];
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

function deterministicWeather(state: GameState, minutes: number): void {
  const sampleCount = Math.max(1, Math.ceil(minutes / WEATHER_SAMPLE_MINUTES));
  const samples: WeatherSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = ((index + 0.5) / sampleCount) * minutes;
    const absoluteMinutes = state.gameTime.minuteOfDay + offset;
    const dayOffset = Math.floor(absoluteMinutes / MINUTES_PER_DAY);
    const minuteOfDay = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const type = weatherTypeAt(state.gameTime.day + dayOffset, minuteOfDay);
    const dayOfYear = ((state.gameTime.day + dayOffset - 1) % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR;
    const wetness = (Math.sin(((dayOfYear - 135) / DAYS_PER_YEAR) * Math.PI * 2) + 1) / 2;
    const base = WEATHER_BASELINES[type];
    samples.push({
      type,
      temperatureC: base.temperatureC + (0.5 - wetness) * 2.2,
      humidityPercent: clamp(base.humidityPercent + (wetness - 0.5) * 8),
      rainIntensity: base.rainIntensity,
      cloudCover: base.cloudCover,
      windSpeedKmh: base.windSpeedKmh,
      windDirectionDeg: base.windDirectionDeg,
    });
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

function tickCoupledPipeline(state: GameState, minutes: number): void {
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
    tickAquaticEcologyAtEnvironmentalScale(state, minutes);
    tickWildFaunaWithStableFoodWebClock(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    tickWildPredatorsWithPressureResponse(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    tickLongRunEcosystemBalance(state, minutes);
  } finally {
    finalizeTerrestrialEcologyScale(state, scaleSnapshot);
  }
}

function simulateDays(state: GameState, days: number): number {
  const targetMinutes = days * MINUTES_PER_DAY;
  let elapsed = 0;
  let ticks = 0;
  while (elapsed < targetMinutes) {
    const step = Math.min(STEP_MINUTES, targetMinutes - elapsed);
    tickCoupledPipeline(state, step);
    elapsed += step;
    ticks += 1;
  }
  return ticks;
}

function energyRatio(populations: EnergyAwarePredator[]): number {
  const reserve = populations.reduce((sum, population) => sum + Math.max(0, population.energyReserveKg || 0), 0);
  const capacity = populations.reduce((sum, population) => sum + Math.max(0, population.maxEnergyReserveKg || 0), 0);
  return capacity > 0 ? reserve / capacity : 0;
}

function aquaticSnapshot(state: GameState): AquaticSpeciesDiagnostics[] {
  const rows = new Map<string, AquaticSpeciesDiagnostics>();
  for (const population of state.ecologySystem?.aquaticPopulations || []) {
    const row = rows.get(population.speciesId) || { speciesId: population.speciesId, population: 0, biomassKg: 0, populations: 0 };
    row.population += Math.max(0, population.population);
    row.biomassKg += Math.max(0, population.biomassKg);
    if (population.population > 0) row.populations += 1;
    rows.set(population.speciesId, row);
  }
  return [...rows.values()]
    .map(row => ({ ...row, population: round3(row.population), biomassKg: round3(row.biomassKg) }))
    .sort((a, b) => a.speciesId.localeCompare(b.speciesId));
}

function aquaticFoodWebSnapshot(state: GameState): AquaticFoodWebDiagnostics {
  const rows = Object.values(state.ecologySystem?.aquaticFoodWebByNodeId || {});
  return {
    nodes: rows.length,
    detritusKg: round3(rows.reduce((sum, row) => sum + row.detritusKg, 0)),
    benthicInvertebratesKg: round3(rows.reduce((sum, row) => sum + row.benthicInvertebratesKg, 0)),
    zooplanktonKg: round3(rows.reduce((sum, row) => sum + row.zooplanktonKg, 0)),
    carrionKg: round3(rows.reduce((sum, row) => sum + row.carrionKg, 0)),
  };
}

function captureCheckpoint(state: GameState): Checkpoint {
  const system = state.ecologySystem!;
  const predators = (system.predatorPopulations || []).filter(population => population.population > 0) as EnergyAwarePredator[];
  const fauna = (system.animalPopulations || []).filter(population => population.population > 0);
  const aquatic = aquaticSnapshot(state);
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
  const checkpoint: Checkpoint = {
    gameDay: state.gameTime.day,
    predatorPopulation: round3(predatorPopulation),
    predatorBiomassKg: round3(predators.reduce((sum, population) => sum + population.biomassKg, 0)),
    predatorSpecies: species.length,
    faunaPopulation: round3(fauna.reduce((sum, population) => sum + population.population, 0)),
    faunaBiomassKg: round3(fauna.reduce((sum, population) => sum + population.biomassKg, 0)),
    faunaSpecies: new Set(fauna.map(population => population.speciesId)).size,
    aquaticPopulation: round3(aquatic.reduce((sum, row) => sum + row.population, 0)),
    aquaticBiomassKg: round3(aquatic.reduce((sum, row) => sum + row.biomassKg, 0)),
    aquaticSpecies: aquatic.filter(row => row.population > 0).length,
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
    aquatic,
    aquaticFoodWeb: aquaticFoodWebSnapshot(state),
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

function evaluateGate(baseline: Checkpoint, current: Checkpoint): string[] {
  const failures: string[] = [];
  const ratio = (value: number, base: number) => base > 0 ? value / base : 1;
  const predatorSurvival = ratio(current.predatorPopulation, baseline.predatorPopulation);
  const predatorGuild = ratio(current.predatorSpecies, baseline.predatorSpecies);
  const faunaGuild = ratio(current.faunaSpecies, baseline.faunaSpecies);
  const faunaPopulation = ratio(current.faunaPopulation, baseline.faunaPopulation);
  const aquaticGuild = ratio(current.aquaticSpecies, baseline.aquaticSpecies);
  const aquaticPopulation = ratio(current.aquaticPopulation, baseline.aquaticPopulation);

  if (predatorSurvival < 0.1) failures.push(`predator survival fell to ${round3(predatorSurvival * 100)}% of baseline`);
  if (predatorGuild < 0.5) failures.push(`predator guild fell to ${round3(predatorGuild * 100)}% of baseline species`);
  if (faunaGuild < 0.6) failures.push(`terrestrial prey guild fell to ${round3(faunaGuild * 100)}% of baseline species`);
  if (faunaPopulation < 0.25 || faunaPopulation > 4) failures.push(`terrestrial fauna population ratio is ${round3(faunaPopulation)}x baseline`);
  if (aquaticGuild < 0.6) failures.push(`aquatic guild fell to ${round3(aquaticGuild * 100)}% of baseline species`);
  if (aquaticPopulation < 0.25 || aquaticPopulation > 4) failures.push(`aquatic population ratio is ${round3(aquaticPopulation)}x baseline`);
  if (current.populationWeightedHunger >= 85 && current.highStressShare >= 0.5 && current.chronicStressDays >= 30) {
    failures.push(`predator guild remains critically hungry/stressed: hunger=${current.populationWeightedHunger}, highStress=${round3(current.highStressShare * 100)}%, chronic=${current.chronicStressDays}d`);
  }

  const currentSpecies = new Map(current.species.map(row => [row.speciesId, row]));
  for (const initial of baseline.species) {
    const row = currentSpecies.get(initial.speciesId);
    if (initial.population >= 2 && (!row || row.population <= 0)) failures.push(`${initial.speciesId} collapsed from baseline population ${initial.population}`);
    if (row && row.population > 0 && row.populationWeightedHunger >= 95 && row.reserveRatio <= 0.03 && row.chronicStressDays >= 30) {
      failures.push(`${row.speciesId} is trapped in near-max hunger with empty reserves and chronic stress`);
    }
  }
  return failures;
}

function main(): void {
  const seed = parseStringArg('seed', DEFAULT_SEED);
  const outputDir = parseStringArg('out', 'artifacts/p5-coupled-one-year');
  mkdirSync(outputDir, { recursive: true });
  const startedAt = performance.now();
  const state = freshState(seed);
  const warmupTicks = simulateDays(state, WARMUP_DAYS);
  const baseline = captureCheckpoint(state);
  assert.ok(baseline.predatorPopulation > 0, 'predators must seed during warmup before P5 validation');
  const validationTicks = simulateDays(state, VALIDATION_DAYS);
  const current = captureCheckpoint(state);
  const gateFailures = evaluateGate(baseline, current);
  const report = {
    seed,
    profile: 'coupled-terrestrial-aquatic-1y-gate',
    warmupDays: WARMUP_DAYS,
    validationDays: VALIDATION_DAYS,
    outerStepMinutes: STEP_MINUTES,
    aquaticIntegrationSubstepMinutes: AQUATIC_SUBSTEP_MINUTES,
    warmupTicks,
    validationTicks,
    estimatedAquaticSubsteps: (warmupTicks + validationTicks) * (STEP_MINUTES / AQUATIC_SUBSTEP_MINUTES),
    elapsedMs: round3(performance.now() - startedAt),
    baseline,
    current,
    predatorSurvivalShare: round3(current.predatorPopulation / baseline.predatorPopulation),
    faunaPopulationRatio: round3(current.faunaPopulation / baseline.faunaPopulation),
    aquaticPopulationRatio: round3(baseline.aquaticPopulation > 0 ? current.aquaticPopulation / baseline.aquaticPopulation : 1),
    gatePassed: gateFailures.length === 0,
    gateFailures,
    warnings: current.warnings,
  };
  const path = join(outputDir, 'p5-coupled-one-year-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`P5 coupled one-year report written to ${path}`);
  if (gateFailures.length > 0) process.exitCode = 2;
}

main();
