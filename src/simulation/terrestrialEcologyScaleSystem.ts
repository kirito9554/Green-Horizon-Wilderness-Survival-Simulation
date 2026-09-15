import type { GameState } from '../types';
import type {
  EcologicalSubarea,
  WildAnimalPopulation,
  WildPlantPopulation,
  WildPredatorPopulation,
} from '../types/ecologySimulation';
import { REGION_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';

/**
 * Terrestrial ecology uses BuildGrid cells as persistent local samples, not as the
 * literal total area of a macro POI. This layer keeps the physical sample intact
 * for local interactions while temporarily exposing a larger ecological area to
 * flora/fauna/predator simulation.
 */
const TERRESTRIAL_ECOLOGY_SCALE_VERSION = 1;
const PHYSICAL_AREA_RUNTIME: unique symbol = Symbol('terrestrialPhysicalAreaM2');

interface RuntimeScaledSubarea extends EcologicalSubarea {
  [PHYSICAL_AREA_RUNTIME]?: number;
  terrestrialFoodWebScaleVersion?: number;
  terrestrialFoodWebScaleFactor?: number;
}

interface ScaledPlantPopulation extends WildPlantPopulation {
  terrestrialScaleVersion?: number;
  terrestrialScaleFactor?: number;
}

interface ScaledAnimalPopulation extends WildAnimalPopulation {
  terrestrialScaleVersion?: number;
  terrestrialScaleFactor?: number;
}

interface ScaledPredatorPopulation extends WildPredatorPopulation {
  terrestrialScaleVersion?: number;
  terrestrialScaleFactor?: number;
}

export interface TerrestrialEcologyScaleSnapshot {
  subareas: Array<{
    subareaId: string;
    physicalAreaM2: number;
  }>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Hydrology's full landscape multiplier is intentionally not reused directly.
 * A terrestrial ecological subarea represents a local habitat patch plus its
 * surrounding connected habitat, not an entire watershed. The bounded square-root
 * transform keeps regional stocks meaningfully larger than the visible BuildGrid
 * without producing implausibly huge single-subarea populations.
 */
export function getTerrestrialEcologicalRepresentationScale(subarea: EcologicalSubarea): number {
  const regionScale = REGION_HYDROLOGY_PROFILES[subarea.poiId]?.effectiveLandscapeScale || 1;
  return clamp(Math.sqrt(Math.max(1, regionScale)) / 3, 4, 12);
}

export function getPhysicalTerrestrialAreaM2(subarea: EcologicalSubarea): number {
  const runtime = subarea as RuntimeScaledSubarea;
  return Math.max(0, runtime[PHYSICAL_AREA_RUNTIME] ?? subarea.areaM2);
}

export function getEffectiveTerrestrialAreaM2(subarea: EcologicalSubarea): number {
  return getPhysicalTerrestrialAreaM2(subarea) * getTerrestrialEcologicalRepresentationScale(subarea);
}

/**
 * Fraction of a regional subarea stock that is physically represented by the
 * current local BuildGrid sample. Future harvesting/encounter code should use
 * this when estimating what is locally accessible without exposing the whole
 * regional stock at once.
 */
export function getTerrestrialLocalAccessFraction(subarea: EcologicalSubarea): number {
  const effective = getEffectiveTerrestrialAreaM2(subarea);
  return effective > 0 ? clamp(getPhysicalTerrestrialAreaM2(subarea) / effective, 0, 1) : 1;
}

export function getLocalAccessiblePlantBiomassKg(state: GameState, population: WildPlantPopulation): number {
  const subarea = state.ecologySystem?.subareasById?.[population.subareaId];
  if (!subarea) return Math.max(0, population.biomassKg);
  return round3(Math.max(0, population.biomassKg) * getTerrestrialLocalAccessFraction(subarea));
}

export function getExpectedLocallyAvailableAnimals(state: GameState, population: WildAnimalPopulation): number {
  const subarea = state.ecologySystem?.subareasById?.[population.currentSubareaId];
  if (!subarea) return Math.max(0, population.population);
  return round3(Math.max(0, population.population) * getTerrestrialLocalAccessFraction(subarea));
}

function scaleAgeStructuredPopulation(
  population: { population: number; juveniles: number; adults: number; old: number; biomassKg: number },
  factor: number,
): void {
  if (factor <= 1 || population.population <= 0) return;
  const beforePopulation = Math.max(1, population.population);
  const scaleStage = (value: number) => value <= 0 ? 0 : Math.max(1, Math.round(value * factor));
  population.juveniles = scaleStage(population.juveniles);
  population.adults = scaleStage(population.adults);
  population.old = scaleStage(population.old);
  population.population = population.juveniles + population.adults + population.old;
  population.biomassKg = round3(population.biomassKg * population.population / beforePopulation);
}

function reconcileFoodWeb(subarea: EcologicalSubarea): void {
  const runtime = subarea as RuntimeScaledSubarea;
  if (!runtime.foodWeb || runtime.terrestrialFoodWebScaleVersion === TERRESTRIAL_ECOLOGY_SCALE_VERSION) return;
  const scale = getTerrestrialEcologicalRepresentationScale(subarea);
  const alreadyAtEffectiveRuntimeArea = runtime[PHYSICAL_AREA_RUNTIME] !== undefined;
  if (!alreadyAtEffectiveRuntimeArea) {
    runtime.foodWeb.insectBiomassKg = round3(runtime.foodWeb.insectBiomassKg * scale);
    runtime.foodWeb.aquaticPlantBiomassKg = round3(runtime.foodWeb.aquaticPlantBiomassKg * scale);
    runtime.foodWeb.carrionBiomassKg = round3(runtime.foodWeb.carrionBiomassKg * scale);
  }
  runtime.terrestrialFoodWebScaleVersion = TERRESTRIAL_ECOLOGY_SCALE_VERSION;
  runtime.terrestrialFoodWebScaleFactor = scale;
}

function reconcilePlantPopulation(state: GameState, population: WildPlantPopulation): void {
  const scaled = population as ScaledPlantPopulation;
  if (scaled.terrestrialScaleVersion === TERRESTRIAL_ECOLOGY_SCALE_VERSION) return;
  const subarea = state.ecologySystem?.subareasById?.[population.subareaId] as RuntimeScaledSubarea | undefined;
  if (!subarea) return;
  const scale = getTerrestrialEcologicalRepresentationScale(subarea);
  const alreadyCreatedAtEffectiveRuntimeArea = subarea[PHYSICAL_AREA_RUNTIME] !== undefined;
  if (!alreadyCreatedAtEffectiveRuntimeArea) {
    population.biomassKg = round3(population.biomassKg * scale);
    population.fruitBiomassKg = round3(population.fruitBiomassKg * scale);
    population.estimatedIndividuals = Math.max(1, Math.round(population.estimatedIndividuals * scale));
  }
  scaled.terrestrialScaleVersion = TERRESTRIAL_ECOLOGY_SCALE_VERSION;
  scaled.terrestrialScaleFactor = scale;
}

function reconcileAnimalPopulation(state: GameState, population: WildAnimalPopulation): void {
  const scaled = population as ScaledAnimalPopulation;
  if (scaled.terrestrialScaleVersion === TERRESTRIAL_ECOLOGY_SCALE_VERSION) return;
  const subarea = state.ecologySystem?.subareasById?.[population.currentSubareaId];
  if (!subarea) return;
  const landscapeScale = getTerrestrialEcologicalRepresentationScale(subarea);
  // Species definitions were originally tuned with small local founder caps. Keep
  // those caps useful for social structure, but expand aggregate regional stock
  // enough that one survivor cannot erase a macro population in a few encounters.
  const founderScale = clamp(Math.sqrt(landscapeScale), 1, 3.2);
  scaleAgeStructuredPopulation(population, founderScale);
  scaled.terrestrialScaleVersion = TERRESTRIAL_ECOLOGY_SCALE_VERSION;
  scaled.terrestrialScaleFactor = founderScale;
}

function reconcilePredatorPopulation(state: GameState, population: WildPredatorPopulation): void {
  const scaled = population as ScaledPredatorPopulation;
  if (scaled.terrestrialScaleVersion === TERRESTRIAL_ECOLOGY_SCALE_VERSION) return;
  const subarea = state.ecologySystem?.subareasById?.[population.currentSubareaId];
  if (!subarea) return;
  const landscapeScale = getTerrestrialEcologicalRepresentationScale(subarea);
  // Predator populations expand less aggressively than prey populations so the
  // food web does not become predator-heavy solely because the spatial sample grew.
  const founderScale = clamp(Math.pow(landscapeScale, 0.35), 1, 2.2);
  scaleAgeStructuredPopulation(population, founderScale);
  scaled.terrestrialScaleVersion = TERRESTRIAL_ECOLOGY_SCALE_VERSION;
  scaled.terrestrialScaleFactor = founderScale;
}

/**
 * Lazily upgrades old saves and any newly materialized populations. No save-version
 * bump is required: the markers are optional additive fields and JSON persistence
 * naturally preserves them after the first reconciliation.
 */
export function reconcileTerrestrialEcologyScale(state: GameState): void {
  const system = state.ecologySystem;
  if (!system) return;
  system.version = Math.max(6, system.version || 1);
  for (const subarea of Object.values(system.subareasById)) reconcileFoodWeb(subarea);
  for (const population of system.plantPopulations || []) reconcilePlantPopulation(state, population);
  for (const population of system.animalPopulations || []) reconcileAnimalPopulation(state, population);
  for (const population of system.predatorPopulations || []) reconcilePredatorPopulation(state, population);
}

/**
 * Temporarily expose effective ecological area to the existing flora/fauna code.
 * BuildGrid geometry and the persistent physical subarea footprint are restored
 * immediately after the terrestrial ecology pass.
 */
export function prepareTerrestrialEcologyScale(state: GameState): TerrestrialEcologyScaleSnapshot {
  reconcileTerrestrialEcologyScale(state);
  const snapshot: TerrestrialEcologyScaleSnapshot = { subareas: [] };
  const system = state.ecologySystem;
  if (!system) return snapshot;

  for (const subarea of Object.values(system.subareasById)) {
    const runtime = subarea as RuntimeScaledSubarea;
    if (runtime[PHYSICAL_AREA_RUNTIME] !== undefined) continue;
    const physicalAreaM2 = Math.max(0, subarea.areaM2);
    snapshot.subareas.push({ subareaId: subarea.id, physicalAreaM2 });
    runtime[PHYSICAL_AREA_RUNTIME] = physicalAreaM2;
    subarea.areaM2 = physicalAreaM2 * getTerrestrialEcologicalRepresentationScale(subarea);
  }
  return snapshot;
}

export function finalizeTerrestrialEcologyScale(
  state: GameState,
  snapshot: TerrestrialEcologyScaleSnapshot,
): void {
  // Capture populations/food-web state created during the effective-area pass
  // before restoring physical geometry.
  reconcileTerrestrialEcologyScale(state);
  const system = state.ecologySystem;
  if (!system) return;
  for (const saved of snapshot.subareas) {
    const subarea = system.subareasById[saved.subareaId] as RuntimeScaledSubarea | undefined;
    if (!subarea) continue;
    subarea.areaM2 = saved.physicalAreaM2;
    delete subarea[PHYSICAL_AREA_RUNTIME];
  }
}
