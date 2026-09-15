import type { BuildSoilType } from '../types/buildingSimulation';
import type { MainWorldAreaId } from './mainWorldAreas';

export interface SoilHydrologyProfile {
  infiltrationMmH: number;
  fieldCapacityMm: number;
  saturationCapacityMm: number;
  deepDrainageFraction: number;
  runoffCoefficient: number;
  erosionResistance: number;
}

export const SOIL_HYDROLOGY_PROFILES: Record<BuildSoilType, SoilHydrologyProfile> = {
  sand: {
    infiltrationMmH: 34,
    fieldCapacityMm: 92,
    saturationCapacityMm: 145,
    deepDrainageFraction: 0.62,
    runoffCoefficient: 0.08,
    erosionResistance: 0.36,
  },
  loam: {
    infiltrationMmH: 18,
    fieldCapacityMm: 155,
    saturationCapacityMm: 235,
    deepDrainageFraction: 0.34,
    runoffCoefficient: 0.16,
    erosionResistance: 0.62,
  },
  clay: {
    infiltrationMmH: 6,
    fieldCapacityMm: 205,
    saturationCapacityMm: 285,
    deepDrainageFraction: 0.1,
    runoffCoefficient: 0.46,
    erosionResistance: 0.7,
  },
  rock: {
    infiltrationMmH: 1.5,
    fieldCapacityMm: 38,
    saturationCapacityMm: 62,
    deepDrainageFraction: 0.05,
    runoffCoefficient: 0.78,
    erosionResistance: 0.96,
  },
  mud: {
    infiltrationMmH: 3,
    fieldCapacityMm: 245,
    saturationCapacityMm: 335,
    deepDrainageFraction: 0.06,
    runoffCoefficient: 0.52,
    erosionResistance: 0.3,
  },
  gravel: {
    infiltrationMmH: 42,
    fieldCapacityMm: 72,
    saturationCapacityMm: 125,
    deepDrainageFraction: 0.74,
    runoffCoefficient: 0.1,
    erosionResistance: 0.58,
  },
  organic: {
    infiltrationMmH: 12,
    fieldCapacityMm: 285,
    saturationCapacityMm: 390,
    deepDrainageFraction: 0.14,
    runoffCoefficient: 0.18,
    erosionResistance: 0.42,
  },
};

export interface RegionHydrologyProfile {
  rainfallMultiplier: number;
  /** Fraction of deep drainage retained by the modeled aquifer; must stay within 0..1. */
  rechargeMultiplier: number;
  evapotranspirationMultiplier: number;
  effectiveLandscapeScale: number;
  watershedId: string;
  downstreamPoiIds: MainWorldAreaId[];
}

