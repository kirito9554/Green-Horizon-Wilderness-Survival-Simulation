import type { GameState, ItemQuality, SurvivorState } from '../types';
import type { MaterialReservation, MaterialReservationSource } from '../types/craftingSimulation';
import type {
  ConstructionMaterialRequirement,
  ConstructionPhaseKind,
  StructureConstructionJob,
  StructureConstructionPhase,
} from '../types/buildingSimulation';
import '../types/buildingSimulation';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory, deductItemFromInventory, getAvailableInventoryStock, getOrCreatePoiStorage } from './inventorySystem';
import { consumeJobReservations, releaseJobReservations, reserveJobMaterials } from './jobReservationSystem';
import { deriveClusterStats, findStructurePlacement, reserveStructurePlacement } from './buildingClusterSystem';
import { ensureBuildingSimulation } from './buildGridSystem';
import { formatTimeOfDay } from './timeSystem';

const ACTION_SENTINEL_SECONDS = 1_000_000_000;
const QUALITY_ORDER: ItemQuality[] = ['crude', 'standard', 'prime', 'masterwork'];

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function setIdle(worker: SurvivorState): void {
  worker.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function emptyStagingInventory() {
  return { maxWeightKg: 9999, maxVolumeL: 9999, items: [] };
}

function splitInteger(total: number, weights: number[]): number[] {
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map(weight => total * weight);
  const base = raw.map(value => Math.floor(value));
  let remainder = total - base.reduce((sum, value) => sum + value, 0);
  const ranked = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const entry of ranked) {
    if (remainder <= 0) break;
    base[entry.index] += 1;
    remainder -= 1;
  }
  return base;
}

function phaseTemplates(buildingId: string): Array<{
  kind: ConstructionPhaseKind;
  name: string;
  weight: number;
  weatherSensitive?: boolean;
  requiredToolTags?: string[];
}> {
  const category = BUILDINGS_DATABASE[buildingId]?.category;
  if (buildingId === 'BUILDING_CAMPFIRE_HEARTH') {
    return [
      { kind: 'groundwork', name: 'Chuẩn bị nền bếp', weight: 0.24 },
      { kind: 'foundation', name: 'Xếp nền và vành bếp', weight: 0.36 },
      { kind: 'installation', name: 'Bố trí lõi đốt', weight: 0.25 },
      { kind: 'finish', name: 'Kiểm tra khoảng cách an toàn', weight: 0.15 },
    ];
  }
  if (category === 'shelter') {
    return [
      { kind: 'groundwork', name: 'Chuẩn bị điểm neo', weight: 0.10 },
      { kind: 'foundation', name: 'Đặt chân trụ', weight: 0.18 },
      { kind: 'frame', name: 'Dựng khung chính', weight: 0.28, requiredToolTags: ['sharp'] },
      { kind: 'binding', name: 'Buộc và gia cường khung', weight: 0.16 },
      { kind: 'cover', name: 'Lợp mái và che mưa', weight: 0.20, weatherSensitive: true },
      { kind: 'finish', name: 'Hoàn thiện và kiểm tra', weight: 0.08 },
    ];
  }
  if (category === 'storage') {
    return [
      { kind: 'groundwork', name: 'Chuẩn bị mặt kê', weight: 0.12 },
      { kind: 'frame', name: 'Dựng khung chứa', weight: 0.30, requiredToolTags: ['sharp'] },
      { kind: 'binding', name: 'Liên kết khung', weight: 0.20 },
      { kind: 'surface', name: 'Đan / lắp bề mặt chứa', weight: 0.28 },
      { kind: 'finish', name: 'Kiểm tra tải và hoàn thiện', weight: 0.10 },
    ];
  }
  if (category === 'water') {
    return [
      { kind: 'groundwork', name: 'Chuẩn bị nền thoát nước', weight: 0.14 },
      { kind: 'frame', name: 'Dựng giá đỡ', weight: 0.28, requiredToolTags: ['sharp'] },
      { kind: 'installation', name: 'Lắp bề mặt hứng và chứa', weight: 0.34, weatherSensitive: true },
      { kind: 'binding', name: 'Cố định liên kết', weight: 0.14 },
      { kind: 'finish', name: 'Kiểm tra dòng chảy', weight: 0.10 },
    ];
  }
  if (category === 'production') {
    return [
      { kind: 'groundwork', name: 'Chuẩn bị mặt làm việc', weight: 0.12 },
      { kind: 'foundation', name: 'Đặt chân chịu tải', weight: 0.18 },
      { kind: 'frame', name: 'Dựng khung bàn', weight: 0.30, requiredToolTags: ['sharp'] },
      { kind: 'surface', name: 'Lắp mặt thao tác', weight: 0.25 },
      { kind: 'installation', name: 'Lắp điểm giữ dụng cụ', weight: 0.08 },
      { kind: 'finish', name: 'Cân chỉnh và hoàn thiện', weight: 0.07 },
    ];
  }
  return [
    { kind: 'groundwork', name: 'Chuẩn bị mặt bằng', weight: 0.15 },
    { kind: 'frame', name: 'Dựng kết cấu chính', weight: 0.42 },
    { kind: 'installation', name: 'Lắp bộ phận chức năng', weight: 0.30 },
    { kind: 'finish', name: 'Hoàn thiện', weight: 0.13 },
  ];
}

