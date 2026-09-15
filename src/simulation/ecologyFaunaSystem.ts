import type { GameState } from '../types';
import type {
  EcologicalSubarea,
  EcologyFoodWebState,
  SignificantWildAnimal,
  WildAnimalLifeStage,
  WildAnimalPopulation,
  WildFoodResource,
  WildPlantPopulation,
  WorldEcologyState,
} from '../types/ecologySimulation';
import type { MainWorldAreaId } from '../data/mainWorldAreas';
import { WILD_FAUNA_SPECIES, type WildFaunaSpeciesDefinition } from '../data/ecologyFauna';
import { WILD_FLORA_SPECIES } from '../data/ecologyProfiles';
import { ensureRegionEcology, ensureWorldEcology, getRegionSubareas } from './ecologySystem';

const WILD_FOOD_RESOURCES: WildFoodResource[] = [
  'fruit', 'seeds', 'browse', 'ground_vegetation', 'roots_tubers', 'insects', 'aquatic_plants', 'carrion',
];

export interface WildFoodPool extends Record<WildFoodResource, number> {}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 1000) / 1000));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function ensureFoodWeb(subarea: EcologicalSubarea): EcologyFoodWebState {
  if (subarea.foodWeb) return subarea.foodWeb;
  const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
  subarea.foodWeb = {
    insectBiomassKg: round3(areaFactor * (0.35 + subarea.ecology.decompositionRate / 52 + subarea.ecology.biomass / 140)),
    carrionBiomassKg: 0,
    aquaticPlantBiomassKg: round3(areaFactor * (subarea.environment.waterAccess / 100) * (0.35 + subarea.environment.moisture / 120)),
  };
  return subarea.foodWeb;
}

export function ensureWildFauna(state: GameState): WorldEcologyState {
  const system = ensureWorldEcology(state);
  system.version = Math.max(2, system.version || 1);
  system.animalPopulations ||= [];
  system.significantAnimals ||= [];
  for (const subarea of Object.values(system.subareasById)) ensureFoodWeb(subarea);
  for (const region of Object.values(system.regionsByPoiId)) {
    if (region && region.faunaSeeded === undefined) region.faunaSeeded = false;
  }
  return system;
}

function emptyFoodPool(): WildFoodPool {
  return {
    fruit: 0,
    seeds: 0,
    browse: 0,
    ground_vegetation: 0,
    roots_tubers: 0,
    insects: 0,
    aquatic_plants: 0,
    carrion: 0,
  };
}

function plantFoodPool(populations: WildPlantPopulation[]): WildFoodPool {
  const pool = emptyFoodPool();
  for (const population of populations) {
    const flora = WILD_FLORA_SPECIES[population.speciesId];
    if (!flora || population.biomassKg <= 0) continue;
    pool.fruit += Math.max(0, population.fruitBiomassKg);
    pool.seeds += population.biomassKg * clamp01(population.seedBank / 100) * 0.025;
    if (['tree', 'palm', 'clump', 'shrub'].includes(flora.form)) pool.browse += population.biomassKg * 0.16;
    if (['herb', 'fern', 'reed', 'guild'].includes(flora.form)) pool.ground_vegetation += population.biomassKg * 0.3;
    if (['herb', 'clump'].includes(flora.form)) pool.roots_tubers += population.biomassKg * 0.09;
    if (flora.id === 'FLORA_WILD_TARO') pool.roots_tubers += population.biomassKg * 0.22;
  }
  return pool;
}

export function getSubareaWildFoodPool(state: GameState, subareaId: string): WildFoodPool {
  const system = ensureWildFauna(state);
  const subarea = system.subareasById[subareaId];
  if (!subarea) return emptyFoodPool();
  const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
  const foodWeb = ensureFoodWeb(subarea);
  let pool = emptyFoodPool();

  if (subarea.materializationState === 'materialized') {
    pool = plantFoodPool(system.plantPopulations.filter(population => population.subareaId === subareaId));
    // Root/tuber availability also includes small plants that are not important enough
    // to be represented as their own population entry.
    pool.roots_tubers += subarea.resources.ediblePlantPotential * areaFactor * 0.018;
  } else {
    // Latent habitat still participates in animal movement. Its food is represented by
    // ecological potentials until the player observes the patch and flora materializes.
    pool.fruit = subarea.resources.fruitPotential * areaFactor * 0.035;
    pool.seeds = subarea.ecology.plantDiversity * areaFactor * 0.016;
    pool.browse = subarea.ecology.biomass * areaFactor * 0.075;
    pool.ground_vegetation = subarea.ecology.biomass * areaFactor * Math.max(0.025, (100 - subarea.environment.canopyCover) / 1250);
    pool.roots_tubers = subarea.resources.ediblePlantPotential * areaFactor * 0.025;
  }

  pool.insects = foodWeb.insectBiomassKg;
  pool.aquatic_plants = foodWeb.aquaticPlantBiomassKg;
  pool.carrion = foodWeb.carrionBiomassKg;
  for (const resource of WILD_FOOD_RESOURCES) pool[resource] = round3(Math.max(0, pool[resource]));
  return pool;
}

