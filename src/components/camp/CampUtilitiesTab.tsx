import React from 'react';
import {
  Flame,
  Droplets,
  Sparkles,
  TreePine,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Layers,
  Thermometer
} from 'lucide-react';
import { GameState } from '../../types';

interface CampUtilitiesTabProps {
  state: GameState;
  onNavigateTab: (tab: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const CampUtilitiesTab: React.FC<CampUtilitiesTabProps> = ({ state, onNavigateTab }) => {
  const { buildings, weather, inventory } = state;

  const hasCampfire = buildings.some(b => b.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && b.isBuilt);
  const hasRainCollector = buildings.some(b => b.buildingId === 'BUILDING_RAIN_COLLECTOR' && b.isBuilt);
  const firewoodItem = inventory.items.find(i => i.itemId === 'ITEM_DRIFTWOOD_BRANCH' || i.itemId === 'ITEM_BAMBOO_STALK');
  const firewoodCount = firewoodItem ? firewoodItem.quantity : 0;

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
      {/* Top Banner */}
      <div className="camp-sunken-panel-soft flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="camp-sunken-slot p-1.5 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5ecd8]">
              TIỆN ÍCH DOANH TRẠI (CAMP UTILITIES)
            </h2>
            <p className="text-[11px] text-[#a9bcae]">
              Duy trì nguồn lửa, lọc nước uống tiệt trùng, đốt than hoạt tính và vệ sinh rác thải bãi trại.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded camp-sunken-slot text-emerald-300 font-medium">
            Nhiệt độ môi trường: {weather.temperatureC}°C
          </span>
          <span className="px-2.5 py-1 rounded camp-sunken-slot text-amber-300 font-medium">
            Củi gỗ dự trữ: {firewoodCount} cây
          </span>
        </div>
      </div>

      {/* 4 Utility Cards */}
      <div className="grid grid-cols-2 gap-3.5 mt-3 flex-1 min-h-0">
        {/* Utility 1: Hearth / Fire Maintenance */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                BẾP LỬA TRẠI TRUNG TÂM (CAMPFIRE HEARTH)
              </span>
              <span className={`text-[11px] font-semibold ${hasCampfire ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hasCampfire ? 'Đang đỏ lửa' : 'Chưa dựng bếp'}
              </span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Bếp lửa cung cấp ánh sáng ban đêm, xua đuổi muỗi rừng và thú ăn thịt, đồng thời là nguồn nhiệt duy nhất để đun nước tiệt trùng và nấu chín thực phẩm tươi.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Trạng thái nhiệt:</span>
                <span className="font-semibold text-amber-300">{hasCampfire ? 'Ấm áp (+15 Morale ban đêm)' : 'Tắt lửa'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Khả năng đun nấu:</span>
                <span className="font-semibold text-emerald-400">{hasCampfire ? 'Sẵn sàng chế biến' : 'Cần đốt lửa'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(hasCampfire ? 'crafting' : 'buildings')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            {hasCampfire ? 'Mở xưởng đun nước & nấu nướng' : 'Xây dựng bếp lửa trại'}
          </button>
        </div>

        {/* Utility 2: Water Filtration & Rain Collection */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Droplets className="w-4 h-4 text-sky-400" />
                MÁNG HỨNG & LỌC NƯỚC MƯA
              </span>
              <span className={`text-[11px] font-semibold ${hasRainCollector ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hasRainCollector ? 'Hoạt động' : 'Chưa có máng'}
              </span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Máng tre gom nước mưa tự nhiên khi có bão hoặc mưa rào. Nước mưa hứng được sạch hơn nước suối đục và không chứa vi khuẩn gây sốt rét hay tiêu chảy.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Tốc độ hứng khi mưa:</span>
                <span className="font-semibold text-sky-300">~2.5 lít / giờ mưa rào</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Chất lượng nước:</span>
                <span className="font-semibold text-emerald-400">Nước mưa tự nhiên (An toàn)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab(hasRainCollector ? 'storage' : 'buildings')}
            className="w-full py-2 rounded bg-[#163842] hover:bg-[#1d4855] border border-[#265b6c] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            {hasRainCollector ? 'Kiểm tra kho nước' : 'Xây dựng máng nước mưa'}
          </button>
        </div>

        {/* Utility 3: Charcoal Production */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <TreePine className="w-4 h-4 text-emerald-400" />
                LÒ Ủ THAN HOẠT TÍNH
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold">Công nghệ sơ khai</span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Nung yếm khí củi khô và vỏ dừa dưới lớp đất sét để tạo than củi. Than hoạt tính là thành phần thiết yếu để chế thuốc giải độc và màng lọc nước suối.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Tỷ lệ chuyển đổi:</span>
                <span className="font-semibold text-amber-300">4 Cành củi ➔ 2 Than củi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Công dụng:</span>
                <span className="font-semibold text-emerald-400">Khử độc & Luyện kim cơ bản</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('crafting')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            Chế biến than củi
          </button>
        </div>

        {/* Utility 4: Waste Management & Compost */}
        <div className="camp-sunken-panel p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 camp-groove-divider">
              <span className="text-xs font-bold text-[#f5ebd8] flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-lime-400" />
                HỐ Ủ PHÂN COMPOST & VỆ SINH TRẠI
              </span>
              <span className="text-[11px] text-lime-400 font-semibold">Tự phân huỷ sinh học</span>
            </div>

            <p className="text-xs text-[#9eb5a5] mt-2.5 leading-relaxed">
              Gom thức ăn thừa, xương cá và vỏ cây ôi thiu vào hố ủ xa lều ngủ. Giúp duy trì chỉ số Cleanliness của bãi trại và hạn chế thu hút ruồi muỗi mang mầm bệnh.
            </p>

            <div className="mt-3 p-2.5 rounded camp-sunken-slot space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Chỉ số Cleanliness:</span>
                <span className="font-semibold text-emerald-400">Tăng +15% khi định kỳ dọn rác</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8ba394]">Sản phẩm phụ:</span>
                <span className="font-semibold text-lime-300">Phân bón hữu cơ cho vườn ươm</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('assign')}
            className="w-full py-2 rounded bg-[#1b3d2d] hover:bg-[#25523d] border border-[#2e5e45] text-xs font-semibold text-[#f1eadc] transition-colors cursor-pointer text-center shadow"
          >
            Phân công người dọn dẹp trại
          </button>
        </div>
      </div>
    </div>
  );
};