function materialPhaseIndex(itemId: string, phases: ReturnType<typeof phaseTemplates>): number {
  const id = itemId.toLowerCase();
  const find = (kind: ConstructionPhaseKind) => phases.findIndex(phase => phase.kind === kind);
  if (id.includes('pebble') || id.includes('stone') || id.includes('clay')) {
    const index = find('foundation');
    return index >= 0 ? index : 0;
  }
  if (id.includes('leaf') || id.includes('thatch')) {
    const index = find('cover');
    return index >= 0 ? index : Math.max(0, phases.length - 2);
  }
  if (id.includes('vine') || id.includes('cord') || id.includes('fiber') || id.includes('rope')) {
    const index = find('binding');
    return index >= 0 ? index : Math.max(0, phases.length - 2);
  }
  if (id.includes('branch') || id.includes('wood') || id.includes('bamboo') || id.includes('log')) {
    const index = find('frame');
    return index >= 0 ? index : 1;
  }
  const install = find('installation');
  return install >= 0 ? install : Math.max(0, phases.length - 2);
}

export function deriveConstructionPhases(buildingId: string, totalSeconds: number): StructureConstructionPhase[] {
  const blueprint = BUILDINGS_DATABASE[buildingId];
  if (!blueprint) return [];
  const templates = phaseTemplates(buildingId);
  const seconds = splitInteger(Math.max(templates.length, Math.round(totalSeconds)), templates.map(template => template.weight));
  const requirements: ConstructionMaterialRequirement[][] = templates.map(() => []);

  for (const cost of blueprint.cost) {
    const index = materialPhaseIndex(cost.itemId, templates);
    requirements[index].push({ itemId: cost.itemId, quantity: cost.quantity });
  }

  return templates.map((template, index) => ({
    id: `${buildingId}_phase_${index}_${template.kind}`,
    name: template.name,
    kind: template.kind,
    requirements: requirements[index],
    progressSeconds: 0,
    totalSeconds: Math.max(1, seconds[index]),
    status: 'pending',
    materialsConsumed: false,
    consumedQualities: [],
    requiredToolTags: template.requiredToolTags,
    weatherSensitive: template.weatherSensitive,
  }));
}

function resolveSourceInventory(state: GameState, source: MaterialReservationSource) {
  if (source.kind === 'party') return state.inventory;
  return source.areaId ? state.poiStorages?.[source.areaId] : undefined;
}

function reserveAcrossCampSources(
  state: GameState,
  jobId: string,
  poiId: string,
  requirements: ConstructionMaterialRequirement[],
): { reservations: MaterialReservation[]; missing: ConstructionMaterialRequirement[] } {
  const created: MaterialReservation[] = [];
  const sources: MaterialReservationSource[] = [{ kind: 'poi', areaId: poiId }, { kind: 'party' }];

  for (const requirement of requirements) {
    let remaining = requirement.quantity;
    for (const source of sources) {
      if (remaining <= 0) break;
      const inventory = resolveSourceInventory(state, source);
      if (!inventory) continue;
      const available = getAvailableInventoryStock(inventory, requirement.itemId);
      const take = Math.min(remaining, available);
      if (take <= 0) continue;
      const result = reserveJobMaterials(state, 'construction', jobId, [{ itemId: requirement.itemId, quantity: take }], source);
      if (result.reservations.length) {
        created.push(...result.reservations);
        remaining -= take;
      }
    }
    if (remaining > 0) {
      releaseJobReservations(state, created);
      return { reservations: [], missing: [{ itemId: requirement.itemId, quantity: remaining }] };
    }
  }
  return { reservations: created, missing: [] };
}

