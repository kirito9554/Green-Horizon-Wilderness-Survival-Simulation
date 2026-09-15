import type { GameState } from '../types';
import type { BuildCell } from '../types/buildingSimulation';
import type {
  HydrologyNode,
  WaterAllocationPolicy,
  WaterDemand,
  WaterInfrastructureInstance,
  WaterManagementNetwork,
  WaterUseClass,
  WorldHydrologyState,
} from '../types/hydrologySimulation';
import '../types/hydrologySimulation';
import { getWaterInfrastructureProfile } from '../data/hydrologyInfrastructure';
import { SOIL_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';
import { resolveMainWorldAreaId, type MainWorldAreaId } from '../data/mainWorldAreas';
import { getOrCreatePoiBuildGrid } from './buildGridSystem';
import { ensureWorldHydrology, materializeRegionHydrology } from './hydrologySystem';
import { ensureSurfaceWaterNetwork } from './hydrologySurfaceWaterSystem';

const WATER_MANAGEMENT_VERSION = 3;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 5) => { const scale = 10 ** digits; return Math.round(value * scale) / scale; };
const gameMinute = (state: GameState) => Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);

function rainfallMmPerHour(state: GameState): number {
  const intensity = clamp(state.weather.rainIntensity || 0, 0, 1);
  return intensity <= 0 ? 0 : intensity * 2 + intensity * intensity * 45;
}

function ensureManagementCollections(system: WorldHydrologyState): void {
  system.version = Math.max(WATER_MANAGEMENT_VERSION, system.version || 1);
  system.infrastructure ||= [];
  system.networks ||= [];
  system.demands ||= [];
  system.allocationHistory ||= [];
}

function structureCells(state: GameState, structureId: string, poiId: MainWorldAreaId): string[] {
  const building = state.buildings.find(candidate => candidate.id === structureId);
  const placed = (building?.placement || []).map(allocation => allocation.cellId).filter(Boolean);
  if (placed.length) return [...new Set(placed)];
  const grid = state.buildingSimulation?.gridsByPoiId?.[poiId];
  return grid?.cells[0] ? [grid.cells[0].id] : [];
}

function averageCellElevation(state: GameState, poiId: MainWorldAreaId, cellIds: string[]): number {
  const grid = getOrCreatePoiBuildGrid(state, poiId);
  const cells = cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter((cell): cell is BuildCell => Boolean(cell));
  return cells.length ? cells.reduce((sum, cell) => sum + cell.elevation, 0) / cells.length : 0;
}

function managedNodeId(structureId: string): string {
  return `HYDRO_MANAGED_${structureId}`;
}

function ensureManagedStorageNode(
  state: GameState,
  system: WorldHydrologyState,
  infrastructure: WaterInfrastructureInstance,
): HydrologyNode | undefined {
  const capacity = infrastructure.storageCapacityM3 || 0;
  if (capacity <= 0) return undefined;
  const id = managedNodeId(infrastructure.structureId);
  const elevationM = averageCellElevation(state, infrastructure.poiId, infrastructure.cellIds || []);
  const existing = system.nodesById[id];
  if (existing) {
    existing.capacityM3 = capacity;
    existing.storageM3 = Math.min(capacity, Math.max(0, existing.storageM3));
    infrastructure.storedWaterM3 = existing.storageM3;
    return existing;
  }
  const node: HydrologyNode = {
    id,
    kind: 'managed_storage',
    poiId: infrastructure.poiId,
    cellId: infrastructure.cellIds?.[0],
    elevationM,
    storageM3: 0,
    capacityM3: capacity,
    waterLevelM: 0,
    inflowM3H: 0,
    outflowM3H: 0,
    active: true,
    temperatureC: state.weather.temperatureC - 1,
    dissolvedOxygenMgL: 7.6,
    turbidity: 0,
    contamination: 0,
    salinityPpt: 0,
    sedimentLoadKg: 0,
  };
  system.nodesById[id] = node;
  infrastructure.storedWaterM3 = 0;
  if (!infrastructure.outputNodeIds.includes(id)) infrastructure.outputNodeIds.push(id);
  return node;
}

