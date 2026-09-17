import fs from 'node:fs';

const runtimePath = 'src/simulation/spatial/spatialPredatorRuntime.ts';
let runtime = fs.readFileSync(runtimePath, 'utf8');

runtime = runtime.replace(
  'export const SPATIAL_PREDATOR_RUNTIME_VERSION = 5;',
  'export const SPATIAL_PREDATOR_RUNTIME_VERSION = 6;',
);

const helperAnchor = [
  'function clampPredatorReserve(cohort: SpatialPredatorPatchCohortState, species: SpatialPredatorSpeciesDefinition): number {',
  '  const capacity = predatorReserveCapacityKg(cohort, species);',
  '  cohort[RESERVE] = Math.min(capacity, Math.max(0, cohort[RESERVE]));',
  '  return capacity;',
  '}',
  '',
].join('\n');

const helperAddition = [
  'export function getSpatialPredatorMinimumFounderUnits(species: SpatialPredatorSpeciesDefinition): number {',
  '  switch (species.socialMode) {',
  "    case 'family_group': return 3;",
  "    case 'breeding_pair': return 2;",
  "    case 'loose_aggregation': return 2;",
  "    case 'solitary_territory': return 3;",
  '  }',
  '}',
  '',
  'export function getSpatialPredatorMinimumViablePopulation(species: SpatialPredatorSpeciesDefinition): number {',
  '  return Math.max(species.minIslandCapacity, getSpatialPredatorMinimumFounderUnits(species) * 2);',
  '}',
  '',
  'function preferredInitialFounderUnitSize(species: SpatialPredatorSpeciesDefinition): number {',
  "  if (species.socialMode === 'family_group') return 4;",
  "  if (species.socialMode === 'loose_aggregation') return 4;",
  '  return 2;',
  '}',
  '',
  'function createInitialFounderCohort(',
  '  species: SpatialPredatorSpeciesDefinition,',
  '  count: number,',
  '  suitability: number,',
  '  reserveFraction: number,',
  '): SpatialPredatorPatchCohortState {',
  '  const extraBeyondPair = Math.max(0, count - 2);',
  '  const juveniles = Math.min(extraBeyondPair, Math.floor(count * .18));',
  '  const old = Math.min(Math.max(0, extraBeyondPair - juveniles), Math.floor(count * .08));',
  '  const adults = Math.max(2, count - juveniles - old);',
  '  const cohort: SpatialPredatorPatchCohortState = [juveniles, adults, old, .82 + suitability * .14, 0];',
  '  initializePredatorReserve(cohort, species, reserveFraction);',
  '  return cohort;',
  '}',
  '',
].join('\n');

if (!runtime.includes(helperAnchor)) throw new Error('helper insertion anchor not found');
runtime = runtime.replace(helperAnchor, helperAnchor + helperAddition);

const createStart = runtime.indexOf('export function createSpatialPredatorRuntimeState(');
const createEnd = runtime.indexOf('\ninterface PreyCandidate', createStart);
if (createStart < 0 || createEnd < 0) throw new Error('createSpatialPredatorRuntimeState block not found');

