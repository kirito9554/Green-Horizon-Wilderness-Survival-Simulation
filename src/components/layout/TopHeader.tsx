import React, { useState } from 'react';
import { Pause, Save, Wrench, RotateCcw } from 'lucide-react';
import { GameState, InventoryItem } from '../../types';
import { ITEMS_DATABASE } from '../../data/items';

interface TopHeaderProps {
  state: GameState;
  onSetSpeed: (speed: 0 | 1 | 2 | 4) => void;
  onOpenSaveModal: () => void;
  onToggleDevPanel: () => void;
  onResetGame: () => void;
}

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type ResourceKey =
  | 'food'
  | 'water'
  | 'wood'
  | 'stone'
  | 'fiber'
  | 'leaves'
  | 'rope'
  | 'medicine'
  | 'firewood';

/**
 * ================================================================
 * HEADER UI TUNING
 * ================================================================
 * Chỉnh vị trí / kích thước / font ở đây.
 * Tất cả x, y, w, h đều tính theo ảnh reference 1586 x 110 px.
 * JSX phía dưới không còn chứa các con số layout quan trọng.
 */
const HEADER_UI = {
  reference: {
    width: 1586,
    height: 110,
  },

  logoHotspot: {
    x: 0,
    y: 0,
    w: 301,
    h: 110,
  } satisfies Box,

  resources: {
    // Typography dùng chung cho 9 resource.
    typography: {
      fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
      label: {
        y: 32,
        h: 12,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.015em',
        color: '#d7c8ad',
        textShadow: '0 1px 2px rgba(0,0,0,0.95)',
      },
      value: {
        y: 50,
        h: 19,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '0.005em',
        color: '#f5eee2',
        textShadow: '0 1px 2px rgba(0,0,0,1)',
      },
      campValue: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.005em',
        color: '#fbbf24', // Màu vàng ấm sáng (amber gold), hiển thị số trong kho trại chính
        textShadow: '0 1px 2px rgba(0,0,0,1)',
      },
    },

    // segment = vùng hover/tính theo hai vạch ngăn.
    // textX/textW = vùng thực tế dành cho chữ, đã né icon phía trái.
    items: [
      {
        key: 'food' as const,
        label: 'FOOD',
        title: 'Lương thực (Food)',
        segment: { x: 312, y: 0, w: 106, h: 110 },
        textX: 355,
        textW: 58,
      },
      {
        key: 'water' as const,
        label: 'WATER',
        title: 'Nước ngọt (Water)',
        segment: { x: 418, y: 0, w: 101, h: 110 },
        textX: 462,
        textW: 53,
      },
      {
        key: 'wood' as const,
        label: 'WOOD',
        title: 'Gỗ & Tre (Wood)',
        segment: { x: 519, y: 0, w: 99, h: 110 },
        textX: 565,
        textW: 49,
      },
      {
        key: 'stone' as const,
        label: 'STONE',
        title: 'Đá suối (Stone)',
        segment: { x: 618, y: 0, w: 100, h: 110 },
        textX: 666,
        textW: 48,
      },
      {
        key: 'fiber' as const,
        label: 'FIBER',
        title: 'Sợi dây leo (Fiber)',
        segment: { x: 718, y: 0, w: 100, h: 110 },
        textX: 771,
        textW: 44,
      },
      {
        key: 'leaves' as const,
        label: 'LEAVES',
        title: 'Lá cọ (Leaves)',
        segment: { x: 818, y: 0, w: 104, h: 110 },
        textX: 866,
        textW: 52,
      },
      {
        key: 'rope' as const,
        label: 'ROPE',
        title: 'Dây thừng (Rope)',
        segment: { x: 922, y: 0, w: 94, h: 110 },
        textX: 971,
        textW: 42,
      },
      {
        key: 'medicine' as const,
        label: 'MEDICINE',
        title: 'Dược liệu (Medicine)',
        segment: { x: 1016, y: 0, w: 119, h: 110 },
        textX: 1073,
        textW: 58,
      },
      {
        key: 'firewood' as const,
        label: 'FIREWOOD',
        title: 'Củi đốt (Firewood)',
        segment: { x: 1135, y: 0, w: 113, h: 110 },
        textX: 1188,
        textW: 58,
      },
    ],
  },

  actionButtons: {
    // Vùng overlay nằm trên hai button đã được vẽ sẵn trong background.
    fullscreen: {
      box: { x: 1283, y: 39, w: 118, h: 44 } satisfies Box,
      radius: 7,
    },
    gameMenu: {
      box: { x: 1413, y: 38, w: 135, h: 44 } satisfies Box,
      radius: 7,
    },
  },

  dropdown: {
    width: 224,
    topGap: 8,
    padding: 8,
    gap: 8,
    radius: 6,
    borderWidth: 2,

    speedSection: {
      paddingBottom: 8,
      labelFontSize: 10,
      labelMarginBottom: 4,
      labelPaddingX: 4,
      buttonGap: 4,
      buttonPaddingY: 4,
      buttonFontSize: 12,
      buttonRadius: 4,
      pauseIconSize: 12,
    },

    actionRow: {
      paddingX: 8,
      paddingY: 6,
      fontSize: 12,
      gap: 8,
      radius: 4,
      iconSize: 14,
      resetPaddingTop: 8,
    },
  },
} as const;

