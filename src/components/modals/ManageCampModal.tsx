import React, { useState } from 'react';
import { Hammer, Users, Wrench } from 'lucide-react';
import { GameState, JobPriority, JobType } from '../../types';
import { BuildingsView } from '../buildings/BuildingsView';
import { CraftingView } from '../crafting/CraftingView';
import { SurvivorView } from '../survivors/SurvivorView';

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

type CampTab = 'buildings' | 'crafting' | 'survivors';
type Box = { x: number; y: number; w: number; h: number; radiusPx?: number };

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * ============================================================================
 * CAMP MANAGEMENT - DOM SHELL TUNING
 * ============================================================================
 * Ảnh nền mới chỉ giữ artwork/frame lớn. Tab, subtitle và interaction được vẽ
 * bằng DOM để dễ sửa. Tất cả tọa độ dùng design pixel trên ảnh 1448 x 1086.
 * ============================================================================
 */
const CAMP_UI = {
  reference: { width: 1448, height: 1086 },

  background: {
    src: '/ui/buildings/camp-management-bg.png',
    maxWidthPx: 1448,
    viewportPaddingPx: 8,
  },

  /**
   * Scale TOÀN BỘ panel theo viewport nhưng luôn giữ đúng tỉ lệ 1448:1086.
   *
   * width được chọn theo giá trị NHỎ NHẤT trong:
   * - % chiều rộng viewport
   * - % chiều cao viewport quy đổi về width theo aspect ratio
   * - % kích thước thiết kế gốc
   *
   * Muốn panel lớn/nhỏ hơn chỉ cần chỉnh 3 số này.
   */
  panelScale: {
    maxViewportWidthPct: 96,
    maxViewportHeightPct: 92,
    maxScale: 1.0,
  },

  subtitle: {
    x: 166,
    y: 134,
    w: 390,
    h: 24,
    fontPx: 15.5,
    color: '#d9d1bf',
  },

  // Shift the whole top tab group right to align with the cleaned raster.
  tabs: {
    buildings: { x: 614, y: 101, w: 205, h: 55, radiusPx: 8 },
    crafting: { x: 826, y: 102, w: 194, h: 53, radiusPx: 8 },
    survivors: { x: 1028, y: 102, w: 206, h: 53, radiusPx: 8 },
  } satisfies Record<CampTab, Box>,

  close: { x: 1320, y: 101, w: 58, h: 57, radiusPx: 8 },

  tabStyle: {
    iconPx: 22,
    fontPx: 17,
    gapPx: 11,
    radiusPx: 7,

    // Recessed / carved look. Keep these deliberately subtle so the DOM tabs
    // blend into the raster header instead of looking like modern CSS buttons.
    inactiveBg: 'rgba(6, 28, 27, 0.42)',
    hoverBg: 'rgba(12, 45, 37, 0.50)',
    activeBg: 'rgba(18, 67, 47, 0.56)',
    pressedBg: 'rgba(10, 42, 34, 0.62)',

    inactiveBorder: 'rgba(103, 126, 100, 0.16)',
    hoverBorder: 'rgba(119, 151, 116, 0.24)',
    activeBorder: 'rgba(119, 178, 129, 0.30)',

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

    // Very faint organic grain to break the perfectly-flat CSS surface.
    textureImage:
      'repeating-linear-gradient(96deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 8px), radial-gradient(circle at 18% 26%, rgba(255,255,255,0.018) 0 0.7px, transparent 0.9px), radial-gradient(circle at 72% 68%, rgba(0,0,0,0.055) 0 0.8px, transparent 1px)',
    textureSize: 'auto, 13px 13px, 17px 17px',
    textureOpacity: 0.48,

    // Active tab gets a small carved indicator at the bottom instead of a big glow.
    notchWidthPct: 17,
    notchHeightPx: 3,
    notchBottomPx: 4,
    notchColor: 'rgba(126, 181, 132, 0.42)',
    notchShadow: '0 1px 0 rgba(0,0,0,0.48), inset 0 1px 0 rgba(226,242,220,0.12)',
  },

  /** SurvivorView vẫn là legacy layout nên tiếp tục dùng viewport cũ. */
  legacyViewport: { x: 64, y: 187, w: 1308, h: 714 },
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
  const [activeTab, setActiveTab] = useState<CampTab>('buildings');
  const [hoveredTab, setHoveredTab] = useState<CampTab | null>(null);
  const [pressedTab, setPressedTab] = useState<CampTab | null>(null);

  if (!isOpen) return null;

  const tabMeta: Record<CampTab, { label: string; icon: React.ReactNode }> = {
    buildings: { label: 'Công trình', icon: <Hammer /> },
    crafting: { label: 'Chế tạo', icon: <Wrench /> },
    survivors: { label: 'Phân công', icon: <Users /> },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"
      style={{ padding: CAMP_UI.background.viewportPaddingPx }}
    >
      <div
        className="relative shrink-0 select-none"
        style={{
          // Scale whole Camp Management canvas as one unit.
          // All children are %/cqw based, so artwork, hitboxes, text and cards
          // shrink/grow together without changing their local coordinates.
          width: responsivePanelWidth,
          maxWidth: `calc(100vw - ${CAMP_UI.background.viewportPaddingPx * 2}px)`,
          maxHeight: `calc(100vh - ${CAMP_UI.background.viewportPaddingPx * 2}px)`,
          aspectRatio: `${CAMP_UI.reference.width} / ${CAMP_UI.reference.height}`,
          containerType: 'inline-size',
        }}
      >
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
          Xây dựng công trình, chế tạo công cụ & phân công lao động
        </div>

        {/* DOM tabs — recessed plaques blended into the raster header */}
        {(Object.keys(CAMP_UI.tabs) as CampTab[]).map((tab) => {
          const active = activeTab === tab;
          const hovered = hoveredTab === tab;
          const pressed = pressedTab === tab;
          const meta = tabMeta[tab];

          const background = pressed
            ? CAMP_UI.tabStyle.pressedBg
            : active
              ? CAMP_UI.tabStyle.activeBg
              : hovered
                ? CAMP_UI.tabStyle.hoverBg
                : CAMP_UI.tabStyle.inactiveBg;

          const borderColor = active
            ? CAMP_UI.tabStyle.activeBorder
            : hovered
              ? CAMP_UI.tabStyle.hoverBorder
              : CAMP_UI.tabStyle.inactiveBorder;

          const boxShadow = pressed
            ? CAMP_UI.tabStyle.pressedShadow
            : active
              ? CAMP_UI.tabStyle.activeShadow
              : hovered
                ? CAMP_UI.tabStyle.hoverShadow
                : CAMP_UI.tabStyle.inactiveShadow;

          const textColor = active
            ? CAMP_UI.tabStyle.activeText
            : hovered
              ? CAMP_UI.tabStyle.hoverText
              : CAMP_UI.tabStyle.inactiveText;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              onMouseEnter={() => setHoveredTab(tab)}
              onMouseLeave={() => {
                setHoveredTab((current) => (current === tab ? null : current));
                setPressedTab((current) => (current === tab ? null : current));
              }}
              onPointerDown={() => setPressedTab(tab)}
              onPointerUp={() => setPressedTab((current) => (current === tab ? null : current))}
              onPointerCancel={() => setPressedTab((current) => (current === tab ? null : current))}
              className="absolute flex items-center justify-center overflow-hidden cursor-pointer border-0 outline-none transition-[background-color,box-shadow,color,filter,transform] duration-150"
              style={{
                ...rootBoxStyle(CAMP_UI.tabs[tab]),
                gap: uiPx(CAMP_UI.tabStyle.gapPx),
                backgroundColor: background,
                border: `1px solid ${borderColor}`,
                boxShadow,
                color: textColor,
                fontFamily: UI_FONT,
                fontSize: uiPx(CAMP_UI.tabStyle.fontPx),
                fontWeight: 700,
                letterSpacing: '0.012em',
                textShadow: '0 1px 2px rgba(0,0,0,0.84)',
                transform: pressed ? `translateY(${uiPx(1)})` : 'translateY(0)',
                borderRadius: uiPx(CAMP_UI.tabStyle.radiusPx),
              }}
            >
              {/* faint organic texture; intentionally almost invisible */}
              <span
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: CAMP_UI.tabStyle.textureImage,
                  backgroundSize: CAMP_UI.tabStyle.textureSize,
                  opacity: CAMP_UI.tabStyle.textureOpacity,
                  mixBlendMode: 'soft-light',
                }}
              />

              {/* soft inner rim to mimic a carved recess rather than a CSS border */}
              <span
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={{
                  inset: uiPx(2),
                  borderRadius: uiPx(Math.max(2, CAMP_UI.tabStyle.radiusPx - 2)),
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.018), inset 0 -1px 0 rgba(0,0,0,0.24)',
                }}
              />

              <span className="relative z-10 flex items-center justify-center" style={{ gap: uiPx(CAMP_UI.tabStyle.gapPx) }}>
                {React.isValidElement(meta.icon)
                  ? React.cloneElement(meta.icon as React.ReactElement<{ style?: React.CSSProperties }>, {
                      style: {
                        width: uiPx(CAMP_UI.tabStyle.iconPx),
                        height: uiPx(CAMP_UI.tabStyle.iconPx),
                        strokeWidth: 2.15,
                        color: active ? CAMP_UI.tabStyle.activeIcon : textColor,
                        opacity: active ? 0.96 : hovered ? 0.91 : 0.82,
                        filter:
                          'blur(0.05px) drop-shadow(0 1px 1px rgba(0,0,0,0.68))',
                      },
                    })
                  : meta.icon}
                <span
                  style={{
                    opacity: active ? 0.98 : hovered ? 0.94 : 0.88,
                    filter: 'blur(0.04px)',
                  }}
                >
                  {meta.label}
                </span>
              </span>

              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                  style={{
                    width: `${CAMP_UI.tabStyle.notchWidthPct}%`,
                    height: uiPx(CAMP_UI.tabStyle.notchHeightPx),
                    bottom: uiPx(CAMP_UI.tabStyle.notchBottomPx),
                    borderRadius: '999px',
                    background: CAMP_UI.tabStyle.notchColor,
                    boxShadow: CAMP_UI.tabStyle.notchShadow,
                    opacity: 0.9,
                  }}
                />
              )}
            </button>
          );
        })}

        {/* The X artwork is baked in; only hover/click is DOM. */}
        <button
          type="button"
          aria-label="Close Camp Management"
          onClick={onClose}
          className="absolute cursor-pointer transition-all duration-150 hover:bg-white/[0.06] active:bg-white/[0.11]"
          style={{
            ...rootBoxStyle(CAMP_UI.close),
            boxShadow: 'inset 0 0 0 0 rgba(255,255,255,0)',
          }}
        />

        {activeTab === 'buildings' && (
          <BuildingsView state={state} onStartConstruction={onStartConstruction} />
        )}

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

        {activeTab === 'survivors' && (
          <div className="absolute overflow-auto" style={rootBoxStyle(CAMP_UI.legacyViewport)}>
            <SurvivorView
              state={state}
              onUpdateJobPriority={onUpdateJobPriority}
              onUpdatePolicy={onUpdatePolicy}
              onUpdatePortrait={onUpdatePortrait}
              onRecruitSurvivor={onRecruitSurvivor}
            />
          </div>
        )}
      </div>
    </div>
  );
};
