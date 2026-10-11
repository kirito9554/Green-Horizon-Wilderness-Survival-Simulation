import assert from 'node:assert/strict';
import { AREAS_DATABASE } from '../src/data/areas';
import { ITEMS_DATABASE } from '../src/data/items';
import {
  ALL_LEGACY_AREA_IDS,
  MAIN_WORLD_AREA_IDS,
  getWorldAreaLifecycle,
} from '../src/data/mainWorldAreas';
import {
  MAIN_ISLAND_LAND_AREA_KM2,
  MAIN_MAP_ASPECT_RATIO,
  MAIN_WORLD_HEIGHT_METERS,
  MAIN_WORLD_REGION_LIST,
  MAIN_WORLD_REGIONS,
  MAIN_WORLD_WIDTH_METERS,
  percentPointToWorld,
  pointInPolygon,
  worldPointToPercent,
} from '../src/data/worldGeometry';
import {
  HABITAT_PATCH_CELL_SIZE_METERS,
} from '../src/simulation/spatial/habitatPatches';
import { estimateSpatialRoute } from '../src/simulation/spatial/spatialTravel';
import { validateLocalSiteContainment } from '../src/simulation/spatial/localSiteGeneration';
import {
  ALL_LOCAL_SITE_TYPES,
  LOCAL_SITE_FUNCTIONAL_PROFILES,
  getLocalSiteFunctionalProfile,
} from '../src/simulation/spatial/localSiteProfiles';
import {
  DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT,
  RESOURCE_ABSOLUTE_CAP_MULTIPLIER,
  RESOURCE_CRITICAL_ENTER_RATIO,
  RESOURCE_CRITICAL_EXIT_RATIO,
  RESOURCE_RESERVE_FLOOR_RATIO,
  classifyLocalResourceRecoveryFamily,
  getLocalResourceMetrics,
  harvestLocalSiteResource,
  initializeLocalSiteResourceSimulation,
  tickLocalSiteResource,
  type LocalResourceDynamicState,
  type LocalResourceRecoveryFamily,
} from '../src/simulation/spatial/localSiteResourceSimulation';
import {
  generateSpatialWorld,
} from '../src/simulation/spatial/worldGeneration';

