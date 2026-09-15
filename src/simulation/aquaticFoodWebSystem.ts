import type { GameState } from '../types';
import type { HydrologyNode } from '../types/hydrologySimulation';
import type {
  AquaticFoodResource,
  AquaticFoodWebNodeState,
  WildAquaticPopulation,
} from '../types/aquaticEcology';
import type { WorldEcologyState } from '../types/ecologySimulation';
import '../types/aquaticEcology';
import { WILD_AQUATIC_SPECIES, type WildAquaticSpeciesDefinition } from '../data/ecologyAquatic';
import { ensureWorldEcology } from './ecologySystem';

export interface AquaticFoodPool extends Record<AquaticFoodResource, number> {}

export interface AquaticFeedingResult {
  demandKg: number;
  intakeKg: number;
  resourceIntakeKg: number;
  preyIntakeKg: number;
  foodSatisfaction: number;
  preyKilled: number;
}

const RESOURCE_FIELDS: Record<AquaticFoodResource, keyof AquaticFoodWebNodeState> = {
  phytoplankton: 'phytoplanktonKg',
  periphyton: 'periphytonKg',
  aquatic_vegetation: 'aquaticVegetationKg',
  zooplankton: 'zooplanktonKg',
  benthic_invertebrates: 'benthicInvertebratesKg',
  detritus: 'detritusKg',
  carrion: 'carrionKg',
};

const FOOD_RESOURCES = Object.keys(RESOURCE_FIELDS) as AquaticFoodResource[];

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

function ensureFoodWebContainer(state: GameState): WorldEcologyState {
  const system = ensureWorldEcology(state);
  system.version = Math.max(5, system.version || 1);
  system.aquaticFoodWebByNodeId ||= {};
  system.aquaticFoodWebTickIndex ||= 0;
  return system;
}

function effectiveNodeVolume(node: HydrologyNode): number {
  const storage = Math.max(0, node.storageM3 || 0);
  const capacityContribution = Math.max(0, node.capacityM3 || 0) * 0.12;
  const levelContribution = Math.max(0, node.waterLevelM || 0) * 12;
  return Math.max(0.5, storage, capacityContribution, levelContribution);
}

function nodeProductivity(node: HydrologyNode): number {
  const temperature = node.temperatureC ?? 26;
  const oxygen = node.dissolvedOxygenMgL ?? 7;
  const turbidity = node.turbidity ?? 0;
  const contamination = node.contamination ?? 0;
  const thermal = clamp01(1 - Math.abs(temperature - 27) / 15);
  const oxygenFactor = clamp01((oxygen - 1.5) / 6.5);
  const light = clamp01(1 - turbidity / 115);
  const clean = clamp01(1 - contamination / 105);
  return clamp01(thermal * 0.25 + oxygenFactor * 0.2 + light * 0.3 + clean * 0.25);
}

function resourceCapacities(node: HydrologyNode): AquaticFoodPool {
  const volume = effectiveNodeVolume(node);
  const productivity = nodeProductivity(node);
  const salinity = node.salinityPpt ?? 0;
  const coastalBoost = salinity >= 8 ? 1.18 : 1;
  return {
    phytoplankton: Math.max(0.4, volume * 0.11 * (0.55 + productivity * 0.7)),
    periphyton: Math.max(0.3, volume * 0.045 * (0.6 + productivity * 0.65) * coastalBoost),
    aquatic_vegetation: Math.max(0.25, volume * 0.075 * (0.45 + productivity * 0.8)),
    zooplankton: Math.max(0.18, volume * 0.032 * (0.55 + productivity * 0.65)),
    benthic_invertebrates: Math.max(0.16, volume * 0.028 * (0.6 + productivity * 0.6) * coastalBoost),
    detritus: Math.max(0.35, volume * 0.09),
    carrion: Math.max(0.08, volume * 0.018),
  };
}

