from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# ---------------- fauna definitions ----------------
path = Path('src/data/ecologyFauna.ts')
s = path.read_text()
s = replace_once(
    s,
    "import type { WildFoodResource } from '../types/ecologySimulation';\n",
    "import type { WildFoodResource } from '../types/ecologySimulation';\nimport type { EcologyReproductionProfile } from './ecologyDemography';\n",
    'fauna demography import',
)
s = replace_once(
    s,
    "  offspringPerAdultFemalePerYear: number;\n",
    "  offspringPerAdultFemalePerYear: number;\n  reproduction?: EcologyReproductionProfile;\n",
    'fauna reproduction field',
)
fauna_profiles = {
    "maturityDays: 300, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 3.2,": "maturityDays: 300, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 3.2,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 1.2, minOffspringPerEvent: 4, maxOffspringPerEvent: 7, juvenileRecruitmentRate: 0.62, lowPopulationRecoveryBoost: 0.55, overcrowdingSuppressionStart: 0.86, criticalMortalityBuffer: 0.30, initialPopulationMinFraction: 0.50, initialPopulationMaxFraction: 0.78 },",
    "maturityDays: 330, maxAgeDays: 4380, offspringPerAdultFemalePerYear: 1.7,": "maturityDays: 330, maxAgeDays: 4380, offspringPerAdultFemalePerYear: 1.7,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 1.1, minOffspringPerEvent: 1, maxOffspringPerEvent: 2, juvenileRecruitmentRate: 0.82, lowPopulationRecoveryBoost: 0.45, overcrowdingSuppressionStart: 0.84, criticalMortalityBuffer: 0.30, initialPopulationMinFraction: 0.50, initialPopulationMaxFraction: 0.78 },",
    "maturityDays: 180, maxAgeDays: 2190, offspringPerAdultFemalePerYear: 3.5,": "maturityDays: 180, maxAgeDays: 2190, offspringPerAdultFemalePerYear: 3.5,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 2.2, minOffspringPerEvent: 1, maxOffspringPerEvent: 3, juvenileRecruitmentRate: 0.78, lowPopulationRecoveryBoost: 0.75, overcrowdingSuppressionStart: 0.82, criticalMortalityBuffer: 0.35, initialPopulationMinFraction: 0.55, initialPopulationMaxFraction: 0.82 },",
    "maturityDays: 260, maxAgeDays: 2920, offspringPerAdultFemalePerYear: 2.4,": "maturityDays: 260, maxAgeDays: 2920, offspringPerAdultFemalePerYear: 2.4,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 2.0, minOffspringPerEvent: 1, maxOffspringPerEvent: 3, juvenileRecruitmentRate: 0.68, lowPopulationRecoveryBoost: 0.75, overcrowdingSuppressionStart: 0.82, criticalMortalityBuffer: 0.35, initialPopulationMinFraction: 0.52, initialPopulationMaxFraction: 0.80 },",
    "maturityDays: 120, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 8.5,": "maturityDays: 120, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 8.5,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 4.5, minOffspringPerEvent: 3, maxOffspringPerEvent: 7, juvenileRecruitmentRate: 0.68, lowPopulationRecoveryBoost: 1.15, overcrowdingSuppressionStart: 0.78, criticalMortalityBuffer: 0.45, initialPopulationMinFraction: 0.62, initialPopulationMaxFraction: 0.90 },",
    "maturityDays: 260, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 1.2,": "maturityDays: 260, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 1.2,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 1.0, minOffspringPerEvent: 1, maxOffspringPerEvent: 1, juvenileRecruitmentRate: 0.82, lowPopulationRecoveryBoost: 0.55, overcrowdingSuppressionStart: 0.88, criticalMortalityBuffer: 0.40, initialPopulationMinFraction: 0.50, initialPopulationMaxFraction: 0.78 },",
    "maturityDays: 150, maxAgeDays: 2190, offspringPerAdultFemalePerYear: 3.2,": "maturityDays: 150, maxAgeDays: 2190, offspringPerAdultFemalePerYear: 3.2,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 2.4, minOffspringPerEvent: 1, maxOffspringPerEvent: 2, juvenileRecruitmentRate: 0.68, lowPopulationRecoveryBoost: 0.85, overcrowdingSuppressionStart: 0.80, criticalMortalityBuffer: 0.40, initialPopulationMinFraction: 0.58, initialPopulationMaxFraction: 0.86 },",
    "maturityDays: 150, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 7.5,": "maturityDays: 150, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 7.5,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 3.0, minOffspringPerEvent: 6, maxOffspringPerEvent: 10, juvenileRecruitmentRate: 0.50, lowPopulationRecoveryBoost: 1.05, overcrowdingSuppressionStart: 0.78, criticalMortalityBuffer: 0.40, initialPopulationMinFraction: 0.62, initialPopulationMaxFraction: 0.90 },",
    "maturityDays: 180, maxAgeDays: 2555, offspringPerAdultFemalePerYear: 6.2,": "maturityDays: 180, maxAgeDays: 2555, offspringPerAdultFemalePerYear: 6.2,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 1.4, minOffspringPerEvent: 7, maxOffspringPerEvent: 12, juvenileRecruitmentRate: 0.55, lowPopulationRecoveryBoost: 0.95, overcrowdingSuppressionStart: 0.80, criticalMortalityBuffer: 0.40, initialPopulationMinFraction: 0.58, initialPopulationMaxFraction: 0.86 },",
    "maturityDays: 120, maxAgeDays: 1460, offspringPerAdultFemalePerYear: 18,": "maturityDays: 120, maxAgeDays: 1460, offspringPerAdultFemalePerYear: 18,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 2.5, minOffspringPerEvent: 30, maxOffspringPerEvent: 80, juvenileRecruitmentRate: 0.15, lowPopulationRecoveryBoost: 1.35, overcrowdingSuppressionStart: 0.75, criticalMortalityBuffer: 0.50, initialPopulationMinFraction: 0.68, initialPopulationMaxFraction: 0.94 },",
    "maturityDays: 150, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 4.8,": "maturityDays: 150, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 4.8,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 3.0, minOffspringPerEvent: 1, maxOffspringPerEvent: 2, juvenileRecruitmentRate: 0.75, lowPopulationRecoveryBoost: 0.95, overcrowdingSuppressionStart: 0.78, criticalMortalityBuffer: 0.40, initialPopulationMinFraction: 0.62, initialPopulationMaxFraction: 0.90 },",
    "maturityDays: 210, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 12,": "maturityDays: 210, maxAgeDays: 1825, offspringPerAdultFemalePerYear: 12,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 2.0, minOffspringPerEvent: 40, maxOffspringPerEvent: 100, juvenileRecruitmentRate: 0.10, lowPopulationRecoveryBoost: 1.10, overcrowdingSuppressionStart: 0.76, criticalMortalityBuffer: 0.45, initialPopulationMinFraction: 0.65, initialPopulationMaxFraction: 0.92 },",
    "maturityDays: 90, maxAgeDays: 1095, offspringPerAdultFemalePerYear: 11,": "maturityDays: 90, maxAgeDays: 1095, offspringPerAdultFemalePerYear: 11,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 4.0, minOffspringPerEvent: 4, maxOffspringPerEvent: 7, juvenileRecruitmentRate: 0.65, lowPopulationRecoveryBoost: 1.20, overcrowdingSuppressionStart: 0.76, criticalMortalityBuffer: 0.45, initialPopulationMinFraction: 0.68, initialPopulationMaxFraction: 0.94 },",
}
for old, new in fauna_profiles.items():
    s = replace_once(s, old, new, f'fauna profile {old}')
