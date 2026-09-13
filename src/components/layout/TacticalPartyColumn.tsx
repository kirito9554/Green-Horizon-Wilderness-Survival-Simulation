import React from 'react';
import {
  Heart,
  Droplets,
  Zap,
  Plus,
  Bed,
} from 'lucide-react';
import { GameState, SurvivorState } from '../../types';
import { SurvivorPortrait } from '../common/SurvivorPortrait';

interface TacticalPartyColumnProps {
  state: GameState;
  selectedSurvivorId: string | null;
  onSelectSurvivor: (survivorId: string) => void;
  onRestSurvivor: (survivorId: string) => void;
  onOpenSurvivorManagement: () => void;
  onRecruitSurvivor?: () => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const SCRIPT_FONT = '"Baskerville", "Palatino Linotype", "Book Antiqua", Georgia, serif';

/**
 * =============================================================================
 * PARTY COLUMN - UI TUNING AREA
 * =============================================================================
 * Reference artwork size for the right Party column: 220 x 885 px.
 *
 * - x / y / w / h values are DESIGN PIXELS against that reference.
 * - The component converts them to percentages automatically, so the whole
 *   column still scales with the game UI.
 * - activeCard children use TOP / RIGHT / BOTTOM / LEFT against designSize.
 * - Child values under recruitSlot are relative to each recruit slot box.
 *
 * This block is intentionally verbose so pixel matching can be done without
 * hunting through JSX below.
 * =============================================================================
 */
const PARTY_UI = {
  reference: {
    width: 220,
    height: 885,
  },

  root: {
    // 'visible' lets a deliberately oversized card extend outside the 220 px Party column.
    // Change to 'hidden' if you want the whole Party layer clipped to the background column.
    overflow: 'visible' as const,
  },

  typography: {
    fontFamily: UI_FONT,
    heading: {
      color: '#f0e5d1',
      weight: 700,
      letterSpacingEm: 0.035,
      blurPx: 0.14,
      opacity: 0.97,
      shadow: '0 1px 1px rgba(0,0,0,0.88), 0 0 0.4px rgba(243,231,209,0.28)',
    },
    body: {
      color: '#c7b9a2',
      weight: 400,
      letterSpacingEm: 0.004,
      blurPx: 0.10,
      opacity: 0.95,
      shadow: '0 1px 1px rgba(0,0,0,0.72)',
    },
    strong: {
      color: '#f2e7d4',
      weight: 700,
      letterSpacingEm: 0.004,
      blurPx: 0.11,
      opacity: 0.97,
      shadow: '0 1px 2px rgba(0,0,0,0.90)',
    },
  },

  // The people icon is baked into the background, so only live text is drawn.
  header: {
    title: {
      x: 56,
      y: 22,
      w: 82,
      h: 23,
      fontPx: 17,
      weight: 700,
      letterSpacingEm: 0.045,
    },
    count: {
      x: 172,
      y: 22,
      w: 37,
      h: 22,
      fontPx: 15,
      weight: 500,
      letterSpacingEm: 0.015,
      align: 'center' as const,
    },
  },

  // Main / selected survivor card.
  // ---------------------------------------------------------------------------
  // RESIZE THE WHOLE CARD HERE using TOP / RIGHT / BOTTOM / LEFT.
  // The children below are authored against designSize and therefore follow the
  // card automatically when these four edges change. Font/icon/padding sizes also
  // receive the automatic uniform scale. Each child still has its own four edges
  // so it can be nudged independently when the AI-generated background is uneven.
  //
  // Default below matches the baked main-card area at roughly 191 x 251 px.
  // To enlarge the whole card, reduce right/bottom and/or left/top; every child follows.
  // Example: left 10 + right 10 => card width = 220 - 10 - 10 = 200 px.
  activeCard: {
    box: {
      top: 48,
      right: 4,
      bottom: 575,
      left: 12,
    },

    // Base coordinate system used by every child. Normally leave this unchanged.
    designSize: {
      width: 191,
      height: 251,
    },

    // Automatic content scale = min(currentWidth / 191, currentHeight / 251).
    // Multiply it here if the contents look a little too large/small after resizing.
    contentScaleMultiplier: 1.0,
    contentScaleMin: 0.45,
    contentScaleMax: 2.25,
    radiusPx: 7,

    portrait: {
      top: 2,
      right: 2,
      bottom: 2,
      left: 2,
      radiusPx: 5,
      borderPx: 1,
      borderColor: 'rgba(92, 120, 95, 0.62)',
      background: 'rgba(5, 15, 13, 0.98)',

      // Portrait sheet is 5 columns x 4 rows. The source cell ratio is ~2:3.
      // SurvivorPortrait may render a sprite/background rather than a raw <img>, so
      // object-contain on the component itself is not enough. We therefore fit the
      // COMPONENT BOX to the source-cell ratio before SurvivorPortrait renders.
      sourceAspectRatio: 2 / 3,
      fitScale: 1.0,
      offsetXpx: 0,
      offsetYpx: 0,
    },

    // Small translucent shadow panel behind name + profession/action.
    nameBackdrop: {
      top: 4,
      right: 32,
      bottom: 196,
      left: 5,
      radiusPx: 5,
      background: 'rgba(5, 15, 13, 0.46)',
      border: '1px solid rgba(124, 145, 125, 0.10)',
      boxShadow: '0 3px 7px rgba(0,0,0,0.34)',
      backdropBlurPx: 1.25,
    },

    name: {
      top: 7,
      right: 36,
      bottom: 221,
      left: 10,
      fontPx: 16.5,
      weight: 700,
      letterSpacingEm: 0.003,
    },
    action: {
      top: 31,
      right: 76,
      bottom: 202,
      left: 10,
      fontPx: 12.5,
      weight: 500,
      letterSpacingEm: 0.002,
      color: '#39db63',
    },

    // Kept hidden until hover so the default appearance stays faithful to sample.
    restButton: {
      show: true,
      top: 7,
      right: 8,
      bottom: 221,
      left: 160,
      iconPx: 12,
      radiusPx: 5,
      opacityIdle: 0,
      opacityHover: 1,
    },

    // Survival vitals are circular progress rings wrapped around their icons; no number is rendered below.
    // Ring size / stroke / icon can all be tuned independently. Numeric values are tooltip-only.
    vitals: {
      top: 170,
      right: 2,
      bottom: 33,
      left: 2,
      background: 'rgba(7, 20, 18, 0.54)',
      borderTop: '1px solid rgba(80, 107, 88, 0.34)',
      borderBottom: '1px solid rgba(80, 107, 88, 0.30)',
      backdropBlurPx: 1.5,
      horizontalPaddingPx: 7,
      statGapPx: 3,
      ringSizePx: 34,
      ringStrokePx: 3.1,
      ringTrackColor: 'rgba(206, 220, 207, 0.15)',
      ringBackground: 'rgba(5, 16, 14, 0.42)',
      ringGlowOpacity: 0.22,
      iconPx: 15,
      heartColor: '#ef625d',
      waterColor: '#49c9ef',
      staminaColor: '#f0ca49',
    },

    condition: {
      top: 218,
      right: 2,
      bottom: 2,
      left: 2,
      background: 'rgba(6, 18, 15, 0.64)',
      paddingLeftPx: 6,
      paddingRightPx: 6,
      labelYpx: 3,
      labelFontPx: 12.5,
      labelWeight: 700,
      barYpx: 20,
      barHeightPx: 7,
      barRadiusPx: 5,
      barBackground: '#07100d',
      barBorder: '1px solid rgba(62, 87, 70, 0.78)',
      barFill: '#35d978',
    },
  },


  recruitSlots: {
    boxes: [
      { x: 20, y: 334, w: 185, h: 118 },
      { x: 20, y: 462, w: 185, h: 118 },
      { x: 20, y: 594, w: 180, h: 118 },
    ],

    // Empty slot visuals. The dashed rectangle itself is already in the BG.
    empty: {
      hoverBackground: 'rgba(42, 91, 68, 0.10)',
      plusCircle: {
        x: 69,
        y: 31,
        w: 47,
        h: 46,
        radiusPercent: 50,
        border: '1px solid rgba(89, 119, 104, 0.66)',
        background: 'rgba(12, 31, 27, 0.34)',
        plusPx: 22,
        plusStrokeWidth: 2.4,
        plusColor: '#9dafaa',
      },
      label: {
        x: 32,
        y: 82,
        w: 122,
        h: 20,
        fontPx: 12.5,
        weight: 400,
        color: '#9caeaa',
        letterSpacingEm: 0.002,
      },
    },

    // Layout used if additional survivors occupy one of the three lower slots.
    filled: {
      paddingPx: 6,
      portrait: {
        x: 6,
        y: 7,
        w: 76,
        h: 107,
        radiusPx: 5,
        borderPx: 1,
        borderColor: 'rgba(87, 114, 98, 0.56)',
        background: 'rgba(6, 16, 14, 0.96)',

        // Same source-cell ratio as the large portrait.
        sourceAspectRatio: 2 / 3,
        fitScale: 1.0,
        offsetXpx: 0,
        offsetYpx: 0,
      },
      nameBackdrop: {
        x: 66,
        y: 10,
        w: 106,
        h: 35,
        radiusPx: 4,
        background: 'rgba(6, 17, 15, 0.44)',
        border: '1px solid rgba(106, 129, 112, 0.10)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
        backdropBlurPx: 1.1,
      },
      name: { x: 71, y: 14, w: 96, h: 16, fontPx: 12.5, weight: 700 },
      role: { x: 71, y: 29, w: 96, h: 14, fontPx: 10, weight: 500 },
      statsPanel: {
        x: 66,
        y: 47,
        w: 106,
        h: 37,
        radiusPx: 4,
        background: 'rgba(7, 19, 17, 0.48)',
        border: '1px solid rgba(78, 105, 87, 0.18)',
        backdropBlurPx: 1.2,
        rowPaddingPx: 4,
        statGapPx: 2,
        ringSizePx: 24,
        ringStrokePx: 2.35,
        ringTrackColor: 'rgba(206, 220, 207, 0.14)',
        ringBackground: 'rgba(5, 16, 14, 0.36)',
        ringGlowOpacity: 0.18,
        iconPx: 10,
        heartColor: '#ef6962',
        waterColor: '#4cccf1',
        staminaColor: '#f2ce4d',
      },
      conditionLabel: {
        x: 66,
        y: 87,
        w: 92,
        h: 13,
        fontPx: 10.5,
        weight: 700,
      },
      healthBar: {
        x: 66,
        y: 103,
        w: 106,
        h: 7,
        radiusPx: 5,
        background: 'rgba(6, 12, 10, 0.90)',
        border: '1px solid rgba(60, 84, 70, 0.78)',
        fill: '#33d877',
      },
      hoverBackground: 'rgba(35, 76, 57, 0.16)',
    },
  },

  quote: {
    x: 57,
    y: 725,
    w: 116,
    h: 105,
    fontFamily: SCRIPT_FONT,
    color: 'rgba(78, 111, 83, 0.72)',
    blurPx: 0.18,
    shadow: '0 1px 1px rgba(0,0,0,0.45)',
    rotateDeg: -5,
    a: { x: 20, y: 2, w: 75, h: 25, fontPx: 20, weight: 400 },
    wilder: { x: 1, y: 27, w: 114, h: 30, fontPx: 22, weight: 400 },
    tomorrow: { x: 20, y: 59, w: 95, h: 28, fontPx: 19, weight: 400 },
  },
} as const;

type Box = { x: number; y: number; w: number; h: number };
type EdgeBox = { top: number; right: number; bottom: number; left: number };
type Size = { width: number; height: number };

type SoftPreset = typeof PARTY_UI.typography.heading |
  typeof PARTY_UI.typography.body |
  typeof PARTY_UI.typography.strong;

// Legacy x/y/w/h helper retained for recruit slots + decorative quote.
const rootBoxStyle = (box: Box): React.CSSProperties => ({
  left: `${(box.x / PARTY_UI.reference.width) * 100}%`,
  top: `${(box.y / PARTY_UI.reference.height) * 100}%`,
  width: `${(box.w / PARTY_UI.reference.width) * 100}%`,
  height: `${(box.h / PARTY_UI.reference.height) * 100}%`,
});

const childBoxStyle = (box: Box, parent: Box): React.CSSProperties => ({
  left: `${(box.x / parent.w) * 100}%`,
  top: `${(box.y / parent.h) * 100}%`,
  width: `${(box.w / parent.w) * 100}%`,
  height: `${(box.h / parent.h) * 100}%`,
});

// New edge-based helpers for the selected/main card.
// Child percentages are always calculated against designSize, NOT the current card
// size. This is what makes every field follow the card when its outer edges change.
const rootEdgeStyle = (edges: EdgeBox): React.CSSProperties => ({
  top: `${(edges.top / PARTY_UI.reference.height) * 100}%`,
  right: `${(edges.right / PARTY_UI.reference.width) * 100}%`,
  bottom: `${(edges.bottom / PARTY_UI.reference.height) * 100}%`,
  left: `${(edges.left / PARTY_UI.reference.width) * 100}%`,
});

const childEdgeStyle = (edges: EdgeBox, design: Size): React.CSSProperties => ({
  top: `${(edges.top / design.height) * 100}%`,
  right: `${(edges.right / design.width) * 100}%`,
  bottom: `${(edges.bottom / design.height) * 100}%`,
  left: `${(edges.left / design.width) * 100}%`,
});

const edgeSize = (edges: EdgeBox, design: Size) => ({
  width: design.width - edges.left - edges.right,
  height: design.height - edges.top - edges.bottom,
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Fits a SurvivorPortrait component inside its viewport without changing the
 * source portrait aspect ratio. This is intentionally applied to the component
 * box itself because SurvivorPortrait can be sprite/background based, where
 * CSS object-fit on the outer component has no effect.
 */
const containedPortraitStyle = (
  containerWidth: number,
  containerHeight: number,
  sourceAspectRatio: number,
  scale = 1,
  offsetXpx = 0,
  offsetYpx = 0,
): React.CSSProperties => {
  const safeWidth = Math.max(1, containerWidth);
  const safeHeight = Math.max(1, containerHeight);
  const safeAspect = Math.max(0.01, sourceAspectRatio);
  const safeScale = Math.max(0.01, scale);
  const containerAspect = safeWidth / safeHeight;

  let widthPercent = 100;
  let heightPercent = 100;

  if (containerAspect > safeAspect) {
    // Viewport is wider than the source portrait: fit by height.
    heightPercent = 100 * safeScale;
    widthPercent = (safeHeight * safeAspect / safeWidth) * 100 * safeScale;
  } else {
    // Viewport is narrower than the source portrait: fit by width.
    widthPercent = 100 * safeScale;
    heightPercent = (safeWidth / safeAspect / safeHeight) * 100 * safeScale;
  }

  return {
    position: 'absolute',
    left: `calc(50% + ${offsetXpx}px)`,
    top: `calc(50% + ${offsetYpx}px)`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    transform: 'translate(-50%, -50%)',
  };
};

const softTextStyle = (preset: SoftPreset): React.CSSProperties => ({
  fontFamily: PARTY_UI.typography.fontFamily,
  fontWeight: preset.weight,
  letterSpacing: `${preset.letterSpacingEm}em`,
  color: preset.color,
  opacity: preset.opacity,
  textShadow: preset.shadow,
  filter: preset.blurPx > 0 ? `blur(${preset.blurPx}px)` : undefined,
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
});

const simpleSoftText = (
  fontPx: number,
  weight: number,
  color?: string,
  letterSpacingEm = 0.003,
): React.CSSProperties => ({
  fontFamily: PARTY_UI.typography.fontFamily,
  fontSize: fontPx,
  fontWeight: weight,
  letterSpacing: `${letterSpacingEm}em`,
  color: color ?? PARTY_UI.typography.strong.color,
  textShadow: PARTY_UI.typography.strong.shadow,
  filter: `blur(${PARTY_UI.typography.strong.blurPx}px)`,
  WebkitFontSmoothing: 'antialiased',
});

type CircularVitalProps = {
  value: number;
  color: string;
  sizePx: number;
  strokePx: number;
  trackColor: string;
  background: string;
  glowOpacity: number;
  iconPx: number;
  title: string;
  children: React.ReactNode;
};

const CircularVital: React.FC<CircularVitalProps> = ({
  value,
  color,
  sizePx,
  strokePx,
  trackColor,
  background,
  glowOpacity,
  iconPx,
  title,
  children,
}) => {
  const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));
  const radius = Math.max(1, (sizePx - strokePx) / 2);
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedValue / 100);

