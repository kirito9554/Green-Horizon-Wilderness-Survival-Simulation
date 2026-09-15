import type { GameState } from '../types';
import type { HydrologyEdge, HydrologyNode, WaterInfrastructureInstance } from '../types/hydrologySimulation';
import type {
  AquaticBarrierSnapshot,
  AquaticConnectivityLink,
  AquaticConnectivityMode,
  AquaticHabitatCandidate,
  AquaticHabitatType,
  AquaticHydrologyCriteria,
  AquaticWaterBodySnapshot,
  AquaticWaterQualitySnapshot,
  HydroperiodSnapshot,
} from '../types/aquaticHydrology';
import { resolveMainWorldAreaId, type MainWorldAreaId } from '../data/mainWorldAreas';
import { ensureWorldHydrology } from './hydrologySystem';
import { ensureSurfaceWaterNetwork } from './hydrologySurfaceWaterSystem';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number, digits = 4) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const DEFAULT_CRITERIA: Required<AquaticHydrologyCriteria> = {
  minDepthM: 0.05,
  maxDepthM: 50,
  minDissolvedOxygenMgL: 2.5,
  maxVelocityMps: 3.2,
  minVelocityMps: 0,
  minSalinityPpt: 0,
  maxSalinityPpt: 40,
  maxTurbidity: 100,
  maxContamination: 100,
  minimumPassability: 0.12,
};

function normalizedCriteria(input?: AquaticHydrologyCriteria): Required<AquaticHydrologyCriteria> {
  return { ...DEFAULT_CRITERIA, ...(input || {}) };
}

function nodeQuality(node: HydrologyNode): AquaticWaterQualitySnapshot {
  return {
    temperatureC: node.temperatureC ?? 25,
    dissolvedOxygenMgL: node.dissolvedOxygenMgL ?? 7.8,
    turbidity: node.turbidity ?? 0,
    contamination: node.contamination ?? 0,
    salinityPpt: node.salinityPpt ?? 0,
  };
}

function edgeQuality(edge: HydrologyEdge, from?: HydrologyNode, to?: HydrologyNode): AquaticWaterQualitySnapshot {
  const fallback = from ? nodeQuality(from) : to ? nodeQuality(to) : { temperatureC: 25, dissolvedOxygenMgL: 7.8, turbidity: 0, contamination: 0, salinityPpt: 0 };
  return {
    temperatureC: edge.temperatureC ?? fallback.temperatureC,
    dissolvedOxygenMgL: edge.dissolvedOxygenMgL ?? fallback.dissolvedOxygenMgL,
    turbidity: edge.turbidity ?? fallback.turbidity,
    contamination: edge.contaminationLoad ?? fallback.contamination,
    salinityPpt: edge.salinityPpt ?? fallback.salinityPpt,
  };
}

function classifyHydroperiod(reliability: number): HydroperiodSnapshot['classification'] {
  if (reliability >= 0.72) return 'perennial';
  if (reliability >= 0.18) return 'seasonal';
  return 'ephemeral';
}

export function getCellHydroperiod(state: GameState, areaId: string, cellId: string): HydroperiodSnapshot | undefined {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return undefined;
  ensureSurfaceWaterNetwork(state, poiId);
  const hydro = state.hydrologySystem?.cellStatesById?.[`${poiId}:${cellId}`];
  if (!hydro) return undefined;
  const observed = Math.max(0, hydro.observedHours || 0);
  const flooded = Math.max(0, Math.min(observed, hydro.floodedHours || 0));
  const wetFraction = observed > 0 ? flooded / observed : 0;
  const reliableAccess = clamp01((hydro.reliableWaterAccess || 0) / 100);
  const currentWet = hydro.surfaceWaterDepthM >= 0.02 || hydro.inflowM3H > 0.01 || hydro.outflowM3H > 0.01;
  const reliability = clamp01(Math.max(wetFraction, reliableAccess * 0.9, currentWet && observed <= 1 ? 0.12 : 0));
  return {
    currentWet,
    observedHours: round(observed, 2),
    floodedHours: round(flooded, 2),
    wetFraction: round(wetFraction, 4),
    reliability: round(reliability, 4),
    classification: classifyHydroperiod(reliability),
  };
}

