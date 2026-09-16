from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)

# --- types/ecologySimulation.ts -------------------------------------------------
path = Path('src/types/ecologySimulation.ts')
text = path.read_text()
text = replace_once(
    text,
    "  /** Fractional progress toward the next discrete hunt attempt. */\n  huntAttemptProgress?: number;\n",
    "  /** Fractional progress toward the next discrete terrestrial hunt attempt. */\n  huntAttemptProgress?: number;\n  /** Fractional progress toward the next discrete aquatic hunt attempt. */\n  aquaticHuntAttemptProgress?: number;\n",
    'predator aquatic progress',
)
text = replace_once(
    text,
    "  sourceSpeciesId: string;\n  sourceLifeStage: WildAnimalLifeStage;\n",
    "  sourceSpeciesId: string;\n  sourceLifeStage: WildAnimalLifeStage;\n  /** Missing on legacy saves means terrestrial. */\n  sourceRealm?: 'terrestrial' | 'aquatic';\n  /** Hydrology node for aquatic kills; terrestrial carcasses leave this undefined. */\n  waterNodeId?: string;\n",
    'aquatic carcass metadata',
)
path.write_text(text)

# --- data/ecologyPredators.ts ---------------------------------------------------
path = Path('src/data/ecologyPredators.ts')
text = path.read_text()
text = replace_once(
    text,
    "  /** Upper share of daily maintenance demand that supplemental foraging may cover. */\n  maxSupplementalDietShare?: number;\n",
    "  /** Upper share of daily maintenance demand that supplemental foraging may cover. */\n  maxSupplementalDietShare?: number;\n  /** Aquatic populations that can be targeted while hunting from wet habitat. */\n  aquaticPreyWeights?: Partial<Record<string, number>>;\n  /** Small-prey capture attempts per equivalent adult predator-day. */\n  aquaticCaptureRatePerAdultDay?: number;\n  /** Maximum share of tick maintenance demand intentionally sourced from aquatic prey. */\n  maxAquaticDietShare?: number;\n",
    'aquatic predator fields',
)
text = replace_once(
    text,
    "    supplementalDiet: { insects: 0.86, carrion: 0.14 },\n    maxSupplementalDietShare: 0.55,\n",
    "    supplementalDiet: { insects: 0.86, carrion: 0.14 },\n    maxSupplementalDietShare: 0.55,\n    aquaticPreyWeights: {\n      AQUATIC_FRESHWATER_PRAWN: 1,\n      AQUATIC_MUD_CRAB: 0.9,\n      AQUATIC_FORAGE_FISH: 0.78,\n      AQUATIC_TILAPIA: 0.45,\n      AQUATIC_RIVER_CARP: 0.28,\n      AQUATIC_FRESHWATER_EEL: 0.18,\n    },\n    aquaticCaptureRatePerAdultDay: 0.24,\n    maxAquaticDietShare: 0.24,\n",
    'monitor aquatic diet',
)
text = replace_once(
    text,
    "    preyWeights: {\n      FAUNA_WILD_BOAR: 1,\n      FAUNA_FERAL_GOAT: 0.82,\n      FAUNA_LARGE_FOREST_RODENT: 0.62,\n      FAUNA_FERAL_DUCK: 0.42,\n      FAUNA_AGOUTI: 0.34,\n      FAUNA_MUD_CRAB: 0.24,\n      FAUNA_FLYING_FOX: 0.20,\n      FAUNA_WILD_RABBIT: 0.18,\n      FAUNA_FRUIT_DOVE: 0.12,\n      FAUNA_GROUND_FROG: 0.06,\n    },\n    adultWeightKg: 180, dailyFoodKgPerAdult: 1.65, dailyWaterNeed: 90,\n",
    "    preyWeights: {\n      FAUNA_WILD_BOAR: 1,\n      FAUNA_FERAL_GOAT: 0.82,\n      FAUNA_LARGE_FOREST_RODENT: 0.62,\n      FAUNA_FERAL_DUCK: 0.42,\n      FAUNA_AGOUTI: 0.34,\n      FAUNA_MUD_CRAB: 0.24,\n      FAUNA_FLYING_FOX: 0.20,\n      FAUNA_WILD_RABBIT: 0.18,\n      FAUNA_FRUIT_DOVE: 0.12,\n      FAUNA_GROUND_FROG: 0.06,\n    },\n    aquaticPreyWeights: {\n      AQUATIC_LAGOON_SNAPPER: 1,\n      AQUATIC_RIVER_CARP: 0.95,\n      AQUATIC_FRESHWATER_EEL: 0.9,\n      AQUATIC_TILAPIA: 0.82,\n      AQUATIC_PARROTFISH: 0.7,\n      AQUATIC_MUD_CRAB: 0.55,\n      AQUATIC_FORAGE_FISH: 0.42,\n      AQUATIC_FRESHWATER_PRAWN: 0.24,\n    },\n    aquaticCaptureRatePerAdultDay: 1.1,\n    maxAquaticDietShare: 0.62,\n    adultWeightKg: 180, dailyFoodKgPerAdult: 1.65, dailyWaterNeed: 90,\n",
    'croc aquatic diet',
)
path.write_text(text)

