import React from 'react';
import { Hammer, BookOpen, Wrench, ChevronsUp } from 'lucide-react';
import { CraftingMainTab } from '../../types/crafting';

interface CraftingMasterHeaderProps {
  activeTab: CraftingMainTab;
  onSelectTab: (tab: CraftingMainTab) => void;
  day?: number;
  timeText?: string;
  islandName?: string;
}

const TABS: Array<{
  id: CraftingMainTab;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'craft', label: 'Craft', subtitle: 'Create items from resources', icon: Hammer },
  { id: 'research', label: 'Research', subtitle: 'Unlock new recipes', icon: BookOpen },
  { id: 'repair', label: 'Repair', subtitle: 'Maintain and replace parts', icon: Wrench },
  { id: 'upgrade', label: 'Upgrade', subtitle: 'Improve existing items', icon: ChevronsUp },
];

export const CraftingMasterHeader: React.FC<CraftingMasterHeaderProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <div className="shrink-0 px-3 pt-2 pb-2 border-b border-[#3b4d36]/70 bg-[#071713]/92">
      <div className="grid grid-cols-4 gap-2">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`h-[58px] px-3 flex items-center justify-center gap-3 border rounded-[7px] transition-all duration-150 cursor-pointer ${
                active
                  ? 'bg-gradient-to-b from-[#254c28] via-[#18391e] to-[#102817] border-[#d9d449] text-[#fff9d9] shadow-[0_0_14px_rgba(219,216,70,0.26),inset_0_1px_0_rgba(255,255,255,0.13)]'
                  : 'bg-[#0b2925] border-[#315443]/80 text-[#d9d2bd] hover:bg-[#10332e] hover:border-[#55715d]'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#fff4b0]' : 'text-[#d3c29a]'}`} />
              <div className="min-w-0 text-left">
                <div className="text-[14px] font-black leading-none tracking-wide">{tab.label}</div>
                <div className="text-[10px] mt-1 leading-none opacity-70 truncate">{tab.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
