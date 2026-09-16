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
  DEFAULT_SPATIAL_WORLD_SEED,
  HABITAT_PATCH_CELL_SIZE_METERS,
  generateHabitatPatches,
} from '../src/simulation/spatial/habitatPatches';
import {
  buildSpatialRouteGraph,
  estimateSpatialRoute,
} from '../src/simulation/spatial/spatialTravel';

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

function testDeterministicHabitatSubdivision(): void {
  const a = generateHabitatPatches(DEFAULT_SPATIAL_WORLD_SEED);
  const b = generateHabitatPatches(DEFAULT_SPATIAL_WORLD_SEED);
  assert.ok(a.length > 300 && a.length < 700, `600 m lattice should stay lightweight; got ${a.length} patches`);
  assert.equal(a.length, b.length);
  assert.equal(new Set(a.map(patch => patch.id)).size, a.length, 'habitat patch IDs must be unique');

  const totalPatchAreaKm2 = a.reduce((sum, patch) => sum + patch.areaKm2, 0);
  approx(totalPatchAreaKm2, MAIN_ISLAND_LAND_AREA_KM2, 1e-5, 'clipped patches must conserve canonical land area');

  for (let i = 0; i < a.length; i += 1) {
    const first = a[i];
    const second = b[i];
    assert.equal(first.id, second.id, 'same seed must preserve patch identity and ordering');
    assert.equal(first.seed, second.seed, 'same seed must preserve patch seed');
    assert.equal(first.habitat, second.habitat, 'same seed must preserve habitat assignment');
    approx(first.areaM2, second.areaM2, 1e-8, 'same seed must preserve patch geometry area');
    assert.ok(first.areaM2 <= HABITAT_PATCH_CELL_SIZE_METERS ** 2 + 1e-5, `${first.id} cannot exceed its lattice cell`);
    assert.ok(first.coverageFraction > 0 && first.coverageFraction <= 1 + 1e-8);

    const parent = MAIN_WORLD_REGIONS[first.parentRegionId];
    assert.ok(pointInPolygon(first.centroid, parent.polygon), `${first.id} centroid must remain inside parent region`);
    for (const vertex of first.polygon) {
      assert.ok(pointInPolygon(vertex, parent.polygon), `${first.id} clipped vertex must remain on/in parent region`);
    }
  }
}

function testRouteFoundation(): void {
  const patches = generateHabitatPatches(DEFAULT_SPATIAL_WORLD_SEED);
  const graph = buildSpatialRouteGraph(patches);
  assert.equal(Object.keys(graph.patchesById).length, patches.length);

  const start = MAIN_WORLD_REGIONS.AREA_CAMP_CLEARING.centroid;
  const end = MAIN_WORLD_REGIONS.AREA_FOREST_EDGE.centroid;
  const route = estimateSpatialRoute(start, end, { graph, baseOpenTerrainSpeedKmh: 4.5 });
  assert.ok(route, 'canonical land graph must connect Plane Wreck to Deep Rainforest');
  assert.ok(route.patchIds.length > 1, 'cross-region travel should traverse multiple habitat patches');
  assert.ok(route.routeDistanceMeters >= route.straightLineDistanceMeters * 0.75, 'route geometry must remain physically plausible');
  assert.ok(route.weightedDistanceMeters > route.routeDistanceMeters, 'rainforest terrain impedance should increase effective travel cost');
  assert.ok(route.estimatedTravelMinutes > 0);
}

function main(): void {
  testCanonicalMetricGeometry();
  testLegacyExclusion();
  testDeterministicHabitatSubdivision();
  testRouteFoundation();
  console.log('Spatial world geometry and habitat subdivision smoke tests passed.');
}

main();
