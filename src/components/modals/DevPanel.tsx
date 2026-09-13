import React from 'react';
import { Wrench, X, Clock, CloudRain, Sun, Heart, PawPrint } from 'lucide-react';
import { WeatherType } from '../../types';

interface DevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddResource: (itemId: string, quantity: number) => void;
  onFastForwardHours: (hours: number) => void;
  onHealAllSurvivors: () => void;
  onChangeWeather: (weather: WeatherType) => void;
  onStartEncounter?: () => void;
}

export const DevPanel: React.FC<DevPanelProps> = ({
  isOpen,
  onClose,
  onAddResource,
  onFastForwardHours,
  onHealAllSurvivors,
  onChangeWeather,
  onStartEncounter,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 bg-[#16211a] border border-amber-500/60 rounded-xl p-4 w-80 text-[#e2d5bd] shadow-2xl backdrop-blur select-none">
      <div className="flex items-center justify-between border-b border-[#28382d] pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Wrench className="w-4 h-4" />
          <span>Bảng điều khiển cân bằng (Dev Tools)</span>
        </div>
        <button onClick={onClose} className="p-0.5 text-[#788e80] hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <span className="text-[10px] text-[#788e80] font-mono block mb-1">CẤP TÀI NGUYÊN:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => onAddResource('ITEM_BOILED_WATER_BOWL', 10)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-sky-300 rounded border border-[#2c3d31] text-[10px]">+10 Nước sạch</button>
            <button onClick={() => onAddResource('ITEM_GRILLED_FISH', 10)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-amber-300 rounded border border-[#2c3d31] text-[10px]">+10 Cá nướng</button>
            <button onClick={() => onAddResource('ITEM_DRIFTWOOD_BRANCH', 30)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-emerald-300 rounded border border-[#2c3d31] text-[10px]">+30 Gỗ thô</button>
            <button onClick={() => onAddResource('ITEM_RIVER_PEBBLE', 20)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-slate-300 rounded border border-[#2c3d31] text-[10px]">+20 Đá cuội</button>
            <button onClick={() => onAddResource('ITEM_WOVEN_CORDAGE', 15)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-emerald-400 rounded border border-[#2c3d31] text-[10px]">+15 Dây bện</button>
            <button onClick={() => onAddResource('ITEM_PRIMITIVE_STONE_AXE', 1)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-amber-400 rounded border border-[#2c3d31] text-[10px]">+1 Rìu đá thô</button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#25352b]">
          <span className="text-[10px] text-[#788e80] font-mono block mb-1">THỜI GIAN & THỂ TRẠNG:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => onFastForwardHours(3)} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-[#f2e7d3] rounded border border-[#2c3d31] text-[10px] flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Nhảy +3 Giờ</span>
            </button>
            <button onClick={onHealAllSurvivors} className="px-2 py-1 bg-[#1e2a22] hover:bg-[#25352b] text-emerald-300 rounded border border-[#2c3d31] text-[10px] flex items-center justify-center gap-1">
              <Heart className="w-3 h-3 text-red-400" />
              <span>Hồi phục 100%</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[#25352b]">
          <span className="text-[10px] text-[#788e80] font-mono block mb-1">ĐIỀU CHỈNH THỜI TIẾT:</span>
          <div className="grid grid-cols-3 gap-1">
            <button onClick={() => onChangeWeather('clear')} className="p-1 bg-[#1a251e] hover:bg-[#223328] rounded text-[10px] text-amber-300 flex items-center justify-center gap-1"><Sun className="w-3 h-3" /> Nắng</button>
            <button onClick={() => onChangeWeather('heavy_rain')} className="p-1 bg-[#1a251e] hover:bg-[#223328] rounded text-[10px] text-sky-400 flex items-center justify-center gap-1"><CloudRain className="w-3 h-3" /> Mưa lớn</button>
            <button onClick={() => onChangeWeather('storm')} className="p-1 bg-[#1a251e] hover:bg-[#223328] rounded text-[10px] text-red-400 flex items-center justify-center gap-1">Bão táp</button>
          </div>
        </div>

        {onStartEncounter && (
          <div className="pt-2 border-t border-[#25352b]">
            <span className="text-[10px] text-[#788e80] font-mono block mb-1">ENCOUNTER TEST:</span>
            <button
              onClick={() => { onStartEncounter(); onClose(); }}
              className="w-full px-2 py-1.5 bg-[#3a2516] hover:bg-[#51321c] text-amber-200 rounded border border-amber-600/50 text-[10px] flex items-center justify-center gap-1.5"
            >
              <PawPrint className="w-3.5 h-3.5" />
              <span>Trigger Jungle Leopard</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};