// Shadow capture credit is species-level so movement between patches does not strand opportunity.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSpatialFaunaEcosystemState, tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import { getSpatialFaunaRuntimePopulation } from '../src/simulation/spatial/spatialFaunaRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';
import type { SpatialPredatorSpeciesTelemetry } from '../src/types/spatialEcologySimulation';

const seed = process.env.SPATIAL_TROPHIC_SEED ?? 'spatial-trophic-soak-alpha';
const days = Math.max(2, Math.floor(Number(process.env.P9_DAYS ?? 30)));
const alternativeDiet = process.env.P9_ALT_DIET === '1';
const densitySwitching = process.env.P9_SWITCHING === '1';
const speciesCalibration = process.env.P9_CALIBRATE === '1';
const phase = speciesCalibration ? 'p9.6' : densitySwitching ? 'p9.5' : alternativeDiet ? 'p9.4' : 'p9.3';
const world = generateSpatialWorld(seed);
const runtime = createSpatialFaunaEcosystemState(seed, 1, world);
const initialPrey = getSpatialFaunaRuntimePopulation(runtime);
const carryingCapacity = world.faunaCommunity.totalCarryingCapacity;
const initialPredators = runtime.predatorSystem?.telemetry.totalPopulation ?? 0;

interface Aggregate {
  speciesId: string;
  startPopulation: number;
  endPopulation: number;
  preyKilled: number;
  preyBiomassKilledKg: number;
  preyKillsBySpecies: Record<string, number>;
  preyKillBiomassBySpeciesKg: Record<string, number>;
  huntAttempts: number;
  successfulHunts: number;
  unsuccessfulHunts: number;
  modeledAttackSuccessProbabilitySum: number;
  modeledAttackAttempts: number;
  captureRollPassed: number;
  rawCaptureRollPassed: number;
  postCaptureRemovalFailed: number;
  modeledAttackBernoulliVarianceSum: number;
  captureRollSum: number;
  mixedCaptureRollSum: number;
  mixedCaptureRollPassedShadow: number;
  capturePreyAvailabilitySum: number;
  capturePredatorConditionSum: number;
  captureHabitatOpportunitySum: number;
  capturePreyRefugeSum: number;
  captureBaseSuccessSum: number;
  shadowCreditCapturePassed: number;
  shadowCreditMaxFailureStreak: number;
  predatorDays: number;
  hungerRiskPredatorDays: number;
  huntingPredatorDays: number;
  feedingBoutPredatorDays: number;
  shadowDigestingPredatorDays: number;
  bioDemandKJ: number;
  bioCoveredDemandKJ: number;
  bioShortfallKJ: number;
  bioReserveStartKJ: number;
  bioReserveEndKJ: number;
  bioReserveDrawKJ: number;
  bioReserveGainKJ: number;
  bioEnergyOverflowKJ: number;
  shadowGutStartKJ: number;
  shadowGutEndKJ: number;
  shadowAssimilatedEnergyKJ: number;
  shadowDigestionCostKJ: number;
  ingestedPreyEnergyKJ: number;
  alternativeFoodConsumedKg: number;
  alternativeFoodEnergyKJ: number;
  alternativeFruitKg: number;
  alternativeInsectKg: number;
  alternativeCarrionKg: number;
  births: number;
  immigrants: number;
  deaths: number;
  hungerDeaths: number;
  naturalDeaths: number;
}

