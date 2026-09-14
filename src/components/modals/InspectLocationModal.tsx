import React, { useState, useEffect, useMemo } from 'react';
import { CornerBrackets } from '../common/CornerBrackets';
import { 
  X, 
  MapPin, 
  Sparkles, 
  Compass, 
  AlertTriangle, 
  Droplets, 
  Clock, 
  Activity,
  Upload,
  CheckCircle,
  Package,
  Shield,
  Flame,
  Tent,
  Footprints,
  TreePine,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  Leaf,
  Layers,
  Wind,
  Sun,
  CloudRain,
  Eye
} from 'lucide-react';
import { AreaDefinition, GameState, InventoryItem } from '../../types';
import { calculateResourceRecoveryBonus } from '../../simulation/resourcePools';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';
import { SurvivorPortrait } from '../common/SurvivorPortrait';
import { 
  getOrCreatePoiStorage, 
  calculateInventoryOccupancy,
  transferItemBetweenInventories
} from '../../simulation/inventorySystem';
import { 
  getPoiImageUrl, 
  savePoiImage, 
  batchImportPoiImages, 
  matchFilenameToAreaId 
} from '../../utils/poiImageManager';

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
  onOpenManageCamp?: () => void;
}

type TabType = 'recon' | 'resources' | 'operations';

// Biome Vietnamese metadata & ecological features
const BIOME_DETAILS: Record<string, { nameVi: string; icon: any; color: string; desc: string; hazards: string[] }> = {
  beach: {
    nameVi: 'Bờ Biển Nhiệt Đới',
    icon: Wind,
    color: '#38bdf8',
    desc: 'Gió biển ẩm mặn, dừa cạn và sò ốc dồi dào. Thủy triều và sóng lớn khi có bão.',
    hazards: ['Hạ thân nhiệt do gió đêm', 'Cua đá khổng lồ phòng vệ', 'Thủy triều cuốn trôi'],
  },
  jungle: {
    nameVi: 'Rừng Rậm Nhiệt Đới',
    icon: TreePine,
    color: '#4ade80',
    desc: 'Tán lá rậm rạp che phủ ánh sáng, nhiều thảo dược và gỗ chắc. Nơi ẩn nấp của dã thú ăn thịt.',
    hazards: ['Dã thú săn đêm rình rập', 'Rắn lục đuôi đỏ và rết độc', 'Rận rừng và sốt rét'],
  },
  river: {
    nameVi: 'Lưu Vực Sông Suối',
    icon: Droplets,
    color: '#60a5fa',
    desc: 'Nguồn nước ngọt trong lành và các loài thủy sản. Dòng chảy xiết và trơn trượt vào mùa mưa.',
    hazards: ['Bùn lầy trơn trượt té ngã', 'Cá săn mồi hung dữ', 'Lũ quét bất ngờ từ thượng nguồn'],
  },
  bamboo: {
    nameVi: 'Rừng Trúc & Tre Già',
    icon: Leaf,
    color: '#a3e635',
    desc: 'Cây tre trúc dẻo dai làm cọc dựng lán và bẫy săn. Nhiều măng non, nấm rừng và chim dã.',
    hazards: ['Lá tre sắc bén cứa rách da', 'Bọ cạp ẩn trong kẽ tre', 'Dễ mất phương hướng'],
  },
  swamp: {
    nameVi: 'Đầm Lầy Ngập Mặn',
    icon: Layers,
    color: '#34d399',
    desc: 'Vùng nước tù đọng nhiều than bùn và đất sét. Di chuyển cực kỳ chậm chạp và hao tổn sức lực.',
    hazards: ['Bùn lún ngập ngang gối', 'Đỉa trâu hút máu', 'Khí độc mêtan bốc lên ban trưa'],
  },
  rocky: {
    nameVi: 'Vách Đá & Cao Điểm',
    icon: MountainIcon,
    color: '#fbbf24',
    desc: 'Mỏ đá lộ thiên và đá lửa. Tầm quan sát rộng bao quát hòn đảo nhưng dốc đứng cheo leo.',
    hazards: ['Sỏi đá lở trượt chân rơi ngã', 'Gió quật mạnh trên đỉnh cao', 'Thiếu thốn nguồn nước'],
  },
  cave: {
    nameVi: 'Hang Động Tự Nhiên',
    icon: Eye,
    color: '#c084fc',
    desc: 'Nơi trú ẩn mưa gió tuyệt vời nhưng tăm tối, độ ẩm cao và nhiều dơi độc trú ngụ.',
    hazards: ['Thiếu dưỡng khí ngột ngạt', 'Dơi mang mầm bệnh dại', 'Đá nhọn rớt từ trần hang'],
  },
};

