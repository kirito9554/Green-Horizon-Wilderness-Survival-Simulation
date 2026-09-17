# Spatial Fauna Community

This document defines the metric terrestrial-fauna system for the 120 km² procedural island. It covers both the generated whole-island census and the persistent living patch-cohort runtime. The legacy subarea food web remains only as a compatibility layer for systems, especially predators, that have not yet migrated.

## Why this layer exists

The original terrestrial fauna runtime was built around small materialized ecological subareas. Its species definitions use `baseDensityPer1000M2` plus small `maxInitialPopulation` caps. Those caps are useful for the old sample-grid runtime but cannot represent a 120 km² island literally: even suitable habitat was commonly clamped to a few dozen animals per population.

The spatial world has real metric patch area, terrain, Local Site habitat signals and a deterministic world seed, so fauna abundance can instead be derived from actual habitat area.

The census rule is:

```text
metric habitat area
× species prime-habitat density / km²
× generated patch suitability
× macro-region affinity
= local carrying capacity
```

Counts are **aggregate cohort counts**, not one JavaScript entity per animal. Runtime cost therefore scales mainly with `species × occupied habitat patches`, while an island can contain tens of thousands of tracked animals.

## Species catalog

`src/data/spatialFauna.ts` currently contains **24 terrestrial tracked species**: the seven legacy herbivore/omnivore species plus seventeen additional species spanning large herbivores/omnivores, small mammals and rodents, ground and canopy birds, fruit bats, reptiles, amphibians and large terrestrial invertebrates.

The seven legacy species are Wild Boar, Feral Goat, Agouti, Wild Rabbit, Feral Chicken, Feral Duck and Tree Rat. Additional tracked species include Flying Fox, Small Fruit Bat, Fruit Dove, Ground Dove, Island Rail, Forest Quail, Forest Hornbill, Large Forest Rodent, Bamboo Rat, Palm Squirrel, Mouse Deer, Forest Gecko, Forest Skink, Ground Frog, Tree Frog, Coconut Crab and Marsh Turtle.

This is deliberately a **tracked fauna layer**, not a claim that the island contains only 24 terrestrial animal species. Insects, other invertebrates and microfauna can remain biomass/guild pools until an individual species needs gameplay or food-web identity.

## Metric density instead of legacy population caps

Each spatial fauna definition has `densityPerKm2`, interpreted as a game-scale prime-habitat carrying density. It is separate from the legacy `baseDensityPer1000M2` field and is never clamped by the old `maxInitialPopulation` value.

Small species can therefore reach populations of thousands where connected habitat supports them. Large, disturbance-sensitive or habitat-specialist animals remain much rarer because their density and suitable area are lower.

Each species also defines broad fauna guild, ecological target profile, macro-region affinity, diet, deterministic world-presence probability, minimum patch suitability, minimum island K, starting occupancy, body size and life-history metadata.

## Patch suitability and Local Site influence

`src/simulation/spatial/spatialFaunaCommunity.ts` calculates suitability from the generated world rather than assigning a fixed population to a named POI.

Patch suitability combines terrain/environment fit, guild-specific habitat signals, Local Site influence such as forage/water/breeding/refuge, macro-region affinity and disturbance tolerance. Two campaigns with the same ten macro regions can therefore have different local fauna distributions because terrain, hydrology and Local Sites differ by world seed.

## Island, region and patch census

For every species the generator produces island carrying capacity, starting population below K, occupied patch count, exact integer population/K per habitat patch and exact aggregation by canonical macro region.

Integer allocation conserves totals across all levels:

```text
sum(patch population) = region totals = island population
sum(patch K)          = region K      = island K
```

Rare species may be absent from a particular campaign when the world lacks enough suitable habitat or its deterministic presence roll fails.

The deterministic CI census currently produces:

- `spatial-fauna-alpha`: **23/24 species, 49,347 initial individuals, K 66,193**;
- `spatial-fauna-beta`: **23/24 species, 46,438 initial individuals, K 65,472**.

These totals exclude aquatic populations, predators and untracked background insects/microfauna.

## Persistent living patch cohorts

`src/types/spatialFaunaSimulation.ts` and `src/simulation/spatial/spatialFaunaRuntime.ts` materialize the census as compact persistent patch cohorts in `GameState.spatialFaunaSystem`.

Each occupied species/patch stores only:

```text
[juveniles, adults, old, condition, stressDays]
```

Everything else is derived for the daily tick. The alpha seed starts with roughly **4,699 occupied cohorts** while serialized fauna state remains about **282 KiB**, rather than creating ~49,000 animal entities.

The daily runtime implements juvenile → adult → old transitions, life-history natural mortality, condition/stress response, breeding with effective breeder and nearby-mate availability, dry/wet/monsoon seasonality, patch food/water/refuge/breeding suitability, adjacency dispersal, cross-region movement and bounded diagnostic history.

