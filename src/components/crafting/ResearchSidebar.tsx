import React from 'react';
import {
  Brain,
  Lightbulb,
  Clock,
  Zap,
  BookMarked,
  ArrowUp,
  X,
  Plus,
  Compass,
  Sparkles,
} from 'lucide-react';
import { ResearchQueueItem } from '../../types/crafting';

interface ResearchSidebarProps {
  knowledgePoints?: number;
  recipesDiscoveredCount?: number;
  maxRecipesDiscovered?: number;
  materialsIdentifiedCount?: number;
  maxMaterialsIdentified?: number;
  researchSpeedBonusPct?: number;
  queue: ResearchQueueItem[];
  maxQueueSlots?: number;
  onCancelQueueItem: (id: string) => void;
  onMoveUpQueueItem: (id: string) => void;
  onAddToQueueClick?: () => void;
}

export const ResearchSidebar: React.FC<ResearchSidebarProps> = ({
  knowledgePoints = 12,
  recipesDiscoveredCount = 28,
  maxRecipesDiscovered = 52,
  materialsIdentifiedCount = 41,
  maxMaterialsIdentified = 78,
  researchSpeedBonusPct = 10,
  queue,
  maxQueueSlots = 3,
  onCancelQueueItem,
  onMoveUpQueueItem,
  onAddToQueueClick,
}) => {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full gap-3 select-none">
      {/* 1. RESEARCH INFO WIDGET */}
      <div className="p-3 rounded-xl bg-[#0a1712]/90 border border-[#214232]/80 flex flex-col gap-2.5 shadow-sm">
        <div className="flex items-center gap-2 pb-1.5 border-b border-[#1b3629]">
          <Brain className="w-4 h-4 text-[#fbbf24]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#d4e4db]">
            RESEARCH INFO
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Knowledge Points */}
          <div className="p-2 rounded-lg bg-[#07130e] border border-[#1a3326] flex flex-col">
            <span className="text-[10px] text-[#718d7d] font-semibold uppercase">Knowledge Points</span>
            <span className="text-sm font-bold text-[#fbbf24] font-mono mt-0.5">
              {knowledgePoints} KP
            </span>
          </div>

          {/* Recipes Discovered */}
          <div className="p-2 rounded-lg bg-[#07130e] border border-[#1a3326] flex flex-col">
            <span className="text-[10px] text-[#718d7d] font-semibold uppercase">Recipes Discovered</span>
            <span className="text-sm font-bold text-[#86efac] font-mono mt-0.5">
              {recipesDiscoveredCount} / {maxRecipesDiscovered}
            </span>
          </div>

          {/* Materials Identified */}
          <div className="p-2 rounded-lg bg-[#07130e] border border-[#1a3326] flex flex-col">
            <span className="text-[10px] text-[#718d7d] font-semibold uppercase">Materials Identified</span>
            <span className="text-sm font-bold text-[#67e8f9] font-mono mt-0.5">
              {materialsIdentifiedCount} / {maxMaterialsIdentified}
            </span>
          </div>

          {/* Research Speed */}
          <div className="p-2 rounded-lg bg-[#07130e] border border-[#1a3326] flex flex-col">
            <span className="text-[10px] text-[#718d7d] font-semibold uppercase">Research Speed</span>
            <span className="text-sm font-bold text-[#facc15] font-mono mt-0.5 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              +{researchSpeedBonusPct}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. RESEARCH QUEUE WIDGET */}
      <div className="p-3 rounded-xl bg-[#0a1712]/90 border border-[#214232]/80 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#1b3629]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5eead4]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#d4e4db]">
              RESEARCH QUEUE
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#86efac] px-2 py-0.5 rounded bg-[#132c20] border border-[#27533c]">
            {queue.length} / {maxQueueSlots}
          </span>
        </div>

        {/* Queue Items */}
        <div className="flex flex-col gap-2 min-h-[90px]">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-[#637d6e] italic">
              Queue is currently empty.
              <span className="text-[10px] text-[#50685a] mt-0.5">Select a candidate and press Start Research</span>
            </div>
          ) : (
            queue.map((item, idx) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-[#07130e] border border-[#1b3528] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-[#718d7d] bg-[#102319] px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-[#f5ede0] truncate">
                      {item.name}
                    </span>
                  </div>

                  {/* Actions: Move Up & Cancel */}
                  <div className="flex items-center gap-1 shrink-0">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => onMoveUpQueueItem(item.id)}
                        title="Prioritize"
                        className="p-1 rounded bg-[#102319] hover:bg-[#1a3828] text-[#86a894] hover:text-[#fff] transition-colors cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancelQueueItem(item.id)}
                      title="Cancel research"
                      className="p-1 rounded bg-[#102319] hover:bg-[#3b1212] text-[#86a894] hover:text-[#f87171] transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress bar + Countdown */}
                <div className="flex items-center justify-between text-[10px] text-[#718d7d]">
                  <span className="font-mono text-[#86efac]">{item.progressPct}% done</span>
                  <span className="font-mono text-[#5eead4] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(item.remainingSeconds)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#050b08] overflow-hidden border border-[#162a20]">
                  <div
                    className="h-full bg-gradient-to-r from-[#10b981] to-[#34d399] rounded-full transition-all duration-300"
                    style={{ width: `${item.progressPct}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add to Queue Button */}
        {onAddToQueueClick && (
          <button
            type="button"
            onClick={onAddToQueueClick}
            disabled={queue.length >= maxQueueSlots}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border cursor-pointer ${
              queue.length < maxQueueSlots
                ? 'bg-[#10251c] hover:bg-[#163327] border-[#294c39] text-[#a4bdad] hover:text-[#f0faf4]'
                : 'bg-[#0b1612]/60 border-[#1a2f24] text-[#556b5f] cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add to Queue</span>
          </button>
        )}
      </div>

      {/* 3. RESEARCH TIPS */}
      <div className="p-3 rounded-xl bg-[#0a1712]/90 border border-[#214232]/80 flex flex-col gap-2 shadow-sm text-xs mt-auto">
        <div className="flex items-center gap-2 pb-1 border-b border-[#1b3629]">
          <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
          <h4 className="font-bold uppercase text-[#d4e4db] text-[11px] tracking-wider">
            RESEARCH TIPS
          </h4>
        </div>

        <ul className="flex flex-col gap-1.5 text-[11px] text-[#90a89a] leading-relaxed">
          <li className="flex items-start gap-1.5">
            <span className="text-[#fbbf24] mt-0.5">•</span>
            <span>Discover at least <strong>80%</strong> of a recipe&apos;s required materials to unlock it.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[#fbbf24] mt-0.5">•</span>
            <span>Identify new materials by gathering and examining them in the wild.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[#fbbf24] mt-0.5">•</span>
            <span>Some rare materials require deeper inland exploration.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[#fbbf24] mt-0.5">•</span>
            <span>Track recipes to get hints from your surroundings.</span>
          </li>
        </ul>

        <div className="pt-2 border-t border-[#1b3629] text-[10px] italic text-[#6f897a] text-center font-serif">
          &ldquo;Knowledge turns the unknown into the possible.&rdquo;
        </div>
      </div>
    </div>
  );
};
