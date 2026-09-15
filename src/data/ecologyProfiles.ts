import type { MainWorldAreaId } from './mainWorldAreas';
import type { EcologySubareaKind } from '../types/ecologySimulation';

export interface EcologyTargetProfile {
  canopy?: number;
  moisture?: number;
  waterAccess?: number;
  slope?: number;
  floodRisk?: number;
  sunlight?: number;
  rocks?: number;
  fertileSoil?: number;
  vegetation?: number;
}

export interface EcologySubareaArchetype {
  id: string;
  name: string;
  kind: EcologySubareaKind;
  targets: EcologyTargetProfile;
  tolerance: number;
  resourceBias?: Partial<Record<'fruit' | 'edible' | 'medicinal' | 'timber' | 'freshwater', number>>;
}

export interface WeightedArchetype {
  archetypeId: string;
  weight: number;
  minCount?: number;
  maxCount?: number;
}

export interface WeightedFloraSpecies {
  speciesId: string;
  weight: number;
}

export interface EcologyRegionProfile {
  id: string;
  poiId: MainWorldAreaId;
  minSubareas: number;
  maxSubareas: number;
  productivity: number;
  biodiversityPotential: number;
  archetypes: WeightedArchetype[];
  flora: WeightedFloraSpecies[];
}

export interface WildFloraSpeciesDefinition {
  id: string;
  name: string;
  form: 'tree' | 'palm' | 'clump' | 'shrub' | 'herb' | 'fern' | 'reed' | 'guild';
  targets: EcologyTargetProfile;
  tolerance: number;
  baseBiomassKg: number;
  biomassSpread: number;
  densityPer100M2: number;
  growthPerDay: number;
  fruitKgPer100Biomass: number;
  seedBankRate: number;
  significantIndividualChance: number;
}