function nodeHydroperiod(state: GameState, node: HydrologyNode): HydroperiodSnapshot {
  if (node.cellId) {
    const cell = getCellHydroperiod(state, node.poiId, node.cellId);
    if (cell) return cell;
  }
  const currentWet = node.active && (node.storageM3 > 0.001 || node.inflowM3H > 0.01 || node.outflowM3H > 0.01 || node.waterLevelM > 0.01);
  const reliability = currentWet ? 0.5 : 0;
  return { currentWet, observedHours: 0, floodedHours: 0, wetFraction: 0, reliability, classification: classifyHydroperiod(reliability) };
}

function averageHydroperiod(snapshots: HydroperiodSnapshot[]): HydroperiodSnapshot {
  if (!snapshots.length) return { currentWet: false, observedHours: 0, floodedHours: 0, wetFraction: 0, reliability: 0, classification: 'ephemeral' };
  const observedHours = snapshots.reduce((sum, item) => sum + item.observedHours, 0);
  const floodedHours = snapshots.reduce((sum, item) => sum + item.floodedHours, 0);
  const wetFraction = observedHours > 0 ? floodedHours / observedHours : snapshots.reduce((sum, item) => sum + item.wetFraction, 0) / snapshots.length;
  const reliability = snapshots.reduce((sum, item) => sum + item.reliability, 0) / snapshots.length;
  return {
    currentWet: snapshots.some(item => item.currentWet),
    observedHours: round(observedHours, 2),
    floodedHours: round(floodedHours, 2),
    wetFraction: round(wetFraction, 4),
    reliability: round(reliability, 4),
    classification: classifyHydroperiod(reliability),
  };
}

function edgeCells(state: GameState, edge: HydrologyEdge): string[] {
  const system = state.hydrologySystem;
  if (!system) return [];
  const from = system.nodesById[edge.fromNodeId];
  const to = system.nodesById[edge.toNodeId];
  return [from?.cellId, to?.cellId].filter((value): value is string => Boolean(value));
}

function infrastructureAffectsEdge(state: GameState, infrastructure: WaterInfrastructureInstance, edge: HydrologyEdge): boolean {
  if (!infrastructure.active || !['weir', 'sluice'].includes(infrastructure.kind)) return false;
  const directNodeMatch = infrastructure.inputNodeIds.includes(edge.fromNodeId)
    || infrastructure.inputNodeIds.includes(edge.toNodeId)
    || infrastructure.outputNodeIds.includes(edge.fromNodeId)
    || infrastructure.outputNodeIds.includes(edge.toNodeId);
  if (directNodeMatch) return true;
  const cells = new Set(edgeCells(state, edge));
  if (!cells.size) return false;
  return [...(infrastructure.cellIds || []), ...(infrastructure.targetCellIds || [])].some(id => cells.has(id));
}

function infrastructurePassability(state: GameState, infrastructure: WaterInfrastructureInstance): { passability: number; reason: string } {
  const condition = clamp01((state.buildings.find(building => building.id === infrastructure.structureId)?.condition ?? 100) / 100);
  const blockage = clamp01(infrastructure.blockage || 0);
  if (infrastructure.kind === 'weir') {
    return {
      passability: clamp01(0.1 + 0.3 * condition * (1 - blockage)),
      reason: 'diversion weir obstructs upstream/downstream aquatic movement',
    };
  }
  const flowFraction = infrastructure.capacityM3H > 0 ? clamp01((infrastructure.currentFlowM3H || 0) / infrastructure.capacityM3H) : 0;
  return {
    passability: clamp01(0.08 + 0.82 * flowFraction * condition * (1 - blockage)),
    reason: flowFraction > 0.25 ? 'sluice allows partial passage while flowing' : 'closed or weak-flow sluice strongly restricts passage',
  };
}

