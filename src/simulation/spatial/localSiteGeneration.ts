import type { MainWorldAreaId } from '../../data/mainWorldAreas';
import { pointInPolygon, type WorldPointMeters } from '../../data/worldGeometry';
import type { HabitatPatch, TerrainTag } from './habitatPatches';
import type { GeneratedTerrainHydrology, PatchHydrologyState } from './terrainHydrology';
import {
  NATURAL_SITE_ARCHETYPES,
  type LocalSiteArchetype,
  type LocalSiteCategory,
  type LocalSiteRarity,
  type LocalSiteType,
} from './localSiteCatalog';
import {
  samplePointInPolygon,
  spatialUnitRandom,
  stableSpatialId,
} from './spatialRandom';

export type {
  LocalSiteCategory,
  LocalSiteRarity,
  LocalSiteType,
  NaturalLocalSiteType,
  RequiredLocalSiteType,
} from './localSiteCatalog';

export interface GeneratedLocalSite {
  id: string;
  seed: number;
  type: LocalSiteType;
  category: LocalSiteCategory;
  rarity: LocalSiteRarity;
  parentRegionId: MainWorldAreaId;
  patchId: string;
  position: WorldPointMeters;
  radiusMeters: number;
  discoveryDifficulty: number;
  /** Generic hooks for future resource, encounter and shelter systems. */
  resourcePotential: number;
  shelterPotential: number;
  wildlifePotential: number;
  waterPotential: number;
  legacyConceptId?: string;
  tags: readonly string[];
}

export interface LocalSitePoolEntry {
  type: LocalSiteArchetype['type'];
  label: string;
  category: LocalSiteArchetype['category'];
  rarity: LocalSiteRarity;
  worldSupport: number;
  minWorldSupport: number;
  seedAffinity: number;
  enabled: boolean;
  core: boolean;
}

export interface GeneratedLocalSitePool {
  worldSeed: string;
  /** Stable signature useful for save diagnostics and regression tests. */
  signature: string;
  enabledTypes: readonly LocalSiteArchetype['type'][];
  disabledTypes: readonly LocalSiteArchetype['type'][];
  entries: readonly LocalSitePoolEntry[];
  enabledByCategory: Readonly<Record<Exclude<LocalSiteCategory, 'landmark'>, number>>;
}

interface SitePlacementArchetype {
  type: LocalSiteType;
  category: LocalSiteCategory;
  rarity: LocalSiteRarity;
  radiusRange: readonly [number, number];
  discoveryBase: number;
  legacyConceptId?: string;
  tags: readonly string[];
}

const hasTerrain = (patch: HabitatPatch, tag: TerrainTag): boolean => patch.terrainTags.includes(tag);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const CATEGORY_POOL_QUOTAS: Readonly<Record<Exclude<LocalSiteCategory, 'landmark'>, readonly [number, number]>> = {
  water: [7, 10],
  terrain: [6, 9],
  vegetation: [8, 12],
  wildlife: [8, 12],
  coastal: [4, 7],
  disturbance: [2, 4],
};

const RARITY_POOL_MULTIPLIER: Readonly<Record<LocalSiteRarity, number>> = {
  common: 1,
  uncommon: .91,
  rare: .74,
  exceptional: .52,
};

function worldSupportForArchetype(
  archetype: LocalSiteArchetype,
  patches: readonly HabitatPatch[],
  hydrology: GeneratedTerrainHydrology,
): number {
  const scores: number[] = [];
  for (const patch of patches) {
    const hydro = hydrology.byPatchId[patch.id];
    if (!hydro) continue;
    scores.push(clamp01(archetype.score(patch, hydro)));
  }
  scores.sort((a, b) => b - a);
  if (scores.length === 0) return 0;

  // Mean of the best few patches answers "does this world contain a meaningful
  // niche for this feature?" without allowing one anomalous cell to activate it.
  const topCount = Math.min(12, Math.max(4, Math.ceil(scores.length * .025)));
  const top = scores.slice(0, topCount);
  return top.reduce((sum, value) => sum + value, 0) / top.length;
}

