import type { PlantArchitecture } from '../types/agricultureSimulation';

export interface PlantSpeciesDefinition {
  id: string;
  name: string;
  architecture: PlantArchitecture;
  seedItemId: string;
  harvestItemId: string;
  harvestMode: 'destructive' | 'repeatable' | 'culm';
  spacingM2: number;
  maturityHours: number;
  fruitingHours: number;
  baseYieldUnits: number;
  idealTemperatureC: [number, number];
  idealMoisture: [number, number];
  idealSunlight: [number, number];
  droughtTolerance: number;
  floodTolerance: number;
  nutrientDemand: number;
  woody?: boolean;
  tags: string[];
}

export interface TerrestrialSpeciesDefinition {
  id: string;
  name: string;
  adultWeightKg: number;
  maturityHours: number;
  oldAgeHours: number;
  spaceM2: number;
  dailyFeedUnits: number;
  dailyWaterUnits: number;
  idealTemperatureC: [number, number];
  productItemId?: string;
  productIntervalHours?: number;
  manurePerDay: number;
  gestationHours?: number;
  litterMin?: number;
  litterMax?: number;
  tags: string[];
}

export interface AquaticSpeciesDefinition {
  id: string;
  name: string;
  adultWeightKg: number;
  maturityHours: number;
  oldAgeHours: number;
  densityM2: number;
  dailyFeedUnits: number;
  idealTemperatureC: [number, number];
  minimumOxygen: number;
  harvestItemId: string;
  spawningIntervalHours: number;
  tags: string[];
}

