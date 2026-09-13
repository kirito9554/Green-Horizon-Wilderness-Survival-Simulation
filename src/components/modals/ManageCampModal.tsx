import React, { useState, useRef, useEffect } from 'react';
import {
  Tent,
  Hammer,
  Wrench,
  Users,
  Package,
  Leaf,
  Flame,
  Shield,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles
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
  | 'buildings'
  | 'crafting'
  | 'assign'
  | 'storage'
  | 'farming'
  | 'utilities'
  | 'defenses';

type Box = { x: number; y: number; w: number; h: number; radiusPx?: number };

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const CAMP_UI = {
  reference: { width: 1448, height: 1086 },

  background: {
    src: '/ui/buildings/camp-management-bg.png',
    maxWidthPx: 1880,
    viewportPaddingPx: 4,
  },

  panelScale: {
    maxViewportWidthPct: 98,
    maxViewportHeightPct: 96,
    maxScale: 1.30,
  },

  subtitle: {
    x: 166,
    y: 134,
    w: 390,
    h: 24,
    fontPx: 15.5,
    color: '#d9d1bf',
  },

  // Selector bar positioned in the top header
  selectorBar: {
    x: 580,
    y: 101,
    w: 700,
    h: 55,
    radiusPx: 8,
  },

  // Slide-down menu positioning
  dropdownMenu: {
    x: 510,
    y: 162,
    w: 770,
    h: 460,
    radiusPx: 10,
  },

  close: { x: 1320, y: 101, w: 58, h: 57, radiusPx: 8 },

  tabStyle: {
    iconPx: 22,
    fontPx: 17,
    gapPx: 11,
    radiusPx: 7,

    inactiveBg: 'rgba(6, 28, 27, 0.42)',
    hoverBg: 'rgba(12, 45, 37, 0.50)',
    activeBg: 'rgba(18, 67, 47, 0.56)',
    pressedBg: 'rgba(10, 42, 34, 0.62)',

    inactiveBorder: 'rgba(103, 126, 100, 0.22)',
    hoverBorder: 'rgba(119, 151, 116, 0.35)',
    activeBorder: 'rgba(119, 178, 129, 0.48)',

    inactiveText: '#dfd8c8',
    hoverText: '#eee7d7',
    activeText: '#f0eadb',
    activeIcon: '#b9e3c0',

    inactiveShadow:
      'inset 0 3px 6px rgba(0,0,0,0.56), inset 0 -1px 0 rgba(230,241,220,0.025), 0 1px 0 rgba(0,0,0,0.20)',
    hoverShadow:
      'inset 0 3px 6px rgba(0,0,0,0.50), inset 0 -1px 0 rgba(221,239,215,0.045), 0 1px 0 rgba(0,0,0,0.18)',
    activeShadow:
      'inset 0 4px 8px rgba(0,0,0,0.62), inset 0 -1px 0 rgba(157,213,164,0.09), 0 0 0 1px rgba(85,135,96,0.10), 0 0 8px rgba(79,186,100,0.055)',
    pressedShadow:
      'inset 0 5px 10px rgba(0,0,0,0.72), inset 0 -1px 0 rgba(146,199,153,0.05)',

    textureImage:
      'repeating-linear-gradient(96deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 8px), radial-gradient(circle at 18% 26%, rgba(255,255,255,0.018) 0 0.7px, transparent 0.9px), radial-gradient(circle at 72% 68%, rgba(0,0,0,0.055) 0 0.8px, transparent 1px)',
    textureSize: 'auto, 13px 13px, 17px 17px',
    textureOpacity: 0.48,

    notchWidthPct: 17,
    notchHeightPx: 3,
    notchBottomPx: 4,
    notchColor: 'rgba(126, 181, 132, 0.42)',
    notchShadow: '0 1px 0 rgba(0,0,0,0.48), inset 0 1px 0 rgba(226,242,220,0.12)',
  },

  legacyViewport: { x: 65, y: 155, w: 1318, h: 742, radiusPx: 8 },
} as const;

const rootBoxStyle = (box: Box): React.CSSProperties => ({
  left: `${(box.x / CAMP_UI.reference.width) * 100}%`,
  top: `${(box.y / CAMP_UI.reference.height) * 100}%`,
  width: `${(box.w / CAMP_UI.reference.width) * 100}%`,
  height: `${(box.h / CAMP_UI.reference.height) * 100}%`,
  borderRadius: box.radiusPx ?? 0,
});

const uiPx = (px: number) => `${(px / CAMP_UI.reference.width) * 100}cqw`;

const PANEL_ASPECT = CAMP_UI.reference.width / CAMP_UI.reference.height;
const PANEL_MAX_DESIGN_WIDTH =
  CAMP_UI.reference.width * CAMP_UI.panelScale.maxScale;

const responsivePanelWidth = `min(
  ${CAMP_UI.panelScale.maxViewportWidthPct}vw,
  calc(${CAMP_UI.panelScale.maxViewportHeightPct}vh * ${PANEL_ASPECT}),
  ${PANEL_MAX_DESIGN_WIDTH}px
)`;

export const TAB_ORDER: CampTab[] = [
  'overview',
  'buildings',
  'crafting',
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
    icon: React.ReactNode;
    color: string;
    accentBg: string;
  }
> = {
  overview: {
    label: 'TỔNG QUAN',
    sublabel: 'OVERVIEW',
    description: 'Toàn cảnh doanh trại, hàng đợi, vị trí công trình & kho bãi',
    icon: <Tent className="w-5 h-5 text-emerald-400" />,
    color: '#4ade80',
    accentBg: 'rgba(16, 185, 129, 0.15)',
  },
  buildings: {
    label: 'CÔNG TRÌNH',
    sublabel: 'BUILDINGS',
    description: 'Xây dựng nơi trú ẩn, giàn chứa, bếp đun & kiến trúc sinh tồn',
    icon: <Hammer className="w-5 h-5 text-amber-400" />,
    color: '#fbbf24',
    accentBg: 'rgba(245, 158, 11, 0.15)',
  },
  crafting: {
    label: 'CHẾ TẠO',
    sublabel: 'CRAFTING',
    description: 'Chế tạo công cụ, vũ khí, chế biến vật tư & nghiên cứu bản vẽ',
    icon: <Wrench className="w-5 h-5 text-amber-300" />,
    color: '#f59e0b',
    accentBg: 'rgba(217, 119, 6, 0.15)',
  },
  assign: {
    label: 'PHÂN CÔNG',
    sublabel: 'ASSIGN',
    description: 'Điều phối nhân lực, thứ tự ưu tiên & quản lý người sống sót',
    icon: <Users className="w-5 h-5 text-teal-400" />,
    color: '#2dd4bf',
    accentBg: 'rgba(20, 184, 166, 0.15)',
  },
  storage: {
    label: 'KHO BÃI',
    sublabel: 'STORAGE',
    description: 'Kiểm tra dung lượng kho, phẩm chất & quản lý phân loại vật tư',
    icon: <Package className="w-5 h-5 text-emerald-300" />,
    color: '#34d399',
    accentBg: 'rgba(16, 185, 129, 0.15)',
  },
  farming: {
    label: 'LƯƠNG THỰC',
    sublabel: 'FOOD & FARMING',
    description: 'Khẩu phần ăn uống, sấy khô thịt cá & phát triển vườn ươm trại',
    icon: <Leaf className="w-5 h-5 text-lime-400" />,
    color: '#a3e635',
    accentBg: 'rgba(132, 204, 22, 0.15)',
  },
  utilities: {
    label: 'TIỆN ÍCH',
    sublabel: 'UTILITIES',
    description: 'Duy trì lửa trại, lọc nước sạch, lò than củi & vệ sinh rác thải',
    icon: <Flame className="w-5 h-5 text-orange-400" />,
    color: '#fb923c',
    accentBg: 'rgba(249, 115, 22, 0.15)',
  },
  defenses: {
    label: 'PHÒNG THỦ',
    sublabel: 'DEFENSES',
    description: 'Hàng rào tre gai, đuốc cảnh giới đêm, chuông báo & bẫy dã thú',
    icon: <Shield className="w-5 h-5 text-yellow-400" />,
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
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        } else {
          onClose();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        isMenuOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        selectorRef.current &&
        !selectorRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, onClose]);

  if (!isOpen) return null;

  const currentTabConfig = TAB_CONFIGS[activeTab] || TAB_CONFIGS.overview;
  const currentTabIndex = TAB_ORDER.indexOf(activeTab);

  const handlePrevTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIdx = (currentTabIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    setActiveTab(TAB_ORDER[prevIdx]);
    setIsMenuOpen(false);
  };

  const handleNextTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (currentTabIndex + 1) % TAB_ORDER.length;
    setActiveTab(TAB_ORDER[nextIdx]);
    setIsMenuOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"
      style={{ padding: CAMP_UI.background.viewportPaddingPx }}
    >
      <div
        className="relative shrink-0 select-none"
        style={{
          width: responsivePanelWidth,
          maxWidth: `calc(100vw - ${CAMP_UI.background.viewportPaddingPx * 2}px)`,
          maxHeight: `calc(100vh - ${CAMP_UI.background.viewportPaddingPx * 2}px)`,
          aspectRatio: `${CAMP_UI.reference.width} / ${CAMP_UI.reference.height}`,
          containerType: 'inline-size',
        }}
      >
        {/* Background artwork */}
        <img
          src={CAMP_UI.background.src}
          alt="Camp Management"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
          decoding="async"
        />

        {/* Subtitle under the baked CAMP MANAGEMENT title */}
        <div
          className="absolute pointer-events-none whitespace-nowrap"
          style={{
            ...rootBoxStyle(CAMP_UI.subtitle),
            fontFamily: UI_FONT,
            fontSize: uiPx(CAMP_UI.subtitle.fontPx),
            color: CAMP_UI.subtitle.color,
            lineHeight: 1,
            textShadow: '0 1px 2px rgba(0,0,0,0.72)',
            letterSpacing: '0.01em',
          }}
        >
          Hệ thống điều hành bãi trại — Xây dựng, chế tạo, canh tác & an ninh sinh tồn
        </div>

        {/* TOP SELECTOR BAR: replaces fixed tabs with slide-down dropdown menu */}
        <div
          ref={selectorRef}
          className="absolute flex items-center gap-1.5"
          style={{
            ...rootBoxStyle(CAMP_UI.selectorBar),
            zIndex: 40,
          }}
        >
          {/* Quick Cycle Left Button */}
          <button
            type="button"
            onClick={handlePrevTab}
            className="h-full px-2.5 rounded-lg flex items-center justify-center cursor-pointer transition-all border outline-none text-[#cfc5b0] hover:text-[#f7eedf] hover:bg-[#163a2c]/80 active:scale-95"
            style={{
              backgroundColor: CAMP_UI.tabStyle.inactiveBg,
              borderColor: CAMP_UI.tabStyle.inactiveBorder,
              boxShadow: CAMP_UI.tabStyle.inactiveShadow,
            }}
            title="Hệ thống trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Main Dropdown Button (Plaque) */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex-1 h-full px-4 rounded-lg flex items-center justify-between cursor-pointer transition-all border outline-none group"
            style={{
              backgroundColor: isMenuOpen
                ? CAMP_UI.tabStyle.activeBg
                : CAMP_UI.tabStyle.inactiveBg,
              borderColor: isMenuOpen
                ? CAMP_UI.tabStyle.activeBorder
                : CAMP_UI.tabStyle.inactiveBorder,
              boxShadow: isMenuOpen
                ? CAMP_UI.tabStyle.activeShadow
                : CAMP_UI.tabStyle.inactiveShadow,
              fontFamily: UI_FONT,
            }}
          >
            {/* Left: Current System Icon & Label */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center border shadow-inner shrink-0"
                style={{
                  backgroundColor: 'rgba(9, 32, 25, 0.85)',
                  borderColor: 'rgba(74, 222, 128, 0.3)',
                }}
              >
                {currentTabConfig.icon}
              </div>

              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-base font-bold tracking-wider uppercase text-[#f5ebd8] truncate"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
                  >
                    {currentTabConfig.label}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border leading-none shrink-0"
                    style={{
                      color: currentTabConfig.color,
                      backgroundColor: 'rgba(7, 30, 24, 0.75)',
                      borderColor: 'rgba(110, 160, 130, 0.25)',
                    }}
                  >
                    {currentTabConfig.sublabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#9cb1a2] truncate max-w-[340px] leading-tight">
                  {currentTabConfig.description}
                </p>
              </div>
            </div>

            {/* Right: Status Indicator & Chevron Toggle */}
            <div className="flex items-center gap-2.5 shrink-0 ml-2">
              <span className="text-[11px] font-mono text-[#a1baa8] hidden sm:inline">
                {currentTabIndex + 1} / {TAB_ORDER.length}
              </span>
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all duration-200 ${
                  isMenuOpen
                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 rotate-180'
                    : 'bg-[#10291e]/60 border-[#2d4d3c]/50 text-[#b5cbbe] group-hover:text-white'
                }`}
              >
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              </div>
            </div>
          </button>

          {/* Quick Cycle Right Button */}
          <button
            type="button"
            onClick={handleNextTab}
            className="h-full px-2.5 rounded-lg flex items-center justify-center cursor-pointer transition-all border outline-none text-[#cfc5b0] hover:text-[#f7eedf] hover:bg-[#163a2c]/80 active:scale-95"
            style={{
              backgroundColor: CAMP_UI.tabStyle.inactiveBg,
              borderColor: CAMP_UI.tabStyle.inactiveBorder,
              boxShadow: CAMP_UI.tabStyle.inactiveShadow,
            }}
            title="Hệ thống kế tiếp"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* SLIDE-DOWN SELECTION BOARD (BẢNG TRƯỢT XUỐNG KHI ẤN) */}
        {isMenuOpen && (
          <>
            {/* Backdrop click dismisser */}
            <div
              className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[2px] rounded-2xl"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Dropdown Box */}
            <div
              ref={dropdownRef}
              className="absolute z-60 rounded-xl border border-[#3e6851] p-3.5 flex flex-col justify-between animate-in slide-in-from-top-3 fade-in duration-200 shadow-2xl"
              style={{
                ...rootBoxStyle(CAMP_UI.dropdownMenu),
                background:
                  'linear-gradient(180deg, rgba(6, 26, 23, 0.98) 0%, rgba(3, 16, 15, 0.98) 100%)',
                boxShadow:
                  '0 20px 45px -10px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(50, 90, 70, 0.4)',
                fontFamily: UI_FONT,
              }}
            >
              {/* Dropdown Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#254637]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#ede3cf]">
                    BẢNG CHỌN HỆ THỐNG DOANH TRẠI (CAMP SYSTEMS)
                  </span>
                </div>
                <span className="text-[11px] text-[#90a897] italic">
                  Chạm vào phân hệ để chuyển đổi màn hình
                </span>
              </div>

              {/* 8 Systems Grid: 2 columns x 4 rows */}
              <div className="grid grid-cols-2 gap-2 mt-2.5 flex-1">
                {TAB_ORDER.map((tabKey) => {
                  const cfg = TAB_CONFIGS[tabKey];
                  const isActive = activeTab === tabKey;

                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => {
                        setActiveTab(tabKey);
                        setIsMenuOpen(false);
                      }}
                      className={`relative rounded-lg p-2.5 text-left flex items-start gap-3 transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#183d2d] border-emerald-400 shadow-md shadow-emerald-950/70 scale-[1.01]'
                          : 'bg-[#0e241c]/90 border-[#264435] hover:bg-[#153427] hover:border-[#38644e]'
                      }`}
                    >
                      {/* Icon Box */}
                      <div
                        className={`w-9 h-9 rounded-md flex items-center justify-center border shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-[#1e4835] border-emerald-400 shadow-inner'
                            : 'bg-[#112a20] border-[#2c4e3b]'
                        }`}
                      >
                        {cfg.icon}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-bold tracking-wide uppercase ${
                              isActive ? 'text-[#fbf4e8]' : 'text-[#ded6c5]'
                            }`}
                          >
                            {cfg.label}
                          </span>
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                              <Check className="w-3 h-3" />
                              ĐANG XEM
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#96ac9e] leading-snug mt-0.5 line-clamp-2">
                          {cfg.description}
                        </p>
                      </div>

                      {/* Active indicator dot */}
                      {isActive && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Close Button at top right (X) */}
        <button
          type="button"
          aria-label="Close Camp Management"
          onClick={onClose}
          className="absolute cursor-pointer transition-all duration-150 hover:bg-white/[0.06] active:bg-white/[0.11] rounded-lg"
          style={{
            ...rootBoxStyle(CAMP_UI.close),
            boxShadow: 'inset 0 0 0 0 rgba(255,255,255,0)',
            zIndex: 40,
          }}
        />

        {/* ------------------------------------------------------------------ */}
        {/* TAB CONTENTS RENDERING                                             */}
        {/* ------------------------------------------------------------------ */}

        {/* 1. OVERVIEW VIEW */}
        {activeTab === 'overview' && (
          <CampOverviewView
            state={state}
            onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
            onCancelQueueItem={onCancelQueueItem}
            onReorderQueue={onReorderQueue}
          />
        )}

        {/* 2. BUILDINGS VIEW */}
        {activeTab === 'buildings' && (
          <BuildingsView
            state={state}
            onStartConstruction={onStartConstruction}
          />
        )}

        {/* 3. CRAFTING VIEW */}
        {activeTab === 'crafting' && (
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
        )}

        {/* 4. ASSIGN (SURVIVORS) VIEW */}
        {activeTab === 'assign' && (
          <div
            className="absolute overflow-auto"
            style={rootBoxStyle(CAMP_UI.legacyViewport)}
          >
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
          <CampStorageTab
            state={state}
            onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
          />
        )}

        {/* 6. FOOD & FARMING VIEW */}
        {activeTab === 'farming' && (
          <CampFarmingTab
            state={state}
            onUpdatePolicy={onUpdatePolicy}
            onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
          />
        )}

        {/* 7. UTILITIES VIEW */}
        {activeTab === 'utilities' && (
          <CampUtilitiesTab
            state={state}
            onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
          />
        )}

        {/* 8. DEFENSES VIEW */}
        {activeTab === 'defenses' && (
          <CampDefensesTab
            state={state}
            onNavigateTab={(tab) => setActiveTab(tab as CampTab)}
          />
        )}
      </div>
    </div>
  );
};
