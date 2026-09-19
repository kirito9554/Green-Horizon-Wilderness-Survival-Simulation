# Spatial Terrestrial Food Web

This document defines the authoritative terrestrial ecology runtime for the canonical **120 km²** island. The spatial patch world now owns tracked terrestrial fauna, living flora, insects, predators and the material food/water budget that connects them. The old BuildGrid/subarea animal and predator systems remain in the codebase for compatibility reads and isolated regressions, but `simEngine.ts` no longer advances them.

## Runtime ownership

`GameState.spatialFaunaSystem` is the persistent root of the terrestrial food web. It contains:

- aggregate prey/herbivore/omnivore cohorts by habitat patch;
- living flora populations by species/guild and patch;
- living insect biomass by functional guild and patch;
- predator cohorts by patch with food reserve and condition;
- shared patch food, carrion and fresh-water stocks;
- bounded daily telemetry/history.

The generated community reports `legacyRuntimeSpeciesCount = 0`. Seven historical fauna definitions still reuse authored life-history values from `ecologyFauna.ts`; they are explicitly counted as **catalog bridges**, not as legacy runtime ownership.

The whole interaction layer has its own `interactionVersion`. Saves created before the authoritative trophic runtime are deterministically regenerated from the persistent world seed instead of carrying the old anonymous food pools into the new food web.

## Tracked terrestrial fauna

`src/data/spatialFauna.ts` contains **24 tracked terrestrial fauna species**: seven historical species plus seventeen additions spanning large herbivores/omnivores, small mammals, ground and canopy birds, bats, reptiles, amphibians and large invertebrates.

Counts are aggregate cohorts, not one JavaScript entity per animal. Each occupied species/patch stores:

```text
[juveniles, adults, old, condition, stressDays]
```

Carrying capacity is derived from real patch area, generated habitat suitability, macro-region affinity and Local Site ecological influence:

```text
metric patch area
× prime-habitat density / km²
× generated suitability
× macro-region affinity
= patch carrying capacity
```

Exact integer allocation conserves population and K from patch → region → island. The lower-level cohort runtime handles maturation, aging, natural mortality, reproduction, condition/stress and adjacency/cross-region dispersal.

## Living flora: small to large

`src/data/spatialFlora.ts` expands the vegetation model to **40+ tracked taxa/guilds** across thirteen structural strata:

- emergent trees;
- canopy trees;
- subcanopy trees;
- understory trees;
- shrubs;
- herbs;
- groundcover;
- ferns;
- vines/lianas;
- epiphytes;
- reeds/sedges;
- mangroves;
- aquatic vegetation.

Flora is classified by growth strategy, habitat targets, regional affinity, disturbance tolerance, seed/propagule dispersal and explicit ecological roles. Roles include canopy structure, shade, fruit/seed/browse/root/ground food, timber, fiber, medicine, nectar, pollinator host, insect host, nitrogen cycling, erosion control, bank stabilization, wetland structure, aquatic food, refuge, succession pioneer and old-growth indicator.

Each patch population persists compact state:

```text
[standing biomass kg, propagule reserve, condition, succession age days]
```

`spatialFloraRuntime.ts` controls carrying biomass, growth, turnover, colonization, local extirpation and daily primary production. Fruit and seed output responds to pollination; browsing, ground feeding and root/tuber extraction damage the corresponding living plant populations rather than consuming a private duplicate resource.

### Flora owns plant renewal

The authoritative material pass no longer uses fauna census K as a daily plant-production floor. Plant-food renewal is driven mainly by current living flora biomass, condition, season and pollination. A small background term represents untracked seedlings, cryptogams and minor taxa, but it cannot guarantee enough production to sustain census K by itself.

CI includes a direct ownership regression: two identical worlds have plant stocks depleted; one keeps living flora and the other has flora biomass removed. The living-flora world must recover materially more plant food than the bare world.

## Insects as a real trophic layer

`src/data/spatialInsects.ts` tracks **20+ insect taxa/guilds** across twelve functional guilds:

- pollinators;
- folivores;
- frugivores;
- seed feeders;
- wood borers;
- detritivores;
- dung feeders;
- carrion feeders;
- fungivores;
- predatory insects;
- blood feeders;
- aquatic larvae.

Their suitability depends on habitat, hydrology, region, substrate and living flora host biomass. Substrates include canopy, understory, ground, deadwood, litter, dung, carrion, flowers, fruit, freshwater and wetlands.

Each insect patch population persists:

```text
[live biomass kg, egg/larval/refugial recruitment reserve, condition]
```

Insect biomass is a major food source for many tracked birds, bats, reptiles, amphibians and small mammals. The fauna material pass consumes **actual accessible insect biomass**. Egg/larval/refugial reserve is protected from one-day predation and creates a recovery path after severe depletion, so `insects` is no longer an anonymous kg pool that simply respawns from a constant.

Insects also act on the ecosystem instead of existing only as food:

