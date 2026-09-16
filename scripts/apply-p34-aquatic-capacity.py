from pathlib import Path

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)

path = Path('src/data/ecologyAquatic.ts')
text = path.read_text()
# Make catfish a true river-estuary connector instead of a rarely seeded freshwater-only population.
text = rep(
    text,
    "    preferredHabitats: ['flowing_channel', 'standing_water'],\n    hydrologyCriteria: { minDepthM: 0.35, maxDepthM: 8, minDissolvedOxygenMgL: 2.5, maxVelocityMps: 1.25, maxSalinityPpt: 6, maxTurbidity: 92, maxContamination: 58, minimumPassability: 0.18 },\n    idealTemperatureC: [23, 31], temperatureToleranceC: 6, minimumBreedingReliability: 0.46,\n",
    "    preferredHabitats: ['flowing_channel', 'standing_water', 'tidal_water'],\n    hydrologyCriteria: { minDepthM: 0.28, maxDepthM: 9, minDissolvedOxygenMgL: 2.2, maxVelocityMps: 1.55, maxSalinityPpt: 18, maxTurbidity: 94, maxContamination: 60, minimumPassability: 0.12 },\n    idealTemperatureC: [23, 32], temperatureToleranceC: 6, minimumBreedingReliability: 0.38,\n",
    'catfish estuary habitat',
)
anchor = """  AQUATIC_BARRAMUNDI: {
"""
mullet = """  AQUATIC_MANGROVE_MULLET: {
    id: 'AQUATIC_MANGROVE_MULLET', name: 'Mangrove Mullet', trophicGuild: 'omnivore', adultWeightKg: 1.6,
    maturityDays: 280, oldAgeDays: 1900, baseDensityPer100M3: 7.5, maxPopulationPerBody: 650,
    preferredHabitats: ['tidal_water', 'flowing_channel', 'standing_water'],
    hydrologyCriteria: { minDepthM: 0.18, maxDepthM: 8, minDissolvedOxygenMgL: 3, maxVelocityMps: 1.45, maxSalinityPpt: 30, maxTurbidity: 88, maxContamination: 52, minimumPassability: 0.12 },
    idealTemperatureC: [23, 32], temperatureToleranceC: 6, minimumBreedingReliability: 0.4,
    dailyReproductionRate: 0.00155, naturalMortalityPerDay: 0.00038, mobility: 0.86, dailyFoodFraction: 0.022,
    diet: { detritus: 0.44, periphyton: 0.24, aquatic_vegetation: 0.14, benthic_invertebrates: 0.18 },
  },
"""
text = rep(text, anchor, mullet + anchor, 'mangrove mullet tier')
path.write_text(text)

path = Path('src/data/ecologyPredators.ts')
text = path.read_text()
# Monitor gets only a light opportunistic relationship with the new medium fish tier.
text = rep(
    text,
    "      AQUATIC_TILAPIA: 0.45,\n      AQUATIC_RIVER_CARP: 0.28,\n      AQUATIC_FRESHWATER_EEL: 0.18,\n",
    "      AQUATIC_TILAPIA: 0.45,\n      AQUATIC_MANGROVE_MULLET: 0.28,\n      AQUATIC_RIVER_CATFISH: 0.18,\n      AQUATIC_RIVER_CARP: 0.28,\n      AQUATIC_FRESHWATER_EEL: 0.18,\n",
    'monitor medium aquatic prey',
)
text = rep(
    text,
    "      AQUATIC_RIVER_CATFISH: 1.12,\n      AQUATIC_LAGOON_SNAPPER: 0.92,\n",
    "      AQUATIC_RIVER_CATFISH: 1.18,\n      AQUATIC_MANGROVE_MULLET: 0.86,\n      AQUATIC_LAGOON_SNAPPER: 0.92,\n",
    'croc mullet preference',
)
text = rep(
    text,
    "    aquaticCaptureRatePerAdultDay: 1.1,\n    maxAquaticDietShare: 0.62,\n",
    "    aquaticCaptureRatePerAdultDay: 1.75,\n    maxAquaticDietShare: 0.7,\n",
    'croc bounded attempt opportunity',
)
path.write_text(text)
