# ĐẶC TẢ CẤU TRÚC DỮ LIỆU (DATA SCHEMA)
## Dự án: Canopy - Tropical Survival Management

---

### 1. ITEM SCHEMA (`ItemDefinition`)
```typescript
export type ItemCategory = 
  | 'food'
  | 'water'
  | 'raw_material'
  | 'tool'
  | 'component'
  | 'medicine'
  | 'seed'
  | 'construction';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  weight: number;          // kg mỗi đơn vị
  volume: number;          // lít (L) mỗi đơn vị
  stackSize: number;       // số lượng tối đa 1 ô
  freshnessMax?: number;   // số ngày tối đa trước khi ôi thiu (nếu là đồ tươi)
  spoilageRate?: number;   // hệ số hao mòn độ tươi mỗi ngày
  nutrition?: {
    calories: number;      // giá trị năng lượng (kcal)
    protein?: number;      // gram
    carbs?: number;        // gram
    fat?: number;          // gram
    hydration: number;     // lượng nước bù đắp (ml/đơn vị)
    moraleBonus?: number;  // tăng tinh thần khi ăn ngon
  };
  toolProperties?: {
    type: 'axe' | 'pickaxe' | 'knife' | 'spear' | 'bucket' | 'hammer';
    tier: number;
    durabilityMax: number;
    efficiency: number;    // hệ số tốc độ khai thác/chế tác
  };
  tags: string[];          // ví dụ: ['wood', 'fiber', 'sharp', 'edible', 'coconut']
}
```

---

### 2. RECIPE SCHEMA (`RecipeDefinition`)
```typescript
export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeOutput {
  itemId: string;
  quantity: number;
  chance?: number;        // tỷ lệ ra sản phẩm phụ (ví dụ: bổ dừa ra vỏ 100%, nước 100%)
}

export interface RecipeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'survival' | 'tools' | 'processing' | 'food' | 'medicine' | 'materials';
  ingredients: RecipeIngredient[];
  outputs: RecipeOutput[];
  craftTimeSeconds: number; // thời gian chế tạo cơ sở (tại 1x speed)
  requiredSkill?: {
    skill: string;
    level: number;
  };
  requiredToolTag?: string; // ví dụ: cần 'knife' hoặc 'sharp'
  requiredBuildingId?: string; // ví dụ: 'fire_pit', 'workbench'
}
```

---

### 3. AREA & EXPEDITION SCHEMA (`AreaDefinition`)
```typescript
export interface ResourceNode {
  id: string;
  name: string;
  itemId: string;
  minAmount: number;
  maxAmount: number;
  gatherTimeMinutes: number;
  dangerLevel: number;
  requiredToolTag?: string;
  knowledgeRequired: number; // % cần thiết để thấy node này
}

export interface AreaDefinition {
  id: string;
  name: string;
  biome: 'beach' | 'jungle' | 'river' | 'bamboo' | 'swamp' | 'rocky' | 'cave';
  description: string;
  distanceKm: number;
  baseTravelTimeMinutes: number;
  baseDanger: number;        // thang 1-100
  waterAvailability: 'none' | 'dirty' | 'brackish' | 'fresh_stream';
  knowledge: number;         // 0 - 100%
  nodes: ResourceNode[];
}
```

---

### 4. SURVIVOR SCHEMA (`SurvivorState`)
```typescript
export type JobType = 
  | 'gather'
  | 'build'
  | 'craft'
  | 'cook'
  | 'haul'
  | 'medicine'
  | 'explore';

export type JobPriority = 'highest' | 'high' | 'normal' | 'low' | 'disabled';

export interface SurvivorState {
  id: string;
  name: string;
  role: string;
  portraitUrl: string;
  health: number;      // 0 - 100
  hunger: number;      // 0 (no) - 100 (đói cồn cào)
  thirst: number;      // 0 (no) - 100 (chết khát)
  fatigue: number;     // 0 (tỉnh táo) - 100 (kiệt sức)
  morale: number;      // 0 - 100
  skills: Record<string, number>; // ví dụ: { foraging: 2, crafting: 1, ... }
  traits: string[];    // ví dụ: ['Strong', 'Herbalist', 'Pessimist']
  jobPriorities: Record<JobType, JobPriority>;
  currentAction: {
    type: 'idle' | 'gathering' | 'crafting' | 'resting' | 'on_expedition';
    targetId?: string;
    progress: number;
    totalTime: number;
  };
}
```

---

### 5. TOÀN CẢNH TRẠNG THÁI GAME (`GameSaveState`)
```typescript
export interface GameSaveState {
  saveVersion: number;
  saveName: string;
  timestamp: number;
  gameTime: {
    day: number;
    minuteOfDay: number;  // 0 đến 1439 (24h)
    speed: 0 | 1 | 2 | 4; // 0 = pause
  };
  weather: {
    current: 'clear' | 'cloudy' | 'light_rain' | 'heavy_rain' | 'storm' | 'heat_wave';
    temperatureC: number;
    humidityPercent: number;
    durationRemainingMinutes: number;
  };
  survivors: SurvivorState[];
  inventory: {
    maxWeight: number;    // tổng tải trọng kho trại
    maxVolume: number;    // tổng thể tích kho trại
    items: Array<{
      id: string;
      itemId: string;
      quantity: number;
      condition?: number;
      freshness?: number;
    }>;
  };
  areas: Record<string, {
    knowledge: number;
    clearedNodes: Record<string, number>; // node ID -> thời điểm hồi sinh
  }>;
  buildings: Array<{
    id: string;
    buildingId: string;
    level: number;
    condition: number;
    isConstructed: boolean;
  }>;
  expeditions: Array<{
    id: string;
    areaId: string;
    survivorIds: string[];
    loadout: Array<{ itemId: string; quantity: number }>;
    progressMinutes: number;
    totalMinutes: number;
    gatheredItems: Array<{ itemId: string; quantity: number }>;
    status: 'traveling' | 'gathering' | 'returning' | 'completed';
  }>;
  logs: Array<{
    id: string;
    day: number;
    timeStr: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'danger';
  }>;
  policies: {
    foodPolicy: 'ration' | 'normal' | 'generous';
    waterPolicy: 'ration' | 'normal' | 'generous';
  };
}
```
