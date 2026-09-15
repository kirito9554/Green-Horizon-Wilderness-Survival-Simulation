import type { GameState } from '../types';
import type { AquaticWaterBodySnapshot } from '../types/aquaticHydrology';
import type { WildAquaticPopulation } from '../types/aquaticEcology';
import type { RegionEcology, WorldEcologyState } from '../types/ecologySimulation';
import '../types/aquaticEcology';
import { WILD_AQUATIC_SPECIES, type WildAquaticSpeciesDefinition } from '../data/ecologyAquatic';
import { resolveMainWorldAreaId, type MainWorldAreaId } from '../data/mainWorldAreas';
import { ensureRegionEcology, ensureWorldEcology } from './ecologySystem';
import { getConnectedAquaticWaterBody, queryAquaticWaterBodies } from './aquaticHydrologySystem';

const AQUATIC_ECOLOGY_VERSION = 4;
const AQUATIC_TICK_MINUTES = 60;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value * 1000) / 1000));
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

export function ensureAquaticEcology(state: GameState): WorldEcologyState {
  const system = ensureWorldEcology(state);
  system.version = Math.max(AQUATIC_ECOLOGY_VERSION, system.version || 1);
  system.aquaticPopulations ||= [];
  for (const region of Object.values(system.regionsByPoiId)) {
    if (region && region.aquaticSeeded === undefined) region.aquaticSeeded = false;
  }
  return system;
}

function temperatureSuitability(body: AquaticWaterBodySnapshot, species: WildAquaticSpeciesDefinition): number {
  const [min, max] = species.idealTemperatureC;
  const value = body.quality.temperatureC;
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  return clamp01(1 - distance / Math.max(1, species.temperatureToleranceC));
}

export function getAquaticHabitatSuitability(body: AquaticWaterBodySnapshot, species: WildAquaticSpeciesDefinition): number {
  if (!species.preferredHabitats.includes(body.habitatType)) return 0;
  const criteria = species.hydrologyCriteria;
  if (body.meanDepthM < (criteria.minDepthM || 0) || body.meanDepthM > (criteria.maxDepthM ?? Number.POSITIVE_INFINITY)) return 0;
  if (body.meanVelocityMps < (criteria.minVelocityMps || 0) || body.meanVelocityMps > (criteria.maxVelocityMps ?? Number.POSITIVE_INFINITY)) return 0;
  if (body.quality.dissolvedOxygenMgL < (criteria.minDissolvedOxygenMgL || 0)) return 0;
  if (body.quality.salinityPpt < (criteria.minSalinityPpt || 0) || body.quality.salinityPpt > (criteria.maxSalinityPpt ?? Number.POSITIVE_INFINITY)) return 0;
  if (body.quality.turbidity > (criteria.maxTurbidity ?? 100) || body.quality.contamination > (criteria.maxContamination ?? 100)) return 0;

  const temp = temperatureSuitability(body, species);
  const oxygenFloor = criteria.minDissolvedOxygenMgL || 2;
  const oxygen = clamp01((body.quality.dissolvedOxygenMgL - oxygenFloor) / Math.max(2, 10 - oxygenFloor));
  const reliability = body.hydroperiod.reliability;
  const quality = clamp01(1 - body.quality.contamination / Math.max(20, criteria.maxContamination || 100))
    * clamp01(1 - body.quality.turbidity / Math.max(30, criteria.maxTurbidity || 100));
  return clamp01(temp * 0.28 + oxygen * 0.2 + reliability * 0.24 + quality * 0.14 + body.biologicalConnectivity * 0.14);
}

export function estimateAquaticCarryingCapacity(body: AquaticWaterBodySnapshot, species: WildAquaticSpeciesDefinition): number {
  const suitability = getAquaticHabitatSuitability(body, species);
  if (suitability <= 0 || body.currentVolumeM3 <= 0.01) return 0;
  const volumeUnits = Math.max(0.08, body.currentVolumeM3 / 100);
  const reliabilityFactor = 0.25 + body.hydroperiod.reliability * 0.75;
  const connectivityFactor = 0.65 + body.biologicalConnectivity * 0.35;
  const k = volumeUnits * species.baseDensityPer100M3 * (0.35 + suitability * 0.95) * reliabilityFactor * connectivityFactor;
  return Math.max(0, Math.min(species.maxPopulationPerBody, Math.round(k)));
}