export function ensureWaterInfrastructureBindings(state: GameState): WorldHydrologyState {
  const system = ensureWorldHydrology(state);
  ensureManagementCollections(system);
  const seenStructureIds = new Set<string>();

  for (const building of state.buildings) {
    const profile = getWaterInfrastructureProfile(building.buildingId);
    const poiId = resolveMainWorldAreaId(building.areaId);
    if (!profile || !poiId) continue;
    seenStructureIds.add(building.id);
    materializeRegionHydrology(state, poiId);
    ensureSurfaceWaterNetwork(state, poiId);

    let infrastructure = system.infrastructure.find(candidate => candidate.structureId === building.id);
    if (!infrastructure) {
      infrastructure = {
        id: `water_infra_${building.id}`,
        structureId: building.id,
        poiId,
        kind: profile.kind,
        purpose: profile.purpose,
        cellIds: structureCells(state, building.id, poiId),
        inputNodeIds: [],
        outputNodeIds: [],
        targetCellIds: [],
        capacityM3H: profile.baseCapacityM3H,
        desiredFlowM3H: profile.defaultDesiredFlowM3H,
        currentFlowM3H: 0,
        leakage: profile.baseLeakage,
        blockage: profile.baseBlockage,
        storageCapacityM3: profile.storageCapacityM3,
        storedWaterM3: 0,
        rainCollectionAreaM2: profile.rainCollectionAreaM2,
        gravityRequired: profile.gravityRequired,
        minimumHeadM: profile.minimumHeadM,
        active: Boolean(building.isBuilt && building.condition > 0),
        waterUseClass: profile.defaultWaterUseClass,
        lastUpdatedGameMinute: gameMinute(state),
      };
      system.infrastructure.push(infrastructure);
    } else {
      infrastructure.poiId = poiId;
      infrastructure.kind = profile.kind;
      infrastructure.purpose = profile.purpose;
      infrastructure.cellIds = structureCells(state, building.id, poiId);
      infrastructure.capacityM3H = profile.baseCapacityM3H;
      infrastructure.storageCapacityM3 = profile.storageCapacityM3;
      infrastructure.rainCollectionAreaM2 = profile.rainCollectionAreaM2;
      infrastructure.gravityRequired = profile.gravityRequired;
      infrastructure.minimumHeadM = profile.minimumHeadM;
      infrastructure.active = Boolean(building.isBuilt && building.condition > 0);
      infrastructure.lastUpdatedGameMinute = gameMinute(state);
    }
    ensureManagedStorageNode(state, system, infrastructure);
  }

  for (const infrastructure of system.infrastructure) {
    if (!seenStructureIds.has(infrastructure.structureId)) infrastructure.active = false;
  }
  return system;
}

export function getWaterInfrastructureByStructure(state: GameState, structureId: string): WaterInfrastructureInstance | undefined {
  return state.hydrologySystem?.infrastructure?.find(infrastructure => infrastructure.structureId === structureId);
}

export interface WaterInfrastructureConfiguration {
  inputNodeIds?: string[];
  outputNodeIds?: string[];
  targetCellIds?: string[];
  desiredFlowM3H?: number;
  waterUseClass?: WaterUseClass;
  active?: boolean;
}

