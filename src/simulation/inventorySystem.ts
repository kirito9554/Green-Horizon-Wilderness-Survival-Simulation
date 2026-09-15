import { GameState, InventoryItem, ItemQuality, QualityBreakdown, StorageInventory } from '../types';
import '../types/craftingSimulation';
import '../types/storageSimulation';
import { ITEMS_DATABASE } from '../data/items';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { mergeQualityBreakdown, deductFromQualityBreakdown } from '../utils/qualityUtils';

const QUALITY_ORDER: ItemQuality[] = ['crude', 'standard', 'prime', 'masterwork'];

function emptyBreakdown(): QualityBreakdown {
  return { crude: 0, standard: 0, prime: 0, masterwork: 0 };
}

function sumBreakdown(value?: QualityBreakdown): number {
  if (!value) return 0;
  return QUALITY_ORDER.reduce((sum, quality) => sum + (value[quality] || 0), 0);
}

function normalizeBreakdown(item: InventoryItem): QualityBreakdown {
  if (item.qualityBreakdown && sumBreakdown(item.qualityBreakdown) > 0) {
    return {
      crude: item.qualityBreakdown.crude || 0,
      standard: item.qualityBreakdown.standard || 0,
      prime: item.qualityBreakdown.prime || 0,
      masterwork: item.qualityBreakdown.masterwork || 0,
    };
  }
  const result = emptyBreakdown();
  result[item.quality || 'standard'] = item.quantity;
  return result;
}

function subtractBreakdownExact(base: QualityBreakdown | undefined, subtraction: QualityBreakdown): QualityBreakdown {
  const result = emptyBreakdown();
  for (const quality of QUALITY_ORDER) {
    result[quality] = Math.max(0, (base?.[quality] || 0) - (subtraction[quality] || 0));
  }
  return result;
}

function getAvailableBreakdown(item: InventoryItem): QualityBreakdown {
  return subtractBreakdownExact(normalizeBreakdown(item), item.reservedQualityBreakdown || emptyBreakdown());
}

function extractAvailableQualitySlice(item: InventoryItem, amount: number): QualityBreakdown | null {
  const available = getAvailableBreakdown(item);
  if (sumBreakdown(available) < amount) return null;

  const slice = emptyBreakdown();
  let remaining = amount;
  for (const quality of QUALITY_ORDER) {
    if (remaining <= 0) break;
    const take = Math.min(available[quality] || 0, remaining);
    slice[quality] = take;
    remaining -= take;
  }
  return remaining === 0 ? slice : null;
}

export function getAvailableInventoryItemQuantity(item: InventoryItem): number {
  return Math.max(0, item.quantity - (item.reservedQuantity || 0));
}

export function getAvailableInventoryStock(
  inventory: { items: InventoryItem[] },
  itemId: string,
): number {
  return inventory.items.reduce((sum, item) => {
    if (item.itemId !== itemId) return sum;
    return sum + getAvailableInventoryItemQuantity(item);
  }, 0);
}

export function calculateInventoryOccupancy(items: InventoryItem[]): { weight: number; volume: number } {
  let weight = 0;
  let volume = 0;
  for (const item of items) {
    const def = ITEMS_DATABASE[item.itemId];
    if (def) {
      weight += def.weight * item.quantity;
      volume += def.volume * item.quantity;
    }
  }
  return {
    weight: Math.round(weight * 10) / 10,
    volume: Math.round(volume * 10) / 10,
  };
}

function isLiquidDefinition(itemId: string): boolean {
  const def = ITEMS_DATABASE[itemId];
  return Boolean(def && (def.category === 'water' || def.tags.includes('liquid')));
}

function weightedNumber(existing: number | undefined, incoming: number | undefined, existingQty: number, incomingQty: number): number | undefined {
  if (incoming === undefined) return existing;
  if (existing === undefined || existingQty <= 0) return incoming;
  const total = existingQty + incomingQty;
  return total > 0 ? (existing * existingQty + incoming * incomingQty) / total : incoming;
}

