import React, { useState } from 'react';
import {
  Clock3,
  Hammer,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  Sparkles,
  Shield,
  Weight,
  Layers,
  Flame,
  UserCheck,
} from 'lucide-react';
import { RecipeDefinition, SurvivorState, InventoryItem } from '../../types';
import { ITEMS_DATABASE } from '../../data/items';
import { CraftedItemArt } from './CraftedItemArt';
import { ItemIcon } from '../common/ItemIcon';

interface CraftingDetailCardProps {
  recipe: RecipeDefinition;
  inventoryItems: InventoryItem[];
  survivors: SurvivorState[];
  selectedSurvivorId: string;
  onSelectSurvivor: (id: string) => void;
  onCraftNow: (recipeId: string, quantity: number, survivorId: string) => void;
  onAddToQueue: (recipeId: string, quantity: number, survivorId: string) => void;
  isPinned: boolean;
  onTogglePin: (recipeId: string) => void;
}

export const CraftingDetailCard: React.FC<CraftingDetailCardProps> = ({
  recipe,
  inventoryItems,
  survivors,
  selectedSurvivorId,
  onSelectSurvivor,
  onCraftNow,
  onAddToQueue,
  isPinned,
  onTogglePin,
}) => {
  const [quantity, setQuantity] = useState(1);

  // Calculate owned counts for each ingredient
  const ingredientStatus = recipe.ingredients.map((ing) => {
    const owned = inventoryItems
      .filter((i) => i.itemId === ing.itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
    const requiredTotal = ing.quantity * quantity;
    const isSufficient = owned >= requiredTotal;
    const itemDef = ITEMS_DATABASE[ing.itemId];
    const clue = recipe.ingredientClues?.[ing.itemId] || 'Gathered from exploration & resource nodes';

    return {
      itemId: ing.itemId,
      name: itemDef?.name || ing.itemId.replace('ITEM_', '').replace(/_/g, ' '),
      owned,
      requiredPerUnit: ing.quantity,
      requiredTotal,
      isSufficient,
      clue,
    };
  });

  const canAfford = ingredientStatus.every((ing) => ing.isSufficient);

  // Maximum craftable based on available inventory
  const maxCraftable = Math.max(
    1,
    Math.min(
      ...recipe.ingredients.map((ing) => {
        const owned = inventoryItems
          .filter((i) => i.itemId === ing.itemId)
          .reduce((sum, i) => sum + i.quantity, 0);
        return Math.floor(owned / ing.quantity);
      })
    )
  );

  const selectedSurvivor = survivors.find((s) => s.id === selectedSurvivorId) || survivors[0];
  const isSurvivorBusy = selectedSurvivor && selectedSurvivor.currentAction.type !== 'idle';
  const craftingSkill = Math.round(selectedSurvivor?.skills.crafting || 1);

  const handleAdjustQty = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(99, prev + delta)));
  };

  const handleSetMax = () => {
    if (maxCraftable > 0 && maxCraftable !== Infinity) {
      setQuantity(maxCraftable);
    }
  };

  const tier = recipe.tier || 'Primitive';
  const durability = recipe.durabilityLevel || 'Medium';
  const weight = recipe.weightKg ? `${recipe.weightKg} kg` : '0.5 kg';
  const workstation = recipe.workstationName || 'None (Handcraft)';
  const totalCraftTime = recipe.craftTimeSeconds * quantity;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#11231c]/95 via-[#0c1a14]/95 to-[#08130f]/98 rounded-xl border border-[#274b39]/80 p-3.5 shadow-xl select-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410]">
      {/* 1. Header: Title, Tier, Category, Pin */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[rgba(90,125,102,0.22)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-black text-[#f7f2e7] tracking-wider uppercase font-serif drop-shadow">
              {recipe.name}
            </h2>
            <span
              className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded tracking-widest ${
                tier === 'Advanced'
                  ? 'bg-[#7c2d12]/80 text-[#fdba74] border border-[#ea580c]/50'
                  : tier === 'Basic'
                  ? 'bg-[#1e3a8a]/70 text-[#93c5fd] border border-[#3b82f6]/40'
                  : 'bg-[#292524]/80 text-[#d6d3d1] border border-[#57534e]/50'
              }`}
            >
              {tier}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#91a89b]">
            <span className="capitalize px-1.5 py-0.2 rounded bg-[#173024] text-[#86e2ab] font-medium">
              {recipe.category}
            </span>
            <span>•</span>
            <span className="text-[#a4b8ad]">Workstation: {workstation}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onTogglePin(recipe.id)}
          title={isPinned ? 'Remove from favorites' : 'Pin to favorites'}
          className={`p-1.5 rounded-md border transition-all cursor-pointer ${
            isPinned
              ? 'bg-[#b45309]/30 border-[#f59e0b] text-[#fbbf24]'
              : 'bg-[#0b1613] border-[#254434]/60 text-[#60796b] hover:text-[#b4c8bc]'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* 2. Main Hero Showcase & Specs */}
      <div className="flex items-center gap-3 my-3 p-2.5 rounded-lg bg-[#07130f]/80 border border-[#1b3628]/60">
        <div className="shrink-0 w-20 h-20 rounded-lg bg-gradient-to-b from-[#132d22] to-[#0a1712] border border-[#315a44] flex items-center justify-center p-1.5 relative shadow-inner">
          <div className="absolute inset-0 bg-radial from-[#34d399]/10 to-transparent pointer-events-none" />
          <CraftedItemArt
            itemId={recipe.outputs[0]?.itemId || ''}
            recipeId={recipe.id}
            size={68}
            className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs text-[#b8cbbf] leading-relaxed line-clamp-2">
            {recipe.description}
          </p>

          {recipe.useCases && (
            <div className="text-[11px] text-[#81998c]">
              <span className="text-[#a7beaf] font-semibold">Use cases: </span>
              <span className="italic text-[#c2d5c8]">{recipe.useCases}</span>
            </div>
          )}

          {/* Mini Stats Badges */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex items-center gap-1 text-[10px] text-[#869b8e] bg-[#11241c] px-2 py-0.5 rounded border border-[#214232]">
              <Weight className="w-2.5 h-2.5 text-[#5eead4]" />
              <span>{weight}</span>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-[#869b8e] bg-[#11241c] px-2 py-0.5 rounded border border-[#214232]">
              <Shield className="w-2.5 h-2.5 text-[#a78bfa]" />
              <span>Durability: <strong className="text-[#d8b4fe]">{durability}</strong></span>
            </div>

            <div className="flex items-center gap-1 text-[10px] text-[#869b8e] bg-[#11241c] px-2 py-0.5 rounded border border-[#214232]">
              <Clock3 className="w-2.5 h-2.5 text-[#fbbf24]" />
              <span>{totalCraftTime}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. REQUIRED INGREDIENTS LIST */}
      <div className="space-y-1.5 my-1">
        <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#a0b8aa] uppercase">
          <span>REQUIRED INGREDIENTS</span>
          <span className="text-[10px] text-[#6b8274] font-normal lowercase">
            for {quantity}x craft
          </span>
        </div>

        <div className="space-y-1.5">
          {ingredientStatus.map((ing) => (
            <div
              key={ing.itemId}
              className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                ing.isSufficient
                  ? 'bg-[#0c1a14]/90 border-[#234533]'
                  : 'bg-[#1a0f0f]/80 border-[#5a1e1e]/60'
              }`}
            >
              {/* Left: Pixel Icon + Name + Location Clue */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0 w-8 h-8 rounded bg-[#06100c] border border-[#1b3628] flex items-center justify-center p-0.5">
                  <ItemIcon itemId={ing.itemId} size={28} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#e6ece8] truncate">
                    {ing.name}
                  </div>
                  <div className="text-[10px] text-[#788e80] italic truncate">
                    {ing.clue}
                  </div>
                </div>
              </div>

              {/* Right: Quantity (owned / required) */}
              <div className="shrink-0 text-right font-mono text-xs">
                <span
                  className={`font-bold ${
                    ing.isSufficient ? 'text-[#4ade80]' : 'text-[#f87171]'
                  }`}
                >
                  {ing.owned}
                </span>
                <span className="text-[#62776a]"> / {ing.requiredTotal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SURVIVOR ASSIGNMENT & QUANTITY STEPPER */}
      <div className="mt-3 pt-2.5 border-t border-[rgba(90,125,102,0.22)] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Survivor dropdown */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <UserCheck className="w-3.5 h-3.5 text-[#5ee7aa] shrink-0" />
            <select
              value={selectedSurvivorId}
              onChange={(e) => onSelectSurvivor(e.target.value)}
              className="bg-[#091511] border border-[#224534] rounded-md px-2 py-1 text-xs text-[#dbe7e0] outline-none w-full cursor-pointer"
            >
              {survivors.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0c1a14] text-[#dbe7e0]">
                  {s.name} ({s.currentAction.type === 'idle' ? 'Idle' : 'Busy'} • Crafting {Math.round(s.skills.crafting || 1)})
                </option>
              ))}
            </select>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1 bg-[#091511] border border-[#224534] rounded-md p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => handleAdjustQty(-1)}
              disabled={quantity <= 1}
              className="p-1 text-[#869b8e] hover:text-[#dbe7e0] disabled:opacity-30 cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-7 text-center font-mono font-bold text-xs text-[#fbbf24]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => handleAdjustQty(1)}
              className="p-1 text-[#869b8e] hover:text-[#dbe7e0] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            {maxCraftable > 1 && maxCraftable !== Infinity && (
              <button
                type="button"
                onClick={handleSetMax}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#173024] text-[#86e2ab] hover:bg-[#204433] cursor-pointer"
              >
                MAX
              </button>
            )}
          </div>
        </div>

        {/* 5. Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Add to Queue button */}
          <button
            type="button"
            disabled={!canAfford}
            onClick={() => onAddToQueue(recipe.id, quantity, selectedSurvivorId)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#3b6d51]/70 bg-gradient-to-b from-[#183929] to-[#0f241a] hover:from-[#214e38] hover:to-[#143224] text-[#dcebe1] font-bold text-xs shadow-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Clock3 className="w-3.5 h-3.5 text-[#5eead4]" />
            <span>ADD TO QUEUE</span>
          </button>

          {/* Craft Now button */}
          <button
            type="button"
            disabled={!canAfford || isSurvivorBusy}
            onClick={() => onCraftNow(recipe.id, quantity, selectedSurvivorId)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#4ade80]/60 bg-gradient-to-b from-[#166534] via-[#15803d] to-[#14532d] hover:from-[#15803d] hover:to-[#166534] text-[#ffffff] font-extrabold text-xs shadow-[0_2px_10px_rgba(34,197,94,0.3)] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
          >
            <Hammer className="w-3.5 h-3.5 text-[#ffffff]" />
            <span>CRAFT NOW</span>
          </button>
        </div>

        {/* Warning messages */}
        {!canAfford && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#f87171] justify-center">
            <AlertTriangle className="w-3 h-3" />
            <span>Missing required ingredients to craft this item.</span>
          </div>
        )}
        {canAfford && isSurvivorBusy && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-[#fbbf24] justify-center">
            <AlertTriangle className="w-3 h-3" />
            <span>Assigned survivor is busy. Use &apos;Add to Queue&apos; instead.</span>
          </div>
        )}
      </div>
    </div>
  );
};