export function ensureAquaticFoodWebNode(state: GameState, nodeId: string): AquaticFoodWebNodeState | undefined {
  const system = ensureFoodWebContainer(state);
  const existing = system.aquaticFoodWebByNodeId![nodeId];
  if (existing) return existing;
  const node = state.hydrologySystem?.nodesById?.[nodeId];
  if (!node || (!node.active && node.storageM3 <= 0.001 && node.inflowM3H <= 0.01 && node.outflowM3H <= 0.01)) return undefined;

  const caps = resourceCapacities(node);
  const worldSeed = state.buildingSimulation?.worldSeed || 'aquatic_food_web_fallback';
  const random = mulberry32(hashString(`${worldSeed}:${node.id}:aquatic-food-web:v1`));
  const initial = (cap: number, low: number, high: number) => round3(cap * (low + random() * (high - low)));
  const entry: AquaticFoodWebNodeState = {
    nodeId: node.id,
    poiId: node.poiId,
    phytoplanktonKg: initial(caps.phytoplankton, 0.38, 0.7),
    periphytonKg: initial(caps.periphyton, 0.42, 0.76),
    aquaticVegetationKg: initial(caps.aquatic_vegetation, 0.36, 0.72),
    zooplanktonKg: initial(caps.zooplankton, 0.34, 0.68),
    benthicInvertebratesKg: initial(caps.benthic_invertebrates, 0.38, 0.74),
    detritusKg: initial(caps.detritus, 0.28, 0.62),
    carrionKg: 0,
    productivity: round3(nodeProductivity(node) * 100),
    lastUpdatedGameMinute: gameMinute(state),
  };
  system.aquaticFoodWebByNodeId![nodeId] = entry;
  return entry;
}

export function ensureAquaticFoodWebForNodes(state: GameState, nodeIds: string[]): AquaticFoodWebNodeState[] {
  const result: AquaticFoodWebNodeState[] = [];
  for (const nodeId of [...new Set(nodeIds)].sort()) {
    const entry = ensureAquaticFoodWebNode(state, nodeId);
    if (entry) result.push(entry);
  }
  return result;
}

function logisticGrowth(current: number, capacity: number, ratePerDay: number, days: number, fitness: number): number {
  if (current <= 0 || capacity <= 0 || days <= 0) return current;
  const room = Math.max(0, 1 - current / capacity);
  return Math.max(0, current + current * ratePerDay * days * room * fitness);
}

function tickNodeResources(state: GameState, food: AquaticFoodWebNodeState, now: number): void {
  const node = state.hydrologySystem?.nodesById?.[food.nodeId];
  if (!node) return;
  const elapsed = Math.max(0, now - food.lastUpdatedGameMinute);
  if (elapsed < 30) return;
  const days = elapsed / 1440;
  const caps = resourceCapacities(node);
  const productivity = nodeProductivity(node);
  const oxygenFactor = clamp01(((node.dissolvedOxygenMgL ?? 7) - 1) / 6);
  const turbidityFactor = clamp01(1 - (node.turbidity ?? 0) / 120);
  const contaminationFactor = clamp01(1 - (node.contamination ?? 0) / 100);
  const nutrientFactor = clamp01(0.45 + food.detritusKg / Math.max(0.1, caps.detritus) * 0.55);

  const carrionDecay = Math.min(food.carrionKg, food.carrionKg * (1 - Math.exp(-0.16 * days)));
  food.carrionKg -= carrionDecay;
  food.detritusKg += carrionDecay * 0.78;

  const detritusDecay = Math.min(food.detritusKg, food.detritusKg * (1 - Math.exp(-0.055 * days * Math.max(0.25, oxygenFactor))));
  food.detritusKg -= detritusDecay;

  food.phytoplanktonKg = logisticGrowth(food.phytoplanktonKg, caps.phytoplankton, 0.22, days, productivity * turbidityFactor * nutrientFactor);
  food.periphytonKg = logisticGrowth(food.periphytonKg, caps.periphyton, 0.095, days, productivity * turbidityFactor * contaminationFactor);
  food.aquaticVegetationKg = logisticGrowth(food.aquaticVegetationKg, caps.aquatic_vegetation, 0.055, days, productivity * turbidityFactor * contaminationFactor);

  const phytoFood = clamp01(food.phytoplanktonKg / Math.max(0.1, caps.phytoplankton));
  food.zooplanktonKg = logisticGrowth(food.zooplanktonKg, caps.zooplankton, 0.14, days, oxygenFactor * contaminationFactor * (0.3 + phytoFood * 0.7));
  const benthicFood = clamp01((food.detritusKg + food.periphytonKg) / Math.max(0.1, caps.detritus + caps.periphyton));
  food.benthicInvertebratesKg = logisticGrowth(food.benthicInvertebratesKg, caps.benthic_invertebrates, 0.085, days, oxygenFactor * contaminationFactor * (0.35 + benthicFood * 0.65));

  food.phytoplanktonKg = round3(Math.min(caps.phytoplankton, food.phytoplanktonKg));
  food.periphytonKg = round3(Math.min(caps.periphyton, food.periphytonKg));
  food.aquaticVegetationKg = round3(Math.min(caps.aquatic_vegetation, food.aquaticVegetationKg));
  food.zooplanktonKg = round3(Math.min(caps.zooplankton, food.zooplanktonKg));
  food.benthicInvertebratesKg = round3(Math.min(caps.benthic_invertebrates, food.benthicInvertebratesKg));
  food.detritusKg = round3(Math.min(caps.detritus * 2.5, Math.max(0, food.detritusKg + detritusDecay * 0.12)));
  food.carrionKg = round3(Math.min(caps.carrion * 4, Math.max(0, food.carrionKg)));
  food.productivity = round3(productivity * 100);
  food.lastUpdatedGameMinute = now;
}

