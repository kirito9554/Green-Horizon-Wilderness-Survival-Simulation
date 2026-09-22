import { SPATIAL_FLORA_BY_ID, SPATIAL_FLORA_SPECIES, type SpatialFloraSpeciesDefinition } from '../../data/spatialFlora';
import type { EcologyTargetProfile } from '../../data/ecologyProfiles';
import type { WildFoodResource } from '../../types/ecologySimulation';
import type {
  SpatialFloraPatchState,
  SpatialFloraRuntimeState,
  SpatialFloraTelemetry,
  SpatialPrimaryProductionSnapshot,
} from '../../types/spatialEcologySimulation';
import type { SpatialFaunaSeason } from '../../types/spatialFaunaSimulation';
import { spatialUnitRandom } from './spatialRandom';
import type { GeneratedSpatialWorld } from './worldGeneration';
import type { HabitatPatch } from './habitatPatches';

export const SPATIAL_FLORA_RUNTIME_VERSION = 1;
const BIOMASS = 0;
const PROPAGULE = 1;
const CONDITION = 2;
const SUCCESSION_DAYS = 3;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round3 = (v: number): number => Math.max(0, Math.round(v * 1000) / 1000);

export interface SpatialFloraPatchProduction {
  fruit: number;
  seeds: number;
  browse: number;
  ground_vegetation: number;
  roots_tubers: number;
  aquatic_plants: number;
}

export type SpatialFloraProductionByPatch = Readonly<Record<string, SpatialFloraPatchProduction>>;

function patchTargetValue(patch: HabitatPatch, world: GeneratedSpatialWorld, key: keyof EcologyTargetProfile): number | undefined {
  const site = world.localSiteInfluenceByPatchId[patch.id];
  const hydro = world.hydrology.byPatchId[patch.id];
  if (key === 'canopy') return patch.suitability.canopy * 100;
  if (key === 'moisture') return patch.suitability.moisture * 100;
  if (key === 'waterAccess') return clamp01((hydro?.waterIndex ?? patch.suitability.aquatic) * .72 + (site?.water ?? .25) * .28) * 100;
  if (key === 'slope') return patch.terrain.slope * 100;
  if (key === 'floodRisk') return clamp01((hydro?.waterIndex ?? 0) * .72 + patch.terrain.wetness * .28) * 100;
  if (key === 'sunlight') return (1 - patch.suitability.canopy * .82) * 100;
  if (key === 'rocks') return clamp01(patch.terrain.roughness * .75 + (patch.terrainTags.includes('rock') ? .25 : 0)) * 100;
  if (key === 'fertileSoil') return clamp01(patch.suitability.forage * .58 + patch.suitability.moisture * .2 + (1 - patch.suitability.disturbance) * .14 + (site?.decomposition ?? .3) * .08) * 100;
  if (key === 'vegetation') return clamp01(patch.suitability.cover * .52 + patch.suitability.forage * .28 + patch.suitability.canopy * .2) * 100;
  return undefined;
}

export function getSpatialFloraPatchSuitability(
  species: SpatialFloraSpeciesDefinition,
  patch: HabitatPatch,
  world: GeneratedSpatialWorld,
): number {
  const entries = Object.entries(species.targets) as Array<[keyof EcologyTargetProfile, number]>;
  let score = 0;
  let used = 0;
  for (const [key, target] of entries) {
    const value = patchTargetValue(patch, world, key);
    if (value === undefined) continue;
    const tolerance = key === 'slope' ? Math.max(8, species.tolerance * .55) : Math.max(10, species.tolerance);
    score += Math.max(0, 1 - Math.abs(value - target) / tolerance);
    used += 1;
  }
  const targetFit = used ? score / used : .5;
  const affinity = species.regionAffinity[patch.parentRegionId] ?? .12;
  const disturbance = patch.suitability.disturbance;
  const disturbanceFit = clamp01(1 - Math.max(0, disturbance - species.disturbanceTolerance) * .72);
  const site = world.localSiteInfluenceByPatchId[patch.id];
  let roleBoost = 0;
  if (species.roles.includes('fruit_source')) roleBoost += (site?.resourcePotential.fruit ?? 0) * .08;
  if (species.roles.includes('medicine')) roleBoost += (site?.resourcePotential.medicinal_plants ?? 0) * .08;
  if (species.roles.includes('wetland_structure') || species.stratum === 'aquatic' || species.stratum === 'mangrove') roleBoost += (site?.aquaticNursery ?? 0) * .07;
  return clamp01(targetFit * .66 + affinity * .24 + disturbanceFit * .1 + roleBoost);
}

