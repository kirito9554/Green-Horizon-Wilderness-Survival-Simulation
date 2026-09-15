import type { GameState, InventoryItem, ItemQuality, SurvivorState } from '../types';
import type {
  AgricultureJob,
  AgricultureJobKind,
  AgricultureProductionRecord,
  AgricultureSystemState,
  AquaticAnimalEntity,
  AquaticHabitat,
  CultivationArea,
  PlantEntity,
  PlantLifeStage,
  TerrestrialAnimalEntity,
  TerrestrialHabitat,
} from '../types/agricultureSimulation';
import '../types/agricultureSimulation';
import {
  AQUATIC_SPECIES,
  PLANT_SPECIES,
  TERRESTRIAL_SPECIES,
} from '../data/agricultureSpecies';
import { ITEMS_DATABASE } from '../data/items';
import { getOrCreatePoiBuildGrid } from './buildGridSystem';
import { getOrCreatePoiStorage } from './inventorySystem';
import { ensureStorageSystem } from './storageSystem';
import {
  consumeJobReservations,
  rebuildJobReservationCounters,
  releaseJobReservations,
  reserveJobMaterials,
} from './jobReservationSystem';
import { formatTimeOfDay } from './timeSystem';

const CAMP_POI_ID = 'AREA_CAMP_CLEARING';
const HUGE_ACTION_SECONDS = 9_000_000_000;

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministic01(value: string): number {
  return (stableHash(value) % 10000) / 10000;
}

function rangeFactor(value: number, ideal: [number, number], tolerance = 20): number {
  if (value >= ideal[0] && value <= ideal[1]) return 1;
  const distance = value < ideal[0] ? ideal[0] - value : value - ideal[1];
  return clamp(1 - distance / Math.max(1, tolerance), 0, 1);
}

function currentWeatherRain(state: GameState): number {
  if (state.weather.current === 'storm') return 1;
  if (state.weather.current === 'heavy_rain') return 0.82;
  if (state.weather.current === 'light_rain') return 0.42;
  return state.weather.rainIntensity || 0;
}

function priorityRank(priority: string | undefined): number {
  if (priority === 'highest') return 5;
  if (priority === 'high') return 4;
  if (priority === 'normal') return 3;
  if (priority === 'low') return 2;
  return priority === 'disabled' ? 0 : 1;
}

function pickAgricultureWorker(state: GameState, preferredId?: string): SurvivorState | undefined {
  if (preferredId) {
    const preferred = state.survivors.find(s => s.id === preferredId);
    if (preferred?.currentAction.type === 'idle') return preferred;
  }
  return state.survivors
    .filter(s => s.currentAction.type === 'idle' && s.jobPriorities.gather !== 'disabled')
    .sort((a, b) => {
      const priorityDiff = priorityRank(b.jobPriorities.gather) - priorityRank(a.jobPriorities.gather);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.skills.agriculture || b.skills.foraging || 1) - (a.skills.agriculture || a.skills.foraging || 1);
    })[0];
}

function occupyWorker(worker: SurvivorState, job: AgricultureJob): void {
  worker.currentAction = {
    // Reuse the existing typed action while agriculture owns progress/completion.
    // totalSeconds is intentionally unreachable so survivorSystem never completes it.
    type: 'researching',
    description: `Nông nghiệp: ${job.kind.replace(/_/g, ' ')}`,
    targetId: job.id,
    progressSeconds: 0,
    totalSeconds: HUGE_ACTION_SECONDS,
    resultPayload: { simulationOwner: 'agriculture' },
  };
}

function releaseWorker(state: GameState, job: AgricultureJob): void {
  if (!job.assignedSurvivorId) return;
  const worker = state.survivors.find(s => s.id === job.assignedSurvivorId);
  if (worker?.currentAction.targetId === job.id) {
    worker.currentAction = {
      type: 'idle',
      description: 'Sẵn sàng nhận công việc mới',
      progressSeconds: 0,
      totalSeconds: 0,
    };
  }
  job.assignedSurvivorId = undefined;
}

export function createAgricultureSystemState(): AgricultureSystemState {
  return {
    version: 1,
    cultivationAreas: [],
    plants: [],
    terrestrialHabitats: [],
    terrestrialAnimals: [],
    aquaticHabitats: [],
    aquaticAnimals: [],
    jobs: [],
    productionHistory: [],
  };
}

export function ensureAgricultureSystem(state: GameState): AgricultureSystemState {
  state.agricultureSystem ||= createAgricultureSystemState();
  const system = state.agricultureSystem;
  system.version = Math.max(1, system.version || 1);
  system.cultivationAreas ||= [];
  system.plants ||= [];
  system.terrestrialHabitats ||= [];
  system.terrestrialAnimals ||= [];
  system.aquaticHabitats ||= [];
  system.aquaticAnimals ||= [];
  system.jobs ||= [];
  system.productionHistory ||= [];
  for (const job of system.jobs) {
    job.materialReservations ||= [];
    job.blockedReasons ||= [];
    job.materialsConsumed = Boolean(job.materialsConsumed);
  }
  return system;
}

function freeCellFraction(cell: ReturnType<typeof getOrCreatePoiBuildGrid>['cells'][number]): number {
  return Math.max(0, (cell.areaM2 - cell.reservedAreaM2) / Math.max(1, cell.areaM2));
}

function neighboringCells<T extends { row: number; column: number }>(cells: T[], origin: T): T[] {
  return cells.filter(cell => Math.abs(cell.row - origin.row) <= 1 && Math.abs(cell.column - origin.column) <= 1);
}

function reserveAreaOnCells(cells: ReturnType<typeof getOrCreatePoiBuildGrid>['cells'], areaM2: number): string[] {
  const selected: string[] = [];
  let remaining = areaM2;
  for (const cell of cells) {
    if (remaining <= 0) break;
    const available = Math.max(0, cell.areaM2 - cell.reservedAreaM2);
    if (available <= 0.5) continue;
    const take = Math.min(remaining, available);
    cell.reservedAreaM2 += take;
    selected.push(cell.id);
    remaining -= take;
  }
  if (remaining > 0.01) {
    for (const id of selected) {
      const cell = cells.find(candidate => candidate.id === id);
      if (cell) cell.reservedAreaM2 = Math.max(0, cell.reservedAreaM2 - areaM2 / selected.length);
    }
    return [];
  }
  return selected;
}

