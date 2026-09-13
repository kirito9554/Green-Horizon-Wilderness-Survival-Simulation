import { GameState } from '../types';
import { getDefaultResourcePools, calculateResourceRecoveryBonus } from './resourcePools';
import { addItemToInventory } from './inventorySystem';
import { formatTimeOfDay } from './timeSystem';

// System: Resource Pools Passive Recovery and Passive Rain Collector
export function tickResourceSystem(next: GameState, deltaGameMinutes: number): void {
  // 1. Passive Rain Collection (if rain collector built and raining)
  const hasRainCollector = next.buildings.some(b => b.buildingId === 'BUILDING_RAIN_COLLECTOR' && b.isBuilt);
  if (hasRainCollector && (next.weather.current === 'light_rain' || next.weather.current === 'heavy_rain')) {
    // Every ~30 game minutes of rain, yields boiled-grade fresh rainwater into a bowl
    if (Math.random() < (deltaGameMinutes / 30)) {
      addItemToInventory(next.inventory, 'ITEM_BOILED_WATER_BOWL', 1);
      next.logs.unshift({
        id: `rain_col_${Date.now()}`,
        day: next.gameTime.day,
        timeStr: formatTimeOfDay(next.gameTime.minuteOfDay),
        text: 'Rainwater collector caught fresh drinking water in coconut bowls.',
        type: 'success',
      });
    }
  }

  // 2. Resource Pools Passive Recovery with remaining stock bonus
  if (!next.resourcePools) {
    next.resourcePools = getDefaultResourcePools();
  }
  for (const pool of Object.values(next.resourcePools)) {
    if (pool.currentStock < pool.maxStock) {
      const { multiplier } = calculateResourceRecoveryBonus(pool.currentStock, pool.maxStock);
      const recoveryPerMinute = (pool.baseRecoveryPerHour / 60) * multiplier;
      pool.currentStock = Math.min(pool.maxStock, pool.currentStock + recoveryPerMinute * deltaGameMinutes);
    }
  }
}
