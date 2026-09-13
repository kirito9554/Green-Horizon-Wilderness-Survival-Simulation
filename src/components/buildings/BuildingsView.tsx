import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Droplets,
  Flame,
  Hammer,
  Package,
  Shield,
  UserCheck,
  Wrench,
  Search,
} from 'lucide-react';
import { GameState } from '../../types';
import {
  BUILDING_CATEGORY_LABELS,
  BUILDING_PREVIEW_ATLASES,
  getBuildingCategories,
  getBuildingRecipes,
  type BuildingRecipeDefinition,
} from '../../data/buildings';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';

interface BuildingsViewProps {
  state: GameState;
  onStartConstruction: (survivorId: string, buildingId: string) => void;
}

type Box = { x: number; y: number; w: number; h: number; radiusPx?: number };
type BuildingMode = 'build' | 'upgrade';
type RecipeStatusFilter = 'all' | 'ready' | 'built' | 'missing';

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * ============================================================================
 * BUILDINGS VIEW - FULL DOM TUNING AREA
 * ============================================================================
 * Nền raster chỉ giữ frame tổng. Toàn bộ section header, selector, 4 recipe card,
 * button, border, text và effects đều dựng bằng DOM.
 *
 * Tọa độ = DESIGN PIXEL trên frame 1448 x 1086.
 * ============================================================================
 */
const BUILD_UI = {
  reference: { width: 1448, height: 1086 },

  // No DOM panel behind this area. The raster surface stays visible.
  sectionBand: {
    icon: { x: 109, y: 208, w: 48, h: 48 },
    title: { x: 182, y: 213, w: 540, h: 28 },
    subtitle: { x: 182, y: 244, w: 580, h: 22 },
  },

  builder: {
    panel: { x: 841, y: 210, w: 475, h: 60, radiusPx: 8 },
    icon: { x: 860, y: 224, w: 28, h: 28 },
    label: { x: 897, y: 226, w: 120, h: 26 },
    select: { x: 1024, y: 218, w: 281, h: 43, radiusPx: 6 },
    panelBg: 'rgba(2, 26, 27, 0.22)',
    panelShadow:
      'inset 0 5px 12px rgba(0,0,0,0.38), inset 0 -1px 0 rgba(117,154,130,0.055), inset 0 0 0 1px rgba(38,88,74,0.22)',
  },

  // Inner mode tabs for the Buildings screen.
  // Xây dựng is functional now; Nâng cấp is a placeholder for the future system.
  modeTabs: {
    build: { x: 91, y: 281, w: 154, h: 34, radiusPx: 6 },
    upgrade: { x: 251, y: 281, w: 154, h: 34, radiusPx: 6 },

    inactiveBg: 'rgba(3, 24, 25, 0.28)',
    activeBg: 'rgba(18, 57, 45, 0.62)',
    inactiveShadow:
      'inset 0 3px 7px rgba(0,0,0,0.42), inset 0 -1px 0 rgba(255,255,255,0.025)',
    activeShadow:
      'inset 0 4px 9px rgba(0,0,0,0.48), inset 0 -1px 0 rgba(109,196,139,0.12), 0 0 7px rgba(68,184,112,0.05)',
    hoverBg: 'rgba(16, 52, 42, 0.46)',
  },

  // Build browser controls. Categories are generated from buildings.ts automatically.
  filters: {
    search: { x: 427, y: 281, w: 290, h: 34, radiusPx: 6 },
    category: { x: 726, y: 281, w: 188, h: 34, radiusPx: 6 },
    status: { x: 923, y: 281, w: 174, h: 34, radiusPx: 6 },
    count: { x: 1110, y: 281, w: 243, h: 34, radiusPx: 6 },
    controlBg: 'rgba(3, 24, 25, 0.40)',
    controlBorder: '1px solid rgba(69, 108, 91, 0.20)',
    controlShadow:
      'inset 0 3px 7px rgba(0,0,0,0.40), inset 0 -1px 0 rgba(255,255,255,0.025)',
  },

  /**
   * Fixed recipe viewport.
   * Filter row stays outside this box; every recipe card lives inside this
   * scrollable viewport, so adding/removing controls above no longer changes
   * the local layout of the cards.
   */
  recipeViewport: {
    box: { x: 88, y: 326, w: 1265, h: 530, radiusPx: 8 },
    paddingPx: 5,
    gapXPx: 18,
    gapYPx: 18,
  },

  /**
   * Fixed recipe-card size.
   * Complex recipes DO NOT make the whole card taller; the materials area
   * gets its own compact vertical scrollbar instead.
   */
  cardDesign: {
    w: 610,
    heightPx: 326,
  },

  upgradePlaceholder: {
    panel: { x: 88, y: 326, w: 1265, h: 598, radiusPx: 11 },
    icon: { x: 596, y: 486, w: 54, h: 54 },
    title: { x: 460, y: 553, w: 330, h: 30 },
    text: { x: 403, y: 592, w: 444, h: 44 },
  },

  emptyState: {
    titlePx: 18,
    bodyPx: 11.5,
  },

  // Sunken recipe surface: no fake wood/metal frame.
  cardStyle: {
    bg: 'linear-gradient(180deg, rgba(2, 28, 29, 0.42) 0%, rgba(2, 22, 24, 0.56) 100%)',
    shadow:
      'inset 0 6px 15px rgba(0,0,0,0.44), inset 0 -1px 0 rgba(114,153,127,0.05), inset 0 0 0 1px rgba(31,75,66,0.25), 0 1px 0 rgba(255,255,255,0.01)',
    hoverShadow:
      'inset 0 6px 15px rgba(0,0,0,0.40), inset 0 0 0 1px rgba(61,123,96,0.36), 0 0 10px rgba(60,150,99,0.05)',
  },

  content: {
    // Preview uses a fixed left/top/right geometry and grows with the card.
    image: { x: 16, y: 18, w: 176, h: 0, radiusPx: 5 },
    imageBottomPx: 18,

    title: { x: 205, y: 18, w: 305, h: 34 },
    timer: { x: 519, y: 16, w: 72, h: 30, radiusPx: 6 },
    description: { x: 205, y: 56, w: 386, h: 47 },
    benefit: { x: 205, y: 108, w: 386, h: 52, radiusPx: 5 },

    materialsLabel: { x: 205, y: 168, w: 190, h: 18 },

    // Fixed mini-viewport: 2 rows are visible; longer ingredient lists scroll.
    materials: { x: 205, y: 190, w: 386, h: 61 },

    // Footer stays fixed regardless of ingredient count.
    status: { x: 205, y: 273, w: 218, h: 29 },
    buildButton: { x: 432, y: 266, w: 159, h: 41, radiusPx: 6 },
  },

  typography: {
    // Recipe/card typography — intentionally larger to match the scale of the raster UI.
    titlePx: 20,
    bodyPx: 12.3,
    bodyLineHeight: 1.28,
    benefitPx: 12,
    materialLabelPx: 11.2,
    materialPx: 10.8,
    statusPx: 10.8,
    timerPx: 12,
    buttonPx: 12.5,

    // Header / builder controls.
    sectionTitlePx: 24,
    sectionSubtitlePx: 12,
    builderLabelPx: 13,
    builderSelectPx: 12.5,
    modeTabPx: 12.5,
    filterPx: 11.5,
    countPx: 11,
    emptyTitlePx: 18,
    emptyBodyPx: 11.5,
    upgradePlaceholderTitlePx: 19,
    upgradePlaceholderBodyPx: 12,
  },

  materialGrid: {
    columns: 2,
    rowHeightPx: 27,
    rowGapPx: 6,
    columnGapPx: 6,

    // Very small in-card scrollbar. Only appears when content overflows.
    scrollbarWidthPx: 4,
    scrollbarRightPaddingPx: 5,
  },

  materialChip: {
    heightPx: 27,
    padXPx: 8,
    gapPx: 5,
    radiusPx: 5,
    iconPx: 16,
    nameMaxWidthPx: 112,
  },

} as const;

