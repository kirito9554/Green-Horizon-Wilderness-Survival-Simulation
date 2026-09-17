import { SPATIAL_INSECT_BY_ID, SPATIAL_INSECT_SPECIES, type SpatialInsectSpeciesDefinition } from '../../data/spatialInsects';
import type { EcologyTargetProfile } from '../../data/ecologyProfiles';
import type {
  SpatialFloraRuntimeState,
  SpatialInsectPatchState,
  SpatialInsectRuntimeState,
  SpatialInsectTelemetry,
} from '../../types/spatialEcologySimulation';
import type { SpatialFaunaSeason } from '../../types/spatialFaunaSimulation';
import { spatialUnitRandom } from './spatialRandom';
import type { GeneratedSpatialWorld } from './worldGeneration';
import type { HabitatPatch } from './habitatPatches';

export const SPATIAL_INSECT_RUNTIME_VERSION = 1;
const BIOMASS = 0;
const RECRUITMENT = 1;
const CONDITION = 2;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round3 = (v: number): number => Math.max(0, Math.round(v * 1000) / 1000);

function targetValue(patch: HabitatPatch, world: GeneratedSpatialWorld, key: keyof EcologyTargetProfile): number | undefined {
  const site = world.localSiteInfluenceByPatchId[patch.id];
  const hydro = world.hydrology.byPatchId[patch.id];
  if (key === 'canopy') return patch.suitability.canopy * 100;
  if (key === 'moisture') return patch.suitability.moisture * 100;
  if (key === 'waterAccess') return clamp01((hydro?.waterIndex ?? patch.suitability.aquatic) * .72 + (site?.water ?? .25) * .28) * 100;
  if (key === 'slope') return patch.terrain.slope * 100;
  if (key === 'floodRisk') return clamp01((hydro?.waterIndex ?? 0) * .72 + patch.terrain.wetness * .28) * 100;
  if (key === 'sunlight') return (1 - patch.suitability.canopy * .82) * 100;
  if (key === 'rocks') return patch.terrain.roughness * 100;
  if (key === 'fertileSoil') return clamp01(patch.suitability.forage * .62 + (site?.decomposition ?? .3) * .22 + patch.suitability.moisture * .16) * 100;
  if (key === 'vegetation') return clamp01(patch.suitability.cover * .56 + patch.suitability.forage * .28 + patch.suitability.canopy * .16) * 100;
  return undefined;
}

function floraHostSignal(flora: SpatialFloraRuntimeState | undefined, patchId: string): number {
  if (!flora) return .65;
  let biomass = 0;
  let populations = 0;
  for (const species of flora.species) {
    const state = species.patches[patchId];
    if (!state) continue;
    biomass += state[0];
    populations += 1;
  }
  return clamp01(.18 + Math.log1p(biomass) / Math.log(2_500_000) * .55 + Math.min(1, populations / 18) * .27);
}

function substrateSignal(species: SpatialInsectSpeciesDefinition, patch: HabitatPatch, world: GeneratedSpatialWorld, floraSignal: number): number {
  const site = world.localSiteInfluenceByPatchId[patch.id];
  const hydro = world.hydrology.byPatchId[patch.id];
  let total = 0;
  for (const substrate of species.substrates) {
    if (substrate === 'canopy') total += patch.suitability.canopy;
    else if (substrate === 'understory') total += patch.suitability.cover * .8 + patch.suitability.forage * .2;
    else if (substrate === 'ground') total += patch.suitability.forage * .6 + patch.suitability.cover * .25 + (1 - patch.suitability.canopy) * .15;
    else if (substrate === 'deadwood') total += clamp01((site?.decomposition ?? .35) * .7 + patch.suitability.cover * .3);
    else if (substrate === 'litter') total += clamp01((site?.decomposition ?? .35) * .55 + patch.suitability.canopy * .3 + patch.suitability.moisture * .15);
    else if (substrate === 'dung') total += clamp01(patch.suitability.forage * .55 + (site?.forage ?? .35) * .45);
    else if (substrate === 'carrion') total += clamp01((site?.predatorOpportunity ?? .25) * .6 + (site?.decomposition ?? .35) * .4);
    else if (substrate === 'flowers') total += floraSignal;
    else if (substrate === 'fruit') total += clamp01(floraSignal * .8 + (site?.resourcePotential.fruit ?? 0) * .2);
    else if (substrate === 'freshwater') total += hydro?.waterIndex ?? patch.suitability.aquatic;
    else if (substrate === 'wetland') total += clamp01(patch.terrain.wetness * .55 + patch.suitability.aquatic * .45);
  }
  return species.substrates.length ? clamp01(total / species.substrates.length) : .5;
}

