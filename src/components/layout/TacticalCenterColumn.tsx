import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Info,
  Droplet,
  Utensils,
  Flame,
  Compass,
  Leaf,
  Waves,
  Flower2,
  Hammer,
  Mountain,
  Wrench,
  ShieldAlert,
  Thermometer,
  Clock,
} from 'lucide-react';
import { GameState, AreaDefinition, InventoryItem } from '../../types';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';
import { preloadImage, preloadImages } from '../../utils/imageCache';
import { 
  getFreshnessStage, 
  FRESHNESS_CONFIG, 
  getConditionStage, 
  CONDITION_CONFIG, 
  getDominantQuality, 
  QUALITY_CONFIG 
} from '../../utils/qualityUtils';
import { analyzeItemSpoilage } from '../../simulation/itemSimulation';

interface TacticalCenterColumnProps {
  state: GameState;
  selectedArea: AreaDefinition;
  onOpenManageCamp: () => void;
  onOpenInspectLocation: () => void;
  onConsumeItem: (instanceId: string) => void;
  onDiscardItem: (instanceId: string, qty: number) => void;
  onQuickGather: (nodeId: string) => void;
  onRepairItem?: (instanceId: string) => void;
  onUnloadToPoiStorage?: (areaId: string) => void;
}

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';


/**
 * =============================================================================
 * SELECTED LOCATION - POI CARD ASSETS
 * =============================================================================
 * Files live in: public/poi-card/
 * Vite serves files inside /public from the site root, so runtime URLs start
 * with /poi-card/... rather than /public/poi-card/....
 *
 * The cards were re-cropped from the updated 6 x 3 sheet using the real dark gutters,
 * so every card keeps its full left/right frame. Native sizes vary slightly by row
 * (~324 x 227-233 px), and the preview uses object-contain to avoid any extra crop.
 * Add/change aliases here if an AreaDefinition uses another display name/id.
 * =============================================================================
 */
const POI_CARD_UI = {
  basePath: '/poi-card',
  aspectRatio: 324 / 229,
  fallbackFile: '08_base-camp.png',

  // Exact / common display-name aliases -> cropped card file.
  byName: {
    'waterfall basin': '01_waterfall-basin.png',
    'waterfall': '01_waterfall-basin.png',
    'ancient ruins': '02_ancient-ruins.png',
    'stone ridge': '03_stone-ridge.png',
    'hill lookout': '04_hill-lookout.png',
    'bamboo grove': '05_bamboo-grove.png',
    'kapok grove': '06_kapok-grove.png',
    'clay pit': '07_clay-pit.png',
    'base camp': '08_base-camp.png',
    'camp clearing': '08_base-camp.png',
    'jungle trail': '09_jungle-trail.png',
    'abandoned hut': '10_abandoned-hut.png',
    'medicinal glade': '11_medicinal-glade.png',
    'forest edge': '12_forest-edge.png',
    'foraging grounds': '13_foraging-grounds.png',
    'foraging area': '13_foraging-grounds.png',
    'mangrove edge': '14_mangrove-edge.png',
    'wildlife nest': '15_wildlife-nest.png',
    'swamp crossing': '16_swamp-crossing.png',
    'cave entrance': '17_cave-entrance.png',
    'fishing lagoon': '18_fishing-lagoon.png',
  } as Record<string, string>,

  // Optional ID fragments. These make the mapping survive renamed UI labels.
  byIdFragment: {
    waterfall: '01_waterfall-basin.png',
    ruin: '02_ancient-ruins.png',
    stone: '03_stone-ridge.png',
    lookout: '04_hill-lookout.png',
    bamboo: '05_bamboo-grove.png',
    kapok: '06_kapok-grove.png',
    clay: '07_clay-pit.png',
    camp: '08_base-camp.png',
    trail: '09_jungle-trail.png',
    abandoned: '10_abandoned-hut.png',
    hut: '10_abandoned-hut.png',
    medicinal: '11_medicinal-glade.png',
    medicine: '11_medicinal-glade.png',
    forest: '12_forest-edge.png',
    foraging: '13_foraging-grounds.png',
    mangrove: '14_mangrove-edge.png',
    wildlife: '15_wildlife-nest.png',
    nest: '15_wildlife-nest.png',
    swamp: '16_swamp-crossing.png',
    cave: '17_cave-entrance.png',
    fishing: '18_fishing-lagoon.png',
    lagoon: '18_fishing-lagoon.png',
  } as Record<string, string>,
} as const;

const normalizePoiKey = (value: string | undefined) =>
  (value || '')
    .toLocaleLowerCase('en')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getPoiCardUrl = (area: AreaDefinition): string => {
  const nameKey = normalizePoiKey(area.name);
  const exactByName = POI_CARD_UI.byName[nameKey];
  if (exactByName) return `${POI_CARD_UI.basePath}/${exactByName}`;

  const idKey = normalizePoiKey(area.id);
  for (const [fragment, file] of Object.entries(POI_CARD_UI.byIdFragment)) {
    if (nameKey.includes(fragment) || idKey.includes(fragment)) {
      return `${POI_CARD_UI.basePath}/${file}`;
    }
  }

  return `${POI_CARD_UI.basePath}/${POI_CARD_UI.fallbackFile}`;
};

// Preload each physical POI card only once even when it has multiple aliases above.
const ALL_POI_CARD_URLS = Array.from(
  new Set([
    ...Object.values(POI_CARD_UI.byName),
    ...Object.values(POI_CARD_UI.byIdFragment),
    POI_CARD_UI.fallbackFile,
  ]),
).map((file) => `${POI_CARD_UI.basePath}/${file}`);