The game-state bridge processes fauna only on day boundaries and catches up missed days in order. The same world seed and elapsed day horizon reproduce the same aggregate cohort history.

Before shared competition is applied, the lower-level demographic regression gives the alpha seed day 365 **46,109 / K 66,193** with all **23/23** present species retained, and day 1,800 **41,476 / K 66,193** with 23/23 retained without predator pressure. This lower-level test remains useful because it isolates cohort demography from the community-interaction layer.

## Shared patch resource competition

A species cannot now treat patch food/water/refuge as a private copy of the environment.

`src/simulation/spatial/spatialFaunaCompetition.ts` builds a start-of-day shared community load for every occupied patch. The census K is treated as the **calibrated coexistence baseline** rather than introducing another arbitrary global carrying-capacity multiplier.

Competition channels are intentionally different:

1. **Food** — competitor demand is weighted by metabolic headcount, daily food requirement and normalized diet overlap. Species with little diet overlap contribute little to one another's food pressure.
2. **Water** — all co-located animals contribute their metabolic water demand to the same patch pressure.
3. **Refuge** — occupancy is weighted by ecological guild overlap so species using similar shelter/space niches interfere more strongly.

Pressure is expressed relative to the corresponding K-derived baseline. At or below the designed coexistence load, the interaction layer does **not** add another penalty. Above baseline, a smooth factor reduces effective food/water/refuge sufficiency and persistent condition.

`src/simulation/spatial/spatialFaunaEcosystemRuntime.ts` applies competition **before** each demographic day. The core tick therefore sees the changed condition/stress immediately, so mortality, breeding readiness and stress-driven dispersal can react on the same simulated day. Competition diagnostics are then attached to the daily telemetry.

The regression includes an intentional overload test. In `spatial-fauna-alpha`, a co-located Wild Boar/Agouti pair starts with focal food pressure **0.863**. Artificially overloading the overlapping competitor raises focal food pressure to **1.996** and reduces the food sufficiency factor to **0.477**, while leaving the focal population itself untouched before the pressure calculation. This verifies that the response is genuinely interspecific.

Normal one-year worlds do not receive a hidden island-wide debuff:

- alpha day 365: **46,109 / 66,193**, 23/23 species; peak population-weighted mean pressures food **0.781**, water **0.793**, refuge **0.753**; at most 230 individuals were inside locally competition-limited cohorts on a sampled day;
- beta day 365: **45,241 / 65,472**, 23/23 species; peak mean pressures food **0.775**, water **0.781**, refuge **0.726**; at most 587 individuals were inside locally competition-limited cohorts.

The important result is spatial: most of the island stays below its calibrated coexistence load while local crowding/niche skew can still create real scarcity.

Diet-overlap and life-history baseline calculations are cached by species/pair. The ecological state remains cohort-level; caching changes cost, not results. Full workflow run **35180934854** passed with the cached implementation, including the competition regression and every existing ecology/predator/aquatic/build test.

## Current resource-model boundary

Shared competition is **not yet a conserved biomass stock simulation**. It is an interaction layer inferred from patch K, real species food/water needs and niche overlap.

The project already has dynamic Local Site resource state, but those stocks are not yet the single persistent source consumed by fauna, player gathering and other ecological guilds. Pretending otherwise would double-count resources or force the old sample-grid food assumptions back into the 120 km² world.

The next resource migration should therefore create shared patch productivity/stock pools for the ecological resource families actually consumed by fauna, then let cohort demand draw from those same pools before regeneration/recruitment restores them.

## Compatibility boundary

The metric system is now the living world-scale terrestrial-fauna runtime. `simEngine.ts` advances it before the legacy terrestrial ecology block.

The old `ecologyFaunaSystem` and predator systems still run as a compatibility food web for gameplay/systems that have not migrated. They must not be interpreted as a second literal population census and their populations are not added to the metric island totals.

The legacy predator model has **not** yet been connected to the 24-species patch community. Predator migration remains deferred until prey/resource dynamics are stable enough that predation pressure can be measured against actual spatial prey availability rather than the old subarea menu.

## Next migration phase

The next coherent steps are:

1. replace K-inferred competition capacity with persistent patch food/water/resource productivity where the underlying resource family exists;
2. connect fauna demand to those stocks and let harvesting/season/weather alter the same resource budget;
3. strengthen movement into explicit feeding/drinking/refuge/breeding patch selection and seasonal redistribution;
4. expose only locally encountered groups/individuals to gameplay;
5. migrate predators onto the same patch world, using search → encounter → attack rather than omniscient prey selection;
6. validate biomass/energy flow, local extirpation/recolonization and predator competition before retiring the compatibility runtime.

The core design remains: **the island contains ecologically meaningful animal populations at world scale, while gameplay materializes only animals and encounters that matter locally.**
