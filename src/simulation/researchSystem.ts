import type { GameState, RecipeDefinition, SurvivorState } from '../types';
import '../types/researchSimulation';
import type {
  ResearchEvidenceState,
  ResearchRecentDiscoveryState,
  ResearchSystemState,
} from '../types/researchSimulation';
import type { RecentDiscovery, ResearchCandidate, ResearchQueueItem } from '../types/crafting';
import { RECIPES_DATABASE } from '../data/recipes';
import { ITEMS_DATABASE } from '../data/items';
import { deductItemFromInventory, getAvailableInventoryStock } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';

const RESEARCH_UNLOCK_EVIDENCE = 80;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function setIdle(survivor: SurvivorState): void {
  survivor.currentAction = {
    type: 'idle',
    description: 'Ready for new assignment',
    progressSeconds: 0,
    totalSeconds: 0,
  };
}

export function ensureResearchSystem(state: GameState): ResearchSystemState {
  if (!state.researchSystem) {
    state.researchSystem = {
      evidenceByRecipeId: {},
      identifiedMaterialIds: [],
      trackedRecipeIds: [],
      recentDiscoveries: [],
      knowledgePoints: 0,
    };
  }
  state.researchSystem.evidenceByRecipeId ||= {};
  state.researchSystem.identifiedMaterialIds ||= [];
  state.researchSystem.trackedRecipeIds ||= [];
  state.researchSystem.recentDiscoveries ||= [];
  state.researchSystem.knowledgePoints ||= 0;
  state.craftedRecipeCounts ||= {};
  state.researches ||= {};
  state.discoveredRecipeIds ||= [];
  return state.researchSystem;
}

function createEvidence(recipeId: string): ResearchEvidenceState {
  return {
    recipeId,
    materialEvidence: 0,
    processEvidence: 0,
    toolEvidence: 0,
    environmentEvidence: 0,
    precedentEvidence: 0,
    analysisBonus: 0,
    totalEvidence: 0,
    identifiedIngredientIds: [],
    experimentsCompleted: 0,
  };
}

