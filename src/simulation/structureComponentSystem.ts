import type { GameState, ItemQuality } from '../types';
import type { StructureConstructionJob, StructureConstructionPhase } from '../types/buildingSimulation';
import type {
  StructureComponentInstance,
  StructureComponentKind,
  StructureDerivedPerformance,
} from '../types/structureSimulation';
import '../types/structureSimulation';
import { getPoiBuildGridView } from './buildGridSystem';

const QUALITY_SCORE: Record<ItemQuality, number> = {
  crude: 42,
  standard: 65,
  prime: 82,
  masterwork: 95,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[], fallback = 0): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function materialScore(qualities: ItemQuality[]): number {
  return average(qualities.map(quality => QUALITY_SCORE[quality]), 65);
}

function componentKindForPhase(phase: StructureConstructionPhase, buildingId: string): StructureComponentKind | null {
  if (phase.kind === 'groundwork') return 'ground';
  if (phase.kind === 'foundation') return buildingId === 'BUILDING_CAMPFIRE_HEARTH' ? 'hearth' : 'foundation';
  if (phase.kind === 'frame') return 'frame';
  if (phase.kind === 'binding') return 'bindings';
  if (phase.kind === 'surface') return 'surface';
  if (phase.kind === 'cover') return 'roof';
  if (phase.kind === 'installation') return buildingId === 'BUILDING_CAMPFIRE_HEARTH' ? 'hearth' : 'fixture';
  return null;
}

function componentName(kind: StructureComponentKind): string {
  const names: Record<StructureComponentKind, string> = {
    ground: 'Prepared Ground',
    foundation: 'Foundation / Anchors',
    posts: 'Main Posts',
    frame: 'Structural Frame',
    bindings: 'Bindings & Joints',
    surface: 'Working / Living Surface',
    roof: 'Roof Covering',
    fixture: 'Functional Fixtures',
    drainage: 'Drainage',
    hearth: 'Hearth Assembly',
    other: 'Structure Component',
  };
  return names[kind];
}

function isOrganicMaterial(itemId: string): boolean {
  const id = itemId.toLowerCase();
  return id.includes('wood') || id.includes('branch') || id.includes('bamboo') || id.includes('leaf') ||
    id.includes('fiber') || id.includes('vine') || id.includes('cord') || id.includes('rope');
}

function createComponent(
  buildingId: string,
  phase: StructureConstructionPhase,
  index: number,
  initialMoisture: number,
): StructureComponentInstance | null {
  const kind = componentKindForPhase(phase, buildingId);
  if (!kind) return null;
  const workmanship = clamp(phase.workmanshipScore ?? 65);
  const materials = phase.requirements.map(requirement => requirement.itemId);
  const material = materialScore(phase.consumedQualities);
  const structuralImportance = kind === 'foundation' || kind === 'frame' || kind === 'bindings' ? 1.08 : 1;
  const conditionMax = Math.max(35, Math.round((52 + workmanship * 0.48 + material * 0.20) * structuralImportance));

  return {
    id: `${buildingId}_${phase.id}_${index}`,
    kind,
    name: componentName(kind),
    sourcePhaseKind: phase.kind,
    materialItemIds: [...materials],
    materialQualities: [...phase.consumedQualities],
    workmanship,
    condition: conditionMax,
    conditionMax,
    originalConditionMax: conditionMax,
    moisture: clamp(initialMoisture),
    rot: 0,
    fireDamage: 0,
    permanentDamage: 0,
  };
}

function placementEnvironment(state: GameState, building: GameState['buildings'][number]) {
  const areaId = building.areaId || 'AREA_CAMP_CLEARING';
  const grid = getPoiBuildGridView(state, areaId);
  const cellIds = new Set((building.placement || []).map(allocation => allocation.cellId));
  const cells = grid.cells.filter(cell => cellIds.has(cell.id));
  const used = cells.length ? cells : grid.cells.slice(0, 1);
  return {
    moisture: average(used.map(cell => cell.moisture), 55),
    floodRisk: average(used.map(cell => cell.floodRisk), 30),
    windExposure: average(used.map(cell => cell.windExposure), 45),
    fireRisk: average(used.map(cell => cell.fireRisk), 40),
    drainage: average(used.map(cell => cell.drainage), 50),
  };
}

export function deriveStructurePerformance(
  state: GameState,
  building: GameState['buildings'][number],
): StructureDerivedPerformance {
  const components = building.structureComponents || [];
  if (!components.length) {
    const condition = clamp(building.condition || 100);
    return {
      structuralIntegrity: condition,
      weatherProtection: condition,
      fireSafety: 60,
      functionality: condition,
      cleanliness: 85,
    };
  }

  const ratio = (component: StructureComponentInstance) =>
    component.conditionMax > 0 ? clamp(component.condition / component.conditionMax * 100) : 0;
  const structural = components.filter(component => ['foundation', 'frame', 'bindings', 'hearth'].includes(component.kind));
  const roof = components.filter(component => component.kind === 'roof');
  const functional = components.filter(component => ['surface', 'fixture', 'hearth', 'roof'].includes(component.kind));
  const environment = placementEnvironment(state, building);
  const fireDamage = average(components.map(component => component.fireDamage), 0);
  const rot = average(components.map(component => component.rot), 0);

  return {
    structuralIntegrity: Math.round(average((structural.length ? structural : components).map(ratio), 100)),
    weatherProtection: Math.round(clamp(
      average((roof.length ? roof : components).map(ratio), 100) * 0.72 +
      (100 - average((roof.length ? roof : components).map(component => component.moisture), 0)) * 0.18 +
      environment.drainage * 0.10,
    )),
    fireSafety: Math.round(clamp(100 - environment.fireRisk * 0.55 - fireDamage * 0.45)),
    functionality: Math.round(average((functional.length ? functional : components).map(ratio), 100)),
    cleanliness: Math.round(clamp(92 - rot * 0.42 - environment.moisture * 0.08)),
  };
}

