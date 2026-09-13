const fs = require('fs');

const EXACT_RAW_MATERIALS_ICON_PATH = {
  // ROW 1: Wood & Branches
  ITEM_TWIG: '/iconsets/raw-materials/twig.png',
  ITEM_DRY_TWIG: '/iconsets/raw-materials/dry_twig.png',
  ITEM_BRANCH: '/iconsets/raw-materials/branch.png',
  ITEM_THICK_BRANCH: '/iconsets/raw-materials/thick_branch.png',
  ITEM_SHORT_WOOD_POLE: '/iconsets/raw-materials/short_wood_pole.png',
  ITEM_LONG_WOOD_POLE: '/iconsets/raw-materials/long_wood_pole.png',
  ITEM_SMALL_LOG: '/iconsets/raw-materials/small_log.png',
  ITEM_LOG: '/iconsets/raw-materials/log.png',
  ITEM_HARDWOOD_LOG: '/iconsets/raw-materials/hardwood_log.png',
  ITEM_DRIFTWOOD: '/iconsets/raw-materials/driftwood.png',

  // ROW 2: Bamboo & Leaves
  ITEM_BAMBOO_SHOOT: '/iconsets/raw-materials/bamboo_shoot.png',
  ITEM_BAMBOO_POLE: '/iconsets/raw-materials/bamboo_pole.png',
  ITEM_THICK_BAMBOO_POLE: '/iconsets/raw-materials/thick_bamboo_pole.png',
  ITEM_SPLIT_BAMBOO: '/iconsets/raw-materials/split_bamboo.png',
  ITEM_BAMBOO_STRIP: '/iconsets/raw-materials/bamboo_strip.png',
  ITEM_TREE_BARK: '/iconsets/raw-materials/tree_bark.png',
  ITEM_BARK_STRIP: '/iconsets/raw-materials/bark_strip.png',
  ITEM_PALM_LEAF: '/iconsets/raw-materials/palm_leaf.png',
  ITEM_LARGE_PALM_LEAF: '/iconsets/raw-materials/large_palm_leaf.png',
  ITEM_BROAD_LEAF: '/iconsets/raw-materials/broad_leaf.png',

  // ROW 3: Grass, Vines, Fibers & Coconut Materials
  ITEM_DRY_LEAVES: '/iconsets/raw-materials/dry_leaves.png',
  ITEM_GRASS_BUNDLE: '/iconsets/raw-materials/grass_bundle.png',
  ITEM_DRY_GRASS: '/iconsets/raw-materials/dry_grass.png',
  ITEM_VINE: '/iconsets/raw-materials/vine.png',
  ITEM_LONG_VINE: '/iconsets/raw-materials/long_vine.png',
  ITEM_PLANT_FIBER: '/iconsets/raw-materials/plant_fiber.png',
  ITEM_PALM_FIBER: '/iconsets/raw-materials/palm_fiber.png',
  ITEM_BARK_FIBER: '/iconsets/raw-materials/bark_fiber.png',
  ITEM_COCONUT_HUSK: '/iconsets/raw-materials/coconut_husk.png',
  ITEM_COCONUT_SHELL: '/iconsets/raw-materials/coconut_shell.png',

  // ROW 4: Resin, Sap & Stones
  ITEM_RESIN: '/iconsets/raw-materials/resin.png',
  ITEM_TREE_SAP: '/iconsets/raw-materials/tree_sap.png',
  ITEM_PEBBLE: '/iconsets/raw-materials/pebble.png',
  ITEM_SMALL_STONE: '/iconsets/raw-materials/small_stone.png',
  ITEM_STONE: '/iconsets/raw-materials/stone.png',
  ITEM_LARGE_STONE: '/iconsets/raw-materials/large_stone.png',
  ITEM_FLAT_STONE: '/iconsets/raw-materials/flat_stone.png',
  ITEM_SHARP_STONE: '/iconsets/raw-materials/sharp_stone.png',
  ITEM_STONE_FLAKE: '/iconsets/raw-materials/stone_flake.png',
  ITEM_STONE_BLADE: '/iconsets/raw-materials/stone_blade.png',

  // ROW 5: Stone Heads, Sand, Clay & Ash
  ITEM_STONE_AXE_HEAD: '/iconsets/raw-materials/stone_axe_head.png',
  ITEM_STONE_HAMMER_HEAD: '/iconsets/raw-materials/stone_hammer_head.png',
  ITEM_SAND: '/iconsets/raw-materials/sand.png',
  ITEM_WET_SAND: '/iconsets/raw-materials/wet_sand.png',
  ITEM_CLAY: '/iconsets/raw-materials/clay.png',
  ITEM_WET_CLAY: '/iconsets/raw-materials/wet_clay.png',
  ITEM_CHARCOAL: '/iconsets/raw-materials/charcoal.png',
  ITEM_ASH: '/iconsets/raw-materials/ash.png',
  ITEM_SMALL_BONE: '/iconsets/raw-materials/small_bone.png',
  ITEM_BONE: '/iconsets/raw-materials/bone.png',

  // ROW 6: Bones, Hide, Tendon, Feathers & Shells
  ITEM_LARGE_BONE: '/iconsets/raw-materials/large_bone.png',
  ITEM_BONE_SHARD: '/iconsets/raw-materials/bone_shard.png',
  ITEM_ANIMAL_HIDE: '/iconsets/raw-materials/animal_hide.png',
  ITEM_RAW_HIDE: '/iconsets/raw-materials/raw_hide.png',
  ITEM_TENDON: '/iconsets/raw-materials/tendon.png',
  ITEM_SINEW: '/iconsets/raw-materials/sinew.png',
  ITEM_FEATHER: '/iconsets/raw-materials/feather.png',
  ITEM_SHELL: '/iconsets/raw-materials/shell.png',
  ITEM_LARGE_SHELL: '/iconsets/raw-materials/large_shell.png',
  ITEM_FISH_BONE: '/iconsets/raw-materials/fish_bone.png',

  // ROW 7: Animal By-products & Ropes
  ITEM_FISH_GUTS: '/iconsets/raw-materials/fish_guts.png',
  ITEM_ANIMAL_FAT: '/iconsets/raw-materials/animal_fat.png',
  ITEM_ANIMAL_GUTS: '/iconsets/raw-materials/animal_guts.png',
  ITEM_MANURE: '/iconsets/raw-materials/manure.png',
  ITEM_PLANT_CORD: '/iconsets/raw-materials/plant_cord.png',
  ITEM_FIBER_ROPE: '/iconsets/raw-materials/fiber_rope.png',
  ITEM_VINE_ROPE: '/iconsets/raw-materials/vine_rope.png',
  ITEM_BARK_ROPE: '/iconsets/raw-materials/bark_rope.png',
  ITEM_BAMBOO_ROPE: '/iconsets/raw-materials/bamboo_rope.png',
  ITEM_WOODEN_STAKE: '/iconsets/raw-materials/wooden_stake.png',

  // ROW 8: Stakes, Handles, Planks, Pegs & Hooks
  ITEM_SHARPENED_STICK: '/iconsets/raw-materials/sharpened_stick.png',
  ITEM_WOODEN_HANDLE: '/iconsets/raw-materials/wooden_handle.png',
  ITEM_SHORT_HANDLE: '/iconsets/raw-materials/short_handle.png',
  ITEM_LONG_HANDLE: '/iconsets/raw-materials/long_handle.png',
  ITEM_BAMBOO_HANDLE: '/iconsets/raw-materials/bamboo_handle.png',
  ITEM_WOODEN_PLANK: '/iconsets/raw-materials/wooden_plank.png',
  ITEM_WOODEN_PEG: '/iconsets/raw-materials/wooden_peg.png',
  ITEM_BONE_NEEDLE: '/iconsets/raw-materials/bone_needle.png',
  ITEM_BONE_HOOK: '/iconsets/raw-materials/bone_hook.png',
  ITEM_FISH_HOOK: '/iconsets/raw-materials/fish_hook.png',

  // ROW 9: Tinder
  ITEM_TINDER_BUNDLE: '/iconsets/raw-materials/tinder_bundle.png',
  ITEM_DRY_TINDER: '/iconsets/raw-materials/dry_tinder.png',
};

const items = Object.entries(EXACT_RAW_MATERIALS_ICON_PATH).map(([key, path], index) => {
  const filename = path.split('/').pop();
  const slug = filename.replace('.png', '');
  return {
    index: index + 1,
    name: slug.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    slug: slug,
    filename: filename,
    row: Math.floor(index / 10) + 1,
    col: (index % 10) + 1,
    path: path
  };
});

fs.writeFileSync('src/data/rawMaterialsMap.json', JSON.stringify(items, null, 2));
console.log('JSON written');
