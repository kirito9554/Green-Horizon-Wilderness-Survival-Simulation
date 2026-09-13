import React, { useState } from 'react';
import { 
  Flame, 
  Tent, 
  Package, 
  Droplets, 
  CircleDot, 
  TreePine, 
  Leaf, 
  Link, 
  Sparkles, 
  Clock, 
  UserCheck,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { GameState } from '../../types';
import { AREAS_DATABASE } from '../../data/areas';
import { ITEMS_DATABASE } from '../../data/items';
import { calculateResourceRecoveryBonus } from '../../simulation/resourcePools';
import { getPoiImageUrl } from '../../utils/poiImageManager';

interface CampViewProps {
  state: GameState;
  onStartGathering: (survivorId: string, nodeId: string) => void;
  onNavigateTab: (tab: 'inventory' | 'crafting' | 'buildings') => void;
  onRestSurvivor: (survivorId: string) => void;
}

export const CampView: React.FC<CampViewProps> = ({
  state,
  onStartGathering,
  onNavigateTab,
}) => {
  const { gameTime, weather, buildings, survivors, resourcePools } = state;
  const campArea = AREAS_DATABASE.AREA_CAMP_CLEARING;

  // Selected survivor for quick-gathering assignments
  const [assignedSurvivorId, setAssignedSurvivorId] = useState<string>(
    survivors[0]?.id || ''
  );

  // Derive atmospheric time of day
  const hours = gameTime.minuteOfDay / 60;
  let timeOfDayCategory: 'dawn' | 'noon' | 'sunset' | 'night' = 'noon';
  let skyGradient = 'from-[#1a382c] via-[#12261e] to-[#0c1813]';
  let ambientLighting = 'opacity-90';

  if (hours >= 5 && hours < 8) {
    timeOfDayCategory = 'dawn';
    skyGradient = 'from-[#422e20]/90 via-[#242c22]/90 to-[#111c16]/95';
  } else if (hours >= 8 && hours < 16) {
    timeOfDayCategory = 'noon';
    skyGradient = 'from-[#174435]/85 via-[#153429]/85 to-[#0f221a]/90';
  } else if (hours >= 16 && hours < 19) {
    timeOfDayCategory = 'sunset';
    skyGradient = 'from-[#542a17]/90 via-[#2b271d]/90 to-[#131d17]/95';
  } else {
    timeOfDayCategory = 'night';
    skyGradient = 'from-[#0a1012]/95 via-[#091512]/95 to-[#050b08]/98';
    ambientLighting = 'opacity-70';
  }

  const isRaining = weather.current === 'light_rain' || weather.current === 'heavy_rain' || weather.current === 'storm';

  // Check built structures
  const hasCampfire = buildings.some(b => b.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && b.isBuilt);
  const hasShelter = buildings.some(b => b.buildingId === 'BUILDING_LEAF_SHELTER' && b.isBuilt);
  const hasStorageRack = buildings.some(b => b.buildingId === 'BUILDING_WOVEN_BASKET_RACK' && b.isBuilt);
  const hasRainCollector = buildings.some(b => b.buildingId === 'BUILDING_RAIN_COLLECTOR' && b.isBuilt);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto bg-[#0d1410] text-[#e2d5bd]">
      {/* 1. Atmospheric 2D Camp Scene with Real Photo Backdrop */}
      <div className="relative w-full min-h-72 rounded-xl overflow-hidden border border-[#27382d] p-4 flex flex-col justify-between shadow-2xl transition-colors duration-1000 select-none">
        {/* Real photo background asset */}
        <img
          src={getPoiImageUrl(campArea.id, campArea.imageUrl)}
          alt="Camp Clearing Backdrop"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-60 contrast-110 saturate-90 pointer-events-none"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=80';
          }}
        />

        {/* Dynamic sky and time-of-day gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-b ${skyGradient} pointer-events-none mix-blend-multiply opacity-80`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1410] via-transparent to-black/40 pointer-events-none" />

        {/* Dynamic rain overlay */}
        {isRaining && (
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#48a9e6_1px,transparent_1px)] [background-size:16px_16px] opacity-35 animate-pulse" />
        )}

        {/* Scene Header */}
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] bg-[#16251c]/90 border border-[#2f4637] uppercase tracking-wider text-emerald-300 font-mono backdrop-blur-sm">
                {timeOfDayCategory === 'dawn' && 'Bình minh (Dawn)'}
                {timeOfDayCategory === 'noon' && 'Nắng trưa (Midday)'}
                {timeOfDayCategory === 'sunset' && 'Hoàng hôn (Dusk)'}
                {timeOfDayCategory === 'night' && 'Đêm rừng sâu (Night)'}
              </span>
              <span className="text-xs text-[#d2e2d7] drop-shadow-md">Bờ biển & Trại chính</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#f8f1e4] mt-1 drop-shadow-lg tracking-wide">
              {state.campName}
            </h2>
          </div>

          <div className="bg-[#142119]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2a3c30] text-xs text-[#c6d7cb] flex items-center gap-2 shadow">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Khu vực an toàn</span>
          </div>
        </div>

        {/* 2D Camp Interactive Hotspot Layout */}
        <div className={`relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end transition-opacity duration-500 mt-6 ${ambientLighting}`}>
          {/* Hotspot 1: Campfire */}
          <div
            onClick={() => onNavigateTab('crafting')}
            className={`group p-3 rounded-lg border backdrop-blur-md cursor-pointer transition-all ${
              hasCampfire
                ? 'bg-[#211d17]/85 border-amber-500/70 hover:border-amber-400 hover:scale-[1.02] shadow-lg shadow-amber-950/40'
                : 'bg-[#152019]/75 border-dashed border-[#34483b] hover:border-amber-500/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Flame className={`w-5 h-5 ${hasCampfire ? 'text-amber-400 animate-bounce' : 'text-[#6f8376]'}`} />
              <span className="text-xs font-semibold text-[#f0e4d0]">Bếp Lửa Trại</span>
            </div>
            <p className="text-[10px] text-[#b4c8bb]">
              {hasCampfire ? 'Đang cháy: Đun nước & Nấu cá' : 'Chưa dựng (Cần đá cuội)'}
            </p>
          </div>

          {/* Hotspot 2: Shelter */}
          <div
            onClick={() => onNavigateTab('buildings')}
            className={`group p-3 rounded-lg border backdrop-blur-md cursor-pointer transition-all ${
              hasShelter
                ? 'bg-[#1a2820]/85 border-emerald-500/70 hover:border-emerald-400 hover:scale-[1.02] shadow-lg shadow-emerald-950/40'
                : 'bg-[#152019]/75 border-dashed border-[#34483b] hover:border-emerald-500/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Tent className={`w-5 h-5 ${hasShelter ? 'text-emerald-400' : 'text-[#6f8376]'}`} />
              <span className="text-xs font-semibold text-[#f0e4d0]">Chòi Lá Cọ</span>
            </div>
            <p className="text-[10px] text-[#b4c8bb]">
              {hasShelter ? 'Che mưa gió, hồi phục thể lực' : 'Chưa dựng (Cần lá cọ & dây)'}
            </p>
          </div>

          {/* Hotspot 3: Storage Rack */}
          <div
            onClick={() => onNavigateTab('inventory')}
            className={`group p-3 rounded-lg border backdrop-blur-md cursor-pointer transition-all ${
              hasStorageRack
                ? 'bg-[#222119]/85 border-amber-600/70 hover:border-amber-500 hover:scale-[1.02] shadow-lg shadow-amber-950/40'
                : 'bg-[#152019]/75 border-dashed border-[#34483b] hover:border-amber-600/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Package className={`w-5 h-5 ${hasStorageRack ? 'text-amber-400' : 'text-[#6f8376]'}`} />
              <span className="text-xs font-semibold text-[#f0e4d0]">Kệ Chứa Đồ</span>
            </div>
            <p className="text-[10px] text-[#b4c8bb]">
              {hasStorageRack ? 'Mở rộng sức chứa kho thêm 30kg' : 'Chưa dựng (Cần gỗ trôi dạt)'}
            </p>
          </div>

          {/* Hotspot 4: Rain Collector */}
          <div
            onClick={() => onNavigateTab('buildings')}
            className={`group p-3 rounded-lg border backdrop-blur-md cursor-pointer transition-all ${
              hasRainCollector
                ? 'bg-[#17252c]/85 border-sky-500/70 hover:border-sky-400 hover:scale-[1.02] shadow-lg shadow-sky-950/40'
                : 'bg-[#152019]/75 border-dashed border-[#34483b] hover:border-sky-500/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Droplets className={`w-5 h-5 ${hasRainCollector ? 'text-sky-400' : 'text-[#6f8376]'}`} />
              <span className="text-xs font-semibold text-[#f0e4d0]">Máng Hứng Nước</span>
            </div>
            <p className="text-[10px] text-[#b4c8bb]">
              {hasRainCollector ? 'Tự động hứng khi có mưa' : 'Chưa dựng (Cần máng lá cọ)'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Quick Gathering & Ecological Storage Pools */}
      <div className="bg-[#141d18] border border-[#27382d] rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24342a] pb-3">
          <div>
            <h3 className="text-sm font-serif font-bold text-[#f2e7d3] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Bãi tài nguyên tự nhiên quanh bãi trại
            </h3>
            <p className="text-xs text-[#8da496] mt-0.5">
              Hệ sinh thái hữu hạn: trữ lượng còn lại quyết định tốc độ hồi phục sinh học. Tránh khai thác cạn kiệt để bảo toàn hệ số bonus.
            </p>
          </div>

          {/* Worker Assignment Selector */}
          <div className="flex items-center gap-2.5 bg-[#1b2720] px-3 py-1.5 rounded-lg border border-[#2b3c31]">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-[#a6b8ab] whitespace-nowrap">Giao việc cho:</span>
            <select
              value={assignedSurvivorId}
              onChange={(e) => setAssignedSurvivorId(e.target.value)}
              className="bg-[#141f19] text-xs text-[#f2e7d3] rounded px-2 py-1 border border-[#364a3d] focus:outline-none focus:border-emerald-400"
            >
              {survivors.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currentAction.type === 'idle' ? 'Rảnh rỗi' : 'Đang bận'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Node Cards with Ecological Pool Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {campArea.nodes.map(node => {
            const chosenSurvivor = survivors.find(s => s.id === assignedSurvivorId);
            const isSurvivorBusy = chosenSurvivor?.currentAction.type !== 'idle';

            // Resource Pool details
            const pool = resourcePools ? resourcePools[node.id] : null;
            const currentStock = pool ? pool.currentStock : node.maxYield * 6;
            const maxStock = pool ? pool.maxStock : 30;
            const percent = Math.min(100, Math.max(0, Math.round((currentStock / maxStock) * 100)));
            const isDepleted = currentStock < 1;
            const recoveryPerHour = pool ? pool.baseRecoveryPerHour : 2.4;

            const { bonusPercent, statusLabel, badgeColor, status } = calculateResourceRecoveryBonus(currentStock, maxStock);

            const getNodeIcon = (itemId: string) => {
              switch (itemId) {
                case 'ITEM_WILD_COCONUT': return <CircleDot className="w-4 h-4 text-amber-300" />;
                case 'ITEM_DRIFTWOOD_BRANCH': return <TreePine className="w-4 h-4 text-emerald-400" />;
                case 'ITEM_RIVER_PEBBLE': return <CircleDot className="w-4 h-4 text-slate-300" />;
                case 'ITEM_PALM_LEAF': return <Leaf className="w-4 h-4 text-emerald-300" />;
                case 'ITEM_VINE_FIBER': return <Link className="w-4 h-4 text-emerald-500" />;
                default: return <TreePine className="w-4 h-4 text-emerald-400" />;
              }
            };

            // Progress bar color
            const getBarColor = () => {
              if (percent >= 60) return 'bg-emerald-500';
              if (percent >= 30) return 'bg-amber-500';
              if (percent >= 10) return 'bg-orange-500';
              return 'bg-red-500';
            };

            return (
              <div
                key={node.id}
                className="bg-[#18231d] border border-[#27382d] rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-[#3a5242] transition-colors shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#f2e7d3] flex items-center gap-1.5">
                      {getNodeIcon(node.itemId)}
                      {node.name}
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono font-medium">
                      ~{node.minYield}-{node.maxYield}x / lần
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8ea596] leading-relaxed">
                    {node.description}
                  </p>
                </div>

                {/* Storage Pool & Recovery Engine */}
                <div className="bg-[#131b16] rounded-lg p-2.5 border border-[#223126] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#a4b6aa] font-medium flex items-center gap-1">
                      Trữ lượng còn lại:
                    </span>
                    <span className="font-mono font-semibold text-[#f0e6d2]">
                      {Math.round(currentStock * 10) / 10} / {maxStock} ({percent}%)
                    </span>
                  </div>

                  {/* Stock progress bar */}
                  <div className="w-full bg-[#0a0f0c] h-2 rounded-full overflow-hidden border border-[#202d24]">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${getBarColor()}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Ecological bonus tag */}
                  <div className="flex items-center justify-between pt-1 text-[9px]">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium flex items-center gap-1 ${badgeColor}`}>
                      {status === 'abundant' && <TrendingUp className="w-2.5 h-2.5" />}
                      {status === 'stressed' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {statusLabel}
                    </span>
                    <span className="text-[#788e80] font-mono">
                      +{(recoveryPerHour * (status === 'abundant' ? 1 + bonusPercent/100 : status === 'stressed' ? Math.max(0.3, 1 + bonusPercent/100) : 1)).toFixed(1)}/giờ
                    </span>
                  </div>
                </div>

                {/* Action button & gather time */}
                <div className="flex items-center justify-between pt-1 border-t border-[#233127] text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-[#a4b6aa]">
                    <Clock className="w-3 h-3 text-[#788e80]" />
                    <span>{node.gatherTimeSeconds} giây</span>
                  </div>

                  <button
                    disabled={isSurvivorBusy || !chosenSurvivor || isDepleted}
                    onClick={() => onStartGathering(assignedSurvivorId, node.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all shadow ${
                      isDepleted
                        ? 'bg-red-950/40 text-red-400/80 border border-red-900/60 cursor-not-allowed'
                        : isSurvivorBusy || !chosenSurvivor
                        ? 'bg-[#1e2a22] text-[#6b7e72] cursor-not-allowed border border-[#28392f]'
                        : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-emerald-950/50 hover:shadow-emerald-900/40'
                    }`}
                  >
                    {isDepleted ? 'Cạn kiệt' : isSurvivorBusy ? 'Đang bận' : 'Thu gom'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