function mergePhysicalMetadata(existing: InventoryItem, source: InventoryItem, existingQty: number, amount: number): void {
  existing.moisture = weightedNumber(existing.moisture, source.moisture, existingQty, amount);
  existing.contamination = weightedNumber(existing.contamination, source.contamination, existingQty, amount);
  existing.pestDamage = weightedNumber(existing.pestDamage, source.pestDamage, existingQty, amount);
  existing.mold = weightedNumber(existing.mold, source.mold, existingQty, amount);
  existing.corrosion = weightedNumber(existing.corrosion, source.corrosion, existingQty, amount);
  existing.medicinePotency = weightedNumber(existing.medicinePotency, source.medicinePotency, existingQty, amount);
  existing.spoilageMultiplier = weightedNumber(existing.spoilageMultiplier, source.spoilageMultiplier, existingQty, amount);

  if (source.liquidLiters !== undefined && source.quantity > 0) {
    existing.liquidLiters = (existing.liquidLiters || 0) + source.liquidLiters * amount / source.quantity;
  }
}

export function addItemToInventory(
  inventory: GameState['inventory'],
  itemId: string,
  quantity: number,
  quality: ItemQuality = 'standard'
): { success: boolean; added: number; remainder: number } {
  const def = ITEMS_DATABASE[itemId];
  if (!def || quantity <= 0) return { success: false, added: 0, remainder: quantity };

  const current = calculateInventoryOccupancy(inventory.items);
  const itemWeight = def.weight * quantity;
  const itemVolume = def.volume * quantity;

  if (current.weight + itemWeight > inventory.maxWeightKg || current.volume + itemVolume > inventory.maxVolumeL) {
    return { success: false, added: 0, remainder: quantity };
  }

  if (def.category === 'tool' || def.toolProperties) {
    const durMult = quality === 'prime' ? 1.5 : quality === 'masterwork' ? 2.2 : quality === 'crude' ? 0.7 : 1.0;
    const baseDur = def.toolProperties?.durabilityMax || 100;
    const conditionMax = Math.round(baseDur * durMult);

    for (let i = 0; i < quantity; i++) {
      inventory.items.push({
        instanceId: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        itemId,
        quantity: 1,
        quality,
        condition: conditionMax,
        conditionMax,
        originalConditionMax: conditionMax,
        reservedQuantity: 0,
        reservedQualityBreakdown: emptyBreakdown(),
      });
    }
    return { success: true, added: quantity, remainder: 0 };
  }

  let remaining = quantity;
  for (const invItem of inventory.items) {
    if (invItem.itemId === itemId && invItem.quantity < def.stackSize) {
      const spaceInStack = def.stackSize - invItem.quantity;
      const amountToAdd = Math.min(spaceInStack, remaining);
      invItem.quantity += amountToAdd;
      invItem.qualityBreakdown = mergeQualityBreakdown(invItem.qualityBreakdown, quality, amountToAdd);
      if (isLiquidDefinition(itemId)) invItem.liquidLiters = (invItem.liquidLiters ?? def.volume * (invItem.quantity - amountToAdd)) + def.volume * amountToAdd;
      remaining -= amountToAdd;
      if (remaining <= 0) break;
    }
  }

  while (remaining > 0) {
    const amountInNewStack = Math.min(def.stackSize, remaining);
    inventory.items.push({
      instanceId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      itemId,
      quantity: amountInNewStack,
      qualityBreakdown: { [quality]: amountInNewStack },
      quality,
      freshness: def.freshnessMaxDays ? 100 : undefined,
      liquidLiters: isLiquidDefinition(itemId) ? def.volume * amountInNewStack : undefined,
      medicinePotency: def.category === 'medicine' ? 100 : undefined,
      reservedQuantity: 0,
      reservedQualityBreakdown: emptyBreakdown(),
    });
    remaining -= amountInNewStack;
  }

  return { success: true, added: quantity, remainder: 0 };
}

