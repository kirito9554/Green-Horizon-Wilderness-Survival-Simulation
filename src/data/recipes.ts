import { RecipeDefinition } from '../types';

export const RECIPES_DATABASE: Record<string, RecipeDefinition> = {
  // =========================================================================
  // 1. SƠ CHẾ & TINH LUYỆN (PROCESSING / REFINING)
  // Biến đổi đơn tầng, trích xuất vật liệu, sơ chế nhanh, không cần nghiên cứu
  // =========================================================================
  RECIPE_CRACK_COCONUT: {
    id: 'RECIPE_CRACK_COCONUT',
    name: 'Bóc vỏ & Bổ dừa tươi',
    description: 'Dùng cạnh đá hoặc đá cuội đập nứt lớp vỏ xơ để lấy nước ngọt và gáo dừa.',
    type: 'processing',
    category: 'processing',
    craftTimeSeconds: 4,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_WILD_COCONUT', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_OPEN_COCONUT', quantity: 1 },
      { itemId: 'ITEM_COCONUT_HUSK', quantity: 1 },
    ],
  },
  RECIPE_SCRAPE_COCONUT_MEAT: {
    id: 'RECIPE_SCRAPE_COCONUT_MEAT',
    name: 'Nạo cùi cơm dừa',
    description: 'Nạo sạch phần cơm dừa giàu calo, thu được 2 chiếc gáo dừa khô sạch sẽ làm chén chứa.',
    type: 'processing',
    category: 'food',
    craftTimeSeconds: 6,
    unlockedByDefault: true,
    requiredToolTag: 'sharp',
    ingredients: [
      { itemId: 'ITEM_OPEN_COCONUT', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_COCONUT_MEAT', quantity: 1 },
      { itemId: 'ITEM_COCONUT_BOWL', quantity: 2 },
    ],
  },
  RECIPE_CHARCOAL_SHELLS: {
    id: 'RECIPE_CHARCOAL_SHELLS',
    name: 'Đốt than gáo dừa',
    description: 'Ủ yếm khí gáo dừa dưới tro than hồng để tạo ra than củi tinh khiết.',
    type: 'processing',
    category: 'materials',
    craftTimeSeconds: 15,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_COCONUT_BOWL', quantity: 2 },
      { itemId: 'ITEM_COCONUT_HUSK', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_COCONUT_CHARCOAL', quantity: 2 },
    ],
  },
  RECIPE_FLAKE_SHARP_STONE: {
    id: 'RECIPE_FLAKE_SHARP_STONE',
    name: 'Ghè đẽo đá cuội sắc',
    description: 'Đập hai viên đá cuội bờ suối vào nhau theo góc nghiêng để tách ra mảnh đá có cạnh sắc như dao.',
    type: 'processing',
    category: 'materials',
    craftTimeSeconds: 5,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 2 },
    ],
    outputs: [
      { itemId: 'ITEM_SHARP_STONE', quantity: 1 },
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 1 }, // bảo toàn đá ghè
    ],
  },
  RECIPE_SHAPE_AXE_HEAD: {
    id: 'RECIPE_SHAPE_AXE_HEAD',
    name: 'Đẽo gọt lưỡi rìu đá bazan',
    description: 'Dùng đá sắc đẽo gọt ngàm cố định trên đá cuội cứng để làm đầu rìu.',
    type: 'processing',
    category: 'materials',
    craftTimeSeconds: 12,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_RIVER_PEBBLE', quantity: 2 },
      { itemId: 'ITEM_SHARP_STONE', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_SHAPED_AXE_HEAD', quantity: 1 },
    ],
  },
  RECIPE_CARVE_HANDLE: {
    id: 'RECIPE_CARVE_HANDLE',
    name: 'Gọt đẽo cán gỗ công cụ',
    description: 'Tước vỏ cành gỗ dạt bờ biển, gọt nhẵn và khắc khấc tra cán công cụ.',
    type: 'processing',
    category: 'materials',
    craftTimeSeconds: 8,
    unlockedByDefault: true,
    requiredToolTag: 'sharp',
    ingredients: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_WOODEN_HANDLE', quantity: 1 },
    ],
  },
  RECIPE_SPLIT_BAMBOO: {
    id: 'RECIPE_SPLIT_BAMBOO',
    name: 'Chẻ nan & thanh tre dẻo',
    description: 'Bổ dọc thân tre thành những thanh nan tre dẻo dai phục vụ đan lát và dựng khung.',
    type: 'processing',
    category: 'materials',
    craftTimeSeconds: 6,
    unlockedByDefault: true,
    requiredToolTag: 'sharp',
    ingredients: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_BAMBOO_SPLIT', quantity: 3 },
    ],
  },
  RECIPE_BOIL_WATER: {
    id: 'RECIPE_BOIL_WATER',
    name: 'Đun sôi khử trùng nước suối',
    description: 'Đun sôi nước trong gáo dừa trên than lửa trại để diệt sạch mầm bệnh.',
    type: 'processing',
    category: 'water',
    craftTimeSeconds: 8,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_DIRTY_WATER_BOWL', quantity: 1 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 }, // củi đun
    ],
    outputs: [
      { itemId: 'ITEM_BOILED_WATER_BOWL', quantity: 1 },
    ],
  },
  RECIPE_FILL_CANTEEN: {
    id: 'RECIPE_FILL_CANTEEN',
    name: 'Rót nước sạch vào bình tông tre',
    description: 'Chắt nước sạch đã đun sôi vào bình tông tre để mang theo khi thám hiểm xa.',
    type: 'processing',
    category: 'water',
    craftTimeSeconds: 4,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_BAMBOO_CANTEEN_EMPTY', quantity: 1 },
      { itemId: 'ITEM_BOILED_WATER_BOWL', quantity: 2 },
    ],
    outputs: [
      { itemId: 'ITEM_BAMBOO_CANTEEN_FULL', quantity: 1 },
      { itemId: 'ITEM_COCONUT_BOWL', quantity: 2 },
    ],
  },
  RECIPE_GUT_FISH: {
    id: 'RECIPE_GUT_FISH',
    name: 'Mổ & làm sạch cá suối',
    description: 'Dùng đá sắc cạo vảy, mổ ruột và lọc lấy phi lê thịt cá cùng xương cá nhọn.',
    type: 'processing',
    category: 'food',
    craftTimeSeconds: 6,
    unlockedByDefault: true,
    requiredToolTag: 'sharp',
    ingredients: [
      { itemId: 'ITEM_RIVER_FISH_RAW', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_FISH_FILLET_RAW', quantity: 2 },
      { itemId: 'ITEM_FISH_BONES', quantity: 1 },
    ],
  },
  RECIPE_GRILL_FISH: {
    id: 'RECIPE_GRILL_FISH',
    name: 'Nướng cá trên đá nóng lửa trại',
    description: 'Nướng phi lê cá tươi trên phiến đá lửa trại thơm lừng, dễ tiêu hóa.',
    type: 'processing',
    category: 'food',
    craftTimeSeconds: 9,
    unlockedByDefault: true,
    ingredients: [
      { itemId: 'ITEM_FISH_FILLET_RAW', quantity: 1 },
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_GRILLED_FISH_FILLET', quantity: 1 },
    ],
  },

  // =========================================================================
  // 2. CHẾ TẠO & LẮP RÁP (CRAFTING / ASSEMBLY)
  // Kết hợp đa thành phần, chuyển đổi cấu trúc, cần nghiên cứu mở khóa bản vẽ
  // =========================================================================
  RECIPE_BRAID_CORD: {
    id: 'RECIPE_BRAID_CORD',
    name: 'Bện dây thừng xơ thực vật',
    description: 'Xoắn bện sợi dây leo và xơ lá cọ khô tạo thành sợi dây chịu lực cao.',
    type: 'crafting',
    category: 'materials',
    craftTimeSeconds: 6,
    researchTimeSeconds: 15,
    unlockedByDefault: true, // Mở sẵn để thợ có dây bện cơ bản ngay từ đầu
    ingredients: [
      { itemId: 'ITEM_VINE_FIBER', quantity: 2 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_CORD_ROPE', quantity: 1 },
    ],
  },
  RECIPE_ASSEMBLE_STONE_KNIFE: {
    id: 'RECIPE_ASSEMBLE_STONE_KNIFE',
    name: 'Chế tác dao đá tiện ích quấn cán',
    description: 'Cố định lưỡi đá sắc với đệm xơ cọ và quấn dây bảo vệ tay cầm, tăng lực cắt.',
    type: 'crafting',
    category: 'tools',
    craftTimeSeconds: 8,
    researchTimeSeconds: 20,
    ingredients: [
      { itemId: 'ITEM_SHARP_STONE', quantity: 1 },
      { itemId: 'ITEM_VINE_FIBER', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_PRIMITIVE_STONE_KNIFE', quantity: 1 },
    ],
  },
  RECIPE_ASSEMBLE_STONE_AXE: {
    id: 'RECIPE_ASSEMBLE_STONE_AXE',
    name: 'Lắp ráp rìu đá buộc cán hoàn chỉnh',
    description: 'Ghép đầu rìu đá bazan vào rãnh cán gỗ đã khắc khấc, chằng chặt bằng dây thừng bện xoắn.',
    type: 'crafting',
    category: 'tools',
    craftTimeSeconds: 14,
    researchTimeSeconds: 35,
    ingredients: [
      { itemId: 'ITEM_SHAPED_AXE_HEAD', quantity: 1 },
      { itemId: 'ITEM_WOODEN_HANDLE', quantity: 1 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_PRIMITIVE_STONE_AXE', quantity: 1 },
    ],
  },
  RECIPE_CRAFT_FIRE_STARTER: {
    id: 'RECIPE_CRAFT_FIRE_STARTER',
    name: 'Chế tạo bộ khoan ma sát tạo lửa',
    description: 'Tạo rãnh đánh lửa trên thanh gỗ dạt bờ khô và bùi nhùi xơ dừa chống ẩm.',
    type: 'crafting',
    category: 'tools',
    craftTimeSeconds: 10,
    researchTimeSeconds: 25,
    requiredToolTag: 'sharp',
    ingredients: [
      { itemId: 'ITEM_DRIFTWOOD_BRANCH', quantity: 1 },
      { itemId: 'ITEM_COCONUT_HUSK', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_FIRE_STARTER', quantity: 1 },
    ],
  },
  RECIPE_CRAFT_BAMBOO_CANTEEN: {
    id: 'RECIPE_CRAFT_BAMBOO_CANTEEN',
    name: 'Chế tạo bình tông ống tre có quai',
    description: 'Khoét rỗng đốt tre bánh tẻ, tạo nút đậy kín nước và bện dây quai đeo vai.',
    type: 'crafting',
    category: 'tools',
    craftTimeSeconds: 9,
    researchTimeSeconds: 25,
    requiredToolTag: 'sharp',
    ingredients: [
      { itemId: 'ITEM_BAMBOO_STALK', quantity: 1 },
      { itemId: 'ITEM_CORD_ROPE', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_BAMBOO_CANTEEN_EMPTY', quantity: 1 },
    ],
  },
  RECIPE_CRAFT_HERBAL_POULTICE: {
    id: 'RECIPE_CRAFT_HERBAL_POULTICE',
    name: 'Điều chế cao thuốc lá đắp vết thương',
    description: 'Giã nát lá gừng dại thảo dược với nước sôi, bọc trong lớp lá cọ vô trùng để cầm máu và ngừa nhiễm trùng.',
    type: 'crafting',
    category: 'medicine',
    craftTimeSeconds: 7,
    researchTimeSeconds: 30,
    ingredients: [
      { itemId: 'ITEM_MEDICINAL_HERB_LEAF', quantity: 2 },
      { itemId: 'ITEM_BOILED_WATER_BOWL', quantity: 1 },
      { itemId: 'ITEM_PALM_LEAF', quantity: 1 },
    ],
    outputs: [
      { itemId: 'ITEM_HERBAL_POULTICE', quantity: 1 },
      { itemId: 'ITEM_COCONUT_BOWL', quantity: 1 }, // hoàn trả gáo dừa
    ],
  },
};
