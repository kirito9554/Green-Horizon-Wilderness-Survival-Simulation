import type { MainWorldAreaId } from './mainWorldAreas';
import type { EcologyTargetProfile } from './ecologyProfiles';

export interface SpatialPredatorSpeciesDefinition {
  id: string;
  name: string;
  targets: EcologyTargetProfile;
  tolerance: number;
  regionAffinity: Partial<Record<MainWorldAreaId, number>>;
  preyWeights: Readonly<Record<string, number>>;
  adultWeightKg: number;
  dailyFoodKgPerAdult: number;
  dailyWaterNeed: number;
  densityPerKm2: number;
  worldPresence: number;
  minPatchSuitability: number;
  minIslandCapacity: number;
  initialOccupancy: readonly [number, number];
  homeRangeKm: number;
  maxAdultPreyKg: number;
  juvenilePreference: number;
  huntSuccessBase: number;
  maturityDays: number;
  maxAgeDays: number;
  offspringPerAdultFemalePerYear: number;
  disturbanceTolerance: number;
}

const P = (definition: SpatialPredatorSpeciesDefinition): SpatialPredatorSpeciesDefinition => Object.freeze(definition);

export const SPATIAL_PREDATOR_SPECIES: readonly SpatialPredatorSpeciesDefinition[] = Object.freeze([
  P({
    id: 'PREDATOR_MONITOR_LIZARD', name: 'Monitor Lizard',
    targets: { canopy: 48, moisture: 66, waterAccess: 54, sunlight: 46, vegetation: 58 }, tolerance: 44,
    regionAffinity: { AREA_SWAMP_CROSSING: 1, AREA_MANGROVE_EDGE: .92, AREA_FOREST_EDGE: .76, AREA_WATERFALL_BASIN: .72, AREA_CAMP_CLEARING: .42, AREA_ANCIENT_RUINS: .38, AREA_BAMBOO_GROVE: .34 },
    preyWeights: { FAUNA_TREE_RAT: 1, FAUNA_FOREST_QUAIL: .9, FAUNA_FERAL_CHICKEN: .86, FAUNA_GROUND_FROG: .82, FAUNA_TREE_FROG: .72, FAUNA_FOREST_GECKO: .7, FAUNA_FOREST_SKINK: .68, FAUNA_WILD_RABBIT: .62, FAUNA_FERAL_DUCK: .56, FAUNA_AGOUTI: .38, FAUNA_COCONUT_CRAB: .24 },
    adultWeightKg: 8.5, dailyFoodKgPerAdult: .55, dailyWaterNeed: 38, densityPerKm2: 1.8, worldPresence: 1, minPatchSuitability: .36, minIslandCapacity: 5, initialOccupancy: [.48, .68], homeRangeKm: 1.4, maxAdultPreyKg: 4.5, juvenilePreference: .58, huntSuccessBase: .34, maturityDays: 540, maxAgeDays: 5475, offspringPerAdultFemalePerYear: 1.8, disturbanceTolerance: 44,
  }),
  P({
    id: 'PREDATOR_PYTHON', name: 'Large Python',
    targets: { canopy: 72, moisture: 70, waterAccess: 44, sunlight: 26, vegetation: 78 }, tolerance: 38,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_SWAMP_CROSSING: .9, AREA_BAMBOO_GROVE: .72, AREA_MANGROVE_EDGE: .68, AREA_WATERFALL_BASIN: .58, AREA_ANCIENT_RUINS: .42 },
    preyWeights: { FAUNA_WILD_RABBIT: 1, FAUNA_AGOUTI: .94, FAUNA_LARGE_FOREST_RODENT: .9, FAUNA_TREE_RAT: .86, FAUNA_FOREST_QUAIL: .8, FAUNA_FERAL_CHICKEN: .78, FAUNA_PALM_SQUIRREL: .72, FAUNA_FERAL_DUCK: .58, FAUNA_MOUSE_DEER: .48, FAUNA_FLYING_FOX: .36, FAUNA_WILD_BOAR: .14 },
    adultWeightKg: 24, dailyFoodKgPerAdult: .72, dailyWaterNeed: 32, densityPerKm2: 1.15, worldPresence: 1, minPatchSuitability: .4, minIslandCapacity: 4, initialOccupancy: [.44, .64], homeRangeKm: 1.8, maxAdultPreyKg: 16, juvenilePreference: .62, huntSuccessBase: .28, maturityDays: 900, maxAgeDays: 7300, offspringPerAdultFemalePerYear: 1.1, disturbanceTolerance: 24,
  }),
  P({
    id: 'PREDATOR_RAPTOR', name: 'Forest Raptor',
    targets: { canopy: 38, sunlight: 62, slope: 18, rocks: 42, vegetation: 48 }, tolerance: 44,
    regionAffinity: { AREA_STONE_RIDGE: 1, AREA_FOREST_EDGE: .76, AREA_ANCIENT_RUINS: .72, AREA_BAMBOO_GROVE: .58, AREA_WATERFALL_BASIN: .52, AREA_CAMP_CLEARING: .38, AREA_SWAMP_CROSSING: .28 },
    preyWeights: { FAUNA_TREE_RAT: 1, FAUNA_PALM_SQUIRREL: .94, FAUNA_WILD_RABBIT: .9, FAUNA_FOREST_QUAIL: .88, FAUNA_GROUND_DOVE: .86, FAUNA_FERAL_CHICKEN: .8, FAUNA_FRUIT_DOVE: .74, FAUNA_FOREST_GECKO: .58, FAUNA_FOREST_SKINK: .55, FAUNA_AGOUTI: .38 },
    adultWeightKg: 4.8, dailyFoodKgPerAdult: .42, dailyWaterNeed: 20, densityPerKm2: .78, worldPresence: .96, minPatchSuitability: .4, minIslandCapacity: 3, initialOccupancy: [.42, .62], homeRangeKm: 3.2, maxAdultPreyKg: 4.2, juvenilePreference: .52, huntSuccessBase: .31, maturityDays: 730, maxAgeDays: 6570, offspringPerAdultFemalePerYear: .85, disturbanceTolerance: 26,
  }),
  P({
    id: 'PREDATOR_CIVET', name: 'Island Civet',
    targets: { canopy: 64, moisture: 58, vegetation: 68, slope: 9 }, tolerance: 46,
    regionAffinity: { AREA_FOREST_EDGE: 1, AREA_ANCIENT_RUINS: .86, AREA_CAMP_CLEARING: .62, AREA_BAMBOO_GROVE: .62, AREA_WATERFALL_BASIN: .48, AREA_SWAMP_CROSSING: .38 },
    preyWeights: { FAUNA_TREE_RAT: 1, FAUNA_SMALL_FRUIT_BAT: .82, FAUNA_FOREST_QUAIL: .78, FAUNA_FERAL_CHICKEN: .76, FAUNA_GROUND_DOVE: .7, FAUNA_WILD_RABBIT: .55, FAUNA_PALM_SQUIRREL: .54, FAUNA_LARGE_FOREST_RODENT: .48, FAUNA_AGOUTI: .32, FAUNA_GROUND_FROG: .3, FAUNA_TREE_FROG: .28 },
    adultWeightKg: 5.4, dailyFoodKgPerAdult: .38, dailyWaterNeed: 30, densityPerKm2: 2.4, worldPresence: 1, minPatchSuitability: .34, minIslandCapacity: 6, initialOccupancy: [.52, .72], homeRangeKm: 1.25, maxAdultPreyKg: 3.5, juvenilePreference: .54, huntSuccessBase: .32, maturityDays: 420, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 1.9, disturbanceTolerance: 58,
  }),
  P({
    id: 'PREDATOR_ESTUARINE_CROCODILE', name: 'Estuarine Crocodile',
    targets: { canopy: 28, moisture: 92, waterAccess: 96, floodRisk: 82, sunlight: 52 }, tolerance: 30,
    regionAffinity: { AREA_MANGROVE_EDGE: 1, AREA_SWAMP_CROSSING: .88, AREA_WATERFALL_BASIN: .48 },
    preyWeights: { FAUNA_FERAL_DUCK: 1, FAUNA_WILD_BOAR: .62, FAUNA_FERAL_GOAT: .44, FAUNA_MOUSE_DEER: .42, FAUNA_AGOUTI: .34, FAUNA_MARSH_TURTLE: .3, FAUNA_WILD_RABBIT: .26, FAUNA_COCONUT_CRAB: .18 },
    adultWeightKg: 180, dailyFoodKgPerAdult: 1.65, dailyWaterNeed: 90, densityPerKm2: .24, worldPresence: .92, minPatchSuitability: .58, minIslandCapacity: 2, initialOccupancy: [.38, .56], homeRangeKm: 3.5, maxAdultPreyKg: 90, juvenilePreference: .45, huntSuccessBase: .24, maturityDays: 3650, maxAgeDays: 21900, offspringPerAdultFemalePerYear: .38, disturbanceTolerance: 20,
  }),
]);

export const SPATIAL_PREDATOR_BY_ID: Readonly<Record<string, SpatialPredatorSpeciesDefinition>> = Object.freeze(
  Object.fromEntries(SPATIAL_PREDATOR_SPECIES.map(entry => [entry.id, entry])),
);
