import { GameState, InventoryItem, ItemDefinition, ItemQuality, SurvivorState, BreakageYield } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import { addItemToInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';
import { QUALITY_CONFIG } from '../utils/qualityUtils';

export interface SpoilageAnalysis {
  effectiveDailyRate: number; // % hư hao mỗi ngày
  remainingDays: number;       // số ngày còn lại ước tính
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

/**
 * Tính toán đa biến tốc độ ôi thiu theo thời tiết, kho chứa, phẩm chất và phương pháp bảo quản
 */
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

  // 1. Hệ số nhiệt độ (Nhiệt đới 24°C là mốc chuẩn 1.0)
  let temperatureFactor = 1.0;
  if (currentTemp > 35) {
    temperatureFactor = 2.1;
    descriptions.push(`Nắng gắt gay gắt (${currentTemp}°C): Vi sinh phát triển cực nhanh (+110%)`);
  } else if (currentTemp > 28) {
    temperatureFactor = 1.4;
    descriptions.push(`Nhiệt độ ấm nóng (${currentTemp}°C): Tăng tốc độ hư hao (+40%)`);
  } else if (currentTemp < 22) {
    temperatureFactor = 0.75;
    descriptions.push(`Khí hậu mát mẻ (${currentTemp}°C): Làm chậm phân rã (-25%)`);
  }

  // 2. Hệ số độ ẩm (Độ ẩm > 80% kích thích nấm mốc với thực vật & cá thịt)
  let humidityFactor = 1.0;
  if (currentHumidity > 80) {
    humidityFactor = 1.3;
    descriptions.push(`Độ ẩm không khí cao (${currentHumidity}%): Dễ sinh nấm mốc (+30%)`);
  } else if (currentHumidity < 50) {
    humidityFactor = 0.85;
    descriptions.push(`Không khí hanh khô (${currentHumidity}%): Thoát ẩm nhanh (-15%)`);
  }

  // 3. Hệ số che chắn kho (Có lều che chắn nắng mưa)
  let shelterFactor = 1.0;
  if (hasShelter) {
    shelterFactor = 0.8;
    descriptions.push(`Kho có mái che: Tránh ánh nắng trực tiếp (-20%)`);
  } else {
    shelterFactor = 1.15;
    descriptions.push(`Để trần ngoài trời: Tiếp xúc trực tiếp sương nắng (+15%)`);
  }

  // 4. Hệ số phẩm chất của vật phẩm
  const quality = item.quality || 'standard';
  let qualityFactor = 1.0;
  if (quality === 'masterwork') {
    qualityFactor = 0.6;
    descriptions.push(`Phẩm chất Hoàn mỹ: Lớp biểu bì kín, kháng khuẩn tự nhiên (-40%)`);
  } else if (quality === 'prime') {
    qualityFactor = 0.8;
    descriptions.push(`Phẩm chất Tuyển chọn: Chắc thịt, ráo nước (-20%)`);
  } else if (quality === 'crude') {
    qualityFactor = 1.35;
    descriptions.push(`Phẩm chất Tạm bợ: Nứt dập, dễ nhiễm khuẩn (+35%)`);
  }

  // 5. Hệ số bảo quản & sơ chế
  let preservationFactor = 1.0;
  const presType = def.preservationType || (def.tags.includes('cooked') ? 'cooked' : 'perishable');
  if (presType === 'cooked') {
    preservationFactor = 0.5;
    descriptions.push(`Đã nấu chín / nướng than: Diệt khuẩn, giữ được lâu hơn (-50%)`);
  } else if (presType === 'sealed') {
    preservationFactor = 0.4;
    descriptions.push(`Được bịt kín trong vật chứa: Ngăn ruồi bọ và không khí (-60%)`);
  } else if (presType === 'dried') {
    preservationFactor = 0.2;
    descriptions.push(`Đã sấy khô / hun khói: Bảo quản trường kỳ (-80%)`);
  } else if (presType === 'raw_fresh') {
    preservationFactor = 1.4;
    descriptions.push(`Thực phẩm tươi sống chưa qua chế biến: Rất mau ươn (+40%)`);
  }

  const customMod = item.spoilageMultiplier || 1.0;
  const totalMultiplier = Math.max(0.1, temperatureFactor * humidityFactor * shelterFactor * qualityFactor * preservationFactor * customMod);

  // Tính % hư hao mỗi ngày thực tế (1 ngày = 1440 game minutes)
  const baseDailyPercent = 100 / baseDays;
  const effectiveDailyRate = Math.round(baseDailyPercent * totalMultiplier * 10) / 10;
  const remainingDays = effectiveDailyRate > 0 ? Math.round(((item.freshness || 100) / effectiveDailyRate) * 10) / 10 : 999;

  return {
    effectiveDailyRate,
    remainingDays,
    totalMultiplier,
    factors: {
      temperatureFactor,
      humidityFactor,
      shelterFactor,
      qualityFactor,
      preservationFactor,
      descriptions,
    },
  };
}

/**
 * Ticking hệ thống phân rã thực phẩm & hư hỏng theo môi trường thực
 */
export function tickItemSimulation(next: GameState, deltaGameMinutes: number): void {
  const items = next.inventory.items;
  let spoiledCount = 0;
  const spoiledNames: string[] = [];

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const def = ITEMS_DATABASE[item.itemId];
    if (!def) continue;

    // 1. Phân rã độ tươi (Freshness decay)
    if (def.freshnessMaxDays && item.freshness !== undefined) {
      const analysis = analyzeItemSpoilage(item, def, next);
      if (analysis) {
        // Tỉ lệ hao mòn mỗi phút:
        const lossPerMinute = (analysis.effectiveDailyRate / 1440);
        item.freshness = Math.max(0, item.freshness - lossPerMinute * deltaGameMinutes);

        // Khi độ tươi chạm đáy 0: Thức ăn biến chất thành rác hữu cơ (Compost Rot)
        if (item.freshness <= 0) {
          const spoiledQty = item.quantity;
          spoiledNames.push(def.name);
          spoiledCount += spoiledQty;

          // Xóa món đồ bị thối khỏi kho
          items.splice(i, 1);

          // Sinh ra rác hữu cơ bù lại vào kho
          addItemToInventory(next.inventory, 'ITEM_ORGANIC_ROT', spoiledQty);
        }
      }
    }
  }

  // Ghi log cảnh báo nếu có thực phẩm bị thiu hỏng
  if (spoiledCount > 0) {
    const uniqueNames = Array.from(new Set(spoiledNames)).slice(0, 2).join(', ');
    next.logs.unshift({
      id: `spoil_${Date.now()}`,
      day: next.gameTime.day,
      timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
      text: `[Ôi thiu] ${spoiledCount}x thực phẩm (${uniqueNames}...) đã phân rã hoàn toàn thành mùn hữu cơ do nhiệt ẩm cao!`,
      type: 'warning',
    });
  }
}

