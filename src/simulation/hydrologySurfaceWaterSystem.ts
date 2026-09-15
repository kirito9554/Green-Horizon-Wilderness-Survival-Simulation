import type { GameState } from '../types';
import type { BuildCell, PoiBuildGrid } from '../types/buildingSimulation';
import type { CellHydrologyState, HydrologyEdge, HydrologyNode, RegionHydrologyState, WorldHydrologyState } from '../types/hydrologySimulation';
import '../types/hydrologySimulation';
import { HYDROLOGY_MAJOR_CONNECTIONS } from '../data/hydrologyAnchors';
import { REGION_HYDROLOGY_PROFILES, SOIL_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';
import { resolveMainWorldAreaId, type MainWorldAreaId } from '../data/mainWorldAreas';
import { getOrCreatePoiBuildGrid } from './buildGridSystem';
import { ensureWorldHydrology, materializeRegionHydrology } from './hydrologySystem';

const SURFACE_HYDROLOGY_VERSION = 2;
const TIDAL_PERIOD_MINUTES = 745;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 4) => { const s = 10 ** digits; return Math.round(value * s) / s; };
const gameMinute = (state: GameState) => Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
const isEdgeCell = (grid: PoiBuildGrid, cell: BuildCell) => cell.row === 0 || cell.column === 0 || cell.row === grid.rows - 1 || cell.column === grid.columns - 1;
const neighbors = (grid: PoiBuildGrid, origin: BuildCell) => grid.cells.filter(cell => cell.id !== origin.id && Math.abs(cell.row - origin.row) <= 1 && Math.abs(cell.column - origin.column) <= 1);
const cellHydro = (system: WorldHydrologyState, poiId: MainWorldAreaId, cellId: string) => system.cellStatesById[`${poiId}:${cellId}`];

function normalizeQualityState(hydro: CellHydrologyState): void {
  hydro.dissolvedOxygenMgL = Number.isFinite(hydro.dissolvedOxygenMgL) ? clamp(hydro.dissolvedOxygenMgL!, 0, 14) : 7.8;
  hydro.sedimentKg = Math.max(0, hydro.sedimentKg || 0);
  hydro.contaminantLoad = Math.max(0, hydro.contaminantLoad || 0);
  hydro.salinityPpt = Math.max(0, hydro.salinityPpt || 0);
  hydro.tidalSurfaceWaterDepthM = Math.max(0, hydro.tidalSurfaceWaterDepthM || 0);
}

function ensureChannelNode(system: WorldHydrologyState, poiId: MainWorldAreaId, cell: BuildCell): HydrologyNode {
  const id = `HYDRO_CHANNEL_${poiId}_${cell.id}`;
  const hydro = cellHydro(system, poiId, cell.id);
  return system.nodesById[id] ||= {
    id, kind: 'channel', poiId, cellId: cell.id, elevationM: cell.elevation,
    storageM3: hydro ? hydro.surfaceWaterDepthM * cell.areaM2 : 0,
    capacityM3: Math.max(2, cell.areaM2 * 0.45), waterLevelM: hydro?.surfaceWaterDepthM || 0,
    inflowM3H: hydro?.inflowM3H || 0, outflowM3H: hydro?.outflowM3H || 0,
    active: (hydro?.outflowM3H || 0) > 0.01 || (hydro?.surfaceWaterDepthM || 0) > 0.005,
    temperatureC: hydro?.temperatureC, dissolvedOxygenMgL: hydro?.dissolvedOxygenMgL,
    turbidity: hydro?.turbidity, contamination: hydro?.contamination,
    salinityPpt: hydro?.salinityPpt, sedimentLoadKg: hydro?.sedimentKg,
  };
}

