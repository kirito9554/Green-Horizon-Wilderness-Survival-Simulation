import type { GameState } from '../types';
import type { EcologicalSubarea, WildAnimalPopulation, WildPredatorPopulation } from '../types/ecologySimulation';
import { WILD_PREDATOR_SPECIES, type WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import {
  getPredatorHabitatSuitability,
  predatorCompetitionMultiplier,
  preyRefugiaMultiplier,
  typeIIIPredationResponse,
} from './ecologyPredatorSystem';

export type PredatorHungerBottleneck =
  | 'none'
  | 'prey_localization'
  | 'prey_scarcity'
  | 'low_prey_density'
  | 'prey_refugia'
  | 'competition'
  | 'water'
  | 'habitat'
  | 'mixed';

export interface PredatorPreyTelemetry {
  speciesId: string;
  population: number;
  biomassKg: number;
  weightedBiomassKg: number;
  preference: number;
  densityPer1000M2: number;
  functionalResponse: number;
  refugiaMultiplier: number;
  huntingPressureScore: number;
}

export interface PredatorHungerTelemetry {
  populationId: string;
  speciesId: string;
  poiId: string;
  currentSubareaId: string;
  population: number;
  biomassKg: number;
  hungerStress: number;
  waterStress: number;
  bodyCondition: number;
  migrationPressure: number;
  humanFear: number;
  currentPreferredPreyBiomassKg: number;
  homeRangePreferredPreyBiomassKg: number;
  currentPatchPreyShare: number;
  competitionMultiplier: number;
  averageFunctionalResponse: number;
  averageRefugiaMultiplier: number;
  waterRatio: number;
  habitatSuitability: number;
  estimatedDailyFoodDemandKg: number;
  huntingOpportunityRatio: number;
  bottleneck: PredatorHungerBottleneck;
  prey: PredatorPreyTelemetry[];
}

export interface PredatorHungerGroupSummary {
  key: string;
  populations: number;
  individuals: number;
  biomassKg: number;
  unweightedHunger: number;
  populationWeightedHunger: number;
  biomassWeightedHunger: number;
  populationWeightedOpportunity: number;
  populationWeightedCurrentPatchShare: number;
  highStressIndividuals: number;
}

export interface PredatorHungerSummary {
  populations: number;
  individuals: number;
  biomassKg: number;
  unweightedHunger: number;
  populationWeightedHunger: number;
  biomassWeightedHunger: number;
  highStressIndividuals: number;
  bottlenecks: Partial<Record<PredatorHungerBottleneck, number>>;
  bySpecies: PredatorHungerGroupSummary[];
  byPoi: PredatorHungerGroupSummary[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function preyAt(state: GameState, subareaId: string, species: WildPredatorSpeciesDefinition): WildAnimalPopulation[] {
  return (state.ecologySystem?.animalPopulations || [])
    .filter(population => population.currentSubareaId === subareaId && population.population > 0)
    .filter(population => (species.preyWeights[population.speciesId] || 0) > 0);
}

function weightedPreyBiomass(prey: WildAnimalPopulation[], species: WildPredatorSpeciesDefinition): number {
  return prey.reduce((sum, population) => sum + population.biomassKg * (species.preyWeights[population.speciesId] || 0), 0);
}

function homeRangePreyBiomass(state: GameState, population: WildPredatorPopulation, species: WildPredatorSpeciesDefinition): number {
  const system = state.ecologySystem;
  if (!system) return 0;
  const ids = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  return (system.animalPopulations || [])
    .filter(prey => prey.population > 0 && ids.has(prey.currentSubareaId))
    .reduce((sum, prey) => sum + prey.biomassKg * (species.preyWeights[prey.speciesId] || 0), 0);
}

function telemetryForPrey(
  prey: WildAnimalPopulation,
  subarea: EcologicalSubarea,
  species: WildPredatorSpeciesDefinition,
): PredatorPreyTelemetry {
  const preference = species.preyWeights[prey.speciesId] || 0;
  const densityPer1000M2 = prey.population / Math.max(0.1, subarea.areaM2 / 1000);
  const functionalResponse = typeIIIPredationResponse(densityPer1000M2, species.halfSaturationPreyPer1000M2);
  const refugiaMultiplier = preyRefugiaMultiplier(prey.population, species.minimumViablePreyCount, subarea.environment.canopyCover);
  return {
    speciesId: prey.speciesId,
    population: prey.population,
    biomassKg: round3(prey.biomassKg),
    weightedBiomassKg: round3(prey.biomassKg * preference),
    preference: round3(preference),
    densityPer1000M2: round3(densityPer1000M2),
    functionalResponse: round3(functionalResponse),
    refugiaMultiplier: round3(refugiaMultiplier),
    huntingPressureScore: round3(preference * functionalResponse * refugiaMultiplier * (0.35 + prey.bodyCondition / 150)),
  };
}

function weightedAverage(rows: PredatorPreyTelemetry[], selector: (row: PredatorPreyTelemetry) => number): number {
  const weight = rows.reduce((sum, row) => sum + Math.max(0.001, row.weightedBiomassKg), 0);
  if (weight <= 0) return 0;
  return rows.reduce((sum, row) => sum + selector(row) * Math.max(0.001, row.weightedBiomassKg), 0) / weight;
}

function classifyBottleneck(args: {
  hungerStress: number;
  currentBiomass: number;
  homeRangeBiomass: number;
  currentPatchShare: number;
  competition: number;
  functional: number;
  refugia: number;
  water: number;
  habitat: number;
}): PredatorHungerBottleneck {
  if (args.hungerStress < 45) return 'none';
  if (args.currentBiomass <= 0.05 && args.homeRangeBiomass > 0.5) return 'prey_localization';
  if (args.homeRangeBiomass <= 0.5) return 'prey_scarcity';
  if (args.currentPatchShare < 0.12) return 'prey_localization';
  if (args.water < 0.42) return 'water';
  if (args.competition < 0.42) return 'competition';
  if (args.functional < 0.28) return 'low_prey_density';
  if (args.refugia < 0.48) return 'prey_refugia';
  if (args.habitat < 0.34) return 'habitat';
  return 'mixed';
}

export function collectPredatorHungerTelemetry(state: GameState): PredatorHungerTelemetry[] {
  const system = state.ecologySystem;
  if (!system) return [];
  const result: PredatorHungerTelemetry[] = [];

  for (const population of system.predatorPopulations || []) {
    if (population.population <= 0) continue;
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    const subarea = system.subareasById[population.currentSubareaId];
    if (!species || !subarea) continue;

    const localPrey = preyAt(state, population.currentSubareaId, species);
    const prey = localPrey.map(entry => telemetryForPrey(entry, subarea, species));
    const currentPreferredPreyBiomassKg = weightedPreyBiomass(localPrey, species);
    const homeRangePreferredPreyBiomassKg = homeRangePreyBiomass(state, population, species);
    const currentPatchPreyShare = homeRangePreferredPreyBiomassKg > 0
      ? clamp01(currentPreferredPreyBiomassKg / homeRangePreferredPreyBiomassKg)
      : 0;
    const competitionMultiplier = predatorCompetitionMultiplier(
      population.biomassKg,
      currentPreferredPreyBiomassKg,
      species.idealPredatorPreyBiomassRatio,
    );
    const averageFunctionalResponse = weightedAverage(prey, row => row.functionalResponse);
    const averageRefugiaMultiplier = weightedAverage(prey, row => row.refugiaMultiplier);
    const waterRatio = clamp01(subarea.environment.waterAccess / Math.max(20, species.dailyWaterNeed));
    const habitatSuitability = getPredatorHabitatSuitability(subarea, species);
    const equivalentPredators = population.adults + population.old * 0.82 + population.juveniles * 0.38;
    const estimatedDailyFoodDemandKg = species.dailyFoodKgPerAdult * equivalentPredators;

    // This deliberately measures continuous hunting opportunity, not actual last-tick intake.
    // P1 must remain read-only. P2 can introduce energy accounting and true stored intake state.
    const huntingOpportunityRatio = clamp01(
      averageFunctionalResponse
      * averageRefugiaMultiplier
      * competitionMultiplier
      * clamp01(currentPreferredPreyBiomassKg / Math.max(0.25, estimatedDailyFoodDemandKg * 8)),
    );

    result.push({
      populationId: population.id,
      speciesId: population.speciesId,
      poiId: population.poiId,
      currentSubareaId: population.currentSubareaId,
      population: population.population,
      biomassKg: round3(population.biomassKg),
      hungerStress: round3(population.hungerStress),
      waterStress: round3(population.waterStress),
      bodyCondition: round3(population.bodyCondition),
      migrationPressure: round3(population.migrationPressure),
      humanFear: round3(population.humanFear),
      currentPreferredPreyBiomassKg: round3(currentPreferredPreyBiomassKg),
      homeRangePreferredPreyBiomassKg: round3(homeRangePreferredPreyBiomassKg),
      currentPatchPreyShare: round3(currentPatchPreyShare),
      competitionMultiplier: round3(competitionMultiplier),
      averageFunctionalResponse: round3(averageFunctionalResponse),
      averageRefugiaMultiplier: round3(averageRefugiaMultiplier),
      waterRatio: round3(waterRatio),
      habitatSuitability: round3(habitatSuitability),
      estimatedDailyFoodDemandKg: round3(estimatedDailyFoodDemandKg),
      huntingOpportunityRatio: round3(huntingOpportunityRatio),
      bottleneck: classifyBottleneck({
        hungerStress: population.hungerStress,
        currentBiomass: currentPreferredPreyBiomassKg,
        homeRangeBiomass: homeRangePreferredPreyBiomassKg,
        currentPatchShare: currentPatchPreyShare,
        competition: competitionMultiplier,
        functional: averageFunctionalResponse,
        refugia: averageRefugiaMultiplier,
        water: waterRatio,
        habitat: habitatSuitability,
      }),
      prey,
    });
  }

  return result.sort((a, b) => b.hungerStress - a.hungerStress || a.speciesId.localeCompare(b.speciesId) || a.populationId.localeCompare(b.populationId));
}

function summarizeGroup(key: string, rows: PredatorHungerTelemetry[]): PredatorHungerGroupSummary {
  const individuals = rows.reduce((sum, row) => sum + row.population, 0);
  const biomassKg = rows.reduce((sum, row) => sum + row.biomassKg, 0);
  const weighted = (weight: (row: PredatorHungerTelemetry) => number, value: (row: PredatorHungerTelemetry) => number) => {
    const totalWeight = rows.reduce((sum, row) => sum + weight(row), 0);
    if (totalWeight <= 0) return 0;
    return rows.reduce((sum, row) => sum + value(row) * weight(row), 0) / totalWeight;
  };
  return {
    key,
    populations: rows.length,
    individuals: round3(individuals),
    biomassKg: round3(biomassKg),
    unweightedHunger: round3(rows.length ? rows.reduce((sum, row) => sum + row.hungerStress, 0) / rows.length : 0),
    populationWeightedHunger: round3(weighted(row => row.population, row => row.hungerStress)),
    biomassWeightedHunger: round3(weighted(row => row.biomassKg, row => row.hungerStress)),
    populationWeightedOpportunity: round3(weighted(row => row.population, row => row.huntingOpportunityRatio)),
    populationWeightedCurrentPatchShare: round3(weighted(row => row.population, row => row.currentPatchPreyShare)),
    highStressIndividuals: round3(rows.filter(row => row.hungerStress >= 72).reduce((sum, row) => sum + row.population, 0)),
  };
}

function groupBy(rows: PredatorHungerTelemetry[], selector: (row: PredatorHungerTelemetry) => string): PredatorHungerGroupSummary[] {
  const groups = new Map<string, PredatorHungerTelemetry[]>();
  for (const row of rows) {
    const key = selector(row);
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => summarizeGroup(key, group))
    .sort((a, b) => b.populationWeightedHunger - a.populationWeightedHunger || a.key.localeCompare(b.key));
}

export function summarizePredatorHungerTelemetry(rows: PredatorHungerTelemetry[]): PredatorHungerSummary {
  const total = summarizeGroup('all', rows);
  const bottlenecks: Partial<Record<PredatorHungerBottleneck, number>> = {};
  for (const row of rows) bottlenecks[row.bottleneck] = (bottlenecks[row.bottleneck] || 0) + row.population;
  for (const key of Object.keys(bottlenecks) as PredatorHungerBottleneck[]) bottlenecks[key] = round3(bottlenecks[key] || 0);

  return {
    populations: total.populations,
    individuals: total.individuals,
    biomassKg: total.biomassKg,
    unweightedHunger: total.unweightedHunger,
    populationWeightedHunger: total.populationWeightedHunger,
    biomassWeightedHunger: total.biomassWeightedHunger,
    highStressIndividuals: total.highStressIndividuals,
    bottlenecks,
    bySpecies: groupBy(rows, row => row.speciesId),
    byPoi: groupBy(rows, row => row.poiId),
  };
}