function subareaTargetValue(subarea: EcologicalSubarea, key: string): number | undefined {
  if (key === 'canopy') return subarea.environment.canopyCover;
  if (key === 'moisture') return subarea.environment.moisture;
  if (key === 'waterAccess') return subarea.environment.waterAccess;
  if (key === 'slope') return subarea.terrain.slope;
  if (key === 'floodRisk') return subarea.terrain.floodRisk;
  if (key === 'sunlight') return subarea.environment.sunlight;
  if (key === 'rocks') return clamp(subarea.terrain.slope * 1.8 + (100 - subarea.terrain.soilDepth) * 0.72);
  if (key === 'fertileSoil') return clamp(subarea.ecology.plantDiversity * 0.55 + subarea.ecology.biomass * 0.45);
  if (key === 'vegetation') return subarea.ecology.biomass;
  return undefined;
}

export function getWildAnimalHabitatSuitability(subarea: EcologicalSubarea, species: WildFaunaSpeciesDefinition): number {
  const entries = Object.entries(species.targets);
  if (!entries.length) return 0.5;
  let total = 0;
  let used = 0;
  for (const [key, target] of entries) {
    if (typeof target !== 'number') continue;
    const value = subareaTargetValue(subarea, key);
    if (value === undefined) continue;
    const tolerance = key === 'slope' ? Math.max(8, species.tolerance * 0.6) : Math.max(12, species.tolerance);
    total += Math.max(0, 1 - Math.abs(value - target) / tolerance);
    used++;
  }
  if (!used) return 0.5;
  const humanExcess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
  return clamp01(total / used * (1 - humanExcess / 145));
}

function dietWeightedFood(pool: WildFoodPool, species: WildFaunaSpeciesDefinition): number {
  let totalWeight = 0;
  let weighted = 0;
  for (const resource of WILD_FOOD_RESOURCES) {
    const weight = species.diet[resource] || 0;
    totalWeight += weight;
    weighted += pool[resource] * weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

function subareaAnimalScore(state: GameState, subarea: EcologicalSubarea, species: WildFaunaSpeciesDefinition): number {
  const habitat = getWildAnimalHabitatSuitability(subarea, species);
  const foodKg = dietWeightedFood(getSubareaWildFoodPool(state, subarea.id), species);
  const foodScore = clamp01(foodKg / Math.max(0.08, species.dailyFoodKgPerAdult * 5));
  const waterScore = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));
  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 130;
  return habitat * 0.52 + foodScore * 0.3 + waterScore * 0.18 - humanPenalty;
}

function regionNeighborIds(system: WorldEcologyState, subareaId: string): string[] {
  const neighbors: string[] = [];
  for (const connection of system.connections) {
    if (connection.fromSubareaId === subareaId) neighbors.push(connection.toSubareaId);
    else if (connection.toSubareaId === subareaId) neighbors.push(connection.fromSubareaId);
  }
  return neighbors;
}

function connectedHomeRange(
  state: GameState,
  startId: string,
  desiredCount: number,
  allowedIds: Set<string>,
  species: WildFaunaSpeciesDefinition,
): string[] {
  const system = ensureWildFauna(state);
  const result = [startId];
  const seen = new Set(result);
  while (result.length < desiredCount) {
    const candidates = new Set<string>();
    for (const id of result) {
      for (const neighbor of regionNeighborIds(system, id)) if (allowedIds.has(neighbor) && !seen.has(neighbor)) candidates.add(neighbor);
    }
    if (!candidates.size) break;
    const best = [...candidates]
      .map(id => system.subareasById[id])
      .filter((entry): entry is EcologicalSubarea => Boolean(entry))
      .sort((a, b) => subareaAnimalScore(state, b, species) - subareaAnimalScore(state, a, species))[0];
    if (!best) break;
    result.push(best.id);
    seen.add(best.id);
  }
  return result;
}

export function estimateWildAnimalCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildFaunaSpeciesDefinition,
): number {
  const system = ensureWildFauna(state);
  const subareas = subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const totalArea = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.5, totalArea / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce((sum, subarea) => sum + getWildAnimalHabitatSuitability(subarea, species), 0) / subareas.length;
  const weightedFoodKg = subareas.reduce((sum, subarea) => sum + dietWeightedFood(getSubareaWildFoodPool(state, subarea.id), species), 0);
  const foodDays = weightedFoodKg / Math.max(0.03, species.dailyFoodKgPerAdult);
  const foodFactor = Math.max(0.3, Math.min(1.85, foodDays / Math.max(2, baseK * 4)));
  const water = subareas.reduce((sum, subarea) => sum + clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed)), 0) / subareas.length;
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 130);
  }, 0) / subareas.length;
  return Math.max(0, Math.round(baseK * (0.45 + habitat * 1.1) * (0.45 + water * 0.55) * foodFactor * Math.max(0.25, disturbance)));
}

