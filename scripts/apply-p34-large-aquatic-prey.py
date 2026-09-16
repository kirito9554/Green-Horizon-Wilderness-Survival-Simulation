from pathlib import Path

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)

path = Path('src/data/ecologyAquatic.ts')
text = path.read_text()
anchor = """  AQUATIC_PARROTFISH: {
"""
addition = """  AQUATIC_RIVER_CATFISH: {
    id: 'AQUATIC_RIVER_CATFISH', name: 'River Catfish', trophicGuild: 'omnivore', adultWeightKg: 3.8,
    maturityDays: 420, oldAgeDays: 2400, baseDensityPer100M3: 3.4, maxPopulationPerBody: 260,
    preferredHabitats: ['flowing_channel', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.35, maxDepthM: 8, minDissolvedOxygenMgL: 2.5, maxVelocityMps: 1.25, maxSalinityPpt: 6, maxTurbidity: 92, maxContamination: 58, minimumPassability: 0.18 },
    idealTemperatureC: [23, 31], temperatureToleranceC: 6, minimumBreedingReliability: 0.46,
    dailyReproductionRate: 0.00105, naturalMortalityPerDay: 0.00032, mobility: 0.72, dailyFoodFraction: 0.019,
    diet: { benthic_invertebrates: 0.34, detritus: 0.24, carrion: 0.22, aquatic_vegetation: 0.08, zooplankton: 0.12 },
    preyWeights: { AQUATIC_FRESHWATER_PRAWN: 0.7, AQUATIC_FORAGE_FISH: 0.5 },
  },
  AQUATIC_BARRAMUNDI: {
    id: 'AQUATIC_BARRAMUNDI', name: 'Barramundi', trophicGuild: 'mesopredator', adultWeightKg: 7.5,
    maturityDays: 620, oldAgeDays: 3600, baseDensityPer100M3: 1.55, maxPopulationPerBody: 180,
    preferredHabitats: ['tidal_water', 'flowing_channel', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.45, maxDepthM: 14, minDissolvedOxygenMgL: 3.8, maxVelocityMps: 1.65, maxSalinityPpt: 28, maxTurbidity: 78, maxContamination: 42, minimumPassability: 0.22 },
    idealTemperatureC: [24, 31], temperatureToleranceC: 5, minimumBreedingReliability: 0.52,
    dailyReproductionRate: 0.00048, naturalMortalityPerDay: 0.0002, mobility: 0.92, dailyFoodFraction: 0.014,
    diet: { benthic_invertebrates: 0.48, carrion: 0.32, zooplankton: 0.2 },
    preyWeights: { AQUATIC_FORAGE_FISH: 1, AQUATIC_FRESHWATER_PRAWN: 0.62, AQUATIC_TILAPIA: 0.42, AQUATIC_MUD_CRAB: 0.25 },
  },
"""
text = rep(text, anchor, addition + anchor, 'large aquatic species')
path.write_text(text)

path = Path('src/data/ecologyPredators.ts')
text = path.read_text()
old = """    aquaticPreyWeights: {
      AQUATIC_LAGOON_SNAPPER: 1,
      AQUATIC_RIVER_CARP: 0.95,
      AQUATIC_FRESHWATER_EEL: 0.9,
      AQUATIC_TILAPIA: 0.82,
      AQUATIC_PARROTFISH: 0.7,
      AQUATIC_MUD_CRAB: 0.55,
      AQUATIC_FORAGE_FISH: 0.42,
      AQUATIC_FRESHWATER_PRAWN: 0.24,
    },
"""
new = """    aquaticPreyWeights: {
      AQUATIC_BARRAMUNDI: 1.35,
      AQUATIC_RIVER_CATFISH: 1.12,
      AQUATIC_LAGOON_SNAPPER: 0.92,
      AQUATIC_RIVER_CARP: 0.88,
      AQUATIC_FRESHWATER_EEL: 0.82,
      AQUATIC_TILAPIA: 0.62,
      AQUATIC_PARROTFISH: 0.52,
      AQUATIC_MUD_CRAB: 0.34,
      AQUATIC_FORAGE_FISH: 0.16,
      AQUATIC_FRESHWATER_PRAWN: 0.08,
    },
"""
text = rep(text, old, new, 'croc large prey preference')
path.write_text(text)