function ensureLocalChannelNetwork(state: GameState, region: RegionHydrologyState): void {
  const system = ensureWorldHydrology(state);
  const grid = getOrCreatePoiBuildGrid(state, region.poiId);
  const maxAccumulation = Math.max(1, ...region.drainageLinks.map(link => link.flowAccumulation));
  const threshold = Math.max(3, Math.floor(maxAccumulation * 0.24));
  const scale = REGION_HYDROLOGY_PROFILES[region.poiId].effectiveLandscapeScale;
  region.channelEdgeIds ||= [];
  region.spillwayEdgeIds ||= [];

  for (const link of region.drainageLinks) {
    if (!link.downstreamCellId || link.flowAccumulation < threshold) continue;
    const fromCell = grid.cells.find(cell => cell.id === link.cellId);
    const toCell = grid.cells.find(cell => cell.id === link.downstreamCellId);
    if (!fromCell || !toCell) continue;
    const fromNode = ensureChannelNode(system, region.poiId, fromCell);
    const toNode = ensureChannelNode(system, region.poiId, toCell);
    const id = `HYDRO_LOCAL_${region.poiId}_${fromCell.id}_${toCell.id}`;
    const horizontalDistanceM = Math.max(grid.cellSizeM, Math.hypot(fromCell.row - toCell.row, fromCell.column - toCell.column) * grid.cellSizeM);
    const slope = Math.max(0.001, (fromCell.elevation - toCell.elevation) / horizontalDistanceM);
    const widthM = round(0.6 + Math.sqrt(link.flowAccumulation) * 0.42, 3);
    const bankfullDepthM = round(0.18 + Math.sqrt(link.flowAccumulation) * 0.075, 3);
    const velocityMps = clamp(0.12 + Math.sqrt(slope) * 1.9, 0.08, 2.6);
    system.edgesById[id] ||= {
      id, fromNodeId: fromNode.id, toNodeId: toNode.id,
      lengthM: horizontalDistanceM * Math.sqrt(scale), widthM, slope,
      channelCapacityM3H: round(widthM * bankfullDepthM * velocityMps * 3600, 3),
      dischargeM3H: 0, flowVelocityMps: velocityMps, sedimentLoadKg: 0, contaminationLoad: 0,
      kind: link.flowAccumulation >= maxAccumulation * 0.62 ? 'river' : 'stream',
      fromPoiId: region.poiId, toPoiId: region.poiId, depthM: 0, bankfullDepthM,
      dissolvedOxygenMgL: 7.8, turbidity: 0, salinityPpt: 0,
    };
    if (!region.channelEdgeIds.includes(id)) region.channelEdgeIds.push(id);
  }

  for (const link of region.drainageLinks.filter(candidate => candidate.isDepression)) {
    const sourceCell = grid.cells.find(cell => cell.id === link.cellId);
    if (!sourceCell) continue;
    const depressionNode = Object.values(system.nodesById).find(node => node.kind === 'depression' && node.poiId === region.poiId && node.cellId === sourceCell.id);
    if (!depressionNode) continue;
    const targetCell = neighbors(grid, sourceCell).sort((a, b) => a.elevation - b.elevation || b.drainage - a.drainage || a.id.localeCompare(b.id))[0];
    if (!targetCell) continue;
    const targetNode = ensureChannelNode(system, region.poiId, targetCell);
    const id = `HYDRO_SPILL_${region.poiId}_${sourceCell.id}_${targetCell.id}`;
    system.edgesById[id] ||= {
      id, fromNodeId: depressionNode.id, toNodeId: targetNode.id, lengthM: grid.cellSizeM, widthM: 0.55,
      slope: Math.max(0.002, (Math.max(0.03, targetCell.elevation - sourceCell.elevation + 0.03)) / grid.cellSizeM),
      channelCapacityM3H: 55, dischargeM3H: 0, flowVelocityMps: 0.18,
      sedimentLoadKg: 0, contaminationLoad: 0, kind: 'spillway',
      fromPoiId: region.poiId, toPoiId: region.poiId, depthM: 0, bankfullDepthM: 0.25,
      dissolvedOxygenMgL: 7.5, turbidity: 0, salinityPpt: 0,
    };
    if (!region.spillwayEdgeIds.includes(id)) region.spillwayEdgeIds.push(id);
  }
}