function createPopulation(
  state: GameState,
  poiId: MainWorldAreaId,
  species: WildFaunaSpeciesDefinition,
  random: () => number,
): WildAnimalPopulation | undefined {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return undefined;
  const system = ensureWildFauna(state);
  const subareas = region.subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return undefined;

  const ranked = subareas
    .map(subarea => ({ subarea, score: subareaAnimalScore(state, subarea, species) + random() * 0.08 }))
    .sort((a, b) => b.score - a.score);
  const current = ranked[0]?.subarea;
  if (!current) return undefined;
  const desiredHomeRange = Math.min(
    subareas.length,
    species.homeRangeMin + Math.floor(random() * (species.homeRangeMax - species.homeRangeMin + 1)),
  );
  const homeRange = connectedHomeRange(state, current.id, desiredHomeRange, new Set(region.subareaIds), species);
  const carryingCapacity = estimateWildAnimalCarryingCapacity(state, homeRange, species);
  if (carryingCapacity <= 0) return undefined;

  const socialMinimum = species.socialMode === 'solitary' ? 1 : 2;
  const population = Math.max(socialMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.round(carryingCapacity * (0.3 + random() * 0.34))));
  const juvenileRatio = 0.18 + random() * 0.19;
  const oldRatio = 0.05 + random() * 0.1;
  const juveniles = Math.min(population, Math.round(population * juvenileRatio));
  const old = Math.min(population - juveniles, Math.round(population * oldRatio));
  const adults = Math.max(0, population - juveniles - old);
  const bodyCondition = clamp(66 + random() * 23);
  const averageWeight = species.adultWeightKg * ((adults + old * 0.82 + juveniles * 0.45) / Math.max(1, population));
  const id = `wildfauna_${hashString(`${region.generationSeed}:${species.id}`).toString(36)}`;
  const now = gameMinute(state);

  return {
    id,
    speciesId: species.id,
    poiId,
    currentSubareaId: current.id,
    homeRangeSubareaIds: homeRange,
    population,
    juveniles,
    adults,
    old,
    maleRatio: clamp01(0.45 + random() * 0.1),
    biomassKg: round3(population * averageWeight),
    averageHealth: clamp(72 + random() * 20),
    bodyCondition,
    foodStress: clamp(6 + random() * 16),
    waterStress: clamp(4 + random() * 12),
    reproductionPressure: 35,
    migrationPressure: 12,
    humanFear: clamp(Math.max(0, current.disturbance.humanPressure - species.disturbanceTolerance) * 0.8),
    geneticDiversity: clamp(58 + random() * 34),
    reproductionProgress: 0,
    maturationProgress: 0,
    agingProgress: 0,
    mortalityProgress: 0,
    movementProgress: random() * 0.65,
    lastMoveGameMinute: now,
    lastUpdatedGameMinute: now,
  };
}

export function ensureRegionWildFauna(state: GameState, poiId: string): WildAnimalPopulation[] {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return [];
  const system = ensureWildFauna(state);
  if (region.faunaSeeded) return system.animalPopulations!.filter(population => population.poiId === region.poiId);

  const subareas = region.subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  const created: WildAnimalPopulation[] = [];
  const candidates = Object.values(WILD_FAUNA_SPECIES)
    .map(species => {
      const affinity = species.regionAffinity[region.poiId] || 0;
      const bestSuitability = subareas.reduce((best, subarea) => Math.max(best, getWildAnimalHabitatSuitability(subarea, species)), 0);
      return { species, affinity, bestSuitability, score: affinity * 0.68 + bestSuitability * 0.32 };
    })
    .filter(entry => entry.affinity > 0.05 && entry.bestSuitability > 0.08)
    .sort((a, b) => b.score - a.score);

  for (const entry of candidates) {
    const random = mulberry32(hashString(`${region.generationSeed}:${entry.species.id}:fauna:v1`));
    const presenceProbability = Math.min(0.96, 0.12 + entry.affinity * 0.56 + entry.bestSuitability * 0.28);
    if (random() > presenceProbability) continue;
    const population = createPopulation(state, region.poiId, entry.species, random);
    if (population) created.push(population);
  }

  // A suitable region should never become biologically empty merely because every
  // deterministic presence roll missed. The best niche gets a small founder group.
  if (!created.length && candidates.length) {
    const entry = candidates[0];
    const random = mulberry32(hashString(`${region.generationSeed}:${entry.species.id}:fauna:fallback`));
    const population = createPopulation(state, region.poiId, entry.species, random);
    if (population) created.push(population);
  }

  system.animalPopulations!.push(...created);
  region.faunaSeeded = true;
  return created;
}

