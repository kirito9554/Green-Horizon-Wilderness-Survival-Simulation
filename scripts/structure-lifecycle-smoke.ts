import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import type { StructureConstructionJob, StructureConstructionPhase } from '../src/types/buildingSimulation';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import { ensureBuildingSimulation, getOrCreatePoiBuildGrid } from '../src/simulation/buildGridSystem';
import {
  bootstrapCompletedStructureComponents,
} from '../src/simulation/structureLifecycleSystem';
import {
  tickStructureEnvironment,
} from '../src/simulation/structureComponentSystem';

function completedPhase(
  id: string,
  kind: StructureConstructionPhase['kind'],
  itemId: string | undefined,
  workmanship = 74,
): StructureConstructionPhase {
  return {
    id,
    name: id,
    kind,
    requirements: itemId ? [{ itemId, quantity: 1 }] : [],
    progressSeconds: 5,
    totalSeconds: 5,
    status: 'completed',
    materialsConsumed: true,
    consumedQualities: itemId ? ['standard'] : [],
    workmanshipScore: workmanship,
  };
}

function makeState(): { state: GameState; job: StructureConstructionJob; buildingId: string } {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  const simulation = ensureBuildingSimulation(state);
  simulation.worldSeed = 'structure-lifecycle-smoke';
  simulation.gridsByPoiId = {};
  simulation.clusters = [];
  simulation.preparationJobs = [];
  simulation.constructionJobs = [];

  const grid = getOrCreatePoiBuildGrid(state, 'AREA_CAMP_CLEARING');
  const cell = grid.cells[0];
  assert.ok(cell, 'camp grid requires at least one cell');
  // Make the smoke environment clearly wet so the result is deterministic.
  cell.moisture = 82;
  cell.floodRisk = 70;
  cell.windExposure = 65;
  cell.drainage = 30;

  const clusterId = 'cluster_structure_smoke';
  simulation.clusters.push({
    id: clusterId,
    poiId: 'AREA_CAMP_CLEARING',
    type: 'shelter',
    name: 'Structure Smoke Shelter',
    cellIds: [cell.id],
    usableAreaM2: cell.areaM2,
    occupiedAreaM2: 18,
    state: 'active',
    siteScore: 68,
    createdAtGameMinute: 0,
    maintenancePolicy: 'normal',
  });
  cell.clusterId = clusterId;
  cell.reservedAreaM2 = 18;

  const buildingInstanceId = 'building_structure_smoke';
  const jobId = 'construction_structure_smoke';
  state.buildings.push({
    id: buildingInstanceId,
    buildingId: 'BUILDING_LEAF_SHELTER',
    condition: 100,
    isBuilt: true,
    buildProgressSeconds: 30,
    totalBuildSeconds: 30,
    areaId: 'AREA_CAMP_CLEARING',
    clusterId,
    placement: [{ cellId: cell.id, areaM2: 18 }],
    footprintAreaM2: 18,
    placementScore: 68,
    constructionJobId: jobId,
    stagingInventory: { maxWeightKg: 9999, maxVolumeL: 9999, items: [] },
  });

  const phases: StructureConstructionPhase[] = [
    completedPhase('ground', 'groundwork', undefined, 72),
    completedPhase('foundation', 'foundation', 'ITEM_RIVER_PEBBLE', 75),
    completedPhase('frame', 'frame', 'ITEM_DRIFTWOOD_BRANCH', 78),
    completedPhase('binding', 'binding', 'ITEM_VINE_FIBER', 70),
    completedPhase('roof', 'cover', 'ITEM_PALM_LEAF', 76),
    completedPhase('finish', 'finish', undefined, 80),
  ];

  const job: StructureConstructionJob = {
    id: jobId,
    buildingInstanceId,
    buildingId: 'BUILDING_LEAF_SHELTER',
    clusterId,
    poiId: 'AREA_CAMP_CLEARING',
    status: 'completed',
    createdAtGameMinute: 0,
    materialReservations: [],
    blockedReasons: [],
    haulProgressSeconds: 4,
    haulTotalSeconds: 4,
    materialsDelivered: true,
    materialQualityByItemId: {},
    phases,
    currentPhaseIndex: phases.length,
  };
  simulation.constructionJobs.push(job);
  return { state, job, buildingId: buildingInstanceId };
}

function testConstructionBecomesPhysicalComponents(): void {
  const { state, buildingId } = makeState();
  const building = state.buildings.find(candidate => candidate.id === buildingId)!;
  assert.equal(building.structureComponents, undefined);

  bootstrapCompletedStructureComponents(state);

  assert.ok(building.structureComponents && building.structureComponents.length >= 5, 'completed phased build must create a physical component graph');
  assert.ok(building.structureComponents.some(component => component.kind === 'frame'), 'shelter should have structural frame');
  assert.ok(building.structureComponents.some(component => component.kind === 'bindings'), 'shelter should have bindings');
  assert.ok(building.structureComponents.some(component => component.kind === 'roof'), 'shelter should have roof covering');
  assert.ok(building.structurePerformance, 'component graph must derive structure performance');
  assert.ok((building.structurePerformance?.structuralIntegrity || 0) > 0);
}

function testRainRaisesRoofMoisture(): void {
  const { state, buildingId } = makeState();
  bootstrapCompletedStructureComponents(state);
  const building = state.buildings.find(candidate => candidate.id === buildingId)!;
  const roof = building.structureComponents!.find(component => component.kind === 'roof')!;
  const before = roof.moisture;

  state.weather.current = 'heavy_rain';
  state.weather.humidityPercent = 100;
  tickStructureEnvironment(state, 240);

  assert.ok(roof.moisture > before, 'heavy rain and humidity must increase exposed roof moisture');
  assert.ok(building.structurePerformance, 'environment tick must keep derived performance synchronized');
}

function testPersistentWetRotLowersDurabilityCeiling(): void {
  const { state, buildingId } = makeState();
  bootstrapCompletedStructureComponents(state);
  const building = state.buildings.find(candidate => candidate.id === buildingId)!;
  const roof = building.structureComponents!.find(component => component.kind === 'roof')!;
  const originalCeiling = roof.conditionMax;

  state.weather.current = 'heavy_rain';
  state.weather.humidityPercent = 100;
  roof.moisture = 96;
  // A large deterministic exposure window is intentional in this invariant test:
  // it proves permanent degradation without depending on wall-clock loops.
  tickStructureEnvironment(state, 100_000);

  assert.ok(roof.rot > 55, 'long wet exposure must accumulate meaningful organic rot');
  assert.ok(roof.conditionMax < originalCeiling, 'severe rot must lower current durability ceiling');
  assert.ok(roof.permanentDamage > 0, 'ceiling loss must be recorded as permanent component damage');
  assert.ok((building.condition || 100) < 100, 'aggregate structure condition must follow component degradation');
}

function main(): void {
  testConstructionBecomesPhysicalComponents();
  testRainRaisesRoofMoisture();
  testPersistentWetRotLowersDurabilityCeiling();
  console.log('Structure lifecycle smoke tests passed.');
}

main();