const replacement = [
  'export function createSpatialPredatorRuntimeState(world: GeneratedSpatialWorld, day = 1): SpatialPredatorRuntimeState {',
  '  const speciesStates = SPATIAL_PREDATOR_SPECIES.map(def => {',
  '    const cohortsByPatch: Record<string, SpatialPredatorPatchCohortState> = {};',
  "    if (spatialUnitRandom(world.worldSeed, 'predator-presence|' + def.id) <= def.worldPresence) {",
  '      const minimumFounderUnits = getSpatialPredatorMinimumFounderUnits(def);',
  '      const minimumViablePopulation = getSpatialPredatorMinimumViablePopulation(def);',
  '      const candidates: Array<{ patch: HabitatPatch; suitability: number; expectedContribution: number; anchorScore: number }> = [];',
  '      let expectedIslandPopulation = 0;',
  '',
  '      for (const patch of world.habitatPatches) {',
  '        const suitability = predatorSuitability(def, patch, world);',
  '        if (suitability < def.minPatchSuitability * .9) continue;',
  '        const occupancy = def.initialOccupancy[0]',
  "          + spatialUnitRandom(world.worldSeed, 'predator-occ|' + def.id + '|' + patch.id) * (def.initialOccupancy[1] - def.initialOccupancy[0]);",
  '        const densityExpectation = patch.areaKm2 * def.densityPerKm2 * Math.pow(suitability, 1.45);',
  '        const expectedContribution = suitability >= def.minPatchSuitability ? densityExpectation * occupancy : 0;',
  '        expectedIslandPopulation += expectedContribution;',
  '        const anchorScore = suitability * .55',
  '          + (1 - Math.exp(-expectedContribution * 4)) * .35',
  "          + spatialUnitRandom(world.worldSeed, 'predator-anchor|' + def.id + '|' + patch.id) * .1;",
  '        candidates.push({ patch, suitability, expectedContribution, anchorScore });',
  '      }',
  '',
  '      if (candidates.length > 0) {',
  '        const ecologicalTarget = deterministicRound(',
  '          world.worldSeed,',
  "          'predator-island-target|' + def.id,",
  '          expectedIslandPopulation,',
  '        );',
  '        const targetPopulation = Math.max(minimumViablePopulation, ecologicalTarget);',
  '        const preferredUnitSize = preferredInitialFounderUnitSize(def);',
  '        const maximumUnitCount = Math.max(1, Math.floor(targetPopulation / 2));',
  '        const desiredUnitCount = Math.min(',
  '          candidates.length,',
  '          maximumUnitCount,',
  '          Math.max(minimumFounderUnits, Math.ceil(targetPopulation / preferredUnitSize)),',
  '        );',
  '',
  '        candidates.sort((a, b) => b.anchorScore - a.anchorScore || b.expectedContribution - a.expectedContribution || a.patch.id.localeCompare(b.patch.id));',
  '        const unitSizes = Array.from({ length: desiredUnitCount }, () => 2);',
  '        let remaining = targetPopulation - desiredUnitCount * 2;',
  '        for (let cursor = 0; remaining > 0; cursor += 1) {',
  '          unitSizes[cursor % desiredUnitCount] += 1;',
  '          remaining -= 1;',
  '        }',
  '',
  '        for (let index = 0; index < desiredUnitCount; index += 1) {',
  '          const anchor = candidates[index];',
  '          const count = unitSizes[index];',
  "          const reserveFraction = .52 + spatialUnitRandom(world.worldSeed, 'predator-reserve|' + def.id + '|' + anchor.patch.id) * .18;",
  '          cohortsByPatch[anchor.patch.id] = createInitialFounderCohort(def, count, anchor.suitability, reserveFraction);',
  '        }',
  '      }',
  '    }',
  '    return { speciesId: def.id, cohortsByPatch, globalAbsenceDays: 0 };',
  '  });',
  '  const runtime: SpatialPredatorRuntimeState = {',
  '    version: SPATIAL_PREDATOR_RUNTIME_VERSION,',
  '    worldSeed: world.worldSeed,',
  '    lastProcessedDay: day,',
  '    species: speciesStates,',
  '    telemetry: {',
  "      day, season: 'dry', totalPopulation: 0, presentSpecies: 0, occupiedCohorts: 0,",
  '      preyKilled: 0, preyBiomassKilledKg: 0, carrionAddedKg: 0, births: 0, deaths: 0, moved: 0,',
  '      mateSearchMoved: 0, natalDispersed: 0, territorySettled: 0, groupSplitMoved: 0, immigrants: 0,',
  '      meanCondition: 0, unsuccessfulHunts: 0,',
  '    },',
  '  };',
  "  runtime.telemetry = summarizePredators(runtime, day, 'dry');",
  '  return runtime;',
  '}',
].join('\n');

runtime = runtime.slice(0, createStart) + replacement + runtime.slice(createEnd);

runtime = runtime.replace(
  'const minimumViable = Math.min(3, Math.max(2, predator.minIslandCapacity));',
  'const minimumViable = getSpatialPredatorMinimumViablePopulation(predator);',
);