function ensureMajorConnections(system: WorldHydrologyState): void {
  for (const def of HYDROLOGY_MAJOR_CONNECTIONS) {
    const from = system.nodesById[def.fromAnchorId];
    const to = system.nodesById[def.toAnchorId];
    if (!from || !to) continue;
    const lengthM = from.poiId === to.poiId ? 140 : 900;
    const slope = Math.max(0.0001, Math.max(0.1, from.elevationM - to.elevationM) / lengthM);
    system.edgesById[def.id] ||= {
      id: def.id, fromNodeId: from.id, toNodeId: to.id, lengthM, widthM: def.widthM, slope,
      channelCapacityM3H: def.channelCapacityM3H, dischargeM3H: 0,
      flowVelocityMps: def.kind === 'waterfall' ? 2.8 : clamp(0.25 + Math.sqrt(slope) * 2.2, 0.12, 2.4),
      sedimentLoadKg: 0, contaminationLoad: 0, kind: def.kind, fromPoiId: from.poiId, toPoiId: to.poiId,
      depthM: 0, bankfullDepthM: def.bankfullDepthM, temperatureC: 25,
      dissolvedOxygenMgL: def.kind === 'waterfall' ? 10.5 : 8, turbidity: 0, salinityPpt: def.kind === 'tidal' ? 18 : 0,
    };
  }
}

export function ensureSurfaceWaterNetwork(state: GameState, areaId: string): RegionHydrologyState | undefined {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return undefined;
  const region = materializeRegionHydrology(state, poiId);
  if (!region) return undefined;
  const system = ensureWorldHydrology(state);
  system.version = Math.max(SURFACE_HYDROLOGY_VERSION, system.version || 1);
  region.channelEdgeIds ||= [];
  region.spillwayEdgeIds ||= [];
  for (const id of region.cellStateIds) { const hydro = system.cellStatesById[id]; if (hydro) normalizeQualityState(hydro); }
  ensureLocalChannelNetwork(state, region);
  ensureMajorConnections(system);
  return region;
}

function tideLevelM(state: GameState): number {
  const phase = (gameMinute(state) % TIDAL_PERIOD_MINUTES) / TIDAL_PERIOD_MINUTES;
  return round(0.62 + Math.sin(phase * Math.PI * 2) * 0.58, 4);
}

function applyTidalBoundary(state: GameState, system: WorldHydrologyState): void {
  const tide = tideLevelM(state);
  for (const node of Object.values(system.nodesById)) {
    if (node.kind !== 'coast' && node.kind !== 'estuary') continue;
    const grid = state.buildingSimulation?.gridsByPoiId?.[node.poiId];
    const cell = grid?.cells.find(candidate => candidate.id === node.cellId);
    const hydro = cell && node.cellId ? cellHydro(system, node.poiId, node.cellId) : undefined;
    if (!cell || !hydro) continue;
    normalizeQualityState(hydro);
    hydro.surfaceWaterDepthM = Math.max(0, hydro.surfaceWaterDepthM - (hydro.tidalSurfaceWaterDepthM || 0));
    const threshold = node.kind === 'coast' ? 0.46 : 0.34;
    const depth = Math.max(0, (tide - threshold) * (node.kind === 'coast' ? 0.32 : 0.42));
    hydro.tidalSurfaceWaterDepthM = round(depth, 5);
    hydro.surfaceWaterDepthM += depth;
    hydro.salinityPpt = node.kind === 'coast' ? round(31 + Math.max(0, tide) * 2.4, 2) : round(9 + Math.max(0, tide) * 8, 2);
    node.waterLevelM = tide;
    node.storageM3 = hydro.surfaceWaterDepthM * cell.areaM2;
    node.active = true;
    node.salinityPpt = hydro.salinityPpt;
  }
}

