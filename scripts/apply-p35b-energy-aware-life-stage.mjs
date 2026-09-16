import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/simulation/predatorDiscreteHuntingSystem.ts';
let source = readFileSync(path, 'utf8');

const marker = `function energeticTargetValue(prey: WildAnimalPopulation, predator: WildPredatorSpeciesDefinition): number {\n`;
const helper = `function energyAwareLifeStageWeight(\n  row: { stage: WildAnimalLifeStage; bodyMassKg: number; weight: number },\n  predator: WildPredatorSpeciesDefinition,\n  needSeverity: number,\n): number {\n  // P3.5b: life-stage choice should react to energetic need without permanently\n  // overriding species-specific juvenile preference. When food need is low the\n  // historical stage weights dominate; when hunger/intake deficit is high, a\n  // larger adult or old animal becomes worth the additional capture risk.\n  const urgency = clamp01(needSeverity);\n  const edibleDays = row.bodyMassKg * 0.58 / Math.max(0.05, predator.dailyFoodKgPerAdult);\n  const mealValue = mealTargetValue(edibleDays);\n  const energyBias = 0.35 + urgency * 0.55;\n  const payoffMultiplier = Math.max(0.3, 1 + (mealValue - 1) * energyBias);\n  const maturityShift = row.stage === 'juvenile'\n    ? 1 - urgency * 0.18\n    : row.stage === 'old'\n      ? 1 + urgency * 0.16\n      : 1 + urgency * 0.1;\n  return Math.max(0, row.weight * payoffMultiplier * maturityShift);\n}\n\n`;
if (!source.includes(marker)) throw new Error('energeticTargetValue marker not found');
source = source.replace(marker, helper + marker);

const aquaticOld = `    const stages = eligibleAquaticStages(target.prey, species);\n    const stage = weightedPick(stages, row => row.weight, random);`;
const aquaticNew = `    const stages = eligibleAquaticStages(target.prey, species);\n    const stageNeedSeverity = clamp01(Math.max(\n      hungerDrive,\n      (tickDemandKg - (currentEdibleKg + consumed)) / Math.max(0.001, tickDemandKg),\n    ));\n    const stage = weightedPick(\n      stages,\n      row => energyAwareLifeStageWeight(row, species, stageNeedSeverity),\n      random,\n    );`;
if (!source.includes(aquaticOld)) throw new Error('aquatic stage selection block not found');
source = source.replace(aquaticOld, aquaticNew);

const terrestrialOld = `    const stages = eligibleStages(target.prey, species);\n    const stage = weightedPick(stages, row => row.weight, random);`;
const terrestrialNew = `    const stages = eligibleStages(target.prey, species);\n    const stageNeedSeverity = clamp01(Math.max(\n      population.hungerStress / 100,\n      1 - edibleKg / Math.max(0.001, tickDemandKg),\n    ));\n    const stage = weightedPick(\n      stages,\n      row => energyAwareLifeStageWeight(row, species, stageNeedSeverity),\n      random,\n    );`;
if (!source.includes(terrestrialOld)) throw new Error('terrestrial stage selection block not found');
source = source.replace(terrestrialOld, terrestrialNew);

writeFileSync(path, source);
console.log('Applied P3.5b energy-aware life-stage selection patch.');
