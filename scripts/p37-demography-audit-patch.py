from pathlib import Path

core = Path('src/simulation/predatorDiscreteHuntingSystem.ts')
s = core.read_text()

needle = "  population.reproductionPressure = clamp(mateFactor * densityFactor * condition * foodFactor * 100);\n"
insert = needle + r'''  const p37AuditMinute = gameMinute(state);
  const p37AuditStepMinutes = Math.max(1, Math.round(elapsedDays * 1440));
  if (p37AuditMinute % (30 * 1440) < p37AuditStepMinutes) {
    const p37Audit = population as WildPredatorPopulation & { p37P4MortalityAdded?: number };
    console.log('[P37:SNAPSHOT]' + JSON.stringify({
      day: state.gameTime.day,
      speciesId: population.speciesId,
      population: population.population,
      juveniles: population.juveniles,
      adults: population.adults,
      old: population.old,
      carryingCapacity,
      density: round3(density),
      hunger: round3(population.hungerStress),
      waterStress: round3(population.waterStress),
      bodyCondition: round3(population.bodyCondition),
      health: round3(population.averageHealth),
      reserveRatio: round3((population.energyReserveKg || 0) / Math.max(0.001, population.maxEnergyReserveKg || 0.001)),
      migrationPressure: round3(population.migrationPressure),
      reproductionPressure: round3(population.reproductionPressure),
      reproductionProgress: round3(population.reproductionProgress),
      mortalityProgress: round3(population.mortalityProgress),
      p4MortalityAdded: round3(p37Audit.p37P4MortalityAdded || 0),
    }));
  }
'''
if s.count(needle) != 1:
    raise SystemExit(f'reproduction pressure marker count={s.count(needle)}')
s = s.replace(needle, insert, 1)

needle = "    births = Math.min(births, Math.max(0, Math.ceil(carryingCapacity * 1.08 - population.population)));\n    population.juveniles += births;\n"
insert = "    births = Math.min(births, Math.max(0, Math.ceil(carryingCapacity * 1.08 - population.population)));\n    if (births > 0) console.log('[P37:BIRTH]' + JSON.stringify({ day: state.gameTime.day, speciesId: population.speciesId, births, carryingCapacity, populationBefore: population.population, reproductionPressure: round3(population.reproductionPressure) }));\n    population.juveniles += births;\n"
if s.count(needle) != 1:
    raise SystemExit(f'birth marker count={s.count(needle)}')
s = s.replace(needle, insert, 1)

needle = "  let deaths = Math.min(population.population, Math.floor(population.mortalityProgress));\n  if (deaths > 0) {\n    population.mortalityProgress -= deaths;\n"
insert = r'''  let deaths = Math.min(population.population, Math.floor(population.mortalityProgress));
  if (deaths > 0) {
    const p37Audit = population as WildPredatorPopulation & { p37P4MortalityAdded?: number };
    console.log('[P37:DEATH]' + JSON.stringify({
      day: state.gameTime.day,
      speciesId: population.speciesId,
      deaths,
      populationBefore: population.population,
      juveniles: population.juveniles,
      adults: population.adults,
      old: population.old,
      hunger: round3(population.hungerStress),
      waterStress: round3(population.waterStress),
      health: round3(population.averageHealth),
      starvationRate: round3(starvation),
      dehydrationRate: round3(dehydration),
      oldMortalityRate: round3(oldMortality),
      healthMortalityRate: round3(healthMortality),
      mortalityProgressBeforeFloor: round3(population.mortalityProgress),
      p4MortalityAddedTotal: round3(p37Audit.p37P4MortalityAdded || 0),
    }));
    population.mortalityProgress -= deaths;
'''
if s.count(needle) != 1:
    raise SystemExit(f'death marker count={s.count(needle)}')
s = s.replace(needle, insert, 1)
core.write_text(s)

p4 = Path('src/simulation/predatorPressureResponseSystem.ts')
s = p4.read_text()

needle = "      const removed = removeDispersers(population, wholeDispersers);\n      response.totalEmigrants += removed;\n"
insert = "      const removed = removeDispersers(population, wholeDispersers);\n      if (removed > 0) console.log('[P37:DISPERSAL]' + JSON.stringify({ gameMinute: response.lastUpdatedGameMinute, speciesId: population.speciesId, removed, populationAfter: population.population, chronicStressDays: response.chronicStressDays, severity: round3(severity), migrationPressure: round3(population.migrationPressure) }));\n      response.totalEmigrants += removed;\n"
if s.count(needle) != 1:
    raise SystemExit(f'dispersal marker count={s.count(needle)}')
s = s.replace(needle, insert, 1)

needle = r'''    population.mortalityProgress += population.population
      * severity
      * chronicMortalityGate
      * elapsedDays
      * 0.00035;
'''
insert = r'''    const p37P4Increment = population.population
      * severity
      * chronicMortalityGate
      * elapsedDays
      * 0.00035;
    population.mortalityProgress += p37P4Increment;
    const p37Audit = population as WildPredatorPopulation & { p37P4MortalityAdded?: number };
    p37Audit.p37P4MortalityAdded = (p37Audit.p37P4MortalityAdded || 0) + p37P4Increment;
'''
if s.count(needle) != 1:
    raise SystemExit(f'P4 mortality marker count={s.count(needle)}')
s = s.replace(needle, insert, 1)
p4.write_text(s)