export function syncStructureAggregateState(state: GameState, building: GameState['buildings'][number]): void {
  const components = building.structureComponents || [];
  if (components.length) {
    const averagePct = average(components.map(component =>
      component.conditionMax > 0 ? clamp(component.condition / component.conditionMax * 100) : 0
    ), 100);
    building.condition = Math.round(averagePct * 10) / 10;
  }
  building.structurePerformance = deriveStructurePerformance(state, building);
}

/** Build physical components from the actual phase workmanship/material record. */
export function initializeStructureComponentsFromConstruction(
  state: GameState,
  building: GameState['buildings'][number],
  job: StructureConstructionJob,
): void {
  if (building.structureComponents?.length) {
    syncStructureAggregateState(state, building);
    return;
  }

  const environment = placementEnvironment(state, building);
  const components = job.phases
    .map((phase, index) => createComponent(building.buildingId, phase, index, environment.moisture * 0.35))
    .filter((component): component is StructureComponentInstance => Boolean(component));

  building.structureComponents = components;
  building.structureModifications ||= [];
  syncStructureAggregateState(state, building);
}

function moistureTarget(state: GameState, component: StructureComponentInstance, baseMoisture: number): number {
  const rain = state.weather.current === 'storm'
    ? 36
    : state.weather.current === 'heavy_rain'
      ? 28
      : state.weather.current === 'light_rain'
        ? 16
        : 0;
  const exposedMultiplier = component.kind === 'roof' || component.kind === 'bindings' || component.kind === 'frame' ? 1 : 0.55;
  return clamp(baseMoisture * 0.58 + rain * exposedMultiplier + state.weather.humidityPercent * 0.22);
}

function organicFraction(component: StructureComponentInstance): number {
  if (!component.materialItemIds.length) return component.kind === 'ground' || component.kind === 'foundation' ? 0.1 : 0.55;
  return component.materialItemIds.filter(isOrganicMaterial).length / component.materialItemIds.length;
}

/**
 * Deterministic slow environmental wear. No hidden RNG is used; identical
 * structure/environment histories therefore produce identical degradation.
 */
export function tickStructureEnvironment(state: GameState, deltaGameMinutes: number): void {
  if (deltaGameMinutes <= 0) return;

  for (const building of state.buildings) {
    if (!building.isBuilt || !building.structureComponents?.length) continue;
    const environment = placementEnvironment(state, building);

    for (const component of building.structureComponents) {
      const target = moistureTarget(state, component, environment.moisture);
      const wettingRate = target > component.moisture ? 0.022 : 0.010;
      component.moisture = clamp(component.moisture + (target - component.moisture) * Math.min(1, deltaGameMinutes * wettingRate));

      const organic = organicFraction(component);
      if (organic > 0 && component.moisture > 68) {
        const rotGain = deltaGameMinutes * 0.0024 * organic * ((component.moisture - 60) / 40);
        component.rot = clamp(component.rot + rotGain);
        component.condition = Math.max(0, component.condition - rotGain * 0.22);
      } else if (component.moisture < 45 && component.rot > 0) {
        component.rot = Math.max(0, component.rot - deltaGameMinutes * 0.00015);
      }

      if (environment.floodRisk > 65 && ['ground', 'foundation', 'posts'].includes(component.kind)) {
        const floodStress = deltaGameMinutes * 0.0018 * ((environment.floodRisk - 55) / 45);
        component.condition = Math.max(0, component.condition - floodStress);
        component.moisture = clamp(component.moisture + floodStress * 4);
      }

      if (state.weather.current === 'storm' && ['roof', 'frame', 'bindings'].includes(component.kind)) {
        const windStress = deltaGameMinutes * 0.0032 * (0.45 + environment.windExposure / 100);
        component.condition = Math.max(0, component.condition - windStress);
      }

      // Rot permanently lowers the attainable ceiling slowly. Repair can restore
      // current condition, but a rotten component eventually needs replacement.
      if (component.rot > 55 && organic > 0.3) {
        const ceilingLoss = deltaGameMinutes * 0.00045 * organic;
        const minimumCeiling = component.originalConditionMax * 0.55;
        component.conditionMax = Math.max(minimumCeiling, component.conditionMax - ceilingLoss);
        component.permanentDamage = Math.max(0, component.originalConditionMax - component.conditionMax);
        component.condition = Math.min(component.condition, component.conditionMax);
      }
    }

    syncStructureAggregateState(state, building);
  }
}