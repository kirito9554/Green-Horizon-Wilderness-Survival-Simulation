import assert from 'node:assert/strict';
import { AREAS_DATABASE } from '../src/data/areas';
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
    if (site.category === 'landmark') continue;
    assert.ok(enabledTypes.has(site.type as never), `${seed}: ${site.type} spawned even though it is absent from this world's site pool`);
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

  assert.notEqual(patchFingerprint(alpha), patchFingerprint(beta), 'different runs must generate different habitat geometry/terrain');
  assert.notEqual(siteFingerprint(alpha), siteFingerprint(beta), 'different runs must generate different local sites and positions');
  assert.notEqual(alpha.localSitePool.signature, beta.localSitePool.signature, 'different seeds should select different local-site vocabularies');
  assert.notEqual(alpha.habitatPatches[0].worldSignature, beta.habitatPatches[0].worldSignature, 'different saves must carry distinct spatial signatures');
}

function main(): void {
  testCanonicalMetricGeometry();
  testLegacyExclusion();
  testSeededWorldSimulation();
  console.log('Seeded spatial world, terrain hydrology, terrain-driven local-site pools and route smoke tests passed.');
}

main();
