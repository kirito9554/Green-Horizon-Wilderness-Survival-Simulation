import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Plus,
  Trash2,
  Shield,
  Layers,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Bookmark,
  Check,
} from 'lucide-react';
import {
  RepairableItem,
  RepairCategoryFilter,
  RepairQueueItem,
  SparePartItem,
  MaintenanceHistoryItem,
} from '../../types/crafting';
import {
  INITIAL_REPAIRABLE_ITEMS,
  INITIAL_REPAIR_QUEUE,
  INITIAL_SPARE_PARTS,
  INITIAL_MAINTENANCE_HISTORY,
} from '../../data/repairData';
import { CraftedItemArt } from './CraftedItemArt';

const CATEGORIES: Array<{ id: RepairCategoryFilter; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'weapons', label: 'WEAPONS' },
  { id: 'equipment', label: 'EQUIPMENT' },
  { id: 'structures', label: 'STRUCTURES' },
];

export const RepairView: React.FC = () => {
  const [items, setItems] = useState<RepairableItem[]>(INITIAL_REPAIRABLE_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState<string>('repair_stone_knife');
  const [categoryFilter, setCategoryFilter] = useState<RepairCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<RepairQueueItem[]>(INITIAL_REPAIR_QUEUE);
  const [spareParts, setSpareParts] = useState<SparePartItem[]>(INITIAL_SPARE_PARTS);
  const [history, setHistory] = useState<MaintenanceHistoryItem[]>(INITIAL_MAINTENANCE_HISTORY);
  const [repairMode, setRepairMode] = useState<'repair' | 'replace' | 'patch' | 'inspect'>('repair');

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

  // Repair countdown timer
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
          // Restore item durability to 100%
          setItems((prevItems) =>
            prevItems.map((it) =>
              it.id === completed.itemId
                ? {
                    ...it,
                    durabilityPct: 100,
                    components: {
                      blade: { ...it.components.blade, conditionPct: 100, isDamaged: false, statusText: 'Pristine condition' },
                      handle: { ...it.components.handle, conditionPct: 100, isDamaged: false, statusText: 'Solid' },
                      binding: { ...it.components.binding, conditionPct: 100, isDamaged: false, statusText: 'Tight & new' },
                      grip: { ...it.components.grip, conditionPct: 100, isDamaged: false, statusText: 'Optimal hold' },
                    },
                    identifiedIssues: ['All components serviced and restored.'],
                  }
                : it
            )
          );
          setHistory((prev) => [
            {
              id: `mh_${Date.now()}`,
              itemName: completed.name,
              actionText: 'Full Overhaul Repaired',
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

  const handleStartRepair = () => {
    if (!activeItem) return;
    const newQueueItem: RepairQueueItem = {
      id: `rq_${Date.now()}`,
      itemId: activeItem.id,
      name: activeItem.name,
      detailText: 'Restoring damaged parts...',
      remainingSeconds: 60,
      totalSeconds: 60,
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
      {/* 3-Column Core Layout matching Image 3 */}
      <div className="grid grid-cols-12 gap-2.5 flex-1 min-h-0 overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: EQUIPMENT REPAIR CATALOG (4 cols)                            */}
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
                    ? 'bg-[#1b4332] text-[#86efac] border border-[#2d6a4f]'
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
              placeholder="Search repairable gear..."
              className="w-full pl-8 pr-3 py-1 text-xs bg-[#091511] border border-[#214232] rounded text-[#d6ded9] placeholder-[#5a7365] focus:outline-none focus:border-[#34d399]"
            />
          </div>

          {/* 4x4 Item Grid */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410]">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedItemId;
                const durColor =
                  item.durabilityPct > 70
                    ? 'text-[#4ade80] bg-[#166534]'
                    : item.durabilityPct >= 40
                    ? 'text-[#fbbf24] bg-[#854d0e]'
                    : 'text-[#f87171] bg-[#991b1b]';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`flex flex-col items-center justify-between p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#1b3d2e] to-[#0f281e] border-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.3)] ring-1 ring-[#34d399]'
                        : 'bg-[#0a1813]/80 hover:bg-[#11241d] border-[#1d3a2b] text-[#9bb3a5]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded bg-[#132c20] border border-[#234b37] flex items-center justify-center mb-1">
                      <CraftedItemArt itemId="" recipeId="" size={24} />
                    </div>
                    <span className="text-[11px] font-bold text-[#e6ede8] truncate w-full">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#a5c2b2] mt-0.5">
                      {item.durabilityPct}%
                    </span>

                    {/* Durability Bar */}
                    <div className="w-full h-1 bg-[#091712] rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full ${
                          item.durabilityPct > 70
                            ? 'bg-[#4ade80]'
                            : item.durabilityPct >= 40
                            ? 'bg-[#fbbf24]'
                            : 'bg-[#f87171]'
                        }`}
                        style={{ width: `${item.durabilityPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CENTER COLUMN: REPAIR BENCH & COMPONENT BREAKDOWN (5 cols)                */}
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
              <span className="text-[10px] text-[#718d7d] uppercase font-semibold">CONDITION</span>
              <div className="text-sm font-black font-mono text-[#fbbf24]">
                {activeItem.durabilityPct}%
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-[11px] text-[#a0b8aa] my-2 leading-relaxed">
            {activeItem.description}
          </p>

          {/* Component Breakdown with 4 Pointer Cards */}
          <div className="grid grid-cols-2 gap-1.5 my-1.5">
            {(Object.entries(activeItem.components) as [string, { name: string; conditionPct: number; isDamaged: boolean; statusText: string }][]).map(([key, comp]) => (
              <div
                key={key}
                className={`p-2 rounded border text-left ${
                  comp.isDamaged
                    ? 'bg-[#1e1410] border-[#b45309]/60 text-[#fde68a]'
                    : 'bg-[#0c1c16] border-[#1f4231] text-[#c2d9cc]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wide">
                    {comp.name}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      comp.conditionPct < 50 ? 'text-[#f87171]' : 'text-[#4ade80]'
                    }`}
                  >
                    {comp.conditionPct}%
                  </span>
                </div>
                <div className="text-[9.5px] opacity-80 mt-0.5 truncate">
                  {comp.statusText}
                </div>
              </div>
            ))}
          </div>

          {/* Condition Overview Gauge */}
          <div className="p-2 rounded-lg bg-[#07130f] border border-[#1d3d2e] my-1.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8ea799]">
              <span>CONDITION OVERVIEW</span>
              <span className="font-mono">
                Current: <strong className="text-[#fbbf24]">{activeItem.durabilityPct}%</strong> → After Repair: <strong className="text-[#4ade80]">100%</strong>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#0d2017] overflow-hidden flex border border-[#1e3c2d]">
              <div
                className="h-full bg-[#fbbf24]"
                style={{ width: `${activeItem.durabilityPct}%` }}
              />
              <div
                className="h-full bg-[#34d399]/40"
                style={{ width: `${100 - activeItem.durabilityPct}%` }}
              />
            </div>
          </div>

          {/* Identified Issues */}
          <div className="space-y-1 my-1">
            <span className="text-[10px] font-bold text-[#fca5a5] uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-[#f87171]" />
              IDENTIFIED ISSUES ({activeItem.identifiedIssues.length})
            </span>
            <div className="space-y-1">
              {activeItem.identifiedIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="text-[10.5px] text-[#fed7aa] bg-[#29170e]/80 px-2 py-1 rounded border border-[#78350f]/60"
                >
                  • {issue}
                </div>
              ))}
            </div>
          </div>

          {/* Repair Mode Tabs */}
          <div className="grid grid-cols-4 gap-1 my-2">
            {[
              { id: 'repair', label: 'Repair' },
              { id: 'replace', label: 'Replace Part' },
              { id: 'patch', label: 'Quick Patch' },
              { id: 'inspect', label: 'Inspect' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRepairMode(tab.id as any)}
                className={`py-1 text-[10px] font-bold rounded uppercase transition-colors cursor-pointer ${
                  repairMode === tab.id
                    ? 'bg-[#1b4e3a] text-[#a7f3d0] border border-[#2a7356]'
                    : 'bg-[#0d1f18] text-[#718d7d] hover:text-[#d1fae5] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Required Materials */}
          <div className="space-y-1 my-1">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              REPAIR MATERIALS
            </span>
            <div className="space-y-1">
              {activeItem.materials.map((mat) => {
                const isSufficient = mat.owned >= mat.needed;
                return (
                  <div
                    key={mat.itemId}
                    className="flex items-center justify-between p-1.5 rounded bg-[#091712] border border-[#1a382a] text-[11px]"
                  >
                    <span className="text-[#dbe6df] font-medium">{mat.name}</span>
                    <span
                      className={`font-mono font-bold ${
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

          {/* Action Button */}
          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={handleStartRepair}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#059669] to-[#10b981] hover:from-[#10b981] hover:to-[#34d399] text-[#022c22] font-black tracking-widest text-xs uppercase shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-[#34d399] cursor-pointer flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              Repair Equipment
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: REPAIR INFO, QUEUE & SPARE PARTS (3 cols)                   */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0 bg-gradient-to-b from-[#11231c]/95 via-[#0c1a14]/95 to-[#08130f]/98 rounded-xl border border-[#274b39]/80 p-3 shadow-xl overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f5540] scrollbar-track-[#091410]">
          {/* Repair Info Stats */}
          <div className="space-y-1.5 pb-2 border-b border-[#1f3f2f]">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              REPAIR INFO
            </span>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Current Durability:</span>
                <strong className="text-[#fbbf24] font-mono">{activeItem.durabilityPct}%</strong>
              </div>
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Max Durability:</span>
                <strong className="text-[#d8e6de] font-mono">100%</strong>
              </div>
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Repair Efficiency:</span>
                <strong className="text-[#4ade80] font-mono">100%</strong>
              </div>
              <div className="flex justify-between text-[#a0b8aa]">
                <span>Parts Replaceable:</span>
                <strong className="text-[#d8e6de] font-mono">4 / 4</strong>
              </div>
            </div>
          </div>

          {/* Repair Queue */}
          <div className="space-y-1.5 pb-2 border-b border-[#1f3f2f]">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              <span>REPAIR QUEUE ({queue.length}/3)</span>
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
                    <div className="flex items-center justify-between text-[10px] text-[#5eead4] font-mono">
                      <span>{q.detailText}</span>
                      <span>{formatSeconds(q.remainingSeconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Spare Parts */}
          <div className="space-y-1.5 pb-2 border-b border-[#1f3f2f]">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              AVAILABLE SPARE PARTS
            </span>
            <div className="space-y-1">
              {spareParts.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between p-1.5 rounded bg-[#091812] border border-[#1b3b2b] text-[10.5px]"
                >
                  <span className="text-[#cde0d5]">{sp.name} x{sp.quantity}</span>
                  <span className="font-mono text-[#4ade80]">{sp.conditionPct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Maintenance */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-[#86a392] uppercase tracking-wider">
              RECENT MAINTENANCE
            </span>
            <div className="space-y-1">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-[10px] text-[#7ea08d]"
                >
                  <span className="truncate max-w-[120px] text-[#b3ccbf]">{h.itemName}</span>
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