function qualitiesFromReservations(reservations: MaterialReservation[]): Record<string, ItemQuality[]> {
  const byItem: Record<string, ItemQuality[]> = {};
  for (const reservation of reservations) {
    const list = byItem[reservation.itemId] ||= [];
    for (const quality of QUALITY_ORDER) {
      const count = Math.floor(reservation.qualityBreakdown?.[quality] || 0);
      for (let index = 0; index < count; index++) list.push(quality);
    }
  }
  return byItem;
}

function totalReservedWeight(reservations: MaterialReservation[]): number {
  return reservations.reduce((sum, reservation) => {
    const weight = ITEMS_DATABASE[reservation.itemId]?.weight || 0.5;
    return sum + weight * reservation.quantity;
  }, 0);
}

function computeHaulSeconds(state: GameState, clusterId: string, reservations: MaterialReservation[]): number {
  const stats = deriveClusterStats(state, clusterId);
  const accessPenalty = stats ? 1 + Math.max(0, 100 - stats.accessibility) / 85 : 1.3;
  const weight = totalReservedWeight(reservations);
  return Math.max(4, Math.round((4 + weight * 0.7) * accessPenalty * 10) / 10);
}

function stagedQuantity(building: NonNullable<GameState['buildings'][number]>, itemId: string): number {
  return building.stagingInventory ? getAvailableInventoryStock(building.stagingInventory, itemId) : 0;
}

function hasOperationalToolTag(state: GameState, tags: string[]): boolean {
  if (!tags.length) return true;
  return state.inventory.items.some(item => {
    const def = ITEMS_DATABASE[item.itemId];
    return Boolean(def && tags.some(tag => def.tags.includes(tag)) && (item.condition === undefined || item.condition > 0) && item.quantity > (item.reservedQuantity || 0));
  });
}

function phaseWeatherBlocked(state: GameState, phase: StructureConstructionPhase): boolean {
  if (!phase.weatherSensitive) return false;
  return state.weather.current === 'storm' || state.weather.current === 'heavy_rain';
}

function chooseBuilder(state: GameState, preferredId?: string): SurvivorState | undefined {
  const preferred = preferredId
    ? state.survivors.find(survivor => survivor.id === preferredId && survivor.currentAction.type === 'idle')
    : undefined;
  return preferred || state.survivors
    .filter(survivor => survivor.currentAction.type === 'idle' && survivor.jobPriorities.build !== 'disabled')
    .sort((a, b) => (b.skills.building || 0) - (a.skills.building || 0))[0];
}

function consumePhaseMaterials(
  building: GameState['buildings'][number],
  job: StructureConstructionJob,
  phase: StructureConstructionPhase,
): boolean {
  const staging = building.stagingInventory;
  if (!staging) return phase.requirements.length === 0;
  if (phase.requirements.some(requirement => stagedQuantity(building, requirement.itemId) < requirement.quantity)) return false;

  for (const requirement of phase.requirements) {
    if (!deductItemFromInventory(staging, requirement.itemId, requirement.quantity)) return false;
    const qualities = job.materialQualityByItemId[requirement.itemId] || [];
    phase.consumedQualities.push(...qualities.splice(0, requirement.quantity));
  }
  phase.materialsConsumed = true;
  return true;
}

function qualityScore(qualities: ItemQuality[]): number {
  if (!qualities.length) return 65;
  const score: Record<ItemQuality, number> = { crude: 42, standard: 65, prime: 82, masterwork: 95 };
  return qualities.reduce((sum, quality) => sum + score[quality], 0) / qualities.length;
}

function workmanshipScore(worker: SurvivorState, phase: StructureConstructionPhase, placementScore: number): number {
  const skill = Math.min(100, 38 + (worker.skills.building || 1) * 10);
  const fatiguePenalty = worker.fatigue > 75 ? 16 : worker.fatigue > 55 ? 8 : 0;
  const needsPenalty = worker.hunger > 75 || worker.thirst > 70 ? 8 : 0;
  const moraleBonus = worker.morale > 75 ? 5 : worker.morale < 30 ? -6 : 0;
  const material = qualityScore(phase.consumedQualities);
  return Math.max(15, Math.min(100, Math.round(skill * 0.45 + material * 0.35 + placementScore * 0.20 - fatiguePenalty - needsPenalty + moraleBonus)));
}

