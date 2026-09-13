import React, { useState, useMemo } from 'react';
import {
  Package,
  Layers,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  ArrowRight,
  Shield,
  Utensils,
  Wrench,
  Leaf,
  HeartPulse,
  Info
} from 'lucide-react';
import { GameState, InventoryItem } from '../../types';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';
import { QualityBadge } from '../common/QualityBadge';
import { getFreshnessStage, getConditionStage } from '../../utils/qualityUtils';

interface CampStorageTabProps {
  state: GameState;
  onNavigateTab: (tab: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const CampStorageTab: React.FC<CampStorageTabProps> = ({ state, onNavigateTab }) => {
  const { inventory, buildings } = state;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    inventory.items[0]?.instanceId || null
  );

  // Storage bonus calculations
  const storageBuildings = buildings.filter(b => b.isBuilt && b.buildingId === 'BUILDING_WOVEN_BASKET_RACK');
  const bonusCapacity = storageBuildings.length * 30;

  // Filter items
  const filteredItems = useMemo(() => {
    return inventory.items.filter(item => {
      const def = ITEMS_DATABASE[item.itemId];
      if (!def) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = def.name.toLowerCase().includes(query);
        const matchCat = def.category.toLowerCase().includes(query);
        if (!matchName && !matchCat) return false;
      }

      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'materials') return def.category === 'raw_material' || def.category === 'component' || def.category === 'construction';
      if (selectedCategory === 'food') return def.category === 'food' || def.category === 'water';
      if (selectedCategory === 'tools') return def.category === 'tool';
      if (selectedCategory === 'medicine') return def.category === 'medicine';
      return true;
    });
  }, [inventory.items, selectedCategory, searchQuery]);

  // Selected item
  const selectedItem = useMemo(() => {
    return inventory.items.find(i => i.instanceId === selectedInstanceId) || filteredItems[0] || null;
  }, [inventory.items, selectedInstanceId, filteredItems]);

  const selectedDef = selectedItem ? ITEMS_DATABASE[selectedItem.itemId] : null;

  // Current weight
  const currentWeightKg = useMemo(() => {
    return inventory.items.reduce((acc, item) => {
      const def = ITEMS_DATABASE[item.itemId];
      return acc + (def?.weight || 0.1) * item.quantity;
    }, 0);
  }, [inventory.items]);

  const weightPercent = Math.min(100, Math.round((currentWeightKg / inventory.maxWeightKg) * 100));

  return (
    <div
      className="absolute inset-0 flex flex-col justify-between text-[#e8dfce] select-none pointer-events-auto"
      style={{
        left: '4.5%',
        top: '16.2%',
        width: '91.0%',
        height: '77.2%',
        fontFamily: UI_FONT,
      }}
    >
      {/* Top Header & Filter Bar */}
      <div className="camp-sunken-panel-soft flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="camp-sunken-slot p-1.5 text-emerald-300">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5ecd8]">
              KHO BÃI DOANH TRẠI (CAMP STORAGE)
            </h2>
            <p className="text-[11px] text-[#a9bcae]">
              Dung lượng: {currentWeightKg.toFixed(1)} / {inventory.maxWeightKg} kg ({weightPercent}%)
              {bonusCapacity > 0 && <span className="text-emerald-400 ml-1.5">(+{bonusCapacity}kg từ kệ tre)</span>}
            </p>
          </div>
        </div>

        {/* Categories Tabs */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'materials', label: 'Nguyên liệu' },
            { id: 'food', label: 'Lương thực/Nước' },
            { id: 'tools', label: 'Công cụ & Đồ dùng' },
            { id: 'medicine', label: 'Thuốc men' },
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1e4835] text-[#f8f1e4] border border-[#3e7d5a] shadow'
                  : 'camp-sunken-slot text-[#96ac9e] hover:bg-[#143226] border border-black/40'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Item Grid (Left) + Detail Inspector (Right) */}
      <div className="flex-1 flex gap-3 mt-3 min-h-0">
        {/* Left: 24 Slots Item Grid */}
        <div className="flex-1 camp-sunken-panel p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between pb-2 camp-groove-divider">
            <span className="text-xs font-bold uppercase tracking-wider text-[#dce7df]">
              VẬT TƯ ĐANG LƯU TRỮ ({filteredItems.length} MÓN)
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('buildings')}
              className="text-xs text-amber-300 hover:text-amber-200 underline font-medium cursor-pointer"
            >
              + Xây thêm kệ chứa đồ để mở rộng kho
            </button>
          </div>

          {/* Grid of Items */}
          <div className="grid grid-cols-6 gap-2 flex-1 overflow-y-auto py-2 pr-1">
            {filteredItems.map(item => {
              const def = ITEMS_DATABASE[item.itemId];
              const isSelected = selectedInstanceId === item.instanceId;

              return (
                <div
                  key={item.instanceId}
                  onClick={() => setSelectedInstanceId(item.instanceId)}
                  className={`relative rounded-lg p-2 flex flex-col items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1f4c37] border border-emerald-400 shadow-md shadow-emerald-950/60 scale-[1.02]'
                      : 'camp-sunken-slot hover:border-emerald-500/50 hover:bg-[#143226]'
                  }`}
                  style={{ minHeight: '85px' }}
                >
                  <div className="w-9 h-9 flex items-center justify-center">
                    <ItemIcon itemId={item.itemId} className="w-8 h-8 object-contain drop-shadow" />
                  </div>

                  <span className="text-[11px] font-semibold text-[#f1e6d4] text-center truncate w-full mt-1">
                    {def?.name || item.itemId}
                  </span>

                  {/* Quantity badge */}
                  <span className="absolute bottom-1 right-1.5 text-[11px] font-mono font-bold text-amber-300 drop-shadow">
                    x{item.quantity}
                  </span>

                  {/* Quality badge */}
                  {item.quality && item.quality !== 'standard' && (
                    <div className="absolute top-1 left-1 scale-75 origin-top-left">
                      <QualityBadge quality={item.quality} showText={false} size="sm" />
                    </div>
                  )}
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="col-span-6 flex flex-col items-center justify-center text-center p-8 text-[#7f9486]">
                <Package className="w-8 h-8 mb-2 opacity-50 text-emerald-400/60" />
                <p className="text-sm font-semibold text-[#c5d8cc]">Không tìm thấy vật phẩm nào trong mục này</p>
                <p className="text-xs text-[#8ca395] mt-1">Hãy thu lượm tài nguyên hoặc chế tác thêm công cụ</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Item Details Inspector */}
        <div className="w-[32%] camp-sunken-panel p-3.5 flex flex-col justify-between">
          {selectedItem && selectedDef ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 pb-3 camp-groove-divider">
                  <div className="w-12 h-12 rounded-lg camp-sunken-slot flex items-center justify-center shrink-0">
                    <ItemIcon itemId={selectedItem.itemId} className="w-10 h-10 object-contain drop-shadow" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#f5ebd8] leading-tight">
                      {selectedDef.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1c3a2e] text-emerald-300 border border-[#2b5440]">
                        {selectedDef.category}
                      </span>
                      {selectedItem.quality && (
                        <QualityBadge quality={selectedItem.quality} size="sm" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#b8cbbd] leading-relaxed mt-3 italic">
                  {selectedDef.description}
                </p>

                {/* Properties & Specs */}
                <div className="mt-3.5 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-black/40">
                    <span className="text-[#8ca395]">Số lượng tồn kho:</span>
                    <span className="font-mono font-bold text-amber-300">{selectedItem.quantity} cái</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/40">
                    <span className="text-[#8ca395]">Khối lượng đơn vị:</span>
                    <span className="font-mono font-bold text-[#e6dcce]">{selectedDef.weight || 0.1} kg</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/40">
                    <span className="text-[#8ca395]">Tổng trọng lượng:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {((selectedDef.weight || 0.1) * selectedItem.quantity).toFixed(2)} kg
                    </span>
                  </div>

                  {selectedDef.nutrition && (
                    <div className="flex justify-between py-1 border-b border-black/40">
                      <span className="text-[#8ca395]">Giá trị dinh dưỡng:</span>
                      <span className="font-mono font-bold text-lime-400">
                        +{selectedDef.nutrition.calories} cal | +{selectedDef.nutrition.hydration} ml
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-3 camp-groove-divider flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('crafting')}
                  className="w-full py-2 px-3 rounded bg-[#163a2a] hover:bg-[#204e39] border border-[#2b5c42] text-xs font-semibold text-[#f1eadc] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
                >
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dùng để chế tác công cụ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#7f9486]">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">Chọn một vật phẩm trong kho để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
