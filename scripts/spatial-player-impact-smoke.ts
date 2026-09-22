import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createSpatialFaunaEcosystemState,
  tickSpatialFaunaEcosystemDay,
} from "../src/simulation/spatial/spatialFaunaEcosystemRuntime";
import { getSpatialFaunaRuntimePopulation } from "../src/simulation/spatial/spatialFaunaRuntime";
import { generateSpatialWorld } from "../src/simulation/spatial/worldGeneration";
import type { GeneratedSpatialWorld } from "../src/simulation/spatial/worldGeneration";
import type {
  SpatialFaunaPatchCohortState,
  SpatialFaunaRuntimeState,
} from "../src/types/spatialFaunaSimulation";

type Scenario = "control" | "hunting" | "harvesting" | "deforestation" | "water-pollution" | "combined";

interface ActionMetrics {
  huntedAnimals: number;
  harvestedFoodKg: number;
  clearedFloraKg: number;
  pollutedWaterUnits: number;
}

interface ScenarioResult extends ActionMetrics {
  scenario: Scenario;
  days: number;
  initialPrey: number;
  finalPrey: number;
  minimumPrey: number;
  initialFloraKg: number;
  finalFloraKg: number;
  minimumFloraKg: number;
  minimumFoodFill: number;
  minimumWaterFill: number;
  initialPredators: number;
  finalPredators: number;
}

const days = Math.max(7, Math.floor(Number(process.env.PLAYER_IMPACT_DAYS ?? 365)));
const seed = process.env.SPATIAL_TROPHIC_SEED ?? "spatial-player-impact";
const scenarios: Scenario[] = [
  "control",
  "hunting",
  "harvesting",
  "deforestation",
  "water-pollution",
  "combined",
];

const FOOD_STOCK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const FRESH_WATER_INDEX = 8;

function patchTargets(world: GeneratedSpatialWorld): string[] {
  return world.habitatPatches.slice(0, 4).map((patch) => patch.id);
}

function population(cohort: SpatialFaunaPatchCohortState): number {
  return cohort[0] + cohort[1] + cohort[2];
}

function removeFromCohort(cohort: SpatialFaunaPatchCohortState, requested: number): number {
  let remaining = Math.max(0, Math.floor(requested));
  let removed = 0;
  for (const index of [2, 1, 0] as const) {
    const amount = Math.min(cohort[index], remaining);
    cohort[index] -= amount;
    remaining -= amount;
    removed += amount;
    if (remaining <= 0) break;
  }
  return removed;
}

function huntWildlife(runtime: SpatialFaunaRuntimeState, targets: string[], metrics: ActionMetrics): void {
  for (const species of runtime.species) {
    for (const patchId of targets) {
      const cohort = species.cohortsByPatch[patchId];
      if (!cohort) continue;
      const requested = Math.max(1, Math.floor(population(cohort) * 0.01));
      metrics.huntedAnimals += removeFromCohort(cohort, requested);
    }
  }
}

function harvestWildFood(runtime: SpatialFaunaRuntimeState, targets: string[], metrics: ActionMetrics): void {
  for (const patchId of targets) {
    const stock = runtime.resourceStocksByPatch?.[patchId];
    if (!stock) continue;
    for (const index of FOOD_STOCK_INDICES) {
      const removed = stock[index] * 0.2;
      stock[index] = Math.max(0, stock[index] - removed);
      metrics.harvestedFoodKg += removed;
    }
  }
}

function clearHabitat(runtime: SpatialFaunaRuntimeState, targets: string[], metrics: ActionMetrics): void {
  for (const flora of runtime.floraSystem?.species ?? []) {
    for (const patchId of targets) {
      const state = flora.patches[patchId];
      if (!state) continue;
      const before = state[0];
      state[0] *= 0.4;
      state[1] *= 0.7;
      state[2] *= 0.75;
      metrics.clearedFloraKg += before - state[0];
    }
  }
}

function polluteWater(runtime: SpatialFaunaRuntimeState, targets: string[], metrics: ActionMetrics): void {
  for (const patchId of targets) {
    const stock = runtime.resourceStocksByPatch?.[patchId];
    if (!stock) continue;
    const removed = stock[FRESH_WATER_INDEX] * 0.25;
    stock[FRESH_WATER_INDEX] = Math.max(0, stock[FRESH_WATER_INDEX] - removed);
    metrics.pollutedWaterUnits += removed;
  }
}

function applyPlayerActions(
  runtime: SpatialFaunaRuntimeState,
  targets: string[],
  day: number,
  scenario: Scenario,
  metrics: ActionMetrics,
): void {
  if (scenario === "control") return;

  const isCombined = scenario === "combined";
  if ((scenario === "hunting" || isCombined) && day % 7 === 0) {
    huntWildlife(runtime, targets, metrics);
  }
  if ((scenario === "harvesting" || isCombined) && day % 7 === 0) {
    harvestWildFood(runtime, targets, metrics);
  }
  if ((scenario === "deforestation" || isCombined) && day === 2) {
    clearHabitat(runtime, targets, metrics);
  }
  if ((scenario === "water-pollution" || isCombined) && day <= 180) {
    polluteWater(runtime, targets, metrics);
  }
}

