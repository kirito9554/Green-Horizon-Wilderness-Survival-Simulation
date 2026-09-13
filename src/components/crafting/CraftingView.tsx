import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Anvil,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Flame,
  Layers,
  ListOrdered,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { GameState, RecipeDefinition, RecipeResearchState } from '../../types';
import { RECIPES_DATABASE } from '../../data/recipes';
import { ITEMS_DATABASE } from '../../data/items';
import { ItemIcon } from '../common/ItemIcon';
import { QUALITY_CONFIG } from '../../utils/qualityUtils';
import './OrganicUI.css';

interface CraftingViewProps {
  state: GameState;
  onStartCrafting?: (survivorId: string, recipeId: string) => void;
  onStartResearch?: (recipeId: string, survivorId: string) => void;
  onPauseResearch?: (recipeId: string) => void;
  onAddToCraftingQueue?: (recipeId: string, quantity: number, assignedSurvivorId?: string) => void;
  onCancelQueueItem?: (queueItemId: string) => void;
  onTogglePauseQueueItem?: (queueItemId: string) => void;
  onReorderQueue?: (queueItemId: string, direction: 'up' | 'down') => void;
  onAssignSurvivorToQueue?: (queueItemId: string, survivorId?: string) => void;
}

type Box = { x: number; y: number; w: number; h: number; radiusPx?: number };
type MainTab = 'crafting' | 'research' | 'processing';
type RecipeStatusFilter = 'all' | 'ready' | 'missing' | 'locked';

const UI_FONT = '"Roboto Condensed", "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const CRAFT_UI = {
  reference: { width: 1448, height: 1086 },

  sectionBand: {
    icon: { x: 109, y: 208, w: 48, h: 48 },
    title: { x: 182, y: 213, w: 540, h: 28 },
    subtitle: { x: 182, y: 244, w: 600, h: 22 },
  },

  artisan: {
    panel: { x: 841, y: 210, w: 475, h: 60, radiusPx: 8 },
    icon: { x: 860, y: 224, w: 28, h: 28 },
    label: { x: 897, y: 226, w: 120, h: 26 },
    select: { x: 1024, y: 218, w: 281, h: 43, radiusPx: 6 },
  },

  tabs: {
    crafting: { x: 91, y: 281, w: 150, h: 34, radiusPx: 6 },
    research: { x: 247, y: 281, w: 150, h: 34, radiusPx: 6 },
    processing: { x: 403, y: 281, w: 150, h: 34, radiusPx: 6 },
  } satisfies Record<MainTab, Box>,

  filters: {
    search: { x: 570, y: 281, w: 262, h: 34, radiusPx: 6 },
    category: { x: 840, y: 281, w: 176, h: 34, radiusPx: 6 },
    status: { x: 1024, y: 281, w: 160, h: 34, radiusPx: 6 },
    count: { x: 1192, y: 281, w: 161, h: 34, radiusPx: 6 },
  },

  browser: {
    listPanel: { x: 88, y: 326, w: 392, h: 530, radiusPx: 9 },
    listTitle: { x: 106, y: 345, w: 340, h: 23 },
    grid: { x: 104, y: 380, w: 360, h: 455 },
    tileW: 81,
    tileH: 93,
    gapX: 10,
    gapY: 10,

    detailPanel: { x: 496, y: 326, w: 857, h: 530, radiusPx: 9 },
    heroIcon: { x: 518, y: 350, w: 180, h: 180, radiusPx: 8 },
    title: { x: 724, y: 350, w: 452, h: 36 },
    badges: { x: 724, y: 391, w: 598, h: 28 },
    description: { x: 724, y: 431, w: 598, h: 63 },
    output: { x: 724, y: 503, w: 598, h: 52, radiusPx: 6 },
    materialsLabel: { x: 518, y: 574, w: 240, h: 20 },
    materials: { x: 518, y: 600, w: 804, h: 108 },
    requirements: { x: 518, y: 720, w: 804, h: 28 },
    status: { x: 518, y: 790, w: 280, h: 34 },
    quantity: { x: 900, y: 781, w: 120, h: 40, radiusPx: 6 },
    secondary: { x: 1028, y: 781, w: 133, h: 40, radiusPx: 6 },
    primary: { x: 1168, y: 781, w: 154, h: 40, radiusPx: 6 },

    researchProgress: { x: 724, y: 505, w: 598, h: 72, radiusPx: 6 },
    researchDiscovery: { x: 518, y: 600, w: 804, h: 108, radiusPx: 6 },
  },

  queueDock: {
    panel: { x: 88, y: 875, w: 1265, h: 138, radiusPx: 9 },
    title: { x: 106, y: 891, w: 370, h: 22 },
    hint: { x: 810, y: 891, w: 520, h: 22 },
    list: { x: 104, y: 922, w: 1232, h: 76 },
  },

  typography: {
    sectionTitlePx: 24,
    sectionSubtitlePx: 13,
    artisanLabelPx: 13.5,
    artisanSelectPx: 13,
    tabPx: 13.5,
    filterPx: 12.5,
    countPx: 11.5,
    listTitlePx: 13,
    tileNamePx: 10.5,
    titlePx: 23,
    bodyPx: 13,
    outputPx: 12.5,
    materialLabelPx: 12,
    materialPx: 12,
    statusPx: 12.5,
    buttonPx: 13,
  },
} as const;

const rootBoxStyle = (box: Box): React.CSSProperties => ({
  left: `${(box.x / CRAFT_UI.reference.width) * 100}%`,
  top: `${(box.y / CRAFT_UI.reference.height) * 100}%`,
  width: `${(box.w / CRAFT_UI.reference.width) * 100}%`,
  height: `${(box.h / CRAFT_UI.reference.height) * 100}%`,
  borderRadius: box.radiusPx ?? 0,
});

const uiPx = (px: number) => `${(px / CRAFT_UI.reference.width) * 100}cqw`;

const localBoxStyle = (box: Box, parent: Box): React.CSSProperties => ({
  left: uiPx(box.x - parent.x),
  top: uiPx(box.y - parent.y),
  width: uiPx(box.w),
  height: uiPx(box.h),
  borderRadius: box.radiusPx ? uiPx(box.radiusPx) : 0,
});

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const CATEGORY_LABELS: Record<string, string> = {
  tool: 'Công cụ',
  tools: 'Công cụ',
  weapon: 'Vũ khí',
  weapons: 'Vũ khí',
  food: 'Thực phẩm',
  water: 'Nước',
  medical: 'Y tế',
  medicine: 'Y tế',
  material: 'Vật liệu',
  materials: 'Vật liệu',
  utility: 'Tiện ích',
  survival: 'Sinh tồn',
  container: 'Vật chứa',
  containers: 'Vật chứa',
  fire: 'Lửa',
};