export function establishPrimitiveCultivationArea(state: GameState, poiId = CAMP_POI_ID): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const grid = getOrCreatePoiBuildGrid(next, poiId);
  const candidates = grid.cells
    .filter(cell => freeCellFraction(cell) >= 0.6 && cell.floodRisk < 82 && cell.slope < 28)
    .sort((a, b) => {
      const scoreA = a.resources.fertileSoil * 0.34 + a.sunlight * 0.24 + a.drainage * 0.14 + (100 - a.rocks) * 0.1 + (100 - a.roots) * 0.08 + (100 - a.slope * 3) * 0.1;
      const scoreB = b.resources.fertileSoil * 0.34 + b.sunlight * 0.24 + b.drainage * 0.14 + (100 - b.rocks) * 0.1 + (100 - b.roots) * 0.08 + (100 - b.slope * 3) * 0.1;
      return scoreB - scoreA;
    });
  const origin = candidates[0];
  if (!origin) return state;
  const local = neighboringCells(candidates, origin).sort((a, b) => b.resources.fertileSoil - a.resources.fertileSoil);
  const cellIds = reserveAreaOnCells(local, 30);
  if (!cellIds.length) return state;
  const cells = cellIds.map(id => grid.cells.find(cell => cell.id === id)!).filter(Boolean);
  const avg = (selector: (cell: typeof cells[number]) => number) => cells.reduce((sum, cell) => sum + selector(cell), 0) / Math.max(1, cells.length);
  const id = `cult_${poiId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  system.cultivationAreas.push({
    id,
    poiId,
    name: `Luống canh tác ${system.cultivationAreas.filter(area => area.poiId === poiId).length + 1}`,
    cellIds,
    usableAreaM2: 30,
    carePolicy: 'normal',
    soil: {
      moisture: clamp(avg(cell => cell.moisture)),
      fertility: clamp(avg(cell => cell.resources.fertileSoil)),
      organicMatter: clamp(avg(cell => cell.soilType === 'organic' ? 78 : cell.soilType === 'loam' ? 62 : 38)),
      nitrogen: clamp(avg(cell => cell.resources.fertileSoil) * 0.9),
      phosphorus: clamp(avg(cell => cell.resources.fertileSoil) * 0.82),
      potassium: clamp(avg(cell => cell.resources.fertileSoil) * 0.86),
      compaction: clamp(avg(cell => cell.compacted) * 0.6 + avg(cell => cell.rocks) * 0.2),
      erosion: clamp(avg(cell => cell.slope) * 1.7),
      contamination: 0,
    },
    plantIds: [],
    modifications: ['primitive_boundary'],
    createdAtGameMinute: gameMinute(next),
  });
  next.logs.unshift({ id: `agri_plot_${Date.now()}`, day: next.gameTime.day, timeStr: formatTimeOfDay(next.gameTime.minuteOfDay), text: 'Đã quy hoạch một luống canh tác sơ khai trên nền đất phù hợp.', type: 'success' });
  return next;
}

export function establishPrimitiveTerrestrialHabitat(state: GameState, poiId = CAMP_POI_ID): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const grid = getOrCreatePoiBuildGrid(next, poiId);
  const candidates = grid.cells
    .filter(cell => freeCellFraction(cell) >= 0.65 && cell.floodRisk < 68 && cell.slope < 24)
    .sort((a, b) => (b.drainage + (100 - b.wildlifeTraffic) + b.resources.waterAccess * 0.45) - (a.drainage + (100 - a.wildlifeTraffic) + a.resources.waterAccess * 0.45));
  const origin = candidates[0];
  if (!origin) return state;
  const local = neighboringCells(candidates, origin);
  const cellIds = reserveAreaOnCells(local, 36);
  if (!cellIds.length) return state;
  const cells = cellIds.map(id => grid.cells.find(cell => cell.id === id)!).filter(Boolean);
  const avg = (selector: (cell: typeof cells[number]) => number) => cells.reduce((sum, cell) => sum + selector(cell), 0) / Math.max(1, cells.length);
  system.terrestrialHabitats.push({
    id: `pen_${poiId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    poiId,
    name: `Bãi chăn nuôi ${system.terrestrialHabitats.filter(h => h.poiId === poiId).length + 1}`,
    cellIds,
    usableAreaM2: 36,
    carePolicy: 'normal',
    animalIds: [],
    ground: {
      vegetationBiomass: clamp(avg(cell => cell.vegetation)),
      manureLoad: 0,
      mud: clamp(avg(cell => cell.moisture) * 0.25),
      beddingQuality: 35,
      standingWater: clamp(avg(cell => cell.floodRisk) * 0.15),
      parasitePressure: 5,
    },
    modifications: ['simple_fence'],
    boundaryCondition: 72,
    predatorProtection: clamp(58 - avg(cell => cell.wildlifeTraffic) * 0.2),
    createdAtGameMinute: gameMinute(next),
  });
  return next;
}

export function establishPrimitiveAquaticHabitat(state: GameState, poiId = CAMP_POI_ID): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const grid = getOrCreatePoiBuildGrid(next, poiId);
  const candidates = grid.cells
    .filter(cell => freeCellFraction(cell) >= 0.5)
    .sort((a, b) => (b.resources.waterAccess * 0.55 + b.moisture * 0.25 + b.floodRisk * 0.2) - (a.resources.waterAccess * 0.55 + a.moisture * 0.25 + a.floodRisk * 0.2));
  const best = candidates[0];
  if (!best || best.resources.waterAccess < 42) return state;
  const local = neighboringCells(candidates, best);
  const cellIds = reserveAreaOnCells(local, 24);
  if (!cellIds.length) return state;
  const waterAccess = best.resources.waterAccess;
  const siteType = waterAccess >= 78 ? 'river_segment' : best.moisture >= 72 ? 'lake_edge' : 'pond_site';
  const flow = siteType === 'river_segment' ? clamp(55 + waterAccess * 0.35) : siteType === 'lake_edge' ? 18 : 8;
  system.aquaticHabitats.push({
    id: `aqua_${poiId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    poiId,
    name: siteType === 'river_segment' ? 'Lồng chắn đoạn sông' : siteType === 'lake_edge' ? 'Lồng ven hồ' : 'Ao nuôi sơ khai',
    siteType,
    cellIds,
    areaM2: 24,
    carePolicy: 'normal',
    aquaticAnimalIds: [],
    water: {
      temperatureC: next.weather.temperatureC - 2,
      oxygen: clamp(62 + flow * 0.25),
      turbidity: clamp(best.moisture * 0.18 + best.floodRisk * 0.18),
      wasteLoad: 0,
      pathogenLoad: 4,
      flowRate: flow,
      depthM: siteType === 'river_segment' ? 1.1 : siteType === 'lake_edge' ? 1.7 : 1.25,
      contamination: 4,
    },
    modifications: [siteType === 'pond_site' ? 'earthen_berm' : 'simple_net_barrier'],
    barrierCondition: 68,
    predatorProtection: 52,
    escapeRisk: siteType === 'river_segment' ? 28 : 18,
    createdAtGameMinute: gameMinute(next),
  });
  return next;
}

function seedRequirementForJob(job: AgricultureJob): Array<{ itemId: string; quantity: number }> {
  if (job.kind !== 'plant' || !job.speciesId) return [];
  const species = PLANT_SPECIES[job.speciesId];
  return species ? [{ itemId: species.seedItemId, quantity: Math.max(1, job.quantity || 1) }] : [];
}

function makeJob(state: GameState, kind: AgricultureJobKind, poiId: string, targetId: string, options?: { speciesId?: string; quantity?: number; survivorId?: string; payload?: AgricultureJob['payload']; totalSeconds?: number }): AgricultureJob {
  const id = `agjob_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    kind,
    status: 'waiting_worker',
    poiId,
    targetId,
    speciesId: options?.speciesId,
    quantity: options?.quantity,
    assignedSurvivorId: options?.survivorId,
    progressSeconds: 0,
    totalSeconds: options?.totalSeconds || 16,
    materialReservations: [],
    materialsConsumed: false,
    blockedReasons: [],
    payload: options?.payload,
    createdAtGameMinute: gameMinute(state),
  };
}

