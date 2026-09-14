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

const CAMP_BASE_MAP_SRC: string | null = null;

const BUILDING_MAP_SPRITES: Record<
  string,
  { src: string; objectPosition?: string; scale?: number }
> = {};

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
    'linear-gradient(180deg, rgba(4, 33, 31, 0.88) 0%, rgba(2, 22, 22, 0.93) 100%)',
  border: '1px solid rgba(77, 112, 91, 0.45)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.025), inset 0 0 0 1px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.25)',
};

const sunkenStyle: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(1, 24, 24, 0.78) 0%, rgba(1, 18, 18, 0.88) 100%)',
  border: '1px solid rgba(54, 90, 74, 0.38)',
  boxShadow:
    'inset 0 5px 12px rgba(0,0,0,0.42), inset 0 -1px 0 rgba(255,255,255,0.02)',
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

  const activeBuildingName = selectedBuilding
    ? (allBlueprints.find((b) => b.id === selectedBuilding.buildingId)?.name ?? selectedBuilding.buildingId)
    : (selectedBlueprint?.name ?? '');

  const activeBuildingDescription = selectedBuilding
    ? (allBlueprints.find((b) => b.id === selectedBuilding.buildingId)?.description ?? '')
    : (selectedBlueprint?.description ?? '');

  return (
    <div
      className="w-full h-full flex gap-3 text-[#e6ede4] select-none pointer-events-auto"
      style={{ fontFamily: UI_FONT }}
    >
      <style>{`
        .build-ui-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(104, 145, 115, 0.80) rgba(2, 18, 18, 0.40);
        }
        .build-ui-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
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

      {/* ================================================================== */}
      {/* LEFT & CENTER: MAIN BUILDING CANVAS                                */}
      {/* ================================================================== */}
      <div className="flex-1 flex flex-col gap-2.5 min-w-0 h-full">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          {['all', ...categories].map((category) => {
            const active = categoryFilter === category;
            const Icon = category === 'all' ? Box : getCategoryIcon(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category)}
                className={`flex-1 min-w-0 py-1.5 px-2 flex items-center justify-center gap-2 rounded-lg transition-all text-xs cursor-pointer ${
                  active
                    ? 'bg-gradient-to-b from-[#1e5439] to-[#12382a] border border-[#6fae70] text-[#eef6ea] font-bold shadow-[0_0_10px_rgba(111,174,112,0.2)]'
                    : 'bg-[#051f1e]/85 hover:bg-[#0d2e27] border border-[#395b4b]/50 text-[#a9b6ac] hover:text-[#e4ede5]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="truncate">
                  {category === 'all' ? 'Tất cả' : getCategoryLabel(category)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Blueprint Selector Rail */}
        <div
          className="build-ui-scroll overflow-x-auto overflow-y-hidden p-2 rounded-xl shrink-0"
          style={sunkenStyle}
        >
          <div className="flex gap-2 min-w-max h-[100px]">
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
                  className={`relative shrink-0 w-[140px] h-full rounded-xl flex flex-col items-center justify-between p-2 transition-all cursor-pointer ${
                    selected
                      ? 'bg-gradient-to-b from-[#1f4934] to-[#0c2a23] border-2 border-[#e7bc4a] text-[#f7f0e1] shadow-[0_0_12px_rgba(231,188,74,0.25)]'
                      : 'bg-[#051f1e]/85 hover:bg-[#0c2a23] border border-[#375545] text-[#b8c9bd] hover:text-white'
                  }`}
                >
                  <div
                    className="flex items-center justify-center rounded-lg w-12 h-11"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 35%, rgba(74,115,79,0.34), rgba(4,24,23,0.80) 70%)',
                      border: '1px solid rgba(74,103,84,0.34)',
                    }}
                  >
                    <Icon className="w-6 h-6" style={{ color, strokeWidth: 1.6 }} />
                  </div>

                  <div className="w-full text-center min-w-0">
                    <div
                      className="truncate font-bold text-[11.5px] leading-tight text-[#f3ebde]"
                      title={blueprint.name}
                    >
                      {blueprint.name}
                    </div>
                    <div className="truncate text-[9.5px] text-[#859a8d] mt-0.5">
                      {getCategoryLabel(category)}
                    </div>
                  </div>

                  {(built || inProgress) && (
                    <div
                      className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center border border-white/20 ${
                        built ? 'bg-emerald-600' : 'bg-amber-600'
                      }`}
                      title={built ? 'Đã xây' : 'Đang thi công'}
                    >
                      {built ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-100" />
                      ) : (
                        <Clock3 className="w-3 h-3 text-amber-100" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Workspace: Map (Left) + Building Details (Right) */}
        <div className="flex-1 flex gap-2.5 min-h-0">
          {/* Map Layout Panel */}
          <div
            className="flex-1 rounded-xl overflow-hidden relative border border-[#3b5c49]/60 shadow-lg flex flex-col"
            style={panelStyle}
          >
            {/* Map Top Header Overlay */}
            <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-[#031a19]/95 via-[#031a19]/70 to-transparent">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#e8d08a]" />
                <span className="uppercase font-bold tracking-wide text-xs text-[#e9e3d7]">
                  Mặt bằng bãi trại (Camp Layout)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#aab9ad]">
                <span>{builtCount} công trình</span>
                <span>{CAMP_PLOTS.length - buildingByPlotId.size} ô trống</span>
              </div>
            </div>

            {/* Base Map Canvas */}
            <div className="relative flex-1 w-full h-full overflow-hidden">
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
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15 pointer-events-none" />

              {/* Interactive Plots */}
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
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl transition-all cursor-pointer group shadow-md"
                    style={{
                      left: `${plot.x}%`,
                      top: `${plot.y}%`,
                      width: `${plot.w}%`,
                      height: `${plot.h}%`,
                      border: building
                        ? isSelectedPlot
                          ? '2px solid rgba(248,203,77,0.92)'
                          : '1px solid rgba(255,255,255,0.1)'
                        : isSelectedPlot
                          ? '2px solid rgba(248,203,77,0.95)'
                          : isBuildTarget
                            ? '1.5px dashed rgba(226,225,207,0.78)'
                            : '1px dashed rgba(214,215,198,0.30)',
                      background: building
                        ? 'rgba(5,24,19,0.55)'
                        : isSelectedPlot
                          ? 'rgba(34,76,53,0.65)'
                          : 'rgba(5,24,23,0.35)',
                      boxShadow: isSelectedPlot
                        ? '0 0 14px rgba(248,203,77,0.35)'
                        : 'none',
                    }}
                  >
                    {building ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
                        {sprite ? (
                          <img
                            src={sprite.src}
                            alt={buildingDef?.name ?? building.buildingId}
                            className="w-full h-full object-contain"
                            style={{
                              transform: `scale(${sprite.scale ?? 1})`,
                              objectPosition: sprite.objectPosition ?? 'center',
                            }}
                          />
                        ) : (
                          <Icon
                            className="w-7 h-7"
                            style={{
                              color: categoryColor,
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                            }}
                          />
                        )}

                        <span className="text-[10px] font-bold text-[#f7eedf] truncate max-w-full leading-tight mt-0.5">
                          {buildingDef?.name ?? building.buildingId}
                        </span>

                        {!building.isBuilt && (
                          <div className="w-4/5 h-1.5 bg-black/60 rounded-full overflow-hidden mt-1 border border-white/20">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <Plus className="w-4 h-4 text-[#d4cbb8] opacity-75 group-hover:scale-125 transition-transform" />
                        <span className="text-[9px] text-[#c9bea8] font-mono mt-0.5">
                          {plot.id.replace('PLOT_', '')}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Building Details Panel */}
          <div
            className="w-[340px] xl:w-[370px] shrink-0 rounded-xl p-3 flex flex-col justify-between border border-[#3b5c49]/60 shadow-lg"
            style={panelStyle}
          >
            {selectedBlueprint || selectedBuilding ? (
              <>
                <div className="flex flex-col gap-2 min-h-0">
                  {/* Header Title */}
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#284938]/70">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        background: 'rgba(9, 36, 28, 0.9)',
                        borderColor: 'rgba(84, 215, 117, 0.45)',
                      }}
                    >
                      <SelectedCategoryIcon
                        className="w-5 h-5"
                        style={{ color: selectedCategoryColor }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-[#f5ecd8] truncate uppercase">
                        {activeBuildingName}
                      </h3>
                      <span className="text-[10.5px] text-[#90a89a]">
                        {getCategoryLabel(selectedCategory)}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#a9bcae] leading-relaxed line-clamp-3">
                    {activeBuildingDescription}
                  </p>

                  {/* Materials / Construction Checklist */}
                  <div className="mt-1">
                    <div className="text-[11px] font-bold text-[#8ea797] uppercase tracking-wider mb-1.5">
                      Vật tư yêu cầu (Required Materials)
                    </div>
                    <div className="build-ui-scroll overflow-y-auto max-h-[140px] flex flex-col gap-1 pr-1">
                      {materialStatus.map((material) => (
                        <div
                          key={material.itemId}
                          className="rounded-lg px-2.5 py-1.5 flex items-center gap-2 border text-xs"
                          style={{
                            ...sunkenStyle,
                            borderColor: material.hasEnough
                              ? 'rgba(54,119,78,0.52)'
                              : 'rgba(141,66,62,0.62)',
                          }}
                        >
                          <ItemIcon
                            itemId={material.itemId}
                            size={18}
                            className="shrink-0 object-contain"
                          />
                          <span className="truncate flex-1 text-[#cbd4cc]">
                            {material.name}
                          </span>
                          <span
                            className="font-mono font-bold shrink-0"
                            style={{
                              color: material.hasEnough ? '#81dda0' : '#e58884',
                            }}
                          >
                            {material.stock}/{material.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Worker Assignment & Build Action */}
                <div className="pt-2 flex flex-col gap-2 border-t border-[#284938]/70">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10.5px] font-bold text-[#8fa697] uppercase tracking-wider">
                      Phân công thợ xây:
                    </label>
                    <select
                      value={assignedSurvivorId}
                      onChange={(e) => setAssignedSurvivorId(e.target.value)}
                      className="w-full rounded-lg h-9 px-2.5 outline-none cursor-pointer text-xs text-[#e6e2d7] bg-[#031918] border border-[#496955]/70"
                    >
                      {survivors.map((survivor) => (
                        <option key={survivor.id} value={survivor.id}>
                          {survivor.name} — {survivor.currentAction.type === 'idle' ? 'Đang rảnh' : 'Đang bận'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={!canBuild}
                    onClick={handleBuild}
                    className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wide transition-all cursor-pointer ${
                      canBuild
                        ? 'bg-gradient-to-b from-[#3b7847] to-[#1d5034] hover:from-[#499458] hover:to-[#246241] border border-[#dabb4a] text-[#f5eedf] shadow-[0_0_12px_rgba(218,187,74,0.3)] active:scale-98'
                        : 'bg-[#1b2b23]/60 border border-[#394d41]/50 text-[#718278] cursor-not-allowed'
                    }`}
                  >
                    <Hammer className="w-4 h-4" />
                    {selectedPlot
                      ? canBuild
                        ? 'Tiến hành xây dựng'
                        : !canAffordSelected
                          ? 'Thiếu vật tư'
                          : !chosenSurvivorIdle
                            ? 'Thợ xây đang bận'
                            : 'Không thể xây tại đây'
                      : 'Chọn vị trí trên bản đồ'}
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#819287]">
                Chọn bản vẽ hoặc vị trí công trình để xem chi tiết.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT SIDEBAR: CAMP STATS & CONSTRUCTION QUEUE                     */}
      {/* ================================================================== */}
      <div className="w-[260px] xl:w-[280px] shrink-0 flex flex-col gap-2.5 h-full overflow-y-auto build-ui-scroll pr-0.5">
        {/* Camp Info Card */}
        <div className="p-3 rounded-xl border border-[#3b5c49]/60 shadow-md" style={panelStyle}>
          <div className="flex items-center gap-2 pb-2 border-b border-[#345044]/60">
            <Home className="w-4 h-4 text-[#e7d492]" />
            <span className="uppercase font-extrabold text-xs text-[#ece6d8]">
              Thông tin bãi trại
            </span>
          </div>
          <div className="pt-2 flex flex-col gap-1.5 text-xs">
            {[
              ['Tổng công trình', `${builtCount} / ${CAMP_PLOTS.length}`],
              ['Thợ đang xây', `${buildingWorkers} / ${survivors.length}`],
              ['Người đang rảnh', String(idleSurvivors)],
              ['Quy mô khu trại', builtCount >= 6 ? 'Đang mở rộng' : 'Cơ bản'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[#abb9ae]">{label}</span>
                <span className="text-[#ead65e] font-bold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Construction Queue Card */}
        <div className="p-3 rounded-xl border border-[#3b5c49]/60 shadow-md flex-1 flex flex-col min-h-[160px]" style={panelStyle}>
          <div className="flex items-center justify-between pb-2 border-b border-[#345044]/60 shrink-0">
            <div className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-[#e3d4a0]" />
              <span className="uppercase font-extrabold text-xs text-[#ece6d8]">
                Hàng đợi thi công
              </span>
            </div>
            <span className="text-amber-300 font-bold text-xs">
              {constructionQueue.length} / 4
            </span>
          </div>

          <div className="build-ui-scroll overflow-y-auto flex-1 py-2 flex flex-col gap-1.5">
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
                  <div
                    key={building.id}
                    className="rounded-lg p-2 text-left border border-[#274738]/60"
                    style={sunkenStyle}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-[#d4b86b] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold text-xs text-[#e9e1d3]">
                            {def?.name ?? building.buildingId}
                          </span>
                          <span className="font-mono text-[10px] text-[#cfc5a2] shrink-0">
                            {remaining}s
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-black/55 overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#72867a] py-4">
                <Clock3 className="w-5 h-5 opacity-60 mb-1" />
                <span className="text-xs">Chưa có công trình đang xây.</span>
              </div>
            )}
          </div>
        </div>

        {/* Resources Summary Card */}
        <div className="p-3 rounded-xl border border-[#3b5c49]/60 shadow-md max-h-[160px] flex flex-col" style={panelStyle}>
          <div className="flex items-center gap-2 pb-2 border-b border-[#345044]/60 shrink-0">
            <Package className="w-4 h-4 text-[#e6d69e]" />
            <span className="uppercase font-extrabold text-xs text-[#ece6d8]">
              Vật tư xây dựng
            </span>
          </div>
          <div className="build-ui-scroll overflow-y-auto flex-1 pt-1.5 pr-1 flex flex-col gap-1">
            {resourceSummary.map((resource) => (
              <div
                key={resource.itemId}
                className="flex items-center gap-2 py-0.5 text-xs"
              >
                <ItemIcon
                  itemId={resource.itemId}
                  size={15}
                  className="shrink-0 object-contain"
                />
                <span className="truncate flex-1 text-[#c9d2ca]">
                  {resource.name}
                </span>
                <span className="font-mono font-bold text-[#e8cf63] shrink-0">
                  {resource.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Workers Status Card */}
        <div className="p-3 rounded-xl border border-[#3b5c49]/60 shadow-md" style={panelStyle}>
          <div className="flex items-center gap-2 pb-2 border-b border-[#345044]/60">
            <Users className="w-4 h-4 text-[#e3d5a7]" />
            <span className="uppercase font-extrabold text-xs text-[#ece6d8]">
              Nhân lực bãi trại
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2 text-xs">
            {[
              ['Xây dựng', buildingWorkers],
              ['Thu lượm', gatheringWorkers],
              ['Chế tác', craftingWorkers],
              ['Thám hiểm', exploringWorkers],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <span className="text-[#a9b7ac] truncate">{label}</span>
                <span className="text-[#e4d56f] font-bold">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
