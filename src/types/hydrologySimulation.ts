import type { BuildSoilType } from './buildingSimulation';
import type { MainWorldAreaId } from '../data/mainWorldAreas';

export type HydrologyAnchorKind =
  | 'river_entry'
  | 'river_exit'
  | 'waterfall'
  | 'estuary'
  | 'coast'
  | 'major_wetland'
  | 'spring_zone';

export type HydrologyNodeKind = HydrologyAnchorKind | 'depression' | 'groundwater' | 'channel';
export type HydrologyEdgeKind = 'stream' | 'river' | 'waterfall' | 'spillway' | 'estuary' | 'tidal';

export interface SoilHydrologyProfileSnapshot {
  soilType: BuildSoilType;
  infiltrationMmH: number;
  fieldCapacityMm: number;
  saturationCapacityMm: number;
  deepDrainageFraction: number;
  runoffCoefficient: number;
  erosionResistance: number;
}

export interface CellHydrologyState {
  id: string;
  poiId: MainWorldAreaId;
  cellId: string;
  soilWaterMm: number;
  rootZoneMoisture: number;
  saturation: number;
  surfaceWaterDepthM: number;
  waterTableDepthM: number;
  infiltrationMmH: number;
  runoffMmH: number;
  evapotranspirationMmH: number;
  inflowM3H: number;
  outflowM3H: number;
  currentFloodRisk: number;
  reliableWaterAccess: number;
  temperatureC: number;
  turbidity: number;
  contamination: number;
  /** Detailed M3/M4 water-quality state, added compatibly inside save schema V14. */
  dissolvedOxygenMgL?: number;
  sedimentKg?: number;
  contaminantLoad?: number;
  salinityPpt?: number;
  tidalSurfaceWaterDepthM?: number;
  maxObservedFloodDepthM: number;
  saturatedHours: number;
  floodedHours: number;
  observedHours: number;
  lastUpdatedGameMinute: number;
}

export interface CellDrainageLink {
  cellId: string;
  downstreamCellId?: string;
  upstreamCellIds: string[];
  flowAccumulation: number;
  isDepression: boolean;
  isOutlet: boolean;
}

export interface HydrologyNode {
  id: string;
  kind: HydrologyNodeKind;
  poiId: MainWorldAreaId;
  cellId?: string;
  elevationM: number;
  storageM3: number;
  capacityM3: number;
  waterLevelM: number;
  inflowM3H: number;
  outflowM3H: number;
  active: boolean;
  temperatureC?: number;
  dissolvedOxygenMgL?: number;
  turbidity?: number;
  contamination?: number;
  salinityPpt?: number;
  sedimentLoadKg?: number;
}

export interface HydrologyEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  lengthM: number;
  widthM: number;
  slope: number;
  channelCapacityM3H: number;
  dischargeM3H: number;
  flowVelocityMps: number;
  sedimentLoadKg: number;
  contaminationLoad: number;
  kind?: HydrologyEdgeKind;
  fromPoiId?: MainWorldAreaId;
  toPoiId?: MainWorldAreaId;
  depthM?: number;
  bankfullDepthM?: number;
  temperatureC?: number;
  dissolvedOxygenMgL?: number;
  turbidity?: number;
  salinityPpt?: number;
}

export interface WatershedState {
  id: string;
  regionIds: MainWorldAreaId[];
  materializedRegionIds: MainWorldAreaId[];
  catchmentAreaM2: number;
  rainfallInputM3: number;
  surfaceStorageM3: number;
  dischargeM3H: number;
  lastUpdatedGameMinute: number;
}

export interface AquiferState {
  id: string;
  watershedId: string;
  storageM3: number;
  capacityM3: number;
  rechargeM3PerDay: number;
  waterTableElevationM: number;
  conductivity: number;
  lastUpdatedGameMinute: number;
}

export interface RegionHydrologyState {
  poiId: MainWorldAreaId;
  generationVersion: number;
  generationSeed: number;
  watershedId: string;
  cellStateIds: string[];
  drainageLinks: CellDrainageLink[];
  anchorNodeIds: string[];
  downstreamPoiIds: MainWorldAreaId[];
  channelEdgeIds?: string[];
  spillwayEdgeIds?: string[];
  surfaceDischargeM3H?: number;
  lastHydrologyTickGameMinute: number;
}

export interface WaterInfrastructureInstance {
  id: string;
  structureId: string;
  poiId: MainWorldAreaId;
  kind: 'ditch' | 'channel' | 'weir' | 'pond' | 'cistern' | 'sluice' | 'pump' | 'pipe';
  inputNodeIds: string[];
  outputNodeIds: string[];
  capacityM3H: number;
  leakage: number;
  blockage: number;
}

export interface WaterManagementNetwork {
  id: string;
  poiId: MainWorldAreaId;
  infrastructureIds: string[];
  allocationPolicy: 'drinking_first' | 'balanced' | 'agriculture_first' | 'reserve_first';
}

export interface WorldHydrologyState {
  version: number;
  regionsByPoiId: Partial<Record<MainWorldAreaId, RegionHydrologyState>>;
  cellStatesById: Record<string, CellHydrologyState>;
  nodesById: Record<string, HydrologyNode>;
  edgesById: Record<string, HydrologyEdge>;
  watershedsById: Record<string, WatershedState>;
  aquifersById: Record<string, AquiferState>;
  infrastructure: WaterInfrastructureInstance[];
  networks: WaterManagementNetwork[];
  hydrologyTickIndex: number;
}

declare module './index' {
  interface GameState {
    hydrologySystem?: WorldHydrologyState;
  }
}

export {};