function approx(actual: number, expected: number, tolerance: number, message: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function testCanonicalMetricGeometry(): void {
  assert.equal(MAIN_WORLD_AREA_IDS.length, 10, 'only ten current macro regions may enter spatial world geometry');
  assert.equal(MAIN_WORLD_REGION_LIST.length, 10);

  const totalAreaKm2 = MAIN_WORLD_REGION_LIST.reduce((sum, region) => sum + region.areaKm2, 0);
  approx(totalAreaKm2, MAIN_ISLAND_LAND_AREA_KM2, 1e-6, 'canonical polygons must calibrate to 120 km²');
  approx(MAIN_WORLD_WIDTH_METERS / MAIN_WORLD_HEIGHT_METERS, MAIN_MAP_ASPECT_RATIO, 1e-12, 'metric bounds must preserve raster aspect ratio');

  for (const region of MAIN_WORLD_REGION_LIST) {
    assert.ok(region.areaKm2 > 0, `${region.id} must have positive land area`);
    assert.ok(region.areaShare > 0 && region.areaShare < 1, `${region.id} area share must be normalized`);
    assert.ok(pointInPolygon(region.centroid, region.polygon), `${region.id} centroid must remain on its authored territory`);
  }

  const sourcePoint: [number, number] = [63.25, 42.75];
  const worldPoint = percentPointToWorld(sourcePoint);
  const roundTrip = worldPointToPercent(worldPoint);
  approx(roundTrip[0], sourcePoint[0], 1e-10, 'x percent/world conversion must round-trip');
  approx(roundTrip[1], sourcePoint[1], 1e-10, 'y percent/world conversion must round-trip');
}

function testLegacyExclusion(): void {
  const allDatabaseIds = Object.keys(AREAS_DATABASE);
  const active = allDatabaseIds.filter(areaId => getWorldAreaLifecycle(areaId) === 'active');
  assert.deepEqual([...active].sort(), [...MAIN_WORLD_AREA_IDS].sort(), 'only canonical main-map regions may be active');
  assert.equal(
    ALL_LEGACY_AREA_IDS.length,
    allDatabaseIds.length - MAIN_WORLD_AREA_IDS.length,
    'every non-canonical database area must be explicitly classified as legacy',
  );
  for (const legacyId of ALL_LEGACY_AREA_IDS) {
    assert.notEqual(getWorldAreaLifecycle(legacyId), 'active', `${legacyId} must never enter active macro geometry`);
  }
}

function testLocalSiteFunctionalProfiles(): void {
  const uniqueTypes = new Set(ALL_LOCAL_SITE_TYPES);
  assert.equal(uniqueTypes.size, ALL_LOCAL_SITE_TYPES.length, 'local-site type registry must not contain duplicates');
  assert.equal(
    Object.keys(LOCAL_SITE_FUNCTIONAL_PROFILES).length,
    ALL_LOCAL_SITE_TYPES.length,
    'every local-site type must have exactly one functional profile',
  );

  for (const type of ALL_LOCAL_SITE_TYPES) {
    const profile = getLocalSiteFunctionalProfile(type);
    assert.equal(profile.type, type, `${type}: functional profile key/type mismatch`);
    assert.ok(profile.activities.length > 0, `${type}: every site needs at least one player-facing activity`);
    assert.ok(profile.roleTags.length > 0, `${type}: every site needs machine-readable role tags`);
    assert.ok(profile.gameplay.movementCostMultiplier > 0 && profile.gameplay.movementCostMultiplier <= 3, `${type}: invalid movement cost`);

    for (const [name, value] of Object.entries(profile.gameplay)) {
      if (name === 'movementCostMultiplier') continue;
      assert.ok(value >= 0 && value <= 1, `${type}: gameplay ${name} must be normalized`);
    }
    for (const [name, value] of Object.entries(profile.ecology)) {
      if (name === 'guildAffinity') continue;
      assert.ok(typeof value === 'number' && value >= 0 && value <= 1, `${type}: ecology ${name} must be normalized`);
    }
    for (const [guild, affinity] of Object.entries(profile.ecology.guildAffinity)) {
      assert.ok((affinity ?? 0) >= -1 && (affinity ?? 0) <= 1, `${type}: guild ${guild} affinity must be -1..1`);
    }
    for (const resource of profile.resources) {
      assert.ok(resource.abundance >= 0 && resource.abundance <= 1, `${type}: ${resource.kind} abundance must be normalized`);
      assert.ok(resource.extractionImpact >= 0 && resource.extractionImpact <= 1, `${type}: ${resource.kind} extraction impact must be normalized`);
      for (const itemId of resource.itemIds ?? []) {
        assert.ok(ITEMS_DATABASE[itemId], `${type}: resource ${resource.kind} references missing item ${itemId}`);
      }
    }
  }

  const hasResource = (type: (typeof ALL_LOCAL_SITE_TYPES)[number], kind: string): boolean =>
    getLocalSiteFunctionalProfile(type).resources.some(resource => resource.kind === kind);

  assert.equal(hasResource('freshwater_seep', 'fresh_water'), true, 'freshwater seep must provide water');
  assert.equal(hasResource('clay_bank', 'clay'), true, 'clay bank must provide clay');
  assert.equal(hasResource('fallen_giant', 'timber'), true, 'fallen giant must provide timber/deadwood');
  assert.equal(hasResource('plane_wreck', 'salvage'), true, 'plane wreck must provide finite salvage');
  assert.ok(getLocalSiteFunctionalProfile('rock_shelter').gameplay.shelterQuality >= .8, 'rock shelter must be a strong shelter site');
  assert.ok(getLocalSiteFunctionalProfile('predator_den').ecology.guildAffinity.predator! >= .8, 'predator den must strongly favor predators');
  assert.ok(getLocalSiteFunctionalProfile('burrow_colony').ecology.preyRefuge >= .9, 'burrow colony must act as strong prey refuge');
  assert.ok(getLocalSiteFunctionalProfile('animal_trail').ecology.predatorOpportunity >= .7, 'animal trail must create hunting opportunity');
}

function syntheticResource(
  family: LocalResourceRecoveryFamily,
  stock: number,
  overrides: Partial<LocalResourceDynamicState> = {},
): LocalResourceDynamicState {
  return {
    id: `synthetic:${family}`,
    siteId: 'synthetic-site',
    kind: family === 'flow' ? 'fresh_water' : family === 'geological_flux' ? 'stone' : family === 'salvage_exposure' ? 'salvage' : 'fruit',
    recoveryFamily: family,
    baseCapacity: 100,
    effectiveCapacity: 100,
    stock,
    condition: 1,
    depletionPressure: 0,
    criticalLatched: stock / 100 <= RESOURCE_CRITICAL_ENTER_RATIO,
    extractionImpact: .8,
    seasonality: 'year_round',
    itemIds: [],
    lastUpdatedHours: 0,
    ...overrides,
  };
}

function testLocalResourceDepletionAndRecovery(): void {
  assert.equal(RESOURCE_RESERVE_FLOOR_RATIO, .1, 'critical reserve floor must be 10% of base capacity');
  assert.ok(RESOURCE_CRITICAL_ENTER_RATIO > RESOURCE_RESERVE_FLOOR_RATIO);
  assert.ok(RESOURCE_CRITICAL_EXIT_RATIO > RESOURCE_CRITICAL_ENTER_RATIO, 'critical state must use recovery hysteresis');

  const normalMetrics = getLocalResourceMetrics(syntheticResource('renewable_biomass', 55));
  const criticalMetrics = getLocalResourceMetrics(syntheticResource('renewable_biomass', 12));
  assert.equal(criticalMetrics.depletionState, 'critical');
  assert.ok(criticalMetrics.yieldEfficiency < normalMetrics.yieldEfficiency * .4, 'critical depletion must heavily punish yield');
  assert.ok(criticalMetrics.quality < normalMetrics.quality, 'critical depletion must reduce quality');
  assert.ok(criticalMetrics.laborCostMultiplier > normalMetrics.laborCostMultiplier * 1.7, 'critical depletion must sharply increase labor cost');
  assert.ok(criticalMetrics.recoveryMultiplier < normalMetrics.recoveryMultiplier * .5, 'critical depletion must strongly suppress recovery');

  const nearlyCritical = syntheticResource('renewable_biomass', 16, { criticalLatched: false });
  const harvested = harvestLocalSiteResource(nearlyCritical, 20);
  approx(harvested.state.stock, 10, 1e-9, 'harvest may reach but never cross the reserve floor');
  assert.equal(harvested.state.criticalLatched, true, 'crossing the critical threshold must latch critical state');
  assert.equal(harvested.result.reserveFloorReached, true);

  const futile = harvestLocalSiteResource(harvested.state, 12);
  assert.equal(futile.result.resourceDraw, 0, 'the 10% ecological reserve is not harvestable stock');
  assert.equal(futile.result.yieldedUnits, 0, 'repeated extraction at the floor must not create free resources');
  assert.ok(futile.state.depletionPressure > harvested.state.depletionPressure, 'futile extraction must deepen depletion pressure');
  assert.ok(futile.state.condition < harvested.state.condition, 'futile extraction must damage site condition');
  approx(futile.state.stock, 10, 1e-9, 'futile extraction must preserve the reserve floor');

  const stillLatched = tickLocalSiteResource(
    syntheticResource('renewable_biomass', 24, { criticalLatched: true }),
    .01,
    DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT,
  );
  assert.equal(stillLatched.criticalLatched, true, 'critical must persist below the 25% recovery threshold');

  const recovered = tickLocalSiteResource(
    syntheticResource('renewable_biomass', 26, { criticalLatched: true }),
    .01,
    DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT,
  );
  assert.equal(recovered.criticalLatched, false, 'critical must clear after recovery exceeds the hysteresis threshold');

  const lowPlant = syntheticResource('renewable_biomass', 11);
  const midPlant = syntheticResource('renewable_biomass', 50, { criticalLatched: false });
  const lowPlantAfter = tickLocalSiteResource(lowPlant, 24, DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT);
  const midPlantAfter = tickLocalSiteResource(midPlant, 24, DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT);
  assert.ok(
    lowPlantAfter.stock - lowPlant.stock < midPlantAfter.stock - midPlant.stock,
    'plant biomass near the reserve floor must regrow much slower than a healthy mid-stock population',
  );

  const geology = syntheticResource('geological_flux', 50, { criticalLatched: false });
  const lowErosion = tickLocalSiteResource(geology, 24, { ...DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT, erosion: 0, flooding: 0, rainfall: .2 });
  const highErosion = tickLocalSiteResource(geology, 24, { ...DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT, erosion: 1, flooding: .8, rainfall: .9 });
  assert.ok(highErosion.stock - geology.stock > lowErosion.stock - geology.stock, 'erosion/flooding must bonus fixed geological replenishment');

  for (const family of [
    'renewable_biomass', 'geological_flux', 'flow', 'episodic', 'population_backed', 'salvage_exposure',
  ] as const) {
    const atFloor = syntheticResource(family, 10, { criticalLatched: true });
    const context = {
      ...DEFAULT_LOCAL_RESOURCE_RECOVERY_CONTEXT,
      stormPulse: family === 'episodic' || family === 'salvage_exposure' ? .4 : 0,
      tidalPulse: family === 'episodic' ? .3 : 0,
    };
    const after = tickLocalSiteResource(atFloor, 24, context);
    assert.ok(after.stock > atFloor.stock, `${family}: every repeatable resource family must have a non-zero recovery path`);
    assert.ok(after.stock >= atFloor.baseCapacity * RESOURCE_RESERVE_FLOOR_RATIO, `${family}: recovery must preserve reserve floor`);
    assert.ok(after.stock <= atFloor.baseCapacity * RESOURCE_ABSOLUTE_CAP_MULTIPLIER + 1e-9, `${family}: recovery must obey absolute cap`);
  }

  assert.equal(classifyLocalResourceRecoveryFamily({ kind: 'fruit', renewability: 'seasonal' }), 'renewable_biomass');
  assert.equal(classifyLocalResourceRecoveryFamily({ kind: 'stone', renewability: 'finite' }), 'geological_flux');
  assert.equal(classifyLocalResourceRecoveryFamily({ kind: 'fresh_water', renewability: 'continuous' }), 'flow');
  assert.equal(classifyLocalResourceRecoveryFamily({ kind: 'driftwood', renewability: 'episodic' }), 'episodic');
  assert.equal(classifyLocalResourceRecoveryFamily({ kind: 'fish', renewability: 'continuous' }), 'population_backed');
  assert.equal(classifyLocalResourceRecoveryFamily({ kind: 'salvage', renewability: 'finite' }), 'salvage_exposure');
}

function patchFingerprint(world: ReturnType<typeof generateSpatialWorld>): string {
  return world.habitatPatches.slice(0, 80).map(patch => [
    patch.parentRegionId,
    patch.id,
    patch.centroid.x.toFixed(2),
    patch.centroid.y.toFixed(2),
    patch.habitat,
    patch.terrain.elevationMeters.toFixed(2),
    patch.terrain.wetness.toFixed(3),
  ].join(':')).join('|');
}

function siteFingerprint(world: ReturnType<typeof generateSpatialWorld>): string {
  return world.localSites.slice(0, 80).map(site => [
    site.id,
    site.type,
    site.patchId,
    site.position.x.toFixed(2),
    site.position.y.toFixed(2),
  ].join(':')).join('|');
}

function validateWorld(seed: string): ReturnType<typeof generateSpatialWorld> {
  const world = generateSpatialWorld(seed);
  const patches = world.habitatPatches;
  assert.ok(patches.length > 300 && patches.length < 750, `600 m shifted lattice should stay lightweight; got ${patches.length} patches`);
  assert.equal(new Set(patches.map(patch => patch.id)).size, patches.length, 'habitat patch IDs must be unique inside a world');

  const totalPatchAreaKm2 = patches.reduce((sum, patch) => sum + patch.areaKm2, 0);
  approx(totalPatchAreaKm2, MAIN_ISLAND_LAND_AREA_KM2, 1e-5, `${seed}: clipped patches must conserve canonical land area`);

  for (const patch of patches) {
    assert.ok(patch.areaM2 <= HABITAT_PATCH_CELL_SIZE_METERS ** 2 + 1e-5, `${patch.id} cannot exceed its lattice cell`);
    assert.ok(patch.coverageFraction > 0 && patch.coverageFraction <= 1 + 1e-8);
    assert.ok(patch.movementCost > 1, `${patch.id} must retain positive terrain impedance`);
    assert.ok(patch.terrain.elevationMeters >= 0);
    assert.ok(patch.terrain.wetness >= 0 && patch.terrain.wetness <= 1);
    assert.ok(patch.terrain.roughness >= 0 && patch.terrain.roughness <= 1);
    assert.ok(patch.terrain.drainage >= 0 && patch.terrain.drainage <= 1);

    const parent = MAIN_WORLD_REGIONS[patch.parentRegionId];
    assert.ok(pointInPolygon(patch.centroid, parent.polygon), `${patch.id} centroid must remain inside parent region`);
    for (const vertex of patch.polygon) {
      assert.ok(pointInPolygon(vertex, parent.polygon), `${patch.id} clipped vertex must remain on/in parent region`);
    }
  }

  assert.equal(Object.keys(world.routeGraph.patchesById).length, patches.length);
  assert.equal(Object.keys(world.hydrology.byPatchId).length, patches.length);
  assert.ok(world.hydrology.streamPatchIds.length > 10, `${seed}: terrain should generate a non-trivial drainage network`);

  for (const patch of patches) {
    const hydro = world.hydrology.byPatchId[patch.id];
    assert.ok(hydro, `${patch.id} must have generated hydrology`);
    if (hydro.downstreamPatchId) {
      const downstream = world.routeGraph.patchesById[hydro.downstreamPatchId];
      assert.ok(downstream, `${patch.id} downstream patch must exist`);
      assert.ok(
        downstream.terrain.elevationMeters < patch.terrain.elevationMeters - .3,
        `${patch.id} drainage must move downhill`,
      );
    }
  }

  const pool = world.localSitePool;
  const catalogTypes = new Set(pool.entries.map(entry => entry.type));
  const enabledTypes = new Set(pool.enabledTypes);
  assert.ok(catalogTypes.size >= 60, `${seed}: expanded natural-site catalog should contain many archetypes; got ${catalogTypes.size}`);
  assert.ok(enabledTypes.size >= 20, `${seed}: terrain should enable a useful local-site vocabulary; got ${enabledTypes.size}`);
  assert.ok(enabledTypes.size < catalogTypes.size, `${seed}: one campaign must not enable the entire local-site catalog`);
  assert.equal(pool.disabledTypes.length > 0, true, `${seed}: some archetypes should remain absent from this seed`);

  assert.ok(world.localSites.length > 70 && world.localSites.length < 350, `${seed}: local-site density should stay gameplay-sized; got ${world.localSites.length}`);
  assert.equal(new Set(world.localSites.map(site => site.id)).size, world.localSites.length, 'local site IDs must be unique');
  assert.equal(validateLocalSiteContainment(world.localSites, patches), true, 'every generated local site must lie in its habitat patch');
  for (const requiredType of ['plane_wreck', 'limestone_cavern', 'ruin_complex'] as const) {
    assert.equal(world.localSites.filter(site => site.type === requiredType).length, 1, `${seed}: ${requiredType} must exist exactly once`);
  }
  for (const site of world.localSites) {
    if (site.category !== 'landmark') {
      assert.ok(enabledTypes.has(site.type as never), `${seed}: ${site.type} spawned even though it is absent from this world's site pool`);
    }
    assert.ok(getLocalSiteFunctionalProfile(site.type), `${seed}: ${site.type} must have functional semantics`);
    assert.ok(world.localSiteInfluenceByPatchId[site.patchId], `${seed}: spawned site patch must expose aggregated site influence`);
  }

  for (const influence of Object.values(world.localSiteInfluenceByPatchId)) {
    assert.ok(influence.siteCount > 0);
    for (const key of [
      'forage', 'cover', 'water', 'breedingHabitat', 'preyRefuge', 'predatorOpportunity',
      'aquaticNursery', 'decomposition', 'disturbanceSensitivity', 'shelterQuality',
      'campSuitability', 'hazard', 'navigationValue',
    ] as const) {
      assert.ok(influence[key] >= 0 && influence[key] <= 1, `${seed}: patch influence ${key} must be normalized`);
    }
    for (const value of Object.values(influence.resourcePotential)) {
      assert.ok((value ?? 0) >= 0 && (value ?? 0) <= 1, `${seed}: patch resource signal must be normalized`);
    }
  }

  const resourceState = initializeLocalSiteResourceSimulation(seed, world.localSites);
  const resourceStateAgain = initializeLocalSiteResourceSimulation(seed, world.localSites);
  assert.deepEqual(resourceState, resourceStateAgain, `${seed}: local resource initialization must be deterministic`);
  assert.ok(Object.keys(resourceState.resourcesById).length > 20, `${seed}: generated sites should materialize many dynamic resource states`);
  for (const resource of Object.values(resourceState.resourcesById)) {
    const metrics = getLocalResourceMetrics(resource);
    assert.ok(resource.stock >= metrics.reserveFloor - 1e-9, `${resource.id}: generated stock may not start below reserve floor`);
    assert.ok(resource.stock <= resource.baseCapacity * RESOURCE_ABSOLUTE_CAP_MULTIPLIER + 1e-9, `${resource.id}: generated stock exceeds absolute cap`);
    assert.ok(resource.condition >= 0 && resource.condition <= 1);
    assert.ok(resource.depletionPressure >= 0 && resource.depletionPressure <= 1);
  }

  const route = estimateSpatialRoute(
    MAIN_WORLD_REGIONS.AREA_CAMP_CLEARING.centroid,
    MAIN_WORLD_REGIONS.AREA_FOREST_EDGE.centroid,
    { graph: world.routeGraph, baseOpenTerrainSpeedKmh: 4.5 },
  );
  assert.ok(route, `${seed}: generated land graph must connect Plane Wreck to Deep Rainforest`);
  assert.ok(route.patchIds.length > 1, 'cross-region travel should traverse multiple habitat patches');
  assert.ok(route.routeDistanceMeters >= route.straightLineDistanceMeters * .7, 'route geometry must remain physically plausible');
  assert.ok(route.weightedDistanceMeters > route.routeDistanceMeters, 'terrain impedance should increase effective travel cost');
  assert.ok(route.estimatedTravelMinutes > 0);

  return world;
}

function testSeededWorldSimulation(): void {
  const alpha = validateWorld('spatial-world-alpha');
  const alphaAgain = validateWorld('spatial-world-alpha');
  const beta = validateWorld('spatial-world-beta');

  assert.equal(patchFingerprint(alpha), patchFingerprint(alphaAgain), 'same world seed must recreate identical terrain topology');
  assert.equal(siteFingerprint(alpha), siteFingerprint(alphaAgain), 'same world seed must recreate identical local sites');
  assert.deepEqual(alpha.hydrology.streamPatchIds, alphaAgain.hydrology.streamPatchIds, 'same seed must recreate drainage topology');
  assert.equal(alpha.localSitePool.signature, alphaAgain.localSitePool.signature, 'same seed must recreate the same terrain-driven site pool');
  assert.deepEqual(alpha.localSiteInfluenceByPatchId, alphaAgain.localSiteInfluenceByPatchId, 'same seed must recreate identical site ecology/resource signals');

  assert.notEqual(patchFingerprint(alpha), patchFingerprint(beta), 'different runs must generate different habitat geometry/terrain');
  assert.notEqual(siteFingerprint(alpha), siteFingerprint(beta), 'different runs must generate different local sites and positions');
  assert.notEqual(alpha.localSitePool.signature, beta.localSitePool.signature, 'different seeds should select different local-site vocabularies');
  assert.notEqual(alpha.habitatPatches[0].worldSignature, beta.habitatPatches[0].worldSignature, 'different saves must carry distinct spatial signatures');
}

function main(): void {
  testCanonicalMetricGeometry();
  testLegacyExclusion();
  testLocalSiteFunctionalProfiles();
  testLocalResourceDepletionAndRecovery();
  testSeededWorldSimulation();
  console.log('Seeded spatial world, local-site resource depletion/recovery, ecology, hydrology and route smoke tests passed.');
}

main();
