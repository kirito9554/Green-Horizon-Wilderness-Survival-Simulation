import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSpatialFaunaEcosystemState, tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import type { SpatialPredatorRuntimeOptions, } from '../src/simulation/spatial/spatialPredatorRuntime';
import { getSpatialFaunaCohortPopulation, getSpatialFaunaRuntimePopulation, getSpatialFaunaSeason } from '../src/simulation/spatial/spatialFaunaRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';
import type { SpatialPredatorSpeciesTelemetry } from '../src/types/spatialEcologySimulation';
import type { SpatialFaunaRuntimeState } from '../src/types/spatialFaunaSimulation';

const CHECKPOINTS = new Set([365, 1095, 1825]);
const SAMPLE_INTERVAL_DAYS = 30;
const TRAILING_WINDOW_DAYS = 365;
type P6Mode = 'baseline' | 'mate-only' | 'recovery-only' | 'combined';
const mode = (process.env.PREDATOR_P6_MODE ?? 'combined') as P6Mode;
const seed = process.env.SPATIAL_TROPHIC_SEED ?? 'spatial-trophic-soak-alpha';
const enforceGate = process.env.PREDATOR_P6_ASSERT !== '0';
const optionsByMode: Record<P6Mode, SpatialPredatorRuntimeOptions> = {
  baseline: { maintainMateConnectivity: false, controlledRecovery: false },
  'mate-only': { maintainMateConnectivity: true, controlledRecovery: false },
  'recovery-only': { maintainMateConnectivity: false, controlledRecovery: true },
  combined: { maintainMateConnectivity: true, controlledRecovery: true },
};
const predatorOptions = optionsByMode[mode] ?? optionsByMode.combined;

interface PredatorCheckpoint {
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  breedingCapableCohorts: number;
  isolatedBreeders: number;
  belowMvpDays: number;
  recoveryPressure: number;
}

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
  predatorBySpecies: Record<string, PredatorCheckpoint>;
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
  faunaImmigrants: number;
  nonPredatorDeaths: number;
  predatorKills: number;
  meanConditionSum: number;
  meanFoodSufficiencySum: number;
  meanWaterSufficiencySum: number;
  resourceLimitedPopulationSum: number;
  days: number;
}

interface PredatorAggregate extends SpatialPredatorSpeciesTelemetry {
  maxGlobalAbsenceDays: number;
}

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
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

function predatorCheckpoint(runtime: SpatialFaunaRuntimeState): Record<string, PredatorCheckpoint> {
  const result: Record<string, PredatorCheckpoint> = {};
  for (const [speciesId, telemetry] of Object.entries(runtime.predatorSystem?.telemetry.bySpecies ?? {})) {
    result[speciesId] = {
      population: telemetry.endPopulation,
      juveniles: telemetry.juveniles,
      adults: telemetry.adults,
      old: telemetry.old,
      breedingCapableCohorts: telemetry.breedingCapableCohorts,
      isolatedBreeders: telemetry.isolatedBreeders,
      belowMvpDays: telemetry.belowMvpDays,
      recoveryPressure: telemetry.recoveryPressure,
    };
  }
  return result;
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
    predatorBySpecies: predatorCheckpoint(runtime),
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
  for (const [speciesId, state] of Object.entries(point.predatorBySpecies)) {
    console.log(
      `${label} ${speciesId} pop=${state.population} age=${state.juveniles}/${state.adults}/${state.old} `
        + `breeding=${state.breedingCapableCohorts} isolated=${state.isolatedBreeders} `
        + `belowMvp=${state.belowMvpDays} pressure=${state.recoveryPressure.toFixed(3)}`,
    );
  }
}

function printAnnualDemography(label: string, annual: AnnualDemography): void {
  const accountedNet = annual.births + annual.faunaImmigrants - annual.nonPredatorDeaths - annual.predatorKills;
  console.log(
    `[${label}] demography y${annual.year} pop=${annual.startPopulation}->${annual.endPopulation} net=${annual.endPopulation - annual.startPopulation} `
      + `births=${annual.births} immigrants=${annual.faunaImmigrants} deaths=${annual.nonPredatorDeaths} kills=${annual.predatorKills} accounted=${accountedNet} `
      + `meanCondition=${(annual.meanConditionSum / annual.days).toFixed(3)} `
      + `food=${(annual.meanFoodSufficiencySum / annual.days).toFixed(3)} `
      + `water=${(annual.meanWaterSufficiencySum / annual.days).toFixed(3)} `
      + `resourceLimited=${Math.round(annual.resourceLimitedPopulationSum / annual.days)}`,
  );
}

function createPredatorAggregates(runtime: SpatialFaunaRuntimeState): Record<string, PredatorAggregate> {
  const result: Record<string, PredatorAggregate> = {};
  for (const telemetry of Object.values(runtime.predatorSystem?.telemetry.bySpecies ?? {})) {
    result[telemetry.speciesId] = { ...telemetry, maxGlobalAbsenceDays: telemetry.globalAbsenceDays };
  }
  return result;
}

