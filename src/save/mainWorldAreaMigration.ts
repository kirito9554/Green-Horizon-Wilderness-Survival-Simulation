import type { GameState, InventoryItem, StorageInventory } from '../types';
import type { PoiBuildGrid } from '../types/buildingSimulation';
import {
  LEGACY_MAIN_AREA_REDIRECTS,
  resolveMainWorldAreaId,
} from '../data/mainWorldAreas';

const AREA_REFERENCE_KEYS = new Set([
  'areaId',
  'poiId',
  'sourcePoiId',
  'targetPoiId',
]);

const STORAGE_LOCATION_REFERENCE_KEYS = new Set([
  'storageLocationId',
  'sourceLocationId',
  'targetLocationId',
  'locationId',
]);

function groundStorageId(poiId: string): string {
  return `storage_ground_${poiId}`;
}

function canonicalAreaId(areaId: string | undefined): string | undefined {
  return areaId ? (resolveMainWorldAreaId(areaId) || areaId) : areaId;
}

function mergeLastGatheredTime(
  target: Record<string, number>,
  source: Record<string, number>,
): Record<string, number> {
  const merged = { ...target };
  for (const [nodeId, value] of Object.entries(source || {})) {
    merged[nodeId] = Math.max(merged[nodeId] || 0, value || 0);
  }
  return merged;
}

function migrateAreaProgressKeys(state: GameState): void {
  state.areasProgress ||= {};
  for (const [legacyId, canonicalId] of Object.entries(LEGACY_MAIN_AREA_REDIRECTS)) {
    const legacy = state.areasProgress[legacyId];
    if (!legacy) continue;
    const target = state.areasProgress[canonicalId];
    if (!target) {
      state.areasProgress[canonicalId] = legacy;
    } else {
      target.knowledgePercent = Math.max(target.knowledgePercent || 0, legacy.knowledgePercent || 0);
      target.lastGatheredTime = mergeLastGatheredTime(
        target.lastGatheredTime || {},
        legacy.lastGatheredTime || {},
      );
    }
    delete state.areasProgress[legacyId];
  }
}

function mergeInventoryItems(target: InventoryItem[], source: InventoryItem[]): void {
  const knownInstances = new Set(target.map(item => item.instanceId));
  for (const item of source) {
    if (knownInstances.has(item.instanceId)) continue;
    target.push(item);
    knownInstances.add(item.instanceId);
  }
}

function mergePoiStorage(target: StorageInventory, source: StorageInventory): void {
  target.maxWeightKg = Math.max(target.maxWeightKg || 0, source.maxWeightKg || 0);
  target.maxVolumeL = Math.max(target.maxVolumeL || 0, source.maxVolumeL || 0);
  target.items ||= [];
  mergeInventoryItems(target.items, source.items || []);
}

function migratePoiStorageKeys(state: GameState): void {
  state.poiStorages ||= {};
  for (const [legacyId, canonicalId] of Object.entries(LEGACY_MAIN_AREA_REDIRECTS)) {
    const legacy = state.poiStorages[legacyId];
    if (!legacy) continue;
    const target = state.poiStorages[canonicalId];
    if (target) mergePoiStorage(target, legacy);
    else state.poiStorages[canonicalId] = legacy;
    delete state.poiStorages[legacyId];
  }
}

/**
 * Build-cell IDs are treated as opaque persistent identifiers. When both the
 * old feature-area grid and its macro-region grid exist, append the legacy grid
 * as a disconnected row band. This preserves every cluster/placement/crop cell
 * reference without pretending the two old coordinate systems overlap.
 */
function mergeBuildGrid(target: PoiBuildGrid, source: PoiBuildGrid): void {
  const existingIds = new Set(target.cells.map(cell => cell.id));
  const rowOffset = target.rows + 1;
  const sourceCells = source.cells
    .filter(cell => !existingIds.has(cell.id))
    .map(cell => ({ ...cell, row: cell.row + rowOffset }));

  if (!sourceCells.length) return;
  target.cells.push(...sourceCells);
  target.rows = Math.max(target.rows, rowOffset + source.rows);
  target.columns = Math.max(target.columns, source.columns);
}

