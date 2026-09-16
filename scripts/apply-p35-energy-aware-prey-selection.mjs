import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/simulation/predatorDiscreteHuntingSystem.ts';
let source = readFileSync(path, 'utf8');

const oldTerrestrial = `function energeticTargetValue(prey: WildAnimalPopulation, predator: WildPredatorSpeciesDefinition): number {\n  const stages = eligibleStages(prey, predator);\n  const totalWeight = stages.reduce((sum, row) => sum + row.weight, 0);\n  if (totalWeight <= 0) return 0;\n  const expectedBodyMassKg = stages.reduce((sum, row) => sum + row.bodyMassKg * row.weight, 0) / totalWeight;\n  const expectedEdibleDays = expectedBodyMassKg * 0.58 / Math.max(0.05, predator.dailyFoodKgPerAdult);\n  return Math.max(0.35, Math.sqrt(Math.max(0.05, expectedEdibleDays)));\n}`;

const newTerrestrial = `function mealTargetValue(expectedEdibleDays: number): number {\n  // P3.5: predators should value a meal by how long it can actually feed them.\n  // The previous sqrt curve compressed medium/large prey too aggressively, so\n  // very abundant tiny prey could dominate target selection even when dozens\n  // of kills were required to cover maintenance. Keep small prey as fallback,\n  // but strongly prefer prey that provides roughly a day or more of food.\n  const mealDays = Math.max(0.05, Math.min(10, expectedEdibleDays));\n  const sizeValue = Math.pow(mealDays, 0.8);\n  const smallMealPenalty = mealDays >= 0.75\n    ? 1\n    : 0.4 + 0.6 * (mealDays / 0.75);\n  return Math.max(0.15, sizeValue * smallMealPenalty);\n}\n\nfunction energeticTargetValue(prey: WildAnimalPopulation, predator: WildPredatorSpeciesDefinition): number {\n  const stages = eligibleStages(prey, predator);\n  const totalWeight = stages.reduce((sum, row) => sum + row.weight, 0);\n  if (totalWeight <= 0) return 0;\n  const expectedBodyMassKg = stages.reduce((sum, row) => sum + row.bodyMassKg * row.weight, 0) / totalWeight;\n  const expectedEdibleDays = expectedBodyMassKg * 0.58 / Math.max(0.05, predator.dailyFoodKgPerAdult);\n  return mealTargetValue(expectedEdibleDays);\n}`;

if (!source.includes(oldTerrestrial)) throw new Error('terrestrial energeticTargetValue block not found');
source = source.replace(oldTerrestrial, newTerrestrial);

const oldAquatic = `      const energeticValue = expectedBodyMassKg > 0\n        ? Math.max(0.35, Math.sqrt(expectedBodyMassKg * 0.58 / Math.max(0.05, species.dailyFoodKgPerAdult)))\n        : 0;`;
const newAquatic = `      const energeticValue = expectedBodyMassKg > 0\n        ? mealTargetValue(expectedBodyMassKg * 0.58 / Math.max(0.05, species.dailyFoodKgPerAdult))\n        : 0;`;
if (!source.includes(oldAquatic)) throw new Error('aquatic energetic value block not found');
source = source.replace(oldAquatic, newAquatic);

const abundancePattern = 'Math.sqrt(Math.max(1, prey.population))';
const occurrences = source.split(abundancePattern).length - 1;
if (occurrences !== 2) throw new Error(`expected 2 abundance terms, found ${occurrences}`);
source = source.split(abundancePattern).join('Math.pow(Math.max(1, prey.population), 0.35)');

writeFileSync(path, source);
console.log('Applied P3.5 energy-aware prey selection patch.');