# --- simulation/aquaticFoodWebSystem.ts ----------------------------------------
path = Path('src/simulation/aquaticFoodWebSystem.ts')
text = path.read_text()
anchor = "function tickNodeResources(state: GameState, food: AquaticFoodWebNodeState, now: number): void {\n"
helper = """function riparianDetritusInputKg(state: GameState, food: AquaticFoodWebNodeState, detritusCapacityKg: number, days: number): number {\n  const riparian = Object.values(state.ecologySystem?.subareasById || {})\n    .filter(subarea => subarea.poiId === food.poiId && subarea.materializationState === 'materialized' && subarea.environment.waterAccess >= 35);\n  if (!riparian.length || days <= 0) return 0;\n  const litterIndex = riparian.reduce((sum, subarea) => {\n    const biomass = clamp01(subarea.ecology.biomass / 100);\n    const canopy = clamp01(subarea.environment.canopyCover / 100);\n    const water = clamp01(subarea.environment.waterAccess / 100);\n    const decomposition = clamp01(subarea.ecology.decompositionRate / 100);\n    return sum + biomass * 0.34 + canopy * 0.28 + water * 0.2 + decomposition * 0.18;\n  }, 0) / riparian.length;\n  return Math.max(0, detritusCapacityKg * 0.022 * days * litterIndex);\n}\n\n"""
text = replace_once(text, anchor, helper + anchor, 'riparian detritus helper')
text = replace_once(
    text,
    "  const contaminationFactor = clamp01(1 - (node.contamination ?? 0) / 100);\n  const nutrientFactor = clamp01(0.45 + food.detritusKg / Math.max(0.1, caps.detritus) * 0.55);\n\n",
    "  const contaminationFactor = clamp01(1 - (node.contamination ?? 0) / 100);\n  const riparianDetritusKg = riparianDetritusInputKg(state, food, caps.detritus, days);\n  food.detritusKg += riparianDetritusKg;\n  const nutrientFactor = clamp01(0.45 + food.detritusKg / Math.max(0.1, caps.detritus) * 0.55);\n\n",
    'riparian detritus flux',
)
path.write_text(text)

