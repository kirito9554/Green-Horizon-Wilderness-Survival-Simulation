import type { GameState } from '../types';
import type {
  EcologicalSubarea,
  PredatorHuntPreyTelemetry,
  PredatorHuntTelemetry,
  WildAnimalLifeStage,
  WildAnimalPopulation,
  WildCarcass,
  WildFoodResource,
  WildPredatorPopulation,
  WorldEcologyState,
} from '../types/ecologySimulation';
import type { MainWorldAreaId } from '../data/mainWorldAreas';
import type { WildAquaticPopulation } from '../types/aquaticEcology';
import { WILD_FAUNA_SPECIES } from '../data/ecologyFauna';
import { WILD_AQUATIC_SPECIES } from '../data/ecologyAquatic';
import { WILD_PREDATOR_SPECIES, type WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import { ensureRegionWildFauna } from './ecologyFaunaSystem';
import {
  applyPredatorEnergyAccounting,
  ensurePredatorEnergyState,
  ensureRegionWildPredators,
  ensureWildPredators,
  getPredatorEnergyReserveDays,
  getPredatorHabitatSuitability,
  getPredatorHuntingAccessibility,
  predatorCompetitionMultiplier,
  preyRefugiaMultiplier,
  typeIIIPredationResponse,
} from './ecologyPredatorSystem';
import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport, predatorPoiAccess } from './predatorResourceAccess';

const MIN_CARCASS_FRESHNESS_TO_FEED = 15;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value * 1000) / 1000));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
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

function ensureHuntTelemetry(population: WildPredatorPopulation): PredatorHuntTelemetry {
  population.huntAttemptProgress = Number.isFinite(population.huntAttemptProgress)
    ? Math.max(0, population.huntAttemptProgress || 0)
    : 0;
  population.aquaticHuntAttemptProgress = Number.isFinite(population.aquaticHuntAttemptProgress)
    ? Math.max(0, population.aquaticHuntAttemptProgress || 0)
    : 0;
  population.huntTelemetry ||= {
    attempts: 0,
    encounters: 0,
    attacks: 0,
    successfulKills: 0,
    successfulKillsByLifeStage: {},
    edibleConsumedKg: 0,
    supplementalConsumedKg: 0,
    supplementalByResource: {},
    carcassBiomassCreatedKg: 0,
    byPreySpecies: {},
  };
  population.huntTelemetry.successfulKillsByLifeStage ||= {};
  population.huntTelemetry.supplementalConsumedKg = Math.max(0, population.huntTelemetry.supplementalConsumedKg || 0);
  population.huntTelemetry.supplementalByResource ||= {};
  population.huntTelemetry.byPreySpecies ||= {};
  return population.huntTelemetry;
}

function ensurePreyTelemetry(telemetry: PredatorHuntTelemetry, speciesId: string): PredatorHuntPreyTelemetry {
  return telemetry.byPreySpecies[speciesId] ||= { encounters: 0, attacks: 0, successfulKills: 0 };
}

function stageMassMultiplier(stage: WildAnimalLifeStage): number {
  if (stage === 'juvenile') return 0.42;
  if (stage === 'old') return 0.82;
  return 1;
}

function preyBiomassForPredator(
  system: WorldEcologyState,
  subareaId: string,
  species: WildPredatorSpeciesDefinition,
): number {
  return (system.animalPopulations || [])
    .filter(prey => prey.currentSubareaId === subareaId && prey.population > 0)
    .reduce((sum, prey) => sum + prey.biomassKg * (species.preyWeights[prey.speciesId] || 0), 0);
}

function estimatePredatorCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const subareas = subareaIds
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
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

function neighborIds(system: WorldEcologyState, subareaId: string): string[] {
  const result: string[] = [];
  for (const connection of system.connections) {
    if (connection.fromSubareaId === subareaId) result.push(connection.toSubareaId);
    else if (connection.toSubareaId === subareaId) result.push(connection.fromSubareaId);
  }
  return result;
}

function movementScore(system: WorldEcologyState, subarea: EcologicalSubarea, species: WildPredatorSpeciesDefinition): number {
  const habitat = getPredatorHabitatSuitability(subarea, species);
  const foodSupport = getPredatorFoodSupport(system, [subarea.id], species, subarea.poiId);
  const preyScore = clamp01(foodSupport.effectiveFoodBiomassKg / Math.max(1.5, species.dailyFoodKgPerAdult * 12));
  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));
  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 125;
  return habitat * 0.48 + preyScore * 0.36 + water * 0.16 - humanPenalty - subarea.disturbance.humanPressure / 220;
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

function recomputePredatorBiomass(population: WildPredatorPopulation, species: WildPredatorSpeciesDefinition): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45));
}

function syncCarrionConsumption(system: WorldEcologyState, carcass: WildCarcass, consumedKg: number): void {
  if (consumedKg <= 0 || carcass.mirroredCarrionKg <= 0) return;
  const mirroredConsumed = Math.min(carcass.mirroredCarrionKg, consumedKg);
  if (carcass.waterNodeId) {
    const aquatic = system.aquaticFoodWebByNodeId?.[carcass.waterNodeId];
    if (!aquatic) return;
    aquatic.carrionKg = round3(Math.max(0, aquatic.carrionKg - mirroredConsumed));
  } else {
    const subarea = system.subareasById[carcass.subareaId];
    if (!subarea?.foodWeb) return;
    subarea.foodWeb.carrionBiomassKg = round3(Math.max(0, subarea.foodWeb.carrionBiomassKg - mirroredConsumed));
  }
  carcass.mirroredCarrionKg = round3(Math.max(0, carcass.mirroredCarrionKg - mirroredConsumed));
}

function consumeCarcass(system: WorldEcologyState, carcass: WildCarcass, requestedKg: number): number {
  const consumed = Math.min(Math.max(0, requestedKg), Math.max(0, carcass.remainingEdibleKg));
  if (consumed <= 0) return 0;
  carcass.remainingEdibleKg = round3(Math.max(0, carcass.remainingEdibleKg - consumed));
  carcass.remainingScavengeableKg = round3(Math.max(0, carcass.remainingScavengeableKg - consumed));
  carcass.remainingMassKg = round3(Math.max(0, carcass.remainingMassKg - consumed));
  syncCarrionConsumption(system, carcass, consumed);
  return round3(consumed);
}

function mirrorNewCarcass(system: WorldEcologyState, carcass: WildCarcass): void {
  const mirrored = Math.max(0, carcass.remainingScavengeableKg);
  if (carcass.waterNodeId) {
    const aquatic = system.aquaticFoodWebByNodeId?.[carcass.waterNodeId];
    if (!aquatic) return;
    aquatic.carrionKg = round3(aquatic.carrionKg + mirrored);
  } else {
    const subarea = system.subareasById[carcass.subareaId];
    if (!subarea?.foodWeb) return;
    subarea.foodWeb.carrionBiomassKg = round3(subarea.foodWeb.carrionBiomassKg + mirrored);
  }
  carcass.mirroredCarrionKg = round3(mirrored);
}