export function getAquaticBarriers(state: GameState, areaId?: string): AquaticBarrierSnapshot[] {
  const system = ensureWorldHydrology(state);
  const poiId = areaId ? resolveMainWorldAreaId(areaId) : undefined;
  if (poiId) ensureSurfaceWaterNetwork(state, poiId);
  const edges = Object.values(system.edgesById).filter(edge => !poiId || edge.fromPoiId === poiId || edge.toPoiId === poiId);
  const result: AquaticBarrierSnapshot[] = [];
  for (const infrastructure of system.infrastructure || []) {
    if (poiId && infrastructure.poiId !== poiId) continue;
    if (!infrastructure.active || !['weir', 'sluice'].includes(infrastructure.kind)) continue;
    const affected = edges.filter(edge => infrastructureAffectsEdge(state, infrastructure, edge)).map(edge => edge.id);
    if (!affected.length) continue;
    const profile = infrastructurePassability(state, infrastructure);
    result.push({
      infrastructureId: infrastructure.id,
      structureId: infrastructure.structureId,
      kind: infrastructure.kind,
      poiId: infrastructure.poiId,
      affectedEdgeIds: affected.sort(),
      passability: round(profile.passability, 4),
      reason: profile.reason,
    });
  }
  return result.sort((a, b) => a.infrastructureId.localeCompare(b.infrastructureId));
}

function edgeLimitingFactors(state: GameState, edge: HydrologyEdge, criteria: Required<AquaticHydrologyCriteria>): string[] {
  const system = ensureWorldHydrology(state);
  const from = system.nodesById[edge.fromNodeId];
  const to = system.nodesById[edge.toNodeId];
  const quality = edgeQuality(edge, from, to);
  const depth = Math.max(0, edge.depthM || 0);
  const factors: string[] = [];
  if (edge.dischargeM3H <= 0.001 && depth < criteria.minDepthM) factors.push('dry');
  if (depth < criteria.minDepthM) factors.push('too_shallow');
  if (depth > criteria.maxDepthM) factors.push('too_deep');
  if (edge.flowVelocityMps < criteria.minVelocityMps) factors.push('flow_too_slow');
  if (edge.flowVelocityMps > criteria.maxVelocityMps) factors.push('flow_too_fast');
  if (quality.dissolvedOxygenMgL < criteria.minDissolvedOxygenMgL) factors.push('low_oxygen');
  if (quality.salinityPpt < criteria.minSalinityPpt || quality.salinityPpt > criteria.maxSalinityPpt) factors.push('salinity_out_of_range');
  if (quality.turbidity > criteria.maxTurbidity) factors.push('turbidity_too_high');
  if (quality.contamination > criteria.maxContamination) factors.push('contamination_too_high');
  return [...new Set(factors)];
}

export function getAquaticConnectivityLinks(
  state: GameState,
  areaId?: string,
  criteriaInput?: AquaticHydrologyCriteria,
): AquaticConnectivityLink[] {
  const system = ensureWorldHydrology(state);
  const poiId = areaId ? resolveMainWorldAreaId(areaId) : undefined;
  if (poiId) ensureSurfaceWaterNetwork(state, poiId);
  const criteria = normalizedCriteria(criteriaInput);
  const barriers = getAquaticBarriers(state, poiId);
  return Object.values(system.edgesById)
    .filter(edge => !poiId || edge.fromPoiId === poiId || edge.toPoiId === poiId)
    .map(edge => {
      const limitingFactors = edgeLimitingFactors(state, edge, criteria);
      const hydraulicOpen = limitingFactors.length === 0;
      const edgeBarriers = barriers.filter(barrier => barrier.affectedEdgeIds.includes(edge.id));
      const passability = edgeBarriers.reduce((value, barrier) => value * barrier.passability, hydraulicOpen ? 1 : 0);
      const biologicalOpen = hydraulicOpen && passability >= criteria.minimumPassability;
      if (hydraulicOpen && !biologicalOpen) limitingFactors.push('biological_barrier');
      return {
        edgeId: edge.id,
        kind: edge.kind,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        fromPoiId: edge.fromPoiId,
        toPoiId: edge.toPoiId,
        hydraulicOpen,
        biologicalOpen,
        passability: round(passability, 4),
        limitingFactors,
      };
    })
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId));
}

