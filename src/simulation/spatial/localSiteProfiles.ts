import {
  NATURAL_LOCAL_SITE_TYPES,
  REQUIRED_LOCAL_SITE_TYPES,
  type LocalSiteType,
} from './localSiteCatalog';
import type { GeneratedLocalSite } from './localSiteGeneration';

export type LocalSiteActivity =
  | 'gather_water'
  | 'forage_food'
  | 'forage_medicine'
  | 'gather_material'
  | 'gather_fuel'
  | 'fish'
  | 'hunt'
  | 'trap'
  | 'observe_wildlife'
  | 'salvage'
  | 'shelter'
  | 'camp'
  | 'cross'
  | 'climb'
  | 'survey'
  | 'explore_cave';

export type LocalSiteFaunaGuild =
  | 'invertebrate'
  | 'fish'
  | 'amphibian'
  | 'reptile'
  | 'small_mammal'
  | 'large_herbivore'
  | 'omnivore'
  | 'ground_bird'
  | 'canopy_bird'
  | 'raptor'
  | 'bat'
  | 'predator'
  | 'scavenger';

export type LocalSiteResourceKind =
  | 'fresh_water'
  | 'fish'
  | 'shellfish'
  | 'insects'
  | 'wild_eggs'
  | 'fruit'
  | 'edible_plants'
  | 'tubers'
  | 'medicinal_plants'
  | 'mushrooms'
  | 'honey'
  | 'timber'
  | 'hardwood'
  | 'driftwood'
  | 'bamboo'
  | 'fiber'
  | 'resin'
  | 'clay'
  | 'stone'
  | 'sand'
  | 'shells'
  | 'mineral'
  | 'manure'
  | 'salvage';

export type LocalSiteResourceRenewability =
  | 'continuous'
  | 'seasonal'
  | 'slow'
  | 'finite'
  | 'episodic'
  | 'tidal';

export type LocalSiteResourceSeasonality =
  | 'year_round'
  | 'wet_peak'
  | 'dry_peak'
  | 'fruiting'
  | 'tidal_cycle'
  | 'storm_event'
  | 'irregular';

export interface LocalSiteResourceOpportunity {
  kind: LocalSiteResourceKind;
  /** Relative stock/productivity signal, not literal item count. */
  abundance: number;
  renewability: LocalSiteResourceRenewability;
  seasonality: LocalSiteResourceSeasonality;
  /** 0..1: high values mean careless extraction damages the site strongly. */
  extractionImpact: number;
  /** Existing item IDs that can already be materialized from this resource family. */
  itemIds?: readonly string[];
}

export interface LocalSiteGameplayEffects {
  /** Route impedance while interacting with / crossing this feature. 1 = neutral. */
  movementCostMultiplier: number;
  /** 0..1 usefulness as a navigation landmark or route anchor. */
  navigationValue: number;
  shelterQuality: number;
  campSuitability: number;
  hazard: number;
  visibility: number;
}

export interface LocalSiteEcologyEffects {
  /** Food productivity available to wildlife around the feature. */
  forage: number;
  cover: number;
  water: number;
  breedingHabitat: number;
  /** Physical/vegetative protection reducing easy predator access. */
  preyRefuge: number;
  /** Opportunity for predators to locate/ambush prey around the feature. */
  predatorOpportunity: number;
  aquaticNursery: number;
  decomposition: number;
  /** Sensitivity to repeated human harvest, traffic, logging or construction. */
  disturbanceSensitivity: number;
  guildAffinity: Partial<Record<LocalSiteFaunaGuild, number>>;
}

export interface LocalSiteFunctionalProfile {
  type: LocalSiteType;
  activities: readonly LocalSiteActivity[];
  gameplay: LocalSiteGameplayEffects;
  ecology: LocalSiteEcologyEffects;
  resources: readonly LocalSiteResourceOpportunity[];
  /** Short machine-readable role tags for future UI/AI systems. */
  roleTags: readonly string[];
}

const G = (
  movementCostMultiplier: number,
  navigationValue: number,
  shelterQuality: number,
  campSuitability: number,
  hazard: number,
  visibility: number,
): LocalSiteGameplayEffects => ({
  movementCostMultiplier,
  navigationValue,
  shelterQuality,
  campSuitability,
  hazard,
  visibility,
});

const E = (
  forage: number,
  cover: number,
  water: number,
  breedingHabitat: number,
  preyRefuge: number,
  predatorOpportunity: number,
  aquaticNursery: number,
  decomposition: number,
  disturbanceSensitivity: number,
  guildAffinity: Partial<Record<LocalSiteFaunaGuild, number>> = {},
): LocalSiteEcologyEffects => ({
  forage,
  cover,
  water,
  breedingHabitat,
  preyRefuge,
  predatorOpportunity,
  aquaticNursery,
  decomposition,
  disturbanceSensitivity,
  guildAffinity,
});

const R = (
  kind: LocalSiteResourceKind,
  abundance: number,
  renewability: LocalSiteResourceRenewability,
  seasonality: LocalSiteResourceSeasonality,
  extractionImpact: number,
  itemIds?: readonly string[],
): LocalSiteResourceOpportunity => ({ kind, abundance, renewability, seasonality, extractionImpact, itemIds });

const P = (
  type: LocalSiteType,
  activities: readonly LocalSiteActivity[],
  gameplay: LocalSiteGameplayEffects,
  ecology: LocalSiteEcologyEffects,
  resources: readonly LocalSiteResourceOpportunity[],
  roleTags: readonly string[],
): LocalSiteFunctionalProfile => Object.freeze({ type, activities, gameplay, ecology, resources, roleTags });

