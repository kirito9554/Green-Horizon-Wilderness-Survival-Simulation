import type { GameState } from '../types';
import type {
  EcologicalSubarea,
  WildAnimalPopulation,
  WildPlantPopulation,
  WildPredatorPopulation,
  WorldEcologyState,
} from '../types/ecologySimulation';
import { AREAS_DATABASE } from '../data/areas';
import { ECOLOGY_SUBAREA_ARCHETYPES, WILD_FLORA_SPECIES } from '../data/ecologyProfiles';
import { WILD_FAUNA_SPECIES } from '../data/ecologyFauna';
import { WILD_PREDATOR_SPECIES } from '../data/ecologyPredators';
import { getOrCreatePoiBuildGrid } from './buildGridSystem';
import { getWildAnimalHabitatSuitability, tickWildFauna } from './ecologyFaunaSystem';
import { getPredatorHabitatSuitability } from './ecologyPredatorSystem';

const LONG_RUN_BALANCE_VERSION = 1;
const BALANCE_TICK_MINUTES = 360;
const RECOLONIZATION_INTERVAL_MINUTES = 14 * 1440;

interface LongRunBalanceMeta {
  version: number;
  lastBalanceGameMinute: number;
  lastRecolonizationGameMinute: number;
  balanceTickIndex: number;
}

type LongRunWorldEcologyState = WorldEcologyState & {
  longRunBalance?: LongRunBalanceMeta;
};