path.write_text(s)

# ---------------- predator definitions ----------------
path = Path('src/data/ecologyPredators.ts')
s = path.read_text()
s = replace_once(
    s,
    "import type { WildFoodResource } from '../types/ecologySimulation';\n",
    "import type { WildFoodResource } from '../types/ecologySimulation';\nimport type { EcologyReproductionProfile } from './ecologyDemography';\n",
    'predator demography import',
)
s = replace_once(
    s,
    "  offspringPerAdultFemalePerYear: number;\n",
    "  offspringPerAdultFemalePerYear: number;\n  reproduction?: EcologyReproductionProfile;\n",
    'predator reproduction field',
)
pred_profiles = {
    "maturityDays: 540, maxAgeDays: 5475, offspringPerAdultFemalePerYear: 1.8,": "maturityDays: 540, maxAgeDays: 5475, offspringPerAdultFemalePerYear: 1.8,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 1.0, minOffspringPerEvent: 6, maxOffspringPerEvent: 12, juvenileRecruitmentRate: 0.22, lowPopulationRecoveryBoost: 0.80, overcrowdingSuppressionStart: 0.88, criticalMortalityBuffer: 0.40, initialPopulationMinFraction: 0.55, initialPopulationMaxFraction: 0.82 },",
    "maturityDays: 900, maxAgeDays: 7300, offspringPerAdultFemalePerYear: 1.1,": "maturityDays: 900, maxAgeDays: 7300, offspringPerAdultFemalePerYear: 1.1,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 0.55, minOffspringPerEvent: 20, maxOffspringPerEvent: 40, juvenileRecruitmentRate: 0.08, lowPopulationRecoveryBoost: 0.95, overcrowdingSuppressionStart: 0.90, criticalMortalityBuffer: 0.50, initialPopulationMinFraction: 0.60, initialPopulationMaxFraction: 0.88 },",
    "maturityDays: 730, maxAgeDays: 6570, offspringPerAdultFemalePerYear: 0.85,": "maturityDays: 730, maxAgeDays: 6570, offspringPerAdultFemalePerYear: 0.85,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 1.0, minOffspringPerEvent: 1, maxOffspringPerEvent: 3, juvenileRecruitmentRate: 0.65, lowPopulationRecoveryBoost: 1.10, overcrowdingSuppressionStart: 0.92, criticalMortalityBuffer: 0.55, initialPopulationMinFraction: 0.68, initialPopulationMaxFraction: 0.94 },",
    "maturityDays: 420, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 1.9,": "maturityDays: 420, maxAgeDays: 3650, offspringPerAdultFemalePerYear: 1.9,\n    reproduction: { mode: 'live_birth', eventsPerAdultFemalePerYear: 1.1, minOffspringPerEvent: 2, maxOffspringPerEvent: 4, juvenileRecruitmentRate: 0.68, lowPopulationRecoveryBoost: 0.65, overcrowdingSuppressionStart: 0.86, criticalMortalityBuffer: 0.35, initialPopulationMinFraction: 0.55, initialPopulationMaxFraction: 0.82 },",
    "maturityDays: 3650, maxAgeDays: 21900, offspringPerAdultFemalePerYear: 0.38,": "maturityDays: 3650, maxAgeDays: 21900, offspringPerAdultFemalePerYear: 0.38,\n    reproduction: { mode: 'egg_clutch', eventsPerAdultFemalePerYear: 0.35, minOffspringPerEvent: 25, maxOffspringPerEvent: 45, juvenileRecruitmentRate: 0.05, lowPopulationRecoveryBoost: 1.00, overcrowdingSuppressionStart: 0.95, criticalMortalityBuffer: 0.55, initialPopulationMinFraction: 0.70, initialPopulationMaxFraction: 0.95 },",
}
for old, new in pred_profiles.items():
    s = replace_once(s, old, new, f'pred profile {old}')