const toPercentX = (px: number) => `${(px / HEADER_UI.reference.width) * 100}%`;
const toPercentY = (px: number) => `${(px / HEADER_UI.reference.height) * 100}%`;

// IMPORTANT: percentages on children are relative to their parent segment,
// not to the full 1586 px header. Resource textX/textW are stored in
// reference-header pixels, so convert them against the segment width here.
const toLocalPercentX = (px: number, parentWidth: number) => `${(px / parentWidth) * 100}%`;

const boxStyle = (box: Box): React.CSSProperties => ({
  left: toPercentX(box.x),
  top: toPercentY(box.y),
  width: toPercentX(box.w),
  height: toPercentY(box.h),
});

const countResources = (items: InventoryItem[] = []): Record<ResourceKey, number> => {
  let food = 0;
  let water = 0;
  let wood = 0;
  let stone = 0;
  let fiber = 0;
  let leaves = 0;
  let rope = 0;
  let medicine = 0;
  let firewood = 0;

  for (const item of items) {
    const def = ITEMS_DATABASE[item.itemId];
    if (!def) continue;

    if (def.category === 'food') food += item.quantity;
    if (def.category === 'water' || def.tags.includes('drinkable')) water += item.quantity;
    if (def.tags.includes('wood') || def.tags.includes('bamboo') || def.tags.includes('pole')) wood += item.quantity;
    if (def.tags.includes('stone') || def.tags.includes('tool_head')) stone += item.quantity;
    if (def.tags.includes('fiber') || def.tags.includes('binding') || def.tags.includes('weaving')) fiber += item.quantity;
    if (def.tags.includes('leaf') || def.tags.includes('roofing')) leaves += item.quantity;
    if (def.tags.includes('rope') || def.id === 'ITEM_CORD_ROPE') rope += item.quantity;
    if (def.category === 'medicine' || def.tags.includes('medicine') || def.tags.includes('healing')) medicine += item.quantity;
    if (def.tags.includes('fuel') || def.tags.includes('tinder') || def.tags.includes('charcoal')) firewood += item.quantity;
  }

  return {
    food,
    water,
    wood,
    stone,
    fiber,
    leaves,
    rope,
    medicine,
    firewood,
  };
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  state,
  onSetSpeed,
  onOpenSaveModal,
  onToggleDevPanel,
  onResetGame,
}) => {
  const { gameTime, inventory } = state;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Kho trại chính (Camp Clearing)
  const campStorage =
    state.poiStorages?.['AREA_CAMP_CLEARING'] ||
    state.poiStorages?.['base-camp'] ||
    Object.entries(state.poiStorages || {}).find(([k]) => k.toLowerCase().includes('camp'))?.[1];

  const partyResourceValues = countResources(inventory.items);
  const campResourceValues = countResources(campStorage?.items || []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const resourceTypography = HEADER_UI.resources.typography;
  const dropdown = HEADER_UI.dropdown;

  return (
    <header className="relative w-full h-full text-[#ecd9b5] select-none z-30">
      {/* Logo / title hotspot */}
      <div
        className="absolute cursor-pointer"
        style={boxStyle(HEADER_UI.logoHotspot)}
        title="Green Horizon: Survive • Explore • Belong"
      />

      {/* 9 dynamic resource labels + values */}
      {HEADER_UI.resources.items.map((resource) => (
        <div
          key={resource.key}
          className="absolute pointer-events-auto"
          style={boxStyle(resource.segment)}
          title={`${resource.title}\n• Túi đồ Party: ${partyResourceValues[resource.key]}\n• Kho trại chính: ${campResourceValues[resource.key]}`}
        >
          <span
            className="absolute text-center whitespace-nowrap uppercase leading-none"
            style={{
              left: toLocalPercentX(resource.textX - resource.segment.x, resource.segment.w),
              top: toPercentY(resourceTypography.label.y),
              width: toLocalPercentX(resource.textW, resource.segment.w),
              height: toPercentY(resourceTypography.label.h),
              fontFamily: resourceTypography.fontFamily,
              fontSize: `${resourceTypography.label.fontSize}px`,
              fontWeight: resourceTypography.label.fontWeight,
              letterSpacing: resourceTypography.label.letterSpacing,
              color: resourceTypography.label.color,
              textShadow: resourceTypography.label.textShadow,
            }}
          >
            {resource.label}
          </span>

          <div
            className="absolute flex items-baseline justify-center whitespace-nowrap leading-none tabular-nums"
            style={{
              left: toLocalPercentX(resource.textX - resource.segment.x, resource.segment.w),
              top: toPercentY(resourceTypography.value.y),
              width: toLocalPercentX(resource.textW, resource.segment.w),
              height: toPercentY(resourceTypography.value.h),
              fontFamily: resourceTypography.fontFamily,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{
                fontSize: `${resourceTypography.value.fontSize}px`,
                fontWeight: resourceTypography.value.fontWeight,
                letterSpacing: resourceTypography.value.letterSpacing,
                color: resourceTypography.value.color,
                textShadow: resourceTypography.value.textShadow,
              }}
            >
              {partyResourceValues[resource.key]}
            </span>
            <span
              style={{
                fontSize: `${resourceTypography.campValue.fontSize}px`,
                fontWeight: resourceTypography.campValue.fontWeight,
                letterSpacing: resourceTypography.campValue.letterSpacing,
                color: resourceTypography.campValue.color,
                textShadow: resourceTypography.campValue.textShadow,
                marginLeft: '1px',
              }}
            >
              ({campResourceValues[resource.key]})
            </span>
          </div>
        </div>
      ))}

      {/* Fullscreen overlay */}
      <button
        onClick={handleToggleFullscreen}
        className="absolute hover:bg-white/10 active:bg-white/20 active:scale-[0.985] transition-all cursor-pointer ring-0 hover:ring-1 hover:ring-emerald-400/40"
        style={{
          ...boxStyle(HEADER_UI.actionButtons.fullscreen.box),
          borderRadius: `${HEADER_UI.actionButtons.fullscreen.radius}px`,
        }}
        title="Bật/Tắt toàn màn hình (Fullscreen)"
        aria-label="Fullscreen"
      />

      {/* Game Menu overlay + dropdown anchor */}
      <div
        className="absolute"
        style={boxStyle(HEADER_UI.actionButtons.gameMenu.box)}
      >
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-full h-full transition-all cursor-pointer active:scale-[0.985] ${
            isMenuOpen
              ? 'bg-white/15 ring-1 ring-emerald-400/60 shadow-inner'
              : 'hover:bg-white/10 hover:ring-1 hover:ring-emerald-400/40'
          }`}
          style={{ borderRadius: `${HEADER_UI.actionButtons.gameMenu.radius}px` }}
          title="Mở menu trò chơi (Game Menu)"
          aria-label="Game Menu"
        />

        {isMenuOpen && (
          <div
            className="absolute right-0 top-full bg-[#18110a]/95 border-[#4a3622] shadow-[0_8px_24px_rgba(0,0,0,0.95)] z-50 flex flex-col backdrop-blur-md animate-in fade-in"
            style={{
              marginTop: `${dropdown.topGap}px`,
              width: `${dropdown.width}px`,
              padding: `${dropdown.padding}px`,
              gap: `${dropdown.gap}px`,
              borderRadius: `${dropdown.radius}px`,
              borderWidth: `${dropdown.borderWidth}px`,
            }}
            onMouseLeave={() => setIsMenuOpen(false)}
          >
            {/* Simulation Speed Row */}
            <div
              className="border-b border-[#382819]"
              style={{ paddingBottom: `${dropdown.speedSection.paddingBottom}px` }}
            >
              <div
                className="uppercase font-bold text-[#9e8362]"
                style={{
                  fontSize: `${dropdown.speedSection.labelFontSize}px`,
                  marginBottom: `${dropdown.speedSection.labelMarginBottom}px`,
                  paddingLeft: `${dropdown.speedSection.labelPaddingX}px`,
                  paddingRight: `${dropdown.speedSection.labelPaddingX}px`,
                }}
              >
                Tốc độ giả lập
              </div>

              <div
                className="grid grid-cols-4"
                style={{ gap: `${dropdown.speedSection.buttonGap}px` }}
              >
                <button
                  onClick={() => onSetSpeed(0)}
                  className={`font-mono font-bold flex items-center justify-center ${
                    gameTime.speed === 0 ? 'bg-amber-600 text-white' : 'bg-[#22170e] text-[#a89274] hover:text-white'
                  }`}
                  style={{
                    paddingTop: `${dropdown.speedSection.buttonPaddingY}px`,
                    paddingBottom: `${dropdown.speedSection.buttonPaddingY}px`,
                    fontSize: `${dropdown.speedSection.buttonFontSize}px`,
                    borderRadius: `${dropdown.speedSection.buttonRadius}px`,
                  }}
                >
                  <Pause
                    style={{
                      width: `${dropdown.speedSection.pauseIconSize}px`,
                      height: `${dropdown.speedSection.pauseIconSize}px`,
                    }}
                  />
                </button>

                {[1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => onSetSpeed(speed as 1 | 2 | 4)}
                    className={`font-mono font-bold flex items-center justify-center ${
                      gameTime.speed === speed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#22170e] text-[#a89274] hover:text-white'
                    }`}
                    style={{
                      paddingTop: `${dropdown.speedSection.buttonPaddingY}px`,
                      paddingBottom: `${dropdown.speedSection.buttonPaddingY}px`,
                      fontSize: `${dropdown.speedSection.buttonFontSize}px`,
                      borderRadius: `${dropdown.speedSection.buttonRadius}px`,
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Save / Load */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onOpenSaveModal();
              }}
              className="w-full text-left hover:bg-[#281b10] text-[#e0cfb2] flex items-center transition-colors cursor-pointer"
              style={{
                paddingLeft: `${dropdown.actionRow.paddingX}px`,
                paddingRight: `${dropdown.actionRow.paddingX}px`,
                paddingTop: `${dropdown.actionRow.paddingY}px`,
                paddingBottom: `${dropdown.actionRow.paddingY}px`,
                fontSize: `${dropdown.actionRow.fontSize}px`,
                gap: `${dropdown.actionRow.gap}px`,
                borderRadius: `${dropdown.actionRow.radius}px`,
              }}
            >
              <Save
                className="text-amber-400 shrink-0"
                style={{ width: dropdown.actionRow.iconSize, height: dropdown.actionRow.iconSize }}
              />
              <span>Save / Load Game</span>
            </button>

            {/* Developer Sandbox */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onToggleDevPanel();
              }}
              className="w-full text-left hover:bg-[#281b10] text-[#e0cfb2] flex items-center transition-colors cursor-pointer"
              style={{
                paddingLeft: `${dropdown.actionRow.paddingX}px`,
                paddingRight: `${dropdown.actionRow.paddingX}px`,
                paddingTop: `${dropdown.actionRow.paddingY}px`,
                paddingBottom: `${dropdown.actionRow.paddingY}px`,
                fontSize: `${dropdown.actionRow.fontSize}px`,
                gap: `${dropdown.actionRow.gap}px`,
                borderRadius: `${dropdown.actionRow.radius}px`,
              }}
            >
              <Wrench
                className="text-sky-400 shrink-0"
                style={{ width: dropdown.actionRow.iconSize, height: dropdown.actionRow.iconSize }}
              />
              <span>Developer Sandbox</span>
            </button>

            {/* Reset Game */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onResetGame();
              }}
              className="w-full text-left hover:bg-[#381616] text-rose-300 flex items-center transition-colors cursor-pointer border-t border-[#382819]"
              style={{
                paddingLeft: `${dropdown.actionRow.paddingX}px`,
                paddingRight: `${dropdown.actionRow.paddingX}px`,
                paddingTop: `${dropdown.actionRow.resetPaddingTop}px`,
                paddingBottom: `${dropdown.actionRow.paddingY}px`,
                fontSize: `${dropdown.actionRow.fontSize}px`,
                gap: `${dropdown.actionRow.gap}px`,
                borderRadius: `${dropdown.actionRow.radius}px`,
              }}
            >
              <RotateCcw
                className="text-rose-400 shrink-0"
                style={{ width: dropdown.actionRow.iconSize, height: dropdown.actionRow.iconSize }}
              />
              <span>Restart Game (Chơi lại)</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
