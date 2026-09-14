/**
 * Canopy: Tropical Survival Management
 * Comprehensive Type System for Phase 1 & Foundation for Future Phases
 */

export type ItemCategory = 
  | 'food'
  | 'water'
  | 'raw_material'
  | 'tool'
  | 'component'
  | 'medicine'
  | 'seed'
  | 'construction';

export interface Nutrition {
  calories: number;
  hydration: number;
  protein?: number;
  fat?: number;
  moraleBonus?: number;
}

export interface ToolProperties {
  type: 'axe' | 'knife' | 'spear' | 'hammer' | 'container' | 'canteen' | 'bow';
  tier: number;
  durabilityMax: number;
  efficiency: number;
  hardness?: number;
  repairable?: boolean;
}

export type PreservationType = 
  | 'raw_fresh'
  | 'perishable'
  | 'cooked'
  | 'dried'
  | 'sealed'
  | 'non_perishable';

export interface BreakageYield {
  itemId: string;
  quantity: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  weight: number;
  volume: number;
  stackSize: number;
  freshnessMaxDays?: number;
  preservationType?: PreservationType;
  nutrition?: Nutrition;
  toolProperties?: ToolProperties;
  breakageSalvage?: BreakageYield[];
  tags: string[];
  iconName: string;
}

export type ItemQuality = 'crude' | 'standard' | 'prime' | 'masterwork';

export interface QualityBreakdown {
  crude?: number;
  standard?: number;
  prime?: number;
  masterwork?: number;
}

export interface CraftedInfo {
  crafterName: string;
  craftingSkill: number;
  materialQuality: ItemQuality;
  craftedDay: number;
}

