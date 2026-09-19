import assert from 'node:assert/strict';
import { createSpatialFaunaEcosystemState } from '../src/simulation/spatial/spatialFaunaEcosystemRuntime';
import { calculatePredatorEnergyLedger } from '../src/simulation/spatial/spatialPredatorP7';
import { tickSpatialPredatorsDay } from '../src/simulation/spatial/spatialPredatorRuntime';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

function approx(actual: number, expected: number, label: string, scale = 1): void {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, scale) * 1e-9, `${label}: ${actual} vs ${expected}`);
}

for (const [name, reserve, capacity, fresh, demand] of [
  ['reserve draw', 5, 10, 2, 8],
  ['reserve refill', 5, 10, 10, 8],
  ['overflow', 10, 10, 5, 3],
  ['shortfall', 0, 10, 1, 8],
] as const) {
  const ledger = calculatePredatorEnergyLedger(reserve, capacity, fresh, demand);
  approx(ledger.demandKg, ledger.coveredDemandKg + ledger.shortfallKg, `${name} demand`, demand);
  approx(
    ledger.reserveBeforeKg + ledger.huntedEdibleKg,
    ledger.coveredDemandKg + ledger.reserveAfterKg + ledger.overflowKg,
    `${name} energy conservation`,
    reserve + fresh,
  );
  approx(
    ledger.reserveAfterKg,
    ledger.reserveBeforeKg - ledger.reserveDrawKg + ledger.reserveGainKg,
    `${name} reserve balance`,
    capacity,
  );
  assert.ok(ledger.reserveAfterKg >= 0 && ledger.reserveAfterKg <= ledger.reserveCapacityKg + 1e-9, `${name} reserve bounds`);
}

const world = generateSpatialWorld('spatial-trophic-soak-alpha');
const runtime = createSpatialFaunaEcosystemState('spatial-trophic-soak-alpha', 1, world);
assert.ok(runtime.predatorSystem, 'predator runtime missing');
const telemetry = tickSpatialPredatorsDay(runtime.predatorSystem, runtime, world, 2, 'dry');

for (const species of Object.values(telemetry.bySpecies ?? {})) {
  assert.equal(species.successfulHunts, species.preyKilled, `${species.speciesId} successful hunts must equal kills`);
  assert.equal(species.huntAttempts, species.successfulHunts + species.unsuccessfulHunts, `${species.speciesId} hunt attempts must reconcile`);
  const tolerance = Math.max(1, species.dailyDemandKg + species.reserveStartKg + species.edibleBiomassFromKillsKg) * 1e-9;
  assert.ok(
    Math.abs(species.edibleBiomassFromKillsKg - species.preyBiomassKilledKg * .62) <= tolerance,
    `${species.speciesId} edible yield must match kill biomass`,
  );
  assert.ok(
    Math.abs(species.dailyDemandKg - species.coveredDemandKg - species.energyShortfallKg) <= tolerance,
    `${species.speciesId} demand must reconcile`,
  );
  assert.ok(
    Math.abs(species.reserveEndKg - (species.reserveStartKg - species.reserveDrawKg + species.reserveGainKg)) <= tolerance,
    `${species.speciesId} reserve must reconcile`,
  );
  assert.ok(
    Math.abs(
      species.reserveStartKg + species.edibleBiomassFromKillsKg
      - species.coveredDemandKg - species.reserveEndKg - species.edibleOverflowKg
    ) <= tolerance,
    `${species.speciesId} energy must be conserved`,
  );
  assert.ok(species.accessiblePreyHeadDays <= species.islandPreferredPreyHeadDays + tolerance, `${species.speciesId} local prey heads cannot exceed island pool`);
  assert.ok(
    species.accessiblePreyBiomassPredatorDaysKg <= species.islandPreferredPreyBiomassPredatorDaysKg + tolerance,
    `${species.speciesId} local prey biomass cannot exceed island pool`,
  );
  assert.ok(species.mateAccessBeforeSum <= species.mateAccessEvaluated + 1e-9, `${species.speciesId} mate access before must be bounded`);
  assert.ok(species.mateAccessAfterSum <= species.mateAccessEvaluated + 1e-9, `${species.speciesId} mate access after must be bounded`);
}

console.log('spatial predator P7 energy-accounting telemetry regression passed');
