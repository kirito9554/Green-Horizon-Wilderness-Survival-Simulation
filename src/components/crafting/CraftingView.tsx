import React, { useMemo, useState, useEffect } from 'react';
import { GameState, RecipeDefinition } from '../../types';
import {
  CraftingMainTab,
  CraftingCategoryFilter,
  CraftingSortMode,
  CraftingViewMode,
  CraftingStatsSummary,
  RecentlyCraftedEntry,
} from '../../types/crafting';
import { RECIPES_DATABASE } from '../../data/recipes';
import { CraftingMasterHeader } from './CraftingMasterHeader';
import { CraftingHeader } from './CraftingHeader';
import { CraftingCatalogGrid } from './CraftingCatalogGrid';
import { CraftingDetailCard } from './CraftingDetailCard';
import { CraftingQueueSidebar } from './CraftingQueueSidebar';
import { CraftingFavoritesAndHistory } from './CraftingFavoritesAndHistory';
import { ResearchView } from './ResearchView';
import { RepairView } from './RepairView';
import { UpgradeView } from './UpgradeView';
import './OrganicUI.css';
import './CraftingReference.css';

interface CraftingViewProps {
  state: GameState;
  /** Legacy callback retained for parent compatibility; queue scheduler is authoritative. */
  onStartCrafting?: (survivorId: string, recipeId: string) => void;
  onStartResearch?: (recipeId: string, survivorId: string) => void;
  onPauseResearch?: (recipeId: string) => void;
  onAddToCraftingQueue?: (recipeId: string, quantity: number, assignedSurvivorId?: string) => void;
  onCancelQueueItem?: (queueItemId: string) => void;
  onTogglePauseQueueItem?: (queueItemId: string) => void;
  onReorderQueue?: (queueItemId: string, direction: 'up' | 'down') => void;
  onAssignSurvivorToQueue?: (queueItemId: string, survivorId?: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const CraftingView: React.FC<CraftingViewProps> = ({
  state,
  onStartResearch,
  onPauseResearch,
  onAddToCraftingQueue,
  onCancelQueueItem,
  onTogglePauseQueueItem,
  onReorderQueue,
}) => {
  const { inventory, survivors, craftingQueue = [] } = state;
  const [activeTab, setActiveTab] = useState<CraftingMainTab>('craft');
  const [selectedCategory, setSelectedCategory] = useState<CraftingCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<CraftingSortMode>('default');
  const [viewMode, setViewMode] = useState<CraftingViewMode>('grid');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(
    new Set(state.pinnedRecipeIds || ['RECIPE_ASSEMBLE_STONE_KNIFE', 'RECIPE_TORCH', 'RECIPE_CRAFT_BANDAGE'])
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('RECIPE_ASSEMBLE_STONE_KNIFE');
  const [selectedSurvivorId, setSelectedSurvivorId] = useState<string>(survivors[0]?.id || '');

  useEffect(() => {
    if (!selectedSurvivorId || !survivors.some((survivor) => survivor.id === selectedSurvivorId)) {
      const idle = survivors.find((survivor) => survivor.currentAction.type === 'idle') || survivors[0];
      if (idle) setSelectedSurvivorId(idle.id);
    }
  }, [survivors, selectedSurvivorId]);

  const allCraftingRecipes = useMemo(
    () => Object.values(RECIPES_DATABASE).filter((recipe) => recipe.type === 'crafting' || recipe.type === undefined),
    []
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<CraftingCategoryFilter, number> = {
      all: allCraftingRecipes.length,
      tools: 0,
      weapons: 0,
      survival: 0,
      shelter: 0,
      food: 0,
      medicine: 0,
      utility: 0,
    };
    allCraftingRecipes.forEach((recipe) => {
      const category = recipe.category as CraftingCategoryFilter;
      if (counts[category] !== undefined) counts[category] += 1;
      if (recipe.id.includes('BOW') || recipe.id.includes('SPEAR') || recipe.id.includes('CLUB')) counts.weapons += 1;
      if (recipe.id.includes('BED') || recipe.id.includes('SHELTER')) counts.shelter += 1;
    });
    return counts;
  }, [allCraftingRecipes]);

  const getRecipeStatus = (recipe: RecipeDefinition) => {
    let maxCraft = Infinity;
    const missingIngredients: string[] = [];

    recipe.ingredients.forEach((ingredient) => {
      const ownedAvailable = inventory.items
        .filter((item) => item.itemId === ingredient.itemId)
        .reduce((sum, item) => sum + Math.max(0, item.quantity - (item.reservedQuantity || 0)), 0);
      maxCraft = Math.min(maxCraft, Math.floor(ownedAvailable / ingredient.quantity));
      if (ownedAvailable < ingredient.quantity) missingIngredients.push(ingredient.itemId);
    });

    const research = state.researches?.[recipe.id];
    const isUnlocked = recipe.unlockedByDefault || recipe.type !== 'crafting' || research?.status === 'completed';

    return {
      recipe,
      canCraft: isUnlocked && missingIngredients.length === 0 && maxCraft > 0,
      maxCraftable: maxCraft === Infinity ? 0 : maxCraft,
      missingIngredients,
      isPinned: pinnedIds.has(recipe.id),
      isUnlocked,
    };
  };

  const processedRecipes = useMemo(() => {
    return allCraftingRecipes
      .map(getRecipeStatus)
      .filter(({ recipe, isPinned }) => {
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'weapons') {
            if (!(recipe.id.includes('BOW') || recipe.id.includes('SPEAR') || recipe.id.includes('CLUB'))) return false;
          } else if (selectedCategory === 'shelter') {
            if (!(recipe.category === 'shelter' || recipe.id.includes('BED') || recipe.id.includes('SHELTER'))) return false;
          } else if (recipe.category !== selectedCategory) return false;
        }
        if (onlyPinned && !isPinned) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          if (!recipe.name.toLowerCase().includes(query) && !recipe.description.toLowerCase().includes(query) && !recipe.category.toLowerCase().includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (sortMode === 'name') return a.recipe.name.localeCompare(b.recipe.name);
        if (sortMode === 'craftable') return Number(b.canCraft) - Number(a.canCraft) || b.maxCraftable - a.maxCraftable;
        if (sortMode === 'tier') {
          const weight: Record<string, number> = { Primitive: 1, Basic: 2, Advanced: 3 };
          return (weight[a.recipe.tier || 'Primitive'] || 1) - (weight[b.recipe.tier || 'Primitive'] || 1);
        }
        return 0;
      });
  }, [allCraftingRecipes, inventory, selectedCategory, onlyPinned, searchQuery, sortMode, pinnedIds, state.researches]);

  const activeRecipe = useMemo(
    () => allCraftingRecipes.find((recipe) => recipe.id === selectedRecipeId) || processedRecipes[0]?.recipe || allCraftingRecipes[0] || null,
    [allCraftingRecipes, selectedRecipeId, processedRecipes]
  );

  const stats: CraftingStatsSummary = useMemo(() => {
    const idleCount = survivors.filter((survivor) => survivor.currentAction.type === 'idle').length;
    const skilled = survivors.filter((survivor) => (survivor.skills.crafting || 0) > 1);
    const avgSkill = skilled.length > 0
      ? skilled.reduce((sum, survivor) => sum + (survivor.skills.crafting || 1), 0) / skilled.length
      : 1;
    return {
      totalKnownRecipes: allCraftingRecipes.filter((recipe) => recipe.unlockedByDefault || state.researches?.[recipe.id]?.status === 'completed').length,
      maxRecipes: Math.max(18, allCraftingRecipes.length),
      queuedCrafts: craftingQueue.length,
      maxQueueSlots: 3,
      idleSurvivors: idleCount,
      craftingSpeedBonusPct: Math.max(0, Math.round((avgSkill - 1) * 10)),
    };
  }, [allCraftingRecipes, craftingQueue.length, survivors, state.researches]);

  const recentHistory = useMemo<RecentlyCraftedEntry[]>(() => {
    return (state.recentlyCrafted || []).map((entry) => ({ ...entry, timeAgoText: entry.timeAgoText || 'Recently' }));
  }, [state.recentlyCrafted]);

  const togglePin = (recipeId: string) => {
    setPinnedIds((previous) => {
      const next = new Set(previous);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
  };

  const handleCraftNow = (recipeId: string, quantity: number, survivorId: string) => {
    onAddToCraftingQueue?.(recipeId, quantity, survivorId || undefined);
  };

  const handleAddToQueue = (recipeId: string, quantity: number, survivorId: string) => {
    onAddToCraftingQueue?.(recipeId, quantity, survivorId || undefined);
  };

  const minuteOfDay = state.gameTime.minuteOfDay || 0;
  const timeText = `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(Math.floor(minuteOfDay % 60)).padStart(2, '0')}`;

  return (
    <div className="crafting-reference-root w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#06130f] text-[#e8e2d4] select-none" style={{ fontFamily: UI_FONT, containerType: 'size' }}>
      <CraftingMasterHeader activeTab={activeTab} onSelectTab={setActiveTab} day={state.gameTime.day || 1} timeText={timeText} islandName="GREENHAVEN ISLAND" />

      {activeTab === 'craft' && activeRecipe && (
        <div className="min-h-0 flex-1 grid grid-cols-[minmax(0,2.55fr)_minmax(300px,.95fr)] gap-2 p-2 overflow-hidden">
          <div className="min-w-0 min-h-0 flex flex-col border border-[#40503d] bg-[#071711] overflow-hidden">
            <CraftingHeader
              category={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoryCounts={categoryCounts}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortMode={sortMode}
              onSortChange={setSortMode}
              viewMode={viewMode}
              onToggleViewMode={() => setViewMode((previous) => previous === 'grid' ? 'list' : 'grid')}
              onlyPinned={onlyPinned}
              onToggleOnlyPinned={() => setOnlyPinned((previous) => !previous)}
              stats={stats}
            />

            <div className="min-h-0 flex-1 grid grid-cols-[1.08fr_.92fr] gap-2 p-2 overflow-hidden">
              <section className="min-w-0 min-h-0 border border-[#354a3b] bg-[#081813] p-2 flex flex-col overflow-hidden">
                <div className="h-7 shrink-0 flex items-center justify-between px-1 mb-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[#e1d9c6]">Recipe Catalog</span>
                  <span className="text-[9.5px] text-[#7f8e81]">{processedRecipes.length} recipes</span>
                </div>
                <div className="min-h-0 flex-1">
                  <CraftingCatalogGrid
                    recipes={processedRecipes}
                    selectedRecipeId={activeRecipe.id}
                    onSelectRecipe={setSelectedRecipeId}
                    onTogglePin={(recipeId) => togglePin(recipeId)}
                    viewMode={viewMode}
                  />
                </div>
              </section>

              <CraftingDetailCard
                recipe={activeRecipe}
                inventoryItems={inventory.items}
                survivors={survivors}
                selectedSurvivorId={selectedSurvivorId}
                onSelectSurvivor={setSelectedSurvivorId}
                onCraftNow={handleCraftNow}
                onAddToQueue={handleAddToQueue}
                isPinned={pinnedIds.has(activeRecipe.id)}
                onTogglePin={togglePin}
              />
            </div>

            <CraftingFavoritesAndHistory recentHistory={recentHistory} favoriteRecipeIds={Array.from(pinnedIds)} allRecipes={allCraftingRecipes} onSelectRecipe={(recipe) => setSelectedRecipeId(recipe.id)} />
          </div>

          <CraftingQueueSidebar
            queue={craftingQueue}
            survivors={survivors}
            selectedRecipe={activeRecipe}
            onSelectRecipe={setSelectedRecipeId}
            onCancelQueueItem={onCancelQueueItem}
            onTogglePauseQueueItem={onTogglePauseQueueItem}
            onReorderQueue={onReorderQueue}
            stats={stats}
            onAddSelectedToQueue={() => handleAddToQueue(activeRecipe.id, 1, selectedSurvivorId)}
          />
        </div>
      )}

      {activeTab === 'research' && (
        <div className="min-h-0 flex-1 p-2 overflow-hidden">
          <ResearchView state={state} onStartResearch={onStartResearch} onPauseResearch={onPauseResearch} />
        </div>
      )}
      {activeTab === 'repair' && <div className="min-h-0 flex-1 p-2 overflow-hidden"><RepairView /></div>}
      {activeTab === 'upgrade' && <div className="min-h-0 flex-1 p-2 overflow-hidden"><UpgradeView /></div>}
    </div>
  );
};
