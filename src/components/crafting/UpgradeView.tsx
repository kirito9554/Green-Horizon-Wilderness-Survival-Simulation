import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpCircle,
  Clock3,
  Gauge,
  Hammer,
  Pause,
  Play,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { GameState } from '../../types';
import type { ComponentModification } from '../../types/upgradeSimulation';
import { ITEMS_DATABASE } from '../../data/items';
import { RECIPES_DATABASE } from '../../data/recipes';
import { deriveToolStats, getNextTierRecipeForItem } from '../../simulation/upgradeSystem';
import { CraftedItemArt } from './CraftedItemArt';

interface UpgradeViewProps {
  state: GameState;
  onQueueTierUpgrade?: (instanceId: string, survivorId?: string) => void;
  onQueueComponentModification?: (
    instanceId: string,
    modification: ComponentModification,
    componentInstanceId?: string,
    survivorId?: string,
  ) => void;
  onCancelUpgrade?: (jobId: string) => void;
  onTogglePauseUpgrade?: (jobId: string) => void;
}

function pct(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
}

function formatSeconds(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function ageText(currentMinute: number, eventMinute: number): string {
  const elapsed = Math.max(0, currentMinute - eventMinute);
  if (elapsed < 60) return `${Math.max(1, Math.round(elapsed))}m ago`;
  if (elapsed < 1440) return `${Math.round(elapsed / 60)}h ago`;
  return `${Math.round(elapsed / 1440)}d ago`;
}

export const UpgradeView: React.FC<UpgradeViewProps> = ({
  state,
  onQueueTierUpgrade,
  onQueueComponentModification,
  onCancelUpgrade,
  onTogglePauseUpgrade,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modification, setModification] = useState<ComponentModification>('sharpen');

  const tools = useMemo(
    () => state.inventory.items.filter(item => {
      const def = ITEMS_DATABASE[item.itemId];
      return Boolean(def && (def.category === 'tool' || def.toolProperties));
    }),
    [state.inventory.items],
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tools;
    return tools.filter(item => {
      const def = ITEMS_DATABASE[item.itemId];
      return def?.name.toLowerCase().includes(query)
        || def?.tags.some(tag => tag.toLowerCase().includes(query));
    });
  }, [tools, searchQuery]);

  useEffect(() => {
    if (!selectedInstanceId || !tools.some(item => item.instanceId === selectedInstanceId)) {
      if (tools[0]) setSelectedInstanceId(tools[0].instanceId);
    }
  }, [tools, selectedInstanceId]);

  const activeItem = tools.find(item => item.instanceId === selectedInstanceId) || tools[0];
  const activeDef = activeItem ? ITEMS_DATABASE[activeItem.itemId] : undefined;
  const components = activeItem?.components || [];

  useEffect(() => {
    if (!activeItem) return;
    if (!selectedComponentId || !components.some(component => component.instanceId === selectedComponentId)) {
      const preferred = components.find(component => component.properties.edgeSharpness !== undefined) || components[0];
      if (preferred) setSelectedComponentId(preferred.instanceId);
    }
  }, [activeItem?.instanceId, components, selectedComponentId]);

  const activeComponent = components.find(component => component.instanceId === selectedComponentId) || components[0];
  const stats = activeItem ? deriveToolStats(activeItem) : null;
  const nextRecipe = activeItem ? getNextTierRecipeForItem(activeItem.itemId) : undefined;
  const nextItemId = nextRecipe?.outputs[0]?.itemId;
  const nextDef = nextItemId ? ITEMS_DATABASE[nextItemId] : undefined;
  const sourceRecipe = activeItem
    ? Object.values(RECIPES_DATABASE).find(recipe => recipe.outputs.some(output => output.itemId === activeItem.itemId))
    : undefined;
  const queue = state.upgradeSystem?.queue || [];
  const history = state.upgradeSystem?.history || [];
  const activeQueuedJob = activeItem ? queue.find(job => job.targetInstanceId === activeItem.instanceId) : undefined;
  const idleWorker = state.survivors
    .filter(survivor => survivor.currentAction.type === 'idle')
    .sort((a, b) => (b.skills.crafting || 1) - (a.skills.crafting || 1))[0];
  const currentMinute = Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);

  const projectedStats = stats ? {
    durability: nextDef?.toolProperties?.durabilityMax || Math.round(stats.durability * 1.12),
    cuttingPower: nextDef ? Math.round(stats.cuttingPower * 1.22 * 10) / 10 : stats.cuttingPower,
    efficiency: nextDef ? Math.min(160, Math.round(stats.efficiency * 1.12 * 10) / 10) : stats.efficiency,
    handling: nextDef ? Math.min(100, Math.round((stats.handling + 6) * 10) / 10) : stats.handling,
    reachM: stats.reachM,
    reliability: nextDef ? Math.min(100, Math.round((stats.reliability + 8) * 10) / 10) : stats.reliability,
  } : null;

  if (!activeItem || !activeDef || !stats) {
    return <div className="h-full flex items-center justify-center border border-[#40503d] bg-[#071711] text-[#8fa194]">No upgradeable equipment in inventory.</div>;
  }

  const queueTier = () => {
    if (!nextRecipe || activeQueuedJob) return;
    onQueueTierUpgrade?.(activeItem.instanceId, idleWorker?.id);
  };

  const queueModification = () => {
    if (!activeComponent || activeQueuedJob) return;
    onQueueComponentModification?.(activeItem.instanceId, modification, activeComponent.instanceId, idleWorker?.id);
  };

  return (
    <div className="h-full min-h-0 grid grid-cols-[.92fr_1.55fr_.83fr] gap-2 overflow-hidden text-[#e8e2d4]">
      <section className="min-h-0 border border-[#40503d] bg-[#071711] p-2 flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-[#31483a]"><div className="flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-[#e5d574]" /><span className="text-[13px] font-black">UPGRADEABLE EQUIPMENT</span></div><span className="text-[10px] text-[#869789]">{tools.length}</span></div>
        <label className="h-8 shrink-0 mt-2 px-2 flex items-center gap-2 border border-[#31483a] bg-[#091813]"><Search className="w-3.5 h-3.5 text-[#718678]" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search equipment..." className="min-w-0 flex-1 bg-transparent outline-none text-[11px]" /></label>
        <div className="min-h-0 flex-1 mt-2 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-3 gap-1.5">
            {filtered.map(item => {
              const def = ITEMS_DATABASE[item.itemId];
              const selected = item.instanceId === activeItem.instanceId;
              const locked = (item.reservedQuantity || 0) > 0;
              const condition = pct(item.condition || 0, item.conditionMax || 100);
              const recipe = getNextTierRecipeForItem(item.itemId);
              return (
                <button key={item.instanceId} type="button" onClick={() => setSelectedInstanceId(item.instanceId)} className={`min-h-[100px] p-1.5 border text-center cursor-pointer ${selected ? 'border-[#ddd94e] bg-[#173421]' : 'border-[#304739] bg-[#091813] hover:bg-[#10251d]'}`}>
                  <div className="h-[50px] flex items-center justify-center"><CraftedItemArt itemId={item.itemId} size={44} /></div>
                  <div className="text-[10px] font-bold truncate">{def?.name || item.itemId}</div>
                  <div className="mt-0.5 flex justify-center gap-1">{[0, 1, 2, 3].map(index => <span key={index} className={`w-1.5 h-1.5 rounded-full ${index === 0 || item.modifications?.length && index <= Math.min(3, item.modifications.length) ? 'bg-[#d9c851]' : 'bg-[#34483b]'}`} />)}</div>
                  <div className="text-[8px] text-[#829385]">{recipe ? 'tier path available' : 'component mods'}</div>
                  {locked && <div className="text-[8px] text-[#d8a560]">reserved</div>}
                  <div className="h-1 mt-1 bg-[#17261f]"><div className="h-full bg-[#5fc462]" style={{ width: `${condition}%` }} /></div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="min-h-0 border border-[#40503d] bg-[#081813] flex flex-col overflow-hidden">
        <div className="shrink-0 p-2.5 border-b border-[#31483a] flex items-center gap-3">
          <div className="w-16 h-16 border border-[#405746] bg-[#07120e] flex items-center justify-center"><CraftedItemArt itemId={activeItem.itemId} size={56} /></div>
          <div className="min-w-0 flex-1"><h2 className="text-[18px] font-black truncate">{activeDef.name}</h2><p className="text-[10px] text-[#98a69a] line-clamp-2">{activeDef.description}</p><div className="mt-1 flex items-center gap-2 text-[9px]"><span className="px-1.5 py-0.5 border border-[#49604c] bg-[#10261d]">{activeItem.quality || 'standard'}</span><span className="text-[#d9ca6e]">{sourceRecipe?.tier || 'Field-built'}</span><span className="text-[#7f9687]">{activeItem.modifications?.length || 0} mods</span></div></div>
        </div>

        <div className="shrink-0 p-2.5 border-b border-[#31483a]">
          <div className="text-[11px] font-black mb-1.5">UPGRADE PATH</div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div className="h-[88px] border border-[#d3cf49] bg-[#173421] flex items-center gap-2 p-2"><CraftedItemArt itemId={activeItem.itemId} size={54} /><div className="min-w-0"><div className="text-[10px] font-black truncate">{activeDef.name}</div><div className="text-[8.5px] text-[#8da092]">Current physical instance</div><div className="text-[8px] text-[#d7c95e]">Durability {stats.durability}</div></div></div>
            <ArrowRight className="w-5 h-5 text-[#dfd263]" />
            <div className={`h-[88px] border p-2 flex items-center gap-2 ${nextDef ? 'border-[#52684f] bg-[#0a1d17]' : 'border-dashed border-[#35483c] bg-[#07140f]'}`}>{nextDef ? <><CraftedItemArt itemId={nextItemId || ''} size={54} /><div className="min-w-0"><div className="text-[10px] font-black truncate">{nextDef.name}</div><div className="text-[8.5px] text-[#8da092]">{nextRecipe?.tier || 'Next tier'}</div><div className="text-[8px] text-[#7fc980]">Preserves instance history</div></div></> : <div className="w-full text-center text-[9px] text-[#75887a]">No recipe-tier successor. Use component modifications.</div>}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 grid grid-cols-[1.06fr_.94fr] gap-2 p-2.5 overflow-hidden">
          <div className="min-h-0 border border-[#31483a] bg-[#07150f] p-2 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-black mb-1.5">STAT COMPARISON — DERIVED FROM COMPONENTS</div>
            <CompareRow label="Durability" current={stats.durability.toFixed(0)} next={projectedStats?.durability.toFixed(0) || '—'} />
            <CompareRow label="Cutting Power" current={stats.cuttingPower.toFixed(1)} next={projectedStats?.cuttingPower.toFixed(1) || '—'} />
            <CompareRow label="Efficiency" current={`${stats.efficiency.toFixed(1)}%`} next={projectedStats ? `${projectedStats.efficiency.toFixed(1)}%` : '—'} />
            <CompareRow label="Handling" current={`${stats.handling.toFixed(1)}%`} next={projectedStats ? `${projectedStats.handling.toFixed(1)}%` : '—'} />
            <CompareRow label="Reach" current={`${stats.reachM.toFixed(2)} m`} next={projectedStats ? `${projectedStats.reachM.toFixed(2)} m` : '—'} />
            <CompareRow label="Reliability" current={`${stats.reliability.toFixed(1)}%`} next={projectedStats ? `${projectedStats.reliability.toFixed(1)}%` : '—'} />
          </div>

          <div className="min-h-0 border border-[#31483a] bg-[#07150f] p-2 flex flex-col overflow-hidden">
            <div className="text-[10px] font-black mb-1.5">COMPONENT MODIFICATION</div>
            <select value={selectedComponentId} onChange={event => setSelectedComponentId(event.target.value)} className="h-8 bg-[#091813] border border-[#344b3c] px-2 text-[10px] outline-none">
              {components.map(component => <option key={component.instanceId} value={component.instanceId}>{component.name} — {Math.round(pct(component.condition, component.conditionMax))}%</option>)}
            </select>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {([
                ['sharpen', 'Sharpen'],
                ['reinforce', 'Reinforce'],
                ['rebalance', 'Rebalance'],
                ['weatherproof', 'Weatherproof'],
              ] as Array<[ComponentModification, string]>).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setModification(id)} className={`h-8 border text-[9px] font-bold cursor-pointer ${modification === id ? 'border-[#dad54b] bg-[#23431d] text-[#fffbd8]' : 'border-[#3b5242] bg-[#0a1f18] text-[#aab5ac]'}`}>{label}</button>
              ))}
            </div>
            {activeComponent && <div className="mt-2 text-[8.5px] text-[#859689] space-y-1"><Stat label="Part" value={activeComponent.name} /><Stat label="Condition" value={`${activeComponent.condition.toFixed(1)} / ${activeComponent.conditionMax.toFixed(1)}`} />{activeComponent.properties.edgeSharpness !== undefined && <Stat label="Edge" value={`${Math.round(activeComponent.properties.edgeSharpness)}%`} />}{activeComponent.properties.tension !== undefined && <Stat label="Tension" value={`${Math.round(activeComponent.properties.tension)}%`} />}{activeComponent.properties.moistureResistance !== undefined && <Stat label="Moisture resist." value={`${Math.round(activeComponent.properties.moistureResistance)}%`} />}</div>}
          </div>
        </div>

        <div className="shrink-0 p-2.5 border-t border-[#31483a] grid grid-cols-[1.15fr_.85fr] gap-2">
          <button type="button" disabled={!nextRecipe || Boolean(activeQueuedJob)} onClick={queueTier} className="h-11 border border-[#d9d54b] bg-gradient-to-b from-[#486526] to-[#244719] disabled:opacity-35 text-[#fffbd9] font-black text-[12px] flex items-center justify-center gap-2 cursor-pointer"><ArrowUpCircle className="w-4 h-4" /> {nextDef ? `Upgrade to ${nextDef.name}` : 'No tier upgrade'}</button>
          <button type="button" disabled={!activeComponent || Boolean(activeQueuedJob)} onClick={queueModification} className="h-11 border border-[#56705c] bg-[#0d2923] disabled:opacity-35 text-[#ded8c9] font-bold text-[11px] flex items-center justify-center gap-2 cursor-pointer"><Wrench className="w-4 h-4" /> Apply {modification}</button>
        </div>
      </section>

      <aside className="min-h-0 flex flex-col gap-2 overflow-hidden">
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]">
          <div className="h-9 px-2.5 flex items-center gap-2 border-b border-[#31483a]"><Gauge className="w-4 h-4 text-[#e5d574]" /><span className="text-[12px] font-black">UPGRADE INFO</span></div>
          <div className="p-2 text-[9.5px] space-y-1"><Stat label="Derived durability" value={stats.durability.toFixed(0)} /><Stat label="Condition" value={`${stats.conditionPct.toFixed(1)}%`} /><Stat label="Reliability" value={`${stats.reliability.toFixed(1)}%`} /><Stat label="Craft worker" value={idleWorker?.name || 'None idle'} /></div>
        </section>

        <section className="min-h-0 flex-1 border border-[#40503d] bg-[#0b201a] flex flex-col overflow-hidden">
          <div className="h-9 shrink-0 px-2.5 flex items-center justify-between border-b border-[#31483a]"><span className="text-[12px] font-black">UPGRADE QUEUE</span><span className="text-[10px] text-[#dfcc68]">{queue.length}/3</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {queue.length === 0 ? <div className="text-[10px] text-[#73877a] italic">No upgrade jobs.</div> : queue.map(job => {
              const progress = job.totalSeconds > 0 ? Math.min(100, job.progressSeconds / job.totalSeconds * 100) : 0;
              const targetDef = ITEMS_DATABASE[job.targetItemId || job.sourceItemId];
              return (
                <div key={job.id} className="p-2 border border-[#344d3d] bg-[#081813]">
                  <div className="flex gap-2"><CraftedItemArt itemId={job.targetItemId || job.sourceItemId} size={34} /><div className="min-w-0 flex-1"><div className="text-[10px] font-bold truncate">{targetDef?.name || job.sourceItemId}</div><div className="text-[8.5px] text-[#8fa095]">{job.mode === 'tier' ? 'tier upgrade' : job.modification} · {job.status.replace('_', ' ')}</div></div></div>
                  {job.blockedReasons[0] ? <div className="mt-1 text-[8px] text-[#e0a36c] truncate">{job.blockedReasons[0]}</div> : <><div className="h-1.5 mt-1.5 bg-[#17271f]"><div className="h-full bg-[#4fc5a5]" style={{ width: `${progress}%` }} /></div><div className="mt-1 text-[8px] text-[#819085]">{formatSeconds(Math.max(0, job.totalSeconds - job.progressSeconds))}</div></>}
                  <div className="mt-1 flex justify-end gap-1"><button type="button" onClick={() => onTogglePauseUpgrade?.(job.id)} className="w-6 h-5 border border-[#51644f] flex items-center justify-center cursor-pointer">{job.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}</button><button type="button" onClick={() => onCancelUpgrade?.(job.id)} className="w-6 h-5 border border-[#88483c] text-[#ed6d5b] flex items-center justify-center cursor-pointer"><Trash2 className="w-3 h-3" /></button></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="h-[150px] shrink-0 border border-[#40503d] bg-[#0b201a] flex flex-col overflow-hidden">
          <div className="h-9 shrink-0 px-2.5 flex items-center gap-2 border-b border-[#31483a]"><Clock3 className="w-3.5 h-3.5 text-[#e5d574]" /><span className="text-[11px] font-black">UPGRADE HISTORY</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {history.length === 0 ? <div className="text-[9px] text-[#74877a] italic">No upgrade history yet.</div> : history.slice(0, 8).map(entry => <div key={entry.id} className="flex items-start justify-between gap-2 text-[8.5px] border-b border-[#273b30] pb-1"><div className="min-w-0"><div className="text-[#bdc6bc] truncate">{ITEMS_DATABASE[entry.fromItemId]?.name || entry.fromItemId} → {ITEMS_DATABASE[entry.toItemId]?.name || entry.toItemId}</div><div className="text-[#7e9184]">{entry.mode === 'tier' ? 'tier upgrade' : `${entry.modification} ${entry.componentName || ''}`}</div></div><span className="shrink-0 text-[#697d70]">{ageText(currentMinute, entry.gameMinute)}</span></div>)}
          </div>
        </section>
      </aside>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2"><span className="text-[#829487]">{label}</span><strong className="text-[#ded6c5] font-mono text-right truncate">{value}</strong></div>
);

const CompareRow: React.FC<{ label: string; current: string; next: string }> = ({ label, current, next }) => (
  <div className="grid grid-cols-[1fr_.65fr_auto_.65fr] items-center gap-2 min-h-7 border-b border-[#273b30] last:border-0 text-[9.5px]"><span className="text-[#aab5aa]">{label}</span><strong className="font-mono text-right text-[#ded7c8]">{current}</strong><ArrowRight className="w-3 h-3 text-[#cdbf68]" /><strong className="font-mono text-[#7fd274]">{next}</strong></div>
);