const aggregates: Record<string, Aggregate> = {};
for (const telemetry of Object.values(runtime.predatorSystem?.telemetry.bySpecies ?? {})) {
  aggregates[telemetry.speciesId] = {
    speciesId: telemetry.speciesId,
    startPopulation: telemetry.endPopulation,
    endPopulation: telemetry.endPopulation,
    preyKilled: 0,
    preyBiomassKilledKg: 0,
    preyKillsBySpecies: {},
    preyKillBiomassBySpeciesKg: {},
    huntAttempts: 0,
    successfulHunts: 0,
    unsuccessfulHunts: 0,
    modeledAttackSuccessProbabilitySum: 0,
    modeledAttackAttempts: 0,
    captureRollPassed: 0,
    rawCaptureRollPassed: 0,
    postCaptureRemovalFailed: 0,
    modeledAttackBernoulliVarianceSum: 0,
    captureRollSum: 0,
    mixedCaptureRollSum: 0,
    mixedCaptureRollPassedShadow: 0,
    capturePreyAvailabilitySum: 0,
    capturePredatorConditionSum: 0,
    captureHabitatOpportunitySum: 0,
    capturePreyRefugeSum: 0,
    captureBaseSuccessSum: 0,
    shadowCreditCapturePassed: 0,
    shadowCreditMaxFailureStreak: 0,
    predatorDays: 0,
    hungerRiskPredatorDays: 0,
    huntingPredatorDays: 0,
    feedingBoutPredatorDays: 0,
    shadowDigestingPredatorDays: 0,
    bioDemandKJ: 0,
    bioCoveredDemandKJ: 0,
    bioShortfallKJ: 0,
    bioReserveStartKJ: 0,
    bioReserveEndKJ: 0,
    bioReserveDrawKJ: 0,
    bioReserveGainKJ: 0,
    bioEnergyOverflowKJ: 0,
    shadowGutStartKJ: 0,
    shadowGutEndKJ: 0,
    shadowAssimilatedEnergyKJ: 0,
    shadowDigestionCostKJ: 0,
    ingestedPreyEnergyKJ: 0,
    alternativeFoodConsumedKg: 0,
    alternativeFoodEnergyKJ: 0,
    alternativeFruitKg: 0,
    alternativeInsectKg: 0,
    alternativeCarrionKg: 0,
    births: 0,
    immigrants: 0,
    deaths: 0,
    hungerDeaths: 0,
    naturalDeaths: 0,
  };
}