export function configureWaterInfrastructure(
  state: GameState,
  infrastructureId: string,
  configuration: WaterInfrastructureConfiguration,
): void {
  const system = ensureWaterInfrastructureBindings(state);
  const infrastructure = system.infrastructure.find(candidate => candidate.id === infrastructureId);
  if (!infrastructure) return;
  if (configuration.inputNodeIds) infrastructure.inputNodeIds = [...new Set(configuration.inputNodeIds.filter(id => Boolean(system.nodesById[id])))];
  if (configuration.outputNodeIds) {
    const managedId = infrastructure.storageCapacityM3 ? managedNodeId(infrastructure.structureId) : undefined;
    infrastructure.outputNodeIds = [...new Set([
      ...(managedId ? [managedId] : []),
      ...configuration.outputNodeIds.filter(id => Boolean(system.nodesById[id])),
    ])];
  }
  if (configuration.targetCellIds) {
    const grid = getOrCreatePoiBuildGrid(state, infrastructure.poiId);
    const valid = new Set(grid.cells.map(cell => cell.id));
    const maxTargets = getWaterInfrastructureProfile(state.buildings.find(building => building.id === infrastructure.structureId)?.buildingId || '')?.targetCellLimit || 0;
    const targets = [...new Set(configuration.targetCellIds.filter(id => valid.has(id)))];
    infrastructure.targetCellIds = maxTargets > 0 ? targets.slice(0, maxTargets) : targets;
  }
  if (configuration.desiredFlowM3H !== undefined) infrastructure.desiredFlowM3H = Math.max(0, configuration.desiredFlowM3H);
  if (configuration.waterUseClass) infrastructure.waterUseClass = configuration.waterUseClass;
  if (configuration.active !== undefined) infrastructure.active = configuration.active;
}

export function createWaterManagementNetwork(
  state: GameState,
  poiId: string,
  infrastructureIds?: string[],
  allocationPolicy: WaterAllocationPolicy = 'balanced',
): WaterManagementNetwork | undefined {
  const canonicalPoiId = resolveMainWorldAreaId(poiId);
  if (!canonicalPoiId) return undefined;
  const system = ensureWaterInfrastructureBindings(state);
  const ids = (infrastructureIds || system.infrastructure.filter(infrastructure => infrastructure.poiId === canonicalPoiId).map(infrastructure => infrastructure.id))
    .filter(id => system.infrastructure.some(infrastructure => infrastructure.id === id && infrastructure.poiId === canonicalPoiId));
  const existing = system.networks.find(network => network.poiId === canonicalPoiId);
  if (existing) {
    existing.infrastructureIds = [...new Set(ids)];
    existing.allocationPolicy = allocationPolicy;
    existing.reserveFraction ??= 0.15;
    return existing;
  }
  const network: WaterManagementNetwork = {
    id: `water_network_${canonicalPoiId}_${system.networks.length + 1}`,
    poiId: canonicalPoiId,
    infrastructureIds: [...new Set(ids)],
    allocationPolicy,
    reserveFraction: 0.15,
  };
  system.networks.push(network);
  return network;
}

export function setWaterAllocationPolicy(
  state: GameState,
  networkId: string,
  allocationPolicy: WaterAllocationPolicy,
  reserveFraction?: number,
): void {
  const system = ensureWaterInfrastructureBindings(state);
  const network = system.networks.find(candidate => candidate.id === networkId);
  if (!network) return;
  network.allocationPolicy = allocationPolicy;
  if (reserveFraction !== undefined) network.reserveFraction = clamp(reserveFraction, 0, 0.9);
}

export function registerWaterDemand(
  state: GameState,
  input: Omit<WaterDemand, 'deliveredM3H'> & { deliveredM3H?: number },
): WaterDemand | undefined {
  const poiId = resolveMainWorldAreaId(input.poiId);
  if (!poiId) return undefined;
  const system = ensureWaterInfrastructureBindings(state);
  system.demands ||= [];
  const existing = system.demands.find(demand => demand.id === input.id);
  const demand: WaterDemand = {
    ...input,
    poiId,
    targetCellIds: [...new Set(input.targetCellIds || [])],
    demandM3H: Math.max(0, input.demandM3H),
    minimumM3H: Math.max(0, Math.min(input.demandM3H, input.minimumM3H)),
    deliveredM3H: input.deliveredM3H || 0,
    active: input.active !== false,
  };
  if (existing) Object.assign(existing, demand);
  else system.demands.push(demand);
  return existing || demand;
}

export function removeWaterDemand(state: GameState, demandId: string): void {
  const system = ensureWorldHydrology(state);
  ensureManagementCollections(system);
  system.demands = (system.demands || []).filter(demand => demand.id !== demandId);
}

