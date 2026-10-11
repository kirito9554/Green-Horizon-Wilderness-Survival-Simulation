# Predator self-sustain audit — rescue-independent validation

This research branch keeps the existing player-facing legacy predator behavior unchanged until P9.6 is validated across the full ecological horizon.

## Why an independent baseline is necessary

The historical five-year combined-mode soak may pass all its collapse gates even when predators cannot replace their own losses. Its external immigration mechanism creates founder cohorts when populations fall below the minimum viable population (MVP). The legacy baseline logs (22 September 2026 UTC) show:
- Alpha: predators 144 -> 16 by day 1825, with **36 external immigrants**, 7 births and 171 deaths.
- Beta: predators 135 -> 18 by day 1825, with **56 external immigrants**, 9 births and 182 deaths.
- Across both seeds, the majority of deaths are classified as hunger deaths. This is an energy bottleneck, not evidence that prey are globally scarce.
- The beta seed generates no initial forest raptors (world presence <1); a zero-start species cannot demonstrate unassisted persistence.

P9.6 one-year rescue-enabled diagnostics already show improvements in monitor lizard, python and civet recruitment, while raptor and crocodile viability are less certain. Those 365-day results alone do **not** establish a self-sustaining five-year ecosystem.

## What this change tests

The `allowExternalImmigration` runtime option defaults to **true**, preserving existing gameplay and legacy regression behavior. Setting it to false retains ordinary habitat-dependent hunting, condition, reproduction, natural mortality, hunger mortality, dispersal, mate searching, local extinction and the below-MVP pressure clock — but it stops the insertion of external founder animals.

Run the focused P9.6 diagnostic without external arrivals:

```sh
P9_DAYS=365 P9_ALT_DIET=1 P9_SWITCHING=1 P9_CALIBRATE=1 P9_ALLOW_IMMIGRATION=0 npm run test:spatial-predator-p9-diagnostic
```

Run the full five-year ecosystem with P9.6 authoritative feeding and zero external arrivals:

```sh
PREDATOR_P6_MODE=combined PREDATOR_P9_ACTIVE=1 PREDATOR_NO_RESCUE=1 PREDATOR_P6_ASSERT=0 npm run test:spatial-trophic-soak
```

Select both `SPATIAL_TROPHIC_SEED=spatial-trophic-soak-alpha` and `SPATIAL_TROPHIC_SEED=spatial-trophic-soak-beta`. GitHub Actions runs the two P9.6 365-day no-rescue diagnostics and the two five-year no-rescue probes alongside unchanged legacy checks.

## Interpretation

These *diagnostic* jobs do not weaken the old collapse criteria or declare an ecological PASS. The five-year probe deliberately records its gate outcomes rather than asserting the historical gates, because the purpose is to surface failures, not obscure them.

Evaluate each seeded species separately using its starting abundance, births, deaths, extinction/absence intervals, energy coverage, hunger deaths, juvenile maturation, breeding-capable units and mate access. Record unseeded species (including beta raptors) as **not tested for self-sustain**, not as successes.

Do not change reproduction, mortality, preferred prey, immigration or nominal carrying capacity merely to force green checks. Only promote P9 into gameplay after checking prey stability, conserved material budgets, no-rescue persistence across seeds and longer-run trends. A five-year trajectory can still be insufficient to demonstrate crocodile replacement because its authored maturity age is 3,650 days.