function reserveRequirementsForJob(state: GameState, job: AgricultureJob): void {
  const requirements = seedRequirementForJob(job);
  if (!requirements.length) {
    job.status = 'waiting_worker';
    return;
  }
  const result = reserveJobMaterials(state, 'agriculture', job.id, requirements, { kind: 'poi', areaId: job.poiId });
  job.materialReservations = result.reservations;
  if (result.missing.length) {
    job.status = 'waiting_materials';
    job.blockedReasons = result.missing.map(m => `Thiếu ${ITEMS_DATABASE[m.itemId]?.name || m.itemId} ×${m.quantity}`);
  } else {
    job.status = 'waiting_worker';
    job.blockedReasons = [];
  }
}

export function queuePlanting(state: GameState, areaId: string, speciesId: string, quantity: number, survivorId?: string): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const area = system.cultivationAreas.find(candidate => candidate.id === areaId);
  const species = PLANT_SPECIES[speciesId];
  if (!area || !species || quantity <= 0) return state;
  const occupiedArea = area.plantIds
    .map(id => system.plants.find(plant => plant.id === id))
    .filter(Boolean)
    .reduce((sum, plant) => sum + (PLANT_SPECIES[plant!.speciesId]?.spacingM2 || 1), 0);
  const maxQuantity = Math.max(0, Math.floor((area.usableAreaM2 - occupiedArea) / species.spacingM2));
  const requested = Math.min(quantity, maxQuantity);
  if (requested <= 0) return state;
  const job = makeJob(next, 'plant', area.poiId, area.id, { speciesId, quantity: requested, survivorId, totalSeconds: 8 + requested * 3 });
  reserveRequirementsForJob(next, job);
  system.jobs.push(job);
  return next;
}

export function queueAgricultureCareJob(state: GameState, kind: AgricultureJobKind, targetId: string, survivorId?: string): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const area = system.cultivationAreas.find(candidate => candidate.id === targetId);
  const terrestrial = system.terrestrialHabitats.find(candidate => candidate.id === targetId);
  const aquatic = system.aquaticHabitats.find(candidate => candidate.id === targetId);
  const poiId = area?.poiId || terrestrial?.poiId || aquatic?.poiId;
  if (!poiId) return state;
  const durations: Partial<Record<AgricultureJobKind, number>> = {
    water: 18,
    tend: 22,
    fertilize: 24,
    harvest: 28,
    collect_seed: 20,
    feed_animals: 20,
    water_animals: 18,
    clean_habitat: 30,
    collect_product: 20,
    feed_aquatic: 18,
    inspect_water: 14,
    clean_aquatic: 28,
    harvest_aquatic: 32,
  };
  system.jobs.push(makeJob(next, kind, poiId, targetId, { survivorId, totalSeconds: durations[kind] || 20 }));
  return next;
}

export function cancelAgricultureJob(state: GameState, jobId: string): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const index = system.jobs.findIndex(job => job.id === jobId);
  if (index < 0) return state;
  const job = system.jobs[index];
  if (!job.materialsConsumed) releaseJobReservations(next, job.materialReservations || []);
  releaseWorker(next, job);
  system.jobs.splice(index, 1);
  return next;
}

export function togglePauseAgricultureJob(state: GameState, jobId: string): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const job = system.jobs.find(candidate => candidate.id === jobId);
  if (!job) return state;
  if (job.status === 'paused') {
    job.status = job.materialReservations.length || !seedRequirementForJob(job).length ? 'waiting_worker' : 'waiting_materials';
  } else if (job.status !== 'completed') {
    releaseWorker(next, job);
    job.status = 'paused';
  }
  return next;
}

function geneticsFor(seed: string) {
  const variant = (offset: number) => 0.92 + deterministic01(`${seed}:${offset}`) * 0.16;
  return {
    yield: variant(1), growth: variant(2), droughtTolerance: variant(3), floodTolerance: variant(4), diseaseResistance: variant(5), quality: variant(6),
  };
}

function animalGeneticsFor(seed: string) {
  const variant = (offset: number) => 0.92 + deterministic01(`${seed}:${offset}`) * 0.16;
  return { growth: variant(1), fertility: variant(2), diseaseResistance: variant(3), feedEfficiency: variant(4), production: variant(5), temperament: variant(6) };
}

function plantStage(speciesId: string, ageHours: number): PlantLifeStage {
  const species = PLANT_SPECIES[speciesId];
  if (!species) return 'dead';
  const ratio = ageHours / Math.max(1, species.maturityHours);
  if (ratio < 0.03) return 'germinating';
  if (ratio < 0.16) return 'seedling';
  if (ratio < 0.72) return 'vegetative';
  if (ratio < 1) return 'mature';
  if (ratio < 1.08) return 'flowering';
  if (ratio < 2.4) return 'fruiting';
  return 'senescent';
}

function animalStage(ageHours: number, maturityHours: number, oldAgeHours: number) {
  if (ageHours < maturityHours * 0.16) return 'newborn' as const;
  if (ageHours < maturityHours * 0.62) return 'juvenile' as const;
  if (ageHours < maturityHours) return 'subadult' as const;
  if (ageHours < oldAgeHours) return 'adult' as const;
  return 'old' as const;
}

function addGroundOutput(state: GameState, poiId: string, itemId: string, quantity: number, quality: ItemQuality = 'standard'): boolean {
  const def = ITEMS_DATABASE[itemId];
  if (!def || quantity <= 0) return false;
  ensureStorageSystem(state);
  const inventory = getOrCreatePoiStorage(state, poiId);
  const locationId = `storage_ground_${poiId}`;
  let remaining = quantity;
  for (const item of inventory.items) {
    if (item.itemId !== itemId || item.storageLocationId !== locationId || (item.reservedQuantity || 0) > 0 || item.quantity >= def.stackSize) continue;
    const take = Math.min(remaining, def.stackSize - item.quantity);
    item.quantity += take;
    item.qualityBreakdown ||= {};
    item.qualityBreakdown[quality] = (item.qualityBreakdown[quality] || 0) + take;
    if (item.freshness !== undefined || def.freshnessMaxDays) item.freshness = Math.min(item.freshness ?? 100, 100);
    remaining -= take;
    if (remaining <= 0) break;
  }
  while (remaining > 0) {
    const take = Math.min(remaining, def.stackSize);
    const created: InventoryItem = {
      instanceId: `agri_${itemId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      itemId,
      quantity: take,
      quality,
      qualityBreakdown: { [quality]: take },
      freshness: def.freshnessMaxDays ? 100 : undefined,
      reservedQuantity: 0,
      reservedQualityBreakdown: { crude: 0, standard: 0, prime: 0, masterwork: 0 },
      storageLocationId: locationId,
      medicinePotency: def.category === 'medicine' ? 100 : undefined,
      liquidLiters: def.tags.includes('liquid') ? def.volume * take : undefined,
    };
    inventory.items.push(created);
    remaining -= take;
  }
  return true;
}

function recordProduction(state: GameState, sourceType: AgricultureProductionRecord['sourceType'], sourceId: string, itemId: string, quantity: number, poiId: string): void {
  const system = ensureAgricultureSystem(state);
  system.productionHistory.unshift({
    id: `agprod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    gameMinute: gameMinute(state), sourceType, sourceId, itemId, quantity, poiId,
  });
  if (system.productionHistory.length > 160) system.productionHistory.length = 160;
}