function structureCondition(state: GameState, infrastructure: WaterInfrastructureInstance): number {
  return clamp(state.buildings.find(building => building.id === infrastructure.structureId)?.condition ?? 0);
}

function effectiveCapacityM3H(state: GameState, infrastructure: WaterInfrastructureInstance): number {
  const conditionFactor = 0.25 + structureCondition(state, infrastructure) / 100 * 0.75;
  return Math.max(0, infrastructure.capacityM3H * conditionFactor * (1 - clamp(infrastructure.blockage, 0, 0.95)));
}

function effectiveLeakage(state: GameState, infrastructure: WaterInfrastructureInstance): number {
  const damage = 1 - structureCondition(state, infrastructure) / 100;
  return clamp(infrastructure.leakage + damage * 0.35, 0, 0.85);
}

function sourceHydraulicHead(node: HydrologyNode): number {
  return node.elevationM + Math.max(0, node.waterLevelM || 0);
}

function targetHydraulicElevation(state: GameState, infrastructure: WaterInfrastructureInstance): number | undefined {
  const system = state.hydrologySystem;
  const outputNode = infrastructure.outputNodeIds.map(id => system?.nodesById[id]).find(node => node && node.kind !== 'managed_storage');
  if (outputNode) return outputNode.elevationM + Math.max(0, outputNode.waterLevelM || 0);
  const targetIds = infrastructure.targetCellIds || [];
  if (!targetIds.length) return undefined;
  return averageCellElevation(state, infrastructure.poiId, targetIds);
}

function gravityAllows(state: GameState, infrastructure: WaterInfrastructureInstance, sourceNode: HydrologyNode): boolean {
  if (!infrastructure.gravityRequired || infrastructure.kind === 'pump') return true;
  const destination = targetHydraulicElevation(state, infrastructure);
  if (destination === undefined) return true;
  return sourceHydraulicHead(sourceNode) >= destination + (infrastructure.minimumHeadM || 0);
}

function reduceNaturalOutflow(system: WorldHydrologyState, node: HydrologyNode, withdrawnRateM3H: number): void {
  if (withdrawnRateM3H <= 0) return;
  const before = Math.max(0, node.outflowM3H);
  const remaining = Math.max(0, before - withdrawnRateM3H);
  const ratio = before > 0 ? remaining / before : 0;
  node.outflowM3H = remaining;
  for (const edge of Object.values(system.edgesById)) {
    if (edge.fromNodeId !== node.id) continue;
    edge.dischargeM3H *= ratio;
    if (edge.depthM !== undefined) edge.depthM *= ratio;
    edge.sedimentLoadKg *= ratio;
    edge.contaminationLoad *= ratio;
  }
}

function withdrawFromNode(
  state: GameState,
  infrastructure: WaterInfrastructureInstance,
  node: HydrologyNode,
  requestedM3: number,
  deltaHours: number,
  reserveFraction = 0,
): number {
  if (requestedM3 <= 0 || deltaHours <= 0) return 0;
  const system = ensureWorldHydrology(state);
  if (!gravityAllows(state, infrastructure, node)) return 0;
  if (node.kind === 'managed_storage') {
    const reserve = Math.max(0, node.capacityM3 * clamp(reserveFraction, 0, 0.9));
    const available = Math.max(0, node.storageM3 - reserve);
    const volume = Math.min(requestedM3, available, effectiveCapacityM3H(state, infrastructure) * deltaHours);
    node.storageM3 -= volume;
    node.outflowM3H = volume / deltaHours;
    const owner = system.infrastructure.find(candidate => managedNodeId(candidate.structureId) === node.id);
    if (owner) owner.storedWaterM3 = node.storageM3;
    return volume;
  }

  const availableFlowM3 = Math.max(0, node.outflowM3H) * deltaHours;
  const availableStoredM3 = Math.max(0, node.storageM3);
  const volume = Math.min(requestedM3, availableFlowM3 + availableStoredM3, effectiveCapacityM3H(state, infrastructure) * deltaHours);
  if (volume <= 0) return 0;
  const fromFlow = Math.min(volume, availableFlowM3);
  reduceNaturalOutflow(system, node, fromFlow / deltaHours);
  const fromStorage = volume - fromFlow;
  if (fromStorage > 0) node.storageM3 = Math.max(0, node.storageM3 - fromStorage);
  return volume;
}

