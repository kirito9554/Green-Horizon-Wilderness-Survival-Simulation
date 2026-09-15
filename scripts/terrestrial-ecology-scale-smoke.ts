import assert from 'node:assert/strict';
import type { GameState } from '../src/types';
import { INITIAL_GAME_STATE } from '../src/simulation/simEngine';
import {
  discoverEcologySubarea,
  ensureRegionEcology,
} from '../src/simulation/ecologySystem';
import {
  ensureRegionWildFauna,
  promoteWildAnimalIndividual,
} from '../src/simulation/ecologyFaunaSystem';
import {
  finalizeTerrestrialEcologyScale,
  getEffectiveTerrestrialAreaM2,
  getExpectedLocallyAvailableAnimals,
  getLocalAccessiblePlantBiomassKg,
  getTerrestrialEcologicalRepresentationScale,
  getTerrestrialLocalAccessFraction,
  prepareTerrestrialEcologyScale,
  reconcileTerrestrialEcologyScale,
} from '../src/simulation/terrestrialEcologyScaleSystem';

function fresh(seed = 'terrestrial-scale-smoke'): GameState {
  const state = JSON.parse(JSON.stringify(INITIAL_GAME_STATE)) as GameState;
  if (state.buildingSimulation) state.buildingSimulation.worldSeed = seed;
  return state;
}

function totalPlantBiomass(state: GameState, subareaId: string): number {
  return (state.ecologySystem?.plantPopulations || [])
    .filter(population => population.subareaId === subareaId)
    .reduce((sum, population) => sum + population.biomassKg, 0);
}

function testPhysicalAreaAndEffectiveAreaAreSeparate(): void {
  const state = fresh('area-separation');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE');
  assert.ok(region?.subareaIds.length, 'forest region must materialize ecological subareas');
  const subarea = state.ecologySystem!.subareasById[region!.subareaIds[0]];
  const physicalArea = subarea.areaM2;
  const scale = getTerrestrialEcologicalRepresentationScale(subarea);
  assert.ok(scale >= 4 && scale <= 12, 'terrestrial representation scale must stay bounded');
  assert.ok(getEffectiveTerrestrialAreaM2(subarea) > physicalArea * 3.9, 'effective ecological area must be larger than the visible BuildGrid sample');
  assert.ok(getTerrestrialLocalAccessFraction(subarea) < 0.26, 'one local sample must expose only a minority of regional ecological stock');

  const snapshot = prepareTerrestrialEcologyScale(state);
  assert.ok(subarea.areaM2 > physicalArea, 'terrestrial ecology pass must temporarily see effective area');
  finalizeTerrestrialEcologyScale(state, snapshot);
  assert.equal(subarea.areaM2, physicalArea, 'physical subarea footprint must be restored exactly after ecology simulation');
}

function testLegacyPlantStockScalesOnceAndLocalAccessRemainsSmall(): void {
  const state = fresh('flora-scale-once');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  const subarea = discoverEcologySubarea(state, region.subareaIds[0])!;
  const physicalArea = subarea.areaM2;
  const before = totalPlantBiomass(state, subarea.id);
  assert.ok(before > 0, 'materialized terrestrial habitat must contain plant biomass');

  const firstSnapshot = prepareTerrestrialEcologyScale(state);
  const afterUpgrade = totalPlantBiomass(state, subarea.id);
  assert.ok(afterUpgrade > before * 3.5, 'old local-sample flora must be reconciled to regional ecological stock');
  const plant = state.ecologySystem!.plantPopulations.find(population => population.subareaId === subarea.id)!;
  const accessible = getLocalAccessiblePlantBiomassKg(state, plant);
  assert.ok(accessible > 0 && accessible < plant.biomassKg * 0.3, 'local harvesting must expose only the local share of regional plant biomass');
  finalizeTerrestrialEcologyScale(state, firstSnapshot);
  assert.equal(subarea.areaM2, physicalArea);

  const stableBiomass = totalPlantBiomass(state, subarea.id);
  const secondSnapshot = prepareTerrestrialEcologyScale(state);
  finalizeTerrestrialEcologyScale(state, secondSnapshot);
  assert.ok(Math.abs(totalPlantBiomass(state, subarea.id) - stableBiomass) < 0.001, 'scale reconciliation must be idempotent and never multiply stock every tick');

  const reloaded = JSON.parse(JSON.stringify(state)) as GameState;
  const reloadBefore = totalPlantBiomass(reloaded, subarea.id);
  const reloadSnapshot = prepareTerrestrialEcologyScale(reloaded);
  finalizeTerrestrialEcologyScale(reloaded, reloadSnapshot);
  assert.ok(Math.abs(totalPlantBiomass(reloaded, subarea.id) - reloadBefore) < 0.001, 'scale markers must survive save/load JSON roundtrips');
}

function testRegionalFaunaIsLargerThanOneLocalEncounter(): void {
  const state = fresh('fauna-regional-stock');
  const region = ensureRegionEcology(state, 'AREA_FOREST_EDGE')!;
  discoverEcologySubarea(state, region.subareaIds[0]);

  const snapshot = prepareTerrestrialEcologyScale(state);
  const seeded = ensureRegionWildFauna(state, region.poiId);
  assert.ok(seeded.length > 0, 'suitable rainforest habitat must seed at least one wild fauna population');
  const beforeReconcile = Math.max(...seeded.map(population => population.population));
  reconcileTerrestrialEcologyScale(state);
  const largest = [...seeded].sort((a, b) => b.population - a.population)[0];
  assert.ok(largest.population >= beforeReconcile, 'regional reconciliation must not shrink founder populations');
  assert.ok(largest.population >= 3, 'regional stock must contain more than a trivial one-encounter population');
  const locallyExpected = getExpectedLocallyAvailableAnimals(state, largest);
  assert.ok(locallyExpected < largest.population * 0.3, 'a local encounter must not expose the whole regional fauna population');
  finalizeTerrestrialEcologyScale(state, snapshot);

  const beforePromotion = largest.population;
  const individual = promoteWildAnimalIndividual(state, largest.id);
  assert.ok(individual, 'aggregate fauna must still be materializable into a real individual');
  assert.equal(largest.population, beforePromotion - 1, 'materializing one real animal must conserve regional headcount exactly');
  assert.ok(1 / beforePromotion < 0.5, 'one ordinary encounter must not remove most of a regional population');
}

function testEffectiveAreaDoesNotLeakIntoPersistentGeometry(): void {
  const state = fresh('no-area-leak');
  const region = ensureRegionEcology(state, 'AREA_BAMBOO_GROVE')!;
  const physicalAreas = new Map(region.subareaIds.map(id => [id, state.ecologySystem!.subareasById[id].areaM2]));
  const snapshot = prepareTerrestrialEcologyScale(state);
  reconcileTerrestrialEcologyScale(state);
  finalizeTerrestrialEcologyScale(state, snapshot);
  for (const [id, physicalArea] of physicalAreas) {
    assert.equal(state.ecologySystem!.subareasById[id].areaM2, physicalArea, 'effective simulation area must never overwrite persistent BuildGrid-derived geometry');
  }
}

function main(): void {
  testPhysicalAreaAndEffectiveAreaAreSeparate();
  testLegacyPlantStockScalesOnceAndLocalAccessRemainsSmall();
  testRegionalFaunaIsLargerThanOneLocalEncounter();
  testEffectiveAreaDoesNotLeakIntoPersistentGeometry();
  console.log('terrestrial ecology scale smoke: ok');
}

main();
