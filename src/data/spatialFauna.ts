import type { MainWorldAreaId } from './mainWorldAreas';
import type { EcologyTargetProfile } from './ecologyProfiles';
import {
  WILD_FAUNA_SPECIES,
  type WildAnimalSocialMode,
} from './ecologyFauna';
import type { WildFoodResource } from '../types/ecologySimulation';

export type SpatialFaunaGuild =
  | 'large_herbivore'
  | 'omnivore'
  | 'small_mammal'
  | 'ground_bird'
  | 'canopy_bird'
  | 'bat'
  | 'reptile'
  | 'amphibian'
  | 'invertebrate';

export type SpatialFaunaSocialMode = WildAnimalSocialMode | 'colony' | 'loose_group';

export interface SpatialFaunaSpeciesDefinition {
  id: string;
  name: string;
  guild: SpatialFaunaGuild;
  trophicRole: 'herbivore' | 'omnivore';
  socialMode: SpatialFaunaSocialMode;
  targets: EcologyTargetProfile;
  tolerance: number;
  regionAffinity: Partial<Record<MainWorldAreaId, number>>;
  diet: Partial<Record<WildFoodResource, number>>;
  adultWeightKg: number;
  dailyFoodKgPerAdult: number;
  dailyWaterNeed: number;
  /** Prime-habitat carrying density on the metric world, not the legacy sample-grid density. */
  densityPerKm2: number;
  /** Deterministic per-seed chance that an ecologically supported species is present. */
  worldPresence: number;
  minPatchSuitability: number;
  minIslandCapacity: number;
  initialOccupancy: readonly [number, number];
  maturityDays: number;
  maxAgeDays: number;
  offspringPerAdultFemalePerYear: number;
  disturbanceTolerance: number;
  /** True while the old subarea fauna runtime still owns this species' live tick. */
  legacyRuntime: boolean;
}

interface SpatialMetricOverrides {
  guild: SpatialFaunaGuild;
  densityPerKm2: number;
  worldPresence?: number;
  minPatchSuitability?: number;
  minIslandCapacity?: number;
  initialOccupancy?: readonly [number, number];
}

function fromLegacy(id: string, overrides: SpatialMetricOverrides): SpatialFaunaSpeciesDefinition {
  const source = WILD_FAUNA_SPECIES[id];
  if (!source) throw new Error(`Missing legacy fauna species ${id}`);
  return Object.freeze({
    id: source.id,
    name: source.name,
    guild: overrides.guild,
    trophicRole: source.trophicRole,
    socialMode: source.socialMode,
    targets: source.targets,
    tolerance: source.tolerance,
    regionAffinity: source.regionAffinity,
    diet: source.diet,
    adultWeightKg: source.adultWeightKg,
    dailyFoodKgPerAdult: source.dailyFoodKgPerAdult,
    dailyWaterNeed: source.dailyWaterNeed,
    densityPerKm2: overrides.densityPerKm2,
    worldPresence: overrides.worldPresence ?? 1,
    minPatchSuitability: overrides.minPatchSuitability ?? .34,
    minIslandCapacity: overrides.minIslandCapacity ?? 4,
    initialOccupancy: overrides.initialOccupancy ?? [.56, .76],
    maturityDays: source.maturityDays,
    maxAgeDays: source.maxAgeDays,
    offspringPerAdultFemalePerYear: source.offspringPerAdultFemalePerYear,
    disturbanceTolerance: source.disturbanceTolerance,
    legacyRuntime: true,
  });
}

function species(definition: Omit<SpatialFaunaSpeciesDefinition, 'legacyRuntime'>): SpatialFaunaSpeciesDefinition {
  return Object.freeze({ ...definition, legacyRuntime: false });
}

