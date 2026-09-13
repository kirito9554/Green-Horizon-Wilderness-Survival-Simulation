import { GameState, InventoryItem, ItemQuality, QualityBreakdown, StorageInventory } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import { BUILDINGS_DATABASE } from '../data/buildings';
import { mergeQualityBreakdown, deductFromQualityBreakdown } from '../utils/qualityUtils';

// Helper: Calculate total current weight and volume
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

// Helper: Add items safely to inventory considering stacks and quality
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

  // Check capacity limits
  if (current.weight + itemWeight > inventory.maxWeightKg || current.volume + itemVolume > inventory.maxVolumeL) {
    // Inventory is full
    return { success: false, added: 0, remainder: quantity };
  }

  // Với công cụ (tool) có durability: Mỗi món chiếm 1 ô riêng biệt để lưu đúng durability & quality
  if (def.category === 'tool' || def.toolProperties) {
    const durMult = quality === 'prime' ? 1.5 : quality === 'masterwork' ? 2.2 : quality === 'crude' ? 0.7 : 1.0;
    const baseDur = def.toolProperties?.durabilityMax || 100;
    const conditionMax = Math.round(baseDur * durMult);
    const condition = conditionMax;

    for (let i = 0; i < quantity; i++) {
      inventory.items.push({
        instanceId: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        itemId,
        quantity: 1,
        quality,
        condition,
        conditionMax,
      });
    }
    return { success: true, added: quantity, remainder: 0 };
  }

  let remaining = quantity;

  // Try filling existing stacks first
  for (const invItem of inventory.items) {
    if (invItem.itemId === itemId && invItem.quantity < def.stackSize) {
      const spaceInStack = def.stackSize - invItem.quantity;
      const amountToAdd = Math.min(spaceInStack, remaining);
      invItem.quantity += amountToAdd;
      
      // Update quality breakdown for this stack
      invItem.qualityBreakdown = mergeQualityBreakdown(invItem.qualityBreakdown, quality, amountToAdd);

      remaining -= amountToAdd;
      if (remaining <= 0) break;
    }
  }

  // Create new stacks if needed
  while (remaining > 0) {
    const amountInNewStack = Math.min(def.stackSize, remaining);
    const initialBreakdown: QualityBreakdown = {
      [quality]: amountInNewStack,
    };

    inventory.items.push({
      instanceId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      itemId,
      quantity: amountInNewStack,
      qualityBreakdown: initialBreakdown,
      quality,
      freshness: def.freshnessMaxDays ? 100 : undefined,
    });
    remaining -= amountInNewStack;
  }

  return { success: true, added: quantity, remainder: 0 };
}

// Helper: Sửa chữa công cụ bằng cách mài sắc hoặc quấn lại dây buộc
export function repairToolItem(
  inventory: GameState['inventory'],
  toolInstanceId: string
): { success: boolean; repairedAmount: number; message: string } {
  const tool = inventory.items.find(i => i.instanceId === toolInstanceId);
  if (!tool) return { success: false, repairedAmount: 0, message: 'Không tìm thấy công cụ trong kho' };

  const def = ITEMS_DATABASE[tool.itemId];
  if (!def || !def.toolProperties) return { success: false, repairedAmount: 0, message: 'Vật phẩm không phải công cụ' };

  const maxCond = tool.conditionMax || def.toolProperties.durabilityMax || 100;
  if ((tool.condition || 0) >= maxCond) {
    return { success: false, repairedAmount: 0, message: 'Công cụ vẫn còn rất mới, chưa cần sửa chữa' };
  }

  // Kiểm tra nguyên liệu sửa chữa (Cần 1x Dây buộc hoặc 1x Đá cuội ghè mài)
  const hasFiber = inventory.items.some(i => (i.itemId === 'ITEM_VINE_FIBER' || i.itemId === 'ITEM_CORD_ROPE') && i.quantity > 0);
  const hasStone = inventory.items.some(i => i.itemId === 'ITEM_RIVER_PEBBLE' && i.quantity > 0);

  if (!hasFiber && !hasStone) {
    return { success: false, repairedAmount: 0, message: 'Cần ít nhất 1x Dây rừng hoặc 1x Đá cuội để mài/buộc lại công cụ' };
  }

  // Tiêu thụ 1 nguyên liệu sửa chữa
  if (hasFiber) {
    const fiberItem = inventory.items.find(i => (i.itemId === 'ITEM_VINE_FIBER' || i.itemId === 'ITEM_CORD_ROPE') && i.quantity > 0);
    if (fiberItem) deductItemFromInventory(inventory, fiberItem.itemId, 1);
  } else if (hasStone) {
    deductItemFromInventory(inventory, 'ITEM_RIVER_PEBBLE', 1);
  }

  // Hồi phục 50% độ bền tối đa
  const healAmount = Math.round(maxCond * 0.5);
  const oldCond = tool.condition || 0;
  tool.condition = Math.min(maxCond, oldCond + healAmount);
  const actualRepaired = tool.condition - oldCond;

  return { 
    success: true, 
    repairedAmount: actualRepaired, 
    message: `Đã gia cố và mài lại ${def.name}, hồi phục +${actualRepaired} độ bền!` 
  };
}