function releaseGroundwaterBaseflow(state: GameState, system: WorldHydrologyState, deltaHours: number): void {
  if (deltaHours <= 0) return;
  for (const aquifer of Object.values(system.aquifersById)) {
    if (aquifer.capacityM3 <= 0 || aquifer.storageM3 <= 0) continue;
    const fraction = clamp(aquifer.storageM3 / aquifer.capacityM3, 0, 1);
    if (fraction <= 0.08) continue;
    const watershed = system.watershedsById[aquifer.watershedId];
    if (!watershed) continue;
    const sources = Object.values(system.nodesById).filter(node => watershed.materializedRegionIds.includes(node.poiId) && (node.kind === 'spring_zone' || node.kind === 'river_entry'));
    if (!sources.length) continue;
    const rate = aquifer.capacityM3 * 0.0000075 * aquifer.conductivity * Math.pow(fraction, 1.65);
    const total = Math.min(aquifer.storageM3, rate * deltaHours);
    if (total <= 0) continue;
    aquifer.storageM3 -= total;
    for (const node of sources) {
      const volume = total / sources.length;
      const profile = REGION_HYDROLOGY_PROFILES[node.poiId];
      const grid = state.buildingSimulation?.gridsByPoiId?.[node.poiId];
      const cell = grid?.cells.find(candidate => candidate.id === node.cellId);
      const hydro = cell && node.cellId ? cellHydro(system, node.poiId, node.cellId) : undefined;
      if (!cell || !hydro) continue;
      normalizeQualityState(hydro);
      hydro.surfaceWaterDepthM += (volume / profile.effectiveLandscapeScale) / Math.max(1, cell.areaM2);
      hydro.reliableWaterAccess = clamp(hydro.reliableWaterAccess + fraction * 1.8);
      node.storageM3 = Math.min(node.capacityM3, node.storageM3 + volume);
      node.inflowM3H = volume / deltaHours;
      node.outflowM3H = node.inflowM3H;
      node.waterLevelM = hydro.surfaceWaterDepthM;
      node.active = node.outflowM3H > 0.001;
      node.temperatureC = hydro.temperatureC;
      node.dissolvedOxygenMgL = Math.max(7.2, hydro.dissolvedOxygenMgL || 0);
    }
  }
}

function outletDischarge(state: GameState, system: WorldHydrologyState, region: RegionHydrologyState): number {
  const scale = REGION_HYDROLOGY_PROFILES[region.poiId].effectiveLandscapeScale;
  return region.drainageLinks.filter(link => link.isOutlet).reduce((sum, link) => sum + (cellHydro(system, region.poiId, link.cellId)?.outflowM3H || 0) * scale, 0);
}

function synchronizeAnchorFlows(state: GameState, system: WorldHydrologyState): void {
  for (const region of Object.values(system.regionsByPoiId)) {
    if (!region) continue;
    const discharge = outletDischarge(state, system, region);
    const nodes = region.anchorNodeIds.map(id => system.nodesById[id]).filter(Boolean);
    const outlet = nodes.find(node => node.kind === 'river_exit') || nodes.find(node => node.kind === 'major_wetland') || nodes.find(node => node.kind === 'estuary');
    if (outlet) { outlet.inflowM3H = Math.max(outlet.inflowM3H, discharge); outlet.outflowM3H = Math.max(outlet.outflowM3H, discharge); outlet.active = outlet.outflowM3H > 0.01; }
  }
  for (let pass = 0; pass < 2; pass++) for (const def of HYDROLOGY_MAJOR_CONNECTIONS) {
    const edge = system.edgesById[def.id];
    const from = system.nodesById[def.fromAnchorId];
    const to = system.nodesById[def.toAnchorId];
    if (!edge || !from || !to) continue;
    edge.dischargeM3H = Math.max(0, from.outflowM3H);
    edge.depthM = round(Math.min(edge.bankfullDepthM || 1, edge.dischargeM3H / Math.max(1, edge.channelCapacityM3H) * (edge.bankfullDepthM || 1)), 3);
    to.inflowM3H = Math.max(to.inflowM3H, edge.dischargeM3H);
    if (to.kind !== 'coast') to.outflowM3H = Math.max(to.outflowM3H, to.inflowM3H);
    to.active = to.active || edge.dischargeM3H > 0.01;
  }
}

