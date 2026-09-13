import React, { useState } from 'react';
import { 
  Compass, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Droplets, 
  Eye, 
  Users, 
  ShieldAlert, 
  ArrowRight,
  Send,
  X,
  TrendingUp
} from 'lucide-react';
import { GameState, AreaDefinition } from '../../types';
import { AREAS_DATABASE } from '../../data/areas';
import { ITEMS_DATABASE } from '../../data/items';
import { calculateResourceRecoveryBonus } from '../../simulation/resourcePools';
import { getPoiImageUrl } from '../../utils/poiImageManager';
import { SurvivorPortrait } from '../common/SurvivorPortrait';

interface WorldMapViewProps {
  state: GameState;
  onLaunchExpedition: (
    areaId: string, 
    survivorIds: string[], 
    rationItemId?: string, 
    waterContainerItemId?: string
  ) => void;
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  state,
  onLaunchExpedition,
}) => {
  const { areasProgress, survivors, inventory, expeditions, resourcePools } = state;
  const [selectedAreaId, setSelectedAreaId] = useState<string>('AREA_COASTAL_SHALLOWS');
  const [isExpeditionModalOpen, setIsExpeditionModalOpen] = useState(false);
  const [selectedSurvivorIds, setSelectedSurvivorIds] = useState<string[]>([]);
  const [selectedRation, setSelectedRation] = useState<string>('');
  const [selectedWater, setSelectedWater] = useState<string>('');

  const selectedArea = AREAS_DATABASE[selectedAreaId];
  const knowledge = areasProgress[selectedAreaId]?.knowledgePercent || 0;

  // Check if an expedition is already active in this area
  const activeInArea = expeditions.find(e => e.areaId === selectedAreaId);

  // Available water & rations in inventory
  const waterItems = inventory.items.filter(i => {
    const def = ITEMS_DATABASE[i.itemId];
    return def && (def.category === 'water' || def.tags.includes('drinkable')) && !def.tags.includes('dirty');
  });

  const foodItems = inventory.items.filter(i => {
    const def = ITEMS_DATABASE[i.itemId];
    return def && def.category === 'food' && def.nutrition && def.nutrition.calories > 0;
  });

  const handleOpenExpedition = (areaId: string) => {
    setSelectedAreaId(areaId);
    const idleSurvivors = survivors.filter(s => s.currentAction.type === 'idle');
    setSelectedSurvivorIds(idleSurvivors.length > 0 ? [idleSurvivors[0].id] : []);
    setSelectedRation(foodItems[0]?.itemId || '');
    setSelectedWater(waterItems[0]?.itemId || '');
    setIsExpeditionModalOpen(true);
  };

  const handleConfirmExpedition = () => {
    if (selectedSurvivorIds.length === 0) return;
    onLaunchExpedition(selectedAreaId, selectedSurvivorIds, selectedRation, selectedWater);
    setIsExpeditionModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto bg-[#0d1410] text-[#e2d5bd]">
      {/* 1. World Map Header */}
      <div className="bg-[#141d18] border border-[#27382d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-serif font-bold text-[#f2e7d3]">
              Bản đồ thám hiểm hòn đảo nhiệt đới
            </h2>
          </div>
          <p className="text-xs text-[#8ea596] mt-0.5">
            Càng thám hiểm nhiều, mức độ hiểu biết (Knowledge %) càng tăng, giúp mở khóa các vị trí thu hoạch và trữ lượng tài nguyên nguyên sinh.
          </p>
        </div>
      </div>

      {/* 2. Grid of Exploration Areas with Real Photo Assets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {Object.values(AREAS_DATABASE)
          .filter(area => !area.sector || area.sector === 'center')
          .map(area => {
          const areaProg = areasProgress[area.id] || { knowledgePercent: 0 };
          const isSelected = selectedAreaId === area.id;
          const isCamp = area.id === 'AREA_CAMP_CLEARING';
          const isOngoing = expeditions.some(e => e.areaId === area.id);

          return (
            <div
              key={area.id}
              onClick={() => setSelectedAreaId(area.id)}
              className={`bg-[#18231d] border rounded-xl overflow-hidden flex flex-col justify-between cursor-pointer transition-all shadow-md ${
                isSelected
                  ? 'border-emerald-400 ring-1 ring-emerald-400/50 bg-[#1e2d24]'
                  : 'border-[#27382d] hover:border-[#384e3f] hover:bg-[#1b2620]'
              }`}
            >
              {/* Photo Thumbnail Banner */}
              <div className="relative h-28 w-full overflow-hidden bg-[#0e1712]">
                <img
                  src={getPoiImageUrl(area.id, area.imageUrl)}
                  alt={area.name}
                  className="w-full h-full object-cover filter brightness-75 hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=600&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#18231d] via-transparent to-black/30" />

                <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded bg-black/70 backdrop-blur text-emerald-300 border border-white/10 font-mono font-medium">
                  {area.distanceKm} km
                </span>

                <div className="absolute bottom-2 left-2 right-2">
                  <h3 className="text-xs font-serif font-bold text-white drop-shadow-md truncate">
                    {area.name}
                  </h3>
                </div>
              </div>

              <div className="p-3 flex flex-col gap-2.5 flex-1 justify-between">
                <div>
                  <p className="text-[11px] text-[#8ea596] line-clamp-2 mb-2 leading-relaxed">
                    {area.description}
                  </p>

                  {/* Knowledge % bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-[#a4b6aa] mb-1 font-mono">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-emerald-400" />
                        Khảo sát
                      </span>
                      <span>{areaProg.knowledgePercent}%</span>
                    </div>
                    <div className="w-full bg-[#121914] h-1.5 rounded-full overflow-hidden border border-[#27382d]">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${areaProg.knowledgePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#131d17] text-[#9eb2a4] border border-[#243329] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#788e80]" />
                      <span>~{area.baseTravelMinutes}p đi</span>
                    </span>

                    <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                      area.baseDanger > 40
                        ? 'bg-[#291717] text-red-300 border-red-900/50'
                        : area.baseDanger > 20
                        ? 'bg-[#281e14] text-amber-300 border-amber-900/50'
                        : 'bg-[#14231a] text-emerald-300 border-emerald-900/50'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />
                      <span>Nguy hiểm: {area.baseDanger}%</span>
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2 border-t border-[#233127]">
                  {isCamp ? (
                    <span className="text-[10px] text-[#788e80] italic block text-center py-1">Trại chính hiện tại</span>
                  ) : isOngoing ? (
                    <span className="text-[10px] text-amber-400 font-medium block text-center py-1">Đội đang khám phá...</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenExpedition(area.id);
                      }}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-all shadow flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Tổ chức thám hiểm</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Detailed Selected Area Panel with Storage Pool Reports */}
      {selectedArea && (
        <div className="mt-auto bg-[#141d18] border border-[#27382d] rounded-xl p-4 flex flex-col gap-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between border-b border-[#24342a] pb-2.5 gap-2">
            <div>
              <h3 className="text-sm font-serif font-bold text-[#f2e7d3]">
                {selectedArea.name} — Báo cáo khảo sát & Hệ sinh thái
              </h3>
              <p className="text-xs text-[#8ea596] italic mt-0.5">
                "{selectedArea.flavorText}"
              </p>
            </div>
            <span className="text-xs text-amber-300 font-mono px-2 py-0.5 rounded bg-[#1a251e] border border-[#2e4033]">
              Khoảng cách: {selectedArea.distanceKm} km (~{selectedArea.baseTravelMinutes} phút)
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-[#c8dacb] block mb-2">
              Các bãi tài nguyên và trữ lượng sinh thái tại khu vực:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {selectedArea.nodes.map(node => {
                const isDiscovered = knowledge >= node.knowledgeRequired;
                const itemDef = ITEMS_DATABASE[node.itemId];
                const pool = resourcePools ? resourcePools[node.id] : null;
                const currentStock = pool ? pool.currentStock : node.maxYield * 5;
                const maxStock = pool ? pool.maxStock : 25;
                const percent = Math.min(100, Math.max(0, Math.round((currentStock / maxStock) * 100)));
                const { bonusPercent, statusLabel, badgeColor } = calculateResourceRecoveryBonus(currentStock, maxStock);

                return (
                  <div
                    key={node.id}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1.5 ${
                      isDiscovered
                        ? 'bg-[#18231d] border-[#293b2f] text-[#f0e6d2]'
                        : 'bg-[#121914] border-dashed border-[#233127] text-[#607467]'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center font-medium">
                        <span className="truncate">{isDiscovered ? node.name : '??? (Chưa đủ Knowledge)'}</span>
                        {isDiscovered && (
                          <span className="text-[10px] text-amber-400 font-mono shrink-0 ml-1">
                            {node.minYield}-{node.maxYield}x
                          </span>
                        )}
                      </div>
                      {isDiscovered && (
                        <div className="text-[10px] text-[#8ea596] mt-0.5 truncate">
                          Sản vật: {itemDef?.name}
                        </div>
                      )}
                    </div>

                    {isDiscovered && pool && (
                      <div className="mt-1 pt-1.5 border-t border-[#233127] text-[10px]">
                        <div className="flex justify-between text-[#9eb2a4] mb-1 font-mono">
                          <span>Trữ lượng:</span>
                          <span>{Math.round(currentStock * 10) / 10} / {maxStock}</span>
                        </div>
                        <div className="w-full bg-[#0d1410] h-1.5 rounded-full overflow-hidden border border-[#202d24]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percent >= 60 ? 'bg-emerald-500' : percent >= 30 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="mt-1">
                          <span className={`px-1.5 py-0.2 rounded border text-[9px] font-medium inline-block ${badgeColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. Expedition Dispatch Modal with Character Portraits */}
      {isExpeditionModalOpen && selectedArea && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151f19] border border-[#2a3c30] rounded-2xl max-w-lg w-full p-5 flex flex-col gap-4 text-[#e2d5bd] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#24342a] pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-serif font-bold text-[#f2e7d3]">
                  Khởi hành thám hiểm: {selectedArea.name}
                </h3>
              </div>
              <button
                onClick={() => setIsExpeditionModalOpen(false)}
                className="p-1 text-[#788e80] hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Survivor Selection with Real Portraits */}
            <div>
              <span className="text-xs font-semibold text-[#f0e6d2] block mb-1.5">
                1. Chọn thành viên đội thám hiểm:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {survivors.map(survivor => {
                  const isSelected = selectedSurvivorIds.includes(survivor.id);
                  const isBusy = survivor.currentAction.type !== 'idle';

                  return (
                    <div
                      key={survivor.id}
                      onClick={() => {
                        if (isBusy) return;
                        if (isSelected) {
                          setSelectedSurvivorIds(selectedSurvivorIds.filter(id => id !== survivor.id));
                        } else {
                          setSelectedSurvivorIds([...selectedSurvivorIds, survivor.id]);
                        }
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all flex flex-col items-center text-center gap-1.5 ${
                        isBusy
                          ? 'opacity-40 bg-[#121914] border-[#223026] cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow'
                          : 'bg-[#18231d] border-[#27382d] hover:border-[#3a5242]'
                      }`}
                    >
                      <SurvivorPortrait
                        survivor={survivor}
                        shape="portrait"
                        className="w-11 h-15 rounded border border-[#3a5242] shadow"
                      />
                      <div className="w-full">
                        <div className="font-semibold truncate">{survivor.name}</div>
                        <div className="text-[10px] text-[#8ea596]">
                          {isBusy ? 'Đang bận' : `Trinh sát Lv.${Math.round(survivor.skills.exploration || 1)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Supply Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-semibold text-[#f0e6d2] block mb-1.5">
                  2. Khẩu phần nước uống:
                </span>
                <select
                  value={selectedWater}
                  onChange={(e) => setSelectedWater(e.target.value)}
                  className="w-full bg-[#18231d] text-xs text-[#f2e7d3] rounded-lg p-2 border border-[#27382d] focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Không mang theo (Nguy cơ khát)</option>
                  {waterItems.map(item => {
                    const def = ITEMS_DATABASE[item.itemId];
                    return (
                      <option key={item.instanceId} value={item.itemId}>
                        {def ? def.name : item.itemId} (Có {item.quantity})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <span className="text-xs font-semibold text-[#f0e6d2] block mb-1.5">
                  3. Lương khô mang theo:
                </span>
                <select
                  value={selectedRation}
                  onChange={(e) => setSelectedRation(e.target.value)}
                  className="w-full bg-[#18231d] text-xs text-[#f2e7d3] rounded-lg p-2 border border-[#27382d] focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Không mang theo (Nguy cơ đói)</option>
                  {foodItems.map(item => {
                    const def = ITEMS_DATABASE[item.itemId];
                    return (
                      <option key={item.instanceId} value={item.itemId}>
                        {def ? def.name : item.itemId} (Có {item.quantity})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#24342a]">
              <button
                onClick={() => setIsExpeditionModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#a4b6aa] hover:text-white transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                disabled={selectedSurvivorIds.length === 0}
                onClick={handleConfirmExpedition}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow flex items-center gap-1.5 ${
                  selectedSurvivorIds.length === 0
                    ? 'bg-[#1b251f] text-[#63756a] cursor-not-allowed border border-[#25362b]'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Xuất phát</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
