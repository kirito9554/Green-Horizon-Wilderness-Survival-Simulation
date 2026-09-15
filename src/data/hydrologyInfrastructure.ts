import type {
  WaterInfrastructureKind,
  WaterInfrastructurePurpose,
  WaterUseClass,
} from '../types/hydrologySimulation';

export interface WaterInfrastructureProfile {
  buildingId: string;
  kind: WaterInfrastructureKind;
  purpose: WaterInfrastructurePurpose;
  baseCapacityM3H: number;
  baseLeakage: number;
  baseBlockage: number;
  storageCapacityM3?: number;
  rainCollectionAreaM2?: number;
  gravityRequired: boolean;
  minimumHeadM: number;
  defaultDesiredFlowM3H: number;
  defaultWaterUseClass: WaterUseClass;
  targetCellLimit: number;
}

/**
 * Hydraulic behavior only. Construction cost, footprint, condition, repair and
 * modification remain owned by the normal Building/Structure systems.
 */
export const WATER_INFRASTRUCTURE_PROFILES: Record<string, WaterInfrastructureProfile> = {
  BUILDING_RAIN_COLLECTOR: {
    buildingId: 'BUILDING_RAIN_COLLECTOR',
    kind: 'rain_collector',
    purpose: 'rain_collection',
    baseCapacityM3H: 0.08,
    baseLeakage: 0.06,
    baseBlockage: 0.03,
    storageCapacityM3: 0.025,
    rainCollectionAreaM2: 10,
    gravityRequired: false,
    minimumHeadM: 0,
    defaultDesiredFlowM3H: 0.04,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 0,
  },
  BUILDING_BAMBOO_WATER_TANK: {
    buildingId: 'BUILDING_BAMBOO_WATER_TANK',
    kind: 'cistern',
    purpose: 'storage',
    baseCapacityM3H: 0.6,
    baseLeakage: 0.012,
    baseBlockage: 0.01,
    storageCapacityM3: 0.07,
    gravityRequired: true,
    minimumHeadM: 0.04,
    defaultDesiredFlowM3H: 0.16,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 0,
  },
  BUILDING_IRRIGATION_DITCH: {
    buildingId: 'BUILDING_IRRIGATION_DITCH',
    kind: 'ditch',
    purpose: 'irrigation',
    baseCapacityM3H: 1.15,
    baseLeakage: 0.16,
    baseBlockage: 0.08,
    gravityRequired: true,
    minimumHeadM: 0.03,
    defaultDesiredFlowM3H: 0.55,
    defaultWaterUseClass: 'normal_crops',
    targetCellLimit: 8,
  },
  BUILDING_DRAINAGE_DITCH: {
    buildingId: 'BUILDING_DRAINAGE_DITCH',
    kind: 'ditch',
    purpose: 'drainage',
    baseCapacityM3H: 1.45,
    baseLeakage: 0.08,
    baseBlockage: 0.1,
    gravityRequired: true,
    minimumHeadM: 0.02,
    defaultDesiredFlowM3H: 0.7,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 10,
  },
  BUILDING_BAMBOO_WATER_CHANNEL: {
    buildingId: 'BUILDING_BAMBOO_WATER_CHANNEL',
    kind: 'channel',
    purpose: 'transfer',
    baseCapacityM3H: 0.9,
    baseLeakage: 0.09,
    baseBlockage: 0.045,
    gravityRequired: true,
    minimumHeadM: 0.04,
    defaultDesiredFlowM3H: 0.5,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 6,
  },
  BUILDING_SMALL_DIVERSION_WEIR: {
    buildingId: 'BUILDING_SMALL_DIVERSION_WEIR',
    kind: 'weir',
    purpose: 'diversion',
    baseCapacityM3H: 2.4,
    baseLeakage: 0.035,
    baseBlockage: 0.04,
    gravityRequired: true,
    minimumHeadM: 0.02,
    defaultDesiredFlowM3H: 0.9,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 0,
  },
  BUILDING_EARTHEN_POND: {
    buildingId: 'BUILDING_EARTHEN_POND',
    kind: 'pond',
    purpose: 'storage',
    baseCapacityM3H: 1.25,
    baseLeakage: 0.028,
    baseBlockage: 0,
    storageCapacityM3: 18,
    rainCollectionAreaM2: 32,
    gravityRequired: false,
    minimumHeadM: 0,
    defaultDesiredFlowM3H: 0.55,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 0,
  },
  BUILDING_SIMPLE_SLUICE: {
    buildingId: 'BUILDING_SIMPLE_SLUICE',
    kind: 'sluice',
    purpose: 'diversion',
    baseCapacityM3H: 2,
    baseLeakage: 0.025,
    baseBlockage: 0.035,
    gravityRequired: true,
    minimumHeadM: 0.015,
    defaultDesiredFlowM3H: 0.8,
    defaultWaterUseClass: 'reserve',
    targetCellLimit: 0,
  },
};

export function getWaterInfrastructureProfile(buildingId: string): WaterInfrastructureProfile | undefined {
  return WATER_INFRASTRUCTURE_PROFILES[buildingId];
}
