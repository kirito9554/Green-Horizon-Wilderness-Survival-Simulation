import type { GameState } from '../types';
import type { BuildCell, PoiBuildGrid } from '../types/buildingSimulation';
import type {
  EcologicalSubarea,
  EcologyConnection,
  EcologyDisturbanceState,
  RegionEcology,
  SignificantWildPlant,
  WildPlantPopulation,
  WorldEcologyState,
} from '../types/ecologySimulation';
import '../types/ecologySimulation';
import {
  ECOLOGY_REGION_PROFILES,
  ECOLOGY_SUBAREA_ARCHETYPES,
  WILD_FLORA_SPECIES,
  type EcologySubareaArchetype,
  type EcologyTargetProfile,
  type WildFloraSpeciesDefinition,
} from '../data/ecologyProfiles';
import {
  MAIN_WORLD_AREA_SET,
  MAIN_WORLD_START_AREA_ID,
  type MainWorldAreaId,
} from '../data/mainWorldAreas';
import { getOrCreatePoiBuildGrid } from './buildGridSystem';

const ECOLOGY_GENERATION_VERSION = 1;
const ECOLOGY_TICK_MINUTES = 30;

export interface EcologyDisturbanceInput {
  vegetationLoss?: number;
  canopyLoss?: number;
  floodDamage?: number;
  fireDamage?: number;
  stormDamage?: number;
  humanPressure?: number;
  loggingPressure?: number;
  foragingPressure?: number;
}

interface SubareaSeed {
  archetype: EcologySubareaArchetype;
  cell: BuildCell;
  index: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 1000) / 1000));
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