function migrateBuildGridKeys(state: GameState): void {
  const simulation = state.buildingSimulation;
  if (!simulation?.gridsByPoiId) return;

  for (const [legacyId, canonicalId] of Object.entries(LEGACY_MAIN_AREA_REDIRECTS)) {
    const source = simulation.gridsByPoiId[legacyId];
    if (!source) continue;
    const target = simulation.gridsByPoiId[canonicalId];
    if (target) {
      mergeBuildGrid(target, source);
    } else {
      source.poiId = canonicalId;
      simulation.gridsByPoiId[canonicalId] = source;
    }
    delete simulation.gridsByPoiId[legacyId];
  }
}

function makeGroundLocationRedirects(): Record<string, string> {
  const redirects: Record<string, string> = {};
  for (const [legacyId, canonicalId] of Object.entries(LEGACY_MAIN_AREA_REDIRECTS)) {
    redirects[groundStorageId(legacyId)] = groundStorageId(canonicalId);
  }
  return redirects;
}

function migrateStorageLocations(
  state: GameState,
  locationRedirects: Record<string, string>,
): void {
  const storage = state.storageSystem;
  if (!storage?.locations) return;

  const result = [] as typeof storage.locations;
  const seenIds = new Set<string>();

  // Canonical locations win when both old and new ground caches exist.
  const ordered = [...storage.locations].sort((a, b) => {
    const aLegacy = locationRedirects[a.id] ? 1 : 0;
    const bLegacy = locationRedirects[b.id] ? 1 : 0;
    return aLegacy - bLegacy;
  });

  for (const location of ordered) {
    const canonicalPoi = canonicalAreaId(location.poiId) || location.poiId;
    const redirectedId = locationRedirects[location.id] || location.id;
    location.poiId = canonicalPoi;
    location.id = redirectedId;
    if (seenIds.has(location.id)) continue;
    seenIds.add(location.id);
    result.push(location);
  }

  storage.locations = result;
}

function recursivelyCanonicalizeReferences(
  value: unknown,
  locationRedirects: Record<string, string>,
  visited = new Set<object>(),
): void {
  if (!value || typeof value !== 'object') return;
  const object = value as Record<string, unknown>;
  if (visited.has(object)) return;
  visited.add(object);

  if (Array.isArray(value)) {
    for (const entry of value) recursivelyCanonicalizeReferences(entry, locationRedirects, visited);
    return;
  }

  for (const [key, nested] of Object.entries(object)) {
    if (typeof nested === 'string' && AREA_REFERENCE_KEYS.has(key)) {
      const canonical = resolveMainWorldAreaId(nested);
      if (canonical) object[key] = canonical;
      continue;
    }
    if (typeof nested === 'string' && STORAGE_LOCATION_REFERENCE_KEYS.has(key)) {
      if (locationRedirects[nested]) object[key] = locationRedirects[nested];
      continue;
    }
    recursivelyCanonicalizeReferences(nested, locationRedirects, visited);
  }
}

/**
 * V12 canonicalization entry point. It is intentionally idempotent so repair
 * tools/tests can call it more than once without duplicating stock or cells.
 */
export function migrateLegacyMainWorldAreas(state: GameState): void {
  const locationRedirects = makeGroundLocationRedirects();

  migrateAreaProgressKeys(state);
  migratePoiStorageKeys(state);
  migrateBuildGridKeys(state);
  migrateStorageLocations(state, locationRedirects);

  // Handles buildings, expeditions, jobs, reservations, storage routes,
  // agriculture habitats/history and future nested systems using the same keys.
  recursivelyCanonicalizeReferences(state, locationRedirects);
}
