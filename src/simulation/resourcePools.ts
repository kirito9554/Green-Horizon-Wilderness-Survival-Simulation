import { ResourcePoolState } from '../types';
import { AREAS_DATABASE } from '../data/areas';

export interface PoolConfig {
  maxStock: number;
  initialStock: number;
  baseRecoveryPerHour: number;
  resourceCategory: 'botany' | 'wood' | 'minerals' | 'marine' | 'water';
}

export const NODE_POOL_CONFIGS: Record<string, PoolConfig> = {
  // Camp nodes
  NODE_CAMP_COCONUTS: {
    maxStock: 24,
    initialStock: 18,
    baseRecoveryPerHour: 2.4, // Coconuts fall from mature palms periodically
    resourceCategory: 'botany',
  },
  NODE_CAMP_DRIFTWOOD: {
    maxStock: 35,
    initialStock: 28,
    baseRecoveryPerHour: 3.6, // Washed ashore with tide surges
    resourceCategory: 'wood',
  },
  NODE_CAMP_STONES: {
    maxStock: 25,
    initialStock: 20,
    baseRecoveryPerHour: 1.5, // Slow pebble wash & gravel deposit
    resourceCategory: 'minerals',
  },
  NODE_CAMP_PALM_FRONDS: {
    maxStock: 40,
    initialStock: 32,
    baseRecoveryPerHour: 4.0, // Vigorous tropical palm leaf sprout
    resourceCategory: 'botany',
  },
  NODE_CAMP_VINES: {
    maxStock: 30,
    initialStock: 24,
    baseRecoveryPerHour: 3.0, // Jungle creepers grow quickly
    resourceCategory: 'botany',
  },

  // Coastal shallows
  NODE_SHALLOW_FISH: {
    maxStock: 20,
    initialStock: 16,
    baseRecoveryPerHour: 2.5, // Tidal schools in shallow reef
    resourceCategory: 'marine',
  },
  NODE_REEF_DRIFTWOOD: {
    maxStock: 30,
    initialStock: 25,
    baseRecoveryPerHour: 2.8,
    resourceCategory: 'wood',
  },

  // Riverbank
  NODE_RIVER_WATER: {
    maxStock: 60,
    initialStock: 55,
    baseRecoveryPerHour: 12.0, // Fresh streaming creek
    resourceCategory: 'water',
  },
  NODE_RIVER_CLAY: {
    maxStock: 30,
    initialStock: 25,
    baseRecoveryPerHour: 2.0, // Silt sediment
    resourceCategory: 'minerals',
  },
  NODE_RIVER_HERBS: {
    maxStock: 16,
    initialStock: 12,
    baseRecoveryPerHour: 1.2, // Fragile medicinal root
    resourceCategory: 'botany',
  },
  NODE_RIVER_FISH: {
    maxStock: 22,
    initialStock: 18,
    baseRecoveryPerHour: 2.4,
    resourceCategory: 'marine',
  },

  // Bamboo grove
  NODE_BAMBOO_STALKS: {
    maxStock: 35,
    initialStock: 30,
    baseRecoveryPerHour: 2.2, // Bamboo cane maturation
    resourceCategory: 'wood',
  },
  NODE_CANOPY_FIGS: {
    maxStock: 25,
    initialStock: 20,
    baseRecoveryPerHour: 3.0, // Epiphytic fruit clusters
    resourceCategory: 'botany',
  },
};

/**
 * Calculates recovery rate bonus based on remaining stock.
 * In natural ecosystems:
 * - High stock (>65%): Mother trees, healthy seed beds, and breeding fish provide a high regenerative bonus (up to +100%).
 * - Medium stock (30% - 65%): Balanced standard regeneration.
 * - Stressed stock (<30%): Over-harvested ecosystem. Recovery slows significantly (down to -75%) because roots/parent plants were stripped.
 * - Depleted (0): Ecological shock, very slow crawl until initial shoots re-establish.
 */
export function calculateResourceRecoveryBonus(
  currentStock: number, 
  maxStock: number
): {
  multiplier: number;
  bonusPercent: number;
  status: 'abundant' | 'normal' | 'stressed' | 'depleted';
  statusLabel: string;
  badgeColor: string;
} {
  if (currentStock <= 0.05) {
    return {
      multiplier: 0.25,
      bonusPercent: -75,
      status: 'depleted',
      statusLabel: 'Cạn kiệt (Phục hồi cực chậm)',
      badgeColor: 'text-red-400 bg-red-950/60 border-red-800',
    };
  }

  const ratio = Math.max(0, Math.min(1, currentStock / maxStock));

  if (ratio >= 0.65) {
    // Abundant stock bonus: 1.3x to 2.0x base speed
    const normalized = (ratio - 0.65) / 0.35; // 0 to 1
    const bonusPercent = Math.round(30 + normalized * 70); // +30% to +100%
    const multiplier = 1 + bonusPercent / 100;
    return {
      multiplier,
      bonusPercent,
      status: 'abundant',
      statusLabel: `Dồi dào (+${bonusPercent}% phục hồi)`,
      badgeColor: 'text-emerald-300 bg-emerald-950/60 border-emerald-700',
    };
  } else if (ratio >= 0.3) {
    // Normal / stable range
    return {
      multiplier: 1.0,
      bonusPercent: 0,
      status: 'normal',
      statusLabel: 'Ổn định (100% tốc độ gốc)',
      badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-700',
    };
  } else {
    // Stressed / over-harvested range: 0.4x to 0.7x speed
    const normalized = ratio / 0.3; // 0 to 1
    const penaltyPercent = Math.round(60 - normalized * 35); // -25% to -60%
    const multiplier = Math.max(0.3, 1 - penaltyPercent / 100);
    return {
      multiplier,
      bonusPercent: -penaltyPercent,
      status: 'stressed',
      statusLabel: `Suy thoái (-${penaltyPercent}% phục hồi)`,
      badgeColor: 'text-orange-400 bg-orange-950/60 border-orange-800',
    };
  }
}

/**
 * Initializes resource pools for all known nodes.
 */
export function getDefaultResourcePools(): Record<string, ResourcePoolState> {
  const pools: Record<string, ResourcePoolState> = {};

  for (const [nodeId, config] of Object.entries(NODE_POOL_CONFIGS)) {
    pools[nodeId] = {
      nodeId,
      currentStock: config.initialStock,
      maxStock: config.maxStock,
      baseRecoveryPerHour: config.baseRecoveryPerHour,
      lastUpdatedMinute: 0,
    };
  }

  // Ensure every node across all areas has an active resource pool
  for (const area of Object.values(AREAS_DATABASE)) {
    for (const node of area.nodes) {
      if (!pools[node.id]) {
        pools[node.id] = {
          nodeId: node.id,
          currentStock: 20,
          maxStock: 25,
          baseRecoveryPerHour: 2.5,
          lastUpdatedMinute: 0,
        };
      }
    }
  }

  return pools;
}
