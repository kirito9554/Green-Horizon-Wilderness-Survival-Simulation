import React, { useMemo } from 'react';
import {
  Tent,
  Flame,
  Shield,
  Sparkles,
  Users,
  Plus,
  X,
  ArrowUp,
  ArrowRight,
  Package,
  Clock,
  CheckCircle2,
  Hammer,
  Layers,
  Settings,
  HeartPulse,
  Droplets,
  TreePine,
  Sparkle
} from 'lucide-react';
import { GameState, ConstructedBuilding, CraftingQueueItem } from '../../types';
import { BUILDINGS_DATABASE } from '../../data/buildings';
import { RECIPES_DATABASE } from '../../data/recipes';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';
import { QualityBadge } from '../common/QualityBadge';

interface CampOverviewViewProps {
  state: GameState;
  onNavigateTab: (tab: string) => void;
  onCancelQueueItem?: (queueItemId: string) => void;
  onReorderQueue?: (queueItemId: string, direction: 'up' | 'down') => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * ============================================================================
 * BẢNG TUỲ CHỈNH NHANH TOẠ ĐỘ & KÍCH THƯỚC (CAMP OVERVIEW CALIBRATION CONFIG)
 * ============================================================================
 * Bạn có thể điều chỉnh nhanh vị trí, tỷ lệ %, khoảng cách và kích thước của
 * từng khối thành phần trong giao diện Camp Overview ngay tại đây:
 */
export const CAMP_OVERVIEW_CONFIG = {
  // 1. Khung tổng thể (Root Frame Viewport)
  frame: {
    left: '5.5%',         // Toạ độ mép trái (%)
    top: '17.2%',         // Toạ độ mép trên (%)
    width: '90.0%',       // Chiều rộng tổng (%)
    height: '66%',      // Chiều cao tổng (%)
    rowGap: 'gap-3',      // Khoảng cách giữa hàng trên (Top) và hàng dưới (Bottom)
  },

  // 2. Hàng trên (Top Row: Poster Trại + Trạng thái + Hàng đợi)
  topRow: {
    height: '66%',        // Chiều cao hàng trên (% so với frame)
    gap: 'gap-3',         // Khoảng cách giữa cột Trái (Art) và Phải (Status/Queue)
    
    // Cột bên trái (Left: Tiêu đề Banner + Ảnh nghệ thuật Doanh trại)
    leftColumn: {
      gap: 'gap-2.5',     // Khoảng cách giữa Banner và Khung tranh
    },

    // Cột bên phải (Right: Trạng thái Trại + Hàng đợi chế tác/xây dựng)
    rightColumn: {
      width: '36%',              // Chiều rộng cột phải (%)
      gap: 'gap-2.5',            // Khoảng cách giữa bảng Status và bảng Queue
      statusPanelHeight: '46%',  // Chiều cao khối TRẠNG THÁI KHU TRẠI (%)
      queuePanelHeight: '52%',   // Chiều cao khối HÀNG ĐỢI TIẾN TRÌNH (%)
    },
  },

  // 3. Hàng dưới (Bottom Row: Vị trí Công trình + Xem trước Kho bãi)
  bottomRow: {
    height: '32%',        // Chiều cao hàng dưới (% so với frame)
    gap: 'gap-3',         // Khoảng cách giữa 2 bảng dưới

    // Bảng bên trái: Vị trí công trình (Building Slots)
    buildingSlots: {
      width: '42%',              // Chiều rộng bảng công trình (%)
      cols: 5,                   // Số cột (5 cột)
      rows: 2,                   // Số hàng (2 hàng)
      totalSlots: 10,            // Tổng số ô vị trí công trình (10 ô)
      gridGap: 'gap-1.5',        // Khoảng cách giữa các ô công trình

      // Tuỳ chỉnh kích thước & quy cách chung cho TẤT CẢ các ô công trình:
      slot: {
        minWidth: 'auto',        // Chiều rộng tối thiểu ('auto', '40px', ...)
        minHeight: 'auto',       // Chiều cao tối thiểu ('auto', '38px', ...)
        padding: 'p-1',          // Padding bên trong ô ('p-1', 'p-1.5', ...)
        iconSize: 'w-5 h-5',     // Kích thước biểu tượng công trình ('w-5 h-5', 'w-6 h-6', ...)
        labelFontSize: 'text-[9px]', // Cỡ chữ tên công trình ('text-[8px]', 'text-[9px]', 'text-[10px]')
        plusIconSize: 'w-4 h-4', // Kích thước icon dấu cộng (+) ô trống
        aspectRatio: 'auto',     // Tỷ lệ khung ô ('auto', '1/1', ...)
      },
    },

    // Bảng bên phải: Xem trước kho bãi (Camp Storage Preview)
    storagePreview: {
      cols: 8,                   // Số cột (8 cột)
      rows: 2,                   // Số hàng (2 hàng)
      totalSlots: 16,            // Tổng số ô kho bãi (16 ô)
      gridGap: 'gap-1',        // Khoảng cách giữa các ô kho bãi

      // Tuỳ chỉnh kích thước & quy cách chung cho TẤT CẢ các ô kho đồ:
      slot: {
        minWidth: '0',           // Cho phép ô co lại theo chiều rộng cột grid
        minHeight: '0',          // Không để content ép ô cao hơn tỷ lệ vuông
        padding: 'p-0.5',          // Padding bên trong ô ('p-1', 'p-1.5', ...)
        iconSize: 'w-5 h-5',     // Kích thước hình vật phẩm ('w-5 h-5', 'w-6 h-6', 'w-7 h-7')
        quantityFontSize: 'text-[10px]', // Cỡ chữ số lượng ('text-[9px]', 'text-[10px]', 'text-xs')
        aspectRatio: '1 / 1',    // Luôn giữ slot vuông
      },
    },
  },
} as const;

export const CampOverviewView: React.FC<CampOverviewViewProps> = ({
  state,
  onNavigateTab,
  onCancelQueueItem,
  onReorderQueue,
}) => {
  const { gameTime, weather, buildings, survivors, inventory, craftingQueue = [] } = state;

  // Active in-progress construction tasks
  const underConstruction = useMemo(() => {
    return buildings.filter(b => !b.isBuilt);
  }, [buildings]);

  // Built structures
  const builtStructures = useMemo(() => {
    return buildings.filter(b => b.isBuilt);
  }, [buildings]);

  // Derive metrics
  const avgMorale = useMemo(() => {
    if (survivors.length === 0) return 50;
    const total = survivors.reduce((acc, s) => acc + s.morale, 0);
    return Math.round(total / survivors.length);
  }, [survivors]);

  const moraleStatus = useMemo(() => {
    if (avgMorale >= 75) return { label: 'Rất cao (High)', color: 'text-emerald-400' };
    if (avgMorale >= 45) return { label: 'Tốt (Fair)', color: 'text-lime-300' };
    if (avgMorale >= 25) return { label: 'Bất an (Low)', color: 'text-amber-400' };
    return { label: 'Nguy cấp (Poor)', color: 'text-rose-400' };
  }, [avgMorale]);

  const hasCampfire = builtStructures.some(b => b.buildingId === 'BUILDING_CAMPFIRE_HEARTH');
  const hasShelter = builtStructures.some(b => b.buildingId === 'BUILDING_LEAF_SHELTER');
  const hasStorageRack = builtStructures.some(b => b.buildingId === 'BUILDING_WOVEN_BASKET_RACK');
  const hasRainCollector = builtStructures.some(b => b.buildingId === 'BUILDING_RAIN_COLLECTOR');

  const campSafety = useMemo(() => {
    let score = 50;
    if (hasCampfire) score += 20;
    if (hasShelter) score += 15;
    if (weather.current === 'clear' || weather.current === 'cloudy') score += 10;
    if (weather.current === 'storm') score -= 25;
    if (score >= 70) return { label: 'An toàn (Safe)', color: 'text-emerald-400' };
    if (score >= 40) return { label: 'Cảnh giác (Caution)', color: 'text-amber-300' };
    return { label: 'Nguy hiểm (Danger)', color: 'text-rose-400' };
  }, [hasCampfire, hasShelter, weather.current]);

  const cleanliness = useMemo(() => {
    let status = 'Vừa phải (Moderate)';
    let color = 'text-amber-300';
    if (hasRainCollector && hasShelter) {
      status = 'Tốt (Clean)';
      color = 'text-emerald-400';
    }
    return { label: status, color };
  }, [hasRainCollector, hasShelter]);

  const comfort = useMemo(() => {
    if (hasShelter && builtStructures.length >= 3) {
      return { label: 'Khá tốt (Good)', color: 'text-emerald-400' };
    }
    if (hasShelter) {
      return { label: 'Cơ bản (Basic)', color: 'text-amber-300' };
    }
    return { label: 'Dã chiến (Rudimentary)', color: 'text-amber-400' };
  }, [hasShelter, builtStructures.length]);

  // Current inventory weight
  const currentWeightKg = useMemo(() => {
    return inventory.items.reduce((total, item) => {
      const def = ITEMS_DATABASE[item.itemId];
      const w = def?.weight || 0.1;
      return total + w * item.quantity;
    }, 0);
  }, [inventory.items]);

  // Format seconds to mm:ss
  const formatRemainingTime = (seconds: number) => {
    const s = Math.max(0, Math.round(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 10 Building Slots
  const buildingSlotsTotal = CAMP_OVERVIEW_CONFIG.bottomRow.buildingSlots.totalSlots;
  const buildingSlots = useMemo(() => {
    const slots: Array<{
      building?: ConstructedBuilding;
      def?: typeof BUILDINGS_DATABASE[string];
      index: number;
    }> = [];

    for (let i = 0; i < buildingSlotsTotal; i++) {
      if (i < builtStructures.length) {
        const b = builtStructures[i];
        const def = BUILDINGS_DATABASE[b.buildingId];
        slots.push({ building: b, def, index: i });
      } else {
        slots.push({ index: i });
      }
    }
    return slots;
  }, [builtStructures, buildingSlotsTotal]);

  // Camp storage preview items (16 slots = 2 rows x 8 cols)
  const storageSlotsTotal = CAMP_OVERVIEW_CONFIG.bottomRow.storagePreview.totalSlots;
  const storageItems = useMemo(() => {
    const items = [...inventory.items];
    const slots: Array<(typeof inventory.items)[number] | null> = [];
    for (let i = 0; i < storageSlotsTotal; i++) {
      slots.push(items[i] || null);
    }
    return slots;
  }, [inventory.items, storageSlotsTotal]);

  return (
    <div
      className={`absolute inset-0 flex flex-col justify-between text-[#e8dfce] select-none pointer-events-auto ${CAMP_OVERVIEW_CONFIG.frame.rowGap}`}
      style={{
        left: CAMP_OVERVIEW_CONFIG.frame.left,
        top: CAMP_OVERVIEW_CONFIG.frame.top,
        width: CAMP_OVERVIEW_CONFIG.frame.width,
        height: CAMP_OVERVIEW_CONFIG.frame.height,
        fontFamily: UI_FONT,
      }}
    >
      {/* 1. TOP MAIN ROW (Camp Banner + Campsite Artwork on Left, Status + Queue on Right) */}
      <div 
        className={`w-full flex ${CAMP_OVERVIEW_CONFIG.topRow.gap}`}
        style={{ height: CAMP_OVERVIEW_CONFIG.topRow.height }}
      >
        {/* LEFT COLUMN: Header Banner + Atmospheric Campsite Art */}
        <div className={`flex-1 flex flex-col ${CAMP_OVERVIEW_CONFIG.topRow.leftColumn.gap} h-full min-w-0`}>
          {/* Top Title Banner */}
          <div className="camp-sunken-panel-soft flex items-center justify-between px-3.5 py-2">
            <div className="flex items-center gap-2.5">
              <div className="camp-sunken-slot p-1.5 text-emerald-300">
                <Tent className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold uppercase tracking-wider text-[#f5ecd8] leading-tight">
                  {state.campName || 'DOANH TRẠI CHÍNH (BASE CAMP)'}
                </h2>
                <p className="text-xs text-[#a9bcae] leading-tight">
                  Khu sinh tồn trọng yếu — Vun đắp nơi trú ẩn, tạo dựng ngày mai.
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-xs italic text-[#d4c39e]/90 font-serif">
                &ldquo;Một nơi an toàn hôm nay, một hành trình xa hơn ngày mai.&rdquo;
              </span>
            </div>
          </div>

          {/* Centerpiece Camp Artwork Frame */}
          <div className="relative flex-1 rounded-lg overflow-hidden camp-sunken-panel group">
            {/* Base Camp Backdrop Art */}
            <img
              src="/poi-bg/center/base-camp.png"
              alt="Base Camp"
              className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.05] transition-transform duration-700 group-hover:scale-[1.01]"
              onError={(e) => {
                // Fallback to center map or unsplash if file missing
                e.currentTarget.src = '/maps/center.png';
              }}
            />

            {/* Atmosphere overlay: morning/noon/dusk lighting */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#04100c]/85 via-transparent to-black/30 pointer-events-none" />
            {/* Deep cavity inset shadow frame over artwork */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_8px_20px_rgba(0,0,0,0.85),inset_0_-4px_12px_rgba(0,0,0,0.80)]" />

            {/* Warm campfire glow if built */}
            {hasCampfire && (
              <div
                className="absolute inset-0 pointer-events-none mix-blend-screen opacity-40 animate-pulse"
                style={{
                  background: 'radial-gradient(circle at 48% 55%, rgba(255, 140, 40, 0.4) 0%, transparent 45%)',
                }}
              />
            )}

            {/* Rain FX if active weather */}
            {(weather.current === 'light_rain' || weather.current === 'heavy_rain' || weather.current === 'storm') && (
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#5ec3f8_1px,transparent_1px)] [background-size:14px_14px] opacity-25" />
            )}

            {/* Badges / Interactive Tags inside the campsite art */}
            <div className="absolute bottom-2.5 left-3 flex items-center gap-2">
              <div className="px-2 py-0.5 rounded camp-sunken-slot text-[11px] font-medium text-[#c5dcd0] flex items-center gap-1.5 shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Khu vực an toàn tuyệt đối</span>
              </div>

              {hasCampfire && (
                <div className="px-2 py-0.5 rounded camp-sunken-slot text-[11px] font-medium text-amber-300 flex items-center gap-1 shadow">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Bếp lửa đang duy trì</span>
                </div>
              )}
            </div>

            {/* Top Right Weather Quick Indicator */}
            <div className="absolute top-2.5 right-3 px-2 py-1 rounded camp-sunken-slot text-[11px] text-[#e0d6c4] flex items-center gap-2 shadow">
              <span className="capitalize text-emerald-300 font-semibold">{weather.current.replace('_', ' ')}</span>
              <span className="text-[#8ba294]">|</span>
              <span>{weather.temperatureC}°C</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Camp Status (Top) + Active Queue (Bottom) */}
        <div 
          className={`flex flex-col ${CAMP_OVERVIEW_CONFIG.topRow.rightColumn.gap} h-full shrink-0`}
          style={{ width: CAMP_OVERVIEW_CONFIG.topRow.rightColumn.width }}
        >
          {/* 1. CAMP STATUS PANEL */}
          <div
            className="camp-sunken-panel p-3 flex flex-col justify-between"
            style={{ height: CAMP_OVERVIEW_CONFIG.topRow.rightColumn.statusPanelHeight }}
          >
            <div className="flex items-center justify-between pb-1.5 camp-groove-divider">
              <div className="flex items-center gap-2">
                <Tent className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#eee5d3]">
                  TRẠNG THÁI KHU TRẠI (CAMP STATUS)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('assign')}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-[#c8dcce] bg-[#153427] border border-[#2b5843] hover:bg-[#1d4434] transition-colors cursor-pointer"
                title="Quản lý chính sách & phân công"
              >
                <Settings className="w-3 h-3 text-emerald-300" />
                <span>Manage</span>
              </button>
            </div>

            {/* Metrics List */}
            <div className="flex flex-col justify-around flex-1 py-1 gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#9cb1a3]">
                  <Users className="w-3.5 h-3.5 text-[#7f9988]" />
                  <span>Người sống sót (Survivors)</span>
                </span>
                <span className="font-mono font-bold text-[#f5ebd8] text-xs">
                  {survivors.length} / 4
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#9cb1a3]">
                  <Sparkles className="w-3.5 h-3.5 text-[#7f9988]" />
                  <span>Tinh thần chung (Morale)</span>
                </span>
                <span className={`font-semibold text-xs ${moraleStatus.color}`}>
                  {moraleStatus.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#9cb1a3]">
                  <Shield className="w-3.5 h-3.5 text-[#7f9988]" />
                  <span>Mức độ an toàn (Camp Safety)</span>
                </span>
                <span className={`font-semibold text-xs ${campSafety.color}`}>
                  {campSafety.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#9cb1a3]">
                  <Sparkle className="w-3.5 h-3.5 text-[#7f9988]" />
                  <span>Vệ sinh & Môi trường (Cleanliness)</span>
                </span>
                <span className={`font-semibold text-xs ${cleanliness.color}`}>
                  {cleanliness.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#9cb1a3]">
                  <HeartPulse className="w-3.5 h-3.5 text-[#7f9988]" />
                  <span>Mức độ tiện nghi (Comfort)</span>
                </span>
                <span className={`font-semibold text-xs ${comfort.color}`}>
                  {comfort.label}
                </span>
              </div>
            </div>
          </div>

          {/* 2. QUEUE PANEL (Active Construction & Crafting) */}
          <div
            className="camp-sunken-panel p-3 flex flex-col justify-between"
            style={{ height: CAMP_OVERVIEW_CONFIG.topRow.rightColumn.queuePanelHeight }}
          >
            <div className="flex items-center justify-between pb-1.5 camp-groove-divider">
              <div className="flex items-center gap-2">
                <Hammer className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#eee5d3]">
                  HÀNG ĐỢI TIẾN TRÌNH (QUEUE)
                </span>
              </div>
              <span className="font-mono text-[11px] text-amber-300 font-semibold px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/50">
                {underConstruction.length + craftingQueue.length} / 4
              </span>
            </div>

            {/* Queue Items List */}
            <div className="flex-1 overflow-y-auto py-1.5 flex flex-col gap-1.5 pr-0.5">
              {/* Ongoing construction */}
              {underConstruction.map((building) => {
                const def = BUILDINGS_DATABASE[building.buildingId];
                const pct = Math.min(100, Math.round((building.buildProgressSeconds / building.totalBuildSeconds) * 100));
                const remaining = building.totalBuildSeconds - building.buildProgressSeconds;

                return (
                  <div
                    key={building.id}
                    className="camp-sunken-slot p-2 flex items-center justify-between gap-2"
                  >
                    <div className="w-7 h-7 rounded bg-[#163628] border border-[#36614a] flex items-center justify-center shrink-0">
                      <Hammer className="w-4 h-4 text-amber-300" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#f1e6d4] truncate">
                          {def?.name || 'Công trình mới'}
                        </span>
                        <span className="font-mono text-[10px] text-amber-300">
                          {formatRemainingTime(remaining)}
                        </span>
                      </div>
                      <div className="w-full bg-[#081510] h-1.5 rounded-full overflow-hidden border border-[#1b3529] mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-[#8ca395]">{pct}%</span>
                    </div>
                  </div>
                );
              })}

              {/* Crafting Queue */}
              {craftingQueue.map((item) => {
                const recipe = RECIPES_DATABASE[item.recipeId];
                const pct = item.totalSeconds > 0 ? Math.min(100, Math.round((item.progressSeconds / item.totalSeconds) * 100)) : 0;
                const remaining = item.totalSeconds - item.progressSeconds;

                return (
                  <div
                    key={item.id}
                    className="camp-sunken-slot p-2 flex items-center justify-between gap-2"
                  >
                    <div className="w-7 h-7 rounded bg-[#163628] border border-[#36614a] flex items-center justify-center shrink-0">
                      <ItemIcon itemId={recipe?.outputs[0]?.itemId} className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#f1e6d4] truncate">
                          {recipe?.name || 'Vật phẩm chế tạo'} {item.quantity > 1 ? `x${item.quantity}` : ''}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-300">
                          {formatRemainingTime(remaining)}
                        </span>
                      </div>
                      <div className="w-full bg-[#081510] h-1.5 rounded-full overflow-hidden border border-[#1b3529] mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onReorderQueue && (
                        <button
                          type="button"
                          onClick={() => onReorderQueue(item.id, 'up')}
                          className="p-1 rounded bg-[#163529] hover:bg-[#204a39] text-[#b4cec0] hover:text-white border border-[#2b533e] cursor-pointer"
                          title="Tăng ưu tiên"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {onCancelQueueItem && (
                        <button
                          type="button"
                          onClick={() => onCancelQueueItem(item.id)}
                          className="p-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-800/60 cursor-pointer"
                          title="Huỷ chế tác"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {underConstruction.length === 0 && craftingQueue.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-2 text-[#7f9486]">
                  <Clock className="w-5 h-5 mb-1 opacity-60 text-emerald-400/70" />
                  <p className="text-[11px]">Hàng đợi hiện đang trống.</p>
                </div>
              )}
            </div>

            {/* Add to Queue button */}
            <div className="pt-1.5 camp-groove-divider flex gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('buildings')}
                className="flex-1 py-1 px-2 rounded bg-[#143628] hover:bg-[#1d4c39] border border-[#2c5b43] text-xs font-semibold text-[#f1eadc] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
              >
                <Plus className="w-3 h-3 text-amber-400" />
                <span>Xây công trình</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('crafting')}
                className="flex-1 py-1 px-2 rounded bg-[#122e23] hover:bg-[#1a3f31] border border-[#254b38] text-xs font-semibold text-[#dce8e0] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>Chế tác đồ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM ROW (Building Slots on Left + Camp Storage on Right) */}
      <div 
        className={`w-full flex ${CAMP_OVERVIEW_CONFIG.bottomRow.gap}`}
        style={{ height: CAMP_OVERVIEW_CONFIG.bottomRow.height }}
      >
        {/* BUILDING SLOTS GRID (5 columns x 2 rows) */}
        <div 
          className="camp-sunken-panel p-2.5 flex flex-col justify-between"
          style={{ width: CAMP_OVERVIEW_CONFIG.bottomRow.buildingSlots.width }}
        >
          <div className="flex items-center justify-between pb-1.5 camp-groove-divider">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#eee5d3]">
                VỊ TRÍ CÔNG TRÌNH (BUILDING SLOTS)
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#9bb0a2]">
              {builtStructures.length} / {buildingSlotsTotal} đã dựng
            </span>
          </div>

          {/* 10 Slots Grid: 5 cols x 2 rows */}
          <div className={`grid grid-cols-5 grid-rows-2 ${CAMP_OVERVIEW_CONFIG.bottomRow.buildingSlots.gridGap} flex-1 pt-1.5`}>
            {buildingSlots.map(({ building, def, index }) => {
              const bSlotCfg = CAMP_OVERVIEW_CONFIG.bottomRow.buildingSlots.slot;
              const slotStyle: React.CSSProperties = {
                minWidth: bSlotCfg.minWidth !== 'auto' ? bSlotCfg.minWidth : undefined,
                minHeight: bSlotCfg.minHeight !== 'auto' ? bSlotCfg.minHeight : undefined,
                aspectRatio: bSlotCfg.aspectRatio !== 'auto' ? bSlotCfg.aspectRatio : undefined,
              };

              if (building && def) {
                return (
                  <div
                    key={building.id}
                    onClick={() => onNavigateTab('buildings')}
                    style={slotStyle}
                    className={`relative group camp-sunken-slot hover:border-amber-400/80 hover:bg-[#183d2e] transition-all flex flex-col items-center justify-center ${bSlotCfg.padding} cursor-pointer`}
                    title={`${def.name}: ${def.benefitsDescription}`}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <ItemIcon itemId={def.cost[0]?.itemId} className={`${bSlotCfg.iconSize} drop-shadow`} />
                    </div>
                    <span className={`${bSlotCfg.labelFontSize} text-[#eddcc3] font-semibold truncate w-full text-center leading-none mt-0.5`}>
                      {def.name.split(' ')[0]}
                    </span>
                    {/* Tiny status pip */}
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" />
                  </div>
                );
              }

              return (
                <button
                  key={`slot_${index}`}
                  type="button"
                  onClick={() => onNavigateTab('buildings')}
                  style={slotStyle}
                  className={`camp-sunken-slot border border-dashed border-black/80 hover:bg-[#143226]/60 hover:border-emerald-400/40 transition-all flex items-center justify-center cursor-pointer group ${bSlotCfg.padding}`}
                  title="Nhấn để mở bảng chọn xây dựng công trình mới"
                >
                  <Plus className={`${bSlotCfg.plusIconSize} text-[#4f6f5b] group-hover:text-emerald-300 transition-colors`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* CAMP STORAGE PREVIEW (16 Slots: 8 columns x 2 rows) */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden camp-sunken-panel p-2.5 flex flex-col">
          <div className="flex items-center justify-between pb-1.5 camp-groove-divider">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#eee5d3]">
                KHO CHỨA ĐỒ DOANH TRẠI (CAMP STORAGE)
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-emerald-300 font-semibold">
                {currentWeightKg.toFixed(1)} / {inventory.maxWeightKg} kg
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('storage')}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-[#c8dcce] bg-[#153427] border border-[#2b5843] hover:bg-[#1d4434] transition-colors cursor-pointer"
                title="Mở toàn bộ kho bãi doanh trại"
              >
                <Settings className="w-3 h-3 text-emerald-300" />
                <span>Manage</span>
              </button>
            </div>
          </div>

          {/* 16 Item Slots: 8 cols x 2 rows. Rows keep their natural square height; viewport scrolls if needed. */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden pt-1.5 pr-1">
            <div className={`grid grid-cols-8 auto-rows-max content-start ${CAMP_OVERVIEW_CONFIG.bottomRow.storagePreview.gridGap} w-full min-w-0`}>
            {storageItems.map((item, idx) => {
              const sSlotCfg = CAMP_OVERVIEW_CONFIG.bottomRow.storagePreview.slot;
              const slotStyle: React.CSSProperties = {
                minWidth: sSlotCfg.minWidth !== 'auto' ? sSlotCfg.minWidth : undefined,
                minHeight: sSlotCfg.minHeight !== 'auto' ? sSlotCfg.minHeight : undefined,
                aspectRatio: sSlotCfg.aspectRatio !== 'auto' ? sSlotCfg.aspectRatio : undefined,
              };

              if (item) {
                const def = ITEMS_DATABASE[item.itemId];
                return (
                  <div
                    key={item.instanceId || `item_${idx}`}
                    onClick={() => onNavigateTab('storage')}
                    style={slotStyle}
                    className={`relative group w-full min-w-0 min-h-0 camp-sunken-slot hover:border-emerald-400/80 hover:bg-[#17382b] transition-all flex items-center justify-center ${sSlotCfg.padding} cursor-pointer`}
                    title={`${def?.name || item.itemId} (x${item.quantity})`}
                  >
                    <ItemIcon itemId={item.itemId} className={`${sSlotCfg.iconSize} object-contain drop-shadow`} />

                    {/* Quantity Badge */}
                    <span className={`absolute bottom-0.5 right-1 ${sSlotCfg.quantityFontSize} font-mono font-bold text-[#f5ecd8] leading-none drop-shadow`}>
                      {item.quantity}
                    </span>

                    {/* Quality indicator */}
                    {item.quality && item.quality !== 'standard' && (
                      <div className="absolute top-0.5 left-0.5 scale-75 origin-top-left">
                        <QualityBadge quality={item.quality} showText={false} size="sm" />
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={`empty_slot_${idx}`}
                  onClick={() => onNavigateTab('storage')}
                  style={slotStyle}
                  className="w-full min-w-0 min-h-0 camp-sunken-slot opacity-60 flex items-center justify-center cursor-pointer hover:opacity-100"
                />
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
