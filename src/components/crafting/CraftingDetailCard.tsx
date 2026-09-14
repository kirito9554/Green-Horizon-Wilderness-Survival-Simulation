import React, { useMemo, useState } from 'react';
import { Clock3, Hammer, Bookmark, Weight, Shield, Layers, UserCheck, Minus, Plus } from 'lucide-react';
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

  const ingredientStatus = useMemo(
    () => recipe.ingredients.map((ing) => {
      const matching = inventoryItems.filter((item) => item.itemId === ing.itemId);
      const totalOwned = matching.reduce((sum, item) => sum + item.quantity, 0);
      const reserved = matching.reduce((sum, item) => sum + Math.min(item.quantity, item.reservedQuantity || 0), 0);
      const available = Math.max(0, totalOwned - reserved);
      const required = ing.quantity * quantity;
      const itemDef = ITEMS_DATABASE[ing.itemId];
      return {
        itemId: ing.itemId,
        name: itemDef?.name || ing.itemId.replace('ITEM_', '').replace(/_/g, ' '),
        owned: available,
        totalOwned,
        reserved,
        required,
        sufficient: available >= required,
        clue: recipe.ingredientClues?.[ing.itemId] || 'Gathered while exploring the island',
      };
    }),
    [recipe, inventoryItems, quantity]
  );

  const canAfford = ingredientStatus.every((item) => item.sufficient);
  const maxCraftable = Math.max(
    0,
    Math.min(
      ...recipe.ingredients.map((ing) => {
        const available = inventoryItems
          .filter((item) => item.itemId === ing.itemId)
          .reduce((sum, item) => sum + Math.max(0, item.quantity - (item.reservedQuantity || 0)), 0);
        return Math.floor(available / ing.quantity);
      })
    )
  );
  const selectedSurvivor = survivors.find((s) => s.id === selectedSurvivorId) || survivors[0];
  const survivorBusy = !!selectedSurvivor && selectedSurvivor.currentAction.type !== 'idle';
  const totalCraftTime = recipe.craftTimeSeconds * quantity;
  const workstation = recipe.workstationName || 'None (Handcraft)';

  return (
    <section className="h-full min-h-0 flex flex-col overflow-hidden border border-[#3b513f] bg-gradient-to-b from-[#0d211b] to-[#071611] shadow-inner">
      <div className="shrink-0 p-3 border-b border-[#34493a]">
        <div className="flex gap-3">
          <div className="w-[92px] h-[92px] shrink-0 rounded-[5px] border border-[#49624e] bg-[#091510] flex items-center justify-center">
            <CraftedItemArt itemId={recipe.outputs[0]?.itemId || ''} recipeId={recipe.id} size={82} className="drop-shadow-[0_5px_8px_rgba(0,0,0,.8)]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[20px] leading-none font-black text-[#f5efe2] truncate">{recipe.name}</h2>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="px-2 py-0.5 rounded bg-[#0d4c40] border border-[#317d67] text-[10px] font-bold text-[#c9f2df] capitalize">{recipe.category}</span>
                  <span className="px-2 py-0.5 rounded bg-[#473712] border border-[#816426] text-[10px] font-bold text-[#f0d583]">{recipe.tier || 'Primitive'}</span>
                </div>
              </div>
              <button type="button" onClick={() => onTogglePin(recipe.id)} className={`p-1.5 rounded cursor-pointer ${isPinned ? 'text-[#f2ca4e]' : 'text-[#8d8e79] hover:text-[#dfcf95]'}`} title={isPinned ? 'Unpin recipe' : 'Pin recipe'}>
                <Bookmark className={`w-5 h-5 ${isPinned ? 'fill-current' : ''}`} />
              </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.35] text-[#c3c7b9] line-clamp-3">{recipe.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-2.5 border-t border-[#32483a] text-[11px]">
          <div className="flex items-center justify-between gap-2"><span className="text-[#9aa393] flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Durability</span><strong className="text-[#e9d77f]">{recipe.durabilityLevel || 'Medium'}</strong></div>
          <div className="flex items-center justify-between gap-2"><span className="text-[#9aa393] flex items-center gap-1"><Weight className="w-3.5 h-3.5" />Weight</span><strong className="text-[#e8e1d3]">{recipe.weightKg || 0.5} kg</strong></div>
          <div className="flex items-center justify-between gap-2"><span className="text-[#9aa393] flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />Base Time</span><strong className="text-[#e8e1d3]">{totalCraftTime}s</strong></div>
          <div className="flex items-center justify-between gap-2"><span className="text-[#9aa393] flex items-center gap-1"><Layers className="w-3.5 h-3.5" />Workstation</span><strong className="text-[#e8e1d3] truncate">{workstation}</strong></div>
        </div>
      </div>

      <div className="min-h-0 flex-1 flex flex-col p-3">
        <div className="shrink-0 flex items-center justify-between text-[12px] font-black tracking-wide text-[#f0e8d6] uppercase">
          <span>Required Materials</span>
          <span className="text-[10px] font-medium text-[#a8aa96] normal-case">Available / Need</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar mt-2 space-y-1.5 pr-1">
          {ingredientStatus.map((ing) => (
            <div key={ing.itemId} className="h-[54px] px-2 flex items-center gap-2 border border-[#314a3a] bg-[#091813]">
              <div className="w-10 h-10 shrink-0 rounded-[4px] border border-[#334b3c] bg-[#07120e] flex items-center justify-center">
                <ItemIcon itemId={ing.itemId} size={34} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-[#ede8dc] truncate">{ing.name}</div>
                <div className="text-[9.5px] text-[#7d8b7e] truncate">
                  {ing.reserved > 0 ? `${ing.reserved} reserved by queued work · ` : ''}{ing.clue}
                </div>
              </div>
              <div className={`shrink-0 font-mono text-[12px] font-black ${ing.sufficient ? 'text-[#8be06b]' : 'text-[#ef7564]'}`}>
                {ing.owned} / {ing.required}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 mt-2.5 pt-2.5 border-t border-[#314839] space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label className="h-8 flex items-center gap-1.5 px-2 border border-[#314a3a] bg-[#081713] rounded-[4px] min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-[#82c9a3] shrink-0" />
              <select value={selectedSurvivorId} onChange={(e) => onSelectSurvivor(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none text-[10.5px] text-[#dcd7c8] cursor-pointer">
                {survivors.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#0a1a15]">{s.name} — {s.currentAction.type === 'idle' ? 'Idle' : 'Busy'}</option>
                ))}
              </select>
            </label>

            <div className="h-8 flex items-center border border-[#314a3a] bg-[#081713] rounded-[4px] overflow-hidden">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-full w-7 flex items-center justify-center text-[#a9ac98] hover:text-white cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-7 text-center text-[11px] font-bold text-[#eed36d]">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(20, q + 1))} className="h-full w-7 flex items-center justify-center text-[#a9ac98] hover:text-white cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div className="grid grid-cols-[1.15fr_.85fr] gap-2">
            <button
              type="button"
              disabled={!canAfford || survivorBusy}
              onClick={() => onCraftNow(recipe.id, quantity, selectedSurvivorId)}
              className="h-11 rounded-[5px] border border-[#d8d54c] bg-gradient-to-b from-[#466326] to-[#244719] text-[#fffbdc] font-black text-[14px] flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(208,211,69,.2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={canAfford ? 'Reserve materials and start through the crafting scheduler' : 'Not enough unreserved materials for immediate crafting'}
            >
              <Hammer className="w-4 h-4" /> Craft
            </button>
            <button
              type="button"
              onClick={() => onAddToQueue(recipe.id, quantity, selectedSurvivorId)}
              className="h-11 rounded-[5px] border border-[#4a6554] bg-[#0d2923] text-[#e4dfd0] font-bold text-[12px] cursor-pointer hover:bg-[#13342c]"
              title={maxCraftable > 0 ? 'Reserve available materials for planned production' : 'Plan this job; it will wait for missing materials'}
            >
              Add to Queue
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