const rootBoxStyle = (box: Box): React.CSSProperties => ({
  left: `${(box.x / BUILD_UI.reference.width) * 100}%`,
  top: `${(box.y / BUILD_UI.reference.height) * 100}%`,
  width: `${(box.w / BUILD_UI.reference.width) * 100}%`,
  height: `${(box.h / BUILD_UI.reference.height) * 100}%`,
  borderRadius: box.radiusPx ?? 0,
});

const uiPx = (px: number) => `${(px / BUILD_UI.reference.width) * 100}cqw`;

/**
 * Card children use root design pixels converted to cqw instead of percentages
 * of the card height. This prevents controls such as the build button from
 * "jumping" when the card height changes.
 */
const cardPxStyle = (box: Box, offsetYPx = 0): React.CSSProperties => ({
  left: uiPx(box.x),
  top: uiPx(box.y + offsetYPx),
  width: uiPx(box.w),
  height: uiPx(box.h),
  borderRadius: box.radiusPx ? uiPx(box.radiusPx) : 0,
});

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'food':
      return Flame;
    case 'shelter':
      return Shield;
    case 'storage':
      return Package;
    case 'water':
      return Droplets;
    default:
      return Wrench;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'food':
      return '#ffb24a';
    case 'shelter':
      return '#f2cf4f';
    case 'storage':
      return '#e5bb43';
    case 'water':
      return '#38baff';
    default:
      return '#81ceb8';
  }
};

const titleCaseCategory = (category: string) =>
  category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getCategoryLabel = (category: string) =>
  BUILDING_CATEGORY_LABELS[category] ?? titleCaseCategory(category);