export const REGION_HYDROLOGY_PROFILES: Record<MainWorldAreaId, RegionHydrologyProfile> = {
  AREA_CAVE_ENTRANCE: {
    rainfallMultiplier: 0.82,
    rechargeMultiplier: 0.92,
    evapotranspirationMultiplier: 0.22,
    effectiveLandscapeScale: 520,
    watershedId: 'WS_NORTH_KARST',
    downstreamPoiIds: ['AREA_WATERFALL_BASIN'],
  },
  AREA_STONE_RIDGE: {
    rainfallMultiplier: 1.24,
    rechargeMultiplier: 0.82,
    evapotranspirationMultiplier: 0.88,
    effectiveLandscapeScale: 900,
    watershedId: 'WS_NORTH_KARST',
    downstreamPoiIds: ['AREA_BAMBOO_GROVE', 'AREA_WATERFALL_BASIN'],
  },
  AREA_BAMBOO_GROVE: {
    rainfallMultiplier: 1.12,
    rechargeMultiplier: 0.84,
    evapotranspirationMultiplier: 0.94,
    effectiveLandscapeScale: 760,
    watershedId: 'WS_NORTH_KARST',
    downstreamPoiIds: ['AREA_WATERFALL_BASIN'],
  },
  AREA_ANCIENT_RUINS: {
    rainfallMultiplier: 0.96,
    rechargeMultiplier: 0.68,
    evapotranspirationMultiplier: 1.02,
    effectiveLandscapeScale: 640,
    watershedId: 'WS_EAST_COAST',
    downstreamPoiIds: ['AREA_FOREST_EDGE', 'AREA_CAMP_CLEARING'],
  },
  AREA_CAMP_CLEARING: {
    rainfallMultiplier: 0.9,
    rechargeMultiplier: 0.54,
    evapotranspirationMultiplier: 1.18,
    effectiveLandscapeScale: 460,
    watershedId: 'WS_EAST_COAST',
    downstreamPoiIds: ['AREA_FISHING_LAGOON'],
  },
  AREA_MANGROVE_EDGE: {
    rainfallMultiplier: 1.04,
    rechargeMultiplier: 0.42,
    evapotranspirationMultiplier: 0.96,
    effectiveLandscapeScale: 820,
    watershedId: 'WS_RAINFOREST_DELTA',
    downstreamPoiIds: ['AREA_FISHING_LAGOON'],
  },
  AREA_FOREST_EDGE: {
    rainfallMultiplier: 1.18,
    rechargeMultiplier: 0.9,
    evapotranspirationMultiplier: 0.72,
    effectiveLandscapeScale: 1180,
    watershedId: 'WS_RAINFOREST_DELTA',
    downstreamPoiIds: ['AREA_SWAMP_CROSSING', 'AREA_WATERFALL_BASIN'],
  },
  AREA_SWAMP_CROSSING: {
    rainfallMultiplier: 1.12,
    rechargeMultiplier: 0.58,
    evapotranspirationMultiplier: 0.78,
    effectiveLandscapeScale: 980,
    watershedId: 'WS_RAINFOREST_DELTA',
    downstreamPoiIds: ['AREA_MANGROVE_EDGE'],
  },
  AREA_WATERFALL_BASIN: {
    rainfallMultiplier: 1.14,
    rechargeMultiplier: 0.88,
    evapotranspirationMultiplier: 0.84,
    effectiveLandscapeScale: 1080,
    watershedId: 'WS_NORTH_KARST',
    downstreamPoiIds: ['AREA_MANGROVE_EDGE', 'AREA_FISHING_LAGOON'],
  },
  AREA_FISHING_LAGOON: {
    rainfallMultiplier: 0.92,
    rechargeMultiplier: 0.32,
    evapotranspirationMultiplier: 1.22,
    effectiveLandscapeScale: 700,
    watershedId: 'WS_EAST_COAST',
    downstreamPoiIds: [],
  },
};

export interface WatershedProfile {
  id: string;
  regionIds: MainWorldAreaId[];
  conductivity: number;
  aquiferCapacityPerEffectiveM2: number;
}

export const WATERSHED_PROFILES: Record<string, WatershedProfile> = {
  WS_NORTH_KARST: {
    id: 'WS_NORTH_KARST',
    regionIds: ['AREA_CAVE_ENTRANCE', 'AREA_STONE_RIDGE', 'AREA_BAMBOO_GROVE', 'AREA_WATERFALL_BASIN'],
    conductivity: 0.76,
    aquiferCapacityPerEffectiveM2: 0.32,
  },
  WS_RAINFOREST_DELTA: {
    id: 'WS_RAINFOREST_DELTA',
    regionIds: ['AREA_FOREST_EDGE', 'AREA_SWAMP_CROSSING', 'AREA_MANGROVE_EDGE'],
    conductivity: 0.48,
    aquiferCapacityPerEffectiveM2: 0.44,
  },
  WS_EAST_COAST: {
    id: 'WS_EAST_COAST',
    regionIds: ['AREA_ANCIENT_RUINS', 'AREA_CAMP_CLEARING', 'AREA_FISHING_LAGOON'],
    conductivity: 0.58,
    aquiferCapacityPerEffectiveM2: 0.24,
  },
};
