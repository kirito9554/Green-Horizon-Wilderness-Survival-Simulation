import type { GameState } from '../types';
import type { HydrologyNode } from '../types/hydrologySimulation';
import { REGION_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';
import { tickAquaticEcologyWithBootstrap } from './aquaticBootstrapSystem';

/**
 * Hydrology uses small deterministic BuildGrid samples to represent much larger
 * landscape processes. Natural macro nodes therefore store a representative
 * control volume rather than a literal bucket that a survivor can empty by hand.
 * Local depressions and player-built storage remain literal physical volumes.
 */
export type EnvironmentalWaterScaleClass =
  | 'boundary'
  | 'macro_environment'
  | 'local_natural'
  | 'managed_storage';

export interface EnvironmentalWaterManagementSnapshot {
  nodes: Array<{
    nodeId: string;
    scaleClass: EnvironmentalWaterScaleClass;
    representativeStorageM3: number;
    managementScale: number;
  }>;
}

interface TemporaryEcologyScaleSnapshot {
  nodeId: string;
  storageM3: number;
  capacityM3: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function getEnvironmentalWaterScaleClass(node: HydrologyNode): EnvironmentalWaterScaleClass {
  if (node.kind === 'managed_storage') return 'managed_storage';
  if (node.kind === 'coast') return 'boundary';
  if (node.kind === 'depression' || node.kind === 'channel') return 'local_natural';
  return 'macro_environment';
}

/**
 * Full landscape scale is appropriate for water accounting: one modeled cell or
 * macro anchor stands in for a much larger contributing landscape. This does not
 * multiply flow rates, which are already routed as physical discharge by the
 * hydrology system; it only expands representative stored volume during player
 * withdrawals/deposits.
 */
export function getEnvironmentalWaterManagementScale(node: HydrologyNode): number {
  const scaleClass = getEnvironmentalWaterScaleClass(node);
  if (scaleClass === 'managed_storage' || scaleClass === 'local_natural') return 1;
  const regionScale = REGION_HYDROLOGY_PROFILES[node.poiId]?.effectiveLandscapeScale || 1;
  return Math.max(1, regionScale);
}

/**
 * Ecology needs a larger-than-grid water volume, but using the entire watershed
 * multiplier would make a single node stand in for an implausibly huge uniform
 * habitat. A bounded square-root scale represents the surrounding reachable
 * reach/wetland while keeping local pools and managed ponds literal.
 */
export function getAquaticEcologicalRepresentationScale(node: HydrologyNode): number {
  const scaleClass = getEnvironmentalWaterScaleClass(node);
  if (scaleClass === 'managed_storage' || scaleClass === 'local_natural') return 1;
  const regionScale = REGION_HYDROLOGY_PROFILES[node.poiId]?.effectiveLandscapeScale || 1;
  const base = Math.sqrt(Math.max(1, regionScale));
  return scaleClass === 'boundary'
    ? clamp(base * 1.6, 12, 64)
    : clamp(base * 1.1, 8, 48);
}

export function getEffectiveEnvironmentalStorageM3(node: HydrologyNode): number {
  const scaleClass = getEnvironmentalWaterScaleClass(node);
  if (scaleClass === 'boundary') return Number.POSITIVE_INFINITY;
  return Math.max(0, node.storageM3) * getEnvironmentalWaterManagementScale(node);
}

/**
 * Expand only representative natural storage immediately before WaterManagement.
 * Natural discharge is intentionally not scaled here: surface hydrology already
 * expresses routed macro discharge in m3/h, so a diversion continues to reduce
 * downstream flow by its real withdrawn rate.
 */
export function prepareEnvironmentalWaterManagementScale(state: GameState): EnvironmentalWaterManagementSnapshot {
  const nodes: EnvironmentalWaterManagementSnapshot['nodes'] = [];
  const system = state.hydrologySystem;
  if (!system) return { nodes };

  for (const node of Object.values(system.nodesById)) {
    const scaleClass = getEnvironmentalWaterScaleClass(node);
    if (scaleClass === 'managed_storage' || scaleClass === 'local_natural') continue;
    const managementScale = getEnvironmentalWaterManagementScale(node);
    nodes.push({
      nodeId: node.id,
      scaleClass,
      representativeStorageM3: node.storageM3,
      managementScale,
    });

    if (scaleClass === 'boundary') {
      // Ocean/coastal water is an external boundary at this game scale. Give the
      // management pass a large finite working volume, then restore the boundary.
      node.storageM3 = Math.max(node.storageM3, node.capacityM3, 1) * managementScale;
    } else {
      node.storageM3 *= managementScale;
    }
  }
  return { nodes };
}

/**
 * Convert macro storage back to its representative control-volume state after
 * management. Deposits and withdrawals remain mass-conserving because the
 * temporary expanded volume is divided by the same landscape scale. Boundary
 * water is restored because the ocean is not an exhaustible player reservoir.
 */
export function finalizeEnvironmentalWaterManagementScale(
  state: GameState,
  snapshot: EnvironmentalWaterManagementSnapshot,
): void {
  const system = state.hydrologySystem;
  if (!system) return;
  for (const saved of snapshot.nodes) {
    const node = system.nodesById[saved.nodeId];
    if (!node) continue;
    if (saved.scaleClass === 'boundary') {
      node.storageM3 = saved.representativeStorageM3;
      continue;
    }
    node.storageM3 = Math.max(0, node.storageM3 / Math.max(1, saved.managementScale));
  }
}

function prepareAquaticEcologyScale(state: GameState): TemporaryEcologyScaleSnapshot[] {
  const system = state.hydrologySystem;
  if (!system) return [];
  const snapshots: TemporaryEcologyScaleSnapshot[] = [];
  for (const node of Object.values(system.nodesById)) {
    const scale = getAquaticEcologicalRepresentationScale(node);
    if (scale <= 1) continue;
    snapshots.push({ nodeId: node.id, storageM3: node.storageM3, capacityM3: node.capacityM3 });
    node.storageM3 *= scale;
    node.capacityM3 *= scale;
  }
  return snapshots;
}

function restoreAquaticEcologyScale(state: GameState, snapshots: TemporaryEcologyScaleSnapshot[]): void {
  const system = state.hydrologySystem;
  if (!system) return;
  for (const saved of snapshots) {
    const node = system.nodesById[saved.nodeId];
    if (!node) continue;
    node.storageM3 = saved.storageM3;
    node.capacityM3 = saved.capacityM3;
  }
}

/**
 * Aquatic populations and food-web resources see an ecological reach volume,
 * not the tiny representative control volume used by the local BuildGrid. The
 * physical Hydrology state is restored immediately afterward, so this changes
 * ecological scale without fabricating water for irrigation or storage.
 */
export function tickAquaticEcologyAtEnvironmentalScale(state: GameState, deltaGameMinutes: number): void {
  const snapshots = prepareAquaticEcologyScale(state);
  try {
    tickAquaticEcologyWithBootstrap(state, deltaGameMinutes);
  } finally {
    restoreAquaticEcologyScale(state, snapshots);
  }
}
