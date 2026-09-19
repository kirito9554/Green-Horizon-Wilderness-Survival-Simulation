import type { HabitatPatch } from './habitatPatches';
import type { GeneratedLocalSite } from './localSiteGeneration';
import {
  getLocalSiteFunctionalProfile,
  type LocalSiteResourceKind,
  type LocalSiteResourceOpportunity,
  type LocalSiteResourceSeasonality,
} from './localSiteProfiles';
import { spatialUnitRandom } from './spatialRandom';
import type { PatchHydrologyState } from './terrainHydrology';

export const LOCAL_RESOURCE_SIMULATION_VERSION = 1;
export const RESOURCE_RESERVE_FLOOR_RATIO = 0.10;
export const RESOURCE_CRITICAL_ENTER_RATIO = 0.15;
export const RESOURCE_CRITICAL_EXIT_RATIO = 0.25;
export const RESOURCE_STRESSED_EXIT_RATIO = 0.35;
export const RESOURCE_ABUNDANT_RATIO = 0.70;
export const RESOURCE_ABSOLUTE_CAP_MULTIPLIER = 1.25;

export type LocalResourceRecoveryFamily =
  | 'renewable_biomass'
  | 'geological_flux'
  | 'flow'
  | 'episodic'
  | 'population_backed'
  | 'salvage_exposure';

export type LocalResourceDepletionState =
  | 'abundant'
  | 'normal'
  | 'stressed'
  | 'critical';

export interface LocalResourceRecoveryContext {
  /** 0..1 local rainfall / recent precipitation support. */
  rainfall: number;
  /** 0..1 erosion/weathering exposure. */
  erosion: number;
  /** 0..1 flooding / sediment transport support. */
  flooding: number;
  /** 0..1 one-tick storm pulse; use 0 when no new storm event occurred. */
  stormPulse: number;
  /** 0..1 one-tick tidal deposition pulse. */
  tidalPulse: number;
  /** 0..1 biological recolonization/recruitment from the surrounding ecosystem. */
  populationRecruitment: number;
  /** 0..1 temperature/phenology suitability for biological growth. */
  temperatureSuitability: number;
  /** 0..1 generic seasonal activity, e.g. fruiting or breeding window. */
  seasonalActivity: number;
  /** Multiplies the condition-derived carrying capacity. Usually 0.6..1.2. */
  capacityModifier: number;
}

export interface LocalResourceDynamicState {
  id: string;
  siteId: string;
  kind: LocalSiteResourceKind;
  recoveryFamily: LocalResourceRecoveryFamily;
  baseCapacity: number;
  effectiveCapacity: number;
  stock: number;
  condition: number;
  depletionPressure: number;
  criticalLatched: boolean;
  extractionImpact: number;
  seasonality: LocalSiteResourceSeasonality;
  itemIds: readonly string[];
  lastUpdatedHours: number;
}

export interface LocalResourceSimulationState {
  version: number;
  worldSeed: string;
  resourcesById: Record<string, LocalResourceDynamicState>;
  resourceIdsBySiteId: Record<string, string[]>;
}

export interface LocalResourceMetrics {
  stockRatio: number;
  effectiveStockRatio: number;
  reserveFloor: number;
  depletionState: LocalResourceDepletionState;
  yieldEfficiency: number;
  quality: number;
  laborCostMultiplier: number;
  recoveryMultiplier: number;
  harvestableStock: number;
}

export interface LocalResourceHarvestResult {
  requestedEffortUnits: number;
  resourceDraw: number;
  yieldedUnits: number;
  quality: number;
  reserveFloorReached: boolean;
  depletionState: LocalResourceDepletionState;
  conditionDamage: number;
  depletionPressureAdded: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);

function isGeological(kind: string): boolean {
  return ['clay', 'stone', 'sand', 'shells', 'mineral'].includes(kind);
}

function isBiologicalPopulation(kind: string): boolean {
  return ['fish', 'shellfish', 'insects', 'wild_eggs', 'feathers', 'honey', 'manure'].includes(kind);
}

function isPlantBiomass(kind: string): boolean {
  return [
    'fruit', 'edible_plants', 'tubers', 'medicinal_plants', 'mushrooms',
    'timber', 'hardwood', 'bamboo', 'fiber', 'resin',
  ].includes(kind);
}

