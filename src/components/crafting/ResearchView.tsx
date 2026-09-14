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
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('res_tanning_rack');
  const [statusFilter, setStatusFilter] = useState<ResearchStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'progress' | 'name' | 'category'>('progress');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [pinnedCandidateIds, setPinnedCandidateIds] = useState<string[]>(['res_tanning_rack']);
  const [queue, setQueue] = useState<ResearchQueueItem[]>(INITIAL_RESEARCH_QUEUE);
  const [recentDiscoveries, setRecentDiscoveries] = useState<RecentDiscovery[]>(INITIAL_RECENT_DISCOVERIES);
  const [knowledgePoints, setKnowledgePoints] = useState(12);

  // Active candidate
  const activeCandidate = candidates.find((c) => c.id === selectedCandidateId) || candidates[0] || null;

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    // Status filter
    if (statusFilter === 'not_researched' && c.progressPct > 0) return false;
    if (statusFilter === 'partially_discovered' && (c.progressPct === 0 || c.progressPct >= c.minDiscoveryRequiredPct)) return false;
    if (statusFilter === 'ready' && c.progressPct < c.minDiscoveryRequiredPct) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCat = c.category.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      const matchMat = c.materialsAnalysis.some((m) => m.name.toLowerCase().includes(q));
      if (!matchName && !matchCat && !matchDesc && !matchMat) return false;
    }

    return true;
  });

  // Sort candidates
  filteredCandidates.sort((a, b) => {
    if (sortMode === 'progress') return b.progressPct - a.progressPct;
    if (sortMode === 'name') return a.name.localeCompare(b.name);
    if (sortMode === 'category') return a.category.localeCompare(b.category);
    return 0;
  });

  // Countdown timer effect for research queue
  useEffect(() => {
    const timer = setInterval(() => {
      setQueue((prevQueue) => {
        if (prevQueue.length === 0) return prevQueue;

        let changed = false;
        const newQueue = prevQueue.map((item, idx) => {
          if (idx === 0 && item.remainingSeconds > 0) {
            changed = true;
            const updatedSecs = item.remainingSeconds - 1;
            const updatedPct = Math.min(100, Math.round(((item.totalSeconds - updatedSecs) / item.totalSeconds) * 100));
            return {
              ...item,
              remainingSeconds: updatedSecs,
              progressPct: updatedPct,
            };
          }
          return item;
        });

        // If completed
        if (newQueue[0] && newQueue[0].remainingSeconds <= 0) {
          const completedItem = newQueue[0];
          // Mark candidate as researched
          setCandidates((prevC) =>
            prevC.map((c) => (c.id === completedItem.candidateId ? { ...c, isResearched: true, progressPct: 100 } : c))
          );
          // Add to recent discoveries
          setRecentDiscoveries((prev) => [
            { id: `disc_${Date.now()}`, name: completedItem.name, type: 'unlocked', timeAgo: 'Just now' },
            ...prev.slice(0, 5),
          ]);
          setKnowledgePoints((prev) => prev + 5);
          if (onUnlockRecipe) onUnlockRecipe(completedItem.candidateId);
          return newQueue.slice(1);
        }

        return changed ? newQueue : prevQueue;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onUnlockRecipe]);

  // Handlers
  const handleStartResearch = (c: ResearchCandidate) => {
    if (queue.length >= 3) return;
    if (queue.some((q) => q.candidateId === c.id)) return;

    const totalSecs = c.researchTimeSeconds;
    const newItem: ResearchQueueItem = {
      id: `rq_${Date.now()}`,
      candidateId: c.id,
      name: c.name,
      progressPct: c.progressPct,
      remainingSeconds: Math.max(10, Math.round(totalSecs * (1 - c.progressPct / 100))),
      totalSeconds: totalSecs,
      status: 'in_progress',
    };

    setQueue((prev) => [...prev, newItem]);
  };

  const handleToggleTrack = (c: ResearchCandidate) => {
    setCandidates((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, isTracking: !item.isTracking } : item))
    );
  };

  const handleAnalyze = (c: ResearchCandidate) => {
    // Reveal one undiscovered material if any
    setCandidates((prev) =>
      prev.map((item) => {
        if (item.id !== c.id) return item;
        const undiscovered = item.materialsAnalysis.filter((m) => !m.discovered);
        if (undiscovered.length === 0) return item;

        const target = undiscovered[0];
        const newAnalysis = item.materialsAnalysis.map((m) =>
          m.name === target.name ? { ...m, discovered: true } : m
        );
        const newCount = newAnalysis.filter((m) => m.discovered).length;
        const newPct = Math.round((newCount / item.materialsRequiredTotal) * 100);

        // Add discovery
        setRecentDiscoveries((d) => [
          { id: `disc_${Date.now()}`, name: target.name, type: 'material_identified', timeAgo: 'Just now' },
          ...d.slice(0, 5),
        ]);

        return {
          ...item,
          materialsAnalysis: newAnalysis,
          materialsDiscoveredCount: newCount,
          progressPct: newPct,
        };
      })
    );
  };

  const handleToggleFavorite = () => {
    if (!activeCandidate) return;
    setPinnedCandidateIds((prev) =>
      prev.includes(activeCandidate.id)
        ? prev.filter((id) => id !== activeCandidate.id)
        : [...prev, activeCandidate.id]
    );
  };

  const handleCancelQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handleMoveUpQueueItem = (id: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const isFavorited = activeCandidate ? pinnedCandidateIds.includes(activeCandidate.id) : false;
  const canStartResearch = activeCandidate ? activeCandidate.progressPct >= activeCandidate.minDiscoveryRequiredPct && !queue.some((q) => q.candidateId === activeCandidate.id) : false;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 3-Column Core Layout matching Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left Column: Candidates Grid (5 cols on lg) */}
        <div className="lg:col-span-4 xl:col-span-5 flex flex-col min-h-0">
          <ResearchCandidateGrid
            candidates={filteredCandidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortMode={sortMode}
            onSortChange={setSortMode}
            viewMode={viewMode}
            onToggleViewMode={() => setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))}
          />
        </div>

        {/* Center Column: Candidate Detail Card (4 cols on lg) */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col min-h-0">
          <ResearchDetailCard
            candidate={activeCandidate}
            onStartResearch={handleStartResearch}
            onToggleTrack={handleToggleTrack}
            onAnalyze={handleAnalyze}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
            canStartResearch={canStartResearch}
          />
        </div>

        {/* Right Column: Research Info, Queue & Tips (4 or 3 cols on lg) */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col min-h-0">
          <ResearchSidebar
            knowledgePoints={knowledgePoints}
            recipesDiscoveredCount={candidates.filter((c) => c.isResearched).length + 28}
            maxRecipesDiscovered={52}
            materialsIdentifiedCount={41}
            maxMaterialsIdentified={78}
            researchSpeedBonusPct={10}
            queue={queue}
            maxQueueSlots={3}
            onCancelQueueItem={handleCancelQueueItem}
            onMoveUpQueueItem={handleMoveUpQueueItem}
            onAddToQueueClick={() => {
              if (activeCandidate && canStartResearch) {
                handleStartResearch(activeCandidate);
              }
            }}
          />
        </div>
      </div>

      {/* Bottom Bar: Recent Discoveries */}
      <ResearchRecentDiscoveries
        discoveries={recentDiscoveries}
        onViewAll={() => setStatusFilter('all')}
      />
    </div>
  );
};