function accumulatePredators(aggregates: Record<string, PredatorAggregate>, dailyBySpecies: Record<string, SpatialPredatorSpeciesTelemetry>): void {
  for (const daily of Object.values(dailyBySpecies)) {
    const total = aggregates[daily.speciesId] ?? { ...daily, maxGlobalAbsenceDays: daily.globalAbsenceDays };
    if (!aggregates[daily.speciesId]) aggregates[daily.speciesId] = total;
    total.endPopulation = daily.endPopulation;
    total.juveniles = daily.juveniles;
    total.adults = daily.adults;
    total.old = daily.old;
    total.births += daily.births;
    total.immigrants += daily.immigrants;
    total.deaths += daily.deaths;
    total.hungerDeaths += daily.hungerDeaths;
    total.naturalDeaths += daily.naturalDeaths;
    total.deathJuveniles += daily.deathJuveniles;
    total.deathAdults += daily.deathAdults;
    total.deathOld += daily.deathOld;
    total.matured += daily.matured;
    total.aged += daily.aged;
    total.preyKilled += daily.preyKilled;
    total.huntAttempts += daily.huntAttempts;
    total.successfulHunts += daily.successfulHunts;
    total.unsuccessfulHunts += daily.unsuccessfulHunts;
    total.modeledAttackSuccessProbabilitySum += daily.modeledAttackSuccessProbabilitySum;
    total.modeledAttackAttempts += daily.modeledAttackAttempts;
    total.huntOpportunityPredatorDays += daily.huntOpportunityPredatorDays;
    total.accessiblePreyHeadDays += daily.accessiblePreyHeadDays;
    total.accessiblePreyBiomassPredatorDaysKg += daily.accessiblePreyBiomassPredatorDaysKg;
    total.islandPreferredPreyHeadDays += daily.islandPreferredPreyHeadDays;
    total.islandPreferredPreyBiomassPredatorDaysKg += daily.islandPreferredPreyBiomassPredatorDaysKg;
    total.preyBiomassKilledKg += daily.preyBiomassKilledKg;
    total.edibleBiomassFromKillsKg += daily.edibleBiomassFromKillsKg;
    total.dailyDemandKg += daily.dailyDemandKg;
    total.coveredDemandKg += daily.coveredDemandKg;
    total.energyShortfallKg += daily.energyShortfallKg;
    total.reserveStartKg += daily.reserveStartKg;
    total.reserveEndKg += daily.reserveEndKg;
    total.reserveDrawKg += daily.reserveDrawKg;
    total.reserveGainKg += daily.reserveGainKg;
    total.edibleOverflowKg += daily.edibleOverflowKg;
    total.fmrDemandKJ += daily.fmrDemandKJ;
    total.legacyDemandEquivalentKJ += daily.legacyDemandEquivalentKJ;
    total.ingestedPreyEnergyKJ += daily.ingestedPreyEnergyKJ;
    total.shadowGutStartKJ += daily.shadowGutStartKJ;
    total.shadowGutEndKJ += daily.shadowGutEndKJ;
    total.shadowAssimilatedEnergyKJ += daily.shadowAssimilatedEnergyKJ;
    total.shadowDigestionCostKJ += daily.shadowDigestionCostKJ;
    total.shadowDigestingPredatorDays += daily.shadowDigestingPredatorDays;
    total.bioDemandKJ += daily.bioDemandKJ;
    total.bioCoveredDemandKJ += daily.bioCoveredDemandKJ;
    total.bioShortfallKJ += daily.bioShortfallKJ;
    total.bioReserveStartKJ += daily.bioReserveStartKJ;
    total.bioReserveEndKJ += daily.bioReserveEndKJ;
    total.bioReserveDrawKJ += daily.bioReserveDrawKJ;
    total.bioReserveGainKJ += daily.bioReserveGainKJ;
    total.bioEnergyOverflowKJ += daily.bioEnergyOverflowKJ;
    total.feedingBoutPredatorDays += daily.feedingBoutPredatorDays;
    total.alternativeFoodConsumedKg += daily.alternativeFoodConsumedKg;
    total.alternativeFoodEnergyKJ += daily.alternativeFoodEnergyKJ;
    total.alternativeFruitKg += daily.alternativeFruitKg;
    total.alternativeInsectKg += daily.alternativeInsectKg;
    total.alternativeCarrionKg += daily.alternativeCarrionKg;
    total.hungerRiskPredatorDays += daily.hungerRiskPredatorDays;
    total.huntingPredatorDays += daily.huntingPredatorDays;
    total.reserveCoveredPredatorDays += daily.reserveCoveredPredatorDays;
    total.predatorDays += daily.predatorDays;
    total.foodCoveragePredatorDays += daily.foodCoveragePredatorDays;
    total.reserveFillPredatorDays += daily.reserveFillPredatorDays;
    total.breedingCapableCohorts = daily.breedingCapableCohorts;
    total.isolatedBreeders = daily.isolatedBreeders;
    total.mateSearchProposed += daily.mateSearchProposed;
    total.mateSearchExecuted += daily.mateSearchExecuted;
    total.mateSearchBlocked += daily.mateSearchBlocked;
    total.mateAccessEvaluated += daily.mateAccessEvaluated;
    total.mateAccessBeforeSum += daily.mateAccessBeforeSum;
    total.mateAccessAfterSum += daily.mateAccessAfterSum;
    total.belowMvpDays = daily.belowMvpDays;
    total.recoveryPressure = daily.recoveryPressure;
    total.recoveredDays = daily.recoveredDays;
    total.nextEligibleImmigrationDay = daily.nextEligibleImmigrationDay;
    total.immigrationPulses += daily.immigrationPulses;
    total.extinctionEvents += daily.extinctionEvents;
    total.recolonizationEvents += daily.recolonizationEvents;
    total.globalAbsenceDays = daily.globalAbsenceDays;
    total.maxGlobalAbsenceDays = Math.max(total.maxGlobalAbsenceDays, daily.globalAbsenceDays);
    total.lastExtinctionDay = daily.lastExtinctionDay;
    total.lastRecolonizationDay = daily.lastRecolonizationDay;
  }
}

