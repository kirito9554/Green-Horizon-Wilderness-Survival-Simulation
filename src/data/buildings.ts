import { BuildingDefinition } from '../types';

/**
 * UI-only metadata lives beside each building recipe so BuildingsView stays data-driven.
 * Adding a new building normally requires editing ONLY this file.
 */
export type BuildingPreviewDefinition =
  | {
      type: 'atlas';
      atlasId: string;
      cell: number;
    }
  | {
      type: 'image';
      src: string;
      objectPosition?: string;
    };

export interface BuildingRecipeUiMeta {
  /** Smaller values appear first. Defaults to 9999. */
  sortOrder?: number;
  /** Search/filter keywords that do not need to be visible in the card. */
  tags?: string[];
  /** Hide a recipe from the build browser without deleting gameplay data. */
  hidden?: boolean;
  /** Optional preview art. No preview = category icon fallback. */
  preview?: BuildingPreviewDefinition;
}

export type BuildingRecipeDefinition = BuildingDefinition & {
  ui?: BuildingRecipeUiMeta;
};

export interface BuildingPreviewAtlas {
  src: string;
  sheetWidth: number;
  sheetHeight: number;
  cells: Array<{ x: number; y: number; w: number; h: number }>;
}

/** Shared atlases. Add another atlas here only when you actually need one. */
export const BUILDING_PREVIEW_ATLASES: Record<string, BuildingPreviewAtlas> = {
  BUILDING_CARDS_01: {
    src: '/ui/buildings/building-cards.png',
    sheetWidth: 887,
    sheetHeight: 1774,
    cells: [
      { x: 0, y: 0, w: 442, h: 884 },
      { x: 445, y: 0, w: 442, h: 884 },
      { x: 0, y: 888, w: 442, h: 886 },
      { x: 445, y: 888, w: 442, h: 886 },
    ],
  },
};

/**
 * Friendly labels for the category filter. Unknown/new categories still work and
 * automatically fall back to a title-cased version of their category id.
 */
export const BUILDING_CATEGORY_LABELS: Record<string, string> = {
  food: 'Nấu nướng',
  shelter: 'Nơi trú',
  storage: 'Kho chứa',
  water: 'Nước',
  production: 'Sản xuất',
  agriculture: 'Nông nghiệp',
  animal: 'Chăn nuôi',
  infrastructure: 'Hạ tầng',
};

