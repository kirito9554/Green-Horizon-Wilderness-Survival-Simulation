# Spatial Fauna Community

This document defines the first metric fauna layer for the 120 km² procedural island. It is intentionally a **census and carrying-capacity foundation**, not yet the live replacement for the legacy subarea fauna tick.

## Why this layer exists

The original terrestrial fauna runtime was built around small materialized ecological subareas. Its species definitions use `baseDensityPer1000M2` plus small `maxInitialPopulation` caps. Those caps are useful for the old sample-grid runtime but cannot represent a 120 km² island literally: even suitable habitat was commonly clamped to a few dozen animals per population.

The spatial world now has real metric patch area, terrain, local-site habitat signals and deterministic world seeds, so fauna abundance can instead be derived from actual habitat area.

The new rule is:

```text
metric habitat area
× species prime-habitat density / km²
× generated patch suitability
× macro-region affinity
= local carrying capacity
```

Counts are **aggregate cohort counts**, not one JavaScript entity per animal. Runtime cost therefore scales mainly with `species × habitat patches`, while an island can still contain tens of thousands of tracked animals.

## Species catalog

`src/data/spatialFauna.ts` currently contains **24 terrestrial tracked species**: the seven legacy herbivore/omnivore species plus seventeen additional species.

The expanded community covers:

- large herbivores / large omnivores;
- small mammals and rodents;
- ground birds and canopy birds;
- fruit bats;
- reptiles;
- amphibians;
- large terrestrial invertebrates.

The seven legacy species are bridged into the metric catalog without changing their existing live runtime yet:

- Wild Boar
- Feral Goat
- Agouti
- Wild Rabbit
- Feral Chicken
- Feral Duck
- Tree Rat

Additional tracked species currently include:

- Flying Fox
- Small Fruit Bat
- Fruit Dove
- Ground Dove
- Island Rail
- Forest Quail
- Forest Hornbill
- Large Forest Rodent
- Bamboo Rat
- Palm Squirrel
- Mouse Deer
- Forest Gecko
- Forest Skink
- Ground Frog
- Tree Frog
- Coconut Crab
- Marsh Turtle

This is still a deliberately selective **tracked fauna layer**, not a claim that the island contains only 24 terrestrial animal species. Insects, other invertebrates and microfauna can remain biomass/guild pools until individual species need gameplay or food-web identity.

## Metric density instead of legacy population caps

Each spatial fauna definition has `densityPerKm2`, interpreted as a game-scale prime-habitat carrying density. It is separate from the legacy `baseDensityPer1000M2` field and is never clamped by the old `maxInitialPopulation` value.

Small species can therefore reach populations of thousands where large connected habitat supports them. Large, disturbance-sensitive or habitat-specialist animals remain much rarer because their density and suitable area are lower.

Each species also defines:

- broad fauna guild;
- ecological target profile;
- macro-region affinity;
- diet;
- deterministic per-world presence probability for non-universal species;
- minimum patch suitability;
- minimum island carrying capacity;
- starting occupancy range below K;
- body size and life-history metadata retained for later live simulation migration.

## Patch suitability and Local Site influence

`src/simulation/spatial/spatialFaunaCommunity.ts` calculates suitability from the generated world rather than assigning a fixed population to a named POI.

Patch suitability combines:

1. terrain/environment fit against the species target profile;
2. guild-specific habitat signals such as forage, cover, moisture and aquatic access;
3. Local Site influence such as breeding habitat, prey refuge, water and decomposition hotspots;
4. authored macro-region affinity;
5. disturbance tolerance.

A species is only allocated to patches above its minimum suitability. This means two campaigns with the same ten macro regions can have different local carrying-capacity maps because terrain, hydrology and Local Sites differ by world seed.

## Island, region and patch census

For every species the generator produces:

- island carrying capacity;
- initial aggregate population below K;
- occupied patch count;
- exact integer population and K per habitat patch;
- exact aggregation by canonical macro region.

Integer allocation conserves totals across all levels:

```text
sum(patch population) = region totals = island population
sum(patch K)          = region K      = island K
```

Rare species may be absent from a particular campaign when the world lacks enough suitable habitat or its deterministic presence roll fails. Common species remain consistent where the generated island supports them.

## Current census scale

The CI regression currently exercises two deterministic worlds.

`spatial-fauna-alpha`:

- 23 / 24 tracked species present;
- **49,347** initial terrestrial individuals;
- island terrestrial K **66,193**.

Largest tracked populations in that seed include Ground Frog 9,069, Tree Rat 7,213, Tree Frog 6,524, Forest Gecko 6,357, Forest Skink 3,987 and Small Fruit Bat 3,956.

`spatial-fauna-beta`:

- 23 / 24 tracked species present;
- **46,438** initial terrestrial individuals;
- island terrestrial K **65,472**.

The difference comes from procedural habitat geometry/suitability and deterministic species presence/occupancy, not from a global random multiplier.

These totals deliberately exclude aquatic populations, predators and untracked background insects/microfauna. The tracked terrestrial community is therefore already an order of magnitude larger than the previous tiny capped runtime without materializing tens of thousands of entities.

## Compatibility boundary

This phase does **not** inject the metric census into `ecologyFaunaSystem.ts` yet.

The old system currently owns live feeding, reproduction, movement and predator-facing prey records for the seven legacy species. Replacing only its population numbers would massively increase food demand while still using the old sample-grid food-web assumptions, producing a misleading balance failure.

For now:

```text
GeneratedSpatialWorld.faunaCommunity
= authoritative metric census / future spatial ecology baseline

legacy ecologyFaunaSystem
= compatibility live runtime until migration
```

The seventeen new tracked species therefore exist in the spatial census but are not yet independently ticking as legacy `WildAnimalPopulation` records.

## Next migration phase

The live migration should happen as a coherent patch-ecology step:

1. create persistent patch/cohort fauna state from the metric census;
2. move food/water demand onto patch resource productivity rather than legacy sample pools;
3. make animals select feeding, drinking, refuge and breeding patches/sites;
4. add patch adjacency dispersal and seasonal movement;
5. expose only locally encountered groups/individuals to gameplay;
6. migrate predators onto the same patch world and broaden their diets to the expanded prey community;
7. validate biomass/energy flow and predator pressure before removing the compatibility runtime.

This preserves the core design goal: **the island contains ecologically meaningful animal populations at world scale, while gameplay only materializes the animals and encounters that matter locally.**