function runFiveYearSoak(): void {
  const label = `${mode}|${seed}`;
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaEcosystemState(seed, 1, world);
  const k = world.faunaCommunity.totalCarryingCapacity;
  const initial = snapshot(runtime, 1);
  const initialPreySpecies = initial.preySpecies;
  const initialPredatorSpecies = initial.predatorSpecies;
  const initialFloraSpecies = initial.floraSpecies;
  const initialInsectSpecies = initial.insectSpecies;
  const predatorAggregates = createPredatorAggregates(runtime);
  const checkpoints = new Map<number, Snapshot>();
  const samples: Snapshot[] = [initial];
  const transitions: OccupancyTransitions = { localExtirpations: 0, localRecolonizations: 0 };
  let previousOccupancy = preyOccupancy(runtime);
  const annual: AnnualDemography[] = Array.from({ length: 5 }, (_, index) => ({
    year: index + 1,
    startPopulation: 0,
    endPopulation: 0,
    births: 0,
    faunaImmigrants: 0,
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
  let faunaMateMoves = 0;
  let faunaNatalMoves = 0;
  let faunaGroupSplits = 0;
  let faunaResourceMoves = 0;
  let faunaImmigrants = 0;
  let predatorMateMoves = 0;
  let predatorNatalMoves = 0;
  let predatorTerritorySettlements = 0;
  let predatorGroupSplits = 0;
  let predatorImmigrants = 0;
  let predatorBirths = 0;
  let predatorDeaths = 0;

  for (let day = 2; day <= 1825; day += 1) {
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day, predatorOptions);
    const predatorTelemetry = runtime.predatorSystem?.telemetry;
    accumulatePredators(predatorAggregates, predatorTelemetry?.bySpecies ?? {});
    totalKills += telemetry.predatorKills ?? 0;
    totalInsectConsumption += telemetry.insectConsumedKg ?? 0;
    faunaMateMoves += telemetry.mateSearchMoved ?? 0;
    faunaNatalMoves += telemetry.natalDispersed ?? 0;
    faunaGroupSplits += telemetry.groupSplitMoved ?? 0;
    faunaResourceMoves += telemetry.resourceMoved ?? 0;
    faunaImmigrants += telemetry.recolonizedIndividuals ?? 0;
    predatorMateMoves += predatorTelemetry?.mateSearchMoved ?? 0;
    predatorNatalMoves += predatorTelemetry?.natalDispersed ?? 0;
    predatorTerritorySettlements += predatorTelemetry?.territorySettled ?? 0;
    predatorGroupSplits += predatorTelemetry?.groupSplitMoved ?? 0;
    predatorImmigrants += predatorTelemetry?.immigrants ?? 0;
    predatorBirths += predatorTelemetry?.births ?? 0;
    predatorDeaths += predatorTelemetry?.deaths ?? 0;
    if (telemetry.meanFoodSufficiency < .9) daysWithFoodStress += 1;
    if (telemetry.meanWaterSufficiency < .9) daysWithWaterStress += 1;

    const yearIndex = Math.min(4, Math.floor((day - 1) / 365));
    const bucket = annual[yearIndex];
    if (bucket.days === 0 && yearIndex > 0) bucket.startPopulation = annual[yearIndex - 1].endPopulation;
    bucket.births += telemetry.births;
    bucket.faunaImmigrants += telemetry.recolonizedIndividuals ?? 0;
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
  printCheckpoint(`[${label}] year1`, y1, k);
  printCheckpoint(`[${label}] year3`, y3, k);
  printCheckpoint(`[${label}] year5`, y5, k);
  for (const bucket of annual) printAnnualDemography(label, bucket);

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

  const checks: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail: string): void => { checks.push({ name, pass, detail }); };
  for (const species of Object.values(predatorAggregates)) {
    const expectedEnd = species.startPopulation + species.births + species.immigrants - species.deaths;
    check(`predator-accounting:${species.speciesId}`, expectedEnd === species.endPopulation, `${expectedEnd} vs ${species.endPopulation}`);
    check(
      `predator-death-stage-accounting:${species.speciesId}`,
      species.deathJuveniles + species.deathAdults + species.deathOld === species.deaths,
      `${species.deathJuveniles}+${species.deathAdults}+${species.deathOld} vs ${species.deaths}`,
    );
    const energyTolerance = Math.max(1, species.dailyDemandKg + species.reserveStartKg + species.edibleBiomassFromKillsKg) * 1e-9;
    check(
      `predator-hunt-accounting:${species.speciesId}`,
      species.huntAttempts === species.successfulHunts + species.unsuccessfulHunts && species.successfulHunts === species.preyKilled,
      `attempts=${species.huntAttempts} success=${species.successfulHunts} failed=${species.unsuccessfulHunts} kills=${species.preyKilled}`,
    );
    check(
      `predator-edible-yield-accounting:${species.speciesId}`,
      Math.abs(species.edibleBiomassFromKillsKg - species.preyBiomassKilledKg * .62) <= energyTolerance,
      `edible=${species.edibleBiomassFromKillsKg.toFixed(3)} killBiomass=${species.preyBiomassKilledKg.toFixed(3)}`,
    );
    check(
      `predator-demand-accounting:${species.speciesId}`,
      Math.abs(species.dailyDemandKg - species.coveredDemandKg - species.energyShortfallKg) <= energyTolerance,
      `demand=${species.dailyDemandKg.toFixed(3)} covered=${species.coveredDemandKg.toFixed(3)} shortfall=${species.energyShortfallKg.toFixed(3)}`,
    );
    check(
      `predator-reserve-accounting:${species.speciesId}`,
      Math.abs(species.reserveEndKg - (species.reserveStartKg - species.reserveDrawKg + species.reserveGainKg)) <= energyTolerance,
      `start=${species.reserveStartKg.toFixed(3)} draw=${species.reserveDrawKg.toFixed(3)} gain=${species.reserveGainKg.toFixed(3)} end=${species.reserveEndKg.toFixed(3)}`,
    );
    check(
      `predator-energy-conservation:${species.speciesId}`,
      Math.abs(
        species.reserveStartKg + species.edibleBiomassFromKillsKg
        - species.coveredDemandKg - species.reserveEndKg - species.edibleOverflowKg
      ) <= energyTolerance,
      `input=${(species.reserveStartKg + species.edibleBiomassFromKillsKg).toFixed(3)} output=${(species.coveredDemandKg + species.reserveEndKg + species.edibleOverflowKg).toFixed(3)}`,
    );
    check(
      `predator-accessible-prey-subset:${species.speciesId}`,
      species.accessiblePreyHeadDays <= species.islandPreferredPreyHeadDays + energyTolerance
        && species.accessiblePreyBiomassPredatorDaysKg <= species.islandPreferredPreyBiomassPredatorDaysKg + energyTolerance,
      `heads=${species.accessiblePreyHeadDays.toFixed(1)}/${species.islandPreferredPreyHeadDays.toFixed(1)} biomass=${species.accessiblePreyBiomassPredatorDaysKg.toFixed(1)}/${species.islandPreferredPreyBiomassPredatorDaysKg.toFixed(1)}`,
    );
    check(
      `predator-mate-access-bounds:${species.speciesId}`,
      species.mateAccessBeforeSum >= -1e-9
        && species.mateAccessAfterSum >= -1e-9
        && species.mateAccessBeforeSum <= species.mateAccessEvaluated + 1e-9
        && species.mateAccessAfterSum <= species.mateAccessEvaluated + 1e-9,
      `samples=${species.mateAccessEvaluated} beforeSum=${species.mateAccessBeforeSum.toFixed(3)} afterSum=${species.mateAccessAfterSum.toFixed(3)}`,
    );
    check(
      `predator-feeding-day-accounting:${species.speciesId}`,
      species.huntingPredatorDays >= 0
        && species.reserveCoveredPredatorDays >= 0
        && species.huntingPredatorDays + species.reserveCoveredPredatorDays <= species.predatorDays + energyTolerance,
      `hunting=${species.huntingPredatorDays.toFixed(1)} reserve=${species.reserveCoveredPredatorDays.toFixed(1)} predatorDays=${species.predatorDays.toFixed(1)}`,
    );
    check(
      `predator-p9-shadow-energy-bounds:${species.speciesId}`,
      Number.isFinite(species.fmrDemandKJ)
        && Number.isFinite(species.legacyDemandEquivalentKJ)
        && Number.isFinite(species.ingestedPreyEnergyKJ)
        && species.fmrDemandKJ >= 0
        && species.legacyDemandEquivalentKJ >= 0
        && species.ingestedPreyEnergyKJ >= 0,
      `fmr=${species.fmrDemandKJ.toFixed(1)} legacy=${species.legacyDemandEquivalentKJ.toFixed(1)} intake=${species.ingestedPreyEnergyKJ.toFixed(1)}`,
    );
    const shadowGutTolerance = Math.max(
      1,
      species.shadowGutStartKJ + species.ingestedPreyEnergyKJ + species.alternativeFoodEnergyKJ,
    ) * 1e-9;
    check(
      `predator-p9-shadow-gut-conservation:${species.speciesId}`,
      Math.abs(
        species.shadowGutStartKJ + species.ingestedPreyEnergyKJ + species.alternativeFoodEnergyKJ
          - species.shadowGutEndKJ
          - species.shadowAssimilatedEnergyKJ
          - species.shadowDigestionCostKJ
      ) <= shadowGutTolerance,
      `input=${(species.shadowGutStartKJ + species.ingestedPreyEnergyKJ + species.alternativeFoodEnergyKJ).toFixed(1)} output=${(species.shadowGutEndKJ + species.shadowAssimilatedEnergyKJ + species.shadowDigestionCostKJ).toFixed(1)}`,
    );
    check(
      `predator-p9-shadow-digesting-day-bounds:${species.speciesId}`,
      species.shadowDigestingPredatorDays >= 0
        && species.shadowDigestingPredatorDays <= species.predatorDays + energyTolerance,
      `digesting=${species.shadowDigestingPredatorDays.toFixed(1)} predatorDays=${species.predatorDays.toFixed(1)}`,
    );
    if (species.bioDemandKJ > 0) {
      const bioTolerance = Math.max(
        1,
        species.bioReserveStartKJ + species.shadowAssimilatedEnergyKJ,
      ) * 1e-9;
      check(
        `predator-p9-bio-demand-accounting:${species.speciesId}`,
        Math.abs(species.bioDemandKJ - species.bioCoveredDemandKJ - species.bioShortfallKJ) <= bioTolerance,
        `demand=${species.bioDemandKJ.toFixed(1)} covered=${species.bioCoveredDemandKJ.toFixed(1)} shortfall=${species.bioShortfallKJ.toFixed(1)}`,
      );
      check(
        `predator-p9-bio-energy-conservation:${species.speciesId}`,
        Math.abs(
          species.bioReserveStartKJ + species.shadowAssimilatedEnergyKJ
            - species.bioCoveredDemandKJ
            - species.bioReserveEndKJ
            - species.bioEnergyOverflowKJ
        ) <= bioTolerance,
        `input=${(species.bioReserveStartKJ + species.shadowAssimilatedEnergyKJ).toFixed(1)} output=${(species.bioCoveredDemandKJ + species.bioReserveEndKJ + species.bioEnergyOverflowKJ).toFixed(1)}`,
      );
    }
  }
  for (const bucket of annual) {
    const expected = bucket.startPopulation + bucket.births + bucket.faunaImmigrants - bucket.nonPredatorDeaths - bucket.predatorKills;
    check(`prey-accounting:y${bucket.year}`, expected === bucket.endPopulation, `${expected} vs ${bucket.endPopulation}`);
  }
  check('flora-collapse-floor', minima.floraKg > initial.floraKg * .2, `${ratio(minima.floraKg, initial.floraKg).toFixed(3)}x initial`);
  check('insect-collapse-floor', minima.insectKg > initial.insectKg * .1, `${ratio(minima.insectKg, initial.insectKg).toFixed(3)}x initial`);
  check('prey-collapse-floor', minima.prey > k * .2, `${minima.prey}/${k}`);
  check('predator-global-extinction', minima.predators > 0, `minimum=${minima.predators}`);
  check('flora-late-trend', trailingFlora >= priorFlora * .72, `${priorFlora.toFixed(0)} -> ${trailingFlora.toFixed(0)}kg`);
  check('insect-late-trend', trailingInsects >= priorInsects * .6, `${priorInsects.toFixed(0)} -> ${trailingInsects.toFixed(0)}kg`);
  check('prey-late-trend', trailingPrey >= priorPrey * .68, `${priorPrey.toFixed(0)} -> ${trailingPrey.toFixed(0)}`);
  check('predator-late-trend', trailingPredators >= Math.max(1, priorPredators * .45), `${priorPredators.toFixed(1)} -> ${trailingPredators.toFixed(1)}`);
  check('prey-species', y5.preySpecies >= initialPreySpecies - 3, `${initialPreySpecies} -> ${y5.preySpecies}`);
  check('predator-species', y5.predatorSpecies >= Math.max(3, initialPredatorSpecies - 2), `${initialPredatorSpecies} -> ${y5.predatorSpecies}`);
  check('flora-species', y5.floraSpecies >= initialFloraSpecies - 4, `${initialFloraSpecies} -> ${y5.floraSpecies}`);
  check('insect-species', y5.insectSpecies >= initialInsectSpecies - 4, `${initialInsectSpecies} -> ${y5.insectSpecies}`);
  check('prey-local-extirpation', transitions.localExtirpations > 0, `${transitions.localExtirpations}`);
  check('prey-local-recolonization', transitions.localRecolonizations > 0, `${transitions.localRecolonizations}`);
  check('predator-kills-active', totalKills > 0, `${totalKills}`);
  check('insect-link-active', totalInsectConsumption > 0, `${totalInsectConsumption}`);
  check('fauna-natal-movement-active', faunaNatalMoves > 0, `${faunaNatalMoves}`);
  check('predator-social-movement-active', predatorMateMoves + predatorNatalMoves + predatorTerritorySettlements > 0, `${predatorMateMoves + predatorNatalMoves + predatorTerritorySettlements}`);

  const speciesReport = Object.fromEntries(Object.entries(predatorAggregates).map(([speciesId, species]) => {
    const recruitment = species.births + species.immigrants;
    const foodCoverage = species.predatorDays > 0 ? species.foodCoveragePredatorDays / species.predatorDays : 1;
    const reserveFill = species.predatorDays > 0 ? species.reserveFillPredatorDays / species.predatorDays : 0;
    const killsPerPredatorDay = species.predatorDays > 0 ? species.preyKilled / species.predatorDays : 0;
    const immigrationShare = recruitment > 0 ? species.immigrants / recruitment : 0;
    const mateAccessSamples = species.mateAccessEvaluated;
    const mateAccessBefore = mateAccessSamples > 0 ? species.mateAccessBeforeSum / mateAccessSamples : 0;
    const mateAccessAfter = mateAccessSamples > 0 ? species.mateAccessAfterSum / mateAccessSamples : 0;
    const huntOpportunityRate = species.predatorDays > 0 ? species.huntOpportunityPredatorDays / species.predatorDays : 0;
    const attemptsPerPredatorDay = species.predatorDays > 0 ? species.huntAttempts / species.predatorDays : 0;
    const huntSuccessRate = species.huntAttempts > 0 ? species.successfulHunts / species.huntAttempts : 0;
    const accessiblePreyHeadsPerPredatorDay = species.predatorDays > 0 ? species.accessiblePreyHeadDays / species.predatorDays : 0;
    const islandPreferredPreyHeadsPerPredatorDay = species.predatorDays > 0 ? species.islandPreferredPreyHeadDays / species.predatorDays : 0;
    const accessiblePreyBiomassKgPerPredatorDay = species.predatorDays > 0 ? species.accessiblePreyBiomassPredatorDaysKg / species.predatorDays : 0;
    const islandPreferredPreyBiomassKgPerPredatorDay = species.predatorDays > 0 ? species.islandPreferredPreyBiomassPredatorDaysKg / species.predatorDays : 0;
    const preyHeadAccessShare = species.islandPreferredPreyHeadDays > 0 ? species.accessiblePreyHeadDays / species.islandPreferredPreyHeadDays : 0;
    const preyBiomassAccessShare = species.islandPreferredPreyBiomassPredatorDaysKg > 0
      ? species.accessiblePreyBiomassPredatorDaysKg / species.islandPreferredPreyBiomassPredatorDaysKg
      : 0;
    const preyBiomassPerKillKg = species.preyKilled > 0 ? species.preyBiomassKilledKg / species.preyKilled : 0;
    const edibleKgPerKill = species.preyKilled > 0 ? species.edibleBiomassFromKillsKg / species.preyKilled : 0;
    const edibleYieldVsDemand = species.dailyDemandKg > 0 ? species.edibleBiomassFromKillsKg / species.dailyDemandKg : 0;
    const demandCoverage = species.dailyDemandKg > 0 ? species.coveredDemandKg / species.dailyDemandKg : 1;
    const shortfallRatio = species.dailyDemandKg > 0 ? species.energyShortfallKg / species.dailyDemandKg : 0;
    const hungerRiskShare = species.predatorDays > 0 ? species.hungerRiskPredatorDays / species.predatorDays : 0;
    const huntingDayShare = species.predatorDays > 0 ? species.huntingPredatorDays / species.predatorDays : 0;
    const reserveCoveredDayShare = species.predatorDays > 0 ? species.reserveCoveredPredatorDays / species.predatorDays : 0;
    const reserveDeltaKgPerPredatorDay = species.predatorDays > 0 ? (species.reserveEndKg - species.reserveStartKg) / species.predatorDays : 0;
    const p9ShadowIntakeVsFmr = species.fmrDemandKJ > 0 ? species.ingestedPreyEnergyKJ / species.fmrDemandKJ : 1;
    const p9ShadowLegacyVsFmr = species.fmrDemandKJ > 0 ? species.legacyDemandEquivalentKJ / species.fmrDemandKJ : 1;
    const p9ShadowAssimilatedVsFmr = species.fmrDemandKJ > 0 ? species.shadowAssimilatedEnergyKJ / species.fmrDemandKJ : 1;
    const p9ShadowTotalGrossIntakeVsFmr = species.fmrDemandKJ > 0
      ? (species.ingestedPreyEnergyKJ + species.alternativeFoodEnergyKJ) / species.fmrDemandKJ
      : 1;
    const p9BioCoverage = species.bioDemandKJ > 0 ? species.bioCoveredDemandKJ / species.bioDemandKJ : 0;
    const p9ShadowDigestingShare = species.predatorDays > 0 ? species.shadowDigestingPredatorDays / species.predatorDays : 0;
    console.log(
      `[${label}] ${speciesId} pop=${species.startPopulation}->${species.endPopulation} births=${species.births} immigrants=${species.immigrants} deaths=${species.deaths} `
        + `hunger=${species.hungerDeaths} natural=${species.naturalDeaths} deathAge=${species.deathJuveniles}/${species.deathAdults}/${species.deathOld} `
        + `matured=${species.matured} aged=${species.aged} breeding=${species.breedingCapableCohorts} isolated=${species.isolatedBreeders} `
        + `mate=${species.mateSearchProposed}/${species.mateSearchExecuted}/${species.mateSearchBlocked} access=${mateAccessBefore.toFixed(3)}->${mateAccessAfter.toFixed(3)} `
        + `pulses=${species.immigrationPulses} belowMvp=${species.belowMvpDays} pressure=${species.recoveryPressure.toFixed(3)} maxAbsent=${species.maxGlobalAbsenceDays} `
        + `food=${foodCoverage.toFixed(3)} reserve=${reserveFill.toFixed(3)} kills/predDay=${killsPerPredatorDay.toFixed(4)} immigrationShare=${immigrationShare.toFixed(3)}`,
    );
    console.log(
      `[${label}] ${speciesId} energy opportunity=${huntOpportunityRate.toFixed(3)} attempts/predDay=${attemptsPerPredatorDay.toFixed(4)} success=${huntSuccessRate.toFixed(3)} `
        + `preyHeads local/island=${accessiblePreyHeadsPerPredatorDay.toFixed(1)}/${islandPreferredPreyHeadsPerPredatorDay.toFixed(1)} accessShare=${preyHeadAccessShare.toFixed(3)} `
        + `preyBiomass local/island=${accessiblePreyBiomassKgPerPredatorDay.toFixed(1)}/${islandPreferredPreyBiomassKgPerPredatorDay.toFixed(1)}kg accessShare=${preyBiomassAccessShare.toFixed(3)} `
        + `killKg=${preyBiomassPerKillKg.toFixed(2)} edible/kill=${edibleKgPerKill.toFixed(2)} edible/demand=${edibleYieldVsDemand.toFixed(3)} `
        + `coverage=${demandCoverage.toFixed(3)} shortfall=${shortfallRatio.toFixed(3)} reserveDelta/predDay=${reserveDeltaKgPerPredatorDay.toFixed(4)} `
        + `hungerRisk=${hungerRiskShare.toFixed(3)} huntingDays=${huntingDayShare.toFixed(3)} reserveDays=${reserveCoveredDayShare.toFixed(3)}`,
    );
    console.log(
      `[${label}] ${speciesId} p9-shadow fmr=${(species.fmrDemandKJ / 1000).toFixed(1)}MJ `
        + `legacyEq=${(species.legacyDemandEquivalentKJ / 1000).toFixed(1)}MJ intake=${(species.ingestedPreyEnergyKJ / 1000).toFixed(1)}MJ `
        + `intake/fmr=${p9ShadowIntakeVsFmr.toFixed(3)} legacy/fmr=${p9ShadowLegacyVsFmr.toFixed(3)}`,
    );
    console.log(
      `[${label}] ${speciesId} p9-gut assimilated=${(species.shadowAssimilatedEnergyKJ / 1000).toFixed(1)}MJ `
        + `SDA=${(species.shadowDigestionCostKJ / 1000).toFixed(1)}MJ gutEnd=${(species.shadowGutEndKJ / 1000).toFixed(1)}MJ `
        + `assim/fmr=${p9ShadowAssimilatedVsFmr.toFixed(3)} digestingDays=${p9ShadowDigestingShare.toFixed(3)}`,
    );
    if (species.bioDemandKJ > 0 || species.alternativeFoodEnergyKJ > 0) {
      console.log(
        `[${label}] ${speciesId} p9-active bioCoverage=${p9BioCoverage.toFixed(3)} totalGross/fmr=${p9ShadowTotalGrossIntakeVsFmr.toFixed(3)} `
          + `altKg=${species.alternativeFoodConsumedKg.toFixed(1)} fruit=${species.alternativeFruitKg.toFixed(1)} `
          + `insects=${species.alternativeInsectKg.toFixed(1)} carrion=${species.alternativeCarrionKg.toFixed(1)}`,
      );
    }
    return [speciesId, {
      ...species,
      foodCoverage,
      reserveFill,
      killsPerPredatorDay,
      immigrationShare,
      mateAccessSamples,
      mateAccessBefore,
      mateAccessAfter,
      huntOpportunityRate,
      attemptsPerPredatorDay,
      huntSuccessRate,
      accessiblePreyHeadsPerPredatorDay,
      islandPreferredPreyHeadsPerPredatorDay,
      accessiblePreyBiomassKgPerPredatorDay,
      islandPreferredPreyBiomassKgPerPredatorDay,
      preyHeadAccessShare,
      preyBiomassAccessShare,
      preyBiomassPerKillKg,
      edibleKgPerKill,
      edibleYieldVsDemand,
      demandCoverage,
      shortfallRatio,
      hungerRiskShare,
      huntingDayShare,
      reserveCoveredDayShare,
      reserveDeltaKgPerPredatorDay,
    }];
  }));

  console.log(
    `[${label}] 5y extrema flora=${(minima.floraKg / 1e6).toFixed(1)}-${(maxima.floraKg / 1e6).toFixed(1)}Mkg `
      + `insects=${(minima.insectKg / 1000).toFixed(1)}-${(maxima.insectKg / 1000).toFixed(1)}t `
      + `prey=${minima.prey}-${maxima.prey} predators=${minima.predators}-${maxima.predators} `
      + `localTransitions extirp=${transitions.localExtirpations} recolon=${transitions.localRecolonizations} `
      + `stressDays food=${daysWithFoodStress} water=${daysWithWaterStress} kills=${totalKills} insectEaten=${(totalInsectConsumption / 1000).toFixed(1)}t`,
  );
  console.log(
    `[${label}] movement fauna mate=${faunaMateMoves} natal=${faunaNatalMoves} split=${faunaGroupSplits} resource=${faunaResourceMoves} immigrants=${faunaImmigrants} `
      + `predator mate=${predatorMateMoves} natal=${predatorNatalMoves} settle=${predatorTerritorySettlements} split=${predatorGroupSplits} immigrants=${predatorImmigrants} `
      + `predator births=${predatorBirths} deaths=${predatorDeaths}`,
  );
  console.log(
    `[${label}] annual trend year4->year5 mean flora=${(priorFlora / 1e6).toFixed(1)}->${(trailingFlora / 1e6).toFixed(1)}Mkg `
      + `insects=${(priorInsects / 1000).toFixed(1)}->${(trailingInsects / 1000).toFixed(1)}t `
      + `prey=${priorPrey.toFixed(0)}->${trailingPrey.toFixed(0)} predators=${priorPredators.toFixed(1)}->${trailingPredators.toFixed(1)}`,
  );

  const report = {
    mode,
    seed,
    predatorOptions,
    enforceGate,
    initial,
    checkpoints: { year1: y1, year3: y3, year5: y5 },
    annualPreyDemography: annual,
    predatorSpecies: speciesReport,
    extrema: { minima, maxima },
    lateTrend: { priorFlora, trailingFlora, priorInsects, trailingInsects, priorPrey, trailingPrey, priorPredators, trailingPredators },
    movement: { faunaMateMoves, faunaNatalMoves, faunaGroupSplits, faunaResourceMoves, faunaImmigrants, predatorMateMoves, predatorNatalMoves, predatorTerritorySettlements, predatorGroupSplits, predatorImmigrants },
    trophic: { totalKills, totalInsectConsumption, daysWithFoodStress, daysWithWaterStress },
    transitions,
    checks,
  };
  mkdirSync('artifacts', { recursive: true });
  const safeSeed = seed.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const reportPath = `artifacts/predator-p9-shadow-${mode}-${safeSeed}.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[${label}] report=${reportPath}`);

  if (enforceGate) {
    for (const result of checks) assert.ok(result.pass, `${label}: ${result.name} failed (${result.detail})`);
    console.log(`[${label}] five-year spatial terrestrial trophic soak passed.`);
  } else {
    console.log(`[${label}] diagnostic soak complete; gate assertions intentionally disabled.`);
  }
}

runFiveYearSoak();
