import type { GameState } from '../types';
import type {
  EcologicalSubarea,
  SignificantWildPredator,
  WildAnimalLifeStage,
  WildAnimalPopulation,
  WildPredatorPopulation,
  WorldEcologyState,
} from '../types/ecologySimulation';
import type { MainWorldAreaId } from '../data/mainWorldAreas';
import { WILD_FAUNA_SPECIES } from '../data/ecologyFauna';
import { WILD_PREDATOR_SPECIES, type WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import { ensureRegionEcology, ensureWorldEcology } from './ecologySystem';
import { ensureRegionWildFauna, ensureWildFauna } from './ecologyFaunaSystem';
import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport } from './predatorResourceAccess';
import { initialPopulationFraction, resolveReproductionProfile } from './ecologyDemographySystem';

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

function equivalentPredatorCount(population: WildPredatorPopulation): number {
  return population.adults + population.old * 0.82 + population.juveniles * 0.38;
}

/**
 * P3.8: reserve horizon is a metabolic/body-size property, not a hidden copy of
 * hunt cadence. Larger intermittent feeders can bank more food-days from a big
 * meal, while smaller active predators carry a shorter buffer. Hunt timing is
 * decided separately from secured food-days in the discrete hunting system.
 */
export function getPredatorEnergyReserveDays(species: WildPredatorSpeciesDefinition): number {
  const metabolicMassDays = species.adultWeightKg / Math.max(0.05, species.dailyFoodKgPerAdult);
  return round3(Math.max(3, Math.min(24, Math.sqrt(metabolicMassDays) * 1.15)));
}

function predatorEnergyCapacityKg(population: WildPredatorPopulation, species: WildPredatorSpeciesDefinition): number {
  const dailyDemandKg = species.dailyFoodKgPerAdult * equivalentPredatorCount(population);
  return round3(Math.max(0, dailyDemandKg * getPredatorEnergyReserveDays(species)));
}

/**
 * Backward-compatible save migration plus age-structure rescaling. Existing
 * saves have no reserve fields; they receive a conservative reserve inferred
 * from current hunger instead of being treated as instantly empty. If population
 * size changes later, reserve percentage is preserved rather than creating or
 * deleting per-capita satiation.
 */
export function ensurePredatorEnergyState(
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  initialFraction?: number,
): void {
  const nextCapacity = predatorEnergyCapacityKg(population, species);
  const oldCapacity = Number.isFinite(population.maxEnergyReserveKg) ? Math.max(0, population.maxEnergyReserveKg || 0) : undefined;
  const existingReserve = Number.isFinite(population.energyReserveKg) ? Math.max(0, population.energyReserveKg || 0) : undefined;

  let reserve: number;
  if (existingReserve === undefined) {
    const legacyFraction = initialFraction ?? Math.min(0.8, Math.max(0.15, 0.15 + (1 - clamp01(population.hungerStress / 100)) * 0.65));
    reserve = nextCapacity * clamp01(legacyFraction);
  } else if (oldCapacity !== undefined && oldCapacity > 0 && Math.abs(oldCapacity - nextCapacity) > 0.0005) {
    reserve = nextCapacity * clamp01(existingReserve / oldCapacity);
  } else {
    reserve = existingReserve;
  }

  population.maxEnergyReserveKg = round3(nextCapacity);
  population.energyReserveKg = round3(Math.min(nextCapacity, Math.max(0, reserve)));
  if (!Number.isFinite(population.lastEnergyIntakeKg)) population.lastEnergyIntakeKg = 0;
  if (!Number.isFinite(population.lastEnergyDemandKg)) population.lastEnergyDemandKg = 0;
}

/**
 * Converts stored edible mass plus the latest kill into metabolic coverage for a
 * time slice. Surplus from a large discrete kill is banked up to the species'
 * reserve horizon; only uncovered demand contributes to hunger stress later.
 */
export function applyPredatorEnergyAccounting(
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  elapsedDays: number,
  huntedEdibleKg: number,
): number {
  ensurePredatorEnergyState(population, species);
  const demandKg = Math.max(0, species.dailyFoodKgPerAdult * equivalentPredatorCount(population) * Math.max(0, elapsedDays));
  const reserveBefore = Math.max(0, population.energyReserveKg || 0);
  const availableKg = reserveBefore + Math.max(0, huntedEdibleKg);
  const coveredKg = Math.min(demandKg, availableKg);
  const capacityKg = Math.max(0, population.maxEnergyReserveKg || 0);
  population.energyReserveKg = round3(Math.min(capacityKg, Math.max(0, availableKg - coveredKg)));
  population.lastEnergyIntakeKg = round3(Math.max(0, huntedEdibleKg));
  population.lastEnergyDemandKg = round3(demandKg);
  return demandKg <= 0 ? 1 : clamp01(coveredKg / demandKg);
}