/**
 * Tính toán hao mòn độ bền công cụ khi lao động
 */
export function calculateToolWear(
  tool: InventoryItem,
  taskType: 'gathering' | 'crafting' | 'building',
  survivor: SurvivorState,
  state: GameState
): { wearAmount: number; notes: string[] } {
  const def = ITEMS_DATABASE[tool.itemId];
  const notes: string[] = [];
  let baseWear = 2.0; // Điểm mòn cơ sở mỗi lần hoàn thành công việc

  if (taskType === 'gathering') {
    baseWear = 2.5;
  } else if (taskType === 'building') {
    baseWear = 3.0;
  } else {
    baseWear = 1.5;
  }

  // 1. Phẩm chất công cụ giảm hao mòn
  const q = tool.quality || 'standard';
  let qualityMod = 1.0;
  if (q === 'masterwork') {
    qualityMod = 0.55;
    notes.push('Chế tác hoàn mỹ: Lưỡi bền gấp đôi (-45% mòn)');
  } else if (q === 'prime') {
    qualityMod = 0.75;
    notes.push('Vật liệu tuyển chọn: Giảm hao mòn (-25%)');
  } else if (q === 'crude') {
    qualityMod = 1.45;
    notes.push('Kết cấu tạm bợ: Dễ mẻ và lung lay (+45% mòn)');
  }

  // 2. Kỹ năng người dùng (thợ lành nghề ít làm sứt mẻ công cụ)
  const skill = taskType === 'crafting' 
    ? (survivor.skills.crafting || 1)
    : taskType === 'building' 
      ? (survivor.skills.building || 1)
      : (survivor.skills.foraging || 1);

  let skillMod = 1.0;
  if (skill >= 2.5) {
    skillMod = 0.7;
    notes.push(`${survivor.name} thao tác chuẩn xác (-30% mòn)`);
  } else if (skill < 1.2) {
    skillMod = 1.25;
    notes.push(`${survivor.name} còn vụng về, dễ làm va đập (+25% mòn)`);
  }

  // 3. Thể lực người dùng (mệt mỏi vung lệch tay, chém vào đá)
  let fatigueMod = 1.0;
  if (survivor.fatigue > 75) {
    fatigueMod = 1.4;
    notes.push('Kiệt sức: Vung lực không đều (+40% mòn)');
  }

  // 4. Thời tiết (Mưa gió làm mục dây bện)
  let weatherMod = 1.0;
  if (state.weather.current === 'heavy_rain' || state.weather.current === 'storm') {
    weatherMod = 1.3;
    notes.push('Mưa bão ngấm nước: Dây buộc nhanh dão (+30% mòn)');
  }

  const hardness = def?.toolProperties?.hardness || 1;
  const hardnessReduction = 1 / (1 + (hardness - 1) * 0.2);

  const wearAmount = Math.round(baseWear * qualityMod * skillMod * fatigueMod * weatherMod * hardnessReduction * 10) / 10;

  return {
    wearAmount: Math.max(0.5, wearAmount),
    notes,
  };
}

/**
 * Áp dụng hao mòn và kiểm tra vỡ nát công cụ
 */
