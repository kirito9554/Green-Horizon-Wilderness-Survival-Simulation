# Five-year terrestrial trophic soak

This document records the first multi-year validation of the authoritative spatial terrestrial food web.

The goal is not to force every population or biomass curve to remain flat. Seasonal oscillation, local extirpation, recolonization, predator-prey cycling and convergence away from initial seeded abundance are expected. The soak instead rejects runaway self-depletion, global trophic collapse and a persistent downward ratchet that is clearly caused by exhausted food/water resources.

## Test shape

`npm run test:spatial-trophic-soak` runs one continuous deterministic world for **1,825 days** and records checkpoints at one, three and five years.

The simulation includes the complete authoritative terrestrial chain:

```text
living flora
-> living insects / plant foods
-> shared patch material stocks
-> 24-species non-predator fauna community
-> five spatial predators
-> carrion / decomposition feedback
```

The regression tracks:

- total flora and insect biomass;
- prey/non-predator population against metric carrying capacity;
- predator population;
- global species/taxon persistence;
- food/water sufficiency and pool fill;
- seasonal/global minima and maxima;
- local prey extirpation and recolonization between monthly samples;
- predator kills and insect consumption;
- year-four versus year-five annual means to detect slow decline.

A dedicated GitHub Actions workflow (`trophic-soak.yml`) runs the long soak separately from the normal CI suite so ordinary validation stays fast.

## First five-year result

Seed: `spatial-trophic-soak-alpha`

### Checkpoints

| Metric | Year 1 | Year 3 | Year 5 |
| --- | ---: | ---: | ---: |
| Flora biomass | 276.0 Mkg | 224.3 Mkg | 192.9 Mkg |
| Insect biomass | 326.2 t | 342.5 t | 331.0 t |
| Prey/non-predator population | 41,451 | 34,291 | 30,591 |
| Metric prey K | 67,031 | 67,031 | 67,031 |
| Predator population | 205 | 205 | 205 |
| Present prey species | 23 | 23 | 23 |
| Present predator species | 5 | 5 | 5 |
| Present flora taxa/guilds | 43 | 43 | 43 |
| Present insect taxa/guilds | 22 | 22 | 22 |
| Mean food sufficiency | 0.825 | 0.854 | 0.867 |
| Mean water sufficiency | 0.773 | 0.814 | 0.829 |
| Food-pool fill | 0.921 | 0.952 | 0.953 |
| Water-pool fill | 0.990 | 0.990 | 0.990 |

### Five-year extrema and spatial turnover

Across the full run:

- flora biomass ranged from **192.9 to 318.3 Mkg**;
- insect biomass ranged from **212.8 to 408.5 t**;
- prey population ranged from **30,162 to 48,233**;
- predator population ranged from **202 to 205**;
- monthly occupancy sampling observed **1,729 local prey extirpations** and **512 recolonizations**;
- mean food sufficiency fell below 0.9 on **714 days**;
- mean water sufficiency fell below 0.9 on **624 days**;
- spatial predators made **40,349 kills**;
- fauna consumed about **497.9 t** of living insect biomass.

The presence of both local extirpation and recolonization is important: the patch community is spatially dynamic rather than frozen, while all tracked global prey/predator/flora/insect taxa survived the five-year horizon.

## Year-four to year-five trend

The trailing annual means were:

| Metric | Year 4 mean | Year 5 mean | Change |
| --- | ---: | ---: | ---: |
| Flora biomass | 214.7 Mkg | 198.9 Mkg | -7.4% |
| Insect biomass | 353.3 t | 354.4 t | +0.3% |
| Prey population | 32,673 | 30,937 | -5.3% |
| Predator population | 205.0 | 205.0 | ~0% |

This means the ecosystem has **not proven a perfectly flat equilibrium** by year five. Flora and prey are still converging downward from their initial seeded abundance.

However, the observed decline is **not consistent with resource self-exhaustion**:

1. food-pool fill rises from 0.921 to about 0.953;
2. mean food sufficiency rises from 0.825 to 0.867;
3. water remains near 0.99 pool fill and water sufficiency improves;
4. insect biomass remains stable to slightly higher over the late run;
5. no tracked global species/taxon is lost;
6. predator abundance remains bounded rather than growing while prey declines;
7. local recolonization continues to occur.

The current interpretation is therefore **downward convergence toward a lower dynamic equilibrium**, not a landscape eating itself empty.

The prey decline is also directionally consistent with the fauna-only long-run runtime, which already converges below the initial census without resource starvation. Spatial predation adds further pressure, but the five-year run does not show a runaway trophic cascade.

## Regression gates

The soak currently rejects the run if:

- flora falls below 20% of initial biomass;
- insects fall below 10% of initial biomass;
- prey falls below 20% of metric K;
- all predators disappear;
- year-five annual means fall sharply below the previous annual window (flora <72%, insects <60%, prey <68%, predators <45%);
- more than a small number of global prey/predator/flora/insect taxa disappear;
- no local extirpation or no recolonization occurs;
- predation or insectivory stops functioning.

These are collapse/slow-spiral guards, not targets for artificial equilibrium.

## CI result

GitHub Actions run **35191735498** (`Five-year Terrestrial Trophic Soak`) completed successfully.

The normal full validation workflow on the same PR head also passed independently.

## Remaining caution

Five years is long enough to reject the earlier short-horizon concern that the ecosystem simply consumes its own resource base and dies. It is not yet proof of an asymptotic equilibrium.

The next reason to extend the horizon would be to answer a narrower question: whether the remaining flora/prey downward convergence eventually plateaus or continues at a small rate beyond year five. That should be done after runtime profiling/optimization rather than by weakening ecological feedback or adding artificial food floors.
