# Spatial Fauna Community

This document defines the metric terrestrial-fauna system for the 120 km² procedural island. It covers the generated whole-island census, persistent living patch cohorts, shared competition and the persistent material food/water pools consumed by those cohorts. The legacy subarea food web remains only as a compatibility layer for systems, especially predators, that have not yet migrated.

## Why this layer exists

The original terrestrial fauna runtime was built around small materialized ecological subareas. Its species definitions use `baseDensityPer1000M2` plus small `maxInitialPopulation` caps. Those caps are useful for the old sample-grid runtime but cannot represent a 120 km² island literally: even suitable habitat was commonly clamped to a few dozen animals per population.

The spatial world has real metric patch area, terrain, Local Site habitat signals and a deterministic world seed, so fauna abundance and its supporting resources can instead be derived from actual habitat area.

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

Everything else is derived for the daily tick. The alpha seed starts with roughly **4,699 occupied cohorts** while serialized fauna-only state is about **282 KiB**, rather than creating ~49,000 animal entities.

The daily runtime implements juvenile → adult → old transitions, life-history natural mortality, condition/stress response, breeding with effective breeder and nearby-mate availability, dry/wet/monsoon seasonality, habitat/refuge/breeding suitability, adjacency dispersal, cross-region movement and bounded diagnostic history.

The game-state bridge processes fauna only on day boundaries and catches up missed days in order. The same world seed and elapsed day horizon reproduce the same aggregate cohort history.

The lower-level demographic regression, which intentionally isolates demography from shared material resources, gives alpha day 365 **46,109 / K 66,193** with all **23/23** present species retained and day 1,800 **41,476 / K 66,193** with 23/23 retained without predator pressure.

## Persistent area-scaled patch resource pools

`src/simulation/spatial/spatialFaunaResourcePools.ts` provides the first conserved material budget for the metric terrestrial fauna runtime.

Each generated habitat patch persists one compact stock tuple:

```text
[
  fruit kg,
  seeds kg,
  browse kg,
  ground vegetation kg,
  roots/tubers kg,
  insects kg,
  aquatic plants kg,
  carrion kg,
  fresh-water units
]
```

Only changing stock is saved. Capacity and productivity are regenerated deterministically from the world seed, actual patch area, generated habitat, hydrology, Local Sites and the metric fauna census. This keeps save size bounded while making the material world reproducible.

### Area is the primary scale

The pool is deliberately **not** a fixed amount per patch. Every standing-stock capacity starts from:

```text
patch area in km²
× resource standing crop per km²
× habitat / hydrology / Local Site potential
```

Food standing-crop coefficients range from sparse carrion through fruit/seeds to much larger browse, ground vegetation and aquatic-plant biomass. Fresh-water capacity also scales with patch area, then receives wetness, water-index, catchment-flow and Local Site water signals.

This means clipping the same nominal 600 m grid into a tiny polygon sliver does not magically create the same resource pool as a 0.3–0.36 km² patch. A large productive patch carries proportionally more standing material.

The current deterministic model is intentionally large enough for a **120 km² tropical island** rather than inheriting sample-grid quantities. The first measured resource regression produced:

- alpha: **67.93 million kg** total food standing capacity;
- beta: **68.25 million kg** total food standing capacity;
- minimum generated patch standing-food density in those worlds: about **310k–345k kg/km²**;
- alpha neutral resource production: about **646k kg/day** across the full island;
- beta neutral resource production: about **652k kg/day**;
- full census-K tracked-fauna food demand is only about **3.0 t/day**.

The large difference is intentional: the stock/productivity layer represents a whole tropical landscape and food-web substrate, whereas the 24 tracked species are only a selected gameplay/ecology census. Predators, aquatic fauna, untracked insects, decomposers/microfauna and future player extraction are not yet all drawing from these pools.

### K is a safety calibration, not the source of biomass

Area/habitat determines the physical-scale pool first. The metric census is then used as a consistency floor:

- each consumed food family has enough standing reserve for its local K demand;
- neutral production cannot be lower than local K demand × **1.35**;
- fresh-water storage cannot be lower than **45 days** of local K water demand;
- neutral water recharge cannot be lower than local K demand × **1.5**.

This prevents a contradiction where the census says a patch can support a population while the resource model says the same patch cannot feed it. It does **not** make K an infinite food generator: all daily consumption still subtracts from the persisted stock.