export const BUILDINGS_DATABASE: Record<string, BuildingRecipeDefinition> = {
  BUILDING_CAMPFIRE_HEARTH: {
    id: 'BUILDING_CAMPFIRE_HEARTH',
    name: 'Lửa trại thô sơ',
    description:
      'Một đống củi được xếp trực tiếp trên nền đất với vật liệu bắt lửa ở giữa. Cấu trúc đơn giản, dễ dựng và phù hợp cho những ngày đầu sinh tồn.',
    category: 'food',
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 6 },
      { itemId: 'ITEM_COCONUT_HUSK', quantity: 2 },
    ],
    buildTimeSeconds: 20,
    benefitsDescription:
      'Cho phép nấu thức ăn, đun sôi nước và cung cấp ánh sáng cùng hơi ấm vào ban đêm.',
    ui: {
      sortOrder: 10,
      tags: [
        'lửa',
        'lửa trại',
        'nấu ăn',
        'đun nước',
        'sưởi ấm',
        'đầu game',
        'fire',
        'cooking',
        'boil water',
        'warmth',
      ],
      preview: { type: 'atlas', atlasId: 'BUILDING_CARDS_01', cell: 0 },
    },
  },

  BUILDING_LEAF_SHELTER: {
    id: 'BUILDING_LEAF_SHELTER',
    name: 'Lều lá đơn giản',
    description:
      'Khung cành cây buộc dây và phủ nhiều lớp lá cọ, tạo thành một chỗ trú thấp sát mặt đất. Đủ để che nắng và tránh những cơn mưa thông thường.',
    category: 'shelter',
    cost: [
      { itemId: 'ITEM_PALM_LEAF', quantity: 10 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 5 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 3 },
    ],
    buildTimeSeconds: 30,
    benefitsDescription:
      'Tạo chỗ nghỉ có mái che, giúp hồi phục mệt mỏi nhanh hơn và giảm ảnh hưởng của mưa khi nghỉ tại trại.',
    ui: {
      sortOrder: 20,
      tags: [
        'lều',
        'nơi trú',
        'ngủ',
        'nghỉ',
        'mưa',
        'lá cọ',
        'shelter',
        'sleep',
        'rest',
        'rain',
      ],
      preview: { type: 'atlas', atlasId: 'BUILDING_CARDS_01', cell: 1 },
    },
  },

  BUILDING_WOVEN_BASKET_RACK: {
    id: 'BUILDING_WOVEN_BASKET_RACK',
    name: 'Kệ chứa đồ có mái lá',
    description:
      'Một kệ tre nhiều tầng được buộc chắc bằng dây, phía trên phủ mái lá để che mưa. Giúp dụng cụ, lương thực khô và vật tư không phải đặt trực tiếp trên nền đất ẩm.',
    category: 'storage',
    cost: [
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 8 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 6 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 4 },
    ],
    buildTimeSeconds: 30,
    benefitsDescription:
      'Tăng sức chứa kho của trại thêm +30 kg và +50 L, đồng thời giúp vật tư tránh mưa trực tiếp và độ ẩm từ mặt đất.',
    maxCapacityIncrease: {
      weightKg: 30,
      volumeL: 50,
    },
    ui: {
      sortOrder: 30,
      tags: [
        'kệ',
        'kệ chứa đồ',
        'kho',
        'lưu trữ',
        'tre',
        'mái lá',
        'storage',
        'inventory',
        'capacity',
        'bamboo',
      ],
      preview: { type: 'atlas', atlasId: 'BUILDING_CARDS_01', cell: 2 },
    },
  },

  BUILDING_RAIN_COLLECTOR: {
    id: 'BUILDING_RAIN_COLLECTOR',
    name: 'Máng hứng nước mưa bằng lá',
    description:
      'Khung tre nghiêng phủ lá cọ bản rộng để gom nước mưa về một mép thấp. Nước chảy thành dòng và có thể được hứng vào vật chứa đặt phía dưới.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_PALM_LEAF', quantity: 8 },
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 3 },
    ],
    buildTimeSeconds: 35,
    benefitsDescription:
      'Tự động thu gom nước khi trời mưa, tạo nguồn nước mưa tương đối sạch để dự trữ tại trại.',
    ui: {
      sortOrder: 40,
      tags: [
        'nước',
        'nước mưa',
        'hứng nước',
        'máng nước',
        'lá cọ',
        'water',
        'rain',
        'rainwater',
        'collector',
      ],
      preview: { type: 'atlas', atlasId: 'BUILDING_CARDS_01', cell: 3 },
    },
  },

  BUILDING_CARPENTER_BENCH: {
    id: 'BUILDING_CARPENTER_BENCH',
    name: 'Bàn chế tác bằng gỗ',
    description:
      'Một bàn làm việc thô sơ ghép từ cành gỗ và tre, tạo mặt phẳng ổn định để cắt, buộc, mài và lắp ráp các dụng cụ đơn giản.',
    category: 'production',
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 8 },
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 4 },
    ],
    buildTimeSeconds: 40,
    benefitsDescription:
      'Tăng tốc chế tạo dụng cụ và xử lý linh kiện tại trại thêm 30%.',
    ui: {
      sortOrder: 50,
      tags: [
        'bàn chế tác',
        'chế tạo',
        'dụng cụ',
        'gia công gỗ',
        'production',
        'crafting',
        'tools',
        'woodworking',
        'workbench',
      ],
      // No preview yet: BuildingsView automatically falls back to the category icon.
    },
  },
};

/** Canonical browser order. Hidden recipes stay valid gameplay data but are omitted from UI. */
export const getBuildingRecipes = (): BuildingRecipeDefinition[] =>
  Object.values(BUILDINGS_DATABASE)
    .filter((recipe) => recipe.ui?.hidden !== true)
    .sort((a, b) => {
      const orderA = a.ui?.sortOrder ?? 9999;
      const orderB = b.ui?.sortOrder ?? 9999;
      return orderA - orderB || a.name.localeCompare(b.name);
    });

/** Categories are discovered from the data, so new categories automatically appear in filters. */
export const getBuildingCategories = (): string[] =>
  Array.from(new Set(getBuildingRecipes().map((recipe) => String(recipe.category)))).sort((a, b) =>
    (BUILDING_CATEGORY_LABELS[a] ?? a).localeCompare(BUILDING_CATEGORY_LABELS[b] ?? b),
  );