export function classifyLocalResourceRecoveryFamily(
  resource: Pick<LocalSiteResourceOpportunity, 'kind' | 'renewability'>,
): LocalResourceRecoveryFamily {
  const kind = resource.kind as string;
  if (kind === 'fresh_water') return 'flow';
  if (kind === 'salvage') return 'salvage_exposure';
  if (kind === 'driftwood') return 'episodic';
  if (isBiologicalPopulation(kind)) return 'population_backed';
  if (isGeological(kind)) return 'geological_flux';
  if (resource.renewability === 'episodic' || resource.renewability === 'tidal') return 'episodic';
  if (isPlantBiomass(kind)) return 'renewable_biomass';
  return 'episodic';
}

function makeResourceId(siteId: string, kind: string, index: number): string {
  return `local-resource:${siteId}:${kind}:${index}`;
}

function initialEffectiveCapacity(baseCapacity: number, condition: number): number {
  return baseCapacity * (0.55 + condition * 0.45);
}

export function initializeLocalSiteResourceSimulation(
  worldSeed: string,
  sites: readonly GeneratedLocalSite[],
): LocalResourceSimulationState {
  const resourcesById: Record<string, LocalResourceDynamicState> = {};
  const resourceIdsBySiteId: Record<string, string[]> = {};

  for (const site of sites) {
    const profile = getLocalSiteFunctionalProfile(site.type);
    if (profile.resources.length === 0) continue;

    const siteResourceIds: string[] = [];
    profile.resources.forEach((resource, index) => {
      const id = makeResourceId(site.id, resource.kind, index);
      const conditionRoll = spatialUnitRandom(worldSeed, `${id}|condition`);
      const stockRoll = spatialUnitRandom(worldSeed, `${id}|stock`);
      const condition = 0.82 + conditionRoll * 0.16;
      const baseCapacity = Math.max(8, 100 * resource.abundance);
      const effectiveCapacity = initialEffectiveCapacity(baseCapacity, condition);
      const reserveFloor = baseCapacity * RESOURCE_RESERVE_FLOOR_RATIO;
      const stock = clamp(
        effectiveCapacity * (0.68 + stockRoll * 0.28),
        reserveFloor,
        baseCapacity * RESOURCE_ABSOLUTE_CAP_MULTIPLIER,
      );

      resourcesById[id] = {
        id,
        siteId: site.id,
        kind: resource.kind,
        recoveryFamily: classifyLocalResourceRecoveryFamily(resource),
        baseCapacity,
        effectiveCapacity,
        stock,
        condition,
        depletionPressure: 0,
        criticalLatched: false,
        extractionImpact: resource.extractionImpact,
        seasonality: resource.seasonality,
        itemIds: Object.freeze([...(resource.itemIds ?? [])]),
        lastUpdatedHours: 0,
      };
      siteResourceIds.push(id);
    });

    resourceIdsBySiteId[site.id] = siteResourceIds;
  }

  return {
    version: LOCAL_RESOURCE_SIMULATION_VERSION,
    worldSeed,
    resourcesById,
    resourceIdsBySiteId,
  };
}

function depletionStateFor(resource: LocalResourceDynamicState, stockRatio: number): LocalResourceDepletionState {
  if (resource.criticalLatched || stockRatio <= RESOURCE_CRITICAL_ENTER_RATIO) return 'critical';
  if (stockRatio < RESOURCE_STRESSED_EXIT_RATIO) return 'stressed';
  if (stockRatio >= RESOURCE_ABUNDANT_RATIO) return 'abundant';
  return 'normal';
}

