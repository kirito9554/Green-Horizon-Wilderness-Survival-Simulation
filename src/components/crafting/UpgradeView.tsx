import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, Search, CheckCircle2, Clock3, Trash2, History, Package, TrendingUp, ArrowRight } from 'lucide-react';
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
  { id: 'all', label: 'All' },
  { id: 'tools', label: 'Tools' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'utility', label: 'Structures' },
];

const formatSeconds = (seconds: number) => {
  const sec = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(sec / 60);
  return `00:${String(minutes).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

export const UpgradeView: React.FC = () => {
  const [items] = useState<TieredUpgradeItem[]>(INITIAL_TIERED_UPGRADE_ITEMS);
  const [selectedItemId, setSelectedItemId] = useState('upg_stone_knife');
  const [categoryFilter, setCategoryFilter] = useState<UpgradeCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<UpgradeQueueItem[]>(INITIAL_UPGRADE_QUEUE_ITEMS);
  const [history, setHistory] = useState<UpgradeHistoryItem[]>(INITIAL_UPGRADE_HISTORY_ITEMS);

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
          setHistory((entries) => [{ id: `uh_${Date.now()}`, fromName: completed.name, toName: `${completed.name} ${completed.targetTierLabel}`, timeAgo: 'Just now' }, ...entries.slice(0, 4)]);
          return next.slice(1);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startUpgrade = () => {
    if (!activeItem || activeItem.currentTier >= activeItem.maxTier || queue.length >= 3 || queue.some((item) => item.itemId === activeItem.id)) return;
    const nextStep = activeItem.tierSteps.find((step) => step.tier === activeItem.currentTier + 1);
    setQueue((previous) => [...previous, {
      id: `uq_${Date.now()}`,
      itemId: activeItem.id,
      name: activeItem.name,
      targetTierLabel: nextStep?.tierLabel || `Tier ${activeItem.currentTier + 1}`,
      remainingSeconds: 300,
      totalSeconds: 300,
      status: 'in_progress',
    }]);
  };

  return (
    <div className="h-full min-h-0 grid grid-cols-[.98fr_1.55fr_.9fr] gap-2 overflow-hidden select-none">
      <section className="min-w-0 min-h-0 flex flex-col border border-[#40503d] bg-[#071711] overflow-hidden">
        <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[#3b4c3a] bg-[#0c241d]"><ArrowUpCircle className="w-4 h-4 text-[#e2d470]" /><h3 className="text-[13px] font-black text-[#eee6d5] tracking-wide">UPGRADEABLE EQUIPMENT</h3></div>
        <div className="shrink-0 px-2 py-2 border-b border-[#314538] space-y-2">
          <div className="grid grid-cols-5 gap-1">{CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => setCategoryFilter(category.id)} className={`h-8 rounded-[4px] border text-[10px] font-bold cursor-pointer ${categoryFilter === category.id ? 'bg-[#345528] border-[#d1cb4b] text-[#fff6cf]' : 'bg-[#0b211b] border-[#2d4639] text-[#aaa995]'}`}>{category.label}</button>)}</div>
          <label className="h-8 flex items-center gap-2 px-2.5 rounded-[4px] border border-[#30483a] bg-[#081813]"><Search className="w-3.5 h-3.5 text-[#9b8d6c]" /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search upgradeable gear..." className="min-w-0 flex-1 bg-transparent outline-none text-[11px] text-[#e5dfd0] placeholder:text-[#766e5d]" /></label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
          <div className="grid grid-cols-4 gap-2 auto-rows-[112px] content-start">
            {filteredItems.map((item) => {
              const selected = item.id === activeItem.id;
              return <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className={`p-1.5 border rounded-[5px] flex flex-col items-center justify-between cursor-pointer ${selected ? 'bg-[#17351f] border-[#e0d34e] shadow-[0_0_10px_rgba(220,211,75,.2)]' : 'bg-[#0a1d17] border-[#324a3b] hover:border-[#60715a]'}`}>
                <div className="w-12 h-12 flex items-center justify-center"><CraftedItemArt itemId="" recipeId="" size={42} /></div>
                <div className="w-full text-center"><div className="text-[10.5px] font-bold text-[#eee8da] truncate">{item.name}</div><div className="flex items-center justify-center gap-1 mt-2">{Array.from({ length: item.maxTier }).map((_, index) => <span key={index} className={`w-2 h-2 rounded-full border ${index < item.currentTier ? 'bg-[#e7d452] border-[#e7d452]' : 'bg-[#25362d] border-[#46574a]'}`} />)}</div></div>
              </button>;
            })}
          </div>
        </div>
      </section>

      <section className="min-w-0 min-h-0 flex flex-col border border-[#40503d] bg-[#071711] overflow-hidden">
        <div className="h-[92px] shrink-0 px-3 py-2.5 border-b border-[#3b4c3a] bg-[#0b211a] flex items-center gap-3">
          <div className="w-[74px] h-[74px] shrink-0 border border-[#405646] bg-[#07130f] flex items-center justify-center"><CraftedItemArt itemId="" recipeId="" size={60} /></div>
          <div className="min-w-0 flex-1"><h2 className="text-[20px] font-black text-[#f2ead9] leading-none">{activeItem.name}</h2><p className="text-[11px] text-[#b2b7aa] mt-2 line-clamp-2">{activeItem.description}</p><div className="flex gap-1.5 mt-2">{activeItem.tags.slice(0,3).map((tag) => <span key={tag} className="px-2 py-0.5 rounded bg-[#0f473a] border border-[#2b735e] text-[9.5px] text-[#c8eadc]">{tag}</span>)}</div></div>
          <div className="text-right"><div className="text-[9px] text-[#8e998e] uppercase">Current Tier</div><div className="text-[18px] font-black text-[#e5ca55]">Tier {activeItem.currentTier}</div></div>
        </div>

        <div className="shrink-0 px-3 py-2 border-b border-[#34493b] bg-[#081914]">
          <div className="text-[12px] font-black text-[#eae2d1] tracking-wide flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-[#e3d16e]" /> UPGRADE PATH</div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-1 items-center">
            {activeItem.tierSteps.slice(0,4).map((step, index) => <React.Fragment key={step.tier}><div className={`h-[112px] border rounded-[5px] p-2 flex flex-col items-center justify-between ${step.isCurrent ? 'bg-[#304b24] border-[#e0d24e] shadow-[0_0_10px_rgba(223,211,77,.2)]' : step.isUnlocked ? 'bg-[#0b211a] border-[#3c5545]' : 'bg-[#08140f] border-[#25372d] opacity-55'}`}><div className="w-12 h-12 flex items-center justify-center"><CraftedItemArt itemId="" recipeId="" size={40} /></div><div className="text-center"><div className="text-[10px] font-bold text-[#eee8da] truncate max-w-[95px]">{step.name}</div><div className="text-[9px] mt-1 text-[#9aa294]">{step.tierLabel}</div></div></div>{index < Math.min(3, activeItem.tierSteps.length - 1) && <ArrowRight className="w-4 h-4 text-[#d9c961]" />}</React.Fragment>)}
          </div>
        </div>

        <div className="min-h-0 flex-1 grid grid-rows-[1fr_auto_auto] gap-2 p-2 overflow-hidden">
          <div className="min-h-0 border border-[#354a3b] bg-[#091813] overflow-hidden flex flex-col">
            <div className="h-9 shrink-0 px-2 flex items-center border-b border-[#354a3b] bg-[#0c211a] text-[11px] font-black text-[#e4dcc9]">STAT COMPARISON</div>
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-[10.5px]">
                <thead className="sticky top-0 bg-[#0a1b16] text-[#8e998e]"><tr><th className="text-left px-2 py-1.5">Stat</th><th className="px-2 py-1.5">Current</th><th className="px-2 py-1.5">Next</th><th className="px-2 py-1.5 text-right">Change</th></tr></thead>
                <tbody>{activeItem.statComparisons.map((row) => <tr key={row.label} className="border-t border-[#24372d]"><td className="px-2 py-1.5 text-[#d9d5c9] font-medium">{row.label}</td><td className="px-2 py-1.5 text-center text-[#aaa99d] font-mono">{row.currentValue}</td><td className="px-2 py-1.5 text-center text-[#eee8d8] font-mono font-bold">{row.nextValue}</td><td className={`px-2 py-1.5 text-right font-mono font-bold ${row.isPositive === true ? 'text-[#79da61]' : row.isPositive === false ? 'text-[#ea6558]' : 'text-[#9da297]'}`}>{row.changeText}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-[1.1fr_.9fr] gap-2">
            <div className="border border-[#354a3b] bg-[#091813] p-2"><div className="text-[10px] font-black text-[#e1d9c7] mb-1.5">REQUIRED MATERIALS</div><div className="grid grid-cols-3 gap-1.5">{activeItem.requiredMaterials.slice(0,3).map((material) => <div key={material.itemId} className="border border-[#2d4336] bg-[#07140f] p-1.5 text-center"><Package className="w-4 h-4 mx-auto text-[#cfb765]" /><div className="text-[8.5px] mt-1 truncate text-[#d9d5ca]">{material.name}</div><div className={`text-[10px] font-bold ${material.owned >= material.needed ? 'text-[#7ada61]' : 'text-[#e96558]'}`}>{material.owned} / {material.needed}</div></div>)}</div></div>
            <div className="border border-[#354a3b] bg-[#091813] p-2"><div className="text-[10px] font-black text-[#e1d9c7] mb-1.5">UPGRADE REQUIREMENTS</div><div className="space-y-1">{activeItem.requirements.slice(0,4).map((requirement) => <div key={requirement.id} className="h-6 flex items-center gap-1.5 text-[9.5px] text-[#d4d1c6]"><CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${requirement.isMet ? 'text-[#75d660]' : 'text-[#876f58]'}`} /><span className="truncate">{requirement.label}</span></div>)}</div></div>
          </div>

          <button type="button" onClick={startUpgrade} className="h-11 rounded-[5px] border border-[#ddd34e] bg-gradient-to-b from-[#4a6728] to-[#254719] text-[#fffbd7] font-black text-[14px] flex items-center justify-center gap-2 cursor-pointer"><ArrowUpCircle className="w-4 h-4" /> Upgrade to Tier {Math.min(activeItem.maxTier, activeItem.currentTier + 1)}</button>
        </div>
      </section>

      <aside className="min-w-0 min-h-0 flex flex-col gap-2 overflow-hidden">
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<TrendingUp className="w-4 h-4" />} title="UPGRADE INFO" /><div className="p-3 space-y-1.5 text-[11px]"><Stat label="Total Upgradeable Items" value={`${items.length} / 24`} /><Stat label="Upgrades Unlocked" value="8 / 32" /><Stat label="Average Item Level" value="1.6" /><Stat label="Upgrade Success Rate" value="100%" /></div></section>
        <section className="min-h-0 flex-1 border border-[#40503d] bg-[#0b201a] flex flex-col"><PanelTitle icon={<ArrowUpCircle className="w-4 h-4" />} title={`UPGRADE QUEUE  ${queue.length} / 3`} /><div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">{queue.map((item) => <div key={item.id} className="h-[64px] border border-[#344c3c] bg-[#081914] p-2 flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-[#d2bd61] shrink-0" /><div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold text-[#ebe5d7] truncate">{item.name}</div><div className="text-[9px] text-[#87958a]">{item.targetTierLabel}</div><div className="text-[9px] font-mono text-[#c7bdab] mt-1">{formatSeconds(item.remainingSeconds)}</div></div><button type="button" onClick={() => setQueue((entries) => entries.filter((entry) => entry.id !== item.id))} className="w-7 h-7 border border-[#8b4537] text-[#ef6656] flex items-center justify-center cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></div>)}</div></section>
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<History className="w-4 h-4" />} title="UPGRADE HISTORY" /><div className="p-2 space-y-1">{history.slice(0,5).map((entry) => <div key={entry.id} className="h-7 flex items-center gap-2 text-[9px] border-b border-[#25372d] last:border-0"><span className="min-w-0 flex-1 truncate text-[#cfcabd]">{entry.fromName} → {entry.toName}</span><span className="text-[#77857a] shrink-0">{entry.timeAgo}</span></div>)}</div></section>
        <button type="button" className="h-11 shrink-0 border border-[#40503d] bg-[#0d2721] text-[11px] text-[#e5dfcf] flex items-center justify-center gap-2 cursor-pointer"><Clock3 className="w-4 h-4 text-[#d3c269]" /> View Full History</button>
      </aside>
    </div>
  );
};

const PanelTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => <div className="h-10 px-3 flex items-center gap-2 border-b border-[#3b4c3a] bg-[#0d2721] text-[#eee6d5]"><span className="text-[#dfce6d]">{icon}</span><h3 className="text-[12px] font-black tracking-wide">{title}</h3></div>;
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="h-6 flex items-center border-b border-[#26392f] last:border-0"><span className="min-w-0 flex-1 text-[#b3b7aa]">{label}</span><strong className="text-[#e2cc57] font-mono">{value}</strong></div>;
