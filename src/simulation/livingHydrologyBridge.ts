import type { GameState } from '../types';
import type { CellHydrologyState, WaterDemand, WaterManagementNetwork } from '../types/hydrologySimulation';
import type { EcologicalSubarea } from '../types/ecologySimulation';
import type { CultivationArea, TerrestrialHabitat, AquaticHabitat } from '../types/agricultureSimulation';
import { PLANT_SPECIES } from '../data/agricultureSpecies';
import { resolveMainWorldAreaId, type MainWorldAreaId } from '../data/mainWorldAreas';
import { getOrCreatePoiBuildGrid } from './buildGridSystem';
import {
  getCellHydrologyState,
  materializeRegionHydrology,
} from './hydrologySystem';
import { ensureSurfaceWaterNetwork } from './hydrologySurfaceWaterSystem';
import {
  createWaterManagementNetwork,
  ensureWaterInfrastructureBindings,
  registerWaterDemand,
} from './waterManagementSystem';

const ECOLOGY_TICK_MINUTES = 30;
const CROP_DEMAND_PREFIX = 'living_crop_water_';

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function currentWeatherRain(state: GameState): number {
  if (state.weather.current === 'storm') return 1;
  if (state.weather.current === 'heavy_rain') return 0.82;
  if (state.weather.current === 'light_rain') return 0.42;
  return state.weather.rainIntensity || 0;
}

interface HydrologyAverages {
  moisture: number;
  saturation: number;
  surfaceDepthM: number;
  floodRisk: number;
  waterAccess: number;
  temperatureC: number;
  turbidity: number;
  contamination: number;
  oxygenPercent?: number;
  flowIndex: number;
}

function ensurePoiHydrology(state: GameState, poiId: string): MainWorldAreaId | undefined {
  const canonical = resolveMainWorldAreaId(poiId);
  if (!canonical) return undefined;
  materializeRegionHydrology(state, canonical);
  ensureSurfaceWaterNetwork(state, canonical);
  return canonical;
}

function average(values: number[], fallback = 0): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hydrologyAverages(state: GameState, poiId: string, cellIds: string[]): HydrologyAverages | undefined {
  const canonical = ensurePoiHydrology(state, poiId);
  if (!canonical || !cellIds.length) return undefined;
  const cells = cellIds
    .map(cellId => getCellHydrologyState(state, canonical, cellId))
    .filter((entry): entry is CellHydrologyState => Boolean(entry));
  if (!cells.length) return undefined;

  const nodeOxygen = Object.values(state.hydrologySystem?.nodesById || {})
    .filter(node => node.poiId === canonical && node.dissolvedOxygenMgL !== undefined)
    .map(node => node.dissolvedOxygenMgL!);
  const cellOxygen = cells
    .filter(cell => cell.dissolvedOxygenMgL !== undefined)
    .map(cell => cell.dissolvedOxygenMgL!);
  const oxygenMgL = cellOxygen.length ? average(cellOxygen) : nodeOxygen.length ? average(nodeOxygen) : undefined;
  const waterAccess = average(cells.map(cell => cell.reliableWaterAccess));
  const averageOutflow = average(cells.map(cell => Math.max(0, cell.outflowM3H)));

  return {
    moisture: average(cells.map(cell => cell.rootZoneMoisture)),
    saturation: average(cells.map(cell => cell.saturation)),
    surfaceDepthM: average(cells.map(cell => cell.surfaceWaterDepthM)),
    floodRisk: average(cells.map(cell => cell.currentFloodRisk)),
    waterAccess,
    temperatureC: average(cells.map(cell => cell.temperatureC), state.weather.temperatureC - 1),
    turbidity: average(cells.map(cell => cell.turbidity)),
    contamination: average(cells.map(cell => cell.contamination)),
    oxygenPercent: oxygenMgL === undefined ? undefined : clamp(oxygenMgL * 10),
    flowIndex: clamp(averageOutflow * 14 + waterAccess * 0.14),
  };
}

function targetCropMoisture(state: GameState, area: CultivationArea): number {
  const system = state.agricultureSystem;
  if (!system) return 55;
  const species = area.plantIds
    .map(id => system.plants.find(plant => plant.id === id))
    .map(plant => plant ? PLANT_SPECIES[plant.speciesId] : undefined)
    .filter(Boolean);
  if (!species.length) return 55;
  return clamp(average(species.map(definition => definition!.idealMoisture[0] + 8)), 35, 82);
}

function cropDemandRateM3H(state: GameState, area: CultivationArea, moisture: number): number {
  if (!area.plantIds.length) return 0;
  const target = targetCropMoisture(state, area);
  const deficit = Math.max(0, target - moisture);
  if (deficit < 2) return 0;
  // Convert the normalized root-zone deficit to a bounded irrigation depth.
  // 12 mm/h at a 100-point deficit keeps the number physical: 1 mm * 1 m2 = 1 L.
  const requestedDepthMmH = Math.min(12, deficit / 100 * 12);
  return Math.max(0, area.usableAreaM2 * requestedDepthMmH / 1000);
}