function applyDepressionSpill(state: GameState, system: WorldHydrologyState, region: RegionHydrologyState, deltaHours: number): void {
  if (deltaHours <= 0) return;
  const grid = getOrCreatePoiBuildGrid(state, region.poiId);
  const scale = REGION_HYDROLOGY_PROFILES[region.poiId].effectiveLandscapeScale;
  for (const id of region.spillwayEdgeIds || []) {
    const edge = system.edgesById[id];
    const from = edge && system.nodesById[edge.fromNodeId];
    const to = edge && system.nodesById[edge.toNodeId];
    if (!edge || !from?.cellId || !to?.cellId || from.kind !== 'depression') continue;
    const sourceCell = grid.cells.find(cell => cell.id === from.cellId);
    const targetCell = grid.cells.find(cell => cell.id === to.cellId);
    const source = sourceCell ? cellHydro(system, region.poiId, sourceCell.id) : undefined;
    const target = targetCell ? cellHydro(system, region.poiId, targetCell.id) : undefined;
    if (!source || !target || !sourceCell || !targetCell) continue;
    const fullness = from.capacityM3 > 0 ? from.storageM3 / from.capacityM3 : 0;
    if (fullness < 0.9 || source.inflowM3H <= 0.01) { edge.dischargeM3H = 0; continue; }
    const spill = Math.min(from.storageM3 * 0.24, source.inflowM3H * deltaHours * 0.72, edge.channelCapacityM3H * deltaHours / Math.max(1, scale));
    if (spill <= 0) continue;
    from.storageM3 = Math.max(0, from.storageM3 - spill);
    source.surfaceWaterDepthM = Math.max(0, source.surfaceWaterDepthM - spill / sourceCell.areaM2);
    target.surfaceWaterDepthM += spill / targetCell.areaM2;
    edge.dischargeM3H = round(spill / deltaHours * scale, 3);
  }
}

function bankfullCapacity(system: WorldHydrologyState, region: RegionHydrologyState): number {
  const nodes = region.anchorNodeIds.map(id => system.nodesById[id]).filter(Boolean);
  const node = nodes.find(n => n.kind === 'river_exit') || nodes.find(n => n.kind === 'major_wetland') || nodes.find(n => n.kind === 'estuary');
  if (node) {
    const outgoing = Object.values(system.edgesById).filter(edge => edge.fromNodeId === node.id);
    if (outgoing.length) return Math.max(180, Math.min(...outgoing.map(edge => edge.channelCapacityM3H)));
  }
  const local = (region.channelEdgeIds || []).map(id => system.edgesById[id]).filter(Boolean);
  return local.length ? Math.max(120, Math.max(...local.map(edge => edge.channelCapacityM3H))) : 260;
}

function applyFloodplainOverflow(state: GameState, system: WorldHydrologyState, region: RegionHydrologyState, deltaHours: number): void {
  if (deltaHours <= 0) return;
  const raw = outletDischarge(state, system, region);
  const overflow = Math.max(0, raw - bankfullCapacity(system, region));
  const retainedRate = overflow * 0.62;
  region.surfaceDischargeM3H = round(Math.max(0, raw - retainedRate), 3);
  if (retainedRate <= 0) return;
  const profile = REGION_HYDROLOGY_PROFILES[region.poiId];
  const grid = getOrCreatePoiBuildGrid(state, region.poiId);
  let floodM3 = retainedRate * deltaHours / Math.max(1, profile.effectiveLandscapeScale);
  const candidates = [...grid.cells].sort((a, b) => (a.elevation * 2.2 + a.drainage * 0.06 - a.floodRisk * 0.1 - (isEdgeCell(grid, a) ? 4 : 0)) - (b.elevation * 2.2 + b.drainage * 0.06 - b.floodRisk * 0.1 - (isEdgeCell(grid, b) ? 4 : 0)) || a.id.localeCompare(b.id));
  for (const cell of candidates) {
    if (floodM3 <= 0.0001) break;
    const hydro = cellHydro(system, region.poiId, cell.id);
    if (!hydro) continue;
    const maxDepth = region.poiId === 'AREA_SWAMP_CROSSING' || region.poiId === 'AREA_MANGROVE_EDGE' ? 1.1 : 0.72;
    const available = Math.max(0, (maxDepth - hydro.surfaceWaterDepthM) * cell.areaM2);
    const added = Math.min(available, floodM3);
    hydro.surfaceWaterDepthM += added / cell.areaM2;
    hydro.currentFloodRisk = clamp(hydro.currentFloodRisk + hydro.surfaceWaterDepthM * 180);
    hydro.maxObservedFloodDepthM = Math.max(hydro.maxObservedFloodDepthM, hydro.surfaceWaterDepthM);
    floodM3 -= added;
  }
}

