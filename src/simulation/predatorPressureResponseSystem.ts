import type { GameState } from '../types';
import type { EcologicalSubarea, WildAnimalPopulation, WildPredatorPopulation, WorldEcologyState } from '../types/ecologySimulation';
import { WILD_PREDATOR_SPECIES, type WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import {
  ensurePredatorEnergyState,
  ensureWildPredators,
  getPredatorHabitatSuitability,
  getPredatorHuntingAccessibility,
  predatorCompetitionMultiplier,
} from './ecologyPredatorSystem';
import { tickWildPredatorsDiscrete } from './predatorDiscreteHuntingSystem';

const RESPONSE_VERSION = 1;

interface PredatorPressurePopulationState {
  chronicStressDays: number;
  dispersalProgress: number;
  totalEmigrants: number;
  lastUpdatedGameMinute: number;
  lastExpandedGameMinute?: number;
}

interface PredatorPressureResponseState {
  version: number;
  populationsById: Record<string, PredatorPressurePopulationState>;
}

type PressureAwareWorldEcologyState = WorldEcologyState & {
  predatorPressureResponse?: PredatorPressureResponseState;
};

export interface PredatorPressureResponseDiagnostic {
  populationId: string;
  speciesId: string;
  population: number;
  chronicStressDays: number;
  totalEmigrants: number;
  accessiblePreferredPreyBiomassKg: number;
  competitionMultiplier: number;
  stressSeverity: number;
  homeRangeSize: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function ensureResponseState(system: PressureAwareWorldEcologyState): PredatorPressureResponseState {
  system.predatorPressureResponse ||= {
    version: RESPONSE_VERSION,
    populationsById: {},
  };
  system.predatorPressureResponse.version = RESPONSE_VERSION;
  return system.predatorPressureResponse;
}

function ensurePopulationResponseState(
  state: PredatorPressureResponseState,
  population: WildPredatorPopulation,
  now: number,
): PredatorPressurePopulationState {
  return state.populationsById[population.id] ||= {
    chronicStressDays: 0,
    dispersalProgress: 0,
    totalEmigrants: 0,
    lastUpdatedGameMinute: now,
  };
}

function accessiblePreferredPreyBiomass(
  system: WorldEcologyState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): number {
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  return (system.animalPopulations || [])
    .filter(prey => prey.population > 0 && homeRange.has(prey.currentSubareaId))
    .reduce((sum, prey) => {
      const preference = species.preyWeights[prey.speciesId] || 0;
      if (preference <= 0) return sum;
      const accessibility = getPredatorHuntingAccessibility(system, population, species, prey.currentSubareaId);
      return sum + prey.biomassKg * preference * accessibility;
    }, 0);
}

function pressureSignals(
  system: WorldEcologyState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
) {
  const accessiblePrey = accessiblePreferredPreyBiomass(system, population, species);
  const competition = predatorCompetitionMultiplier(
    population.biomassKg,
    accessiblePrey,
    species.idealPredatorPreyBiomassRatio,
  );
  // Current resource pressure should dominate the chronic response. Body
  // condition is deliberately a weak lagging signal so a population can recover
  // once food/water/competition improve instead of remaining self-locked by the
  // damage caused during an earlier shortage.
  const hungerSeverity = clamp01((population.hungerStress - 62) / 38);
  const competitionSeverity = clamp01((0.7 - competition) / 0.56);
  const waterSeverity = clamp01((population.waterStress - 74) / 26);
  const conditionSeverity = clamp01((42 - population.bodyCondition) / 30);
  const severity = Math.max(
    hungerSeverity,
    competitionSeverity * 0.85,
    waterSeverity * 0.55,
    conditionSeverity * 0.25,
  );
  return { accessiblePrey, competition, severity };
}

function neighborIds(system: WorldEcologyState, subareaId: string): string[] {
  const result: string[] = [];
  for (const connection of system.connections) {
    if (connection.fromSubareaId === subareaId) result.push(connection.toSubareaId);
    else if (connection.toSubareaId === subareaId) result.push(connection.fromSubareaId);
  }
  return result;
}

function preyBiomassAt(
  system: WorldEcologyState,
  subareaId: string,
  species: WildPredatorSpeciesDefinition,
): number {
  return (system.animalPopulations || [])
    .filter(prey => prey.currentSubareaId === subareaId && prey.population > 0)
    .reduce((sum, prey) => sum + prey.biomassKg * (species.preyWeights[prey.speciesId] || 0), 0);
}

function tryExpandHomeRange(
  state: GameState,
  system: WorldEcologyState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  response: PredatorPressurePopulationState,
  now: number,
): boolean {
  const range = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  range.add(population.currentSubareaId);
  if (range.size >= species.homeRangeMax) return false;
  if (response.chronicStressDays < 2 || population.migrationPressure < 50) return false;
  if (response.lastExpandedGameMinute !== undefined && now - response.lastExpandedGameMinute < 3 * 1440) return false;

  const region = system.regionsByPoiId[population.poiId];
  if (!region) return false;
  const allowed = new Set(region.subareaIds);
  const candidates = new Set<string>();
  for (const id of range) {
    for (const neighborId of neighborIds(system, id)) {
      if (allowed.has(neighborId) && !range.has(neighborId)) candidates.add(neighborId);
    }
  }
  const best = [...candidates]
    .map(id => system.subareasById[id])
    .filter((subarea): subarea is EcologicalSubarea => Boolean(subarea && subarea.materializationState === 'materialized'))
    .map(subarea => {
      const habitat = getPredatorHabitatSuitability(subarea, species);
      const preySupport = clamp01(preyBiomassAt(system, subarea.id, species) / Math.max(0.2, species.dailyFoodKgPerAdult * 8));
      const water = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));
      return { subarea, score: habitat * 0.5 + preySupport * 0.4 + water * 0.1 };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.2) return false;

  population.homeRangeSubareaIds = [...range, best.subarea.id];
  population.migrationPressure = Math.max(0, population.migrationPressure - 8);
  response.lastExpandedGameMinute = now;
  return true;
}

function removeDispersers(
  population: WildPredatorPopulation,
  count: number,
): number {
  let remaining = Math.min(Math.max(0, count), Math.max(0, population.population - 1));
  if (remaining <= 0) return 0;
  let removed = 0;

  const adult = Math.min(population.adults, remaining);
  population.adults -= adult;
  remaining -= adult;
  removed += adult;

  const juvenile = Math.min(population.juveniles, remaining);
  population.juveniles -= juvenile;
  remaining -= juvenile;
  removed += juvenile;

  const old = Math.min(population.old, remaining);
  population.old -= old;
  removed += old;
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  return removed;
}

function recomputePredatorBiomass(population: WildPredatorPopulation, species: WildPredatorSpeciesDefinition): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45));
}