function addRecentDiscovery(state: GameState, entry: Omit<ResearchRecentDiscoveryState, 'id' | 'gameMinute'>): void {
  const system = ensureResearchSystem(state);
  system.recentDiscoveries.unshift({
    ...entry,
    id: `research_disc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    gameMinute: gameMinute(state),
  });
  system.recentDiscoveries = system.recentDiscoveries.slice(0, 20);
}

function allOwnedItemIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const item of state.inventory.items) if (item.quantity > 0) ids.add(item.itemId);
  for (const storage of Object.values(state.poiStorages || {})) {
    for (const item of storage.items) if (item.quantity > 0) ids.add(item.itemId);
  }
  return ids;
}

function predecessorFor(recipeId: string): RecipeDefinition | undefined {
  return Object.values(RECIPES_DATABASE).find(recipe => recipe.progression?.nextRecipeId === recipeId);
}

function isRecipeExperienced(state: GameState, recipeId: string): boolean {
  return state.researches?.[recipeId]?.status === 'completed' || (state.craftedRecipeCounts?.[recipeId] || 0) > 0;
}

function hasSameCategoryExperience(state: GameState, recipe: RecipeDefinition): boolean {
  return Object.values(RECIPES_DATABASE).some(candidate =>
    candidate.id !== recipe.id &&
    candidate.category === recipe.category &&
    isRecipeExperienced(state, candidate.id)
  );
}

function hasRequiredToolKnowledge(state: GameState, recipe: RecipeDefinition): number {
  const checks: boolean[] = [];
  if (recipe.requiredToolTag) {
    checks.push(state.inventory.items.some(item => {
      const def = ITEMS_DATABASE[item.itemId];
      return Boolean(def?.tags.includes(recipe.requiredToolTag!) && (item.condition === undefined || item.condition > 0));
    }));
  }
  if (recipe.requiredBuildingId) {
    checks.push(state.buildings.some(building => building.buildingId === recipe.requiredBuildingId && building.isBuilt && building.condition > 0));
  }
  if (recipe.id === 'RECIPE_BOIL_WATER' || recipe.id === 'RECIPE_GRILL_FISH' || recipe.id === 'RECIPE_CHARCOAL_SHELLS') {
    checks.push(state.buildings.some(building => building.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && building.isBuilt && building.condition > 0));
  }
  if (checks.length === 0) return 15;
  return 15 * (checks.filter(Boolean).length / checks.length);
}

function environmentKnowledge(state: GameState): number {
  const values = Object.values(state.areasProgress || {})
    .map(progress => progress.knowledgePercent || 0)
    .sort((a, b) => b - a)
    .slice(0, 3);
  if (values.length === 0) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clamp(average / 10, 0, 10);
}

/**
 * Recalculate evidence from persistent world knowledge. Evidence never depends
 * on currently selected UI cards. Possession identifies material categories,
 * previous production teaches process/precedent, tools/buildings teach method,
 * and explored terrain contributes environmental understanding.
 */
export function refreshResearchEvidence(
  state: GameState,
  options: { recordMaterialDiscoveries?: boolean; recordIdeaDiscoveries?: boolean } = {},
): boolean {
  const system = ensureResearchSystem(state);
  const ownedIds = allOwnedItemIds(state);
  let changed = false;

  for (const itemId of ownedIds) {
    if (!system.identifiedMaterialIds.includes(itemId)) {
      system.identifiedMaterialIds.push(itemId);
      changed = true;
      if (options.recordMaterialDiscoveries !== false) {
        addRecentDiscovery(state, {
          itemId,
          name: ITEMS_DATABASE[itemId]?.name || itemId,
          type: 'material_identified',
        });
      }
    }
  }

  for (const recipe of Object.values(RECIPES_DATABASE)) {
    if (recipe.type !== 'crafting') continue;
    const evidence = system.evidenceByRecipeId[recipe.id] ||= createEvidence(recipe.id);

    const identifiedIngredients = recipe.ingredients
      .map(ingredient => ingredient.itemId)
      .filter(itemId => system.identifiedMaterialIds.includes(itemId));
    evidence.identifiedIngredientIds = Array.from(new Set(identifiedIngredients));
    evidence.materialEvidence = recipe.ingredients.length > 0
      ? 40 * (evidence.identifiedIngredientIds.length / recipe.ingredients.length)
      : 40;

    const predecessor = predecessorFor(recipe.id);
    const precedentKnown = predecessor ? isRecipeExperienced(state, predecessor.id) : false;
    const sameCategoryKnown = hasSameCategoryExperience(state, recipe);
    evidence.processEvidence = clamp((precedentKnown ? 15 : 0) + (sameCategoryKnown ? 10 : 0), 0, 25);
    evidence.toolEvidence = hasRequiredToolKnowledge(state, recipe);
    evidence.environmentEvidence = environmentKnowledge(state);
    evidence.precedentEvidence = recipe.unlockedByDefault ? 10 : precedentKnown ? 10 : sameCategoryKnown ? 5 : 0;

    const rawTotal =
      evidence.materialEvidence +
      evidence.processEvidence +
      evidence.toolEvidence +
      evidence.environmentEvidence +
      evidence.precedentEvidence +
      evidence.analysisBonus;
    evidence.totalEvidence = recipe.unlockedByDefault ? 100 : Math.round(clamp(rawTotal) * 10) / 10;

    if (recipe.unlockedByDefault) {
      const research = state.researches![recipe.id];
      if (!research || research.status !== 'completed') {
        state.researches![recipe.id] = {
          recipeId: recipe.id,
          status: 'completed',
          progressSeconds: recipe.researchTimeSeconds || 15,
          totalSeconds: recipe.researchTimeSeconds || 15,
          evidenceScoreAtStart: 100,
        };
      }
      if (!state.discoveredRecipeIds!.includes(recipe.id)) state.discoveredRecipeIds!.push(recipe.id);
      continue;
    }

    const existing = state.researches![recipe.id];
    if (!existing) {
      state.researches![recipe.id] = {
        recipeId: recipe.id,
        status: evidence.totalEvidence >= RESEARCH_UNLOCK_EVIDENCE ? 'discovered' : 'locked',
        progressSeconds: 0,
        totalSeconds: recipe.researchTimeSeconds || 25,
      };
      if (evidence.totalEvidence >= RESEARCH_UNLOCK_EVIDENCE) {
        if (!state.discoveredRecipeIds!.includes(recipe.id)) state.discoveredRecipeIds!.push(recipe.id);
        changed = true;
        if (options.recordIdeaDiscoveries !== false) {
          addRecentDiscovery(state, { recipeId: recipe.id, name: recipe.name, type: 'idea_discovered' });
        }
      }
    } else if (existing.status === 'locked' && evidence.totalEvidence >= RESEARCH_UNLOCK_EVIDENCE) {
      existing.status = 'discovered';
      if (!state.discoveredRecipeIds!.includes(recipe.id)) state.discoveredRecipeIds!.push(recipe.id);
      changed = true;
      if (options.recordIdeaDiscoveries !== false) {
        addRecentDiscovery(state, { recipeId: recipe.id, name: recipe.name, type: 'idea_discovered' });
      }
    }

    if (state.researches![recipe.id]?.status === 'completed') evidence.totalEvidence = 100;
  }

  return changed;
}

function researchSkill(survivor: SurvivorState): number {
  const crafting = survivor.skills.crafting || 1;
  const exploration = survivor.skills.exploration || 1;
  return crafting * 0.7 + exploration * 0.3;
}

function effectiveResearchTime(recipe: RecipeDefinition, survivor: SurvivorState): number {
  const skill = researchSkill(survivor);
  const skillFactor = 1 / (1 + Math.max(0, skill - 1) * 0.09);
  const fatigueFactor = survivor.fatigue > 75 ? 1.35 : survivor.fatigue > 55 ? 1.15 : 1;
  const needsFactor = survivor.hunger > 75 || survivor.thirst > 70 ? 1.15 : 1;
  const moraleFactor = survivor.morale < 30 ? 1.12 : survivor.morale > 75 ? 0.95 : 1;
  return Math.max(5, Math.round((recipe.researchTimeSeconds || 25) * skillFactor * fatigueFactor * needsFactor * moraleFactor * 10) / 10);
}

export function startEvidenceResearch(state: GameState, recipeId: string, survivorId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  refreshResearchEvidence(next, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: true });
  const system = ensureResearchSystem(next);
  const recipe = RECIPES_DATABASE[recipeId];
  const survivor = next.survivors.find(candidate => candidate.id === survivorId);
  if (!recipe || !survivor || survivor.currentAction.type !== 'idle') return state;

  const evidence = system.evidenceByRecipeId[recipeId];
  if (!recipe.unlockedByDefault && (!evidence || evidence.totalEvidence < RESEARCH_UNLOCK_EVIDENCE)) {
    next.logs.unshift({
      id: `res_block_${Date.now()}_${recipeId}`,
      day: next.gameTime.day,
      timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
      text: `[Nghiên cứu chưa đủ căn cứ] ${recipe.name}: cần ${RESEARCH_UNLOCK_EVIDENCE}% evidence, hiện có ${Math.round(evidence?.totalEvidence || 0)}%.`,
      type: 'warning',
    });
    return next;
  }

  let research = next.researches![recipeId];
  if (research?.status === 'completed') return state;
  if (!research) {
    research = {
      recipeId,
      status: 'discovered',
      progressSeconds: 0,
      totalSeconds: recipe.researchTimeSeconds || 25,
    };
    next.researches![recipeId] = research;
  }

  const oldTotal = Math.max(1, research.totalSeconds || recipe.researchTimeSeconds || 25);
  const progressFraction = Math.max(0, Math.min(1, research.progressSeconds / oldTotal));
  const newTotal = effectiveResearchTime(recipe, survivor);
  research.totalSeconds = newTotal;
  research.effectiveResearchSeconds = newTotal;
  research.progressSeconds = newTotal * progressFraction;
  research.status = 'in_progress';
  research.assignedSurvivorId = survivorId;
  research.evidenceScoreAtStart = evidence?.totalEvidence || 100;

  survivor.currentAction = {
    type: 'researching',
    description: `Nghiên cứu: ${recipe.name}`,
    targetId: recipeId,
    progressSeconds: research.progressSeconds,
    totalSeconds: research.totalSeconds,
    resultPayload: { recipeId },
  };

  next.logs.unshift({
    id: `res_start_${Date.now()}_${recipeId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `${survivor.name} bắt đầu nghiên cứu ${recipe.name} từ ${Math.round(research.evidenceScoreAtStart)}% evidence.`,
    type: 'info',
  });
  return next;
}

export function pauseEvidenceResearch(state: GameState, recipeId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const research = next.researches?.[recipeId];
  if (!research || research.status !== 'in_progress') return state;

  if (research.assignedSurvivorId) {
    const survivor = next.survivors.find(candidate => candidate.id === research.assignedSurvivorId);
    if (survivor?.currentAction.type === 'researching' && survivor.currentAction.targetId === recipeId) {
      research.progressSeconds = Math.max(research.progressSeconds, survivor.currentAction.progressSeconds);
      setIdle(survivor);
    }
  }
  research.status = 'paused';
  research.assignedSurvivorId = undefined;
  return next;
}

function findResearchSample(state: GameState, recipe: RecipeDefinition): { itemId: string; source: GameState['inventory'] } | null {
  const system = ensureResearchSystem(state);
  const ordered = [...recipe.ingredients].sort((a, b) => {
    const aKnown = system.identifiedMaterialIds.includes(a.itemId) ? 1 : 0;
    const bKnown = system.identifiedMaterialIds.includes(b.itemId) ? 1 : 0;
    return aKnown - bKnown;
  });

  for (const ingredient of ordered) {
    if (getAvailableInventoryStock(state.inventory, ingredient.itemId) > 0) {
      return { itemId: ingredient.itemId, source: state.inventory };
    }
    for (const storage of Object.values(state.poiStorages || {})) {
      if (getAvailableInventoryStock(storage, ingredient.itemId) > 0) {
        return { itemId: ingredient.itemId, source: storage };
      }
    }
  }
  return null;
}

/**
 * A field/lab analysis is deliberately destructive: one unreserved sample is
 * consumed. New materials provide a large evidence jump; repeated experiments
 * give diminishing process insight rather than infinite free progress.
 */
export function analyzeResearchEvidence(state: GameState, recipeId: string, survivorId?: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  refreshResearchEvidence(next, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false });
  const system = ensureResearchSystem(next);
  const recipe = RECIPES_DATABASE[recipeId];
  if (!recipe) return state;

  const evidence = system.evidenceByRecipeId[recipeId] ||= createEvidence(recipeId);
  const sample = findResearchSample(next, recipe);
  if (!sample) {
    next.logs.unshift({
      id: `analysis_block_${Date.now()}_${recipeId}`,
      day: next.gameTime.day,
      timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
      text: `[Phân tích thất bại] Không có mẫu nguyên liệu chưa bị giữ để thử nghiệm ${recipe.name}.`,
      type: 'warning',
    });
    return next;
  }

  if (!deductItemFromInventory(sample.source, sample.itemId, 1)) return next;
  const wasIdentified = system.identifiedMaterialIds.includes(sample.itemId);
  if (!wasIdentified) {
    system.identifiedMaterialIds.push(sample.itemId);
    system.knowledgePoints += 1;
    addRecentDiscovery(next, {
      recipeId,
      itemId: sample.itemId,
      name: ITEMS_DATABASE[sample.itemId]?.name || sample.itemId,
      type: 'material_identified',
    });
  }

  const experimentIndex = evidence.experimentsCompleted;
  const experimentGain = !wasIdentified ? 10 : experimentIndex === 0 ? 7 : experimentIndex === 1 ? 5 : 3;
  evidence.analysisBonus = clamp(evidence.analysisBonus + experimentGain, 0, 20);
  evidence.experimentsCompleted += 1;
  evidence.lastAnalyzedAtGameMinute = gameMinute(next);

  if (survivorId) {
    const survivor = next.survivors.find(candidate => candidate.id === survivorId);
    if (survivor) survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.02;
  }

  addRecentDiscovery(next, {
    recipeId,
    itemId: sample.itemId,
    name: `${recipe.name}: experiment #${evidence.experimentsCompleted}`,
    type: 'experiment',
  });
  refreshResearchEvidence(next, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: true });

  next.logs.unshift({
    id: `analysis_${Date.now()}_${recipeId}`,
    day: next.gameTime.day,
    timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
    text: `[Thử nghiệm] Đã tiêu thụ 1x ${ITEMS_DATABASE[sample.itemId]?.name || sample.itemId}; evidence ${recipe.name} tăng lên ${Math.round(system.evidenceByRecipeId[recipeId].totalEvidence)}%.`,
    type: 'info',
  });
  return next;
}