function biomassFor(population: Pick<WildAquaticPopulation, 'juveniles' | 'adults' | 'old'>, species: WildAquaticSpeciesDefinition): number {
  return round3(species.adultWeightKg * (population.juveniles * 0.28 + population.adults + population.old * 0.82));
}

function createPopulation(
  state: GameState,
  body: AquaticWaterBodySnapshot,
  species: WildAquaticSpeciesDefinition,
  random: () => number,
): WildAquaticPopulation | undefined {
  const k = estimateAquaticCarryingCapacity(body, species);
  if (k < 2) return undefined;
  const suitability = getAquaticHabitatSuitability(body, species);
  if (suitability < 0.34) return undefined;
  const count = Math.max(2, Math.min(k, Math.round(k * (0.34 + random() * 0.34))));
  const juvenileRatio = 0.22 + random() * 0.22;
  const oldRatio = 0.04 + random() * 0.08;
  const juveniles = Math.min(count, Math.round(count * juvenileRatio));
  const old = Math.min(count - juveniles, Math.round(count * oldRatio));
  const adults = Math.max(0, count - juveniles - old);
  const sortedNodes = [...body.nodeIds].sort();
  const anchorNodeId = sortedNodes[0];
  if (!anchorNodeId) return undefined;
  const population: WildAquaticPopulation = {
    id: `aquapop_${hashString(`${species.id}:${body.id}:${anchorNodeId}`).toString(36)}`,
    speciesId: species.id,
    currentWaterBodyId: body.id,
    anchorNodeId,
    occupiedNodeIds: sortedNodes,
    poiIds: [...body.poiIds],
    population: count,
    juveniles,
    adults,
    old,
    biomassKg: 0,
    averageHealth: clamp100(72 + suitability * 22 + random() * 5),
    bodyCondition: clamp100(68 + suitability * 24 + random() * 6),
    habitatStress: clamp100((1 - suitability) * 70),
    oxygenStress: 0,
    foodStress: clamp100(Math.max(0, count / Math.max(1, k) - 0.72) * 160),
    reproductionPressure: clamp100(suitability * 70),
    migrationPressure: clamp100((1 - body.biologicalConnectivity) * 28),
    geneticDiversity: clamp100(58 + random() * 34),
    reproductionProgress: random() * 0.6,
    maturationProgress: random() * 0.5,
    agingProgress: random() * 0.3,
    mortalityProgress: random() * 0.25,
    lastUpdatedGameMinute: gameMinute(state),
  };
  population.biomassKg = biomassFor(population, species);
  return population;
}

export function ensureRegionAquaticEcology(state: GameState, areaId: string): RegionEcology | undefined {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return undefined;
  const region = ensureRegionEcology(state, poiId);
  if (!region) return undefined;
  const system = ensureAquaticEcology(state);
  if (region.aquaticSeeded) return region;

  const worldSeed = state.buildingSimulation?.worldSeed || 'aquatic_ecology_fallback';
  for (const species of Object.values(WILD_AQUATIC_SPECIES)) {
    const bodies = queryAquaticWaterBodies(state, poiId, species.hydrologyCriteria, 'biological')
      .filter(body => body.poiIds.includes(poiId))
      .filter(body => getAquaticHabitatSuitability(body, species) > 0.28)
      .sort((a, b) => b.currentVolumeM3 - a.currentVolumeM3 || a.id.localeCompare(b.id));

    for (const body of bodies) {
      const overlapsExisting = (system.aquaticPopulations || []).some(population => population.speciesId === species.id && population.occupiedNodeIds.some(nodeId => body.nodeIds.includes(nodeId)));
      if (overlapsExisting) continue;
      const suitability = getAquaticHabitatSuitability(body, species);
      const random = mulberry32(hashString(`${worldSeed}:${body.id}:${species.id}:aquatic:v1`));
      const presence = suitability >= 0.64 || random() < Math.max(0.08, suitability * 0.72 - 0.08);
      if (!presence) continue;
      const population = createPopulation(state, body, species, random);
      if (population) system.aquaticPopulations!.push(population);
    }
  }

  region.aquaticSeeded = true;
  return region;
}

