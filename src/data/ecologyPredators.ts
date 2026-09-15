import type { MainWorldAreaId } from './mainWorldAreas';
import type { EcologyTargetProfile } from './ecologyProfiles';

export interface WildPredatorSpeciesDefinition {
  id: string;
  name: string;
  targets: EcologyTargetProfile;
  tolerance: number;
  regionAffinity: Partial<Record<MainWorldAreaId, number>>;
  preyWeights: Partial<Record<string, number>>;
  adultWeightKg: number;
  dailyFoodKgPerAdult: number;
  dailyWaterNeed: number;
  maxKillsPerAdultPerDay: number;
  halfSaturationPreyPer1000M2: number;
  idealPredatorPreyBiomassRatio: number;
  minimumViablePreyCount: number;
  maxAdultPreyKg: number;
  juvenilePreference: number;
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

export const WILD_PREDATOR_SPECIES: Record<string, WildPredatorSpeciesDefinition> = {
  PREDATOR_MONITOR_LIZARD: {
    id: 'PREDATOR_MONITOR_LIZARD', name: 'Monitor Lizard',
    targets: { canopy: 48, moisture: 66, waterAccess: 54, sunlight: 46, vegetation: 58 }, tolerance: 44,
    regionAffinity: {
      AREA_SWAMP_CROSSING: 1,
      AREA_MANGROVE_EDGE: 0.92,
      AREA_FOREST_EDGE: 0.76,
      AREA_WATERFALL_BASIN: 0.72,
      AREA_CAMP_CLEARING: 0.42,
      AREA_ANCIENT_RUINS: 0.38,
      AREA_BAMBOO_GROVE: 0.34,
    },
    preyWeights: {
      FAUNA_TREE_RAT: 1,
      FAUNA_FERAL_CHICKEN: 0.9,
      FAUNA_WILD_RABBIT: 0.68,
      FAUNA_FERAL_DUCK: 0.5,
      FAUNA_AGOUTI: 0.42,
    },
    adultWeightKg: 8.5, dailyFoodKgPerAdult: 0.55, dailyWaterNeed: 38,
    maxKillsPerAdultPerDay: 0.42, halfSaturationPreyPer1000M2: 9,
    idealPredatorPreyBiomassRatio: 0.12, minimumViablePreyCount: 4,
    maxAdultPreyKg: 4.5, juvenilePreference: 0.58,
    baseDensityPer1000M2: 0.75, maxInitialPopulation: 4, homeRangeMin: 3, homeRangeMax: 6,
    maturityDays: 540, maxAgeDays: 5475, offspringPerAdultFemalePerYear: 1.8,
    disturbanceTolerance: 44, roamingPerDay: 0.52,
  },

  PREDATOR_PYTHON: {
    id: 'PREDATOR_PYTHON', name: 'Large Python',
    targets: { canopy: 72, moisture: 70, waterAccess: 44, sunlight: 26, vegetation: 78 }, tolerance: 38,
    regionAffinity: {
      AREA_FOREST_EDGE: 1,
      AREA_SWAMP_CROSSING: 0.9,
      AREA_BAMBOO_GROVE: 0.72,
      AREA_MANGROVE_EDGE: 0.68,
      AREA_WATERFALL_BASIN: 0.58,
      AREA_ANCIENT_RUINS: 0.42,
    },
    preyWeights: {
      FAUNA_WILD_RABBIT: 1,
      FAUNA_AGOUTI: 0.94,
      FAUNA_TREE_RAT: 0.82,
      FAUNA_FERAL_CHICKEN: 0.78,
      FAUNA_FERAL_DUCK: 0.58,
      FAUNA_WILD_BOAR: 0.18,
    },
    adultWeightKg: 24, dailyFoodKgPerAdult: 0.72, dailyWaterNeed: 32,
    maxKillsPerAdultPerDay: 0.16, halfSaturationPreyPer1000M2: 7,
    idealPredatorPreyBiomassRatio: 0.1, minimumViablePreyCount: 4,
    maxAdultPreyKg: 16, juvenilePreference: 0.62,
    baseDensityPer1000M2: 0.36, maxInitialPopulation: 3, homeRangeMin: 3, homeRangeMax: 6,
    maturityDays: 900, maxAgeDays: 7300, offspringPerAdultFemalePerYear: 1.1,
    disturbanceTolerance: 24, roamingPerDay: 0.32,
  },

  PREDATOR_RAPTOR: {
    id: 'PREDATOR_RAPTOR', name: 'Forest Raptor',
    targets: { canopy: 38, sunlight: 62, slope: 18, rocks: 42, vegetation: 48 }, tolerance: 44,
    regionAffinity: {
      AREA_STONE_RIDGE: 1,
      AREA_FOREST_EDGE: 0.76,
      AREA_ANCIENT_RUINS: 0.72,
      AREA_BAMBOO_GROVE: 0.58,
      AREA_WATERFALL_BASIN: 0.52,
      AREA_CAMP_CLEARING: 0.38,
      AREA_SWAMP_CROSSING: 0.28,
    },
    preyWeights: {
      FAUNA_WILD_RABBIT: 1,
      FAUNA_FERAL_CHICKEN: 0.94,
      FAUNA_TREE_RAT: 0.82,
      FAUNA_AGOUTI: 0.72,
      FAUNA_FERAL_DUCK: 0.62,
    },
    adultWeightKg: 4.8, dailyFoodKgPerAdult: 0.42, dailyWaterNeed: 20,
    maxKillsPerAdultPerDay: 0.34, halfSaturationPreyPer1000M2: 8,
    idealPredatorPreyBiomassRatio: 0.08, minimumViablePreyCount: 4,
    maxAdultPreyKg: 4.2, juvenilePreference: 0.52,
    baseDensityPer1000M2: 0.28, maxInitialPopulation: 2, homeRangeMin: 4, homeRangeMax: 8,
    maturityDays: 730, maxAgeDays: 6570, offspringPerAdultFemalePerYear: 0.85,
    disturbanceTolerance: 26, roamingPerDay: 0.7,
  },

  PREDATOR_CIVET: {
    id: 'PREDATOR_CIVET', name: 'Island Civet',
    targets: { canopy: 64, moisture: 58, vegetation: 68, slope: 9 }, tolerance: 46,
    regionAffinity: {
      AREA_FOREST_EDGE: 1,
      AREA_ANCIENT_RUINS: 0.86,
      AREA_CAMP_CLEARING: 0.62,
      AREA_BAMBOO_GROVE: 0.62,
      AREA_WATERFALL_BASIN: 0.48,
      AREA_SWAMP_CROSSING: 0.38,
    },
    preyWeights: {
      FAUNA_TREE_RAT: 1,
      FAUNA_FERAL_CHICKEN: 0.82,
      FAUNA_WILD_RABBIT: 0.56,
      FAUNA_AGOUTI: 0.36,
    },
    adultWeightKg: 5.4, dailyFoodKgPerAdult: 0.38, dailyWaterNeed: 30,
    maxKillsPerAdultPerDay: 0.3, halfSaturationPreyPer1000M2: 10,
    idealPredatorPreyBiomassRatio: 0.11, minimumViablePreyCount: 4,
    maxAdultPreyKg: 3.5, juvenilePreference: 0.54,
    baseDensityPer1000M2: 0.55, maxInitialPopulation: 4, homeRangeMin: 3, homeRangeMax: 6,
    maturityDays: 420, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 1.9,
    disturbanceTolerance: 58, roamingPerDay: 0.6,
  },

  PREDATOR_ESTUARINE_CROCODILE: {
    id: 'PREDATOR_ESTUARINE_CROCODILE', name: 'Estuarine Crocodile',
    targets: { canopy: 28, moisture: 92, waterAccess: 96, floodRisk: 82, sunlight: 52 }, tolerance: 30,
    regionAffinity: {
      AREA_MANGROVE_EDGE: 1,
      AREA_SWAMP_CROSSING: 0.88,
      AREA_WATERFALL_BASIN: 0.48,
    },
    preyWeights: {
      FAUNA_FERAL_DUCK: 1,
      FAUNA_WILD_BOAR: 0.62,
      FAUNA_FERAL_GOAT: 0.44,
      FAUNA_AGOUTI: 0.34,
      FAUNA_WILD_RABBIT: 0.26,
    },
    adultWeightKg: 180, dailyFoodKgPerAdult: 1.65, dailyWaterNeed: 90,
    maxKillsPerAdultPerDay: 0.08, halfSaturationPreyPer1000M2: 5,
    idealPredatorPreyBiomassRatio: 0.14, minimumViablePreyCount: 3,
    maxAdultPreyKg: 90, juvenilePreference: 0.45,
    baseDensityPer1000M2: 0.12, maxInitialPopulation: 2, homeRangeMin: 3, homeRangeMax: 6,
    maturityDays: 3650, maxAgeDays: 21900, offspringPerAdultFemalePerYear: 0.38,
    disturbanceTolerance: 20, roamingPerDay: 0.24,
  },
};

export const WILD_PREDATOR_SPECIES_IDS = Object.freeze(Object.keys(WILD_PREDATOR_SPECIES));
