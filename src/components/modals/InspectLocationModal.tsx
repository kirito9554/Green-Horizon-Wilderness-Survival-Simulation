import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  MapPin, 
  Sparkles, 
  Compass, 
  AlertTriangle, 
  Droplet, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  UserCheck,
  Upload,
  CheckCircle,
  Package,
  Warehouse,
  Hammer,
  ArrowRight,
  ArrowLeft,
  ArrowRightLeft,
  Plus,
  Shield,
  Flame,
  Check,
  Filter,
  Info
} from 'lucide-react';
import { AreaDefinition, GameState, InventoryItem, ConstructedBuilding } from '../../types';
import { calculateResourceRecoveryBonus } from '../../simulation/resourcePools';
import { ITEMS_DATABASE } from '../../data/items';
import { BUILDINGS_DATABASE } from '../../data/buildings';
import { ItemIcon } from '../common/ItemIcon';
import { SurvivorPortrait } from '../common/SurvivorPortrait';
import { 
  getOrCreatePoiStorage, 
  calculateInventoryOccupancy,
  transferItemBetweenInventories,
  transferAllItems
} from '../../simulation/inventorySystem';
import { 
  getPoiImageUrl, 
  savePoiImage, 
  batchImportPoiImages, 
  matchFilenameToAreaId 
} from '../../utils/poiImageManager';
import { QUALITY_CONFIG, FRESHNESS_CONFIG, CONDITION_CONFIG, getFreshnessStage, getConditionStage, getDominantQuality } from '../../utils/qualityUtils';

interface InspectLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: AreaDefinition;
  state: GameState;
  onStartGathering: (survivorId: string, nodeId: string, targetAreaId?: string) => void;
  onLaunchExpedition: (areaId: string, survivorIds: string[]) => void;
  onTransferItem?: (areaId: string, instanceId: string, quantity: number, direction: 'party_to_poi' | 'poi_to_party') => void;
  onTransferAll?: (areaId: string, direction: 'party_to_poi' | 'poi_to_party') => void;
  onStartPoiConstruction?: (survivorId: string, buildingId: string, areaId: string) => void;
}

type TabType = 'storage' | 'buildings' | 'resources';

