import type { RecipeResearchState } from './index';

export type ResearchEvidenceChannel =
  | 'materials'
  | 'process'
  | 'tools'
  | 'environment'
  | 'precedent'
  | 'experiments';

export interface ResearchEvidenceState {
  recipeId: string;
  materialEvidence: number;
  processEvidence: number;
  toolEvidence: number;
  environmentEvidence: number;
  precedentEvidence: number;
  analysisBonus: number;
  totalEvidence: number;
  identifiedIngredientIds: string[];
  experimentsCompleted: number;
  lastAnalyzedAtGameMinute?: number;
}

export interface ResearchRecentDiscoveryState {
  id: string;
  recipeId?: string;
  itemId?: string;
  name: string;
  type: 'idea_discovered' | 'material_identified' | 'experiment' | 'recipe_unlocked';
  gameMinute: number;
}

export interface ResearchSystemState {
  evidenceByRecipeId: Record<string, ResearchEvidenceState>;
  identifiedMaterialIds: string[];
  trackedRecipeIds: string[];
  recentDiscoveries: ResearchRecentDiscoveryState[];
  knowledgePoints: number;
}

declare module './index' {
  interface RecipeResearchState {
    evidenceScoreAtStart?: number;
    effectiveResearchSeconds?: number;
  }

  interface GameState {
    researchSystem?: ResearchSystemState;
    /** Persistent production history used as process/precedent evidence. */
    craftedRecipeCounts?: Record<string, number>;
  }
}

export type PersistentRecipeResearchState = RecipeResearchState;
export {};
