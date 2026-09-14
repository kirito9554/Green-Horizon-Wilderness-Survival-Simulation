import React from 'react';
import {
  BarChart3,
  Clock,
  Bookmark,
  ArrowUp,
  X,
  Plus,
  Check,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  UpgradeableTool,
  ToolStats,
  ModificationQueueItem,
  SavedConfiguration,
  ModPart,
} from '../../types/crafting';

interface UpgradeSidebarProps {
  tool: UpgradeableTool | null;
  previewPart: ModPart | null;
  queue: ModificationQueueItem[];
  maxQueueSlots?: number;
  onCancelQueueItem: (id: string) => void;
  onMoveUpQueueItem: (id: string) => void;
  onAddToQueueClick?: () => void;
  savedConfigurations: SavedConfiguration[];
  onApplyConfiguration: (cfg: SavedConfiguration) => void;
  onSaveCurrentConfiguration: () => void;
}

export const UpgradeSidebar: React.FC<UpgradeSidebarProps> = ({
  tool,
  previewPart,
  queue,
  maxQueueSlots = 3,
  onCancelQueueItem,
  onMoveUpQueueItem,
  onAddToQueueClick,
  savedConfigurations,
  onApplyConfiguration,
  onSaveCurrentConfiguration,
}) => {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStats = tool
    ? tool.baseStats
    : {
        durability: 100,
        cuttingPower: 5,
        efficiencyPct: 80,
        weightKg: 0.5,
        reachM: 1.0,
        stealthPct: 90,
      };

  // Compute preview stats if previewPart is provided
  const previewStats: ToolStats = {
    durability: currentStats.durability + (previewPart?.statModifiers.durability || 0),
    cuttingPower: currentStats.cuttingPower + (previewPart?.statModifiers.cuttingPower || 0),
    efficiencyPct: currentStats.efficiencyPct + (previewPart?.statModifiers.efficiencyPct || 0),
    weightKg: Number((currentStats.weightKg + (previewPart?.statModifiers.weightKg || 0)).toFixed(1)),
    reachM: Number((currentStats.reachM + (previewPart?.statModifiers.reachM || 0)).toFixed(1)),
    stealthPct: currentStats.stealthPct + (previewPart?.statModifiers.stealthPct || 0),
  };

  const statRows: Array<{
    label: string;
    current: string | number;
    preview: string | number;
    diff: string;
    positive: boolean | null;
  }> = [
    {
      label: 'Durability',
      current: currentStats.durability,
      preview: previewStats.durability,
      diff: previewStats.durability - currentStats.durability > 0 ? `+${previewStats.durability - currentStats.durability}` : '—',
      positive: previewStats.durability > currentStats.durability,
    },
    {
      label: 'Cutting Power',
      current: currentStats.cuttingPower,
      preview: previewStats.cuttingPower,
      diff: previewStats.cuttingPower - currentStats.cuttingPower > 0 ? `+${previewStats.cuttingPower - currentStats.cuttingPower}` : '—',
      positive: previewStats.cuttingPower > currentStats.cuttingPower,
    },
    {
      label: 'Efficiency',
      current: `${currentStats.efficiencyPct}%`,
      preview: `${previewStats.efficiencyPct}%`,
      diff: previewStats.efficiencyPct - currentStats.efficiencyPct > 0 ? `+${previewStats.efficiencyPct - currentStats.efficiencyPct}%` : '—',
      positive: previewStats.efficiencyPct > currentStats.efficiencyPct,
    },
    {
      label: 'Weight',
      current: `${currentStats.weightKg} kg`,
      preview: `${previewStats.weightKg} kg`,
      diff: previewStats.weightKg - currentStats.weightKg > 0 ? `+${(previewStats.weightKg - currentStats.weightKg).toFixed(1)}` : '—',
      positive: previewStats.weightKg < currentStats.weightKg, // lighter is usually better
    },
    {
      label: 'Reach',
      current: `${currentStats.reachM} m`,
      preview: `${previewStats.reachM} m`,
      diff: previewStats.reachM - currentStats.reachM > 0 ? `+${(previewStats.reachM - currentStats.reachM).toFixed(1)}` : '—',
      positive: previewStats.reachM > currentStats.reachM,
    },
    {
      label: 'Stealth',
      current: `${currentStats.stealthPct}%`,
      preview: `${previewStats.stealthPct}%`,
      diff: previewStats.stealthPct - currentStats.stealthPct > 0 ? `+${previewStats.stealthPct - currentStats.stealthPct}%` : '—',
      positive: previewStats.stealthPct > currentStats.stealthPct,
    },
  ];

  return (
    <div className="flex flex-col h-full gap-3 select-none">
      {/* 1. TOOL STATS COMPARISON TABLE */}
      <div className="p-3 rounded-xl bg-[#0a1712]/90 border border-[#214232]/80 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center gap-2 pb-1.5 border-b border-[#1b3629]">
          <BarChart3 className="w-4 h-4 text-[#38bdf8]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#d4e4db]">
            TOOL STATS COMPARISON
          </h3>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-[#6f8c7b] border-b border-[#152e22]">
              <th className="text-left pb-1 font-semibold">Stat</th>
              <th className="text-center pb-1 font-semibold">Current</th>
              <th className="text-center pb-1 font-semibold text-[#38bdf8]">Preview</th>
              <th className="text-right pb-1 font-semibold">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#12281e]">
            {statRows.map((row) => (
              <tr key={row.label} className="hover:bg-[#0e2118]/50">
                <td className="py-1.5 text-[#9ab3a5] text-[11px] font-medium">{row.label}</td>
                <td className="py-1.5 text-center font-mono text-[#c5d8cc]">{row.current}</td>
                <td className="py-1.5 text-center font-mono font-bold text-[#38bdf8]">
                  {row.preview}
                </td>
                <td className="py-1.5 text-right font-mono font-bold">
                  {row.diff === '—' ? (
                    <span className="text-[#597464]">—</span>
                  ) : (
                    <span className={row.positive ? 'text-[#4ade80]' : 'text-[#f87171]'}>
                      {row.diff}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. MODIFICATION QUEUE */}
      <div className="p-3 rounded-xl bg-[#0a1712]/90 border border-[#214232]/80 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#1b3629]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5eead4]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#d4e4db]">
              MODIFICATION QUEUE
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#38bdf8] px-2 py-0.5 rounded bg-[#102736] border border-[#1e4963]">
            {queue.length} / {maxQueueSlots}
          </span>
        </div>

        <div className="flex flex-col gap-2 min-h-[85px]">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-[#637d6e] italic">
              No modifications queued.
            </div>
          ) : (
            queue.map((item, idx) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-[#07130e] border border-[#1b3528] flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#f5ede0] truncate">
                      {item.actionTitle}
                    </span>
                    <span className="text-[10px] text-[#769382] truncate">{item.detailText}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => onMoveUpQueueItem(item.id)}
                        className="p-1 rounded bg-[#102319] hover:bg-[#1a3828] text-[#86a894] hover:text-[#fff] transition-colors cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancelQueueItem(item.id)}
                      className="p-1 rounded bg-[#102319] hover:bg-[#3b1212] text-[#86a894] hover:text-[#f87171] transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#718d7d]">
                  <span className="font-mono text-[#38bdf8]">{item.progressPct}%</span>
                  <span className="font-mono text-[#5eead4] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(item.remainingSeconds)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#050b08] overflow-hidden border border-[#162a20]">
                  <div
                    className="h-full bg-gradient-to-r from-[#0284c7] to-[#38bdf8] rounded-full transition-all duration-300"
                    style={{ width: `${item.progressPct}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {onAddToQueueClick && (
          <button
            type="button"
            onClick={onAddToQueueClick}
            disabled={queue.length >= maxQueueSlots}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border cursor-pointer ${
              queue.length < maxQueueSlots
                ? 'bg-[#10251c] hover:bg-[#163327] border-[#294c39] text-[#a4bdad] hover:text-[#f0faf4]'
                : 'bg-[#0b1612]/60 border-[#1a2f24] text-[#556b5f] cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add to Queue</span>
          </button>
        )}
      </div>

      {/* 3. SAVED CONFIGURATIONS */}
      <div className="p-3 rounded-xl bg-[#0a1712]/90 border border-[#214232]/80 flex flex-col gap-2 shadow-sm text-xs mt-auto">
        <div className="flex items-center justify-between pb-1 border-b border-[#1b3629]">
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-[#fbbf24]" />
            <h4 className="font-bold uppercase text-[#d4e4db] text-[11px] tracking-wider">
              SAVED CONFIGURATIONS
            </h4>
          </div>
          <span className="text-[10px] text-[#698574] font-mono">
            {savedConfigurations.length} / 5
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {savedConfigurations.map((cfg) => (
            <div
              key={cfg.id}
              className="flex items-center justify-between p-2 rounded-lg bg-[#07130e] border border-[#1a3427] hover:border-[#2b543f] transition-all"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[#e1ece5] text-xs truncate">{cfg.name}</span>
                <span className="text-[10px] text-[#718d7d] truncate">{cfg.description}</span>
              </div>

              <button
                type="button"
                onClick={() => onApplyConfiguration(cfg)}
                className="px-2.5 py-1 rounded bg-[#10291d] hover:bg-[#19402e] border border-[#2a573f] text-[#86efac] text-[11px] font-bold uppercase transition-colors shrink-0 cursor-pointer"
              >
                Apply
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSaveCurrentConfiguration}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-1 rounded-md bg-[#0e2118] hover:bg-[#142e22] border border-[#224734] text-[#a1bead] text-[11px] font-bold uppercase transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Save Current Configuration</span>
        </button>
      </div>
    </div>
  );
};
