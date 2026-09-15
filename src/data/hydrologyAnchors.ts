import type { HydrologyAnchorKind } from '../types/hydrologySimulation';
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

export function getHydrologyAnchorsForPoi(poiId: MainWorldAreaId): HydrologyAnchorDefinition[] {
  return HYDROLOGY_ANCHORS.filter(anchor => anchor.poiId === poiId);
}
