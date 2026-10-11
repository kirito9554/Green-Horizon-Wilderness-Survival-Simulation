# Predator P9 — Bioenergetic Feeding & Functional Response

P9 replaces the P8 `daily deficit -> expected attempts` feedback loop with an empirically grounded feeding model in staged, testable steps.

## P8 frozen baseline

Reference runtime head: `e57669202215b28b8e756e0d06d94d55109ab211`.

Five-year combined-mode soak:

| Seed | Year 1 prey | Year 3 prey | Year 5 prey | 5y minimum | K | Total predator kills |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| alpha | 24,562 | 10,635 | 19,749 | 7,888 | 67,031 | 101,492 |
| beta | 26,196 | 7,817 | 6,182 | 6,182 | 65,447 | 99,075 |

Both seeds failed only after real execution of P8 because the prey-collapse floor requires the five-year minimum to remain above 20% of carrying capacity. P8 raised predator energy acquisition relative to P7 but did so by allowing small-prey feeders to convert daily energy deficit into very high hunt-attempt counts.

## P9 phases

### P9.1 — FMR shadow ledger

- Add field metabolic rate estimates in kJ/day using Nagy allometries.
- Convert legacy kg-food demand and P8 edible kills to a common reference-energy axis.
- Telemetry only: no mortality, hunting, fertility, movement or reserve decisions may read P9 shadow values.

### P9.2 — Gut / digestion shadow state

- Add deterministic, energy-conserving gut-state helpers.
- Python 25%-body-mass meals must retain a multi-day digestion horizon consistent with the observed 6-8 day post-feeding response.
- Crocodilian large meals must also remain multi-day.
- Still non-authoritative.

### P9.3 — Feeding-bout authority

- Remove `requiredAttempts = deficit / expectedEnergyPerAttempt` as the driver of hunt limits.
- Hunt only when usable stored/gut energy warrants a feeding bout.
- A successful meal ends or suppresses further hunting according to meal/gut state.

### P9.4 — Alternative diet channels

- Civet and monitor gain plant/invertebrate/carrion energy channels from the conserved shared material budget.
- Vertebrate kills stop acting as the only route to energy for generalists.

### P9.5 — Density-dependent prey switching

- Target selection incorporates local relative availability and profitability.
- Rare prey lose encounter/selection pressure emergently; no global-K escape hatch.

### P9.6 — Species calibration

- Replace generic values with analogue-derived profiles where defensible.
- Mark each value as measured, analogue-derived, allometric, or fallback.
- Deprecate non-authoritative P8 constants rather than silently tuning them.

### P9.7 — Validation ladder

Regression -> 30-day diagnostic -> 1 year -> 3 years -> 5 years, alpha and beta.

Prey fecundity, carrying capacity, predator mortality, controlled recovery and breeding are frozen while P9 feeding mechanics are being diagnosed.

## Empirical anchors

- Nagy, Girard & Brown (1999), and Nagy (2005): field metabolic rate allometry for free-ranging mammals, birds and reptiles.
- Secor and colleagues: Python meals around 25% body mass produce strong postprandial metabolic responses lasting roughly 6-8 days; SDA is roughly one quarter of ingested energy.
- De Cuyper et al. (2019): predator/prey size and gut capacity strongly determine carnivore kill frequency; small-prey and large-prey feeders require different semantics.

These relationships are used as biological constraints, not as claims that the fictional Green Horizon species exactly match any single real species.
