import type { GameState, SurvivorState } from '../types';
import type {
  BuildCell,
  CampCluster,
  ClusterDerivedStats,
  ClusterSiteCandidate,
  ClusterType,
  SitePreparationJob,
  SitePreparationRequirement,
  SitePreparationType,
  StructurePlacementAllocation,
} from '../types/buildingSimulation';
import '../types/buildingSimulation';
import { CLUSTER_DEFINITIONS, getSpatialProfile } from '../data/buildingSpatial';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { addItemToInventory, getOrCreatePoiStorage } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import {
  ensureBuildingSimulation,
  getOrCreatePoiBuildGrid,
  getPoiBuildGridView,
} from './buildGridSystem';

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function average(cells: BuildCell[], selector: (cell: BuildCell) => number): number {
  if (cells.length === 0) return 0;
  return cells.reduce((sum, cell) => sum + selector(cell), 0) / cells.length;
}

function cellFlatness(cell: BuildCell): number {
  return clamp(100 - cell.slope * 4.2);
}

function cellShelter(cell: BuildCell): number {
  return clamp((100 - cell.windExposure) * 0.7 + cell.canopy * 0.3);
}

function cellFireSafety(cell: BuildCell): number {
  return clamp(100 - cell.fireRisk * 0.72 - cell.vegetation * 0.28);
}