export function getLocalResourceMetrics(resource: LocalResourceDynamicState): LocalResourceMetrics {
  const reserveFloor = resource.baseCapacity * RESOURCE_RESERVE_FLOOR_RATIO;
  const stockRatio = clamp(resource.stock / Math.max(0.001, resource.baseCapacity), 0, RESOURCE_ABSOLUTE_CAP_MULTIPLIER);
  const effectiveStockRatio = clamp(resource.stock / Math.max(0.001, resource.effectiveCapacity), 0, RESOURCE_ABSOLUTE_CAP_MULTIPLIER);
  const depletionState = depletionStateFor(resource, stockRatio);

  let yieldEfficiency: number;
  let quality: number;
  let laborCostMultiplier: number;
  let recoveryMultiplier: number;

  if (depletionState === 'critical') {
    const t = (stockRatio - RESOURCE_RESERVE_FLOOR_RATIO) / Math.max(0.001, RESOURCE_CRITICAL_ENTER_RATIO - RESOURCE_RESERVE_FLOOR_RATIO);
    yieldEfficiency = lerp(0.03, 0.20, t);
    quality = lerp(0.20, 0.45, t);
    laborCostMultiplier = lerp(4.2, 2.6, t);
    recoveryMultiplier = lerp(0.10, 0.28, t);
  } else if (depletionState === 'stressed') {
    const t = (stockRatio - RESOURCE_CRITICAL_ENTER_RATIO) / Math.max(0.001, RESOURCE_STRESSED_EXIT_RATIO - RESOURCE_CRITICAL_ENTER_RATIO);
    yieldEfficiency = lerp(0.20, 0.72, t);
    quality = lerp(0.45, 0.76, t);
    laborCostMultiplier = lerp(2.6, 1.35, t);
    recoveryMultiplier = lerp(0.28, 0.72, t);
  } else if (depletionState === 'normal') {
    const t = (stockRatio - RESOURCE_STRESSED_EXIT_RATIO) / Math.max(0.001, RESOURCE_ABUNDANT_RATIO - RESOURCE_STRESSED_EXIT_RATIO);
    yieldEfficiency = lerp(0.72, 1.0, t);
    quality = lerp(0.76, 0.96, t);
    laborCostMultiplier = lerp(1.35, 1.0, t);
    recoveryMultiplier = lerp(0.72, 1.0, t);
  } else {
    const t = (stockRatio - RESOURCE_ABUNDANT_RATIO) / Math.max(0.001, 1 - RESOURCE_ABUNDANT_RATIO);
    yieldEfficiency = lerp(1.0, 1.08, t);
    quality = lerp(0.96, 1.0, t);
    laborCostMultiplier = lerp(1.0, 0.92, t);
    recoveryMultiplier = lerp(1.0, 0.86, t);
  }

  const conditionFactor = 0.45 + resource.condition * 0.55;
  const pressureFactor = 1 - resource.depletionPressure * 0.55;
  yieldEfficiency = clamp(yieldEfficiency * conditionFactor * pressureFactor, 0.01, 1.1);
  quality = clamp01(quality * (0.6 + resource.condition * 0.4) * (1 - resource.depletionPressure * 0.35));
  laborCostMultiplier = clamp(laborCostMultiplier * (1 + resource.depletionPressure * 0.9), 0.8, 5.5);

  return {
    stockRatio,
    effectiveStockRatio,
    reserveFloor,
    depletionState,
    yieldEfficiency,
    quality,
    laborCostMultiplier,
    recoveryMultiplier,
    harvestableStock: Math.max(0, resource.stock - reserveFloor),
  };
}

function updateCriticalLatch(resource: LocalResourceDynamicState): void {
  const stockRatio = resource.stock / Math.max(0.001, resource.baseCapacity);
  if (resource.criticalLatched) {
    if (stockRatio >= RESOURCE_CRITICAL_EXIT_RATIO) resource.criticalLatched = false;
  } else if (stockRatio <= RESOURCE_CRITICAL_ENTER_RATIO) {
    resource.criticalLatched = true;
  }
}

export function harvestLocalSiteResource(
  resource: LocalResourceDynamicState,
  requestedEffortUnits: number,
): { state: LocalResourceDynamicState; result: LocalResourceHarvestResult } {
  const next = { ...resource, itemIds: resource.itemIds };
  const before = getLocalResourceMetrics(next);
  const effort = Math.max(0, requestedEffortUnits);
  const resourceDraw = Math.min(before.harvestableStock, effort);
  const yieldedUnits = resourceDraw * before.yieldEfficiency;
  const unproductiveEffort = Math.max(0, effort - resourceDraw);

  next.stock = Math.max(before.reserveFloor, next.stock - resourceDraw);

  const drawRatio = resourceDraw / Math.max(1, next.baseCapacity);
  const futileRatio = unproductiveEffort / Math.max(1, next.baseCapacity);
  const conditionDamage = clamp01(next.extractionImpact * (drawRatio * 0.18 + futileRatio * 0.42));
  const depletionPressureAdded = clamp01(next.extractionImpact * (drawRatio * 0.34 + futileRatio * 1.15));
  next.condition = clamp01(next.condition - conditionDamage);
  next.depletionPressure = clamp01(next.depletionPressure + depletionPressureAdded);
  updateCriticalLatch(next);

  const after = getLocalResourceMetrics(next);
  return {
    state: next,
    result: {
      requestedEffortUnits: effort,
      resourceDraw,
      yieldedUnits,
      quality: before.quality,
      reserveFloorReached: next.stock <= before.reserveFloor + 1e-9,
      depletionState: after.depletionState,
      conditionDamage,
      depletionPressureAdded,
    },
  };
}

