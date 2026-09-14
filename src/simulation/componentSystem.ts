import type { InventoryItem, ItemDefinition, ItemQuality } from '../types';
import type {
  ComponentFunctionalProperties,
  ComponentInstance,
  CraftQualityProfile,
  ToolComponentSlot,
} from '../types/craftingSimulation';
import { QUALITY_CONFIG } from '../utils/qualityUtils';

interface ComponentTemplate {
  slot: ToolComponentSlot;
  name: string;
  materialTags: string[];
  conditionWeight: number;
  properties: ComponentFunctionalProperties;
}

const GENERIC_COMPONENTS: ComponentTemplate[] = [
  { slot: 'body', name: 'Body', materialTags: ['structure'], conditionWeight: 0.65, properties: { toughness: 55 } },
  { slot: 'binding', name: 'Binding', materialTags: ['binding'], conditionWeight: 0.35, properties: { tension: 60, moistureResistance: 35 } },
];

function templatesForTool(def: ItemDefinition): ComponentTemplate[] {
  const type = def.toolProperties?.type;
  switch (type) {
    case 'knife':
      return [
        { slot: 'blade', name: 'Blade', materialTags: ['blade', 'stone'], conditionWeight: 0.42, properties: { edgeSharpness: 68, hardness: 62, toughness: 48, thicknessMm: 7 } },
        { slot: 'handle', name: 'Handle', materialTags: ['wood'], conditionWeight: 0.28, properties: { lengthCm: 12, toughness: 58 } },
        { slot: 'binding', name: 'Binding', materialTags: ['fiber', 'binding'], conditionWeight: 0.20, properties: { tension: 65, moistureResistance: 30 } },
        { slot: 'grip', name: 'Grip', materialTags: ['grip'], conditionWeight: 0.10, properties: { gripComfort: 55, moistureResistance: 35 } },
      ];
    case 'axe':
      return [
        { slot: 'head', name: 'Axe Head', materialTags: ['head', 'stone'], conditionWeight: 0.40, properties: { edgeSharpness: 55, hardness: 68, toughness: 58, thicknessMm: 18 } },
        { slot: 'handle', name: 'Handle', materialTags: ['wood'], conditionWeight: 0.32, properties: { lengthCm: 45, toughness: 64 } },
        { slot: 'binding', name: 'Binding', materialTags: ['fiber', 'binding'], conditionWeight: 0.20, properties: { tension: 70, moistureResistance: 30 } },
        { slot: 'grip', name: 'Grip', materialTags: ['grip'], conditionWeight: 0.08, properties: { gripComfort: 50 } },
      ];
    case 'spear':
      return [
        { slot: 'head', name: 'Spear Head', materialTags: ['head', 'stone'], conditionWeight: 0.30, properties: { edgeSharpness: 62, hardness: 60, toughness: 48 } },
        { slot: 'shaft', name: 'Shaft', materialTags: ['wood', 'shaft'], conditionWeight: 0.44, properties: { lengthCm: 175, toughness: 62 } },
        { slot: 'binding', name: 'Binding', materialTags: ['fiber', 'binding'], conditionWeight: 0.18, properties: { tension: 65, moistureResistance: 30 } },
        { slot: 'grip', name: 'Grip', materialTags: ['grip'], conditionWeight: 0.08, properties: { gripComfort: 45 } },
      ];
    case 'hammer':
      return [
        { slot: 'head', name: 'Hammer Head', materialTags: ['head', 'stone'], conditionWeight: 0.45, properties: { hardness: 70, toughness: 70 } },
        { slot: 'handle', name: 'Handle', materialTags: ['wood'], conditionWeight: 0.34, properties: { lengthCm: 38, toughness: 65 } },
        { slot: 'binding', name: 'Binding', materialTags: ['binding'], conditionWeight: 0.16, properties: { tension: 72, moistureResistance: 30 } },
        { slot: 'grip', name: 'Grip', materialTags: ['grip'], conditionWeight: 0.05, properties: { gripComfort: 50 } },
      ];
    case 'bow':
      return [
        { slot: 'frame', name: 'Bow Limbs', materialTags: ['wood', 'frame'], conditionWeight: 0.46, properties: { toughness: 58, lengthCm: 145 } },
        { slot: 'string', name: 'Bow String', materialTags: ['fiber', 'string'], conditionWeight: 0.30, properties: { tension: 72, moistureResistance: 24 } },
        { slot: 'binding', name: 'Limb Binding', materialTags: ['fiber', 'binding'], conditionWeight: 0.14, properties: { tension: 62, moistureResistance: 30 } },
        { slot: 'grip', name: 'Grip', materialTags: ['grip'], conditionWeight: 0.10, properties: { gripComfort: 62 } },
      ];
    case 'container':
    case 'canteen':
      return [
        { slot: 'body', name: 'Container Body', materialTags: ['body'], conditionWeight: 0.60, properties: { toughness: 48, moistureResistance: 72 } },
        { slot: 'closure', name: 'Seal / Stopper', materialTags: ['closure'], conditionWeight: 0.20, properties: { moistureResistance: 78 } },
        { slot: 'binding', name: 'Binding', materialTags: ['binding'], conditionWeight: 0.12, properties: { tension: 55, moistureResistance: 38 } },
        { slot: 'grip', name: 'Carry Grip', materialTags: ['grip'], conditionWeight: 0.08, properties: { gripComfort: 58 } },
      ];
    default:
      return GENERIC_COMPONENTS;
  }
}