export function ensureWildPredators(state: GameState): WorldEcologyState {
  const system = ensureWildFauna(state);
  system.version = Math.max(4, system.version || 1);
  system.predatorPopulations ||= [];
  system.significantPredators ||= [];
  for (const population of system.predatorPopulations) {
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    if (species) ensurePredatorEnergyState(population, species);
  }
  for (const region of Object.values(system.regionsByPoiId)) {
    if (region && region.predatorsSeeded === undefined) region.predatorsSeeded = false;
  }
  return system;
}

function targetValue(subarea: EcologicalSubarea, key: string): number | undefined {
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

export function getPredatorHabitatSuitability(subarea: EcologicalSubarea, species: WildPredatorSpeciesDefinition): number {
  const entries = Object.entries(species.targets);
  if (!entries.length) return 0.5;
  let total = 0;
  let used = 0;
  for (const [key, target] of entries) {
    if (typeof target !== 'number') continue;
    const value = targetValue(subarea, key);
    if (value === undefined) continue;
    const tolerance = key === 'slope' ? Math.max(8, species.tolerance * 0.6) : Math.max(12, species.tolerance);
    total += Math.max(0, 1 - Math.abs(value - target) / tolerance);
    used++;
  }
  if (!used) return 0.5;
  const humanExcess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
  return clamp01(total / used * (1 - humanExcess / 135));
}

function neighborIds(system: WorldEcologyState, subareaId: string): string[] {
  const result: string[] = [];
  for (const connection of system.connections) {
    if (connection.fromSubareaId === subareaId) result.push(connection.toSubareaId);
    else if (connection.toSubareaId === subareaId) result.push(connection.fromSubareaId);
  }
  return result;
}

/**
 * Short hunting excursions may use any connected patch inside the predator's
 * established home range. Access falls with the actual ecology connection
 * movementCost (distance + terrain barriers) and rises with the species' existing
 * roaming rate. This does not teleport the population: currentSubareaId remains
 * the resting/movement location handled by movePredator().
 */
export function getPredatorHuntingAccessibility(
  system: WorldEcologyState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  targetSubareaId: string,
): number {
  if (targetSubareaId === population.currentSubareaId) return 1;
  const allowed = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  allowed.add(population.currentSubareaId);
  if (!allowed.has(targetSubareaId)) return 0;

  const distances = new Map<string, number>([[population.currentSubareaId, 0]]);
  const unresolved = new Set(allowed);
  while (unresolved.size) {
    let currentId: string | undefined;
    let currentCost = Number.POSITIVE_INFINITY;
    for (const id of unresolved) {
      const cost = distances.get(id) ?? Number.POSITIVE_INFINITY;
      if (cost < currentCost) {
        currentId = id;
        currentCost = cost;
      }
    }
    if (!currentId || !Number.isFinite(currentCost)) break;
    unresolved.delete(currentId);
    if (currentId === targetSubareaId) break;

    for (const connection of system.connections) {
      let neighborId: string | undefined;
      if (connection.fromSubareaId === currentId) neighborId = connection.toSubareaId;
      else if (connection.toSubareaId === currentId) neighborId = connection.fromSubareaId;
      if (!neighborId || !allowed.has(neighborId) || !unresolved.has(neighborId)) continue;
      const candidate = currentCost + Math.max(1, connection.movementCost);
      if (candidate < (distances.get(neighborId) ?? Number.POSITIVE_INFINITY)) distances.set(neighborId, candidate);
    }
  }

  const pathCost = distances.get(targetSubareaId);
  if (!Number.isFinite(pathCost)) return 0;
  const travelBudget = Math.max(40, 70 + species.roamingPerDay * 220);
  return round3(clamp01(1 / (1 + (pathCost || 0) / travelBudget)));
}

function preyPopulationsAt(system: WorldEcologyState, subareaId: string): WildAnimalPopulation[] {
  return (system.animalPopulations || []).filter(population => population.currentSubareaId === subareaId && population.population > 0);
}

function preyBiomassForPredator(
  system: WorldEcologyState,
  subareaId: string,
  species: WildPredatorSpeciesDefinition,
): number {
  return preyPopulationsAt(system, subareaId).reduce((sum, prey) => {
    const weight = species.preyWeights[prey.speciesId] || 0;
    return sum + prey.biomassKg * weight;
  }, 0);
}

function preyCountForPredator(
  system: WorldEcologyState,
  subareaId: string,
  species: WildPredatorSpeciesDefinition,
): number {
  return preyPopulationsAt(system, subareaId).reduce((sum, prey) => {
    const weight = species.preyWeights[prey.speciesId] || 0;
    return sum + prey.population * weight;
  }, 0);
}

function predatorScore(
  system: WorldEcologyState,
  subarea: EcologicalSubarea,
  species: WildPredatorSpeciesDefinition,
): number {
  const habitat = getPredatorHabitatSuitability(subarea, species);
  const foodSupport = getPredatorFoodSupport(system, [subarea.id], species, subarea.poiId);
  const preyScore = clamp01(foodSupport.effectiveFoodBiomassKg / Math.max(1.5, species.dailyFoodKgPerAdult * 12));
  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));
  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 125;
  return habitat * 0.48 + preyScore * 0.36 + water * 0.16 - humanPenalty;
}

