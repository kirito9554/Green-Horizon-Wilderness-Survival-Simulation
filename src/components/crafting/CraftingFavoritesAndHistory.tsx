import React from 'react';
import { History, Star, Plus } from 'lucide-react';
import { RecipeDefinition } from '../../types';
import { RecentlyCraftedEntry } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface CraftingFavoritesAndHistoryProps {
  recentHistory: RecentlyCraftedEntry[];
  favoriteRecipeIds: string[];
  allRecipes: RecipeDefinition[];
  onSelectRecipe: (recipe: RecipeDefinition) => void;
  onOpenFavoritesModal?: () => void;
}

export const CraftingFavoritesAndHistory: React.FC<CraftingFavoritesAndHistoryProps> = ({
  recentHistory,
  favoriteRecipeIds,
  allRecipes,
  onSelectRecipe,
  onOpenFavoritesModal,
}) => {
  const favoriteRecipes = allRecipes.filter((r) => favoriteRecipeIds.includes(r.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2.5 border-t border-[#2d4d3c]/40 select-none">
      {/* Recently Crafted Bar */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-[#0a1813]/80 border border-[#1f382a]/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9db7a7]">
            <History className="w-3.5 h-3.5 text-[#5eead4]" />
            <span>RECENTLY CRAFTED</span>
          </div>
          <span className="text-[10px] text-[#698574] font-mono">
            {recentHistory.length} ENTRIES
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {recentHistory.length === 0 ? (
            <div className="text-[11px] text-[#61796b] italic py-1">
              No items crafted recently yet.
            </div>
          ) : (
            recentHistory.map((item) => {
              const recipe = allRecipes.find((r) => r.id === item.recipeId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => recipe && onSelectRecipe(recipe)}
                  className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#12241d]/90 hover:bg-[#183027] border border-[#2b4c3a]/50 hover:border-[#4ade80]/60 transition-all text-left shrink-0 cursor-pointer"
                >
                  <div className="w-6 h-6 rounded bg-[#091510] flex items-center justify-center overflow-hidden border border-[#243d30]">
                    <CraftedItemArt recipeId={item.recipeId} size={22} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#e1ece5] group-hover:text-[#4ade80] transition-colors leading-tight">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#86efac]">
                        x{item.quantity}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#6e8879]">{item.timeAgoText}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Favorites Bar */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-[#0a1813]/80 border border-[#1f382a]/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9db7a7]">
            <Star className="w-3.5 h-3.5 text-[#fbbf24] fill-[#fbbf24]" />
            <span>FAVORITES</span>
          </div>
          <span className="text-[10px] text-[#698574] font-mono">
            {favoriteRecipes.length} PINNED
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {favoriteRecipes.length === 0 ? (
            <div className="text-[11px] text-[#61796b] italic py-1">
              Click the star on any recipe card to pin it here.
            </div>
          ) : (
            favoriteRecipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onSelectRecipe(recipe)}
                className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#12241d]/90 hover:bg-[#183027] border border-[#2b4c3a]/50 hover:border-[#fbbf24]/60 transition-all text-left shrink-0 cursor-pointer"
              >
                <div className="w-6 h-6 rounded bg-[#091510] flex items-center justify-center overflow-hidden border border-[#243d30]">
                  <CraftedItemArt recipeId={recipe.id} size={22} />
                </div>
                <span className="text-[11px] font-bold text-[#e1ece5] group-hover:text-[#fbbf24] transition-colors leading-tight">
                  {recipe.name}
                </span>
              </button>
            ))
          )}

          {onOpenFavoritesModal && (
            <button
              type="button"
              onClick={onOpenFavoritesModal}
              title="Pin more favorites"
              className="w-8 h-8 rounded-md bg-[#12241d]/60 hover:bg-[#1c382b] border border-[#2b4c3a]/50 flex items-center justify-center text-[#759180] hover:text-[#fbbf24] transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