### Shared consumption and recovery

At the start of each fauna ecosystem day the patch pools recover according to season and local environment, then all co-located cohorts submit their metabolic demand to the same material budget.

Food demand is split through each species' normalized diet. If several species consume fruit, for example, they all draw from the same fruit stock exactly once. The available amount is allocated as a shared satisfaction ratio rather than giving every species a private copy of the fruit pool. Fresh water works the same way at patch level.

Dry/wet/monsoon multipliers alter resource-family recovery differently. Dry season suppresses fruit, vegetation, insects and aquatic production more strongly; wet/monsoon conditions improve most biological/water recovery while preserving resource-specific differences.

Material shortage directly changes persistent cohort condition and stress **before** mortality, breeding and dispersal are processed for the day. This gives later movement and population dynamics a causal material signal rather than a telemetry-only warning.

A 30-day alpha regression consumed about **62.8 t** of food while the large landscape regenerated about **5.57 million kg** into partially empty standing pools. Food and water pools remained around **0.93–0.94 full** under the normal below-K tracked community. Adding the 486 compact patch resource tuples increased the serialized runtime state to roughly **369 KiB**, still well below the regression ceiling.

The stress regression deliberately empties one patch, then derives the artificial overload from that patch's own daily productivity and the selected species' metabolic demand. The test therefore proves material scarcity only when demand exceeds actual local recovery; it no longer relies on an arbitrary fixed `20×K` multiplier.

## Shared patch competition

`src/simulation/spatial/spatialFaunaCompetition.ts` still computes start-of-day community pressure for every occupied patch. The census K remains the calibrated coexistence baseline rather than introducing another arbitrary global carrying-capacity multiplier.

Competition diagnostics distinguish:

1. **Food niche pressure** — metabolic food requirement weighted by normalized diet overlap;
2. **Water pressure** — shared metabolic water demand;
3. **Refuge pressure** — occupancy weighted by ecological guild overlap.

With material pools active, food and water pressure are now **diagnostic only**. Their scarcity effect is owned by the conserved resource stocks so the runtime cannot punish the same shortage twice. Refuge remains a non-consumable shared-space constraint and still modifies condition/stress directly.

The intentional Wild Boar/Agouti overload remains useful as a niche diagnostic: focal food pressure rises from **0.863** to **1.996** and its inferred food factor falls to **0.477** even though the focal cohort itself was not inflated.

Normal one-year ecosystem runs retain all 23 present species in both deterministic worlds while the large material pools remain stable. This is expected at the current tracked-fauna density: the island-scale substrate is much larger than the selected census, while local depletion and future additional consumers can still create spatial scarcity.

## Compatibility boundary

The metric system is now the living world-scale terrestrial-fauna runtime. `simEngine.ts` advances it before the legacy terrestrial ecology block.

The old `ecologyFaunaSystem` and predator systems still run as a compatibility food web for gameplay/systems that have not migrated. They must not be interpreted as a second literal population census and their populations are not added to the metric island totals.

The new fauna food/water pools are also **not yet the same state as player-facing Local Site harvest stocks**. Local Site resource simulation remains the current player extraction model. A later bridge must make fauna use, background ecology and player harvest share the appropriate material budget without double-counting resource families.

The legacy predator model has **not** yet been connected to the 24-species patch community. Predator migration remains deferred until prey/resource dynamics are stable enough that predation pressure can be measured against actual spatial prey availability rather than the old subarea menu.

## Next migration phase

The next coherent steps are:

1. bridge player gathering / Local Site harvest into the corresponding patch material pools so human extraction and fauna draw from one budget;
2. add background/untracked guild turnover where needed so gross landscape productivity is not interpreted as free surplus owned only by the 24 tracked species;
3. strengthen movement into explicit feeding/drinking/refuge/breeding patch selection and seasonal redistribution;
4. expose only locally encountered groups/individuals to gameplay;
5. migrate predators onto the same patch world, using search → encounter → attack rather than omniscient prey selection;
6. validate biomass/energy flow, local extirpation/recolonization and predator competition before retiring the compatibility runtime.

The core design remains: **the island contains ecologically meaningful animal populations and material resources at world scale, while gameplay materializes only animals and encounters that matter locally.**