function updateChronicStress(response: PredatorPressurePopulationState, severity: number, elapsedDays: number): void {
  const recoveryThreshold = 0.36;
  if (severity >= recoveryThreshold) {
    // Severe resource pressure still accumulates quickly, while moderate residual
    // condition damage no longer keeps an otherwise recovering population stuck
    // in chronic stress indefinitely.
    const accumulationRate = 0.35 + severity * 0.45;
    response.chronicStressDays = Math.min(120, response.chronicStressDays + elapsedDays * severity * accumulationRate);
  } else {
    // Healthy days should erase pressure memory faster than it accumulated once
    // food, water and competition recover. This preserves hysteresis without
    // leaving a population chronically stressed for most of a year after relief.
    const recoveryRate = 1.6 + (recoveryThreshold - severity) * 3.4;
    response.chronicStressDays = Math.max(0, response.chronicStressDays - elapsedDays * recoveryRate);
  }
  response.chronicStressDays = round3(response.chronicStressDays);
}

function applyDispersalAndMortality(
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  response: PredatorPressurePopulationState,
  severity: number,
  elapsedDays: number,
): void {
  if (population.population <= 0) return;

  // Relieve true density pressure earlier so an over-dense cohort can leave before
  // starvation damage becomes the dominant population control. Healthy cohorts
  // still need both migration pressure and sustained resource stress to disperse.
  const chronicGate = clamp01((response.chronicStressDays - 10) / 28);
  const migrationGate = clamp01((population.migrationPressure - 58) / 32);
  if (chronicGate > 0 && migrationGate > 0 && severity > 0.4) {
    const roamingFactor = 0.65 + clamp01(species.roamingPerDay / 1.2) * 0.55;
    response.dispersalProgress += population.population
      * severity
      * chronicGate
      * migrationGate
      * roamingFactor
      * elapsedDays
      * 0.003;
    const wholeDispersers = Math.floor(response.dispersalProgress);
    if (wholeDispersers > 0) {
      response.dispersalProgress -= wholeDispersers;
      const removed = removeDispersers(population, wholeDispersers);
      response.totalEmigrants += removed;
      if (removed > 0) population.migrationPressure = Math.max(0, population.migrationPressure - Math.min(24, removed * 5));
    }
  }

  // Once dispersal is available, chronic mortality is the secondary safety valve,
  // not the first response. Delay and soften it so density can self-correct first.
  const chronicMortalityGate = clamp01((response.chronicStressDays - 36) / 52);
  if (chronicMortalityGate > 0 && severity > 0.65) {
    population.mortalityProgress += population.population
      * severity
      * chronicMortalityGate
      * elapsedDays
      * 0.00035;
  }

  recomputePredatorBiomass(population, species);
  ensurePredatorEnergyState(population, species);
}