/**
 * ============================================================================
 * UI TUNING AREA
 * ============================================================================
 * Chỉnh gần như toàn bộ vị trí/kích thước của cột giữa tại đây.
 *
 * - Các giá trị POSITION / SIZE mặc định là % của section cha.
 * - Các giá trị có hậu tố Px là pixel.
 * - Không cần tìm class Tailwind bên dưới để căn lại UI.
 * ============================================================================
 */
const UI = {
  root: {
    paddingPx: 4,
  },

  // Shared typography for all live text rendered over the raster UI background.
  // The subtle blur/opacity makes browser text sit closer to the slightly softened
  // lettering baked into the AI-generated buttons and panel artwork.
  typography: {
    fontFamily: UI_FONT,
    heading: {
      fontWeight: 700,
      letterSpacingEm: 0.025,
      lineHeight: 1,
      color: '#efe3cf',
      opacity: 0.96,
      softBlurPx: 0.16,
      textShadow: '0 1px 1px rgba(0,0,0,0.88), 0 0 0.45px rgba(244,232,209,0.34)',
    },
    body: {
      fontWeight: 400,
      letterSpacingEm: 0.005,
      lineHeight: 1.12,
      color: '#c7b79e',
      opacity: 0.94,
      softBlurPx: 0.12,
      textShadow: '0 1px 1px rgba(0,0,0,0.72)',
    },
    strong: {
      fontWeight: 700,
      letterSpacingEm: 0.005,
      lineHeight: 1.05,
      color: '#f0e4cf',
      opacity: 0.96,
      softBlurPx: 0.14,
      textShadow: '0 1px 1px rgba(0,0,0,0.84)',
    },
  },

  sections: {
    campHeight: 20.8,
    selectedLocationHeight: 17.5,
    inventoryHeight: 34.0,
    logHeight: 25.5,
  },

  camp: {
    title: {
      top: 8,
      left: 13,
      titleFontPx: 16,
      titleWeight: 700,
      titleLetterSpacingEm: 0.025,
      subtitleFontPx: 10,
      subtitleWeight: 400,
      subtitleLetterSpacingEm: 0.005,
      subtitleMarginTopPx: 2,
    },
    manageButton: {
      top: 36,
      left: 4,
      width: 65.5,
      height: 24,
      radiusPx: 6,
    },
    unloadButton: {
      top: 66,
      left: 4,
      width: 65.5,
      height: 24,
      radiusPx: 6,
    },
  },

  selectedLocation: {
    header: {
      top: 8,
      left: 13,
      right: 3,
      fontPx: 14,
      fontWeight: 700,
      letterSpacingEm: 0.025,
    },
    inspectButton: {
      fontPx: 11,
      fontWeight: 600,
      letterSpacingEm: 0.005,
      paddingXpx: 8,
      paddingYpx: 6,
      iconPx: 10,
      gapPx: 4,
      radiusPx: 4,
    },
    content: {
      top: 28,
      left: 3,
      right: 3,
      bottom: 5,
      gapPx: 8,
    },
    thumbnail: {
      width: 28,
      radiusPx: 4,
      // Keep the cropped card's native ratio instead of stretching it to section height.
      aspectRatio: POI_CARD_UI.aspectRatio,
      maxHeightPercent: 96,
      objectFit: 'contain' as const,
      hoverScale: 1.03,
    },
    info: {
      nameFontPx: 15,
      nameFontWeight: 700,
      nameLetterSpacingEm: 0.005,
      descriptionFontPx: 10.5,
      descriptionFontWeight: 400,
      descriptionLetterSpacingEm: 0.003,
      descriptionMarginTopPx: 3,
      quickActionsMarginTopPx: 4,
      quickActionsGapPx: 4,
      quickActionFontPx: 9,
      quickActionFontWeight: 600,
    },
  },

  inventory: {
    /*
     * Reference target: inventory panel ~433 x 293 px.
     * X/Y positions below are percentages of THIS inventory section, so you can
     * nudge each element independently without fighting flex/justify-between.
     */
    title: {
      top: 7.3,
      left: 14.2,
      width: 45,
      fontPx: 16,
      fontWeight: 700,
      letterSpacingEm: 0.025,
      lineHeight: 1,
      color: '#f1e5cf',
      textShadow: '0 1px 2px rgba(0,0,0,0.95)',
    },

    weight: {
      top: 5.9,
      left: 69.0,
      width: 21.0,
      fontPx: 11,
      fontWeight: 600,
      letterSpacingEm: 0.01,
      lineHeight: 1,
      color: '#eee3cf',
      textAlign: 'left' as const,
      textShadow: '0 1px 2px rgba(0,0,0,0.9)',
    },

    weightBar: {
      top: 11.0,
      left: 69.0,
      width: 27.2,
      heightPx: 9,
      radiusPx: 6,
      borderPx: 1,
      background: 'rgba(10, 22, 19, 0.90)',
      borderColor: 'rgba(159, 155, 132, 0.35)',
    },

    // Grid 5 x 3. Tất cả slot dùng chung grid nên luôn bằng nhau.
    grid: {
      top: 19.0,
      left: 4.0,
      right: 3.7,
      bottom: 5.4,
      columns: 5,
      rows: 3,
      columnGapPx: 6,
      rowGapPx: 7,

      // Dịch riêng hàng cuối xuống để khớp các ô được vẽ sẵn trong background AI.
      // Hàng 1 và 2 giữ nguyên. Đặt 0 nếu không cần bù.
      lastRowOffsetYPx: 2,
    },

    // Nội dung bên trong mỗi slot.
    slot: {
      radiusPx: 5,
      paddingPx: 0,
      iconInsetPercent: 7,
      iconBottomInsetPercent: 9,
      itemIconPx: 76,
      quantityFontPx: 11,
      quantityFontWeight: 700,
      quantityRightPx: 3,
      quantityBottomPx: 3,
      quantityMinWidthPx: 18,
      quantityHeightPx: 18,
      quantityPaddingXpx: 4,
      quantityRadiusPx: 5,
    },

    popover: {
      leftPx: 8,
      rightPx: 8,
      bottomPx: 8,
      paddingPx: 8,
      radiusPx: 6,
      previewPx: 36,
      previewIconPx: 36,
      nameFontPx: 11,
      metaFontPx: 9,
    },
  },

  log: {
    /*
     * Log reference tuning.
     * Target layout: colored dot -> time -> event icon -> message.
     * All measurements stay here so you can nudge the panel without editing JSX.
     */
    header: {
      top: 9.0,
      left: 13.0,
      right: 7.0,
      titleFontPx: 16,
      titleFontWeight: 700,
      titleLetterSpacingEm: 0.028,
      titleOpacity: 0.96,

      autoScrollFontPx: 11,
      autoScrollFontWeight: 400,
      autoScrollOpacity: 0.88,
      checkboxPx: 19,
      checkboxRadiusPx: 4,
      checkboxFontPx: 14,
      gapPx: 6,
    },
    list: {
      top: 24.5,
      left: 6.0,
      right: 3.0,
      bottom: 8.5,

      fontPx: 11.5,
      fontWeight: 400,
      letterSpacingEm: 0.002,
      lineHeight: 1.05,
      textColor: '#ddd2be',
      textOpacity: 0.95,
      textBlurPx: 0.10,

      rowHeightPx: 21,
      rowGapPx: 1,
      rowPaddingXpx: 2,
      rowRadiusPx: 3,
      columnGapPx: 8,

      bulletPx: 6,
      bulletGlowPx: 3,
      timeWidthPx: 43,
      timeFontPx: 10,
      timeFontWeight: 400,
      timeColor: '#9e927f',
      timeOpacity: 0.88,

      iconColumnPx: 20,
      iconPx: 17,
      iconStrokeWidth: 2.3,

      alternateRowAlpha: 0.018,
    },
  },
} as const;