function bodyForNode(state: GameState, nodeId: string, species: WildAquaticSpeciesDefinition): AquaticWaterBodySnapshot | undefined {
  const node = state.hydrologySystem?.nodesById?.[nodeId];
  if (!node) return undefined;
  return getConnectedAquaticWaterBody(state, node.poiId, nodeId, species.hydrologyCriteria, 'biological');
}

function splitPopulationByConnectivity(state: GameState, population: WildAquaticPopulation, species: WildAquaticSpeciesDefinition): WildAquaticPopulation[] {
  const bodies = new Map<string, AquaticWaterBodySnapshot>();
  for (const nodeId of population.occupiedNodeIds.length ? population.occupiedNodeIds : [population.anchorNodeId]) {
    const body = bodyForNode(state, nodeId, species);
    if (body) bodies.set(body.id, body);
  }
  if (!bodies.size) return [population];
  if (bodies.size === 1) {
    const body = [...bodies.values()][0];
    population.currentWaterBodyId = body.id;
    population.occupiedNodeIds = [...body.nodeIds];
    population.poiIds = [...body.poiIds];
    if (!body.nodeIds.includes(population.anchorNodeId)) population.anchorNodeId = body.nodeIds[0] || population.anchorNodeId;
    return [population];
  }

  const entries = [...bodies.values()].sort((a, b) => a.id.localeCompare(b.id));
  const weights = entries.map(body => Math.max(1, population.occupiedNodeIds.filter(id => body.nodeIds.includes(id)).length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let remaining = population.population;
  const result: WildAquaticPopulation[] = [];
  for (let index = 0; index < entries.length; index++) {
    const body = entries[index];
    const count = index === entries.length - 1 ? remaining : Math.min(remaining, Math.max(0, Math.round(population.population * weights[index] / totalWeight)));
    remaining -= count;
    if (count <= 0) continue;
    const ratio = count / Math.max(1, population.population);
    const juveniles = Math.min(count, Math.round(population.juveniles * ratio));
    const old = Math.min(count - juveniles, Math.round(population.old * ratio));
    const adults = Math.max(0, count - juveniles - old);
    const keepsIdentity = body.nodeIds.includes(population.anchorNodeId);
    const child: WildAquaticPopulation = {
      ...population,
      id: keepsIdentity ? population.id : `aquapop_${hashString(`${population.id}:${body.id}`).toString(36)}`,
      currentWaterBodyId: body.id,
      anchorNodeId: keepsIdentity ? population.anchorNodeId : body.nodeIds[0],
      occupiedNodeIds: [...body.nodeIds],
      poiIds: [...body.poiIds],
      population: count,
      juveniles,
      adults,
      old,
      biomassKg: 0,
      reproductionProgress: population.reproductionProgress * ratio,
      maturationProgress: population.maturationProgress * ratio,
      agingProgress: population.agingProgress * ratio,
      mortalityProgress: population.mortalityProgress * ratio,
    };
    child.biomassKg = biomassFor(child, species);
    result.push(child);
  }
  return result;
}

function mergeReconnectedPopulations(populations: WildAquaticPopulation[]): WildAquaticPopulation[] {
  const groups = new Map<string, WildAquaticPopulation[]>();
  for (const population of populations) {
    const key = `${population.speciesId}:${population.currentWaterBodyId}`;
    const group = groups.get(key) || [];
    group.push(population);
    groups.set(key, group);
  }
  const result: WildAquaticPopulation[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) { result.push(group[0]); continue; }
    group.sort((a, b) => a.id.localeCompare(b.id));
    const base = group[0];
    const total = group.reduce((sum, item) => sum + item.population, 0);
    const weighted = (selector: (item: WildAquaticPopulation) => number) => total > 0 ? group.reduce((sum, item) => sum + selector(item) * item.population, 0) / total : 0;
    base.population = total;
    base.juveniles = group.reduce((sum, item) => sum + item.juveniles, 0);
    base.adults = group.reduce((sum, item) => sum + item.adults, 0);
    base.old = Math.max(0, total - base.juveniles - base.adults);
    base.occupiedNodeIds = [...new Set(group.flatMap(item => item.occupiedNodeIds))].sort();
    base.poiIds = [...new Set(group.flatMap(item => item.poiIds))] as MainWorldAreaId[];
    base.averageHealth = clamp100(weighted(item => item.averageHealth));
    base.bodyCondition = clamp100(weighted(item => item.bodyCondition));
    base.habitatStress = clamp100(weighted(item => item.habitatStress));
    base.oxygenStress = clamp100(weighted(item => item.oxygenStress));
    base.foodStress = clamp100(weighted(item => item.foodStress));
    base.geneticDiversity = clamp100(weighted(item => item.geneticDiversity));
    base.reproductionProgress = group.reduce((sum, item) => sum + item.reproductionProgress, 0);
    base.maturationProgress = group.reduce((sum, item) => sum + item.maturationProgress, 0);
    base.agingProgress = group.reduce((sum, item) => sum + item.agingProgress, 0);
    base.mortalityProgress = group.reduce((sum, item) => sum + item.mortalityProgress, 0);
    result.push(base);
  }
  return result;
}

function removeDeaths(population: WildAquaticPopulation, deaths: number): void {
  let remaining = Math.min(deaths, population.population);
  const oldDeaths = Math.min(population.old, Math.ceil(remaining * 0.5));
  population.old -= oldDeaths; remaining -= oldDeaths;
  const juvenileDeaths = Math.min(population.juveniles, Math.ceil(remaining * 0.45));
  population.juveniles -= juvenileDeaths; remaining -= juvenileDeaths;
  const adultDeaths = Math.min(population.adults, remaining);
  population.adults -= adultDeaths; remaining -= adultDeaths;
  if (remaining > 0) {
    const extraJuveniles = Math.min(population.juveniles, remaining);
    population.juveniles -= extraJuveniles; remaining -= extraJuveniles;
  }
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
}

function tickPopulation(state: GameState, population: WildAquaticPopulation, elapsedMinutes: number): void {
  const species = WILD_AQUATIC_SPECIES[population.speciesId];
  if (!species || population.population <= 0 || elapsedMinutes <= 0) return;
  const days = elapsedMinutes / 1440;
  const body = bodyForNode(state, population.anchorNodeId, species);
  if (!body) {
    population.habitatStress = 100;
    population.oxygenStress = 100;
    population.foodStress = 100;
    population.migrationPressure = 100;
    population.bodyCondition = clamp100(population.bodyCondition - days * 18);
    population.averageHealth = clamp100(population.averageHealth - days * 14);
    population.mortalityProgress += population.population * (0.035 + species.naturalMortalityPerDay) * days;
  } else {
    population.currentWaterBodyId = body.id;
    population.occupiedNodeIds = [...body.nodeIds];
    population.poiIds = [...body.poiIds];
    const suitability = getAquaticHabitatSuitability(body, species);
    const carryingCapacity = estimateAquaticCarryingCapacity(body, species);
    const minOxygen = species.hydrologyCriteria.minDissolvedOxygenMgL || 2;
    population.oxygenStress = clamp100(Math.max(0, minOxygen - body.quality.dissolvedOxygenMgL) / Math.max(1, minOxygen) * 100);
    population.habitatStress = clamp100((1 - suitability) * 100);
    const densityRatio = population.population / Math.max(1, carryingCapacity);
    population.foodStress = clamp100(Math.max(0, densityRatio - 0.72) * 135 + Math.max(0, 0.35 - body.hydroperiod.reliability) * 55);
    population.migrationPressure = clamp100(population.habitatStress * 0.45 + population.foodStress * 0.42 + population.oxygenStress * 0.55 + (1 - body.biologicalConnectivity) * 16);

    const conditionDelta = (suitability - 0.55) * 7 - population.foodStress * 0.035 - population.oxygenStress * 0.045;
    population.bodyCondition = clamp100(population.bodyCondition + conditionDelta * days);
    population.averageHealth = clamp100(population.averageHealth + ((population.bodyCondition - 50) / 28 - population.habitatStress * 0.025 - population.oxygenStress * 0.035) * days);

    const breederDensity = population.adults >= 2 ? 1 : 0;
    const capacityFactor = carryingCapacity > 0 ? clamp01(1 - population.population / Math.max(1, carryingCapacity)) : 0;
    const reliabilityFactor = body.hydroperiod.reliability >= species.minimumBreedingReliability
      ? clamp01((body.hydroperiod.reliability - species.minimumBreedingReliability) / Math.max(0.05, 1 - species.minimumBreedingReliability))
      : 0;
    const reproductionFitness = clamp01(population.averageHealth / 100 * population.bodyCondition / 100 * (1 - population.habitatStress / 120) * (1 - population.oxygenStress / 110));
    population.reproductionPressure = clamp100(reproductionFitness * capacityFactor * reliabilityFactor * 100);
    population.reproductionProgress += population.adults * species.dailyReproductionRate * days * reproductionFitness * capacityFactor * reliabilityFactor * breederDensity;

    population.maturationProgress += population.juveniles / Math.max(30, species.maturityDays) * days * clamp01(population.averageHealth / 75);
    population.agingProgress += population.adults / Math.max(365, species.oldAgeDays) * days;

    const stressMultiplier = 1 + population.habitatStress / 45 + population.oxygenStress / 28 + population.foodStress / 55;
    const overCapacity = carryingCapacity > 0 ? Math.max(0, densityRatio - 1) : 1;
    population.mortalityProgress += population.population * species.naturalMortalityPerDay * stressMultiplier * days + population.population * overCapacity * 0.006 * days;
  }

  const matured = Math.min(population.juveniles, Math.floor(population.maturationProgress));
  if (matured > 0) {
    population.juveniles -= matured;
    population.adults += matured;
    population.maturationProgress -= matured;
  }
  const aged = Math.min(population.adults, Math.floor(population.agingProgress));
  if (aged > 0) {
    population.adults -= aged;
    population.old += aged;
    population.agingProgress -= aged;
  }
  const births = Math.max(0, Math.floor(population.reproductionProgress));
  if (births > 0) {
    population.juveniles += births;
    population.population += births;
    population.reproductionProgress -= births;
  }
  const deaths = Math.max(0, Math.floor(population.mortalityProgress));
  if (deaths > 0) {
    removeDeaths(population, deaths);
    population.mortalityProgress -= deaths;
  }
  population.population = population.juveniles + population.adults + population.old;
  population.biomassKg = biomassFor(population, species);
  population.lastUpdatedGameMinute = gameMinute(state);
}

export function tickAquaticEcology(state: GameState, _deltaGameMinutes: number): void {
  const system = ensureAquaticEcology(state);
  const hydrologyRegions = state.hydrologySystem?.regionsByPoiId || {};
  for (const region of Object.values(system.regionsByPoiId).filter((entry): entry is RegionEcology => Boolean(entry))) {
    if (hydrologyRegions[region.poiId] && !region.aquaticSeeded) ensureRegionAquaticEcology(state, region.poiId);
  }

  const now = gameMinute(state);
  let populations: WildAquaticPopulation[] = [];
  for (const population of system.aquaticPopulations || []) {
    const species = WILD_AQUATIC_SPECIES[population.speciesId];
    if (!species || population.population <= 0) continue;
    populations.push(...splitPopulationByConnectivity(state, population, species));
  }
  populations = mergeReconnectedPopulations(populations);

  for (const population of populations) {
    const elapsed = Math.max(0, now - population.lastUpdatedGameMinute);
    if (elapsed < AQUATIC_TICK_MINUTES) continue;
    tickPopulation(state, population, elapsed);
  }
  system.aquaticPopulations = populations.filter(population => population.population > 0);
}

export function getAquaticPopulations(state: GameState, areaId?: string): WildAquaticPopulation[] {
  const system = ensureAquaticEcology(state);
  const poiId = areaId ? resolveMainWorldAreaId(areaId) : undefined;
  return (system.aquaticPopulations || []).filter(population => !poiId || population.poiIds.includes(poiId));
}