function cellSuitability(cell: BuildCell, type: ClusterType): number {
  const def = CLUSTER_DEFINITIONS[type];
  const metrics = {
    bearing: cell.bearingCapacity,
    drainage: cell.drainage,
    floodSafety: 100 - cell.floodRisk,
    flatness: cellFlatness(cell),
    sunlight: cell.sunlight,
    shelter: cellShelter(cell),
    waterAccess: cell.resources.waterAccess,
    fireSafety: cellFireSafety(cell),
    fertility: cell.resources.fertileSoil,
  };

  let weighted = 0;
  let weightTotal = 0;
  for (const key of Object.keys(def.weights) as Array<keyof typeof def.weights>) {
    const weight = def.weights[key];
    weighted += metrics[key] * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weighted / weightTotal : 0;
}

function preparationForCells(cells: BuildCell[], areaM2: number): SitePreparationRequirement[] {
  const requirements: SitePreparationRequirement[] = [];
  const vegetation = average(cells, cell => Math.max(0, cell.vegetation - cell.cleared * 0.45));
  const roots = average(cells, cell => cell.roots);
  const rocks = average(cells, cell => cell.rocks);
  const debris = average(cells, cell => cell.debris);
  const slope = average(cells, cell => cell.slope);
  const drainage = average(cells, cell => cell.drainage + cell.drained * 0.4);
  const moisture = average(cells, cell => cell.moisture);
  const bearing = average(cells, cell => cell.bearingCapacity + cell.compacted * 0.3);
  const areaFactor = Math.max(0.6, areaM2 / 100);

  const push = (type: SitePreparationType, severity: number, baseSeconds: number) => {
    requirements.push({
      type,
      severity: Math.round(clamp(severity) * 10) / 10,
      estimatedSeconds: Math.max(5, Math.round(baseSeconds * areaFactor * (0.5 + severity / 100))),
    });
  };

  if (vegetation > 46) push('clear_vegetation', vegetation, 24);
  if (roots > 52) push('remove_roots', roots, 30);
  if (rocks > 62) push('remove_rocks', rocks, 32);
  if (debris > 58) push('clear_debris', debris, 20);
  if (slope > 12) push('level_ground', Math.min(100, slope * 4), 36);
  if (drainage < 42 || moisture > 78) push('drain_ground', Math.max(100 - drainage, moisture - 35), 42);
  if (bearing < 42) push('compact_ground', 100 - bearing, 34);

  return requirements;
}

function advantagesForCells(cells: BuildCell[]): string[] {
  const result: string[] = [];
  const bearing = average(cells, cell => cell.bearingCapacity);
  const drainage = average(cells, cell => cell.drainage);
  const flood = average(cells, cell => cell.floodRisk);
  const slope = average(cells, cell => cell.slope);
  const sunlight = average(cells, cell => cell.sunlight);
  const water = average(cells, cell => cell.resources.waterAccess);
  const fertility = average(cells, cell => cell.resources.fertileSoil);
  const wind = average(cells, cell => cell.windExposure);

  if (bearing >= 68) result.push('Nền chịu tải tốt');
  if (drainage >= 68) result.push('Thoát nước tốt');
  if (flood <= 28) result.push('Rủi ro ngập thấp');
  if (slope <= 6) result.push('Địa hình khá phẳng');
  if (sunlight >= 70) result.push('Ánh sáng tốt');
  if (water >= 70) result.push('Gần nguồn nước');
  if (fertility >= 70) result.push('Đất màu mỡ');
  if (wind <= 30) result.push('Được che gió');
  return result.slice(0, 4);
}

function warningsForCells(cells: BuildCell[]): string[] {
  const result: string[] = [];
  const flood = average(cells, cell => cell.floodRisk);
  const vegetation = average(cells, cell => cell.vegetation);
  const roots = average(cells, cell => cell.roots);
  const rocks = average(cells, cell => cell.rocks);
  const slope = average(cells, cell => cell.slope);
  const wind = average(cells, cell => cell.windExposure);
  const bearing = average(cells, cell => cell.bearingCapacity);

  if (flood >= 62) result.push('Có nguy cơ ngập');
  if (vegetation >= 64) result.push('Thảm thực vật dày');
  if (roots >= 68) result.push('Rễ cây cản trở');
  if (rocks >= 72) result.push('Nhiều đá lộ thiên');
  if (slope >= 15) result.push('Địa hình dốc');
  if (wind >= 72) result.push('Phơi gió mạnh');
  if (bearing <= 34) result.push('Nền đất yếu');
  return result.slice(0, 4);
}

function neighbors(cells: BuildCell[], cell: BuildCell): BuildCell[] {
  return cells.filter(candidate =>
    Math.abs(candidate.row - cell.row) + Math.abs(candidate.column - cell.column) === 1
  );
}

function growCandidateGroup(available: BuildCell[], start: BuildCell, type: ClusterType): BuildCell[] {
  const targetArea = CLUSTER_DEFINITIONS[type].preferredAreaM2;
  const selected: BuildCell[] = [];
  const queued: BuildCell[] = [start];
  const seen = new Set<string>();
  let area = 0;

  while (queued.length > 0 && area < targetArea) {
    queued.sort((a, b) => cellSuitability(b, type) - cellSuitability(a, type));
    const current = queued.shift()!;
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    selected.push(current);
    area += current.areaM2;

    for (const neighbor of neighbors(available, current)) {
      if (!seen.has(neighbor.id) && !queued.some(cell => cell.id === neighbor.id)) queued.push(neighbor);
    }
  }

  return selected;
}

export function getClusterSiteCandidates(state: GameState, poiId: string, type: ClusterType): ClusterSiteCandidate[] {
  const grid = getPoiBuildGridView(state, poiId);
  const def = CLUSTER_DEFINITIONS[type];
  const available = grid.cells.filter(cell => !cell.clusterId);
  const starts = [...available].sort((a, b) => cellSuitability(b, type) - cellSuitability(a, type));
  const signatures = new Set<string>();
  const candidates: ClusterSiteCandidate[] = [];

  for (const start of starts) {
    const group = growCandidateGroup(available, start, type);
    const area = group.reduce((sum, cell) => sum + cell.areaM2, 0);
    if (area < def.minAreaM2) continue;

    const signature = group.map(cell => cell.id).sort().join('|');
    if (signatures.has(signature)) continue;
    signatures.add(signature);

    const score = Math.round(average(group, cell => cellSuitability(cell, type)) * 10) / 10;
    const preparation = preparationForCells(group, area);
    const flood = average(group, cell => cell.floodRisk);
    const bearing = average(group, cell => cell.bearingCapacity);
    const hardBad =
      ((type === 'shelter' || type === 'storage' || type === 'research') && flood > 82) ||
      ((type === 'shelter' || type === 'storage' || type === 'research') && bearing < 22);

    let rating: ClusterSiteCandidate['rating'];
    if (hardBad || score < 45) rating = 'unsuitable';
    else if (preparation.length === 0 && score >= 80) rating = 'excellent';
    else if (preparation.length <= 1 && score >= 67) rating = 'suitable';
    else rating = 'preparation_required';

    candidates.push({
      id: `site_${type}_${stableHash(signature).toString(36)}`,
      poiId,
      clusterType: type,
      cellIds: group.map(cell => cell.id),
      usableAreaM2: area,
      score,
      rating,
      advantages: advantagesForCells(group),
      warnings: warningsForCells(group),
      preparation,
    });

    if (candidates.length >= 12) break;
  }

  return candidates
    .sort((a, b) => {
      const rank = { excellent: 4, suitable: 3, preparation_required: 2, unsuitable: 1 };
      return rank[b.rating] - rank[a.rating] || b.score - a.score;
    })
    .slice(0, 6);
}

function recoveredForPreparation(type: SitePreparationType, severity: number, cellCount: number): Array<{ itemId: string; quantity: number }> {
  const scale = Math.max(1, Math.round((severity / 35) * Math.max(1, cellCount / 2)));
  switch (type) {
    case 'clear_vegetation':
      return [
        { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: Math.max(1, Math.round(scale * 0.7)) },
        { itemId: 'ITEM_PALM_LEAF', quantity: Math.max(1, scale) },
      ];
    case 'remove_roots': return [{ itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: Math.max(1, Math.round(scale * 0.5)) }];
    case 'remove_rocks': return [{ itemId: 'ITEM_RIVER_PEBBLE', quantity: Math.max(1, scale) }];
    case 'clear_debris': return [{ itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: Math.max(1, Math.round(scale * 0.6)) }];
    default: return [];
  }
}

export function establishClusterAtCandidate(
  state: GameState,
  poiId: string,
  type: ClusterType,
  candidateId: string,
  assignedSurvivorId?: string,
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const simulation = ensureBuildingSimulation(next);
  const grid = getOrCreatePoiBuildGrid(next, poiId);
  const candidate = getClusterSiteCandidates(next, poiId, type).find(site => site.id === candidateId);
  if (!candidate || candidate.rating === 'unsuitable') return state;
  if (candidate.cellIds.some(cellId => grid.cells.find(cell => cell.id === cellId)?.clusterId)) return state;

  const clusterId = `cluster_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const index = simulation.clusters.filter(cluster => cluster.poiId === poiId && cluster.type === type).length + 1;
  const cluster: CampCluster = {
    id: clusterId,
    poiId,
    type,
    name: `${CLUSTER_DEFINITIONS[type].name} ${index}`,
    cellIds: [...candidate.cellIds],
    usableAreaM2: candidate.usableAreaM2,
    occupiedAreaM2: 0,
    state: candidate.preparation.length > 0 ? 'preparing' : 'active',
    siteScore: candidate.score,
    createdAtGameMinute: gameMinute(next),
    maintenancePolicy: 'normal',
  };
  simulation.clusters.push(cluster);

  for (const cellId of candidate.cellIds) {
    const cell = grid.cells.find(entry => entry.id === cellId);
    if (cell) cell.clusterId = clusterId;
  }

  for (const requirement of candidate.preparation) {
    const job: SitePreparationJob = {
      id: `siteprep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      clusterId,
      poiId,
      type: requirement.type,
      cellIds: [...candidate.cellIds],
      severity: requirement.severity,
      progressSeconds: 0,
      totalSeconds: requirement.estimatedSeconds,
      status: 'waiting_worker',
      assignedSurvivorId,
      recovered: recoveredForPreparation(requirement.type, requirement.severity, candidate.cellIds.length),
    };
    simulation.preparationJobs.push(job);
  }

  next.logs.unshift({
    id: `cluster_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: candidate.preparation.length > 0
      ? `Đã quy hoạch ${cluster.name}. Cần ${candidate.preparation.length} công đoạn chuẩn bị mặt bằng trước khi xây dựng.`
      : `${cluster.name} đã sẵn sàng để bố trí công trình.`,
    type: candidate.preparation.length > 0 ? 'info' : 'success',
  });
  return next;
}

function setWorkerIdle(worker: SurvivorState): void {
  worker.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

function preparationLabel(type: SitePreparationType): string {
  switch (type) {
    case 'clear_vegetation': return 'Dọn thảm thực vật';
    case 'remove_roots': return 'Đào bỏ rễ cây';
    case 'remove_rocks': return 'Dọn đá';
    case 'clear_debris': return 'Dọn mảnh vụn';
    case 'drain_ground': return 'Thoát nước mặt bằng';
    case 'level_ground': return 'San nền';
    case 'compact_ground': return 'Đầm nền';
  }
}

export function tickBuildingSimulation(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  const jobs = simulation.preparationJobs.filter(job => job.status !== 'completed');

  for (const job of jobs) {
    if (job.status === 'in_progress') {
      const worker = job.assignedSurvivorId
        ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId)
        : undefined;
      if (!worker || worker.currentAction.type !== 'site_preparation' || worker.currentAction.targetId !== job.id) {
        job.status = 'waiting_worker';
        job.assignedSurvivorId = undefined;
      }
      continue;
    }

    const preferred = job.assignedSurvivorId
      ? state.survivors.find(candidate => candidate.id === job.assignedSurvivorId && candidate.currentAction.type === 'idle')
      : undefined;
    const worker = preferred || state.survivors
      .filter(candidate => candidate.currentAction.type === 'idle' && candidate.jobPriorities.build !== 'disabled')
      .sort((a, b) => (b.skills.building || 0) - (a.skills.building || 0))[0];

    if (!worker) continue;
    job.status = 'in_progress';
    job.assignedSurvivorId = worker.id;
    worker.currentAction = {
      type: 'site_preparation',
      description: `${preparationLabel(job.type)}: ${simulation.clusters.find(cluster => cluster.id === job.clusterId)?.name || 'khu trại'}`,
      targetId: job.id,
      progressSeconds: job.progressSeconds,
      totalSeconds: job.totalSeconds,
    };
  }
}

export function completeSitePreparationJob(state: GameState, jobId: string, survivorId?: string): void {
  const simulation = ensureBuildingSimulation(state);
  const job = simulation.preparationJobs.find(candidate => candidate.id === jobId);
  if (!job || job.status === 'completed') return;
  const grid = getOrCreatePoiBuildGrid(state, job.poiId);

  for (const cellId of job.cellIds) {
    const cell = grid.cells.find(candidate => candidate.id === cellId);
    if (!cell) continue;
    switch (job.type) {
      case 'clear_vegetation':
        cell.cleared = 100;
        cell.vegetation = Math.max(5, cell.vegetation * 0.22);
        cell.fireRisk = Math.max(5, cell.fireRisk * 0.7);
        break;
      case 'remove_roots': cell.roots = Math.max(4, cell.roots * 0.18); break;
      case 'remove_rocks': cell.rocks = Math.max(3, cell.rocks * 0.2); break;
      case 'clear_debris': cell.debris = Math.max(2, cell.debris * 0.15); break;
      case 'drain_ground':
        cell.drained = Math.max(cell.drained, 80);
        cell.drainage = Math.min(100, cell.drainage + 28);
        cell.moisture = Math.max(0, cell.moisture - 22);
        cell.floodRisk = Math.max(0, cell.floodRisk - 12);
        break;
      case 'level_ground':
        cell.leveled = Math.max(cell.leveled, 80);
        cell.slope = Math.max(1.5, cell.slope * 0.45);
        break;
      case 'compact_ground':
        cell.compacted = Math.max(cell.compacted, 80);
        cell.bearingCapacity = Math.min(100, cell.bearingCapacity + 24);
        break;
    }
  }

  const storage = getOrCreatePoiStorage(state, job.poiId);
  for (const recovered of job.recovered) {
    addItemToInventory(storage, recovered.itemId, recovered.quantity, 'standard');
  }

  job.status = 'completed';
  job.progressSeconds = job.totalSeconds;
  const worker = survivorId ? state.survivors.find(candidate => candidate.id === survivorId) : undefined;
  if (worker) {
    worker.skills.building = (worker.skills.building || 1) + 0.03;
    setWorkerIdle(worker);
  }

  const cluster = simulation.clusters.find(candidate => candidate.id === job.clusterId);
  if (cluster) {
    const remaining = simulation.preparationJobs.some(candidate => candidate.clusterId === cluster.id && candidate.status !== 'completed');
    if (!remaining) {
      cluster.state = 'active';
      state.logs.unshift({
        id: `cluster_ready_${Date.now()}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `${cluster.name} đã hoàn tất chuẩn bị mặt bằng và sẵn sàng xây dựng.`,
        type: 'success',
      });
    }
  }
}

