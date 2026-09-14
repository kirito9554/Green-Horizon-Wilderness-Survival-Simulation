import { GameState, InventoryItem, ItemDefinition, ItemQuality, SurvivorState, BreakageYield } from '../types';
import '../types/craftingSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { applyComponentWear, type ToolWearTask } from './componentWearSystem';

export interface SpoilageAnalysis {
  effectiveDailyRate: number;
  remainingDays: number;
  totalMultiplier: number;
  factors: {
    temperatureFactor: number;
    humidityFactor: number;
    shelterFactor: number;
    qualityFactor: number;
    preservationFactor: number;
    descriptions: string[];
  };
}

export function analyzeItemSpoilage(
  item: InventoryItem,
  def: ItemDefinition,
  state: GameState
): SpoilageAnalysis | null {
  const baseDays = def.freshnessMaxDays;
  if (!baseDays || item.freshness === undefined) return null;

  const currentTemp = state.weather.temperatureC;
  const currentHumidity = state.weather.humidityPercent;
  const hasShelter = state.buildings.some(b => (b.buildingId === 'BUILDING_LEAF_SHELTER' || b.buildingId === 'BUILDING_CAMPFIRE_HEARTH') && b.isBuilt);
  const descriptions: string[] = [];

  let temperatureFactor = 1.0;
  if (currentTemp > 35) {
    temperatureFactor = 2.1;
    descriptions.push(`Nắng gắt (${currentTemp}°C): phân rã tăng mạnh (+110%)`);
  } else if (currentTemp > 28) {
    temperatureFactor = 1.4;
    descriptions.push(`Nhiệt độ nóng (${currentTemp}°C): hư hao nhanh hơn (+40%)`);
  } else if (currentTemp < 22) {
    temperatureFactor = 0.75;
    descriptions.push(`Khí hậu mát (${currentTemp}°C): phân rã chậm hơn (-25%)`);
  }

  let humidityFactor = 1.0;
  if (currentHumidity > 80) {
    humidityFactor = 1.3;
    descriptions.push(`Độ ẩm cao (${currentHumidity}%): tăng nấm mốc (+30%)`);
  } else if (currentHumidity < 50) {
    humidityFactor = 0.85;
    descriptions.push(`Không khí khô (${currentHumidity}%): giảm hư hao (-15%)`);
  }

  const shelterFactor = hasShelter ? 0.8 : 1.15;
  descriptions.push(hasShelter ? 'Kho có mái che: giảm nắng mưa trực tiếp (-20%)' : 'Để ngoài trời: tăng phơi nhiễm (+15%)');

  const quality = item.quality || 'standard';
  const qualityFactor = quality === 'masterwork' ? 0.6 : quality === 'prime' ? 0.8 : quality === 'crude' ? 1.35 : 1;
  if (quality !== 'standard') descriptions.push(`Phẩm chất ${quality}: hệ số hư hao x${qualityFactor.toFixed(2)}`);

  let preservationFactor = 1.0;
  const presType = def.preservationType || (def.tags.includes('cooked') ? 'cooked' : 'perishable');
  if (presType === 'cooked') preservationFactor = 0.5;
  else if (presType === 'sealed') preservationFactor = 0.4;
  else if (presType === 'dried') preservationFactor = 0.2;
  else if (presType === 'raw_fresh') preservationFactor = 1.4;
  if (presType !== 'perishable') descriptions.push(`${presType}: hệ số bảo quản x${preservationFactor.toFixed(2)}`);

  const customMod = item.spoilageMultiplier || 1;
  const totalMultiplier = Math.max(0.1, temperatureFactor * humidityFactor * shelterFactor * qualityFactor * preservationFactor * customMod);
  const baseDailyPercent = 100 / baseDays;
  const effectiveDailyRate = Math.round(baseDailyPercent * totalMultiplier * 10) / 10;
  const remainingDays = effectiveDailyRate > 0 ? Math.round(((item.freshness || 100) / effectiveDailyRate) * 10) / 10 : 999;

  return {
    effectiveDailyRate,
    remainingDays,
    totalMultiplier,
    factors: { temperatureFactor, humidityFactor, shelterFactor, qualityFactor, preservationFactor, descriptions },
  };
}

export function tickItemSimulation(next: GameState, deltaGameMinutes: number): void {
  const items = next.inventory.items;
  let spoiledCount = 0;
  const spoiledNames: string[] = [];

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const def = ITEMS_DATABASE[item.itemId];
    if (!def) continue;

    if (def.freshnessMaxDays && item.freshness !== undefined) {
      const analysis = analyzeItemSpoilage(item, def, next);
      if (!analysis) continue;
      item.freshness = Math.max(0, item.freshness - (analysis.effectiveDailyRate / 1440) * deltaGameMinutes);
      if (item.freshness <= 0) {
        const spoiledQty = item.quantity;
        spoiledNames.push(def.name);
        spoiledCount += spoiledQty;
        items.splice(i, 1);
        addItemToInventory(next.inventory, 'ITEM_ORGANIC_ROT', spoiledQty);
      }
    }
  }

  if (spoiledCount > 0) {
    const names = Array.from(new Set(spoiledNames)).slice(0, 2).join(', ');
    next.logs.unshift({
      id: `spoil_${Date.now()}`,
      day: next.gameTime.day,
      timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
      text: `[Ôi thiu] ${spoiledCount}x thực phẩm (${names}) đã phân rã do nhiệt ẩm cao.`,
      type: 'warning',
    });
  }
}