s = replace_once(s, "baseDensityPer1000M2: 1.05, maxInitialPopulation: 2,", "baseDensityPer1000M2: 1.20, maxInitialPopulation: 3,", 'eagle baseline population')
s = replace_once(s, "baseDensityPer1000M2: 1.8, maxInitialPopulation: 4,", "baseDensityPer1000M2: 1.9, maxInitialPopulation: 5,", 'monitor baseline population')
s = replace_once(s, "baseDensityPer1000M2: 1.25, maxInitialPopulation: 3,", "baseDensityPer1000M2: 1.35, maxInitialPopulation: 4,", 'python baseline population')
s = replace_once(s, "baseDensityPer1000M2: 1.85, maxInitialPopulation: 4,", "baseDensityPer1000M2: 1.95, maxInitialPopulation: 5,", 'civet baseline population')
path.write_text(s)

# ---------------- fauna simulation ----------------
path = Path('src/simulation/ecologyFaunaSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "import { WILD_FLORA_SPECIES } from '../data/ecologyProfiles';\n",
    "import { WILD_FLORA_SPECIES } from '../data/ecologyProfiles';\nimport { demographicBalance, eventRecruitmentCount, initialPopulationFraction, resolveReproductionProfile, softBreedingFitness } from './ecologyDemographySystem';\n",
    'fauna helper import',
)
s = replace_once(
    s,
    "  const socialMinimum = species.socialMode === 'solitary' ? 1 : 2;\n  const population = Math.max(socialMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.round(carryingCapacity * (0.3 + random() * 0.34))));\n",
    "  const socialMinimum = species.socialMode === 'solitary' ? 1 : 2;\n  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);\n  const population = Math.max(socialMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.round(carryingCapacity * initialPopulationFraction(reproduction, random))));\n",
    'fauna initial population',
)
old = '''  const matureAnimals = population.adults + population.old;
  const mateFactor = matureAnimals < 2 ? matureAnimals / 2 : Math.min(1, matureAnimals / 4);
  const densityBreeding = Math.max(0, 1 - Math.pow(Math.max(0, density - 0.28) / 0.92, 1.7));
  const conditionFactor = clamp01((population.bodyCondition - 35) / 55) * clamp01((population.averageHealth - 38) / 50);
  const stressFactor = clamp01(1 - (population.foodStress + population.waterStress) / 155);
  population.reproductionPressure = clamp(mateFactor * densityBreeding * conditionFactor * stressFactor * 100);
  const adultFemales = population.adults * (1 - population.maleRatio);
  population.reproductionProgress += adultFemales * species.offspringPerAdultFemalePerYear / 365 * elapsedDays * population.reproductionPressure / 100;
  let births = Math.floor(population.reproductionProgress);
  if (births > 0) {
    population.reproductionProgress -= births;
    births = Math.min(births, Math.max(0, Math.ceil(carryingCapacity * 1.18 - population.population)));
    population.juveniles += births;
  }
'''
new = '''  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
  const balance = demographicBalance(population.population, carryingCapacity, reproduction);
  const matureAnimals = population.adults + population.old;
  // One represented mature animal can still encounter a mate in the surrounding
  // aggregate habitat; two or more mature animals no longer receive an arbitrary
  // mature/4 penalty.
  const mateAvailability = matureAnimals <= 0 ? 0 : matureAnimals === 1 ? 0.38 : 1;
  const conditionFactor = clamp01(
    clamp01((population.bodyCondition - 32) / 60) * 0.55
      + clamp01((population.averageHealth - 34) / 58) * 0.45,
  );
  const resourceState = clamp01(1 - (population.foodStress + population.waterStress) / 185);
  const breedingFitness = softBreedingFitness(mateAvailability, conditionFactor, resourceState);
  population.reproductionPressure = clamp(breedingFitness * Math.min(1.35, balance.reproductionMultiplier) * 100);
  const adultFemales = population.adults * (1 - population.maleRatio);
  population.reproductionProgress += adultFemales
    * reproduction.eventsPerAdultFemalePerYear / 365
    * elapsedDays
    * breedingFitness
    * balance.reproductionMultiplier;
  const breedingEvents = Math.floor(population.reproductionProgress);
  if (breedingEvents > 0) {
    population.reproductionProgress -= breedingEvents;
    let recruits = 0;
    for (let eventIndex = 0; eventIndex < breedingEvents; eventIndex += 1) {
      const random = mulberry32(hashString(`${population.id}:${gameMinute(state)}:${system.ecologyTickIndex}:${eventIndex}:breeding`));
      recruits += eventRecruitmentCount(reproduction, random);
    }
    const burstCapacity = Math.max(0, Math.ceil(carryingCapacity * 1.22 - population.population));
    population.juveniles += Math.min(recruits, burstCapacity);
  }
'''
s = replace_once(s, old, new, 'fauna event reproduction')
old = '''  const stressMortality = Math.max(0, population.foodStress + population.waterStress - 125) / 100 * population.population * 0.004;
  const oldMortality = population.old / Math.max(90, species.maxAgeDays * 0.28);
  const healthMortality = Math.max(0, 32 - population.averageHealth) / 100 * population.population * 0.006;
  population.mortalityProgress += (stressMortality + oldMortality + healthMortality) * elapsedDays;
'''
new = '''  const stressMortality = Math.max(0, population.foodStress + population.waterStress - 125) / 100 * population.population * 0.004;
  const oldMortality = population.old / Math.max(90, species.maxAgeDays * 0.28);
  const healthMortality = Math.max(0, 32 - population.averageHealth) / 100 * population.population * 0.006;
  // The stabilizer only buffers stress/health losses at critically low density;
  // natural old-age turnover is never suppressed.
  population.mortalityProgress += (
    oldMortality + (stressMortality + healthMortality) * balance.vulnerableMortalityMultiplier
  ) * elapsedDays;
'''
s = replace_once(s, old, new, 'fauna low-pop mortality buffer')
path.write_text(s)

