import type { GameState, InventoryItem, ItemDefinition } from '../types';
import type { ComponentInstance, ToolComponentSlot } from '../types/craftingSimulation';
import { ensureToolComponentInstances, isToolOperational, syncAggregateConditionFromComponents } from './componentSystem';

export type ToolWearTask = 'gathering' | 'crafting' | 'building';

const TASK_SLOT_LOADS: Record<ToolWearTask, Partial<Record<ToolComponentSlot, number>>> = {
  gathering: {
    blade: 0.48,
    head: 0.48,
    handle: 0.24,
    shaft: 0.28,
    frame: 0.35,
    string: 0.22,
    binding: 0.18,
    grip: 0.10,
    body: 0.30,
    closure: 0.10,
    other: 0.12,
  },
  crafting: {
    blade: 0.45,
    head: 0.36,
    handle: 0.18,
    shaft: 0.18,
    frame: 0.22,
    string: 0.18,
    binding: 0.22,
    grip: 0.15,
    body: 0.25,
    closure: 0.12,
    other: 0.14,
  },
  building: {
    blade: 0.30,
    head: 0.52,
    handle: 0.30,
    shaft: 0.28,
    frame: 0.24,
    string: 0.12,
    binding: 0.14,
    grip: 0.08,
    body: 0.30,
    closure: 0.08,
    other: 0.15,
  },
};

function qualityWearMultiplier(component: ComponentInstance): number {
  return component.quality === 'masterwork' ? 0.72 : component.quality === 'prime' ? 0.84 : component.quality === 'crude' ? 1.22 : 1;
}

function structuralWearMultiplier(component: ComponentInstance): number {
  const hardness = component.properties.hardness ?? 50;
  const toughness = component.properties.toughness ?? 50;
  const structural = (hardness * 0.45 + toughness * 0.55) / 100;
  return Math.max(0.72, 1.16 - structural * 0.42);
}

function moistureWearMultiplier(component: ComponentInstance, state: GameState): number {
  if (state.weather.current !== 'heavy_rain' && state.weather.current !== 'storm' && state.weather.current !== 'light_rain') return 1;
  const vulnerable = component.slot === 'binding' || component.slot === 'string' || component.slot === 'grip';
  if (!vulnerable) return 1.04;
  const resistance = component.properties.moistureResistance ?? 25;
  const rainSeverity = state.weather.current === 'storm' ? 0.55 : state.weather.current === 'heavy_rain' ? 0.40 : 0.22;
  return 1 + rainSeverity * (1 - resistance / 100);
}

function normalizeLoads(components: ComponentInstance[], task: ToolWearTask): Map<string, number> {
  const raw = new Map<string, number>();
  let total = 0;
  for (const component of components) {
    const load = TASK_SLOT_LOADS[task][component.slot] ?? 0.12;
    raw.set(component.instanceId, load);
    total += load;
  }
  if (total <= 0) return raw;
  for (const [id, value] of raw) raw.set(id, value / total);
  return raw;
}

export interface ComponentWearResult {
  operationalBefore: boolean;
  operationalAfter: boolean;
  failedComponentNames: string[];
  wearByComponent: Record<string, number>;
}

/**
 * Apply one aggregate wear event to physical components. The sum of distributed
 * wear is scaled by component count so aggregate durability falls at roughly
 * the same pace as the old single-bar model while failure location becomes real.
 */
export function applyComponentWear(
  tool: InventoryItem,
  def: ItemDefinition,
  task: ToolWearTask,
  aggregateWear: number,
  state: GameState,
): ComponentWearResult {
  ensureToolComponentInstances(tool, def);
  const components = tool.components || [];
  const before = isToolOperational(tool, def);
  if (components.length === 0) {
    tool.condition = Math.max(0, (tool.condition || 0) - aggregateWear);
    return { operationalBefore: before, operationalAfter: (tool.condition || 0) > 0, failedComponentNames: [], wearByComponent: {} };
  }

  const loads = normalizeLoads(components, task);
  const failed: string[] = [];
  const wearByComponent: Record<string, number> = {};
  const scale = components.length;

  for (const component of components) {
    const load = loads.get(component.instanceId) || 0;
    const wear = Math.max(
      0.05,
      aggregateWear * load * scale * qualityWearMultiplier(component) * structuralWearMultiplier(component) * moistureWearMultiplier(component, state),
    );
    const beforeCondition = component.condition;
    component.condition = Math.max(0, Math.round((component.condition - wear) * 10) / 10);
    wearByComponent[component.name] = Math.round((beforeCondition - component.condition) * 10) / 10;

    if (component.properties.edgeSharpness !== undefined && (component.slot === 'blade' || component.slot === 'head')) {
      component.properties.edgeSharpness = Math.max(0, Math.round((component.properties.edgeSharpness - wear * 0.75) * 10) / 10);
    }
    if (component.properties.tension !== undefined && (component.slot === 'binding' || component.slot === 'string')) {
      component.properties.tension = Math.max(0, Math.round((component.properties.tension - wear * 0.58) * 10) / 10);
    }

    if (beforeCondition > 0 && component.condition <= 0) failed.push(component.name);
  }

  syncAggregateConditionFromComponents(tool);
  const after = isToolOperational(tool, def);
  // Generic schedulers still use aggregate condition as a fast availability
  // check. Zero it while a critical component is failed; repair/replace later
  // calls syncAggregateConditionFromComponents and restores the real aggregate.
  if (!after) tool.condition = 0;

  return {
    operationalBefore: before,
    operationalAfter: after,
    failedComponentNames: failed,
    wearByComponent,
  };
}