  return (
    <div
      className="flex items-center justify-center min-w-0"
      title={`${title}: ${normalizedValue}`}
    >
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: sizePx,
          height: sizePx,
          borderRadius: '50%',
          background,
          boxShadow: `0 0 ${Math.max(2, sizePx * 0.18)}px rgba(0,0,0,0.34)`,
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={sizePx}
          height={sizePx}
          viewBox={`0 0 ${sizePx} ${sizePx}`}
          aria-hidden="true"
        >
          <circle
            cx={sizePx / 2}
            cy={sizePx / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokePx}
          />
          <circle
            cx={sizePx / 2}
            cy={sizePx / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokePx}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${sizePx / 2} ${sizePx / 2})`}
            style={{
              transition: 'stroke-dashoffset 300ms ease',
              filter: `drop-shadow(0 0 ${Math.max(1, strokePx * 1.15)}px color-mix(in srgb, ${color} ${Math.round(glowOpacity * 100)}%, transparent))`,
            }}
          />
        </svg>

        <span
          className="relative z-[1] flex items-center justify-center"
          style={{ width: iconPx, height: iconPx, color }}
        >
          {children}
        </span>
      </div>

    </div>
  );
};

export const TacticalPartyColumn: React.FC<TacticalPartyColumnProps> = ({
  state,
  selectedSurvivorId,
  onSelectSurvivor,
  onRestSurvivor,
  onOpenSurvivorManagement,
  onRecruitSurvivor,
}) => {
  const { survivors } = state;
  const activeSurvivor = survivors.find((s) => s.id === selectedSurvivorId) || survivors[0];
  const otherSurvivors = survivors.filter((s) => s.id !== activeSurvivor?.id).slice(0, 3);

  const getHealthStatus = (s: SurvivorState) => {
    if (s.health > 80 && s.hunger < 50 && s.thirst < 50) {
      return { text: 'Healthy', color: '#3de879' };
    }
    if (s.health > 50) return { text: 'Fair', color: '#e8c04b' };
    return { text: 'Injured', color: '#ef6868' };
  };

  const activeBox = PARTY_UI.activeCard.box;
  const activeDesign = PARTY_UI.activeCard.designSize;
  const activeCurrentSize = edgeSize(activeBox, PARTY_UI.reference);
  const activeAutoScale = clamp(
    Math.min(
      activeCurrentSize.width / activeDesign.width,
      activeCurrentSize.height / activeDesign.height,
    ) * PARTY_UI.activeCard.contentScaleMultiplier,
    PARTY_UI.activeCard.contentScaleMin,
    PARTY_UI.activeCard.contentScaleMax,
  );
  const activePx = (value: number) => value * activeAutoScale;

  const activePortraitDesignSize = edgeSize(PARTY_UI.activeCard.portrait, activeDesign);
  const activePortraitCurrentSize = {
    width: activeCurrentSize.width * (activePortraitDesignSize.width / activeDesign.width),
    height: activeCurrentSize.height * (activePortraitDesignSize.height / activeDesign.height),
  };

  return (
    <div
      className="relative w-full h-full select-none text-[#e5dbc8]"
      style={{ overflow: PARTY_UI.root.overflow }}
    >
      {/* Header icon is part of the background artwork. */}
      <span
        className="absolute uppercase pointer-events-none whitespace-nowrap"
        style={{
          ...rootBoxStyle(PARTY_UI.header.title),
          ...softTextStyle(PARTY_UI.typography.heading),
          fontSize: PARTY_UI.header.title.fontPx,
          fontWeight: PARTY_UI.header.title.weight,
          letterSpacing: `${PARTY_UI.header.title.letterSpacingEm}em`,
          lineHeight: 1,
        }}
      >
        PARTY
      </span>

      <span
        className="absolute pointer-events-none whitespace-nowrap flex items-start justify-center"
        style={{
          ...rootBoxStyle(PARTY_UI.header.count),
          ...softTextStyle(PARTY_UI.typography.body),
          fontSize: PARTY_UI.header.count.fontPx,
          fontWeight: PARTY_UI.header.count.weight,
          letterSpacing: `${PARTY_UI.header.count.letterSpacingEm}em`,
          textAlign: PARTY_UI.header.count.align,
          lineHeight: 1,
        }}
      >
        {survivors.length} / 4
      </span>

      {activeSurvivor && (
        <div
          className="absolute group overflow-hidden"
          style={{
            ...rootEdgeStyle(activeBox),
            borderRadius: activePx(PARTY_UI.activeCard.radiusPx),
          }}
          onClick={() => onSelectSurvivor(activeSurvivor.id)}
        >
          <div
            className="absolute overflow-hidden bg-[#08120f]"
            style={{
              ...childEdgeStyle(PARTY_UI.activeCard.portrait, activeDesign),
              borderRadius: activePx(PARTY_UI.activeCard.portrait.radiusPx),
              border: `${activePx(PARTY_UI.activeCard.portrait.borderPx)}px solid ${PARTY_UI.activeCard.portrait.borderColor}`,
              background: PARTY_UI.activeCard.portrait.background,
              zIndex: 1,
            }}
          >
            <div
              style={containedPortraitStyle(
                activePortraitCurrentSize.width,
                activePortraitCurrentSize.height,
                PARTY_UI.activeCard.portrait.sourceAspectRatio,
                PARTY_UI.activeCard.portrait.fitScale,
                activePx(PARTY_UI.activeCard.portrait.offsetXpx),
                activePx(PARTY_UI.activeCard.portrait.offsetYpx),
              )}
            >
              <SurvivorPortrait
                survivor={activeSurvivor}
                shape="portrait"
                showBorder={false}
                className="w-full h-full [&_img]:!w-full [&_img]:!h-full [&_img]:!object-contain [&_img]:object-center"
              />
            </div>
          </div>

          <div
            className="absolute pointer-events-none"
            style={{
              ...childEdgeStyle(PARTY_UI.activeCard.nameBackdrop, activeDesign),
              borderRadius: activePx(PARTY_UI.activeCard.nameBackdrop.radiusPx),
              background: PARTY_UI.activeCard.nameBackdrop.background,
              border: PARTY_UI.activeCard.nameBackdrop.border,
              boxShadow: PARTY_UI.activeCard.nameBackdrop.boxShadow,
              backdropFilter: `blur(${activePx(PARTY_UI.activeCard.nameBackdrop.backdropBlurPx)}px)`,
              WebkitBackdropFilter: `blur(${activePx(PARTY_UI.activeCard.nameBackdrop.backdropBlurPx)}px)`,
              zIndex: 2,
            }}
          />

          <span
            className="absolute truncate pointer-events-none"
            style={{
              ...childEdgeStyle(PARTY_UI.activeCard.name, activeDesign),
              ...simpleSoftText(
                activePx(PARTY_UI.activeCard.name.fontPx),
                PARTY_UI.activeCard.name.weight,
                '#ffffff',
                PARTY_UI.activeCard.name.letterSpacingEm,
              ),
              lineHeight: 1.05,
              zIndex: 3,
            }}
          >
            {activeSurvivor.name}
          </span>

          <span
            className="absolute truncate pointer-events-none"
            style={{
              ...childEdgeStyle(PARTY_UI.activeCard.action, activeDesign),
              ...simpleSoftText(
                activePx(PARTY_UI.activeCard.action.fontPx),
                PARTY_UI.activeCard.action.weight,
                PARTY_UI.activeCard.action.color,
                PARTY_UI.activeCard.action.letterSpacingEm,
              ),
              lineHeight: 1,
              zIndex: 3,
            }}
          >
            {activeSurvivor.currentAction?.type === 'resting' ? 'Resting' : 'Exploring'}
          </span>

          {PARTY_UI.activeCard.restButton.show && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestSurvivor(activeSurvivor.id);
              }}
              className="absolute flex items-center justify-center border border-[#355442] bg-[#0b1b15]/80 text-[#d8c99f] transition-opacity hover:text-white hover:bg-[#163125]"
              style={{
                ...childEdgeStyle(PARTY_UI.activeCard.restButton, activeDesign),
                borderRadius: activePx(PARTY_UI.activeCard.restButton.radiusPx),
                opacity: PARTY_UI.activeCard.restButton.opacityIdle,
                zIndex: 5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = String(PARTY_UI.activeCard.restButton.opacityHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = String(PARTY_UI.activeCard.restButton.opacityIdle);
              }}
              title="Nghỉ ngơi hồi sức"
              aria-label="Rest survivor"
            >
              <Bed
                style={{
                  width: activePx(PARTY_UI.activeCard.restButton.iconPx),
                  height: activePx(PARTY_UI.activeCard.restButton.iconPx),
                }}
              />
            </button>
          )}

          <div
            className="absolute grid grid-cols-3 items-center"
            style={{
              ...childEdgeStyle(PARTY_UI.activeCard.vitals, activeDesign),
              background: PARTY_UI.activeCard.vitals.background,
              borderTop: PARTY_UI.activeCard.vitals.borderTop,
              borderBottom: PARTY_UI.activeCard.vitals.borderBottom,
              paddingLeft: activePx(PARTY_UI.activeCard.vitals.horizontalPaddingPx),
              paddingRight: activePx(PARTY_UI.activeCard.vitals.horizontalPaddingPx),
              columnGap: activePx(PARTY_UI.activeCard.vitals.statGapPx),
              backdropFilter: `blur(${activePx(PARTY_UI.activeCard.vitals.backdropBlurPx)}px)`,
              WebkitBackdropFilter: `blur(${activePx(PARTY_UI.activeCard.vitals.backdropBlurPx)}px)`,
              zIndex: 4,
            }}
          >
            <CircularVital
              title="Health"
              value={activeSurvivor.health}
              color={PARTY_UI.activeCard.vitals.heartColor}
              sizePx={activePx(PARTY_UI.activeCard.vitals.ringSizePx)}
              strokePx={activePx(PARTY_UI.activeCard.vitals.ringStrokePx)}
              trackColor={PARTY_UI.activeCard.vitals.ringTrackColor}
              background={PARTY_UI.activeCard.vitals.ringBackground}
              glowOpacity={PARTY_UI.activeCard.vitals.ringGlowOpacity}
              iconPx={activePx(PARTY_UI.activeCard.vitals.iconPx)}
            >
              <Heart className="w-full h-full" fill="currentColor" />
            </CircularVital>

            <CircularVital
              title="Water"
              value={100 - activeSurvivor.thirst}
              color={PARTY_UI.activeCard.vitals.waterColor}
              sizePx={activePx(PARTY_UI.activeCard.vitals.ringSizePx)}
              strokePx={activePx(PARTY_UI.activeCard.vitals.ringStrokePx)}
              trackColor={PARTY_UI.activeCard.vitals.ringTrackColor}
              background={PARTY_UI.activeCard.vitals.ringBackground}
              glowOpacity={PARTY_UI.activeCard.vitals.ringGlowOpacity}
              iconPx={activePx(PARTY_UI.activeCard.vitals.iconPx)}
            >
              <Droplets className="w-full h-full" fill="currentColor" />
            </CircularVital>

            <CircularVital
              title="Stamina"
              value={100 - activeSurvivor.fatigue}
              color={PARTY_UI.activeCard.vitals.staminaColor}
              sizePx={activePx(PARTY_UI.activeCard.vitals.ringSizePx)}
              strokePx={activePx(PARTY_UI.activeCard.vitals.ringStrokePx)}
              trackColor={PARTY_UI.activeCard.vitals.ringTrackColor}
              background={PARTY_UI.activeCard.vitals.ringBackground}
              glowOpacity={PARTY_UI.activeCard.vitals.ringGlowOpacity}
              iconPx={activePx(PARTY_UI.activeCard.vitals.iconPx)}
            >
              <Zap className="w-full h-full" fill="currentColor" />
            </CircularVital>
          </div>

          <div
            className="absolute"
            style={{
              ...childEdgeStyle(PARTY_UI.activeCard.condition, activeDesign),
              background: PARTY_UI.activeCard.condition.background,
              paddingLeft: activePx(PARTY_UI.activeCard.condition.paddingLeftPx),
              paddingRight: activePx(PARTY_UI.activeCard.condition.paddingRightPx),
              backdropFilter: `blur(${activePx(1.5)}px)`,
              WebkitBackdropFilter: `blur(${activePx(1.5)}px)`,
              zIndex: 4,
            }}
          >
            <span
              className="absolute left-0"
              style={{
                top: activePx(PARTY_UI.activeCard.condition.labelYpx),
                marginLeft: activePx(PARTY_UI.activeCard.condition.paddingLeftPx),
                ...simpleSoftText(
                  activePx(PARTY_UI.activeCard.condition.labelFontPx),
                  PARTY_UI.activeCard.condition.labelWeight,
                  getHealthStatus(activeSurvivor).color,
                ),
                lineHeight: 1,
              }}
            >
              {getHealthStatus(activeSurvivor).text}
            </span>

            <div
              className="absolute overflow-hidden"
              style={{
                left: activePx(PARTY_UI.activeCard.condition.paddingLeftPx),
                right: activePx(PARTY_UI.activeCard.condition.paddingRightPx),
                top: activePx(PARTY_UI.activeCard.condition.barYpx),
                height: activePx(PARTY_UI.activeCard.condition.barHeightPx),
                borderRadius: activePx(PARTY_UI.activeCard.condition.barRadiusPx),
                background: PARTY_UI.activeCard.condition.barBackground,
                border: PARTY_UI.activeCard.condition.barBorder,
              }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round(activeSurvivor.health)))}%`,
                  background: PARTY_UI.activeCard.condition.barFill,
                  borderRadius: activePx(PARTY_UI.activeCard.condition.barRadiusPx),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {PARTY_UI.recruitSlots.boxes.map((slotBox, slotIndex) => {
        const survivor = otherSurvivors[slotIndex];

        if (survivor) {
          const filled = PARTY_UI.recruitSlots.filled;
          const survivorStatus = getHealthStatus(survivor);
          return (
            <button
              key={survivor.id}
              onClick={() => onSelectSurvivor(survivor.id)}
              className="absolute overflow-hidden text-left transition-colors"
              style={{
                ...rootBoxStyle(slotBox),
                background: 'transparent',
                borderRadius: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = filled.hoverBackground;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                className="absolute overflow-hidden"
                style={{
                  ...childBoxStyle(filled.portrait, slotBox),
                  borderRadius: filled.portrait.radiusPx,
                  border: `${filled.portrait.borderPx}px solid ${filled.portrait.borderColor}`,
                  background: filled.portrait.background,
                }}
              >
                <div
                  style={containedPortraitStyle(
                    filled.portrait.w,
                    filled.portrait.h,
                    filled.portrait.sourceAspectRatio,
                    filled.portrait.fitScale,
                    filled.portrait.offsetXpx,
                    filled.portrait.offsetYpx,
                  )}
                >
                  <SurvivorPortrait
                    survivor={survivor}
                    shape="portrait"
                    showBorder={false}
                    className="w-full h-full [&_img]:!w-full [&_img]:!h-full [&_img]:!object-contain [&_img]:object-center"
                  />
                </div>
              </div>

              <div
                className="absolute pointer-events-none"
                style={{
                  ...childBoxStyle(filled.nameBackdrop, slotBox),
                  borderRadius: filled.nameBackdrop.radiusPx,
                  background: filled.nameBackdrop.background,
                  border: filled.nameBackdrop.border,
                  boxShadow: filled.nameBackdrop.boxShadow,
                  backdropFilter: `blur(${filled.nameBackdrop.backdropBlurPx}px)`,
                  WebkitBackdropFilter: `blur(${filled.nameBackdrop.backdropBlurPx}px)`,
                }}
              />

              <span
                className="absolute truncate"
                style={{
                  ...childBoxStyle(filled.name, slotBox),
                  ...simpleSoftText(filled.name.fontPx, filled.name.weight, '#f6ead6'),
                }}
              >
                {survivor.name}
              </span>

              <span
                className="absolute truncate"
                style={{
                  ...childBoxStyle(filled.role, slotBox),
                  ...simpleSoftText(filled.role.fontPx, filled.role.weight, '#58d77b'),
                }}
              >
                {survivor.currentAction?.type === 'resting' ? 'Resting' : survivor.role || 'Exploring'}
              </span>

              <div
                className="absolute grid grid-cols-3 items-center"
                style={{
                  ...childBoxStyle(filled.statsPanel, slotBox),
                  borderRadius: filled.statsPanel.radiusPx,
                  background: filled.statsPanel.background,
                  border: filled.statsPanel.border,
                  paddingLeft: filled.statsPanel.rowPaddingPx,
                  paddingRight: filled.statsPanel.rowPaddingPx,
                  columnGap: filled.statsPanel.statGapPx,
                  backdropFilter: `blur(${filled.statsPanel.backdropBlurPx}px)`,
                  WebkitBackdropFilter: `blur(${filled.statsPanel.backdropBlurPx}px)`,
                }}
              >
                <CircularVital
                  title="Health"
                  value={survivor.health}
                  color={filled.statsPanel.heartColor}
                  sizePx={filled.statsPanel.ringSizePx}
                  strokePx={filled.statsPanel.ringStrokePx}
                  trackColor={filled.statsPanel.ringTrackColor}
                  background={filled.statsPanel.ringBackground}
                  glowOpacity={filled.statsPanel.ringGlowOpacity}
                  iconPx={filled.statsPanel.iconPx}
                >
                  <Heart className="w-full h-full" fill="currentColor" />
                </CircularVital>

                <CircularVital
                  title="Water"
                  value={100 - survivor.thirst}
                  color={filled.statsPanel.waterColor}
                  sizePx={filled.statsPanel.ringSizePx}
                  strokePx={filled.statsPanel.ringStrokePx}
                  trackColor={filled.statsPanel.ringTrackColor}
                  background={filled.statsPanel.ringBackground}
                  glowOpacity={filled.statsPanel.ringGlowOpacity}
                  iconPx={filled.statsPanel.iconPx}
                >
                  <Droplets className="w-full h-full" fill="currentColor" />
                </CircularVital>

                <CircularVital
                  title="Stamina"
                  value={100 - survivor.fatigue}
                  color={filled.statsPanel.staminaColor}
                  sizePx={filled.statsPanel.ringSizePx}
                  strokePx={filled.statsPanel.ringStrokePx}
                  trackColor={filled.statsPanel.ringTrackColor}
                  background={filled.statsPanel.ringBackground}
                  glowOpacity={filled.statsPanel.ringGlowOpacity}
                  iconPx={filled.statsPanel.iconPx}
                >
                  <Zap className="w-full h-full" fill="currentColor" />
                </CircularVital>
              </div>

              <span
                className="absolute truncate"
                style={{
                  ...childBoxStyle(filled.conditionLabel, slotBox),
                  ...simpleSoftText(filled.conditionLabel.fontPx, filled.conditionLabel.weight, survivorStatus.color),
                }}
              >
                {survivorStatus.text}
              </span>

              <div
                className="absolute overflow-hidden"
                style={{
                  ...childBoxStyle(filled.healthBar, slotBox),
                  borderRadius: filled.healthBar.radiusPx,
                  background: filled.healthBar.background,
                  border: filled.healthBar.border,
                }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round(survivor.health)))}%`,
                    borderRadius: filled.healthBar.radiusPx,
                    background: filled.healthBar.fill,
                  }}
                />
              </div>
            </button>
          );
        }

        const empty = PARTY_UI.recruitSlots.empty;
        return (
          <button
            key={`empty_slot_${slotIndex}`}
            onClick={() => {
              if (onRecruitSurvivor) {
                onRecruitSurvivor();
              } else {
                onOpenSurvivorManagement();
              }
            }}
            className="absolute transition-colors group cursor-pointer"
            style={{
              ...rootBoxStyle(slotBox),
              background: 'transparent',
              borderRadius: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = empty.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Chiêu mộ thêm người sống sót (English Pool)"
          >
            <div
              className="absolute flex items-center justify-center"
              style={{
                ...childBoxStyle(empty.plusCircle, slotBox),
                borderRadius: `${empty.plusCircle.radiusPercent}%`,
                border: empty.plusCircle.border,
                background: empty.plusCircle.background,
              }}
            >
              <Plus
                style={{
                  width: empty.plusCircle.plusPx,
                  height: empty.plusCircle.plusPx,
                  strokeWidth: empty.plusCircle.plusStrokeWidth,
                  color: empty.plusCircle.plusColor,
                }}
              />
            </div>

            <span
              className="absolute flex items-start justify-center whitespace-nowrap"
              style={{
                ...childBoxStyle(empty.label, slotBox),
                ...simpleSoftText(
                  empty.label.fontPx,
                  empty.label.weight,
                  empty.label.color,
                  empty.label.letterSpacingEm,
                ),
                lineHeight: 1,
                textAlign: 'center',
              }}
            >
              Recruit Survivor
            </span>
          </button>
        );
      })}

      <div
        className="absolute pointer-events-none select-none"
        style={{
          ...rootBoxStyle(PARTY_UI.quote),
          fontFamily: PARTY_UI.quote.fontFamily,
          color: PARTY_UI.quote.color,
          filter: `blur(${PARTY_UI.quote.blurPx}px)`,
          textShadow: PARTY_UI.quote.shadow,
          transform: `rotate(${PARTY_UI.quote.rotateDeg}deg)`,
          transformOrigin: 'center',
        }}
      >
        <span
          className="absolute italic"
          style={{
            ...childBoxStyle(PARTY_UI.quote.a, PARTY_UI.quote),
            fontSize: PARTY_UI.quote.a.fontPx,
            fontWeight: PARTY_UI.quote.a.weight,
            lineHeight: 1,
          }}
        >
          A
        </span>
        <span
          className="absolute italic"
          style={{
            ...childBoxStyle(PARTY_UI.quote.wilder, PARTY_UI.quote),
            fontSize: PARTY_UI.quote.wilder.fontPx,
            fontWeight: PARTY_UI.quote.wilder.weight,
            lineHeight: 1,
          }}
        >
          Wilder
        </span>
        <span
          className="absolute italic"
          style={{
            ...childBoxStyle(PARTY_UI.quote.tomorrow, PARTY_UI.quote),
            fontSize: PARTY_UI.quote.tomorrow.fontPx,
            fontWeight: PARTY_UI.quote.tomorrow.weight,
            lineHeight: 1,
          }}
        >
          Tomorrow
        </span>
      </div>
    </div>
  );
};
