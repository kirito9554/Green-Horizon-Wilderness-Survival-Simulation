import React from 'react';
import { Search, LayoutGrid, List, Bookmark, Package, Hammer, Swords, Flame, Home, Soup, Cross, Boxes } from 'lucide-react';
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

const CATEGORY_ITEMS: Array<{
  id: CraftingCategoryFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'All', icon: Package },
  { id: 'tools', label: 'Tools', icon: Hammer },
  { id: 'weapons', label: 'Weapons', icon: Swords },
  { id: 'survival', label: 'Survival', icon: Flame },
  { id: 'shelter', label: 'Shelter', icon: Home },
  { id: 'food', label: 'Food', icon: Soup },
  { id: 'medicine', label: 'Medicine', icon: Cross },
  { id: 'utility', label: 'Utility', icon: Boxes },
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
}) => {
  return (
    <div className="shrink-0 px-2.5 pt-2 pb-2 border-b border-[#314939]/70 bg-[#071812]/80 select-none">
      <div className="grid grid-cols-8 gap-1.5">
        {CATEGORY_ITEMS.map((item) => {
          const active = category === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCategory(item.id)}
              title={`${item.label} (${categoryCounts[item.id] || 0})`}
              className={`h-10 px-2 rounded-[5px] border flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-b from-[#365b24] to-[#16381d] border-[#d9d34b] text-[#fffbd8] shadow-[0_0_10px_rgba(214,210,64,0.23)]'
                  : 'bg-[#0c2521] border-[#29463a] text-[#c7c1ab] hover:bg-[#10302a] hover:border-[#476250]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_132px_38px_38px] gap-2 mt-2">
        <label className="h-9 flex items-center gap-2 px-3 rounded-[5px] border border-[#2f4a3d] bg-[#081814] focus-within:border-[#c4c75c]">
          <Search className="w-4 h-4 text-[#b9aa7c] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search recipes..."
            className="min-w-0 flex-1 bg-transparent outline-none text-[12px] text-[#ebe5d4] placeholder:text-[#806f58]"
          />
        </label>

        <select
          value={sortMode}
          onChange={(e) => onSortChange(e.target.value as CraftingSortMode)}
          className="h-9 px-2 rounded-[5px] bg-[#0a1b17] border border-[#2f4a3d] text-[11px] text-[#e3dcc9] outline-none cursor-pointer"
        >
          <option value="default">Sort: Default</option>
          <option value="name">Sort: Name</option>
          <option value="tier">Sort: Tier</option>
          <option value="craftable">Sort: Ready</option>
        </select>

        <button
          type="button"
          onClick={onToggleOnlyPinned}
          title="Pinned recipes"
          className={`h-9 rounded-[5px] border flex items-center justify-center cursor-pointer ${
            onlyPinned
              ? 'bg-[#51430c] border-[#d5b13c] text-[#ffe079]'
              : 'bg-[#0a1b17] border-[#2f4a3d] text-[#9d9277] hover:text-[#e8d9aa]'
          }`}
        >
          <Bookmark className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleViewMode}
          title="Toggle grid/list view"
          className="h-9 rounded-[5px] border border-[#2f4a3d] bg-[#0a1b17] text-[#c7baa0] hover:text-white flex items-center justify-center cursor-pointer"
        >
          {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