/**
 * Select the local-site vocabulary for one campaign. Macro geography is stable,
 * but terrain support + the world seed choose only a subset of the full catalog.
 * This makes different runs ecologically distinct instead of forcing every site
 * archetype to appear on every island.
 */
export function generateLocalSitePool(
  worldSeed: string,
  patches: readonly HabitatPatch[],
  hydrology: GeneratedTerrainHydrology,
): GeneratedLocalSitePool {
  const candidates = NATURAL_SITE_ARCHETYPES.map(archetype => {
    const worldSupport = worldSupportForArchetype(archetype, patches, hydrology);
    const seedAffinity = .66 + spatialUnitRandom(worldSeed, `site-pool-affinity|${archetype.type}`) * .68;
    return {
      archetype,
      worldSupport,
      seedAffinity,
      supported: worldSupport >= archetype.pool.minWorldSupport,
    };
  });

  const enabled = new Set<LocalSiteArchetype['type']>();
  for (const category of Object.keys(CATEGORY_POOL_QUOTAS) as Array<Exclude<LocalSiteCategory, 'landmark'>>) {
    const supported = candidates.filter(candidate => candidate.archetype.category === category && candidate.supported);
    if (supported.length === 0) continue;

    const [minimum, maximum] = CATEGORY_POOL_QUOTAS[category];
    const span = Math.max(0, maximum - minimum);
    const target = Math.min(
      supported.length,
      minimum + Math.floor(spatialUnitRandom(worldSeed, `site-pool-quota|${category}`) * (span + 1)),
    );

    const core = supported.filter(candidate => candidate.archetype.pool.core);
    for (const candidate of core) enabled.add(candidate.archetype.type);

    const remaining = supported
      .filter(candidate => !candidate.archetype.pool.core)
      .sort((a, b) => {
        const scoreA = a.worldSupport * a.seedAffinity * RARITY_POOL_MULTIPLIER[a.archetype.rarity];
        const scoreB = b.worldSupport * b.seedAffinity * RARITY_POOL_MULTIPLIER[b.archetype.rarity];
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.archetype.type.localeCompare(b.archetype.type);
      });

    const desiredNonCore = Math.max(0, target - core.length);
    for (const candidate of remaining.slice(0, desiredNonCore)) enabled.add(candidate.archetype.type);
  }

  const entries: LocalSitePoolEntry[] = candidates.map(candidate => Object.freeze({
    type: candidate.archetype.type,
    label: candidate.archetype.label,
    category: candidate.archetype.category,
    rarity: candidate.archetype.rarity,
    worldSupport: candidate.worldSupport,
    minWorldSupport: candidate.archetype.pool.minWorldSupport,
    seedAffinity: candidate.seedAffinity,
    enabled: enabled.has(candidate.archetype.type),
    core: Boolean(candidate.archetype.pool.core),
  }));

  const enabledTypes = [...enabled].sort();
  const disabledTypes = entries.filter(entry => !entry.enabled).map(entry => entry.type).sort();
  const enabledByCategory: Record<Exclude<LocalSiteCategory, 'landmark'>, number> = {
    water: 0,
    terrain: 0,
    vegetation: 0,
    wildlife: 0,
    coastal: 0,
    disturbance: 0,
  };
  for (const entry of entries) if (entry.enabled) enabledByCategory[entry.category] += 1;

  return Object.freeze({
    worldSeed,
    signature: enabledTypes.join('|'),
    enabledTypes: Object.freeze(enabledTypes),
    disabledTypes: Object.freeze(disabledTypes),
    entries: Object.freeze(entries),
    enabledByCategory: Object.freeze(enabledByCategory),
  });
}

function localSiteCountForPatch(worldSeed: string, patch: HabitatPatch): number {
  const expected = patch.areaKm2 * (
    .9
    + patch.suitability.forage * .38
    + patch.suitability.cover * .24
    + patch.suitability.aquatic * .12
  );
  const floor = Math.floor(expected);
  const fraction = expected - floor;
  const extra = spatialUnitRandom(worldSeed, `site-count|${patch.id}`) < fraction ? 1 : 0;
  return Math.min(3, floor + extra);
}