export function toggleTrackResearch(state: GameState, recipeId: string): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const system = ensureResearchSystem(next);
  if (system.trackedRecipeIds.includes(recipeId)) {
    system.trackedRecipeIds = system.trackedRecipeIds.filter(id => id !== recipeId);
  } else {
    system.trackedRecipeIds.push(recipeId);
  }
  return next;
}

function researchReward(recipe: RecipeDefinition): number {
  if (recipe.tier === 'Advanced') return 7;
  if (recipe.tier === 'Basic') return 5;
  return 3;
}

export function tickResearchEvidence(state: GameState, deltaGameSeconds: number): void {
  refreshResearchEvidence(state, { recordMaterialDiscoveries: true, recordIdeaDiscoveries: true });
  const system = ensureResearchSystem(state);

  for (const research of Object.values(state.researches || {})) {
    if (research.status !== 'in_progress' || !research.assignedSurvivorId) continue;
    const recipe = RECIPES_DATABASE[research.recipeId];
    const survivor = state.survivors.find(candidate => candidate.id === research.assignedSurvivorId);
    if (!recipe || !survivor) {
      research.status = 'paused';
      research.assignedSurvivorId = undefined;
      continue;
    }

    const stillResearching = survivor.currentAction.type === 'researching' && survivor.currentAction.targetId === research.recipeId;
    if (!stillResearching && research.progressSeconds + deltaGameSeconds < research.totalSeconds) {
      research.status = 'paused';
      research.assignedSurvivorId = undefined;
      continue;
    }

    research.progressSeconds = Math.min(research.totalSeconds, research.progressSeconds + deltaGameSeconds);
    if (stillResearching) survivor.currentAction.progressSeconds = research.progressSeconds;

    if (research.progressSeconds >= research.totalSeconds) {
      research.status = 'completed';
      research.progressSeconds = research.totalSeconds;
      research.assignedSurvivorId = undefined;
      setIdle(survivor);
      survivor.skills.crafting = (survivor.skills.crafting || 1) + 0.10;
      survivor.skills.exploration = (survivor.skills.exploration || 1) + 0.03;
      system.knowledgePoints += researchReward(recipe);
      const evidence = system.evidenceByRecipeId[recipe.id] ||= createEvidence(recipe.id);
      evidence.totalEvidence = 100;
      if (!state.discoveredRecipeIds!.includes(recipe.id)) state.discoveredRecipeIds!.push(recipe.id);
      addRecentDiscovery(state, { recipeId: recipe.id, name: recipe.name, type: 'recipe_unlocked' });

      state.logs.unshift({
        id: `research_done_${Date.now()}_${recipe.id}`,
        day: state.gameTime.day,
        timeStr: formatTimeOfDay(state.gameTime.minuteOfDay),
        text: `[Nghiên cứu hoàn tất] ${survivor.name} hoàn thiện ${recipe.name}; +${researchReward(recipe)} Knowledge Points.`,
        type: 'success',
      });
    }
  }
}

