import React from 'react';
import { Sparkles, ArrowRight, CheckCircle, Search } from 'lucide-react';
import { RecentDiscovery } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface ResearchRecentDiscoveriesProps {
  discoveries: RecentDiscovery[];
  onViewAll?: () => void;
}

export const ResearchRecentDiscoveries: React.FC<ResearchRecentDiscoveriesProps> = ({
  discoveries,
  onViewAll,
}) => {
  return (
    <div className="flex flex-col gap-2 pt-2.5 border-t border-[#2d4d3c]/40 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9db7a7]">
          <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
          <span>RECENT DISCOVERIES</span>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-[11px] font-bold text-[#7ce0a5] hover:text-[#a7f3d0] transition-colors cursor-pointer"
          >
            <span>View All Discoveries</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 overflow-x-auto py-0.5">
        {discoveries.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0a1813]/80 border border-[#1f382a]/70 hover:border-[#385e4a] transition-all"
          >
            <div className="w-7 h-7 rounded bg-[#07130e] flex items-center justify-center overflow-hidden border border-[#213b2e] shrink-0">
              <CraftedItemArt itemId={d.name} recipeId={d.name} size={24} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-[#e1ece5] truncate">
                {d.name}
              </span>
              <div className="flex items-center gap-1 text-[9px] text-[#6e8879]">
                {d.type === 'unlocked' ? (
                  <span className="text-[#86efac] flex items-center gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5" /> Unlocked
                  </span>
                ) : (
                  <span className="text-[#7dd3fc] flex items-center gap-0.5">
                    <Search className="w-2.5 h-2.5" /> Material
                  </span>
                )}
                <span>• {d.timeAgo}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
