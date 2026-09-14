import type { CraftingQueueItem, GameState, RecipeDefinition } from '../types';
import type { WorkstationKind } from '../types/craftingSimulation';

export interface WorkstationDescriptor {
  kind: WorkstationKind;
  buildingId?: string;
  speedMultiplier: number;
  precisionBonus: number;
  weatherProtection: number;
  capacity: number;
}

export interface WorkstationAssignment {
  workstationId?: string;
  kind: WorkstationKind;
  speedMultiplier: number;
  precisionBonus: number;
  weatherProtection: number;
}

const WORKSTATION_BY_BUILDING_ID: Record<string, WorkstationDescriptor> = {
  BUILDING_CAMPFIRE_HEARTH: {
    kind: 'campfire',
    buildingId: 'BUILDING_CAMPFIRE_HEARTH',
    speedMultiplier: 1.0,
    precisionBonus: 0,
    weatherProtection: 0,
    capacity: 1,
  },
  BUILDING_CARPENTER_BENCH: {
    kind: 'workbench',
    buildingId: 'BUILDING_CARPENTER_BENCH',
    speedMultiplier: 1.3,
    precisionBonus: 12,
    weatherProtection: 0.15,
    capacity: 1,
  },
};

function inferKindFromRecipe(recipe: RecipeDefinition): WorkstationKind {
  if (recipe.requiredBuildingId && WORKSTATION_BY_BUILDING_ID[recipe.requiredBuildingId]) {
    return WORKSTATION_BY_BUILDING_ID[recipe.requiredBuildingId].kind;
  }
  if (recipe.id === 'RECIPE_BOIL_WATER' || recipe.id === 'RECIPE_GRILL_FISH' || recipe.id === 'RECIPE_CHARCOAL_SHELLS') {
    return 'campfire';
  }

  const name = (recipe.workstationName || '').toLowerCase();
  if (name.includes('workbench') || name.includes('bench')) return 'workbench';
  if (name.includes('campfire') || name.includes('fire')) return 'campfire';
  if (name.includes('kiln')) return 'kiln';
  if (name.includes('drying')) return 'drying_rack';
  return 'handcraft';
}

function descriptorForKind(kind: WorkstationKind): WorkstationDescriptor {
  if (kind === 'campfire') return WORKSTATION_BY_BUILDING_ID.BUILDING_CAMPFIRE_HEARTH;
  if (kind === 'workbench') return WORKSTATION_BY_BUILDING_ID.BUILDING_CARPENTER_BENCH;
  return {
    kind,
    speedMultiplier: 1,
    precisionBonus: 0,
    weatherProtection: kind === 'handcraft' ? 0 : 0.1,
    capacity: kind === 'handcraft' ? 999 : 1,
  };
}

function queueOccupancyForBuilding(state: GameState, buildingInstanceId: string, excludingQueueId: string): number {
  return (state.craftingQueue || []).filter(queueItem =>
    queueItem.id !== excludingQueueId &&
    queueItem.status === 'in_progress' &&
    queueItem.assignedWorkstationId === buildingInstanceId
  ).length;
}

export function findAvailableWorkstation(
  state: GameState,
  recipe: RecipeDefinition,
  queueItemId: string,
): { assignment: WorkstationAssignment | null; reason?: string } {
  const kind = inferKindFromRecipe(recipe);

  if (kind === 'handcraft') {
    const sheltered = state.buildings.some(building =>
      building.isBuilt &&
      building.condition > 0 &&
      building.buildingId === 'BUILDING_LEAF_SHELTER'
    );
    return {
      assignment: {
        kind,
        speedMultiplier: 1,
        precisionBonus: 0,
        weatherProtection: sheltered ? 0.55 : 0,
      },
    };
  }

  const descriptor = recipe.requiredBuildingId
    ? WORKSTATION_BY_BUILDING_ID[recipe.requiredBuildingId] || descriptorForKind(kind)
    : descriptorForKind(kind);

  const candidates = state.buildings.filter(building => {
    if (!building.isBuilt || building.condition <= 0) return false;
    if (recipe.requiredBuildingId) return building.buildingId === recipe.requiredBuildingId;
    const known = WORKSTATION_BY_BUILDING_ID[building.buildingId];
    return known?.kind === kind;
  });

  if (candidates.length === 0) {
    return {
      assignment: null,
      reason: recipe.requiredBuildingId
        ? `Requires ${recipe.requiredBuildingId}`
        : `Requires ${kind}`,
    };
  }

  for (const building of candidates) {
    const buildingDescriptor = WORKSTATION_BY_BUILDING_ID[building.buildingId] || descriptor;
    const occupied = queueOccupancyForBuilding(state, building.id, queueItemId);
    if (occupied >= buildingDescriptor.capacity) continue;

    const conditionRatio = Math.max(0.2, Math.min(1, building.condition / 100));
    const speedMultiplier = 1 + (buildingDescriptor.speedMultiplier - 1) * conditionRatio;
    const precisionBonus = buildingDescriptor.precisionBonus * conditionRatio;

    return {
      assignment: {
        workstationId: building.id,
        kind: buildingDescriptor.kind,
        speedMultiplier,
        precisionBonus,
        weatherProtection: buildingDescriptor.weatherProtection * conditionRatio,
      },
    };
  }

  return {
    assignment: null,
    reason: `${kind} is currently occupied`,
  };
}

export function assignWorkstation(queueItem: CraftingQueueItem, assignment: WorkstationAssignment): void {
  queueItem.assignedWorkstationId = assignment.workstationId;
  queueItem.assignedWorkstationKind = assignment.kind;
  queueItem.workstationSpeedMultiplier = assignment.speedMultiplier;
  queueItem.workstationPrecisionBonus = assignment.precisionBonus;
  queueItem.workstationWeatherProtection = assignment.weatherProtection;
}

export function releaseWorkstation(queueItem: CraftingQueueItem): void {
  queueItem.assignedWorkstationId = undefined;
  queueItem.assignedWorkstationKind = undefined;
  queueItem.workstationSpeedMultiplier = undefined;
  queueItem.workstationPrecisionBonus = undefined;
  queueItem.workstationWeatherProtection = undefined;
}
