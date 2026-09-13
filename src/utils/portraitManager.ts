import type { CSSProperties } from 'react';

/**
 * Portrait Manager for Green Horizon: Tropical Survival Colony
 * Handles the 20-character portrait sprite sheet (4 rows x 5 columns) in /portraits/portrait.png
 * Sheet dimensions: 1145px x 1374px -> cell size: 229px x 343.5px (Aspect ratio: 2:3)
 */

export const PORTRAIT_CONFIG = {
  cols: 5,
  rows: 4,
  total: 20,
  cellWidth: 229,
  cellHeight: 343.5,
  aspectRatio: 2 / 3, // width:height = 2:3
  sheetUrl: '/portraits/portrait.png',
};

// Default mapping for known survivors
export const SURVIVOR_PORTRAIT_MAP: Record<string, number> = {
  SURVIVOR_ALEX: 0,
  SURVIVOR_LINH: 1,
  SURVIVOR_DAVID: 2,
  SURVIVOR_MAYA: 3,
};

/**
 * Returns a stable portrait index (0..19) for any survivor
 */
export function getSurvivorPortraitIndex(survivor?: { id?: string; portraitIndex?: number }): number {
  if (survivor?.portraitIndex !== undefined && survivor.portraitIndex >= 0 && survivor.portraitIndex < PORTRAIT_CONFIG.total) {
    return survivor.portraitIndex;
  }
  if (survivor?.id && SURVIVOR_PORTRAIT_MAP[survivor.id] !== undefined) {
    return SURVIVOR_PORTRAIT_MAP[survivor.id];
  }
  if (survivor?.id) {
    // Generate deterministic index from id string
    let hash = 0;
    for (let i = 0; i < survivor.id.length; i++) {
      hash = (hash * 31 + survivor.id.charCodeAt(i)) >>> 0;
    }
    return hash % PORTRAIT_CONFIG.total;
  }
  return 0;
}

/**
 * Returns the CSS styles for displaying a specific portrait index from the sprite sheet
 */
export function getPortraitStyle(
  portraitIndex: number,
  mode: 'full' | 'headshot' = 'full'
): CSSProperties {
  const safeIndex = Math.max(0, Math.min(PORTRAIT_CONFIG.total - 1, portraitIndex || 0));
  const col = safeIndex % PORTRAIT_CONFIG.cols;
  const row = Math.floor(safeIndex / PORTRAIT_CONFIG.cols);

  // Background position percentages for standard CSS sprites
  const xPercent = (col / (PORTRAIT_CONFIG.cols - 1)) * 100;
  const yPercent = (row / (PORTRAIT_CONFIG.rows - 1)) * 100;

  if (mode === 'headshot') {
    // Zoom slightly into upper chest and head
    return {
      backgroundImage: `url("${PORTRAIT_CONFIG.sheetUrl}")`,
      backgroundSize: `${PORTRAIT_CONFIG.cols * 100}% ${PORTRAIT_CONFIG.rows * 100}%`,
      backgroundPosition: `${xPercent}% ${yPercent}%`,
      backgroundRepeat: 'no-repeat',
    };
  }

  return {
    backgroundImage: `url("${PORTRAIT_CONFIG.sheetUrl}")`,
    backgroundSize: `${PORTRAIT_CONFIG.cols * 100}% ${PORTRAIT_CONFIG.rows * 100}%`,
    backgroundPosition: `${xPercent}% ${yPercent}%`,
    backgroundRepeat: 'no-repeat',
  };
}