export function repairToolItem(
  inventory: GameState['inventory'],
  toolInstanceId: string
): { success: boolean; repairedAmount: number; message: string } {
  const tool = inventory.items.find(i => i.instanceId === toolInstanceId);
  if (!tool) return { success: false, repairedAmount: 0, message: 'Không tìm thấy công cụ trong kho' };
  if ((tool.reservedQuantity || 0) > 0) {
    return { success: false, repairedAmount: 0, message: 'Công cụ đang được giữ cho một công việc khác' };
  }

  const def = ITEMS_DATABASE[tool.itemId];
  if (!def || !def.toolProperties) return { success: false, repairedAmount: 0, message: 'Vật phẩm không phải công cụ' };

  const maxCond = tool.conditionMax || def.toolProperties.durabilityMax || 100;
  if ((tool.condition || 0) >= maxCond) {
    return { success: false, repairedAmount: 0, message: 'Công cụ vẫn còn rất mới, chưa cần sửa chữa' };
  }

  const hasFiber = getAvailableInventoryStock(inventory, 'ITEM_VINE_FIBER') > 0 || getAvailableInventoryStock(inventory, 'ITEM_CORD_ROPE') > 0;
  const hasStone = getAvailableInventoryStock(inventory, 'ITEM_RIVER_PEBBLE') > 0;
  if (!hasFiber && !hasStone) {
    return { success: false, repairedAmount: 0, message: 'Cần ít nhất 1x Dây rừng hoặc 1x Đá cuội chưa được giữ cho công việc khác' };
  }

  if (hasFiber) {
    const materialId = getAvailableInventoryStock(inventory, 'ITEM_VINE_FIBER') > 0 ? 'ITEM_VINE_FIBER' : 'ITEM_CORD_ROPE';
    deductItemFromInventory(inventory, materialId, 1);
  } else {
    deductItemFromInventory(inventory, 'ITEM_RIVER_PEBBLE', 1);
  }

  const healAmount = Math.round(maxCond * 0.5);
  const oldCond = tool.condition || 0;
  tool.condition = Math.min(maxCond, oldCond + healAmount);
  const actualRepaired = tool.condition - oldCond;

  return {
    success: true,
    repairedAmount: actualRepaired,
    message: `Đã gia cố và mài lại ${def.name}, hồi phục +${actualRepaired} độ bền!`,
  };
}

export function deductItemFromInventory(
  inventory: GameState['inventory'],
  itemId: string,
  quantity: number
): boolean {
  let needed = quantity;
  const available = getAvailableInventoryStock(inventory, itemId);
  if (available < needed) return false;

  for (let i = inventory.items.length - 1; i >= 0 && needed > 0; i--) {
    const item = inventory.items[i];
    if (item.itemId !== itemId) continue;

    const availableOnItem = getAvailableInventoryItemQuantity(item);
    if (availableOnItem <= 0) continue;
    const take = Math.min(availableOnItem, needed);
    const qualitySlice = extractAvailableQualitySlice(item, take);
    if (!qualitySlice) continue;

    const quantityBefore = item.quantity;
    item.quantity -= take;
    if (item.liquidLiters !== undefined && quantityBefore > 0) {
      item.liquidLiters = Math.max(0, item.liquidLiters * item.quantity / quantityBefore);
    }
    if (item.qualityBreakdown) {
      item.qualityBreakdown = subtractBreakdownExact(item.qualityBreakdown, qualitySlice);
    }
    needed -= take;

    if (item.quantity <= 0) inventory.items.splice(i, 1);
  }

  return needed <= 0;
}

