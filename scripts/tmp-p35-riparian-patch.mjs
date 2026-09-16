import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`missing patch anchor: ${label}`);
  return text.replace(from, to);
}

// Restore the original P3.4 fish-size data so this experiment isolates riparian access.
const aquaticPath = 'src/data/ecologyAquatic.ts';
let aquatic = readFileSync(aquaticPath, 'utf8');
for (const [from, to, label] of [
  ["id: 'AQUATIC_LAGOON_SNAPPER', name: 'Lagoon Snapper', trophicGuild: 'mesopredator', adultWeightKg: 3.2,", "id: 'AQUATIC_LAGOON_SNAPPER', name: 'Lagoon Snapper', trophicGuild: 'mesopredator', adultWeightKg: 2.2,", 'snapper mass'],
  ["id: 'AQUATIC_RIVER_CATFISH', name: 'River Catfish', trophicGuild: 'omnivore', adultWeightKg: 6.5,", "id: 'AQUATIC_RIVER_CATFISH', name: 'River Catfish', trophicGuild: 'omnivore', adultWeightKg: 3.8,", 'catfish mass'],
  ["id: 'AQUATIC_MANGROVE_MULLET', name: 'Mangrove Mullet', trophicGuild: 'omnivore', adultWeightKg: 2.1,", "id: 'AQUATIC_MANGROVE_MULLET', name: 'Mangrove Mullet', trophicGuild: 'omnivore', adultWeightKg: 1.6,", 'mullet mass'],
  ["id: 'AQUATIC_BARRAMUNDI', name: 'Barramundi', trophicGuild: 'mesopredator', adultWeightKg: 14,", "id: 'AQUATIC_BARRAMUNDI', name: 'Barramundi', trophicGuild: 'mesopredator', adultWeightKg: 7.5,", 'barramundi mass'],
]) aquatic = replaceOnce(aquatic, from, to, label);
writeFileSync(aquaticPath, aquatic);

// Add an opt-in riparian terrestrial foraging reach. Only Crocodile uses it.
const predatorDataPath = 'src/data/ecologyPredators.ts';
let predatorData = readFileSync(predatorDataPath, 'utf8');
predatorData = replaceOnce(
  predatorData,
  "  /** Maximum hydrology-network hops used while searching aquatic prey. Defaults to local POI only. */\n  aquaticForagingReachHops?: number;\n",
  "  /** Maximum hydrology-network hops used while searching aquatic prey. Defaults to local POI only. */\n  aquaticForagingReachHops?: number;\n  /** Hydrology-network hops used to ambush terrestrial prey in riparian subareas. Defaults to home range only. */\n  riparianForagingReachHops?: number;\n",
  'riparian species field',
);
predatorData = replaceOnce(
  predatorData,
  "    aquaticForagingReachHops: 2,\n    adultWeightKg: 180,",
  "    aquaticForagingReachHops: 2,\n    riparianForagingReachHops: 2,\n    adultWeightKg: 180,",
  'croc riparian reach',
);
writeFileSync(predatorDataPath, predatorData);

const huntPath = 'src/simulation/predatorDiscreteHuntingSystem.ts';
let hunt = readFileSync(huntPath, 'utf8');

hunt = replaceOnce(
  hunt,
  "function feedFromOwnedCarcasses(\n  state: GameState,\n  population: WildPredatorPopulation,\n  mealBudgetKg: number,\n): number {",
  `function riparianForagingAccess(\n  system: WorldEcologyState,\n  population: WildPredatorPopulation,\n  species: WildPredatorSpeciesDefinition,\n  subarea: EcologicalSubarea,\n): number {\n  const maxHops = Math.max(0, Math.floor(species.riparianForagingReachHops || 0));\n  if (maxHops <= 0 || subarea.environment.waterAccess < 50) return 0;\n  const poiAccess = aquaticPoiAccess(population.poiId, subarea.poiId, maxHops);\n  if (poiAccess <= 0) return 0;\n  const shoreline = clamp01((subarea.environment.waterAccess - 50) / 50);\n  const habitat = getPredatorHabitatSuitability(subarea, species);\n  return clamp01(poiAccess * (0.5 + shoreline * 0.35 + habitat * 0.15));\n}\n\nfunction feedFromOwnedCarcasses(\n  state: GameState,\n  population: WildPredatorPopulation,\n  species: WildPredatorSpeciesDefinition,\n  mealBudgetKg: number,\n): number {`,
  'riparian helper + carcass signature',
);