export function tickAquaticFoodWebResources(state: GameState, nodeIds: string[]): void {
  const system = ensureFoodWebContainer(state);
  const now = gameMinute(state);
  let advanced = false;
  for (const entry of ensureAquaticFoodWebForNodes(state, nodeIds)) {
    const before = entry.lastUpdatedGameMinute;
    tickNodeResources(state, entry, now);
    if (entry.lastUpdatedGameMinute !== before) advanced = true;
  }
  if (advanced) system.aquaticFoodWebTickIndex = (system.aquaticFoodWebTickIndex || 0) + 1;
}

function emptyPool(): AquaticFoodPool {
  return {
    phytoplankton: 0,
    periphyton: 0,
    aquatic_vegetation: 0,
    zooplankton: 0,
    benthic_invertebrates: 0,
    detritus: 0,
    carrion: 0,
  };
}

function readResource(entry: AquaticFoodWebNodeState, resource: AquaticFoodResource): number {
  return Number(entry[RESOURCE_FIELDS[resource]]) || 0;
}

function writeResource(entry: AquaticFoodWebNodeState, resource: AquaticFoodResource, value: number): void {
  (entry[RESOURCE_FIELDS[resource]] as number) = round3(Math.max(0, value));
}

export function getAquaticFoodPoolForNodes(state: GameState, nodeIds: string[]): AquaticFoodPool {
  const pool = emptyPool();
  for (const entry of ensureAquaticFoodWebForNodes(state, nodeIds)) {
    for (const resource of FOOD_RESOURCES) pool[resource] += readResource(entry, resource);
  }
  for (const resource of FOOD_RESOURCES) pool[resource] = round3(pool[resource]);
  return pool;
}

function consumeResourceAcrossNodes(
  entries: AquaticFoodWebNodeState[],
  resource: AquaticFoodResource,
  requestedKg: number,
): number {
  const requested = Math.max(0, requestedKg);
  const total = entries.reduce((sum, entry) => sum + readResource(entry, resource), 0);
  const consumed = Math.min(requested, total);
  if (consumed <= 0 || total <= 0) return 0;
  let remaining = consumed;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const available = readResource(entry, resource);
    const take = index === entries.length - 1 ? Math.min(available, remaining) : Math.min(available, consumed * available / total);
    writeResource(entry, resource, available - take);
    remaining -= take;
  }
  return round3(consumed - Math.max(0, remaining));
}