function connectedHomeRange(
  state: GameState,
  startId: string,
  desiredCount: number,
  allowedIds: Set<string>,
  species: WildPredatorSpeciesDefinition,
): string[] {
  const system = ensureWildPredators(state);
  const result = [startId];
  const seen = new Set(result);
  while (result.length < desiredCount) {
    const candidates = new Set<string>();
    for (const id of result) {
      for (const neighbor of neighborIds(system, id)) if (allowedIds.has(neighbor) && !seen.has(neighbor)) candidates.add(neighbor);
    }
    if (!candidates.size) break;
    const best = [...candidates]
      .map(id => system.subareasById[id])
      .filter((entry): entry is EcologicalSubarea => Boolean(entry))
      .sort((a, b) => predatorScore(system, b, species) - predatorScore(system, a, species))[0];
    if (!best) break;
    result.push(best.id);
    seen.add(best.id);
  }
  return result;
}

export function typeIIIPredationResponse(preyDensityPer1000M2: number, halfSaturation: number): number {
  const density = Math.max(0, preyDensityPer1000M2);
  const half = Math.max(0.001, halfSaturation);
  const densitySquared = density * density;
  return clamp01(densitySquared / (densitySquared + half * half));
}

export function predatorCompetitionMultiplier(
  predatorBiomassKg: number,
  preferredPreyBiomassKg: number,
  idealRatio: number,
): number {
  const preyBiomass = Math.max(0.001, preferredPreyBiomassKg);
  const ratio = Math.max(0, predatorBiomassKg) / preyBiomass;
  const ideal = Math.max(0.001, idealRatio);
  if (ratio <= ideal) return 1;
  const overload = ratio / ideal - 1;
  return Math.max(0.14, 1 / (1 + overload * 0.82));
}

export function preyRefugiaMultiplier(
  preyCount: number,
  minimumViableCount: number,
  subareaCover: number,
): number {
  const minimum = Math.max(1, minimumViableCount);
  const countFactor = preyCount >= minimum
    ? 1
    : Math.pow(clamp01(preyCount / minimum), 2.2);
  const cover = clamp01(subareaCover / 100);
  const concealment = 1 - cover * (1 - countFactor) * 0.72;
  return clamp01(countFactor * 0.76 + concealment * 0.24);
}

function estimatePredatorCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const subareas = subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const areaM2 = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.25, areaM2 / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce((sum, subarea) => sum + getPredatorHabitatSuitability(subarea, species), 0) / subareas.length;
  const foodSupport = getPredatorFoodSupport(system, subareaIds, species, subareas[0].poiId);
  const preySupport = foodSupport.supportedAdultEquivalents;
  const water = getPredatorAccessibleWaterRatio(state, system, subareaIds, species, subareas[0].poiId);
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 125);
  }, 0) / subareas.length;
  return Math.max(0, Math.floor(Math.min(baseK * (0.45 + habitat * 0.95) * (0.5 + water * 0.5), preySupport * 0.75) * Math.max(0.2, disturbance)));
}

