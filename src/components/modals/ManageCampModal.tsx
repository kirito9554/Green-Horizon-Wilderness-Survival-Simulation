import React, { useState, useEffect } from 'react';
import {
  Tent,
  Wrench,
  Hammer,
  Users,
  Package,
  Leaf,
  Flame,
  Shield,
  X,
  Clock3,
  Sun,
  MapPin,
} from 'lucide-react';
import { GameState, JobPriority, JobType } from '../../types';
import { BuildingsView } from '../buildings/BuildingsView';
import { CraftingView } from '../crafting/CraftingView';
import { SurvivorView } from '../survivors/SurvivorView';
import { CampOverviewView } from '../camp/CampOverviewView';
import { CampStorageTab } from '../camp/CampStorageTab';
import { CampFarmingTab } from '../camp/CampFarmingTab';
import { CampUtilitiesTab } from '../camp/CampUtilitiesTab';
import { CampDefensesTab } from '../camp/CampDefensesTab';
import '../crafting/OrganicUI.css';

interface ManageCampModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
  onStartConstruction: (survivorId: string, buildingId: string) => void;
  onStartCrafting: (survivorId: string, recipeId: string) => void;
  onStartResearch?: (recipeId: string, survivorId: string) => void;
  onPauseResearch?: (recipeId: string) => void;
  onAddToCraftingQueue?: (recipeId: string, quantity: number, assignedSurvivorId?: string) => void;
  onCancelQueueItem?: (queueItemId: string) => void;
  onTogglePauseQueueItem?: (queueItemId: string) => void;
  onReorderQueue?: (queueItemId: string, direction: 'up' | 'down') => void;
  onAssignSurvivorToQueue?: (queueItemId: string, survivorId?: string) => void;
  onUpdateJobPriority: (survivorId: string, job: JobType, priority: JobPriority) => void;
  onUpdatePolicy: (
    policyKey: 'foodPolicy' | 'waterPolicy',
    value: 'ration' | 'normal' | 'generous'
  ) => void;
  onUpdatePortrait?: (survivorId: string, portraitIndex: number) => void;
  onRecruitSurvivor?: () => void;
}

export type CampTab =
  | 'overview'
  | 'crafting'
  | 'buildings'
  | 'assign'
  | 'storage'
  | 'farming'
  | 'utilities'
  | 'defenses';

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const TAB_ORDER: CampTab[] = [
  'overview',
  'crafting',
  'buildings',
  'assign',
  'storage',
  'farming',
  'utilities',
  'defenses',
];

export const TAB_CONFIGS: Record<
  CampTab,
  {
    label: string;
    sublabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    accentBg: string;
  }
> = {
  overview: {
    label: 'TỔNG QUAN',
    sublabel: 'OVERVIEW',
    description: 'Toàn cảnh doanh trại, hàng đợi, vị trí công trình & kho bãi sinh tồn',
    icon: Tent,
    color: '#4ade80',
    accentBg: 'rgba(16, 185, 129, 0.15)',
  },
  crafting: {
    label: 'CHẾ TẠO',
    sublabel: 'CRAFTING',
    description: 'Chế tạo công cụ, vũ khí, chế biến vật tư & nghiên cứu bản vẽ mới',
    icon: Wrench,
    color: '#f59e0b',
    accentBg: 'rgba(217, 119, 6, 0.15)',
  },
  buildings: {
    label: 'CÔNG TRÌNH',
    sublabel: 'BUILDING',
    description: 'Bố trí mặt bằng, xây dựng nơi trú ẩn, giàn chứa & kiến trúc sinh tồn',
    icon: Hammer,
    color: '#fbbf24',
    accentBg: 'rgba(245, 158, 11, 0.15)',
  },
  assign: {
    label: 'PHÂN CÔNG',
    sublabel: 'SURVIVORS',
    description: 'Điều phối nhân lực, thứ tự ưu tiên & quản lý sức khỏe người sống sót',
    icon: Users,
    color: '#2dd4bf',
    accentBg: 'rgba(20, 184, 166, 0.15)',
  },
  storage: {
    label: 'KHO BÃI',
    sublabel: 'STORAGE',
    description: 'Kiểm tra dung lượng kho bãi, độ tươi phẩm chất & quản lý phân loại vật tư',
    icon: Package,
    color: '#34d399',
    accentBg: 'rgba(16, 185, 129, 0.15)',
  },
  farming: {
    label: 'LƯƠNG THỰC',
    sublabel: 'FARMING',
    description: 'Khẩu phần ăn uống, bảo quản sấy khô thực phẩm & phát triển vườn ươm trại',
    icon: Leaf,
    color: '#a3e635',
    accentBg: 'rgba(132, 204, 22, 0.15)',
  },
  utilities: {
    label: 'TIỆN ÍCH',
    sublabel: 'UTILITIES',
    description: 'Duy trì bếp lửa trại, lọc nước sạch tiệt trùng & xử lý rác thải bãi trại',
    icon: Flame,
    color: '#fb923c',
    accentBg: 'rgba(249, 115, 22, 0.15)',
  },
  defenses: {
    label: 'PHÒNG THỦ',
    sublabel: 'DEFENSES',
    description: 'Hàng rào tre gai, đuốc cảnh giới đêm, chuông báo động & phòng ngừa thú dữ',
    icon: Shield,
    color: '#eab308',
    accentBg: 'rgba(234, 179, 8, 0.15)',
  },
};