function average<T>(items: T[], selector: (item: T) => number): number {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

function targetCellValue(cell: BuildCell, key: keyof EcologyTargetProfile): number | undefined {
  if (key === 'canopy') return cell.canopy;
  if (key === 'moisture') return cell.moisture;
  if (key === 'waterAccess') return cell.resources.waterAccess;
  if (key === 'slope') return cell.slope;
  if (key === 'floodRisk') return cell.floodRisk;
  if (key === 'sunlight') return cell.sunlight;
  if (key === 'rocks') return cell.rocks;
  if (key === 'fertileSoil') return cell.resources.fertileSoil;
  if (key === 'vegetation') return cell.vegetation;
  return undefined;
}

function targetSubareaValue(subarea: EcologicalSubarea, cells: BuildCell[], key: keyof EcologyTargetProfile): number | undefined {
  if (key === 'canopy') return subarea.environment.canopyCover;
  if (key === 'moisture') return subarea.environment.moisture;
  if (key === 'waterAccess') return subarea.environment.waterAccess;
  if (key === 'slope') return subarea.terrain.slope;
  if (key === 'floodRisk') return subarea.terrain.floodRisk;
  if (key === 'sunlight') return subarea.environment.sunlight;
  if (key === 'rocks') return average(cells, cell => cell.rocks);
  if (key === 'fertileSoil') return average(cells, cell => cell.resources.fertileSoil);
  if (key === 'vegetation') return average(cells, cell => cell.vegetation);
  return undefined;
}

function suitabilityFromTargets(
  getValue: (key: keyof EcologyTargetProfile) => number | undefined,
  targets: EcologyTargetProfile,
  tolerance: number,
): number {
  const entries = Object.entries(targets) as Array<[keyof EcologyTargetProfile, number]>;
  if (!entries.length) return 0.5;
  let total = 0;
  let used = 0;
  for (const [key, target] of entries) {
    const value = getValue(key);
    if (value === undefined) continue;
    const effectiveTolerance = key === 'slope' ? Math.max(8, tolerance * 0.55) : Math.max(10, tolerance);
    total += Math.max(0, 1 - Math.abs(value - target) / effectiveTolerance);
    used++;
  }
  return used ? total / used : 0.5;
}

function archetypeSuitability(cell: BuildCell, archetype: EcologySubareaArchetype): number {
  return suitabilityFromTargets(key => targetCellValue(cell, key), archetype.targets, archetype.tolerance);
}

function floraSuitability(subarea: EcologicalSubarea, cells: BuildCell[], flora: WildFloraSpeciesDefinition): number {
  return suitabilityFromTargets(key => targetSubareaValue(subarea, cells, key), flora.targets, flora.tolerance);
}

function chooseWeightedArchetypes(poiId: MainWorldAreaId, random: () => number): EcologySubareaArchetype[] {
  const profile = ECOLOGY_REGION_PROFILES[poiId];
  const desiredCount = profile.minSubareas + Math.floor(random() * (profile.maxSubareas - profile.minSubareas + 1));
  const selected: EcologySubareaArchetype[] = [];
  const counts: Record<string, number> = {};

  for (const weighted of profile.archetypes) {
    const min = weighted.minCount || 0;
    for (let i = 0; i < min && selected.length < desiredCount; i++) {
      const archetype = ECOLOGY_SUBAREA_ARCHETYPES[weighted.archetypeId];
      if (archetype) {
        selected.push(archetype);
        counts[weighted.archetypeId] = (counts[weighted.archetypeId] || 0) + 1;
      }
    }
  }

  let guard = 0;
  while (selected.length < desiredCount && guard++ < 200) {
    const eligible = profile.archetypes.filter(entry => (counts[entry.archetypeId] || 0) < (entry.maxCount ?? 2));
    if (!eligible.length) break;
    const totalWeight = eligible.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * totalWeight;
    let choice = eligible[eligible.length - 1];
    for (const entry of eligible) {
      roll -= entry.weight;
      if (roll <= 0) { choice = entry; break; }
    }
    const archetype = ECOLOGY_SUBAREA_ARCHETYPES[choice.archetypeId];
    if (!archetype) continue;
    selected.push(archetype);
    counts[choice.archetypeId] = (counts[choice.archetypeId] || 0) + 1;
  }

  return selected;
}

function chooseSubareaSeeds(grid: PoiBuildGrid, archetypes: EcologySubareaArchetype[], random: () => number): SubareaSeed[] {
  const unused = new Set(grid.cells.map(cell => cell.id));
  const seeds: SubareaSeed[] = [];
  archetypes.forEach((archetype, index) => {
    const candidates = grid.cells
      .filter(cell => unused.has(cell.id))
      .map(cell => ({ cell, score: archetypeSuitability(cell, archetype) + random() * 0.16 }))
      .sort((a, b) => b.score - a.score);
    const chosen = candidates[0]?.cell || grid.cells[index % grid.cells.length];
    if (!chosen) return;
    unused.delete(chosen.id);
    seeds.push({ archetype, cell: chosen, index });
  });
  return seeds;
}

function assignCellsToSeeds(grid: PoiBuildGrid, seeds: SubareaSeed[]): Map<number, BuildCell[]> {
  const assignments = new Map<number, BuildCell[]>();
  for (const seed of seeds) assignments.set(seed.index, []);

  for (const cell of grid.cells) {
    let bestSeed = seeds[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const seed of seeds) {
      const distance = Math.abs(cell.row - seed.cell.row) + Math.abs(cell.column - seed.cell.column);
      const mismatch = 1 - archetypeSuitability(cell, seed.archetype);
      const score = distance + mismatch * 2.8;
      if (score < bestScore) {
        bestScore = score;
        bestSeed = seed;
      }
    }
    assignments.get(bestSeed.index)!.push(cell);
  }

  // Guarantee every selected archetype owns at least its deterministic seed cell.
  for (const seed of seeds) {
    const currentOwner = [...assignments.entries()].find(([, cells]) => cells.some(cell => cell.id === seed.cell.id));
    if (currentOwner && currentOwner[0] !== seed.index) {
      assignments.set(currentOwner[0], currentOwner[1].filter(cell => cell.id !== seed.cell.id));
      assignments.get(seed.index)!.push(seed.cell);
    }
  }
  return assignments;
}

function buildSubarea(
  state: GameState,
  poiId: MainWorldAreaId,
  seed: SubareaSeed,
  cells: BuildCell[],
  regionSeed: number,
): EcologicalSubarea {
  const archetype = seed.archetype;
  const areaM2 = cells.reduce((sum, cell) => sum + cell.areaM2, 0);
  const bias = archetype.resourceBias || {};
  const avgFertility = average(cells, cell => cell.resources.fertileSoil);
  const avgVegetation = average(cells, cell => cell.vegetation);
  const avgWildlife = average(cells, cell => cell.wildlifeTraffic);
  const avgMoisture = average(cells, cell => cell.moisture);
  const avgCanopy = average(cells, cell => cell.canopy);
  const idHash = hashString(`${regionSeed}:${archetype.id}:${seed.index}`); 
  return {
    id: `eco_${poiId}_${seed.index}_${idHash.toString(36)}`,
    poiId,
    archetypeId: archetype.id,
    kind: archetype.kind,
    name: archetype.name,
    cellIds: cells.map(cell => cell.id),
    areaM2,
    materializationState: 'latent',
    discovered: false,
    terrain: {
      elevation: average(cells, cell => cell.elevation),
      slope: average(cells, cell => cell.slope),
      drainage: average(cells, cell => cell.drainage),
      floodRisk: average(cells, cell => cell.floodRisk),
      soilDepth: clamp(68 - average(cells, cell => cell.rocks) * 0.45 + avgFertility * 0.25),
    },
    environment: {
      canopyCover: avgCanopy,
      sunlight: average(cells, cell => cell.sunlight),
      humidity: clamp(42 + avgMoisture * 0.52 + avgCanopy * 0.16),
      moisture: avgMoisture,
      windExposure: average(cells, cell => cell.windExposure),
      waterAccess: average(cells, cell => cell.resources.waterAccess),
    },
    resources: {
      fruitPotential: clamp(avgFertility * 0.4 + avgVegetation * 0.34 + (bias.fruit || 0)),
      ediblePlantPotential: clamp(avgFertility * 0.45 + avgVegetation * 0.3 + (bias.edible || 0)),
      medicinalPlantPotential: clamp(avgFertility * 0.32 + avgMoisture * 0.2 + avgCanopy * 0.18 + (bias.medicinal || 0)),
      timberPotential: clamp(average(cells, cell => cell.resources.timberYield) * 0.65 + avgCanopy * 0.2 + (bias.timber || 0)),
      freshwaterPotential: clamp(average(cells, cell => cell.resources.waterAccess) * 0.72 + (bias.freshwater || 0)),
    },
    ecology: {
      biomass: clamp(avgVegetation * 0.58 + avgCanopy * 0.34 + avgFertility * 0.08),
      plantDiversity: clamp(avgVegetation * 0.42 + avgFertility * 0.34 + avgMoisture * 0.12 + (100 - Math.abs(50 - avgCanopy)) * 0.12),
      preyDensity: clamp(avgWildlife * 0.7 + avgVegetation * 0.3),
      predatorPressure: clamp(avgWildlife * 0.26),
      decompositionRate: clamp(avgMoisture * 0.46 + avgVegetation * 0.24 + 24),
      diseasePressure: clamp(avgMoisture * 0.32 + avgVegetation * 0.14),
    },
    disturbance: {
      floodDamage: 0,
      fireDamage: 0,
      stormDamage: 0,
      humanPressure: poiId === MAIN_WORLD_START_AREA_ID ? 18 : 0,
      loggingPressure: 0,
      foragingPressure: 0,
    },
    plantPopulationIds: [],
    generatedAtGameMinute: gameMinute(state),
  };
}

function subareaCentroid(grid: PoiBuildGrid, subarea: EcologicalSubarea): { row: number; column: number } {
  const cells = subarea.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter((cell): cell is BuildCell => Boolean(cell));
  return { row: average(cells, cell => cell.row), column: average(cells, cell => cell.column) };
}

function buildConnections(grid: PoiBuildGrid, poiId: MainWorldAreaId, subareas: EcologicalSubarea[]): EcologyConnection[] {
  if (subareas.length <= 1) return [];
  const centroids = new Map(subareas.map(subarea => [subarea.id, subareaCentroid(grid, subarea)]));
  const connected = new Set<string>([subareas[0].id]);
  const remaining = new Set(subareas.slice(1).map(subarea => subarea.id));
  const result: EcologyConnection[] = [];

  while (remaining.size) {
    let best: { from: EcologicalSubarea; to: EcologicalSubarea; distance: number } | undefined;
    for (const fromId of connected) {
      const from = subareas.find(entry => entry.id === fromId)!;
      const a = centroids.get(from.id)!;
      for (const toId of remaining) {
        const to = subareas.find(entry => entry.id === toId)!;
        const b = centroids.get(to.id)!;
        const distance = Math.hypot(a.row - b.row, a.column - b.column);
        if (!best || distance < best.distance) best = { from, to, distance };
      }
    }
    if (!best) break;
    const fromCells = best.from.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter((cell): cell is BuildCell => Boolean(cell));
    const toCells = best.to.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter((cell): cell is BuildCell => Boolean(cell));
    const slopeBarrier = clamp((average(fromCells, c => c.slope) + average(toCells, c => c.slope)) / 2);
    const vegetationBarrier = clamp((average(fromCells, c => c.vegetation) + average(toCells, c => c.vegetation)) / 2);
    const waterBarrier = clamp((average(fromCells, c => c.floodRisk) + average(toCells, c => c.floodRisk)) / 2);
    const distanceM = Math.max(grid.cellSizeM, best.distance * grid.cellSizeM);
    result.push({
      id: `ecolink_${hashString(`${poiId}:${best.from.id}:${best.to.id}`).toString(36)}`,
      poiId,
      fromSubareaId: best.from.id,
      toSubareaId: best.to.id,
      distanceM,
      movementCost: Math.max(1, distanceM * (1 + slopeBarrier / 180 + vegetationBarrier / 260 + waterBarrier / 300)),
      waterBarrier,
      slopeBarrier,
      vegetationBarrier,
      visibility: clamp(100 - vegetationBarrier * 0.58 - best.from.environment.canopyCover * 0.22),
    });
    connected.add(best.to.id);
    remaining.delete(best.to.id);
  }
  return result;
}

export function createWorldEcologyState(): WorldEcologyState {
  return {
    version: 1,
    regionsByPoiId: {},
    subareasById: {},
    connections: [],
    plantPopulations: [],
    significantPlants: [],
    ecologyTickIndex: 0,
  };
}

export function ensureWorldEcology(state: GameState): WorldEcologyState {
  state.ecologySystem ||= createWorldEcologyState();
  state.ecologySystem.version = Math.max(1, state.ecologySystem.version || 1);
  state.ecologySystem.regionsByPoiId ||= {};
  state.ecologySystem.subareasById ||= {};
  state.ecologySystem.connections ||= [];
  state.ecologySystem.plantPopulations ||= [];
  state.ecologySystem.significantPlants ||= [];
  state.ecologySystem.ecologyTickIndex ||= 0;
  return state.ecologySystem;
}

export function ensureRegionEcology(state: GameState, poiId: string): RegionEcology | undefined {
  if (!MAIN_WORLD_AREA_SET.has(poiId)) return undefined;
  const canonicalPoiId = poiId as MainWorldAreaId;
  const system = ensureWorldEcology(state);
  const existing = system.regionsByPoiId[canonicalPoiId];
  if (existing?.generationVersion === ECOLOGY_GENERATION_VERSION) return existing;

  const profile = ECOLOGY_REGION_PROFILES[canonicalPoiId];
  const grid = getOrCreatePoiBuildGrid(state, canonicalPoiId);
  const worldSeed = state.buildingSimulation?.worldSeed || 'ecology_fallback_world';
  const generationSeed = hashString(`${worldSeed}:${canonicalPoiId}:ecology:v${ECOLOGY_GENERATION_VERSION}`);
  const random = mulberry32(generationSeed);
  const archetypes = chooseWeightedArchetypes(canonicalPoiId, random);
  const seeds = chooseSubareaSeeds(grid, archetypes, random);
  const assignments = assignCellsToSeeds(grid, seeds);
  const subareas = seeds
    .map(seed => buildSubarea(state, canonicalPoiId, seed, assignments.get(seed.index) || [], generationSeed))
    .filter(subarea => subarea.cellIds.length > 0);
  const connections = buildConnections(grid, canonicalPoiId, subareas);

  for (const subarea of subareas) system.subareasById[subarea.id] = subarea;
  system.connections.push(...connections);
  const region: RegionEcology = {
    poiId: canonicalPoiId,
    generationVersion: ECOLOGY_GENERATION_VERSION,
    generationSeed,
    profileId: profile.id,
    subareaIds: subareas.map(subarea => subarea.id),
    connectionIds: connections.map(connection => connection.id),
    discoveredSubareaIds: [],
    humanPressure: canonicalPoiId === MAIN_WORLD_START_AREA_ID ? 18 : 0,
    huntingPressure: 0,
    fishingPressure: 0,
    loggingPressure: 0,
    biodiversityIndex: profile.biodiversityPotential,
    productivity: profile.productivity,
    lastEcologyTickGameMinute: gameMinute(state),
  };
  system.regionsByPoiId[canonicalPoiId] = region;
  return region;
}

function createSignificantPlant(
  population: WildPlantPopulation,
  flora: WildFloraSpeciesDefinition,
  random: () => number,
  index: number,
): SignificantWildPlant {
  const maturityRoll = random();
  return {
    id: `wildplant_${hashString(`${population.id}:${index}`).toString(36)}`,
    speciesId: flora.id,
    poiId: population.poiId,
    subareaId: population.subareaId,
    sourcePopulationId: population.id,
    ageHours: Math.round((900 + random() * 18000) * (flora.form === 'tree' || flora.form === 'palm' ? 6 : 1)),
    health: clamp(72 + random() * 26),
    biomassKg: Math.max(0.2, flora.baseBiomassKg * (0.5 + random() * 0.8) / Math.max(1, population.estimatedIndividuals * 0.22)),
    reproductiveState: maturityRoll < 0.18 ? 'juvenile' : maturityRoll < 0.72 ? 'mature' : maturityRoll < 0.87 ? 'flowering' : 'fruiting',
    genetics: {
      vigor: clamp(42 + random() * 48),
      moistureTolerance: clamp(35 + random() * 58),
      yieldPotential: clamp(36 + random() * 58),
    },
  };
}

export function materializeEcologySubarea(state: GameState, subareaId: string): EcologicalSubarea | undefined {
  const system = ensureWorldEcology(state);
  const subarea = system.subareasById[subareaId];
  if (!subarea) return undefined;
  if (subarea.materializationState === 'materialized') return subarea;

  const profile = ECOLOGY_REGION_PROFILES[subarea.poiId];
  const grid = getOrCreatePoiBuildGrid(state, subarea.poiId);
  const cells = subarea.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter((cell): cell is BuildCell => Boolean(cell));
  const seed = hashString(`${system.regionsByPoiId[subarea.poiId]?.generationSeed || 0}:${subarea.id}:flora:v1`);
  const random = mulberry32(seed);
  const candidates = profile.flora
    .map(weighted => {
      const flora = WILD_FLORA_SPECIES[weighted.speciesId];
      const suitability = flora ? floraSuitability(subarea, cells, flora) : 0;
      return { flora, weight: weighted.weight, suitability, roll: random() };
    })
    .filter(entry => entry.flora && (entry.suitability > 0.18 || entry.flora.id === 'FLORA_GROUND_GUILD'))
    .sort((a, b) => (b.suitability * b.weight + b.roll * 0.2) - (a.suitability * a.weight + a.roll * 0.2));

  const desiredSpecies = Math.min(candidates.length, Math.max(2, Math.round(2 + subarea.ecology.plantDiversity / 28 + random() * 1.5)));
  for (const entry of candidates.slice(0, desiredSpecies)) {
    const flora = entry.flora!;
    const fit = Math.max(0.12, entry.suitability);
    const areaFactor = Math.max(0.15, subarea.areaM2 / 100);
    const biomassKg = Math.max(0.5, flora.baseBiomassKg * areaFactor * (0.5 + fit * 0.75) * (0.82 + random() * 0.36));
    const estimatedIndividuals = Math.max(1, Math.round(flora.densityPer100M2 * areaFactor * (0.45 + fit * 0.85)));
    const matureRatio = clamp(48 + random() * 34, 5, 92) / 100;
    const population: WildPlantPopulation = {
      id: `wildpop_${hashString(`${subarea.id}:${flora.id}`).toString(36)}`,
      speciesId: flora.id,
      poiId: subarea.poiId,
      subareaId: subarea.id,
      biomassKg: Math.round(biomassKg * 100) / 100,
      estimatedIndividuals,
      juvenileRatio: clamp(18 + random() * 34, 5, 75) / 100,
      matureRatio,
      health: clamp(68 + fit * 25 + random() * 6),
      regeneration: clamp(45 + fit * 42 + random() * 8),
      fruitBiomassKg: Math.round(biomassKg * flora.fruitKgPer100Biomass / 100 * (0.45 + random() * 0.8) * 100) / 100,
      seedBank: clamp(30 + fit * 52 + random() * 12),
      geneticDiversity: clamp(54 + random() * 38),
      lastUpdatedGameMinute: gameMinute(state),
    };
    system.plantPopulations.push(population);
    subarea.plantPopulationIds.push(population.id);

    if (flora.significantIndividualChance > 0 && random() < flora.significantIndividualChance * Math.min(3, Math.sqrt(estimatedIndividuals))) {
      const count = random() < flora.significantIndividualChance * 0.25 ? 2 : 1;
      for (let i = 0; i < count; i++) system.significantPlants.push(createSignificantPlant(population, flora, random, i));
    }
  }

  subarea.materializationState = 'materialized';
  return subarea;
}

export function discoverEcologySubarea(state: GameState, subareaId: string): EcologicalSubarea | undefined {
  const subarea = materializeEcologySubarea(state, subareaId);
  if (!subarea) return undefined;
  const region = ensureWorldEcology(state).regionsByPoiId[subarea.poiId];
  subarea.discovered = true;
  if (region && !region.discoveredSubareaIds.includes(subarea.id)) region.discoveredSubareaIds.push(subarea.id);
  return subarea;
}

export function applyEcologyDisturbance(state: GameState, subareaId: string, input: EcologyDisturbanceInput): void {
  const system = ensureWorldEcology(state);
  const subarea = system.subareasById[subareaId];
  if (!subarea) return;
  const grid = getOrCreatePoiBuildGrid(state, subarea.poiId);
  const vegetationLoss = clamp(input.vegetationLoss || 0);
  const canopyLoss = clamp(input.canopyLoss || 0);
  const pressureUpdates: Array<[keyof EcologyDisturbanceState, number | undefined]> = [
    ['floodDamage', input.floodDamage],
    ['fireDamage', input.fireDamage],
    ['stormDamage', input.stormDamage],
    ['humanPressure', input.humanPressure],
    ['loggingPressure', input.loggingPressure],
    ['foragingPressure', input.foragingPressure],
  ];
  for (const [key, amount] of pressureUpdates) {
    if (amount === undefined) continue;
    subarea.disturbance[key] = clamp(subarea.disturbance[key] + amount);
  }

  for (const cellId of subarea.cellIds) {
    const cell = grid.cells.find(candidate => candidate.id === cellId);
    if (!cell) continue;
    cell.vegetation = clamp(cell.vegetation - vegetationLoss);
    cell.canopy = clamp(cell.canopy - canopyLoss);
    cell.sunlight = clamp(cell.sunlight + canopyLoss * 0.55);
    if (input.humanPressure) cell.wildlifeTraffic = clamp(cell.wildlifeTraffic - input.humanPressure * 0.18);
  }

  subarea.environment.canopyCover = clamp(subarea.environment.canopyCover - canopyLoss);
  subarea.environment.sunlight = clamp(subarea.environment.sunlight + canopyLoss * 0.55);
  subarea.ecology.biomass = clamp(subarea.ecology.biomass - vegetationLoss * 0.58 - canopyLoss * 0.32);
  subarea.ecology.plantDiversity = clamp(subarea.ecology.plantDiversity - vegetationLoss * 0.18 - canopyLoss * 0.08);
  subarea.ecology.preyDensity = clamp(subarea.ecology.preyDensity - (input.humanPressure || 0) * 0.24);

  const severity = Math.max(vegetationLoss, canopyLoss, input.fireDamage || 0, input.loggingPressure || 0) / 100;
  for (const population of system.plantPopulations.filter(pop => pop.subareaId === subareaId)) {
    population.biomassKg = Math.max(0, population.biomassKg * (1 - severity * 0.7));
    population.health = clamp(population.health - severity * 28);
    population.regeneration = clamp(population.regeneration - severity * 18);
    population.fruitBiomassKg = Math.max(0, population.fruitBiomassKg * (1 - severity));
  }
  const region = system.regionsByPoiId[subarea.poiId];
  if (region) {
    region.humanPressure = clamp(region.humanPressure + (input.humanPressure || 0) * 0.18);
    region.loggingPressure = clamp(region.loggingPressure + (input.loggingPressure || 0) * 0.2);
  }
}

function tickPlantPopulation(state: GameState, population: WildPlantPopulation, elapsedMinutes: number): void {
  const system = ensureWorldEcology(state);
  const subarea = system.subareasById[population.subareaId];
  const flora = WILD_FLORA_SPECIES[population.speciesId];
  if (!subarea || !flora || elapsedMinutes <= 0) return;
  const days = elapsedMinutes / 1440;
  const stress = clamp(
    100
      - subarea.disturbance.humanPressure * 0.32
      - subarea.disturbance.fireDamage * 0.7
      - subarea.disturbance.loggingPressure * 0.45,
  ) / 100;
  const moistureFit = Math.max(0.15, 1 - Math.abs(subarea.environment.moisture - (flora.targets.moisture ?? subarea.environment.moisture)) / Math.max(25, flora.tolerance));
  const growthFraction = flora.growthPerDay * days * stress * moistureFit * (0.35 + population.regeneration / 150);
  const softCapacity = Math.max(1, subarea.areaM2 / 100 * flora.baseBiomassKg * 2.4);
  const capacityFactor = Math.max(0, 1 - population.biomassKg / softCapacity);
  population.biomassKg = Math.max(0, population.biomassKg * (1 + growthFraction * capacityFactor));
  population.health = clamp(population.health + (stress * moistureFit - 0.55) * days * 3);
  population.seedBank = clamp(population.seedBank + flora.seedBankRate * days * stress);
  population.fruitBiomassKg = Math.max(0, population.fruitBiomassKg + population.biomassKg * flora.fruitKgPer100Biomass / 100 * days * 0.08 * stress);
  population.estimatedIndividuals = Math.max(0, Math.round(population.estimatedIndividuals * (1 + growthFraction * capacityFactor * 0.18)));
  population.lastUpdatedGameMinute = gameMinute(state);
}

export function tickWorldEcology(state: GameState, _deltaGameMinutes: number): void {
  const system = ensureWorldEcology(state);
  if (!system.regionsByPoiId[MAIN_WORLD_START_AREA_ID]) {
    const startRegion = ensureRegionEcology(state, MAIN_WORLD_START_AREA_ID);
    if (startRegion?.subareaIds.length) {
      const grid = getOrCreatePoiBuildGrid(state, MAIN_WORLD_START_AREA_ID);
      const centerRow = (grid.rows - 1) / 2;
      const centerColumn = (grid.columns - 1) / 2;
      const nearest = startRegion.subareaIds
        .map(id => system.subareasById[id])
        .filter(Boolean)
        .sort((a, b) => {
          const ca = subareaCentroid(grid, a);
          const cb = subareaCentroid(grid, b);
          return Math.hypot(ca.row - centerRow, ca.column - centerColumn) - Math.hypot(cb.row - centerRow, cb.column - centerColumn);
        })[0];
      if (nearest) discoverEcologySubarea(state, nearest.id);
    }
  }

  const now = gameMinute(state);
  let advancedAny = false;
  for (const region of Object.values(system.regionsByPoiId).filter((entry): entry is RegionEcology => Boolean(entry))) {
    const elapsed = Math.max(0, now - region.lastEcologyTickGameMinute);
    if (elapsed < ECOLOGY_TICK_MINUTES) continue;
    const rain = state.weather.current === 'storm' ? 1 : state.weather.current === 'heavy_rain' ? 0.82 : state.weather.current === 'light_rain' ? 0.4 : 0;
    for (const subareaId of region.subareaIds) {
      const subarea = system.subareasById[subareaId];
      if (!subarea || subarea.materializationState !== 'materialized') continue;
      const targetMoisture = clamp(state.weather.humidityPercent * 0.55 + rain * 44 + subarea.environment.waterAccess * 0.2);
      const blend = Math.min(0.18, elapsed / 1440 * 0.22);
      subarea.environment.moisture = clamp(subarea.environment.moisture + (targetMoisture - subarea.environment.moisture) * blend);
      subarea.environment.humidity = clamp(state.weather.humidityPercent * 0.62 + subarea.environment.moisture * 0.28 + subarea.environment.canopyCover * 0.1);
      subarea.disturbance.humanPressure = clamp(subarea.disturbance.humanPressure - elapsed / 1440 * 0.12);
      subarea.disturbance.foragingPressure = clamp(subarea.disturbance.foragingPressure - elapsed / 1440 * 0.2);
      subarea.disturbance.stormDamage = clamp(subarea.disturbance.stormDamage - elapsed / 1440 * 0.08);
    }
    for (const population of system.plantPopulations.filter(pop => pop.poiId === region.poiId)) tickPlantPopulation(state, population, elapsed);
    region.lastEcologyTickGameMinute = now;
    advancedAny = true;
  }
  if (advancedAny) system.ecologyTickIndex++;
}

export function getRegionSubareas(state: GameState, poiId: string): EcologicalSubarea[] {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return [];
  const system = ensureWorldEcology(state);
  return region.subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
}

export function getSubareaPlantPopulations(state: GameState, subareaId: string): WildPlantPopulation[] {
  const system = ensureWorldEcology(state);
  return system.plantPopulations.filter(population => population.subareaId === subareaId);
}

export function getEcologyGenerationFingerprint(state: GameState, poiId: string): string | undefined {
  const region = ensureRegionEcology(state, poiId);
  if (!region) return undefined;
  const system = ensureWorldEcology(state);
  return region.subareaIds
    .map(id => system.subareasById[id])
    .filter(Boolean)
    .map(subarea => `${subarea.archetypeId}:${subarea.cellIds.slice().sort().join(',')}`)
    .join('|');
}
