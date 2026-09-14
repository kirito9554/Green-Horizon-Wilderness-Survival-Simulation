import React from 'react';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  Users,
  Clock3,
  Bookmark,
  Zap,
} from 'lucide-react';
import { CraftingCategoryFilter, CraftingSortMode, CraftingViewMode, CraftingStatsSummary } from '../../types/crafting';

interface CraftingHeaderProps {
  category: CraftingCategoryFilter;
  onSelectCategory: (category: CraftingCategoryFilter) => void;
  categoryCounts: Record<CraftingCategoryFilter, number>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortMode: CraftingSortMode;
  onSortChange: (sort: CraftingSortMode) => void;
  viewMode: CraftingViewMode;
  onToggleViewMode: () => void;
  onlyPinned: boolean;
  onToggleOnlyPinned: () => void;
  stats: CraftingStatsSummary;
}

const CATEGORY_ITEMS: Array<{ id: CraftingCategoryFilter; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'weapons', label: 'WEAPONS' },
  { id: 'survival', label: 'SURVIVAL' },
  { id: 'shelter', label: 'SHELTER' },
  { id: 'food', label: 'FOOD' },
  { id: 'medicine', label: 'MEDICINE' },
  { id: 'utility', label: 'UTILITY' },
];

export const CraftingHeader: React.FC<CraftingHeaderProps> = ({
  category,
  onSelectCategory,
  categoryCounts,
  searchQuery,
  onSearchChange,
  sortMode,
  onSortChange,
  viewMode,
  onToggleViewMode,
  onlyPinned,
  onToggleOnlyPinned,
  stats,
}) => {
  return (
    <div className="flex flex-col gap-2.5 pb-2.5 border-b border-[rgba(90,118,98,0.25)] select-none">
      {/* Top row: Title + Metric Stats Badges */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-[#f5ede0] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-serif">
              CRAFTING
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c382b]/70 border border-[#3b6d51]/50 text-[#7ce0a5] uppercase tracking-wider">
              SURVIVAL BENCH
            </span>
          </div>
          <p className="text-xs text-[#a3b8aa] tracking-wide mt-0.5">
            Combine collected raw resources to forge essential tools, shelter, and survival equipment.
          </p>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Known Recipes */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1c18]/80 border border-[#2d4d3c]/40 text-[#c2d4c8] text-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="text-[10px] text-[#869b8e] font-semibold">RECIPES:</span>
            <strong className="text-[#f0e4ca] font-mono">{stats.totalKnownRecipes}/{stats.maxRecipes}</strong>
          </div>

          {/* Queue slots */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1c18]/80 border border-[#2d4d3c]/40 text-[#c2d4c8] text-xs">
            <Clock3 className="w-3.5 h-3.5 text-[#5eead4]" />
            <span className="text-[10px] text-[#869b8e] font-semibold">QUEUE:</span>
            <strong className="text-[#f0e4ca] font-mono">{stats.queuedCrafts}/{stats.maxQueueSlots}</strong>
          </div>

          {/* Idle Survivors */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1c18]/80 border border-[#2d4d3c]/40 text-[#c2d4c8] text-xs">
            <Users className="w-3.5 h-3.5 text-[#86efac]" />
            <span className="text-[10px] text-[#869b8e] font-semibold">SURVIVORS:</span>
            <strong className="text-[#86efac] font-mono">{stats.idleSurvivors} IDLE</strong>
          </div>

          {/* Speed Bonus */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1c18]/80 border border-[#2d4d3c]/40 text-[#c2d4c8] text-xs">
            <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span className="text-[10px] text-[#869b8e] font-semibold">EFFICIENCY:</span>
            <strong className="text-[#fbbf24] font-mono">+{stats.craftingSpeedBonusPct}%</strong>
          </div>
        </div>
      </div>

      {/* Bottom row: Category Pills + Search + Sort + View Mode */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
          {CATEGORY_ITEMS.map((item) => {
            const active = category === item.id;
            const count = categoryCounts[item.id] || 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCategory(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-b from-[#24533a] to-[#163a28] text-[#f2efe9] border border-[#52936e] shadow-[0_2px_8px_rgba(36,83,58,0.4)]'
                    : 'bg-[#0d1c17]/60 hover:bg-[#152a22]/70 text-[#9cb1a4] hover:text-[#dbe6df] border border-[#254234]/40'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                    active ? 'bg-[#3b7a57] text-[#e8f5ee]' : 'bg-[#152b21] text-[#71887b]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Sort, Pinned, View Toggle */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 focus-within:border-[#52936e] transition-colors">
            <Search className="w-3.5 h-3.5 text-[#6c8677]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search recipes..."
              className="bg-transparent text-xs text-[#e6ede8] placeholder-[#5f7468] outline-none w-28 md:w-36 font-sans"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 text-xs text-[#b0c4b8]">
            <SlidersHorizontal className="w-3 h-3 text-[#6c8677]" />
            <select
              value={sortMode}
              onChange={(e) => onSortChange(e.target.value as CraftingSortMode)}
              className="bg-transparent text-xs text-[#dbe6df] outline-none cursor-pointer pr-1"
            >
              <option value="default" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Default</option>
              <option value="name" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Name A-Z</option>
              <option value="tier" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Tier Level</option>
              <option value="craftable" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Ready to Craft</option>
            </select>
          </div>

          {/* Pinned / Favorites Filter */}
          <button
            type="button"
            onClick={onToggleOnlyPinned}
            title={onlyPinned ? 'Show all recipes' : 'Show only pinned recipes'}
            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
              onlyPinned
                ? 'bg-[#b45309]/30 border-[#f59e0b] text-[#fbbf24]'
                : 'bg-[#0a1512]/90 border-[#284838]/60 text-[#6c8677] hover:text-[#dbe6df]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* View Mode (Grid vs List) */}
          <button
            type="button"
            onClick={onToggleViewMode}
            title={viewMode === 'grid' ? 'Switch to List view' : 'Switch to Grid view'}
            className="p-1.5 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 text-[#8aa394] hover:text-[#dbe6df] transition-colors cursor-pointer"
          >
            {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
