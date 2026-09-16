import type { MainWorldAreaId } from '../../data/mainWorldAreas';
import { pointInPolygon, type WorldPointMeters } from '../../data/worldGeometry';
import type { HabitatPatch, TerrainTag } from './habitatPatches';
import type { GeneratedTerrainHydrology, PatchHydrologyState } from './terrainHydrology';
import {
  samplePointInPolygon,
  spatialUnitRandom,
  stableSpatialId,
} from './spatialRandom';

export type LocalSiteType =
  | 'plane_wreck'
  | 'limestone_cavern'
  | 'ruin_complex'
  | 'freshwater_seep'
  | 'animal_trail'
  | 'wildlife_nest'
  | 'giant_kapok'
  | 'medicinal_glade'
  | 'clay_bank'
  | 'fallen_giant'
  | 'root_hollow'
  | 'rock_shelter'
  | 'fruit_grove'
  | 'canopy_gap'
  | 'mud_crossing'
  | 'tidal_pool'
  | 'cave_shaft'
  | 'waterfall_pool';

export interface GeneratedLocalSite {
  id: string;
  seed: number;
  type: LocalSiteType;
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

interface LocalSiteArchetype {
  type: LocalSiteType;
  label: string;
  baseWeight: number;
  radiusRange: readonly [number, number];
  discoveryBase: number;
  legacyConceptId?: string;
  tags: readonly string[];
  score: (patch: HabitatPatch, hydrology: PatchHydrologyState) => number;
}

const hasTerrain = (patch: HabitatPatch, tag: TerrainTag): boolean => patch.terrainTags.includes(tag);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const NATURAL_SITE_ARCHETYPES: readonly LocalSiteArchetype[] = [
  {
    type: 'freshwater_seep', label: 'Freshwater Seep', baseWeight: .7, radiusRange: [18, 55], discoveryBase: 48,
    tags: ['water', 'freshwater', 'forage'],
    score: (patch, hydro) => clamp01(hydro.waterIndex * .55 + patch.terrain.wetness * .3 + patch.terrain.drainage * .15),
  },
  {
    type: 'animal_trail', label: 'Animal Trail', baseWeight: 1.3, radiusRange: [35, 110], discoveryBase: 34,
    legacyConceptId: 'AREA_JUNGLE_TRAIL', tags: ['trail', 'wildlife', 'travel'],
    score: patch => clamp01(patch.suitability.forage * .4 + patch.suitability.cover * .3 + (1 - patch.suitability.disturbance) * .2 + .1),
  },
  {
    type: 'wildlife_nest', label: 'Wildlife Nest', baseWeight: .78, radiusRange: [18, 60], discoveryBase: 58,
    legacyConceptId: 'AREA_WILDLIFE_NEST', tags: ['wildlife', 'nest', 'encounter'],
    score: patch => clamp01(patch.suitability.cover * .45 + patch.suitability.canopy * .25 + patch.suitability.forage * .2 - patch.suitability.disturbance * .25),
  },
  {
    type: 'giant_kapok', label: 'Giant Kapok', baseWeight: .32, radiusRange: [24, 70], discoveryBase: 56,
    legacyConceptId: 'AREA_KAPOK_GROVE', tags: ['tree', 'landmark', 'canopy'],
    score: patch => clamp01(patch.suitability.canopy * .65 + patch.suitability.cover * .18 - patch.suitability.disturbance * .35),
  },
  {
    type: 'medicinal_glade', label: 'Medicinal Glade', baseWeight: .48, radiusRange: [25, 75], discoveryBase: 62,
    legacyConceptId: 'AREA_MEDICINAL_GLADE', tags: ['plants', 'medicine', 'forage'],
    score: patch => clamp01(patch.suitability.forage * .45 + patch.suitability.moisture * .28 + (1 - patch.suitability.canopy) * .15 + .12),
  },
  {
    type: 'clay_bank', label: 'Clay Bank', baseWeight: .44, radiusRange: [20, 70], discoveryBase: 44,
    legacyConceptId: 'AREA_CLAY_PIT', tags: ['clay', 'water', 'material'],
    score: (patch, hydro) => clamp01(patch.terrain.wetness * .4 + hydro.waterIndex * .32 + (hasTerrain(patch, 'rock') ? -.28 : .2)),
  },
  {
    type: 'fallen_giant', label: 'Fallen Giant', baseWeight: .62, radiusRange: [25, 85], discoveryBase: 38,
    tags: ['tree', 'shelter', 'insects'],
    score: patch => clamp01(patch.suitability.canopy * .42 + patch.terrain.roughness * .24 + patch.suitability.cover * .26),
  },
  {
    type: 'root_hollow', label: 'Root Hollow', baseWeight: .58, radiusRange: [12, 42], discoveryBase: 66,
    tags: ['shelter', 'roots', 'wildlife'],
    score: patch => clamp01(patch.suitability.cover * .45 + patch.suitability.canopy * .3 + patch.terrain.roughness * .18),
  },
  {
    type: 'rock_shelter', label: 'Rock Shelter', baseWeight: .5, radiusRange: [18, 65], discoveryBase: 54,
    tags: ['rock', 'shelter', 'dry'],
    score: patch => clamp01((hasTerrain(patch, 'rock') ? .52 : 0) + patch.terrain.roughness * .28 + patch.terrain.drainage * .16),
  },
  {
    type: 'fruit_grove', label: 'Fruiting Grove', baseWeight: .6, radiusRange: [28, 90], discoveryBase: 46,
    tags: ['food', 'plants', 'wildlife'],
    score: patch => clamp01(patch.suitability.forage * .62 + patch.suitability.canopy * .2 - patch.suitability.disturbance * .12),
  },
  {
    type: 'canopy_gap', label: 'Canopy Gap', baseWeight: .45, radiusRange: [35, 105], discoveryBase: 28,
    tags: ['clearing', 'sunlight', 'building'],
    score: patch => clamp01((1 - patch.suitability.canopy) * .5 + patch.suitability.disturbance * .32 + (hasTerrain(patch, 'open_ground') ? .28 : 0)),
  },
  {
    type: 'mud_crossing', label: 'Mud Crossing', baseWeight: .42, radiusRange: [22, 80], discoveryBase: 32,
    tags: ['mud', 'crossing', 'travel', 'water'],
    score: (patch, hydro) => clamp01((hasTerrain(patch, 'mud') ? .42 : 0) + patch.terrain.wetness * .3 + hydro.waterIndex * .28),
  },
  {
    type: 'tidal_pool', label: 'Tidal Pool', baseWeight: .5, radiusRange: [12, 50], discoveryBase: 30,
    tags: ['coastal', 'tidal', 'aquatic', 'food'],
    score: patch => clamp01((hasTerrain(patch, 'tidal') ? .55 : 0) + (hasTerrain(patch, 'coastal') ? .25 : 0) + patch.suitability.aquatic * .2),
  },
  {
    type: 'cave_shaft', label: 'Karst Shaft', baseWeight: .28, radiusRange: [10, 45], discoveryBase: 72,
    tags: ['cave', 'rock', 'hazard'],
    score: patch => clamp01((patch.habitat === 'karst_forest' || patch.habitat === 'cave_mouth' ? .58 : 0) + (hasTerrain(patch, 'rock') ? .22 : 0) + patch.terrain.roughness * .2),
  },
  {
    type: 'waterfall_pool', label: 'Cascade Pool', baseWeight: .34, radiusRange: [20, 70], discoveryBase: 48,
    tags: ['water', 'rock', 'freshwater', 'fishing'],
    score: (patch, hydro) => clamp01((hydro.watercourse === 'river' || hydro.watercourse === 'stream' ? .42 : 0) + patch.terrain.slope * .28 + patch.suitability.aquatic * .3),
  },
];

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
): LocalSiteArchetype {
  const weighted = NATURAL_SITE_ARCHETYPES.map(archetype => {
    const suitability = archetype.score(patch, hydrology);
    const worldVariation = .72 + spatialUnitRandom(worldSeed, `site-weight|${patch.id}|${siteIndex}|${archetype.type}`) * .56;
    return { archetype, weight: archetype.baseWeight * worldVariation * Math.pow(Math.max(.04, suitability), 1.7) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
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
  archetype: LocalSiteArchetype,
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

function requiredSiteArchetype(definition: RequiredMacroSiteDefinition): LocalSiteArchetype {
  return {
    type: definition.type,
    label: definition.type,
    baseWeight: 1,
    radiusRange: definition.radiusRange,
    discoveryBase: definition.discoveryBase,
    tags: definition.tags,
    score: patch => definition.score(patch),
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
): GeneratedLocalSite[] {
  const sites: GeneratedLocalSite[] = [];

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
      const archetype = chooseArchetype(worldSeed, patch, hydrologyState, siteIndex);
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