function accumulate(daily: SpatialPredatorSpeciesTelemetry): void {
  const total = aggregates[daily.speciesId];
  if (!total) return;
  total.endPopulation = daily.endPopulation;
  total.preyKilled += daily.preyKilled;
  total.preyBiomassKilledKg += daily.preyBiomassKilledKg;
  for (const [preyId, kills] of Object.entries(daily.preyKillsBySpecies)) {
    total.preyKillsBySpecies[preyId] = (total.preyKillsBySpecies[preyId] ?? 0) + kills;
  }
  for (const [preyId, biomass] of Object.entries(daily.preyKillBiomassBySpeciesKg)) {
    total.preyKillBiomassBySpeciesKg[preyId] = (total.preyKillBiomassBySpeciesKg[preyId] ?? 0) + biomass;
  }
  total.huntAttempts += daily.huntAttempts;
  total.successfulHunts += daily.successfulHunts;
  total.unsuccessfulHunts += daily.unsuccessfulHunts;
  total.modeledAttackSuccessProbabilitySum += daily.modeledAttackSuccessProbabilitySum;
  total.modeledAttackAttempts += daily.modeledAttackAttempts;
  total.captureRollPassed += daily.captureRollPassed;
  total.rawCaptureRollPassed += daily.rawCaptureRollPassed;
  total.postCaptureRemovalFailed += daily.postCaptureRemovalFailed;
  total.modeledAttackBernoulliVarianceSum += daily.modeledAttackBernoulliVarianceSum;
  total.captureRollSum += daily.captureRollSum;
  total.mixedCaptureRollSum += daily.mixedCaptureRollSum;
  total.mixedCaptureRollPassedShadow += daily.mixedCaptureRollPassedShadow;
  total.capturePreyAvailabilitySum += daily.capturePreyAvailabilitySum;
  total.capturePredatorConditionSum += daily.capturePredatorConditionSum;
  total.captureHabitatOpportunitySum += daily.captureHabitatOpportunitySum;
  total.capturePreyRefugeSum += daily.capturePreyRefugeSum;
  total.captureBaseSuccessSum += daily.captureBaseSuccessSum;
  total.shadowCreditCapturePassed += daily.shadowCreditCapturePassed;
  total.shadowCreditMaxFailureStreak = Math.max(total.shadowCreditMaxFailureStreak, daily.shadowCreditMaxFailureStreak);
  total.predatorDays += daily.predatorDays;
  total.hungerRiskPredatorDays += daily.hungerRiskPredatorDays;
  total.huntingPredatorDays += daily.huntingPredatorDays;
  total.feedingBoutPredatorDays += daily.feedingBoutPredatorDays;
  total.shadowDigestingPredatorDays += daily.shadowDigestingPredatorDays;
  total.bioDemandKJ += daily.bioDemandKJ;
  total.bioCoveredDemandKJ += daily.bioCoveredDemandKJ;
  total.bioShortfallKJ += daily.bioShortfallKJ;
  total.bioReserveStartKJ += daily.bioReserveStartKJ;
  total.bioReserveEndKJ += daily.bioReserveEndKJ;
  total.bioReserveDrawKJ += daily.bioReserveDrawKJ;
  total.bioReserveGainKJ += daily.bioReserveGainKJ;
  total.bioEnergyOverflowKJ += daily.bioEnergyOverflowKJ;
  total.shadowGutStartKJ += daily.shadowGutStartKJ;
  total.shadowGutEndKJ += daily.shadowGutEndKJ;
  total.shadowAssimilatedEnergyKJ += daily.shadowAssimilatedEnergyKJ;
  total.shadowDigestionCostKJ += daily.shadowDigestionCostKJ;
  total.ingestedPreyEnergyKJ += daily.ingestedPreyEnergyKJ;
  total.alternativeFoodConsumedKg += daily.alternativeFoodConsumedKg;
  total.alternativeFoodEnergyKJ += daily.alternativeFoodEnergyKJ;
  total.alternativeFruitKg += daily.alternativeFruitKg;
  total.alternativeInsectKg += daily.alternativeInsectKg;
  total.alternativeCarrionKg += daily.alternativeCarrionKg;
  total.births += daily.births;
  total.immigrants += daily.immigrants;
  total.deaths += daily.deaths;
  total.hungerDeaths += daily.hungerDeaths;
  total.naturalDeaths += daily.naturalDeaths;
}

let minPrey = initialPrey;
let maxPrey = initialPrey;
let totalKills = 0;
const checkpoints: Array<{ day: number; prey: number; predators: number }> = [];

for (let day = 2; day <= days; day += 1) {
  const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day, {
    maintainMateConnectivity: true,
    controlledRecovery: true,
    bioenergeticFeeding: true,
    accumulatedCaptureOpportunity: true,
    alternativeDiet,
    densitySwitching,
    speciesCalibration,
  });
  totalKills += telemetry.predatorKills ?? 0;
  for (const daily of Object.values(runtime.predatorSystem?.telemetry.bySpecies ?? {})) accumulate(daily);
  const prey = getSpatialFaunaRuntimePopulation(runtime);
  minPrey = Math.min(minPrey, prey);
  maxPrey = Math.max(maxPrey, prey);
  if (day === 30 || day === 90 || day === 180 || day === 365 || day === days) {
    checkpoints.push({
      day,
      prey,
      predators: runtime.predatorSystem?.telemetry.totalPopulation ?? 0,
    });
  }
}