function createPredatorPopulation(
  state: GameState,
  poiId: MainWorldAreaId,
  species: WildPredatorSpeciesDefinition,
  random: () => number,
): WildPredatorPopulation | undefined {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return undefined;
  const system = ensureWildPredators(state);
  const subareas = region.subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  const ranked = subareas
    .map(subarea => ({ subarea, score: predatorScore(system, subarea, species) + random() * 0.07 }))
    .sort((a, b) => b.score - a.score);
  const current = ranked[0]?.subarea;
  if (!current || getPredatorFoodSupport(system, [current.id], species, poiId).effectiveFoodBiomassKg <= 0.15) return undefined;

  const desiredHomeRange = Math.min(
    subareas.length,
    species.homeRangeMin + Math.floor(random() * (species.homeRangeMax - species.homeRangeMin + 1)),
  );
  const homeRange = connectedHomeRange(state, current.id, desiredHomeRange, new Set(region.subareaIds), species);
  const carryingCapacity = estimatePredatorCarryingCapacity(state, homeRange, species);
  if (carryingCapacity <= 0) return undefined;
  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
  const demographicMinimum = carryingCapacity >= 2 && species.maxInitialPopulation >= 2 ? 2 : 1;
  const population = Math.max(demographicMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * initialPopulationFraction(reproduction, random)))));
  const juvenileRatio = 0.12 + random() * 0.16;
  const oldRatio = 0.04 + random() * 0.08;
  const juveniles = Math.min(population, Math.round(population * juvenileRatio));
  const old = Math.min(population - juveniles, Math.round(population * oldRatio));
  const adults = Math.max(0, population - juveniles - old);
  const bodyCondition = clamp(68 + random() * 22);
  const now = gameMinute(state);
  const created: WildPredatorPopulation = {
    id: `wildpred_${hashString(`${region.generationSeed}:${species.id}`).toString(36)}`,
    speciesId: species.id,
    poiId,
    currentSubareaId: current.id,
    homeRangeSubareaIds: homeRange,
    population,
    juveniles,
    adults,
    old,
    maleRatio: clamp01(0.45 + random() * 0.1),
    biomassKg: round3(species.adultWeightKg * (adults + old * 0.82 + juveniles * 0.45)),
    averageHealth: clamp(74 + random() * 18),
    bodyCondition,
    hungerStress: clamp(8 + random() * 14),
    waterStress: clamp(4 + random() * 10),
    reproductionPressure: 28,
    migrationPressure: 10,
    humanFear: clamp(Math.max(0, current.disturbance.humanPressure - species.disturbanceTolerance) * 0.8),
    geneticDiversity: clamp(54 + random() * 36),
    reproductionProgress: 0,
    maturationProgress: 0,
    agingProgress: 0,
    mortalityProgress: 0,
    movementProgress: random() * 0.55,
    predationProgressByPreySpecies: {},
    lastMoveGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  ensurePredatorEnergyState(created, species, 0.5 + random() * 0.2);
  return created;
}

export function ensureRegionWildPredators(state: GameState, poiId: string): WildPredatorPopulation[] {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return [];
  const system = ensureWildPredators(state);
  if (region.predatorsSeeded) return system.predatorPopulations!.filter(population => population.poiId === region.poiId);

  // Predators are seeded only after real prey populations exist in this landscape.
  ensureRegionWildFauna(state, region.poiId);
  const subareas = region.subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  const created: WildPredatorPopulation[] = [];
  const candidates = Object.values(WILD_PREDATOR_SPECIES)
    .map(species => {
      const affinity = species.regionAffinity[region.poiId] || 0;
      const bestHabitat = subareas.reduce((best, subarea) => Math.max(best, getPredatorHabitatSuitability(subarea, species)), 0);
      const preySupport = getPredatorFoodSupport(system, region.subareaIds, species, region.poiId).effectiveFoodBiomassKg;
      return { species, affinity, bestHabitat, preySupport, score: affinity * 0.5 + bestHabitat * 0.25 + clamp01(preySupport / 18) * 0.25 };
    })
    .filter(entry => entry.affinity > 0.05 && entry.bestHabitat > 0.08 && entry.preySupport > 0.18)
    .sort((a, b) => b.score - a.score);

  for (const entry of candidates) {
    const random = mulberry32(hashString(`${region.generationSeed}:${entry.species.id}:predator:v1`));
    const presence = Math.min(0.88, 0.08 + entry.affinity * 0.42 + entry.bestHabitat * 0.2 + clamp01(entry.preySupport / 25) * 0.18);
    if (random() > presence) continue;
    const population = createPredatorPopulation(state, region.poiId, entry.species, random);
    if (population) created.push(population);
  }

  // A predator guild is not forced into every region. Predator-free landscapes are
  // valid procedural outcomes when the deterministic seed or prey support is weak.
  system.predatorPopulations!.push(...created);
  region.predatorsSeeded = true;
  return created;
}

