import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CheckCircle2,
  Clock3,
  Droplets,
  Flame,
  Hammer,
  Home,
  MapPin,
  Move,
  Package,
  Plus,
  Trash2,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { GameState } from '../../types';
import {
  BUILDING_CATEGORY_LABELS,
  getBuildingCategories,
  getBuildingRecipes,
  type BuildingRecipeDefinition,
} from '../../data/buildings';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';

interface BuildingsViewProps {
  state: GameState;
  /**
   * plotId is optional for backward compatibility with the existing game handler.
   * The current prototype passes it, but older handlers can simply ignore it.
   */
  onStartConstruction: (survivorId: string, buildingId: string, plotId?: string) => void;
}

type UiBox = { x: number; y: number; w: number; h: number; radiusPx?: number };
type PlotSize = 'small' | 'medium' | 'large';

type CampPlot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: PlotSize;
};

const UI_FONT =
  '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * ============================================================================
 * BUILDING MANAGEMENT — MAP PROTOTYPE
 * ============================================================================
 * Asset strategy for now:
 * - CAMP_BASE_MAP_SRC = null -> CSS terrain placeholder.
 * - BUILDING_MAP_SPRITES is empty -> each building uses a DOM/icon placeholder.
 *
 * Later, adding real art only requires filling the map source and sprite table.
 * ============================================================================
 */

const CAMP_BASE_MAP_SRC: string | null = null;

const BUILDING_MAP_SPRITES: Record<
  string,
  { src: string; objectPosition?: string; scale?: number }
> = {
  // BUILDING_CAMPFIRE_HEARTH: {
  //   src: '/ui/buildings/map/campfire.webp',
  //   scale: 1,
  // },
};

const BUILD_UI = {
  reference: { width: 1448, height: 1086 },

  // Geometry is tuned against the same 1448 x 1086 management frame used by
  // the other camp tabs. The left/center work area stays broad, while the
  // right rail is wide enough to keep labels readable without tiny text.
  header: { x: 78, y: 190, w: 974, h: 72 },
  categoryTabs: { x: 78, y: 270, w: 974, h: 44 },
  blueprintRail: { x: 78, y: 322, w: 974, h: 128, radiusPx: 9 },

  mapPanel: { x: 78, y: 460, w: 610, h: 490, radiusPx: 10 },
  detailPanel: { x: 698, y: 460, w: 354, h: 490, radiusPx: 10 },

  rightColumn: { x: 1064, y: 190, w: 316, h: 760 },
  campInfo: { x: 1064, y: 190, w: 316, h: 174, radiusPx: 10 },
  queue: { x: 1064, y: 374, w: 316, h: 242, radiusPx: 10 },
  resources: { x: 1064, y: 626, w: 316, h: 170, radiusPx: 10 },
  workers: { x: 1064, y: 806, w: 316, h: 144, radiusPx: 10 },
} as const;

const CAMP_PLOTS: CampPlot[] = [
  { id: 'PLOT_NW_01', x: 18, y: 23, w: 14, h: 14, size: 'medium' },
  { id: 'PLOT_N_02', x: 47, y: 18, w: 12, h: 12, size: 'small' },
  { id: 'PLOT_NE_03', x: 72, y: 26, w: 16, h: 14, size: 'medium' },
  { id: 'PLOT_W_04', x: 16, y: 52, w: 12, h: 12, size: 'small' },
  { id: 'PLOT_C_05', x: 43, y: 48, w: 14, h: 14, size: 'medium' },
  { id: 'PLOT_E_06', x: 73, y: 52, w: 12, h: 12, size: 'small' },
  { id: 'PLOT_SW_07', x: 22, y: 76, w: 16, h: 14, size: 'medium' },
  { id: 'PLOT_S_08', x: 48, y: 76, w: 18, h: 15, size: 'large' },
  { id: 'PLOT_SE_09', x: 76, y: 76, w: 16, h: 14, size: 'medium' },
  { id: 'PLOT_INNER_10', x: 57, y: 33, w: 11, h: 11, size: 'small' },
  { id: 'PLOT_INNER_11', x: 33, y: 34, w: 11, h: 11, size: 'small' },
  { id: 'PLOT_INNER_12', x: 61, y: 64, w: 11, h: 11, size: 'small' },
];

const rootBoxStyle = (box: UiBox): React.CSSProperties => ({
  left: `${(box.x / BUILD_UI.reference.width) * 100}%`,
  top: `${(box.y / BUILD_UI.reference.height) * 100}%`,
  width: `${(box.w / BUILD_UI.reference.width) * 100}%`,
  height: `${(box.h / BUILD_UI.reference.height) * 100}%`,
  borderRadius: box.radiusPx ?? 0,
});

const uiPx = (px: number) => `${(px / BUILD_UI.reference.width) * 100}cqw`;

/**
 * Text must remain legible when the management frame scales down.
 * Pure cqw made 9-12px design text collapse to ~7-9px on common laptop sizes.
 * This helper keeps responsive scaling but enforces a practical minimum size.
 */
const uiFont = (designPx: number, minPx: number, maxPx = designPx) =>
  `clamp(${minPx}px, ${uiPx(designPx)}, ${maxPx}px)`;

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'food':
      return Flame;
    case 'shelter':
      return Home;
    case 'storage':
      return Package;
    case 'water':
      return Droplets;
    case 'production':
      return Wrench;
    case 'infrastructure':
      return Hammer;
    default:
      return Box;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'food':
      return '#f59e0b';
    case 'shelter':
      return '#f0cf69';
    case 'storage':
      return '#d9ad55';
    case 'water':
      return '#5bc5e8';
    case 'production':
      return '#9dd08c';
    default:
      return '#8dc7ab';
  }
};

