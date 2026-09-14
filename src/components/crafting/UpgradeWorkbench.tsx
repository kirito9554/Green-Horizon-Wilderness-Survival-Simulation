import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Minus,
  RefreshCw,
  ArrowUp,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
} from 'lucide-react';
import { UpgradeableTool, ToolModSlot, ModPart } from '../../types/crafting';
import { CraftedItemArt } from './CraftedItemArt';

interface UpgradeWorkbenchProps {
  tool: UpgradeableTool | null;
  availableParts: ModPart[];
  selectedPartId: string;
  onSelectPart: (part: ModPart) => void;
  onInstallPart: (slot: ToolModSlot, part: ModPart) => void;
  onRemovePart: (slot: ToolModSlot) => void;
  onReplacePart: (slot: ToolModSlot, part: ModPart) => void;
  activeSlot: ToolModSlot;
  onSelectSlot: (slot: ToolModSlot) => void;
}

export const UpgradeWorkbench: React.FC<UpgradeWorkbenchProps> = ({
  tool,
  availableParts,
  selectedPartId,
  onSelectPart,
  onInstallPart,
  onRemovePart,
  onReplacePart,
  activeSlot,
  onSelectSlot,
}) => {
  const [partSlotFilter, setPartSlotFilter] = useState<'all' | ToolModSlot>('all');
  const [partSearch, setPartSearch] = useState('');

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center rounded-xl bg-[#091611]/80 border border-[#1d382b]/60">
        <Wrench className="w-12 h-12 text-[#466352] mb-3" />
        <p className="text-sm font-semibold text-[#8fa799]">Select equipment to modify</p>
      </div>
    );
  }

  const selectedPart = availableParts.find((p) => p.id === selectedPartId) || availableParts[1] || availableParts[0] || null;

  // Filter parts
  const filteredParts = availableParts.filter((p) => {
    if (partSlotFilter !== 'all' && p.slotType !== partSlotFilter) return false;
    if (partSearch.trim()) {
      const q = partSearch.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const slotsList: Array<{ slot: ToolModSlot; label: string }> = [
    { slot: 'blade', label: 'BLADE' },
    { slot: 'handle', label: 'HANDLE' },
    { slot: 'binding', label: 'BINDING' },
    { slot: 'grip', label: 'GRIP' },
  ];

  return (
    <div className="flex flex-col h-full rounded-xl bg-[#0a1712]/90 border border-[#264a38]/80 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
      {/* Top Header: Selected Tool Info */}
      <div className="p-3.5 bg-gradient-to-r from-[#122b22] to-[#0c1e17] border-b border-[#213f2f] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#07130e] border border-[#234533] flex items-center justify-center shrink-0">
            <CraftedItemArt itemId={tool.name} recipeId={tool.name} size={36} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#f5ede0] font-serif tracking-wide">
                {tool.name}
              </h2>
              {tool.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#1b3a2a] text-[#7ce0a5] border border-[#2e5d44] uppercase"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[#9eb5a7] mt-0.5">{tool.description}</p>
          </div>
        </div>
      </div>

      {/* WORKBENCH SCHEMATIC AREA */}
      <div className="p-3 flex flex-col gap-2.5 bg-[#081510]/80 border-b border-[#1c3629]">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#a2bba9]">
          <span className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-[#38bdf8]" />
            MODIFICATION WORKBENCH
          </span>
          <span className="text-[10px] text-[#698574]">4 MODULAR SLOTS</span>
        </div>

        {/* 4 Modular Slots Banner & Central Visual */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {slotsList.map(({ slot, label }) => {
            const installed = tool.slots[slot];
            const isActive = activeSlot === slot;

            return (
              <button
                key={slot}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className={`flex flex-col p-2 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#153a4c]/50 border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                    : 'bg-[#0d1e17] hover:bg-[#132c21] border-[#203a2c]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-[#769382] uppercase">
                  <span>{label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />}
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-6 h-6 rounded bg-[#06100c] border border-[#1b3327] flex items-center justify-center shrink-0">
                    <CraftedItemArt itemId={installed.partName} recipeId={installed.partName} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-[#e1ece5] truncate">
                      {installed.partName}
                    </div>
                    <div className="text-[9px] text-[#38bdf8] font-mono">
                      Tier {installed.tier}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Workbench Control Buttons */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => selectedPart && onInstallPart(activeSlot, selectedPart)}
            disabled={!selectedPart}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#102b1f] hover:bg-[#183d2c] border border-[#2b5941] text-[#9ee6be] text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={() => onRemovePart(activeSlot)}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#1a1c1a] hover:bg-[#282121] border border-[#3b2b2b] text-[#dca6a6] text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <Minus className="w-3 h-3" />
            <span>Remove</span>
          </button>
          <button
            type="button"
            onClick={() => selectedPart && onReplacePart(activeSlot, selectedPart)}
            disabled={!selectedPart}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#142838] hover:bg-[#1b3a52] border border-[#2d5978] text-[#9ed4f8] text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Replace</span>
          </button>
          <button
            type="button"
            onClick={() => selectedPart && onInstallPart(activeSlot, selectedPart)}
            disabled={!selectedPart}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-[#2b2410] hover:bg-[#3d3316] border border-[#5e4f24] text-[#fcd34d] text-[11px] font-bold uppercase transition-colors cursor-pointer"
          >
            <ArrowUp className="w-3 h-3" />
            <span>Upgrade</span>
          </button>
        </div>
      </div>

      {/* AVAILABLE PARTS SECTION */}
      <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#a2bba9]">
          <span>AVAILABLE PARTS</span>
          <span className="text-[10px] text-[#698574]">{filteredParts.length} PARTS</span>
        </div>

        {/* Filter bar for parts */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(['all', 'blade', 'handle', 'binding', 'grip'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setPartSlotFilter(slot)}
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase transition-colors cursor-pointer ${
                  partSlotFilter === slot
                    ? 'bg-[#38bdf8] text-[#081510]'
                    : 'bg-[#10231b] text-[#7d9b89] hover:text-[#d3e3da]'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#07130e] border border-[#1d382a] text-[10px]">
            <Search className="w-3 h-3 text-[#587363]" />
            <input
              type="text"
              value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)}
              placeholder="Search parts..."
              className="bg-transparent text-[11px] text-[#d6e5dc] placeholder-[#587363] outline-none w-20 sm:w-28 font-sans"
            />
          </div>
        </div>

        {/* Parts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredParts.map((part) => {
            const isSelected = part.id === selectedPartId;
            const isRare = part.tier === 'Rare';
            const isAdvanced = part.tier === 'Advanced';

            return (
              <button
                key={part.id}
                type="button"
                onClick={() => {
                  onSelectPart(part);
                  onSelectSlot(part.slotType);
                }}
                className={`p-2 rounded-lg border text-left transition-all duration-150 cursor-pointer relative ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#183949] to-[#0c1f28] border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                    : isRare
                    ? 'bg-[#1f152d]/80 border-[#9333ea]/60 hover:border-[#c084fc]'
                    : 'bg-[#0b1812]/90 hover:bg-[#12251d] border-[#1d382b]'
                }`}
              >
                {/* Count Badge */}
                <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-bold px-1 rounded bg-[#000]/70 text-[#cbd5e1]">
                  x{part.count}
                </span>

                <div className="w-full h-12 rounded bg-[#06100c] border border-[#182f23] flex items-center justify-center mb-1.5 overflow-hidden">
                  <CraftedItemArt itemId={part.name} recipeId={part.name} size={32} />
                </div>

                <div className="text-[11px] font-bold text-[#e1ece5] truncate">
                  {part.name}
                </div>
                <div
                  className={`text-[9px] font-semibold uppercase ${
                    isRare ? 'text-[#c084fc]' : isAdvanced ? 'text-[#f59e0b]' : 'text-[#7d9b89]'
                  }`}
                >
                  {part.tier}
                </div>
              </button>
            );
          })}
        </div>

        {/* SELECTED PART DETAILS CARD (Matching Image 3) */}
        {selectedPart && (
          <div className="mt-2 p-3 rounded-lg bg-[#07130e]/95 border border-[#213f2e] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#f5ede0] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
                  {selectedPart.name}
                </h4>
                <span className="text-[10px] text-[#769382]">
                  {selectedPart.slotType.toUpperCase()} PART • {selectedPart.tier.toUpperCase()}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onInstallPart(selectedPart.slotType, selectedPart)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0ea5e9] hover:to-[#0284c7] text-[#f0f9ff] text-xs font-bold uppercase transition-all shadow-[0_0_8px_rgba(56,189,248,0.3)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Workbench</span>
              </button>
            </div>

            <p className="text-[11px] text-[#9eb5a7] leading-relaxed">
              {selectedPart.description}
            </p>

            {/* Stat Diff pills */}
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              {selectedPart.statModifiers.cuttingPower !== undefined && selectedPart.statModifiers.cuttingPower !== 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#12281e] border border-[#225239] text-[#86efac] font-mono">
                  Cutting Power: {selectedPart.statModifiers.cuttingPower > 0 ? `+${selectedPart.statModifiers.cuttingPower}` : selectedPart.statModifiers.cuttingPower}
                </span>
              )}
              {selectedPart.statModifiers.durability !== undefined && selectedPart.statModifiers.durability !== 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#12281e] border border-[#225239] text-[#86efac] font-mono">
                  Durability: {selectedPart.statModifiers.durability > 0 ? `+${selectedPart.statModifiers.durability}` : selectedPart.statModifiers.durability}
                </span>
              )}
              {selectedPart.statModifiers.weightKg !== undefined && selectedPart.statModifiers.weightKg !== 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#1b2319] border border-[#394a2b] text-[#fde047] font-mono">
                  Weight: {selectedPart.statModifiers.weightKg > 0 ? `+${selectedPart.statModifiers.weightKg} kg` : `${selectedPart.statModifiers.weightKg} kg`}
                </span>
              )}
              {selectedPart.statModifiers.efficiencyPct !== undefined && selectedPart.statModifiers.efficiencyPct !== 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#102430] border border-[#214f6b] text-[#7dd3fc] font-mono">
                  Efficiency: +{selectedPart.statModifiers.efficiencyPct}%
                </span>
              )}
            </div>

            {/* Compatible With list */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#7d9b89] pt-1 border-t border-[#182e21]">
              <span className="font-semibold">Compatible with:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {selectedPart.compatibleTools.map((tName) => (
                  <span
                    key={tName}
                    className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#0f2119] text-[#d6e5dc]"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-[#4ade80]" />
                    {tName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