function removePrey(
  prey: WildAnimalPopulation,
  killsRequested: number,
  predator: WildPredatorSpeciesDefinition,
): { kills: number; edibleKg: number; carrionKg: number } {
  const preySpecies = WILD_FAUNA_SPECIES[prey.speciesId];
  if (!preySpecies || killsRequested <= 0 || prey.population <= 0) return { kills: 0, edibleKg: 0, carrionKg: 0 };
  let requested = Math.min(killsRequested, prey.population);
  let kills = 0;
  let edibleKg = 0;
  let carrionKg = 0;

  const canKillAdult = preySpecies.adultWeightKg <= predator.maxAdultPreyKg;
  const stages: Array<'juveniles' | 'adults' | 'old'> = predator.juvenilePreference >= 0.5
    ? ['juveniles', 'old', 'adults']
    : ['adults', 'juveniles', 'old'];

  for (const stage of stages) {
    if (requested <= 0) break;
    if ((stage === 'adults' || stage === 'old') && !canKillAdult) continue;
    const available = prey[stage];
    if (available <= 0) continue;
    const taken = Math.min(available, requested);
    prey[stage] -= taken;
    requested -= taken;
    kills += taken;
    const stageWeight = stage === 'juveniles' ? 0.42 : stage === 'old' ? 0.82 : 1;
    const bodyKg = preySpecies.adultWeightKg * stageWeight * taken;
    edibleKg += bodyKg * 0.58;
    carrionKg += bodyKg * 0.22;
  }

  prey.population = Math.max(0, prey.juveniles + prey.adults + prey.old);
  prey.biomassKg = round3(preySpecies.adultWeightKg * (prey.adults + prey.old * 0.82 + prey.juveniles * 0.45));
  return { kills, edibleKg: round3(edibleKg), carrionKg: round3(carrionKg) };
}

function preyChoiceScore(
  prey: WildAnimalPopulation,
  subarea: EcologicalSubarea,
  predator: WildPredatorSpeciesDefinition,
): number {
  const preference = predator.preyWeights[prey.speciesId] || 0;
  if (preference <= 0 || prey.population <= 0) return 0;
  const densityPer1000 = prey.population / Math.max(0.1, subarea.areaM2 / 1000);
  const functional = typeIIIPredationResponse(densityPer1000, predator.halfSaturationPreyPer1000M2);
  const refugia = preyRefugiaMultiplier(prey.population, predator.minimumViablePreyCount, subarea.environment.canopyCover);
  return preference * functional * refugia * (0.35 + prey.bodyCondition / 150);
}

function hunt(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  _currentSubarea: EcologicalSubarea,
  elapsedDays: number,
): { edibleKg: number; kills: number } {
  const system = ensureWildPredators(state);
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  const prey = (system.animalPopulations || [])
    .filter(entry => entry.population > 0 && homeRange.has(entry.currentSubareaId) && (species.preyWeights[entry.speciesId] || 0) > 0)
    .map(target => {
      const targetSubarea = system.subareasById[target.currentSubareaId];
      const accessibility = targetSubarea
        ? getPredatorHuntingAccessibility(system, population, species, target.currentSubareaId)
        : 0;
      return {
        target,
        targetSubarea,
        accessibility,
        score: targetSubarea ? preyChoiceScore(target, targetSubarea, species) * accessibility : 0,
      };
    })
    .filter(entry => Boolean(entry.targetSubarea) && entry.accessibility > 0)
    .sort((a, b) => b.score - a.score);

  const equivalentPredators = equivalentPredatorCount(population);
  const foodDemand = species.dailyFoodKgPerAdult * equivalentPredators * elapsedDays;
  if (foodDemand <= 0 || !prey.length) return { edibleKg: 0, kills: 0 };

  const accessiblePreferredBiomass = prey.reduce((sum, entry) => {
    const preference = species.preyWeights[entry.target.speciesId] || 0;
    return sum + entry.target.biomassKg * preference * entry.accessibility;
  }, 0);
  const competition = predatorCompetitionMultiplier(population.biomassKg, accessiblePreferredBiomass, species.idealPredatorPreyBiomassRatio);
  let edibleKg = 0;
  let kills = 0;

  // Diet switching now spans the established home range. Remote prey is discounted
  // by travel accessibility, so carrying-capacity prey is not magically equivalent
  // to prey in the current patch. Predator location itself is left unchanged.
  for (const entry of prey) {
    if (edibleKg >= foodDemand * 1.05) break;
    const target = entry.target;
    const targetSubarea = entry.targetSubarea!;
    const preference = species.preyWeights[target.speciesId] || 0;
    const densityPer1000 = target.population / Math.max(0.1, targetSubarea.areaM2 / 1000);
    const functional = typeIIIPredationResponse(densityPer1000, species.halfSaturationPreyPer1000M2);
    const refugia = preyRefugiaMultiplier(target.population, species.minimumViablePreyCount, targetSubarea.environment.canopyCover);
    const maxKills = equivalentPredators * species.maxKillsPerAdultPerDay * elapsedDays * preference * functional * competition * refugia * entry.accessibility;
    const accumulated = (population.predationProgressByPreySpecies[target.speciesId] || 0) + maxKills;
    let wholeKills = Math.floor(accumulated);
    population.predationProgressByPreySpecies[target.speciesId] = accumulated - wholeKills;

    // Background ecology cannot mechanically wipe the final local refugium. This
    // guard affects only natural predation; player hunting remains free to cause extinction.
    if (target.population <= species.minimumViablePreyCount) {
      wholeKills = Math.min(wholeKills, Math.max(0, target.population - 1));
    }
    if (wholeKills <= 0) continue;

    const result = removePrey(target, wholeKills, species);
    kills += result.kills;
    edibleKg += result.edibleKg;
    if (targetSubarea.foodWeb) {
      targetSubarea.foodWeb.carrionBiomassKg = round3(targetSubarea.foodWeb.carrionBiomassKg + result.carrionKg);
    }
  }

  return { edibleKg: round3(edibleKg), kills };
}