function weightedQuality(entries: Array<{ quality: AquaticWaterQualitySnapshot; weight: number }>): AquaticWaterQualitySnapshot {
  const total = entries.reduce((sum, entry) => sum + Math.max(0.0001, entry.weight), 0);
  const avg = (selector: (quality: AquaticWaterQualitySnapshot) => number) => entries.reduce((sum, entry) => sum + selector(entry.quality) * Math.max(0.0001, entry.weight), 0) / Math.max(0.0001, total);
  return {
    temperatureC: round(avg(q => q.temperatureC), 2),
    dissolvedOxygenMgL: round(avg(q => q.dissolvedOxygenMgL), 2),
    turbidity: round(avg(q => q.turbidity), 2),
    contamination: round(avg(q => q.contamination), 2),
    salinityPpt: round(avg(q => q.salinityPpt), 2),
  };
}

function determineHabitatType(state: GameState, nodes: HydrologyNode[], edges: HydrologyEdge[], quality: AquaticWaterQualitySnapshot): AquaticHabitatType {
  const system = state.hydrologySystem!;
  const managedPond = nodes.some(node => node.kind === 'managed_storage' && system.infrastructure.some(infrastructure => infrastructure.kind === 'pond' && infrastructure.outputNodeIds.includes(node.id)));
  if (managedPond) return 'managed_pond';
  if (nodes.some(node => node.kind === 'coast' || node.kind === 'estuary') || edges.some(edge => edge.kind === 'tidal' || edge.kind === 'estuary') || quality.salinityPpt >= 3) return 'tidal_water';
  if (edges.some(edge => edge.flowVelocityMps >= 0.08 && (edge.dischargeM3H > 0.01 || (edge.depthM || 0) > 0.05))) return 'flowing_channel';
  return 'standing_water';
}

function bodySnapshot(
  state: GameState,
  nodeIds: string[],
  edgeIds: string[],
  links: AquaticConnectivityLink[],
): AquaticWaterBodySnapshot {
  const system = ensureWorldHydrology(state);
  const nodes = nodeIds.map(id => system.nodesById[id]).filter((node): node is HydrologyNode => Boolean(node));
  const edges = edgeIds.map(id => system.edgesById[id]).filter((edge): edge is HydrologyEdge => Boolean(edge));
  const channelVolume = edges.reduce((sum, edge) => sum + Math.max(0, edge.lengthM * edge.widthM * Math.max(0, edge.depthM || 0)), 0);
  const nodeVolume = nodes.reduce((sum, node) => sum + Math.max(0, node.storageM3), 0);
  const qualityEntries = [
    ...nodes.map(node => ({ quality: nodeQuality(node), weight: Math.max(0.1, node.storageM3) })),
    ...edges.map(edge => ({ quality: edgeQuality(edge, system.nodesById[edge.fromNodeId], system.nodesById[edge.toNodeId]), weight: Math.max(0.1, edge.lengthM * edge.widthM * Math.max(0.02, edge.depthM || 0)) })),
  ];
  const quality = weightedQuality(qualityEntries.length ? qualityEntries : [{ quality: { temperatureC: 25, dissolvedOxygenMgL: 7.8, turbidity: 0, contamination: 0, salinityPpt: 0 }, weight: 1 }]);
  const hydroperiod = averageHydroperiod(nodes.map(node => nodeHydroperiod(state, node)));
  const relevantLinks = links.filter(link => edgeIds.includes(link.edgeId));
  const hydraulicConnectivity = relevantLinks.length ? relevantLinks.filter(link => link.hydraulicOpen).length / relevantLinks.length : (hydroperiod.currentWet ? 1 : 0);
  const biologicalConnectivity = relevantLinks.length ? relevantLinks.reduce((sum, link) => sum + (link.biologicalOpen ? link.passability : 0), 0) / relevantLinks.length : hydraulicConnectivity;
  const meanDepthM = edges.length ? edges.reduce((sum, edge) => sum + Math.max(0, edge.depthM || 0), 0) / edges.length : nodes.reduce((sum, node) => sum + Math.max(0, node.waterLevelM), 0) / Math.max(1, nodes.length);
  const meanVelocityMps = edges.length ? edges.reduce((sum, edge) => sum + Math.max(0, edge.flowVelocityMps), 0) / edges.length : 0;
  const poiIds = [...new Set(nodes.map(node => node.poiId))].sort() as MainWorldAreaId[];
  const limitingFactors = [...new Set(relevantLinks.flatMap(link => link.limitingFactors))].sort();
  const stableId = [...nodeIds].sort().join('|');
  return {
    id: `aquatic_body_${simpleHash(stableId).toString(36)}`,
    nodeIds: [...nodeIds].sort(),
    edgeIds: [...edgeIds].sort(),
    poiIds,
    nodeKinds: [...new Set(nodes.map(node => node.kind))],
    habitatType: determineHabitatType(state, nodes, edges, quality),
    currentVolumeM3: round(nodeVolume + channelVolume, 3),
    estimatedChannelVolumeM3: round(channelVolume, 3),
    meanDepthM: round(meanDepthM, 3),
    meanVelocityMps: round(meanVelocityMps, 3),
    quality,
    hydroperiod,
    hydraulicConnectivity: round(hydraulicConnectivity, 4),
    biologicalConnectivity: round(biologicalConnectivity, 4),
    limitingFactors,
  };
}

function simpleHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function componentFromNode(
  state: GameState,
  startNodeId: string,
  links: AquaticConnectivityLink[],
  mode: AquaticConnectivityMode,
): { nodeIds: string[]; edgeIds: string[] } {
  const system = ensureWorldHydrology(state);
  const visited = new Set<string>();
  const edges = new Set<string>();
  const queue = [startNodeId];
  while (queue.length) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId) || !system.nodesById[nodeId]) continue;
    visited.add(nodeId);
    for (const link of links) {
      const open = mode === 'biological' ? link.biologicalOpen : link.hydraulicOpen;
      if (!open) continue;
      if (link.fromNodeId !== nodeId && link.toNodeId !== nodeId) continue;
      edges.add(link.edgeId);
      const other = link.fromNodeId === nodeId ? link.toNodeId : link.fromNodeId;
      if (!visited.has(other)) queue.push(other);
    }
  }
  return { nodeIds: [...visited], edgeIds: [...edges] };
}

function startNodesForRef(state: GameState, poiId: MainWorldAreaId, refId: string): string[] {
  const system = ensureWorldHydrology(state);
  if (system.nodesById[refId]) return [refId];
  const edge = system.edgesById[refId];
  if (edge) return [edge.fromNodeId, edge.toNodeId];
  return Object.values(system.nodesById).filter(node => node.poiId === poiId && node.cellId === refId).map(node => node.id);
}

export function getConnectedAquaticWaterBody(
  state: GameState,
  areaId: string,
  startRefId: string,
  criteriaInput?: AquaticHydrologyCriteria,
  mode: AquaticConnectivityMode = 'hydraulic',
): AquaticWaterBodySnapshot | undefined {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return undefined;
  ensureSurfaceWaterNetwork(state, poiId);
  const links = getAquaticConnectivityLinks(state, undefined, criteriaInput);
  const starts = startNodesForRef(state, poiId, startRefId);
  if (!starts.length) return undefined;
  const mergedNodes = new Set<string>();
  const mergedEdges = new Set<string>();
  for (const start of starts) {
    const component = componentFromNode(state, start, links, mode);
    for (const id of component.nodeIds) mergedNodes.add(id);
    for (const id of component.edgeIds) mergedEdges.add(id);
  }
  if (!mergedNodes.size) return undefined;
  const snapshot = bodySnapshot(state, [...mergedNodes], [...mergedEdges], links);
  if (!snapshot.hydroperiod.currentWet && snapshot.currentVolumeM3 <= 0.001) return undefined;
  return snapshot;
}

export function queryAquaticWaterBodies(
  state: GameState,
  areaId: string,
  criteriaInput?: AquaticHydrologyCriteria,
  mode: AquaticConnectivityMode = 'hydraulic',
): AquaticWaterBodySnapshot[] {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return [];
  ensureSurfaceWaterNetwork(state, poiId);
  const system = ensureWorldHydrology(state);
  const links = getAquaticConnectivityLinks(state, undefined, criteriaInput);
  const candidateNodes = Object.values(system.nodesById)
    .filter(node => node.poiId === poiId)
    .filter(node => nodeHydroperiod(state, node).currentWet || node.storageM3 > 0.001 || node.outflowM3H > 0.01 || node.inflowM3H > 0.01);
  const visited = new Set<string>();
  const bodies: AquaticWaterBodySnapshot[] = [];
  for (const node of candidateNodes.sort((a, b) => a.id.localeCompare(b.id))) {
    if (visited.has(node.id)) continue;
    const component = componentFromNode(state, node.id, links, mode);
    for (const id of component.nodeIds) visited.add(id);
    const snapshot = bodySnapshot(state, component.nodeIds, component.edgeIds, links);
    if (snapshot.hydroperiod.currentWet || snapshot.currentVolumeM3 > 0.001) bodies.push(snapshot);
  }
  return bodies.sort((a, b) => b.currentVolumeM3 - a.currentVolumeM3 || a.id.localeCompare(b.id));
}

