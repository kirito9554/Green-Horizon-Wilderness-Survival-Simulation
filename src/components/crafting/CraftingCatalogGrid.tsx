import React from 'react';
import { Bookmark, AlertCircle, Clock3 } from 'lucide-react';
import { RecipeDefinition } from '../../types';
import { CraftingViewMode } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

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
      <div className="h-full flex flex-col items-center justify-center text-center text-[#7b8e80] border border-[#294236] bg-[#07130f]">
        <AlertCircle className="w-8 h-8 mb-2" />
        <div className="text-sm font-bold text-[#d3d9d4]">No recipes found</div>
        <div className="text-[11px] mt-1">Change category or clear the search filter.</div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="h-full overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
        {recipes.map(({ recipe, canCraft, isPinned }) => {
          const selected = recipe.id === selectedRecipeId;
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => onSelectRecipe(recipe.id)}
              className={`w-full h-[62px] px-2.5 flex items-center gap-3 rounded-[5px] border text-left transition-all cursor-pointer ${
                selected
                  ? 'bg-[#18341f] border-[#dfd44e] shadow-[0_0_10px_rgba(218,211,72,0.18)]'
                  : 'bg-[#0a1b17] border-[#2d473a] hover:bg-[#10251e] hover:border-[#4d6554]'
              }`}
            >
              <div className="w-11 h-11 shrink-0 rounded-[4px] border border-[#3b5445] bg-[#07120e] flex items-center justify-center">
                <CraftedItemArt itemId={recipe.outputs[0]?.itemId || ''} recipeId={recipe.id} size={38} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[12px] text-[#eee8d8] truncate">{recipe.name}</span>
                  <span className={`w-2 h-2 rounded-full ${canCraft ? 'bg-[#7ddc61]' : 'bg-[#a24f3e]'}`} />
                </div>
                <div className="text-[10px] text-[#829385] mt-0.5 flex items-center gap-1.5">
                  <Clock3 className="w-3 h-3" />
                  <span>{recipe.craftTimeSeconds}s</span>
                  <span>•</span>
                  <span>{recipe.ingredients.length} materials</span>
                </div>
              </div>
              {isPinned && <Bookmark className="w-4 h-4 text-[#e7c04e] fill-current shrink-0" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
      <div className="grid grid-cols-4 gap-2 auto-rows-[148px] content-start">
        {recipes.map(({ recipe, canCraft, maxCraftable, isPinned, isUnlocked }) => {
          const selected = recipe.id === selectedRecipeId;
          return (
            <div
              key={recipe.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectRecipe(recipe.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectRecipe(recipe.id);
                }
              }}
              className={`group relative min-w-0 p-1.5 rounded-[6px] border flex flex-col items-center justify-between transition-all cursor-pointer overflow-hidden ${
                selected
                  ? 'bg-gradient-to-b from-[#17391f] to-[#0b2115] border-[#e1d54d] shadow-[0_0_13px_rgba(225,213,77,0.28),inset_0_0_0_1px_rgba(237,220,79,0.25)]'
                  : 'bg-gradient-to-b from-[#0b211b] to-[#071512] border-[#355144] hover:border-[#72805a] hover:bg-[#102a20]'
              } ${!isUnlocked ? 'opacity-55' : ''}`}
            >
              <div className="absolute top-1.5 left-1.5 z-10">
                <span className={`block w-2 h-2 rounded-full border border-black/40 ${canCraft ? 'bg-[#8adf63]' : 'bg-[#b36b43]'}`} title={canCraft ? 'Craftable' : 'Missing materials'} />
              </div>

              <button
                type="button"
                aria-label={isPinned ? 'Unpin recipe' : 'Pin recipe'}
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin(recipe.id, event);
                }}
                className={`absolute top-1 right-1 z-20 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                  isPinned ? 'opacity-100 text-[#f0c951]' : 'text-[#8c917f] hover:text-[#ead18b]'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
              </button>

              <div className="flex-1 w-full flex items-center justify-center pt-2">
                <CraftedItemArt
                  itemId={recipe.outputs[0]?.itemId || ''}
                  recipeId={recipe.id}
                  size={78}
                  className="drop-shadow-[0_5px_8px_rgba(0,0,0,0.8)] group-hover:scale-[1.03] transition-transform"
                />
              </div>

              <div className="w-full px-1 pb-1 text-center">
                <div className="text-[12px] font-bold leading-tight text-[#f0ebdf] truncate">{recipe.name}</div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-[9px] text-[#889588]">
                  <span>{recipe.tier || 'Primitive'}</span>
                  {canCraft && maxCraftable > 0 && <span className="text-[#80d768]">x{maxCraftable}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
