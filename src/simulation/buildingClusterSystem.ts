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

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function avg(cells: BuildCell[], selector: (cell: BuildCell) => number): number {
  if (!cells.length) return 0;
  return cells.reduce((sum, cell) => sum + selector(cell), 0) / cells.length;
}

function flatness(cell: BuildCell): number {
  return clamp(100 - cell.slope * 4.2);
}

function shelter(cell: BuildCell): number {
  return clamp((100 - cell.windExposure) * 0.7 + cell.canopy * 0.3);
}

function fireSafety(cell: BuildCell): number {
  return clamp(100 - cell.fireRisk * 0.72 - cell.vegetation * 0.28);
}

function siteCellScore(cell: BuildCell, type: ClusterType): number {
  const weights = CLUSTER_DEFINITIONS[type].weights;
  const metrics = {
    bearing: cell.bearingCapacity,
    drainage: cell.drainage,
    floodSafety: 100 - cell.floodRisk,
    flatness: flatness(cell),
    sunlight: cell.sunlight,
    shelter: shelter(cell),
    waterAccess: cell.resources.waterAccess,
    fireSafety: fireSafety(cell),
    fertility: cell.resources.fertileSoil,
  };

  let weighted = 0;
  let total = 0;
  for (const key of Object.keys(weights) as Array<keyof typeof weights>) {
    weighted += metrics[key] * weights[key];
    total += weights[key];
  }
  return total > 0 ? weighted / total : 0;
}

function preparationFor(cells: BuildCell[], areaM2: number): SitePreparationRequirement[] {
  const result: SitePreparationRequirement[] = [];
  const areaFactor = Math.max(0.6, areaM2 / 100);
  const push = (type: SitePreparationType, severity: number, base: number) => {
    result.push({
      type,
      severity: Math.round(clamp(severity) * 10) / 10,
      estimatedSeconds: Math.max(5, Math.round(base * areaFactor * (0.5 + severity / 100))),
    });
  };

  const vegetation = avg(cells, c => Math.max(0, c.vegetation - c.cleared * 0.45));
  const roots = avg(cells, c => c.roots);
  const rocks = avg(cells, c => c.rocks);
  const debris = avg(cells, c => c.debris);
  const slope = avg(cells, c => c.slope);
  const drainage = avg(cells, c => c.drainage + c.drained * 0.4);
  const moisture = avg(cells, c => c.moisture);
  const bearing = avg(cells, c => c.bearingCapacity + c.compacted * 0.3);

  if (vegetation > 46) push('clear_vegetation', vegetation, 24);
  if (roots > 52) push('remove_roots', roots, 30);
  if (rocks > 62) push('remove_rocks', rocks, 32);
  if (debris > 58) push('clear_debris', debris, 20);
  if (slope > 12) push('level_ground', Math.min(100, slope * 4), 36);
  if (drainage < 42 || moisture > 78) push('drain_ground', Math.max(100 - drainage, moisture - 35), 42);
  if (bearing < 42) push('compact_ground', 100 - bearing, 34);
  return result;
}

function siteAdvantages(cells: BuildCell[]): string[] {
  const values: string[] = [];
  if (avg(cells, c => c.bearingCapacity) >= 68) values.push('Nền chịu tải tốt');
  if (avg(cells, c => c.drainage) >= 68) values.push('Thoát nước tốt');
  if (avg(cells, c => c.floodRisk) <= 28) values.push('Rủi ro ngập thấp');
  if (avg(cells, c => c.slope) <= 6) values.push('Địa hình khá phẳng');
  if (avg(cells, c => c.sunlight) >= 70) values.push('Ánh sáng tốt');
  if (avg(cells, c => c.resources.waterAccess) >= 70) values.push('Gần nguồn nước');
  if (avg(cells, c => c.resources.fertileSoil) >= 70) values.push('Đất màu mỡ');
  if (avg(cells, c => c.windExposure) <= 30) values.push('Được che gió');
  return values.slice(0, 4);
}