hunt = replaceOnce(
  hunt,
  "    .filter(carcass => homeRange.has(carcass.subareaId))\n",
  `    .filter(carcass => {\n      if (homeRange.has(carcass.subareaId)) return true;\n      const subarea = system.subareasById[carcass.subareaId];\n      return Boolean(subarea && riparianForagingAccess(system, population, species, subarea) > 0);\n    })\n`,
  'remote owned carcass access',
);

hunt = replaceOnce(
  hunt,
  "  return (system.animalPopulations || [])\n    .filter(prey => prey.population > 1 && homeRange.has(prey.currentSubareaId))\n    .map(prey => {\n      const preference = species.preyWeights[prey.speciesId] || 0;\n      const subarea = system.subareasById[prey.currentSubareaId];\n      const accessibility = preference > 0 && subarea\n        ? getPredatorHuntingAccessibility(system, population, species, prey.currentSubareaId)\n        : 0;",
  `  return (system.animalPopulations || [])\n    .filter(prey => prey.population > 1)\n    .map(prey => {\n      const preference = species.preyWeights[prey.speciesId] || 0;\n      const subarea = system.subareasById[prey.currentSubareaId];\n      const localAccessibility = preference > 0 && subarea && homeRange.has(prey.currentSubareaId)\n        ? getPredatorHuntingAccessibility(system, population, species, prey.currentSubareaId)\n        : 0;\n      const riparianAccessibility = preference > 0 && subarea && !homeRange.has(prey.currentSubareaId)\n        ? riparianForagingAccess(system, population, species, subarea)\n        : 0;\n      const accessibility = Math.max(localAccessibility, riparianAccessibility);`,
  'riparian hunt target access',
);

hunt = replaceOnce(
  hunt,
  "  let edibleKg = feedFromOwnedCarcasses(state, population, mealBudgetKg);",
  "  let edibleKg = feedFromOwnedCarcasses(state, population, species, mealBudgetKg);",
  'owned carcass call',
);
writeFileSync(huntPath, hunt);

// Tighten P5 pathology detection so a near-starving remnant cannot edge-pass at 94.x hunger.
const gatePath = 'scripts/p5-coupled-fast-gate.ts';
let gate = readFileSync(gatePath, 'utf8');
gate = replaceOnce(
  gate,
  "    if (row && row.population > 0 && row.hunger >= 95 && row.reserveRatio <= 0.03 && row.chronicStressDays >= 30) {\n      failures.push(`${row.speciesId} is trapped in near-max hunger with empty reserves and chronic stress`);\n    }",
  "    if (row && row.population > 0 && row.hunger >= 85 && row.reserveRatio <= 0.03 && row.chronicStressDays >= 60) {\n      failures.push(`${row.speciesId} is trapped in severe hunger with empty reserves and chronic stress`);\n    }\n    if (row && initial.population >= 2 && row.population <= initial.population * 0.5 && row.hunger >= 75 && row.chronicStressDays >= 60) {\n      failures.push(`${row.speciesId} lost at least half its baseline population under sustained hunger stress`);\n    }",
  'P5 severe-pathology gate',
);
writeFileSync(gatePath, gate);

// Remove temporary patch plumbing from the commit that carries the real change.
for (const path of ['scripts/tmp-p35-riparian-patch.mjs', '.github/workflows/tmp-p35-riparian-patch.yml']) {
  if (existsSync(path)) unlinkSync(path);
}
