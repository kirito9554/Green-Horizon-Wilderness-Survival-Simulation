export interface StructureModificationDefinition {
  id: string;
  name: string;
  description: string;
  compatibleBuildingIds?: string[];
  compatibleCategories?: string[];
  cost: Array<{ itemId: string; quantity: number }>;
  durationSeconds: number;
  effects: {
    frameReinforcement?: number;
    roofReinforcement?: number;
    moistureResistance?: number;
    floodProtection?: number;
    windProtection?: number;
    functionality?: number;
    fireSafety?: number;
    addDrainageComponent?: boolean;
    addRaisedSurface?: boolean;
    /** Storage-only derived effects. Values are points except capacity percentages. */
    storageMoistureProtection?: number;
    storageRainProtection?: number;
    storagePestProtection?: number;
    storageContaminationProtection?: number;
    storageAccessibility?: number;
    storageVolumePercent?: number;
    storageWeightPercent?: number;
  };
}

export const STRUCTURE_MODIFICATIONS: Record<string, StructureModificationDefinition> = {
  MOD_CROSS_BRACING: {
    id: 'MOD_CROSS_BRACING',
    name: 'Giằng Chéo Khung',
    description: 'Bổ sung các thanh giằng chéo để giảm rung và tăng khả năng chịu gió của kết cấu.',
    compatibleCategories: ['shelter', 'storage', 'production'],
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 3 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 18,
    effects: { frameReinforcement: 18 },
  },
  MOD_DOUBLE_ROOF: {
    id: 'MOD_DOUBLE_ROOF',
    name: 'Mái Hai Lớp',
    description: 'Bổ sung lớp lợp chồng và khoảng thoáng giúp giảm nước lọt, nhưng tăng tải lên khung.',
    compatibleCategories: ['shelter'],
    cost: [
      { itemId: 'ITEM_PALM_LEAF', quantity: 6 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 20,
    effects: { roofReinforcement: 16, moistureResistance: 26 },
  },
  MOD_DRAINAGE_DITCH: {
    id: 'MOD_DRAINAGE_DITCH',
    name: 'Rãnh Thoát Nước',
    description: 'Đào và gia cố rãnh thoát nước quanh công trình để giảm ứ nước và stress nền trong mùa mưa.',
    compatibleCategories: ['shelter', 'storage', 'water', 'production'],
    cost: [
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 4 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 },
    ],
    durationSeconds: 22,
    effects: { floodProtection: 30, addDrainageComponent: true, storageMoistureProtection: 6 },
  },
  MOD_RAISED_FLOOR: {
    id: 'MOD_RAISED_FLOOR',
    name: 'Sàn Nâng',
    description: 'Nâng bề mặt sinh hoạt khỏi nền ẩm để cải thiện độ khô, vệ sinh và khả năng chịu ngập nhẹ.',
    compatibleCategories: ['shelter', 'storage'],
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 4 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 24,
    effects: { floodProtection: 22, functionality: 10, addRaisedSurface: true, storageMoistureProtection: 10, storageAccessibility: 4 },
  },
  MOD_WINDBREAK: {
    id: 'MOD_WINDBREAK',
    name: 'Vách Chắn Gió',
    description: 'Dựng vách nhẹ ở hướng phơi gió để giảm tải gió trực tiếp lên mái và khu sinh hoạt.',
    compatibleCategories: ['shelter', 'cooking'],
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 3 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 4 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 20,
    effects: { windProtection: 24, functionality: 4 },
  },

  MOD_STORAGE_RAISED_BASE: {
    id: 'MOD_STORAGE_RAISED_BASE',
    name: 'Chân Kê Kho Nâng Cao',
    description: 'Nâng đáy kho khỏi mặt đất bằng gỗ và đá kê, giảm hút ẩm nền và cản côn trùng bò trực tiếp vào vật tư.',
    compatibleCategories: ['storage'],
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 2 },
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 4 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 18,
    effects: {
      floodProtection: 12,
      storageMoistureProtection: 16,
      storagePestProtection: 8,
      storageAccessibility: 3,
    },
  },
  MOD_STORAGE_RAIN_COVER: {
    id: 'MOD_STORAGE_RAIN_COVER',
    name: 'Mái Phủ Chống Mưa Kho',
    description: 'Bổ sung lớp lá chồng và mép thoát nước trên storage để giảm mưa tạt và nước ngấm qua nắp, khe hoặc bề mặt chứa.',
    compatibleCategories: ['storage'],
    cost: [
      { itemId: 'ITEM_PALM_LEAF', quantity: 6 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 16,
    effects: {
      storageRainProtection: 24,
      storageMoistureProtection: 14,
    },
  },
  MOD_STORAGE_PEST_SCREEN: {
    id: 'MOD_STORAGE_PEST_SCREEN',
    name: 'Lưới Chắn Sinh Vật Nhỏ',
    description: 'Đan nan tre và sợi thành lớp chắn quanh khe hở để hạn chế côn trùng, chuột nhỏ và bụi bẩn xâm nhập.',
    compatibleCategories: ['storage'],
    cost: [
      { itemId: 'ITEM_BAMBOO_STRIP', quantity: 6 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
    ],
    durationSeconds: 16,
    effects: {
      storagePestProtection: 30,
      storageContaminationProtection: 14,
      storageAccessibility: -4,
    },
  },
  MOD_STORAGE_DIVIDERS: {
    id: 'MOD_STORAGE_DIVIDERS',
    name: 'Vách Chia & Giá Phân Loại',
    description: 'Thêm các ngăn nhỏ để lấy vật tư nhanh và tránh lẫn nhóm đồ, đổi lại một phần thể tích bị chiếm bởi khung phân loại.',
    compatibleCategories: ['storage'],
    cost: [
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 1 },
    ],
    durationSeconds: 14,
    effects: {
      storageAccessibility: 18,
      storageContaminationProtection: 6,
      storageVolumePercent: -8,
    },
  },
  MOD_STORAGE_REINFORCED_FRAME: {
    id: 'MOD_STORAGE_REINFORCED_FRAME',
    name: 'Khung Kho Gia Cường',
    description: 'Gia cố khung chịu lực và điểm buộc để kho chịu được vật tư nặng hơn mà không võng hoặc biến dạng.',
    compatibleCategories: ['storage'],
    cost: [
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 6 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 2 },
    ],
    durationSeconds: 20,
    effects: {
      frameReinforcement: 16,
      storageWeightPercent: 25,
      storageVolumePercent: 5,
    },
  },
};

export function getAvailableStructureModifications(buildingId: string, category: string): StructureModificationDefinition[] {
  return Object.values(STRUCTURE_MODIFICATIONS).filter(definition => {
    const buildingMatch = definition.compatibleBuildingIds?.includes(buildingId) ?? false;
    const categoryMatch = definition.compatibleCategories?.includes(category) ?? false;
    return buildingMatch || categoryMatch;
  });
}