const endPrey = getSpatialFaunaRuntimePopulation(runtime);
const endPredators = runtime.predatorSystem?.telemetry.totalPopulation ?? 0;
const species = Object.fromEntries(Object.entries(aggregates).map(([speciesId, a]) => {
  const predatorDays = Math.max(1, a.predatorDays);
  const demand = Math.max(1e-9, a.bioDemandKJ);
  return [speciesId, {
    ...a,
    attemptsPerPredatorDay: a.huntAttempts / predatorDays,
    killsPerPredatorDay: a.preyKilled / predatorDays,
    huntSuccessRate: a.huntAttempts > 0 ? a.successfulHunts / a.huntAttempts : 0,
    modeledAttackSuccessRate: a.modeledAttackAttempts > 0
      ? a.modeledAttackSuccessProbabilitySum / a.modeledAttackAttempts
      : 0,
    captureRollPassRate: a.modeledAttackAttempts > 0
      ? a.captureRollPassed / a.modeledAttackAttempts
      : 0,
    rawCaptureRollPassRate: a.modeledAttackAttempts > 0
      ? a.rawCaptureRollPassed / a.modeledAttackAttempts
      : 0,
    postCaptureRemovalFailureRate: a.captureRollPassed > 0
      ? a.postCaptureRemovalFailed / a.captureRollPassed
      : 0,
    meanCaptureRoll: a.modeledAttackAttempts > 0 ? a.captureRollSum / a.modeledAttackAttempts : 0,
    meanMixedCaptureRoll: a.modeledAttackAttempts > 0 ? a.mixedCaptureRollSum / a.modeledAttackAttempts : 0,
    mixedCaptureRollPassRate: a.modeledAttackAttempts > 0
      ? a.mixedCaptureRollPassedShadow / a.modeledAttackAttempts
      : 0,
    capturePreyAvailabilityMean: a.modeledAttackAttempts > 0 ? a.capturePreyAvailabilitySum / a.modeledAttackAttempts : 0,
    capturePredatorConditionMean: a.modeledAttackAttempts > 0 ? a.capturePredatorConditionSum / a.modeledAttackAttempts : 0,
    captureHabitatOpportunityMean: a.modeledAttackAttempts > 0 ? a.captureHabitatOpportunitySum / a.modeledAttackAttempts : 0,
    capturePreyRefugeMean: a.modeledAttackAttempts > 0 ? a.capturePreyRefugeSum / a.modeledAttackAttempts : 0,
    captureBaseSuccessMean: a.modeledAttackAttempts > 0 ? a.captureBaseSuccessSum / a.modeledAttackAttempts : 0,
    shadowCreditPassRate: a.modeledAttackAttempts > 0 ? a.shadowCreditCapturePassed / a.modeledAttackAttempts : 0,
    shadowCreditMaxFailureStreak: a.shadowCreditMaxFailureStreak,
    captureCalibrationZ: a.modeledAttackBernoulliVarianceSum > 0
      ? (a.rawCaptureRollPassed - a.modeledAttackSuccessProbabilitySum)
        / Math.sqrt(a.modeledAttackBernoulliVarianceSum)
      : 0,
    mixedCaptureCalibrationZ: a.modeledAttackBernoulliVarianceSum > 0
      ? (a.mixedCaptureRollPassedShadow - a.modeledAttackSuccessProbabilitySum)
        / Math.sqrt(a.modeledAttackBernoulliVarianceSum)
      : 0,
    bioCoverage: a.bioCoveredDemandKJ / demand,
    bioShortfall: a.bioShortfallKJ / demand,
    hungerRiskShare: a.hungerRiskPredatorDays / predatorDays,
    huntingDayShare: a.huntingPredatorDays / predatorDays,
    feedingBoutDayShare: a.feedingBoutPredatorDays / predatorDays,
    digestingDayShare: a.shadowDigestingPredatorDays / predatorDays,
    assimilatedVsDemand: a.shadowAssimilatedEnergyKJ / demand,
    intakeVsDemand: a.ingestedPreyEnergyKJ / demand,
    totalGrossIntakeVsDemand: (a.ingestedPreyEnergyKJ + a.alternativeFoodEnergyKJ) / demand,
    averageKillBiomassKg: a.preyKilled > 0 ? a.preyBiomassKilledKg / a.preyKilled : 0,
    topPrey: Object.entries(a.preyKillsBySpecies)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 5)
      .map(([preyId, kills]) => ({ preyId, kills, biomassKg: a.preyKillBiomassBySpeciesKg[preyId] ?? 0 })),
  }];
}));

