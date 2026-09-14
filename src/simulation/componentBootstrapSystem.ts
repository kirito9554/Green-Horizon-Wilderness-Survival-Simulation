import type { GameState } from '../types';
import { ITEMS_DATABASE } from '../data/items';
import {
  ensureToolComponentInstances,
  isToolOperational,
  syncAggregateConditionFromComponents,
} from './componentSystem';

/**
 * Transitional bootstrap while every acquisition path is migrated to create
 * component instances directly.
 *
 * Component state is canonical. The aggregate condition field remains a legacy
 * compatibility summary, so rebuild it every tick and force it to zero whenever
 * a critical assembly is not operational. Older systems that still gate on
 * `condition > 0` therefore cannot accidentally use a knife with a failed
 * blade/binding, a bow with a snapped string, etc.
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
      syncAggregateConditionFromComponents(item);

      if (!isToolOperational(item, def)) {
        item.condition = 0;
      }
    }
  }
}