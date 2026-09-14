import React, { useEffect, useMemo, useState } from 'react';
import { Wrench, AlertTriangle, Search, Trash2, Package, Clock3, ShieldCheck, RefreshCw } from 'lucide-react';
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
  { id: 'all', label: 'All' },
  { id: 'tools', label: 'Tools' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'structures', label: 'Structures' },
];

const formatSeconds = (seconds: number) => {
  const sec = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(sec / 60);
  return `00:${String(minutes).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

export const RepairView: React.FC = () => {
  const [items, setItems] = useState<RepairableItem[]>(INITIAL_REPAIRABLE_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState('repair_stone_knife');
  const [categoryFilter, setCategoryFilter] = useState<RepairCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<RepairQueueItem[]>(INITIAL_REPAIR_QUEUE);
  const [spareParts] = useState<SparePartItem[]>(INITIAL_SPARE_PARTS);
  const [history, setHistory] = useState<MaintenanceHistoryItem[]>(INITIAL_MAINTENANCE_HISTORY);
  const [repairMode, setRepairMode] = useState<'repair' | 'replace' | 'patch' | 'inspect'>('repair');

  const activeItem = items.find((item) => item.id === selectedItemId) || items[0];
  const filteredItems = useMemo(() => items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(query) || item.tags.some((tag) => tag.toLowerCase().includes(query));
  }), [items, categoryFilter, searchQuery]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQueue((previous) => {
        if (previous.length === 0) return previous;
        const next = previous.map((item, index) => index === 0 && item.remainingSeconds > 0 ? { ...item, remainingSeconds: item.remainingSeconds - 1 } : item);
        if (next[0] && next[0].remainingSeconds <= 0) {
          const completed = next[0];
          setItems((current) => current.map((item) => item.id === completed.itemId ? {
            ...item,
            durabilityPct: 100,
            components: {
              blade: { ...item.components.blade, conditionPct: 100, isDamaged: false, statusText: 'Pristine condition' },
              handle: { ...item.components.handle, conditionPct: 100, isDamaged: false, statusText: 'Solid' },
              binding: { ...item.components.binding, conditionPct: 100, isDamaged: false, statusText: 'Tight & new' },
              grip: { ...item.components.grip, conditionPct: 100, isDamaged: false, statusText: 'Optimal hold' },
            },
            identifiedIssues: ['All components serviced and restored.'],
          } : item));
          setHistory((entries) => [{ id: `mh_${Date.now()}`, itemName: completed.name, actionText: 'Full overhaul repaired', timeAgo: 'Just now' }, ...entries.slice(0, 4)]);
          return next.slice(1);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startRepair = () => {
    if (!activeItem || queue.length >= 3 || queue.some((item) => item.itemId === activeItem.id)) return;
    setQueue((previous) => [...previous, {
      id: `rq_${Date.now()}`,
      itemId: activeItem.id,
      name: activeItem.name,
      detailText: repairMode === 'replace' ? 'Replacing worn component...' : repairMode === 'patch' ? 'Applying quick patch...' : 'Repairing damaged parts...',
      remainingSeconds: repairMode === 'patch' ? 25 : 60,
      totalSeconds: repairMode === 'patch' ? 25 : 60,
      status: 'in_progress',
    }]);
  };

  const componentEntries = Object.entries(activeItem.components) as Array<[string, { name: string; conditionPct: number; isDamaged: boolean; statusText: string }]>;

  return (
    <div className="h-full min-h-0 grid grid-cols-[.98fr_1.55fr_.9fr] gap-2 overflow-hidden select-none">
      <section className="min-w-0 min-h-0 flex flex-col border border-[#40503d] bg-[#071711] overflow-hidden">
        <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[#3b4c3a] bg-[#0c241d]"><Wrench className="w-4 h-4 text-[#e2d470]" /><h3 className="text-[13px] font-black text-[#eee6d5] tracking-wide">REPAIRABLE EQUIPMENT</h3></div>
        <div className="shrink-0 px-2 py-2 border-b border-[#314538] space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => setCategoryFilter(category.id)} className={`h-8 rounded-[4px] border text-[10px] font-bold cursor-pointer ${categoryFilter === category.id ? 'bg-[#345528] border-[#d1cb4b] text-[#fff6cf]' : 'bg-[#0b211b] border-[#2d4639] text-[#aaa995]'}`}>{category.label}</button>)}
          </div>
          <label className="h-8 flex items-center gap-2 px-2.5 rounded-[4px] border border-[#30483a] bg-[#081813]"><Search className="w-3.5 h-3.5 text-[#9b8d6c]" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search repairable gear..." className="min-w-0 flex-1 bg-transparent outline-none text-[11px] text-[#e5dfd0] placeholder:text-[#766e5d]" /></label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
          <div className="grid grid-cols-4 gap-2 auto-rows-[112px] content-start">
            {filteredItems.map((item) => {
              const selected = item.id === activeItem.id;
              const bar = item.durabilityPct > 70 ? '#6fd45c' : item.durabilityPct >= 40 ? '#e3ba48' : '#df594d';
              return <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className={`p-1.5 border rounded-[5px] flex flex-col items-center justify-between cursor-pointer ${selected ? 'bg-[#17351f] border-[#e0d34e] shadow-[0_0_10px_rgba(220,211,75,.2)]' : 'bg-[#0a1d17] border-[#324a3b] hover:border-[#60715a]'}`}>
                <div className="w-12 h-12 flex items-center justify-center"><CraftedItemArt itemId="" recipeId="" size={42} /></div>
                <div className="w-full text-center"><div className="text-[10.5px] font-bold text-[#eee8da] truncate">{item.name}</div><div className="text-[9.5px] font-mono mt-1" style={{ color: bar }}>{item.durabilityPct}%</div><div className="h-1 mt-1 bg-[#17251e] overflow-hidden"><div className="h-full" style={{ width: `${item.durabilityPct}%`, background: bar }} /></div></div>
              </button>;
            })}
          </div>
        </div>
      </section>

      <section className="min-w-0 min-h-0 flex flex-col border border-[#40503d] bg-[#071711] overflow-hidden">
        <div className="h-[92px] shrink-0 px-3 py-2.5 border-b border-[#3b4c3a] bg-[#0b211a] flex items-center gap-3">
          <div className="w-[74px] h-[74px] shrink-0 border border-[#405646] bg-[#07130f] flex items-center justify-center"><CraftedItemArt itemId="" recipeId="" size={60} /></div>
          <div className="min-w-0 flex-1"><h2 className="text-[20px] font-black text-[#f2ead9] leading-none">{activeItem.name}</h2><p className="text-[11px] text-[#b2b7aa] mt-2 line-clamp-2">{activeItem.description}</p><div className="flex gap-1.5 mt-2">{activeItem.tags.slice(0,3).map((tag) => <span key={tag} className="px-2 py-0.5 rounded bg-[#0f473a] border border-[#2b735e] text-[9.5px] text-[#c8eadc]">{tag}</span>)}</div></div>
          <div className="text-right"><div className="text-[9px] text-[#8e998e] uppercase">Condition</div><div className="text-[20px] font-black text-[#e5ca55]">{activeItem.durabilityPct}%</div></div>
        </div>

        <div className="h-[300px] shrink-0 relative border-b border-[#34493b] bg-[radial-gradient(circle_at_center,rgba(27,69,51,.35),rgba(5,18,14,.85)_64%)] overflow-hidden">
          <div className="absolute left-3 top-3 text-[12px] font-black tracking-wide text-[#e9e1cf] flex items-center gap-2"><Wrench className="w-4 h-4 text-[#e4d472]" /> REPAIR BENCH <span className="text-[10px] font-normal text-[#879589]">Inspect, repair and replace damaged parts.</span></div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 28 33 L 43 43" stroke="#c1a84e" strokeWidth="0.45" fill="none" />
            <path d="M 72 33 L 57 43" stroke="#c1a84e" strokeWidth="0.45" fill="none" />
            <path d="M 28 72 L 43 58" stroke="#c1a84e" strokeWidth="0.45" fill="none" />
            <path d="M 72 72 L 57 58" stroke="#c1a84e" strokeWidth="0.45" fill="none" />
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%] w-[150px] h-[116px] rounded-full border border-[#4b624e] bg-[#0a1a14]/80 shadow-[0_0_28px_rgba(108,147,111,.12)] flex flex-col items-center justify-center"><CraftedItemArt itemId="" recipeId="" size={82} /><span className="text-[10px] mt-1 text-[#d6cda9]">{activeItem.name}</span></div>
          {componentEntries.map(([key, component], index) => {
            const positions = ['left-3 top-[58px]', 'right-3 top-[58px]', 'left-3 bottom-3', 'right-3 bottom-3'];
            return <div key={key} className={`absolute ${positions[index]} w-[150px] h-[72px] p-2 border rounded-[5px] ${component.isDamaged ? 'bg-[#24170f] border-[#9d5d32]' : 'bg-[#0a1d16] border-[#3c5745]'}`}><div className="flex items-center justify-between"><span className="text-[10.5px] font-black text-[#e9e2d3]">{component.name}</span><span className={`text-[12px] font-black ${component.conditionPct < 50 ? 'text-[#ef6657]' : component.conditionPct < 75 ? 'text-[#edc247]' : 'text-[#7bdc65]'}`}>{component.conditionPct}%</span></div><div className="h-1.5 mt-2 bg-[#1a261f] overflow-hidden"><div className={`h-full ${component.conditionPct < 50 ? 'bg-[#e65c4f]' : component.conditionPct < 75 ? 'bg-[#e3b840]' : 'bg-[#67cb57]'}`} style={{ width: `${component.conditionPct}%` }} /></div><div className="text-[9px] mt-1 text-[#a7a99d] truncate">{component.statusText}</div></div>;
          })}
        </div>

        <div className="min-h-0 flex-1 grid grid-rows-[auto_auto_1fr_auto] gap-2 p-2 overflow-hidden">
          <div className="grid grid-cols-[1.15fr_.85fr] gap-2">
            <div className="border border-[#354b3c] bg-[#091813] px-2.5 py-2"><div className="text-[10px] font-black text-[#ded6c4] uppercase">Condition Overview</div><div className="mt-2 flex items-center gap-2 text-[11px]"><span className="text-[#e5c453] font-bold">{activeItem.durabilityPct}%</span><span className="text-[#908f80]">→</span><span className="text-[#7ddd65] font-bold">100%</span><div className="h-2 flex-1 bg-[#1b291f] overflow-hidden"><div className="h-full bg-[#e0b941]" style={{ width: `${activeItem.durabilityPct}%` }} /></div></div></div>
            <div className="border border-[#553f2f] bg-[#16120e] px-2.5 py-2"><div className="text-[10px] font-black text-[#f1d1ae] flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-[#ed6c50]" /> IDENTIFIED ISSUES</div><div className="text-[9px] mt-1 text-[#c7a991] truncate">{activeItem.identifiedIssues[0] || 'No major issue detected'}</div></div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">{(['repair','replace','patch','inspect'] as const).map((mode) => <button key={mode} type="button" onClick={() => setRepairMode(mode)} className={`h-9 border rounded-[4px] text-[10px] font-bold capitalize cursor-pointer ${repairMode === mode ? 'bg-[#36552b] border-[#d6cf4c] text-[#fff8d0]' : 'bg-[#0b211a] border-[#324a3b] text-[#acae9d]'}`}>{mode === 'replace' ? 'Replace Part' : mode === 'patch' ? 'Quick Patch' : mode}</button>)}</div>

          <div className="min-h-0 grid grid-cols-5 gap-1.5 overflow-hidden">{activeItem.materials.slice(0,5).map((material) => <div key={material.itemId} className="min-w-0 border border-[#344a3b] bg-[#091813] p-1.5 flex flex-col justify-center text-center"><Package className="w-4 h-4 mx-auto text-[#c9b36d]" /><div className="mt-1 text-[9px] text-[#e2ddcf] truncate">{material.name}</div><div className={`text-[10px] font-bold ${material.owned >= material.needed ? 'text-[#7bdc65]' : 'text-[#ec6556]'}`}>{material.owned} / {material.needed}</div></div>)}</div>

          <div className="grid grid-cols-[1fr_160px] gap-2"><div className="h-11 border border-[#354a3b] bg-[#091813] px-3 flex items-center text-[10px] text-[#9aa496]"><ShieldCheck className="w-4 h-4 mr-2 text-[#6fd45d]" /> Restores {activeItem.repairResult.restoresPct}% durability · fixes {activeItem.repairResult.fixesPartsCount} damaged part(s)</div><button type="button" onClick={startRepair} className="h-11 rounded-[5px] border border-[#ddd34e] bg-gradient-to-b from-[#4a6728] to-[#254719] text-[#fffbd7] font-black text-[13px] flex items-center justify-center gap-2 cursor-pointer"><Wrench className="w-4 h-4" /> Repair</button></div>
        </div>
      </section>

      <aside className="min-w-0 min-h-0 flex flex-col gap-2 overflow-hidden">
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<ShieldCheck className="w-4 h-4" />} title="REPAIR INFO" /><div className="p-3 space-y-1.5 text-[11px]"><Stat label="Current Durability" value={`${activeItem.durabilityPct}%`} /><Stat label="Max Durability" value="100%" /><Stat label="Repair Efficiency" value="100%" /><Stat label="Parts Replaceable" value="4 / 4" /><Stat label="Basic Repair Cost" value={`${activeItem.materials.length} materials`} /></div></section>
        <section className="min-h-0 flex-1 border border-[#40503d] bg-[#0b201a] flex flex-col"><PanelTitle icon={<Clock3 className="w-4 h-4" />} title={`REPAIR QUEUE  ${queue.length} / 3`} /><div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">{queue.map((item) => <div key={item.id} className="h-[62px] border border-[#344c3c] bg-[#081914] p-2 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-[#d1bb60] shrink-0" /><div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold text-[#ebe5d7] truncate">{item.name}</div><div className="text-[9px] text-[#87958a] truncate">{item.detailText}</div><div className="text-[9px] font-mono text-[#c7bdab] mt-1">{formatSeconds(item.remainingSeconds)}</div></div><button type="button" onClick={() => setQueue((entries) => entries.filter((entry) => entry.id !== item.id))} className="w-7 h-7 border border-[#8b4537] text-[#ef6656] flex items-center justify-center cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></div>)}</div></section>
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<Package className="w-4 h-4" />} title="AVAILABLE SPARE PARTS" /><div className="p-2 space-y-1">{spareParts.slice(0,4).map((part) => <div key={part.id} className="h-7 px-2 flex items-center gap-2 border border-[#2e4437] bg-[#081813] text-[9.5px]"><span className="min-w-0 flex-1 text-[#d8d5c8] truncate">{part.name} ×{part.quantity}</span><span className="font-bold text-[#d7c655]">{part.conditionPct}%</span></div>)}</div></section>
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<Clock3 className="w-4 h-4" />} title="RECENT MAINTENANCE" /><div className="p-2 space-y-1">{history.slice(0,4).map((entry) => <div key={entry.id} className="h-6 flex items-center gap-2 text-[9px] border-b border-[#25372d] last:border-0"><span className="min-w-0 flex-1 truncate text-[#cfcabd]">{entry.itemName} — {entry.actionText}</span><span className="text-[#77857a] shrink-0">{entry.timeAgo}</span></div>)}</div></section>
      </aside>
    </div>
  );
};

const PanelTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => <div className="h-10 px-3 flex items-center gap-2 border-b border-[#3b4c3a] bg-[#0d2721] text-[#eee6d5]"><span className="text-[#dfce6d]">{icon}</span><h3 className="text-[12px] font-black tracking-wide">{title}</h3></div>;
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="h-6 flex items-center border-b border-[#26392f] last:border-0"><span className="min-w-0 flex-1 text-[#b3b7aa]">{label}</span><strong className="text-[#e2cc57] font-mono">{value}</strong></div>;