function chooseArchetype(
  worldSeed: string,
  patch: HabitatPatch,
  hydrology: PatchHydrologyState,
  siteIndex: number,
  enabledTypes: ReadonlySet<LocalSiteArchetype['type']>,
): LocalSiteArchetype | undefined {
  const weighted = NATURAL_SITE_ARCHETYPES
    .filter(archetype => enabledTypes.has(archetype.type))
    .map(archetype => {
      const suitability = clamp01(archetype.score(patch, hydrology));
      const worldVariation = .72 + spatialUnitRandom(worldSeed, `site-weight|${patch.id}|${siteIndex}|${archetype.type}`) * .56;
      const localThreshold = archetype.rarity === 'exceptional' ? .34 : archetype.rarity === 'rare' ? .22 : .1;
      const weight = suitability < localThreshold
        ? 0
        : archetype.baseWeight * worldVariation * Math.pow(Math.max(.04, suitability), 1.7);
      return { archetype, weight };
    })
    .filter(item => item.weight > 0);

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0 || weighted.length === 0) return undefined;

  let cursor = spatialUnitRandom(worldSeed, `site-pick|${patch.id}|${siteIndex}`) * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.archetype;
  }
  return weighted[weighted.length - 1].archetype;
}

function sitePoint(
  worldSeed: string,
  patch: HabitatPatch,
  key: string,
  existing: readonly GeneratedLocalSite[],
): WorldPointMeters {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const point = samplePointInPolygon(patch.polygon, worldSeed, `${key}|point|${attempt}`);
    const tooClose = existing.some(site => site.patchId === patch.id && Math.hypot(site.position.x - point.x, site.position.y - point.y) < 55);
    if (!tooClose) return point;
  }
  return samplePointInPolygon(patch.polygon, worldSeed, `${key}|fallback`);
}

function makeSite(
  worldSeed: string,
  patch: HabitatPatch,
  archetype: SitePlacementArchetype,
  key: string,
  existing: readonly GeneratedLocalSite[],
): GeneratedLocalSite {
  const roll = spatialUnitRandom(worldSeed, `${key}|properties`);
  const [minRadius, maxRadius] = archetype.radiusRange;
  const hydroBias = patch.suitability.aquatic;
  return Object.freeze({
    id: stableSpatialId(`SITE_${archetype.type.toUpperCase()}`, worldSeed, key),
    seed: Math.floor(spatialUnitRandom(worldSeed, `${key}|seed`) * 0x1_0000_0000) >>> 0,
    type: archetype.type,
    category: archetype.category,
    rarity: archetype.rarity,
    parentRegionId: patch.parentRegionId,
    patchId: patch.id,
    position: sitePoint(worldSeed, patch, key, existing),
    radiusMeters: Math.round(minRadius + roll * (maxRadius - minRadius)),
    discoveryDifficulty: Math.round(Math.max(5, Math.min(95, archetype.discoveryBase + (spatialUnitRandom(worldSeed, `${key}|discover`) - .5) * 24))),
    resourcePotential: clamp01(patch.suitability.forage * .65 + (1 - patch.suitability.disturbance) * .15 + roll * .2),
    shelterPotential: clamp01(patch.suitability.cover * .6 + (1 - patch.terrain.wetness) * .18 + patch.terrain.roughness * .12),
    wildlifePotential: clamp01(patch.suitability.cover * .34 + patch.suitability.forage * .4 + (1 - patch.suitability.disturbance) * .26),
    waterPotential: clamp01(hydroBias * .65 + patch.terrain.wetness * .35),
    legacyConceptId: archetype.legacyConceptId,
    tags: archetype.tags,
  });
}

interface RequiredMacroSiteDefinition {
  type: LocalSiteType;
  regionId: MainWorldAreaId;
  tags: readonly string[];
  radiusRange: readonly [number, number];
  discoveryBase: number;
  score: (patch: HabitatPatch) => number;
}

