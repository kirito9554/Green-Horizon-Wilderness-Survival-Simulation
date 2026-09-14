import React from 'react';
import { Hammer, Lightbulb, Wrench, Sparkles, ArrowUpCircle, Compass, ShieldCheck } from 'lucide-react';
import { CraftingMainTab } from '../../types/crafting';

interface CraftingMasterHeaderProps {
  activeTab: CraftingMainTab;
  onSelectTab: (tab: CraftingMainTab) => void;
  day?: number;
  timeText?: string;
  islandName?: string;
}

export const CraftingMasterHeader: React.FC<CraftingMasterHeaderProps> = ({
  activeTab,
  onSelectTab,
  day = 7,
  timeText = '14:26',
  islandName = 'GREENHAVEN ISLAND',
}) => {
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'research':
        return {
          title: 'RESEARCH',
          subtitle: 'Study your findings, analyze materials, and unlock new recipes.',
          motto: 'KNOWLEDGE • SURVIVAL • PROGRESS',
          icon: <Lightbulb className="w-5 h-5 text-[#fbbf24]" />,
        };
      case 'repair':
        return {
          title: 'REPAIR',
          subtitle: 'Restore durability, replace damaged parts, and maintain your equipment.',
          motto: 'RESTORE • MAINTAIN • ENDURE',
          icon: <Sparkles className="w-5 h-5 text-[#34d399]" />,
        };
      case 'upgrade':
        return {
          title: 'UPGRADE',
          subtitle: 'Evolve tools into higher tiers with better stats and special perks.',
          motto: 'ADAPT • ENHANCE • MASTER',
          icon: <ArrowUpCircle className="w-5 h-5 text-[#38bdf8]" />,
        };
      case 'craft':
      default:
        return {
          title: 'CRAFTING',
          subtitle: 'Turn gathered resources into useful tools, equipment and supplies.',
          motto: 'SURVIVE • EXPLORE • BUILD',
          icon: <Hammer className="w-5 h-5 text-[#4ade80]" />,
        };
    }
  };

  const currentInfo = getHeaderInfo();

  return (
    <div className="flex flex-col gap-2.5 pb-2.5 border-b border-[rgba(90,118,98,0.3)] select-none shrink-0">
      {/* Top row: Title + Motto & Location info */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#142920] border border-[#2d4d3c] flex items-center justify-center shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]">
            {currentInfo.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black tracking-widest text-[#f5ede0] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-serif">
                {currentInfo.title}
              </h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1c382b]/80 border border-[#3b6d51]/60 text-[#7ce0a5] uppercase tracking-wider">
                WORKBENCH TIER 1
              </span>
            </div>
            <p className="text-[11px] text-[#a3b8aa] tracking-wide">
              {currentInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Location & Slogan Banner */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end text-right">
            <span className="text-[9px] uppercase font-bold tracking-widest text-[#698573]">
              {currentInfo.motto}
            </span>
            <span className="text-[11px] font-mono font-medium text-[#c5d8cc] flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-[#d4af37]" />
              {islandName} • Day {day} {timeText}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#0a1813]/80 border border-[#2a4737]/60 text-[#a8c2b2] text-[11px]">
            <ShieldCheck className="w-3 h-3 text-[#4ade80]" />
            <span className="text-[10px] font-semibold text-[#86efac]">CAMP SAFE</span>
          </div>
        </div>
      </div>

      {/* 4 Main Sub-Tabs Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {/* Tab 1: Craft */}
        <button
          type="button"
          onClick={() => onSelectTab('craft')}
          className={`relative group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 border ${
            activeTab === 'craft'
              ? 'bg-gradient-to-r from-[#193a2b] to-[#122b20] border-[#4ade80] shadow-[0_0_12px_rgba(74,222,128,0.25)] text-[#f5ede0]'
              : 'bg-[#0e211a]/70 hover:bg-[#142c22] border-[#254636]/60 text-[#9bb0a2] hover:text-[#e2eee6]'
          }`}
        >
          <div
            className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${
              activeTab === 'craft'
                ? 'bg-[#25523d] text-[#4ade80] border border-[#3c7e5e]'
                : 'bg-[#12251d] text-[#718d7c] group-hover:text-[#a8c7b4]'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide uppercase">
                Craft
              </span>
              {activeTab === 'craft' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
              )}
            </div>
            <p className="text-[10px] truncate opacity-75 hidden sm:block">
              Create items
            </p>
          </div>
        </button>

        {/* Tab 2: Research */}
        <button
          type="button"
          onClick={() => onSelectTab('research')}
          className={`relative group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 border ${
            activeTab === 'research'
              ? 'bg-gradient-to-r from-[#2e2612] to-[#1e190b] border-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.25)] text-[#fef3c7]'
              : 'bg-[#0e211a]/70 hover:bg-[#142c22] border-[#254636]/60 text-[#9bb0a2] hover:text-[#e2eee6]'
          }`}
        >
          <div
            className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${
              activeTab === 'research'
                ? 'bg-[#423315] text-[#fbbf24] border border-[#6b5220]'
                : 'bg-[#12251d] text-[#718d7c] group-hover:text-[#a8c7b4]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide uppercase">
                Research
              </span>
              {activeTab === 'research' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
              )}
            </div>
            <p className="text-[10px] truncate opacity-75 hidden sm:block">
              Unlock recipes
            </p>
          </div>
        </button>

        {/* Tab 3: Repair */}
        <button
          type="button"
          onClick={() => onSelectTab('repair')}
          className={`relative group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 border ${
            activeTab === 'repair'
              ? 'bg-gradient-to-r from-[#0d3326] to-[#082219] border-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.25)] text-[#d1fae5]'
              : 'bg-[#0e211a]/70 hover:bg-[#142c22] border-[#254636]/60 text-[#9bb0a2] hover:text-[#e2eee6]'
          }`}
        >
          <div
            className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${
              activeTab === 'repair'
                ? 'bg-[#134e3a] text-[#34d399] border border-[#1b7557]'
                : 'bg-[#12251d] text-[#718d7c] group-hover:text-[#a8c7b4]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide uppercase">
                Repair
              </span>
              {activeTab === 'repair' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              )}
            </div>
            <p className="text-[10px] truncate opacity-75 hidden sm:block">
              Fix damaged gear
            </p>
          </div>
        </button>

        {/* Tab 4: Upgrade */}
        <button
          type="button"
          onClick={() => onSelectTab('upgrade')}
          className={`relative group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 border ${
            activeTab === 'upgrade'
              ? 'bg-gradient-to-r from-[#122d3b] to-[#0c1f2a] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.25)] text-[#e0f2fe]'
              : 'bg-[#0e211a]/70 hover:bg-[#142c22] border-[#254636]/60 text-[#9bb0a2] hover:text-[#e2eee6]'
          }`}
        >
          <div
            className={`w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors ${
              activeTab === 'upgrade'
                ? 'bg-[#164259] text-[#38bdf8] border border-[#23688c]'
                : 'bg-[#12251d] text-[#718d7c] group-hover:text-[#a8c7b4]'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide uppercase">
                Upgrade
              </span>
              {activeTab === 'upgrade' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse" />
              )}
            </div>
            <p className="text-[10px] truncate opacity-75 hidden sm:block">
              Improve tiers
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