export function getOrCreatePoiStorage(state: GameState, areaId: string): StorageInventory {
  if (!state.poiStorages) state.poiStorages = {};
  if (!state.poiStorages[areaId]) {
    const isCamp = areaId === 'AREA_CAMP_CLEARING';
    const baseWeight = isCamp ? 120 : 45;
    const baseVolume = isCamp ? 180 : 70;

    let extraWeight = 0;
    let extraVolume = 0;
    if (state.buildings) {
      for (const b of state.buildings) {
        if (b.isBuilt && (b.areaId === areaId || (!b.areaId && isCamp))) {
          const bDef = BUILDINGS_DATABASE[b.buildingId];
          if (bDef?.maxCapacityIncrease) {
            extraWeight += bDef.maxCapacityIncrease.weightKg || 0;
            extraVolume += bDef.maxCapacityIncrease.volumeL || 0;
          }
        }
      }
    }

    const initialItems: InventoryItem[] = [];
    if (isCamp) {
      initialItems.push(
        {
          instanceId: 'camp_init_1', itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 12,
          quality: 'standard', qualityBreakdown: { crude: 4, standard: 8 },
          reservedQuantity: 0, reservedQualityBreakdown: emptyBreakdown(),
        },
        {
          instanceId: 'camp_init_2', itemId: 'ITEM_RIVER_PEBBLE', quantity: 8,
          quality: 'standard', qualityBreakdown: { standard: 8 },
          reservedQuantity: 0, reservedQualityBreakdown: emptyBreakdown(),
        },
        {
          instanceId: 'camp_init_3', itemId: 'ITEM_PALM_LEAF', quantity: 10,
          quality: 'standard', qualityBreakdown: { standard: 10 },
          reservedQuantity: 0, reservedQualityBreakdown: emptyBreakdown(),
        },
      );
    }

    state.poiStorages[areaId] = {
      maxWeightKg: baseWeight + extraWeight,
      maxVolumeL: baseVolume + extraVolume,
      items: initialItems,
    };
  }
  return state.poiStorages[areaId];
}

function mergeQualitySliceIntoTarget(
  targetInv: { items: InventoryItem[] },
  sourceItem: InventoryItem,
  defStackSize: number,
  qualitySlice: QualityBreakdown,
): void {
  for (const quality of QUALITY_ORDER) {
    let remaining = qualitySlice[quality] || 0;
    while (remaining > 0) {
      const existing = targetInv.items.find(item => item.itemId === sourceItem.itemId && item.quantity < defStackSize && (item.reservedQuantity || 0) === 0);
      if (existing) {
        const amount = Math.min(defStackSize - existing.quantity, remaining);
        const existingQty = existing.quantity;
        mergePhysicalMetadata(existing, sourceItem, existingQty, amount);
        existing.quantity += amount;
        existing.qualityBreakdown = mergeQualityBreakdown(existing.qualityBreakdown, quality, amount);
        if (sourceItem.freshness !== undefined) {
          existing.freshness = Math.min(existing.freshness ?? sourceItem.freshness, sourceItem.freshness);
        }
        remaining -= amount;
      } else {
        const amount = Math.min(defStackSize, remaining);
        targetInv.items.push({
          instanceId: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          itemId: sourceItem.itemId,
          quantity: amount,
          quality,
          qualityBreakdown: { [quality]: amount },
          freshness: sourceItem.freshness,
          condition: sourceItem.condition,
          conditionMax: sourceItem.conditionMax,
          originalConditionMax: sourceItem.originalConditionMax,
          moisture: sourceItem.moisture,
          contamination: sourceItem.contamination,
          pestDamage: sourceItem.pestDamage,
          mold: sourceItem.mold,
          corrosion: sourceItem.corrosion,
          medicinePotency: sourceItem.medicinePotency,
          spoilageMultiplier: sourceItem.spoilageMultiplier,
          liquidLiters: sourceItem.liquidLiters !== undefined && sourceItem.quantity > 0
            ? sourceItem.liquidLiters * amount / sourceItem.quantity
            : undefined,
          reservedQuantity: 0,
          reservedQualityBreakdown: emptyBreakdown(),
        });
        remaining -= amount;
      }
    }
  }
}

