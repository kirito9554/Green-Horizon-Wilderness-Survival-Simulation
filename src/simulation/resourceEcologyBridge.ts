import type { GameState, ResourcePoolState } from '../types';
import type { WildPlantPopulation, WorldEcologyState } from '../types/ecologySimulation';
import { resolveMainWorldAreaId } from '../data/mainWorldAreas';
import { ensureWorldEcology } from './ecologySystem';
import { getTerrestrialLocalAccessFraction } from './terrestrialEcologyScaleSystem';

export type BiologicalHarvestKind = 'fruit' | 'biomass' | 'medicinal_foliage';

interface BiologicalResourceBinding {
  nodeId: string;
  areaId: string;
  speciesId: string;
  kind: BiologicalHarvestKind;
  /** Approximate living-stock kilograms represented by one inventory unit. */
  kgPerUnit: number;
  /** How much of the source biomass can safely be exposed as gatherable stock. */
  accessibility: number;
}

interface ResourceEcologyBridgeMeta {
  version: number;
  lastObservedStockByNodeId: Record<string, number>;
}

type BridgeWorldEcologyState = WorldEcologyState & {
  resourceEcologyBridge?: ResourceEcologyBridgeMeta;
};

const BRIDGE_VERSION = 1;

const BIOLOGICAL_BINDINGS: Record<string, BiologicalResourceBinding> = {
  NODE_CAMP_COCONUTS: {
    nodeId: 'NODE_CAMP_COCONUTS', areaId: 'AREA_CAMP_CLEARING', speciesId: 'FLORA_COCONUT_PALM',
    kind: 'fruit', kgPerUnit: 1.25, accessibility: 0.82,
  },
  NODE_BAMBOO_STALKS: {
    nodeId: 'NODE_BAMBOO_STALKS', areaId: 'AREA_BAMBOO_GROVE', speciesId: 'FLORA_BAMBOO',
    kind: 'biomass', kgPerUnit: 3.4, accessibility: 0.16,
  },
  NODE_FORAGE_BERRIES: {
    nodeId: 'NODE_FORAGE_BERRIES', areaId: 'AREA_FORAGING_GROUNDS', speciesId: 'FLORA_BERRY_SHRUB',
    kind: 'fruit', kgPerUnit: 0.12, accessibility: 0.88,
  },
  NODE_GLADE_HERBS: {
    nodeId: 'NODE_GLADE_HERBS', areaId: 'AREA_MEDICINAL_GLADE', speciesId: 'FLORA_MEDICINAL_ORCHID',
    kind: 'medicinal_foliage', kgPerUnit: 0.08, accessibility: 0.18,
  },
  NODE_TRAIL_HERBS: {
    nodeId: 'NODE_TRAIL_HERBS', areaId: 'AREA_JUNGLE_TRAIL', speciesId: 'FLORA_MEDICINAL_FERN',
    kind: 'medicinal_foliage', kgPerUnit: 0.1, accessibility: 0.14,
  },
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function ensureMeta(state: GameState): ResourceEcologyBridgeMeta {
  const system = ensureWorldEcology(state) as BridgeWorldEcologyState;
  system.resourceEcologyBridge ||= { version: BRIDGE_VERSION, lastObservedStockByNodeId: {} };
  system.resourceEcologyBridge.version = BRIDGE_VERSION;
  system.resourceEcologyBridge.lastObservedStockByNodeId ||= {};
  return system.resourceEcologyBridge;
}

function materializedPlantPopulations(
  state: GameState,
  binding: BiologicalResourceBinding,
): WildPlantPopulation[] | undefined {
  const poiId = resolveMainWorldAreaId(binding.areaId);
  if (!poiId) return undefined;
  const system = state.ecologySystem;
  const region = system?.regionsByPoiId?.[poiId];
  if (!system || !region) return undefined;

  const materializedSubareas = new Set(
    region.subareaIds.filter(id => system.subareasById[id]?.materializationState === 'materialized'),
  );
  if (!materializedSubareas.size) return undefined;

  const populations = system.plantPopulations.filter(population =>
    population.poiId === poiId
      && population.speciesId === binding.speciesId
      && materializedSubareas.has(population.subareaId),
  );
  return populations.length ? populations : undefined;
}

function accessibleKg(state: GameState, population: WildPlantPopulation, binding: BiologicalResourceBinding): number {
  const subarea = state.ecologySystem?.subareasById?.[population.subareaId];
  const localFraction = subarea ? getTerrestrialLocalAccessFraction(subarea) : 1;
  const sourceKg = binding.kind === 'fruit' ? population.fruitBiomassKg : population.biomassKg;
  return Math.max(0, sourceKg * localFraction * binding.accessibility);
}

function accessibleUnits(state: GameState, binding: BiologicalResourceBinding): number | undefined {
  const populations = materializedPlantPopulations(state, binding);
  if (!populations) return undefined;
  const kilograms = populations.reduce((sum, population) => sum + accessibleKg(state, population, binding), 0);
  return Math.max(0, kilograms / Math.max(0.001, binding.kgPerUnit));
}

function consumeLivingStock(state: GameState, binding: BiologicalResourceBinding, units: number): number {
  const requestedKg = Math.max(0, units) * binding.kgPerUnit;
  if (requestedKg <= 0) return 0;
  const populations = materializedPlantPopulations(state, binding);
  if (!populations?.length) return 0;

  const weighted = populations
    .map(population => ({ population, availableKg: accessibleKg(state, population, binding) }))
    .filter(entry => entry.availableKg > 0);
  const totalAccessibleKg = weighted.reduce((sum, entry) => sum + entry.availableKg, 0);
  const consumedKg = Math.min(requestedKg, totalAccessibleKg);
  if (consumedKg <= 0) return 0;

  for (const entry of weighted) {
    const share = entry.availableKg / totalAccessibleKg;
    const kg = consumedKg * share;
    if (binding.kind === 'fruit') {
      entry.population.fruitBiomassKg = round3(Math.max(0, entry.population.fruitBiomassKg - kg));
      entry.population.seedBank = clamp(entry.population.seedBank - kg / Math.max(0.1, entry.population.biomassKg) * 14);
    } else {
      entry.population.biomassKg = round3(Math.max(0, entry.population.biomassKg - kg));
      entry.population.regeneration = clamp(entry.population.regeneration - kg / Math.max(0.1, entry.population.biomassKg + kg) * 18);
      entry.population.health = clamp(entry.population.health - kg / Math.max(0.1, entry.population.biomassKg + kg) * 7);
      if (binding.kind === 'medicinal_foliage') {
        entry.population.seedBank = clamp(entry.population.seedBank - kg / Math.max(0.1, entry.population.biomassKg + kg) * 8);
      }
    }

    const subarea = state.ecologySystem?.subareasById?.[entry.population.subareaId];
    if (subarea) {
      const pressure = kg / Math.max(1, subarea.areaM2 / 100) * (binding.kind === 'fruit' ? 0.08 : 0.34);
      subarea.disturbance.foragingPressure = clamp(subarea.disturbance.foragingPressure + pressure);
      subarea.disturbance.humanPressure = clamp(subarea.disturbance.humanPressure + pressure * 0.18);
      if (binding.kind === 'biomass') {
        subarea.ecology.biomass = clamp(subarea.ecology.biomass - pressure * 0.12);
      }
    }
  }

  return consumedKg / binding.kgPerUnit;
}

function syncPoolToLivingStock(state: GameState, pool: ResourcePoolState, binding: BiologicalResourceBinding): boolean {
  const livingUnits = accessibleUnits(state, binding);
  if (livingUnits === undefined) return false;
  // Preserve UI continuity: maxStock remains a node-scale display cap while
  // currentStock can never advertise more than the living local stock can supply.
  pool.currentStock = Math.max(0, Math.min(pool.maxStock, livingUnits));
  return true;
}

export function isBiologicalResourceNode(nodeId: string): boolean {
  return Boolean(BIOLOGICAL_BINDINGS[nodeId]);
}

export function isEcologyBackedBiologicalResourceNode(state: GameState, nodeId: string): boolean {
  const binding = BIOLOGICAL_BINDINGS[nodeId];
  return Boolean(binding && materializedPlantPopulations(state, binding));
}

/**
 * Called before legacy passive recovery. A stock decrease since the previous
 * frame represents successful player gathering and is withdrawn from the real
 * flora stock. Afterwards the displayed node stock is derived back from ecology.
 * Unobserved/unmaterialized regions are deliberately left on the legacy model so
 * this bridge never causes exploration or ecosystem generation by itself.
 */
export function reconcileBiologicalResourcePools(state: GameState): void {
  if (!state.resourcePools) return;
  const meta = ensureMeta(state);
  for (const binding of Object.values(BIOLOGICAL_BINDINGS)) {
    const pool = state.resourcePools[binding.nodeId];
    if (!pool) continue;
    const livingUnits = accessibleUnits(state, binding);
    if (livingUnits === undefined) {
      delete meta.lastObservedStockByNodeId[binding.nodeId];
      continue;
    }

    const previous = meta.lastObservedStockByNodeId[binding.nodeId];
    if (previous !== undefined && pool.currentStock < previous) {
      consumeLivingStock(state, binding, previous - pool.currentStock);
    }
    syncPoolToLivingStock(state, pool, binding);
    meta.lastObservedStockByNodeId[binding.nodeId] = pool.currentStock;
  }
}

export function getBiologicalResourceBindings(): Readonly<Record<string, BiologicalResourceBinding>> {
  return BIOLOGICAL_BINDINGS;
}
