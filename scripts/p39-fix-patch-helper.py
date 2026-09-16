from pathlib import Path

p = Path('scripts/p39-apply-life-history-demography.py')
s = p.read_text()

faulty = '''s = replace_once(
    s,
    "  const population = Math.max(1, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * (0.36 + random() * 0.36)))));\\n",
    "  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);\\n  const demographicMinimum = carryingCapacity >= 2 && species.maxInitialPopulation >= 2 ? 2 : 1;\\n  const population = Math.max(demographicMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * initialPopulationFraction(reproduction, random)))));\\n",
    'predator initial population',
)
'''
if faulty not in s:
    raise SystemExit('faulty discrete bootstrap block not found')
s = s.replace(faulty, '', 1)

marker = "# ---------------- predator simulation ----------------\n"
if marker not in s:
    raise SystemExit('predator simulation marker not found')
bootstrap = '''# ---------------- predator bootstrap ----------------
path = Path('src/simulation/ecologyPredatorSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport } from './predatorResourceAccess';\\n",
    "import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport } from './predatorResourceAccess';\\nimport { initialPopulationFraction, resolveReproductionProfile } from './ecologyDemographySystem';\\n",
    'predator bootstrap helper import',
)
s = replace_once(
    s,
    "  const population = Math.max(1, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * (0.36 + random() * 0.36)))));\\n",
    "  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);\\n  const demographicMinimum = carryingCapacity >= 2 && species.maxInitialPopulation >= 2 ? 2 : 1;\\n  const population = Math.max(demographicMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * initialPopulationFraction(reproduction, random)))));\\n",
    'predator initial population',
)
path.write_text(s)

'''
s = s.replace(marker, bootstrap + marker, 1)
p.write_text(s)