function capacityKg(species: SpatialFloraSpeciesDefinition, patch: HabitatPatch, suitability: number): number {
  if (suitability < species.minPatchSuitability) return 0;
  const fit = clamp01((suitability - species.minPatchSuitability) / Math.max(.08, 1 - species.minPatchSuitability));
  return patch.areaKm2 * species.biomassKgPerKm2 * (.18 + fit * .82);
}

function emptyProduction(): SpatialFloraPatchProduction {
  return { fruit: 0, seeds: 0, browse: 0, ground_vegetation: 0, roots_tubers: 0, aquatic_plants: 0 };
}

function resourceKey(resource: WildFoodResource): keyof SpatialFloraPatchProduction | undefined {
  if (resource === 'fruit') return 'fruit';
  if (resource === 'seeds') return 'seeds';
  if (resource === 'browse') return 'browse';
  if (resource === 'ground_vegetation') return 'ground_vegetation';
  if (resource === 'roots_tubers') return 'roots_tubers';
  if (resource === 'aquatic_plants') return 'aquatic_plants';
  return undefined;
}

function productionFromState(
  species: SpatialFloraSpeciesDefinition,
  state: SpatialFloraPatchState,
  season: SpatialFaunaSeason,
  pollination: number,
): SpatialFloraPatchProduction {
  const out = emptyProduction();
  const biomass = state[BIOMASS];
  if (biomass <= 0) return out;
  const turnover = Math.min(species.maxAnnualTurnover / 365, Math.max(species.growthPerDay * 1.8, .00005));
  const seasonal = species.seasonProduction[season];
  const condition = .4 + state[CONDITION] * .6;
  const pollinatorFactor = species.roles.includes('pollinator_host') || species.roles.includes('fruit_source')
    ? .55 + clamp01(pollination) * .45
    : 1;
  const dailyNewBiomass = biomass * turnover * seasonal * condition;
  for (const [rawResource, fraction] of Object.entries(species.resourceAllocation)) {
    const key = resourceKey(rawResource as WildFoodResource);
    if (!key || !fraction) continue;
    const reproductive = key === 'fruit' || key === 'seeds' ? pollinatorFactor : 1;
    out[key] += dailyNewBiomass * fraction * reproductive;
  }
  return out;
}

export function createSpatialFloraRuntimeState(world: GeneratedSpatialWorld, day = 1): SpatialFloraRuntimeState {
  const speciesStates = SPATIAL_FLORA_SPECIES.map(species => {
    const patches: Record<string, SpatialFloraPatchState> = {};
    const presentWorld = spatialUnitRandom(world.worldSeed, `flora-presence|${species.id}`) <= species.worldPresence;
    if (presentWorld) {
      for (const patch of world.habitatPatches) {
        const suitability = getSpatialFloraPatchSuitability(species, patch, world);
        const cap = capacityKg(species, patch, suitability);
        if (cap <= 0) continue;
        const occupation = spatialUnitRandom(world.worldSeed, `flora-occ|${species.id}|${patch.id}`);
        const establishment = clamp01(.38 + suitability * .56);
        if (occupation > establishment) continue;
        const fill = .58 + spatialUnitRandom(world.worldSeed, `flora-fill|${species.id}|${patch.id}`) * .34;
        const propagule = .35 + spatialUnitRandom(world.worldSeed, `flora-seed|${species.id}|${patch.id}`) * .55;
        patches[patch.id] = [round3(cap * fill), propagule, .78 + suitability * .18, Math.floor(spatialUnitRandom(world.worldSeed, `flora-age|${species.id}|${patch.id}`) * 3650)];
      }
    }
    return { speciesId: species.id, patches };
  });
  const runtime: SpatialFloraRuntimeState = {
    version: SPATIAL_FLORA_RUNTIME_VERSION,
    worldSeed: world.worldSeed,
    lastProcessedDay: day,
    species: speciesStates,
    telemetry: { day, season: 'dry', trackedSpecies: SPATIAL_FLORA_SPECIES.length, occupiedPopulations: 0, totalBiomassKg: 0, fruitProductionKg: 0, seedProductionKg: 0, browseProductionKg: 0, groundProductionKg: 0, rootProductionKg: 0, aquaticPlantProductionKg: 0, colonizedPatches: 0, localExtirpations: 0 },
  };
  runtime.telemetry = summarizeSpatialFlora(runtime, world, 'dry');
  return runtime;
}

