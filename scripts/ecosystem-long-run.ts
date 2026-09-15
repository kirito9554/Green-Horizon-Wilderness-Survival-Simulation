import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState, WeatherType } from '../src/types';
import type { WildAnimalPopulation, WildPredatorPopulation } from '../src/types/ecologySimulation';
import type { WildAquaticPopulation } from '../src/types/aquaticEcology';
import '../src/types/ecologySimulation';
import '../src/types/aquaticEcology';
import '../src/types/hydrologySimulation';
import { MAIN_WORLD_AREA_IDS, type MainWorldAreaId } from '../src/data/mainWorldAreas';
import { WILD_FLORA_SPECIES } from '../src/data/ecologyProfiles';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation } from '../src/simulation/buildGridSystem';
import {
  applyEcologyDisturbance,
  createWorldEcologyState,
  discoverEcologySubarea,
  ensureRegionEcology,
  tickWorldEcology,
} from '../src/simulation/ecologySystem';
import { tickWildPredators } from '../src/simulation/ecologyPredatorSystem';
import { createWorldHydrologyState, tickWorldHydrology } from '../src/simulation/hydrologySystem';
import { ensureSurfaceWaterNetwork, tickSurfaceWaterHydrology } from '../src/simulation/hydrologySurfaceWaterSystem';
import { tickAquaticEcologyAtEnvironmentalScale } from '../src/simulation/environmentalScaleSystem';
import {
  finalizeTerrestrialEcologyScale,
  prepareTerrestrialEcologyScale,
  reconcileTerrestrialEcologyScale,
} from '../src/simulation/terrestrialEcologyScaleSystem';
import { finalizeLivingHydrologyState, prepareLivingHydrologyState } from '../src/simulation/livingHydrologyBridge';
import { tickLongRunEcosystemBalance, tickWildFaunaWithStableFoodWebClock } from '../src/simulation/longRunEcosystemSystem';
import { reconcileBiologicalResourcePools } from '../src/simulation/resourceEcologyBridge';
import { advanceTime } from '../src/simulation/timeSystem';
import { getCardinalDirection, WEATHER_BASELINES } from '../src/simulation/weatherSystem';

const DAYS_PER_YEAR = 365;
const MINUTES_PER_DAY = 1440;
const SAMPLE_INTERVAL_DAYS = 30;
const DEFAULT_STEP_MINUTES = 720;
const DEFAULT_SEED = 'ecosystem-long-run-v1';
const ENVIRONMENTAL_FORCING_SUBSTEP_MINUTES = 360;

const SCENARIOS = ['untouched', 'sustainable_harvest', 'heavy_harvest', 'catastrophe_recovery'] as const;
type ScenarioId = (typeof SCENARIOS)[number];

interface RunOptions {
  scenario: ScenarioId;
  durationDays: number;
  stepMinutes: number;
  seed: string;
}

interface ScenarioRuntime {
  lastMonthlyHarvestPeriod: number;
  catastropheApplied: boolean;
  peakDisturbance: number;
}

interface EcosystemSnapshot {
  elapsedDays: number;
  gameDay: number;
  plantBiomassKg: number;
  fruitBiomassKg: number;
  faunaPopulation: number;
  faunaBiomassKg: number;
  predatorPopulation: number;
  predatorBiomassKg: number;
  aquaticPopulation: number;
  aquaticBiomassKg: number;
  averageCanopy: number;
  averagePlantDiversity: number;
  averageForagingPressure: number;
  averageFireDamage: number;
  averageLoggingPressure: number;
  averageFaunaFoodStress: number;
  averagePredatorHungerStress: number;
  averageAquaticStress: number;
  biologicalGatherStockUnits: number;
  floraBySpeciesKg: Record<string, number>;
  faunaBySpecies: Record<string, number>;
  predatorsBySpecies: Record<string, number>;
  aquaticBySpecies: Record<string, number>;
}

