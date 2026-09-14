import React from 'react';
import { Clock3, Check, Bookmark, AlertCircle, ChevronRight, Lock } from 'lucide-react';
import { RecipeDefinition, InventoryItem } from '../../types';
import { CraftingViewMode } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';
import { ItemIcon } from '../common/ItemIcon';

interface RecipeWithStatus {
  recipe: RecipeDefinition;
  canCraft: boolean;
  maxCraftable: number;
  missingIngredients: string[];
  isPinned: boolean;
  isUnlocked: boolean;
}

interface CraftingCatalogGridProps {
  recipes: RecipeWithStatus[];
  selectedRecipeId: string;
  onSelectRecipe: (recipeId: string) => void;
  onTogglePin: (recipeId: string, event: React.MouseEvent) => void;
  viewMode: CraftingViewMode;
}

export const CraftingCatalogGrid: React.FC<CraftingCatalogGridProps> = ({
  recipes,
  selectedRecipeId,
  onSelectRecipe,
  onTogglePin,
  viewMode,
}) => {
  if (recipes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#091512]/60 rounded-xl border border-[#1f3a2c]/40">
        <AlertCircle className="w-10 h-10 text-[#688172] mb-2" />
        <h3 className="text-sm font-bold text-[#d4ded7] uppercase tracking-wider">No Recipes Found</h3>
        <p className="text-xs text-[#809689] mt-1 max-w-sm">
          Try changing your category filter or clearing the search query to view available survival blueprints.
        </p>
      </div>
    );
  }

  // --- GRID VIEW MODE ---
  if (viewMode === 'grid') {
    return (
      <div className="flex-1 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410] select-none">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {recipes.map(({ recipe, canCraft, maxCraftable, isPinned, isUnlocked }) => {
            const isSelected = selectedRecipeId === recipe.id;
            const tier = recipe.tier || 'Primitive';

            return (
              <div
                key={recipe.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectRecipe(recipe.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRecipe(recipe.id);
                  }
                }}
                className={`group relative flex flex-col justify-between p-2.5 rounded-lg border transition-all duration-150 cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#1c382b] to-[#0f231b] border-[#4ade80] shadow-[0_0_15px_rgba(74,222,128,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-[#4ade80]/60'
                    : 'bg-gradient-to-b from-[#11221b]/90 to-[#0a1712]/95 hover:from-[#173026] hover:to-[#0d1e18] border-[#224032]/70 hover:border-[#3b6d54]/90 shadow-md'
                }`}
              >
                {/* Top Bar: Tier Badge + Pin Button + Craftable indicator */}
                <div className="flex items-center justify-between gap-1 z-10">
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider ${
                      tier === 'Advanced'
                        ? 'bg-[#7c2d12]/80 text-[#fdba74] border border-[#ea580c]/50'
                        : tier === 'Basic'
                        ? 'bg-[#1e3a8a]/70 text-[#93c5fd] border border-[#3b82f6]/40'
                        : 'bg-[#292524]/80 text-[#d6d3d1] border border-[#57534e]/50'
                    }`}
                  >
                    {tier}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Status Pill */}
                    {canCraft ? (
                      <span className="flex items-center gap-1 text-[9.5px] font-bold text-[#4ade80] bg-[#052e16]/80 px-1.5 py-0.5 rounded border border-[#166534]/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
                        READY {maxCraftable > 1 && `(${maxCraftable})`}
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-medium text-[#f87171] bg-[#450a0a]/60 px-1.5 py-0.5 rounded border border-[#991b1b]/40">
                        MISSING
                      </span>
                    )}

                    {/* Bookmark / Pin */}
                    <button
                      type="button"
                      onClick={(e) => onTogglePin(recipe.id, e)}
                      title={isPinned ? 'Unpin' : 'Pin to favorites'}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isPinned
                          ? 'text-[#fbbf24] hover:text-[#fde68a]'
                          : 'text-[#4d6657] hover:text-[#9cb1a4] opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Bookmark className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Center: High-Fidelity Custom Artwork */}
                <div className="my-2 flex items-center justify-center relative py-1">
                  <div
                    className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-200 pointer-events-none ${
                      isSelected
                        ? 'bg-[#22c55e]/15 opacity-100'
                        : canCraft
                        ? 'bg-[#10b981]/10 opacity-70 group-hover:opacity-100'
                        : 'bg-transparent opacity-0'
                    }`}
                  />
                  <CraftedItemArt
                    itemId={recipe.outputs[0]?.itemId || ''}
                    recipeId={recipe.id}
                    size={68}
                    className="relative transition-transform duration-200 group-hover:scale-105 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)]"
                  />
                </div>

                {/* Bottom: Item Name + Craft Time + Ingredients dots */}
                <div className="z-10 mt-auto pt-1 border-t border-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between gap-1">
                    <h4
                      className={`text-xs font-bold truncate leading-tight ${
                        isSelected ? 'text-[#f0fdf4]' : 'text-[#e5ede8] group-hover:text-[#f5fbf7]'
                      }`}
                      title={recipe.name}
                    >
                      {recipe.name}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[10px] text-[#869b8e]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock3 className="w-2.5 h-2.5 text-[#5eead4]" />
                      {recipe.craftTimeSeconds}s
                    </span>

                    {/* Ingredient Dots preview */}
                    <div className="flex items-center gap-0.5">
                      {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                        <span
                          key={`${ing.itemId}-${idx}`}
                          className="w-1.5 h-1.5 rounded-full bg-[#416a53]"
                          title={`${ing.quantity}x required`}
                        />
                      ))}
                      {recipe.ingredients.length > 3 && (
                        <span className="text-[9px] text-[#6c8677] leading-none">+</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- LIST VIEW MODE ---
  return (
    <div className="flex-1 overflow-y-auto pr-1.5 space-y-1.5 scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410] select-none">
      {recipes.map(({ recipe, canCraft, maxCraftable, isPinned }) => {
        const isSelected = selectedRecipeId === recipe.id;
        const tier = recipe.tier || 'Primitive';

        return (
          <div
            key={recipe.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectRecipe(recipe.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRecipe(recipe.id);
              }
            }}
            className={`group flex items-center justify-between p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
              isSelected
                ? 'bg-gradient-to-r from-[#1c382b] to-[#12271e] border-[#4ade80] shadow-md ring-1 ring-[#4ade80]/50'
                : 'bg-[#0f211a]/80 hover:bg-[#152e24] border-[#224032]/60 hover:border-[#35614a]'
            }`}
          >
            {/* Left: Icon + Title + Tier */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-11 h-11 rounded bg-[#0a1612] border border-[#264536]/80 flex items-center justify-center p-1">
                <CraftedItemArt
                  itemId={recipe.outputs[0]?.itemId || ''}
                  recipeId={recipe.id}
                  size={36}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#e5ede8] truncate">{recipe.name}</h4>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#24352c] text-[#a4b8ad] font-semibold uppercase">
                    {tier}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-[#869b8e]">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock3 className="w-2.5 h-2.5 text-[#5eead4]" />
                    {recipe.craftTimeSeconds}s
                  </span>
                  <span>•</span>
                  <span>{recipe.ingredients.length} ingredients</span>
                </div>
              </div>
            </div>

            {/* Right: Status + Pin Button + Arrow */}
            <div className="flex items-center gap-2 shrink-0">
              {canCraft ? (
                <span className="text-[10px] font-bold text-[#4ade80] bg-[#052e16] px-2 py-0.5 rounded border border-[#166534]">
                  READY {maxCraftable > 1 && `(${maxCraftable})`}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-[#f87171] bg-[#450a0a]/60 px-2 py-0.5 rounded border border-[#991b1b]/40">
                  MISSING
                </span>
              )}

              <button
                type="button"
                onClick={(e) => onTogglePin(recipe.id, e)}
                className={`p-1 rounded cursor-pointer ${
                  isPinned ? 'text-[#fbbf24]' : 'text-[#4d6657] hover:text-[#9cb1a4]'
                }`}
              >
                <Bookmark className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
              </button>

              <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-[#4ade80] translate-x-0.5' : 'text-[#476352]'}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
