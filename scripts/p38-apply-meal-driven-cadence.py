from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# Reserve capacity must no longer be derived from a fixed kill cadence.
path = Path('src/simulation/ecologyPredatorSystem.ts')
s = path.read_text()
old = '''/**
 * Intermittent feeders can bank a larger fraction of a successful kill. The
 * reserve horizon is derived from the existing kill cadence rather than adding a
 * second per-species tuning table. The cadence multiplier includes room for
 * normal search/refugia gaps so a predator is not forced into daily feeding.
 */
export function getPredatorEnergyReserveDays(species: WildPredatorSpeciesDefinition): number {
  const expectedKillIntervalDays = 1 / Math.max(0.03, species.maxKillsPerAdultPerDay);
  return round3(Math.max(3, Math.min(24, expectedKillIntervalDays * 1.75)));
}
'''
new = '''/**
 * P3.8: reserve horizon is a metabolic/body-size property, not a hidden copy of
 * hunt cadence. Larger intermittent feeders can bank more food-days from a big
 * meal, while smaller active predators carry a shorter buffer. Hunt timing is
 * decided separately from secured food-days in the discrete hunting system.
 */
export function getPredatorEnergyReserveDays(species: WildPredatorSpeciesDefinition): number {
  const metabolicMassDays = species.adultWeightKg / Math.max(0.05, species.dailyFoodKgPerAdult);
  return round3(Math.max(3, Math.min(24, Math.sqrt(metabolicMassDays) * 1.15)));
}
'''
s = replace_once(s, old, new, 'reserve horizon')
path.write_text(s)


path = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
s = path.read_text()
s = replace_once(
    s,
    "const BASE_EXPECTED_ATTEMPT_SUCCESS = 0.22;\nconst MIN_CARCASS_FRESHNESS_TO_FEED = 15;\n",
    "const MIN_CARCASS_FRESHNESS_TO_FEED = 15;\n",
    'remove fixed attempt-success cadence constant',
)

anchor = '''function supplementalAvailableKg(
'''
helpers = '''function ownedCarcassEdibleKg(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
): number {
  const system = ensureWildPredators(state);
  const homeRange = new Set(population.homeRangeSubareaIds.length ? population.homeRangeSubareaIds : [population.currentSubareaId]);
  homeRange.add(population.currentSubareaId);
  return round3((system.wildCarcasses || [])
    .filter(carcass => carcass.killerPopulationId === population.id)
    .filter(carcass => carcass.remainingEdibleKg > 0 && carcass.freshness >= MIN_CARCASS_FRESHNESS_TO_FEED)
    .filter(carcass => {
      if (homeRange.has(carcass.subareaId)) return true;
      const subarea = system.subareasById[carcass.subareaId];
      return Boolean(subarea && riparianForagingAccess(system, population, species, subarea) > 0);
    })
    .reduce((sum, carcass) => {
      // Very stale meat is less reliable as future secured food even before it
      // reaches the hard feeding cutoff.
      const freshnessReliability = clamp01((carcass.freshness - MIN_CARCASS_FRESHNESS_TO_FEED) / 70);
      return sum + carcass.remainingEdibleKg * (0.55 + freshnessReliability * 0.45);
    }, 0));
}

function securedFoodCoverageDays(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  currentEdibleKg = 0,
  tickDemandKg = 0,
): number {
  const equivalentPredators = equivalentPredatorCount(population);
  const dailyDemandKg = Math.max(0.001, species.dailyFoodKgPerAdult * equivalentPredators);
  const storedReserveKg = Math.max(0, population.energyReserveKg || 0);
  const ownedCarcassKg = ownedCarcassEdibleKg(state, population, species);
  // Food already eaten for this tick only extends future rest once immediate
  // maintenance has been covered; otherwise it is current-day fuel, not reserve.
  const currentSurplusKg = Math.max(0, currentEdibleKg - Math.max(0, tickDemandKg));
  return Math.max(0, (storedReserveKg + ownedCarcassKg + currentSurplusKg) / dailyDemandKg);
}

function mealDrivenHuntReadiness(
  state: GameState,
  population: WildPredatorPopulation,
  species: WildPredatorSpeciesDefinition,
  currentEdibleKg: number,
  tickDemandKg: number,
): number {
  const securedDays = securedFoodCoverageDays(state, population, species, currentEdibleKg, tickDemandKg);
  // Below ~0.1 secured days the cohort is effectively ready to hunt. Around one
  // full food-day the normal hunt drive is almost completely suppressed. This
  // makes a small prey item create only a short pause while a large carcass can
  // naturally produce multi-day rest through the remaining edible biomass.
  const normalReadiness = securedDays <= 0.1
    ? 1
    : clamp01((1.2 - securedDays) / 1.1);
  // Severe hunger can override part of the rest signal. This is important for
  // aggregate populations where one large carcass may not physically feed every
  // individual even though the cohort owns it.
  const hungerOverride = clamp01((population.hungerStress - 62) / 38) * 0.82;
  return Math.max(normalReadiness, hungerOverride);
}

function activeSearchAttemptsPerAdultDay(species: WildPredatorSpeciesDefinition): number {
  // Search capacity is activity/roaming driven rather than a desired kill quota.
  // Failure creates no cooldown, so an unsuccessful predator can keep searching;
  // successful prey size determines the pause through secured food-days instead.
  return Math.max(1.2, Math.min(3.4, 1.4 + species.roamingPerDay * 1.6));
}

'''
s = replace_once(s, anchor, helpers + anchor, 'meal-driven cadence helpers')