function siteWarnings(cells: BuildCell[]): string[] {
  const values: string[] = [];
  if (avg(cells, c => c.floodRisk) >= 62) values.push('Có nguy cơ ngập');
  if (avg(cells, c => c.vegetation) >= 64) values.push('Thảm thực vật dày');
  if (avg(cells, c => c.roots) >= 68) values.push('Rễ cây cản trở');
  if (avg(cells, c => c.rocks) >= 72) values.push('Nhiều đá lộ thiên');
  if (avg(cells, c => c.slope) >= 15) values.push('Địa hình dốc');
  if (avg(cells, c => c.windExposure) >= 72) values.push('Phơi gió mạnh');
  if (avg(cells, c => c.bearingCapacity) <= 34) values.push('Nền đất yếu');
  return values.slice(0, 4);
}

function adjacent(source: BuildCell[], cell: BuildCell): BuildCell[] {
  return source.filter(candidate => Math.abs(candidate.row - cell.row) + Math.abs(candidate.column - cell.column) === 1);
}

function growGroup(available: BuildCell[], start: BuildCell, type: ClusterType): BuildCell[] {
  const targetArea = CLUSTER_DEFINITIONS[type].preferredAreaM2;
  const selected: BuildCell[] = [];
  const queue: BuildCell[] = [start];
  const seen = new Set<string>();
  let area = 0;

  while (queue.length && area < targetArea) {
    queue.sort((a, b) => siteCellScore(b, type) - siteCellScore(a, type));
    const current = queue.shift()!;
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    selected.push(current);
    area += current.areaM2;
    for (const neighbor of adjacent(available, current)) {
      if (!seen.has(neighbor.id) && !queue.some(entry => entry.id === neighbor.id)) queue.push(neighbor);
    }
  }
  return selected;
}

export function getClusterSiteCandidates(state: GameState, poiId: string, type: ClusterType): ClusterSiteCandidate[] {
  const grid = getPoiBuildGridView(state, poiId);
  const def = CLUSTER_DEFINITIONS[type];
  const available = grid.cells.filter(cell => !cell.clusterId);
  const starts = [...available].sort((a, b) => siteCellScore(b, type) - siteCellScore(a, type));
  const signatures = new Set<string>();
  const candidates: ClusterSiteCandidate[] = [];

  for (const start of starts) {
    const cells = growGroup(available, start, type);
    const area = cells.reduce((sum, cell) => sum + cell.areaM2, 0);
    if (area < def.minAreaM2) continue;
    const signature = cells.map(cell => cell.id).sort().join('|');
    if (signatures.has(signature)) continue;
    signatures.add(signature);

    const score = Math.round(avg(cells, cell => siteCellScore(cell, type)) * 10) / 10;
    const prep = preparationFor(cells, area);
    const flood = avg(cells, c => c.floodRisk);
    const bearing = avg(cells, c => c.bearingCapacity);
    const hardBad =
      ((type === 'shelter' || type === 'storage' || type === 'research') && flood > 82) ||
      ((type === 'shelter' || type === 'storage' || type === 'research') && bearing < 22);

    const rating: ClusterSiteCandidate['rating'] = hardBad || score < 45
      ? 'unsuitable'
      : prep.length === 0 && score >= 80
        ? 'excellent'
        : prep.length <= 1 && score >= 67
          ? 'suitable'
          : 'preparation_required';

    candidates.push({
      id: `site_${type}_${hash(signature).toString(36)}`,
      poiId,
      clusterType: type,
      cellIds: cells.map(cell => cell.id),
      usableAreaM2: area,
      score,
      rating,
      advantages: siteAdvantages(cells),
      warnings: siteWarnings(cells),
      preparation: prep,
    });
    if (candidates.length >= 12) break;
  }

  const rank = { excellent: 4, suitable: 3, preparation_required: 2, unsuitable: 1 };
  return candidates.sort((a, b) => rank[b.rating] - rank[a.rating] || b.score - a.score).slice(0, 6);
}