export const ECOLOGY_SUBAREA_ARCHETYPES: Record<string, EcologySubareaArchetype> = {
  CAVE_TWILIGHT: { id: 'CAVE_TWILIGHT', name: 'Twilight Chamber', kind: 'physical', targets: { canopy: 100, sunlight: 8, moisture: 62, rocks: 82 }, tolerance: 28, resourceBias: { freshwater: 10 } },
  CAVE_POOL: { id: 'CAVE_POOL', name: 'Underground Pool', kind: 'physical', targets: { canopy: 100, sunlight: 1, moisture: 88, waterAccess: 90, rocks: 72 }, tolerance: 25, resourceBias: { freshwater: 55 } },
  CAVE_ROOT_CRACK: { id: 'CAVE_ROOT_CRACK', name: 'Root-filled Karst Crack', kind: 'ecological', targets: { canopy: 95, moisture: 66, vegetation: 22, rocks: 72 }, tolerance: 32, resourceBias: { medicinal: 8 } },
  CAVE_GUANO: { id: 'CAVE_GUANO', name: 'Guano Floor', kind: 'ecological', targets: { sunlight: 0, moisture: 56, fertileSoil: 36, rocks: 70 }, tolerance: 34 },

  CLOUD_FOREST: { id: 'CLOUD_FOREST', name: 'Cloud Forest Pocket', kind: 'ecological', targets: { canopy: 68, moisture: 68, sunlight: 38, slope: 18, vegetation: 64 }, tolerance: 34, resourceBias: { medicinal: 18, timber: 10 } },
  WIND_RIDGE: { id: 'WIND_RIDGE', name: 'Wind-scoured Ridge', kind: 'physical', targets: { canopy: 15, moisture: 24, sunlight: 82, slope: 30, rocks: 78 }, tolerance: 33 },
  FERN_MEADOW: { id: 'FERN_MEADOW', name: 'Highland Fern Meadow', kind: 'ecological', targets: { canopy: 22, moisture: 58, sunlight: 62, vegetation: 70 }, tolerance: 34, resourceBias: { edible: 12, medicinal: 18 } },
  MOUNTAIN_SEEP: { id: 'MOUNTAIN_SEEP', name: 'Mountain Seep', kind: 'physical', targets: { moisture: 82, waterAccess: 76, slope: 22, rocks: 58 }, tolerance: 28, resourceBias: { freshwater: 45, medicinal: 10 } },
  CLIFF_NEST: { id: 'CLIFF_NEST', name: 'Cliff Nesting Ledge', kind: 'ecological', targets: { canopy: 8, sunlight: 80, slope: 42, rocks: 88 }, tolerance: 28 },

  BAMBOO_THICKET: { id: 'BAMBOO_THICKET', name: 'Dense Bamboo Thicket', kind: 'ecological', targets: { canopy: 68, moisture: 58, fertileSoil: 64, vegetation: 88 }, tolerance: 30, resourceBias: { timber: 34, edible: 8 } },
  BAMBOO_EXPANSION: { id: 'BAMBOO_EXPANSION', name: 'Young Bamboo Expansion', kind: 'ecological', targets: { canopy: 45, sunlight: 52, moisture: 54, vegetation: 72 }, tolerance: 38, resourceBias: { timber: 22, edible: 15 } },
  STREAM_TERRACE: { id: 'STREAM_TERRACE', name: 'Stream Terrace', kind: 'physical', targets: { moisture: 74, waterAccess: 82, fertileSoil: 72, slope: 8 }, tolerance: 30, resourceBias: { freshwater: 40, edible: 12 } },
  LANDSLIDE_SCAR: { id: 'LANDSLIDE_SCAR', name: 'Landslide Scar', kind: 'ephemeral', targets: { canopy: 15, sunlight: 82, slope: 32, rocks: 62, vegetation: 24 }, tolerance: 34 },

  RUIN_COURTYARD: { id: 'RUIN_COURTYARD', name: 'Overgrown Courtyard', kind: 'physical', targets: { canopy: 45, sunlight: 52, rocks: 60, vegetation: 58 }, tolerance: 40, resourceBias: { medicinal: 8 } },
  ROOT_WALL: { id: 'ROOT_WALL', name: 'Root-covered Wall', kind: 'ecological', targets: { canopy: 62, moisture: 58, rocks: 70, vegetation: 70 }, tolerance: 36 },
  DRY_CISTERN: { id: 'DRY_CISTERN', name: 'Dry Cistern', kind: 'physical', targets: { waterAccess: 34, moisture: 40, rocks: 76, canopy: 28 }, tolerance: 42 },

  BEACH_STRAND: { id: 'BEACH_STRAND', name: 'Beach Strand', kind: 'physical', targets: { canopy: 8, moisture: 28, sunlight: 92, rocks: 24, vegetation: 18 }, tolerance: 35, resourceBias: { edible: 8 } },
  COCONUT_FRINGE: { id: 'COCONUT_FRINGE', name: 'Coconut Fringe', kind: 'ecological', targets: { canopy: 38, moisture: 40, sunlight: 72, vegetation: 48 }, tolerance: 38, resourceBias: { fruit: 40, timber: 8 } },
  WRECK_SCRUB: { id: 'WRECK_SCRUB', name: 'Wreck Scrub Clearing', kind: 'ecological', targets: { canopy: 18, sunlight: 76, vegetation: 40, debris: 0 } as EcologyTargetProfile, tolerance: 42, resourceBias: { edible: 8 } },
  DRAINAGE_HOLLOW: { id: 'DRAINAGE_HOLLOW', name: 'Drainage Hollow', kind: 'physical', targets: { moisture: 74, floodRisk: 62, waterAccess: 56, vegetation: 58 }, tolerance: 34, resourceBias: { freshwater: 18, medicinal: 8 } },

  TIDAL_CREEK: { id: 'TIDAL_CREEK', name: 'Tidal Creek', kind: 'physical', targets: { moisture: 94, waterAccess: 96, floodRisk: 90, canopy: 42 }, tolerance: 24, resourceBias: { freshwater: 14 } },
  MANGROVE_ROOT_MAZE: { id: 'MANGROVE_ROOT_MAZE', name: 'Mangrove Root Maze', kind: 'ecological', targets: { canopy: 66, moisture: 94, floodRisk: 86, vegetation: 82, waterAccess: 92 }, tolerance: 26, resourceBias: { timber: 14 } },
  MUDFLAT: { id: 'MUDFLAT', name: 'Tidal Mudflat', kind: 'physical', targets: { canopy: 5, sunlight: 84, moisture: 92, floodRisk: 90, vegetation: 15 }, tolerance: 30 },
  BRACKISH_POOL: { id: 'BRACKISH_POOL', name: 'Brackish Pool', kind: 'physical', targets: { moisture: 98, waterAccess: 98, floodRisk: 88, vegetation: 30 }, tolerance: 22 },
  DRY_HUMMOCK: { id: 'DRY_HUMMOCK', name: 'Mangrove Dry Hummock', kind: 'physical', targets: { moisture: 58, floodRisk: 42, canopy: 48, vegetation: 62 }, tolerance: 36, resourceBias: { fruit: 6 } },

  OLD_GROWTH: { id: 'OLD_GROWTH', name: 'Old-growth Canopy', kind: 'ecological', targets: { canopy: 94, moisture: 70, sunlight: 16, fertileSoil: 68, vegetation: 88 }, tolerance: 26, resourceBias: { timber: 42, medicinal: 10 } },
  KAPOK_GROVE: { id: 'KAPOK_GROVE', name: 'Kapok Grove', kind: 'ecological', targets: { canopy: 86, moisture: 64, fertileSoil: 72, vegetation: 82 }, tolerance: 30, resourceBias: { timber: 28, fruit: 8 } },
  FRUIT_CLEARING: { id: 'FRUIT_CLEARING', name: 'Fruit-rich Clearing', kind: 'ecological', targets: { canopy: 40, sunlight: 60, fertileSoil: 78, moisture: 62, vegetation: 72 }, tolerance: 35, resourceBias: { fruit: 48, edible: 28 } },
  VINE_THICKET: { id: 'VINE_THICKET', name: 'Dense Vine Thicket', kind: 'ecological', targets: { canopy: 76, moisture: 74, sunlight: 25, vegetation: 94 }, tolerance: 30, resourceBias: { medicinal: 8 } },
  SHADED_CREEK: { id: 'SHADED_CREEK', name: 'Shaded Creek', kind: 'physical', targets: { canopy: 78, moisture: 88, waterAccess: 92, sunlight: 20, vegetation: 72 }, tolerance: 26, resourceBias: { freshwater: 55, medicinal: 12 } },
  FERN_HOLLOW: { id: 'FERN_HOLLOW', name: 'Fern Hollow', kind: 'ecological', targets: { canopy: 72, moisture: 82, sunlight: 25, fertileSoil: 76, vegetation: 80 }, tolerance: 28, resourceBias: { edible: 14, medicinal: 26 } },
  FALLEN_GIANT_GAP: { id: 'FALLEN_GIANT_GAP', name: 'Fallen Giant Gap', kind: 'ephemeral', targets: { canopy: 34, sunlight: 68, debris: 0, vegetation: 54 } as EcologyTargetProfile, tolerance: 40, resourceBias: { timber: 22 } },
  ANIMAL_TRAIL: { id: 'ANIMAL_TRAIL', name: 'Animal Trail', kind: 'ephemeral', targets: { canopy: 62, moisture: 58, vegetation: 55 }, tolerance: 50 },
  MEDICINAL_GLADE: { id: 'MEDICINAL_GLADE', name: 'Medicinal Glade', kind: 'ecological', targets: { canopy: 58, moisture: 72, sunlight: 38, fertileSoil: 84, vegetation: 72 }, tolerance: 30, resourceBias: { medicinal: 60, edible: 8 } },
  BAMBOO_POCKET: { id: 'BAMBOO_POCKET', name: 'Bamboo Pocket', kind: 'ecological', targets: { canopy: 68, moisture: 62, vegetation: 85, fertileSoil: 68 }, tolerance: 32, resourceBias: { timber: 28 } },

  FLOODED_GROVE: { id: 'FLOODED_GROVE', name: 'Flooded Grove', kind: 'ecological', targets: { canopy: 74, moisture: 96, floodRisk: 92, waterAccess: 88, vegetation: 74 }, tolerance: 25, resourceBias: { timber: 12 } },
  SEASONAL_POOL: { id: 'SEASONAL_POOL', name: 'Seasonal Pool', kind: 'ephemeral', targets: { moisture: 98, floodRisk: 95, waterAccess: 95, canopy: 38 }, tolerance: 22, resourceBias: { freshwater: 25 } },
  BLACKWATER_CHANNEL: { id: 'BLACKWATER_CHANNEL', name: 'Blackwater Channel', kind: 'physical', targets: { moisture: 100, floodRisk: 94, waterAccess: 100, canopy: 62 }, tolerance: 20 },
  RAISED_REFUGE: { id: 'RAISED_REFUGE', name: 'Raised Refuge', kind: 'physical', targets: { moisture: 58, floodRisk: 36, canopy: 62, vegetation: 72 }, tolerance: 38, resourceBias: { fruit: 8 } },
  REED_BED: { id: 'REED_BED', name: 'Reed Bed', kind: 'ecological', targets: { canopy: 18, sunlight: 72, moisture: 92, floodRisk: 82, vegetation: 88 }, tolerance: 28, resourceBias: { edible: 8 } },

  FAST_RIFFLE: { id: 'FAST_RIFFLE', name: 'Fast Riffle', kind: 'physical', targets: { waterAccess: 100, moisture: 90, rocks: 68, slope: 16 }, tolerance: 24, resourceBias: { freshwater: 45 } },
  DEEP_POOL: { id: 'DEEP_POOL', name: 'Deep Pool', kind: 'physical', targets: { waterAccess: 100, moisture: 98, floodRisk: 72, rocks: 44 }, tolerance: 24, resourceBias: { freshwater: 55 } },
  SPRAY_ZONE: { id: 'SPRAY_ZONE', name: 'Waterfall Spray Zone', kind: 'ecological', targets: { moisture: 96, waterAccess: 88, rocks: 70, vegetation: 68 }, tolerance: 25, resourceBias: { medicinal: 18, freshwater: 38 } },
  RIPARIAN_GROVE: { id: 'RIPARIAN_GROVE', name: 'Riparian Grove', kind: 'ecological', targets: { canopy: 68, moisture: 82, waterAccess: 84, fertileSoil: 80, vegetation: 78 }, tolerance: 28, resourceBias: { fruit: 12, timber: 14, freshwater: 25 } },
  GRAVEL_BAR: { id: 'GRAVEL_BAR', name: 'Gravel Bar', kind: 'physical', targets: { canopy: 8, sunlight: 86, moisture: 56, rocks: 72, waterAccess: 72 }, tolerance: 34 },
  SLOW_BACKWATER: { id: 'SLOW_BACKWATER', name: 'Slow Backwater', kind: 'physical', targets: { waterAccess: 95, moisture: 92, floodRisk: 70, canopy: 48 }, tolerance: 28, resourceBias: { freshwater: 42 } },

  TIDE_POOL: { id: 'TIDE_POOL', name: 'Tide Pool', kind: 'physical', targets: { waterAccess: 96, rocks: 86, canopy: 0, sunlight: 88, moisture: 76 }, tolerance: 26 },
  ROCK_PLATFORM: { id: 'ROCK_PLATFORM', name: 'Rock Platform', kind: 'physical', targets: { rocks: 92, canopy: 2, sunlight: 92, moisture: 32 }, tolerance: 28 },
  POCKET_BEACH: { id: 'POCKET_BEACH', name: 'Pocket Beach', kind: 'physical', targets: { canopy: 8, sunlight: 90, moisture: 28, rocks: 28, vegetation: 18 }, tolerance: 34 },
  COASTAL_SCRUB: { id: 'COASTAL_SCRUB', name: 'Coastal Scrub', kind: 'ecological', targets: { canopy: 24, sunlight: 72, moisture: 38, vegetation: 58 }, tolerance: 38, resourceBias: { edible: 8 } },
};