const titleCaseCategory = (category: string) =>
  category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getCategoryLabel = (category: string) =>
  BUILDING_CATEGORY_LABELS[category] ?? titleCaseCategory(category);

const panelStyle: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(3, 29, 28, 0.62) 0%, rgba(2, 21, 21, 0.74) 100%)',
  border: '1px solid rgba(51, 88, 72, 0.30)',
  boxShadow:
    'inset 0 8px 18px rgba(0,0,0,0.52), inset 0 -2px 0 rgba(118,156,132,0.025), inset 0 0 0 1px rgba(8,18,15,0.46)',
};

const sunkenStyle: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(2, 24, 23, 0.60) 0%, rgba(1, 17, 17, 0.76) 100%)',
  border: '1px solid rgba(49, 84, 69, 0.30)',
  boxShadow:
    'inset 0 6px 13px rgba(0,0,0,0.50), inset 0 -1px 0 rgba(131,166,143,0.025), inset 0 0 0 1px rgba(8,20,16,0.32)',
};

const recessedHeaderStyle: React.CSSProperties = {
  background: 'rgba(2, 24, 23, 0.34)',
  borderBottom: '1px solid rgba(64, 99, 82, 0.32)',
  boxShadow: 'inset 0 -3px 7px rgba(0,0,0,0.24)',
};