export interface InventoryItem {
  instanceId: string;
  itemId: string;
  quantity: number;
  quality?: ItemQuality;
  qualityBreakdown?: QualityBreakdown;
  condition?: number;
  conditionMax?: number;
  freshness?: number;
  spoilageMultiplier?: number;
  craftedInfo?: CraftedInfo;
  isFavorite?: boolean;
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeOutput {
  itemId: string;
  quantity: number;
  chance?: number;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  description: string;
  type?: 'crafting' | 'processing';
  category: 'tools' | 'processing' | 'food' | 'water' | 'materials' | 'shelter' | 'medicine' | 'survival' | 'utility';
  ingredients: RecipeIngredient[];
  outputs: RecipeOutput[];
  craftTimeSeconds: number;
  researchTimeSeconds?: number;
  unlockedByDefault?: boolean;
  tier?: 'Primitive' | 'Basic' | 'Advanced';
  workstationName?: string;
  durabilityLevel?: 'Low' | 'Medium' | 'High' | 'Indestructible' | 'One-time';
  weightKg?: number;
  useCases?: string;
  ingredientClues?: Record<string, string>;
  progression?: {
    nextRecipeId: string;
    nextName: string;
    nextStats?: {
      durability?: string;
      cutting?: string;
      feature?: string;
    };
  };
  requiredSkill?: {
    skill: string;
    level: number;
  };
  requiredToolTag?: string;
  requiredBuildingId?: string;
}

export interface RecipeResearchState {
  recipeId: string;
  status: 'locked' | 'discovered' | 'in_progress' | 'paused' | 'completed';
  progressSeconds: number;
  totalSeconds: number;
  assignedSurvivorId?: string;
}

export interface CraftingQueueItem {
  id: string;
  recipeId: string;
  quantity: number;
  completedCount: number;
  assignedSurvivorId?: string;
  progressSeconds: number;
  totalSeconds: number;
  status: 'pending' | 'in_progress' | 'paused';
  createdAt: number;
  activeIngredientQualities?: ItemQuality[];
}

export type WeatherType = 
  | 'clear' 
  | 'cloudy' 
  | 'light_rain' 
  | 'heavy_rain' 
  | 'storm' 
  | 'fog'
  | 'heat_wave';

export interface WindState {
  speedKmh: number;
  gustKmh: number;
  directionDeg: number;
  cardinal: string;
}

export interface WeatherState {
  current: WeatherType;
  previous?: WeatherType;
  next?: WeatherType;
  temperatureC: number;
  humidityPercent: number;
  durationRemainingMinutes: number;
  totalDurationMinutes?: number;
  transitionProgress?: number;
  rainIntensity?: number;
  cloudCover?: number;
  wind?: WindState;
}

export type JobType = 
  | 'gather'
  | 'build'
  | 'craft'
  | 'cook'
  | 'haul'
  | 'medicine'
  | 'explore';

export type JobPriority = 'highest' | 'high' | 'normal' | 'low' | 'disabled';

export interface CurrentAction {
  type: 'idle' | 'gathering' | 'crafting' | 'building' | 'hauling' | 'resting' | 'on_expedition' | 'researching';
  description: string;
  targetId?: string;
  progressSeconds: number;
  totalSeconds: number;
  resultPayload?: Record<string, unknown>;
}

export interface SurvivorState {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  avatarUrl?: string;
  portraitIndex?: number;
  health: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  morale: number;
  skills: Record<string, number>;
  traits: string[];
  jobPriorities: Record<JobType, JobPriority>;
  currentAction: CurrentAction;
}

export interface ResourcePoolState {
  nodeId: string;
  currentStock: number;
  maxStock: number;
  baseRecoveryPerHour: number;
  lastUpdatedMinute: number;
}

export interface ResourceNode {
  id: string;
  name: string;
  description: string;
  itemId: string;
  minYield: number;
  maxYield: number;
  gatherTimeSeconds: number;
  dangerLevel: number;
  requiredToolTag?: string;
  knowledgeRequired: number;
  respawnTimeMinutes: number;
}

export interface AreaDefinition {
  id: string;
  name: string;
  biome: 'beach' | 'jungle' | 'river' | 'bamboo' | 'swamp' | 'rocky' | 'cave';
  description: string;
  imageUrl?: string;
  distanceKm: number;
  baseTravelMinutes: number;
  baseDanger: number;
  waterAvailability: 'none' | 'dirty' | 'brackish' | 'fresh_stream';
  nodes: ResourceNode[];
  flavorText: string;
  sector?: 'center' | 'up' | 'down' | 'left' | 'right';
  mapX?: number;
  mapY?: number;
  boxW?: number;
  boxH?: number;
  iconType?: 'water' | 'ruins' | 'bamboo' | 'clay' | 'camp' | 'trail' | 'forage' | 'hut' | 'river' | 'wildlife' | 'cave' | 'mountain' | 'village' | 'dock' | 'beach' | 'shrine';
}

export interface ActiveExpedition {
  id: string;
  areaId: string;
  survivorIds: string[];
  rationItemId?: string;
  rationCount: number;
  waterContainerItemId?: string;
  waterCount: number;
  equippedToolIds: string[];
  totalMinutes: number;
  progressMinutes: number;
  phase: 'travel_out' | 'exploring' | 'travel_back' | 'finished';
  collectedLoot: Array<{ itemId: string; quantity: number }>;
  eventLog: string[];
  knowledgeGained: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  category: 'shelter' | 'storage' | 'water' | 'food' | 'production' | 'infrastructure';
  cost: Array<{ itemId: string; quantity: number }>;
  buildTimeSeconds: number;
  benefitsDescription: string;
  maxCapacityIncrease?: {
    weightKg?: number;
    volumeL?: number;
  };
}

export interface StorageInventory {
  maxWeightKg: number;
  maxVolumeL: number;
  items: InventoryItem[];
}

export interface ConstructedBuilding {
  id: string;
  buildingId: string;
  condition: number;
  isBuilt: boolean;
  buildProgressSeconds: number;
  totalBuildSeconds: number;
  areaId?: string;
}

export interface LogMessage {
  id: string;
  day: number;
  timeStr: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

export interface GameSettings {
  autoConsumeFood: boolean;
  autoConsumeWater: boolean;
  foodPolicy: 'ration' | 'normal' | 'generous';
  waterPolicy: 'ration' | 'normal' | 'generous';
  soundEnabled: boolean;
  gameSpeedMultiplier: number;
}

export interface GameState {
  saveVersion: number;
  campName: string;
  gameTime: {
    day: number;
    minuteOfDay: number;
    speed: 0 | 1 | 2 | 4;
  };
  weather: WeatherState;
  survivors: SurvivorState[];
  inventory: {
    maxWeightKg: number;
    maxVolumeL: number;
    items: InventoryItem[];
  };
  areasProgress: Record<string, {
    knowledgePercent: number;
    lastGatheredTime: Record<string, number>;
  }>;
  buildings: ConstructedBuilding[];
  poiStorages?: Record<string, StorageInventory>;
  expeditions: ActiveExpedition[];
  resourcePools: Record<string, ResourcePoolState>;
  researches?: Record<string, RecipeResearchState>;
  craftingQueue?: CraftingQueueItem[];
  discoveredRecipeIds?: string[];
  pinnedRecipeIds?: string[];
  favoriteRecipeIds?: string[];
  recentlyCrafted?: Array<{
    id: string;
    recipeId: string;
    name: string;
    quantity: number;
    timestamp: number;
    timeAgoText?: string;
  }>;
  logs: LogMessage[];
  settings: GameSettings;
}