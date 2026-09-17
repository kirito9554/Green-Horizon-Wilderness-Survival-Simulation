import assert from 'node:assert/strict';
import { createSpatialFaunaEcosystemState, tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import { getSpatialFaunaCohortPopulation, getSpatialFaunaRuntimePopulation, getSpatialFaunaSeason } from '../src/simulation/spatial/spatialFaunaRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';
import type { SpatialFaunaRuntimeState } from '../src/types/spatialFaunaSimulation';

const CHECKPOINTS = new Set([365, 1095, 1825]);
const SAMPLE_INTERVAL_DAYS = 30;
const TRAILING_WINDOW_DAYS = 365;

interface Snapshot {
  day: number;
  season: string;
  floraKg: number;
  insectKg: number;
  prey: number;
  predators: number;
  preySpecies: number;
  predatorSpecies: number;
  floraSpecies: number;
  insectSpecies: number;
  meanCondition: number;
  meanFoodSufficiency: number;
  meanWaterSufficiency: number;
  foodFill: number;
  waterFill: number;
  resourceLimitedPopulation: number;
}

interface OccupancyTransitions {
  localExtirpations: number;
  localRecolonizations: number;
}

interface AnnualDemography {
  year: number;
  startPopulation: number;
  endPopulation: number;
  births: number;
  nonPredatorDeaths: number;
  predatorKills: number;
  meanConditionSum: number;
  meanFoodSufficiencySum: number;
  meanWaterSufficiencySum: number;
  resourceLimitedPopulationSum: number;
  days: number;
}

function presentPreySpecies(runtime: SpatialFaunaRuntimeState): number {
  return runtime.species.filter(species => Object.values(species.cohortsByPatch).some(cohort => getSpatialFaunaCohortPopulation(cohort) > 0)).length;
}

function presentPredatorSpecies(runtime: SpatialFaunaRuntimeState): number {
  return runtime.predatorSystem?.species.filter(species => Object.values(species.cohortsByPatch).some(cohort => cohort[0] + cohort[1] + cohort[2] > 0)).length ?? 0;
}

function presentFloraSpecies(runtime: SpatialFaunaRuntimeState): number {
  return runtime.floraSystem?.species.filter(species => Object.values(species.patches).some(state => state[0] > 1)).length ?? 0;
}

function presentInsectSpecies(runtime: SpatialFaunaRuntimeState): number {
  return runtime.insectSystem?.species.filter(species => Object.values(species.patches).some(state => state[0] > .01)).length ?? 0;
}

function preyOccupancy(runtime: SpatialFaunaRuntimeState): Set<string> {
  const occupied = new Set<string>();
  for (const species of runtime.species) {
    for (const [patchId, cohort] of Object.entries(species.cohortsByPatch)) {
      if (getSpatialFaunaCohortPopulation(cohort) > 0) occupied.add(`${species.speciesId}|${patchId}`);
    }
  }
  return occupied;
}

function compareOccupancy(previous: Set<string>, current: Set<string>, totals: OccupancyTransitions): void {
  for (const key of previous) if (!current.has(key)) totals.localExtirpations += 1;
  for (const key of current) if (!previous.has(key)) totals.localRecolonizations += 1;
}

function snapshot(runtime: SpatialFaunaRuntimeState, day: number): Snapshot {
  return {
    day,
    season: getSpatialFaunaSeason(day),
    floraKg: runtime.floraSystem?.telemetry.totalBiomassKg ?? 0,
    insectKg: runtime.insectSystem?.telemetry.totalBiomassKg ?? 0,
    prey: getSpatialFaunaRuntimePopulation(runtime),
    predators: runtime.predatorSystem?.telemetry.totalPopulation ?? 0,
    preySpecies: presentPreySpecies(runtime),
    predatorSpecies: presentPredatorSpecies(runtime),
    floraSpecies: presentFloraSpecies(runtime),
    insectSpecies: presentInsectSpecies(runtime),
    meanCondition: runtime.telemetry.meanCondition,
    meanFoodSufficiency: runtime.telemetry.meanFoodSufficiency,
    meanWaterSufficiency: runtime.telemetry.meanWaterSufficiency,
    foodFill: runtime.telemetry.meanFoodPoolFill ?? 1,
    waterFill: runtime.telemetry.meanWaterPoolFill ?? 1,
    resourceLimitedPopulation: runtime.telemetry.resourceLimitedPopulation ?? 0,
  };
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function ratio(value: number, baseline: number): number {
  return baseline > 0 ? value / baseline : 1;
}

function printCheckpoint(label: string, point: Snapshot, k: number): void {
  console.log(
    `${label} day=${point.day} season=${point.season} `
      + `flora=${(point.floraKg / 1e6).toFixed(1)}Mkg insects=${(point.insectKg / 1000).toFixed(1)}t `
      + `prey=${point.prey}/${k} predators=${point.predators} `
      + `species prey=${point.preySpecies} pred=${point.predatorSpecies} flora=${point.floraSpecies} insects=${point.insectSpecies} `
      + `condition=${point.meanCondition.toFixed(3)} suff food=${point.meanFoodSufficiency.toFixed(3)} water=${point.meanWaterSufficiency.toFixed(3)} `
      + `fill food=${point.foodFill.toFixed(3)} water=${point.waterFill.toFixed(3)}`,
  );
}

function printAnnualDemography(seed: string, annual: AnnualDemography): void {
  const expectedEnd = annual.startPopulation + annual.births - annual.nonPredatorDeaths - annual.predatorKills;
  const net = annual.endPopulation - annual.startPopulation;
  const accountedNet = annual.births - annual.nonPredatorDeaths - annual.predatorKills;
  assert.equal(expectedEnd, annual.endPopulation, `${seed}: year ${annual.year} demographic accounting mismatch (${expectedEnd} vs ${annual.endPopulation})`);
  console.log(
    `[${seed}] demography y${annual.year} pop=${annual.startPopulation}->${annual.endPopulation} net=${net} `
      + `births=${annual.births} deaths=${annual.nonPredatorDeaths} kills=${annual.predatorKills} accounted=${accountedNet} `
      + `meanCondition=${(annual.meanConditionSum / annual.days).toFixed(3)} `
      + `food=${(annual.meanFoodSufficiencySum / annual.days).toFixed(3)} `
      + `water=${(annual.meanWaterSufficiencySum / annual.days).toFixed(3)} `
      + `resourceLimited=${Math.round(annual.resourceLimitedPopulationSum / annual.days)}`,
  );
}

function runFiveYearSoak(seed: string): void {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaEcosystemState(seed, 1, world);
  const k = world.faunaCommunity.totalCarryingCapacity;
  const initial = snapshot(runtime, 1);
  const initialPreySpecies = initial.preySpecies;
  const initialPredatorSpecies = initial.predatorSpecies;
  const initialFloraSpecies = initial.floraSpecies;
  const initialInsectSpecies = initial.insectSpecies;
  const checkpoints = new Map<number, Snapshot>();
  const samples: Snapshot[] = [initial];
  const transitions: OccupancyTransitions = { localExtirpations: 0, localRecolonizations: 0 };
  let previousOccupancy = preyOccupancy(runtime);

  const annual: AnnualDemography[] = Array.from({ length: 5 }, (_, index) => ({
    year: index + 1,
    startPopulation: 0,
    endPopulation: 0,
    births: 0,
    nonPredatorDeaths: 0,
    predatorKills: 0,
    meanConditionSum: 0,
    meanFoodSufficiencySum: 0,
    meanWaterSufficiencySum: 0,
    resourceLimitedPopulationSum: 0,
    days: 0,
  }));
  annual[0].startPopulation = initial.prey;

  const minima = { floraKg: initial.floraKg, insectKg: initial.insectKg, prey: initial.prey, predators: initial.predators };
  const maxima = { floraKg: initial.floraKg, insectKg: initial.insectKg, prey: initial.prey, predators: initial.predators };
  let totalKills = 0;
  let totalInsectConsumption = 0;
  let daysWithFoodStress = 0;
  let daysWithWaterStress = 0;

  for (let day = 2; day <= 1825; day += 1) {
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day);
    totalKills += telemetry.predatorKills ?? 0;
    totalInsectConsumption += telemetry.insectConsumedKg ?? 0;
    if (telemetry.meanFoodSufficiency < .9) daysWithFoodStress += 1;
    if (telemetry.meanWaterSufficiency < .9) daysWithWaterStress += 1;

    const yearIndex = Math.min(4, Math.floor((day - 1) / 365));
    const bucket = annual[yearIndex];
    if (bucket.days === 0 && yearIndex > 0) bucket.startPopulation = annual[yearIndex - 1].endPopulation;
    bucket.births += telemetry.births;
    bucket.nonPredatorDeaths += telemetry.deaths;
    bucket.predatorKills += telemetry.predatorKills ?? 0;
    bucket.meanConditionSum += telemetry.meanCondition;
    bucket.meanFoodSufficiencySum += telemetry.meanFoodSufficiency;
    bucket.meanWaterSufficiencySum += telemetry.meanWaterSufficiency;
    bucket.resourceLimitedPopulationSum += telemetry.resourceLimitedPopulation ?? 0;
    bucket.days += 1;
    bucket.endPopulation = getSpatialFaunaRuntimePopulation(runtime);

    const currentFlora = runtime.floraSystem?.telemetry.totalBiomassKg ?? 0;
    const currentInsects = runtime.insectSystem?.telemetry.totalBiomassKg ?? 0;
    const currentPrey = getSpatialFaunaRuntimePopulation(runtime);
    const currentPredators = runtime.predatorSystem?.telemetry.totalPopulation ?? 0;
    minima.floraKg = Math.min(minima.floraKg, currentFlora);
    minima.insectKg = Math.min(minima.insectKg, currentInsects);
    minima.prey = Math.min(minima.prey, currentPrey);
    minima.predators = Math.min(minima.predators, currentPredators);
    maxima.floraKg = Math.max(maxima.floraKg, currentFlora);
    maxima.insectKg = Math.max(maxima.insectKg, currentInsects);
    maxima.prey = Math.max(maxima.prey, currentPrey);
    maxima.predators = Math.max(maxima.predators, currentPredators);

    if (day % SAMPLE_INTERVAL_DAYS === 0 || CHECKPOINTS.has(day)) {
      const point = snapshot(runtime, day);
      samples.push(point);
      if (CHECKPOINTS.has(day)) checkpoints.set(day, point);
      const occupancy = preyOccupancy(runtime);
      compareOccupancy(previousOccupancy, occupancy, transitions);
      previousOccupancy = occupancy;
    }
  }

  const y1 = checkpoints.get(365)!;
  const y3 = checkpoints.get(1095)!;
  const y5 = checkpoints.get(1825)!;
  printCheckpoint(`[${seed}] year1`, y1, k);
  printCheckpoint(`[${seed}] year3`, y3, k);
  printCheckpoint(`[${seed}] year5`, y5, k);
  for (const bucket of annual) printAnnualDemography(seed, bucket);

  const trailing = samples.filter(sample => sample.day > 1825 - TRAILING_WINDOW_DAYS);
  const priorYear = samples.filter(sample => sample.day > 1095 && sample.day <= 1460);
  const trailingFlora = mean(trailing.map(sample => sample.floraKg));
  const priorFlora = mean(priorYear.map(sample => sample.floraKg));
  const trailingInsects = mean(trailing.map(sample => sample.insectKg));
  const priorInsects = mean(priorYear.map(sample => sample.insectKg));
  const trailingPrey = mean(trailing.map(sample => sample.prey));
  const priorPrey = mean(priorYear.map(sample => sample.prey));
  const trailingPredators = mean(trailing.map(sample => sample.predators));
  const priorPredators = mean(priorYear.map(sample => sample.predators));

  assert.ok(minima.floraKg > initial.floraKg * .2, `${seed}: flora hit collapse floor (${ratio(minima.floraKg, initial.floraKg).toFixed(3)}x initial)`);
  assert.ok(minima.insectKg > initial.insectKg * .1, `${seed}: insects hit collapse floor (${ratio(minima.insectKg, initial.insectKg).toFixed(3)}x initial)`);
  assert.ok(minima.prey > k * .2, `${seed}: prey hit collapse floor (${minima.prey}/${k})`);
  assert.ok(minima.predators > 0, `${seed}: predator community went globally extinct`);

  assert.ok(trailingFlora >= priorFlora * .72, `${seed}: flora shows slow death spiral (${priorFlora.toFixed(0)} -> ${trailingFlora.toFixed(0)}kg mean)`);
  assert.ok(trailingInsects >= priorInsects * .6, `${seed}: insects show slow death spiral (${priorInsects.toFixed(0)} -> ${trailingInsects.toFixed(0)}kg mean)`);
  assert.ok(trailingPrey >= priorPrey * .68, `${seed}: prey shows slow death spiral (${priorPrey.toFixed(0)} -> ${trailingPrey.toFixed(0)} mean)`);
  assert.ok(trailingPredators >= Math.max(1, priorPredators * .45), `${seed}: predators show slow death spiral (${priorPredators.toFixed(1)} -> ${trailingPredators.toFixed(1)} mean)`);

  assert.ok(y5.preySpecies >= initialPreySpecies - 3, `${seed}: excessive prey species loss (${initialPreySpecies} -> ${y5.preySpecies})`);
  assert.ok(y5.predatorSpecies >= Math.max(3, initialPredatorSpecies - 2), `${seed}: excessive predator species loss (${initialPredatorSpecies} -> ${y5.predatorSpecies})`);
  assert.ok(y5.floraSpecies >= initialFloraSpecies - 4, `${seed}: excessive flora taxon loss (${initialFloraSpecies} -> ${y5.floraSpecies})`);
  assert.ok(y5.insectSpecies >= initialInsectSpecies - 4, `${seed}: excessive insect guild/taxon loss (${initialInsectSpecies} -> ${y5.insectSpecies})`);

  assert.ok(transitions.localExtirpations > 0, `${seed}: no local prey extirpation observed over five years`);
  assert.ok(transitions.localRecolonizations > 0, `${seed}: no local prey recolonization observed over five years`);
  assert.ok(totalKills > 0, `${seed}: predators stopped functioning during soak`);
  assert.ok(totalInsectConsumption > 0, `${seed}: insect trophic link stopped functioning during soak`);

  console.log(
    `[${seed}] 5y extrema flora=${(minima.floraKg / 1e6).toFixed(1)}-${(maxima.floraKg / 1e6).toFixed(1)}Mkg `
      + `insects=${(minima.insectKg / 1000).toFixed(1)}-${(maxima.insectKg / 1000).toFixed(1)}t `
      + `prey=${minima.prey}-${maxima.prey} predators=${minima.predators}-${maxima.predators} `
      + `localTransitions extirp=${transitions.localExtirpations} recolon=${transitions.localRecolonizations} `
      + `stressDays food=${daysWithFoodStress} water=${daysWithWaterStress} kills=${totalKills} insectEaten=${(totalInsectConsumption / 1000).toFixed(1)}t`,
  );
  console.log(
    `[${seed}] annual trend year4->year5 mean flora=${(priorFlora / 1e6).toFixed(1)}->${(trailingFlora / 1e6).toFixed(1)}Mkg `
      + `insects=${(priorInsects / 1000).toFixed(1)}->${(trailingInsects / 1000).toFixed(1)}t `
      + `prey=${priorPrey.toFixed(0)}->${trailingPrey.toFixed(0)} predators=${priorPredators.toFixed(1)}->${trailingPredators.toFixed(1)}`,
  );
}

runFiveYearSoak('spatial-trophic-soak-alpha');
console.log('Five-year spatial terrestrial trophic soak passed.');
