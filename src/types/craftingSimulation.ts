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
  edgeSharpness?: number;
  hardness?: number;
  toughness?: number;
  lengthCm?: number;
  thicknessMm?: number;
  tension?: number;
  moistureResistance?: number;
  gripComfort?: number;
}

export interface ComponentInstance {
  instanceId: string;
  slot: ToolComponentSlot;
  name: string;
  sourceItemId?: string;
  materialTags: string[];
  quality: ItemQuality;
  condition: number;
  conditionMax: number;
  originalConditionMax: number;
  properties: ComponentFunctionalProperties;
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

export type MaterialReservationOwnerType = 'crafting' | 'repair' | 'upgrade' | 'research';

/**
 * A reservation never removes an item from inventory. It marks an exact slice
 * of an inventory instance as unavailable until it is consumed or released.
 */
export interface MaterialReservation {
  id: string;
  ownerType: MaterialReservationOwnerType;
  ownerId: string;
  source: MaterialReservationSource;
  instanceId: string;
  itemId: string;
  quantity: number;
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
  | 'legacy_consumed';

export type WorkstationKind = 'handcraft' | 'campfire' | 'workbench' | 'kiln' | 'drying_rack' | 'other';

declare module './index' {
  interface InventoryItem {
    reservedQuantity?: number;
    reservedQualityBreakdown?: QualityBreakdown;
    originalConditionMax?: number;
    components?: ComponentInstance[];
    craftQualityProfile?: CraftQualityProfile;
  }

  interface CraftingQueueItem {
    materialReservations?: MaterialReservation[];
    reservationStatus?: CraftReservationStatus;
    blockedReasons?: string[];
    deterministicSeed?: number;
    currentUnitIngredientQualities?: ItemQuality[];
    assignedWorkstationId?: string;
    assignedWorkstationKind?: WorkstationKind;
    workstationSpeedMultiplier?: number;
    workstationPrecisionBonus?: number;
  }
}

export {};
