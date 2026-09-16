# Spatial World Foundation

This document defines the first metric spatial model for the current main island.

## Canonical world

`src/data/mainWorldAreas.ts` is the lifecycle registry. Only the ten `MAIN_WORLD_AREA_IDS` are active macro regions. Every other entry in `AREAS_DATABASE` is legacy/archive data; old redirect aliases remain available only for save and migration compatibility.

`src/data/poiTerritories.ts` remains the authored source of truth for current macro-region shape. The spatial backend does not invent replacement region rectangles.

## Physical scale

The current island is calibrated to **120 km² of land**.

The source map is 1672 × 941. The backend first measures the combined normalized area of the ten authored polygons, then derives a metric world rectangle that:

1. preserves the source-map aspect ratio; and
2. makes the combined canonical polygon area equal exactly 120 km².

With the current polygons this is approximately a 17.81 km × 10.02 km map-space rectangle. The surrounding rectangle includes ocean/non-land; the canonical land polygons occupy about 67.23% of it.

The resulting macro-region areas are derived from geometry rather than stored as hand-authored balance constants.

## Spatial hierarchy

The intended hierarchy is:

```text
Main Island
  -> Macro Region (10 authored polygons)
    -> Habitat Patch (deterministic clipped lattice)
      -> Local Sites / trails / water crossings (future)
```

A macro region is a strategic/map-scale province. It is no longer intended to be the smallest unit used by ecology or movement.

## Habitat patches

`src/simulation/spatial/habitatPatches.ts` overlays a deterministic 600 m global lattice on the island and clips each macro polygon against that lattice. Boundary cells are true clipped polygons, not rectangles that spill outside their parent region.

A patch has:

- stable ID and deterministic seed;
- parent macro region;
- polygon, centroid, bounds, and area;
- habitat and terrain tags;
- baseline movement impedance;
- generic canopy/cover/moisture/aquatic/elevation/disturbance/forage suitability hooks.

The default current geometry produces roughly five hundred patches island-wide. This is intentionally much coarser than GIS or tile simulation while still giving ecology and travel a meaningful spatial substrate.

## Travel foundation

`src/simulation/spatial/spatialTravel.ts` builds a lightweight adjacency graph from habitat patches and exposes a read-only Dijkstra route estimator. Edge cost combines physical distance and patch movement impedance.

This is **not yet** the final expedition navigation system. Existing `distanceKm` and `baseTravelMinutes` remain live gameplay data until authored trails, slopes, river crossings, weather/load/fatigue effects, and route validation are added.

## Ecology integration plan

Fauna and predator populations should migrate from macro-region buckets toward patch-aware populations in later phases. The spatial layer is designed to support:

- local population density instead of whole-region headcount;
- habitat-specific carrying capacity;
- home-range overlap;
- predator encounter probability and competition based on shared space;
- refugia emerging from terrain/habitat rather than hard low-population buffs;
- local extirpation and recolonization without treating every disappearance as island-wide extinction.

No fauna/predator balance values are changed by this foundation PR.

## Legacy POIs

Old center-map POIs such as Hill Lookout, Jungle Trail, Foraging Grounds, Medicinal Glade, Kapok Grove, and Clay Pit are no longer macro regions. Their concepts can later be reused as **local-site archetypes inside habitat patches**, but their old area IDs must not re-enter active macro geometry.

Old outer-sector data remains archived for possible future multi-map expansion.