function routeWaterQuality(state: GameState, system: WorldHydrologyState, region: RegionHydrologyState, deltaHours: number): void {
  const grid = getOrCreatePoiBuildGrid(state, region.poiId);
  const links = new Map(region.drainageLinks.map(link => [link.cellId, link]));
  const ordered = [...grid.cells].sort((a, b) => b.elevation - a.elevation || a.id.localeCompare(b.id));
  const waterfallCells = new Set(region.anchorNodeIds.map(id => system.nodesById[id]).filter(node => node?.kind === 'waterfall' && node.cellId).map(node => node.cellId!));
  for (const cell of grid.cells) {
    const hydro = cellHydro(system, region.poiId, cell.id); if (!hydro) continue; normalizeQualityState(hydro);
    const soil = SOIL_HYDROLOGY_PROFILES[cell.soilType];
    const exposed = clamp(1 - cell.vegetation / 100 * 0.62 - cell.roots / 100 * 0.18, 0.08, 1);
    const runoffM3 = hydro.runoffMmH * deltaHours * cell.areaM2 / 1000;
    hydro.sedimentKg! += Math.max(0, runoffM3 * 3.4 * (0.25 + Math.min(2.4, cell.slope / 18)) * exposed * (1 - soil.erosionResistance * 0.72));
    hydro.contaminantLoad! *= Math.exp(-0.012 * deltaHours);
  }
  for (const cell of ordered) {
    const link = links.get(cell.id); if (!link?.downstreamCellId) continue;
    const source = cellHydro(system, region.poiId, cell.id); const target = cellHydro(system, region.poiId, link.downstreamCellId);
    if (!source || !target) continue; normalizeQualityState(source); normalizeQualityState(target);
    const fraction = clamp(source.outflowM3H / Math.max(0.25, source.outflowM3H + 1.4), 0.04, 0.68);
    const sediment = source.sedimentKg! * fraction; const contaminant = source.contaminantLoad! * fraction;
    source.sedimentKg! -= sediment; source.contaminantLoad! -= contaminant;
    target.sedimentKg! += sediment; target.contaminantLoad! += contaminant;
  }
  for (const cell of grid.cells) {
    const hydro = cellHydro(system, region.poiId, cell.id); if (!hydro) continue; normalizeQualityState(hydro);
    const moving = Math.max(0.02, hydro.surfaceWaterDepthM * cell.areaM2 + (hydro.inflowM3H + hydro.outflowM3H) * 0.04);
    hydro.turbidity = round(clamp(hydro.sedimentKg! / moving * 2.8), 2);
    hydro.contamination = round(clamp(hydro.contaminantLoad! / moving * 2.2), 2);
    const aeration = Math.min(3.4, hydro.outflowM3H * 0.18) + (waterfallCells.has(cell.id) ? 3.2 : 0);
    hydro.dissolvedOxygenMgL = round(clamp(8.7 + aeration - Math.max(0, hydro.temperatureC - 22) * 0.16 - hydro.contamination * 0.022 - hydro.turbidity * 0.004, 1.2, 13.5), 2);
  }
  for (const edgeId of region.channelEdgeIds || []) {
    const edge = system.edgesById[edgeId]; const from = edge && system.nodesById[edge.fromNodeId];
    if (!edge || !from?.cellId) continue;
    const hydro = cellHydro(system, region.poiId, from.cellId); if (!hydro) continue;
    const scale = REGION_HYDROLOGY_PROFILES[region.poiId].effectiveLandscapeScale;
    edge.dischargeM3H = round(hydro.outflowM3H * scale, 3);
    edge.depthM = round(Math.min(edge.bankfullDepthM || 1, edge.dischargeM3H / Math.max(1, edge.channelCapacityM3H) * (edge.bankfullDepthM || 1)), 3);
    edge.sedimentLoadKg = round(hydro.sedimentKg! * scale, 3); edge.contaminationLoad = round(hydro.contaminantLoad! * scale, 3);
    edge.temperatureC = hydro.temperatureC; edge.dissolvedOxygenMgL = hydro.dissolvedOxygenMgL; edge.turbidity = hydro.turbidity; edge.salinityPpt = hydro.salinityPpt;
    from.outflowM3H = edge.dischargeM3H; from.active = edge.dischargeM3H > 0.01 || hydro.surfaceWaterDepthM > 0.005;
    from.temperatureC = hydro.temperatureC; from.dissolvedOxygenMgL = hydro.dissolvedOxygenMgL; from.turbidity = hydro.turbidity; from.contamination = hydro.contamination; from.salinityPpt = hydro.salinityPpt; from.sedimentLoadKg = hydro.sedimentKg;
  }
}

