export interface RawMaterialIconEntry {
  index: number;
  name: string;
  slug: string;
  filename: string;
  row: number;
  col: number;
  path: string;
}

import rawMapData from './rawMaterialsMap.json';

export const RAW_MATERIALS_MAP: RawMaterialIconEntry[] = rawMapData;

// Quick lookup by exact slug
export const RAW_MATERIALS_BY_SLUG: Record<string, RawMaterialIconEntry> = {};
RAW_MATERIALS_MAP.forEach((item) => {
  RAW_MATERIALS_BY_SLUG[item.slug] = item;
});

/**
 * Danh sách ánh xạ 1:1 chuẩn xác CHỈ dành cho 82 nguyên liệu thô thực sự từ iconset.
 * Tuyệt đối không gán ép cho các item thành phẩm, công cụ tra cán, thức ăn, nước uống, thuốc men chưa có icon riêng.
 */
export const EXACT_RAW_MATERIALS_ICON_PATH: Record<string, string> = {
  ITEM_TWIG: '/iconsets/raw-materials/test_twig.png',
  ITEM_DRY_TWIG: '/iconsets/raw-materials/dry_twig.png',
  ITEM_BRANCH: '/iconsets/raw-materials/branch.png',
  ITEM_THICK_BRANCH: '/iconsets/raw-materials/branch.png',
  ITEM_SHORT_WOOD_POLE: '/iconsets/raw-materials/driftwood.png',
  ITEM_LONG_WOOD_POLE: '/iconsets/raw-materials/driftwood.png',
  ITEM_SMALL_LOG: '/iconsets/raw-materials/driftwood.png',
  ITEM_LOG: '/iconsets/raw-materials/driftwood.png',
  ITEM_HARDWOOD_LOG: '/iconsets/raw-materials/driftwood.png',
  ITEM_DRIFTWOOD: '/iconsets/raw-materials/driftwood.png',
  ITEM_BAMBOO_SHOOT: '/iconsets/raw-materials/bamboo_shoot.png',
  ITEM_BAMBOO_POLE: '/iconsets/raw-materials/bamboo_pole.png',
  ITEM_THICK_BAMBOO_POLE: '/iconsets/raw-materials/bamboo_pole.png',
  ITEM_SPLIT_BAMBOO: '/iconsets/raw-materials/bamboo_strip.png',
  ITEM_BAMBOO_STRIP: '/iconsets/raw-materials/bamboo_strip.png',
  ITEM_TREE_BARK: '/iconsets/raw-materials/bark_strip.png',
  ITEM_BARK_STRIP: '/iconsets/raw-materials/bark_strip.png',
  ITEM_PALM_LEAF: '/iconsets/raw-materials/broad_leaf.png',
  ITEM_LARGE_PALM_LEAF: '/iconsets/raw-materials/broad_leaf.png',
  ITEM_BROAD_LEAF: '/iconsets/raw-materials/broad_leaf.png',
  ITEM_DRY_LEAVES: '/iconsets/raw-materials/dry_leaves.png',
  ITEM_GRASS_BUNDLE: '/iconsets/raw-materials/grass_bundle.png',
  ITEM_DRY_GRASS: '/iconsets/raw-materials/dry_grass.png',
  ITEM_VINE: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_LONG_VINE: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_PLANT_FIBER: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_PALM_FIBER: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_BARK_FIBER: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_COCONUT_HUSK: '/iconsets/raw-materials/coconut_husk.png',
  ITEM_COCONUT_SHELL: '/iconsets/raw-materials/coconut_shell.png',
  ITEM_RESIN: '/iconsets/raw-materials/clay.png',
  ITEM_TREE_SAP: '/iconsets/raw-materials/clay.png',
  ITEM_PEBBLE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_SMALL_STONE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_STONE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_LARGE_STONE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_FLAT_STONE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_SHARP_STONE: '/iconsets/raw-materials/bone_shard.png',
  ITEM_STONE_FLAKE: '/iconsets/raw-materials/bone_shard.png',
  ITEM_STONE_BLADE: '/iconsets/raw-materials/bone_shard.png',
  ITEM_STONE_AXE_HEAD: '/iconsets/raw-materials/flat_stone.png',
  ITEM_STONE_HAMMER_HEAD: '/iconsets/raw-materials/flat_stone.png',
  ITEM_SAND: '/iconsets/raw-materials/ash.png',
  ITEM_WET_SAND: '/iconsets/raw-materials/ash.png',
  ITEM_CLAY: '/iconsets/raw-materials/clay.png',
  ITEM_WET_CLAY: '/iconsets/raw-materials/clay.png',
  ITEM_CHARCOAL: '/iconsets/raw-materials/charcoal.png',
  ITEM_ASH: '/iconsets/raw-materials/ash.png',
  ITEM_SMALL_BONE: '/iconsets/raw-materials/bone.png',
  ITEM_BONE: '/iconsets/raw-materials/bone.png',
  ITEM_LARGE_BONE: '/iconsets/raw-materials/bone.png',
  ITEM_BONE_SHARD: '/iconsets/raw-materials/bone_shard.png',
  ITEM_ANIMAL_HIDE: '/iconsets/raw-materials/animal_hide.png',
  ITEM_RAW_HIDE: '/iconsets/raw-materials/animal_hide.png',
  ITEM_TENDON: '/iconsets/raw-materials/feather.png',
  ITEM_SINEW: '/iconsets/raw-materials/feather.png',
  ITEM_FEATHER: '/iconsets/raw-materials/feather.png',
  ITEM_SHELL: '/iconsets/raw-materials/fish_bone.png',
  ITEM_LARGE_SHELL: '/iconsets/raw-materials/fish_bone.png',
  ITEM_FISH_BONE: '/iconsets/raw-materials/fish_bone.png',
  ITEM_FISH_GUTS: '/iconsets/raw-materials/fish_guts.png',
  ITEM_ANIMAL_FAT: '/iconsets/raw-materials/animal_fat.png',
  ITEM_ANIMAL_GUTS: '/iconsets/raw-materials/animal_guts.png',
  ITEM_MANURE: '/iconsets/raw-materials/dry_tinder.png',
  ITEM_PLANT_CORD: '/iconsets/raw-materials/fiber_rope.png',
  ITEM_FIBER_ROPE: '/iconsets/raw-materials/fiber_rope.png',
  ITEM_VINE_ROPE: '/iconsets/raw-materials/bark_rope.png',
  ITEM_BARK_ROPE: '/iconsets/raw-materials/bark_rope.png',
  ITEM_BAMBOO_ROPE: '/iconsets/raw-materials/bamboo_rope.png',
  ITEM_WOODEN_STAKE: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_SHARPENED_STICK: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_WOODEN_HANDLE: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_SHORT_HANDLE: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_LONG_HANDLE: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_BAMBOO_HANDLE: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_WOODEN_PLANK: '/iconsets/raw-materials/driftwood.png',
  ITEM_WOODEN_PEG: '/iconsets/raw-materials/test_twig.png',
  ITEM_BONE_NEEDLE: '/iconsets/raw-materials/bone_needle.png',
  ITEM_BONE_HOOK: '/iconsets/raw-materials/bone_hook.png',
  ITEM_FISH_HOOK: '/iconsets/raw-materials/fish_hook.png',
  ITEM_TINDER_BUNDLE: '/iconsets/raw-materials/dry_tinder.png',
  ITEM_DRY_TINDER: '/iconsets/raw-materials/dry_tinder.png',
  ITEM_DRIFTWOOD_BRANCH: '/iconsets/raw-materials/driftwood.png',
  ITEM_BAMBOO_STALK: '/iconsets/raw-materials/bamboo_pole.png',
  ITEM_BAMBOO_SPLIT: '/iconsets/raw-materials/bamboo_strip.png',
  ITEM_VINE_FIBER: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_CORD_ROPE: '/iconsets/raw-materials/fiber_rope.png',
  ITEM_RIVER_PEBBLE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_SHAPED_AXE_HEAD: '/iconsets/raw-materials/flat_stone.png',
  ITEM_CLAY_LUMP: '/iconsets/raw-materials/clay.png',
  ITEM_RAW_CLAY: '/iconsets/raw-materials/clay.png',
  ITEM_COCONUT_CHARCOAL: '/iconsets/raw-materials/charcoal.png',
  ITEM_COCONUT_BOWL: '/iconsets/raw-materials/coconut_shell.png',
  ITEM_FISH_BONES: '/iconsets/raw-materials/fish_bone.png',
};

