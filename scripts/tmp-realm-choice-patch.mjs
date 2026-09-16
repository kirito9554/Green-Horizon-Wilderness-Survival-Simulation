import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`missing patch anchor: ${label}`);
  return text.replace(from, to);
}

const huntPath = 'src/simulation/predatorDiscreteHuntingSystem.ts';
let hunt = readFileSync(huntPath, 'utf8');

hunt = replaceOnce(
  hunt,
  `  const equivalentPredators = equivalentPredatorCount(population);\n  const needDrive = clamp01((tickDemandKg - currentEdibleKg) / Math.max(0.001, tickDemandKg));\n  const hungerDrive = clamp01(population.hungerStress / 100);\n  const huntDrive = clamp01(needDrive * 0.82 + hungerDrive * 0.18) * waterAccess;\n  const aquaticBudgetKg = Math.min(remainingMealBudgetKg, tickDemandKg * maxShare);\n  if (aquaticBudgetKg <= 0.001 || huntDrive <= 0) return { edibleKg: 0, kills: 0 };`,
  `  const equivalentPredators = equivalentPredatorCount(population);\n  const needDrive = clamp01((tickDemandKg - currentEdibleKg) / Math.max(0.001, tickDemandKg));\n  const hungerDrive = clamp01(population.hungerStress / 100);\n\n  // Aquatic and terrestrial prey compete for the same feeding decision.\n  // maxAquaticDietShare is a ceiling, not a fish-first quota. Using the best\n  // currently reachable target in each realm lets a crocodile prefer a large\n  // riparian boar when that meal is more valuable than another small fish.\n  const aquaticTargets = collectAquaticHuntTargets(state, population, species);\n  const terrestrialTargets = collectHuntTargets(state, population, species);\n  const aquaticOpportunity = aquaticTargets.reduce((best, target) => Math.max(best, target.targetWeight), 0);\n  const terrestrialOpportunity = terrestrialTargets.reduce((best, target) => Math.max(best, target.targetWeight), 0);\n  const totalRealmOpportunity = aquaticOpportunity + terrestrialOpportunity;\n  const preferredAquaticShare = totalRealmOpportunity > 0 ? aquaticOpportunity / totalRealmOpportunity : 0;\n  const effectiveAquaticShare = Math.min(maxShare, preferredAquaticShare);\n  const realmDrive = maxShare > 0 ? Math.sqrt(clamp01(effectiveAquaticShare / maxShare)) : 0;\n  const huntDrive = clamp01(needDrive * 0.82 + hungerDrive * 0.18) * waterAccess * realmDrive;\n  const aquaticBudgetKg = Math.min(remainingMealBudgetKg, tickDemandKg * effectiveAquaticShare);\n  if (aquaticBudgetKg <= 0.001 || huntDrive <= 0 || aquaticTargets.length <= 0) return { edibleKg: 0, kills: 0 };`,
  'realm competition setup',
);

writeFileSync(huntPath, hunt);
for (const path of ['scripts/tmp-realm-choice-patch.mjs', '.github/workflows/tmp-realm-choice-patch.yml']) {
  if (existsSync(path)) unlinkSync(path);
}