export const InspectLocationModal: React.FC<InspectLocationModalProps> = ({
  isOpen,
  onClose,
  area,
  state,
  onStartGathering,
  onLaunchExpedition,
  onTransferItem,
  onTransferAll,
  onStartPoiConstruction,
}) => {
  const { survivors, resourcePools, buildings = [] } = state;
  const [activeTab, setActiveTab] = useState<TabType>('storage');
  const [selectedSurvivorId, setSelectedSurvivorId] = useState<string>(
    survivors[0]?.id || ''
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [bgUrl, setBgUrl] = useState<string>(() => getPoiImageUrl(area.id, area.imageUrl));
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  useEffect(() => {
    setBgUrl(getPoiImageUrl(area.id, area.imageUrl));
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.areaId === area.id || !detail.areaId) {
        setBgUrl(getPoiImageUrl(area.id, area.imageUrl));
      }
    };
    window.addEventListener('poi-images-updated', handleUpdate);
    return () => window.removeEventListener('poi-images-updated', handleUpdate);
  }, [area.id, area.imageUrl]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      const matchedId = matchFilenameToAreaId(file.name) || area.id;
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          await savePoiImage(matchedId, file.name, base64);
          setBgUrl(base64);
          setUploadFeedback(`Đã lưu ảnh cho ${matchedId === area.id ? area.name : matchedId}!`);
          setTimeout(() => setUploadFeedback(null), 3500);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const result = await batchImportPoiImages(files);
      setUploadFeedback(`Đã nạp thành công ${result.successCount}/${result.totalCount} ảnh POI!`);
      setBgUrl(getPoiImageUrl(area.id, area.imageUrl));
      setTimeout(() => setUploadFeedback(null), 4000);
    }
  };

  // Kho bãi hiện tại của POI
  const poiStorage = useMemo(() => {
    return getOrCreatePoiStorage(state, area.id);
  }, [state, area.id]);

  // Tải trọng của 2 kho
  const partyOcc = useMemo(() => {
    return calculateInventoryOccupancy(state.inventory.items);
  }, [state.inventory.items]);

  const poiOcc = useMemo(() => {
    return calculateInventoryOccupancy(poiStorage.items);
  }, [poiStorage.items]);

  const partyMaxWeight = state.inventory.maxWeightKg || 50;
  const partyMaxVolume = state.inventory.maxVolumeL || 80;
  const poiMaxWeight = poiStorage.maxWeightKg || 45;
  const poiMaxVolume = poiStorage.maxVolumeL || 70;

  const partyWeightPct = Math.min(100, Math.round((partyOcc.weight / partyMaxWeight) * 100));
  const poiWeightPct = Math.min(100, Math.round((poiOcc.weight / poiMaxWeight) * 100));

  if (!isOpen) return null;

  const isCamp = area.id === 'AREA_CAMP_CLEARING';
  const chosenSurvivor = survivors.find(s => s.id === selectedSurvivorId);
  const isSurvivorBusy = chosenSurvivor?.currentAction.type !== 'idle';

  // Lọc items theo category
  const filterItems = (items: InventoryItem[]) => {
    if (categoryFilter === 'all') return items;
    return items.filter(i => {
      const def = ITEMS_DATABASE[i.itemId];
      if (!def) return false;
      if (categoryFilter === 'food') return def.category === 'food';
      if (categoryFilter === 'water') return def.category === 'water';
      if (categoryFilter === 'material') return def.category === 'raw_material' || def.category === 'component' || def.category === 'construction';
      if (categoryFilter === 'tool') return def.category === 'tool';
      return true;
    });
  };

  const filteredPartyItems = filterItems(state.inventory.items);
  const filteredPoiItems = filterItems(poiStorage.items);

  // Danh sách công trình tại POI này
  const areaBuildings = buildings.filter(b => b.areaId === area.id || (!b.areaId && isCamp));

  // Kiểm tra vật liệu khả dụng tổng hợp (cả từ túi party và từ kho POI)
  const getCombinedItemCount = (itemId: string): number => {
    const partyCount = state.inventory.items
      .filter(i => i.itemId === itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
    const poiCount = poiStorage.items
      .filter(i => i.itemId === itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
    return partyCount + poiCount;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl wood-border-outer rounded-xl flex flex-col overflow-hidden shadow-2xl max-h-[92vh] bg-[#120e09] text-[#e5dbc8]">
        {/* Top Header Banner */}
        <div className="relative h-36 sm:h-44 w-full overflow-hidden bg-stone-900 shrink-0">
          <img 
            src={bgUrl || area.imageUrl || 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=80'} 
            alt={area.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120e09] via-[#120e09]/65 to-transparent" />

          {/* Action Buttons on Banner Header */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            {uploadFeedback && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-medium shadow animate-in fade-in">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>{uploadFeedback}</span>
              </div>
            )}
            <label
              title="Tải ảnh nền cho địa điểm này hoặc quét nạp nhiều ảnh"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#22170f]/90 hover:bg-[#382618] text-[#e2d5bd] hover:text-white border border-[#523d24] text-xs font-serif shadow cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Nạp / Đổi ảnh</span>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />
            </label>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#22170f]/90 hover:bg-[#382618] text-[#a38d72] hover:text-white border border-[#422e1b] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Location Title Info */}
          <div className="absolute bottom-2.5 left-4 right-4 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-700">
                  {area.biome}
                </span>
                <span className="text-xs text-[#c9b79b]">
                  {isCamp ? 'Căn cứ chính (Home Base)' : `${area.distanceKm} km • ${area.baseTravelMinutes} phút hành trình`}
                </span>
              </div>
              <h2 className="font-serif font-black text-xl sm:text-2xl text-[#f5e6cc] drop-shadow-md">
                {area.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1f1208]/90 border border-[#523d24]">
                <AlertTriangle className={`w-3.5 h-3.5 ${area.baseDanger > 25 ? 'text-red-400' : 'text-amber-400'}`} />
                <span className="text-xs font-semibold text-[#e2d5bd]">
                  Nguy hiểm: {area.baseDanger}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Survivor Bar */}
        <div className="bg-[#19120a] border-b border-[#3b2a1a] px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Main 3 Tabs */}
          <div className="flex items-center gap-1 bg-[#100b07] p-1 rounded-lg border border-[#3b2a1a]">
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-serif transition-all cursor-pointer ${
                activeTab === 'storage'
                  ? 'bg-[#3b2816] text-amber-200 border border-[#8c6543] shadow'
                  : 'text-[#9c8973] hover:text-[#d6c4aa]'
              }`}
            >
              <Warehouse className="w-4 h-4 text-amber-400" />
              <span>Kho Bãi & Giao Dịch</span>
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                {poiStorage.items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('buildings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-serif transition-all cursor-pointer ${
                activeTab === 'buildings'
                  ? 'bg-[#3b2816] text-amber-200 border border-[#8c6543] shadow'
                  : 'text-[#9c8973] hover:text-[#d6c4aa]'
              }`}
            >
              <Hammer className="w-4 h-4 text-amber-400" />
              <span>Công Trình Tiền Trạm</span>
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                {areaBuildings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-serif transition-all cursor-pointer ${
                activeTab === 'resources'
                  ? 'bg-[#3b2816] text-amber-200 border border-[#8c6543] shadow'
                  : 'text-[#9c8973] hover:text-[#d6c4aa]'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Sinh Thái & Khai Thác</span>
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                {area.nodes.length}
              </span>
            </button>
          </div>

          {/* Survivor Assign Control */}
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-serif font-bold text-[#cfbda4] hidden sm:inline">
              Nhân sự:
            </span>
            {chosenSurvivor && (
              <SurvivorPortrait
                survivor={chosenSurvivor}
                shape="portrait"
                className="w-6 h-8 rounded border border-[#523d24]"
              />
            )}
            <select
              value={selectedSurvivorId}
              onChange={(e) => setSelectedSurvivorId(e.target.value)}
              className="bg-[#24190f] text-xs text-[#f5e6cc] px-2.5 py-1.5 rounded border border-[#523d24] focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {survivors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currentAction.type === 'idle' ? 'Rảnh rỗi' : s.currentAction.type})
                </option>
              ))}
            </select>
            {isSurvivorBusy && (
              <span className="text-[10px] text-amber-400 max-w-[120px] truncate hidden md:inline" title={chosenSurvivor?.currentAction.description}>
                {chosenSurvivor?.currentAction.description}
              </span>
            )}
          </div>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: KHO BÃI & GIAO DỊCH (DUAL STORAGE SYSTEM) */}
          {activeTab === 'storage' && (
            <div className="space-y-3">
              {/* Category Filter & Global Transfer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-[#18110a] border border-[#382618]">
                {/* Category Filters */}
                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-amber-400 ml-1 mr-1" />
                  {(['all', 'food', 'water', 'material', 'tool'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2 py-0.8 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-[#47301c] text-amber-200 border border-[#8c6543]'
                          : 'text-[#8f7d69] hover:text-[#e2d5bd]'
                      }`}
                    >
                      {cat === 'all' ? 'Tất cả' : cat === 'food' ? 'Thức ăn' : cat === 'water' ? 'Nước' : cat === 'material' ? 'Vật liệu' : 'Công cụ'}
                    </button>
                  ))}
                </div>

                {/* Fast Transfer All Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTransferAll?.(area.id, 'party_to_poi')}
                    disabled={state.inventory.items.length === 0}
                    className="btn-wood-dark px-2.5 py-1 rounded text-[11px] font-bold text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Chuyển toàn bộ vật phẩm từ túi vào kho POI"
                  >
                    <span>Cất hết vào kho</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onTransferAll?.(area.id, 'poi_to_party')}
                    disabled={poiStorage.items.length === 0}
                    className="btn-wood-dark px-2.5 py-1 rounded text-[11px] font-bold text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Chuyển toàn bộ vật phẩm từ kho POI vào túi"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Lấy tất cả vào túi</span>
                  </button>
                </div>
              </div>

              {/* Dual Column Layout: Left = Party Bag | Right = POI Storage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. TÚI HÀNH TRANG PARTY (Left) */}
                <div className="p-3 rounded-lg bg-[#161009] border border-[#3b2a1a] flex flex-col justify-between">
                  <div>
                    {/* Header with Stats */}
                    <div className="flex items-center justify-between border-b border-[#2b1e13] pb-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-amber-400" />
                        <h3 className="font-serif font-bold text-xs text-[#f5e6cc] uppercase tracking-wider">
                          Túi Đồ Party (Hành trang)
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-amber-200">
                          {partyOcc.weight.toFixed(1)} / {partyMaxWeight} kg
                        </span>
                        <span className="text-[10px] text-[#8f7a62] ml-1.5">
                          ({partyOcc.volume.toFixed(1)}/{partyMaxVolume} L)
                        </span>
                      </div>
                    </div>

                    {/* Weight Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#0a0704] overflow-hidden mb-3 border border-[#261b11]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          partyWeightPct > 90 ? 'bg-red-500' : partyWeightPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${partyWeightPct}%` }}
                      />
                    </div>

                    {/* Items List */}
                    {filteredPartyItems.length === 0 ? (
                      <div className="p-6 text-center text-[#6e5d4a] text-xs italic">
                        Túi hành trang không có vật phẩm phù hợp bộ lọc.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                        {filteredPartyItems.map((item) => {
                          const def = ITEMS_DATABASE[item.itemId];
                          if (!def) return null;
                          const dominantQ = getDominantQuality(item.qualityBreakdown, item.quality);
                          const qConfig = QUALITY_CONFIG[dominantQ];
                          const totalWeight = (def.weight * item.quantity).toFixed(1);

                          return (
                            <div
                              key={item.instanceId}
                              className="p-1.5 rounded bg-[#1f160e] hover:bg-[#281d13] border border-[#3b2a1a] flex items-center justify-between gap-2 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded bg-black/40 border border-[#382618] p-0.5 flex items-center justify-center shrink-0">
                                  <ItemIcon itemId={item.itemId} category={def.category} size={28} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-serif font-bold text-xs text-[#f5e6cc] truncate">
                                      {def.name}
                                    </span>
                                    {dominantQ !== 'standard' && (
                                      <span className={`text-[9px] font-bold px-1 rounded ${qConfig.textColor} bg-black/30`}>
                                        {qConfig.nameVi}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#8f7a62]">
                                    {item.quantity}x • {totalWeight} kg
                                  </div>
                                </div>
                              </div>

                              {/* Transfer Controls */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => onTransferItem?.(area.id, item.instanceId, 1, 'party_to_poi')}
                                  className="px-1.5 py-1 rounded bg-[#2e2014] hover:bg-[#47301c] text-[#e2d5bd] text-[10px] font-mono border border-[#523d24] cursor-pointer"
                                  title="Chuyển 1 cái sang kho POI"
                                >
                                  1 ➔
                                </button>
                                {item.quantity > 1 && (
                                  <button
                                    onClick={() => onTransferItem?.(area.id, item.instanceId, item.quantity, 'party_to_poi')}
                                    className="px-1.5 py-1 rounded bg-[#2e2014] hover:bg-[#47301c] text-amber-300 text-[10px] font-mono border border-[#523d24] cursor-pointer"
                                    title="Chuyển tất cả sang kho POI"
                                  >
                                    Hết ➔
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. KHO BÃI TẠI ĐỊA ĐIỂM (Right) */}
                <div className="p-3 rounded-lg bg-[#161009] border border-[#3b2a1a] flex flex-col justify-between">
                  <div>
                    {/* Header with Stats */}
                    <div className="flex items-center justify-between border-b border-[#2b1e13] pb-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Warehouse className="w-4 h-4 text-amber-400" />
                        <h3 className="font-serif font-bold text-xs text-[#f5e6cc] uppercase tracking-wider">
                          Kho Bãi {area.name}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-amber-200">
                          {poiOcc.weight.toFixed(1)} / {poiMaxWeight} kg
                        </span>
                        <span className="text-[10px] text-[#8f7a62] ml-1.5">
                          ({poiOcc.volume.toFixed(1)}/{poiMaxVolume} L)
                        </span>
                      </div>
                    </div>

                    {/* Weight Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#0a0704] overflow-hidden mb-3 border border-[#261b11]">
                      <div
                        className={`h-full transition-all duration-300 ${
                          poiWeightPct > 90 ? 'bg-red-500' : poiWeightPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${poiWeightPct}%` }}
                      />
                    </div>

                    {/* Items List */}
                    {filteredPoiItems.length === 0 ? (
                      <div className="p-6 text-center text-[#6e5d4a] text-xs italic">
                        Kho bãi tại địa điểm này đang trống. Bạn có thể cất bớt vật tư hoặc phân công thợ khai thác vào kho.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                        {filteredPoiItems.map((item) => {
                          const def = ITEMS_DATABASE[item.itemId];
                          if (!def) return null;
                          const dominantQ = getDominantQuality(item.qualityBreakdown, item.quality);
                          const qConfig = QUALITY_CONFIG[dominantQ];
                          const totalWeight = (def.weight * item.quantity).toFixed(1);

                          return (
                            <div
                              key={item.instanceId}
                              className="p-1.5 rounded bg-[#1f160e] hover:bg-[#281d13] border border-[#3b2a1a] flex items-center justify-between gap-2 transition-colors"
                            >
                              {/* Transfer Controls (Left Arrow) */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => onTransferItem?.(area.id, item.instanceId, 1, 'poi_to_party')}
                                  className="px-1.5 py-1 rounded bg-[#2e2014] hover:bg-[#47301c] text-[#e2d5bd] text-[10px] font-mono border border-[#523d24] cursor-pointer"
                                  title="Lấy 1 cái về túi party"
                                >
                                  ⬅ 1
                                </button>
                                {item.quantity > 1 && (
                                  <button
                                    onClick={() => onTransferItem?.(area.id, item.instanceId, item.quantity, 'poi_to_party')}
                                    className="px-1.5 py-1 rounded bg-[#2e2014] hover:bg-[#47301c] text-amber-300 text-[10px] font-mono border border-[#523d24] cursor-pointer"
                                    title="Lấy tất cả về túi party"
                                  >
                                    ⬅ Hết
                                  </button>
                                )}
                              </div>

                              {/* Item Info */}
                              <div className="flex items-center gap-2 min-w-0 text-right justify-end flex-1">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1 justify-end">
                                    {dominantQ !== 'standard' && (
                                      <span className={`text-[9px] font-bold px-1 rounded ${qConfig.textColor} bg-black/30`}>
                                        {qConfig.nameVi}
                                      </span>
                                    )}
                                    <span className="font-serif font-bold text-xs text-[#f5e6cc] truncate">
                                      {def.name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#8f7a62]">
                                    {item.quantity}x • {totalWeight} kg
                                  </div>
                                </div>
                                <div className="w-8 h-8 rounded bg-black/40 border border-[#382618] p-0.5 flex items-center justify-center shrink-0">
                                  <ItemIcon itemId={item.itemId} category={def.category} size={28} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CÔNG TRÌNH TIỀN TRẠM (POI STRUCTURES & OUTPOST FACILITIES) */}
          {activeTab === 'buildings' && (
            <div className="space-y-4">
              {/* Existing / In-progress buildings at this POI */}
              <div>
                <h3 className="font-serif font-bold text-xs text-[#d4ba94] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Công Trình Hiện Hữu Tại {area.name} ({areaBuildings.length})
                </h3>

                {areaBuildings.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#18110a] border border-[#382618] text-center text-xs text-[#8c7860] italic">
                    Chưa có công trình nào được dựng tại địa bàn này. Hãy tiến hành xây dựng kho bãi dã ngoại hoặc lán che bên dưới!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {areaBuildings.map((b) => {
                      const def = BUILDINGS_DATABASE[b.buildingId];
                      if (!def) return null;
                      const progressPct = Math.round((b.buildProgressSeconds / b.totalBuildSeconds) * 100);

                      return (
                        <div
                          key={b.id}
                          className="p-3 rounded-lg bg-[#18110a] border border-[#3b2a1a] flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-serif font-bold text-xs text-[#f5e6cc]">
                                {def.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  b.isBuilt
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                                }`}
                              >
                                {b.isBuilt ? 'Hoạt động 100%' : `Đang thi công ${progressPct}%`}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#a39079] line-clamp-2">
                              {def.benefitsDescription}
                            </p>
                          </div>

                          {!b.isBuilt && (
                            <div className="w-full h-1.5 rounded-full bg-[#0d0905] overflow-hidden border border-[#2b1f13]">
                              <div
                                className="h-full bg-amber-500 transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Blueprints ready to build at this POI */}
              <div>
                <h3 className="font-serif font-bold text-xs text-[#d4ba94] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-amber-400" />
                  Bản Thiết Kế Khả Dụng Để Thi Công Tại Đây
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(BUILDINGS_DATABASE).map((bp) => {
                    // Kiểm tra xem đã xây chưa (nếu đã có và isBuilt thì có thể cho phép xây thêm hoặc hiển thị trạng thái)
                    const existing = areaBuildings.find(b => b.buildingId === bp.id);
                    const isConstructing = existing && !existing.isBuilt;
                    const isCompleted = existing && existing.isBuilt;

                    // Kiểm tra đủ nguyên liệu (tính tổng cả từ kho POI + túi party)
                    let canAfford = true;
                    const costs = bp.cost.map(cost => {
                      const available = getCombinedItemCount(cost.itemId);
                      const hasEnough = available >= cost.quantity;
                      if (!hasEnough) canAfford = false;
                      const itemDef = ITEMS_DATABASE[cost.itemId];
                      return {
                        ...cost,
                        available,
                        hasEnough,
                        name: itemDef?.name || cost.itemId,
                      };
                    });

                    return (
                      <div
                        key={bp.id}
                        className="p-3 rounded-lg bg-[#18110a] border border-[#3b2a1a] flex flex-col justify-between gap-2.5 hover:border-[#523d24] transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-serif font-bold text-xs text-[#f5e6cc]">
                              {bp.name}
                            </h4>
                            <span className="text-[10px] font-mono text-[#8f7a62]">
                              {bp.buildTimeSeconds}s
                            </span>
                          </div>
                          <p className="text-[11px] text-[#a39079] mb-2">
                            {bp.benefitsDescription}
                          </p>

                          {/* Cost requirements */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-serif font-bold text-[#8f7a62]">
                              Nguyên liệu (Kho POI + Túi party):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {costs.map(c => (
                                <span
                                  key={c.itemId}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                    c.hasEnough
                                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                                      : 'bg-red-950/60 border-red-700/60 text-red-300'
                                  }`}
                                >
                                  {c.name}: {c.available}/{c.quantity}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          disabled={isCompleted || isSurvivorBusy || !canAfford}
                          onClick={() => {
                            onStartPoiConstruction?.(selectedSurvivorId, bp.id, area.id);
                            onClose();
                          }}
                          className={`w-full py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-[#221a12] text-emerald-400 border border-emerald-800/40 cursor-default'
                              : isSurvivorBusy || !canAfford
                              ? 'bg-[#241c14] text-[#6e5d4a] border border-[#382618] cursor-not-allowed'
                              : 'btn-wood-green'
                          }`}
                        >
                          <Hammer className="w-3.5 h-3.5" />
                          <span>
                            {isCompleted
                              ? 'Đã xây dựng tại đây'
                              : isConstructing
                              ? 'Tiếp tục thi công'
                              : 'Phân công thi công'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HỆ SINH THÁI & KHAI THÁC (ECOLOGY & EXTRACTION) */}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif font-bold text-xs text-[#d4ba94] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Trữ Lượng Sinh Thái & Khai Thác Nhập Kho ({area.nodes.length} bãi)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {area.nodes.map((node) => {
                    const pool = resourcePools[node.id];
                    const currentStock = pool ? pool.currentStock : 20;
                    const maxStock = pool ? pool.maxStock : 25;
                    const baseRecovery = pool ? pool.baseRecoveryPerHour : 2.5;

                    const ecoBonus = calculateResourceRecoveryBonus(currentStock, maxStock);
                    const stockPercent = Math.min(100, Math.round((currentStock / maxStock) * 100));
                    const itemDef = ITEMS_DATABASE[node.itemId];

                    return (
                      <div 
                        key={node.id}
                        className="p-3 rounded-lg bg-[#18110a] border border-[#3b2a1a] flex flex-col justify-between gap-2 hover:border-[#523d24] transition-colors"
                      >
                        <div>
                          <div className="flex items-start gap-2.5 mb-2">
                            <div className="w-14 h-14 shrink-0 rounded bg-black/40 border border-[#3b2a1a] p-1 flex items-center justify-center overflow-hidden">
                              <ItemIcon 
                                itemId={node.itemId} 
                                category={itemDef?.category} 
                                size={52} 
                                className="w-full h-full object-contain" 
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-serif font-bold text-xs text-[#f5e6cc]">
                                  {node.name}
                                </h4>
                                <span className="text-[10px] font-mono text-[#a89274]">
                                  {node.gatherTimeSeconds}s
                                </span>
                              </div>

                              {/* Stock Progress Bar */}
                              <div className="space-y-1 my-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-[#8f7a62]">Trữ lượng:</span>
                                  <span className="font-mono font-bold text-amber-200">
                                    {currentStock.toFixed(1)} / {maxStock}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-[#0d0a06] overflow-hidden border border-[#2b1f13]">
                                  <div 
                                    className={`h-full transition-all duration-300 ${
                                      stockPercent > 65 ? 'bg-emerald-500' : stockPercent > 30 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${stockPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Eco Health Status */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#291c12]">
                            <span className="text-[#8f7a62]">Phục hồi tự nhiên:</span>
                            <span className={`px-1.5 py-0.5 rounded font-medium border text-[9px] ${ecoBonus.badgeColor}`}>
                              +{ (baseRecovery * ecoBonus.multiplier).toFixed(1) } /h
                            </span>
                          </div>
                        </div>

                        {/* Extraction Button: Harvest into POI Storage */}
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <button
                            disabled={isSurvivorBusy || currentStock < 1}
                            onClick={() => {
                              onStartGathering(selectedSurvivorId, node.id, area.id);
                              onClose();
                            }}
                            className={`py-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                              isSurvivorBusy || currentStock < 1
                                ? 'bg-[#241c14] text-[#6e5d4a] cursor-not-allowed'
                                : 'btn-wood-green cursor-pointer'
                            }`}
                            title="Khai thác và nhập thẳng vào Kho bãi của địa điểm này"
                          >
                            <Warehouse className="w-3 h-3" />
                            <span>Nhập kho POI</span>
                          </button>

                          <button
                            disabled={isSurvivorBusy || currentStock < 1}
                            onClick={() => {
                              onStartGathering(selectedSurvivorId, node.id, undefined);
                              onClose();
                            }}
                            className={`py-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                              isSurvivorBusy || currentStock < 1
                                ? 'bg-[#241c14] text-[#6e5d4a] cursor-not-allowed'
                                : 'btn-wood-dark cursor-pointer text-amber-200'
                            }`}
                            title="Thu lượm bỏ vào túi đồ của party"
                          >
                            <Package className="w-3 h-3" />
                            <span>Vào túi Party</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expedition Launcher if not base camp */}
              {!isCamp && (
                <div className="pt-3 border-t border-[#382819] flex items-center justify-between">
                  <span className="text-xs text-[#a69279]">
                    Tổ chức thám hiểm chuyên sâu để khai phá toàn diện vùng đất này.
                  </span>
                  <button
                    onClick={() => {
                      onLaunchExpedition(area.id, [selectedSurvivorId]);
                      onClose();
                    }}
                    disabled={isSurvivorBusy}
                    className="btn-wood-dark py-2 px-4 rounded text-xs font-bold text-amber-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Khởi hành Thám hiểm</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