function deliverReservationsToStaging(state: GameState, job: StructureConstructionJob): boolean {
  const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
  if (!building) return false;
  building.stagingInventory ||= emptyStagingInventory();

  const qualityByItem = qualitiesFromReservations(job.materialReservations);
  const snapshot = job.materialReservations.map(reservation => ({
    itemId: reservation.itemId,
    quantity: reservation.quantity,
    qualityBreakdown: { ...reservation.qualityBreakdown },
  }));
  const consumed = consumeJobReservations(state, job.materialReservations);
  if (!consumed.success) return false;

  for (const reservation of snapshot) {
    for (const quality of QUALITY_ORDER) {
      const quantity = Math.floor(reservation.qualityBreakdown[quality] || 0);
      if (quantity > 0) addItemToInventory(building.stagingInventory, reservation.itemId, quantity, quality);
    }
  }

  job.materialQualityByItemId = qualityByItem;
  job.materialReservations = [];
  job.materialsDelivered = true;
  return true;
}

function applyCompletionBenefits(state: GameState, building: GameState['buildings'][number]): void {
  const definition = BUILDINGS_DATABASE[building.buildingId];
  if (!definition?.maxCapacityIncrease) return;
  const storage = getOrCreatePoiStorage(state, building.areaId || 'AREA_CAMP_CLEARING');
  storage.maxWeightKg += definition.maxCapacityIncrease.weightKg || 0;
  storage.maxVolumeL += definition.maxCapacityIncrease.volumeL || 0;
  if ((building.areaId || 'AREA_CAMP_CLEARING') === 'AREA_CAMP_CLEARING') {
    state.inventory.maxWeightKg += Math.round((definition.maxCapacityIncrease.weightKg || 0) * 0.5);
    state.inventory.maxVolumeL += Math.round((definition.maxCapacityIncrease.volumeL || 0) * 0.5);
  }
}

function completeConstruction(state: GameState, job: StructureConstructionJob, worker?: SurvivorState): void {
  const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
  const definition = BUILDINGS_DATABASE[job.buildingId];
  if (!building) return;

  building.isBuilt = true;
  building.buildProgressSeconds = building.totalBuildSeconds;
  building.condition = 100;
  job.status = 'completed';
  applyCompletionBenefits(state, building);
  if (worker) {
    worker.skills.building = (worker.skills.building || 1) + 0.12;
    setIdle(worker);
  }
  state.logs.unshift({
    id: `construction_done_${Date.now()}_${job.id}`,
    day: state.gameTime.day,
    timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
    text: `${worker?.name || 'Đội xây dựng'} đã hoàn thành ${definition?.name || job.buildingId}.`,
    type: 'success',
  });
}