export function applyToolWear(
  state: GameState, 
  toolInstanceId: string, 
  wearAmount: number, 
  user: SurvivorState
): { isBroken: boolean; salvagedItems: BreakageYield[] } {
  const toolIndex = state.inventory.items.findIndex(i => i.instanceId === toolInstanceId);
  if (toolIndex === -1) return { isBroken: false, salvagedItems: [] };

  const tool = state.inventory.items[toolIndex];
  const def = ITEMS_DATABASE[tool.itemId];
  if (!def || tool.condition === undefined) return { isBroken: false, salvagedItems: [] };

  tool.condition = Math.max(0, Math.round((tool.condition - wearAmount) * 10) / 10);

  // Nếu công cụ gãy hoàn toàn (condition <= 0)
  if (tool.condition <= 0) {
    state.inventory.items.splice(toolIndex, 1);

    const salvaged: BreakageYield[] = [];
    if (def.breakageSalvage && def.breakageSalvage.length > 0) {
      for (const s of def.breakageSalvage) {
        addItemToInventory(state.inventory, s.itemId, s.quantity, 'crude');
        salvaged.push(s);
      }
    } else {
      // Fallback mặc định cho công cụ thô sơ: rớt 1 đá cuội hoặc cành cây
      addItemToInventory(state.inventory, 'ITEM_RIVER_PEBBLE', 1, 'crude');
      salvaged.push({ itemId: 'ITEM_RIVER_PEBBLE', quantity: 1 });
    }

    const salvageText = salvaged.map(s => {
      const sDef = ITEMS_DATABASE[s.itemId];
      return `${s.quantity}x ${sDef ? sDef.name : s.itemId}`;
    }).join(', ');

    state.logs.unshift({
      id: `break_${Date.now()}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `[Gãy nát] ${def.name} của ${user.name} đã gãy vỡ sau thời gian dài sử dụng! Thu hồi phế liệu: ${salvageText}.`,
      type: 'danger',
    });

    return { isBroken: true, salvagedItems: salvaged };
  }

  // Cảnh báo khi công cụ sắp gãy (dưới 15%)
  const maxCond = tool.conditionMax || def.toolProperties?.durabilityMax || 100;
  if ((tool.condition / maxCond) < 0.15 && Math.random() < 0.25) {
    state.logs.unshift({
      id: `warn_tool_${Date.now()}`,
      day: state.gameTime.day,
      timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
      text: `[Cảnh báo công cụ] ${def.name} đang mẻ cạnh nghiêm trọng (${tool.condition}/${maxCond})!`,
      type: 'warning',
    });
  }

  return { isBroken: false, salvagedItems: [] };
}

/**
 * Tổng hợp phẩm chất thành phẩm dựa trên nguyên liệu đầu vào và trạng thái người chế tác
 */
export function synthesizeCraftedQuality(
  ingredientQualities: ItemQuality[],
  crafter: SurvivorState
): { quality: ItemQuality; conditionMaxMultiplier: number; bonusEfficiency: number } {
  // Điểm số nguyên liệu (Crude: 1, Standard: 2, Prime: 3.5, Masterwork: 5)
  const scoreMap: Record<ItemQuality, number> = {
    crude: 1,
    standard: 2,
    prime: 3.5,
    masterwork: 5,
  };

  let avgIngScore = 2;
  if (ingredientQualities.length > 0) {
    const total = ingredientQualities.reduce((sum, q) => sum + (scoreMap[q] || 2), 0);
    avgIngScore = total / ingredientQualities.length;
  }

  // Điểm số tay nghề thợ (Crafting Skill: 1.0 -> 5.0)
  const craftSkill = crafter.skills.crafting || 1;

  // Điểm trừ sức khỏe (Đói, khát, mệt mỏi)
  let penalty = 0;
  if (crafter.fatigue > 70) penalty += 0.5;
  if (crafter.hunger > 70 || crafter.thirst > 70) penalty += 0.5;
  if (crafter.morale < 30) penalty += 0.3;

  // Điểm tổng hợp (Weighted: Nguyên liệu 45%, Kỹ năng 45%, Thể trạng 10%)
  const baseComposite = (avgIngScore * 0.45) + (craftSkill * 0.9) - penalty;
  const rollVariance = (Math.random() - 0.5) * 0.8; // Biến thiên ngẫu nhiên ±0.4
  const finalScore = baseComposite + rollVariance;

  let quality: ItemQuality = 'standard';
  let conditionMaxMultiplier = 1.0;
  let bonusEfficiency = 0;

  if (finalScore >= 4.2) {
    quality = 'masterwork';
    conditionMaxMultiplier = 2.2;
    bonusEfficiency = 0.4;
  } else if (finalScore >= 2.8) {
    quality = 'prime';
    conditionMaxMultiplier = 1.5;
    bonusEfficiency = 0.2;
  } else if (finalScore < 1.6) {
    quality = 'crude';
    conditionMaxMultiplier = 0.7;
    bonusEfficiency = -0.15;
  }

  return { quality, conditionMaxMultiplier, bonusEfficiency };
}