function qualityScalar(quality: ItemQuality): number {
  return QUALITY_CONFIG[quality]?.durabilityMultiplier || 1;
}

function createComponent(item: InventoryItem, template: ComponentTemplate, index: number, conditionRatio: number): ComponentInstance {
  const quality = item.quality || 'standard';
  const structuralVariance = 0.9 + template.conditionWeight * 0.35;
  const conditionMax = Math.max(20, Math.round(100 * qualityScalar(quality) * structuralVariance));
  const condition = Math.max(0, Math.min(conditionMax, Math.round(conditionMax * conditionRatio)));
  return {
    instanceId: `${item.instanceId}_${template.slot}_${index}`,
    slot: template.slot,
    name: template.name,
    materialTags: [...template.materialTags],
    quality,
    condition,
    conditionMax,
    originalConditionMax: conditionMax,
    properties: { ...template.properties },
    permanentDamage: 0,
  };
}

export function createDefaultCraftQualityProfile(quality: ItemQuality): CraftQualityProfile {
  const base = quality === 'masterwork' ? 94 : quality === 'prime' ? 82 : quality === 'crude' ? 42 : 65;
  return {
    material: base,
    workmanship: base,
    fit: Math.max(0, Math.min(100, base - 2)),
    finish: Math.max(0, Math.min(100, base - 5)),
    structuralIntegrity: Math.max(0, Math.min(100, base + 2)),
  };
}

export function ensureToolComponentInstances(item: InventoryItem, def: ItemDefinition): InventoryItem {
  if (!def.toolProperties && def.category !== 'tool') return item;

  const aggregateMax = Math.max(1, item.conditionMax || def.toolProperties?.durabilityMax || 100);
  const aggregateCondition = item.condition === undefined ? aggregateMax : item.condition;
  const ratio = Math.max(0, Math.min(1, aggregateCondition / aggregateMax));

  item.originalConditionMax = item.originalConditionMax || aggregateMax;
  item.craftQualityProfile = item.craftQualityProfile || createDefaultCraftQualityProfile(item.quality || 'standard');
  if (!item.components || item.components.length === 0) {
    item.components = templatesForTool(def).map((template, index) => createComponent(item, template, index, ratio));
  }
  return item;
}

export function deriveAggregateConditionFromComponents(item: InventoryItem): { condition: number; conditionMax: number } {
  if (!item.components || item.components.length === 0) {
    return {
      condition: item.condition || 0,
      conditionMax: item.conditionMax || item.originalConditionMax || 100,
    };
  }

  let current = 0;
  let max = 0;
  for (const component of item.components) {
    current += component.condition;
    max += component.conditionMax;
  }
  const ratio = max > 0 ? current / max : 0;
  const aggregateMax = item.conditionMax || item.originalConditionMax || 100;
  return {
    condition: Math.round(aggregateMax * ratio * 10) / 10,
    conditionMax: aggregateMax,
  };
}

export function syncAggregateConditionFromComponents(item: InventoryItem): void {
  const derived = deriveAggregateConditionFromComponents(item);
  item.condition = derived.condition;
  item.conditionMax = derived.conditionMax;
}

function criticalSlotsFor(def: ItemDefinition): ToolComponentSlot[] {
  switch (def.toolProperties?.type) {
    case 'knife': return ['blade', 'handle', 'binding'];
    case 'axe': return ['head', 'handle', 'binding'];
    case 'spear': return ['head', 'shaft', 'binding'];
    case 'hammer': return ['head', 'handle', 'binding'];
    case 'bow': return ['frame', 'string'];
    case 'container':
    case 'canteen': return ['body', 'closure'];
    default: return ['body'];
  }
}

/** A broken critical part disables the tool but leaves the physical item repairable. */
export function isToolOperational(item: InventoryItem, def: ItemDefinition): boolean {
  ensureToolComponentInstances(item, def);
  const criticalSlots = criticalSlotsFor(def);
  const components = item.components || [];
  if (components.length === 0) return (item.condition || 0) > 0;

  return criticalSlots.every(slot => {
    const component = components.find(part => part.slot === slot);
    if (!component) return true;
    const ratio = component.conditionMax > 0 ? component.condition / component.conditionMax : 0;
    if (ratio <= 0.02) return false;
    if ((slot === 'binding' || slot === 'string') && (component.properties.tension ?? 100) <= 5) return false;
    return true;
  });
}
