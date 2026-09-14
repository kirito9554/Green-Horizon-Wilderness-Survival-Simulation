import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  Hammer,
  Package,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { GameState, InventoryItem } from '../../types';
import type { ComponentInstance } from '../../types/craftingSimulation';
import type { MaintenanceMode } from '../../types/maintenanceSimulation';
import { ITEMS_DATABASE } from '../../data/items';
import { CraftedItemArt } from './CraftedItemArt';

interface RepairViewProps {
  state: GameState;
  onQueueMaintenance?: (
    targetInstanceId: string,
    mode: MaintenanceMode,
    componentInstanceId?: string,
    survivorId?: string,
  ) => void;
  onCancelMaintenance?: (jobId: string) => void;
  onTogglePauseMaintenance?: (jobId: string) => void;
  onDismantleTool?: (instanceId: string, survivorId?: string) => void;
}

function pct(current: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
}

function formatSeconds(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(value / 60);
  const secs = value % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function componentStatus(component: ComponentInstance): string {
  const ratio = pct(component.condition, component.conditionMax);
  if (component.condition <= 0) return 'FAILED — replacement or major repair required';
  if (ratio < 25) return 'Critical structural damage';
  if (ratio < 50) return 'Heavily worn';
  if (ratio < 75) return 'Serviceable wear';
  if (ratio < 95) return 'Good condition';
  return 'Excellent condition';
}

function ageText(currentMinute: number, eventMinute: number): string {
  const elapsed = Math.max(0, currentMinute - eventMinute);
  if (elapsed < 60) return `${Math.max(1, Math.round(elapsed))}m ago`;
  if (elapsed < 1440) return `${Math.round(elapsed / 60)}h ago`;
  return `${Math.round(elapsed / 1440)}d ago`;
}

export const RepairView: React.FC<RepairViewProps> = ({
  state,
  onQueueMaintenance,
  onCancelMaintenance,
  onTogglePauseMaintenance,
  onDismantleTool,
}) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<MaintenanceMode>('repair');

  const tools = useMemo(
    () => state.inventory.items.filter(item => {
      const def = ITEMS_DATABASE[item.itemId];
      return Boolean(def && (def.category === 'tool' || def.toolProperties));
    }),
    [state.inventory.items],
  );

  const filteredTools = useMemo(() => {
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
      const weakest = [...components].sort((a, b) => pct(a.condition, a.conditionMax) - pct(b.condition, b.conditionMax))[0];
      if (weakest) setSelectedComponentId(weakest.instanceId);
    }
  }, [activeItem?.instanceId, components, selectedComponentId]);

  const activeComponent = components.find(component => component.instanceId === selectedComponentId) || components[0];
  const queue = state.maintenanceSystem?.queue || [];
  const history = state.maintenanceSystem?.history || [];
  const activeQueuedJob = activeItem ? queue.find(job => job.targetInstanceId === activeItem.instanceId) : undefined;
  const idleWorker = state.survivors
    .filter(survivor => survivor.currentAction.type === 'idle')
    .sort((a, b) => (b.skills.crafting || 1) - (a.skills.crafting || 1))[0];
  const currentMinute = Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);

  const aggregateCondition = activeItem && activeItem.conditionMax
    ? pct(activeItem.condition || 0, activeItem.conditionMax)
    : 0;
  const permanentDamage = components.reduce((sum, component) => sum + (component.permanentDamage || 0), 0);
  const originalStructuralMax = components.reduce((sum, component) => sum + component.originalConditionMax, 0);
  const permanentDamagePct = originalStructuralMax > 0 ? permanentDamage / originalStructuralMax * 100 : 0;

  const issues = components
    .filter(component => pct(component.condition, component.conditionMax) < 70
      || (component.properties.edgeSharpness !== undefined && component.properties.edgeSharpness < 45)
      || (component.properties.tension !== undefined && component.properties.tension < 45))
    .map(component => {
      const details: string[] = [];
      if (pct(component.condition, component.conditionMax) < 70) details.push(componentStatus(component));
      if (component.properties.edgeSharpness !== undefined && component.properties.edgeSharpness < 45) details.push(`edge ${Math.round(component.properties.edgeSharpness)}%`);
      if (component.properties.tension !== undefined && component.properties.tension < 45) details.push(`tension ${Math.round(component.properties.tension)}%`);
      return `${component.name}: ${details.join(', ')}`;
    });

  if (!activeItem || !activeDef) {
    return (
      <div className="h-full flex items-center justify-center border border-[#40503d] bg-[#071711] text-[#8fa194]">
        No repairable equipment in inventory.
      </div>
    );
  }

  const startSelectedMode = () => {
    if (!activeComponent || activeQueuedJob) return;
    onQueueMaintenance?.(activeItem.instanceId, mode, activeComponent.instanceId, idleWorker?.id);
  };

  return (
    <div className="h-full min-h-0 grid grid-cols-[.92fr_1.55fr_.83fr] gap-2 overflow-hidden text-[#e8e2d4]">
      <section className="min-h-0 border border-[#40503d] bg-[#071711] p-2 flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-2 pb-2 border-b border-[#31483a]">
          <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-[#e5d574]" /><h3 className="text-[13px] font-black">REPAIRABLE EQUIPMENT</h3></div>
          <span className="text-[10px] text-[#879789]">{tools.length} instances</span>
        </div>
        <label className="shrink-0 h-8 mt-2 px-2 flex items-center gap-2 border border-[#31483a] bg-[#091813]">
          <Search className="w-3.5 h-3.5 text-[#718678]" />
          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search equipment..." className="min-w-0 flex-1 bg-transparent outline-none text-[11px] text-[#e9e2d5]" />
        </label>
        <div className="min-h-0 flex-1 mt-2 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-3 gap-1.5">
            {filteredTools.map(item => {
              const def = ITEMS_DATABASE[item.itemId];
              const condition = pct(item.condition || 0, item.conditionMax || 100);
              const selected = item.instanceId === activeItem.instanceId;
              const locked = (item.reservedQuantity || 0) > 0;
              return (
                <button key={item.instanceId} type="button" onClick={() => setSelectedInstanceId(item.instanceId)} className={`min-h-[98px] p-1.5 border text-center cursor-pointer ${selected ? 'border-[#ddd94e] bg-[#173421]' : 'border-[#304739] bg-[#091813] hover:bg-[#10251d]'}`}>
                  <div className="h-52px min-h-[48px] flex items-center justify-center"><CraftedItemArt itemId={item.itemId} size={44} /></div>
                  <div className="text-[10px] font-bold truncate">{def?.name || item.itemId}</div>
                  <div className={`text-[9px] font-mono ${condition < 40 ? 'text-[#ef7564]' : condition < 70 ? 'text-[#efc85d]' : 'text-[#82d76b]'}`}>{Math.round(condition)}%</div>
                  {locked && <div className="text-[8px] text-[#d8a560] truncate">reserved</div>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="min-h-0 border border-[#40503d] bg-[#081813] flex flex-col overflow-hidden">
        <div className="shrink-0 p-2.5 border-b border-[#31483a] flex items-center gap-3">
          <div className="w-16 h-16 border border-[#405746] bg-[#07120e] flex items-center justify-center"><CraftedItemArt itemId={activeItem.itemId} size={56} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-black truncate">{activeDef.name}</h2>
            <p className="text-[10px] text-[#9da99d] line-clamp-2">{activeDef.description}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[9px]"><span className="px-1.5 py-0.5 border border-[#49604c] bg-[#10261d]">{activeItem.quality || 'standard'}</span><span className="text-[#d8c66e]">Condition {Math.round(aggregateCondition)}%</span><span className="text-[#c28f78]">Permanent wear {permanentDamagePct.toFixed(1)}%</span></div>
          </div>
        </div>

        <div className="shrink-0 px-2.5 py-2 border-b border-[#31483a]">
          <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-black tracking-wide">REPAIR BENCH — PHYSICAL COMPONENTS</span><span className="text-[9px] text-[#788b7d]">select a real part</span></div>
          <div className="grid grid-cols-4 gap-1.5">
            {components.map(component => {
              const condition = pct(component.condition, component.conditionMax);
              const selected = component.instanceId === activeComponent?.instanceId;
              return (
                <button key={component.instanceId} type="button" onClick={() => setSelectedComponentId(component.instanceId)} className={`min-h-[82px] p-1.5 border text-left cursor-pointer ${selected ? 'border-[#e4d94d] bg-[#173421]' : 'border-[#31483a] bg-[#091813]'}`}>
                  <div className="flex items-center justify-between gap-1"><span className="text-[10px] font-black truncate">{component.name}</span><span className={`text-[10px] font-mono ${condition < 35 ? 'text-[#ef6b59]' : condition < 70 ? 'text-[#e6c75d]' : 'text-[#75d56b]'}`}>{Math.round(condition)}%</span></div>
                  <div className="h-1.5 mt-1 bg-[#17261f]"><div className={condition < 35 ? 'h-full bg-[#dc5d4c]' : condition < 70 ? 'h-full bg-[#d5b74b]' : 'h-full bg-[#58b95c]'} style={{ width: `${condition}%` }} /></div>
                  <div className="mt-1 text-[8.5px] text-[#8e9c90] line-clamp-2">{componentStatus(component)}</div>
                  <div className="mt-0.5 text-[8px] text-[#6e8174]">max {component.conditionMax.toFixed(0)} / original {component.originalConditionMax.toFixed(0)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 grid grid-cols-[1fr_.92fr] gap-2 p-2.5 overflow-hidden">
          <div className="min-h-0 border border-[#31483a] bg-[#07150f] p-2 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-black mb-1.5 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-[#e6a354]" /> IDENTIFIED ISSUES</div>
            {issues.length ? issues.map((issue, index) => <div key={index} className="py-1.5 border-b border-[#283b30] last:border-0 text-[10px] text-[#cfb9a8]">{issue}</div>) : <div className="text-[10px] text-[#779282]">No significant component issues detected.</div>}
          </div>
          <div className="min-h-0 border border-[#31483a] bg-[#07150f] p-2 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-black mb-1.5 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#78d27a]" /> SELECTED COMPONENT</div>
            {activeComponent && (
              <div className="space-y-1 text-[9.5px] text-[#aeb9ae]">
                <Stat label="Condition" value={`${activeComponent.condition.toFixed(1)} / ${activeComponent.conditionMax.toFixed(1)}`} />
                <Stat label="Quality" value={activeComponent.quality} />
                {activeComponent.properties.edgeSharpness !== undefined && <Stat label="Edge sharpness" value={`${Math.round(activeComponent.properties.edgeSharpness)}%`} />}
                {activeComponent.properties.tension !== undefined && <Stat label="Tension" value={`${Math.round(activeComponent.properties.tension)}%`} />}
                {activeComponent.properties.moistureResistance !== undefined && <Stat label="Moisture resistance" value={`${Math.round(activeComponent.properties.moistureResistance)}%`} />}
                {activeComponent.properties.gripComfort !== undefined && <Stat label="Grip comfort" value={`${Math.round(activeComponent.properties.gripComfort)}%`} />}
                <Stat label="Permanent damage" value={(activeComponent.permanentDamage || 0).toFixed(1)} />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 p-2.5 border-t border-[#31483a]">
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {([
              ['maintenance', 'Maintain'],
              ['repair', 'Repair'],
              ['quick_patch', 'Quick Patch'],
              ['replace', 'Replace Part'],
            ] as Array<[MaintenanceMode, string]>).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setMode(id)} className={`h-8 border text-[10px] font-bold cursor-pointer ${mode === id ? 'border-[#dcd74c] bg-[#24451d] text-[#fffbd7]' : 'border-[#3f5746] bg-[#0b211a] text-[#aab5ab]'}`}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <button type="button" disabled={!activeComponent || Boolean(activeQueuedJob)} onClick={startSelectedMode} className="h-10 border border-[#d8d54c] bg-gradient-to-b from-[#466326] to-[#244719] disabled:opacity-40 text-[#fffbdc] font-black text-[12px] flex items-center justify-center gap-2 cursor-pointer"><Wrench className="w-4 h-4" /> Queue {mode.replace('_', ' ')}</button>
            <button type="button" disabled={!activeQueuedJob} onClick={() => activeQueuedJob && onTogglePauseMaintenance?.(activeQueuedJob.id)} className="h-10 px-3 border border-[#52654f] bg-[#0d2923] disabled:opacity-35 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
            <button type="button" disabled={Boolean(activeQueuedJob)} onClick={() => onDismantleTool?.(activeItem.instanceId, idleWorker?.id)} className="h-10 px-3 border border-[#7c5440] bg-[#281711] disabled:opacity-35 text-[#e2aa82] text-[10px] font-bold cursor-pointer">Dismantle</button>
          </div>
        </div>
      </section>

      <aside className="min-h-0 flex flex-col gap-2 overflow-hidden">
        <section className="shrink-0 border border-[#40503d] bg-[#0b201a]">
          <div className="h-9 px-2.5 flex items-center gap-2 border-b border-[#31483a]"><Hammer className="w-4 h-4 text-[#e5d574]" /><span className="text-[12px] font-black">REPAIR INFO</span></div>
          <div className="p-2 text-[9.5px] space-y-1"><Stat label="Current condition" value={`${Math.round(aggregateCondition)}%`} /><Stat label="Component count" value={`${components.length}`} /><Stat label="Permanent wear" value={`${permanentDamagePct.toFixed(1)}%`} /><Stat label="Idle technician" value={idleWorker?.name || 'None'} /></div>
        </section>

        <section className="min-h-0 flex-1 border border-[#40503d] bg-[#0b201a] flex flex-col overflow-hidden">
          <div className="h-9 shrink-0 px-2.5 flex items-center justify-between border-b border-[#31483a]"><span className="text-[12px] font-black">REPAIR QUEUE</span><span className="text-[10px] text-[#dfcc68]">{queue.length}/3</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {queue.length === 0 ? <div className="text-[10px] text-[#73877a] italic">No maintenance jobs.</div> : queue.map(job => {
              const item = state.inventory.items.find(candidate => candidate.instanceId === job.targetInstanceId);
              const def = ITEMS_DATABASE[job.targetItemId];
              const progress = job.totalSeconds > 0 ? Math.min(100, job.progressSeconds / job.totalSeconds * 100) : 0;
              return (
                <div key={job.id} className="p-2 border border-[#344d3d] bg-[#081813]">
                  <div className="flex items-center gap-2"><CraftedItemArt itemId={job.targetItemId} size={32} /><div className="min-w-0 flex-1"><div className="text-[10px] font-bold truncate">{def?.name || job.targetItemId}</div><div className="text-[8.5px] text-[#91a095]">{job.mode.replace('_', ' ')} · {job.status.replace('_', ' ')}</div></div></div>
                  {job.blockedReasons[0] ? <div className="mt-1 text-[8px] text-[#e0a36c] truncate">{job.blockedReasons[0]}</div> : <><div className="h-1.5 mt-1.5 bg-[#17271f]"><div className="h-full bg-[#4fc5a5]" style={{ width: `${progress}%` }} /></div><div className="mt-1 text-[8px] text-[#819085]">{formatSeconds(Math.max(0, job.totalSeconds - job.progressSeconds))}</div></>}
                  <div className="mt-1 flex justify-end gap-1"><button type="button" onClick={() => onTogglePauseMaintenance?.(job.id)} className="w-6 h-5 border border-[#51644f] flex items-center justify-center cursor-pointer">{job.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}</button><button type="button" onClick={() => onCancelMaintenance?.(job.id)} className="w-6 h-5 border border-[#88483c] text-[#ed6d5b] flex items-center justify-center cursor-pointer"><Trash2 className="w-3 h-3" /></button></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="h-[150px] shrink-0 border border-[#40503d] bg-[#0b201a] flex flex-col overflow-hidden">
          <div className="h-9 shrink-0 px-2.5 flex items-center gap-2 border-b border-[#31483a]"><Clock3 className="w-3.5 h-3.5 text-[#e5d574]" /><span className="text-[11px] font-black">RECENT MAINTENANCE</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {history.length === 0 ? <div className="text-[9px] text-[#74877a] italic">No maintenance history yet.</div> : history.slice(0, 8).map(entry => <div key={entry.id} className="flex items-start justify-between gap-2 text-[8.5px] border-b border-[#273b30] pb-1"><div className="min-w-0"><div className="text-[#bdc6bc] truncate">{ITEMS_DATABASE[entry.targetItemId]?.name || entry.targetItemId}</div><div className="text-[#7e9184]">{entry.mode.replace('_', ' ')}{entry.componentName ? ` · ${entry.componentName}` : ''}</div></div><span className="shrink-0 text-[#697d70]">{ageText(currentMinute, entry.gameMinute)}</span></div>)}
          </div>
        </section>
      </aside>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2"><span className="text-[#829487]">{label}</span><strong className="text-[#ded6c5] font-mono text-right truncate">{value}</strong></div>
);