function runScenario(scenario: Scenario): ScenarioResult {
  const world = generateSpatialWorld(seed);
  const runtime = createSpatialFaunaEcosystemState(seed, 1, world);
  const targets = patchTargets(world);
  const metrics: ActionMetrics = {
    huntedAnimals: 0,
    harvestedFoodKg: 0,
    clearedFloraKg: 0,
    pollutedWaterUnits: 0,
  };
  const initialPrey = getSpatialFaunaRuntimePopulation(runtime);
  const initialFloraKg = runtime.floraSystem?.telemetry.totalBiomassKg ?? 0;
  const initialPredators = runtime.predatorSystem?.telemetry.totalPopulation ?? 0;
  let minimumPrey = initialPrey;
  let minimumFloraKg = initialFloraKg;
  let minimumFoodFill = 1;
  let minimumWaterFill = 1;

  for (let day = 2; day <= days; day += 1) {
    applyPlayerActions(runtime, targets, day, scenario, metrics);
    const telemetry = tickSpatialFaunaEcosystemDay(runtime, world, day, {
      maintainMateConnectivity: true,
      controlledRecovery: true,
      bioenergeticFeeding: true,
      accumulatedCaptureOpportunity: true,
    });
    minimumPrey = Math.min(minimumPrey, getSpatialFaunaRuntimePopulation(runtime));
    minimumFloraKg = Math.min(minimumFloraKg, runtime.floraSystem?.telemetry.totalBiomassKg ?? 0);
    minimumFoodFill = Math.min(minimumFoodFill, telemetry.meanFoodPoolFill ?? 1);
    minimumWaterFill = Math.min(minimumWaterFill, telemetry.meanWaterPoolFill ?? 1);
  }

  return {
    scenario,
    days,
    ...metrics,
    initialPrey,
    finalPrey: getSpatialFaunaRuntimePopulation(runtime),
    minimumPrey,
    initialFloraKg,
    finalFloraKg: runtime.floraSystem?.telemetry.totalBiomassKg ?? 0,
    minimumFloraKg,
    minimumFoodFill,
    minimumWaterFill,
    initialPredators,
    finalPredators: runtime.predatorSystem?.telemetry.totalPopulation ?? 0,
  };
}

const results = scenarios.map(runScenario);
const control = results.find((result) => result.scenario === "control")!;
const combined = results.find((result) => result.scenario === "combined")!;
const byScenario = new Map(results.map((result) => [result.scenario, result]));

assert.ok(control.finalPredators > 0, "control ecosystem lost all predators");
assert.ok(combined.finalPredators > 0, "combined player pressure caused predator extinction");
assert.ok(combined.finalPrey > combined.initialPrey * 0.1, "combined player pressure caused immediate prey collapse");
assert.ok(combined.finalPrey < control.finalPrey, "combined player pressure did not affect final prey population");
assert.ok(
  combined.minimumFoodFill < control.minimumFoodFill
    || combined.minimumWaterFill < control.minimumWaterFill
    || combined.minimumFloraKg < control.minimumFloraKg,
  "combined player pressure did not leave a measurable ecosystem footprint",
);

assert.ok((byScenario.get("hunting")?.huntedAnimals ?? 0) > 0, "hunting scenario applied no wildlife removal");
assert.ok((byScenario.get("harvesting")?.harvestedFoodKg ?? 0) > 0, "harvesting scenario removed no food");
assert.ok((byScenario.get("deforestation")?.clearedFloraKg ?? 0) > 0, "deforestation scenario removed no flora");
assert.ok((byScenario.get("water-pollution")?.pollutedWaterUnits ?? 0) > 0, "water scenario removed no water");

console.log("Player-impact ecosystem regression passed.");
for (const result of results) {
  console.log(
    "[" + result.scenario + "] "
      + "prey=" + result.initialPrey + "->" + result.finalPrey
      + " minPrey=" + result.minimumPrey
      + " flora=" + result.initialFloraKg.toFixed(1) + "->" + result.finalFloraKg.toFixed(1)
      + " minFoodFill=" + result.minimumFoodFill.toFixed(3)
      + " minWaterFill=" + result.minimumWaterFill.toFixed(3)
      + " predators=" + result.initialPredators + "->" + result.finalPredators
      + " actions(hunt/food/flora/water)="
      + result.huntedAnimals + "/" + result.harvestedFoodKg.toFixed(1) + "/"
      + result.clearedFloraKg.toFixed(1) + "/" + result.pollutedWaterUnits.toFixed(1),
  );
}

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/spatial-player-impact-" + seed + "-" + days + "d.json",
  JSON.stringify({ seed, days, targets: patchTargets(generateSpatialWorld(seed)), results }, null, 2),
);