# --- simulation/predatorDiscreteHuntingSystem.ts -------------------------------
path = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
text = path.read_text()
text = replace_once(
    text,
    "import type { MainWorldAreaId } from '../data/mainWorldAreas';\nimport { WILD_FAUNA_SPECIES } from '../data/ecologyFauna';\n",
    "import type { MainWorldAreaId } from '../data/mainWorldAreas';\nimport type { WildAquaticPopulation } from '../types/aquaticEcology';\nimport { WILD_FAUNA_SPECIES } from '../data/ecologyFauna';\nimport { WILD_AQUATIC_SPECIES } from '../data/ecologyAquatic';\n",
    'aquatic hunting imports',
)
text = replace_once(
    text,
    "} from './ecologyPredatorSystem';\n\nconst BASE_EXPECTED_ATTEMPT_SUCCESS = 0.22;\n",
    "} from './ecologyPredatorSystem';\n\nconst BASE_EXPECTED_ATTEMPT_SUCCESS = 0.22;\n",
    'predator import anchor',
)
text = replace_once(
    text,
    "  population.huntAttemptProgress = Number.isFinite(population.huntAttemptProgress)\n    ? Math.max(0, population.huntAttemptProgress || 0)\n    : 0;\n",
    "  population.huntAttemptProgress = Number.isFinite(population.huntAttemptProgress)\n    ? Math.max(0, population.huntAttemptProgress || 0)\n    : 0;\n  population.aquaticHuntAttemptProgress = Number.isFinite(population.aquaticHuntAttemptProgress)\n    ? Math.max(0, population.aquaticHuntAttemptProgress || 0)\n    : 0;\n",
    'aquatic attempt init',
)

old_sync = """function syncCarrionConsumption(system: WorldEcologyState, carcass: WildCarcass, consumedKg: number): void {\n  if (consumedKg <= 0 || carcass.mirroredCarrionKg <= 0) return;\n  const subarea = system.subareasById[carcass.subareaId];\n  if (!subarea?.foodWeb) return;\n  const mirroredConsumed = Math.min(carcass.mirroredCarrionKg, consumedKg);\n  subarea.foodWeb.carrionBiomassKg = round3(Math.max(0, subarea.foodWeb.carrionBiomassKg - mirroredConsumed));\n  carcass.mirroredCarrionKg = round3(Math.max(0, carcass.mirroredCarrionKg - mirroredConsumed));\n}\n"""
new_sync = """function syncCarrionConsumption(system: WorldEcologyState, carcass: WildCarcass, consumedKg: number): void {\n  if (consumedKg <= 0 || carcass.mirroredCarrionKg <= 0) return;\n  const mirroredConsumed = Math.min(carcass.mirroredCarrionKg, consumedKg);\n  if (carcass.waterNodeId) {\n    const aquatic = system.aquaticFoodWebByNodeId?.[carcass.waterNodeId];\n    if (!aquatic) return;\n    aquatic.carrionKg = round3(Math.max(0, aquatic.carrionKg - mirroredConsumed));\n  } else {\n    const subarea = system.subareasById[carcass.subareaId];\n    if (!subarea?.foodWeb) return;\n    subarea.foodWeb.carrionBiomassKg = round3(Math.max(0, subarea.foodWeb.carrionBiomassKg - mirroredConsumed));\n  }\n  carcass.mirroredCarrionKg = round3(Math.max(0, carcass.mirroredCarrionKg - mirroredConsumed));\n}\n"""
text = replace_once(text, old_sync, new_sync, 'aquatic carrion consumption mirror')

old_mirror = """function mirrorNewCarcass(system: WorldEcologyState, carcass: WildCarcass): void {\n  const subarea = system.subareasById[carcass.subareaId];\n  if (!subarea?.foodWeb) return;\n  const mirrored = Math.max(0, carcass.remainingScavengeableKg);\n  subarea.foodWeb.carrionBiomassKg = round3(subarea.foodWeb.carrionBiomassKg + mirrored);\n  carcass.mirroredCarrionKg = round3(mirrored);\n}\n"""
new_mirror = """function mirrorNewCarcass(system: WorldEcologyState, carcass: WildCarcass): void {\n  const mirrored = Math.max(0, carcass.remainingScavengeableKg);\n  if (carcass.waterNodeId) {\n    const aquatic = system.aquaticFoodWebByNodeId?.[carcass.waterNodeId];\n    if (!aquatic) return;\n    aquatic.carrionKg = round3(aquatic.carrionKg + mirrored);\n  } else {\n    const subarea = system.subareasById[carcass.subareaId];\n    if (!subarea?.foodWeb) return;\n    subarea.foodWeb.carrionBiomassKg = round3(subarea.foodWeb.carrionBiomassKg + mirrored);\n  }\n  carcass.mirroredCarrionKg = round3(mirrored);\n}\n"""
text = replace_once(text, old_mirror, new_mirror, 'aquatic carrion creation mirror')