function syncMajorQuality(system: WorldHydrologyState): void {
  for (const def of HYDROLOGY_MAJOR_CONNECTIONS) {
    const edge = system.edgesById[def.id]; const from = edge && system.nodesById[edge.fromNodeId]; if (!edge || !from) continue;
    edge.temperatureC = from.temperatureC ?? edge.temperatureC ?? 25; edge.dissolvedOxygenMgL = from.dissolvedOxygenMgL ?? edge.dissolvedOxygenMgL ?? 7.8;
    edge.turbidity = from.turbidity ?? edge.turbidity ?? 0; edge.salinityPpt = from.salinityPpt ?? edge.salinityPpt ?? 0;
    edge.sedimentLoadKg = from.sedimentLoadKg || 0; edge.contaminationLoad = from.contamination || 0;
  }
}

function aggregateDischarge(system: WorldHydrologyState): void {
  for (const watershed of Object.values(system.watershedsById)) watershed.dischargeM3H = round(watershed.materializedRegionIds.reduce((sum, poiId) => sum + (system.regionsByPoiId[poiId]?.surfaceDischargeM3H || 0), 0), 3);
}

export function tickSurfaceWaterHydrology(state: GameState, deltaGameMinutes: number): void {
  if (deltaGameMinutes <= 0) return;
  const system = ensureWorldHydrology(state); system.version = Math.max(SURFACE_HYDROLOGY_VERSION, system.version || 1);
  const regions = Object.values(system.regionsByPoiId).filter((region): region is RegionHydrologyState => Boolean(region));
  for (const region of regions) ensureSurfaceWaterNetwork(state, region.poiId);
  ensureMajorConnections(system);
  const hours = deltaGameMinutes / 60;
  applyTidalBoundary(state, system); releaseGroundwaterBaseflow(state, system, hours); synchronizeAnchorFlows(state, system);
  for (const region of regions) { applyDepressionSpill(state, system, region, hours); applyFloodplainOverflow(state, system, region, hours); routeWaterQuality(state, system, region, hours); }
  synchronizeAnchorFlows(state, system); syncMajorQuality(system); aggregateDischarge(system);
}

export function addCellContaminationLoad(state: GameState, areaId: string, cellId: string, amount: number): void {
  const poiId = resolveMainWorldAreaId(areaId); if (!poiId || amount <= 0) return;
  ensureSurfaceWaterNetwork(state, poiId); const hydro = cellHydro(ensureWorldHydrology(state), poiId, cellId); if (!hydro) return;
  normalizeQualityState(hydro); hydro.contaminantLoad! += amount;
}

export function getRegionSurfaceWaterEdges(state: GameState, areaId: string): HydrologyEdge[] {
  const poiId = resolveMainWorldAreaId(areaId); if (!poiId) return [];
  const region = state.hydrologySystem?.regionsByPoiId?.[poiId]; if (!region) return [];
  return [...new Set([...(region.channelEdgeIds || []), ...(region.spillwayEdgeIds || [])])].map(id => state.hydrologySystem!.edgesById[id]).filter(Boolean);
}

export function getCurrentTideLevelM(state: GameState): number { return tideLevelM(state); }