interface LongRunResult {
  scenario: ScenarioId;
  durationDays: number;
  stepMinutes: number;
  seed: string;
  baseline: EcosystemSnapshot;
  final: EcosystemSnapshot;
  telemetry: EcosystemSnapshot[];
  peakDisturbance: number;
  warnings: string[];
}

interface AgeStructuredPopulation {
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  biomassKg: number;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sumBySpecies<T extends { speciesId: string }>(items: T[], value: (item: T) => number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) result[item.speciesId] = round3((result[item.speciesId] || 0) + value(item));
  return result;
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

  reconcileBiologicalResourcePools(state);
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

function withdrawPoolUnits(state: GameState, nodeId: string, units: number): void {
  if (!state.resourcePools || units <= 0) return;
  const pool = state.resourcePools[nodeId];
  if (!pool) return;
  pool.currentStock = Math.max(0, pool.currentStock - units);
}

function harvestAgeStructured(population: AgeStructuredPopulation, fraction: number): number {
  const before = population.population;
  if (before <= 0 || fraction <= 0) return 0;
  let remainingToRemove = Math.min(before, Math.floor(before * fraction));
  if (remainingToRemove <= 0) return 0;
  const removed = remainingToRemove;

  const adultRemoved = Math.min(population.adults, remainingToRemove);
  population.adults -= adultRemoved;
  remainingToRemove -= adultRemoved;
  const oldRemoved = Math.min(population.old, remainingToRemove);
  population.old -= oldRemoved;
  remainingToRemove -= oldRemoved;
  const juvenileRemoved = Math.min(population.juveniles, remainingToRemove);
  population.juveniles -= juvenileRemoved;

  population.population = population.juveniles + population.adults + population.old;
  population.biomassKg = round3(population.biomassKg * (population.population / Math.max(1, before)));
  return removed;
}

function harvestFauna(state: GameState, fraction: number): number {
  const populations = state.ecologySystem?.animalPopulations || [];
  let removed = 0;
  for (const population of populations) {
    if (population.poiId !== 'AREA_FOREST_EDGE') continue;
    removed += harvestAgeStructured(population, fraction);
  }
  const region = state.ecologySystem?.regionsByPoiId.AREA_FOREST_EDGE;
  if (region) region.huntingPressure = clamp(region.huntingPressure + fraction * 55);
  return removed;
}

function harvestAquatic(state: GameState, fraction: number): number {
  const populations = state.ecologySystem?.aquaticPopulations || [];
  let removed = 0;
  for (const population of populations) {
    if (!population.poiIds.includes('AREA_FISHING_LAGOON')) continue;
    removed += harvestAgeStructured(population, fraction);
  }
  const region = state.ecologySystem?.regionsByPoiId.AREA_FISHING_LAGOON;
  if (region) region.fishingPressure = clamp(region.fishingPressure + fraction * 60);
  return removed;
}

function applyPlantHarvest(state: GameState, ratesPerDay: Record<string, number>, stepDays: number): void {
  reconcileBiologicalResourcePools(state);
  for (const [nodeId, rate] of Object.entries(ratesPerDay)) withdrawPoolUnits(state, nodeId, rate * stepDays);
  reconcileBiologicalResourcePools(state);
}

function averageDisturbance(state: GameState): number {
  const subareas = Object.values(state.ecologySystem?.subareasById || {}).filter(Boolean);
  return average(subareas.map(subarea =>
    (subarea!.disturbance.fireDamage + subarea!.disturbance.loggingPressure + subarea!.disturbance.foragingPressure) / 3,
  ));
}

function applyScenarioInterventions(
  state: GameState,
  scenario: ScenarioId,
  elapsedDays: number,
  stepDays: number,
  runtime: ScenarioRuntime,
): void {
  if (scenario === 'sustainable_harvest') {
    applyPlantHarvest(state, {
      NODE_CAMP_COCONUTS: 0.16,
      NODE_BAMBOO_STALKS: 0.035,
      NODE_FORAGE_BERRIES: 0.28,
      NODE_GLADE_HERBS: 0.035,
      NODE_TRAIL_HERBS: 0.05,
    }, stepDays);
  } else if (scenario === 'heavy_harvest') {
    applyPlantHarvest(state, {
      NODE_CAMP_COCONUTS: 1.4,
      NODE_BAMBOO_STALKS: 0.52,
      NODE_FORAGE_BERRIES: 2.4,
      NODE_GLADE_HERBS: 0.34,
      NODE_TRAIL_HERBS: 0.42,
    }, stepDays);
  } else {
    reconcileBiologicalResourcePools(state);
  }

  const monthlyPeriod = Math.floor(elapsedDays / 30);
  if (monthlyPeriod > runtime.lastMonthlyHarvestPeriod) {
    if (scenario === 'sustainable_harvest') {
      harvestFauna(state, 0.015);
      harvestAquatic(state, 0.02);
    } else if (scenario === 'heavy_harvest') {
      harvestFauna(state, 0.12);
      harvestAquatic(state, 0.15);
    }
    runtime.lastMonthlyHarvestPeriod = monthlyPeriod;
  }

  if (scenario === 'catastrophe_recovery' && !runtime.catastropheApplied && elapsedDays >= 120) {
    const forest = state.ecologySystem?.regionsByPoiId.AREA_FOREST_EDGE;
    const bamboo = state.ecologySystem?.regionsByPoiId.AREA_BAMBOO_GROVE;
    for (const subareaId of forest?.subareaIds || []) {
      applyEcologyDisturbance(state, subareaId, {
        vegetationLoss: 42,
        canopyLoss: 28,
        fireDamage: 72,
        stormDamage: 18,
        humanPressure: 20,
        loggingPressure: 24,
      });
    }
    for (const subareaId of bamboo?.subareaIds.slice(0, Math.max(1, Math.floor((bamboo?.subareaIds.length || 0) / 2))) || []) {
      applyEcologyDisturbance(state, subareaId, {
        vegetationLoss: 24,
        canopyLoss: 12,
        fireDamage: 38,
        humanPressure: 12,
        loggingPressure: 18,
      });
    }
    runtime.catastropheApplied = true;
  }

  runtime.peakDisturbance = Math.max(runtime.peakDisturbance, averageDisturbance(state));
}

function stepEcosystemSlice(
  state: GameState,
  minutes: number,
  scenario: ScenarioId,
  elapsedMinutesAfterSlice: number,
  runtime: ScenarioRuntime,
): void {
  // Weather is a forcing over the interval that is about to be integrated. Use
  // the interval-start state so a six-hour coarse step sees the same forcing as
  // six one-hour fine steps inside the same deterministic weather slot.
  deterministicWeather(state);
  advanceTime(state, minutes);
  tickWorldHydrology(state, minutes);
  tickSurfaceWaterHydrology(state, minutes);
  prepareLivingHydrologyState(state, minutes);

  applyScenarioInterventions(state, scenario, elapsedMinutesAfterSlice / MINUTES_PER_DAY, minutes / MINUTES_PER_DAY, runtime);

  const scaleSnapshot = prepareTerrestrialEcologyScale(state);
  try {
    tickWorldEcology(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    finalizeLivingHydrologyState(state);
    tickAquaticEcologyAtEnvironmentalScale(state, minutes);
    tickWildFaunaWithStableFoodWebClock(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    tickWildPredators(state, minutes);
    reconcileTerrestrialEcologyScale(state);
    tickLongRunEcosystemBalance(state, minutes);
  } finally {
    finalizeTerrestrialEcologyScale(state, scaleSnapshot);
  }
}

function stepEcosystem(
  state: GameState,
  minutes: number,
  scenario: ScenarioId,
  elapsedMinutesAfterStep: number,
  runtime: ScenarioRuntime,
): void {
  let remaining = Math.max(0, minutes);
  let elapsedCursor = Math.max(0, elapsedMinutesAfterStep - minutes);
  while (remaining > 0.0001) {
    const slice = Math.min(remaining, ENVIRONMENTAL_FORCING_SUBSTEP_MINUTES);
    elapsedCursor += slice;
    stepEcosystemSlice(state, slice, scenario, elapsedCursor, runtime);
    remaining -= slice;
  }
  // Expose the weather corresponding to the final clock for telemetry/UI while
  // keeping all physical integration above driven by interval-start forcing.
  deterministicWeather(state);
}

function captureSnapshot(state: GameState, elapsedDays: number): EcosystemSnapshot {
  reconcileBiologicalResourcePools(state);
  const system = state.ecologySystem!;
  const plants = system.plantPopulations || [];
  const fauna = system.animalPopulations || [];
  const predators = system.predatorPopulations || [];
  const aquatic = system.aquaticPopulations || [];
  const subareas = Object.values(system.subareasById).filter(Boolean);
  const biologicalStock = Object.entries(state.resourcePools || {})
    .filter(([nodeId]) => [
      'NODE_CAMP_COCONUTS',
      'NODE_BAMBOO_STALKS',
      'NODE_FORAGE_BERRIES',
      'NODE_GLADE_HERBS',
      'NODE_TRAIL_HERBS',
    ].includes(nodeId))
    .reduce((sum, [, pool]) => sum + pool.currentStock, 0);

  return {
    elapsedDays: round3(elapsedDays),
    gameDay: state.gameTime.day,
    plantBiomassKg: round3(plants.reduce((sum, population) => sum + population.biomassKg, 0)),
    fruitBiomassKg: round3(plants.reduce((sum, population) => sum + population.fruitBiomassKg, 0)),
    faunaPopulation: round3(fauna.reduce((sum, population) => sum + population.population, 0)),
    faunaBiomassKg: round3(fauna.reduce((sum, population) => sum + population.biomassKg, 0)),
    predatorPopulation: round3(predators.reduce((sum, population) => sum + population.population, 0)),
    predatorBiomassKg: round3(predators.reduce((sum, population) => sum + population.biomassKg, 0)),
    aquaticPopulation: round3(aquatic.reduce((sum, population) => sum + population.population, 0)),
    aquaticBiomassKg: round3(aquatic.reduce((sum, population) => sum + population.biomassKg, 0)),
    averageCanopy: round3(average(subareas.map(subarea => subarea!.environment.canopyCover))),
    averagePlantDiversity: round3(average(subareas.map(subarea => subarea!.ecology.plantDiversity))),
    averageForagingPressure: round3(average(subareas.map(subarea => subarea!.disturbance.foragingPressure))),
    averageFireDamage: round3(average(subareas.map(subarea => subarea!.disturbance.fireDamage))),
    averageLoggingPressure: round3(average(subareas.map(subarea => subarea!.disturbance.loggingPressure))),
    averageFaunaFoodStress: round3(average(fauna.map(population => population.foodStress))),
    averagePredatorHungerStress: round3(average(predators.map(population => population.hungerStress))),
    averageAquaticStress: round3(average(aquatic.map(population => (population.habitatStress + population.oxygenStress + population.foodStress) / 3))),
    biologicalGatherStockUnits: round3(biologicalStock),
    floraBySpeciesKg: sumBySpecies(plants, population => population.biomassKg),
    faunaBySpecies: sumBySpecies(fauna, population => population.population),
    predatorsBySpecies: sumBySpecies(predators, population => population.population),
    aquaticBySpecies: sumBySpecies(aquatic, population => population.population),
  };
}

function assertAgeStructure(populations: AgeStructuredPopulation[], label: string): void {
  for (const population of populations) {
    assert.ok(Number.isFinite(population.population) && population.population >= 0, `${label} population must stay finite/non-negative`);
    assert.ok(Number.isFinite(population.biomassKg) && population.biomassKg >= 0, `${label} biomass must stay finite/non-negative`);
    const structured = population.juveniles + population.adults + population.old;
    assert.ok(Math.abs(structured - population.population) < 0.001, `${label} age structure must conserve population`);
  }
}

function assertStateInvariants(state: GameState): void {
  const system = state.ecologySystem!;
  for (const plant of system.plantPopulations) {
    assert.ok(Number.isFinite(plant.biomassKg) && plant.biomassKg >= 0, 'plant biomass must stay finite/non-negative');
    assert.ok(Number.isFinite(plant.fruitBiomassKg) && plant.fruitBiomassKg >= 0, 'fruit biomass must stay finite/non-negative');
    const flora = WILD_FLORA_SPECIES[plant.speciesId];
    if (!flora) continue;
    const standingRatio = Math.max(0, flora.fruitKgPer100Biomass) / 100;
    const generousCap = plant.biomassKg * standingRatio * 1.35 + 0.05;
    assert.ok(plant.fruitBiomassKg <= generousCap, `standing fruit must remain bounded for ${plant.speciesId}`);
  }
  assertAgeStructure(system.animalPopulations || [], 'fauna');
  assertAgeStructure(system.predatorPopulations || [], 'predator');
  assertAgeStructure(system.aquaticPopulations || [], 'aquatic');
}

function warningsFor(result: LongRunResult): string[] {
  const warnings: string[] = [];
  const ratio = (end: number, start: number) => start > 0 ? end / start : 1;
  const plantRatio = ratio(result.final.plantBiomassKg, result.baseline.plantBiomassKg);
  if (plantRatio < 0.35) warnings.push(`plant biomass fell to ${(plantRatio * 100).toFixed(1)}% of baseline`);
  if (plantRatio > 3) warnings.push(`plant biomass rose to ${(plantRatio * 100).toFixed(1)}% of baseline`);
  if (result.final.faunaPopulation <= 0) warnings.push('all terrestrial fauna collapsed');
  if (result.final.aquaticPopulation <= 0) warnings.push('all aquatic fauna collapsed');
  if (result.final.predatorPopulation <= 0) warnings.push('all predator populations collapsed');
  if (result.final.averageFaunaFoodStress > 75) warnings.push('fauna food stress remains critically high');
  if (result.final.averagePredatorHungerStress > 80) warnings.push('predator hunger stress remains critically high');
  return warnings;
}

function runScenario(options: RunOptions): LongRunResult {
  assert.ok(options.durationDays > 0, 'durationDays must be positive');
  assert.ok(options.stepMinutes >= 30 && options.stepMinutes <= MINUTES_PER_DAY, 'stepMinutes must be between 30 and 1440');
  const state = freshState(options.seed);
  const runtime: ScenarioRuntime = { lastMonthlyHarvestPeriod: 0, catastropheApplied: false, peakDisturbance: 0 };

  // One neutral hour seeds terrestrial fauna and starts hydrological observation.
  stepEcosystem(state, 60, 'untouched', 0, runtime);
  const baseline = captureSnapshot(state, 0);
  const telemetry: EcosystemSnapshot[] = [baseline];
  const totalMinutes = options.durationDays * MINUTES_PER_DAY;
  const sampleEveryMinutes = SAMPLE_INTERVAL_DAYS * MINUTES_PER_DAY;
  let elapsedMinutes = 0;
  let nextSampleMinute = sampleEveryMinutes;

  while (elapsedMinutes < totalMinutes) {
    const step = Math.min(options.stepMinutes, totalMinutes - elapsedMinutes);
    elapsedMinutes += step;
    stepEcosystem(state, step, options.scenario, elapsedMinutes, runtime);
    if (elapsedMinutes + 0.001 >= nextSampleMinute || elapsedMinutes + 0.001 >= totalMinutes) {
      telemetry.push(captureSnapshot(state, elapsedMinutes / MINUTES_PER_DAY));
      while (nextSampleMinute <= elapsedMinutes + 0.001) nextSampleMinute += sampleEveryMinutes;
    }
  }

  assertStateInvariants(state);
  const result: LongRunResult = {
    scenario: options.scenario,
    durationDays: options.durationDays,
    stepMinutes: options.stepMinutes,
    seed: options.seed,
    baseline,
    final: captureSnapshot(state, options.durationDays),
    telemetry,
    peakDisturbance: round3(runtime.peakDisturbance),
    warnings: [],
  };
  result.warnings = warningsFor(result);
  return result;
}

function relativeDifference(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
}

function fingerprint(snapshot: EcosystemSnapshot): string {
  return JSON.stringify({
    plantBiomassKg: snapshot.plantBiomassKg,
    fruitBiomassKg: snapshot.fruitBiomassKg,
    faunaPopulation: snapshot.faunaPopulation,
    faunaBiomassKg: snapshot.faunaBiomassKg,
    predatorPopulation: snapshot.predatorPopulation,
    predatorBiomassKg: snapshot.predatorBiomassKg,
    aquaticPopulation: snapshot.aquaticPopulation,
    aquaticBiomassKg: snapshot.aquaticBiomassKg,
    floraBySpeciesKg: snapshot.floraBySpeciesKg,
    faunaBySpecies: snapshot.faunaBySpecies,
    predatorsBySpecies: snapshot.predatorsBySpecies,
    aquaticBySpecies: snapshot.aquaticBySpecies,
  });
}

function runCiSuite(): void {
  const deterministicA = runScenario({ scenario: 'untouched', durationDays: 60, stepMinutes: 360, seed: 'long-run-ci-determinism' });
  const deterministicB = runScenario({ scenario: 'untouched', durationDays: 60, stepMinutes: 360, seed: 'long-run-ci-determinism' });
  assert.equal(fingerprint(deterministicA.final), fingerprint(deterministicB.final), 'same seed and timestep must reproduce the same ecosystem state');

  const fine = runScenario({ scenario: 'untouched', durationDays: 90, stepMinutes: 60, seed: 'long-run-ci-timestep' });
  const coarse = runScenario({ scenario: 'untouched', durationDays: 90, stepMinutes: 360, seed: 'long-run-ci-timestep' });
  const timestepMetrics: Array<keyof EcosystemSnapshot> = [
    'plantBiomassKg',
    'fruitBiomassKg',
    'faunaBiomassKg',
    'predatorBiomassKg',
    'aquaticBiomassKg',
  ];
  for (const metric of timestepMetrics) {
    const a = fine.final[metric];
    const b = coarse.final[metric];
    assert.equal(typeof a, 'number');
    assert.equal(typeof b, 'number');
    assert.ok(relativeDifference(a as number, b as number) < 0.45, `${String(metric)} must remain reasonably timestep invariant`);
  }

  const untouched = runScenario({ scenario: 'untouched', durationDays: 365, stepMinutes: 720, seed: 'long-run-ci-pressure' });
  const heavy = runScenario({ scenario: 'heavy_harvest', durationDays: 365, stepMinutes: 720, seed: 'long-run-ci-pressure' });
  assert.ok(untouched.final.plantBiomassKg > 0 && untouched.final.faunaPopulation > 0 && untouched.final.aquaticPopulation > 0, 'untouched one-year ecosystem must remain biologically active');
  assert.ok(
    heavy.final.biologicalGatherStockUnits < untouched.final.biologicalGatherStockUnits
      || heavy.final.faunaPopulation < untouched.final.faunaPopulation
      || heavy.final.aquaticPopulation < untouched.final.aquaticPopulation,
    'heavy harvesting must produce a measurable ecological depletion signal',
  );

  const catastrophe = runScenario({ scenario: 'catastrophe_recovery', durationDays: 365, stepMinutes: 720, seed: 'long-run-ci-catastrophe' });
  const finalDisturbance = (catastrophe.final.averageFireDamage + catastrophe.final.averageLoggingPressure + catastrophe.final.averageForagingPressure) / 3;
  assert.ok(catastrophe.peakDisturbance > finalDisturbance, 'disturbance must decline after a one-off catastrophe instead of remaining permanently locked');

  console.log('ecosystem long-run CI harness: ok');
  console.log(JSON.stringify({
    timestepDifference: Object.fromEntries(timestepMetrics.map(metric => [metric, round3(relativeDifference(fine.final[metric] as number, coarse.final[metric] as number))])),
    untouched: untouched.final,
    heavyHarvest: heavy.final,
    catastrophe: catastrophe.final,
  }, null, 2));
}

function snapshotCsv(rows: EcosystemSnapshot[]): string {
  const columns: Array<keyof EcosystemSnapshot> = [
    'elapsedDays', 'gameDay', 'plantBiomassKg', 'fruitBiomassKg', 'faunaPopulation', 'faunaBiomassKg',
    'predatorPopulation', 'predatorBiomassKg', 'aquaticPopulation', 'aquaticBiomassKg', 'averageCanopy',
    'averagePlantDiversity', 'averageForagingPressure', 'averageFireDamage', 'averageLoggingPressure',
    'averageFaunaFoodStress', 'averagePredatorHungerStress', 'averageAquaticStress', 'biologicalGatherStockUnits',
  ];
  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => String(row[column])).join(',')),
  ].join('\n');
}