export type StructurePlacementStatus = 'available' | 'preparation_required' | 'no_space' | 'incompatible' | 'cluster_not_ready';

export interface StructurePlacementResult {
  status: StructurePlacementStatus;
  score: number;
  footprintAreaM2: number;
  allocations: StructurePlacementAllocation[];
  reasons: string[];
}

function structureCellScore(cell: BuildCell): number {
  return (
    cell.bearingCapacity * 0.25 +
    cell.drainage * 0.20 +
    cellFlatness(cell) * 0.22 +
    (100 - cell.floodRisk) * 0.18 +
    cellFireSafety(cell) * 0.15
  );
}

export function findStructurePlacement(state: GameState, clusterId: string, buildingId: string): StructurePlacementResult {
  const cluster = state.buildingSimulation?.clusters.find(candidate => candidate.id === clusterId);
  const profile = getSpatialProfile(buildingId);
  if (!cluster) return { status: 'no_space', score: 0, footprintAreaM2: profile.footprintAreaM2, allocations: [], reasons: ['Không tìm thấy cluster'] };
  if (!profile.compatibleClusters.includes(cluster.type)) {
    return { status: 'incompatible', score: 0, footprintAreaM2: profile.footprintAreaM2, allocations: [], reasons: ['Không phù hợp với chức năng cluster'] };
  }
  if (cluster.state !== 'active') {
    return { status: 'cluster_not_ready', score: cluster.siteScore, footprintAreaM2: profile.footprintAreaM2, allocations: [], reasons: ['Mặt bằng cluster chưa chuẩn bị xong'] };
  }

  const grid = getPoiBuildGridView(state, cluster.poiId);
  const candidates = grid.cells
    .filter(cell => cluster.cellIds.includes(cell.id))
    .map(cell => ({ cell, free: Math.max(0, cell.areaM2 - cell.reservedAreaM2) }))
    .filter(entry => entry.free > 0)
    .sort((a, b) => structureCellScore(b.cell) - structureCellScore(a.cell));

  let remaining = profile.footprintAreaM2;
  const allocations: StructurePlacementAllocation[] = [];
  const selectedCells: BuildCell[] = [];

  for (const entry of candidates) {
    if (remaining <= 0) break;
    if (entry.cell.bearingCapacity < profile.minBearing || entry.cell.floodRisk > profile.maxFloodRisk) continue;
    if (entry.cell.slope > profile.maxSlope + 7) continue;
    const amount = Math.min(entry.free, remaining);
    allocations.push({ cellId: entry.cell.id, areaM2: amount });
    selectedCells.push(entry.cell);
    remaining -= amount;
  }

  if (remaining > 0.01) {
    return { status: 'no_space', score: 0, footprintAreaM2: profile.footprintAreaM2, allocations: [], reasons: ['Không còn đủ diện tích phù hợp trong cluster'] };
  }

  const averageScore = Math.round(average(selectedCells, structureCellScore) * 10) / 10;
  const needsPrep = selectedCells.some(cell =>
    cell.slope > profile.maxSlope ||
    cell.drainage < profile.preferredDrainage - 15 ||
    cell.vegetation > 58 ||
    cell.roots > 62
  );
  const reasons: string[] = [];
  if (needsPrep) reasons.push('Vị trí cần chuẩn bị nhẹ trước khi thi công');
  if (average(selectedCells, cell => cell.drainage) >= profile.preferredDrainage) reasons.push('Thoát nước phù hợp');
  if (average(selectedCells, cell => cell.bearingCapacity) >= profile.minBearing + 15) reasons.push('Nền chịu tải tốt');

  return {
    status: needsPrep ? 'preparation_required' : 'available',
    score: averageScore,
    footprintAreaM2: profile.footprintAreaM2,
    allocations,
    reasons,
  };
}

