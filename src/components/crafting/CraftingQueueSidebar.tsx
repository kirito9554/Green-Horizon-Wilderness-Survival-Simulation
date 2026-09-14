import React from 'react';
import { Clock3, Trash2, ChevronUp, ChevronDown, Hammer, BookOpen, Users, Zap, ArrowRight, Plus } from 'lucide-react';
import { CraftingQueueItem, RecipeDefinition, SurvivorState } from '../../types';
import { CraftingStatsSummary } from '../../types/crafting';
import { RECIPES_DATABASE } from '../../data/recipes';
import { CraftedItemArt } from './CraftedItemArt';

interface CraftingQueueSidebarProps {
  queue: CraftingQueueItem[];
  survivors: SurvivorState[];
  selectedRecipe: RecipeDefinition;
  onSelectRecipe: (recipeId: string) => void;
  onCancelQueueItem?: (id: string) => void;
  onTogglePauseQueueItem?: (id: string) => void;
  onReorderQueue?: (id: string, direction: 'up' | 'down') => void;
  onAddSelectedToQueue?: () => void;
  stats?: CraftingStatsSummary;
}

const formatTime = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const CraftingQueueSidebar: React.FC<CraftingQueueSidebarProps> = ({
  queue,
  survivors,
  selectedRecipe,
  onSelectRecipe,
  onCancelQueueItem,
  onReorderQueue,
  onAddSelectedToQueue,
  stats,
}) => {
  const progression = selectedRecipe.progression;
  const nextRecipe = progression ? RECIPES_DATABASE[progression.nextRecipeId] : null;
  const visibleQueue = queue.slice(0, 3);

  return (
    <aside className="h-full min-h-0 flex flex-col gap-2 bg-[#061510]">
      <section className="shrink-0 border border-[#40503d] bg-[#0b201a]">
        <div className="h-10 px-3 flex items-center gap-2 border-b border-[#3c4d3b] bg-[#0d2721] text-[#f0e7d5]">
          <Hammer className="w-4 h-4 text-[#e5d574]" />
          <h3 className="text-[13px] font-black tracking-wide">CRAFTING INFO</h3>
        </div>
        <div className="px-3 py-2.5 grid grid-cols-1 gap-1.5 text-[11px]">
          <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Total Known Recipes" value={`${stats?.totalKnownRecipes ?? 0} / ${stats?.maxRecipes ?? 18}`} />
          <InfoRow icon={<Clock3 className="w-3.5 h-3.5" />} label="Queued Crafts" value={`${queue.length} / ${stats?.maxQueueSlots ?? 3}`} />
          <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Idle Survivors" value={`${stats?.idleSurvivors ?? survivors.filter((s) => s.currentAction.type === 'idle').length}`} />
          <InfoRow icon={<Zap className="w-3.5 h-3.5" />} label="Crafting Speed" value={`+${stats?.craftingSpeedBonusPct ?? 0}%`} />
        </div>
      </section>

      <section className="min-h-0 flex-[1.05] border border-[#40503d] bg-[#0b201a] flex flex-col">
        <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-[#3c4d3b] bg-[#0d2721]">
          <div className="flex items-center gap-2 text-[#f0e7d5]"><Clock3 className="w-4 h-4 text-[#e5d574]" /><h3 className="text-[13px] font-black tracking-wide">CRAFTING QUEUE</h3></div>
          <span className="text-[12px] font-bold text-[#e5d574]">{queue.length} / {stats?.maxQueueSlots ?? 3}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1.5">
          {visibleQueue.length === 0 ? (
            <div className="h-full min-h-[84px] flex items-center justify-center text-[11px] italic text-[#718275] border border-dashed border-[#355040] bg-[#07150f]">Queue is empty</div>
          ) : (
            visibleQueue.map((item, index) => {
              const recipe = RECIPES_DATABASE[item.recipeId];
              const total = item.totalSeconds || recipe?.craftTimeSeconds || 1;
              const progress = Math.min(100, Math.round(((item.progressSeconds || 0) / total) * 100));
              const remaining = Math.max(0, total - (item.progressSeconds || 0));
              return (
                <div key={item.id} className="h-[66px] px-2 flex items-center gap-2 border border-[#355040] bg-[#081914]">
                  <div className="w-10 h-10 shrink-0 rounded-[4px] border border-[#405546] bg-[#07120e] flex items-center justify-center">
                    <CraftedItemArt itemId={recipe?.outputs[0]?.itemId || ''} recipeId={recipe?.id} size={34} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-[#eee7d8] truncate">{recipe?.name || item.recipeId}</span><span className="text-[9px] text-[#8d998e]">x{item.quantity}</span></div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-[#17271f] overflow-hidden border border-[#2b4134]"><div className="h-full bg-[#3bc1c9]" style={{ width: `${Math.max(8, progress)}%` }} /></div>
                      <span className="text-[9px] font-mono text-[#cdc4b1]">{formatTime(remaining)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    {index > 0 && <button type="button" onClick={() => onReorderQueue?.(item.id, 'up')} className="w-6 h-5 flex items-center justify-center border border-[#50634e] text-[#d7d0bd] hover:text-white cursor-pointer"><ChevronUp className="w-3 h-3" /></button>}
                    <button type="button" onClick={() => onCancelQueueItem?.(item.id)} className="w-6 h-5 flex items-center justify-center border border-[#8b493c] text-[#ef6b59] hover:text-red-300 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    {index < visibleQueue.length - 1 && <button type="button" onClick={() => onReorderQueue?.(item.id, 'down')} className="w-6 h-5 flex items-center justify-center border border-[#50634e] text-[#d7d0bd] hover:text-white cursor-pointer"><ChevronDown className="w-3 h-3" /></button>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button type="button" onClick={onAddSelectedToQueue} className="h-11 shrink-0 m-2 mt-0 border border-dashed border-[#50705b] bg-[#0b251e] hover:bg-[#103027] text-[#d9d2c0] flex items-center justify-center gap-2 text-[12px] cursor-pointer"><Plus className="w-4 h-4" /> Add to Queue</button>
      </section>

      <section className="min-h-0 flex-[.95] border border-[#40503d] bg-[#0b201a] flex flex-col">
        <div className="h-10 shrink-0 px-3 flex items-center gap-2 border-b border-[#3c4d3b] bg-[#0d2721] text-[#f0e7d5]"><Zap className="w-4 h-4 text-[#e5d574]" /><h3 className="text-[13px] font-black tracking-wide">RECIPE PROGRESSION</h3></div>
        <div className="min-h-0 flex-1 p-3">
          {progression && nextRecipe ? (
            <button type="button" onClick={() => onSelectRecipe(nextRecipe.id)} className="w-full h-full min-h-[110px] border border-[#405644] bg-[#081914] hover:border-[#d0c650] cursor-pointer flex flex-col items-center justify-center p-2">
              <div className="flex items-center justify-center gap-3">
                <div className="text-center"><div className="w-14 h-14 mx-auto border border-[#3d5645] bg-[#07120e] flex items-center justify-center"><CraftedItemArt itemId={selectedRecipe.outputs[0]?.itemId || ''} recipeId={selectedRecipe.id} size={48} /></div><div className="mt-1 text-[10px] font-bold text-[#e9e3d5] max-w-[90px] truncate">{selectedRecipe.name}</div></div>
                <ArrowRight className="w-5 h-5 text-[#e2d471] shrink-0" />
                <div className="text-center"><div className="w-14 h-14 mx-auto border border-[#4b5d4d] bg-[#07120e] flex items-center justify-center"><CraftedItemArt itemId={nextRecipe.outputs[0]?.itemId || ''} recipeId={nextRecipe.id} size={48} /></div><div className="mt-1 text-[10px] font-bold text-[#e9e3d5] max-w-[90px] truncate">{nextRecipe.name}</div></div>
              </div>
              <div className="mt-2 text-[9.5px] text-[#929e91] text-center">Discover and craft higher-tier variants through research and upgrades.</div>
            </button>
          ) : (
            <div className="h-full min-h-[110px] flex items-center justify-center text-center text-[10.5px] text-[#78877b] border border-dashed border-[#354a3d] bg-[#07150f] px-5">No known progression for this recipe yet.</div>
          )}
        </div>
      </section>
    </aside>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="h-6 flex items-center gap-2 border-b border-[#25392e] last:border-0">
    <span className="text-[#ddd2ad] shrink-0">{icon}</span>
    <span className="min-w-0 flex-1 text-[#b7b9ae] truncate">{label}</span>
    <strong className="text-[#e5d15d] font-mono text-[12px] shrink-0">{value}</strong>
  </div>
);
