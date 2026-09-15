import type { HydrologyAnchorKind, HydrologyEdgeKind } from '../types/hydrologySimulation';
import type { MainWorldAreaId } from './mainWorldAreas';

export type HydrologyAnchorCellSelector =
  | 'lowest'
  | 'highest_wet'
  | 'wettest'
  | 'rocky_wet'
  | 'edge_low';

export interface HydrologyAnchorDefinition {
  id: string;
  poiId: MainWorldAreaId;
  kind: HydrologyAnchorKind;
  selector: HydrologyAnchorCellSelector;
  capacityM3: number;
}

export interface HydrologyMajorConnectionDefinition {
  id: string;
  fromAnchorId: string;
  toAnchorId: string;
  kind: HydrologyEdgeKind;
  widthM: number;
  bankfullDepthM: number;
  channelCapacityM3H: number;
}

/**
 * Large geographic water features are anchored to the current main-map regions.
 * The exact local BuildCell is selected deterministically from terrain; secondary
 * creeks, seeps and depressions are procedural and derived from the drainage field.
 */
export const HYDROLOGY_ANCHORS: HydrologyAnchorDefinition[] = [
  { id: 'HYDRO_SPRING_HIGHLANDS', poiId: 'AREA_STONE_RIDGE', kind: 'spring_zone', selector: 'highest_wet', capacityM3: 28 },
  { id: 'HYDRO_SPRING_BAMBOO', poiId: 'AREA_BAMBOO_GROVE', kind: 'spring_zone', selector: 'highest_wet', capacityM3: 22 },
  { id: 'HYDRO_KARST_SEEP', poiId: 'AREA_CAVE_ENTRANCE', kind: 'spring_zone', selector: 'wettest', capacityM3: 18 },
  { id: 'HYDRO_GORGE_ENTRY', poiId: 'AREA_WATERFALL_BASIN', kind: 'river_entry', selector: 'highest_wet', capacityM3: 140 },
  { id: 'HYDRO_GORGE_FALL', poiId: 'AREA_WATERFALL_BASIN', kind: 'waterfall', selector: 'rocky_wet', capacityM3: 180 },
  { id: 'HYDRO_GORGE_EXIT', poiId: 'AREA_WATERFALL_BASIN', kind: 'river_exit', selector: 'lowest', capacityM3: 220 },
  { id: 'HYDRO_FLOODED_FOREST_WETLAND', poiId: 'AREA_SWAMP_CROSSING', kind: 'major_wetland', selector: 'lowest', capacityM3: 420 },
  { id: 'HYDRO_MANGROVE_ESTUARY', poiId: 'AREA_MANGROVE_EDGE', kind: 'estuary', selector: 'edge_low', capacityM3: 720 },
  { id: 'HYDRO_ROCKY_SHORE_COAST', poiId: 'AREA_FISHING_LAGOON', kind: 'coast', selector: 'edge_low', capacityM3: 1200 },
  { id: 'HYDRO_PLANE_WRECK_COAST', poiId: 'AREA_CAMP_CLEARING', kind: 'coast', selector: 'edge_low', capacityM3: 900 },
];

/**
 * These are geographic truths of the main island rather than procedural rolls.
 * Edges are only materialized once both endpoint regions exist in the save, so
 * the hydrology subsystem remains lazy while preserving a stable watershed graph.
 */
export const HYDROLOGY_MAJOR_CONNECTIONS: HydrologyMajorConnectionDefinition[] = [
  {
    id: 'HYDRO_EDGE_HIGHLANDS_TO_GORGE',
    fromAnchorId: 'HYDRO_SPRING_HIGHLANDS',
    toAnchorId: 'HYDRO_GORGE_ENTRY',
    kind: 'stream', widthM: 1.8, bankfullDepthM: 0.7, channelCapacityM3H: 210,
  },
  {
    id: 'HYDRO_EDGE_BAMBOO_TO_GORGE',
    fromAnchorId: 'HYDRO_SPRING_BAMBOO',
    toAnchorId: 'HYDRO_GORGE_ENTRY',
    kind: 'stream', widthM: 1.5, bankfullDepthM: 0.6, channelCapacityM3H: 165,
  },
  {
    id: 'HYDRO_EDGE_KARST_TO_GORGE',
    fromAnchorId: 'HYDRO_KARST_SEEP',
    toAnchorId: 'HYDRO_GORGE_ENTRY',
    kind: 'stream', widthM: 1.1, bankfullDepthM: 0.5, channelCapacityM3H: 110,
  },
  {
    id: 'HYDRO_EDGE_GORGE_ENTRY_TO_FALL',
    fromAnchorId: 'HYDRO_GORGE_ENTRY',
    toAnchorId: 'HYDRO_GORGE_FALL',
    kind: 'river', widthM: 5.5, bankfullDepthM: 1.9, channelCapacityM3H: 1450,
  },
  {
    id: 'HYDRO_EDGE_GORGE_FALL_TO_EXIT',
    fromAnchorId: 'HYDRO_GORGE_FALL',
    toAnchorId: 'HYDRO_GORGE_EXIT',
    kind: 'waterfall', widthM: 5.2, bankfullDepthM: 1.7, channelCapacityM3H: 1580,
  },
  {
    id: 'HYDRO_EDGE_GORGE_TO_ESTUARY',
    fromAnchorId: 'HYDRO_GORGE_EXIT',
    toAnchorId: 'HYDRO_MANGROVE_ESTUARY',
    kind: 'river', widthM: 7.2, bankfullDepthM: 2.2, channelCapacityM3H: 2200,
  },
  {
    id: 'HYDRO_EDGE_WETLAND_TO_ESTUARY',
    fromAnchorId: 'HYDRO_FLOODED_FOREST_WETLAND',
    toAnchorId: 'HYDRO_MANGROVE_ESTUARY',
    kind: 'estuary', widthM: 6.5, bankfullDepthM: 1.5, channelCapacityM3H: 1300,
  },
  {
    id: 'HYDRO_EDGE_ESTUARY_TO_COAST',
    fromAnchorId: 'HYDRO_MANGROVE_ESTUARY',
    toAnchorId: 'HYDRO_ROCKY_SHORE_COAST',
    kind: 'tidal', widthM: 11, bankfullDepthM: 2.6, channelCapacityM3H: 3800,
  },
];

export function getHydrologyAnchorsForPoi(poiId: MainWorldAreaId): HydrologyAnchorDefinition[] {
  return HYDROLOGY_ANCHORS.filter(anchor => anchor.poiId === poiId);
}
