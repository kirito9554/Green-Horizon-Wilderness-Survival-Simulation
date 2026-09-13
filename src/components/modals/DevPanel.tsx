import React from 'react';
import { CornerBrackets } from '../common/CornerBrackets';
import { Wrench, X, Clock, CloudRain, Sun, Heart, PawPrint } from 'lucide-react';
import { WeatherType } from '../../types';

interface DevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddResource: (itemId: string, quantity: number) => void;
  onFastForwardHours: (hours: number) => void;
  onHealAllSurvivors: () => void;
  onChangeWeather: (weather: WeatherType) => void;
  onTriggerEncounter?: () => void;
}

export const DevPanel: React.FC<DevPanelProps> = ({
  isOpen,
  onClose,
  onAddResource,
  onFastForwardHours,
  onHealAllSurvivors,
  onChangeWeather,
  onTriggerEncounter,
}) => {
  if (!isOpen) return null;

  const handleTrigger = () => {
    if (onTriggerEncounter) {
      onTriggerEncounter();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('encounter', '1');
      window.location.href = `${url.pathname}${url.search}${url.hash}`;
    }
  };

  return (
    <div className="fixed bottom-16 right-4 z-50 organic-chiseled-frame p-4 w-84 text-[#e2d5bd] shadow-2xl select-none">
      <CornerBrackets style="iron" size={16} inset={2} />
      <div className="flex items-center justify-between border-b border-[#4d3a24] pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
          <Wrench className="w-4 h-4 text-amber-400" />
          <span className="tracking-wide uppercase font-serif">Expedition Devkit</span>
        </div>
        <button onClick={onClose} className="p-1 rounded btn-organic-subtle text-[#a8957c] hover:text-white cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <span className="text-[10px] text-[#9e8b74] font-serif font-bold block mb-1.5 tracking-wider uppercase">Cấp Tài Nguyên:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => onAddResource('ITEM_BOILED_WATER_BOWL', 10)} className="btn-organic-subtle px-2 py-1.5 text-sky-300 text-[10px] font-medium text-left cursor-pointer">+10 Nước sạch</button>
            <button onClick={() => onAddResource('ITEM_GRILLED_FISH', 10)} className="btn-organic-subtle px-2 py-1.5 text-amber-300 text-[10px] font-medium text-left cursor-pointer">+10 Cá nướng</button>
            <button onClick={() => onAddResource('ITEM_DRIFTWOOD_BRANCH', 30)} className="btn-organic-subtle px-2 py-1.5 text-emerald-300 text-[10px] font-medium text-left cursor-pointer">+30 Gỗ thô</button>
            <button onClick={() => onAddResource('ITEM_RIVER_PEBBLE', 20)} className="btn-organic-subtle px-2 py-1.5 text-slate-300 text-[10px] font-medium text-left cursor-pointer">+20 Đá cuội</button>
            <button onClick={() => onAddResource('ITEM_WOVEN_CORDAGE', 15)} className="btn-organic-subtle px-2 py-1.5 text-emerald-400 text-[10px] font-medium text-left cursor-pointer">+15 Dây bện</button>
            <button onClick={() => onAddResource('ITEM_PRIMITIVE_STONE_AXE', 1)} className="btn-organic-subtle px-2 py-1.5 text-amber-400 text-[10px] font-medium text-left cursor-pointer">+1 Rìu đá thô</button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#3d2e1c]">
          <span className="text-[10px] text-[#9e8b74] font-serif font-bold block mb-1.5 tracking-wider uppercase">Thời Gian & Thể Trạng:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => onFastForwardHours(3)} className="btn-organic-amber px-2 py-1.5 text-[#fdf4e4] text-[10px] flex items-center justify-center gap-1.5 font-bold cursor-pointer">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>Nhảy +3 Giờ</span>
            </button>
            <button onClick={onHealAllSurvivors} className="btn-organic-action px-2 py-1.5 text-emerald-200 text-[10px] flex items-center justify-center gap-1.5 font-bold cursor-pointer">
              <Heart className="w-3.5 h-3.5 text-rose-300" />
              <span>Hồi phục 100%</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#3d2e1c]">
          <span className="text-[10px] text-[#9e8b74] font-serif font-bold block mb-1.5 tracking-wider uppercase">Điều Chỉnh Thời Tiết:</span>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => onChangeWeather('clear')} className="btn-organic-subtle py-1.5 px-1 text-[10px] text-amber-300 flex items-center justify-center gap-1 font-medium cursor-pointer"><Sun className="w-3 h-3" /> Nắng</button>
            <button onClick={() => onChangeWeather('heavy_rain')} className="btn-organic-subtle py-1.5 px-1 text-[10px] text-sky-400 flex items-center justify-center gap-1 font-medium cursor-pointer"><CloudRain className="w-3 h-3" /> Mưa</button>
            <button onClick={() => onChangeWeather('storm')} className="btn-organic-danger py-1.5 px-1 text-[10px] text-rose-200 flex items-center justify-center gap-1 font-medium cursor-pointer">Bão táp</button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#3d2e1c]">
          <span className="text-[10px] text-[#9e8b74] font-serif font-bold block mb-1.5 tracking-wider uppercase">Encounter Test:</span>
          <button
            onClick={handleTrigger}
            className="w-full btn-organic-amber py-2 px-3 text-amber-100 text-[11px] font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <PawPrint className="w-4 h-4 text-amber-300" />
            <span>Kích Hoạt Chạm Trán: Báo Hoa Mai</span>
          </button>
        </div>
      </div>
    </div>
  );
};