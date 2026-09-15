import type { MainWorldAreaId } from '../data/mainWorldAreas';
import type { HydrologyEdgeKind, HydrologyNodeKind, WaterInfrastructureKind } from './hydrologySimulation';

export type HydroperiodClass = 'ephemeral' | 'seasonal' | 'perennial';
export type AquaticConnectivityMode = 'hydraulic' | 'biological';
export type AquaticHabitatType = 'flowing_channel' | 'standing_water' | 'tidal_water' | 'managed_pond';

export interface AquaticHydrologyCriteria {
  minDepthM?: number;
  maxDepthM?: number;
  minDissolvedOxygenMgL?: number;
  maxVelocityMps?: number;
  minVelocityMps?: number;
  minSalinityPpt?: number;
  maxSalinityPpt?: number;
  maxTurbidity?: number;
  maxContamination?: number;
  minimumPassability?: number;
}

export interface HydroperiodSnapshot {
  currentWet: boolean;
  observedHours: number;
  floodedHours: number;
  wetFraction: number;
  reliability: number;
  classification: HydroperiodClass;
}

export interface AquaticBarrierSnapshot {
  infrastructureId: string;
  structureId: string;
  kind: WaterInfrastructureKind;
  poiId: MainWorldAreaId;
  affectedEdgeIds: string[];
  passability: number;
  reason: string;
}

export interface AquaticConnectivityLink {
  edgeId: string;
  kind?: HydrologyEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  fromPoiId?: MainWorldAreaId;
  toPoiId?: MainWorldAreaId;
  hydraulicOpen: boolean;
  biologicalOpen: boolean;
  passability: number;
  limitingFactors: string[];
}

export interface AquaticWaterQualitySnapshot {
  temperatureC: number;
  dissolvedOxygenMgL: number;
  turbidity: number;
  contamination: number;
  salinityPpt: number;
}

export interface AquaticWaterBodySnapshot {
  id: string;
  nodeIds: string[];
  edgeIds: string[];
  poiIds: MainWorldAreaId[];
  nodeKinds: HydrologyNodeKind[];
  habitatType: AquaticHabitatType;
  currentVolumeM3: number;
  estimatedChannelVolumeM3: number;
  meanDepthM: number;
  meanVelocityMps: number;
  quality: AquaticWaterQualitySnapshot;
  hydroperiod: HydroperiodSnapshot;
  hydraulicConnectivity: number;
  biologicalConnectivity: number;
  limitingFactors: string[];
}

export interface AquaticHabitatCandidate {
  id: string;
  waterBodyId: string;
  poiId: MainWorldAreaId;
  habitatType: AquaticHabitatType;
  nodeIds: string[];
  edgeIds: string[];
  cellIds: string[];
  depthM: number;
  velocityMps: number;
  currentVolumeM3: number;
  hydroperiod: HydroperiodSnapshot;
  quality: AquaticWaterQualitySnapshot;
  hydraulicConnectivity: number;
  biologicalConnectivity: number;
  suitability: number;
  limitingFactors: string[];
}