export function planSpatialConstruction(
  state: GameState,
  survivorId: string | undefined,
  clusterId: string,
  buildingId: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureBuildingSimulation(next);
  simulation.constructionJobs ||= [];
  const cluster = simulation.clusters.find(candidate => candidate.id === clusterId);
  const blueprint = BUILDINGS_DATABASE[buildingId];
  if (!cluster || !blueprint) return state;

  const preview = findStructurePlacement(next, clusterId, buildingId);
  if (preview.status !== 'available' && preview.status !== 'preparation_required') {
    next.logs.unshift({
      id: `construction_space_${Date.now()}`,
      day: next.gameTime.day,
      timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
      text: `Không thể bố trí ${blueprint.name}: ${preview.reasons.join(', ') || 'không đủ mặt bằng phù hợp'}.`,
      type: 'warning',
    });
    return next;
  }

  const placement = reserveStructurePlacement(next, clusterId, buildingId);
  const microPrepMultiplier = placement.status === 'preparation_required' ? 1.18 : 1;
  const buildingInstanceId = `bld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const totalBuildSeconds = Math.round(blueprint.buildTimeSeconds * microPrepMultiplier * 10) / 10;
  const building: GameState['buildings'][number] = {
    id: buildingInstanceId,
    buildingId,
    condition: 100,
    isBuilt: false,
    buildProgressSeconds: 0,
    totalBuildSeconds,
    areaId: cluster.poiId,
    clusterId,
    placement: placement.allocations,
    footprintAreaM2: placement.footprintAreaM2,
    placementScore: placement.score,
    stagingInventory: emptyStagingInventory(),
  };
  next.buildings.push(building);

  const jobId = `construction_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reservation = reserveAcrossCampSources(next, jobId, cluster.poiId, blueprint.cost);
  const phases = deriveConstructionPhases(buildingId, totalBuildSeconds);
  const job: StructureConstructionJob = {
    id: jobId,
    buildingInstanceId,
    buildingId,
    clusterId,
    poiId: cluster.poiId,
    status: reservation.missing.length ? 'waiting_materials' : 'waiting_hauling',
    assignedSurvivorId: survivorId || undefined,
    createdAtGameMinute: gameMinute(next),
    materialReservations: reservation.reservations,
    blockedReasons: reservation.missing.length
      ? reservation.missing.map(item => `Thiếu ${ITEMS_DATABASE[item.itemId]?.name || item.itemId} x${item.quantity}`)
      : [],
    haulProgressSeconds: 0,
    haulTotalSeconds: reservation.reservations.length ? computeHaulSeconds(next, clusterId, reservation.reservations) : 0,
    materialsDelivered: false,
    materialQualityByItemId: {},
    phases,
    currentPhaseIndex: 0,
  };
  building.constructionJobId = jobId;
  simulation.constructionJobs.push(job);

  next.logs.unshift({
    id: `construction_plan_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: reservation.missing.length
      ? `Đã lên kế hoạch ${blueprint.name}; footprint được giữ nhưng đang chờ đủ vật liệu.`
      : `Đã lên kế hoạch ${blueprint.name}; vật liệu đã được giữ và chờ vận chuyển tới công trường.`,
    type: reservation.missing.length ? 'warning' : 'info',
  });
  return next;
}

function retryMaterialReservation(state: GameState, job: StructureConstructionJob): void {
  const blueprint = BUILDINGS_DATABASE[job.buildingId];
  if (!blueprint || job.materialReservations.length || job.materialsDelivered) return;
  const result = reserveAcrossCampSources(state, job.id, job.poiId, blueprint.cost);
  if (result.missing.length) {
    job.status = 'waiting_materials';
    job.blockedReasons = result.missing.map(item => `Thiếu ${ITEMS_DATABASE[item.itemId]?.name || item.itemId} x${item.quantity}`);
    return;
  }
  job.materialReservations = result.reservations;
  job.haulTotalSeconds = computeHaulSeconds(state, job.clusterId, result.reservations);
  job.status = 'waiting_hauling';
  job.blockedReasons = [];
}

function currentPhase(job: StructureConstructionJob): StructureConstructionPhase | undefined {
  return job.phases[job.currentPhaseIndex];
}

function syncBuildingProgress(state: GameState, job: StructureConstructionJob): void {
  const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
  if (!building) return;
  const completed = job.phases.reduce((sum, phase) => sum + (phase.status === 'completed' ? phase.totalSeconds : phase.progressSeconds), 0);
  const total = Math.max(1, job.phases.reduce((sum, phase) => sum + phase.totalSeconds, 0));
  building.buildProgressSeconds = Math.min(building.totalBuildSeconds, building.totalBuildSeconds * completed / total);
}

/**
 * Runs after SurvivorSystem. It owns sentinel build actions for both hauling and
 * phase work; SurvivorSystem only advances the worker action clock.
 */
export function tickBuildingConstructionRuntime(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  simulation.constructionJobs ||= [];

  for (const job of simulation.constructionJobs) {
    if (job.status === 'completed' || job.status === 'paused') continue;
    const building = state.buildings.find(candidate => candidate.id === job.buildingInstanceId);
    if (!building) continue;

    if (job.status === 'waiting_materials') {
      retryMaterialReservation(state, job);
      if (job.status === 'waiting_materials') continue;
    }

    if (!job.materialsDelivered) {
      if (job.status === 'hauling') {
        const worker = job.assignedSurvivorId ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId) : undefined;
        const owns = worker?.currentAction.type === 'building' && worker.currentAction.resultPayload?.constructionJobId === job.id && worker.currentAction.resultPayload?.constructionStage === 'hauling';
        if (!worker || !owns) {
          job.status = 'waiting_hauling';
          job.assignedSurvivorId = undefined;
          continue;
        }
        job.haulProgressSeconds = Math.min(job.haulTotalSeconds, worker.currentAction.progressSeconds);
        if (job.haulProgressSeconds >= job.haulTotalSeconds) {
          if (!deliverReservationsToStaging(state, job)) {
            setIdle(worker);
            job.status = 'waiting_materials';
            job.assignedSurvivorId = undefined;
            job.blockedReasons = ['Nguồn vật liệu đã thay đổi; cần giữ lại vật liệu'];
            continue;
          }
          setIdle(worker);
          job.assignedSurvivorId = undefined;
          job.status = 'waiting_worker';
          job.blockedReasons = [];
        }
        continue;
      }

      const worker = chooseBuilder(state, job.assignedSurvivorId);
      if (!worker) {
        job.status = 'waiting_hauling';
        job.blockedReasons = ['Chờ người vận chuyển rảnh'];
        continue;
      }
      job.assignedSurvivorId = worker.id;
      job.status = 'hauling';
      job.blockedReasons = [];
      worker.currentAction = {
        type: 'building',
        description: `Vận chuyển vật liệu tới ${BUILDINGS_DATABASE[job.buildingId]?.name || 'công trường'}`,
        targetId: job.id,
        progressSeconds: job.haulProgressSeconds,
        totalSeconds: ACTION_SENTINEL_SECONDS,
        resultPayload: { constructionJobId: job.id, constructionStage: 'hauling', constructionStageSeconds: job.haulTotalSeconds },
      };
      continue;
    }

    const phase = currentPhase(job);
    if (!phase) {
      completeConstruction(state, job);
      continue;
    }

    if (job.status === 'in_progress') {
      const worker = job.assignedSurvivorId ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId) : undefined;
      const owns = worker?.currentAction.type === 'building' && worker.currentAction.resultPayload?.constructionJobId === job.id && worker.currentAction.resultPayload?.phaseId === phase.id;
      if (!worker || !owns) {
        job.status = 'waiting_worker';
        job.assignedSurvivorId = undefined;
        continue;
      }
      if (phaseWeatherBlocked(state, phase)) {
        phase.progressSeconds = Math.min(phase.totalSeconds, worker.currentAction.progressSeconds);
        setIdle(worker);
        job.status = 'waiting_weather';
        job.assignedSurvivorId = undefined;
        job.blockedReasons = ['Mưa lớn / bão cản trở công đoạn ngoài trời'];
        syncBuildingProgress(state, job);
        continue;
      }

      phase.progressSeconds = Math.min(phase.totalSeconds, worker.currentAction.progressSeconds);
      syncBuildingProgress(state, job);
      if (phase.progressSeconds >= phase.totalSeconds) {
        phase.workmanshipScore = workmanshipScore(worker, phase, building.placementScore || 65);
        phase.status = 'completed';
        worker.skills.building = (worker.skills.building || 1) + 0.025;
        setIdle(worker);
        job.assignedSurvivorId = undefined;
        job.currentPhaseIndex += 1;
        job.status = 'waiting_worker';
        if (job.currentPhaseIndex >= job.phases.length) completeConstruction(state, job, worker);
      }
      continue;
    }

    if (phaseWeatherBlocked(state, phase)) {
      job.status = 'waiting_weather';
      job.blockedReasons = ['Mưa lớn / bão cản trở công đoạn ngoài trời'];
      continue;
    }
    if (job.status === 'waiting_weather') {
      job.status = 'waiting_worker';
      job.blockedReasons = [];
    }

    const toolTags = phase.requiredToolTags || [];
    if (!hasOperationalToolTag(state, toolTags)) {
      job.status = 'waiting_tool';
      job.blockedReasons = [`Cần công cụ phù hợp: ${toolTags.join(' / ')}`];
      continue;
    }

    const worker = chooseBuilder(state, job.assignedSurvivorId);
    if (!worker) {
      job.status = 'waiting_worker';
      job.blockedReasons = ['Chờ thợ xây rảnh'];
      continue;
    }

    if (!phase.materialsConsumed && !consumePhaseMaterials(building, job, phase)) {
      job.status = 'waiting_materials';
      job.blockedReasons = ['Vật liệu staging không đủ cho công đoạn hiện tại'];
      continue;
    }

    phase.status = 'in_progress';
    job.status = 'in_progress';
    job.assignedSurvivorId = worker.id;
    job.blockedReasons = [];
    worker.currentAction = {
      type: 'building',
      description: `${phase.name}: ${BUILDINGS_DATABASE[job.buildingId]?.name || 'công trình'}`,
      targetId: job.id,
      progressSeconds: phase.progressSeconds,
      totalSeconds: ACTION_SENTINEL_SECONDS,
      resultPayload: {
        constructionJobId: job.id,
        constructionStage: 'phase',
        phaseId: phase.id,
        phaseTotalSeconds: phase.totalSeconds,
      },
    };
  }
}