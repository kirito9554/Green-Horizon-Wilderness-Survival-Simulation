import type { HabitatPatch, TerrainTag } from './habitatPatches';
import type { PatchHydrologyState } from './terrainHydrology';

export const REQUIRED_LOCAL_SITE_TYPES = [
  'plane_wreck',
  'limestone_cavern',
  'ruin_complex',
] as const;

export const NATURAL_LOCAL_SITE_TYPES = [
  'freshwater_seep',
  'animal_trail',
  'wildlife_nest',
  'giant_kapok',
  'medicinal_glade',
  'clay_bank',
  'fallen_giant',
  'root_hollow',
  'rock_shelter',
  'fruit_grove',
  'canopy_gap',
  'mud_crossing',
  'tidal_pool',
  'cave_shaft',
  'waterfall_pool',
  'spring_head',
  'forest_pool',
  'seasonal_pool',
  'stream_ford',
  'river_bend',
  'gravel_bar',
  'oxbow_pool',
  'marsh_pool',
  'brackish_pool',
  'mangrove_channel',
  'reed_bed',
  'ravine',
  'cliff_face',
  'boulder_field',
  'landslide_scar',
  'sinkhole',
  'limestone_pinnacle',
  'cave_mouth',
  'talus_slope',
  'rock_outcrop',
  'erosion_gully',
  'bamboo_thicket',
  'palm_grove',
  'fern_gully',
  'vine_tangle',
  'strangler_fig',
  'moss_grove',
  'epiphyte_grove',
  'forest_glade',
  'rattan_thicket',
  'wild_tuber_patch',
  'resin_grove',
  'mushroom_deadwood',
  'animal_wallow',
  'mineral_lick',
  'burrow_colony',
  'nesting_cliff',
  'bat_roost',
  'roost_tree',
  'feeding_ground',
  'termite_mound',
  'bee_tree',
  'predator_den',
  'amphibian_breeding_pool',
  'reptile_basking_ledge',
  'boar_rooting_ground',
  'sandbar',
  'driftwood_bank',
  'shell_bank',
  'mangrove_rookery',
  'sea_cave',
  'beach_nest',
  'flood_debris_field',
  'stormfall',
  'fallen_log_jam',
] as const;

export type RequiredLocalSiteType = (typeof REQUIRED_LOCAL_SITE_TYPES)[number];
export type NaturalLocalSiteType = (typeof NATURAL_LOCAL_SITE_TYPES)[number];
export type LocalSiteType = RequiredLocalSiteType | NaturalLocalSiteType;

export type LocalSiteCategory =
  | 'water'
  | 'terrain'
  | 'vegetation'
  | 'wildlife'
  | 'coastal'
  | 'disturbance'
  | 'landmark';

export type LocalSiteRarity = 'common' | 'uncommon' | 'rare' | 'exceptional';

export interface LocalSitePoolRule {
  /** Minimum mean top-n terrain suitability required before this archetype can enter a seed's pool. */
  minWorldSupport: number;
  /** Core archetypes are retained whenever terrain support clears the minimum. */
  core?: boolean;
}

export interface LocalSiteArchetype {
  type: NaturalLocalSiteType;
  label: string;
  category: Exclude<LocalSiteCategory, 'landmark'>;
  rarity: LocalSiteRarity;
  baseWeight: number;
  radiusRange: readonly [number, number];
  discoveryBase: number;
  legacyConceptId?: string;
  tags: readonly string[];
  pool: LocalSitePoolRule;
  score: (patch: HabitatPatch, hydrology: PatchHydrologyState) => number;
}

const hasTerrain = (patch: HabitatPatch, tag: TerrainTag): boolean => patch.terrainTags.includes(tag);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const course = (hydro: PatchHydrologyState, kind: PatchHydrologyState['watercourse']): number => hydro.watercourse === kind ? 1 : 0;
const flowingWater = (hydro: PatchHydrologyState): number => hydro.watercourse === 'river'
  ? 1
  : hydro.watercourse === 'stream'
    ? .8
    : hydro.watercourse === 'seasonal_stream'
      ? .48
      : hydro.watercourse === 'wetland_channel'
        ? .72
        : 0;
