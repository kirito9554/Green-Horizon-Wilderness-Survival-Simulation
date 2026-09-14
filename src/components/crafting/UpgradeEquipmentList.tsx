import React from 'react';
import { Search, Wrench } from 'lucide-react';
import { UpgradeableTool, UpgradeCategoryFilter, InstalledModSlot } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface UpgradeEquipmentListProps {
  tools: UpgradeableTool[];
  selectedToolId: string;
  onSelectTool: (tool: UpgradeableTool) => void;
  categoryFilter: UpgradeCategoryFilter;
  onCategoryFilterChange: (cat: UpgradeCategoryFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const UPGRADE_CATEGORIES: Array<{ id: UpgradeCategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tools', label: 'Tools' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'utility', label: 'Utility' },
];

export const UpgradeEquipmentList: React.FC<UpgradeEquipmentListProps> = ({
  tools,
  selectedToolId,
  onSelectTool,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchChange,
}) => {
  const filteredTools = tools.filter((t) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full gap-2.5">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {UPGRADE_CATEGORIES.map((cat) => {
          const active = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryFilterChange(cat.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                active
                  ? 'bg-[#38bdf8]/20 border border-[#38bdf8] text-[#e0f2fe] shadow-[0_2px_8px_rgba(56,189,248,0.2)]'
                  : 'bg-[#0f2119]/70 hover:bg-[#152e23] border border-[#254636]/50 text-[#90a89a]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 focus-within:border-[#38bdf8] transition-colors">
        <Search className="w-3.5 h-3.5 text-[#6c8677]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search equipment..."
          className="bg-transparent text-xs text-[#e6ede8] placeholder-[#5f7468] outline-none w-full font-sans"
        />
      </div>

      {/* Grid of Equipment Cards */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-[360px] max-h-[520px]">
        {filteredTools.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center text-xs text-[#637d6e] p-4 rounded-lg bg-[#07130e]/40 border border-[#1b3628]">
            <Wrench className="w-6 h-6 text-[#4a6354] mb-2" />
            No equipment matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredTools.map((tool) => {
              const isSelected = tool.id === selectedToolId;
              const slotValues = Object.values(tool.slots) as InstalledModSlot[];
              const slotsCount = slotValues.length;
              const filledSlots = slotValues.filter((s) => s.tier > 0).length;

              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onSelectTool(tool)}
                  className={`group flex flex-col p-2.5 rounded-xl text-left transition-all duration-150 border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#102d3d] to-[#0a1c26] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                      : 'bg-[#0e1d17]/80 hover:bg-[#142820] border-[#223d30]/70 hover:border-[#385e4a]'
                  }`}
                >
                  <div className="w-full h-16 rounded-lg bg-[#07130e] border border-[#1b3327] flex items-center justify-center overflow-hidden mb-2 relative group-hover:scale-[1.02] transition-transform">
                    <CraftedItemArt itemId={tool.name} recipeId={tool.name} size={44} />
                  </div>

                  <h3 className="text-xs font-bold text-[#f5ede0] truncate group-hover:text-[#38bdf8] transition-colors">
                    {tool.name}
                  </h3>

                  {/* 4 Mod Pips under each card matching Image 3 */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {Array.from({ length: slotsCount }).map((_, idx) => {
                      const isFilled = idx < filledSlots;
                      return (
                        <span
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            isFilled ? 'bg-[#38bdf8] shadow-[0_0_4px_#38bdf8]' : 'bg-[#1b3629]'
                          }`}
                        />
                      );
                    })}
                    <span className="text-[9px] text-[#6f897b] font-mono ml-auto">
                      {filledSlots}/{slotsCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