interface AgeStructuredPopulation {
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  biomassKg: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
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

function average(values: number[], fallback = 0): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function ensureMeta(state: GameState): LongRunBalanceMeta | undefined {
  const system = state.ecologySystem as LongRunWorldEcologyState | undefined;
  if (!system) return undefined;
  const now = gameMinute(state);
  system.longRunBalance ||= {
    version: LONG_RUN_BALANCE_VERSION,
    lastBalanceGameMinute: now,
    lastRecolonizationGameMinute: now,
    balanceTickIndex: 0,
  };
  system.longRunBalance.version = LONG_RUN_BALANCE_VERSION;
  return system.longRunBalance;
}

function halfLifeDecay(value: number, elapsedDays: number, halfLifeDays: number): number {
  if (value <= 0 || elapsedDays <= 0) return Math.max(0, value);
  return value * Math.pow(0.5, elapsedDays / Math.max(0.001, halfLifeDays));
}

function floraTurnoverPerDay(population: WildPlantPopulation): number {
  const form = WILD_FLORA_SPECIES[population.speciesId]?.form;
  if (form === 'tree') return 0.00028;
  if (form === 'palm') return 0.00034;
  if (form === 'clump') return 0.0008;
  if (form === 'shrub') return 0.0012;
  if (form === 'fern') return 0.0022;
  if (form === 'reed') return 0.0028;
  if (form === 'herb') return 0.0032;
  return 0.0035;
}

function fruitDecayPerDay(population: WildPlantPopulation): number {
  const form = WILD_FLORA_SPECIES[population.speciesId]?.form;
  if (form === 'tree' || form === 'palm') return 0.035;
  if (form === 'shrub') return 0.07;
  return 0.1;
}

function communityCapacityKg(subarea: EcologicalSubarea): number {
  const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
  const kgPer100M2 = 850 + subarea.ecology.biomass * 28 + subarea.environment.canopyCover * 11;
  return Math.max(120, areaFactor * kgPer100M2);
}

function balancePlantCommunity(
  system: WorldEcologyState,
  subarea: EcologicalSubarea,
  elapsedDays: number,
): void {
  const populations = system.plantPopulations.filter(population => population.subareaId === subarea.id && population.biomassKg > 0);
  if (!populations.length || elapsedDays <= 0) return;

  const totalBiomass = populations.reduce((sum, population) => sum + population.biomassKg, 0);
  const capacity = communityCapacityKg(subarea);
  const overload = Math.max(0, totalBiomass / Math.max(1, capacity) - 1);
  const crowdingTurnover = Math.min(0.055, overload * 0.022);

  for (const population of populations) {
    const flora = WILD_FLORA_SPECIES[population.speciesId];
    if (!flora) continue;
    const turnover = floraTurnoverPerDay(population) + crowdingTurnover;
    const biomassFactor = Math.exp(-turnover * elapsedDays);
    const individualFactor = Math.exp(-turnover * elapsedDays * 0.45);
    population.biomassKg = round3(Math.max(0, population.biomassKg * biomassFactor));
    population.estimatedIndividuals = Math.max(0, Math.round(population.estimatedIndividuals * individualFactor));
    population.health = clamp(population.health + (overload > 0 ? -overload * 2.2 : 0.12) * elapsedDays);

    const fruitRatio = Math.max(0, flora.fruitKgPer100Biomass) / 100;
    if (fruitRatio <= 0 || population.biomassKg <= 0) {
      population.fruitBiomassKg = 0;
    } else {
      const standingFruitCapacity = population.biomassKg * fruitRatio * (flora.form === 'tree' || flora.form === 'palm' ? 1.05 : 0.72);
      population.fruitBiomassKg = round3(Math.min(
        standingFruitCapacity,
        Math.max(0, population.fruitBiomassKg * Math.exp(-fruitDecayPerDay(population) * elapsedDays)),
      ));
    }
  }
}

function recoverSubareaSuccession(
  state: GameState,
  system: WorldEcologyState,
  subarea: EcologicalSubarea,
  elapsedDays: number,
): void {
  const region = system.regionsByPoiId[subarea.poiId];
  const archetype = ECOLOGY_SUBAREA_ARCHETYPES[subarea.archetypeId];
  if (!region || !archetype || elapsedDays <= 0) return;

  subarea.disturbance.floodDamage = clamp(halfLifeDecay(subarea.disturbance.floodDamage, elapsedDays, 14));
  subarea.disturbance.stormDamage = clamp(halfLifeDecay(subarea.disturbance.stormDamage, elapsedDays, 45));
  subarea.disturbance.fireDamage = clamp(halfLifeDecay(subarea.disturbance.fireDamage, elapsedDays, 240));
  subarea.disturbance.loggingPressure = clamp(halfLifeDecay(subarea.disturbance.loggingPressure, elapsedDays, 360));

  const populations = system.plantPopulations.filter(population => population.subareaId === subarea.id);
  const seedBank = average(populations.map(population => population.seedBank), 45) / 100;
  const moistureFitness = clamp01((subarea.environment.moisture + 15) / 100);
  const disturbanceFitness = clamp01(1 - subarea.disturbance.fireDamage / 125)
    * clamp01(1 - subarea.disturbance.loggingPressure / 140);
  const recoveryFitness = moistureFitness * (0.35 + seedBank * 0.65) * disturbanceFitness;
  if (recoveryFitness <= 0.001) return;

  const grid = getOrCreatePoiBuildGrid(state, subarea.poiId);
  const cells = subarea.cellIds
    .map(id => grid.cells.find(cell => cell.id === id))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
  if (!cells.length) return;

  const targetVegetation = archetype.targets.vegetation;
  const targetCanopy = archetype.targets.canopy;
  const vegetationBlend = 1 - Math.exp(-0.006 * elapsedDays * recoveryFitness);
  const canopyBlend = 1 - Math.exp(-0.0012 * elapsedDays * recoveryFitness);

  for (const cell of cells) {
    if (targetVegetation !== undefined && cell.vegetation < targetVegetation) {
      cell.vegetation = clamp(cell.vegetation + (targetVegetation - cell.vegetation) * vegetationBlend);
    }
    if (targetCanopy !== undefined && cell.canopy < targetCanopy) {
      const before = cell.canopy;
      cell.canopy = clamp(cell.canopy + (targetCanopy - cell.canopy) * canopyBlend);
      cell.sunlight = clamp(cell.sunlight - Math.max(0, cell.canopy - before) * 0.55);
    }
  }

  const avgVegetation = average(cells.map(cell => cell.vegetation), subarea.ecology.biomass);
  const avgCanopy = average(cells.map(cell => cell.canopy), subarea.environment.canopyCover);
  subarea.environment.canopyCover = clamp(avgCanopy);
  subarea.environment.sunlight = clamp(average(cells.map(cell => cell.sunlight), subarea.environment.sunlight));
  const targetBiomass = clamp(avgVegetation * 0.58 + avgCanopy * 0.34 + subarea.ecology.plantDiversity * 0.08);
  const biomassBlend = 1 - Math.exp(-0.004 * elapsedDays * recoveryFitness);
  if (subarea.ecology.biomass < targetBiomass) {
    subarea.ecology.biomass = clamp(subarea.ecology.biomass + (targetBiomass - subarea.ecology.biomass) * biomassBlend);
  }

  const diversityTarget = Math.max(subarea.ecology.plantDiversity, region.biodiversityIndex);
  const diversityBlend = 1 - Math.exp(-0.0015 * elapsedDays * recoveryFitness);
  subarea.ecology.plantDiversity = clamp(
    subarea.ecology.plantDiversity + (diversityTarget - subarea.ecology.plantDiversity) * diversityBlend,
  );
}

function macroDistance(aPoiId: string, bPoiId: string): number {
  const a = AREAS_DATABASE[aPoiId];
  const b = AREAS_DATABASE[bPoiId];
  if (!a || !b) return 60;
  return Math.hypot(a.mapX - b.mapX, a.mapY - b.mapY);
}

function removeMigrants(population: AgeStructuredPopulation, count: number): { juveniles: number; adults: number; old: number; count: number } {
  let remaining = Math.min(Math.max(0, count), population.population);
  let adults = Math.min(population.adults, remaining);
  population.adults -= adults;
  remaining -= adults;
  let juveniles = Math.min(population.juveniles, remaining);
  population.juveniles -= juveniles;
  remaining -= juveniles;
  const old = Math.min(population.old, remaining);
  population.old -= old;
  remaining -= old;
  const moved = adults + juveniles + old;
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  return { juveniles, adults, old, count: moved };
}

function addMigrants(
  target: AgeStructuredPopulation,
  migrants: { juveniles: number; adults: number; old: number; count: number },
): void {
  target.juveniles += migrants.juveniles;
  target.adults += migrants.adults;
  target.old += migrants.old;
  target.population = target.juveniles + target.adults + target.old;
}

function recomputeFaunaBiomass(population: WildAnimalPopulation): void {
  const species = WILD_FAUNA_SPECIES[population.speciesId];
  if (!species) return;
  population.biomassKg = round3(species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45));
}