// Export backward compatibility alias
export const ITEM_ID_TO_ICON_PATH = EXACT_RAW_MATERIALS_ICON_PATH;

/**
 * Trả về đường dẫn ảnh icon PNG CHỈ KHI có tên/ID khớp chính xác 1:1 với 82 nguyên liệu thô.
 * Nếu là vật phẩm chế tạo/thực phẩm/nước/công cụ chưa có icon phù hợp, hàm sẽ trả về `null`
 * để hệ thống hiển thị placeholder tiêu chuẩn, tránh gán bừa icon sai lệch bản chất.
 */
export function getItemIconPath(itemIdOrSlug?: string): string | null {
  if (!itemIdOrSlug) return null;

  // 1. Kiểm tra khớp chính xác ID trong từ điển nguyên liệu thô
  if (EXACT_RAW_MATERIALS_ICON_PATH[itemIdOrSlug]) {
    return EXACT_RAW_MATERIALS_ICON_PATH[itemIdOrSlug];
  }

  // 2. Kiểm tra khớp chính xác theo slug (ví dụ 'bone_hook', 'hardwood_log')
  const slug = itemIdOrSlug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (RAW_MATERIALS_BY_SLUG[slug]) {
    return RAW_MATERIALS_BY_SLUG[slug].path;
  }

  // 3. Nếu có tiền tố ITEM_, kiểm tra khớp chính xác slug sau tiền tố
  if (itemIdOrSlug.startsWith('ITEM_')) {
    const rawSlug = itemIdOrSlug.substring(5).toLowerCase();
    if (RAW_MATERIALS_BY_SLUG[rawSlug]) {
      return RAW_MATERIALS_BY_SLUG[rawSlug].path;
    }
  }

  // Tuyệt đối không fuzzy match / đoán mò - trả về null để render placeholder
  return null;
}