export const LOCAL_SITE_FUNCTIONAL_PROFILES = {
  plane_wreck: P('plane_wreck', ['salvage', 'shelter', 'survey'], G(1.08, .95, .46, .42, .38, .92), E(.18, .3, .08, .08, .2, .24, .02, .28, .56, { scavenger: .52, small_mammal: .24, predator: .18 }), [R('salvage', .92, 'finite', 'irregular', .16)], ['landmark', 'salvage', 'starting_site']),
  limestone_cavern: P('limestone_cavern', ['explore_cave', 'shelter', 'survey'], G(1.28, .86, .86, .28, .62, .14), E(.16, .82, .28, .62, .72, .26, .14, .46, .72, { bat: .9, reptile: .55, invertebrate: .5, predator: .28 }), [R('fresh_water', .24, 'continuous', 'year_round', .18), R('stone', .6, 'finite', 'year_round', .4, ['ITEM_STONE', 'ITEM_FLAT_STONE'])], ['landmark', 'cave', 'shelter']),
  ruin_complex: P('ruin_complex', ['salvage', 'shelter', 'survey'], G(1.22, .92, .58, .38, .5, .64), E(.3, .56, .16, .28, .52, .46, .04, .42, .62, { reptile: .48, bat: .34, small_mammal: .38, predator: .28, scavenger: .4 }), [R('salvage', .8, 'finite', 'irregular', .24), R('stone', .46, 'finite', 'year_round', .32, ['ITEM_STONE', 'ITEM_FLAT_STONE'])], ['landmark', 'ruin', 'salvage']),

  freshwater_seep: P('freshwater_seep', ['gather_water', 'forage_food', 'observe_wildlife'], G(.92, .64, .18, .46, .16, .42), E(.62, .54, .98, .72, .46, .58, .5, .72, .78, { amphibian: .82, small_mammal: .52, ground_bird: .48, predator: .42, invertebrate: .54 }), [R('fresh_water', .82, 'continuous', 'year_round', .72)], ['water_source', 'wildlife_focus']),
  animal_trail: P('animal_trail', ['cross', 'hunt', 'trap', 'observe_wildlife', 'survey'], G(.7, .82, .08, .12, .2, .48), E(.58, .38, .24, .3, .12, .82, .08, .42, .52, { small_mammal: .62, large_herbivore: .68, omnivore: .72, predator: .7 }), [], ['travel', 'wildlife_corridor', 'hunting']),
  wildlife_nest: P('wildlife_nest', ['observe_wildlife', 'forage_food'], G(1.04, .26, .18, .08, .28, .22), E(.42, .82, .24, .96, .82, .24, .1, .46, .94, { ground_bird: .78, canopy_bird: .82, small_mammal: .42, reptile: .22 }), [R('wild_eggs', .34, 'seasonal', 'irregular', .96), R('feathers' as LocalSiteResourceKind, .22, 'seasonal', 'irregular', .7)], ['breeding_site', 'sensitive']),
  giant_kapok: P('giant_kapok', ['forage_food', 'gather_material', 'observe_wildlife', 'survey'], G(1.06, .78, .46, .3, .18, .32), E(.72, .9, .22, .76, .68, .34, .04, .74, .92, { canopy_bird: .9, bat: .58, small_mammal: .54, invertebrate: .72 }), [R('fruit', .38, 'seasonal', 'fruiting', .66), R('fiber', .2, 'slow', 'year_round', .58, ['ITEM_TREE_BARK', 'ITEM_BARK_FIBER'])], ['old_growth', 'keystone_tree', 'landmark']),
  medicinal_glade: P('medicinal_glade', ['forage_medicine', 'forage_food'], G(.86, .44, .08, .48, .08, .7), E(.82, .44, .48, .64, .32, .28, .06, .76, .94, { invertebrate: .62, ground_bird: .38, small_mammal: .32 }), [R('medicinal_plants', .9, 'seasonal', 'wet_peak', .94), R('edible_plants', .44, 'seasonal', 'wet_peak', .62)], ['medicine', 'forage', 'sensitive']),
  clay_bank: P('clay_bank', ['gather_material', 'gather_water'], G(1.18, .38, .04, .26, .3, .62), E(.24, .28, .72, .32, .18, .34, .38, .44, .62, { amphibian: .38, invertebrate: .42, ground_bird: .22 }), [R('clay', .9, 'slow', 'year_round', .72, ['ITEM_CLAY', 'ITEM_WET_CLAY'])], ['material', 'wet_bank']),
  fallen_giant: P('fallen_giant', ['gather_material', 'gather_fuel', 'shelter', 'observe_wildlife'], G(1.24, .5, .68, .3, .24, .22), E(.58, .86, .3, .7, .82, .42, .04, .96, .72, { invertebrate: .9, small_mammal: .72, reptile: .48, predator: .28 }), [R('timber', .68, 'finite', 'year_round', .72, ['ITEM_BRANCH', 'ITEM_SMALL_LOG', 'ITEM_LOG']), R('mushrooms', .42, 'seasonal', 'wet_peak', .66)], ['deadwood', 'shelter', 'decomposer_hotspot']),
  root_hollow: P('root_hollow', ['shelter', 'trap', 'observe_wildlife'], G(1.08, .34, .72, .22, .3, .18), E(.4, .9, .26, .76, .94, .46, .02, .72, .86, { small_mammal: .88, reptile: .62, invertebrate: .54, predator: .28 }), [], ['refuge', 'denning_microhabitat']),
  rock_shelter: P('rock_shelter', ['shelter', 'camp', 'survey'], G(1.02, .58, .9, .72, .24, .56), E(.18, .64, .12, .42, .72, .26, .02, .28, .46, { reptile: .54, bat: .3, small_mammal: .3 }), [R('stone', .38, 'finite', 'year_round', .28, ['ITEM_STONE', 'ITEM_FLAT_STONE'])], ['shelter', 'camp_candidate']),
  fruit_grove: P('fruit_grove', ['forage_food', 'observe_wildlife'], G(.96, .46, .12, .5, .16, .42), E(.98, .58, .3, .62, .34, .74, .02, .72, .92, { small_mammal: .74, canopy_bird: .78, ground_bird: .48, bat: .58, omnivore: .72, predator: .46 }), [R('fruit', .96, 'seasonal', 'fruiting', .88)], ['food', 'wildlife_focus', 'seasonal']),
  canopy_gap: P('canopy_gap', ['camp', 'survey', 'forage_food'], G(.76, .72, .04, .86, .18, .96), E(.68, .18, .2, .36, .08, .56, .02, .62, .66, { ground_bird: .48, reptile: .52, large_herbivore: .34, predator: .38 }), [R('edible_plants', .42, 'seasonal', 'wet_peak', .58)], ['clearing', 'building_candidate', 'sunlight']),
  mud_crossing: P('mud_crossing', ['cross', 'observe_wildlife'], G(1.58, .72, .02, .04, .62, .58), E(.36, .22, .76, .36, .06, .72, .44, .58, .7, { amphibian: .48, large_herbivore: .48, omnivore: .54, predator: .5 }), [], ['crossing', 'travel_hazard', 'tracks']),
  tidal_pool: P('tidal_pool', ['fish', 'forage_food', 'observe_wildlife'], G(1.14, .62, .02, .08, .28, .82), E(.72, .2, .94, .76, .16, .42, .94, .66, .84, { fish: .76, invertebrate: .92, ground_bird: .48, reptile: .28 }), [R('shellfish', .78, 'tidal', 'tidal_cycle', .82), R('shells', .48, 'tidal', 'tidal_cycle', .42, ['ITEM_SHELL', 'ITEM_LARGE_SHELL'])], ['tidal', 'aquatic_food']),
  cave_shaft: P('cave_shaft', ['explore_cave', 'survey'], G(1.72, .66, .22, .02, .9, .08), E(.08, .62, .2, .54, .5, .22, .02, .52, .58, { bat: .7, invertebrate: .56, reptile: .38 }), [R('stone', .24, 'finite', 'year_round', .28, ['ITEM_STONE'])], ['cave', 'hazard', 'vertical']),
  waterfall_pool: P('waterfall_pool', ['gather_water', 'fish', 'survey'], G(1.42, .84, .12, .1, .58, .78), E(.54, .34, 1, .6, .18, .5, .82, .74, .78, { fish: .7, amphibian: .68, invertebrate: .62, reptile: .32 }), [R('fresh_water', .94, 'continuous', 'year_round', .52), R('fish', .58, 'continuous', 'year_round', .72)], ['freshwater', 'fishing', 'landmark']),
  spring_head: P('spring_head', ['gather_water', 'survey', 'observe_wildlife'], G(1.04, .78, .12, .42, .14, .52), E(.54, .5, 1, .76, .44, .5, .42, .68, .9, { amphibian: .74, small_mammal: .48, ground_bird: .42 }), [R('fresh_water', .98, 'continuous', 'year_round', .9)], ['headwater', 'freshwater', 'sensitive']),
  forest_pool: P('forest_pool', ['gather_water', 'fish', 'observe_wildlife'], G(1.18, .58, .1, .2, .34, .34), E(.64, .72, .94, .9, .68, .56, .88, .9, .94, { amphibian: .94, invertebrate: .86, reptile: .62, fish: .38, predator: .42 }), [R('fresh_water', .58, 'seasonal', 'wet_peak', .84), R('insects', .62, 'continuous', 'wet_peak', .72)], ['pool', 'breeding_hotspot', 'sensitive']),
  seasonal_pool: P('seasonal_pool', ['gather_water', 'observe_wildlife'], G(1.2, .46, .02, .08, .36, .52), E(.5, .28, .78, .94, .36, .48, .86, .86, .98, { amphibian: 1, invertebrate: .82, ground_bird: .3 }), [R('fresh_water', .42, 'seasonal', 'wet_peak', .9), R('insects', .54, 'seasonal', 'wet_peak', .74)], ['ephemeral_water', 'amphibian_breeding']),
  stream_ford: P('stream_ford', ['cross', 'gather_water', 'fish'], G(.78, .86, .04, .18, .36, .86), E(.44, .24, .9, .34, .06, .72, .48, .64, .66, { fish: .46, amphibian: .38, large_herbivore: .4, predator: .46 }), [R('fresh_water', .82, 'continuous', 'year_round', .5), R('stone', .32, 'slow', 'year_round', .22, ['ITEM_PEBBLE', 'ITEM_FLAT_STONE'])], ['crossing', 'route_anchor', 'freshwater']),
  river_bend: P('river_bend', ['fish', 'gather_water', 'observe_wildlife'], G(1.18, .76, .04, .08, .36, .84), E(.72, .34, 1, .72, .22, .7, .86, .86, .82, { fish: .88, reptile: .54, ground_bird: .46, predator: .4, invertebrate: .58 }), [R('fresh_water', .9, 'continuous', 'year_round', .48), R('fish', .82, 'continuous', 'year_round', .8)], ['river', 'fishing', 'wildlife_focus']),
  gravel_bar: P('gravel_bar', ['gather_material', 'cross', 'survey'], G(.9, .76, .02, .12, .18, .96), E(.18, .04, .5, .16, .02, .34, .24, .24, .42, { reptile: .34, ground_bird: .3 }), [R('stone', .8, 'slow', 'year_round', .38, ['ITEM_PEBBLE', 'ITEM_SMALL_STONE', 'ITEM_FLAT_STONE'])], ['stone_source', 'open_ground', 'river']),
  oxbow_pool: P('oxbow_pool', ['fish', 'gather_water', 'observe_wildlife'], G(1.22, .56, .04, .06, .3, .36), E(.78, .62, .96, .92, .62, .54, .96, .94, .96, { fish: .92, amphibian: .86, invertebrate: .86, reptile: .54, ground_bird: .44 }), [R('fish', .76, 'continuous', 'year_round', .84), R('fresh_water', .58, 'seasonal', 'wet_peak', .8)], ['wetland', 'nursery', 'sensitive']),
  marsh_pool: P('marsh_pool', ['fish', 'forage_food', 'observe_wildlife'], G(1.5, .42, .02, .02, .52, .24), E(.82, .72, .98, .98, .72, .62, .98, .98, .98, { amphibian: 1, fish: .72, invertebrate: .96, ground_bird: .64, reptile: .5 }), [R('fish', .48, 'seasonal', 'wet_peak', .88), R('edible_plants', .42, 'seasonal', 'wet_peak', .78)], ['wetland', 'breeding_hotspot', 'difficult_ground']),
  brackish_pool: P('brackish_pool', ['fish', 'forage_food', 'observe_wildlife'], G(1.34, .5, .02, .02, .4, .44), E(.62, .42, .88, .7, .34, .5, .84, .78, .82, { fish: .64, invertebrate: .78, ground_bird: .46, reptile: .38 }), [R('shellfish', .58, 'tidal', 'tidal_cycle', .76), R('fish', .36, 'tidal', 'tidal_cycle', .7)], ['brackish', 'nursery']),
  mangrove_channel: P('mangrove_channel', ['fish', 'cross', 'observe_wildlife'], G(1.72, .68, .04, .01, .7, .28), E(.82, .92, .98, .9, .78, .68, 1, .96, .98, { fish: .88, invertebrate: .92, reptile: .66, ground_bird: .68, predator: .48 }), [R('fish', .74, 'continuous', 'year_round', .9), R('shellfish', .78, 'tidal', 'tidal_cycle', .9)], ['mangrove', 'aquatic_nursery', 'travel_barrier']),
  reed_bed: P('reed_bed', ['gather_material', 'observe_wildlife', 'trap'], G(1.34, .28, .04, .02, .26, .12), E(.66, .96, .86, .92, .92, .38, .72, .84, .96, { ground_bird: .82, amphibian: .64, small_mammal: .5, predator: .22 }), [R('fiber', .66, 'seasonal', 'wet_peak', .84, ['ITEM_PLANT_FIBER'])], ['wetland_cover', 'nesting', 'fiber']),
  ravine: P('ravine', ['cross', 'survey', 'gather_water'], G(1.78, .86, .2, .04, .82, .38), E(.36, .72, .52, .46, .7, .36, .16, .68, .58, { reptile: .5, small_mammal: .44, bat: .26 }), [R('fresh_water', .22, 'seasonal', 'wet_peak', .44), R('stone', .36, 'finite', 'year_round', .28, ['ITEM_STONE'])], ['terrain_barrier', 'microclimate']),
  cliff_face: P('cliff_face', ['climb', 'survey', 'observe_wildlife'], G(2.1, .92, .08, .01, .94, .94), E(.12, .18, .04, .54, .62, .2, .02, .18, .72, { raptor: .82, canopy_bird: .32, reptile: .34 }), [R('stone', .58, 'finite', 'year_round', .42, ['ITEM_STONE', 'ITEM_FLAT_STONE'])], ['cliff', 'hazard', 'lookout']),
  boulder_field: P('boulder_field', ['gather_material', 'cross', 'shelter'], G(1.76, .66, .34, .02, .72, .72), E(.16, .5, .08, .3, .64, .34, .02, .34, .46, { reptile: .68, small_mammal: .38, invertebrate: .28 }), [R('stone', .9, 'finite', 'year_round', .56, ['ITEM_SMALL_STONE', 'ITEM_STONE', 'ITEM_LARGE_STONE'])], ['rock', 'material', 'rough_ground']),
  landslide_scar: P('landslide_scar', ['gather_material', 'cross', 'survey'], G(1.9, .8, .02, .02, .9, .92), E(.28, .08, .16, .12, .04, .4, .02, .3, .74, { reptile: .28, ground_bird: .18 }), [R('stone', .56, 'finite', 'year_round', .48, ['ITEM_STONE', 'ITEM_LARGE_STONE']), R('timber', .3, 'episodic', 'storm_event', .34, ['ITEM_BRANCH', 'ITEM_LOG'])], ['disturbed_terrain', 'hazard']),
  sinkhole: P('sinkhole', ['explore_cave', 'survey', 'gather_water'], G(1.86, .72, .18, .01, .94, .18), E(.22, .68, .48, .58, .62, .3, .16, .58, .76, { bat: .5, reptile: .5, amphibian: .34, invertebrate: .56 }), [R('fresh_water', .24, 'seasonal', 'wet_peak', .56), R('stone', .32, 'finite', 'year_round', .3, ['ITEM_STONE'])], ['karst', 'hazard', 'sink']),
  limestone_pinnacle: P('limestone_pinnacle', ['climb', 'survey'], G(2.0, .98, .06, .01, .92, 1), E(.08, .12, .02, .36, .38, .12, .01, .12, .7, { raptor: .7, reptile: .32 }), [R('stone', .7, 'finite', 'year_round', .54, ['ITEM_STONE'])], ['karst', 'landmark', 'lookout']),
  cave_mouth: P('cave_mouth', ['explore_cave', 'shelter', 'survey'], G(1.22, .72, .84, .34, .48, .2), E(.2, .84, .3, .76, .82, .38, .08, .62, .82, { bat: .86, reptile: .62, invertebrate: .48, predator: .28 }), [R('stone', .32, 'finite', 'year_round', .28, ['ITEM_STONE'])], ['cave', 'shelter', 'denning']),
  talus_slope: P('talus_slope', ['gather_material', 'cross', 'survey'], G(1.92, .76, .1, .01, .88, .82), E(.1, .3, .04, .22, .46, .22, .01, .24, .5, { reptile: .66, small_mammal: .28 }), [R('stone', .88, 'finite', 'year_round', .5, ['ITEM_SMALL_STONE', 'ITEM_STONE'])], ['unstable', 'rock', 'hazard']),
  rock_outcrop: P('rock_outcrop', ['gather_material', 'survey', 'camp'], G(1.08, .82, .16, .42, .18, .94), E(.12, .16, .04, .2, .14, .34, .01, .16, .34, { reptile: .52, raptor: .24 }), [R('stone', .78, 'finite', 'year_round', .44, ['ITEM_SMALL_STONE', 'ITEM_STONE', 'ITEM_FLAT_STONE'])], ['rock', 'lookout', 'material']),
  erosion_gully: P('erosion_gully', ['cross', 'gather_material', 'survey'], G(1.46, .62, .04, .04, .56, .66), E(.26, .3, .32, .22, .24, .46, .08, .46, .54, { reptile: .36, small_mammal: .24 }), [R('clay', .34, 'slow', 'wet_peak', .48, ['ITEM_CLAY']), R('stone', .34, 'slow', 'year_round', .28, ['ITEM_PEBBLE', 'ITEM_SMALL_STONE'])], ['erosion', 'sediment', 'travel_hazard']),
  bamboo_thicket: P('bamboo_thicket', ['gather_material', 'forage_food', 'shelter'], G(1.38, .42, .48, .5, .18, .14), E(.7, .9, .26, .72, .82, .48, .02, .72, .86, { small_mammal: .72, ground_bird: .5, omnivore: .46, predator: .3 }), [R('bamboo', .96, 'continuous', 'wet_peak', .82, ['ITEM_BAMBOO_SHOOT', 'ITEM_BAMBOO_POLE']), R('fiber', .48, 'continuous', 'year_round', .58, ['ITEM_BAMBOO_STRIP'])], ['bamboo', 'material', 'cover']),
  palm_grove: P('palm_grove', ['forage_food', 'gather_material', 'camp'], G(.92, .5, .3, .68, .14, .72), E(.66, .5, .26, .46, .28, .48, .02, .7, .7, { ground_bird: .38, small_mammal: .4, omnivore: .48 }), [R('fruit', .7, 'seasonal', 'fruiting', .68), R('fiber', .8, 'continuous', 'year_round', .7, ['ITEM_PALM_LEAF', 'ITEM_LARGE_PALM_LEAF', 'ITEM_PALM_FIBER'])], ['palm', 'food', 'roofing']),
  fern_gully: P('fern_gully', ['forage_food', 'forage_medicine', 'observe_wildlife'], G(1.32, .4, .18, .14, .22, .18), E(.72, .92, .7, .78, .86, .38, .24, .92, .92, { amphibian: .76, invertebrate: .9, small_mammal: .48 }), [R('edible_plants', .42, 'seasonal', 'wet_peak', .76), R('medicinal_plants', .4, 'seasonal', 'wet_peak', .88)], ['moist_understory', 'forage', 'sensitive']),
  vine_tangle: P('vine_tangle', ['gather_material', 'cross'], G(1.72, .24, .2, .04, .3, .06), E(.46, .98, .28, .58, .9, .38, .02, .72, .82, { small_mammal: .64, reptile: .5, invertebrate: .56 }), [R('fiber', .9, 'continuous', 'wet_peak', .78, ['ITEM_VINE', 'ITEM_LONG_VINE', 'ITEM_PLANT_FIBER'])], ['fiber', 'dense_cover', 'travel_barrier']),
  strangler_fig: P('strangler_fig', ['forage_food', 'observe_wildlife', 'survey'], G(1.1, .68, .34, .26, .16, .26), E(.94, .9, .2, .8, .72, .7, .02, .84, .94, { canopy_bird: .9, bat: .82, small_mammal: .64, omnivore: .62, predator: .36 }), [R('fruit', .88, 'seasonal', 'fruiting', .9)], ['keystone_food', 'tree', 'wildlife_focus']),
  moss_grove: P('moss_grove', ['forage_medicine', 'observe_wildlife'], G(1.2, .34, .18, .1, .14, .12), E(.42, .82, .7, .66, .72, .22, .18, .98, .92, { amphibian: .66, invertebrate: .9, small_mammal: .28 }), [R('medicinal_plants', .28, 'slow', 'wet_peak', .86)], ['humid', 'decomposer_hotspot', 'sensitive']),
  epiphyte_grove: P('epiphyte_grove', ['forage_medicine', 'observe_wildlife'], G(1.18, .46, .1, .08, .12, .18), E(.64, .86, .38, .82, .7, .38, .04, .88, .96, { canopy_bird: .74, invertebrate: .86, amphibian: .42 }), [R('medicinal_plants', .42, 'slow', 'wet_peak', .94)], ['epiphyte', 'canopy_microhabitat', 'sensitive']),
  forest_glade: P('forest_glade', ['forage_food', 'camp', 'survey'], G(.84, .72, .08, .78, .12, .92), E(.8, .28, .24, .5, .14, .66, .02, .66, .74, { large_herbivore: .58, ground_bird: .56, omnivore: .46, predator: .4 }), [R('edible_plants', .6, 'seasonal', 'wet_peak', .72)], ['clearing', 'forage', 'camp_candidate']),
  rattan_thicket: P('rattan_thicket', ['gather_material', 'cross'], G(1.64, .24, .16, .04, .34, .08), E(.42, .94, .3, .58, .88, .36, .02, .72, .88, { small_mammal: .54, reptile: .48, invertebrate: .46 }), [R('fiber', .92, 'slow', 'wet_peak', .92, ['ITEM_PLANT_FIBER'])], ['fiber', 'dense_cover', 'thorny']),
  wild_tuber_patch: P('wild_tuber_patch', ['forage_food'], G(.96, .24, .02, .38, .1, .46), E(.86, .34, .26, .42, .24, .58, .02, .64, .9, { omnivore: .56, large_herbivore: .38, small_mammal: .42 }), [R('tubers', .9, 'seasonal', 'wet_peak', .94)], ['food', 'root_crop', 'sensitive']),
  resin_grove: P('resin_grove', ['gather_material', 'gather_fuel'], G(1.04, .42, .18, .32, .14, .38), E(.38, .64, .16, .5, .4, .32, .01, .62, .82, { invertebrate: .46, canopy_bird: .3 }), [R('resin', .88, 'slow', 'year_round', .9, ['ITEM_RESIN', 'ITEM_TREE_SAP'])], ['resin', 'material', 'slow_regrowth']),
  mushroom_deadwood: P('mushroom_deadwood', ['forage_food', 'observe_wildlife'], G(1.08, .24, .1, .12, .2, .08), E(.54, .68, .42, .52, .54, .26, .02, 1, .9, { invertebrate: .96, small_mammal: .3 }), [R('mushrooms', .86, 'seasonal', 'wet_peak', .92)], ['fungal', 'decomposer_hotspot', 'food']),
  animal_wallow: P('animal_wallow', ['hunt', 'trap', 'observe_wildlife'], G(1.26, .54, .02, .02, .34, .5), E(.54, .24, .64, .32, .04, .88, .16, .66, .72, { large_herbivore: .76, omnivore: .88, predator: .72, ground_bird: .24 }), [R('manure', .46, 'continuous', 'year_round', .2, ['ITEM_MANURE'])], ['wildlife_focus', 'hunting', 'mud']),
  mineral_lick: P('mineral_lick', ['hunt', 'observe_wildlife', 'gather_material'], G(.98, .62, .02, .04, .18, .72), E(.36, .18, .22, .18, .02, .94, .02, .3, .82, { large_herbivore: .92, omnivore: .62, predator: .76 }), [R('mineral', .64, 'slow', 'year_round', .7)], ['wildlife_focus', 'mineral', 'hunting']),
  burrow_colony: P('burrow_colony', ['trap', 'observe_wildlife'], G(1.08, .3, .04, .02, .18, .2), E(.48, .86, .12, .98, 1, .42, .02, .56, .96, { small_mammal: 1, reptile: .42, predator: .46 }), [], ['prey_refuge', 'breeding_colony', 'sensitive']),
  nesting_cliff: P('nesting_cliff', ['observe_wildlife', 'climb'], G(1.96, .84, .02, .01, .92, .96), E(.18, .12, .06, 1, .92, .24, .02, .22, .98, { raptor: .9, canopy_bird: .64, ground_bird: .3 }), [R('wild_eggs', .3, 'seasonal', 'irregular', 1), R('feathers' as LocalSiteResourceKind, .26, 'seasonal', 'irregular', .8)], ['nesting', 'cliff', 'sensitive']),
  bat_roost: P('bat_roost', ['observe_wildlife', 'explore_cave'], G(1.24, .42, .28, .02, .38, .06), E(.26, .82, .18, .98, .92, .3, .02, .9, .98, { bat: 1, invertebrate: .46, predator: .2 }), [R('manure', .66, 'continuous', 'year_round', .72, ['ITEM_MANURE'])], ['roost', 'cave', 'sensitive']),
  roost_tree: P('roost_tree', ['observe_wildlife', 'survey'], G(1.04, .58, .24, .12, .08, .3), E(.42, .9, .16, .92, .7, .38, .02, .78, .98, { canopy_bird: 1, bat: .48, predator: .2 }), [R('feathers' as LocalSiteResourceKind, .18, 'seasonal', 'irregular', .62)], ['roost', 'tree', 'sensitive']),
  feeding_ground: P('feeding_ground', ['hunt', 'observe_wildlife', 'forage_food'], G(.9, .56, .02, .16, .16, .78), E(.94, .28, .22, .42, .08, .92, .02, .62, .84, { large_herbivore: .7, omnivore: .72, small_mammal: .54, ground_bird: .52, predator: .68 }), [R('edible_plants', .44, 'seasonal', 'wet_peak', .64)], ['wildlife_focus', 'forage', 'hunting']),
  termite_mound: P('termite_mound', ['forage_food', 'observe_wildlife', 'gather_material'], G(1.02, .38, .02, .08, .12, .52), E(.52, .18, .08, .42, .18, .66, .02, .9, .72, { invertebrate: 1, omnivore: .54, ground_bird: .58, reptile: .38 }), [R('insects', .9, 'continuous', 'year_round', .76), R('clay', .28, 'slow', 'year_round', .72, ['ITEM_CLAY'])], ['insects', 'food_web', 'soil']),
  bee_tree: P('bee_tree', ['forage_food', 'observe_wildlife'], G(1.04, .34, .08, .04, .48, .16), E(.66, .62, .12, .72, .5, .36, .02, .66, .98, { invertebrate: .96, canopy_bird: .24, omnivore: .36 }), [R('honey', .82, 'seasonal', 'fruiting', .98)], ['pollinator', 'food', 'hazard']),
  predator_den: P('predator_den', ['observe_wildlife', 'hunt', 'shelter'], G(1.2, .38, .3, .02, .86, .16), E(.2, .86, .2, .9, .22, 1, .02, .58, .96, { predator: 1, scavenger: .42, small_mammal: -.4 as number }), [], ['predator', 'den', 'hazard', 'sensitive']),
  amphibian_breeding_pool: P('amphibian_breeding_pool', ['observe_wildlife'], G(1.2, .32, .02, .01, .18, .18), E(.48, .72, .94, 1, .78, .28, .96, .96, 1, { amphibian: 1, invertebrate: .86, reptile: .28 }), [R('insects', .48, 'seasonal', 'wet_peak', .84)], ['breeding_pool', 'amphibian', 'sensitive']),
  reptile_basking_ledge: P('reptile_basking_ledge', ['observe_wildlife', 'survey'], G(1.16, .52, .02, .04, .34, .92), E(.16, .1, .04, .4, .18, .58, .01, .14, .62, { reptile: .96, raptor: .26, predator: .18 }), [R('stone', .2, 'finite', 'year_round', .18, ['ITEM_FLAT_STONE'])], ['reptile', 'sunlight', 'rock']),
  boar_rooting_ground: P('boar_rooting_ground', ['hunt', 'forage_food', 'observe_wildlife'], G(1.08, .4, .02, .12, .18, .52), E(.7, .24, .24, .26, .02, .86, .01, .78, .72, { omnivore: .96, predator: .66, ground_bird: .34, invertebrate: .44 }), [R('tubers', .42, 'seasonal', 'wet_peak', .64), R('insects', .36, 'continuous', 'year_round', .42)], ['wildlife_focus', 'disturbed_soil', 'hunting']),
  sandbar: P('sandbar', ['cross', 'fish', 'survey'], G(.88, .82, .02, .1, .18, 1), E(.2, .02, .58, .34, .02, .48, .32, .18, .62, { ground_bird: .52, reptile: .3, fish: .26 }), [R('sand', .96, 'slow', 'year_round', .34, ['ITEM_SAND', 'ITEM_WET_SAND']), R('fish', .24, 'tidal', 'tidal_cycle', .48)], ['coastal', 'crossing', 'open_ground']),
  driftwood_bank: P('driftwood_bank', ['gather_material', 'gather_fuel', 'salvage'], G(.92, .68, .18, .48, .14, .9), E(.2, .18, .22, .18, .12, .34, .04, .54, .38, { invertebrate: .4, scavenger: .24 }), [R('driftwood', .94, 'episodic', 'storm_event', .28, ['ITEM_DRIFTWOOD', 'ITEM_DRIFTWOOD_BRANCH'])], ['coastal', 'wood', 'storm_deposit']),
  shell_bank: P('shell_bank', ['forage_food', 'gather_material'], G(.92, .46, .02, .06, .12, .96), E(.3, .04, .44, .36, .02, .42, .34, .28, .68, { invertebrate: .68, ground_bird: .38 }), [R('shells', .9, 'tidal', 'tidal_cycle', .54, ['ITEM_SHELL', 'ITEM_LARGE_SHELL']), R('shellfish', .42, 'tidal', 'tidal_cycle', .84)], ['coastal', 'shell', 'forage']),
  mangrove_rookery: P('mangrove_rookery', ['observe_wildlife'], G(1.52, .42, .02, .01, .42, .12), E(.5, .94, .82, 1, .9, .34, .6, .9, 1, { ground_bird: .98, canopy_bird: .72, reptile: .42, invertebrate: .58 }), [R('wild_eggs', .28, 'seasonal', 'irregular', 1), R('feathers' as LocalSiteResourceKind, .24, 'seasonal', 'irregular', .88)], ['rookery', 'mangrove', 'sensitive']),
  sea_cave: P('sea_cave', ['explore_cave', 'shelter', 'survey'], G(1.48, .76, .7, .08, .78, .14), E(.18, .64, .52, .62, .6, .28, .28, .48, .78, { bat: .52, invertebrate: .58, reptile: .28, ground_bird: .24 }), [R('shells', .26, 'tidal', 'tidal_cycle', .38, ['ITEM_SHELL'])], ['coastal', 'cave', 'shelter']),
  beach_nest: P('beach_nest', ['observe_wildlife'], G(.94, .52, .02, .01, .12, .98), E(.14, .04, .12, 1, .72, .46, .02, .24, 1, { ground_bird: .84, reptile: .58, predator: .36 }), [R('wild_eggs', .22, 'seasonal', 'irregular', 1)], ['nesting', 'coastal', 'sensitive']),
  flood_debris_field: P('flood_debris_field', ['salvage', 'gather_material', 'cross'], G(1.48, .54, .18, .08, .58, .54), E(.34, .54, .62, .28, .32, .42, .12, .9, .54, { invertebrate: .68, small_mammal: .32, scavenger: .42 }), [R('timber', .58, 'episodic', 'storm_event', .34, ['ITEM_BRANCH', 'ITEM_LOG']), R('salvage', .28, 'episodic', 'storm_event', .18)], ['flood', 'debris', 'episodic']),
  stormfall: P('stormfall', ['gather_material', 'gather_fuel', 'cross'], G(1.62, .62, .2, .18, .6, .64), E(.46, .5, .2, .34, .38, .54, .02, .96, .62, { invertebrate: .82, small_mammal: .38, ground_bird: .32, predator: .3 }), [R('timber', .92, 'episodic', 'storm_event', .46, ['ITEM_BRANCH', 'ITEM_LOG', 'ITEM_HARDWOOD_LOG'])], ['storm', 'deadwood', 'disturbance']),
  fallen_log_jam: P('fallen_log_jam', ['cross', 'gather_material', 'fish'], G(1.84, .66, .28, .02, .7, .4), E(.52, .58, .92, .66, .54, .58, .72, .94, .72, { fish: .62, amphibian: .58, invertebrate: .82, small_mammal: .3 }), [R('timber', .62, 'episodic', 'storm_event', .44, ['ITEM_BRANCH', 'ITEM_LOG']), R('fish', .34, 'continuous', 'year_round', .56)], ['stream_barrier', 'deadwood', 'aquatic_cover']),
} satisfies Record<LocalSiteType, LocalSiteFunctionalProfile>;

