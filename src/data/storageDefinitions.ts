import type { ItemDefinition } from '../types';
import type { StorageEnvironmentProfile, StorageForm, StorageKind, StoragePolicy } from '../types/storageSimulation';

export interface StorageTypeDefinition {
  id: string;
  name: string;
  description: string;
  kind: StorageKind;
  buildingId?: string;
  capacity: {
    maxWeightKg: number;
    maxVolumeL: number;
    maxItemLengthCm?: number;
    liquidCapacityL?: number;
  };
  environment: StorageEnvironmentProfile;
  policy: StoragePolicy;
  allowedForms: StorageForm[];
  preferredForms: StorageForm[];
}

const defaultPolicy = (overrides: Partial<StoragePolicy> = {}): StoragePolicy => ({
  priority: 'normal',
  autoHaul: false,
  allowCategories: [],
  preferredTags: [],
  forbiddenTags: [],
  acceptDamaged: true,
  acceptSpoiled: false,
  stockRules: [],
  ...overrides,
});

export const STORAGE_TYPES: Record<string, StorageTypeDefinition> = {
  STORAGE_GROUND_CACHE: {
    id: 'STORAGE_GROUND_CACHE',
    name: 'Kho tạm trên nền',
    description: 'Vật tư được gom tại một điểm tập kết ngoài trời. Dễ tiếp cận nhưng hầu như không được bảo vệ khỏi mưa, ẩm và sinh vật.',
    kind: 'ground_cache',
    capacity: { maxWeightKg: 120, maxVolumeL: 180 },
    environment: {
      moistureProtection: 2,
      rainProtection: 0,
      pestProtection: 0,
      ventilation: 95,
      temperatureBuffer: 0,
      contaminationProtection: 5,
      fireProtection: 0,
      accessibility: 95,
    },
    policy: defaultPolicy({ priority: 'low', autoHaul: false }),
    allowedForms: ['loose', 'stackable', 'bundle', 'long', 'fragile', 'bulk'],
    preferredForms: ['bulk', 'long'],
  },

  STORAGE_WOVEN_RACK: {
    id: 'STORAGE_WOVEN_RACK',
    name: 'Kệ chứa đồ có mái lá',
    description: 'Kệ tre nâng vật tư khỏi nền đất, có mái lá che mưa trực tiếp và giữ khả năng thông khí tốt.',
    kind: 'rack',
    buildingId: 'BUILDING_WOVEN_BASKET_RACK',
    capacity: { maxWeightKg: 30, maxVolumeL: 50, maxItemLengthCm: 180 },
    environment: {
      moistureProtection: 40,
      rainProtection: 58,
      pestProtection: 24,
      ventilation: 82,
      temperatureBuffer: 10,
      contaminationProtection: 25,
      fireProtection: 8,
      accessibility: 88,
    },
    policy: defaultPolicy({ priority: 'normal', autoHaul: true, forbiddenTags: ['liquid'] }),
    allowedForms: ['loose', 'stackable', 'bundle', 'long', 'fragile'],
    preferredForms: ['stackable', 'bundle', 'long'],
  },

  STORAGE_BAMBOO_SUPPLY_CRATE: {
    id: 'STORAGE_BAMBOO_SUPPLY_CRATE',
    name: 'Thùng vật tư tre đan kín',
    description: 'Thùng đa dụng có nắp, dùng cho nguyên liệu, linh kiện và công cụ nhỏ cần tránh mưa và bụi bẩn.',
    kind: 'container',
    buildingId: 'BUILDING_BAMBOO_SUPPLY_CRATE',
    capacity: { maxWeightKg: 35, maxVolumeL: 55, maxItemLengthCm: 90 },
    environment: {
      moistureProtection: 58,
      rainProtection: 72,
      pestProtection: 48,
      ventilation: 32,
      temperatureBuffer: 18,
      contaminationProtection: 55,
      fireProtection: 8,
      accessibility: 70,
    },
    policy: defaultPolicy({ priority: 'normal', autoHaul: true, forbiddenTags: ['liquid'] }),
    allowedForms: ['loose', 'stackable', 'bundle', 'fragile'],
    preferredForms: ['stackable', 'bundle'],
  },

  STORAGE_BULK_MATERIAL_RACK: {
    id: 'STORAGE_BULK_MATERIAL_RACK',
    name: 'Giá vật liệu dài & cồng kềnh',
    description: 'Giá dài chuyên cho gỗ, thân tre, cọc, đá và vật liệu bulk; rất dễ lấy nhưng bảo vệ thời tiết hạn chế.',
    kind: 'bulk',
    buildingId: 'BUILDING_BULK_MATERIAL_RACK',
    capacity: { maxWeightKg: 90, maxVolumeL: 80, maxItemLengthCm: 260 },
    environment: {
      moistureProtection: 24,
      rainProtection: 28,
      pestProtection: 8,
      ventilation: 96,
      temperatureBuffer: 0,
      contaminationProtection: 10,
      fireProtection: 4,
      accessibility: 94,
    },
    policy: defaultPolicy({ priority: 'normal', autoHaul: true, forbiddenTags: ['liquid', 'medicine'] }),
    allowedForms: ['long', 'bulk'],
    preferredForms: ['long', 'bulk'],
  },

  STORAGE_MEDICINE_CHEST: {
    id: 'STORAGE_MEDICINE_CHEST',
    name: 'Hòm thuốc tre lót lá khô',
    description: 'Kho nhỏ chuyên dụng, khô và sạch hơn cho thuốc, băng gạc và dược liệu dễ hỏng.',
    kind: 'container',
    buildingId: 'BUILDING_MEDICINE_STORAGE_CHEST',
    capacity: { maxWeightKg: 15, maxVolumeL: 25, maxItemLengthCm: 55 },
    environment: {
      moistureProtection: 78,
      rainProtection: 82,
      pestProtection: 74,
      ventilation: 38,
      temperatureBuffer: 34,
      contaminationProtection: 86,
      fireProtection: 10,
      accessibility: 76,
    },
    policy: defaultPolicy({
      priority: 'high',
      autoHaul: true,
      allowCategories: ['medicine'],
      preferredTags: ['medicine', 'healing', 'first_aid'],
      forbiddenTags: ['liquid', 'bulk'],
    }),
    allowedForms: ['loose', 'stackable', 'bundle', 'fragile'],
    preferredForms: ['stackable', 'bundle', 'fragile'],
  },

  STORAGE_BAMBOO_WATER_TANK: {
    id: 'STORAGE_BAMBOO_WATER_TANK',
    name: 'Bồn nước tre ghép kín',
    description: 'Kho chuyên dụng cho nước dự trữ và vật chứa nước; kín hơn, khó nhiễm bẩn nhưng gần như không dùng cho đồ khô.',
    kind: 'liquid',
    buildingId: 'BUILDING_BAMBOO_WATER_TANK',
    capacity: { maxWeightKg: 70, maxVolumeL: 70, liquidCapacityL: 70, maxItemLengthCm: 70 },
    environment: {
      moistureProtection: 95,
      rainProtection: 90,
      pestProtection: 88,
      ventilation: 5,
      temperatureBuffer: 30,
      contaminationProtection: 82,
      fireProtection: 6,
      accessibility: 66,
    },
    policy: defaultPolicy({
      priority: 'high',
      autoHaul: true,
      allowCategories: ['water'],
      preferredTags: ['water', 'liquid', 'flask'],
      acceptSpoiled: false,
    }),
    allowedForms: ['liquid'],
    preferredForms: ['liquid'],
  },
};

export function inferStorageForm(def: ItemDefinition): StorageForm {
  if (def.category === 'water' || def.tags.includes('liquid')) return 'liquid';
  if (def.tags.some(tag => ['log', 'pole', 'bamboo_stalk', 'long'].includes(tag))) return 'long';
  if (def.tags.some(tag => ['stone', 'ore', 'clay', 'firewood', 'bulk'].includes(tag)) && def.volume >= 1.5) return 'bulk';
  if (def.tags.some(tag => ['rope', 'fiber', 'cord', 'bundle'].includes(tag))) return 'bundle';
  if (def.tags.some(tag => ['jar', 'pot', 'bottle', 'fragile'].includes(tag))) return 'fragile';
  if (def.stackSize > 1) return 'stackable';
  return 'loose';
}

export function storageTypeForBuilding(buildingId: string): StorageTypeDefinition | undefined {
  return Object.values(STORAGE_TYPES).find(type => type.buildingId === buildingId);
}