export function tickPredatorPressureResponse(state: GameState, _deltaGameMinutes: number): void {
  const system = ensureWildPredators(state) as PressureAwareWorldEcologyState;
  const responseState = ensureResponseState(system);
  const now = gameMinute(state);
  const liveIds = new Set<string>();

  for (const population of system.predatorPopulations || []) {
    if (population.population <= 0) continue;
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    if (!species) continue;
    liveIds.add(population.id);
    const response = ensurePopulationResponseState(responseState, population, now);
    const elapsedMinutes = Math.max(0, now - response.lastUpdatedGameMinute);
    response.lastUpdatedGameMinute = now;
    if (elapsedMinutes <= 0) continue;
    const elapsedDays = elapsedMinutes / 1440;
    const signals = pressureSignals(system, population, species);
    updateChronicStress(response, signals.severity, elapsedDays);
    const expanded = tryExpandHomeRange(state, system, population, species, response, now);
    if (!expanded) applyDispersalAndMortality(population, species, response, signals.severity, elapsedDays);
  }

  for (const id of Object.keys(responseState.populationsById)) {
    if (!liveIds.has(id) && !(system.predatorPopulations || []).some(population => population.id === id)) {
      delete responseState.populationsById[id];
    }
  }
}

export function tickWildPredatorsWithPressureResponse(state: GameState, deltaGameMinutes: number): void {
  tickWildPredatorsDiscrete(state, deltaGameMinutes);
  tickPredatorPressureResponse(state, deltaGameMinutes);
}

export function getPredatorPressureResponseDiagnostics(state: GameState): PredatorPressureResponseDiagnostic[] {
  const system = state.ecologySystem as PressureAwareWorldEcologyState | undefined;
  if (!system) return [];
  const responseState = system.predatorPressureResponse;
  return (system.predatorPopulations || [])
    .filter(population => population.population > 0)
    .map(population => {
      const species = WILD_PREDATOR_SPECIES[population.speciesId];
      if (!species) return undefined;
      const meta = responseState?.populationsById[population.id];
      const signals = pressureSignals(system, population, species);
      return {
        populationId: population.id,
        speciesId: population.speciesId,
        population: population.population,
        chronicStressDays: round3(meta?.chronicStressDays || 0),
        totalEmigrants: meta?.totalEmigrants || 0,
        accessiblePreferredPreyBiomassKg: round3(signals.accessiblePrey),
        competitionMultiplier: round3(signals.competition),
        stressSeverity: round3(signals.severity),
        homeRangeSize: population.homeRangeSubareaIds.length,
      };
    })
    .filter((entry): entry is PredatorPressureResponseDiagnostic => Boolean(entry))
    .sort((a, b) => b.chronicStressDays - a.chronicStressDays || a.populationId.localeCompare(b.populationId));
}