const atlasSpriteStyle = (
  atlasId: string,
  cellIndex: number,
): React.CSSProperties | undefined => {
  const atlas = BUILDING_PREVIEW_ATLASES[atlasId];
  const cell = atlas?.cells[cellIndex];
  if (!atlas || !cell) return undefined;

  return {
    position: 'absolute',
    width: `${(atlas.sheetWidth / cell.w) * 100}%`,
    height: `${(atlas.sheetHeight / cell.h) * 100}%`,
    left: `${-(cell.x / cell.w) * 100}%`,
    top: `${-(cell.y / cell.h) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
  };
};



export const BuildingsView: React.FC<BuildingsViewProps> = ({
  state,
  onStartConstruction,
}) => {
  const { buildings, inventory, survivors } = state;
  const [assignedSurvivorId, setAssignedSurvivorId] = useState(survivors[0]?.id || '');
  const [buildMode, setBuildMode] = useState<BuildingMode>('build');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<RecipeStatusFilter>('all');
  const recipeScrollRef = useRef<HTMLDivElement>(null);

  const chosenSurvivor = survivors.find((s) => s.id === assignedSurvivorId);
  const isSurvivorBusy = !!chosenSurvivor && chosenSurvivor.currentAction.type !== 'idle';


  const allBlueprints = useMemo(() => getBuildingRecipes(), []);
  const categories = useMemo(() => getBuildingCategories(), []);


  const getItemStock = (itemId: string) => {
    let count = 0;
    for (const item of inventory.items) {
      if (item.itemId === itemId) count += item.quantity;
    }
    return count;
  };

  const recipeCanAfford = (recipe: BuildingRecipeDefinition) =>
    recipe.cost.every((req) => getItemStock(req.itemId) >= req.quantity);

  const filteredBlueprints = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allBlueprints.filter((recipe) => {
      const category = String(recipe.category);
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;

      const existing = buildings.find((building) => building.buildingId === recipe.id);
      const isBuilt = existing?.isBuilt === true;
      const canAfford = recipeCanAfford(recipe);

      if (statusFilter === 'ready' && (isBuilt || !canAfford)) return false;
      if (statusFilter === 'built' && !isBuilt) return false;
      if (statusFilter === 'missing' && (isBuilt || canAfford)) return false;

      if (!query) return true;

      const haystack = [
        recipe.id,
        recipe.name,
        recipe.description,
        recipe.benefitsDescription,
        category,
        getCategoryLabel(category),
        ...(recipe.ui?.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [allBlueprints, buildings, inventory.items, searchQuery, categoryFilter, statusFilter]);

  const resetRecipeScroll = () => {
    if (recipeScrollRef.current) recipeScrollRef.current.scrollTop = 0;
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: UI_FONT }}>
      {/* =============================================================== */}
      {/* Section band                                                    */}
      {/* =============================================================== */}
      <Hammer
        className="absolute text-[#57e9a3]"
        style={{
          ...rootBoxStyle(BUILD_UI.sectionBand.icon),
          strokeWidth: 2.4,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.45))',
        }}
      />

      <div
        className="absolute font-bold text-[#f0eadb]"
        style={{
          ...rootBoxStyle(BUILD_UI.sectionBand.title),
          fontSize: uiPx(BUILD_UI.typography.sectionTitlePx),
          lineHeight: 1,
          letterSpacing: '0.005em',
          textShadow: '0 1px 2px rgba(0,0,0,0.78)',
        }}
      >
        {buildMode === 'build' ? 'Quy hoạch & Xây dựng khu định cư' : 'Nâng cấp công trình'}
      </div>

      <div
        className="absolute text-[#d2d9cf]"
        style={{
          ...rootBoxStyle(BUILD_UI.sectionBand.subtitle),
          fontSize: uiPx(BUILD_UI.typography.sectionSubtitlePx),
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.60)',
        }}
      >
        {buildMode === 'build'
          ? 'Dựng lều chắn mưa, bếp lửa trại để đun nước tiệt trùng, và gia cố nâng sức chứa kho.'
          : 'Cải thiện hiệu suất, sức chứa và độ bền của các công trình đã hoàn thiện.'}
      </div>

      {/* Builder selector */}
      <div
        className="absolute pointer-events-auto"
        style={{
          ...rootBoxStyle(BUILD_UI.builder.panel),
          background: BUILD_UI.builder.panelBg,
          border: 'none',
          boxShadow: BUILD_UI.builder.panelShadow,
        }}
      />

      <UserCheck
        className="absolute text-[#5ee7aa] pointer-events-none"
        style={{ ...rootBoxStyle(BUILD_UI.builder.icon), strokeWidth: 2.3 }}
      />

      <div
        className="absolute text-[#eee9db] pointer-events-none"
        style={{
          ...rootBoxStyle(BUILD_UI.builder.label),
          fontSize: uiPx(BUILD_UI.typography.builderLabelPx),
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Thợ xây dựng:
      </div>

      <select
        value={assignedSurvivorId}
        onChange={(e) => setAssignedSurvivorId(e.target.value)}
        className="absolute pointer-events-auto text-[#f3eee2] outline-none cursor-pointer"
        style={{
          ...rootBoxStyle(BUILD_UI.builder.select),
          appearance: 'auto',
          WebkitAppearance: 'menulist',
          background: 'rgba(4, 26, 27, 0.82)',
          border: '1px solid rgba(161, 150, 95, 0.70)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.52)',
          paddingLeft: uiPx(14),
          paddingRight: uiPx(10),
          fontFamily: UI_FONT,
          fontSize: uiPx(BUILD_UI.typography.builderSelectPx),
          textShadow: '0 1px 2px rgba(0,0,0,0.65)',
        }}
      >
        {survivors.map((survivor) => (
          <option key={survivor.id} value={survivor.id} className="text-black">
            {survivor.name} ({survivor.currentAction.type === 'idle' ? 'Rảnh' : 'Bận'} • Xây dựng{' '}
            {Math.round(survivor.skills.building || 1)})
          </option>
        ))}
      </select>

      {/* =============================================================== */}
      {/* Buildings mode: Build / Upgrade                                 */}
      {/* =============================================================== */}
      {(
        [
          ['build', 'Xây dựng', Hammer],
          ['upgrade', 'Nâng cấp', Wrench],
        ] as const
      ).map(([mode, label, Icon]) => {
        const active = buildMode === mode;
        const box = BUILD_UI.modeTabs[mode];

        return (
          <button
            key={mode}
            type="button"
            onClick={() => setBuildMode(mode)}
            className="absolute pointer-events-auto flex items-center justify-center gap-2 outline-none transition-all duration-150"
            style={{
              ...rootBoxStyle(box),
              background: active ? BUILD_UI.modeTabs.activeBg : BUILD_UI.modeTabs.inactiveBg,
              border: '1px solid rgba(68, 103, 84, 0.16)',
              boxShadow: active ? BUILD_UI.modeTabs.activeShadow : BUILD_UI.modeTabs.inactiveShadow,
              color: active ? '#dce8dc' : '#9eaba1',
              fontFamily: UI_FONT,
              fontSize: uiPx(BUILD_UI.typography.modeTabPx),
              fontWeight: active ? 700 : 600,
              cursor: 'pointer',
              textShadow: '0 1px 2px rgba(0,0,0,0.68)',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = BUILD_UI.modeTabs.hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = active
                ? BUILD_UI.modeTabs.activeBg
                : BUILD_UI.modeTabs.inactiveBg;
            }}
          >
            <Icon
              style={{
                width: uiPx(14),
                height: uiPx(14),
                strokeWidth: 2.2,
                color: active ? '#69d79a' : '#8e9b91',
              }}
            />
            <span>{label}</span>

            {active && (
              <span
                className="absolute"
                style={{
                  left: '24%',
                  right: '24%',
                  bottom: uiPx(2),
                  height: uiPx(1.5),
                  borderRadius: uiPx(2),
                  background: 'rgba(86, 206, 132, 0.42)',
                  boxShadow: '0 0 4px rgba(76,205,126,0.18)',
                }}
              />
            )}
          </button>
        );
      })}

      {buildMode === 'build' && (
        <>
          <div
            className="absolute pointer-events-auto flex items-center"
            style={{
              ...rootBoxStyle(BUILD_UI.filters.search),
              background: BUILD_UI.filters.controlBg,
              border: BUILD_UI.filters.controlBorder,
              boxShadow: BUILD_UI.filters.controlShadow,
              paddingLeft: uiPx(10),
              paddingRight: uiPx(8),
              gap: uiPx(7),
            }}
          >
            <Search style={{ width: uiPx(14), height: uiPx(14), color: '#7da18e' }} />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetRecipeScroll();
              }}
              placeholder="Tìm công trình..."
              className="w-full min-w-0 bg-transparent outline-none text-[#d9e1d9] placeholder:text-[#6f8077]"
              style={{ fontFamily: UI_FONT, fontSize: uiPx(BUILD_UI.typography.filterPx) }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              resetRecipeScroll();
            }}
            className="absolute pointer-events-auto outline-none cursor-pointer text-[#d9e1d9]"
            style={{
              ...rootBoxStyle(BUILD_UI.filters.category),
              background: BUILD_UI.filters.controlBg,
              border: BUILD_UI.filters.controlBorder,
              boxShadow: BUILD_UI.filters.controlShadow,
              paddingLeft: uiPx(9),
              paddingRight: uiPx(7),
              fontFamily: UI_FONT,
              fontSize: uiPx(BUILD_UI.typography.filterPx),
            }}
          >
            <option value="all">Tất cả nhóm</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as RecipeStatusFilter);
              resetRecipeScroll();
            }}
            className="absolute pointer-events-auto outline-none cursor-pointer text-[#d9e1d9]"
            style={{
              ...rootBoxStyle(BUILD_UI.filters.status),
              background: BUILD_UI.filters.controlBg,
              border: BUILD_UI.filters.controlBorder,
              boxShadow: BUILD_UI.filters.controlShadow,
              paddingLeft: uiPx(9),
              paddingRight: uiPx(7),
              fontFamily: UI_FONT,
              fontSize: uiPx(BUILD_UI.typography.filterPx),
            }}
          >
            <option value="all">Mọi trạng thái</option>
            <option value="ready">Đủ vật tư</option>
            <option value="built">Đã xây</option>
            <option value="missing">Thiếu vật tư</option>
          </select>

          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              ...rootBoxStyle(BUILD_UI.filters.count),
              background: BUILD_UI.filters.controlBg,
              border: BUILD_UI.filters.controlBorder,
              boxShadow: BUILD_UI.filters.controlShadow,
              color: '#9eada3',
              fontFamily: UI_FONT,
              fontSize: uiPx(BUILD_UI.typography.countPx),
            }}
          >
            <span className="whitespace-nowrap">
              {filteredBlueprints.length} công trình
            </span>
          </div>
        </>
      )}

      {/* =============================================================== */}
      {/* Scrollable building recipe viewport                              */}
      {/* =============================================================== */}
      {buildMode === 'build' && (
        <>
          <style>{`
            .building-recipe-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgba(86, 142, 112, 0.72) rgba(2, 22, 24, 0.34);
            }
            .building-recipe-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            .building-recipe-scrollbar::-webkit-scrollbar-track {
              background: rgba(2, 22, 24, 0.30);
              border-radius: 8px;
              box-shadow: inset 0 0 4px rgba(0,0,0,0.35);
            }
            .building-recipe-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(
                180deg,
                rgba(92, 151, 119, 0.78),
                rgba(52, 105, 83, 0.82)
              );
              border: 1px solid rgba(125, 177, 143, 0.20);
              border-radius: 8px;
            }
            .building-recipe-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(
                180deg,
                rgba(106, 171, 134, 0.88),
                rgba(61, 122, 96, 0.90)
              );
            }
            .building-material-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgba(84, 137, 109, 0.66) rgba(2, 20, 21, 0.22);
            }
            .building-material-scrollbar::-webkit-scrollbar {
              width: ${BUILD_UI.materialGrid.scrollbarWidthPx}px;
            }
            .building-material-scrollbar::-webkit-scrollbar-track {
              background: rgba(2, 20, 21, 0.22);
              border-radius: 6px;
            }
            .building-material-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(78, 137, 106, 0.72);
              border-radius: 6px;
            }
            .building-material-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(98, 164, 128, 0.84);
            }
          `}</style>

          <div
            ref={recipeScrollRef}
            className="absolute pointer-events-auto building-recipe-scrollbar"
            style={{
              ...rootBoxStyle(BUILD_UI.recipeViewport.box),
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain',
              padding: uiPx(BUILD_UI.recipeViewport.paddingPx),
            }}
          >
            {filteredBlueprints.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  alignItems: 'start',
                  columnGap: uiPx(BUILD_UI.recipeViewport.gapXPx),
                  rowGap: uiPx(BUILD_UI.recipeViewport.gapYPx),
                  paddingRight: uiPx(5),
                  paddingBottom: uiPx(8),
                }}
              >
                {filteredBlueprints.map((blueprint) => {
                  const existing = buildings.find((b) => b.buildingId === blueprint.id);
                  const isBuilt = existing?.isBuilt || false;
                  const isInProgress =
                    !isBuilt && !!existing && existing.buildProgressSeconds > 0;

                  let canAfford = true;
                  const materialStatus = blueprint.cost.map((req) => {
                    const stock = getItemStock(req.itemId);
                    const hasEnough = stock >= req.quantity;
                    if (!hasEnough) canAfford = false;

                    return {
                      ...req,
                      stock,
                      hasEnough,
                      name: ITEMS_DATABASE[req.itemId]?.name || req.itemId,
                    };
                  });

                  const isConstructible =
                    !isBuilt &&
                    canAfford &&
                    !isSurvivorBusy &&
                    !!chosenSurvivor;

                  const CategoryIcon = getCategoryIcon(blueprint.category);
                  const categoryColor = getCategoryColor(blueprint.category);
                  const preview = blueprint.ui?.preview;
                  const atlas =
                    preview?.type === 'atlas'
                      ? BUILDING_PREVIEW_ATLASES[preview.atlasId]
                      : undefined;
                  const atlasStyle =
                    preview?.type === 'atlas'
                      ? atlasSpriteStyle(preview.atlasId, preview.cell)
                      : undefined;

                  return (
                    <div
                      key={blueprint.id}
                      className="relative overflow-hidden"
                      style={{
                        minWidth: 0,
                        height: uiPx(BUILD_UI.cardDesign.heightPx),
                        background: BUILD_UI.cardStyle.bg,
                        borderRadius: uiPx(11),
                        boxShadow: BUILD_UI.cardStyle.shadow,
                        transition:
                          'box-shadow 140ms ease, background 140ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow =
                          BUILD_UI.cardStyle.hoverShadow;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow =
                          BUILD_UI.cardStyle.shadow;
                      }}
                    >
                      {/* Preview: fixed to the recipe-card height */}
                      <div
                        className="absolute overflow-hidden bg-[#0b1c1b]"
                        style={{
                          left: uiPx(BUILD_UI.content.image.x),
                          top: uiPx(BUILD_UI.content.image.y),
                          width: uiPx(BUILD_UI.content.image.w),
                          bottom: uiPx(BUILD_UI.content.imageBottomPx),
                          borderRadius: uiPx(
                            BUILD_UI.content.image.radiusPx ?? 0,
                          ),
                          border: 'none',
                          boxShadow:
                            'inset 0 5px 11px rgba(0,0,0,0.46), inset 0 0 0 1px rgba(52,99,80,0.20)',
                        }}
                      >
                        {preview?.type === 'atlas' &&
                        atlas &&
                        atlasStyle ? (
                          <img
                            src={atlas.src}
                            alt={blueprint.name}
                            style={atlasStyle}
                            draggable={false}
                            decoding="async"
                          />
                        ) : preview?.type === 'image' ? (
                          <img
                            src={preview.src}
                            alt={blueprint.name}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            style={{
                              objectPosition:
                                preview.objectPosition ?? 'center',
                            }}
                            draggable={false}
                            decoding="async"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#769386]">
                            <CategoryIcon
                              style={{
                                width: uiPx(48),
                                height: uiPx(48),
                                color: categoryColor,
                                opacity: 0.72,
                              }}
                              strokeWidth={1.45}
                            />
                            <span
                              className="uppercase tracking-wider"
                              style={{
                                fontSize: uiPx(9.5),
                                opacity: 0.72,
                              }}
                            >
                              {getCategoryLabel(
                                String(blueprint.category),
                              )}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-white/[0.02] pointer-events-none" />
                      </div>

                      {/* Title */}
                      <div
                        className="absolute truncate uppercase font-extrabold text-[#f1eddf]"
                        style={{
                          ...cardPxStyle(BUILD_UI.content.title),
                          fontSize: uiPx(
                            BUILD_UI.typography.titlePx,
                          ),
                          lineHeight: 1,
                          letterSpacing: '0.025em',
                          textShadow:
                            '0 1px 2px rgba(0,0,0,0.72)',
                        }}
                        title={blueprint.name}
                      >
                        {blueprint.name}
                      </div>

                      {/* Timer / completed badge */}
                      <div
                        className="absolute flex items-center justify-center gap-2"
                        style={{
                          ...cardPxStyle(BUILD_UI.content.timer),
                          border: `1px solid ${
                            isBuilt
                              ? 'rgba(58,157,101,0.72)'
                              : 'rgba(161,148,87,0.72)'
                          }`,
                          background: 'rgba(5, 28, 29, 0.56)',
                          color: isBuilt ? '#76e4a1' : '#f0c34d',
                          fontSize: uiPx(
                            BUILD_UI.typography.timerPx,
                          ),
                          fontWeight: 700,
                        }}
                      >
                        {isBuilt ? (
                          <>
                            <CheckCircle2
                              style={{
                                width: uiPx(13),
                                height: uiPx(13),
                              }}
                            />
                            <span>OK</span>
                          </>
                        ) : (
                          <>
                            <Clock3
                              style={{
                                width: uiPx(13),
                                height: uiPx(13),
                              }}
                            />
                            <span>{blueprint.buildTimeSeconds}s</span>
                          </>
                        )}
                      </div>

                      {/* Description */}
                      <div
                        className="absolute overflow-hidden text-[#c7d0c9]"
                        style={{
                          ...cardPxStyle(
                            BUILD_UI.content.description,
                          ),
                          fontSize: uiPx(
                            BUILD_UI.typography.bodyPx,
                          ),
                          lineHeight:
                            BUILD_UI.typography.bodyLineHeight,
                        }}
                      >
                        {blueprint.description}
                      </div>

                      {/* Benefit */}
                      <div
                        className="absolute flex items-center"
                        style={{
                          ...cardPxStyle(BUILD_UI.content.benefit),
                          gap: uiPx(9),
                          paddingLeft: uiPx(10),
                          paddingRight: uiPx(10),
                          background: 'rgba(4, 31, 31, 0.54)',
                          border:
                            '1px solid rgba(134, 119, 75, 0.66)',
                          color: '#edf2e9',
                        }}
                      >
                        <CategoryIcon
                          className="shrink-0"
                          style={{
                            width: uiPx(18),
                            height: uiPx(18),
                            color: categoryColor,
                            strokeWidth: 2.2,
                          }}
                        />
                        <span
                          className="overflow-hidden"
                          style={{
                            fontSize: uiPx(
                              BUILD_UI.typography.benefitPx,
                            ),
                            lineHeight: 1.16,
                          }}
                        >
                          {blueprint.benefitsDescription}
                        </span>
                      </div>

                      {!isBuilt && (
                        <>
                          <div
                            className="absolute uppercase font-bold text-[#879b8c]"
                            style={{
                              ...cardPxStyle(
                                BUILD_UI.content.materialsLabel,
                              ),
                              fontSize: uiPx(
                                BUILD_UI.typography
                                  .materialLabelPx,
                              ),
                              lineHeight: 1,
                              letterSpacing: '0.14em',
                            }}
                          >
                            Vật tư thi công:
                          </div>

                          {/*
                            Fixed two-column materials viewport.
                            Two rows fit normally; recipes with more ingredients
                            get a tiny internal scrollbar instead of stretching
                            the entire recipe card.
                          */}
                          <div
                            className="absolute building-material-scrollbar"
                            style={{
                              left: uiPx(BUILD_UI.content.materials.x),
                              top: uiPx(BUILD_UI.content.materials.y),
                              width: uiPx(BUILD_UI.content.materials.w),
                              height: uiPx(BUILD_UI.content.materials.h),
                              overflowY: 'auto',
                              overflowX: 'hidden',
                              paddingRight: uiPx(
                                BUILD_UI.materialGrid.scrollbarRightPaddingPx,
                              ),
                            }}
                          >
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${BUILD_UI.materialGrid.columns}, minmax(0, 1fr))`,
                                gridAutoRows: uiPx(
                                  BUILD_UI.materialGrid.rowHeightPx,
                                ),
                                columnGap: uiPx(
                                  BUILD_UI.materialGrid.columnGapPx,
                                ),
                                rowGap: uiPx(
                                  BUILD_UI.materialGrid.rowGapPx,
                                ),
                                alignContent: 'start',
                              }}
                            >
                            {materialStatus.map((mat) => (
                              <div
                                key={mat.itemId}
                                className="flex items-center min-w-0"
                                title={`${mat.name}: ${mat.stock}/${mat.quantity}`}
                                style={{
                                  height: uiPx(
                                    BUILD_UI.materialChip.heightPx,
                                  ),
                                  gap: uiPx(
                                    BUILD_UI.materialChip.gapPx,
                                  ),
                                  paddingLeft: uiPx(
                                    BUILD_UI.materialChip.padXPx,
                                  ),
                                  paddingRight: uiPx(
                                    BUILD_UI.materialChip.padXPx,
                                  ),
                                  borderRadius: uiPx(
                                    BUILD_UI.materialChip.radiusPx,
                                  ),
                                  border: mat.hasEnough
                                    ? '1px solid rgba(27, 128, 92, 0.82)'
                                    : '1px solid rgba(145, 48, 48, 0.86)',
                                  background: mat.hasEnough
                                    ? 'rgba(7, 75, 48, 0.40)'
                                    : 'rgba(91, 19, 23, 0.42)',
                                  color: mat.hasEnough
                                    ? '#b6ecc5'
                                    : '#f29a9a',
                                  fontSize: uiPx(
                                    BUILD_UI.typography.materialPx,
                                  ),
                                  lineHeight: 1,
                                }}
                              >
                                <ItemIcon
                                  itemId={mat.itemId}
                                  size={
                                    BUILD_UI.materialChip.iconPx
                                  }
                                  className="shrink-0 object-contain"
                                />
                                <span
                                  className="truncate min-w-0"
                                  style={{
                                    maxWidth: uiPx(
                                      BUILD_UI.materialChip
                                        .nameMaxWidthPx,
                                    ),
                                  }}
                                >
                                  {mat.name}
                                </span>
                                <span className="shrink-0 ml-auto">
                                  {mat.stock}/{mat.quantity}
                                </span>
                              </div>
                            ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Footer status */}
                      <div
                        className="absolute flex items-center gap-2 text-[#a5b1a8]"
                        style={{
                          ...cardPxStyle(BUILD_UI.content.status),
                          fontSize: uiPx(
                            BUILD_UI.typography.statusPx,
                          ),
                          lineHeight: 1,
                        }}
                      >
                        {isBuilt ? (
                          <>
                            <CheckCircle2
                              style={{
                                width: uiPx(15),
                                height: uiPx(15),
                                color: '#55d98b',
                              }}
                            />
                            <span>
                              Công trình đang vận hành ổn định
                            </span>
                          </>
                        ) : (
                          <>
                            <Hammer
                              style={{
                                width: uiPx(15),
                                height: uiPx(15),
                                color: '#aab7b0',
                              }}
                            />
                            <span>
                              {isInProgress
                                ? 'Đang thi công...'
                                : isSurvivorBusy
                                  ? 'Thợ xây đang bận việc khác'
                                  : !canAfford
                                    ? 'Thiếu vật tư xây dựng'
                                    : 'Đủ điều kiện thi công'}
                            </span>
                          </>
                        )}
                      </div>

                      {!isBuilt && (
                        <button
                          type="button"
                          disabled={!isConstructible}
                          onClick={() =>
                            onStartConstruction(
                              assignedSurvivorId,
                              blueprint.id,
                            )
                          }
                          className="absolute transition-all duration-150"
                          style={{
                            ...cardPxStyle(BUILD_UI.content.buildButton),
                            border: isConstructible
                              ? '1px solid rgba(94, 143, 111, 0.72)'
                              : '1px solid rgba(95, 110, 101, 0.42)',
                            background: isConstructible
                              ? 'linear-gradient(180deg, rgba(44,83,64,0.72), rgba(26,54,43,0.74))'
                              : 'linear-gradient(180deg, rgba(52,68,61,0.30), rgba(35,48,43,0.32))',
                            color: isConstructible
                              ? '#e2ebe0'
                              : '#78857e',
                            boxShadow: isConstructible
                              ? 'inset 0 1px 0 rgba(255,255,255,0.055), 0 2px 5px rgba(0,0,0,0.20)'
                              : 'none',
                            fontFamily: UI_FONT,
                            fontSize: uiPx(
                              BUILD_UI.typography.buttonPx,
                            ),
                            fontWeight: 600,
                            cursor: isConstructible
                              ? 'pointer'
                              : 'not-allowed',
                          }}
                          onMouseEnter={(e) => {
                            if (isConstructible) {
                              e.currentTarget.style.background =
                                'linear-gradient(180deg, rgba(58,108,82,0.86), rgba(31,68,53,0.88))';
                              e.currentTarget.style.boxShadow =
                                'inset 0 1px 0 rgba(255,255,255,0.07), 0 0 9px rgba(73,190,119,0.18)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isConstructible) {
                              e.currentTarget.style.background =
                                'linear-gradient(180deg, rgba(44,83,64,0.72), rgba(26,54,43,0.74))';
                              e.currentTarget.style.boxShadow =
                                'inset 0 1px 0 rgba(255,255,255,0.055), 0 2px 5px rgba(0,0,0,0.20)';
                            }
                          }}
                        >
                          Bắt đầu xây dựng
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
                style={{
                  color: '#86988e',
                  background: 'rgba(2, 24, 25, 0.18)',
                  boxShadow:
                    'inset 0 7px 18px rgba(0,0,0,0.24)',
                }}
              >
                <div
                  className="font-bold text-[#dfe6dd]"
                  style={{
                    fontSize: uiPx(
                      BUILD_UI.typography.emptyTitlePx,
                    ),
                    lineHeight: 1,
                  }}
                >
                  Không có công trình phù hợp
                </div>
                <div
                  style={{
                    marginTop: uiPx(9),
                    fontSize: uiPx(
                      BUILD_UI.typography.emptyBodyPx,
                    ),
                    lineHeight: 1.3,
                  }}
                >
                  Thử đổi nhóm, trạng thái hoặc từ khóa tìm kiếm.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {buildMode === 'upgrade' && (
        <div
          className="absolute pointer-events-auto"
          style={{
            ...rootBoxStyle(BUILD_UI.upgradePlaceholder.panel),
            background:
              'linear-gradient(180deg, rgba(2,28,29,0.32) 0%, rgba(2,22,24,0.48) 100%)',
            boxShadow:
              'inset 0 7px 18px rgba(0,0,0,0.46), inset 0 -1px 0 rgba(120,155,132,0.045), inset 0 0 0 1px rgba(34,78,68,0.22)',
          }}
        >
          <Wrench
            className="absolute text-[#69d79a]"
            style={{
              ...rootBoxStyle(BUILD_UI.upgradePlaceholder.icon),
              strokeWidth: 1.8,
              opacity: 0.72,
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            }}
          />

          <div
            className="absolute text-center font-bold text-[#e3e7dd]"
            style={{
              ...rootBoxStyle(BUILD_UI.upgradePlaceholder.title),
              fontSize: uiPx(BUILD_UI.typography.upgradePlaceholderTitlePx),
              lineHeight: 1,
              letterSpacing: '0.025em',
              textShadow: '0 1px 2px rgba(0,0,0,0.72)',
            }}
          >
            Hệ thống nâng cấp công trình
          </div>

          <div
            className="absolute text-center text-[#93a198]"
            style={{
              ...rootBoxStyle(BUILD_UI.upgradePlaceholder.text),
              fontSize: uiPx(BUILD_UI.typography.upgradePlaceholderBodyPx),
              lineHeight: 1.35,
            }}
          >
            Placeholder — dữ liệu cấp độ, chi phí nâng cấp và hiệu ứng công trình sẽ được bổ sung sau.
          </div>
        </div>
      )}
    </div>
  );
};