function consumePlantBiomass(
  populations: WildPlantPopulation[],
  amountKg: number,
  allowedForms: string[],
): number {
  const eligible = populations.filter(population => {
    const flora = WILD_FLORA_SPECIES[population.speciesId];
    return flora && allowedForms.includes(flora.form) && population.biomassKg > 0;
  });
  const available = eligible.reduce((sum, population) => sum + population.biomassKg, 0);
  const consumed = Math.min(amountKg, available);
  if (consumed <= 0 || available <= 0) return 0;
  for (const population of eligible) {
    const share = population.biomassKg / available;
    population.biomassKg = Math.max(0, population.biomassKg - consumed * share);
    population.regeneration = clamp(population.regeneration - consumed * share * 0.25);
  }
  return consumed;
}

function consumeWildFood(state: GameState, subarea: EcologicalSubarea, resource: WildFoodResource, amountKg: number): number {
  if (amountKg <= 0) return 0;
  const system = ensureWildFauna(state);
  const foodWeb = ensureFoodWeb(subarea);
  const populations = system.plantPopulations.filter(population => population.subareaId === subarea.id);
  const poolBefore = getSubareaWildFoodPool(state, subarea.id);
  const available = poolBefore[resource];
  const target = Math.min(amountKg, available);
  if (target <= 0) return 0;
  let consumed = target;

  if (resource === 'fruit' && subarea.materializationState === 'materialized') {
    const totalFruit = populations.reduce((sum, population) => sum + Math.max(0, population.fruitBiomassKg), 0);
    if (totalFruit > 0) {
      for (const population of populations) {
        if (population.fruitBiomassKg <= 0) continue;
        const share = population.fruitBiomassKg / totalFruit;
        population.fruitBiomassKg = Math.max(0, population.fruitBiomassKg - target * share);
      }
    }
  } else if (resource === 'seeds' && subarea.materializationState === 'materialized') {
    const seedResource = Math.max(0.001, poolBefore.seeds);
    const fraction = clamp01(target / seedResource);
    for (const population of populations) population.seedBank = clamp(population.seedBank * (1 - fraction * 0.78));
  } else if (resource === 'browse' && subarea.materializationState === 'materialized') {
    consumed = consumePlantBiomass(populations, target, ['tree', 'palm', 'clump', 'shrub']);
  } else if (resource === 'ground_vegetation' && subarea.materializationState === 'materialized') {
    consumed = consumePlantBiomass(populations, target, ['herb', 'fern', 'reed', 'guild']);
  } else if (resource === 'roots_tubers' && subarea.materializationState === 'materialized') {
    consumed = consumePlantBiomass(populations, target * 0.7, ['herb', 'clump']) + target * 0.3;
    consumed = Math.min(target, consumed);
  } else if (resource === 'insects') {
    consumed = Math.min(target, foodWeb.insectBiomassKg);
    foodWeb.insectBiomassKg = Math.max(0, foodWeb.insectBiomassKg - consumed);
  } else if (resource === 'aquatic_plants') {
    consumed = Math.min(target, foodWeb.aquaticPlantBiomassKg);
    foodWeb.aquaticPlantBiomassKg = Math.max(0, foodWeb.aquaticPlantBiomassKg - consumed);
  } else if (resource === 'carrion') {
    consumed = Math.min(target, foodWeb.carrionBiomassKg);
    foodWeb.carrionBiomassKg = Math.max(0, foodWeb.carrionBiomassKg - consumed);
  } else if (subarea.materializationState === 'latent') {
    const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
    if (resource === 'fruit') subarea.resources.fruitPotential = clamp(subarea.resources.fruitPotential - consumed / areaFactor * 2.8);
    else if (resource === 'roots_tubers' || resource === 'ground_vegetation') subarea.resources.ediblePlantPotential = clamp(subarea.resources.ediblePlantPotential - consumed / areaFactor * 2.1);
    else if (resource === 'browse') subarea.resources.timberPotential = clamp(subarea.resources.timberPotential - consumed / areaFactor * 0.35);
    else if (resource === 'seeds') subarea.ecology.plantDiversity = clamp(subarea.ecology.plantDiversity - consumed / areaFactor * 0.32);
  }

  if (['browse', 'ground_vegetation', 'roots_tubers'].includes(resource)) {
    const pressure = consumed / Math.max(8, subarea.areaM2 * 0.12) * 100;
    subarea.ecology.biomass = clamp(subarea.ecology.biomass - pressure * 0.42);
  }
  subarea.disturbance.foragingPressure = clamp(subarea.disturbance.foragingPressure + consumed / Math.max(0.1, subarea.areaM2 / 100) * 0.28);
  return round3(consumed);
}

