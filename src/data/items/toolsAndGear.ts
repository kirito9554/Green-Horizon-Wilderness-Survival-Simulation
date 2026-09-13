import { ItemDefinition } from '../../types';

/**
 * TOOLS AND GEAR (Dụng cụ chế tác và trang bị sinh tồn)
 */
export const TOOLS_AND_GEAR_ITEMS: Record<string, ItemDefinition> = {
  ITEM_PRIMITIVE_STONE_AXE: {
    id: 'ITEM_PRIMITIVE_STONE_AXE',
    name: 'Rìu Đá Ghè Cầm Tay',
    description: 'Rìu đá buộc cán gỗ bằng dây thừng dẻo. Công cụ không thể thiếu để đốn hạ gỗ rừng và thu hoạch tre.',
    category: 'tool',
    weight: 1.8,
    volume: 2.2,
    stackSize: 1,
    toolProperties: {
      type: 'axe',
      tier: 1,
      durabilityMax: 100,
      efficiency: 1.5,
      hardness: 2,
      repairable: true,
    },
    breakageSalvage: [
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 1 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 },
    ],
    tags: ['tool', 'axe', 'heavy'],
    iconName: 'Axe',
  },
  ITEM_PRIMITIVE_STONE_KNIFE: {
    id: 'ITEM_PRIMITIVE_STONE_KNIFE',
    name: 'Dao Đá Tiện Ích Buộc Cán',
    description: 'Lưỡi đá mài sắc quấn tay cầm bằng xơ cọ êm ái. Tăng tốc độ thu lượm, mổ cá và chế tác vật liệu lên 40%.',
    category: 'tool',
    weight: 0.5,
    volume: 0.6,
    stackSize: 1,
    toolProperties: {
      type: 'knife',
      tier: 1,
      durabilityMax: 80,
      efficiency: 1.4,
      hardness: 2,
      repairable: true,
    },
    breakageSalvage: [
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 1 },
    ],
    tags: ['tool', 'knife', 'sharp'],
    iconName: 'Scissors',
  },
  ITEM_FIRE_STARTER: {
    id: 'ITEM_FIRE_STARTER',
    name: 'Bộ Khoan Cọ Xát Tạo Lửa',
    description: 'Thanh khoan gỗ và bàn tạo lửa bằng rãnh tre khô. Cho phép người sống sót tạo đốm than nhóm lửa tin cậy.',
    category: 'tool',
    weight: 0.4,
    volume: 0.8,
    stackSize: 2,
    toolProperties: {
      type: 'hammer', // used as fire gadget
      tier: 1,
      durabilityMax: 40,
      efficiency: 1.0,
      hardness: 1,
      repairable: false,
    },
    breakageSalvage: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 },
    ],
    tags: ['tool', 'fire'],
    iconName: 'Flame',
  },
};