export const ManageCampModal: React.FC<ManageCampModalProps> = ({
  isOpen,
  onClose,
  state,
  onStartConstruction,
  onStartCrafting,
  onStartResearch,
  onPauseResearch,
  onAddToCraftingQueue,
  onCancelQueueItem,
  onTogglePauseQueueItem,
  onReorderQueue,
  onAssignSurvivorToQueue,
  onUpdateJobPriority,
  onUpdatePolicy,
  onUpdatePortrait,
  onRecruitSurvivor,
}) => {
  const [activeTab, setActiveTab] = useState<CampTab>('overview');

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const currentTabConfig = TAB_CONFIGS[activeTab] || TAB_CONFIGS.overview;
  const idleSurvivors = state.survivors.filter(s => s.currentAction.type === 'idle').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-150 p-2 sm:p-4 select-none"
      style={{ fontFamily: UI_FONT }}
    >
      {/* Outer Grand Jungle & Wooden Styled Frame */}
      <div
        className="relative flex w-full h-full max-w-[1680px] max-h-[960px] min-h-[640px] rounded-2xl overflow-hidden border-2 border-[#3b5946] shadow-[0_12px_45px_rgba(0,0,0,0.88),0_0_0_1px_rgba(105,158,125,0.22)]"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #0c261e 0%, #061713 55%, #030d0b 100%)',
        }}
      >
        {/* Subtle Decorative Tropical Jungle Vine Edge Overlays */}
        <div className="absolute top-0 left-0 w-32 h-32 pointer-events-none opacity-40 bg-gradient-to-br from-emerald-500/20 to-transparent" />
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-40 bg-gradient-to-bl from-emerald-500/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none opacity-40 bg-gradient-to-tr from-emerald-500/20 to-transparent" />
        <div className="absolute bottom-0 right-0 w-32 h-32 pointer-events-none opacity-40 bg-gradient-to-tl from-emerald-500/20 to-transparent" />

        {/* ================================================================= */}
        {/* LEFT VERTICAL NAVIGATION SIDEBAR (Matching reference image)       */}
        {/* ================================================================= */}
        <aside
          className="relative w-[148px] sm:w-[160px] shrink-0 flex flex-col justify-between border-r border-[#264436]/90 p-2.5 z-20"
          style={{
            background: 'linear-gradient(180deg, rgba(5,20,16,0.96) 0%, rgba(3,14,11,0.98) 100%)',
            boxShadow: 'inset -3px 0 12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Top Camp Badge / Icon */}
          <div className="flex flex-col items-center pb-2.5 mb-1.5 border-b border-[#234233]/70">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-widest text-[#9ed3ab] uppercase">
              <Tent className="w-4 h-4 text-emerald-400" />
              <span>CAMP HQ</span>
            </div>
            <div className="text-[10px] text-[#638472] uppercase tracking-wider font-mono mt-0.5">
              GREEN HORIZON
            </div>
          </div>

          {/* Vertical Tab Buttons List */}
          <nav className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'none' }}>
            {TAB_ORDER.map((tabKey) => {
              const cfg = TAB_CONFIGS[tabKey];
              const isActive = activeTab === tabKey;
              const TabIcon = cfg.icon;

              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`relative group w-full py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer outline-none ${
                    isActive
                      ? 'bg-gradient-to-b from-[#184833] to-[#0d2f21] border-2 border-[#54d775] text-[#f7f3e8] shadow-[0_0_16px_rgba(84,215,117,0.32),inset_0_1px_0_rgba(255,255,255,0.12)] scale-[1.02]'
                      : 'bg-[#081f18]/80 hover:bg-[#113124] border border-[#224434]/80 text-[#8ba394] hover:text-[#e8e2d2] hover:border-[#3b6b50] active:scale-98 shadow-sm'
                  }`}
                >
                  <TabIcon
                    className={`w-6 h-6 transition-transform duration-150 ${
                      isActive
                        ? 'text-[#7bf099] drop-shadow-[0_0_8px_rgba(123,240,153,0.5)] scale-110'
                        : 'text-[#6c8a77] group-hover:text-[#a0c5ad]'
                    }`}
                  />
                  <div className="text-center leading-tight">
                    <span
                      className={`block text-[11.5px] font-black tracking-wider uppercase truncate ${
                        isActive ? 'text-[#f5ede0]' : 'text-[#9cb5a5] group-hover:text-[#ded5c5]'
                      }`}
                    >
                      {cfg.label}
                    </span>
                    <span
                      className="block text-[8.5px] font-mono tracking-wide uppercase opacity-75"
                      style={{ color: isActive ? cfg.color : '#617d6d' }}
                    >
                      {cfg.sublabel}
                    </span>
                  </div>

                  {/* Active Indicator Glow Pip */}
                  {isActive && (
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#62e080] rounded-r-full shadow-[0_0_8px_#62e080]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Branding / Lore Motto */}
          <div className="pt-2 mt-1 border-t border-[#234233]/70 text-center pointer-events-none">
            <span className="text-[9px] tracking-widest uppercase font-mono text-[#547361]">
              A WILDER TOMORROW
            </span>
          </div>
        </aside>

        {/* ================================================================= */}
        {/* RIGHT MAIN VIEWPORT (Header + Fullscreen Tab Content Canvas)       */}
        {/* ================================================================= */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
          {/* 1. MASTER TOP HEADER */}
          <header
            className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#284938]/85"
            style={{
              background: 'linear-gradient(180deg, rgba(6,25,20,0.95) 0%, rgba(4,18,14,0.92) 100%)',
            }}
          >
            {/* Left: Active Tab Title & Description */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner shrink-0"
                style={{
                  backgroundColor: 'rgba(9, 36, 28, 0.9)',
                  borderColor: 'rgba(84, 215, 117, 0.45)',
                  boxShadow: '0 0 12px rgba(84,215,117,0.15)',
                }}
              >
                <currentTabConfig.icon className="w-6 h-6 text-[#72ea91]" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-black tracking-wide uppercase text-[#f5ebd8] leading-none">
                    {currentTabConfig.label}
                  </h1>
                  <span
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border leading-none font-bold"
                    style={{
                      color: currentTabConfig.color,
                      backgroundColor: 'rgba(6, 28, 22, 0.8)',
                      borderColor: 'rgba(110, 160, 130, 0.35)',
                    }}
                  >
                    {currentTabConfig.sublabel}
                  </span>
                </div>
                <p className="text-xs text-[#95ab9c] truncate max-w-[540px] mt-0.5">
                  {currentTabConfig.description}
                </p>
              </div>
            </div>

            {/* Right: Island Status, Day/Time & Big Close Button */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Island Lore & Time HUD */}
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#071d17]/80 border border-[#234333]/70 text-xs">
                <div className="flex items-center gap-1.5 text-[#e5ddcc]">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold tracking-wide">GREENHAVEN ISLAND</span>
                </div>
                <div className="h-3.5 w-px bg-[#264837]" />
                <div className="flex items-center gap-1.5 text-amber-300 font-mono font-bold">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ngày {state.day || 1} • {String(Math.floor(state.gameTime.hour)).padStart(2, '0')}:{String(Math.floor((state.gameTime.hour % 1) * 60)).padStart(2, '0')}</span>
                </div>
                <div className="h-3.5 w-px bg-[#264837]" />
                <div className="flex items-center gap-1.5 text-[#9cb1a2]">
                  <Users className="w-3.5 h-3.5 text-teal-400" />
                  <span>{idleSurvivors} rảnh / {state.survivors.length} người</span>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                aria-label="Đóng quản lý trại"
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150 bg-[#163628]/80 hover:bg-rose-950/80 border border-[#315642] hover:border-rose-500/70 text-[#d8cfbe] hover:text-rose-200 active:scale-95 shadow-md group"
                title="Đóng (Esc)"
              >
                <X className="w-5 h-5 transition-transform duration-150 group-hover:rotate-90" />
              </button>
            </div>
          </header>

          {/* 2. MAIN ACTIVE TAB WORKSPACE CANVAS (Full bleed generous viewport) */}
          <div className="flex-1 min-h-0 relative overflow-hidden bg-gradient-to-b from-[#081b16] to-[#04110e]">
            {/* 1. OVERVIEW VIEW */}
            {activeTab === 'overview' && (
              <div className="w-full h-full overflow-hidden p-3">
                <CampOverviewView
                  state={state}
                  onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
                  onCancelQueueItem={onCancelQueueItem}
                  onReorderQueue={onReorderQueue}
                />
              </div>
            )}

            {/* 2. CRAFTING VIEW */}
            {activeTab === 'crafting' && (
              <div className="w-full h-full overflow-hidden">
                <CraftingView
                  state={state}
                  onStartCrafting={onStartCrafting}
                  onStartResearch={onStartResearch}
                  onPauseResearch={onPauseResearch}
                  onAddToCraftingQueue={onAddToCraftingQueue}
                  onCancelQueueItem={onCancelQueueItem}
                  onTogglePauseQueueItem={onTogglePauseQueueItem}
                  onReorderQueue={onReorderQueue}
                  onAssignSurvivorToQueue={onAssignSurvivorToQueue}
                />
              </div>
            )}

            {/* 3. BUILDINGS VIEW */}
            {activeTab === 'buildings' && (
              <div className="w-full h-full overflow-hidden p-3">
                <BuildingsView
                  state={state}
                  onStartConstruction={onStartConstruction}
                />
              </div>
            )}

            {/* 4. ASSIGN (SURVIVORS) VIEW */}
            {activeTab === 'assign' && (
              <div className="w-full h-full overflow-hidden p-3">
                <SurvivorView
                  state={state}
                  onUpdateJobPriority={onUpdateJobPriority}
                  onUpdatePolicy={onUpdatePolicy}
                  onUpdatePortrait={onUpdatePortrait}
                  onRecruitSurvivor={onRecruitSurvivor}
                />
              </div>
            )}

            {/* 5. STORAGE VIEW */}
            {activeTab === 'storage' && (
              <div className="w-full h-full overflow-hidden p-3">
                <CampStorageTab
                  state={state}
                  onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
                />
              </div>
            )}

            {/* 6. FOOD & FARMING VIEW */}
            {activeTab === 'farming' && (
              <div className="w-full h-full overflow-hidden p-3">
                <CampFarmingTab
                  state={state}
                  onUpdatePolicy={onUpdatePolicy}
                  onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
                />
              </div>
            )}

            {/* 7. UTILITIES VIEW */}
            {activeTab === 'utilities' && (
              <div className="w-full h-full overflow-hidden p-3">
                <CampUtilitiesTab
                  state={state}
                  onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
                />
              </div>
            )}

            {/* 8. DEFENSES VIEW */}
            {activeTab === 'defenses' && (
              <div className="w-full h-full overflow-hidden p-3">
                <CampDefensesTab
                  state={state}
                  onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