function foragePopulation(
  state: GameState,
  subarea: EcologicalSubarea,
  population: WildAnimalPopulation | undefined,
  species: WildFaunaSpeciesDefinition,
  equivalentAdults: number,
  elapsedDays: number,
): number {
  const demand = species.dailyFoodKgPerAdult * equivalentAdults * elapsedDays;
  if (demand <= 0) return 1;
  const totalWeight = WILD_FOOD_RESOURCES.reduce((sum, resource) => sum + (species.diet[resource] || 0), 0);
  if (totalWeight <= 0) return 0;
  let consumed = 0;

  for (const resource of WILD_FOOD_RESOURCES) {
    const weight = species.diet[resource] || 0;
    if (weight <= 0) continue;
    consumed += consumeWildFood(state, subarea, resource, demand * weight / totalWeight);
  }

  let remaining = Math.max(0, demand - consumed);
  if (remaining > 0.001) {
    const remainingPool = getSubareaWildFoodPool(state, subarea.id);
    const options = WILD_FOOD_RESOURCES
      .filter(resource => (species.diet[resource] || 0) > 0 && remainingPool[resource] > 0)
      .sort((a, b) => (species.diet[b] || 0) * remainingPool[b] - (species.diet[a] || 0) * remainingPool[a]);
    for (const resource of options) {
      if (remaining <= 0.001) break;
      const taken = consumeWildFood(state, subarea, resource, remaining);
      consumed += taken;
      remaining -= taken;
    }
  }

  if (population) population.biomassKg = Math.max(0, population.biomassKg);
  return clamp01(consumed / demand);
}

function addCarrion(subarea: EcologicalSubarea, kilograms: number): void {
  if (kilograms <= 0) return;
  const foodWeb = ensureFoodWeb(subarea);
  foodWeb.carrionBiomassKg = round3(foodWeb.carrionBiomassKg + kilograms);
}

function recomputePopulationBiomass(population: WildAnimalPopulation, species: WildFaunaSpeciesDefinition): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(species.adultWeightKg * (
    population.adults + population.old * 0.82 + population.juveniles * 0.45
  ));
}

function movementScore(state: GameState, subarea: EcologicalSubarea, species: WildFaunaSpeciesDefinition): number {
  const base = subareaAnimalScore(state, subarea, species);
  return base - subarea.disturbance.humanPressure / 240 - subarea.ecology.predatorPressure / 400;
}

