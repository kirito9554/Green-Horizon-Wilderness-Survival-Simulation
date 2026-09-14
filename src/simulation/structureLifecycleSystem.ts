import type { GameState } from '../types';
import '../types/buildingSimulation';
import '../types/structureSimulation';
import {
  initializeStructureComponentsFromConstruction,
  syncStructureAggregateState,
  tickStructureEnvironment,
} from './structureComponentSystem';
import { ensureBuildingSimulation } from './buildGridSystem';

/**
 * Converts a completed phased construction record into physical structure
 * components exactly once. The construction scheduler stays concerned with job
 * execution; this lifecycle pass owns the long-lived physical structure state.
 */
export function bootstrapCompletedStructureComponents(state: GameState): void {
  const simulation = ensureBuildingSimulation(state);
  const jobs = simulation.constructionJobs || [];

  for (const building of state.buildings) {
    if (!building.isBuilt) continue;

    if (building.structureComponents?.length) {
      syncStructureAggregateState(state, building);
      continue;
    }

    if (!building.constructionJobId) continue;
    const job = jobs.find(candidate =>
      candidate.id === building.constructionJobId &&
      candidate.buildingInstanceId === building.id &&
      candidate.status === 'completed'
    );
    if (!job) continue;

    initializeStructureComponentsFromConstruction(state, building, job);
  }
}

/**
 * Building lifecycle tick. Newly finished structures receive their physical
 * component graph first; only then can weather/moisture/rot act on them.
 */
export function tickStructureLifecycle(state: GameState, deltaGameMinutes: number): void {
  bootstrapCompletedStructureComponents(state);
  tickStructureEnvironment(state, deltaGameMinutes);
}
