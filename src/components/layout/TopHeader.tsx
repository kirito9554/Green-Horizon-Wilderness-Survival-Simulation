import React, { useState } from 'react';
import { Pause, Save, Wrench, RotateCcw } from 'lucide-react';
import { GameState } from '../../types';

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

/**
 * ================================================================
 * HEADER UI TUNING
 * ================================================================
 * Tọa độ pixel đối chiếu với tỷ lệ ảnh reference 1586 x 110 px.
 */
export const HEADER_UI = {
  reference: {
    width: 1586,
    height: 110,
  },

  actionButtons: {
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

const boxStyle = (box: Box): React.CSSProperties => ({
  left: toPercentX(box.x),
  top: toPercentY(box.y),
  width: toPercentX(box.w),
  height: toPercentY(box.h),
});

export const TopHeader: React.FC<TopHeaderProps> = ({
  state,
  onSetSpeed,
  onOpenSaveModal,
  onToggleDevPanel,
  onResetGame,
}) => {
  const { gameTime } = state;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const dropdown = HEADER_UI.dropdown;

  return (
    <header className="relative w-full h-full text-[#ecd9b5] select-none z-30 pointer-events-none">
      {/* 3. Right Action Buttons: Fullscreen & Game Menu */}
      {/* Fullscreen button overlay */}
      <button
        onClick={handleToggleFullscreen}
        className="absolute pointer-events-auto hover:bg-white/10 active:bg-white/20 active:scale-[0.985] transition-all cursor-pointer ring-0 hover:ring-1 hover:ring-emerald-400/40"
        style={{
          ...boxStyle(HEADER_UI.actionButtons.fullscreen.box),
          borderRadius: `${HEADER_UI.actionButtons.fullscreen.radius}px`,
        }}
        title="Bật/Tắt toàn màn hình (Fullscreen)"
        aria-label="Fullscreen"
      />

      {/* Game Menu overlay + dropdown anchor */}
      <div
        className="absolute pointer-events-auto"
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
                  className={`font-serif font-bold flex items-center justify-center cursor-pointer transition-all border ${
                    gameTime.speed === 0
                      ? 'bg-[#6b3c1a] border-[#b87333] text-[#faedd9] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]'
                      : 'bg-[#181109] border-[#382617] text-[#a18a6e] hover:text-[#faeed8] hover:border-[#52371f]'
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
                    className={`font-serif font-bold flex items-center justify-center cursor-pointer transition-all border ${
                      gameTime.speed === speed
                        ? 'bg-[#2a593e] border-[#52b788] text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]'
                        : 'bg-[#181109] border-[#382617] text-[#a18a6e] hover:text-[#faeed8] hover:border-[#52371f]'
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
