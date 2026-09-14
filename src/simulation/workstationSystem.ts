import type { CraftingQueueItem, GameState, RecipeDefinition } from '../types';
import type { WorkstationKind } from '../types/craftingSimulation';
import '../types/maintenanceSimulation';
import '../types/upgradeSimulation';

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

export interface WorkstationAssignable {
  assignedWorkstationId?: string;
  assignedWorkstationKind?: WorkstationKind;
  workstationSpeedMultiplier?: number;
  workstationPrecisionBonus?: number;
  workstationWeatherProtection?: number;
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

function queueOccupancyForBuilding(state: GameState, buildingInstanceId: string, excludingJobId: string): number {
  const crafting = (state.craftingQueue || []).filter(job =>
    job.id !== excludingJobId &&
    job.status === 'in_progress' &&
    job.assignedWorkstationId === buildingInstanceId
  ).length;

  const maintenance = (state.maintenanceSystem?.queue || []).filter(job =>
    job.id !== excludingJobId &&
    job.status === 'in_progress' &&
    job.assignedWorkstationId === buildingInstanceId
  ).length;

  const upgrades = (state.upgradeSystem?.queue || []).filter(job =>
    job.id !== excludingJobId &&
    job.status === 'in_progress' &&
    job.assignedWorkstationId === buildingInstanceId
  ).length;

  return crafting + maintenance + upgrades;
}

function handcraftAssignment(state: GameState): WorkstationAssignment {
  const sheltered = state.buildings.some(building =>
    building.isBuilt &&
    building.condition > 0 &&
    building.buildingId === 'BUILDING_LEAF_SHELTER'
  );
  return {
    kind: 'handcraft',
    speedMultiplier: 1,
    precisionBonus: 0,
    weatherProtection: sheltered ? 0.55 : 0,
  };
}

function findPhysicalWorkstation(
  state: GameState,
  kind: WorkstationKind,
  jobId: string,
  requiredBuildingId?: string,
): { assignment: WorkstationAssignment | null; reason?: string } {
  if (kind === 'handcraft') return { assignment: handcraftAssignment(state) };

  const descriptor = requiredBuildingId
    ? WORKSTATION_BY_BUILDING_ID[requiredBuildingId] || descriptorForKind(kind)
    : descriptorForKind(kind);

  const candidates = state.buildings.filter(building => {
    if (!building.isBuilt || building.condition <= 0) return false;
    if (requiredBuildingId) return building.buildingId === requiredBuildingId;
    const known = WORKSTATION_BY_BUILDING_ID[building.buildingId];
    return known?.kind === kind;
  });

  if (candidates.length === 0) {
    return {
      assignment: null,
      reason: requiredBuildingId ? `Requires ${requiredBuildingId}` : `Requires ${kind}`,
    };
  }

  for (const building of candidates) {
    const buildingDescriptor = WORKSTATION_BY_BUILDING_ID[building.buildingId] || descriptor;
    const occupied = queueOccupancyForBuilding(state, building.id, jobId);
    if (occupied >= buildingDescriptor.capacity) continue;

    const conditionRatio = Math.max(0.2, Math.min(1, building.condition / 100));
    return {
      assignment: {
        workstationId: building.id,
        kind: buildingDescriptor.kind,
        speedMultiplier: 1 + (buildingDescriptor.speedMultiplier - 1) * conditionRatio,
        precisionBonus: buildingDescriptor.precisionBonus * conditionRatio,
        weatherProtection: buildingDescriptor.weatherProtection * conditionRatio,
      },
    };
  }

  return {
    assignment: null,
    reason: `${kind} is currently occupied`,
  };
}

export function findAvailableWorkstationByKind(
  state: GameState,
  kind: WorkstationKind,
  jobId: string,
): { assignment: WorkstationAssignment | null; reason?: string } {
  return findPhysicalWorkstation(state, kind, jobId);
}

export function findAvailableWorkstation(
  state: GameState,
  recipe: RecipeDefinition,
  queueItemId: string,
): { assignment: WorkstationAssignment | null; reason?: string } {
  const kind = inferKindFromRecipe(recipe);
  return findPhysicalWorkstation(state, kind, queueItemId, recipe.requiredBuildingId);
}

export function assignWorkstation(target: WorkstationAssignable, assignment: WorkstationAssignment): void {
  target.assignedWorkstationId = assignment.workstationId;
  target.assignedWorkstationKind = assignment.kind;
  target.workstationSpeedMultiplier = assignment.speedMultiplier;
  target.workstationPrecisionBonus = assignment.precisionBonus;
  target.workstationWeatherProtection = assignment.weatherProtection;
}

export function releaseWorkstation(target: WorkstationAssignable): void {
  target.assignedWorkstationId = undefined;
  target.assignedWorkstationKind = undefined;
  target.workstationSpeedMultiplier = undefined;
  target.workstationPrecisionBonus = undefined;
  target.workstationWeatherProtection = undefined;
}

export function isAssignedWorkstationOperational(state: GameState, target: WorkstationAssignable): boolean {
  if (!target.assignedWorkstationId) return target.assignedWorkstationKind === undefined || target.assignedWorkstationKind === 'handcraft';
  const building = state.buildings.find(candidate => candidate.id === target.assignedWorkstationId);
  return Boolean(building?.isBuilt && building.condition > 0);
}

/** Retained for older call-sites that explicitly type the queue item. */
export function assignCraftingWorkstation(queueItem: CraftingQueueItem, assignment: WorkstationAssignment): void {
  assignWorkstation(queueItem, assignment);
}