export function getSpatialInsectPatchSuitability(
  species: SpatialInsectSpeciesDefinition,
  patch: HabitatPatch,
  world: GeneratedSpatialWorld,
  flora: SpatialFloraRuntimeState | undefined,
): number {
  const entries = Object.entries(species.targets) as Array<[keyof EcologyTargetProfile, number]>;
  let score = 0;
  let used = 0;
  for (const [key, target] of entries) {
    const value = targetValue(patch, world, key);
    if (value === undefined) continue;
    const tolerance = key === 'slope' ? Math.max(8, species.tolerance * .55) : Math.max(10, species.tolerance);
    score += Math.max(0, 1 - Math.abs(value - target) / tolerance);
    used += 1;
  }
  const targetFit = used ? score / used : .5;
  const affinity = species.regionAffinity[patch.parentRegionId] ?? .15;
  const host = floraHostSignal(flora, patch.id);
  const substrate = substrateSignal(species, patch, world, host);
  return clamp01(targetFit * .5 + affinity * .2 + substrate * .2 + host * .1);
}

function carryingBiomass(species: SpatialInsectSpeciesDefinition, patch: HabitatPatch, suitability: number): number {
  if (suitability < species.minPatchSuitability) return 0;
  const fit = clamp01((suitability - species.minPatchSuitability) / Math.max(.08, 1 - species.minPatchSuitability));
  return patch.areaKm2 * species.biomassKgPerKm2 * (.22 + fit * .78);
}

export function createSpatialInsectRuntimeState(
  world: GeneratedSpatialWorld,
  flora: SpatialFloraRuntimeState | undefined,
  day = 1,
): SpatialInsectRuntimeState {
  const species = SPATIAL_INSECT_SPECIES.map(def => {
    const patches: Record<string, SpatialInsectPatchState> = {};
    if (spatialUnitRandom(world.worldSeed, `insect-presence|${def.id}`) <= def.worldPresence) {
      for (const patch of world.habitatPatches) {
        const suitability = getSpatialInsectPatchSuitability(def, patch, world, flora);
        const cap = carryingBiomass(def, patch, suitability);
        if (cap <= 0) continue;
        const occupation = spatialUnitRandom(world.worldSeed, `insect-occ|${def.id}|${patch.id}`);
        if (occupation > clamp01(.55 + suitability * .42)) continue;
        const fill = .55 + spatialUnitRandom(world.worldSeed, `insect-fill|${def.id}|${patch.id}`) * .38;
        patches[patch.id] = [round3(cap * fill), .45 + suitability * .45, .78 + suitability * .18];
      }
    }
    return { speciesId: def.id, patches };
  });
  const runtime: SpatialInsectRuntimeState = {
    version: SPATIAL_INSECT_RUNTIME_VERSION,
    worldSeed: world.worldSeed,
    lastProcessedDay: day,
    species,
    telemetry: { day, season: 'dry', trackedGuilds: SPATIAL_INSECT_SPECIES.length, occupiedPopulations: 0, totalBiomassKg: 0, producedBiomassKg: 0, consumedByFaunaKg: 0, pollinationIndex: 0, decompositionIndex: 0, herbivoryIndex: 0 },
  };
  runtime.telemetry = summarizeSpatialInsects(runtime, 'dry');
  return runtime;
}

export function tickSpatialInsectsDay(
  runtime: SpatialInsectRuntimeState,
  world: GeneratedSpatialWorld,
  flora: SpatialFloraRuntimeState | undefined,
  day: number,
  season: SpatialFaunaSeason,
): SpatialInsectTelemetry {
  let producedBiomassKg = 0;
  for (const speciesState of runtime.species) {
    const species = SPATIAL_INSECT_BY_ID[speciesState.speciesId];
    if (!species) continue;
    for (const patch of world.habitatPatches) {
      const suitability = getSpatialInsectPatchSuitability(species, patch, world, flora);
      const cap = carryingBiomass(species, patch, suitability);
      let state = speciesState.patches[patch.id];
      if (!state) {
        if (cap <= 0) continue;
        const seed = spatialUnitRandom(world.worldSeed, `insect-colonize|${species.id}|${patch.id}|${day}`);
        if (seed < .001 + suitability * .003 + species.turnoverPerDay * .04) {
          speciesState.patches[patch.id] = [round3(Math.max(.01, cap * .015)), .32, .72];
        }
        continue;
      }
      if (cap <= 0) {
        state[BIOMASS] *= .96;
        state[CONDITION] *= .985;
        continue;
      }
      const fill = clamp01(state[BIOMASS] / cap);
      const seasonal = species.seasonMultiplier[season];
      const recruitment = state[BIOMASS] * species.turnoverPerDay * seasonal * state[CONDITION] * Math.max(.05, 1 - fill);
      const naturalTurnover = state[BIOMASS] * species.turnoverPerDay * (.24 + fill * .26);
      state[BIOMASS] = round3(Math.min(cap * 1.08, Math.max(cap * .0004, state[BIOMASS] + recruitment - naturalTurnover)));
      state[RECRUITMENT] = clamp01(state[RECRUITMENT] + species.turnoverPerDay * .3 * seasonal - .004);
      state[CONDITION] = clamp01(state[CONDITION] + suitability * .0015 - patch.suitability.disturbance * .0008);
      producedBiomassKg += recruitment;
    }
  }
  runtime.lastProcessedDay = day;
  runtime.telemetry = summarizeSpatialInsects(runtime, season, producedBiomassKg, 0);
  return runtime.telemetry;
}