const REQUIRED_MACRO_SITES: readonly RequiredMacroSiteDefinition[] = [
  {
    type: 'plane_wreck', regionId: 'AREA_CAMP_CLEARING', tags: ['wreck', 'starting_site', 'salvage', 'landmark'], radiusRange: [65, 130], discoveryBase: 0,
    score: patch => (hasTerrain(patch, 'coastal') ? .6 : 0) + (hasTerrain(patch, 'open_ground') ? .25 : 0) + patch.suitability.disturbance * .25 - patch.terrain.elevationMeters / 800,
  },
  {
    type: 'limestone_cavern', regionId: 'AREA_CAVE_ENTRANCE', tags: ['cave', 'landmark', 'rock', 'shelter'], radiusRange: [45, 110], discoveryBase: 42,
    score: patch => (hasTerrain(patch, 'rock') ? .48 : 0) + patch.terrain.roughness * .28 + patch.suitability.cover * .18,
  },
  {
    type: 'ruin_complex', regionId: 'AREA_ANCIENT_RUINS', tags: ['ruins', 'landmark', 'salvage', 'history'], radiusRange: [55, 150], discoveryBase: 50,
    score: patch => (patch.habitat === 'ruin_edge' ? .62 : 0) + (hasTerrain(patch, 'rock') ? .18 : 0) + patch.suitability.disturbance * .25,
  },
];

function requiredSiteArchetype(definition: RequiredMacroSiteDefinition): SitePlacementArchetype {
  return {
    type: definition.type,
    category: 'landmark',
    rarity: 'exceptional',
    radiusRange: definition.radiusRange,
    discoveryBase: definition.discoveryBase,
    tags: definition.tags,
  };
}

function chooseRequiredPatch(worldSeed: string, definition: RequiredMacroSiteDefinition, patches: readonly HabitatPatch[]): HabitatPatch | undefined {
  let best: HabitatPatch | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const patch of patches) {
    if (patch.parentRegionId !== definition.regionId) continue;
    const score = definition.score(patch) + (spatialUnitRandom(worldSeed, `required-site|${definition.type}|${patch.id}`) - .5) * .22;
    if (score > bestScore) {
      best = patch;
      bestScore = score;
    }
  }
  return best;
}

export function generateLocalSites(
  worldSeed: string,
  patches: readonly HabitatPatch[],
  hydrology: GeneratedTerrainHydrology,
  pool: GeneratedLocalSitePool = generateLocalSitePool(worldSeed, patches, hydrology),
): GeneratedLocalSite[] {
  const sites: GeneratedLocalSite[] = [];
  const enabledTypes = new Set(pool.enabledTypes);

  // Macro identity is stable between runs, but the exact patch and metric
  // position of each landmark is chosen from the generated local terrain.
  for (const definition of REQUIRED_MACRO_SITES) {
    const patch = chooseRequiredPatch(worldSeed, definition, patches);
    if (!patch) continue;
    const site = makeSite(
      worldSeed,
      patch,
      requiredSiteArchetype(definition),
      `required|${definition.type}|${patch.id}`,
      sites,
    );
    sites.push(site);
  }

  for (const patch of patches) {
    const hydrologyState = hydrology.byPatchId[patch.id];
    if (!hydrologyState) continue;
    const count = localSiteCountForPatch(worldSeed, patch);
    for (let siteIndex = 0; siteIndex < count; siteIndex += 1) {
      const archetype = chooseArchetype(worldSeed, patch, hydrologyState, siteIndex, enabledTypes);
      if (!archetype) continue;
      const key = `natural|${patch.id}|${siteIndex}|${archetype.type}`;
      sites.push(makeSite(worldSeed, patch, archetype, key, sites));
    }
  }

  return sites;
}

export function getLocalSitesForRegion(
  regionId: MainWorldAreaId,
  sites: readonly GeneratedLocalSite[],
): GeneratedLocalSite[] {
  return sites.filter(site => site.parentRegionId === regionId);
}

export function validateLocalSiteContainment(
  sites: readonly GeneratedLocalSite[],
  patches: readonly HabitatPatch[],
): boolean {
  const byId = new Map(patches.map(patch => [patch.id, patch] as const));
  return sites.every(site => {
    const patch = byId.get(site.patchId);
    return Boolean(patch && patch.parentRegionId === site.parentRegionId && pointInPolygon(site.position, patch.polygon));
  });
}
