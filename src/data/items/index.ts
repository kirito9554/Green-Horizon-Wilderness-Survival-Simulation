import { ItemDefinition } from '../../types';
import { RAW_MATERIALS_ITEMS } from './rawMaterials';
import { SURVIVAL_SUPPLIES_ITEMS } from './survivalSupplies';
import { TOOLS_AND_GEAR_ITEMS } from './toolsAndGear';

export { RAW_MATERIALS_ITEMS } from './rawMaterials';
export { SURVIVAL_SUPPLIES_ITEMS } from './survivalSupplies';
export { TOOLS_AND_GEAR_ITEMS } from './toolsAndGear';

/**
 * TỔNG HỢP TOÀN BỘ ITEMS DATABASE TRONG GAME
 * Bao gồm đầy đủ 82 nguyên liệu thô (raw-materials) cùng toàn bộ vật phẩm sinh tồn, nước, thức ăn & dụng cụ.
 */
export const ITEMS_DATABASE: Record<string, ItemDefinition> = {
  ...RAW_MATERIALS_ITEMS,
  ...SURVIVAL_SUPPLIES_ITEMS,
  ...TOOLS_AND_GEAR_ITEMS,

  // --- CÁC ALIAS TƯƠNG THÍCH NGƯỢC (Đảm bảo 100% tương thích với code cũ & recipes) ---
  ITEM_DRIFTWOOD_BRANCH: {
    ...RAW_MATERIALS_ITEMS.ITEM_DRIFTWOOD,
    id: 'ITEM_DRIFTWOOD_BRANCH',
  },
  ITEM_BAMBOO_STALK: {
    ...RAW_MATERIALS_ITEMS.ITEM_BAMBOO_POLE,
    id: 'ITEM_BAMBOO_STALK',
  },
  ITEM_BAMBOO_SPLIT: {
    ...RAW_MATERIALS_ITEMS.ITEM_SPLIT_BAMBOO,
    id: 'ITEM_BAMBOO_SPLIT',
  },
  ITEM_VINE_FIBER: {
    ...RAW_MATERIALS_ITEMS.ITEM_VINE,
    id: 'ITEM_VINE_FIBER',
  },
  ITEM_CORD_ROPE: {
    ...RAW_MATERIALS_ITEMS.ITEM_FIBER_ROPE,
    id: 'ITEM_CORD_ROPE',
  },
  ITEM_RIVER_PEBBLE: {
    ...RAW_MATERIALS_ITEMS.ITEM_PEBBLE,
    id: 'ITEM_RIVER_PEBBLE',
  },
  ITEM_SHAPED_AXE_HEAD: {
    ...RAW_MATERIALS_ITEMS.ITEM_STONE_AXE_HEAD,
    id: 'ITEM_SHAPED_AXE_HEAD',
  },
  ITEM_CLAY_LUMP: {
    ...RAW_MATERIALS_ITEMS.ITEM_CLAY,
    id: 'ITEM_CLAY_LUMP',
  },
  ITEM_COCONUT_CHARCOAL: {
    ...RAW_MATERIALS_ITEMS.ITEM_CHARCOAL,
    id: 'ITEM_COCONUT_CHARCOAL',
  },
  ITEM_COCONUT_BOWL: {
    ...RAW_MATERIALS_ITEMS.ITEM_COCONUT_SHELL,
    id: 'ITEM_COCONUT_BOWL',
  },
  ITEM_FISH_BONES: {
    ...RAW_MATERIALS_ITEMS.ITEM_FISH_BONE,
    id: 'ITEM_FISH_BONES',
  },
};