const rocky = (patch: HabitatPatch): number => hasTerrain(patch, 'rock') ? 1 : 0;
const coastal = (patch: HabitatPatch): number => hasTerrain(patch, 'coastal') ? 1 : 0;
const tidal = (patch: HabitatPatch): number => hasTerrain(patch, 'tidal') ? 1 : 0;
const muddy = (patch: HabitatPatch): number => hasTerrain(patch, 'mud') ? 1 : 0;
const open = (patch: HabitatPatch): number => hasTerrain(patch, 'open_ground') ? 1 : 0;
const dense = (patch: HabitatPatch): number => hasTerrain(patch, 'dense_vegetation') ? 1 : 0;

function A(
  type: NaturalLocalSiteType,
  label: string,
  category: Exclude<LocalSiteCategory, 'landmark'>,
  rarity: LocalSiteRarity,
  baseWeight: number,
  radiusRange: readonly [number, number],
  discoveryBase: number,
  tags: readonly string[],
  score: LocalSiteArchetype['score'],
  options?: { minWorldSupport?: number; core?: boolean; legacyConceptId?: string },
): LocalSiteArchetype {
  const defaultMinimum: Record<LocalSiteRarity, number> = {
    common: .18,
    uncommon: .24,
    rare: .31,
    exceptional: .39,
  };
  return Object.freeze({
    type,
    label,
    category,
    rarity,
    baseWeight,
    radiusRange,
    discoveryBase,
    tags,
    score,
    legacyConceptId: options?.legacyConceptId,
    pool: {
      minWorldSupport: options?.minWorldSupport ?? defaultMinimum[rarity],
      core: options?.core,
    },
  });
}