function recomputePredatorBiomass(population: WildPredatorPopulation): void {
  const species = WILD_PREDATOR_SPECIES[population.speciesId];
  if (!species) return;
  population.biomassKg = round3(species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45));
}

function recolonizeFauna(state: GameState, system: WorldEcologyState, balanceTickIndex: number): void {
  const populations = system.animalPopulations || [];
  const now = gameMinute(state);
  for (const target of populations.filter(population => population.population <= 0)) {
    const species = WILD_FAUNA_SPECIES[target.speciesId];
    const region = system.regionsByPoiId[target.poiId];
    if (!species || !region || (species.regionAffinity[target.poiId] || 0) < 0.2) continue;
    if (!region.subareaIds.some(id => system.subareasById[id]?.materializationState === 'materialized')) continue;

    const candidates = (target.homeRangeSubareaIds.length ? target.homeRangeSubareaIds : region.subareaIds)
      .map(id => system.subareasById[id])
      .filter((entry): entry is EcologicalSubarea => Boolean(entry))
      .sort((a, b) => getWildAnimalHabitatSuitability(b, species) - getWildAnimalHabitatSuitability(a, species));
    const best = candidates[0];
    const habitat = best ? getWildAnimalHabitatSuitability(best, species) : 0;
    if (!best || habitat < 0.32) continue;

    const donors = populations
      .filter(population => population.speciesId === target.speciesId && population.poiId !== target.poiId && population.population >= 5)
      .sort((a, b) => b.population - a.population);
    const donor = donors[0];
    if (!donor) continue;
    const distance = macroDistance(donor.poiId, target.poiId);
    const affinity = species.regionAffinity[target.poiId] || 0;
    const chance = Math.min(0.58, affinity * habitat * Math.exp(-distance / 52) * 0.42);
    const random = mulberry32(hashString(`${target.id}:${donor.id}:${balanceTickIndex}:fauna-recolonize`));
    if (random() > chance) continue;

    const desired = species.socialMode === 'herd' || species.socialMode === 'flock' || species.socialMode === 'sounder' ? 2 : 1;
    const migrants = removeMigrants(donor, Math.min(desired, Math.max(1, donor.population - 3)));
    if (migrants.count <= 0) continue;
    addMigrants(target, migrants);
    recomputeFaunaBiomass(donor);
    recomputeFaunaBiomass(target);
    target.currentSubareaId = best.id;
    if (!target.homeRangeSubareaIds.includes(best.id)) target.homeRangeSubareaIds.push(best.id);
    target.averageHealth = clamp(Math.max(target.averageHealth, 62));
    target.bodyCondition = clamp(Math.max(target.bodyCondition, 58));
    target.foodStress = clamp(Math.min(target.foodStress, 28));
    target.waterStress = clamp(Math.min(target.waterStress, 24));
    target.migrationPressure = 18;
    target.humanFear = clamp(best.disturbance.humanPressure * 0.5);
    target.lastMoveGameMinute = now;
    target.lastUpdatedGameMinute = now;
  }
}

