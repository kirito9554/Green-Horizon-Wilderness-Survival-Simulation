import React, { useState, useEffect } from 'react';
import {
  ArrowUpCircle,
  Sparkles,
  CheckCircle2,
  Clock3,
  Search,
  Check,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  Shield,
  Layers,
  History,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  TieredUpgradeItem,
  UpgradeCategoryFilter,
  UpgradeQueueItem,
  UpgradeHistoryItem,
} from '../../types/crafting';
import {
  INITIAL_TIERED_UPGRADE_ITEMS,
  INITIAL_UPGRADE_QUEUE_ITEMS,
  INITIAL_UPGRADE_HISTORY_ITEMS,
} from '../../data/upgradeData';
import { CraftedItemArt } from './CraftedItemArt';

const CATEGORIES: Array<{ id: UpgradeCategoryFilter; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'weapons', label: 'WEAPONS' },
  { id: 'equipment', label: 'EQUIPMENT' },
  { id: 'utility', label: 'STRUCTURES' as any },
];

export const UpgradeView: React.FC = () => {
  const [items, setItems] = useState<TieredUpgradeItem[]>(INITIAL_TIERED_UPGRADE_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState<string>('upg_stone_knife');
  const [categoryFilter, setCategoryFilter] = useState<UpgradeCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<UpgradeQueueItem[]>(INITIAL_UPGRADE_QUEUE_ITEMS);
  const [history, setHistory] = useState<UpgradeHistoryItem[]>(INITIAL_UPGRADE_HISTORY_ITEMS);

  const activeItem = items.find((i) => i.id === selectedItemId) || items[0];

  // Filter items
  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setQueue((prevQueue) => {
        if (prevQueue.length === 0) return prevQueue;

        let changed = false;
        const newQueue = prevQueue.map((item, idx) => {
          if (idx === 0 && item.remainingSeconds > 0) {
            changed = true;
            return {
              ...item,
              remainingSeconds: item.remainingSeconds - 1,
            };
          }
          return item;
        });

        if (newQueue[0] && newQueue[0].remainingSeconds <= 0) {
          const completed = newQueue[0];
          setHistory((prev) => [
            {
              id: `uh_${Date.now()}`,
              fromName: completed.name,
              toName: `${completed.name} ${completed.targetTierLabel}`,
              timeAgo: 'Just now',
            },
            ...prev.slice(0, 4),
          ]);
          return newQueue.slice(1);
        }

        return changed ? newQueue : prevQueue;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleStartUpgrade = () => {
    if (!activeItem) return;
    const nextTierStep = activeItem.tierSteps.find((s) => s.tier === activeItem.currentTier + 1);
    const targetLabel = nextTierStep ? nextTierStep.tierLabel : `Tier ${activeItem.currentTier + 1}`;

    const newQueueItem: UpgradeQueueItem = {
      id: `uq_${Date.now()}`,
      itemId: activeItem.id,
      name: activeItem.name,
      targetTierLabel: targetLabel,
      remainingSeconds: 300,
      totalSeconds: 300,
      status: 'in_progress',
    };

    setQueue((prev) => [...prev, newQueueItem]);
  };

  const handleCancelQueue = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `00:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 h-full select-none overflow-hidden">
      {/* 3-Column Core Layout matching Image 4 */}
      <div className="grid grid-cols-12 gap-2.5 flex-1 min-h-0 overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: UPGRADEABLE EQUIPMENT CATALOG (4 cols)                       */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-4 flex flex-col min-h-0 bg-[#07130f]/60 rounded-xl border border-[#1d3a2b]/70 p-2.5 shadow-inner">
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer uppercase ${
                  categoryFilter === cat.id
                    ? 'bg-[#1b3d4f] text-[#38bdf8] border border-[#235873]'
                    : 'bg-[#0d1f18]/80 text-[#859e90] hover:text-[#e2eee6] border border-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative my-1.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b8577]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search upgradeable gear..."
              className="w-full pl-8 pr-3 py-1 text-xs bg-[#091511] border border-[#214232] rounded text-[#d6ded9] placeholder-[#5a7365] focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          {/* 4x4 Item Grid */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410]">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`flex flex-col items-center justify-between p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#123142] to-[#0c202b] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.3)] ring-1 ring-[#38bdf8]'
                        : 'bg-[#0a1813]/80 hover:bg-[#11241d] border-[#1d3a2b] text-[#9bb3a5]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded bg-[#132c20] border border-[#234b37] flex items-center justify-center mb-1">
                      <CraftedItemArt itemId="" recipeId="" size={24} />
                    </div>
                    <span className="text-[11px] font-bold text-[#e6ede8] truncate w-full">
                      {item.name}
                    </span>

                    {/* Tier Indicator Dots */}
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-[#38bdf8]">
                      {Array.from({ length: item.maxTier }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full ${
                            idx < item.currentTier
                              ? 'bg-[#38bdf8]'
                              : 'bg-[#1b3d4f] border border-[#254f63]'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER COLUMN: UPGRADE PATH & STAT COMPARISON (5 cols)                    */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0 bg-gradient-to-b from-[#11231c]/95 via-[#0c1a14]/95 to-[#08130f]/98 rounded-xl border border-[#274b39]/80 p-3 shadow-xl overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410]">
          {/* Header */}
          <div className="flex items-start justify-between pb-2 border-b border-[#224434]">
            <div className="flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-lg bg-[#0f261c] border border-[#2b543e] flex items-center justify-center">
                <CraftedItemArt itemId="" recipeId="" size={36} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-wider text-[#f5ede0] uppercase font-serif">
                  {activeItem.name}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {activeItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#173024] text-[#86efac] uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#718d7d] uppercase font-semibold">CURRENT TIER</span>
              <div className="text-sm font-black font-mono text-[#38bdf8]">
                Tier {activeItem.currentTier}
              </div>
            </div>
          </div>

          {/* Description & Quote */}
          <p className="text-[11px] text-[#a0b8aa] my-1.5 leading-relaxed">
            {activeItem.description}
          </p>
          {activeItem.quote && (
            <p className="text-[10.5px] italic text-[#d4af37] bg-[#1a1708]/60 px-2 py-1 rounded border border-[#6b581c]/50 mb-1.5">
              {activeItem.quote}
            </p>
          )}

          {/* Upgrade Path 4-Step Chain */}
          <div className="my-1.5 space-y-1">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              UPGRADE PATH
            </span>
            <div className="grid grid-cols-4 gap-1">
              {activeItem.tierSteps.map((step, idx) => (
                <div
                  key={step.tier}
                  className={`p-1.5 rounded border text-center relative ${
                    step.isCurrent
                      ? 'bg-[#1b3d4f] border-[#38bdf8] text-[#e0f2fe]'
                      : step.isUnlocked
                      ? 'bg-[#0f241a] border-[#25503b] text-[#c0d6c9]'
                      : 'bg-[#08120e] border-[#162920] text-[#55695f] opacity-60'
                  }`}
                >
                  <div className="text-[9px] font-bold font-mono text-[#38bdf8]">
                    {step.tierLabel}
                  </div>
                  <div className="text-[9.5px] font-semibold truncate mt-0.5">
                    {step.name}
                  </div>
                  {step.isCurrent && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#38bdf8] mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stat Comparison Table */}
          <div className="my-1.5 space-y-1">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              STAT COMPARISON
            </span>
            <div className="rounded-lg bg-[#07130f] border border-[#1d3d2e] overflow-hidden">
              <table className="w-full text-left text-[10.5px]">
                <thead>
                  <tr className="border-b border-[#1d3d2e] bg-[#0c1c16] text-[#7ea08d] text-[9.5px] uppercase font-bold">
                    <th className="py-1 px-2">Stat</th>
                    <th className="py-1 px-2">Tier {activeItem.currentTier}</th>
                    <th className="py-1 px-2 text-[#38bdf8]">Tier {activeItem.currentTier + 1}</th>
                    <th className="py-1 px-2 text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#152e22]">
                  {activeItem.statComparisons.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#0a1813]">
                      <td className="py-1 px-2 text-[#d1dfd7] font-medium">{row.label}</td>
                      <td className="py-1 px-2 text-[#9bb3a5] font-mono">{row.currentValue}</td>
                      <td className="py-1 px-2 text-[#e0f2fe] font-mono font-bold">
                        {row.nextValue}
                      </td>
                      <td
                        className={`py-1 px-2 text-right font-mono font-bold ${
                          row.isPositive === true
                            ? 'text-[#4ade80]'
                            : row.isPositive === false
                            ? 'text-[#f87171]'
                            : 'text-[#6e8779]'
                        }`}
                      >
                        {row.changeText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Required Materials & Requirements */}
          <div className="grid grid-cols-2 gap-2 my-1.5">
            {/* Required Materials */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
                REQUIRED MATERIALS
              </span>
              <div className="space-y-1">
                {activeItem.requiredMaterials.map((mat) => {
                  const isSufficient = mat.owned >= mat.needed;
                  return (
                    <div
                      key={mat.itemId}
                      className="flex items-center justify-between p-1 rounded bg-[#091712] border border-[#1a382a] text-[10px]"
                    >
                      <span className="text-[#dbe6df] truncate">{mat.name}</span>
                      <span
                        className={`font-mono font-bold shrink-0 ${
                          isSufficient ? 'text-[#4ade80]' : 'text-[#f87171]'
                        }`}
                      >
                        {mat.owned} / {mat.needed}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upgrade Requirements */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
                REQUIREMENTS
              </span>
              <div className="space-y-1">
                {activeItem.requirements.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-1.5 p-1 rounded bg-[#091712] border border-[#1a382a] text-[10px] text-[#cde0d5]"
                  >
                    <CheckCircle2 className="w-3 h-3 text-[#4ade80] shrink-0" />
                    <span className="truncate">{req.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={handleStartUpgrade}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:from-[#0369a1] hover:to-[#0ea5e9] text-[#082f49] font-black tracking-widest text-xs uppercase shadow-[0_0_15px_rgba(56,189,248,0.4)] border border-[#7dd3fc] cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Upgrade to Tier {activeItem.currentTier + 1}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: UPGRADE INFO, QUEUE & HISTORY (3 cols)                      */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0 bg-gradient-to-b from-[#11231c]/95 via-[#0c1a14]/95 to-[#08130f]/98 rounded-xl border border-[#274b39]/80 p-3 shadow-xl overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410]">
          {/* Upgrade Info */}
          <div className="space-y-1.5 pb-2 border-b border-[#1f3f2f]">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              UPGRADE INFO
            </span>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Total Items:</span>
                <strong className="text-[#e0f2fe] font-mono">12 / 24</strong>
              </div>
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Upgrades Unlocked:</span>
                <strong className="text-[#38bdf8] font-mono">8 / 32</strong>
              </div>
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Average Item Level:</span>
                <strong className="text-[#fbbf24] font-mono">1.6</strong>
              </div>
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Success Rate:</span>
                <strong className="text-[#4ade80] font-mono">100%</strong>
              </div>
            </div>
          </div>

          {/* Upgrade Queue */}
          <div className="space-y-1.5 pb-2 border-b border-[#1f3f2f]">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              <span>UPGRADE QUEUE ({queue.length}/3)</span>
            </div>

            {queue.length === 0 ? (
              <div className="text-[10px] text-[#607769] text-center p-2 rounded bg-[#07130f]/40 italic">
                Queue is empty
              </div>
            ) : (
              <div className="space-y-1.5">
                {queue.map((q) => (
                  <div
                    key={q.id}
                    className="p-2 rounded bg-[#081711] border border-[#1e402f] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#f0fdf4] truncate">{q.name}</span>
                      <button
                        type="button"
                        onClick={() => handleCancelQueue(q.id)}
                        className="text-[#f87171] hover:text-[#ef4444] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#38bdf8] font-mono">
                      <span>{q.targetTierLabel}</span>
                      <span>{formatSeconds(q.remainingSeconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upgrade History */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              UPGRADE HISTORY
            </span>
            <div className="space-y-1">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-[10px] text-[#7ea08d]"
                >
                  <span className="truncate max-w-[130px] text-[#b3ccbf]">
                    {h.fromName} → {h.toName}
                  </span>
                  <span className="text-[9.5px] text-[#577564]">{h.timeAgo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
