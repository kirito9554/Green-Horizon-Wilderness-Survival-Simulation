from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# Aggregate/bootstrap predator system: use the same resource model as discrete hunting.
path = Path('src/simulation/ecologyPredatorSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "import { ensureRegionWildFauna, ensureWildFauna } from './ecologyFaunaSystem';\n",
    "import { ensureRegionWildFauna, ensureWildFauna } from './ecologyFaunaSystem';\n"
    "import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport } from './predatorResourceAccess';\n",
    'aggregate shared-resource import',
)

s = replace_once(
    s,
    "function predatorScore(\n"
    "  system: WorldEcologyState,\n"
    "  subarea: EcologicalSubarea,\n"
    "  species: WildPredatorSpeciesDefinition,\n"
    "): number {\n"
    "  const habitat = getPredatorHabitatSuitability(subarea, species);\n"
    "  const preyBiomass = preyBiomassForPredator(system, subarea.id, species);\n"
    "  const preyScore = clamp01(preyBiomass / Math.max(1.5, species.dailyFoodKgPerAdult * 12));\n"
    "  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));\n"
    "  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 125;\n"
    "  return habitat * 0.48 + preyScore * 0.36 + water * 0.16 - humanPenalty;\n"
    "}\n",
    "function predatorScore(\n"
    "  system: WorldEcologyState,\n"
    "  subarea: EcologicalSubarea,\n"
    "  species: WildPredatorSpeciesDefinition,\n"
    "): number {\n"
    "  const habitat = getPredatorHabitatSuitability(subarea, species);\n"
    "  const foodSupport = getPredatorFoodSupport(system, [subarea.id], species, subarea.poiId);\n"
    "  const preyScore = clamp01(foodSupport.effectiveFoodBiomassKg / Math.max(1.5, species.dailyFoodKgPerAdult * 12));\n"
    "  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));\n"
    "  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 125;\n"
    "  return habitat * 0.48 + preyScore * 0.36 + water * 0.16 - humanPenalty;\n"
    "}\n",
    'aggregate predatorScore',
)

old_k = """function estimatePredatorCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const subareas = subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const areaM2 = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.25, areaM2 / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce((sum, subarea) => sum + getPredatorHabitatSuitability(subarea, species), 0) / subareas.length;
  const preyBiomass = subareas.reduce((sum, subarea) => sum + preyBiomassForPredator(system, subarea.id, species), 0);
  const preySupport = preyBiomass / Math.max(0.2, species.dailyFoodKgPerAdult * 8);
  const water = subareas.reduce((sum, subarea) => sum + clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed)), 0) / subareas.length;
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 125);
  }, 0) / subareas.length;
  return Math.max(0, Math.floor(Math.min(baseK * (0.45 + habitat * 0.95) * (0.5 + water * 0.5), preySupport * 0.75) * Math.max(0.2, disturbance)));
}
"""
new_k = """function estimatePredatorCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const subareas = subareaIds.map(id => system.subareasById[id]).filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const areaM2 = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.25, areaM2 / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce((sum, subarea) => sum + getPredatorHabitatSuitability(subarea, species), 0) / subareas.length;
  const foodSupport = getPredatorFoodSupport(system, subareaIds, species, subareas[0].poiId);
  const preySupport = foodSupport.supportedAdultEquivalents;
  const water = getPredatorAccessibleWaterRatio(state, system, subareaIds, species, subareas[0].poiId);
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 125);
  }, 0) / subareas.length;
  return Math.max(0, Math.floor(Math.min(baseK * (0.45 + habitat * 0.95) * (0.5 + water * 0.5), preySupport * 0.75) * Math.max(0.2, disturbance)));
}
"""
s = replace_once(s, old_k, new_k, 'aggregate carrying capacity')

s = replace_once(
    s,
    "  if (!current || preyBiomassForPredator(system, current.id, species) <= 0.15) return undefined;\n",
    "  if (!current || getPredatorFoodSupport(system, [current.id], species, poiId).effectiveFoodBiomassKg <= 0.15) return undefined;\n",
    'aggregate seed current food support',
)

s = replace_once(
    s,
    "      const preySupport = subareas.reduce((sum, subarea) => sum + preyBiomassForPredator(system, subarea.id, species), 0);\n"
    "      return { species, affinity, bestHabitat, preySupport, score: affinity * 0.5 + bestHabitat * 0.25 + clamp01(preySupport / 18) * 0.25 };\n",
    "      const preySupport = getPredatorFoodSupport(system, region.subareaIds, species, region.poiId).effectiveFoodBiomassKg;\n"
    "      return { species, affinity, bestHabitat, preySupport, score: affinity * 0.5 + bestHabitat * 0.25 + clamp01(preySupport / 18) * 0.25 };\n",
    'aggregate seed candidate food support',
)

s = replace_once(
    s,
    "  const waterRatio = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));\n",
    "  const waterRangeIds = [...new Set([...population.homeRangeSubareaIds, population.currentSubareaId])];\n"
    "  const waterRatio = getPredatorAccessibleWaterRatio(\n"
    "    state, system, waterRangeIds, species, population.poiId, population.currentSubareaId,\n"
    "  );\n",
    'aggregate hydration access',
)
path.write_text(s)


# Discrete predator system: same K/resource access plus shared hydrology reach.
path = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "import { REGION_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';\n",
    "",
    'discrete remove duplicated hydrology profile import',
)
s = replace_once(
    s,
    "} from './ecologyPredatorSystem';\n",
    "} from './ecologyPredatorSystem';\n"
    "import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport, predatorPoiAccess } from './predatorResourceAccess';\n",
    'discrete shared-resource import',
)