export const PLANT_SPECIES: Record<string, PlantSpeciesDefinition> = {
  PLANT_CASSAVA: {
    id: 'PLANT_CASSAVA', name: 'Sắn', architecture: 'herbaceous', seedItemId: 'ITEM_CASSAVA_CUTTING', harvestItemId: 'ITEM_CASSAVA_ROOT',
    harvestMode: 'destructive', spacingM2: 1.0, maturityHours: 24 * 90, fruitingHours: 24 * 8, baseYieldUnits: 5,
    idealTemperatureC: [22, 32], idealMoisture: [45, 75], idealSunlight: [65, 100], droughtTolerance: 78, floodTolerance: 35, nutrientDemand: 42,
    tags: ['food', 'staple', 'root_crop'],
  },
  PLANT_TARO: {
    id: 'PLANT_TARO', name: 'Khoai môn', architecture: 'herbaceous', seedItemId: 'ITEM_TARO_SET', harvestItemId: 'ITEM_TARO_CORM',
    harvestMode: 'destructive', spacingM2: 0.8, maturityHours: 24 * 100, fruitingHours: 24 * 7, baseYieldUnits: 4,
    idealTemperatureC: [21, 31], idealMoisture: [65, 92], idealSunlight: [45, 85], droughtTolerance: 28, floodTolerance: 82, nutrientDemand: 52,
    tags: ['food', 'root_crop', 'wet_crop'],
  },
  PLANT_CHILI: {
    id: 'PLANT_CHILI', name: 'Ớt', architecture: 'herbaceous', seedItemId: 'ITEM_CHILI_SEED', harvestItemId: 'ITEM_CHILI_FRUIT',
    harvestMode: 'repeatable', spacingM2: 0.5, maturityHours: 24 * 55, fruitingHours: 24 * 8, baseYieldUnits: 6,
    idealTemperatureC: [20, 30], idealMoisture: [45, 70], idealSunlight: [70, 100], droughtTolerance: 45, floodTolerance: 18, nutrientDemand: 58,
    tags: ['food', 'medicine', 'fruiting_crop'],
  },
  PLANT_MAIZE: {
    id: 'PLANT_MAIZE', name: 'Ngô', architecture: 'herbaceous', seedItemId: 'ITEM_MAIZE_SEED', harvestItemId: 'ITEM_MAIZE_EAR',
    harvestMode: 'destructive', spacingM2: 0.6, maturityHours: 24 * 75, fruitingHours: 24 * 10, baseYieldUnits: 2,
    idealTemperatureC: [20, 31], idealMoisture: [45, 72], idealSunlight: [75, 100], droughtTolerance: 48, floodTolerance: 20, nutrientDemand: 72,
    tags: ['food', 'grain'],
  },
  PLANT_SWEET_POTATO: {
    id: 'PLANT_SWEET_POTATO', name: 'Khoai lang', architecture: 'herbaceous', seedItemId: 'ITEM_SWEET_POTATO_SLIP', harvestItemId: 'ITEM_SWEET_POTATO',
    harvestMode: 'destructive', spacingM2: 0.7, maturityHours: 24 * 85, fruitingHours: 24 * 8, baseYieldUnits: 5,
    idealTemperatureC: [21, 32], idealMoisture: [40, 70], idealSunlight: [60, 100], droughtTolerance: 62, floodTolerance: 25, nutrientDemand: 46,
    tags: ['food', 'root_crop'],
  },
  PLANT_PINEAPPLE: {
    id: 'PLANT_PINEAPPLE', name: 'Dứa', architecture: 'herbaceous', seedItemId: 'ITEM_PINEAPPLE_CROWN', harvestItemId: 'ITEM_PINEAPPLE_FRUIT',
    harvestMode: 'repeatable', spacingM2: 1.1, maturityHours: 24 * 180, fruitingHours: 24 * 35, baseYieldUnits: 1,
    idealTemperatureC: [22, 31], idealMoisture: [35, 65], idealSunlight: [65, 100], droughtTolerance: 72, floodTolerance: 12, nutrientDemand: 38,
    tags: ['food', 'fruit'],
  },
  PLANT_BANANA: {
    id: 'PLANT_BANANA', name: 'Chuối', architecture: 'clumping', seedItemId: 'ITEM_BANANA_SUCKER', harvestItemId: 'ITEM_BANANA_BUNCH',
    harvestMode: 'repeatable', spacingM2: 4.0, maturityHours: 24 * 240, fruitingHours: 24 * 60, baseYieldUnits: 10,
    idealTemperatureC: [23, 32], idealMoisture: [60, 85], idealSunlight: [55, 95], droughtTolerance: 25, floodTolerance: 45, nutrientDemand: 82,
    tags: ['food', 'fruit', 'perennial'],
  },
  PLANT_PAPAYA: {
    id: 'PLANT_PAPAYA', name: 'Đu đủ', architecture: 'woody', seedItemId: 'ITEM_PAPAYA_SEED', harvestItemId: 'ITEM_PAPAYA_FRUIT',
    harvestMode: 'repeatable', spacingM2: 4.5, maturityHours: 24 * 210, fruitingHours: 24 * 30, baseYieldUnits: 4,
    idealTemperatureC: [22, 33], idealMoisture: [45, 75], idealSunlight: [70, 100], droughtTolerance: 38, floodTolerance: 16, nutrientDemand: 64,
    woody: true, tags: ['food', 'fruit', 'woody'],
  },
  PLANT_BAMBOO: {
    id: 'PLANT_BAMBOO', name: 'Tre', architecture: 'clumping', seedItemId: 'ITEM_BAMBOO_OFFSET', harvestItemId: 'ITEM_BAMBOO_POLE',
    harvestMode: 'culm', spacingM2: 5.0, maturityHours: 24 * 150, fruitingHours: 24 * 45, baseYieldUnits: 3,
    idealTemperatureC: [20, 33], idealMoisture: [50, 82], idealSunlight: [45, 95], droughtTolerance: 52, floodTolerance: 55, nutrientDemand: 58,
    tags: ['material', 'perennial', 'clump'],
  },
  PLANT_MEDICINAL_SHRUB: {
    id: 'PLANT_MEDICINAL_SHRUB', name: 'Cây dược liệu', architecture: 'woody', seedItemId: 'ITEM_MEDICINAL_SHRUB_SEED', harvestItemId: 'ITEM_MEDICINAL_LEAF',
    harvestMode: 'repeatable', spacingM2: 1.5, maturityHours: 24 * 80, fruitingHours: 24 * 18, baseYieldUnits: 4,
    idealTemperatureC: [20, 30], idealMoisture: [45, 72], idealSunlight: [35, 75], droughtTolerance: 48, floodTolerance: 25, nutrientDemand: 42,
    woody: true, tags: ['medicine', 'perennial'],
  },
};

