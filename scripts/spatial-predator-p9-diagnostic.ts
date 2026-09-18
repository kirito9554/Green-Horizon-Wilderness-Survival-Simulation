import { mkdirSync, writeFileSync } from 'node:fs';
import { createSpatialFaunaEcosystemState, tickSpatialFaunaEcosystemDay } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import { getSpatialFaunaRuntimePopulation } from '../src/simulation/spatial/spatialFaunaRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';
import type { SpatialPredatorSpeciesTelemetry } from '../src/types/spatialEcologySimulation';

const seed = process.env.SPATIAL_TROPHIC_SEED ?? 'spatial-trophic-soak-alpha';
const days = Math.max(2, Math.floor(Number(process.env.P9_DAYS ?? 30)));
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
  huntAttempts: number;
  successfulHunts: number;
  unsuccessfulHunts: number;
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
  births: number;
  immigrants: number;
  deaths: number;
  hungerDeaths: number;
}

const aggregates: Record<string, Aggregate> = {};
for (const telemetry of Object.values(runtime.predatorSystem?.telemetry.bySpecies ?? {})) {
  aggregates[telemetry.speciesId] = {
    speciesId: telemetry.speciesId,
    startPopulation: telemetry.endPopulation,
    endPopulation: telemetry.endPopulation,
    preyKilled: 0,
    huntAttempts: 0,
    successfulHunts: 0,
    unsuccessfulHunts: 0,
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
    births: 0,
    immigrants: 0,
    deaths: 0,
    hungerDeaths: 0,
  };
}

function accumulate(daily: SpatialPredatorSpeciesTelemetry): void {
  const total = aggregates[daily.speciesId];
  if (!total) return;
  total.endPopulation = daily.endPopulation;
  total.preyKilled += daily.preyKilled;
  total.huntAttempts += daily.huntAttempts;
  total.successfulHunts += daily.successfulHunts;
  total.unsuccessfulHunts += daily.unsuccessfulHunts;
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
  total.births += daily.births;
  total.immigrants += daily.immigrants;
  total.deaths += daily.deaths;
  total.hungerDeaths += daily.hungerDeaths;
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
    bioCoverage: a.bioCoveredDemandKJ / demand,
    bioShortfall: a.bioShortfallKJ / demand,
    hungerRiskShare: a.hungerRiskPredatorDays / predatorDays,
    huntingDayShare: a.huntingPredatorDays / predatorDays,
    feedingBoutDayShare: a.feedingBoutPredatorDays / predatorDays,
    digestingDayShare: a.shadowDigestingPredatorDays / predatorDays,
    assimilatedVsDemand: a.shadowAssimilatedEnergyKJ / demand,
    intakeVsDemand: a.ingestedPreyEnergyKJ / demand,
  }];
}));

const report = {
  seed,
  days,
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
  `[p9.3|${seed}|${days}d] prey=${initialPrey}->${endPrey} min=${minPrey}/${carryingCapacity} `
    + `predators=${initialPredators}->${endPredators} kills=${totalKills}`,
);
for (const point of checkpoints) {
  console.log(`[p9.3|${seed}] day=${point.day} prey=${point.prey} predators=${point.predators}`);
}
for (const [speciesId, value] of Object.entries(species)) {
  console.log(
    `[p9.3|${seed}] ${speciesId} pop=${value.startPopulation}->${value.endPopulation} `
      + `attempts/predDay=${value.attemptsPerPredatorDay.toFixed(3)} kills/predDay=${value.killsPerPredatorDay.toFixed(3)} `
      + `success=${value.huntSuccessRate.toFixed(3)} coverage=${value.bioCoverage.toFixed(3)} shortfall=${value.bioShortfall.toFixed(3)} `
      + `hungerRisk=${value.hungerRiskShare.toFixed(3)} huntDays=${value.huntingDayShare.toFixed(3)} `
      + `digestDays=${value.digestingDayShare.toFixed(3)} births=${value.births} immigrants=${value.immigrants} deaths=${value.deaths}`,
  );
}

mkdirSync('artifacts', { recursive: true });
const path = `artifacts/predator-p9-diagnostic-${seed}-${days}d.json`;
writeFileSync(path, JSON.stringify(report, null, 2));
console.log(`[p9.3|${seed}] report=${path}`);