function movePopulationIfNeeded(
  state: GameState,
  population: WildAnimalPopulation,
  species: WildFaunaSpeciesDefinition,
  elapsedDays: number,
): void {
  const system = ensureWildFauna(state);
  population.movementProgress += elapsedDays * species.roamingPerDay * (0.45 + population.migrationPressure / 90 + population.humanFear / 180);
  if (population.movementProgress < 1) return;
  population.movementProgress %= 1;

  const current = system.subareasById[population.currentSubareaId];
  if (!current) return;
  const homeRange = new Set(population.homeRangeSubareaIds);
  const neighbors = regionNeighborIds(system, current.id)
    .filter(id => homeRange.has(id))
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!neighbors.length) return;

  const random = mulberry32(hashString(`${population.id}:${system.ecologyTickIndex}:${gameMinute(state)}:move`));
  const currentScore = movementScore(state, current, species);
  const ranked = neighbors
    .map(subarea => ({ subarea, score: movementScore(state, subarea, species) + random() * 0.055 }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return;
  const stressed = population.migrationPressure > 48 || population.humanFear > 52 || population.foodStress > 55 || population.waterStress > 55;
  if (best.score > currentScore + (stressed ? -0.01 : 0.045)) {
    population.currentSubareaId = best.subarea.id;
    population.lastMoveGameMinute = gameMinute(state);
    population.migrationPressure = clamp(population.migrationPressure - 18);
  }
}

function tickFoodWeb(subarea: EcologicalSubarea, elapsedDays: number): void {
  if (elapsedDays <= 0) return;
  const foodWeb = ensureFoodWeb(subarea);
  const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
  const insectCapacity = areaFactor * (0.8 + subarea.ecology.decompositionRate / 28 + subarea.ecology.biomass / 85);
  const aquaticCapacity = areaFactor * (subarea.environment.waterAccess / 100) * (0.8 + subarea.environment.moisture / 85);
  foodWeb.insectBiomassKg = round3(Math.min(insectCapacity, foodWeb.insectBiomassKg + Math.max(0, insectCapacity - foodWeb.insectBiomassKg) * Math.min(0.36, elapsedDays * 0.16)));
  foodWeb.aquaticPlantBiomassKg = round3(Math.min(aquaticCapacity, foodWeb.aquaticPlantBiomassKg + Math.max(0, aquaticCapacity - foodWeb.aquaticPlantBiomassKg) * Math.min(0.3, elapsedDays * 0.1)));
  foodWeb.carrionBiomassKg = round3(Math.max(0, foodWeb.carrionBiomassKg * Math.pow(0.52, elapsedDays)));
}

function tickAnimalPopulation(
  state: GameState,
  population: WildAnimalPopulation,
  elapsedMinutes: number,
): void {
  const species = WILD_FAUNA_SPECIES[population.speciesId];
  const system = ensureWildFauna(state);
  const subarea = system.subareasById[population.currentSubareaId];
  if (!species || !subarea || population.population <= 0 || elapsedMinutes <= 0) return;
  const elapsedDays = elapsedMinutes / 1440;
  const equivalentAdults = population.adults + population.old * 0.85 + population.juveniles * 0.45;
  const intakeRatio = foragePopulation(state, subarea, population, species, equivalentAdults, elapsedDays);
  const waterRatio = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));

  population.foodStress = clamp(population.foodStress + (1 - intakeRatio) * elapsedDays * 58 - intakeRatio * elapsedDays * 20);
  population.waterStress = clamp(population.waterStress + (1 - waterRatio) * elapsedDays * 64 - waterRatio * elapsedDays * 22);
  population.bodyCondition = clamp(population.bodyCondition + (intakeRatio - 0.72) * elapsedDays * 10 - population.waterStress / 100 * elapsedDays * 3);
  population.averageHealth = clamp(population.averageHealth + (population.bodyCondition / 100 - 0.58) * elapsedDays * 3.2 - (population.foodStress + population.waterStress) / 200 * elapsedDays * 2.8);

  const humanExcess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
  population.humanFear = clamp(population.humanFear + humanExcess * elapsedDays * 0.25 - elapsedDays * 1.3);
  const carryingCapacity = Math.max(1, estimateWildAnimalCarryingCapacity(state, population.homeRangeSubareaIds, species));
  const density = population.population / carryingCapacity;
  const crowdingPressure = Math.max(0, density - 0.72);
  population.migrationPressure = clamp(
    population.migrationPressure
      + crowdingPressure * elapsedDays * 36
      + population.foodStress / 100 * elapsedDays * 22
      + population.waterStress / 100 * elapsedDays * 18
      + humanExcess / 100 * elapsedDays * 28
      - elapsedDays * 5,
  );

  const matureAnimals = population.adults + population.old;
  const mateFactor = matureAnimals < 2 ? matureAnimals / 2 : Math.min(1, matureAnimals / 4);
  const densityBreeding = Math.max(0, 1 - Math.pow(Math.max(0, density - 0.28) / 0.92, 1.7));
  const conditionFactor = clamp01((population.bodyCondition - 35) / 55) * clamp01((population.averageHealth - 38) / 50);
  const stressFactor = clamp01(1 - (population.foodStress + population.waterStress) / 155);
  population.reproductionPressure = clamp(mateFactor * densityBreeding * conditionFactor * stressFactor * 100);
  const adultFemales = population.adults * (1 - population.maleRatio);
  population.reproductionProgress += adultFemales * species.offspringPerAdultFemalePerYear / 365 * elapsedDays * population.reproductionPressure / 100;
  let births = Math.floor(population.reproductionProgress);
  if (births > 0) {
    population.reproductionProgress -= births;
    births = Math.min(births, Math.max(0, Math.ceil(carryingCapacity * 1.18 - population.population)));
    population.juveniles += births;
  }

  population.maturationProgress += population.juveniles / Math.max(45, species.maturityDays) * elapsedDays;
  const matured = Math.min(population.juveniles, Math.floor(population.maturationProgress));
  if (matured > 0) {
    population.maturationProgress -= matured;
    population.juveniles -= matured;
    population.adults += matured;
  }

  population.agingProgress += population.adults / Math.max(365, species.maxAgeDays * 0.55) * elapsedDays;
  const aged = Math.min(population.adults, Math.floor(population.agingProgress));
  if (aged > 0) {
    population.agingProgress -= aged;
    population.adults -= aged;
    population.old += aged;
  }

  const stressMortality = Math.max(0, population.foodStress + population.waterStress - 125) / 100 * population.population * 0.004;
  const oldMortality = population.old / Math.max(90, species.maxAgeDays * 0.28);
  const healthMortality = Math.max(0, 32 - population.averageHealth) / 100 * population.population * 0.006;
  population.mortalityProgress += (stressMortality + oldMortality + healthMortality) * elapsedDays;
  let deaths = Math.min(population.population, Math.floor(population.mortalityProgress));
  if (deaths > 0) {
    population.mortalityProgress -= deaths;
    let remaining = deaths;
    const oldDeaths = Math.min(population.old, remaining);
    population.old -= oldDeaths;
    remaining -= oldDeaths;
    const juvenileDeaths = Math.min(population.juveniles, remaining);
    population.juveniles -= juvenileDeaths;
    remaining -= juvenileDeaths;
    population.adults = Math.max(0, population.adults - remaining);
    addCarrion(subarea, deaths * species.adultWeightKg * 0.34);
  }

  recomputePopulationBiomass(population, species);
  movePopulationIfNeeded(state, population, species, elapsedDays);
  population.lastUpdatedGameMinute = gameMinute(state);
}