function candidateCategory(recipe: RecipeDefinition): ResearchCandidate['category'] {
  if (recipe.category === 'tools' || recipe.category === 'materials') return 'Tools';
  if (recipe.category === 'food' || recipe.category === 'water') return 'Cooking';
  if (recipe.category === 'medicine') return 'Medicine';
  if (recipe.category === 'shelter' || recipe.category === 'utility') return 'Structure';
  if (recipe.category === 'survival') return 'Survival';
  return 'Hunting';
}

export function buildResearchCandidates(state: GameState): ResearchCandidate[] {
  const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
  refreshResearchEvidence(snapshot, { recordMaterialDiscoveries: false, recordIdeaDiscoveries: false });
  const system = ensureResearchSystem(snapshot);

  return Object.values(RECIPES_DATABASE)
    .filter(recipe => recipe.type === 'crafting')
    .map(recipe => {
      const evidence = system.evidenceByRecipeId[recipe.id] || createEvidence(recipe.id);
      const research = snapshot.researches?.[recipe.id];
      const completed = research?.status === 'completed';
      return {
        id: recipe.id,
        name: recipe.name,
        category: candidateCategory(recipe),
        description: recipe.description,
        progressPct: completed ? 100 : Math.round(evidence.totalEvidence),
        materialsDiscoveredCount: evidence.identifiedIngredientIds.length,
        materialsRequiredTotal: recipe.ingredients.length,
        minDiscoveryRequiredPct: RESEARCH_UNLOCK_EVIDENCE,
        materialsAnalysis: recipe.ingredients.map(ingredient => ({
          name: ITEMS_DATABASE[ingredient.itemId]?.name || ingredient.itemId,
          discovered: system.identifiedMaterialIds.includes(ingredient.itemId),
          clue: recipe.ingredientClues?.[ingredient.itemId],
        })),
        researchTimeSeconds: research?.totalSeconds || recipe.researchTimeSeconds || 25,
        isResearched: completed,
        isTracking: system.trackedRecipeIds.includes(recipe.id),
        tags: [recipe.category, recipe.tier || 'Primitive'],
      } satisfies ResearchCandidate;
    });
}

