import type { GameState } from '../types';
import type {
  EcologicalSubarea,
  WildFoodResource,
  WorldEcologyState,
} from '../types/ecologySimulation';
import type { MainWorldAreaId } from '../data/mainWorldAreas';
import type { WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import { REGION_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export interface PredatorFoodSupport {
  terrestrialBiomassKg: number;
  aquaticBiomassKg: number;
  supplementalBiomassKg: number;
  effectiveFoodBiomassKg: number;
  supportedAdultEquivalents: number;
}

/**
 * Shared POI-level hydrology reach used by both hunting and demography. Keeping
 * this in one place prevents aquatic hunting from seeing a food web that
 * carrying-capacity and movement logic consider unreachable.
 */
export function predatorPoiAccess(fromPoi: MainWorldAreaId, toPoi: MainWorldAreaId, maxHops: number): number {
  if (fromPoi === toPoi) return 1;
  if (maxHops <= 0) return 0;
  const visited = new Set<MainWorldAreaId>([fromPoi]);
  let frontier: MainWorldAreaId[] = [fromPoi];
  for (let depth = 1; depth <= maxHops; depth += 1) {
    const next: MainWorldAreaId[] = [];
    for (const poiId of frontier) {
      const profile = REGION_HYDROLOGY_PROFILES[poiId];
      const neighbors = new Set<MainWorldAreaId>(profile?.downstreamPoiIds || []);
      for (const [candidateId, candidate] of Object.entries(REGION_HYDROLOGY_PROFILES) as Array<[
        MainWorldAreaId,
        typeof REGION_HYDROLOGY_PROFILES[MainWorldAreaId],
      ]>) {
        if ((candidate?.downstreamPoiIds || []).includes(poiId)) neighbors.add(candidateId);
      }
      for (const neighbor of neighbors) {
        if (neighbor === toPoi) return Math.pow(0.76, depth);
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return 0;
}

function subareasFromIds(system: WorldEcologyState, subareaIds: string[]): EcologicalSubarea[] {
  return subareaIds
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
}

function supplementalAvailableKg(
  system: WorldEcologyState,
  subarea: EcologicalSubarea,
  resource: WildFoodResource,
): number {
  if (resource === 'fruit') {
    if (subarea.materializationState === 'materialized') {
      return (system.plantPopulations || [])
        .filter(plant => plant.subareaId === subarea.id)
        .reduce((sum, plant) => sum + Math.max(0, plant.fruitBiomassKg), 0);
    }
    const areaFactor = Math.max(0.2, subarea.areaM2 / 100);
    return Math.max(0, subarea.resources.fruitPotential * areaFactor * 0.035);
  }
  if (resource === 'insects') return Math.max(0, subarea.foodWeb?.insectBiomassKg || 0);
  if (resource === 'carrion') {
    return (system.wildCarcasses || [])
      .filter(carcass => carcass.subareaId === subarea.id)
      .filter(carcass => carcass.freshness >= 5 && carcass.remainingEdibleKg > 0)
      .reduce((sum, carcass) => sum + carcass.remainingEdibleKg, 0);
  }
  return 0;
}

/**
 * Resource support mirrors the realms the discrete hunter can actually use.
 * Values intentionally stay on the old carrying-capacity biomass scale: diet
 * shares discount aquatic/supplemental pools instead of inventing new K tuning.
 */
export function getPredatorFoodSupport(
  system: WorldEcologyState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
  originPoiId: MainWorldAreaId,
): PredatorFoodSupport {
  const subareas = subareasFromIds(system, subareaIds);
  const allowedSubareas = new Set(subareas.map(subarea => subarea.id));

  const terrestrialBiomassKg = (system.animalPopulations || [])
    .filter(prey => prey.population > 0 && allowedSubareas.has(prey.currentSubareaId))
    .reduce((sum, prey) => sum + prey.biomassKg * (species.preyWeights[prey.speciesId] || 0), 0);

  const wetAccess = subareas.reduce(
    (best, subarea) => Math.max(best, clamp01(((subarea.environment.waterAccess || 0) - 20) / 75)),
    0,
  );
  const aquaticWeights = species.aquaticPreyWeights || {};
  const aquaticShare = clamp01(species.maxAquaticDietShare || 0);
  const aquaticReach = Math.max(0, Math.floor(species.aquaticForagingReachHops || 0));
  const aquaticBiomassKg = aquaticShare <= 0 || wetAccess <= 0
    ? 0
    : (system.aquaticPopulations || []).reduce((sum, prey) => {
        const preference = aquaticWeights[prey.speciesId] || 0;
        if (preference <= 0 || prey.population <= 0) return sum;
        const poiAccess = prey.poiIds.reduce(
          (best, preyPoi) => Math.max(best, predatorPoiAccess(originPoiId, preyPoi, aquaticReach)),
          0,
        );
        return sum + prey.biomassKg * preference * poiAccess * wetAccess * aquaticShare;
      }, 0);

  const supplementalDiet = species.supplementalDiet || {};
  const supplementalShare = clamp01(species.maxSupplementalDietShare || 0);
  const supplementalEntries = Object.entries(supplementalDiet) as Array<[WildFoodResource, number]>;
  const totalSupplementalWeight = supplementalEntries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  const supplementalBiomassKg = supplementalShare <= 0 || totalSupplementalWeight <= 0
    ? 0
    : subareas.reduce((sum, subarea) => {
        const weighted = supplementalEntries.reduce((resourceSum, [resource, weight]) => {
          if (weight <= 0) return resourceSum;
          return resourceSum + supplementalAvailableKg(system, subarea, resource) * (weight / totalSupplementalWeight);
        }, 0);
        return sum + weighted * supplementalShare;
      }, 0);

  const effectiveFoodBiomassKg = Math.max(0, terrestrialBiomassKg + aquaticBiomassKg + supplementalBiomassKg);
  const supportedAdultEquivalents = effectiveFoodBiomassKg / Math.max(0.2, species.dailyFoodKgPerAdult * 8);
  return {
    terrestrialBiomassKg: round3(terrestrialBiomassKg),
    aquaticBiomassKg: round3(aquaticBiomassKg),
    supplementalBiomassKg: round3(supplementalBiomassKg),
    effectiveFoodBiomassKg: round3(effectiveFoodBiomassKg),
    supportedAdultEquivalents: round3(supportedAdultEquivalents),
  };
}

/**
 * Hydration is a home-range resource, not a property of the exact resting tile.
 * Live hydrology can satisfy access when a population can reach an active water
 * node/cell in its POI network; dry or inactive networks do not receive a boost.
 */
export function getPredatorAccessibleWaterRatio(
  state: GameState,
  system: WorldEcologyState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
  originPoiId: MainWorldAreaId,
  currentSubareaId?: string,
): number {
  const subareas = subareasFromIds(system, subareaIds);
  const denominator = Math.max(20, species.dailyWaterNeed);
  let surfaceAccess = 0;
  for (const subarea of subareas) {
    const direct = clamp01((subarea.environment.waterAccess || 0) / denominator);
    const access = subarea.id === currentSubareaId ? direct : direct * 0.9;
    surfaceAccess = Math.max(surfaceAccess, access);
  }

  const hydrology = state.hydrologySystem;
  if (!hydrology) return round3(surfaceAccess);

  const reachHops = Math.max(
    0,
    Math.floor(species.aquaticForagingReachHops || 0),
    Math.floor(species.riparianForagingReachHops || 0),
  );
  let networkAccess = 0;
  for (const node of Object.values(hydrology.nodesById || {})) {
    if (!node?.active) continue;
    const hasWater = node.storageM3 > 0.01 || node.waterLevelM > 0.01 || node.inflowM3H > 0.01 || node.outflowM3H > 0.01;
    if (!hasWater) continue;
    networkAccess = Math.max(networkAccess, predatorPoiAccess(originPoiId, node.poiId, reachHops));
  }
  for (const cell of Object.values(hydrology.cellStatesById || {})) {
    if (!cell || cell.reliableWaterAccess <= 0) continue;
    const poiAccess = predatorPoiAccess(originPoiId, cell.poiId, reachHops);
    networkAccess = Math.max(networkAccess, poiAccess * clamp01(cell.reliableWaterAccess / 100));
  }

  return round3(Math.max(surfaceAccess, networkAccess));
}
