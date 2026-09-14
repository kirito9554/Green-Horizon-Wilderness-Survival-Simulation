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
  const favoriteRecipes = allRecipes.filter((recipe) => favoriteRecipeIds.includes(recipe.id));

  return (
    <div className="h-[82px] shrink-0 grid grid-cols-[1.65fr_.85fr] border-t border-[#42513e] bg-[#071711] select-none overflow-hidden">
      <section className="min-w-0 px-2.5 py-1.5 border-r border-[#40503d]">
        <div className="h-5 flex items-center gap-1.5 text-[11px] font-black text-[#e8dfcc] uppercase tracking-wide">
          <History className="w-3.5 h-3.5 text-[#e3cf6b]" /> Recently Crafted
        </div>
        <div className="h-[50px] flex items-center gap-1.5 overflow-x-auto custom-scrollbar-horizontal">
          {recentHistory.length === 0 ? (
            <span className="text-[10px] italic text-[#738174]">Nothing crafted recently.</span>
          ) : (
            recentHistory.slice(0, 7).map((item) => {
              const recipe = allRecipes.find((r) => r.id === item.recipeId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => recipe && onSelectRecipe(recipe)}
                  className="h-10 shrink-0 px-2 flex items-center gap-1.5 border border-[#344b3c] bg-[#0b2019] hover:border-[#69745b] cursor-pointer"
                >
                  <CraftedItemArt recipeId={item.recipeId} size={30} />
                  <div className="text-left"><div className="text-[10px] font-bold text-[#e9e2d3] leading-none">{item.name}</div><div className="text-[8.5px] mt-1 text-[#7f8d80]">x{item.quantity} · {item.timeAgoText}</div></div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="min-w-0 px-2.5 py-1.5">
        <div className="h-5 flex items-center gap-1.5 text-[11px] font-black text-[#e8dfcc] uppercase tracking-wide"><Star className="w-3.5 h-3.5 text-[#e8cb59] fill-current" /> Favorites</div>
        <div className="h-[50px] flex items-center gap-1.5 overflow-x-auto custom-scrollbar-horizontal">
          {favoriteRecipes.slice(0, 4).map((recipe) => (
            <button key={recipe.id} type="button" onClick={() => onSelectRecipe(recipe)} className="h-10 min-w-[92px] flex items-center gap-1.5 px-2 border border-[#344b3c] bg-[#0b2019] hover:border-[#c9b84c] cursor-pointer">
              <CraftedItemArt recipeId={recipe.id} size={29} />
              <span className="text-[9.5px] font-bold text-[#e9e2d3] truncate">{recipe.name}</span>
            </button>
          ))}
          {onOpenFavoritesModal && <button type="button" onClick={onOpenFavoritesModal} className="w-10 h-10 shrink-0 border border-dashed border-[#566753] text-[#d7cb9b] flex items-center justify-center cursor-pointer"><Plus className="w-4 h-4" /></button>}
        </div>
      </section>
    </div>
  );
};
