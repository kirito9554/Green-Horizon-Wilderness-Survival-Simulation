import type { GameState } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import { ensureToolComponentInstances } from './componentSystem';

/**
 * Transitional bootstrap while every acquisition path is migrated to create
 * component instances directly. It only fills missing component state and does
 * not overwrite existing wear/repair data.
 */
export function tickComponentBootstrap(state: GameState): void {
  const inventories = [
    state.inventory,
    ...Object.values(state.poiStorages || {}),
  ];

  for (const inventory of inventories) {
    for (const item of inventory.items) {
      const def = ITEMS_DATABASE[item.itemId];
      if (!def || (!def.toolProperties && def.category !== 'tool')) continue;
      ensureToolComponentInstances(item, def);
    }
  }
}
