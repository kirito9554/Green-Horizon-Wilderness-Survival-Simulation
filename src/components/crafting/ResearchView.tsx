import React, { useState, useEffect } from 'react';
import {
  ResearchCandidate,
  ResearchStatusFilter,
  ResearchQueueItem,
  RecentDiscovery,
} from '../../types/crafting';
import {
  INITIAL_RESEARCH_CANDIDATES,
  INITIAL_RECENT_DISCOVERIES,
  INITIAL_RESEARCH_QUEUE,
} from '../../data/researchData';
import { ResearchCandidateGrid } from './ResearchCandidateGrid';
import { ResearchDetailCard } from './ResearchDetailCard';
import { ResearchSidebar } from './ResearchSidebar';
import { ResearchRecentDiscoveries } from './ResearchRecentDiscoveries';

interface ResearchViewProps {
  onUnlockRecipe?: (recipeId: string) => void;
}

export const ResearchView: React.FC<ResearchViewProps> = ({ onUnlockRecipe }) => {
  const [candidates, setCandidates] = useState<ResearchCandidate[]>(INITIAL_RESEARCH_CANDIDATES);
  const [selectedCandidateId, setSelectedCandidateId] = useState('res_tanning_rack');
  const [statusFilter, setStatusFilter] = useState<ResearchStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'progress' | 'name' | 'category'>('progress');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [pinnedCandidateIds, setPinnedCandidateIds] = useState<string[]>(['res_tanning_rack']);
  const [queue, setQueue] = useState<ResearchQueueItem[]>(INITIAL_RESEARCH_QUEUE);
  const [recentDiscoveries, setRecentDiscoveries] = useState<RecentDiscovery[]>(INITIAL_RECENT_DISCOVERIES);
  const [knowledgePoints, setKnowledgePoints] = useState(12);

  const activeCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) || candidates[0] || null;

  const filteredCandidates = candidates
    .filter((candidate) => {
      if (statusFilter === 'not_researched' && candidate.progressPct > 0) return false;
      if (statusFilter === 'partially_discovered' && (candidate.progressPct === 0 || candidate.progressPct >= candidate.minDiscoveryRequiredPct)) return false;
      if (statusFilter === 'ready' && candidate.progressPct < candidate.minDiscoveryRequiredPct) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return candidate.name.toLowerCase().includes(query)
          || candidate.category.toLowerCase().includes(query)
          || candidate.description.toLowerCase().includes(query)
          || candidate.materialsAnalysis.some((material) => material.name.toLowerCase().includes(query));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'progress') return b.progressPct - a.progressPct;
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQueue((previous) => {
        if (previous.length === 0) return previous;
        const next = previous.map((item, index) => {
          if (index !== 0 || item.remainingSeconds <= 0) return item;
          const remainingSeconds = item.remainingSeconds - 1;
          return {
            ...item,
            remainingSeconds,
            progressPct: Math.min(100, Math.round(((item.totalSeconds - remainingSeconds) / item.totalSeconds) * 100)),
          };
        });
        if (next[0] && next[0].remainingSeconds <= 0) {
          const completed = next[0];
          setCandidates((items) => items.map((candidate) => candidate.id === completed.candidateId ? { ...candidate, isResearched: true, progressPct: 100 } : candidate));
          setRecentDiscoveries((items) => [{ id: `disc_${Date.now()}`, name: completed.name, type: 'unlocked', timeAgo: 'Just now' }, ...items.slice(0, 5)]);
          setKnowledgePoints((points) => points + 5);
          onUnlockRecipe?.(completed.candidateId);
          return next.slice(1);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onUnlockRecipe]);

  const handleStartResearch = (candidate: ResearchCandidate) => {
    if (queue.length >= 3 || queue.some((item) => item.candidateId === candidate.id)) return;
    const totalSeconds = candidate.researchTimeSeconds;
    setQueue((previous) => [...previous, {
      id: `rq_${Date.now()}`,
      candidateId: candidate.id,
      name: candidate.name,
      progressPct: candidate.progressPct,
      remainingSeconds: Math.max(10, Math.round(totalSeconds * (1 - candidate.progressPct / 100))),
      totalSeconds,
      status: 'in_progress',
    }]);
  };

  const handleAnalyze = (candidate: ResearchCandidate) => {
    setCandidates((previous) => previous.map((item) => {
      if (item.id !== candidate.id) return item;
      const target = item.materialsAnalysis.find((material) => !material.discovered);
      if (!target) return item;
      const materialsAnalysis = item.materialsAnalysis.map((material) => material.name === target.name ? { ...material, discovered: true } : material);
      const materialsDiscoveredCount = materialsAnalysis.filter((material) => material.discovered).length;
      setRecentDiscoveries((entries) => [{ id: `disc_${Date.now()}`, name: target.name, type: 'material_identified', timeAgo: 'Just now' }, ...entries.slice(0, 5)]);
      return {
        ...item,
        materialsAnalysis,
        materialsDiscoveredCount,
        progressPct: Math.round((materialsDiscoveredCount / item.materialsRequiredTotal) * 100),
      };
    }));
  };

  const isFavorited = !!activeCandidate && pinnedCandidateIds.includes(activeCandidate.id);
  const canStartResearch = !!activeCandidate
    && activeCandidate.progressPct >= activeCandidate.minDiscoveryRequiredPct
    && !queue.some((item) => item.candidateId === activeCandidate.id);

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
            onToggleViewMode={() => setViewMode((previous) => previous === 'grid' ? 'list' : 'grid')}
          />
        </section>

        <section className="min-w-0 min-h-0 border border-[#40503d] bg-[#071711] overflow-hidden">
          <ResearchDetailCard
            candidate={activeCandidate}
            onStartResearch={handleStartResearch}
            onToggleTrack={(candidate) => setCandidates((items) => items.map((item) => item.id === candidate.id ? { ...item, isTracking: !item.isTracking } : item))}
            onAnalyze={handleAnalyze}
            isFavorited={isFavorited}
            onToggleFavorite={() => activeCandidate && setPinnedCandidateIds((previous) => previous.includes(activeCandidate.id) ? previous.filter((id) => id !== activeCandidate.id) : [...previous, activeCandidate.id])}
            canStartResearch={canStartResearch}
          />
        </section>

        <section className="min-w-0 min-h-0 border border-[#40503d] bg-[#071711] overflow-hidden">
          <ResearchSidebar
            knowledgePoints={knowledgePoints}
            recipesDiscoveredCount={candidates.filter((candidate) => candidate.isResearched).length + 28}
            maxRecipesDiscovered={52}
            materialsIdentifiedCount={41}
            maxMaterialsIdentified={78}
            researchSpeedBonusPct={10}
            queue={queue}
            maxQueueSlots={3}
            onCancelQueueItem={(id) => setQueue((items) => items.filter((item) => item.id !== id))}
            onMoveUpQueueItem={(id) => setQueue((items) => {
              const index = items.findIndex((item) => item.id === id);
              if (index <= 0) return items;
              const copy = [...items];
              [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
              return copy;
            })}
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