function recomputePredatorBiomass(population: WildPredatorPopulation, species: WildPredatorSpeciesDefinition): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45));
}

function movementScore(system: WorldEcologyState, subarea: EcologicalSubarea, species: WildPredatorSpeciesDefinition): number {
  return predatorScore(system, subarea, species) - subarea.disturbance.humanPressure / 220;
}

function movePredator(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  elapsedDays: number,
): void {
  const system = ensureWildPredators(state);
  population.movementProgress += elapsedDays * species.roamingPerDay * (0.42 + population.migrationPressure / 80 + population.hungerStress / 130 + population.humanFear / 180);
  if (population.movementProgress < 1) return;
  population.movementProgress %= 1;
  const current = system.subareasById[population.currentSubareaId];
  if (!current) return;
  const range = new Set(population.homeRangeSubareaIds);
  const neighbors = neighborIds(system, current.id)
    .filter(id => range.has(id))
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!neighbors.length) return;
  const currentScore = movementScore(system, current, species);
  const random = mulberry32(hashString(`${population.id}:${system.ecologyTickIndex}:${gameMinute(state)}:pred-move`));
  const best = neighbors
    .map(subarea => ({ subarea, score: movementScore(system, subarea, species) + random() * 0.045 }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best) return;
  const stressed = population.migrationPressure > 45 || population.hungerStress > 50 || population.humanFear > 50;
  if (best.score > currentScore + (stressed ? -0.015 : 0.04)) {
    population.currentSubareaId = best.subarea.id;
    population.lastMoveGameMinute = gameMinute(state);
    population.migrationPressure = clamp(population.migrationPressure - 16);
  }
}