function tickSignificantAnimal(state: GameState, animal: SignificantWildAnimal, elapsedMinutes: number): boolean {
  const species = WILD_FAUNA_SPECIES[animal.speciesId];
  const system = ensureWildFauna(state);
  const subarea = system.subareasById[animal.currentSubareaId];
  if (!species || !subarea || elapsedMinutes <= 0) return true;
  const elapsedDays = elapsedMinutes / 1440;
  const stageFactor = animal.lifeStage === 'juvenile' ? 0.5 : animal.lifeStage === 'old' ? 0.85 : 1;
  const intake = foragePopulation(state, subarea, undefined, species, stageFactor, elapsedDays);
  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));
  animal.hunger = clamp(animal.hunger + (1 - intake) * elapsedDays * 62 - intake * elapsedDays * 24);
  animal.thirst = clamp(animal.thirst + (1 - water) * elapsedDays * 68 - water * elapsedDays * 28);
  animal.bodyCondition = clamp(animal.bodyCondition + (intake - 0.7) * elapsedDays * 9 - animal.thirst / 100 * elapsedDays * 2.5);
  animal.health = clamp(animal.health + (animal.bodyCondition / 100 - 0.55) * elapsedDays * 2.5 - (animal.hunger + animal.thirst) / 200 * elapsedDays * 2.5);
  animal.stress = clamp(animal.stress + Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) * elapsedDays * 0.22 - elapsedDays * 1.2);
  animal.humanFear = clamp(animal.humanFear + Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) * elapsedDays * 0.18 - elapsedDays * 0.8);
  animal.ageHours += elapsedMinutes / 60;
  animal.lastUpdatedGameMinute = gameMinute(state);

  const maxAgeHours = species.maxAgeDays * 24;
  if (animal.ageHours > maxAgeHours || animal.health <= 0.1) {
    addCarrion(subarea, animal.weightKg * 0.48);
    return false;
  }

  const moveChance = elapsedDays * species.roamingPerDay * (0.25 + animal.stress / 85 + animal.hunger / 120);
  const random = mulberry32(hashString(`${animal.id}:${system.ecologyTickIndex}:${gameMinute(state)}:individual-move`));
  if (random() < Math.min(0.8, moveChance)) {
    const homeRange = new Set(animal.homeRangeSubareaIds);
    const candidates = regionNeighborIds(system, animal.currentSubareaId)
      .filter(id => homeRange.has(id))
      .map(id => system.subareasById[id])
      .filter((entry): entry is EcologicalSubarea => Boolean(entry))
      .sort((a, b) => movementScore(state, b, species) - movementScore(state, a, species));
    const best = candidates[0];
    if (best && movementScore(state, best, species) > movementScore(state, subarea, species) - 0.03) {
      animal.currentSubareaId = best.id;
      animal.lastMoveGameMinute = gameMinute(state);
    }
  }
  return true;
}

function refreshPreyDensity(system: WorldEcologyState, poiId: MainWorldAreaId): void {
  const populations = system.animalPopulations || [];
  const individuals = system.significantAnimals || [];
  const region = system.regionsByPoiId[poiId];
  if (!region) return;
  for (const subareaId of region.subareaIds) {
    const subarea = system.subareasById[subareaId];
    if (!subarea) continue;
    const populationCount = populations
      .filter(population => population.currentSubareaId === subareaId)
      .reduce((sum, population) => sum + population.population, 0);
    const individualCount = individuals.filter(animal => animal.currentSubareaId === subareaId).length;
    const densityPer1000 = (populationCount + individualCount) / Math.max(0.1, subarea.areaM2 / 1000);
    const observedPressure = clamp(densityPer1000 * 2.2);
    subarea.ecology.preyDensity = clamp(subarea.ecology.preyDensity * 0.68 + observedPressure * 0.32);
  }
}

export function tickWildFauna(state: GameState, _deltaGameMinutes: number): void {
  const system = ensureWildFauna(state);
  const now = gameMinute(state);

  for (const region of Object.values(system.regionsByPoiId)) {
    if (!region) continue;
    const hasMaterializedHabitat = region.subareaIds.some(id => system.subareasById[id]?.materializationState === 'materialized');
    if (!hasMaterializedHabitat) continue;
    if (!region.faunaSeeded) ensureRegionWildFauna(state, region.poiId);

    for (const subareaId of region.subareaIds) {
      const subarea = system.subareasById[subareaId];
      if (!subarea) continue;
      const lastFoodTick = Math.max(region.lastEcologyTickGameMinute, 0);
      const elapsedFoodMinutes = Math.max(0, now - lastFoodTick);
      if (elapsedFoodMinutes > 0) tickFoodWeb(subarea, elapsedFoodMinutes / 1440);
    }

    for (const population of system.animalPopulations!.filter(entry => entry.poiId === region.poiId)) {
      const elapsed = Math.max(0, now - population.lastUpdatedGameMinute);
      if (elapsed > 0) tickAnimalPopulation(state, population, elapsed);
    }

    const surviving: SignificantWildAnimal[] = [];
    for (const animal of system.significantAnimals!.filter(entry => entry.poiId === region.poiId)) {
      const elapsed = Math.max(0, now - animal.lastUpdatedGameMinute);
      if (elapsed <= 0 || tickSignificantAnimal(state, animal, elapsed)) surviving.push(animal);
    }
    const otherRegions = system.significantAnimals!.filter(entry => entry.poiId !== region.poiId);
    system.significantAnimals = [...otherRegions, ...surviving];
    refreshPreyDensity(system, region.poiId);
  }
}