function recovered(type: SitePreparationType, severity: number, cellCount: number): Array<{ itemId: string; quantity: number }> {
  const scale = Math.max(1, Math.round((severity / 35) * Math.max(1, cellCount / 2)));
  if (type === 'clear_vegetation') return [
    { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: Math.max(1, Math.round(scale * 0.7)) },
    { itemId: 'ITEM_PALM_LEAF', quantity: Math.max(1, scale) },
  ];
  if (type === 'remove_roots' || type === 'clear_debris') return [{ itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: Math.max(1, Math.round(scale * 0.6)) }];
  if (type === 'remove_rocks') return [{ itemId: 'ITEM_RIVER_PEBBLE', quantity: Math.max(1, scale) }];
  return [];
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
  if (candidate.cellIds.some(id => grid.cells.find(cell => cell.id === id)?.clusterId)) return state;

  const clusterId = `cluster_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const sequence = simulation.clusters.filter(cluster => cluster.poiId === poiId && cluster.type === type).length + 1;
  const cluster: CampCluster = {
    id: clusterId,
    poiId,
    type,
    name: `${CLUSTER_DEFINITIONS[type].name} ${sequence}`,
    cellIds: [...candidate.cellIds],
    usableAreaM2: candidate.usableAreaM2,
    occupiedAreaM2: 0,
    state: candidate.preparation.length ? 'preparing' : 'active',
    siteScore: candidate.score,
    createdAtGameMinute: gameMinute(next),
    maintenancePolicy: 'normal',
  };
  simulation.clusters.push(cluster);

  for (const id of cluster.cellIds) {
    const cell = grid.cells.find(entry => entry.id === id);
    if (cell) cell.clusterId = cluster.id;
  }

  for (const requirement of candidate.preparation) {
    simulation.preparationJobs.push({
      id: `siteprep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      clusterId: cluster.id,
      poiId,
      type: requirement.type,
      cellIds: [...cluster.cellIds],
      severity: requirement.severity,
      progressSeconds: 0,
      totalSeconds: requirement.estimatedSeconds,
      status: 'waiting_worker',
      assignedSurvivorId,
      recovered: recovered(requirement.type, requirement.severity, cluster.cellIds.length),
    });
  }

  next.logs.unshift({
    id: `cluster_${Date.now()}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: candidate.preparation.length
      ? `Đã quy hoạch ${cluster.name}. Mặt bằng cần ${candidate.preparation.length} công đoạn chuẩn bị.`
      : `${cluster.name} đã sẵn sàng để bố trí công trình.`,
    type: candidate.preparation.length ? 'info' : 'success',
  });
  return next;
}

function prepLabel(type: SitePreparationType): string {
  const labels: Record<SitePreparationType, string> = {
    clear_vegetation: 'Dọn thảm thực vật',
    remove_roots: 'Đào bỏ rễ cây',
    remove_rocks: 'Dọn đá',
    clear_debris: 'Dọn mảnh vụn',
    drain_ground: 'Thoát nước mặt bằng',
    level_ground: 'San nền',
    compact_ground: 'Đầm nền',
  };
  return labels[type];
}

export function tickBuildingSimulation(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  for (const job of simulation.preparationJobs) {
    if (job.status === 'completed') continue;

    if (job.status === 'in_progress') {
      const worker = job.assignedSurvivorId ? state.survivors.find(s => s.id === job.assignedSurvivorId) : undefined;
      const ownsJob = worker?.currentAction.type === 'building' &&
        worker.currentAction.resultPayload?.sitePreparationJobId === job.id;
      if (!ownsJob) {
        job.status = 'waiting_worker';
        job.assignedSurvivorId = undefined;
      } else {
        job.progressSeconds = worker.currentAction.progressSeconds;
      }
      continue;
    }

    const preferred = job.assignedSurvivorId
      ? state.survivors.find(s => s.id === job.assignedSurvivorId && s.currentAction.type === 'idle')
      : undefined;
    const worker = preferred || state.survivors
      .filter(s => s.currentAction.type === 'idle' && s.jobPriorities.build !== 'disabled')
      .sort((a, b) => (b.skills.building || 0) - (a.skills.building || 0))[0];
    if (!worker) continue;

    job.status = 'in_progress';
    job.assignedSurvivorId = worker.id;
    worker.currentAction = {
      type: 'building',
      description: `${prepLabel(job.type)}: ${simulation.clusters.find(c => c.id === job.clusterId)?.name || 'khu trại'}`,
      targetId: job.id,
      progressSeconds: job.progressSeconds,
      totalSeconds: job.totalSeconds,
      resultPayload: { sitePreparationJobId: job.id },
    };
  }
}

export function completeSitePreparationJob(state: GameState, jobId: string, survivorId?: string): void {
  const simulation = ensureBuildingSimulation(state);
  const job = simulation.preparationJobs.find(candidate => candidate.id === jobId);
  if (!job || job.status === 'completed') return;
  const grid = getOrCreatePoiBuildGrid(state, job.poiId);

  for (const id of job.cellIds) {
    const cell = grid.cells.find(candidate => candidate.id === id);
    if (!cell) continue;
    if (job.type === 'clear_vegetation') {
      cell.cleared = 100;
      cell.vegetation = Math.max(5, cell.vegetation * 0.22);
      cell.fireRisk = Math.max(5, cell.fireRisk * 0.7);
    } else if (job.type === 'remove_roots') cell.roots = Math.max(4, cell.roots * 0.18);
    else if (job.type === 'remove_rocks') cell.rocks = Math.max(3, cell.rocks * 0.2);
    else if (job.type === 'clear_debris') cell.debris = Math.max(2, cell.debris * 0.15);
    else if (job.type === 'drain_ground') {
      cell.drained = Math.max(cell.drained, 80);
      cell.drainage = Math.min(100, cell.drainage + 28);
      cell.moisture = Math.max(0, cell.moisture - 22);
      cell.floodRisk = Math.max(0, cell.floodRisk - 12);
    } else if (job.type === 'level_ground') {
      cell.leveled = Math.max(cell.leveled, 80);
      cell.slope = Math.max(1.5, cell.slope * 0.45);
    } else if (job.type === 'compact_ground') {
      cell.compacted = Math.max(cell.compacted, 80);
      cell.bearingCapacity = Math.min(100, cell.bearingCapacity + 24);
    }
  }

  const storage = getOrCreatePoiStorage(state, job.poiId);
  for (const item of job.recovered) addItemToInventory(storage, item.itemId, item.quantity, 'standard');

  job.status = 'completed';
  job.progressSeconds = job.totalSeconds;
  const worker = survivorId ? state.survivors.find(s => s.id === survivorId) : undefined;
  if (worker) worker.skills.building = (worker.skills.building || 1) + 0.03;

  const cluster = simulation.clusters.find(candidate => candidate.id === job.clusterId);
  if (cluster && !simulation.preparationJobs.some(candidate => candidate.clusterId === cluster.id && candidate.status !== 'completed')) {
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

export type StructurePlacementStatus = 'available' | 'preparation_required' | 'no_space' | 'incompatible' | 'cluster_not_ready';
export interface StructurePlacementResult {
  status: StructurePlacementStatus;
  score: number;
  footprintAreaM2: number;
  allocations: StructurePlacementAllocation[];
  reasons: string[];
}

function structureScore(cell: BuildCell): number {
  return cell.bearingCapacity * 0.25 + cell.drainage * 0.20 + flatness(cell) * 0.22 +
    (100 - cell.floodRisk) * 0.18 + fireSafety(cell) * 0.15;
}

export function findStructurePlacement(state: GameState, clusterId: string, buildingId: string): StructurePlacementResult {
  const cluster = state.buildingSimulation?.clusters.find(candidate => candidate.id === clusterId);
  const profile = getSpatialProfile(buildingId);
  const base = { score: 0, footprintAreaM2: profile.footprintAreaM2, allocations: [] as StructurePlacementAllocation[], reasons: [] as string[] };
  if (!cluster) return { ...base, status: 'no_space', reasons: ['Không tìm thấy cluster'] };
  if (!profile.compatibleClusters.includes(cluster.type)) return { ...base, status: 'incompatible', reasons: ['Không phù hợp với chức năng cluster'] };
  if (cluster.state !== 'active') return { ...base, status: 'cluster_not_ready', score: cluster.siteScore, reasons: ['Mặt bằng cluster chưa chuẩn bị xong'] };

  const grid = getPoiBuildGridView(state, cluster.poiId);
  const available = grid.cells
    .filter(cell => cluster.cellIds.includes(cell.id))
    .map(cell => ({ cell, free: Math.max(0, cell.areaM2 - cell.reservedAreaM2) }))
    .filter(entry => entry.free > 0)
    .sort((a, b) => structureScore(b.cell) - structureScore(a.cell));

  let remaining = profile.footprintAreaM2;
  const allocations: StructurePlacementAllocation[] = [];
  const selected: BuildCell[] = [];
  for (const entry of available) {
    if (remaining <= 0) break;
    if (entry.cell.bearingCapacity < profile.minBearing || entry.cell.floodRisk > profile.maxFloodRisk || entry.cell.slope > profile.maxSlope + 7) continue;
    const amount = Math.min(entry.free, remaining);
    allocations.push({ cellId: entry.cell.id, areaM2: amount });
    selected.push(entry.cell);
    remaining -= amount;
  }
  if (remaining > 0.01) return { ...base, status: 'no_space', reasons: ['Không còn đủ diện tích phù hợp trong cluster'] };

  const score = Math.round(avg(selected, structureScore) * 10) / 10;
  const needsPrep = selected.some(cell =>
    cell.slope > profile.maxSlope || cell.drainage < profile.preferredDrainage - 15 || cell.vegetation > 58 || cell.roots > 62
  );
  const reasons: string[] = [];
  if (needsPrep) reasons.push('Vị trí cần chuẩn bị nhẹ; thời gian thi công sẽ tăng');
  if (avg(selected, c => c.drainage) >= profile.preferredDrainage) reasons.push('Thoát nước phù hợp');
  if (avg(selected, c => c.bearingCapacity) >= profile.minBearing + 15) reasons.push('Nền chịu tải tốt');
  return { status: needsPrep ? 'preparation_required' : 'available', score, footprintAreaM2: profile.footprintAreaM2, allocations, reasons };
}

export function reserveStructurePlacement(state: GameState, clusterId: string, buildingId: string): StructurePlacementResult {
  const result = findStructurePlacement(state, clusterId, buildingId);
  if (result.status !== 'available' && result.status !== 'preparation_required') return result;
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
  return {
    usableAreaM2: cluster.usableAreaM2,
    occupiedAreaM2: cluster.occupiedAreaM2,
    freeAreaM2: Math.max(0, cluster.usableAreaM2 - cluster.occupiedAreaM2),
    structureCount: structures.length,
    activeStructureCount: active.length,
    averageCondition: Math.round(active.length ? active.reduce((sum, b) => sum + b.condition, 0) / active.length : 100),
    fireSafety: Math.round(avg(cells, fireSafety)),
    drainage: Math.round(avg(cells, c => c.drainage)),
    accessibility: Math.round(avg(cells, c => flatness(c) * 0.6 + (100 - c.vegetation) * 0.4)),
  };
}

export function compatibleBuildingsForCluster(clusterType: ClusterType): string[] {
  return Object.keys(BUILDINGS_DATABASE).filter(id => getSpatialProfile(id).compatibleClusters.includes(clusterType));
}