function tickPredatorPopulation(state: GameState, population: WildPredatorPopulation, elapsedMinutes: number): void {
  const species = WILD_PREDATOR_SPECIES[population.speciesId];
  const system = ensureWildPredators(state);
  const subarea = system.subareasById[population.currentSubareaId];
  if (!species || !subarea || population.population <= 0 || elapsedMinutes <= 0) return;
  const elapsedDays = elapsedMinutes / 1440;
  const huntResult = hunt(state, population, species, subarea, elapsedDays);
  const energyCoverage = applyPredatorEnergyAccounting(population, species, elapsedDays, huntResult.edibleKg);
  const waterRangeIds = [...new Set([...population.homeRangeSubareaIds, population.currentSubareaId])];
  const waterRatio = getPredatorAccessibleWaterRatio(
    state, system, waterRangeIds, species, population.poiId, population.currentSubareaId,
  );

  // Hunger is an acute stress signal, not a second copy of the energy ledger.
  // Partial coverage still raises pressure, but it does so gradually enough for
  // intermittent feeders to use their bounded reserve instead of oscillating to
  // critical hunger after a few imperfect hunting days.
  population.hungerStress = clamp(population.hungerStress + (1 - energyCoverage) * elapsedDays * 16 - energyCoverage * elapsedDays * 30);
  population.waterStress = clamp(population.waterStress + (1 - waterRatio) * elapsedDays * 54 - waterRatio * elapsedDays * 20);
  population.bodyCondition = clamp(population.bodyCondition + (energyCoverage - 0.62) * elapsedDays * 4.2 - population.waterStress / 100 * elapsedDays * 2.2);
  population.averageHealth = clamp(population.averageHealth + (population.bodyCondition / 100 - 0.58) * elapsedDays * 3 - (population.hungerStress + population.waterStress) / 200 * elapsedDays * 2.6);

  const humanExcess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
  population.humanFear = clamp(population.humanFear + humanExcess * elapsedDays * 0.24 - elapsedDays * 1.1);
  const carryingCapacity = Math.max(1, estimatePredatorCarryingCapacity(state, population.homeRangeSubareaIds, species));
  const density = population.population / carryingCapacity;
  population.migrationPressure = clamp(
    population.migrationPressure
      + Math.max(0, density - 0.8) * elapsedDays * 32
      + population.hungerStress / 100 * elapsedDays * 28
      + population.waterStress / 100 * elapsedDays * 15
      + humanExcess / 100 * elapsedDays * 24
      - elapsedDays * 4,
  );

  const mature = population.adults + population.old;
  const mateFactor = mature < 2 ? mature / 2 : Math.min(1, mature / 3);
  const densityFactor = Math.max(0, 1 - Math.pow(Math.max(0, density - 0.25) / 0.95, 1.8));
  const condition = clamp01((population.bodyCondition - 42) / 50) * clamp01((population.averageHealth - 42) / 48);
  const foodFactor = clamp01(1 - population.hungerStress / 90);
  population.reproductionPressure = clamp(mateFactor * densityFactor * condition * foodFactor * 100);
  const adultFemales = population.adults * (1 - population.maleRatio);
  population.reproductionProgress += adultFemales * species.offspringPerAdultFemalePerYear / 365 * elapsedDays * population.reproductionPressure / 100;
  let births = Math.floor(population.reproductionProgress);
  if (births > 0) {
    population.reproductionProgress -= births;
    births = Math.min(births, Math.max(0, Math.ceil(carryingCapacity * 1.08 - population.population)));
    population.juveniles += births;
  }

  population.maturationProgress += population.juveniles / Math.max(90, species.maturityDays) * elapsedDays;
  const matured = Math.min(population.juveniles, Math.floor(population.maturationProgress));
  if (matured > 0) {
    population.maturationProgress -= matured;
    population.juveniles -= matured;
    population.adults += matured;
  }

  population.agingProgress += population.adults / Math.max(730, species.maxAgeDays * 0.6) * elapsedDays;
  const aged = Math.min(population.adults, Math.floor(population.agingProgress));
  if (aged > 0) {
    population.agingProgress -= aged;
    population.adults -= aged;
    population.old += aged;
  }

  const starvation = Math.max(0, population.hungerStress - 72) / 100 * population.population * 0.006;
  const dehydration = Math.max(0, population.waterStress - 78) / 100 * population.population * 0.005;
  const oldMortality = population.old / Math.max(180, species.maxAgeDays * 0.32);
  const healthMortality = Math.max(0, 30 - population.averageHealth) / 100 * population.population * 0.005;
  population.mortalityProgress += (starvation + dehydration + oldMortality + healthMortality) * elapsedDays;
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
    if (subarea.foodWeb) subarea.foodWeb.carrionBiomassKg = round3(subarea.foodWeb.carrionBiomassKg + deaths * species.adultWeightKg * 0.32);
  }

  recomputePredatorBiomass(population, species);
  ensurePredatorEnergyState(population, species);
  movePredator(state, population, species, elapsedDays);
  population.lastUpdatedGameMinute = gameMinute(state);
}

function refreshPredatorPressure(system: WorldEcologyState, poiId: MainWorldAreaId): void {
  const region = system.regionsByPoiId[poiId];
  if (!region) return;
  for (const subareaId of region.subareaIds) {
    const subarea = system.subareasById[subareaId];
    if (!subarea) continue;
    const biomass = (system.predatorPopulations || [])
      .filter(population => population.currentSubareaId === subareaId)
      .reduce((sum, population) => sum + population.biomassKg, 0)
      + (system.significantPredators || [])
        .filter(predator => predator.currentSubareaId === subareaId)
        .reduce((sum, predator) => sum + predator.weightKg, 0);
    const pressure = clamp(biomass / Math.max(0.2, subarea.areaM2 / 1000) * 0.9);
    subarea.ecology.predatorPressure = clamp(subarea.ecology.predatorPressure * 0.6 + pressure * 0.4);
  }
}

