import React from 'react';
import {
  Clock3,
  Pause,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Lock,
  History,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { CraftingQueueItem, RecipeDefinition, SurvivorState } from '../../types';
import { RECIPES_DATABASE } from '../../data/recipes';
import { CraftedItemArt } from './CraftedItemArt';
import { ItemIcon } from '../common/ItemIcon';

interface RecentlyCraftedItem {
  id: string;
  recipeId: string;
  name: string;
  quantity: number;
  timestamp: number;
  timeAgoText?: string;
}

interface CraftingQueueSidebarProps {
  queue: CraftingQueueItem[];
  survivors: SurvivorState[];
  selectedRecipe: RecipeDefinition;
  onSelectRecipe: (recipeId: string) => void;
  onCancelQueueItem?: (id: string) => void;
  onTogglePauseQueueItem?: (id: string) => void;
  onReorderQueue?: (id: string, direction: 'up' | 'down') => void;
  recentlyCrafted?: RecentlyCraftedItem[];
  onCraftAgain?: (recipeId: string) => void;
}

export const CraftingQueueSidebar: React.FC<CraftingQueueSidebarProps> = ({
  queue,
  survivors,
  selectedRecipe,
  onSelectRecipe,
  onCancelQueueItem,
  onTogglePauseQueueItem,
  onReorderQueue,
  recentlyCrafted = [],
  onCraftAgain,
}) => {
  const activeItem = queue.find((q) => q.status === 'in_progress');
  const pendingItems = queue.filter((q) => q.id !== activeItem?.id);

  // Progression branch for currently selected recipe
  const progression = selectedRecipe.progression;
  const nextRecipe = progression ? RECIPES_DATABASE[progression.nextRecipeId] : null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#11231c]/95 via-[#0c1a14]/95 to-[#08130f]/98 rounded-xl border border-[#274b39]/80 p-3.5 shadow-xl select-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410] space-y-3.5">
      {/* ========================================================================= */}
      {/* 1. ACTIVE CRAFTING / PRODUCTION JOB                                       */}
      {/* ========================================================================= */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#a0b8aa] uppercase">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>ACTIVE CRAFTING</span>
          </div>
          {activeItem && (
            <span className="text-[10px] text-[#4ade80] font-mono font-semibold animate-pulse">
              IN PROGRESS
            </span>
          )}
        </div>

        {activeItem ? (
          (() => {
            const recipe = RECIPES_DATABASE[activeItem.recipeId];
            const survivor = survivors.find((s) => s.id === activeItem.assignedSurvivorId);
            const totalSec = activeItem.totalSeconds || recipe?.craftTimeSeconds || 15;
            const progressSec = activeItem.progressSeconds || 0;
            const progressPct = Math.min(100, Math.round((progressSec / totalSec) * 100));
            const remainingSec = Math.max(0, Math.ceil(totalSec - progressSec));

            return (
              <div className="p-2.5 rounded-lg bg-[#07130f] border border-[#25503b] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 w-8 h-8 rounded bg-[#0f241a] border border-[#315a44] flex items-center justify-center">
                      <CraftedItemArt
                        itemId={recipe?.outputs[0]?.itemId || ''}
                        recipeId={recipe?.id}
                        size={28}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#f0fdf4] truncate">
                        {recipe?.name || activeItem.recipeId}
                      </div>
                      <div className="text-[10px] text-[#7ea08c]">
                        Artisan: <strong className="text-[#a7f3d0]">{survivor?.name || 'Unassigned'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onTogglePauseQueueItem?.(activeItem.id)}
                      className="p-1 rounded bg-[#132c20] hover:bg-[#1a3c2c] text-[#86e2ab] cursor-pointer"
                      title={activeItem.status === 'paused' ? 'Resume' : 'Pause'}
                    >
                      {activeItem.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancelQueueItem?.(activeItem.id)}
                      className="p-1 rounded bg-[#2b1414] hover:bg-[#3d1a1a] text-[#f87171] cursor-pointer"
                      title="Cancel craft"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[#869b8e] font-mono">
                    <span>{progressPct}% completed</span>
                    <span>{remainingSec}s left</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0d1f17] overflow-hidden border border-[#1f3f2f]">
                    <div
                      className="h-full bg-gradient-to-r from-[#16a34a] to-[#4ade80] transition-all duration-300 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="p-3 rounded-lg bg-[#07130f]/60 border border-[#1b3628]/40 text-center text-xs text-[#6e8577] italic">
            No active crafting job. Select a recipe and click &apos;Craft Now&apos; or &apos;Add to Queue&apos;.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. QUEUED CRAFTING SLOTS                                                  */}
      {/* ========================================================================= */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#a0b8aa] uppercase">
          <div className="flex items-center gap-1.5">
            <Clock3 className="w-3.5 h-3.5 text-[#5eead4]" />
            <span>QUEUED ITEMS ({pendingItems.length}/5)</span>
          </div>
        </div>

        {pendingItems.length === 0 ? (
          <div className="p-2.5 rounded-lg bg-[#07130f]/40 border border-[#1b3628]/30 text-center text-[11px] text-[#607769]">
            Queue is empty.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#2f5540]">
            {pendingItems.map((item, index) => {
              const recipe = RECIPES_DATABASE[item.recipeId];
              const survivor = survivors.find((s) => s.id === item.assignedSurvivorId);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#081510] border border-[#1e3b2b] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 text-[10px] font-mono text-[#668071] font-bold">
                      #{index + 1}
                    </span>
                    <div className="shrink-0 w-6 h-6 rounded bg-[#0d2016] flex items-center justify-center">
                      <CraftedItemArt
                        itemId={recipe?.outputs[0]?.itemId || ''}
                        recipeId={recipe?.id}
                        size={20}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#e5ede8] truncate leading-tight">
                        {recipe?.name || item.recipeId}
                      </div>
                      <div className="text-[10px] text-[#718a7c]">
                        {item.quantity}x • {survivor?.name || 'Auto'}
                      </div>
                    </div>
                  </div>

                  {/* Move Up/Down & Cancel */}
                  <div className="flex items-center gap-1 shrink-0">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => onReorderQueue?.(item.id, 'up')}
                        className="p-1 rounded text-[#809a8c] hover:text-[#e0eee5] cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                    )}
                    {index < pendingItems.length - 1 && (
                      <button
                        type="button"
                        onClick={() => onReorderQueue?.(item.id, 'down')}
                        className="p-1 rounded text-[#809a8c] hover:text-[#e0eee5] cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancelQueueItem?.(item.id)}
                      className="p-1 rounded text-[#b91c1c] hover:text-[#ef4444] cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. UPGRADE PATH / PROGRESSION TREE                                        */}
      {/* ========================================================================= */}
      {progression && nextRecipe && (
        <div className="space-y-1.5 pt-2 border-t border-[rgba(90,125,102,0.22)]">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#a0b8aa] uppercase">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" />
              <span>UPGRADE PATH</span>
            </div>
            <span className="text-[10px] text-[#c084fc] font-semibold">EVOLUTION</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectRecipe(nextRecipe.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRecipe(nextRecipe.id);
              }
            }}
            className="p-2.5 rounded-lg bg-gradient-to-r from-[#17142b]/90 to-[#0e171b]/90 border border-[#4c3a70] hover:border-[#8b5cf6] transition-all cursor-pointer group space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="shrink-0 w-8 h-8 rounded bg-[#201738] border border-[#5b4282] flex items-center justify-center p-0.5">
                  <CraftedItemArt
                    itemId={nextRecipe.outputs[0]?.itemId || ''}
                    recipeId={nextRecipe.id}
                    size={28}
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#ede9fe] group-hover:text-[#ffffff] flex items-center gap-1">
                    <span>{nextRecipe.name}</span>
                    <ArrowRight className="w-3 h-3 text-[#a78bfa] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div className="text-[10px] text-[#a78bfa]">
                    Tier: <strong className="text-[#ddd6fe]">{nextRecipe.tier || 'Basic'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Stats Preview */}
            {progression.nextStats && (
              <div className="grid grid-cols-2 gap-1 text-[10px] pt-1 border-t border-[#3d2f5a]">
                {progression.nextStats.durability && (
                  <div className="text-[#c4b5fd]">
                    Durability: <strong>{progression.nextStats.durability}</strong>
                  </div>
                )}
                {progression.nextStats.cutting && (
                  <div className="text-[#c4b5fd]">
                    Efficiency: <strong>{progression.nextStats.cutting}</strong>
                  </div>
                )}
                {progression.nextStats.feature && (
                  <div className="col-span-2 text-[#a7f3d0] italic">
                    ★ {progression.nextStats.feature}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECENTLY CRAFTED HISTORY FEED                                          */}
      {/* ========================================================================= */}
      {recentlyCrafted.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[rgba(90,125,102,0.22)]">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#a0b8aa] uppercase">
            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>RECENTLY CRAFTED</span>
            </div>
          </div>

          <div className="space-y-1">
            {recentlyCrafted.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-1.5 rounded bg-[#091410] border border-[#1b3426] text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0 w-6 h-6 rounded bg-[#07100d] flex items-center justify-center">
                    <CraftedItemArt recipeId={item.recipeId} size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#dce7e1] truncate leading-tight">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-[#6b8577]">
                      {item.quantity}x made • {item.timeAgoText || 'Just now'}
                    </div>
                  </div>
                </div>

                {onCraftAgain && (
                  <button
                    type="button"
                    onClick={() => onCraftAgain(item.recipeId)}
                    className="p-1 rounded text-[#5eead4] hover:text-[#a7f3d0] hover:bg-[#132d22] cursor-pointer"
                    title="Craft again"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
