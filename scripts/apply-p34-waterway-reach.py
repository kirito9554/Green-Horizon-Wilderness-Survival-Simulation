from pathlib import Path

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)

# Predator data: only crocodile gets multi-POI aquatic reach.
path = Path('src/data/ecologyPredators.ts')
text = path.read_text()
text = rep(
    text,
    "  /** Maximum share of tick maintenance demand intentionally sourced from aquatic prey. */\n  maxAquaticDietShare?: number;\n",
    "  /** Maximum share of tick maintenance demand intentionally sourced from aquatic prey. */\n  maxAquaticDietShare?: number;\n  /** Maximum hydrology-network hops used while searching aquatic prey. Defaults to local POI only. */\n  aquaticForagingReachHops?: number;\n",
    'reach field',
)
text = rep(
    text,
    "    aquaticCaptureRatePerAdultDay: 1.1,\n    maxAquaticDietShare: 0.62,\n",
    "    aquaticCaptureRatePerAdultDay: 1.1,\n    maxAquaticDietShare: 0.62,\n    aquaticForagingReachHops: 2,\n",
    'croc reach config',
)
path.write_text(text)

path = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
text = path.read_text()
text = rep(
    text,
    "import { WILD_AQUATIC_SPECIES } from '../data/ecologyAquatic';\n",
    "import { WILD_AQUATIC_SPECIES } from '../data/ecologyAquatic';\nimport { REGION_HYDROLOGY_PROFILES } from '../data/hydrologyProfiles';\n",
    'hydrology profile import',
)
anchor = "function collectAquaticHuntTargets(\n"
helper = r'''function aquaticPoiAccess(fromPoi: MainWorldAreaId, toPoi: MainWorldAreaId, maxHops: number): number {
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

'''
text = rep(text, anchor, helper + anchor, 'poi access helper')
old = """  return (system.aquaticPopulations || [])
    .filter(prey => prey.population > 3 && prey.poiIds.includes(population.poiId) && (weights[prey.speciesId] || 0) > 0)
    .map(prey => {
      const preference = weights[prey.speciesId] || 0;
      const stages = eligibleAquaticStages(prey, species);
"""
new = """  return (system.aquaticPopulations || [])
    .filter(prey => prey.population > 3 && (weights[prey.speciesId] || 0) > 0)
    .map(prey => {
      const preference = weights[prey.speciesId] || 0;
      const reachHops = Math.max(0, Math.floor(species.aquaticForagingReachHops || 0));
      const poiAccess = prey.poiIds.reduce((best, preyPoi) => Math.max(best, aquaticPoiAccess(population.poiId, preyPoi, reachHops)), 0);
      const stages = poiAccess > 0 ? eligibleAquaticStages(prey, species) : [];
"""
text = rep(text, old, new, 'aquatic target topology')
text = rep(
    text,
    "      const searchability = clamp01(Math.sqrt(abundance) * (0.55 + waterAccess * 0.45) * (0.78 + condition * 0.22));\n",
    "      const searchability = clamp01(Math.sqrt(abundance) * (0.55 + waterAccess * 0.45) * (0.78 + condition * 0.22) * poiAccess);\n",
    'searchability reach factor',
)
text = rep(
    text,
    "    poiId: predatorPopulation.poiId,\n    subareaId: predatorPopulation.currentSubareaId,\n",
    "    poiId: state.hydrologySystem?.nodesById?.[waterNodeId]?.poiId || predatorPopulation.poiId,\n    subareaId: predatorPopulation.currentSubareaId,\n",
    'aquatic carcass poi',
)
path.write_text(text)
