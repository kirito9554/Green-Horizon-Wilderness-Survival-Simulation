import React from 'react';
import { Search, LayoutGrid, List, CheckCircle2, HelpCircle } from 'lucide-react';
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
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 p-2 border-b border-[#34483a] bg-[#081914] space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_125px_36px] gap-2">
          <label className="h-9 flex items-center gap-2 px-2.5 border border-[#30483a] bg-[#071611] rounded-[4px]"><Search className="w-4 h-4 text-[#aa966e]" /><input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search research candidates..." className="min-w-0 flex-1 bg-transparent outline-none text-[11px] text-[#e6dfcf] placeholder:text-[#776d5d]" /></label>
          <select value={sortMode} onChange={(e) => onSortChange(e.target.value as 'progress' | 'name' | 'category')} className="h-9 px-2 border border-[#30483a] bg-[#071611] rounded-[4px] text-[10.5px] text-[#ded7c7] outline-none cursor-pointer"><option value="progress">Sort: Progress</option><option value="name">Sort: Name</option><option value="category">Sort: Category</option></select>
          <button type="button" onClick={onToggleViewMode} className="h-9 border border-[#30483a] bg-[#071611] rounded-[4px] flex items-center justify-center text-[#c9baa0] cursor-pointer">{viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">{STATUS_FILTERS.map((filter) => <button key={filter.id} type="button" onClick={() => onStatusFilterChange(filter.id)} className={`h-8 rounded-[4px] border text-[9.5px] font-bold truncate px-1 cursor-pointer ${statusFilter === filter.id ? 'bg-[#4a5423] border-[#ddd04b] text-[#fff6c6]' : 'bg-[#0b211a] border-[#2e4638] text-[#a8aa99]'}`}>{filter.label}</button>)}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
        {candidates.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#7b897d]"><HelpCircle className="w-8 h-8" /><span className="mt-2 text-[11px]">No research candidates found.</span></div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-4 gap-2 auto-rows-[132px] content-start">
            {candidates.map((candidate) => {
              const selected = candidate.id === selectedCandidateId;
              const ready = candidate.progressPct >= candidate.minDiscoveryRequiredPct;
              return <button key={candidate.id} type="button" onClick={() => onSelectCandidate(candidate)} className={`relative p-1.5 border rounded-[5px] flex flex-col items-center justify-between cursor-pointer ${selected ? 'bg-[#2c321b] border-[#e0d24c] shadow-[0_0_10px_rgba(225,211,75,.2)]' : 'bg-[#0a1d17] border-[#324a3b] hover:border-[#617159]'}`}>
                {ready && <CheckCircle2 className="absolute right-1.5 top-1.5 w-3.5 h-3.5 text-[#78d75f]" />}
                <div className="w-16 h-16 flex items-center justify-center"><CraftedItemArt itemId={candidate.id} recipeId={candidate.id} size={54} /></div>
                <div className="w-full text-center"><div className="text-[10px] font-bold text-[#eee7d7] truncate">{candidate.name}</div><div className="mt-1 flex items-center gap-1"><div className="h-1.5 flex-1 bg-[#1b281f] overflow-hidden"><div className={`h-full ${ready ? 'bg-[#6fcd59]' : 'bg-[#d1ae41]'}`} style={{ width: `${candidate.progressPct}%` }} /></div><span className={`text-[9px] font-bold ${ready ? 'text-[#79d761]' : 'text-[#dec251]'}`}>{candidate.progressPct}%</span></div></div>
              </button>;
            })}
          </div>
        ) : (
          <div className="space-y-1.5">{candidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => onSelectCandidate(candidate)} className={`w-full h-[58px] px-2.5 border rounded-[4px] flex items-center gap-2 text-left cursor-pointer ${candidate.id === selectedCandidateId ? 'bg-[#2c321b] border-[#e0d24c]' : 'bg-[#0a1d17] border-[#324a3b]'}`}><CraftedItemArt itemId={candidate.id} recipeId={candidate.id} size={38} /><div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-[#eee7d7] truncate">{candidate.name}</div><div className="text-[9px] text-[#89968a]">{candidate.materialsDiscoveredCount}/{candidate.materialsRequiredTotal} materials</div></div><span className="text-[10px] font-bold text-[#dec251]">{candidate.progressPct}%</span></button>)}</div>
        )}
      </div>
    </div>
  );
};