function recolonizePredators(state: GameState, system: WorldEcologyState, balanceTickIndex: number): void {
  const predators = system.predatorPopulations || [];
  const prey = system.animalPopulations || [];
  const now = gameMinute(state);
  for (const target of predators.filter(population => population.population <= 0)) {
    const species = WILD_PREDATOR_SPECIES[target.speciesId];
    const region = system.regionsByPoiId[target.poiId];
    if (!species || !region || (species.regionAffinity[target.poiId] || 0) < 0.2) continue;
    if (!region.subareaIds.some(id => system.subareasById[id]?.materializationState === 'materialized')) continue;

    const regionalPreyBiomass = prey
      .filter(population => population.poiId === target.poiId && population.population > 0)
      .reduce((sum, population) => sum + population.biomassKg * (species.preyWeights[population.speciesId] || 0), 0);
    if (regionalPreyBiomass < species.dailyFoodKgPerAdult * 24) continue;

    const candidates = (target.homeRangeSubareaIds.length ? target.homeRangeSubareaIds : region.subareaIds)
      .map(id => system.subareasById[id])
      .filter((entry): entry is EcologicalSubarea => Boolean(entry))
      .sort((a, b) => getPredatorHabitatSuitability(b, species) - getPredatorHabitatSuitability(a, species));
    const best = candidates[0];
    const habitat = best ? getPredatorHabitatSuitability(best, species) : 0;
    if (!best || habitat < 0.36) continue;

    const donor = predators
      .filter(population => population.speciesId === target.speciesId && population.poiId !== target.poiId && population.population >= 3)
      .sort((a, b) => b.population - a.population)[0];
    if (!donor) continue;
    const distance = macroDistance(donor.poiId, target.poiId);
    const affinity = species.regionAffinity[target.poiId] || 0;
    const chance = Math.min(0.34, affinity * habitat * Math.exp(-distance / 48) * 0.2);
    const random = mulberry32(hashString(`${target.id}:${donor.id}:${balanceTickIndex}:predator-recolonize`));
    if (random() > chance) continue;

    const migrants = removeMigrants(donor, 1);
    if (migrants.count <= 0) continue;
    addMigrants(target, migrants);
    recomputePredatorBiomass(donor);
    recomputePredatorBiomass(target);
    target.currentSubareaId = best.id;
    if (!target.homeRangeSubareaIds.includes(best.id)) target.homeRangeSubareaIds.push(best.id);
    target.averageHealth = clamp(Math.max(target.averageHealth, 64));
    target.bodyCondition = clamp(Math.max(target.bodyCondition, 60));
    target.hungerStress = clamp(Math.min(target.hungerStress, 30));
    target.waterStress = clamp(Math.min(target.waterStress, 24));
    target.migrationPressure = 20;
    target.humanFear = clamp(best.disturbance.humanPressure * 0.55);
    target.lastMoveGameMinute = now;
    target.lastUpdatedGameMinute = now;
  }
}

