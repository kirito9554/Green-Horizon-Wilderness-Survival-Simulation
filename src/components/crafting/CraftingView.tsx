import React, { useMemo, useState, useEffect } from 'react';
import { GameState, RecipeDefinition, InventoryItem } from '../../types';
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

interface CraftingViewProps {
  state: GameState;
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
  onStartCrafting,
  onAddToCraftingQueue,
  onCancelQueueItem,
  onTogglePauseQueueItem,
  onReorderQueue,
}) => {
  const { inventory, survivors, craftingQueue = [] } = state;

  // Active Main SubTab: 'craft' | 'research' | 'upgrade'
  const [activeTab, setActiveTab] = useState<CraftingMainTab>('craft');

  // Craft sub-tab state
  const [selectedCategory, setSelectedCategory] = useState<CraftingCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<CraftingSortMode>('default');
  const [viewMode, setViewMode] = useState<CraftingViewMode>('grid');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set(state.pinnedRecipeIds || ['RECIPE_ASSEMBLE_STONE_KNIFE', 'RECIPE_TORCH', 'RECIPE_CRAFT_BANDAGE']));
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('RECIPE_ASSEMBLE_STONE_KNIFE');
  const [selectedSurvivorId, setSelectedSurvivorId] = useState<string>(survivors[0]?.id || '');
  const [recentlyCrafted, setRecentlyCrafted] = useState<RecentlyCraftedEntry[]>([
    {
      id: 'rc_1',
      recipeId: 'RECIPE_ASSEMBLE_STONE_KNIFE',
      name: 'Stone Knife',
      quantity: 2,
      timestamp: Date.now() - 120000,
      timeAgoText: '2m ago',
    },
    {
      id: 'rc_2',
      recipeId: 'RECIPE_CRAFT_ROPE',
      name: 'Rope',
      quantity: 4,
      timestamp: Date.now() - 300000,
      timeAgoText: '5m ago',
    },
    {
      id: 'rc_3',
      recipeId: 'RECIPE_TORCH',
      name: 'Torch',
      quantity: 1,
      timestamp: Date.now() - 720000,
      timeAgoText: '12m ago',
    },
    {
      id: 'rc_4',
      recipeId: 'RECIPE_CRAFT_BANDAGE',
      name: 'Bandage',
      quantity: 5,
      timestamp: Date.now() - 1680000,
      timeAgoText: '28m ago',
    },
    {
      id: 'rc_5',
      recipeId: 'RECIPE_CAMPFIRE_KIT',
      name: 'Campfire Kit',
      quantity: 1,
      timestamp: Date.now() - 3600000,
      timeAgoText: '1h ago',
    },
    {
      id: 'rc_6',
      recipeId: 'RECIPE_WOODEN_SPEAR',
      name: 'Wooden Spear',
      quantity: 2,
      timestamp: Date.now() - 7200000,
      timeAgoText: '2h ago',
    },
  ]);

  // Auto-select first idle survivor if available
  useEffect(() => {
    if (!selectedSurvivorId || !survivors.some((s) => s.id === selectedSurvivorId)) {
      const idle = survivors.find((s) => s.currentAction.type === 'idle') || survivors[0];
      if (idle) setSelectedSurvivorId(idle.id);
    }
  }, [survivors, selectedSurvivorId]);

  // All valid crafting recipes
  const allCraftingRecipes = useMemo(() => {
    return Object.values(RECIPES_DATABASE).filter(
      (r) => r.type === 'crafting' || r.type === undefined
    );
  }, []);

  // Category counts
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

    allCraftingRecipes.forEach((r) => {
      const cat = r.category as CraftingCategoryFilter;
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
      if (r.id.includes('BOW') || r.id.includes('SPEAR') || r.id.includes('CLUB')) {
        counts.weapons++;
      }
      if (r.id.includes('BED') || r.id.includes('SHELTER')) {
        counts.shelter++;
      }
    });

    return counts;
  }, [allCraftingRecipes]);

  // Check craft readiness for a recipe
  const getRecipeStatus = (recipe: RecipeDefinition) => {
    let maxCraft = Infinity;
    const missing: string[] = [];

    recipe.ingredients.forEach((ing) => {
      const owned = inventory.items
        .filter((i) => i.itemId === ing.itemId)
        .reduce((sum, i) => sum + i.quantity, 0);

      const possibleWithThis = Math.floor(owned / ing.quantity);
      if (possibleWithThis < maxCraft) {
        maxCraft = possibleWithThis;
      }
      if (owned < ing.quantity) {
        missing.push(ing.itemId);
      }
    });

    const isCraftable = missing.length === 0 && maxCraft > 0;
    const isPinned = pinnedIds.has(recipe.id);

    return {
      recipe,
      isCraftable,
      maxCraftable: maxCraft === Infinity ? 0 : maxCraft,
      isPinned,
      missingIngredients: missing,
    };
  };

  // Processed recipes with filtering and sorting
  const processedRecipes = useMemo(() => {
    return allCraftingRecipes
      .map(getRecipeStatus)
      .filter(({ recipe, isPinned }) => {
        // Category filter
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'weapons') {
            const isWeapon =
              recipe.category === 'weapons' ||
              recipe.id.includes('BOW') ||
              recipe.id.includes('SPEAR') ||
              recipe.id.includes('CLUB');
            if (!isWeapon) return false;
          } else if (selectedCategory === 'shelter') {
            const isShelter =
              recipe.category === 'shelter' ||
              recipe.id.includes('BED') ||
              recipe.id.includes('SHELTER');
            if (!isShelter) return false;
          } else if (recipe.category !== selectedCategory) {
            return false;
          }
        }

        // Pinned only filter
        if (onlyPinned && !isPinned) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = recipe.name.toLowerCase().includes(q);
          const matchDesc = recipe.description.toLowerCase().includes(q);
          const matchCat = recipe.category.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Pinned recipes always on top
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }

        switch (sortMode) {
          case 'name':
            return a.recipe.name.localeCompare(b.recipe.name);
          case 'tier': {
            const tierWeight: Record<string, number> = { Primitive: 1, Basic: 2, Advanced: 3 };
            const aTier = tierWeight[a.recipe.tier || 'Primitive'] || 1;
            const bTier = tierWeight[b.recipe.tier || 'Primitive'] || 1;
            return aTier - bTier;
          }
          case 'craftable':
            if (a.isCraftable !== b.isCraftable) {
              return a.isCraftable ? -1 : 1;
            }
            return b.maxCraftable - a.maxCraftable;
          case 'default':
          default:
            return 0;
        }
      });
  }, [allCraftingRecipes, selectedCategory, onlyPinned, searchQuery, sortMode, pinnedIds, inventory]);

  // Active recipe object
  const activeRecipe = useMemo(() => {
    return (
      allCraftingRecipes.find((r) => r.id === selectedRecipeId) ||
      processedRecipes[0]?.recipe ||
      allCraftingRecipes[0] ||
      null
    );
  }, [allCraftingRecipes, selectedRecipeId, processedRecipes]);

  // Crafting Stats Summary
  const stats: CraftingStatsSummary = useMemo(() => {
    const idleCount = survivors.filter((s) => s.currentAction.type === 'idle').length;
    const speedBonus = idleCount > 1 ? (idleCount - 1) * 15 : 0;

    return {
      totalKnownRecipes: allCraftingRecipes.length,
      maxRecipes: 18,
      queuedCrafts: craftingQueue.length,
      maxQueueSlots: 3,
      idleSurvivors: idleCount,
      craftingSpeedBonusPct: speedBonus,
    };
  }, [allCraftingRecipes.length, craftingQueue.length, survivors]);

  // Handlers
  const handleTogglePin = (recipeId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const handleCraftNow = (recipeId: string, quantity: number, survivorId: string) => {
    if (onStartCrafting) {
      onStartCrafting(survivorId, recipeId);
    } else if (onAddToCraftingQueue) {
      onAddToCraftingQueue(recipeId, quantity, survivorId);
    }

    const recipe = RECIPES_DATABASE[recipeId];
    if (recipe) {
      setRecentlyCrafted((prev) => [
        {
          id: `rc_${Date.now()}`,
          recipeId,
          name: recipe.name,
          quantity,
          timestamp: Date.now(),
          timeAgoText: 'Just now',
        },
        ...prev.slice(0, 5),
      ]);
    }
  };

  const handleAddToQueue = (recipeId: string, quantity: number, survivorId: string) => {
    if (onAddToCraftingQueue) {
      onAddToCraftingQueue(recipeId, quantity, survivorId);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col p-3.5 bg-gradient-to-b from-[#091511] to-[#050c09] text-[#e6ece8] select-none overflow-hidden"
      style={{ fontFamily: UI_FONT }}
    >
      {/* MASTER TOP BAR: Title, Time/Island Info & 3 Sub-tabs (Craft, Research, Upgrade) */}
      <CraftingMasterHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        day={state.day || 7}
        timeText="14:26"
        islandName="GREENHAVEN ISLAND"
      />

      {/* SUB-VIEW RENDERING */}
      <div className="flex-1 flex flex-col min-h-0 pt-2.5 overflow-hidden">
        {activeTab === 'craft' && (
          <div className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-hidden">
            {/* Craft Header with Category pills, search, sort */}
            <CraftingHeader
              category={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoryCounts={categoryCounts}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortMode={sortMode}
              onSortChange={setSortMode}
              viewMode={viewMode}
              onToggleViewMode={() => setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))}
              onlyPinned={onlyPinned}
              onToggleOnlyPinned={() => setOnlyPinned((prev) => !prev)}
              stats={stats}
            />

            {/* Catalog & Details / Queue Grid */}
            <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
              {/* Left Column: RECIPE CATALOG (Zone 1) */}
              <div className="w-[58%] flex flex-col min-h-0 bg-[#07130f]/60 rounded-xl border border-[#1d3a2b]/70 p-2.5 shadow-inner">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[rgba(90,125,102,0.18)]">
                  <span className="text-xs font-black tracking-widest text-[#a8c2b3] uppercase">
                    RECIPE CATALOG ({processedRecipes.length})
                  </span>
                  <span className="text-[11px] text-[#698574]">
                    Select to forge or queue
                  </span>
                </div>

                <CraftingCatalogGrid
                  recipes={processedRecipes}
                  selectedRecipeId={activeRecipe?.id || ''}
                  onSelectRecipe={setSelectedRecipeId}
                  onTogglePin={handleTogglePin}
                  viewMode={viewMode}
                />
              </div>

              {/* Right Column: Split into DETAILS & QUEUE */}
              <div className="w-[42%] flex flex-col gap-2.5 min-h-0">
                {/* Top Half: Detail Card */}
                <div className="h-[56%] min-h-0">
                  {activeRecipe && (
                    <CraftingDetailCard
                      recipe={activeRecipe}
                      inventoryItems={inventory.items}
                      survivors={survivors}
                      selectedSurvivorId={selectedSurvivorId}
                      onSelectSurvivor={setSelectedSurvivorId}
                      onCraftNow={handleCraftNow}
                      onAddToQueue={handleAddToQueue}
                      isPinned={pinnedIds.has(activeRecipe.id)}
                      onTogglePin={handleTogglePin}
                    />
                  )}
                </div>

                {/* Bottom Half: Queue Sidebar */}
                <div className="h-[44%] min-h-0">
                  {activeRecipe && (
                    <CraftingQueueSidebar
                      queue={craftingQueue}
                      survivors={survivors}
                      selectedRecipe={activeRecipe}
                      onSelectRecipe={setSelectedRecipeId}
                      onCancelQueueItem={onCancelQueueItem}
                      onTogglePauseQueueItem={onTogglePauseQueueItem}
                      onReorderQueue={onReorderQueue}
                      recentlyCrafted={recentlyCrafted}
                      onCraftAgain={(recipeId) => handleCraftNow(recipeId, 1, selectedSurvivorId)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Bar: Recently Crafted + Favorites (Matching Image 1) */}
            <CraftingFavoritesAndHistory
              recentHistory={recentlyCrafted}
              favoriteRecipeIds={Array.from(pinnedIds)}
              allRecipes={allCraftingRecipes}
              onSelectRecipe={(r) => setSelectedRecipeId(r.id)}
            />
          </div>
        )}

        {activeTab === 'research' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ResearchView
              onUnlockRecipe={(candidateId) => {
                // Unlock recipe in state if matching
                console.log('Unlocked candidate:', candidateId);
              }}
            />
          </div>
        )}

        {activeTab === 'repair' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <RepairView />
          </div>
        )}

        {activeTab === 'upgrade' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <UpgradeView />
          </div>
        )}
      </div>
    </div>
  );
};