function depositToManagedNode(system: WorldHydrologyState, node: HydrologyNode, volumeM3: number): { stored: number; overflow: number } {
  const available = Math.max(0, node.capacityM3 - node.storageM3);
  const stored = Math.min(volumeM3, available);
  node.storageM3 += stored;
  node.inflowM3H += stored;
  const owner = system.infrastructure.find(candidate => managedNodeId(candidate.structureId) === node.id);
  if (owner) owner.storedWaterM3 = node.storageM3;
  return { stored, overflow: Math.max(0, volumeM3 - stored) };
}

function addWaterToTerrain(
  state: GameState,
  poiId: MainWorldAreaId,
  cellIds: string[],
  volumeM3: number,
  preferSoil: boolean,
): number {
  if (volumeM3 <= 0 || !cellIds.length) return 0;
  const system = ensureWorldHydrology(state);
  const grid = getOrCreatePoiBuildGrid(state, poiId);
  let remaining = volumeM3;
  const cells = cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter((cell): cell is BuildCell => Boolean(cell));
  for (const cell of cells) {
    if (remaining <= 0) break;
    const hydro = system.cellStatesById[`${poiId}:${cell.id}`];
    if (!hydro) continue;
    let cellShare = remaining / Math.max(1, cells.length - cells.indexOf(cell));
    if (preferSoil) {
      const soil = SOIL_HYDROLOGY_PROFILES[cell.soilType];
      const roomMm = Math.max(0, soil.saturationCapacityMm - hydro.soilWaterMm);
      const roomM3 = roomMm * cell.areaM2 / 1000;
      const intoSoil = Math.min(cellShare, roomM3);
      hydro.soilWaterMm += intoSoil * 1000 / cell.areaM2;
      cellShare -= intoSoil;
      remaining -= intoSoil;
      hydro.rootZoneMoisture = round(clamp(hydro.soilWaterMm / Math.max(1, soil.fieldCapacityMm) * 100), 2);
      hydro.saturation = round(clamp(hydro.soilWaterMm / Math.max(1, soil.saturationCapacityMm) * 100), 2);
    }
    if (cellShare > 0) {
      hydro.surfaceWaterDepthM += cellShare / cell.areaM2;
      remaining -= cellShare;
    }
  }
  return volumeM3 - Math.max(0, remaining);
}

function leakToTerrain(state: GameState, infrastructure: WaterInfrastructureInstance, volumeM3: number): void {
  if (volumeM3 <= 0) return;
  const cells = (infrastructure.cellIds?.length ? infrastructure.cellIds : infrastructure.targetCellIds) || [];
  if (!cells.length) return;
  addWaterToTerrain(state, infrastructure.poiId, cells, volumeM3, true);
}

function depositToOutput(
  state: GameState,
  infrastructure: WaterInfrastructureInstance,
  volumeM3: number,
): number {
  if (volumeM3 <= 0) return 0;
  const system = ensureWorldHydrology(state);
  const managed = infrastructure.outputNodeIds.map(id => system.nodesById[id]).find(node => node?.kind === 'managed_storage');
  if (managed) {
    const result = depositToManagedNode(system, managed, volumeM3);
    if (result.overflow > 0) leakToTerrain(state, infrastructure, result.overflow);
    return result.stored;
  }
  const natural = infrastructure.outputNodeIds.map(id => system.nodesById[id]).find(Boolean);
  if (natural?.cellId) {
    const delivered = addWaterToTerrain(state, natural.poiId, [natural.cellId], volumeM3, false);
    natural.inflowM3H += delivered;
    natural.outflowM3H += delivered;
    return delivered;
  }
  if (infrastructure.targetCellIds?.length) return addWaterToTerrain(state, infrastructure.poiId, infrastructure.targetCellIds, volumeM3, infrastructure.purpose === 'irrigation');
  leakToTerrain(state, infrastructure, volumeM3);
  return 0;
}