/**
 * Runtime compatibility wrapper for the terrestrial food web.
 * ecologyFaunaSystem historically used RegionEcology.lastEcologyTickGameMinute as
 * its food-web clock. That timestamp is owned by tickWorldEcology, so repeated
 * sub-30-minute simulation frames re-integrated the same elapsed interval. During
 * this wrapper only, fauna sees exactly this frame's elapsed time; the canonical
 * ecology timestamp is restored immediately afterward.
 */
export function tickWildFaunaWithStableFoodWebClock(state: GameState, deltaGameMinutes: number): void {
  const system = state.ecologySystem;
  if (!system) {
    tickWildFauna(state, deltaGameMinutes);
    return;
  }
  const now = gameMinute(state);
  const saved = Object.values(system.regionsByPoiId)
    .filter(Boolean)
    .map(region => ({ region: region!, lastEcologyTickGameMinute: region!.lastEcologyTickGameMinute }));
  for (const entry of saved) {
    entry.region.lastEcologyTickGameMinute = Math.max(0, now - Math.max(0, deltaGameMinutes));
  }
  try {
    tickWildFauna(state, deltaGameMinutes);
  } finally {
    for (const entry of saved) entry.region.lastEcologyTickGameMinute = entry.lastEcologyTickGameMinute;
  }
}

/**
 * Slow corrective layer for processes whose natural time scale is weeks to years.
 * Fast ecological interactions remain in ecologySystem/fauna/predator systems;
 * this layer prevents unbounded fruit/biomass accumulation, lets disturbance scars
 * recover through succession, and permits low-frequency island recolonization.
 */
export function tickLongRunEcosystemBalance(state: GameState, _deltaGameMinutes: number): void {
  const system = state.ecologySystem as LongRunWorldEcologyState | undefined;
  const meta = ensureMeta(state);
  if (!system || !meta) return;
  const now = gameMinute(state);
  const elapsedMinutes = Math.max(0, now - meta.lastBalanceGameMinute);
  if (elapsedMinutes < BALANCE_TICK_MINUTES) return;
  const elapsedDays = elapsedMinutes / 1440;

  for (const subarea of Object.values(system.subareasById)) {
    if (!subarea || subarea.materializationState !== 'materialized') continue;
    balancePlantCommunity(system, subarea, elapsedDays);
    recoverSubareaSuccession(state, system, subarea, elapsedDays);
  }

  meta.lastBalanceGameMinute = now;
  meta.balanceTickIndex++;
  if (now - meta.lastRecolonizationGameMinute >= RECOLONIZATION_INTERVAL_MINUTES) {
    recolonizeFauna(state, system, meta.balanceTickIndex);
    recolonizePredators(state, system, meta.balanceTickIndex);
    meta.lastRecolonizationGameMinute = now;
  }
}

export function getLongRunEcosystemMeta(state: GameState): Readonly<LongRunBalanceMeta> | undefined {
  return (state.ecologySystem as LongRunWorldEcologyState | undefined)?.longRunBalance;
}