function completePlanting(state: GameState, job: AgricultureJob): void {
  const system = ensureAgricultureSystem(state);
  const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
  const species = job.speciesId ? PLANT_SPECIES[job.speciesId] : undefined;
  if (!area || !species) return;
  const count = Math.max(1, job.quantity || 1);
  for (let i = 0; i < count; i++) {
    const id = `plant_${species.id}_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`;
    const plant: PlantEntity = {
      id,
      speciesId: species.id,
      cultivationAreaId: area.id,
      cellId: area.cellIds[i % Math.max(1, area.cellIds.length)],
      ageHours: 0,
      lifeStage: 'seed',
      health: 92,
      stress: 4,
      rootHealth: 92,
      stemHealth: 92,
      foliageHealth: 88,
      hydration: clamp(area.soil.moisture),
      nutrientStatus: clamp(area.soil.fertility),
      pestDamage: 0,
      diseaseLoad: 0,
      floweringProgress: 0,
      fruitLoad: 0,
      seedLoad: 0,
      harvestableUnits: 0,
      genetics: geneticsFor(id),
      plantedAtGameMinute: gameMinute(state),
    };
    system.plants.push(plant);
    area.plantIds.push(id);
  }
}

function completeHarvest(state: GameState, job: AgricultureJob): void {
  const system = ensureAgricultureSystem(state);
  const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
  if (!area) return;
  const harvestable = area.plantIds
    .map(id => system.plants.find(plant => plant.id === id))
    .filter((plant): plant is PlantEntity => Boolean(plant && plant.lifeStage !== 'dead' && plant.harvestableUnits >= 0.75));
  for (const plant of harvestable) {
    const species = PLANT_SPECIES[plant.speciesId];
    if (!species) continue;
    const quantity = Math.max(1, Math.floor(plant.harvestableUnits));
    if (addGroundOutput(state, area.poiId, species.harvestItemId, quantity, plant.genetics.quality > 1.04 ? 'prime' : plant.health < 55 ? 'crude' : 'standard')) {
      recordProduction(state, 'plant', plant.id, species.harvestItemId, quantity, area.poiId);
      if (species.harvestMode === 'destructive') {
        plant.lifeStage = 'dead';
        plant.health = 0;
        plant.harvestableUnits = 0;
      } else {
        plant.harvestableUnits = 0;
        plant.fruitLoad = 0;
        plant.seedLoad = Math.max(0, plant.seedLoad - 25);
      }
    }
  }
}

function completeSeedCollection(state: GameState, job: AgricultureJob): void {
  const system = ensureAgricultureSystem(state);
  const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
  if (!area) return;
  for (const plantId of area.plantIds) {
    const plant = system.plants.find(candidate => candidate.id === plantId);
    const species = plant ? PLANT_SPECIES[plant.speciesId] : undefined;
    if (!plant || !species || plant.seedLoad < 25 || plant.lifeStage === 'dead') continue;
    const amount = Math.max(1, Math.floor(plant.seedLoad / 30));
    addGroundOutput(state, area.poiId, species.seedItemId, amount, plant.genetics.quality > 1.04 ? 'prime' : 'standard');
    recordProduction(state, 'plant', plant.id, species.seedItemId, amount, area.poiId);
    plant.seedLoad = Math.max(0, plant.seedLoad - amount * 30);
  }
}

function completeAnimalProductCollection(state: GameState, job: AgricultureJob): void {
  const system = ensureAgricultureSystem(state);
  const habitat = system.terrestrialHabitats.find(candidate => candidate.id === job.targetId);
  if (!habitat) return;
  for (const animalId of habitat.animalIds) {
    const animal = system.terrestrialAnimals.find(candidate => candidate.id === animalId);
    const species = animal ? TERRESTRIAL_SPECIES[animal.speciesId] : undefined;
    if (!animal || !species?.productItemId || !species.productIntervalHours || animal.sex !== 'female' || animal.lifeStage !== 'adult') continue;
    const ready = Math.floor(animal.productProgress / species.productIntervalHours);
    if (ready <= 0) continue;
    addGroundOutput(state, habitat.poiId, species.productItemId, ready, animal.health > 85 ? 'prime' : animal.health < 55 ? 'crude' : 'standard');
    recordProduction(state, 'animal', animal.id, species.productItemId, ready, habitat.poiId);
    animal.productProgress -= ready * species.productIntervalHours;
  }
}

function completeAquaticHarvest(state: GameState, job: AgricultureJob): void {
  const system = ensureAgricultureSystem(state);
  const habitat = system.aquaticHabitats.find(candidate => candidate.id === job.targetId);
  if (!habitat) return;
  const requested = Math.max(1, job.quantity || 4);
  const adults = habitat.aquaticAnimalIds
    .map(id => system.aquaticAnimals.find(animal => animal.id === id))
    .filter((animal): animal is AquaticAnimalEntity => Boolean(animal && animal.lifeStage === 'adult' && animal.health > 0))
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, requested);
  for (const animal of adults) {
    const species = AQUATIC_SPECIES[animal.speciesId];
    if (!species) continue;
    const amount = Math.max(1, Math.round(animal.weightKg / Math.max(0.1, species.adultWeightKg)));
    addGroundOutput(state, habitat.poiId, species.harvestItemId, amount, animal.health > 82 ? 'prime' : 'standard');
    recordProduction(state, 'aquatic', animal.id, species.harvestItemId, amount, habitat.poiId);
    habitat.aquaticAnimalIds = habitat.aquaticAnimalIds.filter(id => id !== animal.id);
    system.aquaticAnimals = system.aquaticAnimals.filter(candidate => candidate.id !== animal.id);
  }
}

