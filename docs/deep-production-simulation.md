# Deep Production Simulation

This document is the canonical architecture note for Craft / Research / Repair / Upgrade after the placeholder-first UI pass.

## Ownership

UI components are presentation + command emitters only. They do not own production timers or mutate local mock production state.

Simulation ownership:

- `craftingSystem.ts` — crafting queue, material consumption, worker/workstation scheduling, deterministic quality.
- `researchSystem.ts` — evidence, experiments, research progression, knowledge and discoveries.
- `maintenanceSystem.ts` — maintenance / repair / quick patch / component replacement.
- `upgradeSystem.ts` — same-instance tier upgrades and physical component modifications.
- `componentWearSystem.ts` — physical stress distribution and component failure.
- `workstationSystem.ts` — workstation occupancy, condition and production modifiers.
- `materialReservationSystem.ts` — recipe material reservations.
- `jobReservationSystem.ts` — shared Repair / Upgrade material reservations.
- `dismantleSystem.ts` — deterministic component-aware salvage.

`simEngine.ts` is the orchestration layer only.

## Save version

Current deep-production schema: **V5**.

Migration order rebuilds derived reservation state deterministically:

1. Crafting reservations.
2. Maintenance material reservations.
3. Upgrade material reservations.
4. Maintenance exclusive target locks.
5. Upgrade exclusive target locks.
6. Research evidence refresh.

Reservation counters are derived caches; job reservation records are canonical.

## Inventory reservation invariant

A physical stack remains in inventory while reserved. Generic inventory operations only see:

`availableQuantity = physicalQuantity - reservedQuantity`

A job consumes exact `instanceId` slices and their exact quality composition. Cancel before consumption releases a reservation; cancel after a production phase has consumed material does not magically refund it.

A tool being repaired/upgraded is exclusively locked as a physical instance and cannot simultaneously be crafted away, transferred, dismantled or queued into another maintenance/upgrade job.

## Craft

A queued unit is affected by:

- exact material quality,
- crafter skill,
- hunger / thirst / fatigue / health / morale,
- weather exposure,
- workstation type,
- workstation condition,
- workstation occupancy,
- required tool availability and condition.

Craft quality is a vector (`material`, `workmanship`, `fit`, `finish`, `structuralIntegrity`) and only then summarized to Crude / Standard / Prime / Masterwork.

Random variation is seeded by the queued job + unit index. Save/reload cannot reroll a result.

## Workstations

Campfire and Carpenter Bench are physical occupied resources rather than text labels. Their condition scales speed/precision benefits. Handcraft work can gain weather protection from a completed shelter.

Pause, cancel and completion release the workstation slot. If a physical workstation becomes invalid mid-job, work returns to pending without recreating consumed materials.

## Research

Research discovery uses persistent evidence rather than an inventory-count shortcut.

Evidence channels:

- material knowledge,
- process knowledge,
- tool/workstation knowledge,
- environmental knowledge,
- precedent knowledge,
- destructive analysis experiments.

A non-default recipe becomes researchable at 80 evidence. `Analyze` consumes an unreserved physical sample and produces diminishing evidence gains. Completed recipes and actual production history feed precedent/process knowledge.

## Physical tool components

Tools are physical assemblies. Depending on tool type they contain blade/head, handle/shaft/frame, binding/string, grip/body/closure components.

Each component persists:

- quality,
- condition,
- current maximum condition,
- original maximum condition,
- permanent damage,
- functional properties such as sharpness, hardness, toughness, tension, moisture resistance and grip comfort.

A failed critical component makes the tool unusable but does **not** delete it. It remains available for repair, part replacement or dismantling.

## Wear

Task stress is distributed differently for gathering, crafting and building. Weather particularly accelerates wet fiber/string/grip degradation. Component quality, hardness and toughness modify local wear.

Aggregate condition is only a UI/legacy availability summary; component state is canonical.

## Maintenance

Four distinct operations:

- `maintenance` — light service, sharpening/tension adjustment, no magical rebuild.
- `repair` — larger restoration; severe prior damage can permanently reduce the component's maximum condition.
- `quick_patch` — fast field repair with explicit permanent degradation trade-offs.
- `replace` — consumes a replacement material, creates a new physical component state and resets that component's permanent damage.

Repair jobs reserve exact materials and compete for real idle workers.

## Upgrade

Tier upgrades transform the **same inventory instance** into the successor recipe output instead of deleting history and spawning an unrelated object.

Component modifications operate on real parts:

- sharpen,
- reinforce,
- rebalance,
- weatherproof.

Sharpening can trade material life for edge performance. Reinforcement changes component structural limits. Weatherproofing modifies moisture resistance.

Displayed tool stats are derived from current components, craft quality and condition rather than a static mock table.

## Dismantle

Dismantling is deterministic for the same physical state. Recovery chance depends on component condition and worker crafting skill. Badly damaged parts can recover at degraded quality. Reserved equipment cannot be dismantled.

## Scheduler priority

Current production tick priority is:

1. Maintenance
2. Upgrade
3. Craft / Research

All compete for the same idle survivor pool and reservation-aware inventory.

## Compatibility gateway

The application already exposed `onStartCrafting(survivorId, recipeId)`. Deep-production UI commands can travel through this reducer-safe gateway using reserved `__...__` command identifiers. `taskHandlers.ts` routes those commands before normal recipe handling.

This keeps the existing App / ManageCamp contract backward-compatible while deep systems are validated.

## Required invariants

Future changes must preserve these rules:

1. One physical unit cannot be reserved by two jobs.
2. Save/load cannot change deterministic craft/salvage outcomes.
3. Cancel cannot duplicate material.
4. A consumed production phase cannot receive a full magical refund.
5. Repair cannot exceed the component's current max condition.
6. Permanent damage is only removed by actual part replacement (or a specifically designed advanced process).
7. A broken critical component disables the tool but preserves the item for repair/salvage.
8. Workstation capacity is respected by all active jobs.
9. UI mock state must never become authoritative production state.
10. Any new production queue must be persisted and migrated before release.