const LEGACY_SPATIAL_FAUNA: readonly SpatialFaunaSpeciesDefinition[] = Object.freeze([
  fromLegacy('FAUNA_WILD_BOAR', { guild: 'omnivore', densityPerKm2: 6, minPatchSuitability: .38, initialOccupancy: [.52, .7] }),
  fromLegacy('FAUNA_FERAL_GOAT', { guild: 'large_herbivore', densityPerKm2: 5, minPatchSuitability: .4, initialOccupancy: [.48, .68] }),
  fromLegacy('FAUNA_AGOUTI', { guild: 'small_mammal', densityPerKm2: 50, minPatchSuitability: .34, initialOccupancy: [.58, .78] }),
  fromLegacy('FAUNA_WILD_RABBIT', { guild: 'small_mammal', densityPerKm2: 45, minPatchSuitability: .36, initialOccupancy: [.56, .78] }),
  fromLegacy('FAUNA_FERAL_CHICKEN', { guild: 'ground_bird', densityPerKm2: 35, minPatchSuitability: .34, initialOccupancy: [.58, .8] }),
  fromLegacy('FAUNA_FERAL_DUCK', { guild: 'ground_bird', densityPerKm2: 28, minPatchSuitability: .38, initialOccupancy: [.54, .76] }),
  fromLegacy('FAUNA_TREE_RAT', { guild: 'small_mammal', densityPerKm2: 220, minPatchSuitability: .3, initialOccupancy: [.62, .82] }),
]);