// Helper: Deduct items from inventory (with quality breakdown support)
export function deductItemFromInventory(
  inventory: GameState['inventory'], 
  itemId: string, 
  quantity: number
): boolean {
  let needed = quantity;
  // First verify availability
  let available = 0;
  for (const item of inventory.items) {
    if (item.itemId === itemId) available += item.quantity;
  }
  if (available < needed) return false;

  for (let i = inventory.items.length - 1; i >= 0; i--) {
    const item = inventory.items[i];
    if (item.itemId === itemId) {
      if (item.quantity <= needed) {
        needed -= item.quantity;
        inventory.items.splice(i, 1);
      } else {
        item.quantity -= needed;
        if (item.qualityBreakdown) {
          const { updated } = deductFromQualityBreakdown(item.qualityBreakdown, needed);
          item.qualityBreakdown = updated;
        }
        needed = 0;
      }
      if (needed <= 0) break;
    }
  }
  return true;
}

// Helper: Lấy hoặc khởi tạo kho bãi riêng cho một POI
export function getOrCreatePoiStorage(state: GameState, areaId: string): StorageInventory {
  if (!state.poiStorages) {
    state.poiStorages = {};
  }
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
          if (bDef && bDef.maxCapacityIncrease) {
            extraWeight += bDef.maxCapacityIncrease.weightKg || 0;
            extraVolume += bDef.maxCapacityIncrease.volumeL || 0;
          }
        }
      }
    }

    // Một số địa điểm hoang sơ có thể có sẵn một số vật phẩm tích lũy tự nhiên
    const initialItems: InventoryItem[] = [];
    if (isCamp) {
      initialItems.push(
        {
          instanceId: `camp_init_1`,
          itemId: 'ITEM_DRIFTWOOD_BRANCH',
          quantity: 12,
          quality: 'standard',
          qualityBreakdown: { crude: 4, standard: 8 },
        },
        {
          instanceId: `camp_init_2`,
          itemId: 'ITEM_RIVER_PEBBLE',
          quantity: 8,
          quality: 'standard',
          qualityBreakdown: { standard: 8 },
        },
        {
          instanceId: `camp_init_3`,
          itemId: 'ITEM_PALM_LEAF',
          quantity: 10,
          quality: 'standard',
          qualityBreakdown: { standard: 10 },
        }
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

// Helper: Chuyển vật phẩm giữa 2 kho (Party Inventory <-> POI Storage)
export function transferItemBetweenInventories(
  sourceInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] },
  targetInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] },
  instanceId: string,
  quantityToMove?: number
): { success: boolean; moved: number; message: string } {
  const sourceIndex = sourceInv.items.findIndex(i => i.instanceId === instanceId);
  if (sourceIndex === -1) {
    return { success: false, moved: 0, message: 'Không tìm thấy vật phẩm' };
  }

  const sourceItem = sourceInv.items[sourceIndex];
  const def = ITEMS_DATABASE[sourceItem.itemId];
  if (!def) {
    return { success: false, moved: 0, message: 'Dữ liệu vật phẩm không hợp lệ' };
  }

  const moveQty = Math.max(1, Math.min(sourceItem.quantity, quantityToMove ?? sourceItem.quantity));

  // Kiểm tra tải trọng kho đích
  const targetOcc = calculateInventoryOccupancy(targetInv.items);
  const addWeight = def.weight * moveQty;
  const addVolume = def.volume * moveQty;

  if (targetOcc.weight + addWeight > targetInv.maxWeightKg) {
    return { 
      success: false, 
      moved: 0, 
      message: `Kho đích quá tải trọng lượng! (${(targetOcc.weight + addWeight).toFixed(1)} / ${targetInv.maxWeightKg} kg)` 
    };
  }
  if (targetOcc.volume + addVolume > targetInv.maxVolumeL) {
    return { 
      success: false, 
      moved: 0, 
      message: `Kho đích không đủ thể tích chứa! (${(targetOcc.volume + addVolume).toFixed(1)} / ${targetInv.maxVolumeL} L)` 
    };
  }

  // Chuyển đối với công cụ đơn chiếc
  if (def.category === 'tool' || def.toolProperties) {
    targetInv.items.push({
      ...sourceItem,
      quantity: 1,
    });
    sourceInv.items.splice(sourceIndex, 1);
    return { success: true, moved: 1, message: `Đã chuyển 1x ${def.name}` };
  }

  // Chuyển đối với stack
  let remainingToMove = moveQty;
  for (const tItem of targetInv.items) {
    if (tItem.itemId === sourceItem.itemId && tItem.quantity < def.stackSize) {
      const space = def.stackSize - tItem.quantity;
      const amount = Math.min(space, remainingToMove);
      tItem.quantity += amount;

      const dominantQ = sourceItem.quality || 'standard';
      tItem.qualityBreakdown = mergeQualityBreakdown(tItem.qualityBreakdown, dominantQ, amount);
      remainingToMove -= amount;
      if (remainingToMove <= 0) break;
    }
  }

  while (remainingToMove > 0) {
    const stackAmount = Math.min(def.stackSize, remainingToMove);
    const dominantQ = sourceItem.quality || 'standard';
    targetInv.items.push({
      instanceId: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      itemId: sourceItem.itemId,
      quantity: stackAmount,
      quality: dominantQ,
      qualityBreakdown: { [dominantQ]: stackAmount },
      freshness: sourceItem.freshness,
      condition: sourceItem.condition,
      conditionMax: sourceItem.conditionMax,
    });
    remainingToMove -= stackAmount;
  }

  // Khấu trừ ở kho nguồn
  if (sourceItem.quantity <= moveQty) {
    sourceInv.items.splice(sourceIndex, 1);
  } else {
    sourceItem.quantity -= moveQty;
    if (sourceItem.qualityBreakdown) {
      const { updated } = deductFromQualityBreakdown(sourceItem.qualityBreakdown, moveQty);
      sourceItem.qualityBreakdown = updated;
    }
  }

  return { success: true, moved: moveQty, message: `Đã chuyển ${moveQty}x ${def.name}` };
}

// Helper: Chuyển toàn bộ vật phẩm có thể chuyển từ kho nguồn sang kho đích
export function transferAllItems(
  sourceInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] },
  targetInv: { maxWeightKg: number; maxVolumeL: number; items: InventoryItem[] }
): { success: boolean; movedCount: number; message: string } {
  let movedCount = 0;
  const instanceIds = [...sourceInv.items.map(i => i.instanceId)];

  for (const id of instanceIds) {
    const res = transferItemBetweenInventories(sourceInv, targetInv, id);
    if (res.success) {
      movedCount += res.moved;
    }
  }

  if (movedCount > 0) {
    return { success: true, movedCount, message: `Đã chuyển thành công ${movedCount} vật phẩm sang kho!` };
  }
  return { success: false, movedCount: 0, message: 'Không thể chuyển (kho đích đã đầy hoặc kho nguồn trống)!' };
}

