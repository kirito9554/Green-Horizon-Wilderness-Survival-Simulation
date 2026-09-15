import type { GameState } from '../types';
import type { BuildCell, PoiBuildGrid } from '../types/buildingSimulation';
import type {
  AquiferState,
  CellDrainageLink,
  CellHydrologyState,
  HydrologyNode,
  RegionHydrologyState,
  WatershedState,
  WorldHydrologyState,
} from '../types/hydrologySimulation';
import '../types/hydrologySimulation';
import {
  MAIN_WORLD_START_AREA_ID,
  resolveMainWorldAreaId,
  type MainWorldAreaId,
} from '../data/mainWorldAreas';
import {
  REGION_HYDROLOGY_PROFILES,
  SOIL_HYDROLOGY_PROFILES,
  WATERSHED_PROFILES,
} from '../data/hydrologyProfiles';
import {
  getHydrologyAnchorsForPoi,
  type HydrologyAnchorCellSelector,
} from '../data/hydrologyAnchors';
import { getOrCreatePoiBuildGrid, getPoiBuildGridView } from './buildGridSystem';

const HYDROLOGY_VERSION = 1;
const HYDROLOGY_GENERATION_VERSION = 1;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function hashString(value: string): number {
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

export function getCanonicalWorldSeed(state: GameState): string {
  return state.buildingSimulation?.worldSeed || 'legacy_world_seed';
}

export function createWorldHydrologyState(): WorldHydrologyState {
  return {
    version: HYDROLOGY_VERSION,
    regionsByPoiId: {},
    cellStatesById: {},
    nodesById: {},
    edgesById: {},
    watershedsById: {},
    aquifersById: {},
    infrastructure: [],
    networks: [],
    hydrologyTickIndex: 0,
  };
}

export function ensureWorldHydrology(state: GameState): WorldHydrologyState {
  state.hydrologySystem ||= createWorldHydrologyState();
  const system = state.hydrologySystem;
  system.version = Math.max(HYDROLOGY_VERSION, system.version || 1);
  system.regionsByPoiId ||= {};
  system.cellStatesById ||= {};
  system.nodesById ||= {};
  system.edgesById ||= {};
  system.watershedsById ||= {};
  system.aquifersById ||= {};
  system.infrastructure ||= [];
  system.networks ||= [];
  system.hydrologyTickIndex ||= 0;
  return system;
}

function cellNeighbors(grid: PoiBuildGrid, origin: BuildCell): BuildCell[] {
  return grid.cells.filter(cell => {
    if (cell.id === origin.id) return false;
    const rowDistance = Math.abs(cell.row - origin.row);
    const columnDistance = Math.abs(cell.column - origin.column);
    return rowDistance <= 1 && columnDistance <= 1;
  });
}

function isEdgeCell(grid: PoiBuildGrid, cell: BuildCell): boolean {
  return cell.row === 0 || cell.column === 0 || cell.row === grid.rows - 1 || cell.column === grid.columns - 1;
}

function hydraulicElevation(cell: BuildCell): number {
  // Site preparation may deliberately improve local drainage, but it never creates
  // enough synthetic head to reverse the macro terrain by itself.
  return cell.elevation - clamp(cell.drained || 0) * 0.002 - clamp(cell.leveled || 0) * 0.0005;
}

function buildDrainageLinks(grid: PoiBuildGrid): CellDrainageLink[] {
  const downstreamByCell = new Map<string, string | undefined>();
  const upstreamByCell = new Map<string, string[]>();
  for (const cell of grid.cells) upstreamByCell.set(cell.id, []);

  for (const cell of grid.cells) {
    const originElevation = hydraulicElevation(cell);
    const lowerNeighbors = cellNeighbors(grid, cell)
      .filter(candidate => hydraulicElevation(candidate) < originElevation - 0.01)
      .sort((a, b) => {
        const elevationDiff = hydraulicElevation(a) - hydraulicElevation(b);
        if (Math.abs(elevationDiff) > 0.0001) return elevationDiff;
        return a.id.localeCompare(b.id);
      });
    const downstream = lowerNeighbors[0]?.id;
    downstreamByCell.set(cell.id, downstream);
    if (downstream) upstreamByCell.get(downstream)!.push(cell.id);
  }

  const accumulation = new Map<string, number>(grid.cells.map(cell => [cell.id, 1]));
  const ordered = [...grid.cells].sort((a, b) => hydraulicElevation(b) - hydraulicElevation(a) || a.id.localeCompare(b.id));
  for (const cell of ordered) {
    const downstream = downstreamByCell.get(cell.id);
    if (!downstream) continue;
    accumulation.set(downstream, (accumulation.get(downstream) || 1) + (accumulation.get(cell.id) || 1));
  }

  return grid.cells.map(cell => {
    const downstreamCellId = downstreamByCell.get(cell.id);
    return {
      cellId: cell.id,
      downstreamCellId,
      upstreamCellIds: [...(upstreamByCell.get(cell.id) || [])].sort(),
      flowAccumulation: accumulation.get(cell.id) || 1,
      isDepression: !downstreamCellId && !isEdgeCell(grid, cell),
      isOutlet: !downstreamCellId && isEdgeCell(grid, cell),
    };
  });
}

function selectAnchorCell(grid: PoiBuildGrid, selector: HydrologyAnchorCellSelector): BuildCell | undefined {
  const cells = [...grid.cells];
  const edge = (cell: BuildCell) => isEdgeCell(grid, cell) ? 1 : 0;
  const score = (cell: BuildCell): number => {
    if (selector === 'lowest') return -cell.elevation + cell.moisture * 0.02;
    if (selector === 'highest_wet') return cell.elevation + cell.moisture * 0.08 + cell.resources.waterAccess * 0.04;
    if (selector === 'wettest') return cell.moisture + cell.resources.waterAccess * 0.7 - cell.elevation * 0.04;
    if (selector === 'rocky_wet') return cell.rocks * 0.7 + cell.moisture * 0.55 + cell.resources.waterAccess * 0.45;
    return edge(cell) * 120 - cell.elevation + cell.resources.waterAccess * 0.08;
  };
  return cells.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
}

function createInitialCellState(state: GameState, poiId: MainWorldAreaId, cell: BuildCell): CellHydrologyState {
  const soil = SOIL_HYDROLOGY_PROFILES[cell.soilType];
  const legacyWetness = clamp(cell.moisture) / 100;
  const soilWaterMm = Math.min(
    soil.saturationCapacityMm * 0.92,
    soil.fieldCapacityMm * (0.55 + legacyWetness * 0.65),
  );
  const rootZoneMoisture = clamp((soilWaterMm / Math.max(1, soil.fieldCapacityMm)) * 100);
  return {
    id: `${poiId}:${cell.id}`,
    poiId,
    cellId: cell.id,
    soilWaterMm: round(soilWaterMm),
    rootZoneMoisture: round(rootZoneMoisture, 2),
    saturation: round(clamp((soilWaterMm / soil.saturationCapacityMm) * 100), 2),
    surfaceWaterDepthM: 0,
    waterTableDepthM: round(Math.max(0.35, 5.4 - legacyWetness * 4.4), 3),
    infiltrationMmH: 0,
    runoffMmH: 0,
    evapotranspirationMmH: 0,
    inflowM3H: 0,
    outflowM3H: 0,
    currentFloodRisk: round(clamp(cell.floodRisk * 0.42 + legacyWetness * 18), 2),
    reliableWaterAccess: round(clamp(cell.resources.waterAccess * 0.32), 2),
    temperatureC: round(state.weather.temperatureC - cell.canopy * 0.025, 2),
    turbidity: 0,
    contamination: 0,
    maxObservedFloodDepthM: 0,
    saturatedHours: 0,
    floodedHours: 0,
    observedHours: 0,
    lastUpdatedGameMinute: gameMinute(state),
  };
}

function ensureWatershedAndAquifer(
  state: GameState,
  system: WorldHydrologyState,
  poiId: MainWorldAreaId,
  grid: PoiBuildGrid,
): { watershed: WatershedState; aquifer: AquiferState } {
  const regionProfile = REGION_HYDROLOGY_PROFILES[poiId];
  const watershedProfile = WATERSHED_PROFILES[regionProfile.watershedId];
  const now = gameMinute(state);
  let watershed = system.watershedsById[watershedProfile.id];
  if (!watershed) {
    watershed = system.watershedsById[watershedProfile.id] = {
      id: watershedProfile.id,
      regionIds: [...watershedProfile.regionIds],
      materializedRegionIds: [],
      catchmentAreaM2: 0,
      rainfallInputM3: 0,
      surfaceStorageM3: 0,
      dischargeM3H: 0,
      lastUpdatedGameMinute: now,
    };
  }

  const effectiveAreaM2 = grid.cells.reduce((sum, cell) => sum + cell.areaM2, 0) * regionProfile.effectiveLandscapeScale;
  const wasMaterialized = watershed.materializedRegionIds.includes(poiId);
  if (!wasMaterialized) {
    watershed.materializedRegionIds.push(poiId);
    watershed.catchmentAreaM2 += effectiveAreaM2;
  }

  const aquiferId = `AQ_${watershed.id}`;
  let aquifer = system.aquifersById[aquiferId];
  if (!aquifer) {
    aquifer = system.aquifersById[aquiferId] = {
      id: aquiferId,
      watershedId: watershed.id,
      storageM3: 0,
      capacityM3: 0,
      rechargeM3PerDay: 0,
      waterTableElevationM: 0,
      conductivity: watershedProfile.conductivity,
      lastUpdatedGameMinute: now,
    };
  }

  if (!wasMaterialized) {
    const addedCapacity = effectiveAreaM2 * watershedProfile.aquiferCapacityPerEffectiveM2;
    const averageLegacyMoisture = grid.cells.reduce((sum, cell) => sum + cell.moisture, 0) / Math.max(1, grid.cells.length);
    const initialFraction = 0.18 + clamp(averageLegacyMoisture) / 100 * 0.34;
    aquifer.capacityM3 += addedCapacity;
    aquifer.storageM3 = Math.min(aquifer.capacityM3, aquifer.storageM3 + addedCapacity * initialFraction);
  }

  return { watershed, aquifer };
}

export function materializeRegionHydrology(state: GameState, areaId: string): RegionHydrologyState | undefined {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return undefined;
  const system = ensureWorldHydrology(state);
  const existing = system.regionsByPoiId[poiId];
  if (existing && existing.generationVersion === HYDROLOGY_GENERATION_VERSION) return existing;

  const grid = getOrCreatePoiBuildGrid(state, poiId);
  const worldSeed = getCanonicalWorldSeed(state);
  const generationSeed = hashString(`${worldSeed}:${poiId}:hydrology:v${HYDROLOGY_GENERATION_VERSION}`);
  const drainageLinks = buildDrainageLinks(grid);
  const now = gameMinute(state);

  for (const cell of grid.cells) {
    const id = `${poiId}:${cell.id}`;
    system.cellStatesById[id] ||= createInitialCellState(state, poiId, cell);
  }

  const anchorNodeIds: string[] = [];
  for (const anchor of getHydrologyAnchorsForPoi(poiId)) {
    const cell = selectAnchorCell(grid, anchor.selector);
    const node: HydrologyNode = {
      id: anchor.id,
      kind: anchor.kind,
      poiId,
      cellId: cell?.id,
      elevationM: cell?.elevation || 0,
      storageM3: 0,
      capacityM3: anchor.capacityM3,
      waterLevelM: 0,
      inflowM3H: 0,
      outflowM3H: 0,
      active: anchor.kind === 'coast',
    };
    system.nodesById[node.id] = node;
    anchorNodeIds.push(node.id);
  }

  for (const link of drainageLinks.filter(candidate => candidate.isDepression)) {
    const cell = grid.cells.find(candidate => candidate.id === link.cellId);
    if (!cell) continue;
    const nodeId = `HYDRO_DEPRESSION_${poiId}_${cell.id}`;
    system.nodesById[nodeId] ||= {
      id: nodeId,
      kind: 'depression',
      poiId,
      cellId: cell.id,
      elevationM: cell.elevation,
      storageM3: 0,
      capacityM3: cell.areaM2 * 0.22,
      waterLevelM: 0,
      inflowM3H: 0,
      outflowM3H: 0,
      active: false,
    };
    anchorNodeIds.push(nodeId);
  }

  const { watershed } = ensureWatershedAndAquifer(state, system, poiId, grid);
  const profile = REGION_HYDROLOGY_PROFILES[poiId];
  const region: RegionHydrologyState = {
    poiId,
    generationVersion: HYDROLOGY_GENERATION_VERSION,
    generationSeed,
    watershedId: watershed.id,
    cellStateIds: grid.cells.map(cell => `${poiId}:${cell.id}`),
    drainageLinks,
    anchorNodeIds,
    downstreamPoiIds: [...profile.downstreamPoiIds],
    lastHydrologyTickGameMinute: now,
  };
  system.regionsByPoiId[poiId] = region;
  return region;
}

function rainfallMmPerHour(state: GameState, poiId: MainWorldAreaId): number {
  const intensity = clamp(state.weather.rainIntensity || 0, 0, 1);
  if (intensity <= 0) return 0;
  const tropicalRate = intensity * 2 + intensity * intensity * 45;
  return tropicalRate * REGION_HYDROLOGY_PROFILES[poiId].rainfallMultiplier;
}

function evapotranspirationMmPerHour(state: GameState, cell: BuildCell, poiId: MainWorldAreaId): number {
  const temperatureFactor = clamp((state.weather.temperatureC - 15) / 22, 0.1, 1.4);
  const humidityFactor = clamp(1 - state.weather.humidityPercent / 125, 0.12, 0.82);
  const windFactor = 0.8 + Math.min(0.7, (state.weather.wind?.speedKmh || 0) / 70);
  const lightFactor = 0.35 + clamp(cell.sunlight) / 100 * 0.9;
  return 0.34 * temperatureFactor * humidityFactor * windFactor * lightFactor
    * REGION_HYDROLOGY_PROFILES[poiId].evapotranspirationMultiplier;
}

function tickRegionHydrology(state: GameState, region: RegionHydrologyState, deltaGameMinutes: number): void {
  const system = ensureWorldHydrology(state);
  const grid = getOrCreatePoiBuildGrid(state, region.poiId);
  const profile = REGION_HYDROLOGY_PROFILES[region.poiId];
  const watershed = system.watershedsById[region.watershedId];
  const aquifer = system.aquifersById[`AQ_${region.watershedId}`];
  if (!watershed || !aquifer || deltaGameMinutes <= 0) return;

  const deltaHours = deltaGameMinutes / 60;
  const rainMmH = rainfallMmPerHour(state, region.poiId);
  const incomingByCell = new Map<string, number>();
  const runoffByCell = new Map<string, number>();
  let rechargeM3 = 0;
  let localRainM3 = 0;

  for (const cell of grid.cells) {
    const hydro = system.cellStatesById[`${region.poiId}:${cell.id}`];
    if (!hydro) continue;
    const soil = SOIL_HYDROLOGY_PROFILES[cell.soilType];
    const saturationFraction = clamp(hydro.saturation) / 100;
    const canopyInterception = Math.min(0.28, clamp(cell.canopy) / 100 * 0.22);
    const effectiveRainMmH = rainMmH * (1 - canopyInterception);
    const directRunoffMmH = effectiveRainMmH * soil.runoffCoefficient * (0.35 + saturationFraction * 0.65);
    const drainageFactor = 0.55 + clamp(cell.drainage) / 100 * 0.7;
    const infiltrationCapacityMmH = soil.infiltrationMmH * Math.max(0.12, 1 - saturationFraction * 0.72) * drainageFactor;
    const infiltrationMmH = Math.min(
      Math.max(0, effectiveRainMmH - directRunoffMmH),
      infiltrationCapacityMmH,
    );
    const excessRainMmH = Math.max(0, effectiveRainMmH - directRunoffMmH - infiltrationMmH);
    const runoffMmH = directRunoffMmH + excessRainMmH;
    const evapMmH = evapotranspirationMmPerHour(state, cell, region.poiId);

    const infiltrationMm = infiltrationMmH * deltaHours;
    hydro.soilWaterMm += infiltrationMm;

    const excessAboveFieldCapacity = Math.max(0, hydro.soilWaterMm - soil.fieldCapacityMm);
    const deepDrainageMm = Math.min(
      excessAboveFieldCapacity,
      excessAboveFieldCapacity * soil.deepDrainageFraction * Math.min(1, 0.18 * deltaHours + 0.04),
    );
    hydro.soilWaterMm -= deepDrainageMm;

    const evapMm = Math.min(hydro.soilWaterMm, evapMmH * deltaHours);
    hydro.soilWaterMm -= evapMm;

    if (hydro.soilWaterMm > soil.saturationCapacityMm) {
      const saturationExcessMm = hydro.soilWaterMm - soil.saturationCapacityMm;
      hydro.soilWaterMm = soil.saturationCapacityMm;
      runoffByCell.set(cell.id, (runoffByCell.get(cell.id) || 0) + saturationExcessMm * cell.areaM2 / 1000);
    }

    const localRunoffM3 = runoffMmH * deltaHours * cell.areaM2 / 1000;
    runoffByCell.set(cell.id, (runoffByCell.get(cell.id) || 0) + localRunoffM3);
    localRainM3 += rainMmH * deltaHours * cell.areaM2 / 1000 * profile.effectiveLandscapeScale;
    rechargeM3 += deepDrainageMm * cell.areaM2 / 1000 * profile.effectiveLandscapeScale * profile.rechargeMultiplier;

    hydro.infiltrationMmH = round(infiltrationMmH, 3);
    hydro.runoffMmH = round(runoffMmH, 3);
    hydro.evapotranspirationMmH = round(evapMmH, 3);
    hydro.rootZoneMoisture = round(clamp((hydro.soilWaterMm / Math.max(1, soil.fieldCapacityMm)) * 100), 2);
    hydro.saturation = round(clamp((hydro.soilWaterMm / Math.max(1, soil.saturationCapacityMm)) * 100), 2);
    hydro.temperatureC = round(state.weather.temperatureC - cell.canopy * 0.025, 2);
  }

  aquifer.storageM3 = Math.min(aquifer.capacityM3, aquifer.storageM3 + rechargeM3);
  aquifer.rechargeM3PerDay = round(deltaHours > 0 ? rechargeM3 / deltaHours * 24 : 0, 3);
  const aquiferFraction = aquifer.capacityM3 > 0 ? aquifer.storageM3 / aquifer.capacityM3 : 0;
  const averageRegionElevation = grid.cells.reduce((sum, cell) => sum + cell.elevation, 0) / Math.max(1, grid.cells.length);
  aquifer.waterTableElevationM = round(averageRegionElevation - (1 - aquiferFraction) * 6, 3);
  aquifer.lastUpdatedGameMinute = gameMinute(state);
  watershed.rainfallInputM3 += localRainM3;
  watershed.lastUpdatedGameMinute = gameMinute(state);

  const linkByCell = new Map(region.drainageLinks.map(link => [link.cellId, link]));
  const orderedCells = [...grid.cells].sort((a, b) => hydraulicElevation(b) - hydraulicElevation(a) || a.id.localeCompare(b.id));
  let outletDischargeM3 = 0;
  let surfaceStorageM3 = 0;

  for (const cell of orderedCells) {
    const hydro = system.cellStatesById[`${region.poiId}:${cell.id}`];
    const link = linkByCell.get(cell.id);
    if (!hydro || !link) continue;

    const priorSurfaceM3 = hydro.surfaceWaterDepthM * cell.areaM2;
    const surfaceEvapM3 = Math.min(priorSurfaceM3, hydro.evapotranspirationMmH * deltaHours * cell.areaM2 / 1000 * 0.7);
    const mobileVolumeM3 = Math.max(0, priorSurfaceM3 - surfaceEvapM3)
      + (runoffByCell.get(cell.id) || 0)
      + (incomingByCell.get(cell.id) || 0);

    hydro.inflowM3H = round(((runoffByCell.get(cell.id) || 0) + (incomingByCell.get(cell.id) || 0)) / Math.max(0.001, deltaHours), 4);

    if (link.downstreamCellId) {
      const retentionFraction = Math.min(0.08, Math.max(0.01, (100 - clamp(cell.drainage)) / 100 * 0.065));
      const retainedM3 = mobileVolumeM3 * retentionFraction;
      const routedM3 = Math.max(0, mobileVolumeM3 - retainedM3);
      hydro.surfaceWaterDepthM = round(retainedM3 / Math.max(1, cell.areaM2), 5);
      hydro.outflowM3H = round(routedM3 / Math.max(0.001, deltaHours), 4);
      incomingByCell.set(link.downstreamCellId, (incomingByCell.get(link.downstreamCellId) || 0) + routedM3);
    } else if (link.isDepression) {
      const maxDepthM = 0.22;
      const capacityM3 = cell.areaM2 * maxDepthM;
      const storedM3 = Math.min(capacityM3, mobileVolumeM3);
      hydro.surfaceWaterDepthM = round(storedM3 / Math.max(1, cell.areaM2), 5);
      hydro.outflowM3H = 0;
      const depressionNode = Object.values(system.nodesById).find(node => node.kind === 'depression' && node.poiId === region.poiId && node.cellId === cell.id);
      if (depressionNode) {
        depressionNode.storageM3 = round(storedM3, 4);
        depressionNode.waterLevelM = hydro.surfaceWaterDepthM;
        depressionNode.inflowM3H = hydro.inflowM3H;
        depressionNode.active = storedM3 > 0.01;
      }
      // M3 will turn excess above spill elevation into an explicit downstream edge.
      outletDischargeM3 += Math.max(0, mobileVolumeM3 - storedM3);
    } else {
      hydro.surfaceWaterDepthM = 0;
      hydro.outflowM3H = round(mobileVolumeM3 / Math.max(0.001, deltaHours), 4);
      outletDischargeM3 += mobileVolumeM3;
    }

    const shallowGroundwater = clamp((aquiferFraction - 0.18) / 0.62, 0, 1);
    hydro.waterTableDepthM = round(Math.max(0.2, 6.2 - shallowGroundwater * 5.2 - hydro.saturation / 100 * 0.7), 3);
    hydro.reliableWaterAccess = round(clamp(
      hydro.reliableWaterAccess * 0.995
      + Math.min(72, hydro.surfaceWaterDepthM * 420)
      + shallowGroundwater * 0.8,
    ), 2);
    hydro.currentFloodRisk = round(clamp(
      cell.floodRisk * 0.28
      + hydro.saturation * 0.34
      + Math.min(52, hydro.surfaceWaterDepthM * 260),
    ), 2);
    hydro.observedHours += deltaHours;
    if (hydro.saturation >= 88) hydro.saturatedHours += deltaHours;
    if (hydro.surfaceWaterDepthM >= 0.02) hydro.floodedHours += deltaHours;
    hydro.maxObservedFloodDepthM = Math.max(hydro.maxObservedFloodDepthM, hydro.surfaceWaterDepthM);
    hydro.lastUpdatedGameMinute = gameMinute(state);
    surfaceStorageM3 += hydro.surfaceWaterDepthM * cell.areaM2 * profile.effectiveLandscapeScale;
  }

  watershed.surfaceStorageM3 = round(surfaceStorageM3, 3);
  watershed.dischargeM3H = round(outletDischargeM3 / Math.max(0.001, deltaHours) * profile.effectiveLandscapeScale, 3);
  region.lastHydrologyTickGameMinute = gameMinute(state);
}

export function tickWorldHydrology(state: GameState, deltaGameMinutes: number): void {
  if (deltaGameMinutes <= 0) return;
  const system = ensureWorldHydrology(state);
  if (!Object.keys(system.regionsByPoiId).length) materializeRegionHydrology(state, MAIN_WORLD_START_AREA_ID);
  for (const region of Object.values(system.regionsByPoiId)) {
    if (region) tickRegionHydrology(state, region, deltaGameMinutes);
  }
  system.hydrologyTickIndex += 1;
}

function getLegacyCell(state: GameState, areaId: string, cellId: string): BuildCell | undefined {
  const poiId = resolveMainWorldAreaId(areaId) || areaId;
  const grid = getPoiBuildGridView(state, poiId);
  return grid.cells.find(cell => cell.id === cellId);
}

export function getCellHydrologyState(state: GameState, areaId: string, cellId: string): CellHydrologyState | undefined {
  const poiId = resolveMainWorldAreaId(areaId);
  if (!poiId) return undefined;
  return state.hydrologySystem?.cellStatesById?.[`${poiId}:${cellId}`];
}

export function getCellMoisture(state: GameState, areaId: string, cellId: string): number {
  const hydro = getCellHydrologyState(state, areaId, cellId);
  if (hydro) return hydro.rootZoneMoisture;
  return getLegacyCell(state, areaId, cellId)?.moisture ?? 0;
}

export function getCellFloodRisk(state: GameState, areaId: string, cellId: string): number {
  const hydro = getCellHydrologyState(state, areaId, cellId);
  if (hydro) return hydro.currentFloodRisk;
  return getLegacyCell(state, areaId, cellId)?.floodRisk ?? 0;
}

export function getCellWaterAccess(state: GameState, areaId: string, cellId: string): number {
  const hydro = getCellHydrologyState(state, areaId, cellId);
  if (hydro) return hydro.reliableWaterAccess;
  return getLegacyCell(state, areaId, cellId)?.resources.waterAccess ?? 0;
}

export function getTotalHydrologyWaterM3(state: GameState): number {
  const system = state.hydrologySystem;
  if (!system) return 0;
  let total = 0;
  for (const hydro of Object.values(system.cellStatesById || {})) {
    const grid = state.buildingSimulation?.gridsByPoiId?.[hydro.poiId];
    const cell = grid?.cells.find(candidate => candidate.id === hydro.cellId);
    if (!cell) continue;
    total += hydro.soilWaterMm * cell.areaM2 / 1000;
    total += hydro.surfaceWaterDepthM * cell.areaM2;
  }
  for (const aquifer of Object.values(system.aquifersById || {})) total += aquifer.storageM3;
  return total;
}
