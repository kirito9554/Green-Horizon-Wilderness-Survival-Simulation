import type { ItemQuality, QualityBreakdown } from './index';

/**
 * Deep crafting simulation types.
 *
 * This file augments the legacy public types instead of replacing them in one
 * migration. Existing saves/components therefore remain valid while the
 * simulation starts storing richer per-instance state.
 */

export type ToolComponentSlot =
  | 'blade'
  | 'head'
  | 'handle'
  | 'shaft'
  | 'binding'
  | 'grip'
  | 'frame'
  | 'body'
  | 'closure'
  | 'string'
  | 'other';

export interface ComponentFunctionalProperties {
  /** 0..100. Cutting components only. */
  edgeSharpness?: number;
  /** 0..100. Resistance to deformation/chipping. */
  hardness?: number;
  /** 0..100. Resistance to sudden fracture. */
  toughness?: number;
  /** Relative geometry value used by later derived-stat systems. */
  lengthCm?: number;
  thicknessMm?: number;
  /** 0..100. Lash/string tension. */
  tension?: number;
  /** 0..100. Wet-weather resistance. */
  moistureResistance?: number;
  /** 0..100. Handling comfort / slip resistance. */
  gripComfort?: number;
}

export interface ComponentInstance {
  instanceId: string;
  slot: ToolComponentSlot;
  name: string;
  /** Optional source inventory item/material used to make this component. */
  sourceItemId?: string;
  materialTags: string[];
  quality: ItemQuality;
  condition: number;
  conditionMax: number;
  /** Structural ceiling when the part was first crafted. */
  originalConditionMax: number;
  properties: ComponentFunctionalProperties;
  /** Permanent damage accumulated through severe failures/repairs. */
  permanentDamage?: number;
}

export interface CraftQualityProfile {
  material: number;
  workmanship: number;
  fit: number;
  finish: number;
  structuralIntegrity: number;
}

export interface MaterialReservationSource {
  kind: 'party' | 'poi';
  areaId?: string;
}

/**
 * A reservation never removes an item from inventory. It marks an exact slice
 * of an inventory instance as unavailable until it is consumed or released.
 * This preserves provenance and makes cancel/pause deterministic.
 */
export interface MaterialReservation {
  id: string;
  ownerType: 'crafting';
  ownerId: string;
  source: MaterialReservationSource;
  instanceId: string;
  itemId: string;
  quantity: number;
  /** Exact quality composition of the reserved slice. */
  qualityBreakdown: QualityBreakdown;
  freshness?: number;
  condition?: number;
  conditionMax?: number;
  reservedAtGameMinute: number;
}

export type CraftReservationStatus =
  | 'unreserved'
  | 'reserved'
  | 'partially_consumed'
  | 'consumed'
  /** Old saves may already have consumed the active unit before M1. */
  | 'legacy_consumed';

declare module './index' {
  interface InventoryItem {
    /** Quantity unavailable to normal inventory operations. */
    reservedQuantity?: number;
    /** Quality composition corresponding to reservedQuantity. */
    reservedQualityBreakdown?: QualityBreakdown;
    /** Original structural ceiling before permanent degradation. */
    originalConditionMax?: number;
    /** Real component instances used by Repair/Upgrade in later milestones. */
    components?: ComponentInstance[];
    craftQualityProfile?: CraftQualityProfile;
  }

  interface CraftingQueueItem {
    materialReservations?: MaterialReservation[];
    reservationStatus?: CraftReservationStatus;
    /** Human-readable scheduler reasons; UI can surface these directly. */
    blockedReasons?: string[];
    /** Stable seed so save/load cannot reroll a queued job later. */
    deterministicSeed?: number;
    /** Quality actually consumed for the unit currently being worked. */
    currentUnitIngredientQualities?: ItemQuality[];
  }
}

export {};