function createCarcass(
  state: GameState,
  predatorPopulation: WildPredatorPopulation,
  prey: WildAnimalPopulation,
  stage: WildAnimalLifeStage,
  bodyMassKg: number,
): WildCarcass {
  const system = ensureWildPredators(state);
  system.wildCarcasses ||= [];
  const now = gameMinute(state);
  const serial = system.wildCarcasses.length;
  const edibleMassKg = round3(bodyMassKg * 0.58);
  const scavengeableMassKg = round3(bodyMassKg * 0.8);
  const carcass: WildCarcass = {
    id: `carcass_${hashString(`${predatorPopulation.id}:${prey.id}:${stage}:${now}:${system.ecologyTickIndex}:${serial}`).toString(36)}`,
    poiId: prey.poiId,
    subareaId: prey.currentSubareaId,
    sourceSpeciesId: prey.speciesId,
    sourceLifeStage: stage,
    cause: 'predation',
    killerSpeciesId: predatorPopulation.speciesId,
    killerPopulationId: predatorPopulation.id,
    bodyMassKg: round3(bodyMassKg),
    edibleMassKg,
    scavengeableMassKg,
    remainingMassKg: round3(bodyMassKg),
    remainingEdibleKg: edibleMassKg,
    remainingScavengeableKg: scavengeableMassKg,
    mirroredCarrionKg: 0,
    freshness: 100,
    createdGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  system.wildCarcasses.push(carcass);
  return carcass;
}

function reduceMirroredCarrion(system: WorldEcologyState, carcass: WildCarcass, targetMirroredKg: number): void {
  const previousMirroredKg = Math.max(0, carcass.mirroredCarrionKg);
  const nextMirroredKg = Math.max(0, Math.min(previousMirroredKg, targetMirroredKg));
  const lostMirroredKg = Math.max(0, previousMirroredKg - nextMirroredKg);
  if (lostMirroredKg > 0 && carcass.waterNodeId) {
    const aquatic = system.aquaticFoodWebByNodeId?.[carcass.waterNodeId];
    if (aquatic) aquatic.carrionKg = round3(Math.max(0, aquatic.carrionKg - lostMirroredKg));
  } else if (lostMirroredKg > 0) {
    const subarea = system.subareasById[carcass.subareaId];
    if (subarea?.foodWeb) subarea.foodWeb.carrionBiomassKg = round3(Math.max(0, subarea.foodWeb.carrionBiomassKg - lostMirroredKg));
  }
  carcass.mirroredCarrionKg = round3(nextMirroredKg);
}

function tickWildCarcasses(state: GameState): void {
  const system = ensureWildPredators(state);
  system.wildCarcasses ||= [];
  const now = gameMinute(state);
  for (const carcass of system.wildCarcasses) {
    const elapsedDays = Math.max(0, now - carcass.lastUpdatedGameMinute) / 1440;
    carcass.lastUpdatedGameMinute = now;
    if (elapsedDays <= 0 || carcass.remainingMassKg <= 0) continue;
    const subarea = system.subareasById[carcass.subareaId];
    const decomposition = clamp01((subarea?.ecology.decompositionRate || 50) / 100);
    const decayFraction = clamp01(elapsedDays * (0.035 + decomposition * 0.16));
    const retained = Math.max(0, 1 - decayFraction);
    carcass.remainingMassKg = round3(carcass.remainingMassKg * retained);
    carcass.remainingEdibleKg = round3(carcass.remainingEdibleKg * retained);
    carcass.remainingScavengeableKg = round3(carcass.remainingScavengeableKg * retained);
    reduceMirroredCarrion(system, carcass, carcass.remainingScavengeableKg);
    carcass.freshness = clamp(carcass.freshness - elapsedDays * (5 + decomposition * 9));
  }
  system.wildCarcasses = system.wildCarcasses.filter(carcass => {
    const keep = carcass.remainingMassKg >= 0.05 && carcass.freshness > 0;
    if (!keep) reduceMirroredCarrion(system, carcass, 0);
    return keep;
  });
}

function riparianForagingAccess(
  system: WorldEcologyState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  subarea: EcologicalSubarea,
): number {
  const maxHops = Math.max(0, Math.floor(species.riparianForagingReachHops || 0));
  if (maxHops <= 0 || subarea.environment.waterAccess < 50) return 0;
  const poiAccess = predatorPoiAccess(population.poiId, subarea.poiId, maxHops);
  if (poiAccess <= 0) return 0;
  const shoreline = clamp01((subarea.environment.waterAccess - 50) / 50);
  const habitat = getPredatorHabitatSuitability(subarea, species);
  return clamp01(poiAccess * (0.5 + shoreline * 0.35 + habitat * 0.15));
}

function feedFromOwnedCarcasses(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  mealBudgetKg: number,
): number {
  const system = ensureWildPredators(state);
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  const carcasses = (system.wildCarcasses || [])
    .filter(carcass => carcass.killerPopulationId === population.id)
    .filter(carcass => carcass.remainingEdibleKg > 0 && carcass.freshness >= MIN_CARCASS_FRESHNESS_TO_FEED)
    .filter(carcass => {
      if (homeRange.has(carcass.subareaId)) return true;
      const subarea = system.subareasById[carcass.subareaId];
      return Boolean(subarea && riparianForagingAccess(system, population, species, subarea) > 0);
    })
    .sort((a, b) => {
      const aLocal = a.subareaId === population.currentSubareaId ? 1 : 0;
      const bLocal = b.subareaId === population.currentSubareaId ? 1 : 0;
      return bLocal - aLocal || b.freshness - a.freshness || b.createdGameMinute - a.createdGameMinute;
    });
  let consumed = 0;
  for (const carcass of carcasses) {
    if (consumed >= mealBudgetKg) break;
    consumed += consumeCarcass(system, carcass, mealBudgetKg - consumed);
  }
  return round3(consumed);
}

function ownedCarcassEdibleKg(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  return round3((system.wildCarcasses || [])
    .filter(carcass => carcass.killerPopulationId === population.id)
    .filter(carcass => carcass.remainingEdibleKg > 0 && carcass.freshness >= MIN_CARCASS_FRESHNESS_TO_FEED)
    .filter(carcass => {
      if (homeRange.has(carcass.subareaId)) return true;
      const subarea = system.subareasById[carcass.subareaId];
      return Boolean(subarea && riparianForagingAccess(system, population, species, subarea) > 0);
    })
    .reduce((sum, carcass) => {
      // Very stale meat is less reliable as future secured food even before it
      // reaches the hard feeding cutoff.
      const freshnessReliability = clamp01((carcass.freshness - MIN_CARCASS_FRESHNESS_TO_FEED) / 70);
      return sum + carcass.remainingEdibleKg * (0.55 + freshnessReliability * 0.45);
    }, 0));
}

function securedFoodCoverageDays(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  currentEdibleKg = 0,
  tickDemandKg = 0,
): number {
  const equivalentPredators = equivalentPredatorCount(population);
  const dailyDemandKg = Math.max(0.001, species.dailyFoodKgPerAdult * equivalentPredators);
  const storedReserveKg = Math.max(0, population.energyReserveKg || 0);
  const ownedCarcassKg = ownedCarcassEdibleKg(state, population, species);
  // Food already eaten for this tick only extends future rest once immediate
  // maintenance has been covered; otherwise it is current-day fuel, not reserve.
  const currentSurplusKg = Math.max(0, currentEdibleKg - Math.max(0, tickDemandKg));
  return Math.max(0, (storedReserveKg + ownedCarcassKg + currentSurplusKg) / dailyDemandKg);
}

function mealDrivenHuntReadiness(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  currentEdibleKg: number,
  tickDemandKg: number,
): number {
  const securedDays = securedFoodCoverageDays(state, population, species, currentEdibleKg, tickDemandKg);
  // Below ~0.1 secured days the cohort is effectively ready to hunt. Around one
  // full food-day the normal hunt drive is almost completely suppressed. This
  // makes a small prey item create only a short pause while a large carcass can
  // naturally produce multi-day rest through the remaining edible biomass.
  const normalReadiness = securedDays <= 0.1
    ? 1
    : clamp01((1.2 - securedDays) / 1.1);
  // Severe hunger can override part of the rest signal. This is important for
  // aggregate populations where one large carcass may not physically feed every
  // individual even though the cohort owns it.
  const hungerOverride = clamp01((population.hungerStress - 62) / 38) * 0.82;
  return Math.max(normalReadiness, hungerOverride);
}

function activeSearchAttemptsPerAdultDay(species: WildPredatorSpeciesDefinition): number {
  // Search capacity is activity/roaming driven rather than a desired kill quota.
  // Failure creates no cooldown, so an unsuccessful predator can keep searching;
  // successful prey size determines the pause through secured food-days instead.
  return Math.max(1.2, Math.min(3.4, 1.4 + species.roamingPerDay * 1.6));
}

function supplementalAvailableKg(
  state: GameState,
  population: WildPredatorPopulation,
  subarea: EcologicalSubarea,
  resource: WildFoodResource,
): number {
  const system = ensureWildPredators(state);
  if (resource === 'fruit') {
    if (subarea.materializationState === 'materialized') {
      return round3(system.plantPopulations
        .filter(plant => plant.subareaId === subarea.id)
        .reduce((sum, plant) => sum + Math.max(0, plant.fruitBiomassKg), 0));
    }
    const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
    return round3(Math.max(0, subarea.resources.fruitPotential * areaFactor * 0.035));
  }
  if (resource === 'insects') return round3(Math.max(0, subarea.foodWeb?.insectBiomassKg || 0));
  if (resource === 'carrion') {
    return round3((system.wildCarcasses || [])
      .filter(carcass => carcass.subareaId === subarea.id)
      .filter(carcass => carcass.killerPopulationId !== population.id)
      .filter(carcass => carcass.freshness >= 5 && carcass.remainingEdibleKg > 0)
      .reduce((sum, carcass) => sum + carcass.remainingEdibleKg, 0));
  }
  return 0;
}

function consumeSupplementalResource(
  state: GameState,
  population: WildPredatorPopulation,
  subarea: EcologicalSubarea,
  resource: WildFoodResource,
  requestedKg: number,
): number {
  if (requestedKg <= 0) return 0;
  const system = ensureWildPredators(state);
  if (resource === 'fruit') {
    if (subarea.materializationState === 'materialized') {
      const plants = system.plantPopulations.filter(plant => plant.subareaId === subarea.id && plant.fruitBiomassKg > 0);
      const available = plants.reduce((sum, plant) => sum + plant.fruitBiomassKg, 0);
      const consumed = Math.min(requestedKg, available);
      if (consumed <= 0 || available <= 0) return 0;
      for (const plant of plants) {
        const share = plant.fruitBiomassKg / available;
        plant.fruitBiomassKg = round3(Math.max(0, plant.fruitBiomassKg - consumed * share));
      }
      return round3(consumed);
    }
    const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
    const available = Math.max(0, subarea.resources.fruitPotential * areaFactor * 0.035);
    const consumed = Math.min(requestedKg, available);
    if (consumed > 0) subarea.resources.fruitPotential = clamp(subarea.resources.fruitPotential - consumed / areaFactor * 2.8);
    return round3(consumed);
  }
  if (resource === 'insects') {
    const available = Math.max(0, subarea.foodWeb?.insectBiomassKg || 0);
    const consumed = Math.min(requestedKg, available);
    if (consumed > 0 && subarea.foodWeb) subarea.foodWeb.insectBiomassKg = round3(Math.max(0, available - consumed));
    return round3(consumed);
  }
  if (resource === 'carrion') {
    const carcasses = (system.wildCarcasses || [])
      .filter(carcass => carcass.subareaId === subarea.id)
      .filter(carcass => carcass.killerPopulationId !== population.id)
      .filter(carcass => carcass.freshness >= 5 && carcass.remainingEdibleKg > 0)
      .sort((a, b) => b.freshness - a.freshness || b.createdGameMinute - a.createdGameMinute);
    let consumed = 0;
    for (const carcass of carcasses) {
      if (consumed >= requestedKg) break;
      consumed += consumeCarcass(system, carcass, requestedKg - consumed);
    }
    return round3(consumed);
  }
  return 0;
}

function forageSupplementalFood(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  budgetKg: number,
  telemetry: PredatorHuntTelemetry,
): number {
  const diet = species.supplementalDiet;
  if (!diet || budgetKg <= 0 || (species.maxSupplementalDietShare || 0) <= 0) return 0;
  const resources = (Object.entries(diet) as Array<[WildFoodResource, number]>)
    .filter(([, weight]) => weight > 0);
  const totalWeight = resources.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return 0;

  const system = ensureWildPredators(state);
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  const subareas = [...homeRange]
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry))
    .map(subarea => ({
      subarea,
      accessibility: subarea.id === population.currentSubareaId
        ? 1
        : getPredatorHuntingAccessibility(system, population, species, subarea.id),
    }))
    .filter(entry => entry.accessibility > 0)
    .sort((a, b) => {
      const aFood = resources.reduce((sum, [resource, weight]) => sum + supplementalAvailableKg(state, population, a.subarea, resource) * weight, 0);
      const bFood = resources.reduce((sum, [resource, weight]) => sum + supplementalAvailableKg(state, population, b.subarea, resource) * weight, 0);
      return bFood * b.accessibility - aFood * a.accessibility;
    });

  let consumed = 0;
  const consumeResourceBudget = (resource: WildFoodResource, resourceBudgetKg: number): number => {
    let resourceConsumed = 0;
    for (const entry of subareas) {
      if (resourceConsumed >= resourceBudgetKg) break;
      const accessibleBudget = (resourceBudgetKg - resourceConsumed) * clamp01(0.55 + entry.accessibility * 0.45);
      resourceConsumed += consumeSupplementalResource(state, population, entry.subarea, resource, accessibleBudget);
    }
    if (resourceConsumed > 0) {
      telemetry.supplementalByResource[resource] = round3((telemetry.supplementalByResource[resource] || 0) + resourceConsumed);
    }
    return round3(resourceConsumed);
  };

  for (const [resource, weight] of resources) {
    if (consumed >= budgetKg) break;
    consumed += consumeResourceBudget(resource, Math.min(budgetKg - consumed, budgetKg * weight / totalWeight));
  }

  let remaining = Math.max(0, budgetKg - consumed);
  if (remaining > 0.001) {
    const ranked = resources
      .map(([resource, weight]) => ({
        resource,
        score: weight * subareas.reduce((sum, entry) => sum + supplementalAvailableKg(state, population, entry.subarea, resource) * entry.accessibility, 0),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    for (const entry of ranked) {
      if (remaining <= 0.001) break;
      const taken = consumeResourceBudget(entry.resource, remaining);
      consumed += taken;
      remaining -= taken;
    }
  }

  telemetry.supplementalConsumedKg = round3(telemetry.supplementalConsumedKg + consumed);
  return round3(consumed);
}

interface HuntTarget {
  prey: WildAnimalPopulation;
  subarea: EcologicalSubarea;
  accessibility: number;
  preference: number;
  functionalResponse: number;
  refugia: number;
  searchability: number;
  targetWeight: number;
}

function weightedPick<T>(items: T[], weight: (item: T) => number, random: () => number): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (total <= 0) return undefined;
  let cursor = random() * total;
  for (const item of items) {
    cursor -= Math.max(0, weight(item));
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function eligibleStages(prey: WildAnimalPopulation, predator: WildPredatorSpeciesDefinition): Array<{ stage: WildAnimalLifeStage; count: number; bodyMassKg: number; weight: number }> {
  const preySpecies = WILD_FAUNA_SPECIES[prey.speciesId];
  if (!preySpecies) return [];
  const rows: Array<{ stage: WildAnimalLifeStage; count: number; bodyMassKg: number; weight: number }> = [
    {
      stage: 'juvenile',
      count: prey.juveniles,
      bodyMassKg: preySpecies.adultWeightKg * stageMassMultiplier('juvenile'),
      weight: prey.juveniles * (0.65 + predator.juvenilePreference * 0.9),
    },
    {
      stage: 'adult',
      count: prey.adults,
      bodyMassKg: preySpecies.adultWeightKg,
      weight: prey.adults * (0.9 - predator.juvenilePreference * 0.25),
    },
    {
      stage: 'old',
      count: prey.old,
      bodyMassKg: preySpecies.adultWeightKg * stageMassMultiplier('old'),
      weight: prey.old * 0.82,
    },
  ];
  return rows.filter(row => row.count > 0 && row.bodyMassKg <= predator.maxAdultPreyKg);
}

function mealTargetValue(expectedEdibleDays: number): number {
  // P3.5: predators should value a meal by how long it can actually feed them.
  // The previous sqrt curve compressed medium/large prey too aggressively, so
  // very abundant tiny prey could dominate target selection even when dozens
  // of kills were required to cover maintenance. Keep small prey as fallback,
  // but strongly prefer prey that provides roughly a day or more of food.
  const mealDays = Math.max(0.05, Math.min(10, expectedEdibleDays));
  const sizeValue = Math.pow(mealDays, 0.8);
  const smallMealPenalty = mealDays >= 0.75
    ? 1
    : 0.4 + 0.6 * (mealDays / 0.75);
  return Math.max(0.15, sizeValue * smallMealPenalty);
}

function energyAwareLifeStageWeight(
  row: { stage: WildAnimalLifeStage; bodyMassKg: number; weight: number },
  predator: WildPredatorSpeciesDefinition,
  needSeverity: number,
): number {
  // P3.5b: life-stage choice should react to energetic need without permanently
  // overriding species-specific juvenile preference. When food need is low the
  // historical stage weights dominate; when hunger/intake deficit is high, a
  // larger adult or old animal becomes worth the additional capture risk.
  const urgency = clamp01(needSeverity);
  const edibleDays = row.bodyMassKg * 0.58 / Math.max(0.05, predator.dailyFoodKgPerAdult);
  const mealValue = mealTargetValue(edibleDays);
  const energyBias = 0.35 + urgency * 0.55;
  const payoffMultiplier = Math.max(0.3, 1 + (mealValue - 1) * energyBias);
  const maturityShift = row.stage === 'juvenile'
    ? 1 - urgency * 0.18
    : row.stage === 'old'
      ? 1 + urgency * 0.16
      : 1 + urgency * 0.1;
  return Math.max(0, row.weight * payoffMultiplier * maturityShift);
}

function energeticTargetValue(prey: WildAnimalPopulation, predator: WildPredatorSpeciesDefinition): number {
  const stages = eligibleStages(prey, predator);
  const totalWeight = stages.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return 0;
  const expectedBodyMassKg = stages.reduce((sum, row) => sum + row.bodyMassKg * row.weight, 0) / totalWeight;
  const expectedEdibleDays = expectedBodyMassKg * 0.58 / Math.max(0.05, predator.dailyFoodKgPerAdult);
  return mealTargetValue(expectedEdibleDays);
}

function huntSearchability(
  prey: WildAnimalPopulation,
  subarea: EcologicalSubarea,
  predator: WildPredatorSpeciesDefinition,
  accessibility: number,
): { functionalResponse: number; refugia: number; searchability: number } {
  const densityPer1000 = prey.population / Math.max(0.1, subarea.areaM2 / 1000);
  const functionalResponse = typeIIIPredationResponse(densityPer1000, predator.halfSaturationPreyPer1000M2);
  const refugia = preyRefugiaMultiplier(prey.population, predator.minimumViablePreyCount, subarea.environment.canopyCover);
  const searchability = clamp01(
    Math.sqrt(functionalResponse)
      * accessibility
      * (0.72 + refugia * 0.28),
  );
  return { functionalResponse, refugia, searchability };
}

function adaptivePreyAvailability(
  populationDensity: number,
  biomassDensity: number,
  communityPopulationDensity: number,
  communityBiomassDensity: number,
  accessiblePopulation: number,
  minimumViablePreyCount: number,
): number {
  // P3.6: availability is relative to the prey community this predator can
  // actually reach. Head-count density lets abundant small prey rise in
  // value; biomass density preserves the benefit of medium/large prey.
  // Scarcity suppression makes depleted species progressively inefficient
  // to search for instead of hard-banning them from the diet.
  const populationShare = clamp01(populationDensity / Math.max(0.001, communityPopulationDensity));
  const biomassShare = clamp01(biomassDensity / Math.max(0.001, communityBiomassDensity));
  const densitySignal = Math.pow(populationShare, 0.55) * 0.64
    + Math.pow(biomassShare, 0.55) * 0.36;
  const recoveryPopulation = Math.max(12, minimumViablePreyCount * 6);
  const scarcityRecovery = clamp01(accessiblePopulation / recoveryPopulation);
  const scarcityMultiplier = 0.08 + scarcityRecovery * 0.92;
  return Math.max(0.001, densitySignal * scarcityMultiplier);
}

function collectHuntTargets(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): HuntTarget[] {
  const system = ensureWildPredators(state);
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  const rawTargets = (system.animalPopulations || [])
    .filter(prey => prey.population > 1)
    .map(prey => {
      const preference = species.preyWeights[prey.speciesId] || 0;
      const subarea = system.subareasById[prey.currentSubareaId];
      const localAccessibility = preference > 0 && subarea && homeRange.has(prey.currentSubareaId)
        ? getPredatorHuntingAccessibility(system, population, species, prey.currentSubareaId)
        : 0;
      const riparianAccessibility = preference > 0 && subarea && !homeRange.has(prey.currentSubareaId)
        ? riparianForagingAccess(system, population, species, subarea)
        : 0;
      const accessibility = Math.max(localAccessibility, riparianAccessibility);
      const energeticValue = preference > 0 ? energeticTargetValue(prey, species) : 0;
      const search = subarea && accessibility > 0
        ? huntSearchability(prey, subarea, species, accessibility)
        : { functionalResponse: 0, refugia: 0, searchability: 0 };
      const areaPer1000 = Math.max(0.1, (subarea?.areaM2 || 1000) / 1000);
      return {
        prey,
        subarea,
        accessibility,
        preference,
        energeticValue,
        functionalResponse: search.functionalResponse,
        refugia: search.refugia,
        searchability: search.searchability,
        accessiblePopulation: prey.population * accessibility,
        populationDensity: prey.population / areaPer1000 * accessibility,
        biomassDensity: prey.biomassKg / areaPer1000 * accessibility,
      };
    })
    .filter(entry => Boolean(entry.subarea && entry.preference > 0 && entry.accessibility > 0 && entry.energeticValue > 0));

  const speciesDensity = new Map<string, { population: number; populationDensity: number; biomassDensity: number }>();
  for (const entry of rawTargets) {
    const row = speciesDensity.get(entry.prey.speciesId) || { population: 0, populationDensity: 0, biomassDensity: 0 };
    row.population += entry.accessiblePopulation;
    row.populationDensity += entry.populationDensity;
    row.biomassDensity += entry.biomassDensity;
    speciesDensity.set(entry.prey.speciesId, row);
  }
  const communityPopulationDensity = [...speciesDensity.values()].reduce((sum, row) => sum + row.populationDensity, 0);
  const communityBiomassDensity = [...speciesDensity.values()].reduce((sum, row) => sum + row.biomassDensity, 0);

  return rawTargets
    .map(entry => {
      const density = speciesDensity.get(entry.prey.speciesId)!;
      const availability = adaptivePreyAvailability(
        density.populationDensity,
        density.biomassDensity,
        communityPopulationDensity,
        communityBiomassDensity,
        density.population,
        species.minimumViablePreyCount,
      );
      return {
        prey: entry.prey,
        subarea: entry.subarea,
        accessibility: entry.accessibility,
        preference: entry.preference,
        functionalResponse: entry.functionalResponse,
        refugia: entry.refugia,
        searchability: entry.searchability,
        targetWeight: entry.preference
          * entry.energeticValue
          * availability
          * (0.3 + entry.searchability * 0.7),
      };
    })
    .filter((entry): entry is HuntTarget => Boolean(entry.subarea && entry.targetWeight > 0));
}

function removeOnePrey(prey: WildAnimalPopulation, stage: WildAnimalLifeStage): number {
  const preySpecies = WILD_FAUNA_SPECIES[prey.speciesId];
  if (!preySpecies) return 0;
  if (stage === 'juvenile' && prey.juveniles > 0) prey.juveniles -= 1;
  else if (stage === 'adult' && prey.adults > 0) prey.adults -= 1;
  else if (stage === 'old' && prey.old > 0) prey.old -= 1;
  else return 0;
  prey.population = Math.max(0, prey.juveniles + prey.adults + prey.old);
  prey.biomassKg = round3(preySpecies.adultWeightKg * (prey.adults + prey.old * 0.82 + prey.juveniles * 0.45));
  return round3(preySpecies.adultWeightKg * stageMassMultiplier(stage));
}

interface AquaticHuntTarget {
  prey: WildAquaticPopulation;
  preference: number;
  searchability: number;
  refugia: number;
  targetWeight: number;
  waterNodeId: string;
}

function aquaticStageMassMultiplier(stage: WildAnimalLifeStage): number {
  if (stage === 'juvenile') return 0.28;
  if (stage === 'old') return 0.82;
  return 1;
}

function aquaticRecoveryFloor(speciesId: string): number {
  const preySpecies = WILD_AQUATIC_SPECIES[speciesId];
  if (!preySpecies) return 8;
  // P3.7: slow-maturing, slow-reproducing aquatic prey need a larger
  // aggregate breeding refuge than fast forage species. This is not extra
  // reproduction; it only makes predators progressively inefficient once a
  // prey population approaches its life-history recovery floor.
  const maturityPressure = clamp01((preySpecies.maturityDays - 90) / 600);
  const lowReproductionPressure = clamp01((0.0035 - preySpecies.dailyReproductionRate) / 0.0032);
  return Math.round(7 + (maturityPressure * 0.45 + lowReproductionPressure * 0.55) * 13);
}

function aquaticRecoveryRefugia(accessiblePopulation: number, speciesId: string): number {
  const floor = aquaticRecoveryFloor(speciesId);
  if (accessiblePopulation <= floor) return 0;
  const recoveryBand = Math.max(6, floor * 0.75);
  return clamp01((accessiblePopulation - floor) / recoveryBand);
}

function eligibleAquaticStages(
  prey: WildAquaticPopulation,
  predator: WildPredatorSpeciesDefinition,
): Array<{ stage: WildAnimalLifeStage; count: number; bodyMassKg: number; weight: number }> {
  const preySpecies = WILD_AQUATIC_SPECIES[prey.speciesId];
  if (!preySpecies) return [];
  const rows: Array<{ stage: WildAnimalLifeStage; count: number; bodyMassKg: number; weight: number }> = [
    { stage: 'juvenile', count: prey.juveniles, bodyMassKg: preySpecies.adultWeightKg * 0.28, weight: prey.juveniles * (0.7 + predator.juvenilePreference * 0.8) },
    { stage: 'adult', count: prey.adults, bodyMassKg: preySpecies.adultWeightKg, weight: prey.adults * (0.95 - predator.juvenilePreference * 0.2) },
    { stage: 'old', count: prey.old, bodyMassKg: preySpecies.adultWeightKg * 0.82, weight: prey.old * 0.86 },
  ];
  return rows.filter(row => row.count >= 1 && row.bodyMassKg <= predator.maxAdultPreyKg);
}

function collectAquaticHuntTargets(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): AquaticHuntTarget[] {
  const system = ensureWildPredators(state);
  const weights = species.aquaticPreyWeights || {};
  const current = system.subareasById[population.currentSubareaId];
  const waterAccess = clamp01(((current?.environment.waterAccess || 0) - 20) / 75);
  if (waterAccess <= 0 || !Object.keys(weights).length) return [];

  const rawTargets = (system.aquaticPopulations || [])
    .filter(prey => prey.population > 3 && (weights[prey.speciesId] || 0) > 0)
    .map(prey => {
      const preference = weights[prey.speciesId] || 0;
      const reachHops = Math.max(0, Math.floor(species.aquaticForagingReachHops || 0));
      const poiAccess = prey.poiIds.reduce((best, preyPoi) => Math.max(best, predatorPoiAccess(population.poiId, preyPoi, reachHops)), 0);
      const stages = poiAccess > 0 ? eligibleAquaticStages(prey, species) : [];
      const stageWeight = stages.reduce((sum, row) => sum + row.weight, 0);
      const expectedBodyMassKg = stageWeight > 0
        ? stages.reduce((sum, row) => sum + row.bodyMassKg * row.weight, 0) / stageWeight
        : 0;
      const energeticValue = expectedBodyMassKg > 0
        ? mealTargetValue(expectedBodyMassKg * 0.58 / Math.max(0.05, species.dailyFoodKgPerAdult))
        : 0;
      const abundance = clamp01(prey.population / (prey.population + 12));
      const condition = clamp01(prey.bodyCondition / 100 * 0.6 + prey.averageHealth / 100 * 0.4);
      const searchability = clamp01(Math.sqrt(abundance) * (0.55 + waterAccess * 0.45) * (0.78 + condition * 0.22) * poiAccess);
      const waterNodeId = prey.occupiedNodeIds.find(id => state.hydrologySystem?.nodesById?.[id]?.poiId === population.poiId)
        || prey.anchorNodeId;
      const occupiedNodes = Math.max(1, prey.occupiedNodeIds.length);
      return {
        prey,
        preference,
        searchability,
        waterNodeId,
        energeticValue,
        accessiblePopulation: prey.population * poiAccess,
        populationDensity: prey.population / occupiedNodes * poiAccess,
        biomassDensity: prey.biomassKg / occupiedNodes * poiAccess,
      };
    })
    .filter(entry => entry.preference > 0 && entry.energeticValue > 0 && entry.searchability > 0 && Boolean(state.hydrologySystem?.nodesById?.[entry.waterNodeId]));

  const speciesDensity = new Map<string, { population: number; populationDensity: number; biomassDensity: number }>();
  for (const entry of rawTargets) {
    const row = speciesDensity.get(entry.prey.speciesId) || { population: 0, populationDensity: 0, biomassDensity: 0 };
    row.population += entry.accessiblePopulation;
    row.populationDensity += entry.populationDensity;
    row.biomassDensity += entry.biomassDensity;
    speciesDensity.set(entry.prey.speciesId, row);
  }
  const communityPopulationDensity = [...speciesDensity.values()].reduce((sum, row) => sum + row.populationDensity, 0);
  const communityBiomassDensity = [...speciesDensity.values()].reduce((sum, row) => sum + row.biomassDensity, 0);

  return rawTargets.map(entry => {
    const density = speciesDensity.get(entry.prey.speciesId)!;
    const recoveryFloor = aquaticRecoveryFloor(entry.prey.speciesId);
    const refugia = aquaticRecoveryRefugia(density.population, entry.prey.speciesId);
    const availability = adaptivePreyAvailability(
      density.populationDensity,
      density.biomassDensity,
      communityPopulationDensity,
      communityBiomassDensity,
      density.population,
      recoveryFloor,
    );
    const protectedSearchability = entry.searchability * Math.sqrt(refugia);
    return {
      prey: entry.prey,
      preference: entry.preference,
      searchability: protectedSearchability,
      refugia,
      waterNodeId: entry.waterNodeId,
      targetWeight: entry.preference
        * entry.energeticValue
        * availability
        * refugia
        * (0.35 + protectedSearchability * 0.65),
    };
  }).filter(entry => entry.targetWeight > 0 && entry.refugia > 0);
}

function removeOneAquaticPrey(prey: WildAquaticPopulation, stage: WildAnimalLifeStage): number {
  const species = WILD_AQUATIC_SPECIES[prey.speciesId];
  if (!species) return 0;
  if (stage === 'juvenile' && prey.juveniles >= 1) prey.juveniles -= 1;
  else if (stage === 'adult' && prey.adults >= 1) prey.adults -= 1;
  else if (stage === 'old' && prey.old >= 1) prey.old -= 1;
  else return 0;
  prey.population = round3(Math.max(0, prey.juveniles + prey.adults + prey.old));
  prey.biomassKg = round3(species.adultWeightKg * (prey.juveniles * 0.28 + prey.adults + prey.old * 0.82));
  return round3(species.adultWeightKg * aquaticStageMassMultiplier(stage));
}

function createAquaticCarcass(
  state: GameState,
  predatorPopulation: WildPredatorPopulation,
  prey: WildAquaticPopulation,
  stage: WildAnimalLifeStage,
  bodyMassKg: number,
  waterNodeId: string,
): WildCarcass {
  const system = ensureWildPredators(state);
  system.wildCarcasses ||= [];
  const now = gameMinute(state);
  const edibleMassKg = round3(bodyMassKg * 0.58);
  const scavengeableMassKg = round3(bodyMassKg * 0.8);
  const carcass: WildCarcass = {
    id: `carcass_aq_${hashString(`${predatorPopulation.id}:${prey.id}:${stage}:${now}:${system.ecologyTickIndex}:${system.wildCarcasses.length}`).toString(36)}`,
    poiId: state.hydrologySystem?.nodesById?.[waterNodeId]?.poiId || predatorPopulation.poiId,
    subareaId: predatorPopulation.currentSubareaId,
    sourceSpeciesId: prey.speciesId,
    sourceLifeStage: stage,
    sourceRealm: 'aquatic',
    waterNodeId,
    cause: 'predation',
    killerSpeciesId: predatorPopulation.speciesId,
    killerPopulationId: predatorPopulation.id,
    bodyMassKg: round3(bodyMassKg),
    edibleMassKg,
    scavengeableMassKg,
    remainingMassKg: round3(bodyMassKg),
    remainingEdibleKg: edibleMassKg,
    remainingScavengeableKg: scavengeableMassKg,
    mirroredCarrionKg: 0,
    freshness: 100,
    createdGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  system.wildCarcasses.push(carcass);
  return carcass;
}

function runAquaticHunt(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  elapsedDays: number,
  tickDemandKg: number,
  currentEdibleKg: number,
  remainingMealBudgetKg: number,
  telemetry: PredatorHuntTelemetry,
): { edibleKg: number; kills: number } {
  const captureRate = Math.max(0, species.aquaticCaptureRatePerAdultDay || 0);
  const maxShare = clamp01(species.maxAquaticDietShare || 0);
  if (captureRate <= 0 || maxShare <= 0 || remainingMealBudgetKg <= 0) return { edibleKg: 0, kills: 0 };
  const system = ensureWildPredators(state);
  const current = system.subareasById[population.currentSubareaId];
  const waterAccess = clamp01(((current?.environment.waterAccess || 0) - 20) / 75);
  if (waterAccess <= 0) return { edibleKg: 0, kills: 0 };

  const equivalentPredators = equivalentPredatorCount(population);
  const needDrive = clamp01((tickDemandKg - currentEdibleKg) / Math.max(0.001, tickDemandKg));
  const hungerDrive = clamp01(population.hungerStress / 100);

  // Aquatic and terrestrial prey compete for the same feeding decision.
  // maxAquaticDietShare is a ceiling, not a fish-first quota. Using the best
  // currently reachable target in each realm lets a crocodile prefer a large
  // riparian boar when that meal is more valuable than another small fish.
  const aquaticTargets = collectAquaticHuntTargets(state, population, species);
  const terrestrialTargets = collectHuntTargets(state, population, species);
  const aquaticOpportunity = aquaticTargets.reduce((best, target) => Math.max(best, target.targetWeight), 0);
  const terrestrialOpportunity = terrestrialTargets.reduce((best, target) => Math.max(best, target.targetWeight), 0);
  const totalRealmOpportunity = aquaticOpportunity + terrestrialOpportunity;
  const preferredAquaticShare = totalRealmOpportunity > 0 ? aquaticOpportunity / totalRealmOpportunity : 0;
  const effectiveAquaticShare = Math.min(maxShare, preferredAquaticShare);
  const realmDrive = maxShare > 0 ? Math.sqrt(clamp01(effectiveAquaticShare / maxShare)) : 0;
  const cadenceReadiness = mealDrivenHuntReadiness(state, population, species, currentEdibleKg, tickDemandKg);
  const huntDrive = clamp01(needDrive * 0.82 + hungerDrive * 0.18) * waterAccess * realmDrive * cadenceReadiness;
  const aquaticBudgetKg = Math.min(remainingMealBudgetKg, tickDemandKg * effectiveAquaticShare);
  if (aquaticBudgetKg <= 0.001 || huntDrive <= 0 || aquaticTargets.length <= 0) return { edibleKg: 0, kills: 0 };

  population.aquaticHuntAttemptProgress = Math.max(0, population.aquaticHuntAttemptProgress || 0)
    + equivalentPredators * captureRate * elapsedDays * huntDrive;
  const attempts = Math.floor(population.aquaticHuntAttemptProgress);
  population.aquaticHuntAttemptProgress -= attempts;
  let consumed = 0;
  let kills = 0;

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    if (consumed >= aquaticBudgetKg) break;
    const ordinal = telemetry.attempts + 1;
    telemetry.attempts = ordinal;
    const random = mulberry32(hashString(`${population.id}:${gameMinute(state)}:${system.ecologyTickIndex}:${ordinal}:aquatic-hunt`));
    const target = weightedPick(collectAquaticHuntTargets(state, population, species), entry => entry.targetWeight, random);
    if (!target) {
      telemetry.lastOutcome = 'no_target';
      continue;
    }
    const encounterChance = clamp01((0.12 + target.searchability * 0.82) * target.refugia);
    telemetry.lastTargetSpeciesId = target.prey.speciesId;
    telemetry.lastEncounterChance = round3(encounterChance);
    if (random() >= encounterChance) {
      telemetry.lastOutcome = 'no_encounter';
      continue;
    }
    telemetry.encounters += 1;
    const preyTelemetry = ensurePreyTelemetry(telemetry, target.prey.speciesId);
    preyTelemetry.encounters += 1;
    const stages = eligibleAquaticStages(target.prey, species);
    const stageNeedSeverity = clamp01(Math.max(
      hungerDrive,
      (tickDemandKg - (currentEdibleKg + consumed)) / Math.max(0.001, tickDemandKg),
    ));
    const stage = weightedPick(
      stages,
      row => energyAwareLifeStageWeight(row, species, stageNeedSeverity),
      random,
    );
    if (!stage || target.prey.population <= 3) {
      telemetry.lastOutcome = 'no_attack';
      continue;
    }
    telemetry.attacks += 1;
    preyTelemetry.attacks += 1;
    telemetry.lastTargetLifeStage = stage.stage;
    const condition = clamp01(population.bodyCondition / 100 * 0.55 + population.averageHealth / 100 * 0.45);
    const sizeRatio = clamp01(stage.bodyMassKg / Math.max(0.1, species.maxAdultPreyKg));
    const sizeFactor = clamp01(1.08 - sizeRatio * 0.48);
    const stageFactor = stage.stage === 'juvenile' ? 1.1 : stage.stage === 'old' ? 1.03 : 0.92;
    const preyVigor = 0.82 + (1 - clamp01(target.prey.bodyCondition / 100)) * 0.18;
    const attackSuccessChance = clamp01((0.4 + condition * 0.4) * sizeFactor * stageFactor * preyVigor * (0.72 + waterAccess * 0.28));
    telemetry.lastAttackSuccessChance = round3(attackSuccessChance);
    if (random() >= attackSuccessChance) {
      telemetry.lastOutcome = 'failed_attack';
      continue;
    }
    const bodyMassKg = removeOneAquaticPrey(target.prey, stage.stage);
    if (bodyMassKg <= 0) {
      telemetry.lastOutcome = 'no_attack';
      continue;
    }
    const carcass = createAquaticCarcass(state, population, target.prey, stage.stage, bodyMassKg, target.waterNodeId);
    const immediateMealKg = consumeCarcass(system, carcass, aquaticBudgetKg - consumed);
    consumed += immediateMealKg;
    mirrorNewCarcass(system, carcass);
    kills += 1;
    telemetry.successfulKills += 1;
    telemetry.successfulKillsByLifeStage[stage.stage] = (telemetry.successfulKillsByLifeStage[stage.stage] || 0) + 1;
    preyTelemetry.successfulKills += 1;
    telemetry.edibleConsumedKg = round3(telemetry.edibleConsumedKg + immediateMealKg);
    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';

    // A successful large meal creates its own cooldown. Small prey normally do
    // not cross this threshold, so the population can continue searching soon.
    const securedDaysAfterKill = securedFoodCoverageDays(
      state, population, species, currentEdibleKg + consumed, tickDemandKg,
    );
    if (securedDaysAfterKill >= 0.8 && population.hungerStress < 85) break;
  }
  return { edibleKg: round3(consumed), kills };
}

function runDiscreteHunt(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  elapsedDays: number,
): { edibleKg: number; kills: number } {
  const system = ensureWildPredators(state);
  system.wildCarcasses ||= [];
  const telemetry = ensureHuntTelemetry(population);
  const equivalentPredators = equivalentPredatorCount(population);
  const dailyDemandKg = species.dailyFoodKgPerAdult * equivalentPredators;
  if (equivalentPredators <= 0 || dailyDemandKg <= 0 || elapsedDays <= 0) return { edibleKg: 0, kills: 0 };

  const mealRateMultiplier = 1.6 + getPredatorEnergyReserveDays(species) * 0.16;
  const mealBudgetKg = Math.max(0, dailyDemandKg * elapsedDays * mealRateMultiplier);
  let edibleKg = feedFromOwnedCarcasses(state, population, species, mealBudgetKg);
  const returningCarcassEdibleKg = edibleKg;
  let remainingMealBudgetKg = Math.max(0, mealBudgetKg - edibleKg);

  const supplementalBudgetKg = Math.min(
    remainingMealBudgetKg,
    dailyDemandKg * elapsedDays * clamp01(species.maxSupplementalDietShare || 0),
  );
  if (supplementalBudgetKg > 0) {
    const supplementalKg = forageSupplementalFood(state, population, species, supplementalBudgetKg, telemetry);
    edibleKg += supplementalKg;
    remainingMealBudgetKg = Math.max(0, remainingMealBudgetKg - supplementalKg);
  }

  const tickDemandKg = Math.max(0.001, dailyDemandKg * elapsedDays);
  let kills = 0;
  const aquatic = runAquaticHunt(
    state, population, species, elapsedDays, tickDemandKg, edibleKg, remainingMealBudgetKg, telemetry,
  );
  edibleKg += aquatic.edibleKg;
  remainingMealBudgetKg = Math.max(0, remainingMealBudgetKg - aquatic.edibleKg);
  kills += aquatic.kills;

  const reserveCapacity = Math.max(0.001, population.maxEnergyReserveKg || 0.001);
  const projectedReserveRatio = clamp01(((population.energyReserveKg || 0) + edibleKg) / reserveCapacity);
  const hungerDrive = clamp01(population.hungerStress / 100);
  const reserveDrive = 1 - projectedReserveRatio;
  const intakeCoverage = clamp01(edibleKg / tickDemandKg);
  const immediateNeed = 1 - intakeCoverage;
  const starvationOverride = clamp01((population.hungerStress - 55) / 45);
  const reserveRechargeDrive = reserveDrive * (0.15 + immediateNeed * 0.85);

  // P3.3: current feeding must suppress hunting before reserve refill can
  // dominate behavior. A fed predator may still opportunistically hunt to
  // rebuild reserves, but that motive is deliberately secondary to the
  // current tick's maintenance coverage.
  let huntDrive = clamp01(
    immediateNeed * (0.18 + hungerDrive * 0.62)
      + reserveRechargeDrive * 0.18
      + starvationOverride * 0.16,
  );
  if (intakeCoverage >= 0.95 && population.hungerStress < 35) huntDrive *= 0.08;
  else if (intakeCoverage >= 0.75 && population.hungerStress < 50) huntDrive *= 0.25;
  else if (intakeCoverage >= 0.5 && population.hungerStress < 60) huntDrive *= 0.55;

  // A low reserve can justify eating somewhat beyond immediate maintenance,
  // but not an unlimited chain of kills inside one aggregate population tick.
  const satiationTargetKg = tickDemandKg * (1 + reserveDrive * 0.35 + hungerDrive * 0.15);
  if (intakeCoverage >= 0.75 && population.hungerStress < 50) {
    population.huntAttemptProgress = Math.max(0, population.huntAttemptProgress || 0) * 0.35;
  }

  const cadenceReadiness = mealDrivenHuntReadiness(state, population, species, edibleKg, tickDemandKg);
  const searchAttemptsPerPredatorDay = activeSearchAttemptsPerAdultDay(species);
  population.huntAttemptProgress = Math.max(0, population.huntAttemptProgress || 0)
    + equivalentPredators * searchAttemptsPerPredatorDay * elapsedDays * huntDrive * cadenceReadiness;
  // Do not let a long simulation step dump an unbounded backlog of attempts at
  // once. This is a safety envelope only; it does not prescribe successful kills.
  const safetyAttemptCap = Math.max(1, Math.ceil(equivalentPredators * elapsedDays * 4));
  const attempts = Math.min(Math.floor(population.huntAttemptProgress), safetyAttemptCap);
  population.huntAttemptProgress = Math.max(0, population.huntAttemptProgress - attempts);

  const accessiblePreferredBiomass = collectHuntTargets(state, population, species)
    .reduce((sum, entry) => sum + entry.prey.biomassKg * entry.preference * entry.accessibility, 0);
  const competition = predatorCompetitionMultiplier(population.biomassKg, accessiblePreferredBiomass, species.idealPredatorPreyBiomassRatio);

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    // Re-evaluate satiation after every successful meal. Remaining attempts
    // in this tick are discarded once aggregate intake reaches the bounded
    // maintenance + reserve-recharge target.
    if (edibleKg >= satiationTargetKg && population.hungerStress < 85) break;
    const ordinal = telemetry.attempts + 1;
    telemetry.attempts = ordinal;
    const random = mulberry32(hashString(`${population.id}:${gameMinute(state)}:${system.ecologyTickIndex}:${ordinal}:hunt`));
    const targets = collectHuntTargets(state, population, species);
    const target = weightedPick(targets, entry => entry.targetWeight, random);
    if (!target) {
      telemetry.lastOutcome = 'no_target';
      continue;
    }

    const encounterChance = clamp01(0.06 + target.searchability * 0.88);
    telemetry.lastTargetSpeciesId = target.prey.speciesId;
    telemetry.lastEncounterChance = round3(encounterChance);
    if (random() >= encounterChance) {
      telemetry.lastOutcome = 'no_encounter';
      continue;
    }

    telemetry.encounters += 1;
    const preyTelemetry = ensurePreyTelemetry(telemetry, target.prey.speciesId);
    preyTelemetry.encounters += 1;
    const stages = eligibleStages(target.prey, species);
    const stageNeedSeverity = clamp01(Math.max(
      population.hungerStress / 100,
      1 - edibleKg / Math.max(0.001, tickDemandKg),
    ));
    const stage = weightedPick(
      stages,
      row => energyAwareLifeStageWeight(row, species, stageNeedSeverity),
      random,
    );
    if (!stage || target.prey.population <= 1) {
      telemetry.lastOutcome = 'no_attack';
      continue;
    }

    telemetry.attacks += 1;
    preyTelemetry.attacks += 1;
    telemetry.lastTargetLifeStage = stage.stage;
    const condition = clamp01(population.bodyCondition / 100 * 0.55 + population.averageHealth / 100 * 0.45);
    const sizeRatio = clamp01(stage.bodyMassKg / Math.max(0.1, species.maxAdultPreyKg));
    const sizeFactor = clamp01(1.08 - sizeRatio * 0.55);
    const stageFactor = stage.stage === 'juvenile' ? 1.12 : stage.stage === 'old' ? 1.02 : 0.9;
    const habitatFactor = 0.72 + getPredatorHabitatSuitability(target.subarea, species) * 0.28;
    const preyVigorFactor = 0.82 + (1 - clamp01(target.prey.bodyCondition / 100)) * 0.18;
    const competitionFactor = 0.7 + competition * 0.3;
    const refugeEscapeFactor = 0.78 + target.refugia * 0.22;
    const attackSuccessChance = clamp01(
      (0.42 + condition * 0.38)
        * sizeFactor
        * stageFactor
        * habitatFactor
        * preyVigorFactor
        * competitionFactor
        * refugeEscapeFactor,
    );
    telemetry.lastAttackSuccessChance = round3(attackSuccessChance);
    if (random() >= attackSuccessChance) {
      telemetry.lastOutcome = 'failed_attack';
      continue;
    }

    const bodyMassKg = removeOnePrey(target.prey, stage.stage);
    if (bodyMassKg <= 0) {
      telemetry.lastOutcome = 'no_attack';
      continue;
    }
    const carcass = createCarcass(state, population, target.prey, stage.stage, bodyMassKg);
    const immediateMealKg = consumeCarcass(system, carcass, remainingMealBudgetKg);
    edibleKg += immediateMealKg;
    remainingMealBudgetKg = Math.max(0, remainingMealBudgetKg - immediateMealKg);
    mirrorNewCarcass(system, carcass);

    kills += 1;
    telemetry.successfulKills += 1;
    telemetry.successfulKillsByLifeStage[stage.stage] = (telemetry.successfulKillsByLifeStage[stage.stage] || 0) + 1;
    preyTelemetry.successfulKills += 1;
    telemetry.edibleConsumedKg = round3(telemetry.edibleConsumedKg + immediateMealKg);
    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';

    const securedDaysAfterKill = securedFoodCoverageDays(state, population, species, edibleKg, tickDemandKg);
    if (securedDaysAfterKill >= 0.8 && population.hungerStress < 85) break;
  }

  telemetry.edibleConsumedKg = round3(telemetry.edibleConsumedKg + returningCarcassEdibleKg);
  return { edibleKg: round3(edibleKg), kills };
}

function tickPredatorPopulationDiscrete(state: GameState, population: WildPredatorPopulation, elapsedMinutes: number): void {
  const species = WILD_PREDATOR_SPECIES[population.speciesId];
  const system = ensureWildPredators(state);
  const subarea = system.subareasById[population.currentSubareaId];
  if (!species || !subarea || population.population <= 0 || elapsedMinutes <= 0) return;
  ensurePredatorEnergyState(population, species);
  ensureHuntTelemetry(population);
  const elapsedDays = elapsedMinutes / 1440;
  const huntResult = runDiscreteHunt(state, population, species, elapsedDays);
  const energyCoverage = applyPredatorEnergyAccounting(population, species, elapsedDays, huntResult.edibleKg);
  const waterRangeIds = [...new Set([...population.homeRangeSubareaIds, population.currentSubareaId])];
  const waterRatio = getPredatorAccessibleWaterRatio(
    state, system, waterRangeIds, species, population.poiId, population.currentSubareaId,
  );

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

export function tickWildPredatorsDiscrete(state: GameState, _deltaGameMinutes: number): void {
  const system = ensureWildPredators(state);
  system.wildCarcasses ||= [];
  tickWildCarcasses(state);
  const now = gameMinute(state);
  for (const region of Object.values(system.regionsByPoiId)) {
    if (!region) continue;
    const observed = region.subareaIds.some(id => system.subareasById[id]?.materializationState === 'materialized');
    if (!observed) continue;
    ensureRegionWildFauna(state, region.poiId);
    if (!region.predatorsSeeded) ensureRegionWildPredators(state, region.poiId);
    for (const population of system.predatorPopulations!.filter(entry => entry.poiId === region.poiId)) {
      const elapsed = Math.max(0, now - population.lastUpdatedGameMinute);
      if (elapsed > 0) tickPredatorPopulationDiscrete(state, population, elapsed);
    }
    refreshPredatorPressure(system, region.poiId);
  }
}

export interface PredatorHuntDiagnostic {
  populationId: string;
  speciesId: string;
  population: number;
  attempts: number;
  encounters: number;
  attacks: number;
  successfulKills: number;
  successfulKillsByLifeStage: Partial<Record<WildAnimalLifeStage, number>>;
  encounterRate: number;
  attackSuccessRate: number;
  overallSuccessRate: number;
  edibleConsumedKg: number;
  supplementalConsumedKg: number;
  supplementalByResource: Partial<Record<WildFoodResource, number>>;
  carcassBiomassCreatedKg: number;
  activeOwnedCarcasses: number;
  remainingOwnedCarcassKg: number;
  byPreySpecies: Record<string, PredatorHuntPreyTelemetry>;
}

export function getPredatorHuntDiagnostics(state: GameState): PredatorHuntDiagnostic[] {
  const system = state.ecologySystem;
  if (!system) return [];
  return (system.predatorPopulations || []).map(population => {
    const telemetry = ensureHuntTelemetry(population);
    const ownedCarcasses = (system.wildCarcasses || []).filter(carcass => carcass.killerPopulationId === population.id && carcass.remainingMassKg > 0);
    return {
      populationId: population.id,
      speciesId: population.speciesId,
      population: population.population,
      attempts: telemetry.attempts,
      encounters: telemetry.encounters,
      attacks: telemetry.attacks,
      successfulKills: telemetry.successfulKills,
      successfulKillsByLifeStage: { ...telemetry.successfulKillsByLifeStage },
      encounterRate: round3(telemetry.attempts > 0 ? telemetry.encounters / telemetry.attempts : 0),
      attackSuccessRate: round3(telemetry.attacks > 0 ? telemetry.successfulKills / telemetry.attacks : 0),
      overallSuccessRate: round3(telemetry.attempts > 0 ? telemetry.successfulKills / telemetry.attempts : 0),
      edibleConsumedKg: round3(telemetry.edibleConsumedKg),
      supplementalConsumedKg: round3(telemetry.supplementalConsumedKg),
      supplementalByResource: { ...telemetry.supplementalByResource },
      carcassBiomassCreatedKg: round3(telemetry.carcassBiomassCreatedKg),
      activeOwnedCarcasses: ownedCarcasses.length,
      remainingOwnedCarcassKg: round3(ownedCarcasses.reduce((sum, carcass) => sum + carcass.remainingMassKg, 0)),
      byPreySpecies: JSON.parse(JSON.stringify(telemetry.byPreySpecies)),
    };
  });
}