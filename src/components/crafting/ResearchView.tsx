import React, { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../../types';
import type { ResearchCandidate, ResearchStatusFilter } from '../../types/crafting';
import { RECIPES_DATABASE } from '../../data/recipes';
import {
  buildRecentResearchDiscoveries,
  buildResearchCandidates,
  buildResearchQueue,
  RESEARCH_EVIDENCE_THRESHOLD,
} from '../../simulation/researchSystem';
import { ResearchCandidateGrid } from './ResearchCandidateGrid';
import { ResearchDetailCard } from './ResearchDetailCard';
import { ResearchSidebar } from './ResearchSidebar';
import { ResearchRecentDiscoveries } from './ResearchRecentDiscoveries';

interface ResearchViewProps {
  state: GameState;
  onStartResearch?: (recipeId: string, survivorId: string) => void;
  onPauseResearch?: (recipeId: string) => void;
  onAnalyzeResearch?: (recipeId: string, survivorId?: string) => void;
  onToggleTrackResearch?: (recipeId: string) => void;
}

export const ResearchView: React.FC<ResearchViewProps> = ({
  state,
  onStartResearch,
  onPauseResearch,
  onAnalyzeResearch,
  onToggleTrackResearch,
}) => {
  const candidates = useMemo(() => buildResearchCandidates(state), [state]);
  const queue = useMemo(() => buildResearchQueue(state), [state]);
  const recentDiscoveries = useMemo(() => buildRecentResearchDiscoveries(state), [state]);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ResearchStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'progress' | 'name' | 'category'>('progress');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!selectedCandidateId || !candidates.some(candidate => candidate.id === selectedCandidateId)) {
      const tracked = candidates.find(candidate => candidate.isTracking && !candidate.isResearched);
      const ready = candidates.find(candidate => !candidate.isResearched && candidate.progressPct >= RESEARCH_EVIDENCE_THRESHOLD);
      const partial = candidates.find(candidate => !candidate.isResearched && candidate.progressPct > 0);
      const fallback = tracked || ready || partial || candidates[0];
      if (fallback) setSelectedCandidateId(fallback.id);
    }
  }, [candidates, selectedCandidateId]);

  const activeCandidate = candidates.find(candidate => candidate.id === selectedCandidateId) || candidates[0] || null;

  const filteredCandidates = candidates
    .filter(candidate => {
      if (statusFilter === 'not_researched' && (candidate.progressPct > 0 || candidate.isResearched)) return false;
      if (statusFilter === 'partially_discovered' && (candidate.progressPct === 0 || candidate.progressPct >= candidate.minDiscoveryRequiredPct || candidate.isResearched)) return false;
      if (statusFilter === 'ready' && (candidate.progressPct < candidate.minDiscoveryRequiredPct || candidate.isResearched)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return candidate.name.toLowerCase().includes(query)
          || candidate.category.toLowerCase().includes(query)
          || candidate.description.toLowerCase().includes(query)
          || candidate.materialsAnalysis.some(material => material.name.toLowerCase().includes(query));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'progress') return Number(a.isResearched) - Number(b.isResearched) || b.progressPct - a.progressPct;
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });

  const idleResearchers = state.survivors
    .filter(survivor => survivor.currentAction.type === 'idle')
    .sort((a, b) => {
      const scoreA = (a.skills.crafting || 1) * 0.7 + (a.skills.exploration || 1) * 0.3;
      const scoreB = (b.skills.crafting || 1) * 0.7 + (b.skills.exploration || 1) * 0.3;
      return scoreB - scoreA;
    });
  const preferredResearcher = idleResearchers[0];

  const activeResearchState = activeCandidate ? state.researches?.[activeCandidate.id] : undefined;
  const alreadyQueued = activeResearchState?.status === 'in_progress' || activeResearchState?.status === 'paused';
  const canStartResearch = Boolean(
    activeCandidate
    && !activeCandidate.isResearched
    && activeCandidate.progressPct >= activeCandidate.minDiscoveryRequiredPct
    && !alreadyQueued
    && preferredResearcher
  );

  const handleStartResearch = (candidate: ResearchCandidate) => {
    if (!preferredResearcher) return;
    onStartResearch?.(candidate.id, preferredResearcher.id);
  };

  const handleAnalyze = (candidate: ResearchCandidate) => {
    onAnalyzeResearch?.(candidate.id, preferredResearcher?.id);
  };

  const completedCount = Object.values(state.researches || {}).filter(research => research.status === 'completed').length;
  const allIngredientIds = new Set(
    Object.values(RECIPES_DATABASE)
      .filter(recipe => recipe.type === 'crafting')
      .flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.itemId))
  );
  const identifiedCount = state.researchSystem?.identifiedMaterialIds?.length || 0;
  const bestResearchSkill = state.survivors.reduce((best, survivor) => {
    const value = (survivor.skills.crafting || 1) * 0.7 + (survivor.skills.exploration || 1) * 0.3;
    return Math.max(best, value);
  }, 1);
  const speedBonusPct = Math.max(0, Math.round((bestResearchSkill - 1) * 9));

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#06130f]">
      <div className="min-h-0 flex-1 grid grid-cols-[1.04fr_1fr_.78fr] gap-2 overflow-hidden">
        <section className="min-w-0 min-h-0 border border-[#40503d] bg-[#071711] p-2 overflow-hidden">
          <ResearchCandidateGrid
            candidates={filteredCandidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={(candidate) => setSelectedCandidateId(candidate.id)}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortMode={sortMode}
            onSortChange={setSortMode}
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode(previous => previous === 'grid' ? 'list' : 'grid')}
          />
        </section>

        <section className="min-w-0 min-h-0 border border-[#40503d] bg-[#071711] overflow-hidden">
          <ResearchDetailCard
            candidate={activeCandidate}
            onStartResearch={handleStartResearch}
            onToggleTrack={(candidate) => onToggleTrackResearch?.(candidate.id)}
            onAnalyze={handleAnalyze}
            isFavorited={Boolean(activeCandidate?.isTracking)}
            onToggleFavorite={() => activeCandidate && onToggleTrackResearch?.(activeCandidate.id)}
            canStartResearch={canStartResearch}
          />
        </section>

        <section className="min-w-0 min-h-0 border border-[#40503d] bg-[#071711] overflow-hidden">
          <ResearchSidebar
            knowledgePoints={state.researchSystem?.knowledgePoints || 0}
            recipesDiscoveredCount={completedCount}
            maxRecipesDiscovered={candidates.length}
            materialsIdentifiedCount={identifiedCount}
            maxMaterialsIdentified={allIngredientIds.size}
            researchSpeedBonusPct={speedBonusPct}
            queue={queue}
            maxQueueSlots={Math.max(3, state.survivors.length)}
            onCancelQueueItem={(recipeId) => onPauseResearch?.(recipeId)}
            onMoveUpQueueItem={() => undefined}
            onAddToQueueClick={() => activeCandidate && canStartResearch && handleStartResearch(activeCandidate)}
          />
        </section>
      </div>

      <div className="h-[82px] shrink-0 mt-2 border border-[#40503d] bg-[#071711] overflow-hidden">
        <ResearchRecentDiscoveries discoveries={recentDiscoveries} onViewAll={() => setStatusFilter('all')} />
      </div>
    </div>
  );
};
