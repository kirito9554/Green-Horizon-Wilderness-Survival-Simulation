import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Snapshot {
  plantBiomassKg: number;
  fruitBiomassKg: number;
  faunaPopulation: number;
  faunaBiomassKg: number;
  predatorPopulation: number;
  predatorBiomassKg: number;
  aquaticPopulation: number;
  aquaticBiomassKg: number;
  averageFaunaFoodStress: number;
  averagePredatorHungerStress: number;
  averageAquaticStress: number;
  biologicalGatherStockUnits: number;
  floraBySpeciesKg: Record<string, number>;
  faunaBySpecies: Record<string, number>;
  predatorsBySpecies: Record<string, number>;
  aquaticBySpecies: Record<string, number>;
  averageFireDamage: number;
  averageLoggingPressure: number;
  averageForagingPressure: number;
}

interface ManifestEntry {
  scenario: string;
  years: number;
  stepMinutes: number;
  seed: string;
  baseline: Snapshot;
  final: Snapshot;
  peakDisturbance: number;
  warnings: string[];
}

const tsxBin = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const harnessPath = join('scripts', 'ecosystem-long-run.ts');

function runScenario(scenario: string, days: number, stepMinutes: number, seed: string): ManifestEntry {
  const outDir = mkdtempSync(join(tmpdir(), 'ecosystem-long-run-ci-'));
  try {
    const years = days / 365;
    execFileSync(tsxBin, [
      harnessPath,
      `--scenario=${scenario}`,
      `--years=${years}`,
      `--step-minutes=${stepMinutes}`,
      `--seed=${seed}`,
      `--out=${outDir}`,
    ], {
      cwd: process.cwd(),
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as ManifestEntry[];
    assert.equal(manifest.length, 1, 'CI harness invocation must emit exactly one scenario result');
    return manifest[0];
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function relativeDifference(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
}

function deterministicFingerprint(snapshot: Snapshot): string {
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

function disturbance(snapshot: Snapshot): number {
  return (snapshot.averageFireDamage + snapshot.averageLoggingPressure + snapshot.averageForagingPressure) / 3;
}

function main(): void {
  // Determinism only needs enough time to pass aquatic bootstrap and one
  // recolonization window. Keep this short because exact replay is binary.
  const deterministicA = runScenario('untouched', 30, 360, 'long-run-ci-determinism');
  const deterministicB = runScenario('untouched', 30, 360, 'long-run-ci-determinism');
  assert.equal(
    deterministicFingerprint(deterministicA.final),
    deterministicFingerprint(deterministicB.final),
    'same seed and timestep must reproduce the same ecosystem state',
  );

  // 90 days is intentionally retained here because it spans several aquatic
  // immigration windows and previously exposed the coarse-step snapper failure.
  const fine = runScenario('untouched', 90, 60, 'long-run-ci-timestep');
  const coarse = runScenario('untouched', 90, 360, 'long-run-ci-timestep');
  const timestepMetrics: Array<keyof Pick<Snapshot,
    'plantBiomassKg' | 'fruitBiomassKg' | 'faunaBiomassKg' | 'predatorBiomassKg' | 'aquaticBiomassKg'
  >> = [
    'plantBiomassKg',
    'fruitBiomassKg',
    'faunaBiomassKg',
    'predatorBiomassKg',
    'aquaticBiomassKg',
  ];
  const timestepDifference: Record<string, number> = {};
  for (const metric of timestepMetrics) {
    const difference = relativeDifference(fine.final[metric], coarse.final[metric]);
    timestepDifference[metric] = Math.round(difference * 10000) / 10000;
    assert.ok(difference < 0.45, `${metric} must remain reasonably timestep invariant`);
  }

  // A six-month pressure window is enough to prove gameplay extraction reaches
  // ecology while staying cheap enough for every PR. Full 1/5/20-year sweeps are
  // intentionally left to sim:ecology-long-run rather than CI.
  const untouched = runScenario('untouched', 180, 720, 'long-run-ci-pressure');
  const heavy = runScenario('heavy_harvest', 180, 720, 'long-run-ci-pressure');
  assert.ok(
    untouched.final.plantBiomassKg > 0
      && untouched.final.faunaPopulation > 0
      && untouched.final.aquaticPopulation > 0,
    'untouched six-month ecosystem must remain biologically active',
  );
  assert.ok(
    heavy.final.biologicalGatherStockUnits < untouched.final.biologicalGatherStockUnits
      || heavy.final.faunaPopulation < untouched.final.faunaPopulation
      || heavy.final.aquaticPopulation < untouched.final.aquaticPopulation,
    'heavy harvesting must produce a measurable ecological depletion signal',
  );

  // The catastrophe begins after day 120 in the main harness. 240 days leaves a
  // second 120-day window in which recovery must become measurable.
  const catastrophe = runScenario('catastrophe_recovery', 240, 720, 'long-run-ci-catastrophe');
  assert.ok(
    catastrophe.peakDisturbance > disturbance(catastrophe.final),
    'disturbance must decline after a one-off catastrophe instead of remaining permanently locked',
  );

  console.log('ecosystem long-run CI regression suite: ok');
  console.log(JSON.stringify({
    timestepDifference,
    untouched: {
      plantBiomassKg: untouched.final.plantBiomassKg,
      faunaPopulation: untouched.final.faunaPopulation,
      predatorPopulation: untouched.final.predatorPopulation,
      aquaticPopulation: untouched.final.aquaticPopulation,
    },
    heavyHarvest: {
      plantBiomassKg: heavy.final.plantBiomassKg,
      faunaPopulation: heavy.final.faunaPopulation,
      predatorPopulation: heavy.final.predatorPopulation,
      aquaticPopulation: heavy.final.aquaticPopulation,
      biologicalGatherStockUnits: heavy.final.biologicalGatherStockUnits,
    },
    catastrophe: {
      peakDisturbance: catastrophe.peakDisturbance,
      finalDisturbance: Math.round(disturbance(catastrophe.final) * 1000) / 1000,
    },
  }, null, 2));
}

main();
