import { RecipeDefinition, CraftingQueueItem, SurvivorState } from './index';

export type CraftingMainTab = 'craft' | 'research' | 'repair' | 'upgrade';

export type CraftingCategoryFilter =
  | 'all'
  | 'tools'
  | 'weapons'
  | 'survival'
  | 'shelter'
  | 'food'
  | 'medicine'
  | 'utility';

export type CraftingSortMode = 'default' | 'name' | 'tier' | 'craftable';

export type CraftingViewMode = 'grid' | 'list';

export interface CraftingStatsSummary {
  totalKnownRecipes: number;
  maxRecipes: number;
  queuedCrafts: number;
  maxQueueSlots: number;
  idleSurvivors: number;
  craftingSpeedBonusPct: number;
}

export interface ProgressionBranch {
  currentRecipeId: string;
  currentName: string;
  currentTier: string;
  currentDurability: string;
  currentEffect: string;
  nextRecipeId: string;
  nextName: string;
  nextTier: string;
  nextDurability: string;
  nextEffect: string;
  isUnlocked: boolean;
  unlockRequirement: string;
}

export interface RecentlyCraftedEntry {
  id: string;
  recipeId: string;
  name: string;
  quantity: number;
  timestamp: number;
  timeAgoText: string;
}

// ============================================================================
// RESEARCH DATA TYPES (Ảnh 2)
// ============================================================================
export type ResearchStatusFilter =
  | 'all'
  | 'not_researched'
  | 'partially_discovered'
  | 'ready';

export interface ResearchMaterialRequirement {
  name: string;
  discovered: boolean;
  clue?: string;
}

export interface ResearchCandidate {
  id: string;
  name: string;
  category: 'Structure' | 'Survival' | 'Tools' | 'Cooking' | 'Hunting' | 'Medicine';
  description: string;
  progressPct: number; // 0 - 100
  materialsDiscoveredCount: number;
  materialsRequiredTotal: number;
  minDiscoveryRequiredPct: number; // typically 80%
  materialsAnalysis: ResearchMaterialRequirement[];
  researchTimeSeconds: number;
  isResearched: boolean;
  isTracking?: boolean;
  tags?: string[];
}

export interface ResearchQueueItem {
  id: string;
  candidateId: string;
  name: string;
  progressPct: number;
  remainingSeconds: number;
  totalSeconds: number;
  assignedSurvivorId?: string;
  status: 'in_progress' | 'paused';
}

export interface RecentDiscovery {
  id: string;
  name: string;
  type: 'unlocked' | 'material_identified';
  timeAgo: string;
}

// ============================================================================
// UPGRADE / MODIFICATION TYPES (Ảnh 3)
// ============================================================================
export type UpgradeCategoryFilter =
  | 'all'
  | 'tools'
  | 'weapons'
  | 'equipment'
  | 'structures'
  | 'utility';

export type ToolModSlot = 'blade' | 'handle' | 'binding' | 'grip';

export interface ToolStats {
  durability: number;
  cuttingPower: number;
  efficiencyPct: number;
  weightKg: number;
  reachM: number;
  stealthPct: number;
}

export interface InstalledModSlot {
  partId: string;
  partName: string;
  tier: number;
}

export interface UpgradeableTool {
  id: string;
  name: string;
  category: UpgradeCategoryFilter;
  description: string;
  tags: string[];
  slots: Record<ToolModSlot, InstalledModSlot>;
  baseStats: ToolStats;
}

export interface ModPart {
  id: string;
  name: string;
  slotType: ToolModSlot;
  tier: 'Primitive' | 'Basic' | 'Rare' | 'Advanced';
  description: string;
  count: number;
  statModifiers: Partial<ToolStats>;
  compatibleTools: string[];
}

export interface SavedConfiguration {
  id: string;
  name: string;
  description: string;
  slots: Record<ToolModSlot, string>;
}

export interface RecentModification {
  id: string;
  toolName: string;
  actionDescription: string;
  timeAgo: string;
}

export interface ModificationQueueItem {
  id: string;
  toolId: string;
  actionTitle: string;
  detailText: string;
  progressPct: number;
  remainingSeconds: number;
  totalSeconds: number;
  status: 'in_progress' | 'paused';
}

// ============================================================================
// REPAIR DATA TYPES (Ảnh 3)
// ============================================================================
export type RepairCategoryFilter =
  | 'all'
  | 'tools'
  | 'weapons'
  | 'equipment'
  | 'structures';

export interface ComponentCondition {
  name: string;
  conditionPct: number;
  statusText: string;
  isDamaged: boolean;
}

export interface RepairMaterialCost {
  itemId: string;
  name: string;
  owned: number;
  needed: number;
}

export interface RepairableItem {
  id: string;
  name: string;
  category: RepairCategoryFilter;
  durabilityPct: number;
  maxDurabilityPct: number;
  tags: string[];
  description: string;
  components: {
    blade: ComponentCondition;
    handle: ComponentCondition;
    binding: ComponentCondition;
    grip: ComponentCondition;
  };
  identifiedIssues: string[];
  materials: RepairMaterialCost[];
  repairResult: {
    restoresPct: number;
    fixesPartsCount: number;
    requiresMatCount: number;
  };
}

export interface RepairQueueItem {
  id: string;
  itemId: string;
  name: string;
  detailText: string;
  remainingSeconds: number;
  totalSeconds: number;
  status: 'in_progress' | 'paused';
}

export interface SparePartItem {
  id: string;
  name: string;
  quantity: number;
  conditionPct: number;
}

export interface MaintenanceHistoryItem {
  id: string;
  itemName: string;
  actionText: string;
  timeAgo: string;
}

// ============================================================================
// TIERED UPGRADE DATA TYPES (Ảnh 4)
// ============================================================================
export interface UpgradeTierStep {
  tier: number;
  name: string;
  tierLabel: string;
  isCurrent: boolean;
  isUnlocked: boolean;
}

export interface StatComparisonRow {
  label: string;
  currentValue: string;
  nextValue: string;
  changeText: string;
  isPositive?: boolean;
}

export interface UpgradeRequirementCheck {
  id: string;
  label: string;
  isMet: boolean;
}

export interface TieredUpgradeItem {
  id: string;
  name: string;
  category: UpgradeCategoryFilter;
  currentTier: number;
  maxTier: number;
  tags: string[];
  description: string;
  quote?: string;
  tierSteps: UpgradeTierStep[];
  statComparisons: StatComparisonRow[];
  requiredMaterials: RepairMaterialCost[];
  requirements: UpgradeRequirementCheck[];
}

export interface UpgradeQueueItem {
  id: string;
  itemId: string;
  name: string;
  targetTierLabel: string;
  remainingSeconds: number;
  totalSeconds: number;
  status: 'in_progress' | 'paused';
}

export interface UpgradeHistoryItem {
  id: string;
  fromName: string;
  toName: string;
  timeAgo: string;
}

