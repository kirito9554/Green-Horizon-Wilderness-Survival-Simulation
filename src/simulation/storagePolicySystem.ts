import type { GameState } from '../types';
import type { StoragePriority } from '../types/storageSimulation';
import '../types/storageSimulation';
import { ensureStorageSystem } from './storageSystem';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function setStorageAutoHaul(state: GameState, locationId: string, enabled: boolean): GameState {
  const next = clone(state);
  const location = ensureStorageSystem(next).locations.find(candidate => candidate.id === locationId);
  if (!location || location.isGroundCache) return state;
  location.policy.autoHaul = enabled;
  return next;
}

export function setStoragePriority(state: GameState, locationId: string, priority: StoragePriority): GameState {
  const next = clone(state);
  const location = ensureStorageSystem(next).locations.find(candidate => candidate.id === locationId);
  if (!location) return state;
  location.policy.priority = priority;
  return next;
}

export function setStorageStockRule(
  state: GameState,
  locationId: string,
  itemId: string,
  minQuantity: number,
  maxQuantity?: number,
): GameState {
  const next = clone(state);
  const location = ensureStorageSystem(next).locations.find(candidate => candidate.id === locationId);
  if (!location) return state;
  const min = Math.max(0, Math.floor(minQuantity));
  const max = maxQuantity === undefined || !Number.isFinite(maxQuantity)
    ? undefined
    : Math.max(min, Math.floor(maxQuantity));
  const existing = location.policy.stockRules.find(rule => rule.itemId === itemId);
  if (existing) {
    existing.minQuantity = min;
    existing.maxQuantity = max;
  } else {
    location.policy.stockRules.push({ itemId, minQuantity: min, maxQuantity: max });
  }
  return next;
}

export function removeStorageStockRule(state: GameState, locationId: string, itemId: string): GameState {
  const next = clone(state);
  const location = ensureStorageSystem(next).locations.find(candidate => candidate.id === locationId);
  if (!location) return state;
  location.policy.stockRules = location.policy.stockRules.filter(rule => rule.itemId !== itemId);
  return next;
}