const founderRegex = /  const founders = deterministicFounderCount\([\s\S]*?  const count = Math\.min\(founders, needed\);/;
if (!founderRegex.test(runtime)) throw new Error('recolonization founder block not found');
runtime = runtime.replace(founderRegex, [
  '  const founders = Math.max(2, deterministicFounderCount(',
  "    spatialUnitRandom(world.worldSeed, 'predator-immigration-count|' + predator.id + '|' + day),",
  '    profile.recolonizationFounderCount,',
  '  ));',
  '  const needed = Math.max(2, minimumViable - total);',
  '  const count = Math.min(founders, needed);',
].join('\n'));

fs.writeFileSync(runtimePath, runtime);

const smoke = [
  "import assert from 'node:assert/strict';",
  "import { SPATIAL_PREDATOR_SPECIES } from '../src/data/spatialPredators';",
  'import {',
  '  createSpatialPredatorRuntimeState,',
  '  getSpatialPredatorMinimumFounderUnits,',
  '  getSpatialPredatorMinimumViablePopulation,',
  "} from '../src/simulation/spatial/spatialPredatorRuntime';",
  "import { generateSpatialWorld } from '../src/simulation/spatial/worldGeneration';",
  '',
  "for (const seed of ['spatial-trophic-alpha', 'spatial-trophic-beta', 'predator-founder-gamma']) {",
  '  const world = generateSpatialWorld(seed);',
  '  const runtime = createSpatialPredatorRuntimeState(world, 1);',
  '  let present = 0;',
  '  for (const def of SPATIAL_PREDATOR_SPECIES) {',
  '    const state = runtime.species.find(entry => entry.speciesId === def.id)!;',
  '    const cohorts = Object.values(state.cohortsByPatch);',
  '    const population = cohorts.reduce((sum, cohort) => sum + cohort[0] + cohort[1] + cohort[2], 0);',
  '    if (population <= 0) continue;',
  '    present += 1;',
  '    const minimumUnits = getSpatialPredatorMinimumFounderUnits(def);',
  '    const minimumPopulation = getSpatialPredatorMinimumViablePopulation(def);',
  "    assert.ok(population >= minimumPopulation, seed + ' ' + def.name + ': population ' + population + ' below viable founder floor ' + minimumPopulation);",
  "    assert.ok(cohorts.length >= minimumUnits, seed + ' ' + def.name + ': expected at least ' + minimumUnits + ' founder units, got ' + cohorts.length);",
  '    for (const cohort of cohorts) {',
  '      const unitPopulation = cohort[0] + cohort[1] + cohort[2];',
  "      assert.ok(unitPopulation >= 2, seed + ' ' + def.name + ': initial singleton founder unit detected');",
  "      assert.ok(cohort[1] >= 2, seed + ' ' + def.name + ': founder unit must begin with at least two adults');",
  '    }',
  "    console.log('[' + seed + '] ' + def.name + ': population=' + population + ' units=' + cohorts.length + ' sizes=' + cohorts.map(c => c[0] + c[1] + c[2]).join(','));",
  '  }',
  "  assert.ok(present >= 4, seed + ': expected at least four predator species, got ' + present);",
  "  assert.ok(runtime.telemetry.totalPopulation < 400, seed + ': founder seeding unexpectedly exceeds conservative island envelope (' + runtime.telemetry.totalPopulation + ')');",
  '}',
  '',
  "console.log('spatial predator founder smoke passed');",
  '',
].join('\n');
fs.writeFileSync('scripts/spatial-predator-founder-smoke.ts', smoke);

const workflowPath = '.github/workflows/typecheck.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
const workflowAnchor = [
  '      - name: Full spatial trophic ecosystem smoke test',
  '        run: npm run test:spatial-trophic',
  '',
].join('\n');
if (!workflow.includes(workflowAnchor)) throw new Error('typecheck workflow anchor not found');
workflow = workflow.replace(workflowAnchor, [
  '      - name: Predator founder-unit smoke test',
  '        run: npx tsx scripts/spatial-predator-founder-smoke.ts',
  '',
  workflowAnchor,
].join('\n'));
fs.writeFileSync(workflowPath, workflow);

console.log('predator founder seeding patch applied');