function applyCompletedJob(state: GameState, job: AgricultureJob): void {
  const system = ensureAgricultureSystem(state);
  if (job.kind === 'plant') completePlanting(state, job);
  if (job.kind === 'water') {
    const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
    if (area) {
      area.soil.moisture = clamp(area.soil.moisture + 30);
      for (const id of area.plantIds) {
        const plant = system.plants.find(candidate => candidate.id === id);
        if (plant) plant.hydration = clamp(plant.hydration + 28);
      }
    }
  }
  if (job.kind === 'tend') {
    const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
    if (area) for (const id of area.plantIds) {
      const plant = system.plants.find(candidate => candidate.id === id);
      if (!plant) continue;
      plant.stress = clamp(plant.stress - 18);
      plant.pestDamage = clamp(plant.pestDamage - 14);
      plant.diseaseLoad = clamp(plant.diseaseLoad - 8);
    }
  }
  if (job.kind === 'fertilize') {
    const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
    if (area) {
      area.soil.fertility = clamp(area.soil.fertility + 18);
      area.soil.organicMatter = clamp(area.soil.organicMatter + 12);
      area.soil.nitrogen = clamp(area.soil.nitrogen + 16);
    }
  }
  if (job.kind === 'harvest') completeHarvest(state, job);
  if (job.kind === 'collect_seed') completeSeedCollection(state, job);
  if (job.kind === 'remove_dead_plant') {
    const area = system.cultivationAreas.find(candidate => candidate.id === job.targetId);
    if (area) {
      const dead = new Set(area.plantIds.filter(id => system.plants.find(plant => plant.id === id)?.lifeStage === 'dead'));
      area.plantIds = area.plantIds.filter(id => !dead.has(id));
      system.plants = system.plants.filter(plant => !dead.has(plant.id));
      area.soil.organicMatter = clamp(area.soil.organicMatter + dead.size * 0.6);
    }
  }
  if (job.kind === 'feed_animals') {
    const habitat = system.terrestrialHabitats.find(candidate => candidate.id === job.targetId);
    if (habitat) for (const id of habitat.animalIds) {
      const animal = system.terrestrialAnimals.find(candidate => candidate.id === id);
      if (animal) animal.hunger = clamp(animal.hunger - 45);
    }
  }
  if (job.kind === 'water_animals') {
    const habitat = system.terrestrialHabitats.find(candidate => candidate.id === job.targetId);
    if (habitat) for (const id of habitat.animalIds) {
      const animal = system.terrestrialAnimals.find(candidate => candidate.id === id);
      if (animal) animal.hydration = clamp(animal.hydration + 48);
    }
  }
  if (job.kind === 'clean_habitat') {
    const habitat = system.terrestrialHabitats.find(candidate => candidate.id === job.targetId);
    if (habitat) {
      const manureUnits = Math.max(0, Math.floor(habitat.ground.manureLoad / 12));
      if (manureUnits > 0) {
        addGroundOutput(state, habitat.poiId, 'ITEM_MANURE', manureUnits);
        recordProduction(state, 'animal', habitat.id, 'ITEM_MANURE', manureUnits, habitat.poiId);
      }
      habitat.ground.manureLoad = clamp(habitat.ground.manureLoad - 62);
      habitat.ground.mud = clamp(habitat.ground.mud - 18);
      habitat.ground.parasitePressure = clamp(habitat.ground.parasitePressure - 22);
    }
  }
  if (job.kind === 'collect_product') completeAnimalProductCollection(state, job);
  if (job.kind === 'feed_aquatic') {
    const habitat = system.aquaticHabitats.find(candidate => candidate.id === job.targetId);
    if (habitat) for (const id of habitat.aquaticAnimalIds) {
      const animal = system.aquaticAnimals.find(candidate => candidate.id === id);
      if (animal) animal.hunger = clamp(animal.hunger - 52);
    }
  }
  if (job.kind === 'inspect_water') {
    const habitat = system.aquaticHabitats.find(candidate => candidate.id === job.targetId);
    if (habitat) habitat.water.pathogenLoad = clamp(habitat.water.pathogenLoad - 4);
  }
  if (job.kind === 'clean_aquatic') {
    const habitat = system.aquaticHabitats.find(candidate => candidate.id === job.targetId);
    if (habitat) {
      habitat.water.wasteLoad = clamp(habitat.water.wasteLoad - 48);
      habitat.water.turbidity = clamp(habitat.water.turbidity - 18);
      habitat.water.pathogenLoad = clamp(habitat.water.pathogenLoad - 12);
    }
  }
  if (job.kind === 'harvest_aquatic') completeAquaticHarvest(state, job);
}

function tickAgricultureJobs(state: GameState, deltaGameSeconds: number): void {
  const system = ensureAgricultureSystem(state);
  for (const job of system.jobs) {
    if (job.status === 'completed' || job.status === 'paused' || job.status === 'blocked') continue;
    if (job.status === 'waiting_materials') {
      if (job.materialReservations.length) releaseJobReservations(state, job.materialReservations);
      job.materialReservations = [];
      reserveRequirementsForJob(state, job);
      if (job.status === 'waiting_materials') continue;
    }
    if (job.status === 'waiting_worker') {
      const worker = pickAgricultureWorker(state, job.assignedSurvivorId);
      if (!worker) continue;
      job.assignedSurvivorId = worker.id;
      occupyWorker(worker, job);
      job.status = 'in_progress';
    }
    if (job.status !== 'in_progress') continue;
    const worker = job.assignedSurvivorId ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId) : undefined;
    if (!worker || worker.currentAction.targetId !== job.id) {
      job.status = 'waiting_worker';
      job.assignedSurvivorId = undefined;
      continue;
    }
    if (!job.materialsConsumed && job.materialReservations.length) {
      const consumed = consumeJobReservations(state, job.materialReservations);
      if (!consumed.success) {
        releaseWorker(state, job);
        job.materialReservations = [];
        job.status = 'waiting_materials';
        job.blockedReasons = ['Nguồn giống đã thay đổi trước khi công việc bắt đầu'];
        continue;
      }
      job.materialsConsumed = true;
      job.materialReservations = [];
    }
    const skill = worker.skills.agriculture || worker.skills.foraging || 1;
    const fatiguePenalty = 1 - clamp(worker.fatigue, 0, 95) / 180;
    job.progressSeconds += deltaGameSeconds * Math.max(0.45, (0.78 + skill * 0.08) * fatiguePenalty);
    if (job.progressSeconds < job.totalSeconds) continue;
    applyCompletedJob(state, job);
    worker.skills.agriculture = (worker.skills.agriculture || 1) + 0.06;
    releaseWorker(state, job);
    job.status = 'completed';
    job.progressSeconds = job.totalSeconds;
    job.blockedReasons = [];
  }
  if (system.jobs.length > 100) system.jobs = system.jobs.filter(job => job.status !== 'completed').concat(system.jobs.filter(job => job.status === 'completed').slice(-30));
}