- pollinator biomass affects fruit/seed output;
- folivore/herbivore pressure damages living flora biomass and condition;
- detritivore, termite, dung and carrion guilds contribute decomposition/nutrient effects;
- aquatic larvae provide a terrestrial/aquatic trophic connection signal.

The accessible-biomass rule is centralized in `spatialInsectRuntime.ts`, so material-pool synchronization and actual predation use the same harvestable fraction.

## Spatial predators

`src/data/spatialPredators.ts` and `spatialPredatorRuntime.ts` migrate terrestrial predators onto the same generated patch world. Five predator definitions use metric density, habitat/region preferences, home-range scale, prey spectrum, daily food need, reserve capacity and hunt parameters.

Predation is no longer omniscient selection from a legacy subarea menu. Each day predators perform a patch-scale process:

```text
home-range search
→ prey availability / refuge / predator-opportunity scoring
→ encounter
→ attack / kill
→ prey cohort subtraction
→ predator food reserve
→ leftover carrion
```

Kills remove heads from the actual prey cohort in the selected patch. Consumed biomass replenishes predator reserve; unused kill biomass becomes carrion in the shared material budget. Low reserve/poor hunting affects condition, mortality and movement.

## Authoritative daily food-web order

`spatialFaunaEcosystemRuntime.ts` resolves one terrestrial day in causal order:

```text
1. living flora growth / succession / primary production
2. insect population growth and recruitment
3. insect functional effects on plants
4. shared material recovery + fauna feeding/drinking
5. refresh flora/insect telemetry after consumption
6. shared refuge/niche competition
7. prey/herbivore/omnivore demography and dispersal
8. predator search → encounter → kill → carrion
9. combined telemetry/history
```

This order prevents the same shortage from being counted twice and makes plant/insect state causally upstream of fauna condition and predator prey availability.

## Shared patch material budget

Each generated habitat patch persists one compact stock tuple:

```text
[
  fruit kg,
  seeds kg,
  browse kg,
  ground vegetation kg,
  roots/tubers kg,
  accessible insects kg,
  aquatic plants kg,
  carrion kg,
  fresh-water units
]
```

Standing-stock capacity is still calibrated from real patch area, habitat, hydrology and Local Sites so a clipped sliver cannot hold the same material as a large productive patch. The old area-scaled model also remains useful for capacity and scarcity regression.

Active renewal, however, now has different owners:

- plant families: living spatial flora + a small untracked-background term;
- insects: living insect populations only;
- carrion: mortality/predation events minus decay;
- fresh water: hydrology/recharge;
- consumption: all co-located fauna draw from the same stock.

Material shortage changes persistent cohort condition/stress before demography. Food/water niche-pressure calculations remain diagnostic when conserved material pools are active; refuge remains an active non-consumable shared-space constraint.

## Compatibility boundary

The migration deliberately separates **runtime ownership** from **compatibility code**.

`simEngine.ts` now advances the spatial terrestrial food web once and does **not** call the old terrestrial fauna, predator or long-run balance ticks. The old subarea flora still runs temporarily because existing UI/resource bridges read it. Aquatic ecology also remains on its existing runtime for now.

Therefore:

- old terrestrial animal/predator populations are not a second live census;
- seven historical fauna species may reuse old authored data, but their live populations exist only in the spatial runtime;
- old terrestrial predator code is regression/compatibility code, not gameplay authority;
- old subarea flora is transitional compatibility state, while fauna food production is owned by spatial flora.

## Validation

The CI workflow includes dedicated spatial regressions for:

- metric fauna census and exact conservation;
- living fauna cohort demography;
- shared competition;
- area-scaled material capacity/scarcity;
- full terrestrial trophic ecosystem;
- flora stratum/role coverage;
- insect guild coverage and functional roles;
- insect reserve recovery and protected biomass;
- living-flora ownership of plant renewal;
- predator removal of real prey cohorts;
- insectivorous fauna consuming real insect biomass;
- deterministic same-seed food-web evolution;
- bounded serialized aggregate state.

The full trophic long-run test uses deterministic 90-day and 60-day worlds and rejects collapses in flora, insects, prey or predators rather than merely checking that functions execute.

## Still deferred

The terrestrial migration does **not** make every ecology subsystem complete. The next clean boundaries are:

1. bridge player gathering and Local Site harvesting into the same patch material budget so humans and wildlife cannot extract duplicate resources;
2. migrate aquatic fauna/food-web populations onto generated spatial hydrology where appropriate;
3. replace centroid-neighbor routing with exact passability, trails, barriers and seasonal crossings;
4. strengthen fauna behavior from daily cohort redistribution into explicit feeding/drinking/refuge/breeding site selection where gameplay needs it;
5. materialize only locally encountered animals/groups for encounter gameplay and UI;
6. retire old subarea flora once all player-facing resource/UI readers consume spatial flora.

The core rule is now: **one spatial terrestrial population and material budget owns the living island; gameplay materializes only the local organisms and encounters that matter to the player.**