function consumeDietResources(
  state: GameState,
  nodeIds: string[],
  species: WildAquaticSpeciesDefinition,
  requestedKg: number,
): number {
  const entries = ensureAquaticFoodWebForNodes(state, nodeIds);
  if (!entries.length || requestedKg <= 0) return 0;
  const weightedResources = FOOD_RESOURCES
    .map(resource => ({ resource, weight: species.diet[resource] || 0 }))
    .filter(entry => entry.weight > 0);
  const totalWeight = weightedResources.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return 0;

  let consumed = 0;
  for (const entry of weightedResources) {
    const share = requestedKg * entry.weight / totalWeight;
    consumed += consumeResourceAcrossNodes(entries, entry.resource, share);
  }
  let remaining = Math.max(0, requestedKg - consumed);
  if (remaining > 0.0001) {
    const pool = getAquaticFoodPoolForNodes(state, nodeIds);
    for (const entry of weightedResources.sort((a, b) => (pool[b.resource] * b.weight) - (pool[a.resource] * a.weight))) {
      if (remaining <= 0.0001) break;
      const extra = consumeResourceAcrossNodes(entries, entry.resource, remaining);
      consumed += extra;
      remaining -= extra;
    }
  }
  return round3(consumed);
}

function biomassFor(population: WildAquaticPopulation, species: WildAquaticSpeciesDefinition): number {
  return round3(species.adultWeightKg * (population.juveniles * 0.28 + population.adults + population.old * 0.82));
}

function removePreyIndividuals(population: WildAquaticPopulation, species: WildAquaticSpeciesDefinition, count: number): number {
  let remaining = Math.min(Math.max(0, count), population.population);
  if (remaining <= 0) return 0;
  const beforeBiomass = population.biomassKg;
  const juvenileTake = Math.min(population.juveniles, Math.ceil(remaining * 0.55));
  population.juveniles -= juvenileTake;
  remaining -= juvenileTake;
  const oldTake = Math.min(population.old, Math.ceil(remaining * 0.18));
  population.old -= oldTake;
  remaining -= oldTake;
  const adultTake = Math.min(population.adults, remaining);
  population.adults -= adultTake;
  remaining -= adultTake;
  if (remaining > 0) {
    const extraOld = Math.min(population.old, remaining);
    population.old -= extraOld;
    remaining -= extraOld;
  }
  population.population = population.juveniles + population.adults + population.old;
  population.biomassKg = biomassFor(population, species);
  return round3(Math.max(0, beforeBiomass - population.biomassKg));
}

function overlapNodes(a: WildAquaticPopulation, b: WildAquaticPopulation): boolean {
  const nodes = new Set(a.occupiedNodeIds);
  return b.occupiedNodeIds.some(nodeId => nodes.has(nodeId));
}

