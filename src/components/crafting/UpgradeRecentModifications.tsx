import React from 'react';
import { History, Wrench, Sparkles } from 'lucide-react';
import { RecentModification } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface UpgradeRecentModificationsProps {
  modifications: RecentModification[];
  onSelectToolByName?: (toolName: string) => void;
}

export const UpgradeRecentModifications: React.FC<UpgradeRecentModificationsProps> = ({
  modifications,
  onSelectToolByName,
}) => {
  return (
    <div className="flex flex-col gap-2 pt-2.5 border-t border-[#2d4d3c]/40 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9db7a7]">
          <History className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>RECENT MODIFICATIONS</span>
        </div>
        <span className="text-[10px] text-[#698574] font-mono">
          {modifications.length} UPGRADED
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 overflow-x-auto py-0.5">
        {modifications.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => onSelectToolByName && onSelectToolByName(mod.toolName)}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0a1813]/80 hover:bg-[#10241b] border border-[#1f382a]/70 hover:border-[#38bdf8]/60 transition-all text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded bg-[#07130e] flex items-center justify-center overflow-hidden border border-[#213b2e] shrink-0">
              <CraftedItemArt itemId={mod.toolName} recipeId={mod.toolName} size={24} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-[#e1ece5] truncate">
                {mod.toolName}
              </span>
              <div className="flex items-center gap-1 text-[9px] text-[#6e8879]">
                <span className="text-[#38bdf8] flex items-center gap-0.5 font-medium">
                  <Wrench className="w-2.5 h-2.5" /> {mod.actionDescription}
                </span>
                <span>• {mod.timeAgo}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