function tickPlants(state: GameState, deltaGameMinutes: number): void {
  const system = ensureAgricultureSystem(state);
  const rain = currentWeatherRain(state);
  const hours = deltaGameMinutes / 60;
  for (const area of system.cultivationAreas) {
    const grid = getOrCreatePoiBuildGrid(state, area.poiId);
    const cells = area.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter(Boolean) as typeof grid.cells;
    const avgSun = cells.length ? cells.reduce((sum, cell) => sum + cell.sunlight, 0) / cells.length : 65;
    const avgDrainage = cells.length ? cells.reduce((sum, cell) => sum + cell.drainage, 0) / cells.length : 55;
    const flood = cells.length ? cells.reduce((sum, cell) => sum + cell.floodRisk, 0) / cells.length : 20;
    const evaporation = Math.max(0.04, (state.weather.temperatureC - 18) * 0.006 + avgSun * 0.0015) * hours;
    area.soil.moisture = clamp(area.soil.moisture + rain * 10 * hours - evaporation);
    area.soil.erosion = clamp(area.soil.erosion + Math.max(0, rain - 0.55) * Math.max(0, 60 - avgDrainage) * 0.004 * hours);
    area.soil.compaction = clamp(area.soil.compaction + Math.max(0, area.plantIds.length - area.usableAreaM2) * 0.0004 * hours);

    for (const plantId of area.plantIds) {
      const plant = system.plants.find(candidate => candidate.id === plantId);
      const species = plant ? PLANT_SPECIES[plant.speciesId] : undefined;
      if (!plant || !species || plant.lifeStage === 'dead') continue;
      plant.ageHours += hours;
      plant.lifeStage = plantStage(plant.speciesId, plant.ageHours);
      const temperatureFactor = rangeFactor(state.weather.temperatureC, species.idealTemperatureC, 13);
      const waterTolerance = area.soil.moisture < species.idealMoisture[0]
        ? species.droughtTolerance
        : area.soil.moisture > species.idealMoisture[1]
          ? species.floodTolerance
          : 100;
      const waterFactor = area.soil.moisture >= species.idealMoisture[0] && area.soil.moisture <= species.idealMoisture[1]
        ? 1
        : clamp(0.25 + waterTolerance / 135, 0.25, 0.95);
      const lightFactor = rangeFactor(avgSun, species.idealSunlight, 40);
      const nutrientFactor = clamp((area.soil.fertility + area.soil.nitrogen + area.soil.phosphorus + area.soil.potassium) / 400, 0.2, 1);
      const densityArea = area.plantIds.reduce((sum, id) => {
        const candidate = system.plants.find(p => p.id === id);
        return sum + (candidate ? PLANT_SPECIES[candidate.speciesId]?.spacingM2 || 1 : 0);
      }, 0);
      const densityFactor = densityArea <= area.usableAreaM2 ? 1 : clamp(area.usableAreaM2 / densityArea, 0.45, 1);
      const diseaseFactor = 1 - clamp(plant.diseaseLoad + plant.pestDamage, 0, 140) / 190;
      const growthFactor = clamp(temperatureFactor * waterFactor * lightFactor * nutrientFactor * densityFactor * diseaseFactor * plant.genetics.growth, 0.05, 1.22);

      plant.hydration = clamp(plant.hydration + (area.soil.moisture - plant.hydration) * Math.min(1, hours * 0.2) - Math.max(0, 0.3 - waterFactor) * hours * 3);
      plant.nutrientStatus = clamp(plant.nutrientStatus + (area.soil.fertility - plant.nutrientStatus) * Math.min(1, hours * 0.08));
      const stressGain = (1 - growthFactor) * 2.6 * hours + Math.max(0, flood - species.floodTolerance) * 0.008 * hours;
      plant.stress = clamp(plant.stress + stressGain - growthFactor * 0.7 * hours);
      const humidityDisease = Math.max(0, state.weather.humidityPercent - 78) * 0.004 * hours;
      plant.diseaseLoad = clamp(plant.diseaseLoad + humidityDisease * (2 - plant.genetics.diseaseResistance) + plant.stress * 0.0008 * hours);
      plant.pestDamage = clamp(plant.pestDamage + (cells.reduce((s, cell) => s + cell.wildlifeTraffic, 0) / Math.max(1, cells.length)) * 0.0006 * hours);
      const healthDelta = (growthFactor - 0.55) * 1.2 * hours - plant.stress * 0.004 * hours - plant.diseaseLoad * 0.003 * hours;
      plant.health = clamp(plant.health + healthDelta);
      plant.rootHealth = clamp(plant.rootHealth + healthDelta * 0.6 - Math.max(0, area.soil.moisture - 92) * 0.01 * hours);
      plant.foliageHealth = clamp(plant.foliageHealth + healthDelta * 0.8 - plant.pestDamage * 0.004 * hours);
      plant.stemHealth = clamp(plant.stemHealth + healthDelta * 0.45);
      if (plant.health <= 1 || plant.rootHealth <= 1) {
        plant.lifeStage = 'dead';
        plant.health = 0;
        continue;
      }
      if (plant.lifeStage === 'flowering' || plant.lifeStage === 'fruiting') {
        plant.floweringProgress = clamp(plant.floweringProgress + growthFactor * 2.2 * hours);
        const yieldRate = species.baseYieldUnits / Math.max(1, species.fruitingHours);
        plant.harvestableUnits = Math.min(species.baseYieldUnits * 1.8, plant.harvestableUnits + yieldRate * growthFactor * plant.genetics.yield * hours);
        plant.fruitLoad = clamp(plant.fruitLoad + yieldRate * 10 * growthFactor * hours);
        plant.seedLoad = clamp(plant.seedLoad + growthFactor * 0.9 * hours);
      }
      const uptake = species.nutrientDemand / 100 * 0.012 * growthFactor * hours;
      area.soil.fertility = clamp(area.soil.fertility - uptake);
      area.soil.nitrogen = clamp(area.soil.nitrogen - uptake * 0.9);
      area.soil.phosphorus = clamp(area.soil.phosphorus - uptake * 0.55);
      area.soil.potassium = clamp(area.soil.potassium - uptake * 0.72);
    }
  }
}