function consumePrey(
  state: GameState,
  predator: WildAquaticPopulation,
  predatorSpecies: WildAquaticSpeciesDefinition,
  populations: WildAquaticPopulation[],
  requestedKg: number,
  days: number,
): { consumedKg: number; killed: number } {
  const weights = predatorSpecies.preyWeights || {};
  if (requestedKg <= 0 || !Object.keys(weights).length) return { consumedKg: 0, killed: 0 };
  const candidates = populations
    .filter(prey => prey.id !== predator.id && prey.population > 3 && overlapNodes(predator, prey) && (weights[prey.speciesId] || 0) > 0)
    .map(prey => ({ prey, species: WILD_AQUATIC_SPECIES[prey.speciesId], weight: weights[prey.speciesId] || 0 }))
    .filter((entry): entry is { prey: WildAquaticPopulation; species: WildAquaticSpeciesDefinition; weight: number } => Boolean(entry.species))
    .sort((a, b) => (b.prey.biomassKg * b.weight) - (a.prey.biomassKg * a.weight));
  if (!candidates.length) return { consumedKg: 0, killed: 0 };

  const weightedPreyBiomass = candidates.reduce((sum, entry) => sum + entry.prey.biomassKg * entry.weight, 0);
  const functionalResponse = weightedPreyBiomass / Math.max(0.001, weightedPreyBiomass + requestedKg * 4);
  let target = requestedKg * functionalResponse;
  let consumed = 0;
  let killed = 0;
  const maxKillFraction = Math.min(0.6, Math.max(0.03, days * 0.07));

  for (const entry of candidates) {
    if (target <= 0.0001) break;
    const prey = entry.prey;
    const avgWeight = prey.biomassKg / Math.max(1, prey.population);
    const refugeCount = Math.max(2, Math.ceil(prey.population * 0.08));
    const removable = Math.max(0, Math.min(prey.population - refugeCount, Math.floor(prey.population * maxKillFraction)));
    if (removable <= 0 || avgWeight <= 0) continue;
    const preferenceShare = entry.prey.biomassKg * entry.weight / Math.max(0.001, weightedPreyBiomass);
    const desiredBiomass = Math.min(target, requestedKg * Math.max(0.12, preferenceShare));
    const count = Math.min(removable, Math.max(0, Math.ceil(desiredBiomass / avgWeight)));
    if (count <= 0) continue;
    const killedBiomass = removePreyIndividuals(prey, entry.species, count);
    const edible = killedBiomass * 0.78;
    const waste = killedBiomass - edible;
    consumed += edible;
    killed += count;
    target -= edible;
    depositAquaticCarrion(state, predator.occupiedNodeIds, waste * 0.35, waste * 0.65);
  }
  return { consumedKg: round3(consumed), killed };
}

export function feedAquaticPopulation(
  state: GameState,
  population: WildAquaticPopulation,
  elapsedMinutes: number,
  populations: WildAquaticPopulation[],
): AquaticFeedingResult {
  const species = WILD_AQUATIC_SPECIES[population.speciesId];
  if (!species || population.population <= 0 || elapsedMinutes <= 0) {
    return { demandKg: 0, intakeKg: 0, resourceIntakeKg: 0, preyIntakeKg: 0, foodSatisfaction: 1, preyKilled: 0 };
  }
  const days = elapsedMinutes / 1440;
  const demandKg = Math.max(0.001, population.biomassKg * species.dailyFoodFraction * days);
  const preyShare = species.trophicGuild === 'mesopredator' ? 0.78 : species.preyWeights ? 0.24 : 0;
  const prey = consumePrey(state, population, species, populations, demandKg * preyShare, days);
  const resourceDemand = Math.max(0, demandKg - prey.consumedKg);
  const resourceIntakeKg = consumeDietResources(state, population.occupiedNodeIds, species, resourceDemand);
  const intakeKg = prey.consumedKg + resourceIntakeKg;
  const satisfaction = clamp01(intakeKg / demandKg);
  population.lastFoodDemandKg = round3(demandKg);
  population.lastFoodIntakeKg = round3(intakeKg);
  return {
    demandKg: round3(demandKg),
    intakeKg: round3(intakeKg),
    resourceIntakeKg,
    preyIntakeKg: prey.consumedKg,
    foodSatisfaction: satisfaction,
    preyKilled: prey.killed,
  };
}

export function depositAquaticCarrion(
  state: GameState,
  nodeIds: string[],
  carrionKg: number,
  detritusKg = 0,
): void {
  const entries = ensureAquaticFoodWebForNodes(state, nodeIds);
  if (!entries.length) return;
  const carrionShare = Math.max(0, carrionKg) / entries.length;
  const detritusShare = Math.max(0, detritusKg) / entries.length;
  for (const entry of entries) {
    entry.carrionKg = round3(entry.carrionKg + carrionShare);
    entry.detritusKg = round3(entry.detritusKg + detritusShare);
  }
}

export function getAquaticFoodWebNodeStates(state: GameState, nodeIds?: string[]): AquaticFoodWebNodeState[] {
  const system = ensureFoodWebContainer(state);
  if (!nodeIds) return Object.values(system.aquaticFoodWebByNodeId || {});
  return nodeIds.map(id => system.aquaticFoodWebByNodeId?.[id]).filter((entry): entry is AquaticFoodWebNodeState => Boolean(entry));
}
