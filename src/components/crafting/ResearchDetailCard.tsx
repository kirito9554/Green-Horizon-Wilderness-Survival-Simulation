import React from 'react';
import {
  BookOpen,
  Crosshair,
  Search,
  CheckCircle2,
  HelpCircle,
  Star,
  Sparkles,
  Clock,
  Info,
} from 'lucide-react';
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
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[380px] p-6 text-center rounded-xl bg-[#091611]/80 border border-[#1d382b]/60">
        <BookOpen className="w-12 h-12 text-[#466352] mb-3" />
        <p className="text-sm font-semibold text-[#8fa799]">Select a blueprint to examine</p>
        <p className="text-xs text-[#5d7768] mt-1 max-w-xs">
          Analyze discovered natural resources to unlock advanced survival schematics.
        </p>
      </div>
    );
  }

  const isReady = candidate.progressPct >= candidate.minDiscoveryRequiredPct;

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#0a1712]/90 border border-[#264a38]/80 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
      {/* Top Banner / Illustration with Star */}
      <div className="relative w-full h-40 bg-gradient-to-b from-[#14281f] via-[#0d1d16] to-[#091510] border-b border-[#213f2f] flex items-center justify-center p-4">
        {/* Star Favorite Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            title={isFavorited ? 'Remove from pinned research' : 'Pin research'}
            className="absolute top-3 right-3 p-2 rounded-lg bg-[#06100c]/70 border border-[#274635] text-[#718d7c] hover:text-[#fbbf24] transition-colors cursor-pointer"
          >
            <Star
              className={`w-4 h-4 ${
                isFavorited ? 'text-[#fbbf24] fill-[#fbbf24]' : ''
              }`}
            />
          </button>
        )}

        {/* Category Pill */}
        <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded bg-[#162f22]/80 border border-[#2f5a43] text-[#7ce0a5] uppercase tracking-wider">
          {candidate.category}
        </span>

        {/* Big Illustration */}
        <div className="drop-shadow-[0_10px_16px_rgba(0,0,0,0.8)]">
          <CraftedItemArt itemId={candidate.id} recipeId={candidate.id} size={96} />
        </div>
      </div>

      {/* Main Info Body */}
      <div className="flex-1 flex flex-col p-4 gap-3.5 overflow-y-auto">
        {/* Title & Tags */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#f5ede0] font-serif tracking-wide">
              {candidate.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#a3b8aa]">
              <Clock className="w-3.5 h-3.5 text-[#5eead4]" />
              <span className="font-mono">{candidate.researchTimeSeconds}s</span>
            </div>
          </div>
          <p className="text-xs text-[#a6bcaf] mt-1.5 leading-relaxed">
            {candidate.description}
          </p>
        </div>

        {/* Progress Bar & Status */}
        <div className="p-3 rounded-lg bg-[#07130e]/90 border border-[#1d392b] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#a4bcaf]">Research Progress:</span>
            <span
              className={`font-mono font-bold ${
                isReady ? 'text-[#4ade80]' : 'text-[#fbbf24]'
              }`}
            >
              {candidate.progressPct}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#040a08] overflow-hidden border border-[#16291f]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isReady
                  ? 'bg-gradient-to-r from-[#22c55e] to-[#4ade80]'
                  : 'bg-gradient-to-r from-[#d97706] to-[#fbbf24]'
              }`}
              style={{ width: `${Math.min(100, candidate.progressPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#718b7c] mt-0.5">
            <span>
              {candidate.materialsDiscoveredCount} / {candidate.materialsRequiredTotal} materials discovered
            </span>
            <span
              className={`flex items-center gap-1 font-semibold ${
                isReady ? 'text-[#86efac]' : 'text-[#fbbf24]'
              }`}
            >
              {isReady ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-[#4ade80]" />
                  Requires 80% to unlock [✓]
                </>
              ) : (
                `Requires ${candidate.minDiscoveryRequiredPct}% to unlock`
              )}
            </span>
          </div>
        </div>

        {/* Materials Analysis List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#9bb3a4]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
              <span>MATERIALS ANALYSIS</span>
            </div>
            <span className="text-[10px] text-[#698574]">SURROUNDING EVIDENCE</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {candidate.materialsAnalysis.map((mat, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors ${
                  mat.discovered
                    ? 'bg-[#12241d]/70 border-[#264d38]/60 text-[#d8e6df]'
                    : 'bg-[#141a17]/60 border-[#242f29]/60 text-[#7d9186]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      mat.discovered
                        ? 'bg-[#1d4732] text-[#4ade80]'
                        : 'bg-[#212925] text-[#83948b]'
                    }`}
                  >
                    {mat.discovered ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <HelpCircle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold">{mat.name}</span>
                    {mat.clue && (
                      <span className="text-[10px] text-[#678272]">{mat.clue}</span>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    mat.discovered
                      ? 'bg-[#173e2a] text-[#86efac]'
                      : 'bg-[#1e2722] text-[#819489]'
                  }`}
                >
                  {mat.discovered ? 'Discovered ✓' : 'Unknown ?'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-[#1e382b]/60">
          {/* Start Research Button */}
          <button
            type="button"
            onClick={() => onStartResearch(candidate)}
            disabled={!canStartResearch}
            className={`col-span-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              canStartResearch
                ? 'bg-gradient-to-r from-[#15803d] to-[#166534] hover:from-[#16a34a] hover:to-[#15803d] text-[#f0fdf4] border border-[#4ade80] shadow-[0_0_12px_rgba(74,222,128,0.35)]'
                : 'bg-[#13231c]/60 text-[#60776a] border border-[#20392d]/50 cursor-not-allowed'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Start Research</span>
          </button>

          {/* Track Button */}
          <button
            type="button"
            onClick={() => onToggleTrack(candidate)}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border cursor-pointer ${
              candidate.isTracking
                ? 'bg-[#0369a1]/30 border-[#38bdf8] text-[#e0f2fe]'
                : 'bg-[#0e1e17]/80 hover:bg-[#14281f] border-[#294c39] text-[#9cb1a4] hover:text-[#e2eee6]'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>{candidate.isTracking ? 'Tracking' : 'Track'}</span>
          </button>

          {/* Analyze Button */}
          <button
            type="button"
            onClick={() => onAnalyze(candidate)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#0e1e17]/80 hover:bg-[#14281f] border border-[#294c39] text-[#9cb1a4] hover:text-[#fbbf24] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Analyze</span>
          </button>
        </div>
      </div>
    </div>
  );
};
