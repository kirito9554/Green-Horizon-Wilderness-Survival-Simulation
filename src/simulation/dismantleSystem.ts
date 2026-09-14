import type { GameState, InventoryItem, ItemQuality, SurvivorState } from '../types';
import type { ComponentInstance, ToolComponentSlot } from '../types/craftingSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory } from './inventorySystem';
import { ensureToolComponentInstances } from './componentSystem';
import { formatTimeOfDay } from './timeSystem';

export interface DismantleYield {
  itemId: string;
  quantity: number;
  quality: ItemQuality;
  recoveredFrom: string;
}

export interface DismantleResult {
  state: GameState;
  success: boolean;
  yields: DismantleYield[];
  message: string;
}

function slotFallback(slot: ToolComponentSlot): string | undefined {
  switch (slot) {
    case 'blade': return 'ITEM_SHARP_STONE';
    case 'head': return 'ITEM_RIVER_PEBBLE';
    case 'handle': return 'ITEM_WOODEN_HANDLE';
    case 'shaft': return 'ITEM_DRIFTWOOD_BRANCH';
    case 'frame': return 'ITEM_DRIFTWOOD_BRANCH';
    case 'binding': return 'ITEM_VINE_FIBER';
    case 'string': return 'ITEM_VINE_FIBER';
    case 'grip': return 'ITEM_VINE_FIBER';
    case 'body': return 'ITEM_DRIFTWOOD_BRANCH';
    case 'closure': return 'ITEM_VINE_FIBER';
    default: return undefined;
  }
}

function degradeQuality(quality: ItemQuality, severe: boolean): ItemQuality {
  if (!severe) return quality;
  if (quality === 'masterwork') return 'prime';
  if (quality === 'prime') return 'standard';
  return 'crude';
}

function salvageChance(component: ComponentInstance, worker?: SurvivorState): number {
  const conditionRatio = component.conditionMax > 0 ? component.condition / component.conditionMax : 0;
  const skill = worker?.skills.crafting || 1;
  const carefulBonus = Math.min(0.18, Math.max(0, skill - 1) * 0.045);
  return Math.max(0.08, Math.min(0.98, 0.18 + conditionRatio * 0.67 + carefulBonus));
}

function deterministic01(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 4294967296;
}

function salvageComponent(component: ComponentInstance, tool: InventoryItem, worker?: SurvivorState): DismantleYield | null {
  const outputId = component.sourceItemId || slotFallback(component.slot);
  if (!outputId || !ITEMS_DATABASE[outputId]) return null;

  const conditionRatio = component.conditionMax > 0 ? component.condition / component.conditionMax : 0;
  const chance = salvageChance(component, worker);
  const roll = deterministic01(`${tool.instanceId}:${component.instanceId}:${Math.round(component.condition * 10)}`);
  if (roll > chance) return null;

  const severe = conditionRatio < 0.35 || (component.permanentDamage || 0) > component.originalConditionMax * 0.18;
  return {
    itemId: outputId,
    quantity: 1,
    quality: degradeQuality(component.quality, severe),
    recoveredFrom: component.name,
  };
}

/**
 * Immediate deliberate dismantle action. It is deterministic for a given
 * physical tool/component state: reloading a save cannot reroll salvage.
 */
export function dismantleTool(
  state: GameState,
  instanceId: string,
  survivorId?: string,
): DismantleResult {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const index = next.inventory.items.findIndex(item => item.instanceId === instanceId);
  if (index < 0) return { state, success: false, yields: [], message: 'Tool not found.' };

  const tool = next.inventory.items[index];
  if ((tool.reservedQuantity || 0) > 0) {
    return { state, success: false, yields: [], message: 'Tool is reserved by another production job.' };
  }

  const def = ITEMS_DATABASE[tool.itemId];
  if (!def || (!def.toolProperties && def.category !== 'tool')) {
    return { state, success: false, yields: [], message: 'Item cannot be dismantled as a tool.' };
  }

  ensureToolComponentInstances(tool, def);
  const worker = survivorId ? next.survivors.find(survivor => survivor.id === survivorId) : undefined;
  const yields: DismantleYield[] = [];

  for (const component of tool.components || []) {
    const salvage = salvageComponent(component, tool, worker);
    if (salvage) yields.push(salvage);
  }

  next.inventory.items.splice(index, 1);
  const actuallyAdded: DismantleYield[] = [];
  for (const yieldItem of yields) {
    const added = addItemToInventory(next.inventory, yieldItem.itemId, yieldItem.quantity, yieldItem.quality);
    if (added.success) actuallyAdded.push(yieldItem);
  }

  if (worker) worker.skills.crafting = (worker.skills.crafting || 1) + 0.025;
  const recoveredText = actuallyAdded.length
    ? actuallyAdded.map(entry => `${entry.quantity}x ${ITEMS_DATABASE[entry.itemId]?.name || entry.itemId} (${entry.recoveredFrom})`).join(', ')
    : 'no reusable components';

  next.logs.unshift({
    id: `dismantle_${Date.now()}_${instanceId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `[Dismantled] ${def.name}: recovered ${recoveredText}.`,
    type: actuallyAdded.length ? 'info' : 'warning',
  });

  return {
    state: next,
    success: true,
    yields: actuallyAdded,
    message: `Dismantled ${def.name}; recovered ${recoveredText}.`,
  };
}
