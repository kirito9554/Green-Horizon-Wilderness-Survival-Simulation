import type { GameState } from '../types';
import type { HydrologyNode } from '../types/hydrologySimulation';
import { REGION_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';
import { tickAquaticEcologyWithBootstrap } from './aquaticBootstrapSystem';
import { synchronizeTidalBoundaryForCurrentTime } from './hydrologySurfaceWaterSystem';

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

const AQUATIC_INTEGRATION_SUBSTEP_MINUTES = 60;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function setGameMinute(state: GameState, totalMinute: number): void {
  const safeMinute = Math.max(0, totalMinute);
  state.gameTime.day = Math.floor(safeMinute / 1440) + 1;
  state.gameTime.minuteOfDay = safeMinute % 1440;
}

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

function tickAquaticSubstep(state: GameState, deltaGameMinutes: number, allowColonization: boolean): void {
  // The physical surface-water pass may have been run at a coarser cadence than
  // aquatic ecology. Re-sampling only the reversible tidal boundary here lets
  // coastal/estuarine species see the tide at each virtual hour without routing
  // rainfall, baseflow or contaminants twice.
  synchronizeTidalBoundaryForCurrentTime(state);
  const snapshots = prepareAquaticEcologyScale(state);
  try {
    tickAquaticEcologyWithBootstrap(state, deltaGameMinutes, { allowColonization });
  } finally {
    restoreAquaticEcologyScale(state, snapshots);
  }
}

/**
 * Aquatic populations and food-web resources see an ecological reach volume,
 * not the tiny representative control volume used by the local BuildGrid. The
 * physical Hydrology state is restored immediately afterward, so this changes
 * ecological scale without fabricating water for irrigation or storage.
 *
 * Trophic interactions are integrated at a fixed hourly cadence even when the
 * outer simulation advances by several hours. Virtual time also re-samples the
 * reversible tidal boundary at that cadence. Colonization is evaluated only on
 * the final substep because observed hydroperiod values already represent the
 * outer tick's final state; evaluating bootstrap in earlier virtual hours would
 * make coarse ticks cross observation thresholds prematurely.
 */
export function tickAquaticEcologyAtEnvironmentalScale(state: GameState, deltaGameMinutes: number): void {
  const finalDay = state.gameTime.day;
  const finalMinuteOfDay = state.gameTime.minuteOfDay;
  try {
    if (deltaGameMinutes <= AQUATIC_INTEGRATION_SUBSTEP_MINUTES) {
      tickAquaticSubstep(state, deltaGameMinutes, true);
      return;
    }

    const finalMinute = gameMinute(state);
    const startMinute = Math.max(0, finalMinute - Math.max(0, deltaGameMinutes));
    let cursor = startMinute;
    while (cursor + 0.0001 < finalMinute) {
      const nextMinute = Math.min(finalMinute, cursor + AQUATIC_INTEGRATION_SUBSTEP_MINUTES);
      setGameMinute(state, nextMinute);
      tickAquaticSubstep(state, nextMinute - cursor, nextMinute + 0.0001 >= finalMinute);
      cursor = nextMinute;
    }
  } finally {
    state.gameTime.day = finalDay;
    state.gameTime.minuteOfDay = finalMinuteOfDay;
    // Restore the reversible boundary to the true final clock after any virtual
    // substeps so downstream systems/UI never observe an intermediate tide.
    synchronizeTidalBoundaryForCurrentTime(state);
  }
}