import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Weight, 
  Maximize2, 
  Utensils, 
  Droplets, 
  Trash2, 
  Info,
  CircleDot,
  BookOpen,
  Wrench,
  Clock,
  Thermometer,
  ShieldCheck
} from 'lucide-react';
import { GameState, ItemCategory, ItemDefinition } from '../../types';
import { ITEMS_DATABASE, RAW_MATERIALS_ITEMS } from '../../data/items';
import { calculateInventoryOccupancy } from '../../simulation/simEngine';
import { ItemIcon } from '../common/ItemIcon';
import { QualityBadge } from '../common/QualityBadge';
import { 
  QUALITY_CONFIG, 
  getDominantQuality, 
  getFreshnessStage, 
  FRESHNESS_CONFIG, 
  getConditionStage, 
  CONDITION_CONFIG 
} from '../../utils/qualityUtils';
import { analyzeItemSpoilage } from '../../simulation/itemSimulation';

interface InventoryViewProps {
  state: GameState;
  onConsumeItem: (instanceId: string, survivorId?: string) => void;
  onDiscardItem: (instanceId: string, quantity: number) => void;
  onNavigateTab: (tab: 'crafting') => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  state,
  onConsumeItem,
  onDiscardItem,
  onNavigateTab,
}) => {
  const { inventory, survivors } = state;
  const [viewMode, setViewMode] = useState<'storage' | 'raw_codex'>('storage');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
  const [inspectedInstanceId, setInspectedInstanceId] = useState<string | null>(null);
  const [inspectedCodexId, setInspectedCodexId] = useState<string | null>(null);

  const occupancy = calculateInventoryOccupancy(inventory.items);
  const weightPercent = Math.min(100, Math.round((occupancy.weight / inventory.maxWeightKg) * 100));
  const volumePercent = Math.min(100, Math.round((occupancy.volume / inventory.maxVolumeL) * 100));

  // Category filter tabs
  const categories: Array<{ id: ItemCategory | 'all'; label: string }> = [
    { id: 'all', label: 'Tất cả (All)' },
    { id: 'food', label: 'Thực phẩm (Food)' },
    { id: 'water', label: 'Nước uống (Water)' },
    { id: 'raw_material', label: 'Nguyên liệu (Raw)' },
    { id: 'tool', label: 'Công cụ (Tools)' },
    { id: 'component', label: 'Thành phần (Parts)' },
    { id: 'medicine', label: 'Y tế (Medicine)' },
  ];

  // Filtered item list
  const filteredItems = inventory.items.filter(item => {
    const def = ITEMS_DATABASE[item.itemId];
    if (!def) return false;
    if (selectedCategory !== 'all' && def.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return def.name.toLowerCase().includes(q) || def.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const inspectedItem = inventory.items.find(i => i.instanceId === inspectedInstanceId);
  const inspectedDef = inspectedItem ? ITEMS_DATABASE[inspectedItem.itemId] : null;

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto bg-[#0d1410] text-[#e2d5bd]">
      {/* 1. Storage Header & Dual Capacity Meters (Weight & Volume) */}
      <div className="bg-[#141d18] border border-[#27382d] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24342a] pb-2">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-serif font-bold text-[#f2e7d3]">
              Kho bãi & Sức chứa định cư
            </h2>
            <span className="text-xs text-[#8ea596]">({inventory.items.length} ngăn đồ)</span>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#0f1712] p-0.5 rounded-lg border border-[#24362b]">
            <button
              onClick={() => setViewMode('storage')}
              className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'storage'
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-[#8ea596] hover:text-[#f2e7d3]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Kho chứa</span>
            </button>
            <button
              onClick={() => setViewMode('raw_codex')}
              className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'raw_codex'
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'text-[#8ea596] hover:text-[#f2e7d3]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Bách khoa 82 nguyên liệu thô</span>
            </button>
          </div>
        </div>

        {viewMode === 'storage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Weight Meter */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="flex items-center gap-1 text-[#a5b7aa]">
                  <Weight className="w-3.5 h-3.5 text-emerald-400" />
                  Tổng trọng lượng (Weight)
                </span>
                <span className={weightPercent > 90 ? 'text-red-400 font-bold' : 'text-[#f2e7d3]'}>
                  {occupancy.weight} / {inventory.maxWeightKg} kg ({weightPercent}%)
                </span>
              </div>
              <div className="w-full bg-[#121914] h-2 rounded-full overflow-hidden border border-[#28382d]">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    weightPercent > 90 ? 'bg-red-500' : weightPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${weightPercent}%` }}
                />
              </div>
            </div>

            {/* Volume Meter */}
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="flex items-center gap-1 text-[#a5b7aa]">
                  <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                  Tổng thể tích kho (Volume)
                </span>
                <span className={volumePercent > 90 ? 'text-red-400 font-bold' : 'text-[#f2e7d3]'}>
                  {occupancy.volume} / {inventory.maxVolumeL} L ({volumePercent}%)
                </span>
              </div>
              <div className="w-full bg-[#121914] h-2 rounded-full overflow-hidden border border-[#28382d]">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    volumePercent > 90 ? 'bg-red-500' : volumePercent > 70 ? 'bg-amber-500' : 'bg-sky-500'
                  }`}
                  style={{ width: `${volumePercent}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Search & Category Filters (Storage Mode) or Search Box (Codex Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewMode === 'storage' ? (
          /* Category Pills */
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-[#18231d] text-[#8ea596] hover:text-[#f0e6d2] hover:bg-[#1f2d24] border border-[#26372c]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[#a89274]">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-[#f5e6cc]">Toàn bộ 82 vật phẩm nguyên liệu thô tự nhiên</span>
            <span className="text-[11px] text-[#788e80]">(Iconset chuẩn 1:1)</span>
          </div>
        )}

        {/* Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#788e80]" />
          <input
            type="text"
            placeholder={viewMode === 'storage' ? "Tìm vật phẩm trong kho..." : "Tìm nguyên liệu thô..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-[#141d18] border border-[#27382d] rounded-lg text-xs text-[#f2e7d3] placeholder-[#65796c] focus:outline-none focus:border-emerald-500 w-52"
          />
        </div>
      </div>

      {/* 3. Items Grid: Storage Mode VS Codex Mode */}
      {viewMode === 'storage' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-[#788e80] bg-[#141d18]/50 border border-[#223127] rounded-xl">
              Không tìm thấy vật phẩm nào phù hợp với bộ lọc.
            </div>
          ) : (
            filteredItems.map(item => {
              const def = ITEMS_DATABASE[item.itemId];
              if (!def) return null;

              const isInspected = inspectedInstanceId === item.instanceId;
              const totalItemWeight = Math.round(def.weight * item.quantity * 10) / 10;
              const totalItemVolume = Math.round(def.volume * item.quantity * 10) / 10;

              const isEdible = def.category === 'food' || def.tags.includes('edible');
              const isDrinkable = def.category === 'water' || def.tags.includes('drinkable');
              const isWildCoconut = item.itemId === 'ITEM_WILD_COCONUT';
              const dominantQuality = getDominantQuality(item.qualityBreakdown, item.quality);
              const dominantMeta = QUALITY_CONFIG[dominantQuality];

              return (
                <div
                  key={item.instanceId}
                  onClick={() => setInspectedInstanceId(item.instanceId)}
                  className={`bg-[#18231d] border rounded-lg p-3 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                    isInspected
                      ? 'border-emerald-400 bg-[#1e2a22] shadow-md ring-1 ring-emerald-500/30'
                      : 'border-[#27382d] hover:border-[#384e3f] hover:bg-[#1b2620]'
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="relative w-16 h-16 shrink-0 rounded-lg bg-[#111813] border border-[#2a3c2f] flex items-center justify-center p-1 shadow-inner overflow-hidden">
                        <ItemIcon 
                          itemId={item.itemId} 
                          category={def.category} 
                          size={64} 
                          className="w-full h-full object-contain" 
                        />
                        {/* Dominant Quality Dot indicator */}
                        <div 
                          className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full border border-black/60 shadow-sm"
                          style={{ backgroundColor: dominantMeta.colorHex }}
                          title={`Phẩm chất nổi bật: ${dominantMeta.nameVi}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h4 className="text-xs font-semibold text-[#f0e6d2] leading-tight line-clamp-2">
                            {def.name}
                          </h4>
                          <span className="font-mono text-xs font-bold text-amber-300 bg-[#141d18] px-1.5 py-0.5 rounded border border-[#2b3c31] shrink-0">
                            x{item.quantity}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <QualityBadge item={item} def={def} />
                          {item.freshness !== undefined && (() => {
                            const fStage = getFreshnessStage(item.freshness);
                            const fMeta = FRESHNESS_CONFIG[fStage];
                            return (
                              <span 
                                className="text-[9px] font-mono px-1 py-0.2 rounded border flex items-center gap-1"
                                style={{ 
                                  color: fMeta.colorHex, 
                                  backgroundColor: `${fMeta.colorHex}15`,
                                  borderColor: `${fMeta.colorHex}40`
                                }}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{fMeta.labelVi} ({Math.round(item.freshness)}%)</span>
                              </span>
                            );
                          })()}
                          {item.condition !== undefined && (() => {
                            const maxCond = item.conditionMax || def.toolProperties?.durabilityMax || 100;
                            const cStage = getConditionStage(item.condition, maxCond);
                            const cMeta = CONDITION_CONFIG[cStage];
                            return (
                              <span 
                                className="text-[9px] font-mono px-1 py-0.2 rounded border flex items-center gap-1"
                                style={{ 
                                  color: cMeta.colorHex, 
                                  backgroundColor: `${cMeta.colorHex}15`,
                                  borderColor: `${cMeta.colorHex}40`
                                }}
                              >
                                <Wrench className="w-2.5 h-2.5" />
                                <span>{cMeta.labelVi} ({item.condition}/{maxCond})</span>
                              </span>
                            );
                          })()}
                        </div>

                        {/* Progress bars for freshness and condition */}
                        {(item.freshness !== undefined || item.condition !== undefined) && (
                          <div className="flex flex-col gap-1 mb-2">
                            {item.freshness !== undefined && (() => {
                              const fStage = getFreshnessStage(item.freshness);
                              return (
                                <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full transition-all"
                                    style={{ 
                                      width: `${Math.max(4, Math.min(100, item.freshness))}%`,
                                      backgroundColor: FRESHNESS_CONFIG[fStage].colorHex
                                    }}
                                  />
                                </div>
                              );
                            })()}
                            {item.condition !== undefined && (() => {
                              const maxCond = item.conditionMax || def.toolProperties?.durabilityMax || 100;
                              const cStage = getConditionStage(item.condition, maxCond);
                              return (
                                <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full transition-all"
                                    style={{ 
                                      width: `${Math.max(4, Math.min(100, (item.condition / maxCond) * 100))}%`,
                                      backgroundColor: CONDITION_CONFIG[cStage].colorHex
                                    }}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <p className="text-[10px] text-[#8ea596] line-clamp-1 leading-relaxed">
                          {def.description}
                        </p>
                      </div>
                    </div>

                    {/* Stack breakdown mini bar for multi-item stacks */}
                    {item.quantity > 1 && item.qualityBreakdown && (
                      <div className="mb-2">
                        <QualityBadge item={item} def={def} compact />
                      </div>
                    )}

                    {/* Weight / Volume info */}
                    <div className="flex items-center gap-3 text-[10px] text-[#a4b7aa] font-mono mb-2">
                      <span title="Tổng khối lượng">⚖️ {totalItemWeight} kg</span>
                      <span title="Tổng thể tích">📦 {totalItemVolume} L</span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {def.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[#131c17] text-[#7d9585] border border-[#243329]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions on card */}
                  <div className="pt-2 border-t border-[#233127] flex items-center justify-between gap-1">
                    {isEdible && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConsumeItem(item.instanceId);
                        }}
                        className="px-2 py-1 bg-amber-700/80 hover:bg-amber-600 text-white rounded text-[10px] flex items-center gap-1 transition-colors"
                        title="Ăn để hồi phục cơn đói"
                      >
                        <Utensils className="w-3 h-3" />
                        <span>Ăn</span>
                      </button>
                    )}

                    {isDrinkable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConsumeItem(item.instanceId);
                        }}
                        className="px-2 py-1 bg-sky-700/80 hover:bg-sky-600 text-white rounded text-[10px] flex items-center gap-1 transition-colors"
                        title="Uống để giải tỏa cơn khát"
                      >
                        <Droplets className="w-3 h-3" />
                        <span>Uống</span>
                      </button>
                    )}

                    {isWildCoconut && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateTab('crafting');
                        }}
                        className="px-2 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded text-[10px] flex items-center gap-1 transition-colors"
                        title="Chuyển sang chế tạo để chặt bổ dừa"
                      >
                        <CircleDot className="w-3 h-3" />
                        <span>Bổ dừa</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDiscardItem(item.instanceId, 1);
                      }}
                      className="p-1 hover:bg-[#2c1d1d] text-[#788e80] hover:text-red-400 rounded transition-colors ml-auto"
                      title="Vứt bớt 1 đơn vị khỏi kho"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* CODEX MODE: Hiển thị toàn bộ 82 nguyên liệu thô với icon 64x64 và thông số chi tiết */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.values(RAW_MATERIALS_ITEMS)
            .filter(raw => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return raw.name.toLowerCase().includes(q) || raw.id.toLowerCase().includes(q) || raw.tags.some(t => t.toLowerCase().includes(q));
            })
            .map(raw => {
              const isSelected = inspectedCodexId === raw.id;
              return (
                <div
                  key={raw.id}
                  onClick={() => setInspectedCodexId(raw.id)}
                  className={`bg-[#18231d] border rounded-lg p-3 flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-[#222a1f] shadow-md'
                      : 'border-[#27382d] hover:border-[#4d3d24] hover:bg-[#1b2620]'
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-[#111813] border border-[#3b2f21] flex items-center justify-center p-1 shadow-inner overflow-hidden">
                        <ItemIcon 
                          itemId={raw.id} 
                          category={raw.category} 
                          size={64} 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-[#f5e6cc] leading-tight line-clamp-2 mb-1">
                          {raw.name}
                        </h4>
                        <span className="font-mono text-[9px] text-[#8ea596] block truncate">
                          {raw.id}
                        </span>
                        <p className="text-[10px] text-[#8ea596] line-clamp-2 mt-1 leading-relaxed">
                          {raw.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#a89274] pt-1.5 border-t border-[#28382d]">
                      <span>{raw.weight} kg/đv</span>
                      <span>•</span>
                      <span>{raw.volume} L</span>
                      <span>•</span>
                      <span>Chồng: {raw.stackSize}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 border-t border-[#223026]">
                    {raw.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#121914] text-[#8ea596] border border-[#27382d]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* 4. Inspected Item Detail Footer Bar */}
      {viewMode === 'storage' && inspectedItem && inspectedDef && (() => {
        const spoilage = analyzeItemSpoilage(inspectedItem, inspectedDef, state);
        const maxCond = inspectedItem.conditionMax || inspectedDef.toolProperties?.durabilityMax || 100;
        const cStage = inspectedItem.condition !== undefined ? getConditionStage(inspectedItem.condition, maxCond) : null;
        const cMeta = cStage ? CONDITION_CONFIG[cStage] : null;
        const fStage = inspectedItem.freshness !== undefined ? getFreshnessStage(inspectedItem.freshness) : null;
        const fMeta = fStage ? FRESHNESS_CONFIG[fStage] : null;

        return (
          <div className="mt-auto bg-[#141d18] border border-[#27382d] rounded-xl p-3.5 flex flex-col gap-3 shadow-lg animate-in fade-in">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 shrink-0 rounded-lg bg-[#111813] border border-[#2b3c31] flex items-center justify-center p-1 shadow-inner overflow-hidden">
                  <ItemIcon 
                    itemId={inspectedItem.itemId} 
                    category={inspectedDef.category} 
                    size={64} 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#f0e6d2] flex items-center gap-2 flex-wrap">
                    <span>{inspectedDef.name}</span>
                    <span className="text-xs text-amber-300 font-mono">x{inspectedItem.quantity}</span>
                    <QualityBadge item={inspectedItem} def={inspectedDef} />
                    {fMeta && (
                      <span 
                        className="text-xs font-mono px-1.5 py-0.5 rounded border flex items-center gap-1"
                        style={{ color: fMeta.colorHex, backgroundColor: `${fMeta.colorHex}15`, borderColor: `${fMeta.colorHex}40` }}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{fMeta.labelVi} ({Math.round(inspectedItem.freshness!)}%)</span>
                      </span>
                    )}
                    {cMeta && (
                      <span 
                        className="text-xs font-mono px-1.5 py-0.5 rounded border flex items-center gap-1"
                        style={{ color: cMeta.colorHex, backgroundColor: `${cMeta.colorHex}15`, borderColor: `${cMeta.colorHex}40` }}
                      >
                        <Wrench className="w-3 h-3" />
                        <span>{cMeta.labelVi} ({inspectedItem.condition}/{maxCond})</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8ea596] mt-0.5">
                    Đơn vị: {inspectedDef.weight} kg / {inspectedDef.volume} L (Tối đa {inspectedDef.stackSize} cái/ngăn)
                    {inspectedDef.nutrition && ` • ${inspectedDef.nutrition.calories} kcal • ${inspectedDef.nutrition.hydration} ml nước`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDiscardItem(inspectedItem.instanceId, inspectedItem.quantity)}
                  className="px-3 py-1 bg-[#241a1a] hover:bg-[#382020] text-red-300 text-xs rounded border border-[#3b2727] transition-colors"
                >
                  Vứt hết ({inspectedItem.quantity})
                </button>
                <button
                  onClick={() => setInspectedInstanceId(null)}
                  className="px-3 py-1 bg-[#1a241e] text-[#a4b6aa] hover:text-white text-xs rounded border border-[#28382d]"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Dynamic Spoilage & Tool Breakdown Panel */}
            {(inspectedItem.freshness !== undefined || inspectedItem.condition !== undefined) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2.5 border-t border-[#223127] text-xs">
                {/* Spoilage Deep Analysis */}
                {inspectedItem.freshness !== undefined && (
                  <div className="bg-[#0f1712] border border-[#1f2e23] rounded-lg p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[#d6e5da]">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Mô phỏng Phân rã Sinh học
                      </span>
                      <span className="font-mono text-amber-300">
                        -{spoilage.effectiveDailyRate}% / ngày
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8ca595] leading-relaxed">
                      Dự kiến hỏng sau: <strong className="text-emerald-400 font-mono">{spoilage.remainingDays < 900 ? `${spoilage.remainingDays} ngày` : 'Rất lâu'}</strong>.
                      Khi độ tươi về 0, vật phẩm sẽ phân huỷ thành <em>Chất mùn hữu cơ (ITEM_ORGANIC_ROT)</em>.
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-[#6e8777] pt-1 border-t border-[#18261c]">
                      <span>Nhiệt độ: {state.weather.temperature}°C ({spoilage.factors.temperatureFactor.toFixed(1)}x)</span>
                      <span>•</span>
                      <span>Độ ẩm: {state.weather.humidity}% ({spoilage.factors.humidityFactor.toFixed(1)}x)</span>
                      <span>•</span>
                      <span>Mái che: {spoilage.factors.shelterFactor < 1 ? 'Giảm 25%' : 'Không'}</span>
                    </div>
                  </div>
                )}

                {/* Condition & Durability Deep Analysis */}
                {inspectedItem.condition !== undefined && cMeta && (
                  <div className="bg-[#0f1712] border border-[#1f2e23] rounded-lg p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[#d6e5da]">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-sky-400" />
                        Trạng thái Cơ học & Độ bền
                      </span>
                      <span className="font-mono text-sky-300">
                        Hiệu suất: {Math.round(cMeta.efficiencyMultiplier * 100)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8ca595] leading-relaxed">
                      Độ bền: <strong className="font-mono text-sky-300">{inspectedItem.condition} / {maxCond}</strong>.
                      Khi công cụ gãy hỏng trong quá trình lao động, survivor sẽ an toàn thu hồi phế liệu cứu vãn.
                    </div>
                    {inspectedDef.toolProperties?.hardness && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-[#6e8777] pt-1 border-t border-[#18261c]">
                        <span>Độ cứng: Cấp {inspectedDef.toolProperties.hardness}</span>
                        <span>•</span>
                        <span>Mài sắc: Có thể bảo dưỡng bằng Đá cuội hoặc Dây bện</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Breakdown if multi-quantity stack */}
            {inspectedItem.quantity > 1 && inspectedItem.qualityBreakdown && (
              <div className="pt-2 border-t border-[#223127]">
                <QualityBadge item={inspectedItem} def={inspectedDef} />
              </div>
            )}
          </div>
        );
      })()}

      {/* 5. Inspected Codex Detail Footer Bar */}
      {viewMode === 'raw_codex' && inspectedCodexId && RAW_MATERIALS_ITEMS[inspectedCodexId] && (
        <div className="mt-auto bg-[#1a140d] border border-[#523d24] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 rounded-lg bg-[#110c08] border border-[#523d24] flex items-center justify-center p-1 shadow-inner overflow-hidden">
              <ItemIcon 
                itemId={inspectedCodexId} 
                category={RAW_MATERIALS_ITEMS[inspectedCodexId].category} 
                size={64} 
                className="w-full h-full object-contain" 
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#f5e6cc] flex items-center gap-2">
                <span>{RAW_MATERIALS_ITEMS[inspectedCodexId].name}</span>
                <span className="text-xs text-amber-400 font-mono">({inspectedCodexId})</span>
              </div>
              <p className="text-xs text-[#c4b39b] mt-0.5 max-w-2xl">
                {RAW_MATERIALS_ITEMS[inspectedCodexId].description}
              </p>
              <div className="text-[11px] text-[#8f7a62] mt-1">
                Trọng lượng: {RAW_MATERIALS_ITEMS[inspectedCodexId].weight} kg • Thể tích: {RAW_MATERIALS_ITEMS[inspectedCodexId].volume} L • Xếp chồng tối đa: {RAW_MATERIALS_ITEMS[inspectedCodexId].stackSize} cái/ngăn
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={() => setInspectedCodexId(null)}
              className="px-3 py-1 bg-[#2b1f13] text-[#c4b39b] hover:text-white text-xs rounded border border-[#523d24]"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