const report = {
  seed,
  days,
  phase,
  alternativeDiet,
  densitySwitching,
  speciesCalibration,
  initialPrey,
  endPrey,
  minPrey,
  maxPrey,
  carryingCapacity,
  preyEndVsK: endPrey / carryingCapacity,
  preyMinVsK: minPrey / carryingCapacity,
  initialPredators,
  endPredators,
  totalKills,
  checkpoints,
  species,
};

console.log(
  `[${phase}|${seed}|${days}d] prey=${initialPrey}->${endPrey} min=${minPrey}/${carryingCapacity} `
    + `predators=${initialPredators}->${endPredators} kills=${totalKills}`,
);
for (const point of checkpoints) {
  console.log(`[${phase}|${seed}] day=${point.day} prey=${point.prey} predators=${point.predators}`);
}
for (const [speciesId, value] of Object.entries(species)) {
  console.log(
    `[${phase}|${seed}] ${speciesId} pop=${value.startPopulation}->${value.endPopulation} `
      + `attempts/predDay=${value.attemptsPerPredatorDay.toFixed(3)} kills/predDay=${value.killsPerPredatorDay.toFixed(3)} `
      + `success=${value.huntSuccessRate.toFixed(3)} modeledSuccess=${value.modeledAttackSuccessRate.toFixed(3)} `
      + `capturePass=${value.captureRollPassRate.toFixed(3)} removalFail=${value.postCaptureRemovalFailed}/${value.captureRollPassed} `
      + `rawMean=${value.meanCaptureRoll.toFixed(3)} rawPass=${value.rawCaptureRollPassRate.toFixed(3)} rawZ=${value.captureCalibrationZ.toFixed(2)} `
      + `mixedPass=${value.mixedCaptureRollPassRate.toFixed(3)} mixedMean=${value.meanMixedCaptureRoll.toFixed(3)} mixedZ=${value.mixedCaptureCalibrationZ.toFixed(2)} `
      + `factors=prey:${value.capturePreyAvailabilityMean.toFixed(3)} condition:${value.capturePredatorConditionMean.toFixed(3)} habitat:${value.captureHabitatOpportunityMean.toFixed(3)} refuge:${value.capturePreyRefugeMean.toFixed(3)} base:${value.captureBaseSuccessMean.toFixed(3)} `
      + `creditPass=${value.shadowCreditPassRate.toFixed(3)} creditMaxFail=${value.shadowCreditMaxFailureStreak} `
      + `coverage=${value.bioCoverage.toFixed(3)} shortfall=${value.bioShortfall.toFixed(3)} `
      + `hungerRisk=${value.hungerRiskShare.toFixed(3)} huntDays=${value.huntingDayShare.toFixed(3)} `
      + `digestDays=${value.digestingDayShare.toFixed(3)} totalGross/demand=${value.totalGrossIntakeVsDemand.toFixed(3)} avgKillKg=${value.averageKillBiomassKg.toFixed(2)} altKg=${value.alternativeFoodConsumedKg.toFixed(1)} `
      + `fruit=${value.alternativeFruitKg.toFixed(1)} insects=${value.alternativeInsectKg.toFixed(1)} carrion=${value.alternativeCarrionKg.toFixed(1)} `
      + `births=${value.births} immigrants=${value.immigrants} deaths=${value.deaths} `
      + `hungerDeaths=${value.hungerDeaths} naturalDeaths=${value.naturalDeaths}`,
  );
  if (value.topPrey.length > 0) {
    console.log(
      `[${phase}|${seed}] ${speciesId} preyMix=`
        + value.topPrey.map(entry => `${entry.preyId}:${entry.kills}/${entry.biomassKg.toFixed(1)}kg`).join(','),
    );
  }
}

mkdirSync('artifacts', { recursive: true });
const path = `artifacts/predator-${phase}-diagnostic-${seed}-${days}d.json`;
writeFileSync(path, JSON.stringify(report, null, 2));
console.log(`[${phase}|${seed}] report=${path}`);