function tickTerrestrialAnimals(state: GameState, deltaGameMinutes: number): void {
  const system = ensureAgricultureSystem(state);
  const hours = deltaGameMinutes / 60;
  const rain = currentWeatherRain(state);
  for (const habitat of system.terrestrialHabitats) {
    const grid = getOrCreatePoiBuildGrid(state, habitat.poiId);
    const cells = habitat.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter(Boolean) as typeof grid.cells;
    const avgDrainage = cells.length ? cells.reduce((sum, cell) => sum + cell.drainage, 0) / cells.length : 55;
    const wildlife = cells.length ? cells.reduce((sum, cell) => sum + cell.wildlifeTraffic, 0) / cells.length : 25;
    habitat.ground.vegetationBiomass = clamp(habitat.ground.vegetationBiomass + (rain * 1.2 + 0.14) * hours);
    habitat.ground.mud = clamp(habitat.ground.mud + rain * Math.max(0, 75 - avgDrainage) * 0.03 * hours - avgDrainage * 0.002 * hours);
    habitat.ground.standingWater = clamp(habitat.ground.standingWater + rain * Math.max(0, 65 - avgDrainage) * 0.02 * hours - 0.4 * hours);
    habitat.ground.parasitePressure = clamp(habitat.ground.parasitePressure + (habitat.ground.manureLoad * 0.002 + habitat.ground.mud * 0.0018) * hours);
    habitat.predatorProtection = clamp(habitat.predatorProtection - Math.max(0, wildlife - 70) * 0.0005 * hours);

    const animals = habitat.animalIds.map(id => system.terrestrialAnimals.find(animal => animal.id === id)).filter((animal): animal is TerrestrialAnimalEntity => Boolean(animal));
    const densityArea = animals.reduce((sum, animal) => sum + (TERRESTRIAL_SPECIES[animal.speciesId]?.spaceM2 || 1), 0);
    const crowding = Math.max(0, densityArea / Math.max(1, habitat.usableAreaM2) - 1);
    for (const animal of animals) {
      const species = TERRESTRIAL_SPECIES[animal.speciesId];
      if (!species || animal.lifeStage === 'dead') continue;
      animal.ageHours += hours;
      animal.lifeStage = animalStage(animal.ageHours, species.maturityHours, species.oldAgeHours);
      animal.hunger = clamp(animal.hunger + species.dailyFeedUnits / Math.max(0.05, animal.bodyWeightKg) * 32 * hours);
      animal.hydration = clamp(animal.hydration - species.dailyWaterUnits / Math.max(0.05, animal.bodyWeightKg) * 18 * hours);
      const forageNeed = species.dailyFeedUnits * hours / 24 * 6;
      if (habitat.ground.vegetationBiomass > forageNeed && !species.tags.includes('poultry')) {
        habitat.ground.vegetationBiomass = clamp(habitat.ground.vegetationBiomass - forageNeed);
        animal.hunger = clamp(animal.hunger - forageNeed * 3.5);
      }
      const tempFactor = rangeFactor(state.weather.temperatureC, species.idealTemperatureC, 15);
      animal.stress = clamp(animal.stress + crowding * 3 * hours + (1 - tempFactor) * 2 * hours + habitat.ground.mud * 0.002 * hours - 0.18 * hours);
      animal.parasiteLoad = clamp(animal.parasiteLoad + habitat.ground.parasitePressure * 0.002 * hours);
      animal.diseaseLoad = clamp(animal.diseaseLoad + (animal.parasiteLoad + habitat.ground.manureLoad) * 0.0008 * hours / animal.genetics.diseaseResistance);
      const healthDelta = 0.08 * hours - Math.max(0, animal.hunger - 70) * 0.008 * hours - Math.max(0, 30 - animal.hydration) * 0.014 * hours - animal.diseaseLoad * 0.004 * hours - animal.stress * 0.002 * hours;
      animal.health = clamp(animal.health + healthDelta);
      animal.bodyCondition = clamp(animal.bodyCondition + (55 - animal.hunger) * 0.003 * hours);
      habitat.ground.manureLoad = clamp(habitat.ground.manureLoad + species.manurePerDay / 24 * hours * 8);
      if (animal.lifeStage === 'adult' && animal.sex === 'female' && species.productItemId && animal.health > 45 && animal.hunger < 75 && animal.hydration > 35) {
        animal.productProgress += hours * animal.genetics.production;
      }
      if (animal.health <= 0) animal.lifeStage = 'dead';
    }
  }
}

function tickAquaticAnimals(state: GameState, deltaGameMinutes: number): void {
  const system = ensureAgricultureSystem(state);
  const hours = deltaGameMinutes / 60;
  const rain = currentWeatherRain(state);
  for (const habitat of system.aquaticHabitats) {
    const animals = habitat.aquaticAnimalIds.map(id => system.aquaticAnimals.find(animal => animal.id === id)).filter((animal): animal is AquaticAnimalEntity => Boolean(animal));
    const densityLoad = animals.reduce((sum, animal) => sum + (AQUATIC_SPECIES[animal.speciesId]?.densityM2 || 1), 0) / Math.max(1, habitat.areaM2);
    habitat.water.temperatureC += (state.weather.temperatureC - 2 - habitat.water.temperatureC) * Math.min(1, hours * 0.04);
    habitat.water.wasteLoad = clamp(habitat.water.wasteLoad + animals.length * 0.025 * hours - habitat.water.flowRate * 0.003 * hours);
    habitat.water.turbidity = clamp(habitat.water.turbidity + rain * 2.8 * hours + habitat.water.wasteLoad * 0.002 * hours - habitat.water.flowRate * 0.002 * hours);
    habitat.water.pathogenLoad = clamp(habitat.water.pathogenLoad + habitat.water.wasteLoad * 0.003 * hours + habitat.water.temperatureC * 0.0006 * hours);
    const heatPenalty = Math.max(0, habitat.water.temperatureC - 28) * 1.5;
    habitat.water.oxygen = clamp(72 + habitat.water.flowRate * 0.25 - densityLoad * 18 - habitat.water.wasteLoad * 0.18 - heatPenalty);
    habitat.escapeRisk = clamp((100 - habitat.barrierCondition) * 0.35 + (habitat.siteType === 'river_segment' ? 14 : 5) + rain * 9);

    for (const animal of animals) {
      const species = AQUATIC_SPECIES[animal.speciesId];
      if (!species || animal.lifeStage === 'dead') continue;
      animal.ageHours += hours;
      animal.lifeStage = animalStage(animal.ageHours, species.maturityHours, species.oldAgeHours);
      animal.hunger = clamp(animal.hunger + species.dailyFeedUnits / Math.max(0.03, animal.weightKg) * 20 * hours);
      animal.oxygenStress = clamp(animal.oxygenStress + Math.max(0, species.minimumOxygen - habitat.water.oxygen) * 0.08 * hours - 0.4 * hours);
      const tempFactor = rangeFactor(habitat.water.temperatureC, species.idealTemperatureC, 10);
      animal.stress = clamp(animal.stress + (1 - tempFactor) * 2.5 * hours + animal.oxygenStress * 0.01 * hours + habitat.water.wasteLoad * 0.002 * hours - 0.15 * hours);
      animal.diseaseLoad = clamp(animal.diseaseLoad + habitat.water.pathogenLoad * 0.0015 * hours / animal.genetics.diseaseResistance);
      animal.health = clamp(animal.health + 0.05 * hours - animal.oxygenStress * 0.006 * hours - animal.diseaseLoad * 0.005 * hours - Math.max(0, animal.hunger - 78) * 0.006 * hours);
      const growth = clamp(tempFactor * (1 - animal.stress / 140) * (1 - animal.hunger / 160) * animal.genetics.growth, 0.05, 1.15);
      animal.weightKg = Math.min(species.adultWeightKg * 1.2, animal.weightKg + species.adultWeightKg / Math.max(1, species.maturityHours) * growth * hours);
      if (animal.health <= 0) animal.lifeStage = 'dead';
    }
  }
}