# ---------------- predator simulation ----------------
path = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport, predatorPoiAccess } from './predatorResourceAccess';\n",
    "import { getPredatorAccessibleWaterRatio, getPredatorFoodSupport, predatorPoiAccess } from './predatorResourceAccess';\nimport { demographicBalance, eventRecruitmentCount, initialPopulationFraction, resolveReproductionProfile, softBreedingFitness } from './ecologyDemographySystem';\n",
    'predator helper import',
)
s = replace_once(
    s,
    "  const population = Math.max(1, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * (0.36 + random() * 0.36)))));\n",
    "  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);\n  const demographicMinimum = carryingCapacity >= 2 && species.maxInitialPopulation >= 2 ? 2 : 1;\n  const population = Math.max(demographicMinimum, Math.min(species.maxInitialPopulation, carryingCapacity, Math.max(1, Math.round(carryingCapacity * initialPopulationFraction(reproduction, random)))));\n",
    'predator initial population',
)
old = '''  const mature = population.adults + population.old;
  const mateFactor = mature < 2 ? mature / 2 : Math.min(1, mature / 3);
  const densityFactor = Math.max(0, 1 - Math.pow(Math.max(0, density - 0.25) / 0.95, 1.8));
  const condition = clamp01((population.bodyCondition - 42) / 50) * clamp01((population.averageHealth - 42) / 48);
  const foodFactor = clamp01(1 - population.hungerStress / 90);
  population.reproductionPressure = clamp(mateFactor * densityFactor * condition * foodFactor * 100);
  const adultFemales = population.adults * (1 - population.maleRatio);
  population.reproductionProgress += adultFemales * species.offspringPerAdultFemalePerYear / 365 * elapsedDays * population.reproductionPressure / 100;
  let births = Math.floor(population.reproductionProgress);
  if (births > 0) {
    population.reproductionProgress -= births;
    births = Math.min(births, Math.max(0, Math.ceil(carryingCapacity * 1.08 - population.population)));
    population.juveniles += births;
  }
'''
new = '''  const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
  const balance = demographicBalance(population.population, carryingCapacity, reproduction);
  const mature = population.adults + population.old;
  const mateAvailability = mature <= 0 ? 0 : mature === 1 ? 0.42 : 1;
  const condition = clamp01(
    clamp01((population.bodyCondition - 38) / 56) * 0.55
      + clamp01((population.averageHealth - 38) / 56) * 0.45,
  );
  const foodState = clamp01(1 - population.hungerStress / 96);
  const breedingFitness = softBreedingFitness(mateAvailability, condition, foodState);
  population.reproductionPressure = clamp(breedingFitness * Math.min(1.35, balance.reproductionMultiplier) * 100);
  const adultFemales = population.adults * (1 - population.maleRatio);
  population.reproductionProgress += adultFemales
    * reproduction.eventsPerAdultFemalePerYear / 365
    * elapsedDays
    * breedingFitness
    * balance.reproductionMultiplier;
  const breedingEvents = Math.floor(population.reproductionProgress);
  if (breedingEvents > 0) {
    population.reproductionProgress -= breedingEvents;
    let recruits = 0;
    for (let eventIndex = 0; eventIndex < breedingEvents; eventIndex += 1) {
      const random = mulberry32(hashString(`${population.id}:${gameMinute(state)}:${system.ecologyTickIndex}:${eventIndex}:predator-breeding`));
      recruits += eventRecruitmentCount(reproduction, random);
    }
    const burstCapacity = Math.max(0, Math.ceil(carryingCapacity * 1.18 - population.population));
    population.juveniles += Math.min(recruits, burstCapacity);
  }
'''
s = replace_once(s, old, new, 'predator event reproduction')
old = '''  const starvation = Math.max(0, population.hungerStress - 72) / 100 * population.population * 0.006;
  const dehydration = Math.max(0, population.waterStress - 78) / 100 * population.population * 0.005;
  const oldMortality = population.old / Math.max(180, species.maxAgeDays * 0.32);
  const healthMortality = Math.max(0, 30 - population.averageHealth) / 100 * population.population * 0.005;
  population.mortalityProgress += (starvation + dehydration + oldMortality + healthMortality) * elapsedDays;
'''
new = '''  const starvation = Math.max(0, population.hungerStress - 72) / 100 * population.population * 0.006;
  const dehydration = Math.max(0, population.waterStress - 78) / 100 * population.population * 0.005;
  const oldMortality = population.old / Math.max(180, species.maxAgeDays * 0.32);
  const healthMortality = Math.max(0, 30 - population.averageHealth) / 100 * population.population * 0.005;
  population.mortalityProgress += (
    oldMortality + (starvation + dehydration + healthMortality) * balance.vulnerableMortalityMultiplier
  ) * elapsedDays;
'''
s = replace_once(s, old, new, 'predator low-pop mortality buffer')
path.write_text(s)

# ---------------- pressure-response small cohort buffer ----------------
path = Path('src/simulation/predatorPressureResponseSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "    const wholeDispersers = Math.floor(response.dispersalProgress);\n    if (wholeDispersers > 0) {\n      response.dispersalProgress -= wholeDispersers;\n      const removed = removeDispersers(population, wholeDispersers);\n",
    "    const wholeDispersers = Math.floor(response.dispersalProgress);\n    if (wholeDispersers > 0) {\n      response.dispersalProgress -= wholeDispersers;\n      // Do not let a pressure-response event erase the last local breeding pair.\n      // Real dispersal/metapopulation transfer can be added later; until then,\n      // this buffer prevents aggregate cohorts of 1-2 animals from being deleted.\n      const removable = Math.max(0, population.population - 2);\n      const removed = removeDispersers(population, Math.min(wholeDispersers, removable));\n",
    'pressure dispersal buffer',
)
path.write_text(s)