export function tickWildPredators(state: GameState, _deltaGameMinutes: number): void {
  const system = ensureWildPredators(state);
  const now = gameMinute(state);
  for (const region of Object.values(system.regionsByPoiId)) {
    if (!region) continue;
    const observed = region.subareaIds.some(id => system.subareasById[id]?.materializationState === 'materialized');
    if (!observed) continue;
    ensureRegionWildFauna(state, region.poiId);
    if (!region.predatorsSeeded) ensureRegionWildPredators(state, region.poiId);
    for (const population of system.predatorPopulations!.filter(entry => entry.poiId === region.poiId)) {
      const elapsed = Math.max(0, now - population.lastUpdatedGameMinute);
      if (elapsed > 0) tickPredatorPopulation(state, population, elapsed);
    }
    refreshPredatorPressure(system, region.poiId);
  }
}

export function promoteWildPredatorIndividual(
  state: GameState,
  populationId: string,
  preferredStage?: WildAnimalLifeStage,
): SignificantWildPredator | undefined {
  const system = ensureWildPredators(state);
  const population = system.predatorPopulations!.find(entry => entry.id === populationId);
  if (!population || population.population <= 0) return undefined;
  const species = WILD_PREDATOR_SPECIES[population.speciesId];
  if (!species) return undefined;

  let stage: WildAnimalLifeStage = preferredStage || (population.adults > 0 ? 'adult' : population.juveniles > 0 ? 'juvenile' : 'old');
  if (stage === 'adult' && population.adults <= 0) stage = population.juveniles > 0 ? 'juvenile' : 'old';
  if (stage === 'juvenile' && population.juveniles <= 0) stage = population.adults > 0 ? 'adult' : 'old';
  if (stage === 'old' && population.old <= 0) stage = population.adults > 0 ? 'adult' : 'juvenile';
  if (stage === 'adult') population.adults--;
  else if (stage === 'juvenile') population.juveniles--;
  else population.old--;
  recomputePredatorBiomass(population, species);
  ensurePredatorEnergyState(population, species);

  const now = gameMinute(state);
  const serial = system.significantPredators!.filter(entry => entry.sourcePopulationId === population.id).length;
  const random = mulberry32(hashString(`${population.id}:${now}:${serial}:promote`));
  const maturityHours = species.maturityDays * 24;
  const maxAgeHours = species.maxAgeDays * 24;
  const ageHours = stage === 'juvenile'
    ? maturityHours * (0.15 + random() * 0.8)
    : stage === 'adult'
      ? maturityHours + (maxAgeHours * 0.72 - maturityHours) * random()
      : maxAgeHours * (0.72 + random() * 0.24);
  const stageWeight = stage === 'juvenile' ? 0.42 + random() * 0.28 : stage === 'old' ? 0.74 + random() * 0.18 : 0.84 + random() * 0.3;
  const predator: SignificantWildPredator = {
    id: `wildpredator_${hashString(`${population.id}:${now}:${serial}`).toString(36)}`,
    speciesId: population.speciesId,
    poiId: population.poiId,
    currentSubareaId: population.currentSubareaId,
    homeRangeSubareaIds: [...population.homeRangeSubareaIds],
    sourcePopulationId: population.id,
    lifeStage: stage,
    sex: random() < population.maleRatio ? 'male' : 'female',
    ageHours: Math.round(ageHours),
    weightKg: round3(species.adultWeightKg * stageWeight),
    health: clamp(population.averageHealth - 4 + random() * 8),
    bodyCondition: clamp(population.bodyCondition - 4 + random() * 8),
    hunger: clamp(population.hungerStress * 0.55 + random() * 7),
    thirst: clamp(population.waterStress * 0.5 + random() * 7),
    stress: clamp(population.humanFear * 0.35 + random() * 8),
    humanFear: clamp(population.humanFear - 5 + random() * 10),
    genetics: {
      vigor: clamp(42 + random() * 52),
      sizePotential: clamp(40 + random() * 54),
      huntingEfficiency: clamp(38 + random() * 56),
    },
    lastMoveGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  system.significantPredators!.push(predator);
  return predator;
}

export function getRegionWildPredatorPopulations(state: GameState, poiId: string): WildPredatorPopulation[] {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return [];
  const system = ensureWildPredators(state);
  return system.predatorPopulations!.filter(population => population.poiId === region.poiId);
}

export function getPredatorGenerationFingerprint(state: GameState, poiId: string): string {
  const populations = ensureRegionWildPredators(state, poiId);
  return populations
    .slice()
    .sort((a, b) => a.speciesId.localeCompare(b.speciesId))
    .map(population => `${population.speciesId}:${population.population}:${population.currentSubareaId}:${population.homeRangeSubareaIds.join(',')}`)
    .join('|');
}