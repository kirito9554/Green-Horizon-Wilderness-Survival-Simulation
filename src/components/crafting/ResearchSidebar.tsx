import React from 'react';
import { Brain, Clock, Zap, BookMarked, ArrowUp, X, Plus, Sparkles, Leaf, Search } from 'lucide-react';
import { ResearchQueueItem } from '../../types/crafting';

interface ResearchSidebarProps {
  knowledgePoints?: number;
  recipesDiscoveredCount?: number;
  maxRecipesDiscovered?: number;
  materialsIdentifiedCount?: number;
  maxMaterialsIdentified?: number;
  researchSpeedBonusPct?: number;
  queue: ResearchQueueItem[];
  maxQueueSlots?: number;
  onCancelQueueItem: (id: string) => void;
  onMoveUpQueueItem: (id: string) => void;
  onAddToQueueClick?: () => void;
}

const formatTime = (seconds: number) => {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const ResearchSidebar: React.FC<ResearchSidebarProps> = ({
  knowledgePoints = 12,
  recipesDiscoveredCount = 28,
  maxRecipesDiscovered = 52,
  materialsIdentifiedCount = 41,
  maxMaterialsIdentified = 78,
  researchSpeedBonusPct = 10,
  queue,
  maxQueueSlots = 3,
  onCancelQueueItem,
  onMoveUpQueueItem,
  onAddToQueueClick,
}) => {
  return (
    <div className="h-full min-h-0 flex flex-col gap-2 overflow-hidden select-none">
      <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<Brain className="w-4 h-4" />} title="RESEARCH INFO" /><div className="p-3 space-y-1.5 text-[11px]"><Stat label="Knowledge Points" value={`${knowledgePoints}`} /><Stat label="Recipes Discovered" value={`${recipesDiscoveredCount} / ${maxRecipesDiscovered}`} /><Stat label="Materials Identified" value={`${materialsIdentifiedCount} / ${maxMaterialsIdentified}`} /><Stat label="Research Speed" value={`+${researchSpeedBonusPct}%`} /></div></section>

      <section className="min-h-0 flex-1 border border-[#40503d] bg-[#0b201a] flex flex-col">
        <PanelTitle icon={<BookMarked className="w-4 h-4" />} title={`RESEARCH QUEUE  ${queue.length} / ${maxQueueSlots}`} />
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
          {queue.length === 0 ? <div className="h-full min-h-[90px] border border-dashed border-[#354a3c] bg-[#07150f] flex items-center justify-center text-[10px] italic text-[#758176]">Queue is empty</div> : queue.slice(0, maxQueueSlots).map((item, index) => <div key={item.id} className="h-[72px] p-2 border border-[#344c3d] bg-[#081914] flex flex-col justify-between"><div className="flex items-center gap-2"><span className="text-[9px] font-mono text-[#8b958c]">#{index + 1}</span><span className="min-w-0 flex-1 text-[10.5px] font-bold text-[#ebe5d7] truncate">{item.name}</span>{index > 0 && <button type="button" onClick={() => onMoveUpQueueItem(item.id)} className="w-6 h-6 border border-[#50614e] text-[#c9c1ad] flex items-center justify-center cursor-pointer"><ArrowUp className="w-3 h-3" /></button>}<button type="button" onClick={() => onCancelQueueItem(item.id)} className="w-6 h-6 border border-[#8b4537] text-[#ef6656] flex items-center justify-center cursor-pointer"><X className="w-3 h-3" /></button></div><div className="flex items-center gap-2"><div className="h-1.5 flex-1 bg-[#17261f] overflow-hidden"><div className="h-full bg-[#62c95a]" style={{ width: `${item.progressPct}%` }} /></div><span className="text-[9px] font-mono text-[#c8bfad]">{formatTime(item.remainingSeconds)}</span></div></div>)}
        </div>
        {onAddToQueueClick && <button type="button" onClick={onAddToQueueClick} disabled={queue.length >= maxQueueSlots} className="h-11 shrink-0 m-2 mt-0 border border-dashed border-[#536a56] bg-[#0b251e] text-[11px] text-[#d8d0bd] flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"><Plus className="w-4 h-4" /> Add to Queue</button>}
      </section>

      <section className="shrink-0 border border-[#40503d] bg-[#0b201a]"><PanelTitle icon={<Sparkles className="w-4 h-4" />} title="RESEARCH TIPS" /><div className="p-3 space-y-2 text-[10px] leading-[1.35] text-[#b5b8ac]"><Tip icon={<Zap className="w-3.5 h-3.5" />} text="Discover at least 80% of a recipe's required materials to unlock it." /><Tip icon={<Leaf className="w-3.5 h-3.5" />} text="Identify new materials by gathering and examining them in the world." /><Tip icon={<Search className="w-3.5 h-3.5" />} text="Some rare materials require deeper exploration." /><Tip icon={<Clock className="w-3.5 h-3.5" />} text="Track recipes to receive hints from your surroundings." /></div></section>
    </div>
  );
};

const PanelTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => <div className="h-10 px-3 flex items-center gap-2 border-b border-[#3b4c3a] bg-[#0d2721] text-[#eee6d5]"><span className="text-[#dfce6d]">{icon}</span><h3 className="text-[12px] font-black tracking-wide">{title}</h3></div>;
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="h-6 flex items-center border-b border-[#26392f] last:border-0"><span className="min-w-0 flex-1 text-[#b3b7aa]">{label}</span><strong className="text-[#e2cc57] font-mono">{value}</strong></div>;
const Tip: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => <div className="flex items-start gap-2"><span className="mt-0.5 text-[#d6c567] shrink-0">{icon}</span><span>{text}</span></div>;