function drainTargetCells(state: GameState, infrastructure: WaterInfrastructureInstance, maxVolumeM3: number): number {
  const system = ensureWorldHydrology(state);
  const grid = getOrCreatePoiBuildGrid(state, infrastructure.poiId);
  let remaining = maxVolumeM3;
  let removed = 0;
  for (const cellId of infrastructure.targetCellIds || []) {
    if (remaining <= 0) break;
    const cell = grid.cells.find(candidate => candidate.id === cellId);
    const hydro = system.cellStatesById[`${infrastructure.poiId}:${cellId}`];
    if (!cell || !hydro) continue;
    const surfaceM3 = hydro.surfaceWaterDepthM * cell.areaM2;
    const surfaceTake = Math.min(surfaceM3, remaining);
    hydro.surfaceWaterDepthM -= surfaceTake / cell.areaM2;
    remaining -= surfaceTake;
    removed += surfaceTake;
    if (remaining <= 0) continue;
    const soil = SOIL_HYDROLOGY_PROFILES[cell.soilType];
    const drainableMm = Math.max(0, hydro.soilWaterMm - soil.fieldCapacityMm * 0.92);
    const drainableM3 = drainableMm * cell.areaM2 / 1000;
    const soilTake = Math.min(drainableM3, remaining);
    hydro.soilWaterMm -= soilTake * 1000 / cell.areaM2;
    remaining -= soilTake;
    removed += soilTake;
    hydro.rootZoneMoisture = round(clamp(hydro.soilWaterMm / Math.max(1, soil.fieldCapacityMm) * 100), 2);
    hydro.saturation = round(clamp(hydro.soilWaterMm / Math.max(1, soil.saturationCapacityMm) * 100), 2);
  }
  return removed;
}

function processRainCollection(state: GameState, infrastructure: WaterInfrastructureInstance, deltaHours: number): void {
  if (!infrastructure.active || !infrastructure.rainCollectionAreaM2 || deltaHours <= 0) return;
  const system = ensureWorldHydrology(state);
  const storage = system.nodesById[managedNodeId(infrastructure.structureId)];
  if (!storage) return;
  const condition = structureCondition(state, infrastructure) / 100;
  const capturedM3 = rainfallMmPerHour(state) * deltaHours * infrastructure.rainCollectionAreaM2 / 1000 * (0.45 + condition * 0.5);
  if (capturedM3 > 0) {
    const { overflow } = depositToManagedNode(system, storage, capturedM3);
    if (overflow > 0) leakToTerrain(state, infrastructure, overflow);
  }
  if (infrastructure.kind === 'pond' && storage.storageM3 > 0) {
    const heat = Math.max(0.2, (state.weather.temperatureC - 16) / 22);
    const humidity = clamp(1 - state.weather.humidityPercent / 120, 0.08, 0.75);
    const evaporationM3 = Math.min(storage.storageM3, infrastructure.rainCollectionAreaM2 * 0.00018 * heat * humidity * deltaHours);
    storage.storageM3 -= evaporationM3;
    infrastructure.storedWaterM3 = storage.storageM3;
  }
}