type PercentEdges = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
};

const pctStyle = (values: PercentEdges): React.CSSProperties => {
  const style: React.CSSProperties = {};
  if (values.top !== undefined) style.top = `${values.top}%`;
  if (values.left !== undefined) style.left = `${values.left}%`;
  if (values.right !== undefined) style.right = `${values.right}%`;
  if (values.bottom !== undefined) style.bottom = `${values.bottom}%`;
  if (values.width !== undefined) style.width = `${values.width}%`;
  if (values.height !== undefined) style.height = `${values.height}%`;
  return style;
};

const softTextStyle = (
  preset: typeof UI.typography.heading | typeof UI.typography.body | typeof UI.typography.strong,
): React.CSSProperties => ({
  fontFamily: UI.typography.fontFamily,
  fontWeight: preset.fontWeight,
  letterSpacing: `${preset.letterSpacingEm}em`,
  lineHeight: preset.lineHeight,
  color: preset.color,
  opacity: preset.opacity,
  textShadow: preset.textShadow,
  filter: preset.softBlurPx > 0 ? `blur(${preset.softBlurPx}px)` : undefined,
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
});

export const TacticalCenterColumn: React.FC<TacticalCenterColumnProps> = ({
  state,
  selectedArea,
  onOpenManageCamp,
  onOpenInspectLocation,
  onConsumeItem,
  onDiscardItem,
  onQuickGather,
  onRepairItem,
  onUnloadToPoiStorage,
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedItemInstance, setSelectedItemInstance] = useState<InventoryItem | null>(null);
  const selectedPoiCardUrl = getPoiCardUrl(selectedArea);


  // Warm the selected card immediately, then decode/cache the complete POI deck.
  // imageCache deduplicates aliases and repeated mounts by URL.
  useEffect(() => {
    void preloadImage(selectedPoiCardUrl);
  }, [selectedPoiCardUrl]);

  useEffect(() => {
    void preloadImages(ALL_POI_CARD_URLS, { concurrency: 6 });
  }, []);

  let currentWeightKg = 0;
  for (const item of state.inventory.items) {
    const def = ITEMS_DATABASE[item.itemId];
    if (def) currentWeightKg += def.weight * item.quantity;
  }

  const maxWeightKg = state.inventory.maxWeightKg || 30;
  const weightPercent = Math.min(100, Math.round((currentWeightKg / maxWeightKg) * 100));

  const slotCount = UI.inventory.grid.columns * UI.inventory.grid.rows;
  const displaySlots: (InventoryItem | null)[] = Array(slotCount).fill(null);
  state.inventory.items.slice(0, slotCount).forEach((item, idx) => {
    displaySlots[idx] = item;
  });

  // Chỉ bù vị trí cho hàng cuối của grid; 2 hàng trên không thay đổi.
  const lastRowStartIndex = UI.inventory.grid.columns * (UI.inventory.grid.rows - 1);
  const getInventoryRowOffsetY = (idx: number) =>
    idx >= lastRowStartIndex ? UI.inventory.grid.lastRowOffsetYPx : 0;

  const getLogVisual = (text: string) => {
    const value = text.toLocaleLowerCase('vi');
    const iconStyle = {
      width: UI.log.list.iconPx,
      height: UI.log.list.iconPx,
      flexShrink: 0,
      strokeWidth: UI.log.list.iconStrokeWidth,
      filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.75))',
    };

    if (
      value.includes('medicinal') ||
      value.includes('medicine') ||
      value.includes('herb') ||
      value.includes('dược') ||
      value.includes('thảo')
    ) {
      return { icon: <Flower2 style={iconStyle} className="text-rose-400" />, dot: '#b9ef8f' };
    }

    if (value.includes('river') || value.includes('riverside') || value.includes('suối')) {
      return { icon: <Waves style={iconStyle} className="text-cyan-400" />, dot: '#d9df55' };
    }

    if (
      value.includes('built') ||
      value.includes('build') ||
      value.includes('shelter') ||
      value.includes('craft') ||
      value.includes('chế tạo') ||
      value.includes('xây')
    ) {
      return { icon: <Hammer style={iconStyle} className="text-amber-300" />, dot: '#b9ef8f' };
    }

    if (
      value.includes('discovered') ||
      value.includes('discover') ||
      value.includes('cave') ||
      value.includes('khám phá') ||
      value.includes('hang')
    ) {
      return { icon: <Mountain style={iconStyle} className="text-stone-200" />, dot: '#e4d66c' };
    }

    if (
      value.includes('gathered') ||
      value.includes('gather') ||
      value.includes('forage') ||
      value.includes('thu') ||
      value.includes('hái')
    ) {
      return { icon: <Leaf style={iconStyle} className="text-emerald-400" />, dot: '#c5e966' };
    }

    if (value.includes('uống') || value.includes('nước') || value.includes('water')) {
      return { icon: <Droplet style={iconStyle} className="text-sky-400" />, dot: '#8fdbef' };
    }

    if (
      value.includes('hungry') ||
      value.includes('hunger') ||
      value.includes('ăn') ||
      value.includes('food') ||
      value.includes('dùng')
    ) {
      return { icon: <Utensils style={iconStyle} className="text-lime-400" />, dot: '#b9ef8f' };
    }

    if (value.includes('fire') || value.includes('lửa')) {
      return { icon: <Flame style={iconStyle} className="text-orange-400" />, dot: '#f1b95d' };
    }

    if (value.includes('arrived') || value.includes('thám hiểm') || value.includes('đến')) {
      return { icon: <Compass style={iconStyle} className="text-cyan-300" />, dot: '#d9df55' };
    }

    return { icon: <Info style={iconStyle} className="text-stone-300" />, dot: '#c6b78f' };
  };

  return (
    <div
      className="w-full h-full flex flex-col justify-between select-none text-[#e5dbc8] relative"
      style={{ padding: UI.root.paddingPx }}
    >
      {/* 1. CAMP SECTION */}
      <div className="w-full relative" style={{ height: `${UI.sections.campHeight}%` }}>
        <div
          className="absolute flex flex-col leading-tight pointer-events-none"
          style={pctStyle({ top: UI.camp.title.top, left: UI.camp.title.left })}
        >
          <h3
            className="uppercase"
            style={{
              ...softTextStyle(UI.typography.heading),
              fontSize: UI.camp.title.titleFontPx,
              fontWeight: UI.camp.title.titleWeight,
              letterSpacing: `${UI.camp.title.titleLetterSpacingEm}em`,
            }}
          >
            CAMP
          </h3>
          <span
            style={{
              ...softTextStyle(UI.typography.body),
              fontSize: UI.camp.title.subtitleFontPx,
              fontWeight: UI.camp.title.subtitleWeight,
              letterSpacing: `${UI.camp.title.subtitleLetterSpacingEm}em`,
              marginTop: UI.camp.title.subtitleMarginTopPx,
            }}
          >
            Your survivors are safe at camp.
          </span>
        </div>

        <button
          onClick={onOpenManageCamp}
          className="absolute hover:bg-white/15 active:bg-white/25 active:scale-98 transition-all cursor-pointer ring-0 hover:ring-1 hover:ring-emerald-400/50"
          style={{
            ...pctStyle(UI.camp.manageButton),
            borderRadius: UI.camp.manageButton.radiusPx,
          }}
          title="Quản lý khu trại và chế tạo (Manage Camp)"
          aria-label="Manage Camp"
        />

        <button
          onClick={() => {
            if (onUnloadToPoiStorage) {
              onUnloadToPoiStorage(selectedArea.id);
            }
          }}
          className="absolute hover:bg-white/15 active:bg-white/25 active:scale-98 transition-all cursor-pointer ring-0 hover:ring-1 hover:ring-amber-400/40"
          style={{
            ...pctStyle(UI.camp.unloadButton),
            borderRadius: UI.camp.unloadButton.radiusPx,
          }}
          title={`Dỡ toàn bộ hành trang vào kho bãi của ${selectedArea.name} (Unload All)`}
          aria-label="Unload Inventory"
        />
      </div>

      {/* 2. SELECTED LOCATION SECTION */}
      <div className="w-full relative" style={{ height: `${UI.sections.selectedLocationHeight}%` }}>
        <div
          className="absolute flex items-center justify-between"
          style={pctStyle(UI.selectedLocation.header)}
        >
          <span
            className="uppercase"
            style={{
              ...softTextStyle(UI.typography.heading),
              fontSize: UI.selectedLocation.header.fontPx,
              fontWeight: UI.selectedLocation.header.fontWeight,
              letterSpacing: `${UI.selectedLocation.header.letterSpacingEm}em`,
            }}
          >
            SELECTED LOCATION
          </span>

          <button
            onClick={onOpenInspectLocation}
            className="bg-[#382618]/90 hover:bg-[#4c3422] border border-[#8c6543] text-amber-200 hover:text-white flex items-center cursor-pointer transition-colors shadow-sm"
            style={{
              ...softTextStyle(UI.typography.strong),
              fontSize: UI.selectedLocation.inspectButton.fontPx,
              fontWeight: UI.selectedLocation.inspectButton.fontWeight,
              letterSpacing: `${UI.selectedLocation.inspectButton.letterSpacingEm}em`,
              paddingLeft: UI.selectedLocation.inspectButton.paddingXpx,
              paddingRight: UI.selectedLocation.inspectButton.paddingXpx,
              paddingTop: UI.selectedLocation.inspectButton.paddingYpx,
              paddingBottom: UI.selectedLocation.inspectButton.paddingYpx,
              gap: UI.selectedLocation.inspectButton.gapPx,
              borderRadius: UI.selectedLocation.inspectButton.radiusPx,
            }}
          >
            <Sparkles
              className="text-amber-400"
              style={{
                width: UI.selectedLocation.inspectButton.iconPx,
                height: UI.selectedLocation.inspectButton.iconPx,
              }}
            />
            <span>Inspect</span>
          </button>
        </div>

        <div
          className="absolute flex items-center overflow-hidden rounded-md border border-[#8c6543] shadow-md p-1.5 transition-all duration-300"
          style={{
            ...pctStyle(UI.selectedLocation.content),
            gap: UI.selectedLocation.content.gapPx,
            background: 'linear-gradient(90deg, rgba(29, 45, 38, 0.94) 0%, rgba(23, 38, 32, 0.91) 52%, rgba(16, 29, 25, 0.86) 100%)',
          }}
        >
          <div
            onClick={onOpenInspectLocation}
            className="overflow-hidden shrink-0 bg-transparent relative group cursor-pointer transition-all duration-200 hover:border-amber-300"
            style={{
              width: `${UI.selectedLocation.thumbnail.width}%`,
              aspectRatio: String(UI.selectedLocation.thumbnail.aspectRatio),
              maxHeight: `${UI.selectedLocation.thumbnail.maxHeightPercent}%`,
              borderRadius: UI.selectedLocation.thumbnail.radiusPx,
            }}
            title="Bấm để xem chi tiết & ảnh phóng to"
          >
            <img
              src={selectedPoiCardUrl}
              alt={selectedArea.name}
              loading="eager"
              decoding="async"
              className="w-full h-full object-center transition-transform duration-300"
              style={{
                objectFit: UI.selectedLocation.thumbnail.objectFit,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = `scale(${UI.selectedLocation.thumbnail.hoverScale})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onError={(e) => {
                const fallback = `${POI_CARD_UI.basePath}/${POI_CARD_UI.fallbackFile}`;
                if (!e.currentTarget.src.endsWith(POI_CARD_UI.fallbackFile)) {
                  e.currentTarget.src = fallback;
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-0.5">
              <span className="text-[9px] text-amber-200 font-bold drop-shadow">Inspect</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight z-10">
            <h4
              className="truncate"
              style={{
                ...softTextStyle(UI.typography.strong),
                fontSize: UI.selectedLocation.info.nameFontPx,
                fontWeight: UI.selectedLocation.info.nameFontWeight,
                letterSpacing: `${UI.selectedLocation.info.nameLetterSpacingEm}em`,
              }}
            >
              {selectedArea.name}
            </h4>
            <p
              className="line-clamp-2"
              style={{
                ...softTextStyle(UI.typography.body),
                fontSize: UI.selectedLocation.info.descriptionFontPx,
                fontWeight: UI.selectedLocation.info.descriptionFontWeight,
                letterSpacing: `${UI.selectedLocation.info.descriptionLetterSpacingEm}em`,
                marginTop: UI.selectedLocation.info.descriptionMarginTopPx,
              }}
            >
              {selectedArea.description}
            </p>

            {selectedArea.nodes.length > 0 && (
              <div
                className="flex items-center"
                style={{
                  gap: UI.selectedLocation.info.quickActionsGapPx,
                  marginTop: UI.selectedLocation.info.quickActionsMarginTopPx,
                }}
              >
                {selectedArea.nodes.slice(0, 2).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => onQuickGather(node.id)}
                    className="px-1.5 py-0.5 rounded bg-[#382618]/90 hover:bg-[#4d3624] border border-[#7a5839] hover:border-amber-300 text-amber-200 hover:text-white truncate cursor-pointer transition-colors"
                    style={{
                      ...softTextStyle(UI.typography.strong),
                      fontSize: UI.selectedLocation.info.quickActionFontPx,
                      fontWeight: UI.selectedLocation.info.quickActionFontWeight,
                    }}
                    title={`Thu lượm: ${node.name}`}
                  >
                    + {node.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. CARRYING INVENTORY SECTION */}
      <div className="w-full relative" style={{ height: `${UI.sections.inventoryHeight}%` }}>
        {/* Inventory label: positioned independently for easy pixel matching. */}
        <span
          className="absolute uppercase pointer-events-none whitespace-nowrap"
          style={{
            ...pctStyle(UI.inventory.title),
            ...softTextStyle(UI.typography.heading),
            fontSize: UI.inventory.title.fontPx,
            fontWeight: UI.inventory.title.fontWeight,
            letterSpacing: `${UI.inventory.title.letterSpacingEm}em`,
            lineHeight: UI.inventory.title.lineHeight,
            color: UI.inventory.title.color,
            textShadow: UI.inventory.title.textShadow,
          }}
        >
          CARRYING INVENTORY
        </span>

        {/* Weight text: no flex coupling with the title, so X/Y can be tuned separately. */}
        <span
          className="absolute pointer-events-none whitespace-nowrap"
          style={{
            ...pctStyle(UI.inventory.weight),
            ...softTextStyle(UI.typography.strong),
            fontSize: UI.inventory.weight.fontPx,
            fontWeight: UI.inventory.weight.fontWeight,
            letterSpacing: `${UI.inventory.weight.letterSpacingEm}em`,
            lineHeight: UI.inventory.weight.lineHeight,
            color: UI.inventory.weight.color,
            textAlign: UI.inventory.weight.textAlign,
            textShadow: UI.inventory.weight.textShadow,
          }}
        >
          {currentWeightKg.toFixed(1)} / {maxWeightKg} kg
        </span>

        {/* Weight bar: compact bar directly under the weight value, matching the reference. */}
        <div
          className="absolute overflow-hidden"
          style={{
            ...pctStyle({
              top: UI.inventory.weightBar.top,
              left: UI.inventory.weightBar.left,
              width: UI.inventory.weightBar.width,
            }),
            height: UI.inventory.weightBar.heightPx,
            borderRadius: UI.inventory.weightBar.radiusPx,
            border: `${UI.inventory.weightBar.borderPx}px solid ${UI.inventory.weightBar.borderColor}`,
            background: UI.inventory.weightBar.background,
          }}
        >
          <div
            className={`h-full transition-all duration-300 ${
              weightPercent > 90
                ? 'bg-red-500'
                : weightPercent > 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{
              width: `${weightPercent}%`,
              borderRadius: UI.inventory.weightBar.radiusPx,
            }}
          />
        </div>

        {/*
          15 slots đều nhau tuyệt đối.
          Chỉnh vị trí/kích thước cả cụm ở UI.inventory.grid phía trên.
        */}
        <div
          className="absolute grid"
          style={{
            ...pctStyle(UI.inventory.grid),
            gridTemplateColumns: `repeat(${UI.inventory.grid.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${UI.inventory.grid.rows}, minmax(0, 1fr))`,
            columnGap: UI.inventory.grid.columnGapPx,
            rowGap: UI.inventory.grid.rowGapPx,
          }}
        >
          {displaySlots.map((item, idx) => {
            if (!item) {
              return (
                <div
                  key={`empty_${idx}`}
                  className="relative hover:bg-white/5 transition-colors w-full h-full"
                  style={{
                    borderRadius: UI.inventory.slot.radiusPx,
                    top: getInventoryRowOffsetY(idx),
                  }}
                />
              );
            }

            const def = ITEMS_DATABASE[item.itemId];
            const dominantQuality = getDominantQuality(item.qualityBreakdown, item.quality);
            const qualityMeta = QUALITY_CONFIG[dominantQuality];
            const maxCond = item.conditionMax || def?.toolProperties?.durabilityMax || 100;

            return (
              <div
                key={item.instanceId}
                onClick={() => setSelectedItemInstance(item)}
                className="relative flex items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden active:scale-95 w-full h-full"
                style={{
                  borderRadius: UI.inventory.slot.radiusPx,
                  padding: UI.inventory.slot.paddingPx,
                  top: getInventoryRowOffsetY(idx),
                }}
                title={`${def?.name || item.itemId} [${qualityMeta.nameVi}]`}
              >
                {/* Dominant Quality Dot indicator */}
                <div
                  className="absolute top-1 left-1 w-2 h-2 rounded-full border border-black/70 shadow-sm pointer-events-none z-10"
                  style={{ backgroundColor: qualityMeta.colorHex }}
                />

                {/* Freshness Micro-Bar */}
                {item.freshness !== undefined && (
                  <div 
                    className="absolute left-1 bottom-1 h-1 rounded-full bg-black/70 overflow-hidden pointer-events-none z-10 border border-black/50"
                    style={{ width: '16px' }}
                    title={`Độ tươi: ${Math.round(item.freshness)}%`}
                  >
                    <div 
                      className="h-full transition-all"
                      style={{ 
                        width: `${Math.max(5, Math.min(100, item.freshness))}%`,
                        backgroundColor: FRESHNESS_CONFIG[getFreshnessStage(item.freshness)].colorHex
                      }}
                    />
                  </div>
                )}

                {/* Durability/Condition Micro-Bar */}
                {item.condition !== undefined && (
                  <div 
                    className="absolute right-1 top-1 h-1 rounded-full bg-black/70 overflow-hidden pointer-events-none z-10 border border-black/50"
                    style={{ width: '16px' }}
                    title={`Độ bền: ${item.condition}/${maxCond}`}
                  >
                    <div 
                      className="h-full transition-all"
                      style={{ 
                        width: `${Math.max(5, Math.min(100, (item.condition / maxCond) * 100))}%`,
                        backgroundColor: CONDITION_CONFIG[getConditionStage(item.condition, maxCond)].colorHex
                      }}
                    />
                  </div>
                )}

                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${UI.inventory.slot.iconInsetPercent}%`,
                    right: `${UI.inventory.slot.iconInsetPercent}%`,
                    top: `${UI.inventory.slot.iconInsetPercent}%`,
                    bottom: `${UI.inventory.slot.iconBottomInsetPercent}%`,
                  }}
                >
                  <ItemIcon
                    itemId={item.itemId}
                    category={def?.category}
                    size={UI.inventory.slot.itemIconPx}
                    className="w-full h-full object-contain"
                  />
                </div>

                <span
                  className="absolute flex items-center justify-center bg-[#111817]/95 border border-[#56615a] text-[#f5ead8] leading-none pointer-events-none"
                  style={{
                    right: UI.inventory.slot.quantityRightPx,
                    bottom: UI.inventory.slot.quantityBottomPx,
                    minWidth: UI.inventory.slot.quantityMinWidthPx,
                    height: UI.inventory.slot.quantityHeightPx,
                    ...softTextStyle(UI.typography.strong),
                    filter: 'blur(0.08px)',
                    fontSize: UI.inventory.slot.quantityFontPx,
                    fontWeight: UI.inventory.slot.quantityFontWeight,
                    paddingLeft: UI.inventory.slot.quantityPaddingXpx,
                    paddingRight: UI.inventory.slot.quantityPaddingXpx,
                    borderRadius: UI.inventory.slot.quantityRadiusPx,
                    textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                  }}
                >
                  {item.quantity}
                </span>
              </div>
            );
          })}
        </div>

        {selectedItemInstance && (() => {
          const inspectedDef = ITEMS_DATABASE[selectedItemInstance.itemId];
          const domQuality = getDominantQuality(selectedItemInstance.qualityBreakdown, selectedItemInstance.quality);
          const qMeta = QUALITY_CONFIG[domQuality];
          const spoilage = inspectedDef ? analyzeItemSpoilage(selectedItemInstance, inspectedDef, state) : null;
          const maxCond = selectedItemInstance.conditionMax || inspectedDef?.toolProperties?.durabilityMax || 100;
          const condStage = selectedItemInstance.condition !== undefined ? getConditionStage(selectedItemInstance.condition, maxCond) : null;
          const cMeta = condStage ? CONDITION_CONFIG[condStage] : null;
          const freshStage = selectedItemInstance.freshness !== undefined ? getFreshnessStage(selectedItemInstance.freshness) : null;
          const fMeta = freshStage ? FRESHNESS_CONFIG[freshStage] : null;

          const canRepair = selectedItemInstance.condition !== undefined && 
            selectedItemInstance.condition < maxCond &&
            state.inventory.items.some(i => (i.itemId === 'ITEM_VINE_FIBER' || i.itemId === 'ITEM_CORD_ROPE' || i.itemId === 'ITEM_RIVER_PEBBLE') && i.quantity > 0);

          return (
            <div
              className="absolute bg-[#161f18]/95 border border-[#3e5645] flex flex-col gap-2 text-xs z-30 shadow-2xl backdrop-blur-md animate-in fade-in"
              style={{
                left: UI.inventory.popover.leftPx,
                right: UI.inventory.popover.rightPx,
                bottom: UI.inventory.popover.bottomPx,
                padding: '8px 10px',
                borderRadius: UI.inventory.popover.radiusPx,
              }}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="shrink-0 bg-black/40 border border-[#2b3c31] p-0.5 flex items-center justify-center rounded"
                    style={{
                      width: UI.inventory.popover.previewPx,
                      height: UI.inventory.popover.previewPx,
                    }}
                  >
                    <ItemIcon
                      itemId={selectedItemInstance.itemId}
                      category={inspectedDef?.category}
                      size={UI.inventory.popover.previewIconPx}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="truncate font-bold text-[#f2e7d3]"
                        style={{ fontSize: UI.inventory.popover.nameFontPx }}
                      >
                        {inspectedDef?.name || selectedItemInstance.itemId}
                      </span>
                      <span 
                        className="text-[9px] px-1 py-0.2 rounded font-medium border"
                        style={{ 
                          color: qMeta.colorHex, 
                          backgroundColor: `${qMeta.colorHex}18`,
                          borderColor: `${qMeta.colorHex}40` 
                        }}
                      >
                        {qMeta.nameVi}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#8ea596] mt-0.5">
                      x{selectedItemInstance.quantity} • {((inspectedDef?.weight || 0.5) * selectedItemInstance.quantity).toFixed(1)} kg
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {(inspectedDef?.category === 'food' || inspectedDef?.category === 'water') && (
                    <button
                      onClick={() => {
                        onConsumeItem(selectedItemInstance.instanceId);
                        setSelectedItemInstance(null);
                      }}
                      className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      Dùng
                    </button>
                  )}
                  {canRepair && onRepairItem && (
                    <button
                      onClick={() => {
                        onRepairItem(selectedItemInstance.instanceId);
                      }}
                      className="px-2 py-0.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                      title="Dùng 1 đá cuội hoặc 1 dây bện để mài sắc/gia cố (+50% độ bền)"
                    >
                      <Wrench className="w-2.5 h-2.5" />
                      <span>Sửa</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedItemInstance(null)}
                    className="p-1 hover:bg-white/10 rounded text-[#8ea596] hover:text-white text-[10px] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Dynamic Simulation Status Meters */}
              <div className="pt-1.5 border-t border-[#25362a] flex flex-col gap-1 text-[10px]">
                {/* Freshness dynamic info */}
                {selectedItemInstance.freshness !== undefined && fMeta && (
                  <div className="flex items-center justify-between gap-2 bg-[#101712] px-2 py-1 rounded border border-[#213125]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" style={{ color: fMeta.colorHex }} />
                      <span className="text-[#a4b6aa]">Độ tươi:</span>
                      <span className="font-bold" style={{ color: fMeta.colorHex }}>
                        {Math.round(selectedItemInstance.freshness)}% ({fMeta.labelVi})
                      </span>
                    </div>
                    {spoilage && (
                      <span className="text-[9px] text-[#7d9384] font-mono">
                        {spoilage.remainingDays < 900 ? `~${spoilage.remainingDays} ngày` : 'Lâu dài'} (-{spoilage.effectiveDailyRate}%/ng)
                      </span>
                    )}
                  </div>
                )}

                {/* Condition dynamic info */}
                {selectedItemInstance.condition !== undefined && cMeta && (
                  <div className="flex items-center justify-between gap-2 bg-[#101712] px-2 py-1 rounded border border-[#213125]">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3 h-3" style={{ color: cMeta.colorHex }} />
                      <span className="text-[#a4b6aa]">Độ bền:</span>
                      <span className="font-bold" style={{ color: cMeta.colorHex }}>
                        {selectedItemInstance.condition} / {maxCond} ({cMeta.labelVi})
                      </span>
                    </div>
                    <span className="text-[9px] text-[#7d9384] font-mono">
                      Hiệu suất: {Math.round(cMeta.efficiencyMultiplier * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 4. LOG SECTION */}
      <div className="w-full relative" style={{ height: `${UI.sections.logHeight}%` }}>
        <div
          className="absolute flex items-center justify-between"
          style={pctStyle(UI.log.header)}
        >
          <span
            className="uppercase"
            style={{
              ...softTextStyle(UI.typography.heading),
              fontSize: UI.log.header.titleFontPx,
              fontWeight: UI.log.header.titleFontWeight,
              letterSpacing: `${UI.log.header.titleLetterSpacingEm}em`,
              opacity: UI.log.header.titleOpacity,
            }}
          >
            LOG
          </span>

          <label
            className="flex items-center cursor-pointer"
            style={{
              ...softTextStyle(UI.typography.body),
              gap: UI.log.header.gapPx,
              fontSize: UI.log.header.autoScrollFontPx,
              fontWeight: UI.log.header.autoScrollFontWeight,
              opacity: UI.log.header.autoScrollOpacity,
            }}
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="sr-only"
            />
            <span
              className="flex items-center justify-center font-bold"
              style={{
                width: UI.log.header.checkboxPx,
                height: UI.log.header.checkboxPx,
                borderRadius: UI.log.header.checkboxRadiusPx,
                fontFamily: UI_FONT,
                fontSize: UI.log.header.checkboxFontPx,
                lineHeight: 1,
                color: autoScroll ? '#102016' : '#998d78',
                background: autoScroll ? '#6ed77f' : 'rgba(31,45,40,0.82)',
                border: autoScroll
                  ? '1px solid rgba(137,236,150,0.72)'
                  : '1px solid rgba(132,141,126,0.52)',
                boxShadow: autoScroll
                  ? '0 0 5px rgba(87,210,109,0.16), inset 0 1px rgba(255,255,255,0.22)'
                  : 'inset 0 1px 2px rgba(0,0,0,0.55)',
              }}
            >
              {autoScroll ? '✓' : ''}
            </span>
            <span>Auto-scroll</span>
          </label>
        </div>

        <div
          className="absolute overflow-y-auto pr-1"
          style={{
            ...pctStyle(UI.log.list),
            fontFamily: UI_FONT,
          }}
        >
          {state.logs.map((log, index) => {
            const visual = getLogVisual(log.text);

            return (
              <div
                key={log.id}
                className="grid items-center transition-colors hover:bg-white/[0.055]"
                style={{
                  minHeight: UI.log.list.rowHeightPx,
                  gridTemplateColumns: `${UI.log.list.bulletPx}px ${UI.log.list.timeWidthPx}px ${UI.log.list.iconColumnPx}px minmax(0, 1fr)`,
                  columnGap: UI.log.list.columnGapPx,
                  paddingLeft: UI.log.list.rowPaddingXpx,
                  paddingRight: UI.log.list.rowPaddingXpx,
                  marginTop: index === 0 ? 0 : UI.log.list.rowGapPx,
                  borderRadius: UI.log.list.rowRadiusPx,
                  background:
                    index % 2 === 1
                      ? `rgba(255,255,255,${UI.log.list.alternateRowAlpha})`
                      : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: UI.log.list.bulletPx,
                    height: UI.log.list.bulletPx,
                    borderRadius: '50%',
                    background: visual.dot,
                    boxShadow: `0 0 ${UI.log.list.bulletGlowPx}px ${visual.dot}55`,
                    justifySelf: 'center',
                  }}
                />

                <span
                  className="whitespace-nowrap tabular-nums"
                  style={{
                    fontFamily: UI_FONT,
                    fontSize: UI.log.list.timeFontPx,
                    fontWeight: UI.log.list.timeFontWeight,
                    lineHeight: 1,
                    color: UI.log.list.timeColor,
                    opacity: UI.log.list.timeOpacity,
                    textShadow: '0 1px 1px rgba(0,0,0,0.72)',
                    filter: 'blur(0.08px)',
                  }}
                >
                  {log.timeStr}
                </span>

                <span className="flex items-center justify-center">{visual.icon}</span>

                <span
                  className="min-w-0 truncate"
                  style={{
                    fontFamily: UI_FONT,
                    fontSize: UI.log.list.fontPx,
                    fontWeight: UI.log.list.fontWeight,
                    letterSpacing: `${UI.log.list.letterSpacingEm}em`,
                    lineHeight: UI.log.list.lineHeight,
                    color: UI.log.list.textColor,
                    opacity: UI.log.list.textOpacity,
                    textShadow: '0 1px 1px rgba(0,0,0,0.78)',
                    filter: `blur(${UI.log.list.textBlurPx}px)`,
                  }}
                  title={log.text}
                >
                  {log.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