function existingNetworkForPoi(state: GameState, poiId: MainWorldAreaId): WaterManagementNetwork | undefined {
  return state.hydrologySystem?.networks?.find(network => network.poiId === poiId);
}

function ensureLivingWaterNetwork(state: GameState, poiId: MainWorldAreaId): WaterManagementNetwork | undefined {
  const system = ensureWaterInfrastructureBindings(state);
  const existing = existingNetworkForPoi(state, poiId);
  if (existing) return existing;
  const infrastructureIds = system.infrastructure
    .filter(infrastructure => infrastructure.poiId === poiId && infrastructure.active)
    .filter(infrastructure => infrastructure.purpose === 'irrigation' || infrastructure.purpose === 'transfer' || infrastructure.purpose === 'storage')
    .map(infrastructure => infrastructure.id);
  if (!infrastructureIds.length) return undefined;
  return createWaterManagementNetwork(state, poiId, infrastructureIds, 'balanced');
}

/**
 * Registers Agriculture water demand before tickWaterManagement. The demand is
 * not water itself: WaterManagement still has to withdraw it from a real node,
 * obey capacity/head/leakage, and apply the delivered volume to CellHydrologyState.
 */
export function syncLivingWaterDemands(state: GameState): void {
  const agriculture = state.agricultureSystem;
  if (!agriculture) return;
  const system = ensureWaterInfrastructureBindings(state);
  system.demands ||= [];
  const liveDemandIds = new Set<string>();

  for (const area of agriculture.cultivationAreas) {
    const canonical = ensurePoiHydrology(state, area.poiId);
    if (!canonical) continue;
    const hydro = hydrologyAverages(state, canonical, area.cellIds);
    if (!hydro) continue;
    const network = ensureLivingWaterNetwork(state, canonical);
    const id = `${CROP_DEMAND_PREFIX}${area.id}`;
    liveDemandIds.add(id);
    const rate = cropDemandRateM3H(state, area, hydro.moisture);
    const stressed = area.plantIds.some(id => {
      const plant = agriculture.plants.find(candidate => candidate.id === id);
      return Boolean(plant && (plant.stress >= 60 || plant.hydration <= 30));
    });
    const input: Omit<WaterDemand, 'deliveredM3H'> = {
      id,
      poiId: canonical,
      targetType: 'cells',
      targetId: area.id,
      targetCellIds: [...area.cellIds],
      useClass: stressed || hydro.moisture < 28 ? 'critical_crops' : 'normal_crops',
      demandM3H: rate,
      minimumM3H: stressed ? rate * 0.4 : 0,
      networkId: network?.id,
      active: Boolean(network && rate > 0),
    };
    registerWaterDemand(state, input);
  }

  // Demands are derived state. Remove stale bridge-owned entries when a plot was
  // dismantled instead of leaving invisible consumers in the allocation network.
  system.demands = system.demands.filter(demand => !demand.id.startsWith(CROP_DEMAND_PREFIX) || liveDemandIds.has(demand.id));
}

function precompensateCultivationMoisture(state: GameState, area: CultivationArea, deltaGameMinutes: number): void {
  const hydro = hydrologyAverages(state, area.poiId, area.cellIds);
  if (!hydro) return;
  const grid = getOrCreatePoiBuildGrid(state, area.poiId);
  const cells = area.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter(Boolean) as typeof grid.cells;
  const avgSun = cells.length ? average(cells.map(cell => cell.sunlight)) : 65;
  const hours = deltaGameMinutes / 60;
  const rain = currentWeatherRain(state);
  // agricultureSystem still contains its pre-hydrology rain/evap compatibility
  // update. Pre-compensate that deterministic delta so the value used by plant
  // growth after the update equals the physical root-zone moisture.
  const evaporation = Math.max(0.04, (state.weather.temperatureC - 18) * 0.006 + avgSun * 0.0015) * hours;
  const legacyDelta = rain * 10 * hours - evaporation;
  area.soil.moisture = clamp(hydro.moisture - legacyDelta);
  area.soil.contamination = clamp(hydro.contamination);
}

function precompensateTerrestrialGround(state: GameState, habitat: TerrestrialHabitat, deltaGameMinutes: number): void {
  const hydro = hydrologyAverages(state, habitat.poiId, habitat.cellIds);
  if (!hydro) return;
  const grid = getOrCreatePoiBuildGrid(state, habitat.poiId);
  const cells = habitat.cellIds.map(id => grid.cells.find(cell => cell.id === id)).filter(Boolean) as typeof grid.cells;
  const avgDrainage = cells.length ? average(cells.map(cell => cell.drainage)) : 55;
  const hours = deltaGameMinutes / 60;
  const rain = currentWeatherRain(state);
  const targetMud = clamp(hydro.saturation * 0.55 + hydro.surfaceDepthM * 260 + hydro.floodRisk * 0.12);
  const targetStandingWater = clamp(hydro.surfaceDepthM * 350 + Math.max(0, hydro.floodRisk - 45) * 0.45);
  const legacyMudDelta = rain * Math.max(0, 75 - avgDrainage) * 0.03 * hours - avgDrainage * 0.002 * hours;
  const legacyStandingDelta = rain * Math.max(0, 65 - avgDrainage) * 0.02 * hours - 0.4 * hours;
  habitat.ground.mud = clamp(targetMud - legacyMudDelta);
  habitat.ground.standingWater = clamp(targetStandingWater - legacyStandingDelta);
}