function neighboringPropagulePressure(runtime: SpatialFloraRuntimeState, speciesId: string, patchId: string, world: GeneratedSpatialWorld): number {
  const state = runtime.species.find(entry => entry.speciesId === speciesId);
  if (!state) return 0;
  let pressure = 0;
  for (const edge of world.routeGraph.edgesByPatchId[patchId] ?? []) {
    const source = state.patches[edge.toPatchId];
    if (!source || source[BIOMASS] <= 0) continue;
    const distanceFactor = Math.max(0, 1 - edge.distanceMeters / 1600);
    pressure = Math.max(pressure, source[PROPAGULE] * distanceFactor);
  }
  return pressure;
}

export function tickSpatialFloraDay(
  runtime: SpatialFloraRuntimeState,
  world: GeneratedSpatialWorld,
  day: number,
  season: SpatialFaunaSeason,
  pollinationByPatch: Readonly<Record<string, number>> = {},
): SpatialFloraTelemetry {
  let colonizedPatches = 0;
  let localExtirpations = 0;
  for (const speciesState of runtime.species) {
    const species = SPATIAL_FLORA_BY_ID[speciesState.speciesId];
    if (!species) continue;
    for (const patch of world.habitatPatches) {
      const suitability = getSpatialFloraPatchSuitability(species, patch, world);
      const cap = capacityKg(species, patch, suitability);
      let state = speciesState.patches[patch.id];
      if (!state) {
        if (cap <= 0) continue;
        const pressure = neighboringPropagulePressure(runtime, species.id, patch.id, world);
        const latent = spatialUnitRandom(world.worldSeed, `flora-colonize|${species.id}|${patch.id}|${day}`);
        const probability = clamp01(.0004 + pressure * species.seedDispersalMeters / 900 * .0025 + suitability * .0007);
        if (latent < probability) {
          state = [round3(Math.max(1, cap * .0025)), .14, .68, 0];
          speciesState.patches[patch.id] = state;
          colonizedPatches += 1;
        }
        continue;
      }
      if (cap <= 0) {
        state[CONDITION] *= .985;
        state[BIOMASS] *= .996;
      } else {
        const fill = clamp01(state[BIOMASS] / cap);
        const seasonFactor = species.seasonProduction[season];
        const growth = state[BIOMASS] * species.growthPerDay * seasonFactor * state[CONDITION] * Math.max(.04, 1 - fill);
        const backgroundLoss = state[BIOMASS] * (species.maxAnnualTurnover / 365) * (.2 + fill * .22);
        state[BIOMASS] = round3(Math.min(cap * 1.05, Math.max(cap * .00025, state[BIOMASS] + growth - backgroundLoss)));
        const pollination = pollinationByPatch[patch.id] ?? .72;
        const reproductive = species.roles.includes('pollinator_host') ? .65 + pollination * .35 : 1;
        state[PROPAGULE] = clamp01(state[PROPAGULE] + species.growthPerDay * 2.2 * reproductive - .0006);
        state[CONDITION] = clamp01(state[CONDITION] + .0012 * suitability - patch.suitability.disturbance * .0007);
      }
      state[SUCCESSION_DAYS] += 1;
      if (state[BIOMASS] < 1 && state[PROPAGULE] < .08) {
        delete speciesState.patches[patch.id];
        localExtirpations += 1;
      }
    }
  }
  runtime.lastProcessedDay = day;
  runtime.telemetry = summarizeSpatialFlora(runtime, world, season, pollinationByPatch, colonizedPatches, localExtirpations);
  return runtime.telemetry;
}

export function getSpatialFloraProductionByPatch(
  runtime: SpatialFloraRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
  pollinationByPatch: Readonly<Record<string, number>> = {},
): SpatialFloraProductionByPatch {
  const out: Record<string, SpatialFloraPatchProduction> = {};
  for (const patch of world.habitatPatches) out[patch.id] = emptyProduction();
  for (const speciesState of runtime.species) {
    const species = SPATIAL_FLORA_BY_ID[speciesState.speciesId];
    if (!species) continue;
    for (const [patchId, state] of Object.entries(speciesState.patches)) {
      const production = productionFromState(species, state, season, pollinationByPatch[patchId] ?? .72);
      const target = out[patchId] ?? (out[patchId] = emptyProduction());
      target.fruit += production.fruit;
      target.seeds += production.seeds;
      target.browse += production.browse;
      target.ground_vegetation += production.ground_vegetation;
      target.roots_tubers += production.roots_tubers;
      target.aquatic_plants += production.aquatic_plants;
    }
  }
  return out;
}