export const BuildingsView: React.FC<BuildingsViewProps> = ({
  state,
  onStartConstruction,
}) => {
  const { buildings, inventory, survivors } = state;

  const allBlueprints = useMemo(() => getBuildingRecipes(), []);
  const categories = useMemo(() => getBuildingCategories(), []);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(
    allBlueprints[0]?.id ?? '',
  );
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [assignedSurvivorId, setAssignedSurvivorId] = useState(
    survivors[0]?.id ?? '',
  );

  /**
   * Prototype-only placement memory.
   * This lets the selected plot survive while state updates after pressing Build.
   * The final system should move this to ConstructedBuilding.plotId in GameState.
   */
  const [plannedPlotByBuildingId, setPlannedPlotByBuildingId] = useState<
    Record<string, string>
  >({});

  const visibleBlueprints = useMemo(() => {
    if (categoryFilter === 'all') return allBlueprints;
    return allBlueprints.filter(
      (blueprint) => String(blueprint.category) === categoryFilter,
    );
  }, [allBlueprints, categoryFilter]);

  useEffect(() => {
    if (
      visibleBlueprints.length > 0 &&
      !visibleBlueprints.some((b) => b.id === selectedBlueprintId)
    ) {
      setSelectedBlueprintId(visibleBlueprints[0].id);
      setSelectedBuildingId(null);
      setSelectedPlotId(null);
    }
  }, [visibleBlueprints, selectedBlueprintId]);

  useEffect(() => {
    if (
      assignedSurvivorId &&
      survivors.some((survivor) => survivor.id === assignedSurvivorId)
    ) {
      return;
    }
    setAssignedSurvivorId(survivors[0]?.id ?? '');
  }, [assignedSurvivorId, survivors]);

  const selectedBlueprint =
    allBlueprints.find((blueprint) => blueprint.id === selectedBlueprintId) ??
    allBlueprints[0];

  const selectedBuilding = selectedBuildingId
    ? buildings.find((building) => building.id === selectedBuildingId)
    : undefined;

  const getItemStock = (itemId: string) => {
    let total = 0;
    for (const item of inventory.items) {
      if (item.itemId === itemId) total += item.quantity;
    }
    return total;
  };

  const materialStatus = useMemo(() => {
    if (!selectedBlueprint) return [];
    return selectedBlueprint.cost.map((req) => {
      const stock = getItemStock(req.itemId);
      return {
        ...req,
        stock,
        hasEnough: stock >= req.quantity,
        name: ITEMS_DATABASE[req.itemId]?.name ?? req.itemId,
      };
    });
  }, [selectedBlueprint, inventory.items]);

  const canAffordSelected = materialStatus.every((material) => material.hasEnough);
  const chosenSurvivor = survivors.find(
    (survivor) => survivor.id === assignedSurvivorId,
  );
  const chosenSurvivorIdle = chosenSurvivor?.currentAction.type === 'idle';

  /**
   * Existing saves do not contain plotId yet, so buildings are assigned to the
   * first free prototype plot. A locally planned plot wins when available.
   */
  const buildingPlacements = useMemo(() => {
    const used = new Set<string>();
    const placement = new Map<string, CampPlot>();

    buildings.forEach((building, index) => {
      const preferredId = plannedPlotByBuildingId[building.buildingId];
      const preferred = preferredId
        ? CAMP_PLOTS.find((plot) => plot.id === preferredId)
        : undefined;

      let plot = preferred && !used.has(preferred.id) ? preferred : undefined;

      if (!plot) {
        const wrappedStart = index % CAMP_PLOTS.length;
        for (let offset = 0; offset < CAMP_PLOTS.length; offset += 1) {
          const candidate = CAMP_PLOTS[(wrappedStart + offset) % CAMP_PLOTS.length];
          if (!used.has(candidate.id)) {
            plot = candidate;
            break;
          }
        }
      }

      if (plot) {
        used.add(plot.id);
        placement.set(building.id, plot);
      }
    });

    return placement;
  }, [buildings, plannedPlotByBuildingId]);

  const buildingByPlotId = useMemo(() => {
    const result = new Map<string, GameState['buildings'][number]>();
    buildings.forEach((building) => {
      const plot = buildingPlacements.get(building.id);
      if (plot) result.set(plot.id, building);
    });
    return result;
  }, [buildings, buildingPlacements]);

  const builtCount = buildings.filter((building) => building.isBuilt).length;
  const constructionQueue = buildings.filter((building) => !building.isBuilt);
  const idleSurvivors = survivors.filter(
    (survivor) => survivor.currentAction.type === 'idle',
  ).length;
  const buildingWorkers = survivors.filter(
    (survivor) => survivor.currentAction.type === 'building',
  ).length;
  const gatheringWorkers = survivors.filter(
    (survivor) => survivor.currentAction.type === 'gathering',
  ).length;
  const craftingWorkers = survivors.filter(
    (survivor) => survivor.currentAction.type === 'crafting',
  ).length;
  const exploringWorkers = survivors.filter(
    (survivor) => survivor.currentAction.type === 'on_expedition',
  ).length;

  const resourceSummary = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of inventory.items) {
      totals.set(item.itemId, (totals.get(item.itemId) ?? 0) + item.quantity);
    }

    return [...totals.entries()]
      .map(([itemId, quantity]) => ({
        itemId,
        quantity,
        name: ITEMS_DATABASE[itemId]?.name ?? itemId,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [inventory.items]);

  const selectedPlot = selectedPlotId
    ? CAMP_PLOTS.find((plot) => plot.id === selectedPlotId)
    : undefined;
  const selectedPlotOccupied = selectedPlot
    ? buildingByPlotId.has(selectedPlot.id)
    : false;

  const canBuild =
    !!selectedBlueprint &&
    !!selectedPlot &&
    !selectedPlotOccupied &&
    canAffordSelected &&
    !!chosenSurvivor &&
    chosenSurvivorIdle;

  const handleBlueprintSelect = (blueprint: BuildingRecipeDefinition) => {
    setSelectedBlueprintId(blueprint.id);
    setSelectedBuildingId(null);
    setSelectedPlotId(null);
  };

  const handlePlotClick = (plot: CampPlot) => {
    const occupyingBuilding = buildingByPlotId.get(plot.id);
    setSelectedPlotId(plot.id);

    if (occupyingBuilding) {
      setCategoryFilter('all');
      setSelectedBuildingId(occupyingBuilding.id);
      setSelectedBlueprintId(occupyingBuilding.buildingId);
      return;
    }

    setSelectedBuildingId(null);
  };

  const handleBuild = () => {
    if (!canBuild || !selectedBlueprint || !selectedPlot) return;

    setPlannedPlotByBuildingId((current) => ({
      ...current,
      [selectedBlueprint.id]: selectedPlot.id,
    }));

    onStartConstruction(
      assignedSurvivorId,
      selectedBlueprint.id,
      selectedPlot.id,
    );
  };

  const selectedCategory = selectedBlueprint
    ? String(selectedBlueprint.category)
    : 'production';
  const SelectedCategoryIcon = getCategoryIcon(selectedCategory);
  const selectedCategoryColor = getCategoryColor(selectedCategory);

  const selectedBuildingProgress = selectedBuilding
    ? selectedBuilding.totalBuildSeconds > 0
      ? Math.min(
          100,
          Math.round(
            (selectedBuilding.buildProgressSeconds /
              selectedBuilding.totalBuildSeconds) *
              100,
          ),
        )
      : 0
    : 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ fontFamily: UI_FONT }}
    >
      <style>{`
        .build-ui-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(104, 145, 115, 0.80) rgba(2, 18, 18, 0.40);
        }
        .build-ui-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
        .build-ui-scroll::-webkit-scrollbar-track {
          background: rgba(2, 18, 18, 0.40);
          border-radius: 999px;
        }
        .build-ui-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(104,145,115,0.88), rgba(58,101,81,0.92));
          border-radius: 999px;
          border: 1px solid rgba(151,178,148,0.15);
        }
        .build-ui-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(124,166,132,0.94), rgba(69,116,91,0.96));
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* LEFT / CENTER: HEADER                                               */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto flex items-center justify-between px-4"
        style={{ ...rootBoxStyle(BUILD_UI.header), ...panelStyle }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 flex items-center justify-center rounded-md"
            style={{
              width: uiPx(44),
              height: uiPx(44),
              ...sunkenStyle,
            }}
          >
            <Hammer
              style={{ width: uiPx(25), height: uiPx(25), color: '#74d79b' }}
            />
          </div>
          <div className="min-w-0">
            <div
              className="uppercase font-extrabold tracking-wide text-[#f1eadb]"
              style={{ fontSize: uiFont(27, 20, 28), lineHeight: 1 }}
            >
              Quản lý xây dựng
            </div>
            <div
              className="text-[#a9b8ad] truncate"
              style={{ fontSize: uiFont(14, 12, 14.5), marginTop: uiPx(6), lineHeight: 1.2 }}
            >
              Chọn công trình, bố trí vào khu trại và quản lý tiến độ thi công.
            </div>
          </div>
        </div>

        <div
          className="text-right text-[#7f9989] italic hidden lg:block"
          style={{ fontSize: uiFont(12.5, 10.5, 13) }}
        >
          Prototype layout — map và model sẽ thay bằng asset thật sau.
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CATEGORY TABS                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto flex gap-1.5"
        style={rootBoxStyle(BUILD_UI.categoryTabs)}
      >
        {['all', ...categories].map((category) => {
          const active = categoryFilter === category;
          const Icon = category === 'all' ? Box : getCategoryIcon(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className="flex-1 min-w-0 flex items-center justify-center gap-2 rounded-md transition-all"
              style={{
                background: active
                  ? 'linear-gradient(180deg, rgba(30,84,57,0.82), rgba(18,56,42,0.88))'
                  : 'linear-gradient(180deg, rgba(5,31,30,0.82), rgba(3,24,24,0.88))',
                border: active
                  ? '1px solid rgba(111,174,112,0.68)'
                  : '1px solid rgba(57,91,75,0.48)',
                boxShadow: active
                  ? 'inset 0 5px 10px rgba(0,0,0,0.42), inset 0 -1px 0 rgba(125,200,146,0.07), 0 0 7px rgba(69,177,103,0.06)'
                  : 'inset 0 5px 10px rgba(0,0,0,0.44), inset 0 -1px 0 rgba(255,255,255,0.018)',
                color: active ? '#e6eddc' : '#a9b6ac',
                fontSize: uiFont(13.5, 11.5, 14),
                fontWeight: active ? 750 : 650,
              }}
            >
              <Icon style={{ width: uiPx(16), height: uiPx(16) }} />
              <span className="truncate">
                {category === 'all' ? 'Tất cả' : getCategoryLabel(category)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BLUEPRINT SELECTOR RAIL                                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto build-ui-scroll overflow-x-auto overflow-y-hidden p-2.5"
        style={{ ...rootBoxStyle(BUILD_UI.blueprintRail), ...sunkenStyle }}
      >
        <div className="flex gap-2.5 h-full min-w-max">
          {visibleBlueprints.map((blueprint) => {
            const category = String(blueprint.category);
            const Icon = getCategoryIcon(category);
            const color = getCategoryColor(category);
            const selected = selectedBlueprintId === blueprint.id && !selectedBuildingId;
            const matchingBuildings = buildings.filter(
              (building) => building.buildingId === blueprint.id,
            );
            const built = matchingBuildings.some((building) => building.isBuilt);
            const building = matchingBuildings[0];
            const inProgress = !!building && !building.isBuilt;

            return (
              <button
                key={blueprint.id}
                type="button"
                onClick={() => handleBlueprintSelect(blueprint)}
                className="relative shrink-0 h-full rounded-md flex flex-col items-center justify-between px-2 py-2 transition-all"
                style={{
                  width: uiPx(152),
                  background: selected
                    ? 'linear-gradient(180deg, rgba(31,73,52,0.94), rgba(12,42,35,0.96))'
                    : 'linear-gradient(180deg, rgba(5,31,30,0.92), rgba(3,22,22,0.95))',
                  border: selected
                    ? '1px solid rgba(231,188,74,0.92)'
                    : '1px solid rgba(73,104,85,0.50)',
                  boxShadow: selected
                    ? '0 0 11px rgba(236,184,56,0.15), inset 0 0 0 1px rgba(246,211,112,0.08)'
                    : 'inset 0 3px 8px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-md"
                  style={{
                    width: uiPx(66),
                    height: uiPx(54),
                    background:
                      'radial-gradient(circle at 50% 35%, rgba(74,115,79,0.34), rgba(4,24,23,0.80) 70%)',
                    border: '1px solid rgba(74,103,84,0.34)',
                  }}
                >
                  <Icon
                    style={{ width: uiPx(38), height: uiPx(38), color, strokeWidth: 1.45 }}
                  />
                </div>

                <div className="w-full text-center min-w-0">
                  <div
                    className="truncate font-bold text-[#e9e1d1]"
                    style={{ fontSize: uiFont(13.5, 11.5, 14), lineHeight: 1.08 }}
                    title={blueprint.name}
                  >
                    {blueprint.name}
                  </div>
                  <div
                    className="truncate text-[#859a8d]"
                    style={{ fontSize: uiFont(11.5, 10, 12), marginTop: uiPx(3) }}
                  >
                    {getCategoryLabel(category)}
                  </div>
                </div>

                {(built || inProgress) && (
                  <div
                    className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                    style={{
                      width: uiPx(18),
                      height: uiPx(18),
                      background: built ? '#17613b' : '#735b18',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                    title={built ? 'Đã xây' : 'Đang thi công'}
                  >
                    {built ? (
                      <CheckCircle2
                        style={{ width: uiPx(12), height: uiPx(12), color: '#8ae5a7' }}
                      />
                    ) : (
                      <Clock3
                        style={{ width: uiPx(11), height: uiPx(11), color: '#f2cb61' }}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CAMP LAYOUT MAP                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto overflow-hidden"
        style={{ ...rootBoxStyle(BUILD_UI.mapPanel), ...panelStyle, overflow: 'hidden' }}
      >
        <div
          className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3"
          style={{
            height: uiPx(46),
            background:
              'linear-gradient(180deg, rgba(3,26,25,0.97), rgba(3,26,25,0.72), transparent)',
          }}
        >
          <div className="flex items-center gap-2">
            <MapPin
              style={{ width: uiPx(15), height: uiPx(15), color: '#e8d08a' }}
            />
            <span
              className="uppercase font-bold tracking-wide text-[#e9e3d7]"
              style={{ fontSize: uiFont(14.5, 12, 15) }}
            >
              Camp Layout
            </span>
          </div>
          <div
            className="flex items-center gap-3 text-[#aab9ad]"
            style={{ fontSize: uiFont(11.8, 10.5, 12.2) }}
          >
            <span>{builtCount} công trình</span>
            <span>{CAMP_PLOTS.length - buildingByPlotId.size} ô trống</span>
          </div>
        </div>

        {/* Replace this entire background layer with the final base-camp image later. */}
        {CAMP_BASE_MAP_SRC ? (
          <img
            src={CAMP_BASE_MAP_SRC}
            alt="Camp base layout"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 50% 53%, rgba(132,111,66,0.70) 0%, rgba(94,79,48,0.68) 30%, rgba(42,68,42,0.62) 56%, transparent 72%),
                radial-gradient(circle at 12% 18%, rgba(34,92,48,0.75) 0 9%, transparent 10%),
                radial-gradient(circle at 85% 22%, rgba(28,85,43,0.78) 0 10%, transparent 11%),
                radial-gradient(circle at 10% 78%, rgba(30,83,42,0.78) 0 12%, transparent 13%),
                radial-gradient(circle at 90% 76%, rgba(25,78,39,0.80) 0 13%, transparent 14%),
                linear-gradient(155deg, #183d2c 0%, #244b32 42%, #173426 100%)
              `,
            }}
          >
            <div
              className="absolute rounded-full opacity-30"
              style={{
                left: '9%',
                top: '14%',
                width: '82%',
                height: '74%',
                border: '1px dashed rgba(221,194,106,0.60)',
                boxShadow: 'inset 0 0 40px rgba(197,167,87,0.07)',
              }}
            />
            <div
              className="absolute left-[8%] right-[8%] bottom-[7%] text-center text-[#d4c694]/55 uppercase tracking-[0.25em]"
              style={{ fontSize: uiFont(10.8, 9.5, 11) }}
            >
              Base map placeholder
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15 pointer-events-none" />

        {/* Fixed prototype plots */}
        {CAMP_PLOTS.map((plot) => {
          const building = buildingByPlotId.get(plot.id);
          const isSelectedPlot = selectedPlotId === plot.id;
          const isBuildTarget = !building && !!selectedBlueprint && !selectedBuildingId;

          const buildingDef = building
            ? allBlueprints.find((blueprint) => blueprint.id === building.buildingId)
            : undefined;
          const category = buildingDef ? String(buildingDef.category) : 'production';
          const Icon = getCategoryIcon(category);
          const categoryColor = getCategoryColor(category);
          const sprite = building ? BUILDING_MAP_SPRITES[building.buildingId] : undefined;

          const progress = building
            ? building.totalBuildSeconds > 0
              ? Math.min(
                  100,
                  Math.round(
                    (building.buildProgressSeconds / building.totalBuildSeconds) * 100,
                  ),
                )
              : 0
            : 0;

          return (
            <button
              key={plot.id}
              type="button"
              onClick={() => handlePlotClick(plot)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md transition-all group"
              style={{
                left: `${plot.x}%`,
                top: `${plot.y}%`,
                width: `${plot.w}%`,
                height: `${plot.h}%`,
                border: building
                  ? isSelectedPlot
                    ? '2px solid rgba(248,203,77,0.92)'
                    : '1px solid rgba(255,255,255,0.04)'
                  : isSelectedPlot
                    ? '2px solid rgba(248,203,77,0.95)'
                    : isBuildTarget
                      ? '1px dashed rgba(226,225,207,0.78)'
                      : '1px dashed rgba(214,215,198,0.30)',
                background: building
                  ? 'rgba(5,24,19,0.18)'
                  : isSelectedPlot
                    ? 'rgba(224,181,55,0.14)'
                    : isBuildTarget
                      ? 'rgba(238,240,220,0.05)'
                      : 'rgba(0,0,0,0.05)',
                boxShadow: isSelectedPlot
                  ? '0 0 12px rgba(239,188,53,0.28)'
                  : 'none',
              }}
              title={
                building
                  ? buildingDef?.name ?? building.buildingId
                  : `${plot.id} • ${plot.size}`
              }
            >
              {building ? (
                sprite ? (
                  <img
                    src={sprite.src}
                    alt={buildingDef?.name ?? building.buildingId}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{
                      objectPosition: sprite.objectPosition ?? 'center',
                      transform: `scale(${sprite.scale ?? 1})`,
                      opacity: building.isBuilt ? 1 : 0.55,
                    }}
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: '58%',
                        aspectRatio: '1 / 1',
                        maxHeight: '68%',
                        background:
                          'radial-gradient(circle at 45% 35%, rgba(96,126,86,0.92), rgba(18,46,35,0.96) 72%)',
                        border: '1px solid rgba(214,204,156,0.32)',
                        boxShadow:
                          '0 4px 8px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04)',
                        opacity: building.isBuilt ? 1 : 0.55,
                      }}
                    >
                      <Icon
                        style={{
                          width: '52%',
                          height: '52%',
                          color: categoryColor,
                          strokeWidth: 1.5,
                        }}
                      />
                    </div>
                    <div
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[#eee8db]"
                      style={{
                        fontSize: uiFont(10.5, 9.5, 11),
                        background: 'rgba(1,15,14,0.86)',
                        border: '1px solid rgba(80,107,87,0.55)',
                      }}
                    >
                      {buildingDef?.name ?? 'Công trình'}
                    </div>
                  </div>
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Plus
                    style={{
                      width: '28%',
                      height: '28%',
                      color: isSelectedPlot
                        ? '#f2cf62'
                        : isBuildTarget
                          ? 'rgba(230,230,215,0.82)'
                          : 'rgba(210,214,201,0.38)',
                    }}
                  />
                </div>
              )}

              {building && !building.isBuilt && (
                <div className="absolute left-[12%] right-[12%] bottom-[5%] h-[6px] rounded-full overflow-hidden bg-black/55 border border-white/10 pointer-events-none">
                  <div
                    className="h-full bg-amber-400/80"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BUILDING DETAILS                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto overflow-hidden flex flex-col"
        style={{ ...rootBoxStyle(BUILD_UI.detailPanel), ...panelStyle }}
      >
        {selectedBlueprint ? (
          <>
            <div
              className="px-3 flex items-center justify-between shrink-0"
              style={{
                height: uiPx(50),
                ...recessedHeaderStyle,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <SelectedCategoryIcon
                  style={{
                    width: uiPx(19),
                    height: uiPx(19),
                    color: selectedCategoryColor,
                  }}
                />
                <div
                  className="font-extrabold uppercase text-[#f0eadf] truncate"
                  style={{ fontSize: uiFont(18, 14, 18.5) }}
                >
                  {selectedBlueprint.name}
                </div>
              </div>
              <div
                className="rounded px-2 py-1 uppercase font-bold shrink-0"
                style={{
                  fontSize: uiFont(11.2, 9.8, 11.5),
                  color: selectedCategoryColor,
                  border: `1px solid ${selectedCategoryColor}55`,
                  background: 'rgba(0,0,0,0.18)',
                }}
              >
                {getCategoryLabel(selectedCategory)}
              </div>
            </div>

            <div className="flex-1 min-h-0 p-3 flex flex-col gap-2.5">
              {/* Building/map-art placeholder */}
              <div
                className="relative shrink-0 rounded-md overflow-hidden flex items-center justify-center"
                style={{ height: uiPx(96), ...sunkenStyle }}
              >
                <SelectedCategoryIcon
                  style={{
                    width: uiPx(54),
                    height: uiPx(54),
                    color: selectedCategoryColor,
                    opacity: 0.76,
                    strokeWidth: 1.35,
                  }}
                />
                <div
                  className="absolute bottom-2 right-2 uppercase tracking-wider text-[#9bad9f]"
                  style={{ fontSize: uiFont(10.5, 9.5, 11) }}
                >
                  model placeholder
                </div>
              </div>

              <div
                className="text-[#c2cec5] overflow-hidden"
                style={{ fontSize: uiFont(13, 11.5, 13.5), lineHeight: 1.32, minHeight: uiPx(40) }}
              >
                {selectedBlueprint.description}
              </div>

              <div className="grid grid-cols-2 gap-1.5 shrink-0">
                <div
                  className="rounded px-2 py-1.5 flex items-center justify-between"
                  style={sunkenStyle}
                >
                  <span className="text-[#8fa398]" style={{ fontSize: uiFont(11.5, 10.2, 12) }}>
                    Thời gian
                  </span>
                  <span className="text-amber-300 font-bold" style={{ fontSize: uiFont(12, 10.5, 12.5) }}>
                    {selectedBlueprint.buildTimeSeconds}s
                  </span>
                </div>
                <div
                  className="rounded px-2 py-1.5 flex items-center justify-between"
                  style={sunkenStyle}
                >
                  <span className="text-[#8fa398]" style={{ fontSize: uiFont(11.5, 10.2, 12) }}>
                    Vị trí
                  </span>
                  <span
                    className="text-[#e4ddcd] font-bold truncate ml-2"
                    style={{ fontSize: uiFont(11.8, 10.3, 12.2) }}
                  >
                    {selectedPlot?.id ?? 'Chưa chọn'}
                  </span>
                </div>
              </div>

              {selectedBuilding ? (
                <>
                  <div
                    className="rounded p-2"
                    style={{ ...sunkenStyle, minHeight: uiPx(62) }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[#9eafa4]" style={{ fontSize: uiFont(11.5, 10.2, 12) }}>
                        Trạng thái
                      </span>
                      <span
                        className="font-bold"
                        style={{
                          fontSize: uiFont(12, 10.5, 12.5),
                          color: selectedBuilding.isBuilt ? '#7ae09b' : '#f1c75f',
                        }}
                      >
                        {selectedBuilding.isBuilt ? 'Đã hoàn thiện' : 'Đang thi công'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[#9eafa4]" style={{ fontSize: uiFont(11.5, 10.2, 12) }}>
                        Độ bền
                      </span>
                      <span className="text-[#e8e2d4] font-bold" style={{ fontSize: uiFont(12, 10.5, 12.5) }}>
                        {Math.round(selectedBuilding.condition)} / 100
                      </span>
                    </div>
                    {!selectedBuilding.isBuilt && (
                      <div className="mt-2 h-1.5 rounded-full bg-black/50 overflow-hidden border border-white/10">
                        <div
                          className="h-full bg-amber-400/85"
                          style={{ width: `${selectedBuildingProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-1.5">
                    {[
                      ['Nâng cấp', Wrench],
                      ['Di chuyển', Move],
                      ['Phân công', Users],
                      ['Tháo dỡ', Trash2],
                    ].map(([label, Icon]) => (
                      <button
                        key={String(label)}
                        type="button"
                        disabled
                        className="rounded flex items-center justify-center gap-1.5 opacity-55 cursor-not-allowed"
                        style={{
                          height: uiPx(38),
                          ...sunkenStyle,
                          color: label === 'Tháo dỡ' ? '#e78080' : '#c9d3ca',
                          fontSize: uiFont(12, 10.5, 12.5),
                        }}
                        title="Prototype — chức năng sẽ nối sau"
                      >
                        <Icon style={{ width: uiPx(13), height: uiPx(13) }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="shrink-0">
                    <div
                      className="uppercase tracking-wider font-bold text-[#9aac9f] mb-1.5"
                      style={{ fontSize: uiFont(11.2, 10, 11.6) }}
                    >
                      Vật tư yêu cầu
                    </div>
                    <div className="build-ui-scroll overflow-y-auto pr-1 flex flex-col gap-1"
                      style={{ maxHeight: uiPx(112) }}>
                      {materialStatus.map((material) => (
                        <div
                          key={material.itemId}
                          className="rounded px-2 py-1.5 flex items-center gap-2"
                          style={{
                            ...sunkenStyle,
                            borderColor: material.hasEnough
                              ? 'rgba(54,119,78,0.52)'
                              : 'rgba(141,66,62,0.62)',
                          }}
                        >
                          <ItemIcon
                            itemId={material.itemId}
                            size={20}
                            className="shrink-0 object-contain"
                          />
                          <span
                            className="truncate flex-1 text-[#cbd4cc]"
                            style={{ fontSize: uiFont(11.8, 10.3, 12.2) }}
                          >
                            {material.name}
                          </span>
                          <span
                            className="font-mono font-bold shrink-0"
                            style={{
                              fontSize: uiFont(11.8, 10.3, 12.2),
                              color: material.hasEnough ? '#81dda0' : '#e58884',
                            }}
                          >
                            {material.stock}/{material.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col gap-1.5">
                    <select
                      value={assignedSurvivorId}
                      onChange={(e) => setAssignedSurvivorId(e.target.value)}
                      className="w-full rounded outline-none cursor-pointer text-[#e6e2d7]"
                      style={{
                        height: uiPx(36),
                        paddingLeft: uiPx(8),
                        paddingRight: uiPx(8),
                        background: 'rgba(3,25,24,0.92)',
                        border: '1px solid rgba(73,105,85,0.62)',
                        fontFamily: UI_FONT,
                        fontSize: uiFont(12, 10.5, 12.5),
                      }}
                    >
                      {survivors.map((survivor) => (
                        <option key={survivor.id} value={survivor.id}>
                          {survivor.name} — {survivor.currentAction.type === 'idle' ? 'Rảnh' : 'Bận'}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!canBuild}
                      onClick={handleBuild}
                      className="w-full rounded-md flex items-center justify-center gap-2 font-bold transition-all"
                      style={{
                        height: uiPx(43),
                        background: canBuild
                          ? 'linear-gradient(180deg, rgba(65,112,60,0.94), rgba(31,76,48,0.96))'
                          : 'linear-gradient(180deg, rgba(48,63,54,0.50), rgba(31,43,38,0.56))',
                        border: canBuild
                          ? '1px solid rgba(218,187,74,0.82)'
                          : '1px solid rgba(77,91,82,0.52)',
                        color: canBuild ? '#f0ead7' : '#77847d',
                        cursor: canBuild ? 'pointer' : 'not-allowed',
                        fontSize: uiFont(13.5, 11.5, 14),
                        boxShadow: canBuild
                          ? '0 0 9px rgba(192,151,52,0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
                          : 'none',
                      }}
                    >
                      <Hammer style={{ width: uiPx(15), height: uiPx(15) }} />
                      {selectedPlot
                        ? canBuild
                          ? 'Xây tại vị trí đã chọn'
                          : !canAffordSelected
                            ? 'Thiếu vật tư'
                            : !chosenSurvivorIdle
                              ? 'Thợ xây đang bận'
                              : 'Không thể xây tại đây'
                        : 'Chọn vị trí trên bản đồ'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#819287]">
            Chưa có công trình.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT SIDEBAR: CAMP INFO                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto p-3.5"
        style={{ ...rootBoxStyle(BUILD_UI.campInfo), ...panelStyle }}
      >
        <div className="flex items-center gap-2 pb-2" style={recessedHeaderStyle}>
          <Home style={{ width: uiPx(17), height: uiPx(17), color: '#e7d492' }} />
          <span
            className="uppercase font-extrabold text-[#ece6d8]"
            style={{ fontSize: uiFont(14, 12, 14.5) }}
          >
            Camp Info
          </span>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          {[
            ['Tổng công trình', `${builtCount} / ${CAMP_PLOTS.length}`],
            ['Thợ đang xây', `${buildingWorkers} / ${survivors.length}`],
            ['Người đang rảnh', String(idleSurvivors)],
            ['Khu trại', builtCount >= 6 ? 'Expanding' : 'Basic'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-[#abb9ae]" style={{ fontSize: uiFont(12, 10.5, 12.5) }}>
                {label}
              </span>
              <span className="text-[#ead65e] font-bold" style={{ fontSize: uiFont(11.8, 10.3, 12.2) }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT SIDEBAR: CONSTRUCTION QUEUE                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto p-3.5 flex flex-col"
        style={{ ...rootBoxStyle(BUILD_UI.queue), ...panelStyle }}
      >
        <div className="flex items-center justify-between pb-2 shrink-0" style={recessedHeaderStyle}>
          <div className="flex items-center gap-2">
            <Hammer style={{ width: uiPx(16), height: uiPx(16), color: '#e3d4a0' }} />
            <span
              className="uppercase font-extrabold text-[#ece6d8]"
              style={{ fontSize: uiFont(13, 11.5, 13.5) }}
            >
              Construction Queue
            </span>
          </div>
          <span className="text-amber-300 font-bold" style={{ fontSize: uiFont(12, 10.5, 12.5) }}>
            {constructionQueue.length} / 4
          </span>
        </div>

        <div className="build-ui-scroll overflow-y-auto flex-1 min-h-0 py-2 flex flex-col gap-1.5 pr-1">
          {constructionQueue.length > 0 ? (
            constructionQueue.map((building) => {
              const def = allBlueprints.find((blueprint) => blueprint.id === building.buildingId);
              const progress =
                building.totalBuildSeconds > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (building.buildProgressSeconds / building.totalBuildSeconds) * 100,
                      ),
                    )
                  : 0;
              const remaining = Math.max(
                0,
                Math.round(building.totalBuildSeconds - building.buildProgressSeconds),
              );
              const Icon = getCategoryIcon(String(def?.category ?? 'production'));

              return (
                <button
                  key={building.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSelectedBuildingId(building.id);
                    setSelectedBlueprintId(building.buildingId);
                    const plot = buildingPlacements.get(building.id);
                    if (plot) setSelectedPlotId(plot.id);
                  }}
                  className="rounded p-2 text-left"
                  style={sunkenStyle}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      style={{ width: uiPx(20), height: uiPx(20), color: '#d4b86b' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="truncate font-semibold text-[#e9e1d3]"
                          style={{ fontSize: uiFont(11.8, 10.3, 12.2) }}
                        >
                          {def?.name ?? building.buildingId}
                        </span>
                        <span
                          className="font-mono text-[#cfc5a2] shrink-0"
                          style={{ fontSize: uiFont(10.8, 9.7, 11.2) }}
                        >
                          {remaining}s
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-black/55 overflow-hidden border border-white/10">
                        <div
                          className="h-full bg-emerald-500/80"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#72867a]">
              <Clock3 style={{ width: uiPx(20), height: uiPx(20), opacity: 0.65 }} />
              <span style={{ fontSize: uiFont(11.8, 10.3, 12.2), marginTop: uiPx(6) }}>
                Chưa có công trình đang thi công.
              </span>
            </div>
          )}
        </div>

        <div
          className="shrink-0 rounded flex items-center justify-center gap-1.5 text-[#95a89b]"
          style={{
            height: uiPx(34),
            ...sunkenStyle,
            fontSize: uiFont(11.8, 10.3, 12.2),
          }}
        >
          <Plus style={{ width: uiPx(13), height: uiPx(13) }} />
          Chọn blueprint và plot để thêm vào queue
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT SIDEBAR: RESOURCES                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto p-3.5 flex flex-col"
        style={{ ...rootBoxStyle(BUILD_UI.resources), ...panelStyle }}
      >
        <div className="flex items-center gap-2 pb-2 shrink-0" style={recessedHeaderStyle}>
          <Package style={{ width: uiPx(16), height: uiPx(16), color: '#e6d69e' }} />
          <span
            className="uppercase font-extrabold text-[#ece6d8]"
            style={{ fontSize: uiFont(13, 11.5, 13.5) }}
          >
            Resource Summary
          </span>
        </div>

        <div className="build-ui-scroll overflow-y-auto flex-1 min-h-0 pt-1.5 pr-1">
          {resourceSummary.map((resource) => (
            <div
              key={resource.itemId}
              className="flex items-center gap-2 py-1 border-b border-[#263f34]/55 last:border-b-0"
            >
              <ItemIcon
                itemId={resource.itemId}
                size={19}
                className="shrink-0 object-contain"
              />
              <span
                className="truncate flex-1 text-[#c9d2ca]"
                style={{ fontSize: uiFont(11.5, 10.2, 12) }}
              >
                {resource.name}
              </span>
              <span
                className="font-mono font-bold text-[#e8cf63] shrink-0"
                style={{ fontSize: uiFont(11.5, 10.2, 12) }}
              >
                {resource.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT SIDEBAR: WORKERS                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="absolute pointer-events-auto p-3.5"
        style={{ ...rootBoxStyle(BUILD_UI.workers), ...panelStyle }}
      >
        <div className="flex items-center gap-2 pb-2" style={recessedHeaderStyle}>
          <Users style={{ width: uiPx(16), height: uiPx(16), color: '#e3d5a7' }} />
          <span
            className="uppercase font-extrabold text-[#ece6d8]"
            style={{ fontSize: uiFont(13, 11.5, 13.5) }}
          >
            Assigned Workers
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2">
          {[
            ['Construction', buildingWorkers],
            ['Gathering', gatheringWorkers],
            ['Crafting', craftingWorkers],
            ['Expedition', exploringWorkers],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-center justify-between gap-2 min-w-0">
              <span className="truncate text-[#a9b7ac]" style={{ fontSize: uiFont(10.8, 9.7, 11.2) }}>
                {label}
              </span>
              <span className="text-[#e4d56f] font-bold" style={{ fontSize: uiFont(11, 9.8, 11.4) }}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-2 rounded flex items-center justify-center gap-1.5 text-[#b9c5bb]"
          style={{
            height: uiPx(30),
            ...sunkenStyle,
            fontSize: uiFont(11, 9.8, 11.4),
          }}
        >
          <UserCheck style={{ width: uiPx(12), height: uiPx(12) }} />
          Chọn thợ trong panel công trình
        </div>
      </div>
    </div>
  );
};
