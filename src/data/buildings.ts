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
      tags: ['lửa', 'lửa trại', 'nấu ăn', 'đun nước', 'sưởi ấm', 'đầu game', 'fire', 'cooking', 'boil water', 'warmth'],
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
      tags: ['lều', 'nơi trú', 'ngủ', 'nghỉ', 'mưa', 'lá cọ', 'shelter', 'sleep', 'rest', 'rain'],
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
      'Kho thông thoáng cho vật tư nhẹ, tăng +30 kg / +50 L dung lượng vật lý.',
    maxCapacityIncrease: { weightKg: 30, volumeL: 50 },
    ui: {
      sortOrder: 30,
      tags: ['kệ', 'kho', 'lưu trữ', 'tre', 'mái lá', 'storage', 'inventory', 'capacity', 'bamboo'],
      preview: { type: 'atlas', atlasId: 'BUILDING_CARDS_01', cell: 2 },
    },
  },

  BUILDING_BAMBOO_SUPPLY_CRATE: {
    id: 'BUILDING_BAMBOO_SUPPLY_CRATE',
    name: 'Thùng vật tư tre đan kín',
    description:
      'Thùng tre chẻ đan dày có nắp buộc, được kê khỏi mặt đất. Phù hợp cho nguyên liệu, linh kiện và đồ nghề nhỏ cần tránh mưa trực tiếp.',
    category: 'storage',
    cost: [
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 10 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 4 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 2 },
    ],
    buildTimeSeconds: 34,
    benefitsDescription: 'Kho đa dụng kín hơn rack, tăng +35 kg / +55 L và bảo vệ tốt hơn khỏi ẩm, bẩn và sinh vật nhỏ.',
    maxCapacityIncrease: { weightKg: 35, volumeL: 55 },
    ui: { sortOrder: 31, tags: ['crate', 'storage', 'materials', 'tools', 'thùng', 'kho', 'vật tư', 'tre'] },
  },

  BUILDING_BULK_MATERIAL_RACK: {
    id: 'BUILDING_BULK_MATERIAL_RACK',
    name: 'Giá vật liệu dài & cồng kềnh',
    description:
      'Khung tre dài có chặn ngang dùng để xếp gỗ, cọc, thân tre và vật liệu cồng kềnh. Không phù hợp cho đồ nhỏ nhưng tận dụng không gian rất tốt.',
    category: 'storage',
    cost: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 6 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 3 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 3 },
    ],
    buildTimeSeconds: 30,
    benefitsDescription: 'Chứa vật liệu dài/bulk hiệu quả: +90 kg / +80 L với khả năng tiếp cận cao.',
    maxCapacityIncrease: { weightKg: 90, volumeL: 80 },
    ui: { sortOrder: 32, tags: ['bulk', 'logs', 'bamboo', 'storage', 'rack', 'gỗ', 'tre', 'vật liệu dài'] },
  },

  BUILDING_MEDICINE_STORAGE_CHEST: {
    id: 'BUILDING_MEDICINE_STORAGE_CHEST',
    name: 'Hòm thuốc tre lót lá khô',
    description:
      'Hòm nhỏ đan dày, kê cao và có lớp lót khô để tách thuốc, băng gạc và dược liệu khỏi bụi bẩn cùng hơi ẩm của nền đất.',
    category: 'storage',
    cost: [
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 8 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 3 },
    ],
    buildTimeSeconds: 32,
    benefitsDescription: 'Kho chuyên dụng nhỏ +15 kg / +25 L, ưu tiên thuốc với bảo vệ ẩm và nhiễm bẩn cao.',
    maxCapacityIncrease: { weightKg: 15, volumeL: 25 },
    ui: { sortOrder: 33, tags: ['medicine', 'herbs', 'storage', 'medical', 'thuốc', 'thảo dược', 'hòm'] },
  },

  BUILDING_BAMBOO_WATER_TANK: {
    id: 'BUILDING_BAMBOO_WATER_TANK',
    name: 'Bồn nước tre ghép kín',
    description:
      'Cụm ống tre lớn ghép sát, buộc đai và che nắp lá. Dùng riêng cho vật chứa nước và nước dự trữ, tránh trộn với vật tư khô.',
    category: 'storage',
    cost: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 8 },
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 6 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 5 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 4 },
    ],
    buildTimeSeconds: 42,
    benefitsDescription: 'Kho nước chuyên dụng +70 kg / +70 L, chỉ nhận dạng liquid/water và giảm nguy cơ nhiễm bẩn.',
    maxCapacityIncrease: { weightKg: 70, volumeL: 70 },
    ui: { sortOrder: 34, tags: ['water', 'liquid', 'storage', 'tank', 'nước', 'bồn', 'tre'] },
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
      tags: ['nước', 'nước mưa', 'hứng nước', 'máng nước', 'lá cọ', 'water', 'rain', 'rainwater', 'collector'],
      preview: { type: 'atlas', atlasId: 'BUILDING_CARDS_01', cell: 3 },
    },
  },

  BUILDING_IRRIGATION_DITCH: {
    id: 'BUILDING_IRRIGATION_DITCH',
    name: 'Mương tưới thô sơ',
    description: 'Mương nông đào theo độ dốc tự nhiên, dùng cọc và đá đánh dấu bờ để dẫn nước từ nguồn thấp áp tới khu canh tác.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 3 },
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 1 },
    ],
    buildTimeSeconds: 38,
    benefitsDescription: 'Dẫn nước bằng trọng lực đến các ô đất canh tác. Dễ làm nhưng thất thoát và dễ bồi lấp.',
    ui: { sortOrder: 41, tags: ['irrigation', 'ditch', 'water', 'mương tưới', 'thủy lợi', 'farming'] },
  },

  BUILDING_DRAINAGE_DITCH: {
    id: 'BUILDING_DRAINAGE_DITCH',
    name: 'Mương thoát nước',
    description: 'Rãnh thoát thấp kéo nước thừa khỏi đất bão hòa và dẫn xuống điểm thấp hoặc nguồn nhận nước thích hợp.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 2 },
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 5 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 1 },
    ],
    buildTimeSeconds: 36,
    benefitsDescription: 'Giảm úng cục bộ bằng cách chuyển nước thật khỏi khu đất sang điểm xả thấp hơn.',
    ui: { sortOrder: 42, tags: ['drainage', 'ditch', 'waterlogging', 'mương thoát', 'thoát nước', 'farming'] },
  },

  BUILDING_BAMBOO_WATER_CHANNEL: {
    id: 'BUILDING_BAMBOO_WATER_CHANNEL',
    name: 'Máng dẫn nước bằng tre',
    description: 'Các thân tre bổ và ghép nối thành máng dẫn hẹp, giảm thất thoát so với mương đất nhưng vẫn phụ thuộc hoàn toàn vào chênh cao.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 6 },
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 3 },
    ],
    buildTimeSeconds: 44,
    benefitsDescription: 'Chuyển nước bằng trọng lực với thất thoát thấp hơn mương đất; hư hỏng làm tăng rò rỉ.',
    ui: { sortOrder: 43, tags: ['bamboo', 'channel', 'aqueduct', 'water', 'máng tre', 'dẫn nước'] },
  },

  BUILDING_SMALL_DIVERSION_WEIR: {
    id: 'BUILDING_SMALL_DIVERSION_WEIR',
    name: 'Đập dâng chuyển dòng nhỏ',
    description: 'Hàng cọc tre và đá ghép ngang dòng nước nhỏ để nâng mực nước và lấy một phần lưu lượng sang mạng dẫn nước.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 5 },
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 10 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 4 },
    ],
    buildTimeSeconds: 55,
    benefitsDescription: 'Cho phép chuyển một phần lưu lượng thực của suối; phần lấy đi sẽ không còn ở hạ lưu.',
    ui: { sortOrder: 44, tags: ['weir', 'diversion', 'stream', 'water', 'đập dâng', 'chuyển dòng'] },
  },

  BUILDING_EARTHEN_POND: {
    id: 'BUILDING_EARTHEN_POND',
    name: 'Ao đất chứa nước',
    description: 'Hố trữ nước nông được đào ở địa hình thấp, gia cố mép bằng đá và cọc đánh dấu. Ao mới hoàn thành hoàn toàn có thể khô.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 6 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 4 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 2 },
    ],
    buildTimeSeconds: 70,
    benefitsDescription: 'Tạo thể tích trữ nước vật lý; phải được mưa, runoff hoặc mạng dẫn nước nạp vào trước khi sử dụng.',
    ui: { sortOrder: 45, tags: ['pond', 'reservoir', 'storage', 'water', 'ao đất', 'hồ chứa'] },
  },

  BUILDING_SIMPLE_SLUICE: {
    id: 'BUILDING_SIMPLE_SLUICE',
    name: 'Cửa điều tiết tre',
    description: 'Khung tre có tấm chắn đơn giản đặt trên mương hoặc nhánh dẫn, dùng để giới hạn và phân phối lưu lượng qua mạng thủy lợi.',
    category: 'water',
    cost: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 4 },
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 6 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 3 },
    ],
    buildTimeSeconds: 46,
    benefitsDescription: 'Điều tiết lưu lượng thực trong mạng nước; không tạo thêm nước và mất tác dụng khi không còn chênh cao.',
    ui: { sortOrder: 46, tags: ['sluice', 'gate', 'water', 'flow control', 'cửa nước', 'điều tiết'] },
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
      tags: ['bàn chế tác', 'chế tạo', 'dụng cụ', 'gia công gỗ', 'production', 'crafting', 'tools', 'woodworking', 'workbench'],
    },
  },
};

export const getBuildingRecipes = (): BuildingRecipeDefinition[] =>
  Object.values(BUILDINGS_DATABASE)
    .filter((recipe) => recipe.ui?.hidden !== true)
    .sort((a, b) => {
      const orderA = a.ui?.sortOrder ?? 9999;
      const orderB = b.ui?.sortOrder ?? 9999;
      return orderA - orderB || a.name.localeCompare(b.name);
    });

export const getBuildingCategories = (): string[] =>
  Array.from(new Set(getBuildingRecipes().map((recipe) => String(recipe.category)))).sort((a, b) =>
    (BUILDING_CATEGORY_LABELS[a] ?? a).localeCompare(BUILDING_CATEGORY_LABELS[b] ?? b),
  );