function MountainIcon(props: any) {
  return <Layers {...props} />;
}

// Weather impacts on tactical exploration
const getWeatherImpact = (weatherType: string) => {
  switch (weatherType) {
    case 'storm':
    case 'heavy_rain':
      return {
        title: 'Mưa Giông Cản Trở',
        text: 'Đất trơn trượt, giảm 30% tốc độ di chuyển và tăng nguy cơ trượt chân té ngã.',
        level: 'danger',
      };
    case 'heat_wave':
      return {
        title: 'Nắng Gắt Thiêu Đốt',
        text: 'Tiêu hao nước uống gấp đôi, thể lực giảm nhanh chóng khi hoạt động ngoài trời.',
        level: 'warning',
      };
    case 'fog':
      return {
        title: 'Sương Mù Hạn Chế',
        text: 'Tầm quan sát bị thu hẹp, khả năng phát hiện tài nguyên giảm và nguy cơ mai phục tăng.',
        level: 'warning',
      };
    case 'light_rain':
      return {
        title: 'Mưa Rào Nhẹ',
        text: 'Làm mát không khí, tạo thuận lợi hồi sức nhưng trang bị dễ bị ngấm ẩm.',
        level: 'info',
      };
    case 'cloudy':
      return {
        title: 'Trời Mát Râm Đãng',
        text: 'Nhiệt độ ôn hòa, là thời điểm lý tưởng cho việc trinh sát và thu thập tài nguyên dã chiến.',
        level: 'good',
      };
    default:
      return {
        title: 'Thời Tiết Thuận Lợi',
        text: 'Tầm nhìn thông suốt, các tuyến đường thực địa mở rộng an toàn.',
        level: 'good',
      };
  }
};

