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
    effects: { frameReinforcement: 18, windProtection: 14 },
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
    effects: { floodProtection: 30, addDrainageComponent: true },
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
    effects: { floodProtection: 22, functionality: 10, addRaisedSurface: true },
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
};

export function getAvailableStructureModifications(buildingId: string, category: string): StructureModificationDefinition[] {
  return Object.values(STRUCTURE_MODIFICATIONS).filter(definition => {
    const buildingMatch = definition.compatibleBuildingIds?.includes(buildingId) ?? false;
    const categoryMatch = definition.compatibleCategories?.includes(category) ?? false;
    return buildingMatch || categoryMatch;
  });
}