function seasonalityMultiplier(seasonality: LocalSiteResourceSeasonality, context: LocalResourceRecoveryContext): number {
  switch (seasonality) {
    case 'wet_peak': return 0.55 + context.rainfall * 0.9;
    case 'dry_peak': return 1.35 - context.rainfall * 0.65;
    case 'fruiting': return 0.20 + context.seasonalActivity * 1.25;
    case 'tidal_cycle': return 0.45 + context.tidalPulse * 1.1;
    case 'storm_event': return 0.12 + context.stormPulse * 1.6;
    case 'irregular': return 0.55 + context.seasonalActivity * 0.45;
    default: return 1;
  }
}

function familyRecoveryUnitsPerDay(
  resource: LocalResourceDynamicState,
  context: LocalResourceRecoveryContext,
): number {
  const cap = resource.baseCapacity;
  const stockRatioToEffective = clamp(resource.stock / Math.max(0.001, resource.effectiveCapacity), 0, 1.5);

  switch (resource.recoveryFamily) {
    case 'renewable_biomass': {
      // Logistic-like regrowth. Very low stock regrows slowly because there are few
      // mature plants/propagules; middle stock is fastest; near carrying capacity slows again.
      const logistic = clamp01(stockRatioToEffective) * clamp01(1 - stockRatioToEffective) * 4;
      const environment = 0.45 + context.rainfall * 0.45 + context.temperatureSuitability * 0.35;
      return cap * 0.035 * logistic * environment;
    }
    case 'geological_flux': {
      // Accessible stone/clay/mineral supply is renewed slowly by erosion, weathering,
      // bank collapse and sediment transport rather than biological growth.
      const environment = 0.75 + context.erosion * 0.85 + context.flooding * 0.55 + context.rainfall * 0.25;
      return cap * 0.0012 * environment;
    }
    case 'flow': {
      const environment = 0.18 + context.rainfall * 1.15 + context.flooding * 0.45;
      return cap * 0.14 * environment;
    }
    case 'episodic': {
      const background = cap * 0.0007 * (0.6 + context.erosion * 0.4);
      const pulse = cap * (context.stormPulse * 0.06 + context.flooding * 0.025 + context.tidalPulse * 0.025);
      return background + pulse;
    }
    case 'population_backed': {
      // Until fauna/aquatic systems own these stocks directly, retain a tiny background
      // recolonization source so gameplay resources never hard-extinguish.
      const recruitment = 0.15 + context.populationRecruitment * 0.85;
      return cap * 0.0035 * recruitment;
    }
    case 'salvage_exposure': {
      // Salvage does not magically regrow; storms, collapse and erosion expose previously
      // inaccessible material, producing a deliberately tiny repeatable source.
      const background = cap * 0.00025 * (0.4 + context.erosion * 0.6);
      const exposurePulse = cap * (context.stormPulse * 0.012 + context.flooding * 0.006);
      return background + exposurePulse;
    }
  }
}