function parseListArg(name: string): string[] | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).split(',').map(value => value.trim()).filter(Boolean) : undefined;
}

function parseNumberArg(name: string, fallback: number): number {
  const value = parseListArg(name)?.[0];
  const parsed = value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringArg(name: string, fallback: string): string {
  return parseListArg(name)?.[0] || fallback;
}

function main(): void {
  if (process.argv.includes('--ci')) {
    runCiSuite();
    return;
  }

  const requestedScenarios = parseListArg('scenario') || [...SCENARIOS];
  const scenarios = requestedScenarios.filter((value): value is ScenarioId => (SCENARIOS as readonly string[]).includes(value));
  assert.ok(scenarios.length > 0, `scenario must be one of: ${SCENARIOS.join(', ')}`);
  const years = (parseListArg('years') || ['1', '5', '20']).map(Number).filter(value => Number.isFinite(value) && value > 0);
  assert.ok(years.length > 0, 'years must contain at least one positive number');
  const stepMinutes = parseNumberArg('step-minutes', DEFAULT_STEP_MINUTES);
  const seed = parseStringArg('seed', DEFAULT_SEED);
  const outputDir = parseStringArg('out', 'artifacts/ecosystem-long-run');
  mkdirSync(outputDir, { recursive: true });

  const manifest: Array<Record<string, unknown>> = [];
  for (const scenario of scenarios) {
    for (const yearCount of years) {
      const durationDays = yearCount * DAYS_PER_YEAR;
      console.log(`Running ${scenario}: ${yearCount}y @ ${stepMinutes} min/step ...`);
      const result = runScenario({ scenario, durationDays, stepMinutes, seed });
      const stem = `${scenario}-${yearCount}y-${stepMinutes}m`;
      writeFileSync(join(outputDir, `${stem}.json`), JSON.stringify(result, null, 2));
      writeFileSync(join(outputDir, `${stem}.csv`), snapshotCsv(result.telemetry));
      manifest.push({
        scenario,
        years: yearCount,
        stepMinutes,
        seed,
        baseline: result.baseline,
        final: result.final,
        peakDisturbance: result.peakDisturbance,
        warnings: result.warnings,
      });
      console.log(`${stem}: plants=${result.final.plantBiomassKg}kg fauna=${result.final.faunaPopulation} predators=${result.final.predatorPopulation} aquatic=${result.final.aquaticPopulation} warnings=${result.warnings.length}`);
    }
  }

  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Long-run ecosystem reports written to ${outputDir}`);
}

main();
