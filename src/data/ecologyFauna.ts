import type { MainWorldAreaId } from './mainWorldAreas';
import type { EcologyTargetProfile } from './ecologyProfiles';
import type { WildFoodResource } from '../types/ecologySimulation';

export type WildAnimalSocialMode = 'solitary' | 'pair' | 'flock' | 'herd' | 'sounder';

export interface WildFaunaSpeciesDefinition {
  id: string;
  name: string;
  trophicRole: 'herbivore' | 'omnivore';
  socialMode: WildAnimalSocialMode;
  targets: EcologyTargetProfile;
  tolerance: number;
  regionAffinity: Partial<Record<MainWorldAreaId, number>>;
  diet: Partial<Record<WildFoodResource, number>>;
  adultWeightKg: number;
  dailyFoodKgPerAdult: number;
  dailyWaterNeed: number;
  baseDensityPer1000M2: number;
  maxInitialPopulation: number;
  homeRangeMin: number;
  homeRangeMax: number;
  maturityDays: number;
  maxAgeDays: number;
  offspringPerAdultFemalePerYear: number;
  disturbanceTolerance: number;
  roamingPerDay: number;
}

export const WILD_FAUNA_SPECIES: Record<string, WildFaunaSpeciesDefinition> = {
  FAUNA_WILD_BOAR: {
    id: 'FAUNA_WILD_BOAR', name: 'Wild Boar', trophicRole: 'omnivore', socialMode: 'sounder',
    targets: { canopy: 66, moisture: 64, waterAccess: 58, slope: 10, vegetation: 72 }, tolerance: 38,
    regionAffinity: {
      AREA_FOREST_EDGE: 1,
      AREA_SWAMP_CROSSING: 0.82,
      AREA_BAMBOO_GROVE: 0.76,
      AREA_WATERFALL_BASIN: 0.64,
      AREA_ANCIENT_RUINS: 0.48,
      AREA_MANGROVE_EDGE: 0.34,
      AREA_CAMP_CLEARING: 0.24,
      AREA_STONE_RIDGE: 0.18,
    },
    diet: { roots_tubers: 0.26, fruit: 0.24, seeds: 0.14, ground_vegetation: 0.12, insects: 0.12, carrion: 0.12 },
    adultWeightKg: 68, dailyFoodKgPerAdult: 3.4, dailyWaterNeed: 56,
    baseDensityPer1000M2: 4.2, maxInitialPopulation: 9, homeRangeMin: 3, homeRangeMax: 6,
    maturityDays: 300, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 3.2,
    disturbanceTolerance: 34, roamingPerDay: 0.72,
  },

  FAUNA_FERAL_GOAT: {
    id: 'FAUNA_FERAL_GOAT', name: 'Feral Goat', trophicRole: 'herbivore', socialMode: 'herd',
    targets: { canopy: 24, moisture: 36, slope: 24, sunlight: 70, rocks: 58, vegetation: 54 }, tolerance: 42,
    regionAffinity: {
      AREA_STONE_RIDGE: 1,
      AREA_ANCIENT_RUINS: 0.62,
      AREA_FISHING_LAGOON: 0.36,
      AREA_CAMP_CLEARING: 0.30,
      AREA_BAMBOO_GROVE: 0.26,
      AREA_CAVE_ENTRANCE: 0.18,
    },
    diet: { browse: 0.46, ground_vegetation: 0.36, seeds: 0.08, fruit: 0.05, roots_tubers: 0.05 },
    adultWeightKg: 42, dailyFoodKgPerAdult: 2.2, dailyWaterNeed: 42,
    baseDensityPer1000M2: 5.2, maxInitialPopulation: 11, homeRangeMin: 3, homeRangeMax: 6,
    maturityDays: 330, maxAgeDays: 4380, offspringPerAdultFemalePerYear: 1.7,
    disturbanceTolerance: 46, roamingPerDay: 0.82,
  },

  FAUNA_AGOUTI: {
    id: 'FAUNA_AGOUTI', name: 'Agouti', trophicRole: 'herbivore', socialMode: 'pair',
    targets: { canopy: 72, moisture: 60, waterAccess: 40, slope: 8, vegetation: 78 }, tolerance: 38,
    regionAffinity: {
      AREA_FOREST_EDGE: 1,
      AREA_BAMBOO_GROVE: 0.78,
      AREA_WATERFALL_BASIN: 0.66,
      AREA_SWAMP_CROSSING: 0.48,
      AREA_ANCIENT_RUINS: 0.38,
      AREA_CAMP_CLEARING: 0.22,
    },
    diet: { fruit: 0.46, seeds: 0.38, roots_tubers: 0.08, ground_vegetation: 0.08 },
    adultWeightKg: 3.6, dailyFoodKgPerAdult: 0.22, dailyWaterNeed: 34,
    baseDensityPer1000M2: 11, maxInitialPopulation: 22, homeRangeMin: 2, homeRangeMax: 4,
    maturityDays: 180, maxAgeDays: 2190, offspringPerAdultFemalePerYear: 3.5,
    disturbanceTolerance: 28, roamingPerDay: 0.88,
  },

  FAUNA_WILD_RABBIT: {
    id: 'FAUNA_WILD_RABBIT', name: 'Wild Rabbit', trophicRole: 'herbivore', socialMode: 'pair',
    targets: { canopy: 26, moisture: 44, slope: 12, sunlight: 62, vegetation: 68 }, tolerance: 46,
    regionAffinity: {
      AREA_STONE_RIDGE: 0.82,
      AREA_CAMP_CLEARING: 0.72,
      AREA_ANCIENT_RUINS: 0.68,
      AREA_BAMBOO_GROVE: 0.48,
      AREA_FOREST_EDGE: 0.34,
      AREA_FISHING_LAGOON: 0.26,
    },
    diet: { ground_vegetation: 0.64, browse: 0.22, roots_tubers: 0.08, seeds: 0.06 },
    adultWeightKg: 1.8, dailyFoodKgPerAdult: 0.16, dailyWaterNeed: 24,
    baseDensityPer1000M2: 16, maxInitialPopulation: 30, homeRangeMin: 2, homeRangeMax: 4,
    maturityDays: 120, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 8.5,
    disturbanceTolerance: 38, roamingPerDay: 1.05,
  },

  FAUNA_FERAL_CHICKEN: {
    id: 'FAUNA_FERAL_CHICKEN', name: 'Feral Chicken', trophicRole: 'omnivore', socialMode: 'flock',
    targets: { canopy: 32, moisture: 44, sunlight: 60, vegetation: 54, slope: 6 }, tolerance: 48,
    regionAffinity: {
      AREA_CAMP_CLEARING: 1,
      AREA_ANCIENT_RUINS: 0.82,
      AREA_FOREST_EDGE: 0.42,
      AREA_BAMBOO_GROVE: 0.34,
      AREA_WATERFALL_BASIN: 0.24,
    },
    diet: { seeds: 0.36, insects: 0.34, ground_vegetation: 0.14, fruit: 0.10, roots_tubers: 0.06 },
    adultWeightKg: 1.4, dailyFoodKgPerAdult: 0.13, dailyWaterNeed: 28,
    baseDensityPer1000M2: 14, maxInitialPopulation: 24, homeRangeMin: 2, homeRangeMax: 4,
    maturityDays: 150, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 7.5,
    disturbanceTolerance: 72, roamingPerDay: 0.82,
  },

  FAUNA_FERAL_DUCK: {
    id: 'FAUNA_FERAL_DUCK', name: 'Feral Duck', trophicRole: 'omnivore', socialMode: 'flock',
    targets: { canopy: 30, moisture: 84, waterAccess: 88, floodRisk: 64, sunlight: 58, vegetation: 58 }, tolerance: 34,
    regionAffinity: {
      AREA_SWAMP_CROSSING: 1,
      AREA_WATERFALL_BASIN: 0.92,
      AREA_MANGROVE_EDGE: 0.82,
      AREA_CAMP_CLEARING: 0.34,
      AREA_FISHING_LAGOON: 0.22,
    },
    diet: { aquatic_plants: 0.38, insects: 0.30, seeds: 0.15, ground_vegetation: 0.10, roots_tubers: 0.07 },
    adultWeightKg: 1.25, dailyFoodKgPerAdult: 0.15, dailyWaterNeed: 74,
    baseDensityPer1000M2: 12, maxInitialPopulation: 24, homeRangeMin: 2, homeRangeMax: 5,
    maturityDays: 180, maxAgeDays: 2555, offspringPerAdultFemalePerYear: 6.2,
    disturbanceTolerance: 48, roamingPerDay: 1.0,
  },

  FAUNA_TREE_RAT: {
    id: 'FAUNA_TREE_RAT', name: 'Tree Rat', trophicRole: 'omnivore', socialMode: 'pair',
    targets: { canopy: 62, moisture: 54, vegetation: 70, slope: 6 }, tolerance: 48,
    regionAffinity: {
      AREA_ANCIENT_RUINS: 1,
      AREA_CAMP_CLEARING: 0.96,
      AREA_FOREST_EDGE: 0.92,
      AREA_BAMBOO_GROVE: 0.72,
      AREA_MANGROVE_EDGE: 0.48,
      AREA_WATERFALL_BASIN: 0.44,
      AREA_SWAMP_CROSSING: 0.34,
    },
    diet: { fruit: 0.30, seeds: 0.30, insects: 0.22, roots_tubers: 0.08, carrion: 0.05, ground_vegetation: 0.05 },
    adultWeightKg: 0.34, dailyFoodKgPerAdult: 0.045, dailyWaterNeed: 18,
    baseDensityPer1000M2: 30, maxInitialPopulation: 46, homeRangeMin: 2, homeRangeMax: 4,
    maturityDays: 90, maxAgeDays: 1095, offspringPerAdultFemalePerYear: 11,
    disturbanceTolerance: 82, roamingPerDay: 1.1,
  },
};

export const WILD_FAUNA_SPECIES_IDS = Object.freeze(Object.keys(WILD_FAUNA_SPECIES));
