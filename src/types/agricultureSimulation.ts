import type { MaterialReservation } from './craftingSimulation';

export type AgricultureCarePolicy = 'minimal' | 'normal' | 'intensive' | 'emergency_only';
export type PlantArchitecture = 'herbaceous' | 'woody' | 'clumping';
export type PlantLifeStage = 'seed' | 'germinating' | 'seedling' | 'vegetative' | 'mature' | 'flowering' | 'fruiting' | 'senescent' | 'dead';
export type AnimalLifeStage = 'newborn' | 'juvenile' | 'subadult' | 'adult' | 'old' | 'dead';
export type AquaticSiteType = 'river_segment' | 'lake_edge' | 'pond_site';

export interface AgricultureSoilState {
  moisture: number;
  fertility: number;
  organicMatter: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  compaction: number;
  erosion: number;
  contamination: number;
}

export interface CultivationArea {
  id: string;
  poiId: string;
  clusterId?: string;
  name: string;
  cellIds: string[];
  usableAreaM2: number;
  carePolicy: AgricultureCarePolicy;
  soil: AgricultureSoilState;
  plantIds: string[];
  modifications: string[];
  createdAtGameMinute: number;
}

export interface PlantGenetics {
  yield: number;
  growth: number;
  droughtTolerance: number;
  floodTolerance: number;
  diseaseResistance: number;
  quality: number;
}

export interface PlantEntity {
  id: string;
  speciesId: string;
  cultivationAreaId: string;
  cellId: string;
  ageHours: number;
  lifeStage: PlantLifeStage;
  health: number;
  stress: number;
  rootHealth: number;
  stemHealth: number;
  foliageHealth: number;
  hydration: number;
  nutrientStatus: number;
  pestDamage: number;
  diseaseLoad: number;
  floweringProgress: number;
  fruitLoad: number;
  seedLoad: number;
  harvestableUnits: number;
  genetics: PlantGenetics;
  plantedAtGameMinute: number;
}

export interface TerrestrialGroundState {
  vegetationBiomass: number;
  manureLoad: number;
  mud: number;
  beddingQuality: number;
  standingWater: number;
  parasitePressure: number;
}

export interface TerrestrialHabitat {
  id: string;
  poiId: string;
  clusterId?: string;
  name: string;
  cellIds: string[];
  usableAreaM2: number;
  carePolicy: AgricultureCarePolicy;
  animalIds: string[];
  ground: TerrestrialGroundState;
  modifications: string[];
  boundaryCondition: number;
  predatorProtection: number;
  createdAtGameMinute: number;
}

export type AnimalSex = 'male' | 'female';
export type AnimalReproductiveState = 'immature' | 'ready' | 'pregnant' | 'incubating' | 'lactating' | 'recovering';

export interface AnimalGenetics {
  growth: number;
  fertility: number;
  diseaseResistance: number;
  feedEfficiency: number;
  production: number;
  temperament: number;
}

export interface TerrestrialAnimalEntity {
  id: string;
  speciesId: string;
  habitatId: string;
  sex: AnimalSex;
  ageHours: number;
  lifeStage: AnimalLifeStage;
  bodyWeightKg: number;
  bodyCondition: number;
  health: number;
  hunger: number;
  hydration: number;
  stress: number;
  injury: number;
  diseaseLoad: number;
  parasiteLoad: number;
  reproductiveState: AnimalReproductiveState;
  reproductiveProgress: number;
  productProgress: number;
  genetics: AnimalGenetics;
  bornAtGameMinute: number;
}

export interface AquaticWaterState {
  temperatureC: number;
  oxygen: number;
  turbidity: number;
  wasteLoad: number;
  pathogenLoad: number;
  flowRate: number;
  depthM: number;
  contamination: number;
}

export interface AquaticHabitat {
  id: string;
  poiId: string;
  name: string;
  siteType: AquaticSiteType;
  cellIds: string[];
  areaM2: number;
  carePolicy: AgricultureCarePolicy;
  aquaticAnimalIds: string[];
  water: AquaticWaterState;
  modifications: string[];
  barrierCondition: number;
  predatorProtection: number;
  escapeRisk: number;
  createdAtGameMinute: number;
}

export interface AquaticAnimalEntity {
  id: string;
  speciesId: string;
  habitatId: string;
  sex: AnimalSex;
  ageHours: number;
  lifeStage: AnimalLifeStage;
  weightKg: number;
  health: number;
  hunger: number;
  stress: number;
  diseaseLoad: number;
  oxygenStress: number;
  reproductiveState: AnimalReproductiveState;
  reproductiveProgress: number;
  genetics: AnimalGenetics;
  bornAtGameMinute: number;
}

export type AgricultureJobKind =
  | 'plant'
  | 'water'
  | 'tend'
  | 'fertilize'
  | 'harvest'
  | 'collect_seed'
  | 'remove_dead_plant'
  | 'feed_animals'
  | 'water_animals'
  | 'clean_habitat'
  | 'collect_product'
  | 'feed_aquatic'
  | 'inspect_water'
  | 'clean_aquatic'
  | 'harvest_aquatic';

export type AgricultureJobStatus = 'waiting_materials' | 'waiting_worker' | 'in_progress' | 'paused' | 'completed' | 'blocked';

export interface AgricultureJob {
  id: string;
  kind: AgricultureJobKind;
  status: AgricultureJobStatus;
  poiId: string;
  targetId: string;
  speciesId?: string;
  quantity?: number;
  assignedSurvivorId?: string;
  progressSeconds: number;
  totalSeconds: number;
  materialReservations: MaterialReservation[];
  materialsConsumed: boolean;
  blockedReasons: string[];
  payload?: Record<string, string | number | boolean | undefined>;
  createdAtGameMinute: number;
}

export interface AgricultureProductionRecord {
  id: string;
  gameMinute: number;
  sourceType: 'plant' | 'animal' | 'aquatic';
  sourceId: string;
  itemId: string;
  quantity: number;
  poiId: string;
}

export interface AgricultureSystemState {
  version: number;
  cultivationAreas: CultivationArea[];
  plants: PlantEntity[];
  terrestrialHabitats: TerrestrialHabitat[];
  terrestrialAnimals: TerrestrialAnimalEntity[];
  aquaticHabitats: AquaticHabitat[];
  aquaticAnimals: AquaticAnimalEntity[];
  jobs: AgricultureJob[];
  productionHistory: AgricultureProductionRecord[];
}

declare module './index' {
  interface GameState {
    agricultureSystem?: AgricultureSystemState;
  }
}

export {};