export function applySpatialFloraConsumption(
  runtime: SpatialFloraRuntimeState,
  patchId: string,
  resource: keyof SpatialFloraPatchProduction,
  consumedKg: number,
): number {
  if (consumedKg <= 0) return 0;
  const candidates: Array<{ state: SpatialFloraPatchState; species: SpatialFloraSpeciesDefinition; weight: number }> = [];
  let totalWeight = 0;
  for (const speciesState of runtime.species) {
    const state = speciesState.patches[patchId];
    const species = SPATIAL_FLORA_BY_ID[speciesState.speciesId];
    if (!state || !species) continue;
    const allocationKey = resource === 'ground_vegetation' ? 'ground_vegetation' : resource as WildFoodResource;
    const allocation = species.resourceAllocation[allocationKey] ?? 0;
    if (allocation <= 0) continue;
    const weight = state[BIOMASS] * allocation;
    candidates.push({ state, species, weight });
    totalWeight += weight;
  }
  if (totalWeight <= 0) return 0;
  let applied = 0;
  for (const candidate of candidates) {
    const share = consumedKg * candidate.weight / totalWeight;
    const destructiveFraction = resource === 'browse' ? .26 : resource === 'ground_vegetation' ? .22 : resource === 'roots_tubers' ? .55 : resource === 'aquatic_plants' ? .3 : .025;
    const biomassLoss = Math.min(candidate.state[BIOMASS] * .12, share * destructiveFraction);
    candidate.state[BIOMASS] = round3(Math.max(0, candidate.state[BIOMASS] - biomassLoss));
    if (resource === 'fruit' || resource === 'seeds') candidate.state[PROPAGULE] = clamp01(candidate.state[PROPAGULE] - share / Math.max(1, candidate.state[BIOMASS]) * .08);
    candidate.state[CONDITION] = clamp01(candidate.state[CONDITION] - biomassLoss / Math.max(1, candidate.state[BIOMASS]) * .04);
    applied += share;
  }
  return applied;
}

export function summarizeSpatialFlora(
  runtime: SpatialFloraRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
  pollinationByPatch: Readonly<Record<string, number>> = {},
  colonizedPatches = 0,
  localExtirpations = 0,
): SpatialFloraTelemetry {
  const production = getSpatialFloraProductionByPatch(runtime, world, season, pollinationByPatch);
  let totalBiomassKg = 0;
  let occupiedPopulations = 0;
  for (const speciesState of runtime.species) for (const state of Object.values(speciesState.patches)) {
    totalBiomassKg += state[BIOMASS];
    if (state[BIOMASS] > 0) occupiedPopulations += 1;
  }
  let fruitProductionKg = 0;
  let seedProductionKg = 0;
  let browseProductionKg = 0;
  let groundProductionKg = 0;
  let rootProductionKg = 0;
  let aquaticPlantProductionKg = 0;
  for (const entry of Object.values(production)) {
    fruitProductionKg += entry.fruit;
    seedProductionKg += entry.seeds;
    browseProductionKg += entry.browse;
    groundProductionKg += entry.ground_vegetation;
    rootProductionKg += entry.roots_tubers;
    aquaticPlantProductionKg += entry.aquatic_plants;
  }
  return { day: runtime.lastProcessedDay, season, trackedSpecies: runtime.species.length, occupiedPopulations, totalBiomassKg, fruitProductionKg, seedProductionKg, browseProductionKg, groundProductionKg, rootProductionKg, aquaticPlantProductionKg, colonizedPatches, localExtirpations };
}

export function getSpatialPrimaryProductionSnapshot(
  flora: SpatialFloraRuntimeState,
  world: GeneratedSpatialWorld,
  season: SpatialFaunaSeason,
  insectBiomassByPatch: Readonly<Record<string, number>> = {},
  pollinationByPatch: Readonly<Record<string, number>> = {},
): SpatialPrimaryProductionSnapshot {
  const production = getSpatialFloraProductionByPatch(flora, world, season, pollinationByPatch);
  const byPatchId: SpatialPrimaryProductionSnapshot['byPatchId'] = {};
  for (const patch of world.habitatPatches) {
    const p = production[patch.id] ?? emptyProduction();
    byPatchId[patch.id] = { fruit: p.fruit, seeds: p.seeds, browse: p.browse, groundVegetation: p.ground_vegetation, rootsTubers: p.roots_tubers, aquaticPlants: p.aquatic_plants, insectBiomassKg: insectBiomassByPatch[patch.id] ?? 0 };
  }
  return { byPatchId };
}