export function calculateToolWear(
  tool: InventoryItem,
  taskType: 'gathering' | 'crafting' | 'building',
  survivor: SurvivorState,
  state: GameState
): { wearAmount: number; notes: string[] } {
  const def = ITEMS_DATABASE[tool.itemId];
  const notes: string[] = [];
  const baseWear = taskType === 'gathering' ? 2.5 : taskType === 'building' ? 3.0 : 1.5;

  const q = tool.quality || 'standard';
  const qualityMod = q === 'masterwork' ? 0.55 : q === 'prime' ? 0.75 : q === 'crude' ? 1.45 : 1;
  if (q !== 'standard') notes.push(`${q} construction: wear x${qualityMod.toFixed(2)}`);

  const skill = taskType === 'crafting'
    ? (survivor.skills.crafting || 1)
    : taskType === 'building'
      ? (survivor.skills.building || 1)
      : (survivor.skills.foraging || 1);
  const skillMod = skill >= 2.5 ? 0.7 : skill < 1.2 ? 1.25 : 1;
  if (skill >= 2.5) notes.push(`${survivor.name} handles the tool precisely (-30% wear)`);
  else if (skill < 1.2) notes.push(`${survivor.name} is inexperienced (+25% wear)`);

  const fatigueMod = survivor.fatigue > 75 ? 1.4 : 1;
  if (fatigueMod > 1) notes.push('High fatigue causes poor impacts (+40% wear)');

  const weatherMod = state.weather.current === 'heavy_rain' || state.weather.current === 'storm' ? 1.3 : 1;
  if (weatherMod > 1) notes.push('Wet weather increases binding and grip wear');

  const hardness = def?.toolProperties?.hardness || 1;
  const hardnessReduction = 1 / (1 + (hardness - 1) * 0.2);
  const wearAmount = Math.round(baseWear * qualityMod * skillMod * fatigueMod * weatherMod * hardnessReduction * 10) / 10;
  return { wearAmount: Math.max(0.5, wearAmount), notes };
}

function inferWearTask(user: SurvivorState): ToolWearTask {
  if (user.currentAction.type === 'gathering') return 'gathering';
  if (user.currentAction.type === 'building') return 'building';
  return 'crafting';
}

/**
 * Wear damages the physical components appropriate to the survivor's real job.
 * A failed critical component disables the tool but the item remains repairable.
 */
export function applyToolWear(
  state: GameState,
  toolInstanceId: string,
  wearAmount: number,
  user: SurvivorState
): { isBroken: boolean; salvagedItems: BreakageYield[] } {
  const tool = state.inventory.items.find(item => item.instanceId === toolInstanceId);
  if (!tool) return { isBroken: false, salvagedItems: [] };
  const def = ITEMS_DATABASE[tool.itemId];
  if (!def || (!def.toolProperties && def.category !== 'tool')) return { isBroken: false, salvagedItems: [] };

  const task = inferWearTask(user);
  const result = applyComponentWear(tool, def, task, wearAmount, state);

  if (result.operationalBefore && !result.operationalAfter) {
    const failedText = result.failedComponentNames.length > 0 ? result.failedComponentNames.join(', ') : 'critical component';
    state.logs.unshift({
      id: `tool_disabled_${Date.now()}_${tool.instanceId}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `[Tool failure] ${def.name} used by ${user.name} is unusable: ${failedText}. The tool remains repairable.`,
      type: 'danger',
    });
  } else {
    const maxCond = tool.conditionMax || def.toolProperties?.durabilityMax || 100;
    const ratio = (tool.condition || 0) / Math.max(1, maxCond);
    if (ratio < 0.15 && Math.random() < 0.25) {
      state.logs.unshift({
        id: `warn_tool_${Date.now()}_${tool.instanceId}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `[Tool warning] ${def.name} is critically worn (${Math.round(ratio * 100)}%). Inspect its components before continuing.`,
        type: 'warning',
      });
    }
  }

  return { isBroken: !result.operationalAfter, salvagedItems: [] };
}

/** Legacy direct-craft quality helper retained for non-queue callers. */
export function synthesizeCraftedQuality(
  ingredientQualities: ItemQuality[],
  crafter: SurvivorState
): { quality: ItemQuality; conditionMaxMultiplier: number; bonusEfficiency: number } {
  const scoreMap: Record<ItemQuality, number> = { crude: 1, standard: 2, prime: 3.5, masterwork: 5 };
  const avgIngScore = ingredientQualities.length > 0
    ? ingredientQualities.reduce((sum, q) => sum + (scoreMap[q] || 2), 0) / ingredientQualities.length
    : 2;
  const craftSkill = crafter.skills.crafting || 1;
  let penalty = 0;
  if (crafter.fatigue > 70) penalty += 0.5;
  if (crafter.hunger > 70 || crafter.thirst > 70) penalty += 0.5;
  if (crafter.morale < 30) penalty += 0.3;

  const finalScore = avgIngScore * 0.45 + craftSkill * 0.9 - penalty + (Math.random() - 0.5) * 0.8;
  if (finalScore >= 4.2) return { quality: 'masterwork', conditionMaxMultiplier: 2.2, bonusEfficiency: 0.4 };
  if (finalScore >= 2.8) return { quality: 'prime', conditionMaxMultiplier: 1.5, bonusEfficiency: 0.2 };
  if (finalScore < 1.6) return { quality: 'crude', conditionMaxMultiplier: 0.7, bonusEfficiency: -0.15 };
  return { quality: 'standard', conditionMaxMultiplier: 1, bonusEfficiency: 0 };
}