export const WILD_FLORA_SPECIES: Record<string, WildFloraSpeciesDefinition> = {
  FLORA_COCONUT_PALM: { id: 'FLORA_COCONUT_PALM', name: 'Coconut Palm', form: 'palm', targets: { canopy: 35, sunlight: 72, moisture: 42, waterAccess: 48 }, tolerance: 40, baseBiomassKg: 520, biomassSpread: 220, densityPer100M2: 2.5, growthPerDay: 0.035, fruitKgPer100Biomass: 2.8, seedBankRate: 1.5, significantIndividualChance: 0.12 },
  FLORA_KAPOK: { id: 'FLORA_KAPOK', name: 'Kapok', form: 'tree', targets: { canopy: 88, moisture: 66, fertileSoil: 68, vegetation: 82 }, tolerance: 34, baseBiomassKg: 1450, biomassSpread: 650, densityPer100M2: 0.65, growthPerDay: 0.018, fruitKgPer100Biomass: 0.15, seedBankRate: 1.2, significantIndividualChance: 0.18 },
  FLORA_BAMBOO: { id: 'FLORA_BAMBOO', name: 'Bamboo', form: 'clump', targets: { canopy: 62, moisture: 60, fertileSoil: 64, vegetation: 84 }, tolerance: 34, baseBiomassKg: 640, biomassSpread: 280, densityPer100M2: 3.5, growthPerDay: 0.12, fruitKgPer100Biomass: 0, seedBankRate: 0.4, significantIndividualChance: 0.08 },
  FLORA_WILD_BANANA: { id: 'FLORA_WILD_BANANA', name: 'Wild Banana', form: 'herb', targets: { canopy: 48, sunlight: 50, moisture: 72, fertileSoil: 78 }, tolerance: 36, baseBiomassKg: 210, biomassSpread: 100, densityPer100M2: 3.8, growthPerDay: 0.085, fruitKgPer100Biomass: 5.2, seedBankRate: 1.0, significantIndividualChance: 0.07 },
  FLORA_WILD_PAPAYA: { id: 'FLORA_WILD_PAPAYA', name: 'Wild Papaya', form: 'tree', targets: { canopy: 38, sunlight: 62, moisture: 56, fertileSoil: 72 }, tolerance: 42, baseBiomassKg: 160, biomassSpread: 80, densityPer100M2: 2.1, growthPerDay: 0.065, fruitKgPer100Biomass: 6.8, seedBankRate: 1.8, significantIndividualChance: 0.1 },
  FLORA_WILD_FIG: { id: 'FLORA_WILD_FIG', name: 'Wild Fig', form: 'tree', targets: { canopy: 76, moisture: 66, fertileSoil: 65 }, tolerance: 38, baseBiomassKg: 720, biomassSpread: 300, densityPer100M2: 1.1, growthPerDay: 0.03, fruitKgPer100Biomass: 4.6, seedBankRate: 2.0, significantIndividualChance: 0.12 },
  FLORA_HARDWOOD_CANOPY: { id: 'FLORA_HARDWOOD_CANOPY', name: 'Hardwood Canopy Tree', form: 'tree', targets: { canopy: 88, moisture: 62, vegetation: 82 }, tolerance: 36, baseBiomassKg: 1100, biomassSpread: 480, densityPer100M2: 1.5, growthPerDay: 0.022, fruitKgPer100Biomass: 0.2, seedBankRate: 0.8, significantIndividualChance: 0.1 },
  FLORA_BERRY_SHRUB: { id: 'FLORA_BERRY_SHRUB', name: 'Rainforest Berry Shrub', form: 'shrub', targets: { canopy: 44, sunlight: 52, moisture: 58, fertileSoil: 70 }, tolerance: 44, baseBiomassKg: 72, biomassSpread: 35, densityPer100M2: 7.5, growthPerDay: 0.07, fruitKgPer100Biomass: 8.5, seedBankRate: 2.4, significantIndividualChance: 0.025 },
  FLORA_MEDICINAL_FERN: { id: 'FLORA_MEDICINAL_FERN', name: 'Medicinal Fern', form: 'fern', targets: { canopy: 68, sunlight: 26, moisture: 78, fertileSoil: 72 }, tolerance: 34, baseBiomassKg: 48, biomassSpread: 24, densityPer100M2: 11, growthPerDay: 0.075, fruitKgPer100Biomass: 0, seedBankRate: 1.8, significantIndividualChance: 0.02 },
  FLORA_MEDICINAL_ORCHID: { id: 'FLORA_MEDICINAL_ORCHID', name: 'Medicinal Orchid', form: 'herb', targets: { canopy: 64, sunlight: 34, moisture: 74, fertileSoil: 66 }, tolerance: 28, baseBiomassKg: 12, biomassSpread: 7, densityPer100M2: 4.2, growthPerDay: 0.035, fruitKgPer100Biomass: 0, seedBankRate: 0.65, significantIndividualChance: 0.09 },
  FLORA_WILD_TARO: { id: 'FLORA_WILD_TARO', name: 'Wild Taro', form: 'herb', targets: { canopy: 42, sunlight: 48, moisture: 88, waterAccess: 76, fertileSoil: 76 }, tolerance: 32, baseBiomassKg: 95, biomassSpread: 48, densityPer100M2: 7, growthPerDay: 0.09, fruitKgPer100Biomass: 0, seedBankRate: 1.1, significantIndividualChance: 0.03 },
  FLORA_WETLAND_REED: { id: 'FLORA_WETLAND_REED', name: 'Wetland Reed', form: 'reed', targets: { canopy: 18, sunlight: 70, moisture: 94, floodRisk: 84, waterAccess: 82 }, tolerance: 32, baseBiomassKg: 180, biomassSpread: 90, densityPer100M2: 16, growthPerDay: 0.11, fruitKgPer100Biomass: 0, seedBankRate: 2.2, significantIndividualChance: 0.01 },
  FLORA_GROUND_GUILD: { id: 'FLORA_GROUND_GUILD', name: 'Ground Vegetation Guild', form: 'guild', targets: { sunlight: 52, moisture: 54, fertileSoil: 54 }, tolerance: 70, baseBiomassKg: 240, biomassSpread: 160, densityPer100M2: 20, growthPerDay: 0.12, fruitKgPer100Biomass: 0.2, seedBankRate: 3.0, significantIndividualChance: 0 },
  FLORA_MANGROVE: { id: 'FLORA_MANGROVE', name: 'Mangrove', form: 'tree', targets: { canopy: 58, moisture: 96, floodRisk: 88, waterAccess: 92 }, tolerance: 24, baseBiomassKg: 760, biomassSpread: 320, densityPer100M2: 2.8, growthPerDay: 0.04, fruitKgPer100Biomass: 0.15, seedBankRate: 1.6, significantIndividualChance: 0.08 },
};