old_reduce = """function reduceMirroredCarrion(system: WorldEcologyState, carcass: WildCarcass, targetMirroredKg: number): void {\n  const previousMirroredKg = Math.max(0, carcass.mirroredCarrionKg);\n  const nextMirroredKg = Math.max(0, Math.min(previousMirroredKg, targetMirroredKg));\n  const lostMirroredKg = Math.max(0, previousMirroredKg - nextMirroredKg);\n  const subarea = system.subareasById[carcass.subareaId];\n  if (lostMirroredKg > 0 && subarea?.foodWeb) {\n    subarea.foodWeb.carrionBiomassKg = round3(Math.max(0, subarea.foodWeb.carrionBiomassKg - lostMirroredKg));\n  }\n  carcass.mirroredCarrionKg = round3(nextMirroredKg);\n}\n"""
new_reduce = """function reduceMirroredCarrion(system: WorldEcologyState, carcass: WildCarcass, targetMirroredKg: number): void {\n  const previousMirroredKg = Math.max(0, carcass.mirroredCarrionKg);\n  const nextMirroredKg = Math.max(0, Math.min(previousMirroredKg, targetMirroredKg));\n  const lostMirroredKg = Math.max(0, previousMirroredKg - nextMirroredKg);\n  if (lostMirroredKg > 0 && carcass.waterNodeId) {\n    const aquatic = system.aquaticFoodWebByNodeId?.[carcass.waterNodeId];\n    if (aquatic) aquatic.carrionKg = round3(Math.max(0, aquatic.carrionKg - lostMirroredKg));\n  } else if (lostMirroredKg > 0) {\n    const subarea = system.subareasById[carcass.subareaId];\n    if (subarea?.foodWeb) subarea.foodWeb.carrionBiomassKg = round3(Math.max(0, subarea.foodWeb.carrionBiomassKg - lostMirroredKg));\n  }\n  carcass.mirroredCarrionKg = round3(nextMirroredKg);\n}\n"""
text = replace_once(text, old_reduce, new_reduce, 'aquatic carrion decay mirror')