/**
 * A compact patch-level signal layer. It deliberately does not alter live ecology yet;
 * later fauna/resource/travel systems can consume these normalized signals without
 * re-encoding site names or bespoke if-statements.
 */
export interface LocalSitePatchInfluence {
  siteCount: number;
  forage: number;
  cover: number;
  water: number;
  breedingHabitat: number;
  preyRefuge: number;
  predatorOpportunity: number;
  aquaticNursery: number;
  decomposition: number;
  disturbanceSensitivity: number;
  shelterQuality: number;
  campSuitability: number;
  hazard: number;
  navigationValue: number;
  resourcePotential: Partial<Record<LocalSiteResourceKind, number>>;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function getLocalSiteFunctionalProfile(type: LocalSiteType): LocalSiteFunctionalProfile {
  return LOCAL_SITE_FUNCTIONAL_PROFILES[type];
}

export function aggregateLocalSiteInfluenceByPatch(
  sites: readonly GeneratedLocalSite[],
): Readonly<Record<string, LocalSitePatchInfluence>> {
  const buckets: Record<string, { weight: number; result: LocalSitePatchInfluence }> = {};

  for (const site of sites) {
    const profile = getLocalSiteFunctionalProfile(site.type);
    const weight = Math.max(.15, Math.min(1, site.radiusMeters / 100));
    const bucket = buckets[site.patchId] ?? {
      weight: 0,
      result: {
        siteCount: 0,
        forage: 0,
        cover: 0,
        water: 0,
        breedingHabitat: 0,
        preyRefuge: 0,
        predatorOpportunity: 0,
        aquaticNursery: 0,
        decomposition: 0,
        disturbanceSensitivity: 0,
        shelterQuality: 0,
        campSuitability: 0,
        hazard: 0,
        navigationValue: 0,
        resourcePotential: {},
      },
    };
    bucket.weight += weight;
    bucket.result.siteCount += 1;
    bucket.result.forage += profile.ecology.forage * weight;
    bucket.result.cover += profile.ecology.cover * weight;
    bucket.result.water += profile.ecology.water * weight;
    bucket.result.breedingHabitat += profile.ecology.breedingHabitat * weight;
    bucket.result.preyRefuge += profile.ecology.preyRefuge * weight;
    bucket.result.predatorOpportunity += profile.ecology.predatorOpportunity * weight;
    bucket.result.aquaticNursery += profile.ecology.aquaticNursery * weight;
    bucket.result.decomposition += profile.ecology.decomposition * weight;
    bucket.result.disturbanceSensitivity += profile.ecology.disturbanceSensitivity * weight;
    bucket.result.shelterQuality += profile.gameplay.shelterQuality * weight;
    bucket.result.campSuitability += profile.gameplay.campSuitability * weight;
    bucket.result.hazard += profile.gameplay.hazard * weight;
    bucket.result.navigationValue += profile.gameplay.navigationValue * weight;
    for (const resource of profile.resources) {
      bucket.result.resourcePotential[resource.kind] = Math.max(
        bucket.result.resourcePotential[resource.kind] ?? 0,
        resource.abundance * weight,
      );
    }
    buckets[site.patchId] = bucket;
  }

  const output: Record<string, LocalSitePatchInfluence> = {};
  for (const [patchId, bucket] of Object.entries(buckets)) {
    const w = Math.max(.0001, bucket.weight);
    const result = bucket.result;
    output[patchId] = Object.freeze({
      ...result,
      forage: clamp01(result.forage / w),
      cover: clamp01(result.cover / w),
      water: clamp01(result.water / w),
      breedingHabitat: clamp01(result.breedingHabitat / w),
      preyRefuge: clamp01(result.preyRefuge / w),
      predatorOpportunity: clamp01(result.predatorOpportunity / w),
      aquaticNursery: clamp01(result.aquaticNursery / w),
      decomposition: clamp01(result.decomposition / w),
      disturbanceSensitivity: clamp01(result.disturbanceSensitivity / w),
      shelterQuality: clamp01(result.shelterQuality / w),
      campSuitability: clamp01(result.campSuitability / w),
      hazard: clamp01(result.hazard / w),
      navigationValue: clamp01(result.navigationValue / w),
      resourcePotential: Object.freeze({ ...result.resourcePotential }),
    });
  }
  return Object.freeze(output);
}

export const ALL_LOCAL_SITE_TYPES: readonly LocalSiteType[] = Object.freeze([
  ...REQUIRED_LOCAL_SITE_TYPES,
  ...NATURAL_LOCAL_SITE_TYPES,
]);
