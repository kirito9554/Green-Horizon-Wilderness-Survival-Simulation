# Green Horizon UI Material Guide

This guide exists to keep DOM UI visually consistent with the painted/raster survival-game shell. It is intentionally conservative: the interface should feel worn, practical and authored, not like a glossy dashboard or an AI-generated component gallery.

## Core material rule

Every interactive DOM surface should read as one of three physical states:

1. **Raised control** — button, tab, clickable row.
2. **Recessed control** — input, select, quantity stepper, inventory slot.
3. **Built surface** — panel, card, modal shell, outcome block.

Avoid perfectly clean flat rectangles unless the element is deliberately an invisible hotspot over baked artwork.

## Global implementation

`src/material-system.css` is loaded after Tailwind and skins the existing DOM globally. It adds:

- fine and coarse SVG turbulence grain embedded directly in CSS;
- low-amplitude uneven edge lighting;
- restrained inset depth instead of glossy highlights;
- asymmetrical corner radii on rectangular controls;
- recessed form controls and sliders;
- muted hover response;
- worn wood treatment for existing `.wood-*` and `.btn-wood-*` utilities;
- toned-down backdrop blur and generic oversized shadows;
- non-glossy scrollbars.

`src/material-layout-guards.css` reasserts explicit Tailwind positioning after the global skin so absolute/fixed tactical UI remains pixel-locked.

## What to avoid

Do not default to:

- bright green/blue SaaS gradients;
- large `rounded-2xl` cards everywhere;
- glassmorphism stacks;
- strong neon outer glows;
- hover scale-up on every card/button;
- identical border radii on every corner;
- perfectly smooth color ramps with no material breakup;
- multiple floating cards when one framed surface would work;
- decorative noise strong enough to reduce text or icon readability.

The UI should not advertise the technique used to make it look textured.

## Motion

Controls should feel pressed rather than floated toward the camera.

Preferred:

- tiny brightness shift;
- inset-shadow change;
- at most ~1 px vertical depression;
- subtle scale only for circular map/navigation controls.

Avoid generic `hover:scale-105` / `active:scale-95` behavior on rectangular controls.

## Corner language

Rectangular DOM controls use slightly uneven elliptical radii. Circular icon buttons stay circular. Pills are reserved for genuinely pill-like information tags, not as a default button shape.

## Color language

Use dirty/muted material colors:

- deep jungle teal / green-black for structural surfaces;
- desaturated moss green for positive actions;
- old amber / bronze for emphasis;
- clay / dried-blood red for danger;
- parchment/off-white for primary text.

Avoid pure saturated UI colors unless they communicate an urgent gameplay state.

## Texture hierarchy

Texture must stay subtle.

- Buttons: most visible grain because the hand is expected to touch them.
- Panels/cards: less grain; enough to break perfectly smooth CSS surfaces.
- Inputs/slots: grain plus stronger inward shadow.
- Text/portraits/map artwork: never intentionally blurred or heavily textured by DOM overlays.

## Escape hatches

Use these only when a DOM node is an interaction layer over artwork or needs to remain intentionally flat:

```tsx
<button data-ui-raw="true" />
<div data-ui-material="flat" />
```

The top-header Fullscreen and Game Menu hotspots are already excluded by their ARIA labels because their visual button frames are baked into `UI-BG.png`.

## Existing OrganicUI

`src/components/crafting/OrganicUI.css` already follows the same direction and is explicitly excluded from duplicate global button/card treatment where appropriate. New bespoke systems may use OrganicUI classes when they need finer local tuning, but should still follow the same material hierarchy above.
