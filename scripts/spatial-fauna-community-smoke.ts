import assert from 'node:assert/strict';
import {
  LEGACY_SPATIAL_FAUNA_SPECIES_IDS,
  SPATIAL_FAUNA_SPECIES,
  SPATIAL_FAUNA_SPECIES_BY_ID,
} from '../src/data/spatialFauna';
import { WILD_FAUNA_SPECIES_IDS } from '../src/data/ecologyFauna';
import { MAIN_WORLD_AREA_SET } from '../src/data/mainWorldAreas';
import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';

function validateCommunity(seed: string): ReturnType<typeof generateSpatialWorld>['faunaCommunity'] {
  const world = generateSpatialWorld(seed);
  const community = world.faunaCommunity;
  const patchIds = new Set(world.habitatPatches.map(patch => patch.id));

  assert.ok(SPATIAL_FAUNA_SPECIES.length >= 24, `expanded metric catalog should contain at least 24 species; got ${SPATIAL_FAUNA_SPECIES.length}`);
  assert.equal(new Set(SPATIAL_FAUNA_SPECIES.map(species => species.id)).size, SPATIAL_FAUNA_SPECIES.length, 'spatial fauna IDs must be unique');
  assert.equal(community.catalogSpeciesCount, SPATIAL_FAUNA_SPECIES.length);
  assert.equal(community.legacyRuntimeSpeciesCount, WILD_FAUNA_SPECIES_IDS.length, 'all seven legacy runtime species should remain represented in metric census');
  assert.deepEqual([...LEGACY_SPATIAL_FAUNA_SPECIES_IDS].sort(), [...WILD_FAUNA_SPECIES_IDS].sort(), 'legacy spatial fauna bridge must cover the old fauna catalog exactly');

  assert.ok(community.presentSpeciesCount >= 18, `${seed}: a 120 km² tropical island should support a broad terrestrial community; got ${community.presentSpeciesCount}`);
  assert.ok(community.totalInitialIndividuals >= 3000, `${seed}: metric census should contain thousands of aggregate individuals; got ${community.totalInitialIndividuals}`);
  assert.ok(community.totalCarryingCapacity > community.totalInitialIndividuals, `${seed}: starting fauna should leave ecological headroom below K`);
  assert.ok(community.species.filter(species => species.initialPopulation >= 100).length >= 6, `${seed}: several small/medium fauna should exist at population-scale counts`);

  let summedK = 0;
  let summedPopulation = 0;
  for (const plan of community.species) {
    const definition = SPATIAL_FAUNA_SPECIES_BY_ID[plan.speciesId];
    assert.ok(definition, `${seed}: missing species definition ${plan.speciesId}`);
    if (!plan.present) {
      assert.equal(plan.islandCarryingCapacity, 0);
      assert.equal(plan.initialPopulation, 0);
      assert.equal(plan.patchAllocations.length, 0);
      continue;
    }

    assert.ok(plan.islandCarryingCapacity >= definition.minIslandCapacity, `${seed}: ${plan.speciesId} should only persist when island K clears its minimum viable census threshold`);
    assert.ok(plan.initialPopulation > 0 && plan.initialPopulation <= plan.islandCarryingCapacity, `${seed}: ${plan.speciesId} population must sit within K`);

    const patchK = plan.patchAllocations.reduce((sum, allocation) => sum + allocation.carryingCapacity, 0);
    const patchPopulation = plan.patchAllocations.reduce((sum, allocation) => sum + allocation.initialPopulation, 0);
    assert.equal(patchK, plan.islandCarryingCapacity, `${seed}: ${plan.speciesId} patch K must conserve island K`);
    assert.equal(patchPopulation, plan.initialPopulation, `${seed}: ${plan.speciesId} patch allocation must conserve headcount`);

    const regionK = plan.regionAllocations.reduce((sum, allocation) => sum + allocation.carryingCapacity, 0);
    const regionPopulation = plan.regionAllocations.reduce((sum, allocation) => sum + allocation.initialPopulation, 0);
    assert.equal(regionK, plan.islandCarryingCapacity, `${seed}: ${plan.speciesId} region K must conserve island K`);
    assert.equal(regionPopulation, plan.initialPopulation, `${seed}: ${plan.speciesId} region allocation must conserve headcount`);

    for (const allocation of plan.patchAllocations) {
      assert.ok(patchIds.has(allocation.patchId), `${seed}: ${plan.speciesId} references missing patch ${allocation.patchId}`);
      assert.ok(MAIN_WORLD_AREA_SET.has(allocation.regionId), `${seed}: ${plan.speciesId} entered non-canonical region ${allocation.regionId}`);
      assert.ok((definition.regionAffinity[allocation.regionId] ?? 0) > 0, `${seed}: ${plan.speciesId} allocated outside its authored regional range`);
      assert.ok(allocation.suitability >= definition.minPatchSuitability, `${seed}: ${plan.speciesId} occupied unsuitable patch ${allocation.patchId}`);
      assert.ok(allocation.initialPopulation <= allocation.carryingCapacity, `${seed}: ${plan.speciesId} patch population exceeds local K`);
    }

    summedK += plan.islandCarryingCapacity;
    summedPopulation += plan.initialPopulation;
  }

  assert.equal(summedK, community.totalCarryingCapacity, `${seed}: community K summary mismatch`);
  assert.equal(summedPopulation, community.totalInitialIndividuals, `${seed}: community population summary mismatch`);

  const top = community.species
    .filter(species => species.present)
    .sort((a, b) => b.initialPopulation - a.initialPopulation)
    .slice(0, 10)
    .map(species => `${species.name}=${species.initialPopulation}/${species.islandCarryingCapacity}`)
    .join(', ');
  console.log(`[${seed}] species=${community.presentSpeciesCount}/${community.catalogSpeciesCount} population=${community.totalInitialIndividuals} K=${community.totalCarryingCapacity}`);
  console.log(`[${seed}] top fauna: ${top}`);

  return community;
}

function main(): void {
  const alpha = validateCommunity('spatial-fauna-alpha');
  const alphaAgain = validateCommunity('spatial-fauna-alpha');
  const beta = validateCommunity('spatial-fauna-beta');

  assert.equal(alpha.signature, alphaAgain.signature, 'same world seed must reproduce identical spatial fauna census');
  assert.deepEqual(alpha.species, alphaAgain.species, 'same world seed must reproduce exact patch fauna allocation');
  assert.notEqual(alpha.signature, beta.signature, 'different seeds should produce different fauna census/topology');

  console.log('Spatial fauna metric community regression passed.');
}

main();