export const TERRESTRIAL_SPECIES: Record<string, TerrestrialSpeciesDefinition> = {
  ANIMAL_CHICKEN: {
    id: 'ANIMAL_CHICKEN', name: 'Gà', adultWeightKg: 2.2, maturityHours: 24 * 150, oldAgeHours: 24 * 1800, spaceM2: 1.2,
    dailyFeedUnits: 0.18, dailyWaterUnits: 0.28, idealTemperatureC: [18, 31], productItemId: 'ITEM_EGG', productIntervalHours: 28,
    manurePerDay: 0.12, gestationHours: 24 * 21, litterMin: 1, litterMax: 5, tags: ['poultry', 'egg', 'meat'],
  },
  ANIMAL_DUCK: {
    id: 'ANIMAL_DUCK', name: 'Vịt', adultWeightKg: 2.8, maturityHours: 24 * 160, oldAgeHours: 24 * 1700, spaceM2: 1.5,
    dailyFeedUnits: 0.22, dailyWaterUnits: 0.42, idealTemperatureC: [17, 31], productItemId: 'ITEM_EGG', productIntervalHours: 32,
    manurePerDay: 0.16, gestationHours: 24 * 28, litterMin: 1, litterMax: 5, tags: ['poultry', 'egg', 'wet_tolerant'],
  },
  ANIMAL_GOAT: {
    id: 'ANIMAL_GOAT', name: 'Dê', adultWeightKg: 42, maturityHours: 24 * 300, oldAgeHours: 24 * 3600, spaceM2: 8,
    dailyFeedUnits: 2.1, dailyWaterUnits: 3.2, idealTemperatureC: [14, 31], productItemId: 'ITEM_GOAT_MILK', productIntervalHours: 24,
    manurePerDay: 0.9, gestationHours: 24 * 150, litterMin: 1, litterMax: 2, tags: ['ruminant', 'milk', 'meat', 'hide'],
  },
  ANIMAL_PIG: {
    id: 'ANIMAL_PIG', name: 'Lợn', adultWeightKg: 95, maturityHours: 24 * 240, oldAgeHours: 24 * 2800, spaceM2: 7,
    dailyFeedUnits: 2.8, dailyWaterUnits: 5.0, idealTemperatureC: [16, 29], manurePerDay: 1.4,
    gestationHours: 24 * 114, litterMin: 3, litterMax: 8, tags: ['omnivore', 'meat', 'manure'],
  },
  ANIMAL_RABBIT: {
    id: 'ANIMAL_RABBIT', name: 'Thỏ', adultWeightKg: 2.5, maturityHours: 24 * 120, oldAgeHours: 24 * 1600, spaceM2: 0.8,
    dailyFeedUnits: 0.14, dailyWaterUnits: 0.25, idealTemperatureC: [14, 27], manurePerDay: 0.1,
    gestationHours: 24 * 31, litterMin: 2, litterMax: 6, tags: ['small_livestock', 'meat', 'manure'],
  },
};

export const AQUATIC_SPECIES: Record<string, AquaticSpeciesDefinition> = {
  AQUATIC_TILAPIA: {
    id: 'AQUATIC_TILAPIA', name: 'Cá rô phi', adultWeightKg: 0.8, maturityHours: 24 * 180, oldAgeHours: 24 * 1300,
    densityM2: 1.2, dailyFeedUnits: 0.035, idealTemperatureC: [24, 31], minimumOxygen: 42,
    harvestItemId: 'ITEM_FRESH_FISH', spawningIntervalHours: 24 * 45, tags: ['fish', 'hardy', 'freshwater'],
  },
  AQUATIC_RIVER_CARP: {
    id: 'AQUATIC_RIVER_CARP', name: 'Cá chép sông', adultWeightKg: 1.5, maturityHours: 24 * 240, oldAgeHours: 24 * 1800,
    densityM2: 1.8, dailyFeedUnits: 0.05, idealTemperatureC: [20, 29], minimumOxygen: 50,
    harvestItemId: 'ITEM_FRESH_FISH', spawningIntervalHours: 24 * 70, tags: ['fish', 'freshwater', 'river'],
  },
  AQUATIC_FRESHWATER_PRAWN: {
    id: 'AQUATIC_FRESHWATER_PRAWN', name: 'Tôm càng nước ngọt', adultWeightKg: 0.18, maturityHours: 24 * 150, oldAgeHours: 24 * 800,
    densityM2: 0.35, dailyFeedUnits: 0.012, idealTemperatureC: [24, 31], minimumOxygen: 55,
    harvestItemId: 'ITEM_FRESH_PRAWN', spawningIntervalHours: 24 * 38, tags: ['crustacean', 'freshwater'],
  },
};

export const ALL_AGRICULTURE_SPECIES = {
  ...PLANT_SPECIES,
  ...TERRESTRIAL_SPECIES,
  ...AQUATIC_SPECIES,
};