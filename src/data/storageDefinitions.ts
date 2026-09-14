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