insert_anchor = "function runDiscreteHunt(\n"
aquatic_helpers = r'''interface AquaticHuntTarget {
  prey: WildAquaticPopulation;
  preference: number;
  searchability: number;
  targetWeight: number;
  waterNodeId: string;
}

function aquaticStageMassMultiplier(stage: WildAnimalLifeStage): number {
  if (stage === 'juvenile') return 0.28;
  if (stage === 'old') return 0.82;
  return 1;
}

function eligibleAquaticStages(
  prey: WildAquaticPopulation,
  predator: WildPredatorSpeciesDefinition,
): Array<{ stage: WildAnimalLifeStage; count: number; bodyMassKg: number; weight: number }> {
  const preySpecies = WILD_AQUATIC_SPECIES[prey.speciesId];
  if (!preySpecies) return [];
  const rows: Array<{ stage: WildAnimalLifeStage; count: number; bodyMassKg: number; weight: number }> = [
    { stage: 'juvenile', count: prey.juveniles, bodyMassKg: preySpecies.adultWeightKg * 0.28, weight: prey.juveniles * (0.7 + predator.juvenilePreference * 0.8) },
    { stage: 'adult', count: prey.adults, bodyMassKg: preySpecies.adultWeightKg, weight: prey.adults * (0.95 - predator.juvenilePreference * 0.2) },
    { stage: 'old', count: prey.old, bodyMassKg: preySpecies.adultWeightKg * 0.82, weight: prey.old * 0.86 },
  ];
  return rows.filter(row => row.count >= 1 && row.bodyMassKg <= predator.maxAdultPreyKg);
}

function collectAquaticHuntTargets(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): AquaticHuntTarget[] {
  const system = ensureWildPredators(state);
  const weights = species.aquaticPreyWeights || {};
  const current = system.subareasById[population.currentSubareaId];
  const waterAccess = clamp01(((current?.environment.waterAccess || 0) - 20) / 75);
  if (waterAccess <= 0 || !Object.keys(weights).length) return [];
  return (system.aquaticPopulations || [])
    .filter(prey => prey.population > 3 && prey.poiIds.includes(population.poiId) && (weights[prey.speciesId] || 0) > 0)
    .map(prey => {
      const preference = weights[prey.speciesId] || 0;
      const stages = eligibleAquaticStages(prey, species);
      const stageWeight = stages.reduce((sum, row) => sum + row.weight, 0);
      const expectedBodyMassKg = stageWeight > 0
        ? stages.reduce((sum, row) => sum + row.bodyMassKg * row.weight, 0) / stageWeight
        : 0;
      const energeticValue = expectedBodyMassKg > 0
        ? Math.max(0.35, Math.sqrt(expectedBodyMassKg * 0.58 / Math.max(0.05, species.dailyFoodKgPerAdult)))
        : 0;
      const abundance = clamp01(prey.population / (prey.population + 12));
      const condition = clamp01(prey.bodyCondition / 100 * 0.6 + prey.averageHealth / 100 * 0.4);
      const searchability = clamp01(Math.sqrt(abundance) * (0.55 + waterAccess * 0.45) * (0.78 + condition * 0.22));
      const waterNodeId = prey.occupiedNodeIds.find(id => state.hydrologySystem?.nodesById?.[id]?.poiId === population.poiId)
        || prey.anchorNodeId;
      return {
        prey,
        preference,
        searchability,
        waterNodeId,
        targetWeight: preference * Math.sqrt(Math.max(1, prey.population)) * energeticValue * (0.35 + searchability * 0.65),
      };
    })
    .filter(entry => entry.targetWeight > 0 && Boolean(state.hydrologySystem?.nodesById?.[entry.waterNodeId]));
}

function removeOneAquaticPrey(prey: WildAquaticPopulation, stage: WildAnimalLifeStage): number {
  const species = WILD_AQUATIC_SPECIES[prey.speciesId];
  if (!species) return 0;
  if (stage === 'juvenile' && prey.juveniles >= 1) prey.juveniles -= 1;
  else if (stage === 'adult' && prey.adults >= 1) prey.adults -= 1;
  else if (stage === 'old' && prey.old >= 1) prey.old -= 1;
  else return 0;
  prey.population = round3(Math.max(0, prey.juveniles + prey.adults + prey.old));
  prey.biomassKg = round3(species.adultWeightKg * (prey.juveniles * 0.28 + prey.adults + prey.old * 0.82));
  return round3(species.adultWeightKg * aquaticStageMassMultiplier(stage));
}

function createAquaticCarcass(
  state: GameState,
  predatorPopulation: WildPredatorPopulation,
  prey: WildAquaticPopulation,
  stage: WildAnimalLifeStage,
  bodyMassKg: number,
  waterNodeId: string,
): WildCarcass {
  const system = ensureWildPredators(state);
  system.wildCarcasses ||= [];
  const now = gameMinute(state);
  const edibleMassKg = round3(bodyMassKg * 0.58);
  const scavengeableMassKg = round3(bodyMassKg * 0.8);
  const carcass: WildCarcass = {
    id: `carcass_aq_${hashString(`${predatorPopulation.id}:${prey.id}:${stage}:${now}:${system.ecologyTickIndex}:${system.wildCarcasses.length}`).toString(36)}`,
    poiId: predatorPopulation.poiId,
    subareaId: predatorPopulation.currentSubareaId,
    sourceSpeciesId: prey.speciesId,
    sourceLifeStage: stage,
    sourceRealm: 'aquatic',
    waterNodeId,
    cause: 'predation',
    killerSpeciesId: predatorPopulation.speciesId,
    killerPopulationId: predatorPopulation.id,
    bodyMassKg: round3(bodyMassKg),
    edibleMassKg,
    scavengeableMassKg,
    remainingMassKg: round3(bodyMassKg),
    remainingEdibleKg: edibleMassKg,
    remainingScavengeableKg: scavengeableMassKg,
    mirroredCarrionKg: 0,
    freshness: 100,
    createdGameMinute: now,
    lastUpdatedGameMinute: now,
  };
  system.wildCarcasses.push(carcass);
  return carcass;
}

function runAquaticHunt(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  elapsedDays: number,
  tickDemandKg: number,
  currentEdibleKg: number,
  remainingMealBudgetKg: number,
  telemetry: PredatorHuntTelemetry,
): { edibleKg: number; kills: number } {
  const captureRate = Math.max(0, species.aquaticCaptureRatePerAdultDay || 0);
  const maxShare = clamp01(species.maxAquaticDietShare || 0);
  if (captureRate <= 0 || maxShare <= 0 || remainingMealBudgetKg <= 0) return { edibleKg: 0, kills: 0 };
  const system = ensureWildPredators(state);
  const current = system.subareasById[population.currentSubareaId];
  const waterAccess = clamp01(((current?.environment.waterAccess || 0) - 20) / 75);
  if (waterAccess <= 0) return { edibleKg: 0, kills: 0 };

  const equivalentPredators = equivalentPredatorCount(population);
  const needDrive = clamp01((tickDemandKg - currentEdibleKg) / Math.max(0.001, tickDemandKg));
  const hungerDrive = clamp01(population.hungerStress / 100);
  const huntDrive = clamp01(needDrive * 0.82 + hungerDrive * 0.18) * waterAccess;
  const aquaticBudgetKg = Math.min(remainingMealBudgetKg, tickDemandKg * maxShare);
  if (aquaticBudgetKg <= 0.001 || huntDrive <= 0) return { edibleKg: 0, kills: 0 };

  population.aquaticHuntAttemptProgress = Math.max(0, population.aquaticHuntAttemptProgress || 0)
    + equivalentPredators * captureRate * elapsedDays * huntDrive;
  const attempts = Math.floor(population.aquaticHuntAttemptProgress);
  population.aquaticHuntAttemptProgress -= attempts;
  let consumed = 0;
  let kills = 0;

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    if (consumed >= aquaticBudgetKg) break;
    const ordinal = telemetry.attempts + 1;
    telemetry.attempts = ordinal;
    const random = mulberry32(hashString(`${population.id}:${gameMinute(state)}:${system.ecologyTickIndex}:${ordinal}:aquatic-hunt`));
    const target = weightedPick(collectAquaticHuntTargets(state, population, species), entry => entry.targetWeight, random);
    if (!target) {
      telemetry.lastOutcome = 'no_target';
      continue;
    }
    const encounterChance = clamp01(0.12 + target.searchability * 0.82);
    telemetry.lastTargetSpeciesId = target.prey.speciesId;
    telemetry.lastEncounterChance = round3(encounterChance);
    if (random() >= encounterChance) {
      telemetry.lastOutcome = 'no_encounter';
      continue;
    }
    telemetry.encounters += 1;
    const preyTelemetry = ensurePreyTelemetry(telemetry, target.prey.speciesId);
    preyTelemetry.encounters += 1;
    const stages = eligibleAquaticStages(target.prey, species);
    const stage = weightedPick(stages, row => row.weight, random);
    if (!stage || target.prey.population <= 3) {
      telemetry.lastOutcome = 'no_attack';
      continue;
    }
    telemetry.attacks += 1;
    preyTelemetry.attacks += 1;
    telemetry.lastTargetLifeStage = stage.stage;
    const condition = clamp01(population.bodyCondition / 100 * 0.55 + population.averageHealth / 100 * 0.45);
    const sizeRatio = clamp01(stage.bodyMassKg / Math.max(0.1, species.maxAdultPreyKg));
    const sizeFactor = clamp01(1.08 - sizeRatio * 0.48);
    const stageFactor = stage.stage === 'juvenile' ? 1.1 : stage.stage === 'old' ? 1.03 : 0.92;
    const preyVigor = 0.82 + (1 - clamp01(target.prey.bodyCondition / 100)) * 0.18;
    const attackSuccessChance = clamp01((0.4 + condition * 0.4) * sizeFactor * stageFactor * preyVigor * (0.72 + waterAccess * 0.28));
    telemetry.lastAttackSuccessChance = round3(attackSuccessChance);
    if (random() >= attackSuccessChance) {
      telemetry.lastOutcome = 'failed_attack';
      continue;
    }
    const bodyMassKg = removeOneAquaticPrey(target.prey, stage.stage);
    if (bodyMassKg <= 0) {
      telemetry.lastOutcome = 'no_attack';
      continue;
    }
    const carcass = createAquaticCarcass(state, population, target.prey, stage.stage, bodyMassKg, target.waterNodeId);
    const immediateMealKg = consumeCarcass(system, carcass, aquaticBudgetKg - consumed);
    consumed += immediateMealKg;
    mirrorNewCarcass(system, carcass);
    kills += 1;
    telemetry.successfulKills += 1;
    telemetry.successfulKillsByLifeStage[stage.stage] = (telemetry.successfulKillsByLifeStage[stage.stage] || 0) + 1;
    preyTelemetry.successfulKills += 1;
    telemetry.edibleConsumedKg = round3(telemetry.edibleConsumedKg + immediateMealKg);
    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';
  }
  return { edibleKg: round3(consumed), kills };
}

'''
text = replace_once(text, insert_anchor, aquatic_helpers + insert_anchor, 'aquatic hunt helpers')

