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
  calories: number;       // Energy kcal
  hydration: number;      // Water ml
  protein?: number;
  fat?: number;
  moraleBonus?: number;
}

export interface ToolProperties {
  type: 'axe' | 'knife' | 'spear' | 'hammer' | 'container' | 'canteen';
  tier: number;
  durabilityMax: number;
  efficiency: number;
  hardness?: number;          // 1 - 5: chống mài mòn khi va chạm vật liệu cứng
  repairable?: boolean;       // có thể mài sắc / buộc lại dây
}

export type PreservationType = 
  | 'raw_fresh'        // Thực phẩm sống, nhanh ươn
  | 'perishable'       // Thức ăn thông thường
  | 'cooked'           // Đã nấu chín / nướng, tươi lâu hơn
  | 'dried'            // Đã sấy khô / hun khói
  | 'sealed'           // Bịt kín trong đồ chứa
  | 'non_perishable';  // Không bị hỏng (đá, kim loại, củi khô...)

export interface BreakageYield {
  itemId: string;
  quantity: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  weight: number;          // kg per unit
  volume: number;          // liters per unit
  stackSize: number;       // max stack in an inventory slot
  freshnessMaxDays?: number; // days until spoiled (undefined = non-perishable)
  preservationType?: PreservationType;
  nutrition?: Nutrition;
  toolProperties?: ToolProperties;
  breakageSalvage?: BreakageYield[]; // Phế liệu thu hồi khi độ bền cạn về 0
  tags: string[];          // e.g., ['wood', 'fiber', 'sharp', 'edible', 'coconut', 'water_container']
  iconName: string;        // Lucide icon identifier
}

export type ItemQuality = 'crude' | 'standard' | 'prime' | 'masterwork';

export interface QualityBreakdown {
  crude?: number;      // Tạm bợ / mục nứt / xơ non
  standard?: number;   // Đạt chuẩn / ráo nước
  prime?: number;      // Tuyển chọn / chắc thịt / lõi cứng
  masterwork?: number; // Hoàn mỹ / thượng phẩm
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
  quality?: ItemQuality;              // Phẩm chất của trang bị/vật phẩm đơn chiếc
  qualityBreakdown?: QualityBreakdown; // Phân bổ phẩm chất trong stack
  condition?: number;                 // Độ bền hiện tại (0 - conditionMax)
  conditionMax?: number;              // Độ bền tối đa thực tế (được tăng theo phẩm chất)
  freshness?: number;                 // Độ tươi hiện tại (0 - 100)
  spoilageMultiplier?: number;        // Hệ số bảo quản riêng (0.5 = chậm gấp đôi)
  craftedInfo?: CraftedInfo;          // Thông tin thợ chế tác và thời điểm tạo ra
  isFavorite?: boolean;
}

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeOutput {
  itemId: string;
  quantity: number;
  chance?: number;         // 0 - 1 (default 1)
}

export interface RecipeDefinition {
  id: string;
  name: string;
  description: string;
  type?: 'crafting' | 'processing'; // 'crafting' (kết hợp/lắp ráp đa thành phần) vs 'processing' (sơ chế/tinh luyện đơn tầng)
  category: 'tools' | 'processing' | 'food' | 'water' | 'materials' | 'shelter' | 'medicine';
  ingredients: RecipeIngredient[];
  outputs: RecipeOutput[];
  craftTimeSeconds: number; // base time at 1x speed
  researchTimeSeconds?: number; // Thời gian nghiên cứu bản vẽ (giây) nếu là loại 'crafting'
  unlockedByDefault?: boolean; // Mở khoá sẵn từ đầu (không cần nghiên cứu)
  requiredSkill?: {
    skill: string;
    level: number;
  };
  requiredToolTag?: string; // e.g., 'sharp' (knife or sharp stone)
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
  speedKmh: number;        // Average wind speed (km/h)
  gustKmh: number;         // Peak instantaneous gust (km/h)
  directionDeg: number;    // Direction angle 0-360 degrees
  cardinal: string;        // Cardinal label e.g., 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'
}

export interface WeatherState {
  current: WeatherType;
  previous?: WeatherType;
  next?: WeatherType;
  temperatureC: number;
  humidityPercent: number;
  durationRemainingMinutes: number;
  totalDurationMinutes?: number;
  transitionProgress?: number; // 0.0 to 1.0
  rainIntensity?: number;      // 0.0 to 1.0
  cloudCover?: number;         // 0.0 to 1.0
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
  type: 'idle' | 'gathering' | 'crafting' | 'building' | 'resting' | 'on_expedition' | 'researching';
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
  portraitIndex?: number;  // 0 - 19 in 4x5 sprite sheet
  health: number;          // 0 - 100
  hunger: number;          // 0 (full) - 100 (starving)
  thirst: number;          // 0 (quenched) - 100 (dehydrated)
  fatigue: number;         // 0 (energetic) - 100 (exhausted)
  morale: number;          // 0 (broken) - 100 (inspired)
  skills: Record<string, number>; // foraging, crafting, cooking, medicine, exploration, etc.
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
  dangerLevel: number;     // 0 - 100
  requiredToolTag?: string;
  knowledgeRequired: number; // % needed to see this node
  respawnTimeMinutes: number; // how long before it can be harvested again
}

export interface AreaDefinition {
  id: string;
  name: string;
  biome: 'beach' | 'jungle' | 'river' | 'bamboo' | 'swamp' | 'rocky' | 'cave';
  description: string;
  imageUrl?: string;
  distanceKm: number;
  baseTravelMinutes: number;
  baseDanger: number;      // 0 - 100
  waterAvailability: 'none' | 'dirty' | 'brackish' | 'fresh_stream';
  nodes: ResourceNode[];
  flavorText: string;
  sector?: 'center' | 'up' | 'down' | 'left' | 'right';
  mapX?: number; // 0 - 100% position on world map
  mapY?: number; // 0 - 100% position on world map
  boxW?: number; // width % of detected label pill on map image
  boxH?: number; // height % of detected label pill on map image
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
  condition: number;       // 0 - 100
  isBuilt: boolean;
  buildProgressSeconds: number;
  totalBuildSeconds: number;
  areaId?: string;         // Địa điểm POI xây dựng công trình (mặc định AREA_CAMP_CLEARING)
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
  gameSpeedMultiplier: number; // for balancing
}

export interface GameState {
  saveVersion: number;
  campName: string;
  gameTime: {
    day: number;
    minuteOfDay: number;   // 0 - 1439
    speed: 0 | 1 | 2 | 4;  // 0 = paused
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
    lastGatheredTime: Record<string, number>; // nodeId -> gameMinute
  }>;
  buildings: ConstructedBuilding[];
  poiStorages?: Record<string, StorageInventory>;
  expeditions: ActiveExpedition[];
  resourcePools: Record<string, ResourcePoolState>;
  researches?: Record<string, RecipeResearchState>;
  craftingQueue?: CraftingQueueItem[];
  discoveredRecipeIds?: string[];
  logs: LogMessage[];
  settings: GameSettings;
}