export const ECOLOGY_REGION_PROFILES: Record<MainWorldAreaId, EcologyRegionProfile> = {
  AREA_CAVE_ENTRANCE: { id: 'REGION_LIMESTONE_CAVE', poiId: 'AREA_CAVE_ENTRANCE', minSubareas: 4, maxSubareas: 6, productivity: 24, biodiversityPotential: 42, archetypes: [{ archetypeId: 'CAVE_TWILIGHT', weight: 1, minCount: 1 }, { archetypeId: 'CAVE_POOL', weight: 0.55 }, { archetypeId: 'CAVE_ROOT_CRACK', weight: 0.8 }, { archetypeId: 'CAVE_GUANO', weight: 0.5 }], flora: [{ speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.5 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 0.7 }] },
  AREA_STONE_RIDGE: { id: 'REGION_MISTY_HIGHLANDS', poiId: 'AREA_STONE_RIDGE', minSubareas: 5, maxSubareas: 8, productivity: 46, biodiversityPotential: 62, archetypes: [{ archetypeId: 'CLOUD_FOREST', weight: 0.8 }, { archetypeId: 'WIND_RIDGE', weight: 1, minCount: 1 }, { archetypeId: 'FERN_MEADOW', weight: 0.8 }, { archetypeId: 'MOUNTAIN_SEEP', weight: 0.55 }, { archetypeId: 'CLIFF_NEST', weight: 0.4 }], flora: [{ speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.9 }, { speciesId: 'FLORA_BERRY_SHRUB', weight: 0.55 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 1 }] },
  AREA_BAMBOO_GROVE: { id: 'REGION_BAMBOO_VALLEY', poiId: 'AREA_BAMBOO_GROVE', minSubareas: 5, maxSubareas: 8, productivity: 72, biodiversityPotential: 66, archetypes: [{ archetypeId: 'BAMBOO_THICKET', weight: 1.2, minCount: 1 }, { archetypeId: 'BAMBOO_EXPANSION', weight: 1 }, { archetypeId: 'STREAM_TERRACE', weight: 0.55 }, { archetypeId: 'LANDSLIDE_SCAR', weight: 0.3 }, { archetypeId: 'FERN_HOLLOW', weight: 0.45 }], flora: [{ speciesId: 'FLORA_BAMBOO', weight: 1.4 }, { speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.65 }, { speciesId: 'FLORA_WILD_BANANA', weight: 0.35 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 1 }] },
  AREA_ANCIENT_RUINS: { id: 'REGION_ANCIENT_RUINS', poiId: 'AREA_ANCIENT_RUINS', minSubareas: 4, maxSubareas: 7, productivity: 48, biodiversityPotential: 58, archetypes: [{ archetypeId: 'RUIN_COURTYARD', weight: 1, minCount: 1 }, { archetypeId: 'ROOT_WALL', weight: 0.85 }, { archetypeId: 'DRY_CISTERN', weight: 0.45 }, { archetypeId: 'FERN_HOLLOW', weight: 0.45 }, { archetypeId: 'ANIMAL_TRAIL', weight: 0.35 }], flora: [{ speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.8 }, { speciesId: 'FLORA_WILD_FIG', weight: 0.45 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 1 }] },
  AREA_CAMP_CLEARING: { id: 'REGION_PLANE_WRECK', poiId: 'AREA_CAMP_CLEARING', minSubareas: 4, maxSubareas: 7, productivity: 52, biodiversityPotential: 52, archetypes: [{ archetypeId: 'BEACH_STRAND', weight: 1, minCount: 1 }, { archetypeId: 'COCONUT_FRINGE', weight: 1 }, { archetypeId: 'WRECK_SCRUB', weight: 1 }, { archetypeId: 'DRAINAGE_HOLLOW', weight: 0.45 }, { archetypeId: 'COASTAL_SCRUB', weight: 0.65 }], flora: [{ speciesId: 'FLORA_COCONUT_PALM', weight: 1.3 }, { speciesId: 'FLORA_BERRY_SHRUB', weight: 0.25 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 1 }] },
  AREA_MANGROVE_EDGE: { id: 'REGION_MANGROVE_DELTA', poiId: 'AREA_MANGROVE_EDGE', minSubareas: 6, maxSubareas: 9, productivity: 82, biodiversityPotential: 78, archetypes: [{ archetypeId: 'TIDAL_CREEK', weight: 1, minCount: 1 }, { archetypeId: 'MANGROVE_ROOT_MAZE', weight: 1.3, minCount: 1 }, { archetypeId: 'MUDFLAT', weight: 0.9 }, { archetypeId: 'BRACKISH_POOL', weight: 0.8 }, { archetypeId: 'DRY_HUMMOCK', weight: 0.55 }, { archetypeId: 'REED_BED', weight: 0.4 }], flora: [{ speciesId: 'FLORA_MANGROVE', weight: 1.5 }, { speciesId: 'FLORA_WETLAND_REED', weight: 1 }, { speciesId: 'FLORA_WILD_TARO', weight: 0.35 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 0.45 }] },
  AREA_FOREST_EDGE: { id: 'REGION_DEEP_RAINFOREST', poiId: 'AREA_FOREST_EDGE', minSubareas: 7, maxSubareas: 11, productivity: 94, biodiversityPotential: 96, archetypes: [{ archetypeId: 'OLD_GROWTH', weight: 1.2, minCount: 1 }, { archetypeId: 'KAPOK_GROVE', weight: 0.55 }, { archetypeId: 'FRUIT_CLEARING', weight: 0.75 }, { archetypeId: 'VINE_THICKET', weight: 0.8 }, { archetypeId: 'SHADED_CREEK', weight: 0.55 }, { archetypeId: 'FERN_HOLLOW', weight: 0.75 }, { archetypeId: 'FALLEN_GIANT_GAP', weight: 0.4 }, { archetypeId: 'ANIMAL_TRAIL', weight: 0.7 }, { archetypeId: 'MEDICINAL_GLADE', weight: 0.35 }, { archetypeId: 'BAMBOO_POCKET', weight: 0.25 }], flora: [{ speciesId: 'FLORA_KAPOK', weight: 0.7 }, { speciesId: 'FLORA_BAMBOO', weight: 0.25 }, { speciesId: 'FLORA_WILD_BANANA', weight: 0.8 }, { speciesId: 'FLORA_WILD_PAPAYA', weight: 0.55 }, { speciesId: 'FLORA_WILD_FIG', weight: 0.75 }, { speciesId: 'FLORA_HARDWOOD_CANOPY', weight: 1.1 }, { speciesId: 'FLORA_BERRY_SHRUB', weight: 0.75 }, { speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.9 }, { speciesId: 'FLORA_MEDICINAL_ORCHID', weight: 0.35 }, { speciesId: 'FLORA_WILD_TARO', weight: 0.4 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 1 }] },
  AREA_SWAMP_CROSSING: { id: 'REGION_FLOODED_FOREST', poiId: 'AREA_SWAMP_CROSSING', minSubareas: 6, maxSubareas: 9, productivity: 86, biodiversityPotential: 84, archetypes: [{ archetypeId: 'FLOODED_GROVE', weight: 1.2, minCount: 1 }, { archetypeId: 'SEASONAL_POOL', weight: 0.9 }, { archetypeId: 'BLACKWATER_CHANNEL', weight: 0.75 }, { archetypeId: 'RAISED_REFUGE', weight: 0.55 }, { archetypeId: 'REED_BED', weight: 0.8 }, { archetypeId: 'FERN_HOLLOW', weight: 0.4 }], flora: [{ speciesId: 'FLORA_WETLAND_REED', weight: 1.1 }, { speciesId: 'FLORA_WILD_TARO', weight: 0.9 }, { speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.75 }, { speciesId: 'FLORA_WILD_FIG', weight: 0.3 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 0.9 }] },
  AREA_WATERFALL_BASIN: { id: 'REGION_RIVER_GORGE', poiId: 'AREA_WATERFALL_BASIN', minSubareas: 6, maxSubareas: 9, productivity: 78, biodiversityPotential: 82, archetypes: [{ archetypeId: 'FAST_RIFFLE', weight: 1, minCount: 1 }, { archetypeId: 'DEEP_POOL', weight: 0.75 }, { archetypeId: 'SPRAY_ZONE', weight: 0.8 }, { archetypeId: 'RIPARIAN_GROVE', weight: 1 }, { archetypeId: 'GRAVEL_BAR', weight: 0.6 }, { archetypeId: 'SLOW_BACKWATER', weight: 0.55 }], flora: [{ speciesId: 'FLORA_WILD_TARO', weight: 0.85 }, { speciesId: 'FLORA_MEDICINAL_FERN', weight: 0.9 }, { speciesId: 'FLORA_WILD_BANANA', weight: 0.45 }, { speciesId: 'FLORA_WILD_FIG', weight: 0.35 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 1 }] },
  AREA_FISHING_LAGOON: { id: 'REGION_ROCKY_SHORE', poiId: 'AREA_FISHING_LAGOON', minSubareas: 5, maxSubareas: 8, productivity: 48, biodiversityPotential: 68, archetypes: [{ archetypeId: 'TIDE_POOL', weight: 1 }, { archetypeId: 'ROCK_PLATFORM', weight: 1, minCount: 1 }, { archetypeId: 'POCKET_BEACH', weight: 0.65 }, { archetypeId: 'COASTAL_SCRUB', weight: 0.75 }, { archetypeId: 'COCONUT_FRINGE', weight: 0.45 }], flora: [{ speciesId: 'FLORA_COCONUT_PALM', weight: 0.8 }, { speciesId: 'FLORA_GROUND_GUILD', weight: 0.8 }, { speciesId: 'FLORA_BERRY_SHRUB', weight: 0.2 }] },
};