export function transferItemBetweenInventories(
  sourceInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] },
  targetInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] },
  instanceId: string,
  quantityToMove?: number
): { success: boolean; moved: number; message: string } {
  const sourceIndex = sourceInv.items.findIndex(i => i.instanceId === instanceId);
  if (sourceIndex === -1) return { success: false, moved: 0, message: 'Không tìm thấy vật phẩm' };

  const sourceItem = sourceInv.items[sourceIndex];
  const def = ITEMS_DATABASE[sourceItem.itemId];
  if (!def) return { success: false, moved: 0, message: 'Dữ liệu vật phẩm không hợp lệ' };

  const availableQuantity = getAvailableInventoryItemQuantity(sourceItem);
  if (availableQuantity <= 0) {
    return { success: false, moved: 0, message: `${def.name} đang được giữ cho một công việc khác` };
  }
  const moveQty = Math.max(1, Math.min(availableQuantity, quantityToMove ?? availableQuantity));

  const targetOcc = calculateInventoryOccupancy(targetInv.items);
  const addWeight = def.weight * moveQty;
  const addVolume = def.volume * moveQty;
  if (targetOcc.weight + addWeight > targetInv.maxWeightKg) {
    return { success: false, moved: 0, message: `Kho đích quá tải trọng lượng! (${(targetOcc.weight + addWeight).toFixed(1)} / ${targetInv.maxWeightKg} kg)` };
  }
  if (targetOcc.volume + addVolume > targetInv.maxVolumeL) {
    return { success: false, moved: 0, message: `Kho đích không đủ thể tích chứa! (${(targetOcc.volume + addVolume).toFixed(1)} / ${targetInv.maxVolumeL} L)` };
  }

  if (def.category === 'tool' || def.toolProperties) {
    if ((sourceItem.reservedQuantity || 0) > 0) {
      return { success: false, moved: 0, message: `${def.name} đang được giữ cho một công việc khác` };
    }
    targetInv.items.push({ ...sourceItem, reservedQuantity: 0, reservedQualityBreakdown: emptyBreakdown() });
    sourceInv.items.splice(sourceIndex, 1);
    return { success: true, moved: 1, message: `Đã chuyển 1x ${def.name}` };
  }

  const qualitySlice = extractAvailableQualitySlice(sourceItem, moveQty);
  if (!qualitySlice) return { success: false, moved: 0, message: `Không thể tách phần chưa được giữ của ${def.name}` };

  const quantityBefore = sourceItem.quantity;
  mergeQualitySliceIntoTarget(targetInv, sourceItem, def.stackSize, qualitySlice);
  sourceItem.quantity -= moveQty;
  if (sourceItem.liquidLiters !== undefined && quantityBefore > 0) {
    sourceItem.liquidLiters = Math.max(0, sourceItem.liquidLiters * sourceItem.quantity / quantityBefore);
  }
  if (sourceItem.qualityBreakdown) {
    sourceItem.qualityBreakdown = subtractBreakdownExact(sourceItem.qualityBreakdown, qualitySlice);
  }
  if (sourceItem.quantity <= 0) sourceInv.items.splice(sourceIndex, 1);

  return { success: true, moved: moveQty, message: `Đã chuyển ${moveQty}x ${def.name}` };
}

export function transferAllItems(
  sourceInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] },
  targetInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] }
): { success: boolean; movedCount: number; message: string } {
  let movedCount = 0;
  const instanceIds = [...sourceInv.items.map(i => i.instanceId)];

  for (const id of instanceIds) {
    const res = transferItemBetweenInventories(sourceInv, targetInv, id);
    if (res.success) movedCount += res.moved;
  }

  if (movedCount > 0) {
    return { success: true, movedCount, message: `Đã chuyển thành công ${movedCount} vật phẩm chưa được giữ sang kho!` };
  }
  return { success: false, movedCount: 0, message: 'Không thể chuyển (kho đích đầy, kho trống, hoặc toàn bộ vật phẩm đang được giữ)!' };
}