function syncAquaticHabitatFromHydrology(state: GameState, habitat: AquaticHabitat): void {
  const hydro = hydrologyAverages(state, habitat.poiId, habitat.cellIds);
  if (!hydro) return;
  const physicalSurfacePresent = hydro.surfaceDepthM >= 0.005 || hydro.waterAccess >= 60;
  if (habitat.siteType !== 'pond_site' || physicalSurfacePresent) {
    habitat.water.temperatureC = hydro.temperatureC;
    habitat.water.turbidity = clamp(hydro.turbidity);
    habitat.water.contamination = clamp(hydro.contamination);
    habitat.water.flowRate = hydro.flowIndex;
    if (hydro.oxygenPercent !== undefined) habitat.water.oxygen = hydro.oxygenPercent;
    if (hydro.surfaceDepthM > 0.005) habitat.water.depthM = Math.max(0.08, hydro.surfaceDepthM);
  }
}

function ecologyMoisturePrevalue(
  state: GameState,
  subarea: EcologicalSubarea,
  desiredMoisture: number,
): number {
  const region = state.ecologySystem?.regionsByPoiId?.[subarea.poiId];
  if (!region || subarea.materializationState !== 'materialized') return desiredMoisture;
  const elapsed = Math.max(0, gameMinute(state) - region.lastEcologyTickGameMinute);
  if (elapsed < ECOLOGY_TICK_MINUTES) return desiredMoisture;
  const rain = currentWeatherRain(state);
  const weatherTarget = clamp(state.weather.humidityPercent * 0.55 + rain * 44 + subarea.environment.waterAccess * 0.2);
  const blend = Math.min(0.18, elapsed / 1440 * 0.22);
  if (blend >= 0.999) return desiredMoisture;
  return clamp((desiredMoisture - weatherTarget * blend) / Math.max(0.001, 1 - blend));
}

function syncEcologySubarea(state: GameState, subarea: EcologicalSubarea): void {
  const hydro = hydrologyAverages(state, subarea.poiId, subarea.cellIds);
  if (!hydro) return;
  subarea.environment.waterAccess = clamp(hydro.waterAccess);
  subarea.terrain.floodRisk = clamp(hydro.floodRisk);
  subarea.environment.moisture = ecologyMoisturePrevalue(state, subarea, clamp(hydro.moisture));
  subarea.environment.humidity = clamp(
    state.weather.humidityPercent * 0.62
      + hydro.moisture * 0.28
      + subarea.environment.canopyCover * 0.1,
  );
}

/**
 * Adapts legacy living-system mirror fields immediately before their ticks.
 * The bridge deliberately does not mutate BuildCell.moisture/floodRisk: those are
 * static terrain compatibility values now, while CellHydrologyState is dynamic.
 */
export function prepareLivingHydrologyState(state: GameState, deltaGameMinutes: number): void {
  const agriculture = state.agricultureSystem;
  if (agriculture) {
    for (const area of agriculture.cultivationAreas) precompensateCultivationMoisture(state, area, deltaGameMinutes);
    for (const habitat of agriculture.terrestrialHabitats) precompensateTerrestrialGround(state, habitat, deltaGameMinutes);
    for (const habitat of agriculture.aquaticHabitats) syncAquaticHabitatFromHydrology(state, habitat);
  }

  for (const subarea of Object.values(state.ecologySystem?.subareasById || {})) {
    if (subarea) syncEcologySubarea(state, subarea);
  }
}

/**
 * Re-assert source-of-truth mirrors after living ticks so UI and downstream fauna
 * never observe a magic rain-only moisture value. Biological water quality fields
 * (waste/pathogens) are intentionally preserved for aquaculture.
 */
export function finalizeLivingHydrologyState(state: GameState): void {
  const agriculture = state.agricultureSystem;
  if (agriculture) {
    for (const area of agriculture.cultivationAreas) {
      const hydro = hydrologyAverages(state, area.poiId, area.cellIds);
      if (!hydro) continue;
      area.soil.moisture = clamp(hydro.moisture);
      area.soil.contamination = clamp(hydro.contamination);
    }
  }

  for (const subarea of Object.values(state.ecologySystem?.subareasById || {})) {
    if (!subarea) continue;
    const hydro = hydrologyAverages(state, subarea.poiId, subarea.cellIds);
    if (!hydro) continue;
    subarea.environment.moisture = clamp(hydro.moisture);
    subarea.environment.waterAccess = clamp(hydro.waterAccess);
    subarea.terrain.floodRisk = clamp(hydro.floodRisk);
  }
}