export function reserveStructurePlacement(
  state: GameState,
  clusterId: string,
  buildingId: string,
): StructurePlacementResult {
  const result = findStructurePlacement(state, clusterId, buildingId);
  if (result.status !== 'available') return result;
  const cluster = state.buildingSimulation?.clusters.find(candidate => candidate.id === clusterId);
  if (!cluster) return { ...result, status: 'no_space', allocations: [] };
  const grid = getOrCreatePoiBuildGrid(state, cluster.poiId);
  for (const allocation of result.allocations) {
    const cell = grid.cells.find(candidate => candidate.id === allocation.cellId);
    if (cell) cell.reservedAreaM2 = Math.min(cell.areaM2, cell.reservedAreaM2 + allocation.areaM2);
  }
  cluster.occupiedAreaM2 = Math.min(cluster.usableAreaM2, cluster.occupiedAreaM2 + result.footprintAreaM2);
  return result;
}

export function deriveClusterStats(state: GameState, clusterId: string): ClusterDerivedStats | null {
  const cluster = state.buildingSimulation?.clusters.find(candidate => candidate.id === clusterId);
  if (!cluster) return null;
  const grid = getPoiBuildGridView(state, cluster.poiId);
  const cells = grid.cells.filter(cell => cluster.cellIds.includes(cell.id));
  const structures = state.buildings.filter(building => building.clusterId === clusterId);
  const active = structures.filter(building => building.isBuilt);
  const averageCondition = active.length > 0
    ? active.reduce((sum, building) => sum + building.condition, 0) / active.length
    : 100;

  return {
    usableAreaM2: cluster.usableAreaM2,
    occupiedAreaM2: cluster.occupiedAreaM2,
    freeAreaM2: Math.max(0, cluster.usableAreaM2 - cluster.occupiedAreaM2),
    structureCount: structures.length,
    activeStructureCount: active.length,
    averageCondition: Math.round(averageCondition),
    fireSafety: Math.round(average(cells, cell => cellFireSafety(cell))),
    drainage: Math.round(average(cells, cell => cell.drainage)),
    accessibility: Math.round(average(cells, cell => (cellFlatness(cell) * 0.6 + (100 - cell.vegetation) * 0.4))),
  };
}

export function compatibleBuildingsForCluster(clusterType: ClusterType): string[] {
  return Object.keys(BUILDINGS_DATABASE).filter(buildingId => getSpatialProfile(buildingId).compatibleClusters.includes(clusterType));
}