function bodySuitability(body: AquaticWaterBodySnapshot, criteria: Required<AquaticHydrologyCriteria>): number {
  if (body.meanDepthM < criteria.minDepthM || body.meanDepthM > criteria.maxDepthM) return 0;
  if (body.meanVelocityMps < criteria.minVelocityMps || body.meanVelocityMps > criteria.maxVelocityMps) return 0;
  if (body.quality.dissolvedOxygenMgL < criteria.minDissolvedOxygenMgL) return 0;
  if (body.quality.salinityPpt < criteria.minSalinityPpt || body.quality.salinityPpt > criteria.maxSalinityPpt) return 0;
  if (body.quality.turbidity > criteria.maxTurbidity || body.quality.contamination > criteria.maxContamination) return 0;
  const depthTarget = Math.max(criteria.minDepthM, Math.min(criteria.maxDepthM, 0.8));
  const depthScore = clamp01(1 - Math.abs(body.meanDepthM - depthTarget) / Math.max(0.2, criteria.maxDepthM - criteria.minDepthM));
  const oxygenScore = clamp01((body.quality.dissolvedOxygenMgL - criteria.minDissolvedOxygenMgL) / Math.max(1, 10 - criteria.minDissolvedOxygenMgL));
  const qualityScore = clamp01(1 - body.quality.contamination / Math.max(1, criteria.maxContamination)) * clamp01(1 - body.quality.turbidity / Math.max(1, criteria.maxTurbidity));
  return clamp01(depthScore * 0.25 + oxygenScore * 0.25 + qualityScore * 0.15 + body.hydroperiod.reliability * 0.2 + body.biologicalConnectivity * 0.15);
}

export function queryAquaticHabitatCandidates(
  state: GameState,
  areaId: string,
  criteriaInput?: AquaticHydrologyCriteria,
): AquaticHabitatCandidate[] {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return [];
  const criteria = normalizedCriteria(criteriaInput);
  const bodies = queryAquaticWaterBodies(state, poiId, criteria, 'hydraulic');
  const system = ensureWorldHydrology(state);
  return bodies
    .filter(body => body.poiIds.includes(poiId))
    .map(body => {
      const nodes = body.nodeIds.map(id => system.nodesById[id]).filter(Boolean);
      const cellIds = [...new Set(nodes.filter(node => node.poiId === poiId).map(node => node.cellId).filter((value): value is string => Boolean(value)))];
      const suitability = bodySuitability(body, criteria);
      const limitingFactors = [...body.limitingFactors];
      if (suitability <= 0) limitingFactors.push('habitat_criteria_not_met');
      return {
        id: `aquatic_candidate_${body.id}_${poiId}`,
        waterBodyId: body.id,
        poiId,
        habitatType: body.habitatType,
        nodeIds: body.nodeIds,
        edgeIds: body.edgeIds,
        cellIds,
        depthM: body.meanDepthM,
        velocityMps: body.meanVelocityMps,
        currentVolumeM3: body.currentVolumeM3,
        hydroperiod: body.hydroperiod,
        quality: body.quality,
        hydraulicConnectivity: body.hydraulicConnectivity,
        biologicalConnectivity: body.biologicalConnectivity,
        suitability: round(suitability, 4),
        limitingFactors: [...new Set(limitingFactors)].sort(),
      };
    })
    .filter(candidate => candidate.cellIds.length > 0 && candidate.suitability > 0)
    .sort((a, b) => b.suitability - a.suitability || b.currentVolumeM3 - a.currentVolumeM3 || a.id.localeCompare(b.id));
}