text = replace_once(
    text,
    "  const tickDemandKg = Math.max(0.001, dailyDemandKg * elapsedDays);\n  const reserveCapacity = Math.max(0.001, population.maxEnergyReserveKg || 0.001);\n",
    "  const tickDemandKg = Math.max(0.001, dailyDemandKg * elapsedDays);\n  let kills = 0;\n  const aquatic = runAquaticHunt(\n    state, population, species, elapsedDays, tickDemandKg, edibleKg, remainingMealBudgetKg, telemetry,\n  );\n  edibleKg += aquatic.edibleKg;\n  remainingMealBudgetKg = Math.max(0, remainingMealBudgetKg - aquatic.edibleKg);\n  kills += aquatic.kills;\n\n  const reserveCapacity = Math.max(0.001, population.maxEnergyReserveKg || 0.001);\n",
    'aquatic hunt call',
)
text = replace_once(
    text,
    "  const attempts = Math.floor(population.huntAttemptProgress);\n  population.huntAttemptProgress -= attempts;\n  let kills = 0;\n\n",
    "  const attempts = Math.floor(population.huntAttemptProgress);\n  population.huntAttemptProgress -= attempts;\n\n",
    'shared kill counter',
)
path.write_text(text)

# --- scripts/predator-hunt-event-probe.ts --------------------------------------
path = Path('scripts/predator-hunt-event-probe.ts')
text = path.read_text()
text = replace_once(
    text,
    "import { finalizeLivingHydrologyState, prepareLivingHydrologyState } from '../src/simulation/livingHydrologyBridge';\n",
    "import { finalizeLivingHydrologyState, prepareLivingHydrologyState } from '../src/simulation/livingHydrologyBridge';\nimport { tickAquaticEcologyAtEnvironmentalScale } from '../src/simulation/environmentalScaleSystem';\n",
    'probe aquatic import',
)
text = replace_once(
    text,
    "    finalizeLivingHydrologyState(state);\n    tickWildFaunaWithStableFoodWebClock(state, minutes);\n",
    "    finalizeLivingHydrologyState(state);\n    tickAquaticEcologyAtEnvironmentalScale(state, minutes);\n    tickWildFaunaWithStableFoodWebClock(state, minutes);\n",
    'probe aquatic pipeline',
)
fauna_anchor = "function main(): void {\n"
aquatic_snapshot = r'''function aquaticSnapshot(state: GameState) {
  const rows = new Map<string, { speciesId: string; population: number; biomassKg: number; populations: number }>();
  for (const population of state.ecologySystem?.aquaticPopulations || []) {
    const row = rows.get(population.speciesId) || { speciesId: population.speciesId, population: 0, biomassKg: 0, populations: 0 };
    row.population += Math.max(0, population.population);
    row.biomassKg += Math.max(0, population.biomassKg);
    if (population.population > 0) row.populations += 1;
    rows.set(population.speciesId, row);
  }
  return [...rows.values()].map(row => ({ ...row, population: round3(row.population), biomassKg: round3(row.biomassKg) }))
    .sort((a, b) => a.speciesId.localeCompare(b.speciesId));
}

function aquaticFoodWebSnapshot(state: GameState) {
  const rows = Object.values(state.ecologySystem?.aquaticFoodWebByNodeId || {});
  return {
    nodes: rows.length,
    detritusKg: round3(rows.reduce((sum, row) => sum + row.detritusKg, 0)),
    benthicInvertebratesKg: round3(rows.reduce((sum, row) => sum + row.benthicInvertebratesKg, 0)),
    zooplanktonKg: round3(rows.reduce((sum, row) => sum + row.zooplanktonKg, 0)),
    carrionKg: round3(rows.reduce((sum, row) => sum + row.carrionKg, 0)),
  };
}

'''
text = replace_once(text, fauna_anchor, aquatic_snapshot + fauna_anchor, 'probe aquatic snapshots')
text = replace_once(
    text,
    "  const baselineFauna = faunaSnapshot(state);\n  const baselineHunts = huntSnapshot(state);\n",
    "  const baselineFauna = faunaSnapshot(state);\n  const baselineAquatic = aquaticSnapshot(state);\n  const baselineAquaticFoodWeb = aquaticFoodWebSnapshot(state);\n  const baselineHunts = huntSnapshot(state);\n",
    'probe aquatic baseline',
)
text = replace_once(
    text,
    "  const currentFauna = faunaSnapshot(state);\n  const report = {\n",
    "  const currentFauna = faunaSnapshot(state);\n  const currentAquatic = aquaticSnapshot(state);\n  const currentAquaticFoodWeb = aquaticFoodWebSnapshot(state);\n  const report = {\n",
    'probe aquatic current',
)
text = replace_once(
    text,
    "    baselineFauna,\n    currentFauna,\n    activeCarcasses: carcasses.length,\n",
    "    baselineFauna,\n    currentFauna,\n    baselineAquaticSpecies: baselineAquatic.filter(row => row.population > 0).length,\n    currentAquaticSpecies: currentAquatic.filter(row => row.population > 0).length,\n    baselineAquaticPopulation: round3(baselineAquatic.reduce((sum, row) => sum + row.population, 0)),\n    currentAquaticPopulation: round3(currentAquatic.reduce((sum, row) => sum + row.population, 0)),\n    baselineAquatic,\n    currentAquatic,\n    baselineAquaticFoodWeb,\n    currentAquaticFoodWeb,\n    activeCarcasses: carcasses.length,\n",
    'probe aquatic report',
)
path.write_text(text)