function processDrainage(state: GameState, infrastructure: WaterInfrastructureInstance, deltaHours: number): void {
  if (!infrastructure.active || infrastructure.purpose !== 'drainage' || deltaHours <= 0) return;
  const capacity = effectiveCapacityM3H(state, infrastructure) * deltaHours;
  if (capacity <= 0) return;
  const output = infrastructure.outputNodeIds.map(id => state.hydrologySystem?.nodesById[id]).find(Boolean);
  if (output && infrastructure.gravityRequired) {
    const sourceElevation = averageCellElevation(state, infrastructure.poiId, infrastructure.targetCellIds || []);
    if (sourceElevation < output.elevationM + (infrastructure.minimumHeadM || 0)) {
      infrastructure.currentFlowM3H = 0;
      return;
    }
  }
  const removed = drainTargetCells(state, infrastructure, capacity);
  const leakageFraction = effectiveLeakage(state, infrastructure);
  const leaked = removed * leakageFraction;
  const delivered = removed - leaked;
  leakToTerrain(state, infrastructure, leaked);
  depositToOutput(state, infrastructure, delivered);
  infrastructure.currentFlowM3H = removed / deltaHours;
}

function processTransfer(state: GameState, infrastructure: WaterInfrastructureInstance, deltaHours: number): void {
  if (!infrastructure.active || deltaHours <= 0) return;
  if (!['diversion', 'transfer'].includes(infrastructure.purpose || '')) return;
  const source = infrastructure.inputNodeIds.map(id => state.hydrologySystem?.nodesById[id]).find(Boolean);
  if (!source) { infrastructure.currentFlowM3H = 0; return; }
  const requested = Math.min(effectiveCapacityM3H(state, infrastructure), infrastructure.desiredFlowM3H || 0) * deltaHours;
  const gross = withdrawFromNode(state, infrastructure, source, requested, deltaHours);
  const leakageFraction = effectiveLeakage(state, infrastructure);
  const leaked = gross * leakageFraction;
  const delivered = gross - leaked;
  leakToTerrain(state, infrastructure, leaked);
  depositToOutput(state, infrastructure, delivered);
  infrastructure.currentFlowM3H = gross / deltaHours;
  const turbidity = source.turbidity || 0;
  infrastructure.blockage = clamp(infrastructure.blockage + turbidity * 0.000015 * deltaHours, 0, 0.88);
}

function priorityOrder(policy: WaterAllocationPolicy): WaterUseClass[] {
  if (policy === 'drinking_first') return ['drinking', 'critical_crops', 'livestock', 'normal_crops', 'aquaculture', 'reserve'];
  if (policy === 'agriculture_first') return ['critical_crops', 'normal_crops', 'livestock', 'drinking', 'aquaculture', 'reserve'];
  if (policy === 'reserve_first') return ['reserve', 'drinking', 'critical_crops', 'livestock', 'normal_crops', 'aquaculture'];
  return ['drinking', 'critical_crops', 'livestock', 'aquaculture', 'normal_crops', 'reserve'];
}

function matchingDeliveryInfrastructure(
  system: WorldHydrologyState,
  network: WaterManagementNetwork,
  demand: WaterDemand,
): WaterInfrastructureInstance[] {
  const targetSet = new Set(demand.targetCellIds);
  return network.infrastructureIds
    .map(id => system.infrastructure.find(infrastructure => infrastructure.id === id))
    .filter((infrastructure): infrastructure is WaterInfrastructureInstance => Boolean(infrastructure?.active))
    .filter(infrastructure => infrastructure.purpose === 'irrigation' || infrastructure.purpose === 'transfer')
    .filter(infrastructure => {
      if (infrastructure.targetCellIds?.some(id => targetSet.has(id))) return true;
      return infrastructure.waterUseClass === demand.useClass;
    });
}