old_k_discrete = """function estimatePredatorCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const subareas = subareaIds
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const areaM2 = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.25, areaM2 / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce((sum, subarea) => sum + getPredatorHabitatSuitability(subarea, species), 0) / subareas.length;
  const preyBiomass = subareas.reduce((sum, subarea) => sum + preyBiomassForPredator(system, subarea.id, species), 0);
  const preySupport = preyBiomass / Math.max(0.2, species.dailyFoodKgPerAdult * 8);
  const water = subareas.reduce((sum, subarea) => sum + clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed)), 0) / subareas.length;
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 125);
  }, 0) / subareas.length;
  return Math.max(0, Math.floor(Math.min(baseK * (0.45 + habitat * 0.95) * (0.5 + water * 0.5), preySupport * 0.75) * Math.max(0.2, disturbance)));
}
"""
new_k_discrete = """function estimatePredatorCarryingCapacity(
  state: GameState,
  subareaIds: string[],
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const subareas = subareaIds
    .map(id => system.subareasById[id])
    .filter((entry): entry is EcologicalSubarea => Boolean(entry));
  if (!subareas.length) return 0;
  const areaM2 = subareas.reduce((sum, subarea) => sum + subarea.areaM2, 0);
  const baseK = Math.max(0.25, areaM2 / 1000 * species.baseDensityPer1000M2);
  const habitat = subareas.reduce((sum, subarea) => sum + getPredatorHabitatSuitability(subarea, species), 0) / subareas.length;
  const foodSupport = getPredatorFoodSupport(system, subareaIds, species, subareas[0].poiId);
  const preySupport = foodSupport.supportedAdultEquivalents;
  const water = getPredatorAccessibleWaterRatio(state, system, subareaIds, species, subareas[0].poiId);
  const disturbance = subareas.reduce((sum, subarea) => {
    const excess = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance);
    return sum + (1 - excess / 125);
  }, 0) / subareas.length;
  return Math.max(0, Math.floor(Math.min(baseK * (0.45 + habitat * 0.95) * (0.5 + water * 0.5), preySupport * 0.75) * Math.max(0.2, disturbance)));
}
"""
s = replace_once(s, old_k_discrete, new_k_discrete, 'discrete carrying capacity')

s = replace_once(
    s,
    "function movementScore(system: WorldEcologyState, subarea: EcologicalSubarea, species: WildPredatorSpeciesDefinition): number {\n"
    "  const habitat = getPredatorHabitatSuitability(subarea, species);\n"
    "  const preyBiomass = preyBiomassForPredator(system, subarea.id, species);\n"
    "  const preyScore = clamp01(preyBiomass / Math.max(1.5, species.dailyFoodKgPerAdult * 12));\n"
    "  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));\n"
    "  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 125;\n"
    "  return habitat * 0.48 + preyScore * 0.36 + water * 0.16 - humanPenalty - subarea.disturbance.humanPressure / 220;\n"
    "}\n",
    "function movementScore(system: WorldEcologyState, subarea: EcologicalSubarea, species: WildPredatorSpeciesDefinition): number {\n"
    "  const habitat = getPredatorHabitatSuitability(subarea, species);\n"
    "  const foodSupport = getPredatorFoodSupport(system, [subarea.id], species, subarea.poiId);\n"
    "  const preyScore = clamp01(foodSupport.effectiveFoodBiomassKg / Math.max(1.5, species.dailyFoodKgPerAdult * 12));\n"
    "  const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));\n"
    "  const humanPenalty = Math.max(0, subarea.disturbance.humanPressure - species.disturbanceTolerance) / 125;\n"
    "  return habitat * 0.48 + preyScore * 0.36 + water * 0.16 - humanPenalty - subarea.disturbance.humanPressure / 220;\n"
    "}\n",
    'discrete movement food support',
)

s = s.replace('aquaticPoiAccess(population.poiId, subarea.poiId, maxHops)', 'predatorPoiAccess(population.poiId, subarea.poiId, maxHops)')
s = s.replace('aquaticPoiAccess(population.poiId, preyPoi, reachHops)', 'predatorPoiAccess(population.poiId, preyPoi, reachHops)')

old_poi_fn = """function aquaticPoiAccess(fromPoi: MainWorldAreaId, toPoi: MainWorldAreaId, maxHops: number): number {
  if (fromPoi === toPoi) return 1;
  if (maxHops <= 0) return 0;
  const visited = new Set<MainWorldAreaId>([fromPoi]);
  let frontier: MainWorldAreaId[] = [fromPoi];
  for (let depth = 1; depth <= maxHops; depth += 1) {
    const next: MainWorldAreaId[] = [];
    for (const poiId of frontier) {
      const profile = REGION_HYDROLOGY_PROFILES[poiId];
      const neighbors = new Set<MainWorldAreaId>(profile?.downstreamPoiIds || []);
      for (const [candidateId, candidate] of Object.entries(REGION_HYDROLOGY_PROFILES) as Array<[MainWorldAreaId, typeof REGION_HYDROLOGY_PROFILES[MainWorldAreaId]]>) {
        if (candidate.downstreamPoiIds.includes(poiId)) neighbors.add(candidateId);
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

"""
s = replace_once(s, old_poi_fn, '', 'discrete duplicated aquatic POI access')

s = replace_once(
    s,
    "  const waterRatio = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));\n",
    "  const waterRangeIds = [...new Set([...population.homeRangeSubareaIds, population.currentSubareaId])];\n"
    "  const waterRatio = getPredatorAccessibleWaterRatio(\n"
    "    state, system, waterRangeIds, species, population.poiId, population.currentSubareaId,\n"
    "  );\n",
    'discrete hydration access',
)
path.write_text(s)