const getCategoryLabel = (category: string) => CATEGORY_LABELS[category] ?? titleCase(category);

export const CraftingView: React.FC<CraftingViewProps> = ({
  state,
  onStartCrafting,
  onStartResearch,
  onPauseResearch,
  onAddToCraftingQueue,
  onCancelQueueItem,
  onTogglePauseQueueItem,
  onReorderQueue,
  onAssignSurvivorToQueue,
}) => {
  const { inventory, survivors, buildings, researches = {}, craftingQueue = [] } = state;

  const [activeMainTab, setActiveMainTab] = useState<MainTab>('crafting');
  const [selectedCategory, setSelectedCategory] = useState<RecipeDefinition['category'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RecipeStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSurvivorId, setGlobalSurvivorId] = useState<string>(survivors[0]?.id || '');
  const [queueQuantities, setQueueQuantities] = useState<Record<string, number>>({});
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');

  const recipeScrollRef = useRef<HTMLDivElement>(null);

  const chosenSurvivor = survivors.find((survivor) => survivor.id === globalSurvivorId);
  const isGlobalSurvivorBusy = !!chosenSurvivor && chosenSurvivor.currentAction.type !== 'idle';
  const hasCampfire = buildings.some(
    (building) => building.buildingId === 'BUILDING_CAMPFIRE_HEARTH' && building.isBuilt,
  );

  const allRecipesList = useMemo(() => Object.values(RECIPES_DATABASE), []);
  const craftingRecipes = useMemo(
    () => allRecipesList.filter((recipe) => recipe.type === 'crafting'),
    [allRecipesList],
  );
  const processingRecipes = useMemo(
    () => allRecipesList.filter((recipe) => recipe.type === 'processing'),
    [allRecipesList],
  );

  const getItemStock = (itemId: string): number => {
    let count = 0;
    for (const item of inventory.items) {
      if (item.itemId === itemId) count += item.quantity;
    }
    return count;
  };

  const hasToolWithTag = (tag: string): boolean =>
    inventory.items.some((item) => {
      const definition = ITEMS_DATABASE[item.itemId];
      return definition && definition.tags.includes(tag) && (item.condition === undefined || item.condition > 0);
    });

  const getResearchStatus = (recipeId: string): RecipeResearchState['status'] => {
    const recipe = RECIPES_DATABASE[recipeId];
    if (!recipe || recipe.type !== 'crafting') return 'completed';
    if (recipe.unlockedByDefault) return 'completed';
    const research = researches[recipeId];
    return research ? research.status : 'locked';
  };

  const recipeChecks = (recipe: RecipeDefinition) => {
    let canAfford = true;
    const ingredientStatus = recipe.ingredients.map((ingredient) => {
      const stock = getItemStock(ingredient.itemId);
      const hasEnough = stock >= ingredient.quantity;
      if (!hasEnough) canAfford = false;
      return {
        ...ingredient,
        stock,
        hasEnough,
        name: ITEMS_DATABASE[ingredient.itemId]?.name || ingredient.itemId,
      };
    });

    const toolCheck = recipe.requiredToolTag ? hasToolWithTag(recipe.requiredToolTag) : true;
    const needsCampfire = recipe.id === 'RECIPE_BOIL_WATER' || recipe.id === 'RECIPE_GRILL_FISH';
    const fireCheck = !needsCampfire || hasCampfire;
    return { canAfford, ingredientStatus, toolCheck, fireCheck, needsCampfire };
  };

  const sourceRecipes = activeMainTab === 'processing' ? processingRecipes : craftingRecipes;

  const categories = useMemo(
    () => Array.from(new Set(sourceRecipes.map((recipe) => String(recipe.category)))).sort(),
    [sourceRecipes],
  );

  const visibleRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sourceRecipes.filter((recipe) => {
      if (selectedCategory !== 'all' && recipe.category !== selectedCategory) return false;

      const researchStatus = getResearchStatus(recipe.id);
      const { canAfford, toolCheck, fireCheck } = recipeChecks(recipe);
      const isLocked = activeMainTab !== 'processing' && researchStatus !== 'completed';
      const isReady = !isLocked && canAfford && toolCheck && fireCheck;

      if (statusFilter === 'ready' && !isReady) return false;
      if (statusFilter === 'missing' && (isLocked || isReady)) return false;
      if (statusFilter === 'locked' && !isLocked) return false;

      if (!query) return true;
      return [
        recipe.id,
        recipe.name,
        recipe.description,
        String(recipe.category),
        getCategoryLabel(String(recipe.category)),
        recipe.requiredToolTag ?? '',
        ...recipe.ingredients.map((ingredient) => ITEMS_DATABASE[ingredient.itemId]?.name ?? ingredient.itemId),
        ...recipe.outputs.map((output) => ITEMS_DATABASE[output.itemId]?.name ?? output.itemId),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [
    sourceRecipes,
    selectedCategory,
    statusFilter,
    searchQuery,
    activeMainTab,
    inventory.items,
    researches,
    buildings,
  ]);

  useEffect(() => {
    if (!visibleRecipes.length) {
      setSelectedRecipeId('');
      return;
    }
    if (!visibleRecipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(visibleRecipes[0].id);
    }
  }, [visibleRecipes, selectedRecipeId]);

  const selectedRecipe = visibleRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? visibleRecipes[0];

  const pendingResearchCount = craftingRecipes.filter((recipe) => {
    const status = getResearchStatus(recipe.id);
    return status === 'discovered' || status === 'in_progress' || status === 'paused';
  }).length;

  const unlockedCraftingCount = craftingRecipes.filter(
    (recipe) => getResearchStatus(recipe.id) === 'completed',
  ).length;

  const handleAdjustQty = (recipeId: string, delta: number) => {
    setQueueQuantities((previous) => {
      const current = previous[recipeId] || 1;
      return { ...previous, [recipeId]: Math.max(1, Math.min(20, current + delta)) };
    });
  };

  const changeTab = (tab: MainTab) => {
    setActiveMainTab(tab);
    setSelectedCategory('all');
    setStatusFilter('all');
    setSearchQuery('');
    setSelectedRecipeId('');
    requestAnimationFrame(() => {
      if (recipeScrollRef.current) recipeScrollRef.current.scrollTop = 0;
    });
  };

  const renderRecipeTile = (recipe: RecipeDefinition) => {
    const researchStatus = getResearchStatus(recipe.id);
    const checks = recipeChecks(recipe);
    const locked = activeMainTab !== 'processing' && researchStatus !== 'completed';
    const ready = !locked && checks.canAfford && checks.toolCheck && checks.fireCheck;
    const selected = selectedRecipe?.id === recipe.id;
    const output = recipe.outputs[0];

    return (
      <button
        key={recipe.id}
        type="button"
        onClick={() => setSelectedRecipeId(recipe.id)}
        className={`organic-icon-tile ${selected ? 'organic-icon-tile--selected' : ''} ${locked ? 'organic-icon-tile--locked' : ready ? 'organic-icon-tile--ready' : 'organic-icon-tile--missing'}`}
        title={recipe.name}
        style={{
          width: uiPx(CRAFT_UI.browser.tileW),
          height: uiPx(CRAFT_UI.browser.tileH),
          fontFamily: UI_FONT,
        }}
      >
        <span className="organic-icon-tile__icon">
          <ItemIcon
            itemId={output?.itemId}
            size={42}
            className={`object-contain ${locked ? 'grayscale opacity-35' : ''}`}
          />
          {locked && (
            <span className="organic-icon-tile__lock">
              <Lock style={{ width: uiPx(13), height: uiPx(13) }} />
            </span>
          )}
        </span>

        <span
          className="organic-icon-tile__name"
          style={{ fontSize: uiPx(CRAFT_UI.typography.tileNamePx) }}
        >
          {recipe.name}
        </span>

        <span
          className={`organic-icon-tile__status ${locked ? 'is-locked' : ready ? 'is-ready' : 'is-missing'}`}
          aria-hidden="true"
        />
      </button>
    );
  };

  const renderMaterialGrid = (recipe: RecipeDefinition) => {
    const { ingredientStatus } = recipeChecks(recipe);
    return (
      <div className="crafting-material-scrollbar h-full overflow-y-auto overflow-x-hidden pr-1">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: uiPx(8),
          }}
        >
          {ingredientStatus.map((ingredient) => (
            <div
              key={ingredient.itemId}
              className="flex items-center min-w-0"
              style={{
                height: uiPx(35),
                padding: `0 ${uiPx(10)}`,
                gap: uiPx(8),
                borderRadius: uiPx(6),
                background: ingredient.hasEnough
                  ? 'linear-gradient(180deg, rgba(8, 72, 48, 0.48) 0%, rgba(5, 54, 40, 0.54) 100%)'
                  : 'linear-gradient(180deg, rgba(168, 87, 72, 0.16) 0%, rgba(124, 48, 40, 0.22) 100%)',
                border: ingredient.hasEnough
                  ? '1px solid rgba(44, 139, 92, 0.65)'
                  : '1px solid rgba(196, 92, 82, 0.55)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                fontSize: uiPx(CRAFT_UI.typography.materialPx),
              }}
              title={`${ingredient.name}: ${ingredient.stock}/${ingredient.quantity}`}
            >
              <ItemIcon itemId={ingredient.itemId} size={22} className="shrink-0 object-contain" />
              <span className="truncate min-w-0 font-medium text-[#d8e2dc]">{ingredient.name}</span>
              <span className="ml-auto shrink-0 font-mono font-bold" style={{ color: ingredient.hasEnough ? '#8fe4aa' : '#f08d86' }}>
                {ingredient.stock}/{ingredient.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDetail = () => {
    if (!selectedRecipe) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center text-[#7f9389] p-6">
          <Compass style={{ width: uiPx(44), height: uiPx(44), opacity: 0.55 }} />
          <div style={{ marginTop: uiPx(12), fontSize: uiPx(16), color: '#c8d2cb', fontWeight: 600 }}>
            Không có công thức phù hợp
          </div>
          <div style={{ marginTop: uiPx(6), fontSize: uiPx(12) }}>
            Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
          </div>
        </div>
      );
    }

    const recipe = selectedRecipe;
    const researchStatus = getResearchStatus(recipe.id);
    const processing = activeMainTab === 'processing';
    const unlocked = processing || researchStatus === 'completed';
    const { canAfford, toolCheck, fireCheck, needsCampfire } = recipeChecks(recipe);
    const output = recipe.outputs[0];
    const outputDef = output ? ITEMS_DATABASE[output.itemId] : undefined;
    const qty = queueQuantities[recipe.id] || 1;
    const skillLevel = chosenSurvivor?.skills.crafting || 1;
    const likelyPrime = skillLevel >= 1.5;
    const canExecute = unlocked && canAfford && toolCheck && fireCheck && !!chosenSurvivor;
    const immediateReady = canExecute && !isGlobalSurvivorBusy;

    if (activeMainTab === 'research') {
      const research = researches[recipe.id] || {
        recipeId: recipe.id,
        status: recipe.unlockedByDefault ? 'completed' : 'locked',
        progressSeconds: recipe.unlockedByDefault ? recipe.researchTimeSeconds || 20 : 0,
        totalSeconds: recipe.researchTimeSeconds || 20,
      };
      const completed = research.status === 'completed';
      const inProgress = research.status === 'in_progress';
      const paused = research.status === 'paused';
      const discovered = research.status === 'discovered';
      const locked = research.status === 'locked';
      const progressPct = Math.round((research.progressSeconds / Math.max(research.totalSeconds, 0.001)) * 100);
      const ownedCount = recipe.ingredients.filter((ingredient) => getItemStock(ingredient.itemId) >= 1).length;
      const ingredientPct = Math.round((ownedCount / Math.max(recipe.ingredients.length, 1)) * 100);

      return (
        <div className="w-full h-full flex flex-col justify-between" style={{ padding: uiPx(18) }}>
          {/* Top Row: Hero Icon + Recipe Meta & Research Progress */}
          <div className="flex gap-4 items-start" style={{ gap: uiPx(16) }}>
            <div
              className="shrink-0 flex items-center justify-center relative overflow-hidden rounded-lg"
              style={{
                width: uiPx(130),
                height: uiPx(130),
                background: 'linear-gradient(180deg, rgba(3, 28, 29, 0.75) 0%, rgba(2, 20, 22, 0.90) 100%)',
                border: '1px solid rgba(78, 142, 114, 0.45)',
                boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.60), inset 0 0 0 1px rgba(78, 142, 114, 0.20), 0 2px 4px rgba(0,0,0,0.35)',
              }}
            >
              <ItemIcon itemId={output?.itemId} size={80} className={locked ? 'grayscale opacity-30 object-contain' : 'object-contain'} />
              {locked && <Lock className="absolute text-[#b69a5a]" style={{ width: uiPx(32), height: uiPx(32) }} />}
            </div>

            <div className="flex-1 flex flex-col justify-between min-w-0" style={{ minHeight: uiPx(130) }}>
              <div>
                <div
                  className="font-extrabold uppercase text-[#f0eadc] leading-tight"
                  style={{
                    fontSize: uiPx(CRAFT_UI.typography.titlePx),
                    letterSpacing: '.02em',
                  }}
                >
                  {recipe.name}
                </div>

                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: uiPx(6) }}>
                  <span
                    className="organic-badge flex items-center gap-1.5 px-2.5"
                    style={{
                      height: uiPx(26),
                      border: '1px solid rgba(144,121,70,.50)',
                      background: 'rgba(39,31,17,.48)',
                      color: '#d9bc72',
                      fontSize: uiPx(11.5),
                    }}
                  >
                    <Sparkles style={{ width: uiPx(13), height: uiPx(13) }} />
                    {completed ? 'Đã mở khóa' : locked ? 'Chưa khám phá' : inProgress ? 'Đang nghiên cứu' : paused ? 'Tạm dừng' : discovered ? 'Có thể nghiên cứu' : 'Bản vẽ'}
                  </span>
                  <span
                    className="organic-badge flex items-center px-2.5"
                    style={{
                      height: uiPx(26),
                      border: '1px solid rgba(112,126,83,.28)',
                      background: 'rgba(5,31,28,.36)',
                      color: '#9eb0a6',
                      fontSize: uiPx(11.5),
                    }}
                  >
                    {getCategoryLabel(String(recipe.category))}
                  </span>
                </div>

                <div
                  className="text-[#c7d0c9] line-clamp-2"
                  style={{
                    fontSize: uiPx(CRAFT_UI.typography.bodyPx),
                    lineHeight: 1.35,
                    marginTop: uiPx(6),
                  }}
                >
                  {recipe.description}
                </div>
              </div>

              {/* Research Progress Bar */}
              <div
                className="organic-inset"
                style={{
                  padding: `${uiPx(8)} ${uiPx(12)}`,
                  background: 'rgba(4,31,31,.48)',
                  border: '1px solid rgba(117,104,66,.46)',
                  marginTop: uiPx(6),
                }}
              >
                <div className="flex items-center justify-between" style={{ fontSize: uiPx(11.5), color: '#aeb8b0' }}>
                  <span className="font-semibold">Tiến độ nghiên cứu bản vẽ</span>
                  <span style={{ color: completed ? '#7de0a2' : '#e0bd6b', fontWeight: 700 }}>
                    {completed ? 'Hoàn thành' : `${progressPct}% • ${research.progressSeconds.toFixed(1)}s / ${research.totalSeconds}s`}
                  </span>
                </div>
                <div style={{ marginTop: uiPx(6), height: uiPx(8), borderRadius: uiPx(6), overflow: 'hidden', background: 'rgba(0,0,0,.34)', border: '1px solid rgba(60,84,69,.30)' }}>
                  <div style={{ width: `${completed ? 100 : progressPct}%`, height: '100%', background: completed ? 'linear-gradient(90deg,#2d9b62,#65d990)' : 'linear-gradient(90deg,#8e6725,#d5ae4e)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Middle: Discovery Insight Card */}
          <div
            className="organic-inset-soft my-auto flex flex-col justify-center"
            style={{
              padding: uiPx(14),
              background: 'rgba(8,25,22,.38)',
              border: '1px solid rgba(70,91,77,.24)',
              color: '#9caaa0',
              fontSize: uiPx(12),
              marginTop: uiPx(10),
              marginBottom: uiPx(10),
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#b8c7be]">Nguyên liệu liên quan đã nhìn thấy:</span>
              <strong style={{ color: ingredientPct >= 80 ? '#86dba7' : '#c3b06d', fontSize: uiPx(12.5) }}>
                {ownedCount}/{recipe.ingredients.length} loại • {ingredientPct}%
              </strong>
            </div>
            <div style={{ marginTop: uiPx(8), lineHeight: 1.4, color: '#8fa298' }}>
              {locked
                ? 'Tiếp tục thu lượm và khám phá các nguyên liệu trên đảo để nảy sinh ý niệm hoàn thiện bản vẽ này.'
                : completed
                  ? 'Bản vẽ này đã nghiên cứu thành công! Bạn có thể bắt đầu sản xuất trong tab Chế tạo.'
                  : 'Phân công một người sống sót phụ trách nghiên cứu. Tiến độ nghiên cứu được tự động lưu lại nếu bạn tạm dừng.'}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div
            className="flex items-center justify-between gap-3 pt-3 border-t border-[rgba(70,91,77,.28)] mt-auto"
            style={{ minHeight: uiPx(44) }}
          >
            <div
              className="flex items-center gap-2"
              style={{
                color: completed ? '#7cd89f' : locked ? '#7e8b83' : '#d1b56c',
                fontSize: uiPx(CRAFT_UI.typography.statusPx),
                fontWeight: 600,
              }}
            >
              {completed ? <CheckCircle2 style={{ width: uiPx(18), height: uiPx(18) }} /> : locked ? <Lock style={{ width: uiPx(18), height: uiPx(18) }} /> : <Sparkles style={{ width: uiPx(18), height: uiPx(18) }} />}
              <span>{completed ? 'Đã sẵn sàng sản xuất' : locked ? 'Chưa đủ điều kiện phát hiện' : inProgress ? 'Đang tiến hành nghiên cứu' : paused ? 'Đang tạm dừng' : 'Sẵn sàng nghiên cứu'}</span>
            </div>

            {!completed && !locked && (
              <button
                type="button"
                disabled={!inProgress && isGlobalSurvivorBusy}
                onClick={() => inProgress ? onPauseResearch?.(recipe.id) : onStartResearch?.(recipe.id, globalSurvivorId)}
                className="organic-button organic-button--amber flex items-center justify-center px-5 cursor-pointer"
                style={{
                  height: uiPx(38),
                  color: '#f0deb1',
                  fontFamily: UI_FONT,
                  fontSize: uiPx(CRAFT_UI.typography.buttonPx),
                  fontWeight: 650,
                  opacity: !inProgress && isGlobalSurvivorBusy ? .45 : 1,
                }}
              >
                {inProgress ? 'Tạm dừng' : paused ? 'Tiếp tục' : 'Bắt đầu nghiên cứu'}
              </button>
            )}

            {completed && (
              <button
                type="button"
                onClick={() => changeTab('crafting')}
                className="organic-button organic-button--green flex items-center justify-center px-5 cursor-pointer"
                style={{
                  height: uiPx(38),
                  color: '#e2ebe0',
                  fontFamily: UI_FONT,
                  fontSize: uiPx(CRAFT_UI.typography.buttonPx),
                  fontWeight: 650,
                }}
              >
                Sang tab Chế tạo
              </button>
            )}
          </div>
        </div>
      );
    }

    const isLocked = !unlocked;
    const isDiscovered = researchStatus === 'discovered' || researchStatus === 'in_progress' || researchStatus === 'paused';

    return (
      <div className="w-full h-full flex flex-col justify-between" style={{ padding: uiPx(18) }}>
        {/* Top Row: Hero Icon + Recipe Meta & Output */}
        <div className="flex gap-4 items-start" style={{ gap: uiPx(16) }}>
          <div
            className="shrink-0 flex items-center justify-center relative overflow-hidden rounded-lg"
            style={{
              width: uiPx(130),
              height: uiPx(130),
              background: 'linear-gradient(180deg, rgba(3, 28, 29, 0.75) 0%, rgba(2, 20, 22, 0.90) 100%)',
              border: '1px solid rgba(78, 142, 114, 0.45)',
              boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.60), inset 0 0 0 1px rgba(78, 142, 114, 0.20), 0 2px 4px rgba(0,0,0,0.35)',
            }}
          >
            <ItemIcon itemId={output?.itemId} size={80} className={isLocked ? 'grayscale opacity-30 object-contain' : 'object-contain'} />
            {isLocked && <Lock className="absolute text-[#b69a5a]" style={{ width: uiPx(32), height: uiPx(32) }} />}
          </div>

          <div className="flex-1 flex flex-col justify-between min-w-0" style={{ minHeight: uiPx(130) }}>
            <div>
              <div
                className="font-extrabold uppercase text-[#f0eadc] leading-tight"
                style={{
                  fontSize: uiPx(CRAFT_UI.typography.titlePx),
                  letterSpacing: '.02em',
                }}
              >
                {recipe.name}
              </div>

              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: uiPx(5) }}>
                <span
                  className="organic-badge flex items-center gap-1.5 px-2.5"
                  style={{
                    height: uiPx(25),
                    border: '1px solid rgba(112,126,83,.34)',
                    background: 'rgba(5,31,28,.48)',
                    color: '#b9c9c0',
                    fontSize: uiPx(11.5),
                  }}
                >
                  <Clock3 style={{ width: uiPx(13), height: uiPx(13), color: '#d5b65e' }} />
                  {recipe.craftTimeSeconds}s
                </span>
                <span
                  className="organic-badge flex items-center px-2.5"
                  style={{
                    height: uiPx(25),
                    border: '1px solid rgba(112,126,83,.28)',
                    background: 'rgba(5,31,28,.36)',
                    color: '#9eb0a6',
                    fontSize: uiPx(11.5),
                  }}
                >
                  {getCategoryLabel(String(recipe.category))}
                </span>
                {processing && <span style={{ color: '#73cab8', fontSize: uiPx(11.5), fontWeight: 600 }}>Sơ chế trực tiếp</span>}
              </div>

              <div
                className="text-[#c7d0c9] line-clamp-2"
                style={{
                  fontSize: uiPx(CRAFT_UI.typography.bodyPx),
                  lineHeight: 1.35,
                  marginTop: uiPx(5),
                }}
              >
                {recipe.description}
              </div>
            </div>

            {/* Output Bar */}
            <div
              className="flex items-center min-w-0"
              style={{
                padding: `${uiPx(6)} ${uiPx(12)}`,
                gap: uiPx(10),
                background: 'rgba(4,31,31,.55)',
                border: '1px solid rgba(120,105,65,.45)',
                borderRadius: uiPx(6),
                marginTop: uiPx(6),
              }}
            >
              {output && <ItemIcon itemId={output.itemId} size={28} className="shrink-0 object-contain" />}
              <div className="min-w-0 flex-1">
                <div style={{ color: '#778a80', fontSize: uiPx(10), textTransform: 'uppercase', letterSpacing: '.08em' }}>Sản phẩm thu được</div>
                <div className="truncate font-semibold" style={{ color: '#e0e6df', fontSize: uiPx(CRAFT_UI.typography.outputPx) }}>
                  {outputDef?.name || output?.itemId || 'Không xác định'} {output ? `×${output.quantity}` : ''}
                </div>
              </div>
              {!processing && unlocked && (
                <span
                  className="ml-auto organic-badge px-2.5 flex items-center font-medium shrink-0"
                  style={{
                    height: uiPx(25),
                    border: '1px solid rgba(126,108,65,.44)',
                    background: likelyPrime ? QUALITY_CONFIG.prime.badgeBg : QUALITY_CONFIG.standard.badgeBg,
                    color: likelyPrime ? QUALITY_CONFIG.prime.textColor : QUALITY_CONFIG.standard.textColor,
                    fontSize: uiPx(10.5),
                  }}
                >
                  {likelyPrime ? 'Có cơ hội Prime' : 'Chất lượng Standard'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Materials Or Locked Status */}
        {isLocked ? (
          <div className="my-auto flex flex-col justify-center" style={{ marginTop: uiPx(10), marginBottom: uiPx(10) }}>
            <div
              className="uppercase font-bold text-[#879b8c] mb-2"
              style={{
                fontSize: uiPx(CRAFT_UI.typography.materialLabelPx),
                letterSpacing: '.10em',
              }}
            >
              Trạng thái công thức
            </div>
            <div
              className="organic-inset-soft flex items-center"
              style={{
                padding: uiPx(14),
                background: 'rgba(44,34,18,.26)',
                border: '1px solid rgba(128,105,54,.38)',
                color: '#c9ba92',
                fontSize: uiPx(12.5),
                lineHeight: 1.4,
              }}
            >
              <LightbulbFallback />
              <span style={{ marginLeft: uiPx(10) }}>
                {isDiscovered
                  ? 'Bản vẽ này đã được phát hiện nhưng chưa hoàn tất nghiên cứu. Mở tab Nghiên cứu để phân công thợ nghiên cứu.'
                  : 'Bạn chưa khám phá đủ các nguyên liệu liên quan trên đảo để hình thành bản vẽ công thức này.'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center min-h-0 my-2">
            <div
              className="flex items-center justify-between uppercase font-bold text-[#879b8c] mb-1.5"
              style={{
                fontSize: uiPx(CRAFT_UI.typography.materialLabelPx),
                letterSpacing: '.10em',
              }}
            >
              <span>Nguyên liệu chế tạo</span>
              <span className="text-[#879e91] lowercase font-normal" style={{ fontSize: uiPx(11) }}>
                (Kho trại hiện có)
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {renderMaterialGrid(recipe)}
            </div>

            {/* Tool & Campfire Requirements */}
            <div
              className="flex items-center gap-2 mt-2 flex-wrap"
              style={{
                fontSize: uiPx(11.5),
                color: '#8fa198',
              }}
            >
              {recipe.requiredToolTag && (
                <span
                  className={`organic-badge flex items-center gap-1.5 px-2.5 ${toolCheck ? 'text-[#8ee3ab]' : 'text-amber-300'}`}
                  style={{
                    height: uiPx(26),
                    border: toolCheck ? '1px solid rgba(48,122,84,.36)' : '1px solid rgba(141,91,46,.52)',
                    background: 'rgba(5,28,25,.42)',
                  }}
                >
                  <Wrench style={{ width: uiPx(13), height: uiPx(13) }} />
                  #{recipe.requiredToolTag}: {toolCheck ? 'Sẵn sàng' : 'Chưa có dụng cụ'}
                </span>
              )}
              {needsCampfire && (
                <span
                  className="organic-badge flex items-center gap-1.5 px-2.5"
                  style={{
                    height: uiPx(26),
                    border: fireCheck ? '1px solid rgba(48,122,84,.36)' : '1px solid rgba(141,91,46,.52)',
                    background: 'rgba(5,28,25,.42)',
                    color: fireCheck ? '#9fc4ad' : '#d8ae68',
                  }}
                >
                  <Flame style={{ width: uiPx(13), height: uiPx(13) }} />
                  Bếp lửa trại: {fireCheck ? 'Đang đỏ lửa' : 'Chưa nhóm lửa'}
                </span>
              )}
              {!recipe.requiredToolTag && !needsCampfire && (
                <span className="text-[#7d9487]">Không yêu cầu công cụ hỗ trợ đặc biệt.</span>
              )}
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div
          className="flex items-center justify-between gap-3 pt-3 border-t border-[rgba(70,91,77,.28)] mt-auto"
          style={{ minHeight: uiPx(44) }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              color: isLocked ? '#b99c5a' : canExecute ? '#72d99a' : '#d27870',
              fontSize: uiPx(CRAFT_UI.typography.statusPx),
              fontWeight: 600,
            }}
          >
            {isLocked ? (
              <Lock style={{ width: uiPx(18), height: uiPx(18) }} />
            ) : canExecute ? (
              <CheckCircle2 style={{ width: uiPx(18), height: uiPx(18) }} />
            ) : (
              <AlertTriangle style={{ width: uiPx(18), height: uiPx(18) }} />
            )}
            <span>
              {isLocked
                ? 'Chưa mở khóa bản vẽ'
                : canExecute
                  ? 'Đủ điều kiện chế tạo'
                  : !canAfford
                    ? 'Thiếu nguyên liệu'
                    : !toolCheck
                      ? 'Thiếu dụng cụ phù hợp'
                      : !fireCheck
                        ? 'Cần nhóm bếp lửa'
                        : 'Chưa thể chế tạo'}
            </span>
          </div>

          {isLocked ? (
            isDiscovered && (
              <button
                type="button"
                onClick={() => changeTab('research')}
                className="organic-button organic-button--amber flex items-center justify-center px-5 cursor-pointer"
                style={{
                  height: uiPx(38),
                  color: '#f0deb1',
                  fontFamily: UI_FONT,
                  fontSize: uiPx(CRAFT_UI.typography.buttonPx),
                  fontWeight: 650,
                }}
              >
                Mở tab Nghiên cứu
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="organic-recessed organic-stepper flex items-center justify-between"
                style={{
                  width: uiPx(110),
                  height: uiPx(38),
                  borderRadius: uiPx(6),
                }}
              >
                <button
                  type="button"
                  onClick={() => handleAdjustQty(recipe.id, -1)}
                  className="h-full flex items-center justify-center cursor-pointer hover:text-white"
                  style={{ width: '32%', color: '#a3b1a8' }}
                >
                  <Minus style={{ width: uiPx(14), height: uiPx(14) }} />
                </button>
                <span className="font-mono font-bold" style={{ color: '#e0c374', fontSize: uiPx(13) }}>
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustQty(recipe.id, 1)}
                  className="h-full flex items-center justify-center cursor-pointer hover:text-white"
                  style={{ width: '32%', color: '#a3b1a8' }}
                >
                  <Plus style={{ width: uiPx(14), height: uiPx(14) }} />
                </button>
              </div>

              {processing && (
                <button
                  type="button"
                  disabled={!canExecute}
                  onClick={() => onAddToCraftingQueue?.(recipe.id, qty, globalSurvivorId)}
                  className="organic-button flex items-center justify-center px-3.5 cursor-pointer"
                  style={{
                    height: uiPx(38),
                    background: 'linear-gradient(180deg, rgba(47,64,54,.62), rgba(26,39,34,.76))',
                    border: '1px solid rgba(97,115,91,.42)',
                    color: '#bac8bf',
                    fontFamily: UI_FONT,
                    fontSize: uiPx(12),
                  }}
                >
                  + Hàng đợi
                </button>
              )}

              <button
                type="button"
                disabled={processing ? !immediateReady : !canExecute}
                onClick={() => {
                  if (processing) onStartCrafting?.(globalSurvivorId, recipe.id);
                  else onAddToCraftingQueue?.(recipe.id, qty, globalSurvivorId);
                }}
                className={`organic-button ${processing ? 'organic-button--teal' : 'organic-button--green'} flex items-center justify-center px-5 cursor-pointer`}
                style={{
                  height: uiPx(38),
                  color: '#e4eee8',
                  fontFamily: UI_FONT,
                  fontSize: uiPx(CRAFT_UI.typography.buttonPx),
                  fontWeight: 650,
                }}
              >
                {processing ? 'Sơ chế ngay' : `Thêm ${qty}×`}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeCount = visibleRecipes.length;

  return (
    <div className="absolute inset-0 pointer-events-none organic-ui-root" style={{ fontFamily: UI_FONT, containerType: 'inline-size' }}>
      <style>{`
        .crafting-icon-scrollbar,
        .crafting-material-scrollbar,
        .crafting-queue-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(86,142,112,.72) rgba(2,22,24,.34); }
        .crafting-icon-scrollbar::-webkit-scrollbar,
        .crafting-queue-scrollbar::-webkit-scrollbar { width: 7px; height: 7px; }
        .crafting-material-scrollbar::-webkit-scrollbar { width: 4px; }
        .crafting-icon-scrollbar::-webkit-scrollbar-track,
        .crafting-material-scrollbar::-webkit-scrollbar-track,
        .crafting-queue-scrollbar::-webkit-scrollbar-track { background: rgba(2,20,21,.22); border-radius: 6px; }
        .crafting-icon-scrollbar::-webkit-scrollbar-thumb,
        .crafting-material-scrollbar::-webkit-scrollbar-thumb,
        .crafting-queue-scrollbar::-webkit-scrollbar-thumb { background: rgba(78,137,106,.72); border-radius: 6px; }
      `}</style>

      <Anvil className="absolute text-[#57e9a3]" style={{ ...rootBoxStyle(CRAFT_UI.sectionBand.icon), strokeWidth: 2.25, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.45))' }} />

      <div className="absolute font-bold text-[#f0eadb]" style={{ ...rootBoxStyle(CRAFT_UI.sectionBand.title), fontSize: uiPx(CRAFT_UI.typography.sectionTitlePx), lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,.78)' }}>
        {activeMainTab === 'crafting' ? 'Xưởng Chế Tạo & Lắp Ráp' : activeMainTab === 'research' ? 'Nghiên Cứu Bản Vẽ' : 'Sơ Chế & Tinh Luyện'}
      </div>

      <div className="absolute text-[#d2d9cf]" style={{ ...rootBoxStyle(CRAFT_UI.sectionBand.subtitle), fontSize: uiPx(CRAFT_UI.typography.sectionSubtitlePx), lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,.60)' }}>
        {activeMainTab === 'crafting'
          ? 'Duyệt nhanh công thức bằng biểu tượng, xem nguyên liệu và sản phẩm trong bảng chi tiết.'
          : activeMainTab === 'research'
            ? 'Khám phá ý niệm, phân công thợ và hoàn thiện bản vẽ trước khi sản xuất.'
            : 'Các thao tác đơn tầng có thể thực hiện trực tiếp nếu đủ vật liệu và dụng cụ.'}
      </div>

      <div className="absolute organic-dock" style={{ ...rootBoxStyle(CRAFT_UI.artisan.panel), background: 'rgba(2,26,27,.20)' }} />
      <UserCheck className="absolute text-[#5ee7aa]" style={{ ...rootBoxStyle(CRAFT_UI.artisan.icon), strokeWidth: 2.2 }} />
      <div className="absolute text-[#eee9db]" style={{ ...rootBoxStyle(CRAFT_UI.artisan.label), fontSize: uiPx(CRAFT_UI.typography.artisanLabelPx), display: 'flex', alignItems: 'center' }}>Thợ mặc định:</div>
      <select value={globalSurvivorId} onChange={(event) => setGlobalSurvivorId(event.target.value)} className="absolute pointer-events-auto organic-select outline-none cursor-pointer" style={{ ...rootBoxStyle(CRAFT_UI.artisan.select), paddingLeft: uiPx(14), paddingRight: uiPx(10), fontFamily: UI_FONT, fontSize: uiPx(CRAFT_UI.typography.artisanSelectPx) }}>
        {survivors.map((survivor) => (
          <option key={survivor.id} value={survivor.id}>
            {survivor.name} ({survivor.currentAction.type === 'idle' ? 'Rảnh' : 'Bận'} • Chế tạo {Math.round(survivor.skills.crafting || 1)})
          </option>
        ))}
      </select>

      {([
        ['crafting', 'Chế tạo', Wrench, unlockedCraftingCount],
        ['research', 'Nghiên cứu', BookOpen, pendingResearchCount],
        ['processing', 'Sơ chế', Layers, processingRecipes.length],
      ] as const).map(([tab, label, Icon, count]) => {
        const active = activeMainTab === tab;
        return (
          <button key={tab} type="button" onClick={() => changeTab(tab)} className={`absolute pointer-events-auto organic-tab ${active ? 'organic-tab--active' : ''} flex items-center justify-center gap-2`} style={{ ...rootBoxStyle(CRAFT_UI.tabs[tab]), background: active ? 'rgba(18,57,45,.62)' : 'rgba(3,24,25,.28)', border: '1px solid rgba(68,103,84,.18)', color: active ? '#dce8dc' : '#9eaba1', fontFamily: UI_FONT, fontSize: uiPx(CRAFT_UI.typography.tabPx), fontWeight: active ? 700 : 600 }}>
            <Icon style={{ width: uiPx(14), height: uiPx(14), color: active ? '#69d79a' : '#8e9b91' }} />
            <span>{label}</span>
            <span style={{ color: active ? '#8fe2ad' : '#71847a', fontSize: uiPx(9.5) }}>{count}</span>
          </button>
        );
      })}

      <div className="absolute pointer-events-auto organic-recessed flex items-center" style={{ ...rootBoxStyle(CRAFT_UI.filters.search), padding: `0 ${uiPx(10)}`, gap: uiPx(7) }}>
        <Search style={{ width: uiPx(14), height: uiPx(14), color: '#7da18e' }} />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activeMainTab === 'research' ? 'Tìm bản vẽ...' : 'Tìm công thức...'} className="w-full min-w-0 bg-transparent outline-none text-[#d9e1d9] placeholder:text-[#6f8077]" style={{ fontFamily: UI_FONT, fontSize: uiPx(CRAFT_UI.typography.filterPx) }} />
      </div>

      <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as RecipeDefinition['category'] | 'all')} className="absolute pointer-events-auto organic-select outline-none cursor-pointer" style={{ ...rootBoxStyle(CRAFT_UI.filters.category), paddingLeft: uiPx(9), paddingRight: uiPx(7), fontFamily: UI_FONT, fontSize: uiPx(CRAFT_UI.typography.filterPx) }}>
        <option value="all">Tất cả danh mục</option>
        {categories.map((category) => <option key={category} value={category}>{getCategoryLabel(category)}</option>)}
      </select>

      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RecipeStatusFilter)} className="absolute pointer-events-auto organic-select outline-none cursor-pointer" style={{ ...rootBoxStyle(CRAFT_UI.filters.status), paddingLeft: uiPx(9), paddingRight: uiPx(7), fontFamily: UI_FONT, fontSize: uiPx(CRAFT_UI.typography.filterPx) }}>
        <option value="all">Mọi trạng thái</option>
        <option value="ready">Sẵn sàng</option>
        <option value="missing">Thiếu vật liệu</option>
        {activeMainTab !== 'processing' && <option value="locked">Chưa mở khóa</option>}
      </select>

      <div className="absolute organic-recessed flex items-center justify-center text-[#9eada3]" style={{ ...rootBoxStyle(CRAFT_UI.filters.count), fontSize: uiPx(CRAFT_UI.typography.countPx) }}>
        {activeCount} {activeMainTab === 'research' ? 'bản vẽ' : 'công thức'}
      </div>

      <div className="absolute organic-browser-panel pointer-events-auto" style={{ ...rootBoxStyle(CRAFT_UI.browser.listPanel) }}>
        <div className="absolute uppercase font-bold text-[#aab7af]" style={{ ...localBoxStyle(CRAFT_UI.browser.listTitle, CRAFT_UI.browser.listPanel), fontSize: uiPx(CRAFT_UI.typography.listTitlePx), letterSpacing: '.12em' }}>
          {activeMainTab === 'research' ? 'Danh sách bản vẽ' : 'Danh sách công thức'}
        </div>
        <div ref={recipeScrollRef} className="absolute crafting-icon-scrollbar overflow-y-auto overflow-x-hidden" style={{ ...localBoxStyle(CRAFT_UI.browser.grid, CRAFT_UI.browser.listPanel), paddingRight: uiPx(4) }}>
          {visibleRecipes.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', columnGap: uiPx(CRAFT_UI.browser.gapX), rowGap: uiPx(CRAFT_UI.browser.gapY), alignContent: 'start' }}>
              {visibleRecipes.map(renderRecipeTile)}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center" style={{ color: '#788b81', fontSize: uiPx(10.5) }}>Không có công thức phù hợp.</div>
          )}
        </div>
      </div>

      <div className="absolute organic-detail-panel pointer-events-auto" style={{ ...rootBoxStyle(CRAFT_UI.browser.detailPanel) }}>
        {renderDetail()}
      </div>

      <div className="absolute organic-dock pointer-events-auto" style={{ ...rootBoxStyle(CRAFT_UI.queueDock.panel) }}>
        <div className="absolute flex items-center gap-2 font-bold uppercase text-[#aebcb3]" style={{ ...localBoxStyle(CRAFT_UI.queueDock.title, CRAFT_UI.queueDock.panel), fontSize: uiPx(10.8), letterSpacing: '.10em' }}>
          <ListOrdered style={{ width: uiPx(14), height: uiPx(14), color: '#6fd09a' }} />
          Hàng đợi chế tạo • {craftingQueue.length}
        </div>
        <div className="absolute text-right text-[#6f8178]" style={{ ...localBoxStyle(CRAFT_UI.queueDock.hint, CRAFT_UI.queueDock.panel), fontSize: uiPx(9.2) }}>
          Chọn công thức ở trên để thêm; có thể đổi thợ, tạm dừng hoặc sắp xếp ưu tiên.
        </div>
        <div className="absolute crafting-queue-scrollbar overflow-x-auto overflow-y-hidden" style={{ ...localBoxStyle(CRAFT_UI.queueDock.list, CRAFT_UI.queueDock.panel) }}>
          {craftingQueue.length ? (
            <div className="flex h-full" style={{ gap: uiPx(8), paddingRight: uiPx(6) }}>
              {craftingQueue.map((item, index) => {
                const recipe = RECIPES_DATABASE[item.recipeId];
                if (!recipe) return null;
                const isProgressing = item.status === 'in_progress';
                const isPaused = item.status === 'paused';
                const progressPct = Math.round((item.progressSeconds / Math.max(item.totalSeconds, .001)) * 100);
                return (
                  <div key={item.id} className={`relative shrink-0 organic-queue-card ${isProgressing ? 'organic-queue-card--active' : isPaused ? 'organic-queue-card--paused' : ''}`} style={{ width: uiPx(330), height: uiPx(68), background: isPaused ? 'rgba(53,39,21,.38)' : 'rgba(3,28,26,.48)', border: '1px solid rgba(70,99,82,.30)' }}>
                    <div className="absolute flex items-center justify-center" style={{ left: uiPx(7), top: uiPx(7), width: uiPx(44), height: uiPx(44) }}>
                      <ItemIcon itemId={recipe.outputs[0]?.itemId} size={38} className="object-contain" />
                    </div>
                    <div className="absolute truncate font-semibold text-[#dde5df]" style={{ left: uiPx(56), top: uiPx(7), width: uiPx(170), fontSize: uiPx(9.7) }}>{recipe.name}</div>
                    <div className="absolute" style={{ left: uiPx(56), top: uiPx(25), width: uiPx(165), height: uiPx(5), background: 'rgba(0,0,0,.34)', borderRadius: uiPx(4), overflow: 'hidden' }}>
                      <div style={{ width: `${progressPct}%`, height: '100%', background: isPaused ? '#a57a35' : '#4eaf78' }} />
                    </div>
                    <select value={item.assignedSurvivorId || ''} onChange={(event) => onAssignSurvivorToQueue?.(item.id, event.target.value || undefined)} className="absolute organic-select organic-select--mini outline-none" style={{ left: uiPx(56), bottom: uiPx(5), width: uiPx(151), height: uiPx(20), fontSize: uiPx(8.2), paddingLeft: uiPx(5) }}>
                      <option value="">Tự động phân công</option>
                      {survivors.map((survivor) => <option key={survivor.id} value={survivor.id}>{survivor.name}</option>)}
                    </select>
                    <div className="absolute flex items-center" style={{ right: uiPx(6), bottom: uiPx(5), gap: uiPx(3) }}>
                      <button disabled={index === 0} onClick={() => onReorderQueue?.(item.id, 'up')} style={{ opacity: index === 0 ? .3 : 1 }}><ChevronUp style={{ width: uiPx(13), height: uiPx(13), color: '#8fa198' }} /></button>
                      <button disabled={index === craftingQueue.length - 1} onClick={() => onReorderQueue?.(item.id, 'down')} style={{ opacity: index === craftingQueue.length - 1 ? .3 : 1 }}><ChevronDown style={{ width: uiPx(13), height: uiPx(13), color: '#8fa198' }} /></button>
                      <button onClick={() => onTogglePauseQueueItem?.(item.id)}>{isProgressing ? <Pause style={{ width: uiPx(13), height: uiPx(13), color: '#d5b35f' }} /> : <Play style={{ width: uiPx(13), height: uiPx(13), color: '#73c990' }} />}</button>
                      <button onClick={() => onCancelQueueItem?.(item.id)}><Trash2 style={{ width: uiPx(13), height: uiPx(13), color: '#d3746f' }} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#6f8178]" style={{ fontSize: uiPx(9.8) }}>Hàng đợi đang trống.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const LightbulbFallback = () => <Sparkles style={{ width: uiPx(18), height: uiPx(18), color: '#c3a85d', flexShrink: 0 }} />;
