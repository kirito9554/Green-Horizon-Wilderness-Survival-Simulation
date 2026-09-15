import type { AquaticHabitatType, AquaticHydrologyCriteria } from '../types/aquaticHydrology';
import type { AquaticFoodResource } from '../types/aquaticEcology';

export type AquaticTrophicGuild =
  | 'grazer'
  | 'detritivore'
  | 'omnivore'
  | 'forage_fish'
  | 'mesopredator';

export interface WildAquaticSpeciesDefinition {
  id: string;
  name: string;
  trophicGuild: AquaticTrophicGuild;
  adultWeightKg: number;
  maturityDays: number;
  oldAgeDays: number;
  baseDensityPer100M3: number;
  maxPopulationPerBody: number;
  preferredHabitats: AquaticHabitatType[];
  hydrologyCriteria: AquaticHydrologyCriteria;
  idealTemperatureC: [number, number];
  temperatureToleranceC: number;
  minimumBreedingReliability: number;
  dailyReproductionRate: number;
  naturalMortalityPerDay: number;
  mobility: number;
  dailyFoodFraction: number;
  diet: Partial<Record<AquaticFoodResource, number>>;
  preyWeights?: Record<string, number>;
}

export const WILD_AQUATIC_SPECIES: Record<string, WildAquaticSpeciesDefinition> = {
  AQUATIC_TILAPIA: {
    id: 'AQUATIC_TILAPIA', name: 'Wild Tilapia', trophicGuild: 'omnivore', adultWeightKg: 0.8,
    maturityDays: 180, oldAgeDays: 1300, baseDensityPer100M3: 18, maxPopulationPerBody: 850,
    preferredHabitats: ['standing_water', 'flowing_channel', 'managed_pond'],
    hydrologyCriteria: { minDepthM: 0.18, maxDepthM: 4, minDissolvedOxygenMgL: 3.2, maxVelocityMps: 0.9, maxSalinityPpt: 8, maxTurbidity: 85, maxContamination: 65, minimumPassability: 0.18 },
    idealTemperatureC: [24, 31], temperatureToleranceC: 6, minimumBreedingReliability: 0.42,
    dailyReproductionRate: 0.0028, naturalMortalityPerDay: 0.00052, mobility: 0.62, dailyFoodFraction: 0.032,
    diet: { phytoplankton: 0.24, periphyton: 0.22, aquatic_vegetation: 0.16, zooplankton: 0.16, benthic_invertebrates: 0.15, detritus: 0.07 },
  },
  AQUATIC_RIVER_CARP: {
    id: 'AQUATIC_RIVER_CARP', name: 'River Carp', trophicGuild: 'omnivore', adultWeightKg: 1.5,
    maturityDays: 240, oldAgeDays: 1800, baseDensityPer100M3: 10, maxPopulationPerBody: 620,
    preferredHabitats: ['flowing_channel', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.25, maxDepthM: 6, minDissolvedOxygenMgL: 4.2, maxVelocityMps: 1.35, maxSalinityPpt: 3, maxTurbidity: 72, maxContamination: 55, minimumPassability: 0.24 },
    idealTemperatureC: [20, 29], temperatureToleranceC: 6, minimumBreedingReliability: 0.55,
    dailyReproductionRate: 0.0018, naturalMortalityPerDay: 0.0004, mobility: 0.78, dailyFoodFraction: 0.026,
    diet: { benthic_invertebrates: 0.34, aquatic_vegetation: 0.2, detritus: 0.2, zooplankton: 0.14, periphyton: 0.12 },
  },
  AQUATIC_FRESHWATER_PRAWN: {
    id: 'AQUATIC_FRESHWATER_PRAWN', name: 'Freshwater Prawn', trophicGuild: 'detritivore', adultWeightKg: 0.18,
    maturityDays: 150, oldAgeDays: 800, baseDensityPer100M3: 22, maxPopulationPerBody: 1100,
    preferredHabitats: ['flowing_channel', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.12, maxDepthM: 3.5, minDissolvedOxygenMgL: 4.8, maxVelocityMps: 0.7, maxSalinityPpt: 5, maxTurbidity: 65, maxContamination: 45, minimumPassability: 0.12 },
    idealTemperatureC: [24, 31], temperatureToleranceC: 5, minimumBreedingReliability: 0.48,
    dailyReproductionRate: 0.0036, naturalMortalityPerDay: 0.0008, mobility: 0.48, dailyFoodFraction: 0.05,
    diet: { detritus: 0.45, periphyton: 0.16, benthic_invertebrates: 0.13, zooplankton: 0.1, carrion: 0.16 },
  },
  AQUATIC_FORAGE_FISH: {
    id: 'AQUATIC_FORAGE_FISH', name: 'Small Forage Fish', trophicGuild: 'forage_fish', adultWeightKg: 0.08,
    maturityDays: 100, oldAgeDays: 700, baseDensityPer100M3: 38, maxPopulationPerBody: 2200,
    preferredHabitats: ['flowing_channel', 'standing_water', 'tidal_water'],
    hydrologyCriteria: { minDepthM: 0.1, maxDepthM: 5, minDissolvedOxygenMgL: 4, maxVelocityMps: 1.7, maxSalinityPpt: 16, maxTurbidity: 82, maxContamination: 55, minimumPassability: 0.12 },
    idealTemperatureC: [22, 31], temperatureToleranceC: 7, minimumBreedingReliability: 0.35,
    dailyReproductionRate: 0.0052, naturalMortalityPerDay: 0.0011, mobility: 0.82, dailyFoodFraction: 0.075,
    diet: { zooplankton: 0.56, phytoplankton: 0.29, periphyton: 0.15 },
  },
  AQUATIC_FRESHWATER_EEL: {
    id: 'AQUATIC_FRESHWATER_EEL', name: 'Freshwater Eel', trophicGuild: 'mesopredator', adultWeightKg: 1.2,
    maturityDays: 420, oldAgeDays: 2600, baseDensityPer100M3: 2.8, maxPopulationPerBody: 190,
    preferredHabitats: ['flowing_channel', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.18, maxDepthM: 8, minDissolvedOxygenMgL: 2.8, maxVelocityMps: 1.5, maxSalinityPpt: 10, maxTurbidity: 90, maxContamination: 60, minimumPassability: 0.16 },
    idealTemperatureC: [20, 29], temperatureToleranceC: 7, minimumBreedingReliability: 0.5,
    dailyReproductionRate: 0.0007, naturalMortalityPerDay: 0.00028, mobility: 0.9, dailyFoodFraction: 0.018,
    diet: { benthic_invertebrates: 0.55, carrion: 0.45 },
    preyWeights: { AQUATIC_FORAGE_FISH: 1, AQUATIC_FRESHWATER_PRAWN: 0.7, AQUATIC_TILAPIA: 0.35, AQUATIC_RIVER_CARP: 0.18 },
  },
  AQUATIC_MUD_CRAB: {
    id: 'AQUATIC_MUD_CRAB', name: 'Mud Crab', trophicGuild: 'detritivore', adultWeightKg: 0.7,
    maturityDays: 300, oldAgeDays: 1500, baseDensityPer100M3: 4.2, maxPopulationPerBody: 320,
    preferredHabitats: ['tidal_water', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.08, maxDepthM: 3, minDissolvedOxygenMgL: 3.5, maxVelocityMps: 0.75, minSalinityPpt: 2, maxSalinityPpt: 32, maxTurbidity: 95, maxContamination: 62, minimumPassability: 0.08 },
    idealTemperatureC: [24, 32], temperatureToleranceC: 5, minimumBreedingReliability: 0.42,
    dailyReproductionRate: 0.0015, naturalMortalityPerDay: 0.00055, mobility: 0.42, dailyFoodFraction: 0.028,
    diet: { detritus: 0.34, carrion: 0.27, benthic_invertebrates: 0.25, aquatic_vegetation: 0.14 },
    preyWeights: { AQUATIC_FRESHWATER_PRAWN: 0.5, AQUATIC_FORAGE_FISH: 0.28 },
  },
  AQUATIC_LAGOON_SNAPPER: {
    id: 'AQUATIC_LAGOON_SNAPPER', name: 'Lagoon Snapper', trophicGuild: 'mesopredator', adultWeightKg: 2.2,
    maturityDays: 520, oldAgeDays: 3000, baseDensityPer100M3: 2.1, maxPopulationPerBody: 250,
    preferredHabitats: ['tidal_water'],
    hydrologyCriteria: { minDepthM: 0.35, maxDepthM: 12, minDissolvedOxygenMgL: 4.5, maxVelocityMps: 1.8, minSalinityPpt: 10, maxSalinityPpt: 40, maxTurbidity: 58, maxContamination: 35, minimumPassability: 0.22 },
    idealTemperatureC: [24, 30], temperatureToleranceC: 4, minimumBreedingReliability: 0.72,
    dailyReproductionRate: 0.00062, naturalMortalityPerDay: 0.00024, mobility: 0.88, dailyFoodFraction: 0.022,
    diet: { benthic_invertebrates: 0.72, carrion: 0.28 },
    preyWeights: { AQUATIC_FORAGE_FISH: 1, AQUATIC_FRESHWATER_PRAWN: 0.6, AQUATIC_MUD_CRAB: 0.18 },
  },
  AQUATIC_PARROTFISH: {
    id: 'AQUATIC_PARROTFISH', name: 'Parrotfish', trophicGuild: 'grazer', adultWeightKg: 1.1,
    maturityDays: 430, oldAgeDays: 2200, baseDensityPer100M3: 2.6, maxPopulationPerBody: 280,
    preferredHabitats: ['tidal_water'],
    hydrologyCriteria: { minDepthM: 0.3, maxDepthM: 10, minDissolvedOxygenMgL: 5, maxVelocityMps: 1.5, minSalinityPpt: 20, maxSalinityPpt: 40, maxTurbidity: 40, maxContamination: 28, minimumPassability: 0.18 },
    idealTemperatureC: [25, 30], temperatureToleranceC: 4, minimumBreedingReliability: 0.75,
    dailyReproductionRate: 0.0008, naturalMortalityPerDay: 0.0003, mobility: 0.72, dailyFoodFraction: 0.03,
    diet: { periphyton: 0.64, aquatic_vegetation: 0.25, phytoplankton: 0.11 },
  },
};