export const NATURAL_SITE_ARCHETYPES: readonly LocalSiteArchetype[] = Object.freeze([
  // Water / hydrology features. These are selected only when the generated drainage terrain supports them.
  A('freshwater_seep', 'Freshwater Seep', 'water', 'common', .74, [18, 55], 48, ['water', 'freshwater', 'forage'],
    (p, h) => clamp01(h.waterIndex * .55 + p.terrain.wetness * .3 + p.terrain.drainage * .15), { core: true, minWorldSupport: .24 }),
  A('spring_head', 'Spring Head', 'water', 'uncommon', .48, [16, 50], 58, ['water', 'freshwater', 'headwater'],
    (p, h) => clamp01((h.isHeadwater ? .45 : 0) + h.waterIndex * .3 + p.terrain.drainage * .14 + p.terrain.slope * .12)),
  A('forest_pool', 'Forest Pool', 'water', 'uncommon', .5, [22, 80], 52, ['water', 'pool', 'wildlife'],
    (p, h) => clamp01((h.isSink ? .34 : 0) + p.terrain.wetness * .34 + h.waterIndex * .26 + p.suitability.cover * .1)),
  A('seasonal_pool', 'Seasonal Rain Pool', 'water', 'uncommon', .44, [18, 75], 44, ['water', 'seasonal', 'amphibian'],
    (p, h) => clamp01(p.terrain.wetness * .44 + course(h, 'seasonal_stream') * .32 + (1 - p.terrain.drainage) * .2)),
  A('stream_ford', 'Stream Ford', 'water', 'uncommon', .46, [18, 65], 38, ['water', 'crossing', 'travel'],
    (p, h) => clamp01((course(h, 'stream') * .55 + course(h, 'seasonal_stream') * .34) + (1 - p.terrain.slope) * .22 + open(p) * .12)),
  A('river_bend', 'River Bend', 'water', 'rare', .34, [45, 135], 42, ['river', 'water', 'fishing'],
    (p, h) => clamp01(course(h, 'river') * .68 + h.waterIndex * .18 + (1 - p.terrain.slope) * .18)),
  A('gravel_bar', 'Gravel Bar', 'water', 'uncommon', .42, [24, 95], 34, ['river', 'stone', 'open_ground'],
    (p, h) => clamp01(flowingWater(h) * .48 + rocky(p) * .24 + (1 - p.terrain.wetness) * .12 + (1 - p.suitability.canopy) * .12)),
  A('oxbow_pool', 'Oxbow Pool', 'water', 'rare', .28, [35, 120], 60, ['water', 'wetland', 'fish'],
    (p, h) => clamp01(course(h, 'river') * .34 + h.waterIndex * .3 + (1 - p.terrain.slope) * .2 + p.terrain.wetness * .2)),
  A('marsh_pool', 'Marsh Pool', 'water', 'uncommon', .45, [30, 105], 46, ['wetland', 'water', 'amphibian'],
    (p, h) => clamp01(course(h, 'wetland_channel') * .48 + p.terrain.wetness * .34 + p.suitability.aquatic * .24)),
  A('brackish_pool', 'Brackish Pool', 'water', 'rare', .3, [20, 85], 46, ['brackish', 'water', 'coastal'],
    (p, h) => clamp01(tidal(p) * .42 + coastal(p) * .22 + p.terrain.wetness * .2 + h.waterIndex * .2)),
  A('mangrove_channel', 'Mangrove Channel', 'water', 'uncommon', .42, [40, 140], 40, ['mangrove', 'channel', 'aquatic'],
    (p, h) => clamp01((p.habitat === 'mangrove' || p.habitat === 'tidal_creek' ? .5 : 0) + course(h, 'wetland_channel') * .3 + tidal(p) * .16)),
  A('reed_bed', 'Reed Bed', 'water', 'uncommon', .44, [30, 110], 40, ['wetland', 'plants', 'cover'],
    (p, h) => clamp01(p.terrain.wetness * .34 + p.suitability.aquatic * .3 + (1 - p.suitability.canopy) * .2 + course(h, 'wetland_channel') * .18)),
  A('waterfall_pool', 'Cascade Pool', 'water', 'rare', .34, [20, 70], 48, ['water', 'rock', 'freshwater', 'fishing'],
    (p, h) => clamp01(flowingWater(h) * .42 + p.terrain.slope * .28 + p.suitability.aquatic * .3)),
  A('mud_crossing', 'Mud Crossing', 'water', 'common', .42, [22, 80], 32, ['mud', 'crossing', 'travel', 'water'],
    (p, h) => clamp01(muddy(p) * .42 + p.terrain.wetness * .3 + h.waterIndex * .28)),

  // Terrain / geology features.
  A('rock_shelter', 'Rock Shelter', 'terrain', 'common', .5, [18, 65], 54, ['rock', 'shelter', 'dry'],
    p => clamp01(rocky(p) * .52 + p.terrain.roughness * .28 + p.terrain.drainage * .16), { core: true }),
  A('cave_shaft', 'Karst Shaft', 'terrain', 'rare', .28, [10, 45], 72, ['cave', 'rock', 'hazard'],
    p => clamp01((p.habitat === 'karst_forest' || p.habitat === 'cave_mouth' ? .58 : 0) + rocky(p) * .22 + p.terrain.roughness * .2)),
  A('ravine', 'Jungle Ravine', 'terrain', 'uncommon', .46, [45, 150], 50, ['ravine', 'steep', 'travel_barrier'],
    p => clamp01(p.terrain.slope * .46 + p.terrain.roughness * .32 + p.suitability.moisture * .12)),
  A('cliff_face', 'Cliff Face', 'terrain', 'rare', .34, [50, 165], 36, ['cliff', 'rock', 'hazard'],
    p => clamp01(rocky(p) * .4 + p.terrain.slope * .46 + p.terrain.elevationMeters / 900)),
  A('boulder_field', 'Boulder Field', 'terrain', 'uncommon', .42, [35, 130], 34, ['rock', 'boulder', 'material'],
    p => clamp01(rocky(p) * .46 + p.terrain.roughness * .42 + (1 - p.suitability.canopy) * .12)),
  A('landslide_scar', 'Landslide Scar', 'terrain', 'rare', .28, [45, 160], 42, ['landslide', 'hazard', 'open_ground'],
    p => clamp01(p.terrain.slope * .48 + p.terrain.roughness * .26 + open(p) * .16 + p.suitability.disturbance * .18)),
  A('sinkhole', 'Forest Sinkhole', 'terrain', 'rare', .27, [30, 105], 68, ['sinkhole', 'karst', 'hazard'],
    (p, h) => clamp01((p.habitat === 'karst_forest' ? .44 : 0) + rocky(p) * .2 + (h.isSink ? .2 : 0) + p.terrain.wetness * .12)),
  A('limestone_pinnacle', 'Limestone Pinnacle', 'terrain', 'exceptional', .16, [40, 135], 58, ['karst', 'rock', 'landmark'],
    p => clamp01((p.habitat === 'karst_forest' || p.habitat === 'rocky_ridge' ? .48 : 0) + rocky(p) * .26 + p.terrain.elevationMeters / 850)),
  A('cave_mouth', 'Hidden Cave Mouth', 'terrain', 'rare', .25, [16, 60], 76, ['cave', 'rock', 'shelter'],
    p => clamp01((p.habitat === 'cave_mouth' || p.habitat === 'karst_forest' ? .52 : 0) + rocky(p) * .28 + p.suitability.cover * .14)),
  A('talus_slope', 'Talus Slope', 'terrain', 'rare', .3, [35, 125], 46, ['rock', 'steep', 'unstable'],
    p => clamp01(rocky(p) * .4 + p.terrain.slope * .4 + p.terrain.roughness * .28)),
  A('rock_outcrop', 'Rock Outcrop', 'terrain', 'common', .52, [20, 80], 28, ['rock', 'stone', 'lookout'],
    p => clamp01(rocky(p) * .5 + p.terrain.drainage * .18 + (1 - p.suitability.canopy) * .22)),
  A('erosion_gully', 'Erosion Gully', 'terrain', 'uncommon', .38, [30, 115], 44, ['gully', 'erosion', 'travel_barrier'],
    (p, h) => clamp01(p.terrain.slope * .34 + flowingWater(h) * .22 + p.terrain.roughness * .24 + p.suitability.disturbance * .16)),

  // Vegetation / resource concentrations.
  A('giant_kapok', 'Giant Kapok', 'vegetation', 'rare', .32, [24, 70], 56, ['tree', 'landmark', 'canopy'],
    p => clamp01(p.suitability.canopy * .65 + p.suitability.cover * .18 - p.suitability.disturbance * .35), { legacyConceptId: 'AREA_KAPOK_GROVE' }),
  A('medicinal_glade', 'Medicinal Glade', 'vegetation', 'uncommon', .48, [25, 75], 62, ['plants', 'medicine', 'forage'],
    p => clamp01(p.suitability.forage * .45 + p.suitability.moisture * .28 + (1 - p.suitability.canopy) * .15 + .12), { legacyConceptId: 'AREA_MEDICINAL_GLADE' }),
  A('clay_bank', 'Clay Bank', 'terrain', 'uncommon', .44, [20, 70], 44, ['clay', 'water', 'material'],
    (p, h) => clamp01(p.terrain.wetness * .4 + h.waterIndex * .32 + (rocky(p) ? -.28 : .2)), { legacyConceptId: 'AREA_CLAY_PIT' }),
  A('fallen_giant', 'Fallen Giant', 'vegetation', 'common', .62, [25, 85], 38, ['tree', 'shelter', 'insects'],
    p => clamp01(p.suitability.canopy * .42 + p.terrain.roughness * .24 + p.suitability.cover * .26), { core: true }),
  A('root_hollow', 'Root Hollow', 'vegetation', 'common', .58, [12, 42], 66, ['shelter', 'roots', 'wildlife'],
    p => clamp01(p.suitability.cover * .45 + p.suitability.canopy * .3 + p.terrain.roughness * .18), { core: true }),
  A('fruit_grove', 'Fruiting Grove', 'vegetation', 'common', .6, [28, 90], 46, ['food', 'plants', 'wildlife'],
    p => clamp01(p.suitability.forage * .62 + p.suitability.canopy * .2 - p.suitability.disturbance * .12), { core: true }),
  A('canopy_gap', 'Canopy Gap', 'vegetation', 'common', .45, [35, 105], 28, ['clearing', 'sunlight', 'building'],
    p => clamp01((1 - p.suitability.canopy) * .5 + p.suitability.disturbance * .32 + open(p) * .28)),
  A('bamboo_thicket', 'Dense Bamboo Thicket', 'vegetation', 'uncommon', .5, [35, 120], 38, ['bamboo', 'fiber', 'cover'],
    p => clamp01((p.habitat === 'bamboo_forest' ? .62 : 0) + dense(p) * .18 + p.suitability.moisture * .12)),
  A('palm_grove', 'Wild Palm Grove', 'vegetation', 'uncommon', .42, [35, 115], 44, ['palm', 'food', 'fiber'],
    p => clamp01(coastal(p) * .3 + p.suitability.forage * .3 + (1 - p.suitability.canopy) * .16 + p.suitability.moisture * .12)),
  A('fern_gully', 'Fern Gully', 'vegetation', 'uncommon', .44, [25, 90], 54, ['fern', 'moisture', 'cover'],
    p => clamp01(p.terrain.wetness * .34 + p.suitability.cover * .26 + p.suitability.moisture * .26 + p.terrain.slope * .12)),
  A('vine_tangle', 'Vine Tangle', 'vegetation', 'common', .54, [20, 85], 50, ['vine', 'fiber', 'dense_vegetation'],
    p => clamp01(dense(p) * .34 + p.suitability.cover * .34 + p.suitability.canopy * .2 + p.suitability.moisture * .1)),
  A('strangler_fig', 'Strangler Fig Stand', 'vegetation', 'rare', .28, [20, 70], 64, ['tree', 'roots', 'wildlife'],
    p => clamp01(p.suitability.canopy * .48 + p.suitability.cover * .24 + p.suitability.forage * .14 - p.suitability.disturbance * .22)),
  A('moss_grove', 'Moss Grove', 'vegetation', 'rare', .3, [25, 85], 68, ['moss', 'wet', 'medicine'],
    p => clamp01(p.terrain.wetness * .34 + p.suitability.moisture * .36 + p.suitability.canopy * .22)),
  A('epiphyte_grove', 'Epiphyte Grove', 'vegetation', 'rare', .28, [25, 90], 72, ['epiphyte', 'canopy', 'plants'],
    p => clamp01(p.suitability.canopy * .52 + p.suitability.moisture * .3 + p.suitability.cover * .12)),
  A('forest_glade', 'Hidden Forest Glade', 'vegetation', 'uncommon', .4, [35, 120], 58, ['clearing', 'forage', 'building'],
    p => clamp01((1 - p.suitability.canopy) * .34 + p.suitability.forage * .32 + p.suitability.cover * .16 + (1 - p.suitability.disturbance) * .12)),
  A('rattan_thicket', 'Rattan Thicket', 'vegetation', 'uncommon', .4, [25, 85], 58, ['rattan', 'fiber', 'dense_vegetation'],
    p => clamp01(dense(p) * .28 + p.suitability.moisture * .26 + p.suitability.cover * .28 + p.suitability.forage * .12)),
  A('wild_tuber_patch', 'Wild Tuber Patch', 'vegetation', 'rare', .3, [18, 60], 66, ['food', 'roots', 'forage'],
    p => clamp01(p.suitability.forage * .46 + p.suitability.moisture * .22 + (1 - p.terrain.slope) * .16 + (1 - p.suitability.disturbance) * .12)),
  A('resin_grove', 'Resin Tree Grove', 'vegetation', 'rare', .26, [25, 80], 70, ['resin', 'tree', 'material'],
    p => clamp01(p.suitability.canopy * .4 + p.terrain.drainage * .2 + p.suitability.cover * .18 + (1 - p.terrain.wetness) * .14)),
  A('mushroom_deadwood', 'Fungal Deadwood Patch', 'vegetation', 'rare', .3, [18, 65], 76, ['fungus', 'deadwood', 'food'],
    p => clamp01(p.terrain.wetness * .32 + p.suitability.canopy * .28 + p.suitability.cover * .22 + p.terrain.roughness * .12)),

  // Wildlife-use sites. Later fauna simulation can own activity/state while these remain persistent landscape features.
  A('animal_trail', 'Animal Trail', 'wildlife', 'common', 1.3, [35, 110], 34, ['trail', 'wildlife', 'travel'],
    p => clamp01(p.suitability.forage * .4 + p.suitability.cover * .3 + (1 - p.suitability.disturbance) * .2 + .1), { core: true, legacyConceptId: 'AREA_JUNGLE_TRAIL' }),
  A('wildlife_nest', 'Wildlife Nest', 'wildlife', 'common', .78, [18, 60], 58, ['wildlife', 'nest', 'encounter'],
    p => clamp01(p.suitability.cover * .45 + p.suitability.canopy * .25 + p.suitability.forage * .2 - p.suitability.disturbance * .25), { core: true, legacyConceptId: 'AREA_WILDLIFE_NEST' }),
  A('animal_wallow', 'Animal Wallow', 'wildlife', 'uncommon', .46, [20, 75], 48, ['wildlife', 'mud', 'water'],
    (p, h) => clamp01(p.terrain.wetness * .28 + muddy(p) * .28 + p.suitability.forage * .2 + h.waterIndex * .16)),
  A('mineral_lick', 'Mineral Lick', 'wildlife', 'rare', .28, [15, 55], 68, ['wildlife', 'mineral', 'feeding'],
    (p, h) => clamp01(rocky(p) * .26 + h.waterIndex * .18 + p.terrain.drainage * .18 + p.suitability.forage * .16 + open(p) * .12)),
  A('burrow_colony', 'Burrow Colony', 'wildlife', 'uncommon', .4, [20, 80], 60, ['wildlife', 'burrow', 'prey_refuge'],
    p => clamp01((1 - p.terrain.wetness) * .3 + p.suitability.cover * .24 + (1 - p.terrain.slope) * .2 + p.suitability.forage * .16)),
  A('nesting_cliff', 'Nesting Cliff', 'wildlife', 'rare', .25, [35, 115], 70, ['wildlife', 'bird', 'cliff'],
    p => clamp01(rocky(p) * .32 + p.terrain.slope * .32 + p.terrain.elevationMeters / 1000 + (1 - p.suitability.disturbance) * .14)),
  A('bat_roost', 'Bat Roost', 'wildlife', 'rare', .3, [12, 55], 74, ['wildlife', 'bat', 'cave'],
    p => clamp01((p.habitat === 'cave_mouth' || p.habitat === 'karst_forest' ? .42 : 0) + rocky(p) * .22 + p.suitability.cover * .24)),
  A('roost_tree', 'Communal Roost Tree', 'wildlife', 'uncommon', .38, [18, 60], 62, ['wildlife', 'bird', 'tree'],
    p => clamp01(p.suitability.canopy * .46 + p.suitability.cover * .2 + p.suitability.forage * .16 - p.suitability.disturbance * .2)),
  A('feeding_ground', 'Wildlife Feeding Ground', 'wildlife', 'common', .52, [35, 120], 42, ['wildlife', 'forage', 'encounter'],
    p => clamp01(p.suitability.forage * .56 + (1 - p.suitability.canopy) * .12 + p.suitability.cover * .14 + (1 - p.suitability.disturbance) * .12), { core: true }),
  A('termite_mound', 'Termite Mound Field', 'wildlife', 'uncommon', .4, [15, 65], 46, ['insects', 'food_web', 'soil'],
    p => clamp01((1 - p.terrain.wetness) * .26 + open(p) * .2 + p.suitability.forage * .2 + p.terrain.drainage * .18)),
  A('bee_tree', 'Wild Bee Tree', 'wildlife', 'rare', .26, [12, 45], 72, ['insects', 'honey', 'tree'],
    p => clamp01(p.suitability.canopy * .36 + p.suitability.forage * .34 + p.suitability.cover * .14 - p.suitability.disturbance * .2)),
  A('predator_den', 'Predator Den', 'wildlife', 'rare', .22, [14, 55], 78, ['predator', 'den', 'hazard'],
    p => clamp01(p.suitability.cover * .36 + p.terrain.roughness * .24 + rocky(p) * .18 + (1 - p.suitability.disturbance) * .16)),
  A('amphibian_breeding_pool', 'Amphibian Breeding Pool', 'wildlife', 'rare', .28, [16, 65], 70, ['amphibian', 'water', 'breeding'],
    (p, h) => clamp01(p.terrain.wetness * .32 + h.waterIndex * .32 + p.suitability.cover * .16 + (1 - p.terrain.slope) * .12)),
  A('reptile_basking_ledge', 'Reptile Basking Ledge', 'wildlife', 'uncommon', .36, [16, 65], 52, ['reptile', 'rock', 'sunlight'],
    p => clamp01(rocky(p) * .3 + (1 - p.suitability.canopy) * .3 + p.terrain.drainage * .18 + p.terrain.roughness * .12)),
  A('boar_rooting_ground', 'Boar Rooting Ground', 'wildlife', 'uncommon', .38, [28, 95], 44, ['wildlife', 'forage', 'disturbed_soil'],
    p => clamp01(p.suitability.forage * .4 + p.terrain.wetness * .18 + p.suitability.cover * .18 + (1 - p.suitability.disturbance) * .12)),

  // Coastal features.
  A('tidal_pool', 'Tidal Pool', 'coastal', 'common', .5, [12, 50], 30, ['coastal', 'tidal', 'aquatic', 'food'],
    p => clamp01(tidal(p) * .55 + coastal(p) * .25 + p.suitability.aquatic * .2), { core: true }),
  A('sandbar', 'Tidal Sandbar', 'coastal', 'uncommon', .4, [35, 130], 28, ['coastal', 'tidal', 'open_ground'],
    p => clamp01(coastal(p) * .34 + tidal(p) * .34 + open(p) * .2 + (1 - p.terrain.slope) * .12)),
  A('driftwood_bank', 'Driftwood Bank', 'coastal', 'uncommon', .42, [25, 95], 32, ['coastal', 'wood', 'salvage'],
    p => clamp01(coastal(p) * .48 + open(p) * .16 + p.suitability.disturbance * .14 + (1 - p.suitability.canopy) * .14)),
  A('shell_bank', 'Shell Bank', 'coastal', 'rare', .28, [20, 80], 42, ['coastal', 'shell', 'food'],
    p => clamp01(coastal(p) * .4 + tidal(p) * .3 + (1 - p.suitability.canopy) * .16)),
  A('mangrove_rookery', 'Mangrove Rookery', 'coastal', 'rare', .25, [30, 100], 72, ['mangrove', 'bird', 'nesting'],
    p => clamp01((p.habitat === 'mangrove' ? .48 : 0) + tidal(p) * .16 + p.suitability.canopy * .2 + p.suitability.aquatic * .14)),
  A('sea_cave', 'Sea Cave', 'coastal', 'exceptional', .16, [20, 75], 80, ['coastal', 'cave', 'rock'],
    p => clamp01(coastal(p) * .34 + rocky(p) * .34 + p.terrain.roughness * .22)),
  A('beach_nest', 'Beach Nesting Ground', 'coastal', 'rare', .24, [25, 90], 74, ['coastal', 'nest', 'wildlife'],
    p => clamp01(coastal(p) * .36 + open(p) * .28 + (1 - p.suitability.disturbance) * .22)),
  A('brackish_pool', 'Brackish Pool', 'coastal', 'rare', .3, [20, 85], 46, ['brackish', 'water', 'coastal'],
    (p, h) => clamp01(tidal(p) * .42 + coastal(p) * .22 + p.terrain.wetness * .2 + h.waterIndex * .2), { minWorldSupport: .3 }),

  // Disturbance / episodic landscape features. The feature persists as a site even though its ecological state can evolve later.
  A('flood_debris_field', 'Flood Debris Field', 'disturbance', 'uncommon', .34, [35, 130], 36, ['flood', 'debris', 'salvage'],
    (p, h) => clamp01(flowingWater(h) * .28 + h.waterIndex * .22 + p.suitability.disturbance * .24 + p.terrain.roughness * .16)),
  A('stormfall', 'Stormfall Blowdown', 'disturbance', 'rare', .28, [45, 155], 44, ['storm', 'fallen_trees', 'clearing'],
    p => clamp01(p.suitability.canopy * .3 + p.terrain.roughness * .22 + p.suitability.disturbance * .28 + open(p) * .12)),
  A('fallen_log_jam', 'Fallen Log Jam', 'disturbance', 'rare', .24, [25, 95], 58, ['stream', 'wood', 'barrier'],
    (p, h) => clamp01(flowingWater(h) * .42 + p.suitability.canopy * .2 + p.terrain.roughness * .2 + h.waterIndex * .14)),
]);

export const NATURAL_LOCAL_SITE_ARCHETYPE_COUNT = NATURAL_SITE_ARCHETYPES.length;
