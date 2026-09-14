import React from 'react';
import { BookOpen, Crosshair, Search, CheckCircle2, HelpCircle, Star, Sparkles, Clock } from 'lucide-react';
import { ResearchCandidate } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface ResearchDetailCardProps {
  candidate: ResearchCandidate | null;
  onStartResearch: (candidate: ResearchCandidate) => void;
  onToggleTrack: (candidate: ResearchCandidate) => void;
  onAnalyze: (candidate: ResearchCandidate) => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  canStartResearch: boolean;
}

export const ResearchDetailCard: React.FC<ResearchDetailCardProps> = ({
  candidate,
  onStartResearch,
  onToggleTrack,
  onAnalyze,
  isFavorited = false,
  onToggleFavorite,
  canStartResearch,
}) => {
  if (!candidate) {
    return <div className="h-full flex flex-col items-center justify-center text-[#7b897d]"><BookOpen className="w-10 h-10" /><span className="mt-2 text-[11px]">Select a research candidate.</span></div>;
  }

  const ready = candidate.progressPct >= candidate.minDiscoveryRequiredPct;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#071711]">
      <div className="h-[132px] shrink-0 p-3 border-b border-[#354a3b] bg-[#0a1d17] flex gap-3">
        <div className="w-[104px] h-[104px] shrink-0 border border-[#405747] bg-[#07130f] flex items-center justify-center"><CraftedItemArt itemId={candidate.id} recipeId={candidate.id} size={88} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><div><h2 className="text-[20px] font-black text-[#f1eadb] leading-none">{candidate.name}</h2><div className="mt-2 flex items-center gap-1.5"><span className="px-2 py-0.5 border border-[#537058] bg-[#0e3528] text-[9.5px] font-bold text-[#cce5d3]">{candidate.category}</span><span className="flex items-center gap-1 text-[9.5px] text-[#9aa396]"><Clock className="w-3 h-3" />{candidate.researchTimeSeconds}s</span></div></div>{onToggleFavorite && <button type="button" onClick={onToggleFavorite} className={`p-1.5 cursor-pointer ${isFavorited ? 'text-[#e7ca55]' : 'text-[#858d7e]'}`}><Star className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} /></button>}</div>
          <p className="mt-2 text-[11px] leading-[1.35] text-[#b9beb1] line-clamp-3">{candidate.description}</p>
        </div>
      </div>

      <div className="shrink-0 p-3 border-b border-[#34493b] bg-[#081914]">
        <div className="flex items-center justify-between"><span className="text-[11px] font-black text-[#e9e0ce] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#ddc954]" /> RESEARCH PROGRESS</span><strong className={`text-[22px] ${ready ? 'text-[#79d561]' : 'text-[#e0c351]'}`}>{candidate.progressPct}%</strong></div>
        <div className="mt-2 h-3 border border-[#304436] bg-[#17231d] overflow-hidden"><div className={`h-full ${ready ? 'bg-gradient-to-r from-[#4fae4b] to-[#8ade67]' : 'bg-gradient-to-r from-[#967b25] to-[#e3c349]'}`} style={{ width: `${candidate.progressPct}%` }} /></div>
        <div className="mt-2 flex items-center justify-between text-[10px]"><span className="text-[#a1a99d]">{candidate.materialsDiscoveredCount} / {candidate.materialsRequiredTotal} materials discovered</span><span className={ready ? 'text-[#7fdc65]' : 'text-[#d7bc4c]'}>{ready ? 'Requirement met ✓' : `Requires ${candidate.minDiscoveryRequiredPct}% to unlock`}</span></div>
      </div>

      <div className="min-h-0 flex-1 flex flex-col p-3 overflow-hidden">
        <div className="shrink-0 text-[11px] font-black text-[#e8dfcd] uppercase tracking-wide">Materials Analysis</div>
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar mt-2 space-y-1.5 pr-1">
          {candidate.materialsAnalysis.map((material, index) => <div key={`${material.name}-${index}`} className={`h-[46px] px-2.5 flex items-center gap-2 border ${material.discovered ? 'border-[#36503f] bg-[#0a1d17]' : 'border-[#493a32] bg-[#17130f]'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${material.discovered ? 'bg-[#17452f] text-[#76d960]' : 'bg-[#34241d] text-[#d27b58]'}`}>{material.discovered ? <CheckCircle2 className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}</div><div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold text-[#e7e1d4] truncate">{material.name}</div>{material.clue && <div className="text-[8.5px] text-[#7f8c80] truncate">{material.clue}</div>}</div><span className={`text-[9px] font-bold shrink-0 ${material.discovered ? 'text-[#78d961]' : 'text-[#d77c58]'}`}>{material.discovered ? 'Discovered' : 'Unknown'}</span></div>)}
        </div>

        <div className="shrink-0 grid grid-cols-[1.2fr_.75fr_.75fr] gap-2 mt-2.5 pt-2.5 border-t border-[#34493b]">
          <button type="button" onClick={() => onStartResearch(candidate)} disabled={!canStartResearch} className="h-11 rounded-[5px] border border-[#ddd14c] bg-gradient-to-b from-[#496326] to-[#264619] text-[#fff9d4] font-black text-[12px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"><BookOpen className="w-4 h-4" /> Start Research</button>
          <button type="button" onClick={() => onToggleTrack(candidate)} className={`h-11 rounded-[5px] border text-[11px] font-bold flex items-center justify-center gap-2 cursor-pointer ${candidate.isTracking ? 'bg-[#164333] border-[#5d8d6c] text-[#d4e8da]' : 'bg-[#0b211a] border-[#354b3c] text-[#c4c2b4]'}`}><Crosshair className="w-4 h-4" /> Track</button>
          <button type="button" onClick={() => onAnalyze(candidate)} className="h-11 rounded-[5px] border border-[#354b3c] bg-[#0b211a] text-[#c4c2b4] text-[11px] font-bold flex items-center justify-center gap-2 cursor-pointer"><Search className="w-4 h-4" /> Analyze</button>
        </div>
      </div>
    </div>
  );
};