function deliverDemand(
  state: GameState,
  network: WaterManagementNetwork,
  demand: WaterDemand,
  requestedRateM3H: number,
  deltaHours: number,
): number {
  if (requestedRateM3H <= 0 || deltaHours <= 0) return 0;
  const system = ensureWorldHydrology(state);
  let remainingM3 = requestedRateM3H * deltaHours;
  let deliveredM3 = 0;
  let lostM3 = 0;
  const usedInfrastructureIds: string[] = [];
  for (const infrastructure of matchingDeliveryInfrastructure(system, network, demand)) {
    if (remainingM3 <= 0) break;
    const source = infrastructure.inputNodeIds.map(id => system.nodesById[id]).find(Boolean);
    if (!source) continue;
    const reserveFraction = network.allocationPolicy === 'reserve_first' ? network.reserveFraction || 0.15 : 0;
    const gross = withdrawFromNode(state, infrastructure, source, remainingM3, deltaHours, reserveFraction);
    if (gross <= 0) continue;
    const leakageFraction = effectiveLeakage(state, infrastructure);
    const leaked = gross * leakageFraction;
    const net = gross - leaked;
    leakToTerrain(state, infrastructure, leaked);
    const targetCells = demand.targetCellIds.length ? demand.targetCellIds : infrastructure.targetCellIds || [];
    const applied = addWaterToTerrain(state, demand.poiId, targetCells, net, true);
    if (applied < net) leakToTerrain(state, infrastructure, net - applied);
    infrastructure.currentFlowM3H = Math.max(infrastructure.currentFlowM3H || 0, gross / deltaHours);
    remainingM3 -= gross;
    deliveredM3 += applied;
    lostM3 += leaked + Math.max(0, net - applied);
    usedInfrastructureIds.push(infrastructure.id);
  }
  if (deliveredM3 > 0 || lostM3 > 0) {
    system.allocationHistory ||= [];
    system.allocationHistory.unshift({
      id: `water_alloc_${network.id}_${demand.id}_${gameMinute(state)}_${system.hydrologyTickIndex}`,
      gameMinute: gameMinute(state),
      networkId: network.id,
      demandId: demand.id,
      requestedM3: requestedRateM3H * deltaHours,
      deliveredM3,
      lostM3,
      sourceInfrastructureIds: [...new Set(usedInfrastructureIds)],
    });
  }
  return deliveredM3 / deltaHours;
}

function processAllocationNetworks(state: GameState, deltaHours: number): void {
  const system = ensureWorldHydrology(state);
  for (const demand of system.demands || []) demand.deliveredM3H = 0;
  for (const network of system.networks) {
    const demands = (system.demands || []).filter(demand => demand.active && demand.poiId === network.poiId && (!demand.networkId || demand.networkId === network.id));
    const order = priorityOrder(network.allocationPolicy);
    demands.sort((a, b) => order.indexOf(a.useClass) - order.indexOf(b.useClass) || a.id.localeCompare(b.id));

    // First try to cover ecological/operational minimums, then allocate the remaining request.
    for (const demand of demands) {
      const minimum = Math.max(0, Math.min(demand.demandM3H, demand.minimumM3H));
      demand.deliveredM3H += deliverDemand(state, network, demand, minimum, deltaHours);
    }
    for (const demand of demands) {
      const remainder = Math.max(0, demand.demandM3H - demand.deliveredM3H);
      demand.deliveredM3H += deliverDemand(state, network, demand, remainder, deltaHours);
    }
  }
}

export function tickWaterManagement(state: GameState, deltaGameMinutes: number): void {
  if (deltaGameMinutes <= 0) return;
  const system = ensureWaterInfrastructureBindings(state);
  ensureManagementCollections(system);
  const deltaHours = deltaGameMinutes / 60;
  for (const infrastructure of system.infrastructure) {
    infrastructure.currentFlowM3H = 0;
    const node = system.nodesById[managedNodeId(infrastructure.structureId)];
    if (node) infrastructure.storedWaterM3 = node.storageM3;
    if (!infrastructure.active) continue;
    processRainCollection(state, infrastructure, deltaHours);
  }
  for (const infrastructure of system.infrastructure) processDrainage(state, infrastructure, deltaHours);
  for (const infrastructure of system.infrastructure) processTransfer(state, infrastructure, deltaHours);
  processAllocationNetworks(state, deltaHours);
  for (const infrastructure of system.infrastructure) {
    const node = system.nodesById[managedNodeId(infrastructure.structureId)];
    if (node) infrastructure.storedWaterM3 = node.storageM3;
    infrastructure.lastUpdatedGameMinute = gameMinute(state);
  }
  if ((system.allocationHistory?.length || 0) > 200) system.allocationHistory = system.allocationHistory!.slice(0, 200);
}
