import type { GameState } from '../types';
import type { PopulationDemographyTelemetry } from '../types/ecologyDemographyTelemetry';

export interface PopulationDemographyDiagnostic {
  realm: 'fauna' | 'predator';
  populationId: string;
  speciesId: string;
  poiId: string;
  currentSubareaId: string;
  population: number;
  juveniles: number;
  adults: number;
  old: number;
  effectiveBreeders: number;
  effectiveBreedingFemales: number;
  reproductionProgress: number;
  breedingEvents: number;
  recruits: number;
  maturedJuveniles: number;
  deathsByCause: PopulationDemographyTelemetry['deathsByCause'];
  deathsByLifeStage: PopulationDemographyTelemetry['deathsByLifeStage'];
  predationDeathsByLifeStage: PopulationDemographyTelemetry['predationDeathsByLifeStage'];
  emigrants: number;
  daysSinceRecruitment: number;
  daysWithoutBreeder: number;
  recruitmentEfficiency: number;
  replacementRatio: number;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function collectPopulationDemographyDiagnostics(
  state: GameState,
): PopulationDemographyDiagnostic[] {
  const system = state.ecologySystem;
  if (!system) return [];
  const rows: PopulationDemographyDiagnostic[] = [];
  for (const [realm, populations] of [
    ['fauna', system.animalPopulations || []],
    ['predator', system.predatorPopulations || []],
  ] as const) {
    for (const population of populations) {
      const telemetry = population.demographyTelemetry;
      rows.push({
        realm,
        populationId: population.id,
        speciesId: population.speciesId,
        poiId: population.poiId,
        currentSubareaId: population.currentSubareaId,
        population: population.population,
        juveniles: population.juveniles,
        adults: population.adults,
        old: population.old,
        effectiveBreeders: round3(telemetry?.effectiveBreeders || 0),
        effectiveBreedingFemales: round3(telemetry?.effectiveBreedingFemales || 0),
        reproductionProgress: round3(population.reproductionProgress),
        breedingEvents: round3(telemetry?.breedingEvents || 0),
        recruits: round3(telemetry?.recruits || 0),
        maturedJuveniles: round3(telemetry?.maturedJuveniles || 0),
        deathsByCause: { ...(telemetry?.deathsByCause || {}) },
        deathsByLifeStage: { ...(telemetry?.deathsByLifeStage || {}) },
        predationDeathsByLifeStage: { ...(telemetry?.predationDeathsByLifeStage || {}) },
        emigrants: round3(telemetry?.emigrants || 0),
        daysSinceRecruitment: round3(telemetry?.daysSinceRecruitment || 0),
        daysWithoutBreeder: round3(telemetry?.daysWithoutBreeder || 0),
        recruitmentEfficiency: round3(telemetry?.recruitmentEfficiency || 0),
        replacementRatio: round3(telemetry?.replacementRatio ?? 1),
      });
    }
  }
  return rows.sort((a, b) => a.realm.localeCompare(b.realm)
    || a.speciesId.localeCompare(b.speciesId)
    || a.populationId.localeCompare(b.populationId));
}