export const InspectLocationModal: React.FC<InspectLocationModalProps> = ({
  isOpen,
  onClose,
  area,
  state,
  onStartGathering,
  onLaunchExpedition,
  onTransferItem,
  onTransferAll,
  onOpenManageCamp,
}) => {
  const { survivors, resourcePools, weather } = state;
  const [activeTab, setActiveTab] = useState<TabType>('recon');
  const [selectedSurvivorId, setSelectedSurvivorId] = useState<string>(
    survivors[0]?.id || ''
  );
  const [selectedExpeditionIds, setSelectedExpeditionIds] = useState<string[]>(() => 
    survivors[0]?.id ? [survivors[0].id] : []
  );
  const [bgUrl, setBgUrl] = useState<string>(() => getPoiImageUrl(area.id, area.imageUrl));
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [isBivouacSet, setIsBivouacSet] = useState<boolean>(false);

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

  // Kho dã chiến nếu có
  const poiStorage = useMemo(() => {
    return getOrCreatePoiStorage(state, area.id);
  }, [state, area.id]);

  const partyOcc = useMemo(() => {
    return calculateInventoryOccupancy(state.inventory.items);
  }, [state.inventory.items]);

  const partyMaxWeight = state.inventory.maxWeightKg || 50;

  if (!isOpen) return null;

  const isCamp = area.id === 'AREA_CAMP_CLEARING';
  const chosenSurvivor = survivors.find(s => s.id === selectedSurvivorId);
  const isSurvivorBusy = chosenSurvivor?.currentAction.type !== 'idle';
  const biomeInfo = BIOME_DETAILS[area.biome] || BIOME_DETAILS.jungle;
  const BiomeIcon = biomeInfo.icon;
  const weatherImpact = getWeatherImpact(weather.current);
  const knowledgePercent = isCamp ? 100 : (state.areasProgress?.[area.id]?.knowledgePercent ?? 45);

  const toggleExpeditionSurvivor = (sId: string) => {
    setSelectedExpeditionIds(prev => 
      prev.includes(sId) 
        ? prev.filter(id => id !== sId)
        : [...prev, sId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl h-[92vh] sm:h-[620px] max-h-[680px] wood-border-outer rounded-xl flex flex-col overflow-hidden shadow-2xl bg-[#120e09] text-[#e5dbc8]">
        {/* Expedition Forged Corner Brackets */}
        <CornerBrackets style="bronze" size={26} inset={3} />

        {/* 1. TOP HEADER BANNER (Photo & Identity) */}
        <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-stone-900 shrink-0">
          <img 
            src={bgUrl || area.imageUrl || 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=80'} 
            alt={area.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120e09] via-[#120e09]/60 to-transparent" />

          {/* Action Buttons on Banner */}
          <div className="absolute top-2.5 right-3 z-10 flex items-center gap-2">
            {uploadFeedback && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-medium shadow animate-in fade-in">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>{uploadFeedback}</span>
              </div>
            )}
            <label
              title="Tải ảnh nền cho địa điểm này"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#22170f]/90 hover:bg-[#382618] text-[#e2d5bd] hover:text-white border border-[#523d24] text-xs font-serif shadow cursor-pointer transition-colors"
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
              className="p-1.5 rounded bg-[#22170f]/90 hover:bg-[#382618] text-[#a38d72] hover:text-white border border-[#422e1b] cursor-pointer transition-colors"
              title="Đóng (Close)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Coordinates Info */}
          <div className="absolute bottom-2 left-4 right-4 flex items-end justify-between">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-0.5">
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm border"
                  style={{
                    backgroundColor: 'rgba(10, 20, 14, 0.85)',
                    borderColor: biomeInfo.color,
                    color: biomeInfo.color,
                  }}
                >
                  <BiomeIcon className="w-3 h-3" />
                  <span>{biomeInfo.nameVi}</span>
                </span>

                <span className="text-[11px] text-[#c9b79b] flex items-center gap-1">
                  <Compass className="w-3 h-3 text-amber-400" />
                  {isCamp ? 'Căn Cứ Đầu Não' : `${area.distanceKm} km • ${area.baseTravelMinutes} phút hành trình`}
                </span>
              </div>
              <h2 className="font-serif font-black text-lg sm:text-xl text-[#f5e6cc] drop-shadow-md truncate">
                {area.name}
              </h2>
            </div>

            {/* Quick Threat & Water Indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1f1208]/90 border border-[#523d24]">
                <AlertTriangle className={`w-3.5 h-3.5 ${area.baseDanger > 25 ? 'text-red-400' : 'text-amber-400'}`} />
                <span className="text-[11px] font-semibold text-[#e2d5bd]">
                  Nguy hiểm: {area.baseDanger}%
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#091f24]/90 border border-[#235868]">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-medium text-sky-200">
                  {area.waterAvailability === 'fresh_stream' ? 'Nước ngọt' : 
                   area.waterAvailability === 'brackish' ? 'Nước lợ' :
                   area.waterAvailability === 'dirty' ? 'Nước bẩn' : 'Không có nước'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. TAB NAVIGATION & SURVIVOR DISPATCH BAR */}
        <div className="bg-[#140d07] border-b border-[#3b2a1a] px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 shrink-0 h-[48px]">
          {/* Tactical Tabs */}
          <div className="flex items-center gap-1 bg-[#0a0704] p-0.5 rounded-lg border border-[#3b2a1a] shadow-inner">
            <button
              onClick={() => setActiveTab('recon')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold font-serif transition-all cursor-pointer ${
                activeTab === 'recon'
                  ? 'btn-organic-amber text-amber-100 shadow'
                  : 'text-[#9c8973] hover:text-[#d6c4aa] hover:bg-[#1a120b]'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Tình Báo Thực Địa</span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold font-serif transition-all cursor-pointer ${
                activeTab === 'resources'
                  ? 'btn-organic-amber text-amber-100 shadow'
                  : 'text-[#9c8973] hover:text-[#d6c4aa] hover:bg-[#1a120b]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Điểm Khai Thác</span>
              <span className="ml-0.5 px-1 py-0.1 rounded text-[9.5px] bg-black/50 text-emerald-300 border border-emerald-800/60 font-mono">
                {area.nodes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold font-serif transition-all cursor-pointer ${
                activeTab === 'operations'
                  ? 'btn-organic-amber text-amber-100 shadow'
                  : 'text-[#9c8973] hover:text-[#d6c4aa] hover:bg-[#1a120b]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Tác Chiến Dã Ngoại</span>
            </button>
          </div>

          {/* Survivor Quick Selector (Cho người được chỉ định trinh sát/khai thác) */}
          <div className="flex items-center gap-1.5">
            <span className="hidden md:inline text-[11px] text-[#9c8973] font-serif">
              Trinh sát viên:
            </span>
            <select
              value={selectedSurvivorId}
              onChange={(e) => setSelectedSurvivorId(e.target.value)}
              className="bg-[#1f150c] text-[#f5e6cc] border border-[#4a341f] rounded px-2 py-1 text-xs font-serif focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {survivors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currentAction.type === 'idle' ? 'Rảnh' : 'Đang bận'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. MODAL CONTENT PANELS */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-[#100b07] text-[#dfd4c0]">
          
          {/* ========================================================================= */}
          {/* TAB 1: TÌNH BÁO THỰC ĐỊA & SINH THÁI (RECON & HAZARDS)                    */}
          {/* ========================================================================= */}
          {activeTab === 'recon' && (
            <div className="space-y-3.5">
              {/* Row 1: Grid 2 Columns - Ecology & Recon status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Column A: Terrain & Environmental intelligence */}
                <div className="p-3.5 rounded-lg bg-[#18110a] border border-[#382618] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2d1d11] pb-2">
                    <span className="font-serif font-bold text-xs text-[#d4ba94] uppercase tracking-wide flex items-center gap-1.5">
                      <BiomeIcon className="w-4 h-4" style={{ color: biomeInfo.color }} />
                      Đặc Trưng Địa Hình & Hệ Sinh Thái
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-[#382618] text-[#bda890]">
                      {area.biome.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-[#c4b39b] leading-relaxed">
                    {biomeInfo.desc}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded bg-black/30 border border-[#2a1a0e]">
                      <span className="text-[10px] text-[#8e7a62] block mb-0.5">Tiến độ trinh sát:</span>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-200 font-mono">{knowledgePercent}%</span>
                        <span className="text-[9.5px] text-emerald-400 font-medium">
                          {knowledgePercent >= 80 ? 'Khám phá trọn vẹn' : knowledgePercent >= 40 ? 'Đã lập sơ đồ' : 'Chưa rõ địa hình'}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-[#1b120a] mt-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                          style={{ width: `${knowledgePercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2 rounded bg-black/30 border border-[#2a1a0e]">
                      <span className="text-[10px] text-[#8e7a62] block mb-0.5">Nguồn nước tự nhiên:</span>
                      <span className="font-bold text-sky-200 flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-sky-400" />
                        {area.waterAvailability === 'fresh_stream' ? 'Suối ngọt trong lành' : 
                         area.waterAvailability === 'brackish' ? 'Nước lợ (Cần đun)' :
                         area.waterAvailability === 'dirty' ? 'Nước bùn ô nhiễm' : 'Không có'}
                      </span>
                      <span className="text-[9.5px] text-[#a4917a] block mt-0.5 truncate">
                        {area.waterAvailability === 'fresh_stream' ? 'Có thể uống trực tiếp' : 'Nguy cơ đau bụng nếu uống sống'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column B: Danger Assessment & Weather Impact */}
                <div className="p-3.5 rounded-lg bg-[#18110a] border border-[#382618] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2d1d11] pb-2">
                    <span className="font-serif font-bold text-xs text-[#d4ba94] uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      Đánh Giá Mối Đe Dọa & Thời Tiết
                    </span>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                      area.baseDanger > 40 ? 'bg-red-950/80 text-red-300 border-red-800' :
                      area.baseDanger > 15 ? 'bg-amber-950/80 text-amber-300 border-amber-800' :
                      'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    }`}>
                      Mức đe dọa: {area.baseDanger}%
                    </span>
                  </div>

                  {/* Weather correlation */}
                  <div className={`p-2.5 rounded border text-xs flex items-start gap-2.5 ${
                    weatherImpact.level === 'danger' ? 'bg-red-950/40 border-red-800/60 text-red-200' :
                    weatherImpact.level === 'warning' ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' :
                    'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                  }`}>
                    <Wind className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                    <div>
                      <div className="font-bold flex items-center gap-1">
                        <span>Tác động thời tiết: {weatherImpact.title}</span>
                      </div>
                      <p className="text-[11px] text-[#d6c7b2] mt-0.5">
                        {weatherImpact.text}
                      </p>
                    </div>
                  </div>

                  {/* Known Regional Hazards */}
                  <div>
                    <span className="text-[10.5px] font-serif font-bold text-[#a69279] uppercase tracking-wider block mb-1.5">
                      Nguy cơ rình rập đã ghi nhận:
                    </span>
                    <div className="space-y-1">
                      {biomeInfo.hazards.map((hz, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-[#c9b79f]">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 shrink-0" />
                          <span>{hz}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Field Recon Dossier / Journal Notes */}
              <div className="p-3.5 rounded-lg bg-[#140d07] border border-[#3b2a1a] shadow-inner">
                <div className="flex items-center gap-2 mb-2">
                  <Footprints className="w-4 h-4 text-amber-400" />
                  <h3 className="font-serif font-bold text-xs text-[#e8d5b7] uppercase tracking-wide">
                    Sổ Tay Trinh Sát Thực Địa (Field Recon Log)
                  </h3>
                </div>

                <div className="p-3 rounded bg-black/40 border border-[#2b1f14] italic text-xs text-[#d1c0a5] leading-relaxed relative">
                  <span className="text-2xl text-[#6b543c] font-serif absolute -top-1 left-1 select-none">“</span>
                  <p className="pl-3">
                    {area.flavorText || area.description || 'Khu vực hoang sơ chưa ghi nhận nhiều biến cố lớn. Đội trinh sát cần tiếp tục theo dõi các biến đổi sinh thái tự nhiên.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ĐIỂM KHAI THÁC & LỤC SOÁT (NATURAL NODES & FIELD HARVEST)          */}
          {/* ========================================================================= */}
          {activeTab === 'resources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-xs text-[#d4ba94] uppercase tracking-wide flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Trữ Lượng Sinh Thái & Khai Thác Dã Ngoại ({area.nodes.length} Cụm tự nhiên)
                  </h3>
                  <p className="text-[11px] text-[#9c8973] mt-0.5">
                    Sản vật tự nhiên tại đây tái sinh liên tục theo nhịp sinh học của đảo hoang.
                  </p>
                </div>

                {chosenSurvivor && (
                  <div className="text-xs text-[#c4b39a] flex items-center gap-1.5 bg-[#1a1109] px-2.5 py-1 rounded border border-[#382618]">
                    <span>Người thực hiện:</span>
                    <strong className="text-amber-200">{chosenSurvivor.name}</strong>
                  </div>
                )}
              </div>

              {/* Natural Harvest Nodes Grid */}
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
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="font-serif font-bold text-xs text-[#f5e6cc] truncate">
                                {node.name}
                              </h4>
                              <span className="text-[10px] font-mono text-[#a89274]">
                                {node.gatherTimeSeconds}s
                              </span>
                            </div>

                            <p className="text-[10.5px] text-[#9c8973] line-clamp-1 mb-1">
                              {node.description || `Khai thác thu được ${itemDef?.name || 'sản vật'}.`}
                            </p>

                            {/* Stock Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#8f7a62]">Trữ lượng sinh thái:</span>
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

                        {/* Eco Recovery Rate */}
                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-[#291c12]">
                          <span className="text-[#8f7a62]">Hồi phục tự nhiên:</span>
                          <span className={`px-1.5 py-0.5 rounded font-medium border text-[9px] ${ecoBonus.badgeColor}`}>
                            +{ (baseRecovery * ecoBonus.multiplier).toFixed(1) } /h
                          </span>
                        </div>
                      </div>

                      {/* Direct Field Harvest Button (Vào túi đồ party) */}
                      <button
                        disabled={isSurvivorBusy || currentStock < 1}
                        onClick={() => {
                          onStartGathering(selectedSurvivorId, node.id, undefined);
                          onClose();
                        }}
                        className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSurvivorBusy || currentStock < 1
                            ? 'bg-[#241c14] text-[#6e5d4a] border border-[#382618] cursor-not-allowed'
                            : 'btn-modal-action btn-modal-action-emerald'
                        }`}
                        title="Phân công người sống sót đi thu lượm bỏ vào túi đồ Party"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Khai Thác Bỏ Vào Túi Hành Trang</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Scavenge Feature for wild discovery */}
              <div className="p-3 rounded-lg bg-[#140d07] border border-[#3b2a1a] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-amber-950/40 border border-amber-700/50 text-amber-300">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-xs text-[#f5e6cc]">
                      Lục Soát Thực Địa (Field Scavenge)
                    </h4>
                    <p className="text-[11px] text-[#a4917a]">
                      Rà soát kẽ đá, tán cây rụng để tìm kiếm dây rừng, đá lửa hoặc phế tích bỏ sót.
                    </p>
                  </div>
                </div>

                <button
                  disabled={isSurvivorBusy}
                  onClick={() => {
                    // Start gathering on first available node or trigger scout
                    if (area.nodes[0]) {
                      onStartGathering(selectedSurvivorId, area.nodes[0].id, undefined);
                    }
                    onClose();
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold font-serif flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSurvivorBusy 
                      ? 'bg-[#221a12] text-[#635341] border border-[#332417] cursor-not-allowed' 
                      : 'btn-modal-action btn-modal-action-amber'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Lục Soát</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: TÁC CHIẾN DÃ NGOẠI & TRẠM NGHỈ (FIELD OPERATIONS & BIVOUAC)        */}
          {/* ========================================================================= */}
          {activeTab === 'operations' && (
            <div className="space-y-4">
              
              {/* SPECIAL CASE: THIS IS BASE CAMP */}
              {isCamp ? (
                <div className="p-5 rounded-xl bg-gradient-to-b from-[#1c150c] to-[#120d08] border-2 border-[#5c4026] text-center space-y-3.5 shadow-lg">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-950/60 border border-amber-600/80 flex items-center justify-center text-amber-300 shadow">
                    <Tent className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="font-serif font-black text-base text-[#f5e6cc] uppercase tracking-wide">
                      Đây Là Doanh Trại Đầu Não (Main Base Camp)
                    </h3>
                    <p className="text-xs text-[#c2b097] max-w-md mx-auto mt-1 leading-relaxed">
                      Mọi hoạt động quản lý kho bãi trung tâm, quy hoạch xây dựng công trình, nông trại trồng trọt, bàn chế tác và phân bổ nhân lực được vận hành tập trung tại giao diện Quản Lý Căn Cứ.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenManageCamp?.();
                      }}
                      className="px-6 py-2.5 rounded-lg btn-modal-action btn-modal-action-amber font-serif font-bold text-sm text-amber-100 flex items-center gap-2 mx-auto shadow-md hover:scale-105 transition-all cursor-pointer"
                    >
                      <span>Mở Bảng Quản Lý Căn Cứ (Manage Camp)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* WILD EXPEDITION OPERATIONS */
                <div className="space-y-3.5">
                  {/* Operation 1: Field Bivouac / Temporary Campfire */}
                  <div className="p-3.5 rounded-lg bg-[#18110a] border border-[#3b2a1a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-lg border shrink-0 ${
                        isBivouacSet 
                          ? 'bg-amber-950/70 border-amber-600 text-amber-300' 
                          : 'bg-black/50 border-[#382618] text-[#8e7b65]'
                      }`}>
                        <Flame className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-xs text-[#f5e6cc]">
                            Điểm Trú Chân / Lửa Trại Dã Ngoại (Field Bivouac)
                          </h4>
                          <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold border ${
                            isBivouacSet
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-black/50 text-[#8e7a62] border-[#382618]'
                          }`}>
                            {isBivouacSet ? 'Đang cháy ấm' : 'Chưa thiết lập'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#a6947c] mt-0.5">
                          Dựng lán tạm và đốt lửa trại sưởi ấm giúp đội thám hiểm có thể nghỉ chân qua đêm tại đây mà không bị dã thú săn đêm quấy nhiễu.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsBivouacSet(!isBivouacSet)}
                      className={`px-3 py-2 rounded text-xs font-bold font-serif shrink-0 flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        isBivouacSet
                          ? 'bg-[#291c12] hover:bg-[#382718] text-[#dfcfb7] border border-[#4d3621]'
                          : 'btn-modal-action btn-modal-action-amber'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{isBivouacSet ? 'Dập Lửa Trại' : 'Dựng Trạm Nghỉ Tạm'}</span>
                    </button>
                  </div>

                  {/* Operation 2: Expedition Dispatch Launcher */}
                  <div className="p-3.5 rounded-lg bg-[#18110a] border border-[#3b2a1a] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#2d1d11] pb-2">
                      <div className="flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-amber-400" />
                        <h4 className="font-serif font-bold text-xs text-[#f5e6cc] uppercase tracking-wide">
                          Khởi Hành Đội Thám Hiểm Tới Đây
                        </h4>
                      </div>
                      <span className="text-[10.5px] text-[#9c8973]">
                        Hành trình dự kiến: <strong className="text-amber-200">{area.baseTravelMinutes} phút</strong>
                      </span>
                    </div>

                    <p className="text-xs text-[#a6947c]">
                      Chọn các thành viên trong đoàn tham gia chiến dịch thám hiểm chuyên sâu để mở rộng bản đồ và thu thập tài nguyên:
                    </p>

                    {/* Member Multi-selector */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {survivors.map((s) => {
                        const isSelected = selectedExpeditionIds.includes(s.id);
                        const isBusy = s.currentAction.type !== 'idle';

                        return (
                          <div
                            key={s.id}
                            onClick={() => !isBusy && toggleExpeditionSurvivor(s.id)}
                            className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all select-none ${
                              isBusy
                                ? 'bg-black/30 border-[#22180f] opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-amber-950/60 border-amber-600/90 text-amber-100 shadow'
                                : 'bg-[#120c07] border-[#332214] text-[#9e8b74] hover:border-[#4d3621]'
                            }`}
                          >
                            <SurvivorPortrait
                              survivor={s}
                              size={28}
                              className="rounded-full border border-black/60 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate leading-tight">
                                {s.name}
                              </div>
                              <div className="text-[9.5px] text-[#8c7a65] truncate">
                                {isBusy ? 'Đang bận' : `HP: ${s.health}%`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Dispatch Button */}
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-[#8e7a62]">
                        Đã chọn: <strong className="text-amber-200">{selectedExpeditionIds.length}</strong> thành viên
                      </div>

                      <button
                        disabled={selectedExpeditionIds.length === 0}
                        onClick={() => {
                          onLaunchExpedition(area.id, selectedExpeditionIds);
                          onClose();
                        }}
                        className={`px-4 py-2 rounded text-xs font-bold font-serif flex items-center gap-1.5 transition-all cursor-pointer ${
                          selectedExpeditionIds.length === 0
                            ? 'bg-[#221a12] text-[#635341] border border-[#332417] cursor-not-allowed'
                            : 'btn-modal-action btn-modal-action-amber'
                        }`}
                      >
                        <Compass className="w-4 h-4" />
                        <span>Xuất Phát Thám Hiểm ({area.baseTravelMinutes}p)</span>
                      </button>
                    </div>
                  </div>

                  {/* Operation 3: Field Supply Caching (Hốc Giấu Quân Nhu Dã Ngoại) */}
                  {poiStorage && poiStorage.items.length > 0 && (
                    <div className="p-3 rounded-lg bg-[#140d07] border border-[#3b2a1a] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-300" />
                        <div>
                          <h4 className="font-serif font-bold text-xs text-[#e8d5b7]">
                            Quân Nhu Tạm Thời Tại Địa Bàn ({poiStorage.items.length} món)
                          </h4>
                          <span className="text-[10px] text-[#8e7a62]">
                            Các vật tư nặng giấu lại để giảm tải trọng túi đồ hành trang.
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onTransferAll?.(area.id, 'poi_to_party')}
                        className="px-3 py-1 rounded text-xs font-serif font-bold bg-[#291c12] hover:bg-[#382618] text-amber-200 border border-[#4d3621] cursor-pointer"
                        title="Thu hồi toàn bộ quân nhu mang về túi đồ"
                      >
                        Thu Hồi Hết
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