const EXPANDED_SPATIAL_FAUNA: readonly SpatialFaunaSpeciesDefinition[] = Object.freeze([
  species({
    id: 'FAUNA_FLYING_FOX', name: 'Flying Fox', guild: 'bat', trophicRole: 'herbivore', socialMode: 'colony',
    targets: { canopy: 84, moisture: 62, vegetation: 76, waterAccess: 36 }, tolerance: 40,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_BAMBOO_GROVE: .78, AREA_ANCIENT_RUINS: .58, AREA_SWAMP_CROSSING: .5, AREA_MANGROVE_EDGE: .46, AREA_WATERFALL_BASIN: .44 },
    diet: { fruit: .72, seeds: .18, browse: .1 }, adultWeightKg: .72, dailyFoodKgPerAdult: .18, dailyWaterNeed: 24,
    densityPerKm2: 35, worldPresence: 1, minPatchSuitability: .38, minIslandCapacity: 12, initialOccupancy: [.5, .72],
    maturityDays: 420, maxAgeDays: 5475, offspringPerAdultFemalePerYear: 1.1, disturbanceTolerance: 30,
  }),
  species({
    id: 'FAUNA_SMALL_FRUIT_BAT', name: 'Small Fruit Bat', guild: 'bat', trophicRole: 'omnivore', socialMode: 'colony',
    targets: { canopy: 76, moisture: 66, vegetation: 74 }, tolerance: 46,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_BAMBOO_GROVE: .86, AREA_ANCIENT_RUINS: .76, AREA_CAMP_CLEARING: .58, AREA_MANGROVE_EDGE: .54, AREA_SWAMP_CROSSING: .5, AREA_WATERFALL_BASIN: .48, AREA_CAVE_ENTRANCE: .42 },
    diet: { fruit: .54, insects: .28, seeds: .18 }, adultWeightKg: .12, dailyFoodKgPerAdult: .045, dailyWaterNeed: 17,
    densityPerKm2: 120, worldPresence: 1, minPatchSuitability: .3, minIslandCapacity: 20, initialOccupancy: [.6, .82],
    maturityDays: 180, maxAgeDays: 2920, offspringPerAdultFemalePerYear: 1.8, disturbanceTolerance: 52,
  }),
  species({
    id: 'FAUNA_FRUIT_DOVE', name: 'Fruit Dove', guild: 'canopy_bird', trophicRole: 'herbivore', socialMode: 'flock',
    targets: { canopy: 82, moisture: 62, vegetation: 78 }, tolerance: 38,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_BAMBOO_GROVE: .82, AREA_WATERFALL_BASIN: .7, AREA_SWAMP_CROSSING: .54, AREA_ANCIENT_RUINS: .52, AREA_MANGROVE_EDGE: .42 },
    diet: { fruit: .68, seeds: .32 }, adultWeightKg: .32, dailyFoodKgPerAdult: .055, dailyWaterNeed: 20,
    densityPerKm2: 75, worldPresence: 1, minPatchSuitability: .34, minIslandCapacity: 12, initialOccupancy: [.58, .8],
    maturityDays: 150, maxAgeDays: 2555, offspringPerAdultFemalePerYear: 3.2, disturbanceTolerance: 34,
  }),
  species({
    id: 'FAUNA_GROUND_DOVE', name: 'Ground Dove', guild: 'ground_bird', trophicRole: 'herbivore', socialMode: 'flock',
    targets: { canopy: 44, moisture: 48, sunlight: 52, vegetation: 56 }, tolerance: 48,
    regionAffinity: { AREA_CAMP_CLEARING: 1, AREA_ANCIENT_RUINS: .82, AREA_STONE_RIDGE: .62, AREA_BAMBOO_GROVE: .58, AREA_FOREST_EDGE: .52, AREA_FISHING_LAGOON: .38 },
    diet: { seeds: .62, fruit: .16, ground_vegetation: .12, insects: .1 }, adultWeightKg: .18, dailyFoodKgPerAdult: .03, dailyWaterNeed: 18,
    densityPerKm2: 55, worldPresence: 1, minPatchSuitability: .3, minIslandCapacity: 10, initialOccupancy: [.58, .8],
    maturityDays: 120, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 4.2, disturbanceTolerance: 58,
  }),
  species({
    id: 'FAUNA_ISLAND_RAIL', name: 'Island Rail', guild: 'ground_bird', trophicRole: 'omnivore', socialMode: 'pair',
    targets: { canopy: 52, moisture: 78, waterAccess: 68, floodRisk: 58, vegetation: 72 }, tolerance: 34,
    regionAffinity: { AREA_SWAMP_CROSSING: 1, AREA_MANGROVE_EDGE: .88, AREA_WATERFALL_BASIN: .7, AREA_FOREST_EDGE: .42 },
    diet: { insects: .38, seeds: .24, ground_vegetation: .14, fruit: .12, aquatic_plants: .12 }, adultWeightKg: .36, dailyFoodKgPerAdult: .06, dailyWaterNeed: 36,
    densityPerKm2: 22, worldPresence: .9, minPatchSuitability: .42, minIslandCapacity: 8, initialOccupancy: [.48, .7],
    maturityDays: 180, maxAgeDays: 2190, offspringPerAdultFemalePerYear: 3.6, disturbanceTolerance: 24,
  }),
  species({
    id: 'FAUNA_FOREST_QUAIL', name: 'Forest Quail', guild: 'ground_bird', trophicRole: 'omnivore', socialMode: 'flock',
    targets: { canopy: 66, moisture: 56, vegetation: 76, slope: 10 }, tolerance: 40,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_BAMBOO_GROVE: .86, AREA_ANCIENT_RUINS: .6, AREA_WATERFALL_BASIN: .52, AREA_STONE_RIDGE: .42 },
    diet: { seeds: .4, insects: .34, ground_vegetation: .16, fruit: .1 }, adultWeightKg: .28, dailyFoodKgPerAdult: .045, dailyWaterNeed: 22,
    densityPerKm2: 40, worldPresence: 1, minPatchSuitability: .34, minIslandCapacity: 10, initialOccupancy: [.56, .78],
    maturityDays: 135, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 5.4, disturbanceTolerance: 32,
  }),
  species({
    id: 'FAUNA_HORNBILL', name: 'Forest Hornbill', guild: 'canopy_bird', trophicRole: 'omnivore', socialMode: 'pair',
    targets: { canopy: 90, moisture: 62, vegetation: 78 }, tolerance: 28,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_BAMBOO_GROVE: .62, AREA_WATERFALL_BASIN: .58, AREA_SWAMP_CROSSING: .4 },
    diet: { fruit: .62, insects: .18, seeds: .14, carrion: .06 }, adultWeightKg: 1.7, dailyFoodKgPerAdult: .16, dailyWaterNeed: 26,
    densityPerKm2: 12, worldPresence: .82, minPatchSuitability: .5, minIslandCapacity: 6, initialOccupancy: [.42, .62],
    maturityDays: 540, maxAgeDays: 5475, offspringPerAdultFemalePerYear: 1.4, disturbanceTolerance: 18,
  }),
  species({
    id: 'FAUNA_LARGE_FOREST_RODENT', name: 'Large Forest Rodent', guild: 'small_mammal', trophicRole: 'omnivore', socialMode: 'pair',
    targets: { canopy: 72, moisture: 62, vegetation: 80, waterAccess: 34 }, tolerance: 40,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_BAMBOO_GROVE: .86, AREA_ANCIENT_RUINS: .72, AREA_WATERFALL_BASIN: .6, AREA_SWAMP_CROSSING: .52, AREA_MANGROVE_EDGE: .38 },
    diet: { fruit: .3, seeds: .26, roots_tubers: .18, insects: .14, browse: .07, carrion: .05 }, adultWeightKg: 1.1, dailyFoodKgPerAdult: .11, dailyWaterNeed: 24,
    densityPerKm2: 90, worldPresence: 1, minPatchSuitability: .32, minIslandCapacity: 16, initialOccupancy: [.58, .8],
    maturityDays: 150, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 5.8, disturbanceTolerance: 44,
  }),
  species({
    id: 'FAUNA_BAMBOO_RAT', name: 'Bamboo Rat', guild: 'small_mammal', trophicRole: 'herbivore', socialMode: 'pair',
    targets: { canopy: 64, moisture: 58, vegetation: 86, fertileSoil: 62 }, tolerance: 34,
    regionAffinity: { AREA_BAMBOO_GROVE: 1, AREA_FOREST_EDGE: .64, AREA_WATERFALL_BASIN: .4, AREA_ANCIENT_RUINS: .3 },
    diet: { roots_tubers: .42, browse: .26, ground_vegetation: .2, seeds: .12 }, adultWeightKg: .75, dailyFoodKgPerAdult: .09, dailyWaterNeed: 20,
    densityPerKm2: 60, worldPresence: .94, minPatchSuitability: .4, minIslandCapacity: 10, initialOccupancy: [.5, .72],
    maturityDays: 135, maxAgeDays: 1460, offspringPerAdultFemalePerYear: 5.2, disturbanceTolerance: 38,
  }),
  species({
    id: 'FAUNA_PALM_SQUIRREL', name: 'Palm Squirrel', guild: 'small_mammal', trophicRole: 'omnivore', socialMode: 'loose_group',
    targets: { canopy: 62, moisture: 48, vegetation: 68, sunlight: 42 }, tolerance: 48,
    regionAffinity: { AREA_CAMP_CLEARING: 1, AREA_ANCIENT_RUINS: .9, AREA_FOREST_EDGE: .82, AREA_FISHING_LAGOON: .64, AREA_BAMBOO_GROVE: .62, AREA_MANGROVE_EDGE: .42 },
    diet: { fruit: .36, seeds: .34, insects: .2, browse: .1 }, adultWeightKg: .26, dailyFoodKgPerAdult: .04, dailyWaterNeed: 17,
    densityPerKm2: 110, worldPresence: 1, minPatchSuitability: .28, minIslandCapacity: 18, initialOccupancy: [.62, .84],
    maturityDays: 120, maxAgeDays: 1460, offspringPerAdultFemalePerYear: 5.6, disturbanceTolerance: 72,
  }),
  species({
    id: 'FAUNA_MOUSE_DEER', name: 'Mouse Deer', guild: 'large_herbivore', trophicRole: 'herbivore', socialMode: 'solitary',
    targets: { canopy: 84, moisture: 68, waterAccess: 46, vegetation: 82 }, tolerance: 30,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_SWAMP_CROSSING: .68, AREA_BAMBOO_GROVE: .62, AREA_WATERFALL_BASIN: .54 },
    diet: { browse: .34, fruit: .3, ground_vegetation: .2, seeds: .1, roots_tubers: .06 }, adultWeightKg: 4.2, dailyFoodKgPerAdult: .32, dailyWaterNeed: 34,
    densityPerKm2: 10, worldPresence: .78, minPatchSuitability: .5, minIslandCapacity: 6, initialOccupancy: [.4, .62],
    maturityDays: 300, maxAgeDays: 3285, offspringPerAdultFemalePerYear: 1.8, disturbanceTolerance: 18,
  }),
  species({
    id: 'FAUNA_FOREST_GECKO', name: 'Forest Gecko', guild: 'reptile', trophicRole: 'omnivore', socialMode: 'solitary',
    targets: { canopy: 74, moisture: 68, vegetation: 72, rocks: 34 }, tolerance: 46,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_ANCIENT_RUINS: .94, AREA_BAMBOO_GROVE: .82, AREA_CAVE_ENTRANCE: .74, AREA_WATERFALL_BASIN: .68, AREA_SWAMP_CROSSING: .58, AREA_MANGROVE_EDGE: .46 },
    diet: { insects: .82, fruit: .08, seeds: .05, carrion: .05 }, adultWeightKg: .055, dailyFoodKgPerAdult: .008, dailyWaterNeed: 18,
    densityPerKm2: 180, worldPresence: 1, minPatchSuitability: .28, minIslandCapacity: 24, initialOccupancy: [.64, .86],
    maturityDays: 210, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 4.4, disturbanceTolerance: 56,
  }),
  species({
    id: 'FAUNA_FOREST_SKINK', name: 'Forest Skink', guild: 'reptile', trophicRole: 'omnivore', socialMode: 'solitary',
    targets: { canopy: 54, moisture: 56, sunlight: 46, rocks: 42, vegetation: 66 }, tolerance: 50,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_ANCIENT_RUINS: .92, AREA_CAMP_CLEARING: .8, AREA_STONE_RIDGE: .76, AREA_BAMBOO_GROVE: .74, AREA_FISHING_LAGOON: .6, AREA_WATERFALL_BASIN: .58 },
    diet: { insects: .78, fruit: .08, seeds: .06, carrion: .08 }, adultWeightKg: .08, dailyFoodKgPerAdult: .01, dailyWaterNeed: 17,
    densityPerKm2: 150, worldPresence: 1, minPatchSuitability: .26, minIslandCapacity: 22, initialOccupancy: [.62, .84],
    maturityDays: 180, maxAgeDays: 1460, offspringPerAdultFemalePerYear: 5.2, disturbanceTolerance: 62,
  }),
  species({
    id: 'FAUNA_GROUND_FROG', name: 'Ground Frog', guild: 'amphibian', trophicRole: 'omnivore', socialMode: 'loose_group',
    targets: { canopy: 64, moisture: 88, waterAccess: 72, floodRisk: 52, vegetation: 72 }, tolerance: 34,
    regionAffinity: { AREA_SWAMP_CROSSING: 1, AREA_FOREST_EDGE: .9, AREA_WATERFALL_BASIN: .88, AREA_MANGROVE_EDGE: .72, AREA_BAMBOO_GROVE: .62, AREA_CAVE_ENTRANCE: .48 },
    diet: { insects: .94, aquatic_plants: .02, carrion: .04 }, adultWeightKg: .045, dailyFoodKgPerAdult: .006, dailyWaterNeed: 84,
    densityPerKm2: 300, worldPresence: 1, minPatchSuitability: .34, minIslandCapacity: 30, initialOccupancy: [.64, .86],
    maturityDays: 150, maxAgeDays: 1095, offspringPerAdultFemalePerYear: 14, disturbanceTolerance: 30,
  }),
  species({
    id: 'FAUNA_TREE_FROG', name: 'Tree Frog', guild: 'amphibian', trophicRole: 'omnivore', socialMode: 'loose_group',
    targets: { canopy: 82, moisture: 90, waterAccess: 62, vegetation: 86 }, tolerance: 30,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_SWAMP_CROSSING: .92, AREA_WATERFALL_BASIN: .84, AREA_BAMBOO_GROVE: .74, AREA_MANGROVE_EDGE: .62 },
    diet: { insects: .96, carrion: .04 }, adultWeightKg: .025, dailyFoodKgPerAdult: .004, dailyWaterNeed: 88,
    densityPerKm2: 260, worldPresence: 1, minPatchSuitability: .38, minIslandCapacity: 28, initialOccupancy: [.62, .84],
    maturityDays: 135, maxAgeDays: 1095, offspringPerAdultFemalePerYear: 16, disturbanceTolerance: 24,
  }),
  species({
    id: 'FAUNA_COCONUT_CRAB', name: 'Coconut Crab', guild: 'invertebrate', trophicRole: 'omnivore', socialMode: 'solitary',
    targets: { canopy: 32, moisture: 52, sunlight: 58, vegetation: 46, rocks: 32 }, tolerance: 42,
    regionAffinity: { AREA_FISHING_LAGOON: 1, AREA_CAMP_CLEARING: .84, AREA_MANGROVE_EDGE: .72, AREA_ANCIENT_RUINS: .34 },
    diet: { fruit: .34, seeds: .2, carrion: .22, ground_vegetation: .12, insects: .12 }, adultWeightKg: 2.8, dailyFoodKgPerAdult: .12, dailyWaterNeed: 28,
    densityPerKm2: 20, worldPresence: .9, minPatchSuitability: .4, minIslandCapacity: 8, initialOccupancy: [.46, .68],
    maturityDays: 1460, maxAgeDays: 10950, offspringPerAdultFemalePerYear: 2.2, disturbanceTolerance: 26,
  }),
  species({
    id: 'FAUNA_MARSH_TURTLE', name: 'Marsh Turtle', guild: 'reptile', trophicRole: 'omnivore', socialMode: 'solitary',
    targets: { canopy: 42, moisture: 90, waterAccess: 92, floodRisk: 76, vegetation: 58 }, tolerance: 28,
    regionAffinity: { AREA_SWAMP_CROSSING: 1, AREA_MANGROVE_EDGE: .84, AREA_WATERFALL_BASIN: .7 },
    diet: { aquatic_plants: .42, insects: .24, carrion: .18, ground_vegetation: .1, fruit: .06 }, adultWeightKg: 1.6, dailyFoodKgPerAdult: .07, dailyWaterNeed: 88,
    densityPerKm2: 8, worldPresence: .75, minPatchSuitability: .52, minIslandCapacity: 5, initialOccupancy: [.38, .58],
    maturityDays: 1095, maxAgeDays: 10950, offspringPerAdultFemalePerYear: 2.4, disturbanceTolerance: 20,
  }),
]);

export const SPATIAL_FAUNA_SPECIES: readonly SpatialFaunaSpeciesDefinition[] = Object.freeze([
  ...LEGACY_SPATIAL_FAUNA,
  ...EXPANDED_SPATIAL_FAUNA,
]);

export const SPATIAL_FAUNA_SPECIES_BY_ID: Readonly<Record<string, SpatialFaunaSpeciesDefinition>> = Object.freeze(
  Object.fromEntries(SPATIAL_FAUNA_SPECIES.map(entry => [entry.id, entry])),
);

export const SPATIAL_FAUNA_SPECIES_IDS = Object.freeze(SPATIAL_FAUNA_SPECIES.map(entry => entry.id));
export const LEGACY_SPATIAL_FAUNA_SPECIES_IDS = Object.freeze(LEGACY_SPATIAL_FAUNA.map(entry => entry.id));