export function tickLocalSiteResource(
  resource: LocalResourceDynamicState,
  deltaHours: number,
  context: LocalResourceRecoveryContext,
): LocalResourceDynamicState {
  if (deltaHours <= 0) return resource;
  const next = { ...resource, itemIds: resource.itemIds };
  const days = deltaHours / 24;

  const capacityModifier = clamp(context.capacityModifier, 0.55, RESOURCE_ABSOLUTE_CAP_MULTIPLIER);
  next.effectiveCapacity = clamp(
    next.baseCapacity * (0.55 + next.condition * 0.45) * capacityModifier,
    next.baseCapacity * 0.25,
    next.baseCapacity * RESOURCE_ABSOLUTE_CAP_MULTIPLIER,
  );

  const metrics = getLocalResourceMetrics(next);
  const seasonal = seasonalityMultiplier(next.seasonality, context);
  const conditionMultiplier = 0.28 + next.condition * 0.72;
  const pressureMultiplier = 1 - next.depletionPressure * 0.78;
  const rawRecoveryPerDay = familyRecoveryUnitsPerDay(next, context);
  const recovery = Math.max(
    0,
    rawRecoveryPerDay
      * days
      * seasonal
      * metrics.recoveryMultiplier
      * conditionMultiplier
      * pressureMultiplier,
  );

  if (next.stock < next.effectiveCapacity) {
    next.stock = Math.min(next.effectiveCapacity, next.stock + recovery);
  }

  // Depletion pressure and site condition recover slowly. Critical sites recover
  // much more slowly, forcing a meaningful fallow period before normal use resumes.
  const postRecoveryRatio = next.stock / Math.max(0.001, next.baseCapacity);
  const pressureDecay = days * (postRecoveryRatio <= RESOURCE_CRITICAL_ENTER_RATIO ? 0.004 : 0.018) * (0.55 + postRecoveryRatio);
  next.depletionPressure = clamp01(next.depletionPressure - pressureDecay);

  const conditionRecoveryBase = postRecoveryRatio <= RESOURCE_CRITICAL_ENTER_RATIO ? 0.0006 : 0.0035;
  const conditionRecovery = days * conditionRecoveryBase * (1 - next.depletionPressure) * (0.5 + context.temperatureSuitability * 0.5);
  next.condition = clamp01(next.condition + conditionRecovery);

  updateCriticalLatch(next);
  next.lastUpdatedHours += deltaHours;
  return next;
}

export function tickLocalSiteResourceSimulation(
  state: LocalResourceSimulationState,
  deltaHours: number,
  contextsBySiteId: Readonly<Record<string, LocalResourceRecoveryContext>>,
  fallbackContext: LocalResourceRecoveryContext = DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT,
): LocalResourceSimulationState {
  const resourcesById: Record<string, LocalResourceDynamicState> = {};
  for (const [id, resource] of Object.entries(state.resourcesById)) {
    resourcesById[id] = tickLocalSiteResource(
      resource,
      deltaHours,
      contextsBySiteId[resource.siteId] ?? fallbackContext,
    );
  }
  return {
    ...state,
    resourcesById,
  };
}

export const DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT: LocalResourceRecoveryContext = Object.freeze({
  rainfall: 0.55,
  erosion: 0.35,
  flooding: 0.20,
  stormPulse: 0,
  tidalPulse: 0,
  populationRecruitment: 0.50,
  temperatureSuitability: 0.85,
  seasonalActivity: 0.65,
  capacityModifier: 1,
});

export function deriveLocalResourceRecoveryContext(
  site: GeneratedLocalSite,
  patch: HabitatPatch,
  hydrology: PatchHydrologyState,
  overrides: Partial<LocalResourceRecoveryContext> = {},
): LocalResourceRecoveryContext {
  const base: LocalResourceRecoveryContext = {
    rainfall: clamp01(patch.terrain.wetness * 0.72 + hydrology.waterIndex * 0.28),
    erosion: clamp01(patch.terrain.slope * 0.58 + patch.terrain.roughness * 0.42),
    flooding: clamp01(hydrology.waterIndex * 0.72 + (hydrology.watercourse !== 'none' ? 0.18 : 0)),
    stormPulse: 0,
    tidalPulse: patch.terrainTags.includes('tidal') ? 0.35 : 0,
    populationRecruitment: clamp01(patch.suitability.forage * 0.45 + patch.suitability.cover * 0.35 + 0.2),
    temperatureSuitability: 0.88,
    seasonalActivity: 0.65,
    capacityModifier: clamp(0.7 + patch.suitability.forage * 0.18 + patch.suitability.moisture * 0.12, 0.65, 1.12),
  };

  // Keep site in the signature so future feature-specific context derivation can
  // evolve without changing this API surface.
  void site.id;
  return { ...base, ...overrides };
}