old_aquatic_drive = '''  const realmDrive = maxShare > 0 ? Math.sqrt(clamp01(effectiveAquaticShare / maxShare)) : 0;
  const huntDrive = clamp01(needDrive * 0.82 + hungerDrive * 0.18) * waterAccess * realmDrive;
  const aquaticBudgetKg = Math.min(remainingMealBudgetKg, tickDemandKg * effectiveAquaticShare);
'''
new_aquatic_drive = '''  const realmDrive = maxShare > 0 ? Math.sqrt(clamp01(effectiveAquaticShare / maxShare)) : 0;
  const cadenceReadiness = mealDrivenHuntReadiness(state, population, species, currentEdibleKg, tickDemandKg);
  const huntDrive = clamp01(needDrive * 0.82 + hungerDrive * 0.18) * waterAccess * realmDrive * cadenceReadiness;
  const aquaticBudgetKg = Math.min(remainingMealBudgetKg, tickDemandKg * effectiveAquaticShare);
'''
s = replace_once(s, old_aquatic_drive, new_aquatic_drive, 'aquatic meal readiness')

old_aquatic_success = '''    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';
  }
  return { edibleKg: round3(consumed), kills };
}
'''
new_aquatic_success = '''    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';

    // A successful large meal creates its own cooldown. Small prey normally do
    // not cross this threshold, so the population can continue searching soon.
    const securedDaysAfterKill = securedFoodCoverageDays(
      state, population, species, currentEdibleKg + consumed, tickDemandKg,
    );
    if (securedDaysAfterKill >= 0.8 && population.hungerStress < 85) break;
  }
  return { edibleKg: round3(consumed), kills };
}
'''
s = replace_once(s, old_aquatic_success, new_aquatic_success, 'aquatic post-meal rest')

old_attempts = '''  const attemptsPerPredatorDay = species.maxKillsPerAdultPerDay / BASE_EXPECTED_ATTEMPT_SUCCESS;
  population.huntAttemptProgress = Math.max(0, population.huntAttemptProgress || 0)
    + equivalentPredators * attemptsPerPredatorDay * elapsedDays * huntDrive;
  const attempts = Math.floor(population.huntAttemptProgress);
  population.huntAttemptProgress -= attempts;
'''
new_attempts = '''  const cadenceReadiness = mealDrivenHuntReadiness(state, population, species, edibleKg, tickDemandKg);
  const searchAttemptsPerPredatorDay = activeSearchAttemptsPerAdultDay(species);
  population.huntAttemptProgress = Math.max(0, population.huntAttemptProgress || 0)
    + equivalentPredators * searchAttemptsPerPredatorDay * elapsedDays * huntDrive * cadenceReadiness;
  // Do not let a long simulation step dump an unbounded backlog of attempts at
  // once. This is a safety envelope only; it does not prescribe successful kills.
  const safetyAttemptCap = Math.max(1, Math.ceil(equivalentPredators * elapsedDays * 4));
  const attempts = Math.min(Math.floor(population.huntAttemptProgress), safetyAttemptCap);
  population.huntAttemptProgress = Math.max(0, population.huntAttemptProgress - attempts);
'''
s = replace_once(s, old_attempts, new_attempts, 'terrestrial dynamic attempt cadence')

old_terrestrial_success = '''    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';
  }

  telemetry.edibleConsumedKg = round3(telemetry.edibleConsumedKg + returningCarcassEdibleKg);
'''
new_terrestrial_success = '''    telemetry.carcassBiomassCreatedKg = round3(telemetry.carcassBiomassCreatedKg + bodyMassKg);
    telemetry.lastOutcome = 'success';

    const securedDaysAfterKill = securedFoodCoverageDays(state, population, species, edibleKg, tickDemandKg);
    if (securedDaysAfterKill >= 0.8 && population.hungerStress < 85) break;
  }

  telemetry.edibleConsumedKg = round3(telemetry.edibleConsumedKg + returningCarcassEdibleKg);
'''
s = replace_once(s, old_terrestrial_success, new_terrestrial_success, 'terrestrial post-meal rest')

path.write_text(s)
