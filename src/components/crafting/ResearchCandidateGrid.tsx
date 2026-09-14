import React from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List, CheckCircle2, HelpCircle, Eye } from 'lucide-react';
import { ResearchCandidate, ResearchStatusFilter } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface ResearchCandidateGridProps {
  candidates: ResearchCandidate[];
  selectedCandidateId: string;
  onSelectCandidate: (candidate: ResearchCandidate) => void;
  statusFilter: ResearchStatusFilter;
  onStatusFilterChange: (filter: ResearchStatusFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortMode: 'progress' | 'name' | 'category';
  onSortChange: (sort: 'progress' | 'name' | 'category') => void;
  viewMode: 'grid' | 'list';
  onToggleViewMode: () => void;
}

const STATUS_FILTERS: Array<{ id: ResearchStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'not_researched', label: 'Not Researched' },
  { id: 'partially_discovered', label: 'Partially Discovered' },
  { id: 'ready', label: 'Ready to Research' },
];

export const ResearchCandidateGrid: React.FC<ResearchCandidateGridProps> = ({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  sortMode,
  onSortChange,
  viewMode,
  onToggleViewMode,
}) => {
  return (
    <div className="flex flex-col h-full gap-2.5">
      {/* Top Filter Bar: Status Pills + Search + Sort */}
      <div className="flex flex-col gap-2">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onStatusFilterChange(f.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  active
                    ? 'bg-[#fbbf24]/20 border border-[#fbbf24] text-[#fef3c7] shadow-[0_2px_8px_rgba(251,191,36,0.2)]'
                    : 'bg-[#0f2119]/70 hover:bg-[#152e23] border border-[#254636]/50 text-[#90a89a]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search, Sort, View Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 focus-within:border-[#fbbf24] transition-colors flex-1">
            <Search className="w-3.5 h-3.5 text-[#6c8677]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search research candidates..."
              className="bg-transparent text-xs text-[#e6ede8] placeholder-[#5f7468] outline-none w-full font-sans"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 text-xs text-[#b0c4b8]">
            <SlidersHorizontal className="w-3 h-3 text-[#6c8677]" />
            <select
              value={sortMode}
              onChange={(e) => onSortChange(e.target.value as 'progress' | 'name' | 'category')}
              className="bg-transparent text-xs text-[#dbe6df] outline-none cursor-pointer pr-1"
            >
              <option value="progress" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Progress</option>
              <option value="name" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Name A-Z</option>
              <option value="category" className="bg-[#0e1d17] text-[#dbe6df]">Sort: Category</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <button
            type="button"
            onClick={onToggleViewMode}
            title={viewMode === 'grid' ? 'Switch to List view' : 'Switch to Grid view'}
            className="p-1.5 rounded-md bg-[#0a1512]/90 border border-[#284838]/60 text-[#8aa394] hover:text-[#fbbf24] transition-colors cursor-pointer"
          >
            {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Grid or List of Candidates */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-[360px] max-h-[500px]">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4 rounded-lg bg-[#0b1813]/40 border border-[#1f382a]/50">
            <HelpCircle className="w-8 h-8 text-[#5c7365] mb-2" />
            <p className="text-sm font-semibold text-[#8fa799]">No research candidates found</p>
            <p className="text-xs text-[#637a6c] mt-1">Try adjusting your filters or search keyword</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {candidates.map((c) => {
              const isSelected = c.id === selectedCandidateId;
              const isReady = c.progressPct >= c.minDiscoveryRequiredPct;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCandidate(c)}
                  className={`group relative flex flex-col p-3 rounded-xl text-left transition-all duration-150 border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#2a2414] to-[#151c16] border-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                      : 'bg-[#0e1d17]/80 hover:bg-[#142820] border-[#223d30]/70 hover:border-[#385e4a]'
                  }`}
                >
                  {/* Ready or Tracking Badge */}
                  {isReady && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#15803d]/40 text-[#86efac] border border-[#22c55e]/50 uppercase">
                      <CheckCircle2 className="w-2.5 h-2.5 text-[#4ade80]" />
                      Ready
                    </span>
                  )}
                  {c.isTracking && !isReady && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0284c7]/40 text-[#7dd3fc] border border-[#38bdf8]/50 uppercase">
                      <Eye className="w-2.5 h-2.5 text-[#38bdf8]" />
                      Tracking
                    </span>
                  )}

                  {/* Art Thumbnail */}
                  <div className="w-full h-20 rounded-lg bg-[#07130e] border border-[#1b3327] flex items-center justify-center overflow-hidden mb-2 relative group-hover:scale-[1.02] transition-transform">
                    <CraftedItemArt itemId={c.id} recipeId={c.id} size={54} />
                    <span className="absolute bottom-1 left-1 text-[9px] font-mono font-bold px-1 rounded bg-[#000]/70 text-[#a3b8aa]">
                      {c.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-bold text-[#f5ede0] truncate group-hover:text-[#fbbf24] transition-colors">
                    {c.name}
                  </h3>

                  {/* Progress Bar */}
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#7d9788]">Discovered:</span>
                      <span className={`font-mono font-bold ${isReady ? 'text-[#4ade80]' : 'text-[#fbbf24]'}`}>
                        {c.progressPct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#0a1512] overflow-hidden border border-[#1f372a]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isReady
                            ? 'bg-gradient-to-r from-[#22c55e] to-[#4ade80]'
                            : 'bg-gradient-to-r from-[#d97706] to-[#fbbf24]'
                        }`}
                        style={{ width: `${Math.min(100, c.progressPct)}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col gap-2">
            {candidates.map((c) => {
              const isSelected = c.id === selectedCandidateId;
              const isReady = c.progressPct >= c.minDiscoveryRequiredPct;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCandidate(c)}
                  className={`flex items-center justify-between gap-3 p-2.5 rounded-lg text-left transition-all duration-150 border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#2a2414] to-[#151c16] border-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                      : 'bg-[#0e1d17]/80 hover:bg-[#142820] border-[#223d30]/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#07130e] border border-[#1b3327] flex items-center justify-center shrink-0">
                      <CraftedItemArt itemId={c.id} recipeId={c.id} size={30} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#f5ede0] group-hover:text-[#fbbf24]">
                        {c.name}
                      </h3>
                      <span className="text-[10px] text-[#7d9788]">{c.category} • {c.materialsDiscoveredCount}/{c.materialsRequiredTotal} Materials</span>
                    </div>
                  </div>

                  <div className="w-28 flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-mono font-bold ${isReady ? 'text-[#4ade80]' : 'text-[#fbbf24]'}`}>
                      {c.progressPct}% {isReady && '✓'}
                    </span>
                    <div className="w-full h-1.5 rounded-full bg-[#0a1512] overflow-hidden border border-[#1f372a]">
                      <div
                        className={`h-full rounded-full ${
                          isReady ? 'bg-[#4ade80]' : 'bg-[#fbbf24]'
                        }`}
                        style={{ width: `${c.progressPct}%` }}
                      />
                    </div>
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
