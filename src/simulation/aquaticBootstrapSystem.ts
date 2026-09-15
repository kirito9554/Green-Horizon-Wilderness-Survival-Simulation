import type { GameState } from '../types';
import type { MainWorldAreaId } from '../data/mainWorldAreas';
import type { RegionEcology, WorldEcologyState } from '../types/ecologySimulation';
import { tickAquaticEcology } from './ecologyAquaticSystem';

const AQUATIC_BOOTSTRAP_VERSION = 2;
const MIN_HYDROLOGY_OBSERVATION_HOURS = 24;
const COLONIZATION_INTERVAL_MINUTES = 14 * 1440;

interface AquaticBootstrapMeta {
  version: number;
  lastColonizationAttemptByPoiId: Partial<Record<MainWorldAreaId, number>>;
}

type BootstrapWorldEcologyState = WorldEcologyState & {
  aquaticBootstrap?: AquaticBootstrapMeta;
};

function gameMinute(state: GameState): number {
  return Math.max(0, (state.gameTime.day - 1) * 1440 + state.gameTime.minuteOfDay);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function ensureMeta(state: GameState): AquaticBootstrapMeta | undefined {
  const system = state.ecologySystem as BootstrapWorldEcologyState | undefined;
  if (!system) return undefined;
  system.aquaticBootstrap ||= {
    version: AQUATIC_BOOTSTRAP_VERSION,
    lastColonizationAttemptByPoiId: {},
  };
  system.aquaticBootstrap.version = AQUATIC_BOOTSTRAP_VERSION;
  system.aquaticBootstrap.lastColonizationAttemptByPoiId ||= {};
  return system.aquaticBootstrap;
}

export function getAquaticHydrologyObservationHours(state: GameState, poiId: MainWorldAreaId): number {
  const hydro = state.hydrologySystem;
  const region = hydro?.regionsByPoiId?.[poiId];
  if (!hydro || !region) return 0;
  const observations = region.cellStateIds
    .map(id => hydro.cellStatesById[id]?.observedHours)
    .filter((value): value is number => Number.isFinite(value));
  return average(observations);
}

export function isAquaticBootstrapReady(state: GameState, poiId: MainWorldAreaId): boolean {
  return getAquaticHydrologyObservationHours(state, poiId) >= MIN_HYDROLOGY_OBSERVATION_HOURS;
}

/**
 * Aquatic seeding depends on hydroperiod reliability, which is an observed-history
 * metric. Newly materialized regions used to be marked `aquaticSeeded` on their
 * very first ecology frame, often before hydrology had accumulated any meaningful
 * observation window. A dry/empty first frame therefore became a permanent
 * "already seeded" state.
 *
 * This compatibility wrapper keeps immature regions temporarily masked from the
 * seeder. Once their hydrology has at least one day of observations the normal
 * deterministic habitat seeder is allowed to run. Mature regions are then
 * reopened at a low frequency for an immigration pass. The underlying seeder
 * skips species/body combinations that already have a population, so this does
 * not duplicate established stocks; it only gives missing or locally extirpated
 * species another chance when habitat becomes suitable. That removes the old
 * one-shot dependency on the exact frame when a region first became seedable.
 */
export function tickAquaticEcologyWithBootstrap(state: GameState, deltaGameMinutes: number): void {
  const system = state.ecologySystem;
  if (!system || !state.hydrologySystem) {
    tickAquaticEcology(state, deltaGameMinutes);
    return;
  }

  const meta = ensureMeta(state);
  if (!meta) {
    tickAquaticEcology(state, deltaGameMinutes);
    return;
  }

  const now = gameMinute(state);
  const temporarilyMasked: RegionEcology[] = [];

  for (const region of Object.values(system.regionsByPoiId).filter((entry): entry is RegionEcology => Boolean(entry))) {
    if (!state.hydrologySystem.regionsByPoiId[region.poiId]) continue;

    if (!isAquaticBootstrapReady(state, region.poiId)) {
      // tickAquaticEcology only calls the seeder when aquaticSeeded is false.
      // Mask the region for this frame, then restore false afterwards so it can
      // seed naturally once enough hydroperiod history exists.
      if (!region.aquaticSeeded) {
        region.aquaticSeeded = true;
        temporarilyMasked.push(region);
      }
      continue;
    }

    const previousAttempt = meta.lastColonizationAttemptByPoiId[region.poiId];
    if (!region.aquaticSeeded) {
      meta.lastColonizationAttemptByPoiId[region.poiId] = now;
      continue;
    }

    if (previousAttempt === undefined) {
      meta.lastColonizationAttemptByPoiId[region.poiId] = now;
      continue;
    }

    if (now - previousAttempt >= COLONIZATION_INTERVAL_MINUTES) {
      // Re-open the deterministic habitat seeder for missing species. Existing
      // populations are protected by its overlap check; newcomers still require
      // a valid connected water body, carrying capacity, suitability and the
      // deterministic presence roll.
      region.aquaticSeeded = false;
      meta.lastColonizationAttemptByPoiId[region.poiId] = now;
    }
  }

  try {
    tickAquaticEcology(state, deltaGameMinutes);
  } finally {
    for (const region of temporarilyMasked) region.aquaticSeeded = false;
  }
}

export function getAquaticBootstrapMeta(state: GameState): Readonly<AquaticBootstrapMeta> | undefined {
  return (state.ecologySystem as BootstrapWorldEcologyState | undefined)?.aquaticBootstrap;
}