export function promoteWildAnimalIndividual(
  state: GameState,
  populationId: string,
  preferredStage?: WildAnimalLifeStage,
): SignificantWildAnimal | undefined {
  const system = ensureWildFauna(state);
  const population = system.animalPopulations!.find(entry => entry.id === populationId);
  if (!population || population.population <= 0) return undefined;
  const species = WILD_FAUNA_SPECIES[population.speciesId];
  if (!species) return undefined;

  let stage: WildAnimalLifeStage = preferredStage || (population.adults > 0 ? 'adult' : population.juveniles > 0 ? 'juvenile' : 'old');
  if (stage === 'adult' && population.adults <= 0) stage = population.juveniles > 0 ? 'juvenile' : 'old';
  if (stage === 'juvenile' && population.juveniles <= 0) stage = population.adults > 0 ? 'adult' : 'old';
  if (stage === 'old' && population.old <= 0) stage = population.adults > 0 ? 'adult' : 'juvenile';

  if (stage === 'adult') population.adults--;
  else if (stage === 'juvenile') population.juveniles--;
  else population.old--;
  recomputePopulationBiomass(population, species);

  const now = gameMinute(state);
  const serial = system.significantAnimals!.filter(animal => animal.sourcePopulationId === population.id).length;
  const random = mulberry32(hashString(`${population.id}:${now}:${serial}:promote`));
  const stageWeight = stage === 'juvenile' ? 0.45 + random() * 0.25 : stage === 'old' ? 0.72 + random() * 0.2 : 0.82 + random() * 0.34;
  const maturityHours = species.maturityDays * 24;
  const maxAgeHours = species.maxAgeDays * 24;
  const ageHours = stage === 'juvenile'
    ? maturityHours * (0.15 + random() * 0.8)
    : stage === 'adult'
      ? maturityHours + (maxAgeHours * 0.72 - maturityHours) * random()
      : maxAgeHours * (0.72 + random() * 0.24);

  const animal: SignificantWildAnimal = {
    id: `wildanimal_${hashString(`${population.id}:${now}:${serial}`).toString(36)}`,
    speciesId: population.speciesId,
    poiId: population.poiId,
    currentSubareaId: population.currentSubareaId,
    homeRangeSubareaIds: [...population.homeRangeSubareaIds],
    sourcePopulationId: population.id,
    lifeStage: stage,
    sex: random() < population.maleRatio ? 'male' : 'female',
    ageHours: Math.round(ageHours),
    weightKg: round3(species.adultWeightKg * stageWeight),
    health: clamp(population.averageHealth - 5 + random() * 10),
    bodyCondition: clamp(population.bodyCondition - 4 + random() * 8),
    hunger: clamp(population.foodStress * 0.55 + random() * 8),
    thirst: clamp(population.waterStress * 0.5 + random() * 8),
    stress: clamp(population.humanFear * 0.35 + random() * 10),
    humanFear: clamp(population.humanFear - 6 + random() * 12),
    genetics: {
      vigor: clamp(42 + random() * 52),
      sizePotential: clamp(40 + random() * 54),
      diseaseResistance: clamp(38 + random() * 56),
    },
    lastMoveGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  system.significantAnimals!.push(animal);
  return animal;
}

export function getRegionWildAnimalPopulations(state: GameState, poiId: string): WildAnimalPopulation[] {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return [];
  const system = ensureWildFauna(state);
  return system.animalPopulations!.filter(population => population.poiId === region.poiId);
}

export function getSubareaWildAnimalPopulations(state: GameState, subareaId: string): WildAnimalPopulation[] {
  const system = ensureWildFauna(state);
  return system.animalPopulations!.filter(population => population.currentSubareaId === subareaId);
}

export function getWildFaunaFingerprint(state: GameState, poiId: string): string {
  const populations = ensureRegionWildFauna(state, poiId);
  return populations
    .slice()
    .sort((a, b) => a.speciesId.localeCompare(b.speciesId))
    .map(population => `${population.speciesId}:${population.population}:${population.currentSubareaId}:${population.homeRangeSubareaIds.join(',')}`)
    .join('|');
}