export function buildResearchQueue(state: GameState): ResearchQueueItem[] {
  return Object.values(state.researches || {})
    .filter(research => research.status === 'in_progress' || research.status === 'paused')
    .map(research => {
      const recipe = RECIPES_DATABASE[research.recipeId];
      const total = Math.max(1, research.totalSeconds);
      const progressPct = Math.round(clamp((research.progressSeconds / total) * 100));
      return {
        id: research.recipeId,
        candidateId: research.recipeId,
        name: recipe?.name || research.recipeId,
        progressPct,
        remainingSeconds: Math.max(0, Math.round(total - research.progressSeconds)),
        totalSeconds: total,
        assignedSurvivorId: research.assignedSurvivorId,
        status: research.status === 'paused' ? 'paused' : 'in_progress',
      } satisfies ResearchQueueItem;
    });
}

function discoveryTimeAgo(state: GameState, discovery: ResearchRecentDiscoveryState): string {
  const elapsed = Math.max(0, gameMinute(state) - discovery.gameMinute);
  if (elapsed < 60) return `${Math.max(1, Math.round(elapsed))}m ago`;
  if (elapsed < 1440) return `${Math.round(elapsed / 60)}h ago`;
  return `${Math.round(elapsed / 1440)}d ago`;
}

export function buildRecentResearchDiscoveries(state: GameState): RecentDiscovery[] {
  const system = ensureResearchSystem(state);
  return system.recentDiscoveries.slice(0, 8).map(entry => ({
    id: entry.id,
    name: entry.name,
    type: entry.type === 'recipe_unlocked' || entry.type === 'idea_discovered' ? 'unlocked' : 'material_identified',
    timeAgo: discoveryTimeAgo(state, entry),
  }));
}

export function getResearchEvidence(state: GameState, recipeId: string): ResearchEvidenceState | undefined {
  return state.researchSystem?.evidenceByRecipeId?.[recipeId];
}

export const RESEARCH_EVIDENCE_THRESHOLD = RESEARCH_UNLOCK_EVIDENCE;