export function getSpatialInsectBiomassByPatch(runtime: SpatialInsectRuntimeState): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const speciesState of runtime.species) for (const [patchId, state] of Object.entries(speciesState.patches)) {
    result[patchId] = (result[patchId] ?? 0) + state[BIOMASS];
  }
  return result;
}

export function getSpatialPollinationByPatch(runtime: SpatialInsectRuntimeState): Readonly<Record<string, number>> {
  const weighted: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const speciesState of runtime.species) {
    const def = SPATIAL_INSECT_BY_ID[speciesState.speciesId];
    if (!def || def.pollinationValue <= 0) continue;
    for (const [patchId, state] of Object.entries(speciesState.patches)) {
      weighted[patchId] = (weighted[patchId] ?? 0) + state[BIOMASS] * def.pollinationValue;
      total[patchId] = (total[patchId] ?? 0) + state[BIOMASS];
    }
  }
  const result: Record<string, number> = {};
  for (const patchId of Object.keys(total)) result[patchId] = clamp01(.35 + Math.log1p(weighted[patchId]) / Math.log(2500) * .65);
  return result;
}

export function consumeSpatialInsectBiomass(
  runtime: SpatialInsectRuntimeState,
  patchId: string,
  requestedKg: number,
): number {
  if (requestedKg <= 0) return 0;
  const candidates: Array<{ state: SpatialInsectPatchState; weight: number }> = [];
  let available = 0;
  for (const speciesState of runtime.species) {
    const state = speciesState.patches[patchId];
    if (!state || state[BIOMASS] <= 0) continue;
    candidates.push({ state, weight: state[BIOMASS] });
    available += state[BIOMASS];
  }
  const consumed = Math.min(requestedKg, available * .72);
  if (consumed <= 0 || available <= 0) return 0;
  for (const candidate of candidates) {
    const share = consumed * candidate.weight / available;
    candidate.state[BIOMASS] = round3(Math.max(0, candidate.state[BIOMASS] - share));
    candidate.state[CONDITION] = clamp01(candidate.state[CONDITION] - share / Math.max(1, candidate.weight) * .035);
  }
  runtime.telemetry.consumedByFaunaKg += consumed;
  return consumed;
}

export function summarizeSpatialInsects(
  runtime: SpatialInsectRuntimeState,
  season: SpatialFaunaSeason,
  producedBiomassKg = 0,
  consumedByFaunaKg = runtime.telemetry?.consumedByFaunaKg ?? 0,
): SpatialInsectTelemetry {
  let totalBiomassKg = 0;
  let occupiedPopulations = 0;
  let pollination = 0;
  let decomposition = 0;
  let herbivory = 0;
  let functionalWeight = 0;
  for (const speciesState of runtime.species) {
    const def = SPATIAL_INSECT_BY_ID[speciesState.speciesId];
    if (!def) continue;
    for (const state of Object.values(speciesState.patches)) {
      if (state[BIOMASS] <= 0) continue;
      totalBiomassKg += state[BIOMASS];
      occupiedPopulations += 1;
      pollination += state[BIOMASS] * def.pollinationValue;
      decomposition += state[BIOMASS] * def.decompositionValue;
      herbivory += state[BIOMASS] * def.herbivoryValue;
      functionalWeight += state[BIOMASS];
    }
  }
  return {
    day: runtime.lastProcessedDay,
    season,
    trackedGuilds: runtime.species.length,
    occupiedPopulations,
    totalBiomassKg,
    producedBiomassKg,
    consumedByFaunaKg,
    pollinationIndex: functionalWeight > 0 ? pollination / functionalWeight : 0,
    decompositionIndex: functionalWeight > 0 ? decomposition / functionalWeight : 0,
    herbivoryIndex: functionalWeight > 0 ? herbivory / functionalWeight : 0,
  };
}
