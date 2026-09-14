import type { ItemQuality, SurvivorState } from '../types';
import type { CraftQualityProfile } from '../types/craftingSimulation';

const MATERIAL_SCORE: Record<ItemQuality, number> = {
  crude: 35,
  standard: 60,
  prime: 82,
  masterwork: 96,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/** Stable PRNG: same queued job + unit produces the same craft result after reload. */
export function deterministicRoll(seed: number, unitIndex: number, channel = 0): number {
  let t = (seed + Math.imul(unitIndex + 1, 0x9e3779b1) + Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
  t += 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function summarizeQualityProfile(profile: CraftQualityProfile): ItemQuality {
  const composite =
    profile.material * 0.30 +
    profile.workmanship * 0.30 +
    profile.fit * 0.18 +
    profile.finish * 0.07 +
    profile.structuralIntegrity * 0.15;

  if (composite >= 90 && profile.structuralIntegrity >= 86) return 'masterwork';
  if (composite >= 76 && profile.fit >= 68) return 'prime';
  if (composite < 48 || profile.structuralIntegrity < 40) return 'crude';
  return 'standard';
}

export function deriveCraftQuality(
  ingredientQualities: ItemQuality[],
  crafter: SurvivorState,
  seed: number,
  unitIndex: number,
  context: {
    workstationPrecisionBonus?: number;
    environmentPenalty?: number;
  } = {},
): {
  quality: ItemQuality;
  profile: CraftQualityProfile;
  conditionMaxMultiplier: number;
  efficiencyModifier: number;
} {
  const material = ingredientQualities.length > 0
    ? ingredientQualities.reduce((sum, quality) => sum + MATERIAL_SCORE[quality], 0) / ingredientQualities.length
    : 60;

  const skill = clamp(32 + ((crafter.skills.crafting || 1) - 1) * 15.5, 25, 96);
  const physicalPenalty =
    Math.max(0, crafter.fatigue - 55) * 0.22 +
    Math.max(0, crafter.hunger - 65) * 0.12 +
    Math.max(0, crafter.thirst - 60) * 0.16 +
    Math.max(0, 45 - crafter.health) * 0.16;
  const moraleModifier = (crafter.morale - 50) * 0.08;
  const workstationPrecision = Math.max(0, context.workstationPrecisionBonus || 0);
  const environmentPenalty = Math.max(0, context.environmentPenalty || 0);

  const workNoise = (deterministicRoll(seed, unitIndex, 0) - 0.5) * 10;
  const fitNoise = (deterministicRoll(seed, unitIndex, 1) - 0.5) * 12;
  const finishNoise = (deterministicRoll(seed, unitIndex, 2) - 0.5) * 14;
  const structuralNoise = (deterministicRoll(seed, unitIndex, 3) - 0.5) * 8;

  const workmanship = clamp(skill * 0.72 + material * 0.20 + moraleModifier + workstationPrecision * 0.75 - physicalPenalty - environmentPenalty + workNoise);
  const fit = clamp(skill * 0.62 + material * 0.28 + workstationPrecision - physicalPenalty * 0.8 - environmentPenalty * 0.8 + fitNoise);
  const finish = clamp(skill * 0.55 + material * 0.24 + moraleModifier + workstationPrecision * 0.35 - physicalPenalty * 0.55 - environmentPenalty * 0.45 + finishNoise);
  const structuralIntegrity = clamp(material * 0.48 + workmanship * 0.30 + fit * 0.22 - physicalPenalty * 0.45 - environmentPenalty * 0.35 + structuralNoise);

  const profile: CraftQualityProfile = {
    material: Math.round(material * 10) / 10,
    workmanship: Math.round(workmanship * 10) / 10,
    fit: Math.round(fit * 10) / 10,
    finish: Math.round(finish * 10) / 10,
    structuralIntegrity: Math.round(structuralIntegrity * 10) / 10,
  };

  const quality = summarizeQualityProfile(profile);
  const conditionMaxMultiplier = clamp(0.62 + structuralIntegrity / 105 + workmanship / 430, 0.70, 2.15);
  const efficiencyModifier = clamp((fit - 60) / 180 + (workmanship - 60) / 260, -0.20, 0.42);

  return {
    quality,
    profile,
    conditionMaxMultiplier: Math.round(conditionMaxMultiplier * 1000) / 1000,
    efficiencyModifier: Math.round(efficiencyModifier * 1000) / 1000,
  };
}
