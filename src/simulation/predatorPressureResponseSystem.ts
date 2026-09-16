import type { GameState } from '../types';
import type { WildPredatorPopulation } from '../types/ecologySimulation';
import { WILD_PREDATOR_SPECIES, type WildPredatorSpeciesDefinition } from '../data/ecologyPredators';
import * as base from './predatorPressureResponseSystem.p39base';
import { ensurePredatorEnergyState, ensureWildPredators } from './ecologyPredatorSystem';
import { tickWildPredatorsDiscrete } from './predatorDiscreteHuntingSystem';
import {
  accumulateDemographyMortality,
  breederProtectedDispersalPlan,
  ensureDemographyTelemetry,
  recordDemographyEmigration,
  resolveReproductionProfile,
  syncDemographyTelemetry,
} from './ecologyDemographySystem';

export * from './predatorPressureResponseSystem.p39base';

interface PressureTickSnapshot {
  juveniles: number;
  adults: number;
  old: number;
  maleRatio: number;
  migrationPressure: number;
  mortalityProgress: number;
}

type PressureMetadata = {
  predatorPressureResponse?: {
    populationsById: Record<string, {
      totalEmigrants: number;
      dispersalProgress: number;
    }>;
  };
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function snapshotPopulation(population: WildPredatorPopulation): PressureTickSnapshot {
  return {
    juveniles: population.juveniles,
    adults: population.adults,
    old: population.old,
    maleRatio: population.maleRatio,
    migrationPressure: population.migrationPressure,
    mortalityProgress: population.mortalityProgress,
  };
}

function recomputePredatorBiomass(
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): void {
  population.population = Math.max(0, population.juveniles + population.adults + population.old);
  population.biomassKg = round3(
    species.adultWeightKg * (population.adults + population.old * 0.82 + population.juveniles * 0.45),
  );
}

/**
 * P3.9b-1 pressure wrapper. P3.9 still decides whether dispersal happens and
 * how many animals try to leave; this layer changes which cohorts may leave so
 * a head-count guard cannot erase the final effective breeding cohort.
 */
export function tickPredatorPressureResponse(state: GameState, deltaGameMinutes: number): void {
  const systemBefore = ensureWildPredators(state);
  const snapshots = new Map<string, PressureTickSnapshot>();
  for (const population of systemBefore.predatorPopulations || []) {
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    if (species) {
      const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);
      ensureDemographyTelemetry(population, reproduction);
    }
    snapshots.set(population.id, snapshotPopulation(population));
  }

  base.tickPredatorPressureResponse(state, deltaGameMinutes);

  const system = ensureWildPredators(state);
  const pressureMetadata = system as typeof system & PressureMetadata;
  for (const population of system.predatorPopulations || []) {
    const before = snapshots.get(population.id);
    const species = WILD_PREDATOR_SPECIES[population.speciesId];
    if (!before || !species) continue;
    const reproduction = resolveReproductionProfile(species.reproduction, species.offspringPerAdultFemalePerYear);

    const baseRemoved = {
      juvenile: Math.max(0, before.juveniles - population.juveniles),
      adult: Math.max(0, before.adults - population.adults),
      old: Math.max(0, before.old - population.old),
    };
    const baseRemovedTotal = baseRemoved.juvenile + baseRemoved.adult + baseRemoved.old;
    if (baseRemovedTotal > 0) {
      const plan = breederProtectedDispersalPlan(before, baseRemovedTotal, reproduction);
      population.juveniles = Math.max(0, before.juveniles - (plan.juvenile || 0));
      population.adults = Math.max(0, before.adults - (plan.adult || 0));
      population.old = Math.max(0, before.old - (plan.old || 0));
      population.migrationPressure = Math.max(
        0,
        before.migrationPressure - Math.min(24, plan.total * 5),
      );
      recomputePredatorBiomass(population, species);
      ensurePredatorEnergyState(population, species);

      const metadata = pressureMetadata.predatorPressureResponse?.populationsById[population.id];
      if (metadata && plan.total !== baseRemovedTotal) {
        const blocked = Math.max(0, baseRemovedTotal - plan.total);
        metadata.totalEmigrants = Math.max(
          0,
          metadata.totalEmigrants + plan.total - baseRemovedTotal,
        );
        metadata.dispersalProgress = Math.max(0, metadata.dispersalProgress + blocked);
      }
      recordDemographyEmigration(population, reproduction, plan);
    }

    const pressureMortality = Math.max(0, population.mortalityProgress - before.mortalityProgress);
    if (pressureMortality > 0) {
      accumulateDemographyMortality(population, reproduction, { pressure: pressureMortality });
    }
    syncDemographyTelemetry(population, reproduction);
  }
}

export function tickWildPredatorsWithPressureResponse(
  state: GameState,
  deltaGameMinutes: number,
): void {
  tickWildPredatorsDiscrete(state, deltaGameMinutes);
  tickPredatorPressureResponse(state, deltaGameMinutes);
}
