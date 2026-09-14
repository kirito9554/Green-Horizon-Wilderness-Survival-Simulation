import React from 'react';
import {
  Leaf,
  Utensils,
  Droplets,
  Sun,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  TreePine,
  ShieldCheck
} from 'lucide-react';
import { GameState } from '../../types';
import { ItemIcon } from '../common/ItemIcon';

interface CampFarmingTabProps {
  state: GameState;
  onUpdatePolicy?: (policyKey: 'foodPolicy' | 'waterPolicy', value: 'ration' | 'normal' | 'generous') => void;
  onNavigateTab: (tab: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const CampFarmingTab: React.FC<CampFarmingTabProps> = ({
  state,
  onUpdatePolicy,
  onNavigateTab,
}) => {
  const { inventory, survivors, settings, buildings } = state;

  // Calculate available food and water in camp inventory
  const foodItems = inventory.items.filter(i => {
    return (
      i.itemId === 'ITEM_WILD_COCONUT' ||
      i.itemId === 'ITEM_OPEN_COCONUT' ||
      i.itemId === 'ITEM_DRIED_FISH' ||
      i.itemId === 'ITEM_SMOKED_MEAT' ||
      i.itemId === 'ITEM_ROASTED_FISH'
    );
  });
  const totalFoodCount = foodItems.reduce((sum, item) => sum + item.quantity, 0);

  const waterItems = inventory.items.filter(i => {
    return (
      i.itemId === 'ITEM_BOILED_WATER_BOWL' ||
      i.itemId === 'ITEM_OPEN_COCONUT' ||
      i.itemId === 'ITEM_FRESH_WATER'
    );
  });
  const totalWaterCount = waterItems.reduce((sum, item) => sum + item.quantity, 0);

  // Daily consumption estimates
  const dailyFoodConsumption = survivors.length * (settings.foodPolicy === 'generous' ? 3 : settings.foodPolicy === 'ration' ? 1 : 2);
  const dailyWaterConsumption = survivors.length * (settings.waterPolicy === 'generous' ? 4 : settings.waterPolicy === 'ration' ? 1.5 : 2.5);

  const daysFoodLeft = dailyFoodConsumption > 0 ? (totalFoodCount / dailyFoodConsumption).toFixed(1) : '∞';
  const daysWaterLeft = dailyWaterConsumption > 0 ? (totalWaterCount / dailyWaterConsumption).toFixed(1) : '∞';

  const hasCampfire = buildings.some(b => b.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && b.isBuilt);
  const hasRainCollector = buildings.some(b => b.buildingId === 'BUILDING_RAIN_COLLECTOR' && b.isBuilt);

  return (
    <div
      className="w-full h-full flex flex-col justify-between text-[#e8dfce] select-none pointer-events-auto"
      style={{
        fontFamily: UI_FONT,
      }}
    >
      {/* Top Banner */}
      <div className="camp-sunken-panel-soft flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="camp-sunken-slot p-1.5 text-emerald-300">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5ecd8]">
              LƯƠNG THỰC & CANH TÁC (FOOD & FARMING)
            </h2>
            <p className="text-[11px] text-[#a9bcae]">
              Cân đối dự trữ thực phẩm, chính sách khẩu phần và cơ sở chế biến bảo quản lâu dài.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-amber-400" />
            <span className="text-[#a8bea3]">Lương thực:</span>
            <span className="font-mono font-bold text-amber-300">{totalFoodCount} phần (~{daysFoodLeft} ngày)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="w-4 h-4 text-sky-400" />
            <span className="text-[#a8bea3]">Nước sạch:</span>
            <span className="font-mono font-bold text-sky-300">{totalWaterCount} phần (~{daysWaterLeft} ngày)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Policy Dashboard (Left) + Food Preservation & Farming Facilities (Right) */}
      <div className="flex-1 flex gap-3 mt-3 min-h-0">
        {/* Left: Food & Hydration Policy Panel */}
        <div className="w-[45%] camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2.5 camp-groove-divider">
              <Utensils className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#dce7df]">
                CHÍNH SÁCH KHẨU PHẦN LAO ĐỘNG
              </span>
            </div>

            {/* Food Policy Selector */}
            <div className="mt-3.5">
              <label className="text-xs font-semibold text-[#c8dacb] flex items-center justify-between">
                <span>Khẩu phần thức ăn (Food Policy):</span>
                <span className="text-[11px] font-mono text-amber-300">
                  {settings.foodPolicy === 'ration' ? 'Tiết kiệm (-1/người)' : settings.foodPolicy === 'generous' ? 'Hào phóng (+3/người)' : 'Tiêu chuẩn (2/người)'}
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { id: 'ration', label: 'Tiết kiệm' },
                  { id: 'normal', label: 'Tiêu chuẩn' },
                  { id: 'generous', label: 'Hào phóng' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdatePolicy?.('foodPolicy', p.id as any)}
                    className={`py-1.5 px-2 rounded text-xs font-semibold transition-all cursor-pointer ${
                      settings.foodPolicy === p.id
                        ? 'bg-[#23563f] text-[#f7eee1] border border-emerald-400 shadow'
                        : 'camp-sunken-slot text-[#8ea696] hover:bg-[#163629] border border-black/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Water Policy Selector */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-[#c8dacb] flex items-center justify-between">
                <span>Khẩu phần nước uống (Water Policy):</span>
                <span className="text-[11px] font-mono text-sky-300">
                  {settings.waterPolicy === 'ration' ? 'Tiết kiệm (-1.5/người)' : settings.waterPolicy === 'generous' ? 'Hào phóng (+4/người)' : 'Tiêu chuẩn (2.5/người)'}
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { id: 'ration', label: 'Tiết kiệm' },
                  { id: 'normal', label: 'Tiêu chuẩn' },
                  { id: 'generous', label: 'Hào phóng' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdatePolicy?.('waterPolicy', p.id as any)}
                    className={`py-1.5 px-2 rounded text-xs font-semibold transition-all cursor-pointer ${
                      settings.waterPolicy === p.id
                        ? 'bg-[#1d4c5c] text-[#f7eee1] border border-sky-400 shadow'
                        : 'camp-sunken-slot text-[#8ea696] hover:bg-[#163629] border border-black/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Survivor Health Tip */}
            <div className="mt-4 p-3 rounded camp-sunken-slot text-xs text-[#9eb5a5] leading-relaxed">
              <p className="flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Khẩu phần hào phóng giúp tăng Morale và phục hồi thể lực nhanh chóng. Nếu nguồn lương thực cạn kiệt, hãy chuyển sang mức Tiết kiệm để kéo dài ngày sinh tồn.
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('crafting')}
            className="w-full py-2 px-3 rounded bg-[#163a2a] hover:bg-[#204e39] border border-[#2b5c42] text-xs font-semibold text-[#f1eadc] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow"
          >
            <span>Mở xưởng chế biến thực phẩm & đun nước</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>

        {/* Right: Preservation Racks & Nursery Plots */}
        <div className="flex-1 camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 camp-groove-divider">
              <div className="flex items-center gap-2">
                <TreePine className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#dce7df]">
                  CƠ SỞ CHẾ BIẾN & CANH TÁC
                </span>
              </div>
            </div>

            {/* Facilities Cards */}
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              {/* Facility 1: Campfire Cooking */}
              <div className="p-2.5 rounded-lg camp-sunken-slot flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-1.5">
                      <Flame className={`w-4 h-4 ${hasCampfire ? 'text-amber-400' : 'text-[#647c6e]'}`} />
                      Bếp Nấu Lửa Trại
                    </span>
                    <span className={`text-[10px] font-semibold ${hasCampfire ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {hasCampfire ? 'Đang hoạt động' : 'Chưa dựng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#90a898] mt-1 leading-relaxed">
                    Nấu cá suối, đun sôi nước dừa tiệt trùng khuẩn và nướng thịt tươi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab(hasCampfire ? 'crafting' : 'buildings')}
                  className="py-1 px-2 rounded bg-[#17382a] hover:bg-[#204a37] text-[11px] font-semibold text-[#dbe6df] border border-[#2c5841] cursor-pointer text-center"
                >
                  {hasCampfire ? 'Chế biến món ăn' : 'Dựng bếp lửa'}
                </button>
              </div>

              {/* Facility 2: Rain Collector */}
              <div className="p-2.5 rounded-lg camp-sunken-slot flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-1.5">
                      <Droplets className={`w-4 h-4 ${hasRainCollector ? 'text-sky-400' : 'text-[#647c6e]'}`} />
                      Máng Thu Hứng Nước Mưa
                    </span>
                    <span className={`text-[10px] font-semibold ${hasRainCollector ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {hasRainCollector ? 'Sẵn sàng' : 'Chưa dựng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#90a898] mt-1 leading-relaxed">
                    Thu gom nước mưa tự nhiên tích trữ vào thùng chứa tại bãi trại.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab(hasRainCollector ? 'storage' : 'buildings')}
                  className="py-1 px-2 rounded bg-[#17382a] hover:bg-[#204a37] text-[11px] font-semibold text-[#dbe6df] border border-[#2c5841] cursor-pointer text-center"
                >
                  {hasRainCollector ? 'Kiểm tra thùng nước' : 'Xây máng hứng'}
                </button>
              </div>

              {/* Facility 3: Nursery Bed */}
              <div className="p-2.5 rounded-lg camp-sunken-slot flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-1.5">
                      <Leaf className="w-4 h-4 text-emerald-400" />
                      Vườn Ươm Măng Tre & Thảo Mộc
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Cơ sở tự nhiên</span>
                  </div>
                  <p className="text-[11px] text-[#90a898] mt-1 leading-relaxed">
                    Trồng giống măng tre non và cây dược liệu quanh bãi trại để thu hoạch ổn định.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('buildings')}
                  className="py-1 px-2 rounded bg-[#17382a] hover:bg-[#204a37] text-[11px] font-semibold text-[#dbe6df] border border-[#2c5841] cursor-pointer text-center"
                >
                  Phát triển luống ươm
                </button>
              </div>

              {/* Facility 4: Fish Drying Rack */}
              <div className="p-2.5 rounded-lg camp-sunken-slot flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-amber-400" />
                      Giàn Phơi Sấy Khô
                    </span>
                    <span className="text-[10px] text-amber-300 font-semibold">Phơi nắng tự nhiên</span>
                  </div>
                  <p className="text-[11px] text-[#90a898] mt-1 leading-relaxed">
                    Sấy khô cá suối và thịt thú thành thực phẩm dự trữ không bị thiu hỏng.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('crafting')}
                  className="py-1 px-2 rounded bg-[#17382a] hover:bg-[#204a37] text-[11px] font-semibold text-[#dbe6df] border border-[#2c5841] cursor-pointer text-center"
                >
                  Phơi sấy lương thực
                </button>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded camp-sunken-slot text-xs text-[#8ca595] flex items-center justify-between">
            <span>Sản lượng sinh học bãi trại tăng +20% khi thời tiết ẩm ướt</span>
            <span className="text-emerald-400 font-semibold">Tự động hồi phục</span>
          </div>
        </div>
      </div>
    </div>
  );
};