function maintainAutomaticCareQueue(state: GameState): void {
  const system = ensureAgricultureSystem(state);
  const activeKey = new Set(system.jobs.filter(job => job.status !== 'completed').map(job => `${job.kind}:${job.targetId}`));
  for (const area of system.cultivationAreas) {
    if (area.carePolicy === 'emergency_only') continue;
    const plants = area.plantIds.map(id => system.plants.find(plant => plant.id === id)).filter(Boolean) as PlantEntity[];
    if (area.soil.moisture < (area.carePolicy === 'intensive' ? 58 : 42) && !activeKey.has(`water:${area.id}`)) system.jobs.push(makeJob(state, 'water', area.poiId, area.id));
    if (plants.some(plant => plant.stress > 55 || plant.pestDamage > 35 || plant.diseaseLoad > 35) && !activeKey.has(`tend:${area.id}`)) system.jobs.push(makeJob(state, 'tend', area.poiId, area.id));
  }
  for (const habitat of system.terrestrialHabitats) {
    if (habitat.carePolicy === 'emergency_only') continue;
    const animals = habitat.animalIds.map(id => system.terrestrialAnimals.find(animal => animal.id === id)).filter(Boolean) as TerrestrialAnimalEntity[];
    if (animals.some(animal => animal.hunger > 65) && !activeKey.has(`feed_animals:${habitat.id}`)) system.jobs.push(makeJob(state, 'feed_animals', habitat.poiId, habitat.id));
    if (animals.some(animal => animal.hydration < 42) && !activeKey.has(`water_animals:${habitat.id}`)) system.jobs.push(makeJob(state, 'water_animals', habitat.poiId, habitat.id));
    if ((habitat.ground.manureLoad > 52 || habitat.ground.parasitePressure > 45) && !activeKey.has(`clean_habitat:${habitat.id}`)) system.jobs.push(makeJob(state, 'clean_habitat', habitat.poiId, habitat.id));
    if (animals.some(animal => {
      const species = TERRESTRIAL_SPECIES[animal.speciesId];
      return Boolean(species?.productIntervalHours && animal.productProgress >= species.productIntervalHours);
    }) && !activeKey.has(`collect_product:${habitat.id}`)) system.jobs.push(makeJob(state, 'collect_product', habitat.poiId, habitat.id));
  }
  for (const habitat of system.aquaticHabitats) {
    if (habitat.carePolicy === 'emergency_only') continue;
    const animals = habitat.aquaticAnimalIds.map(id => system.aquaticAnimals.find(animal => animal.id === id)).filter(Boolean) as AquaticAnimalEntity[];
    if (animals.some(animal => animal.hunger > 65) && !activeKey.has(`feed_aquatic:${habitat.id}`)) system.jobs.push(makeJob(state, 'feed_aquatic', habitat.poiId, habitat.id));
    if ((habitat.water.wasteLoad > 55 || habitat.water.pathogenLoad > 48) && !activeKey.has(`clean_aquatic:${habitat.id}`)) system.jobs.push(makeJob(state, 'clean_aquatic', habitat.poiId, habitat.id));
  }
}

export function introduceTerrestrialAnimal(state: GameState, habitatId: string, speciesId: string, sex: 'male' | 'female' = 'female', ageRatio = 1): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const habitat = system.terrestrialHabitats.find(candidate => candidate.id === habitatId);
  const species = TERRESTRIAL_SPECIES[speciesId];
  if (!habitat || !species) return state;
  const id = `animal_${speciesId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const animal: TerrestrialAnimalEntity = {
    id, speciesId, habitatId, sex,
    ageHours: species.maturityHours * ageRatio,
    lifeStage: ageRatio >= 1 ? 'adult' : 'juvenile',
    bodyWeightKg: species.adultWeightKg * Math.min(1, 0.35 + ageRatio * 0.65),
    bodyCondition: 72, health: 90, hunger: 28, hydration: 76, stress: 8, injury: 0, diseaseLoad: 0, parasiteLoad: 0,
    reproductiveState: ageRatio >= 1 ? 'ready' : 'immature', reproductiveProgress: 0, productProgress: 0,
    genetics: animalGeneticsFor(id), bornAtGameMinute: gameMinute(next) - species.maturityHours * ageRatio * 60,
  };
  system.terrestrialAnimals.push(animal);
  habitat.animalIds.push(id);
  return next;
}

export function stockAquaticAnimal(state: GameState, habitatId: string, speciesId: string, quantity = 1): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const habitat = system.aquaticHabitats.find(candidate => candidate.id === habitatId);
  const species = AQUATIC_SPECIES[speciesId];
  if (!habitat || !species || quantity <= 0) return state;
  for (let i = 0; i < quantity; i++) {
    const id = `aquatic_${speciesId}_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`;
    const animal: AquaticAnimalEntity = {
      id, speciesId, habitatId, sex: i % 2 === 0 ? 'female' : 'male', ageHours: species.maturityHours * 0.55,
      lifeStage: 'juvenile', weightKg: species.adultWeightKg * 0.42, health: 92, hunger: 25, stress: 6, diseaseLoad: 0, oxygenStress: 0,
      reproductiveState: 'immature', reproductiveProgress: 0, genetics: animalGeneticsFor(id), bornAtGameMinute: gameMinute(next) - species.maturityHours * 0.55 * 60,
    };
    system.aquaticAnimals.push(animal);
    habitat.aquaticAnimalIds.push(id);
  }
  return next;
}

export function setAgricultureCarePolicy(state: GameState, targetId: string, policy: CultivationArea['carePolicy']): GameState {
  const next = cloneState(state);
  const system = ensureAgricultureSystem(next);
  const target = system.cultivationAreas.find(x => x.id === targetId) || system.terrestrialHabitats.find(x => x.id === targetId) || system.aquaticHabitats.find(x => x.id === targetId);
  if (!target) return state;
  target.carePolicy = policy;
  return next;
}

export function rebuildAgricultureReservations(state: GameState): void {
  const system = ensureAgricultureSystem(state);
  for (const job of system.jobs) {
    if (job.status === 'completed' || job.materialsConsumed) {
      job.materialReservations = [];
      continue;
    }
    job.materialReservations = rebuildJobReservationCounters(state, job.materialReservations || []);
    const requires = seedRequirementForJob(job);
    if (requires.length && !job.materialReservations.length) {
      job.status = 'waiting_materials';
      job.assignedSurvivorId = undefined;
    }
    if (job.status === 'in_progress') {
      job.status = 'waiting_worker';
      job.assignedSurvivorId = undefined;
    }
  }
}

export function summarizeAgricultureOutput(state: GameState, lastMinutes = 7 * 1440): Record<string, number> {
  const system = ensureAgricultureSystem(state);
  const cutoff = gameMinute(state) - lastMinutes;
  const result: Record<string, number> = {};
  for (const record of system.productionHistory) {
    if (record.gameMinute < cutoff) continue;
    result[record.itemId] = (result[record.itemId] || 0) + record.quantity;
  }
  return result;
}

export function tickAgriculture(state: GameState, deltaGameMinutes: number, deltaGameSeconds: number): void {
  ensureAgricultureSystem(state);
  tickPlants(state, deltaGameMinutes);
  tickTerrestrialAnimals(state, deltaGameMinutes);
  tickAquaticAnimals(state, deltaGameMinutes);
  maintainAutomaticCareQueue(state);
  tickAgricultureJobs(state, deltaGameSeconds);
}
