from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


path = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
s = path.read_text()

s = replace_once(
    s,
    "interface AquaticHuntTarget {\n"
    "  prey: WildAquaticPopulation;\n"
    "  preference: number;\n"
    "  searchability: number;\n"
    "  targetWeight: number;\n"
    "  waterNodeId: string;\n"
    "}\n",
    "interface AquaticHuntTarget {\n"
    "  prey: WildAquaticPopulation;\n"
    "  preference: number;\n"
    "  searchability: number;\n"
    "  refugia: number;\n"
    "  targetWeight: number;\n"
    "  waterNodeId: string;\n"
    "}\n",
    'aquatic target refugia field',
)

needle = """function aquaticStageMassMultiplier(stage: WildAnimalLifeStage): number {
  if (stage === 'juvenile') return 0.28;
  if (stage === 'old') return 0.82;
  return 1;
}

"""
insert = needle + """function aquaticRecoveryFloor(speciesId: string): number {
  const preySpecies = WILD_AQUATIC_SPECIES[speciesId];
  if (!preySpecies) return 8;
  // P3.7: slow-maturing, slow-reproducing aquatic prey need a larger
  // aggregate breeding refuge than fast forage species. This is not extra
  // reproduction; it only makes predators progressively inefficient once a
  // prey population approaches its life-history recovery floor.
  const maturityPressure = clamp01((preySpecies.maturityDays - 90) / 600);
  const lowReproductionPressure = clamp01((0.0035 - preySpecies.dailyReproductionRate) / 0.0032);
  return Math.round(7 + (maturityPressure * 0.45 + lowReproductionPressure * 0.55) * 13);
}

function aquaticRecoveryRefugia(accessiblePopulation: number, speciesId: string): number {
  const floor = aquaticRecoveryFloor(speciesId);
  if (accessiblePopulation <= floor) return 0;
  const recoveryBand = Math.max(6, floor * 0.75);
  return clamp01((accessiblePopulation - floor) / recoveryBand);
}

"""
s = replace_once(s, needle, insert, 'aquatic recovery helpers')

old = """  return rawTargets.map(entry => {
    const density = speciesDensity.get(entry.prey.speciesId)!;
    const availability = adaptivePreyAvailability(
      density.populationDensity,
      density.biomassDensity,
      communityPopulationDensity,
      communityBiomassDensity,
      density.population,
      species.minimumViablePreyCount,
    );
    return {
      prey: entry.prey,
      preference: entry.preference,
      searchability: entry.searchability,
      waterNodeId: entry.waterNodeId,
      targetWeight: entry.preference
        * entry.energeticValue
        * availability
        * (0.35 + entry.searchability * 0.65),
    };
  }).filter(entry => entry.targetWeight > 0);
}
"""
new = """  return rawTargets.map(entry => {
    const density = speciesDensity.get(entry.prey.speciesId)!;
    const recoveryFloor = aquaticRecoveryFloor(entry.prey.speciesId);
    const refugia = aquaticRecoveryRefugia(density.population, entry.prey.speciesId);
    const availability = adaptivePreyAvailability(
      density.populationDensity,
      density.biomassDensity,
      communityPopulationDensity,
      communityBiomassDensity,
      density.population,
      recoveryFloor,
    );
    const protectedSearchability = entry.searchability * Math.sqrt(refugia);
    return {
      prey: entry.prey,
      preference: entry.preference,
      searchability: protectedSearchability,
      refugia,
      waterNodeId: entry.waterNodeId,
      targetWeight: entry.preference
        * entry.energeticValue
        * availability
        * refugia
        * (0.35 + protectedSearchability * 0.65),
    };
  }).filter(entry => entry.targetWeight > 0 && entry.refugia > 0);
}
"""
s = replace_once(s, old, new, 'aquatic target life-history refugia')

s = replace_once(
    s,
    "    const encounterChance = clamp01(0.12 + target.searchability * 0.82);\n",
    "    const encounterChance = clamp01((0.12 + target.searchability * 0.82) * target.refugia);\n",
    'aquatic encounter refugia',
)

path.write_text(s)
