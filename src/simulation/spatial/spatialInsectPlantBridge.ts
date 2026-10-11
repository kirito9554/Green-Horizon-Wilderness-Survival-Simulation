import { SPATIAL_INSECT_BY_ID } from '../../data/spatialInsects';
import { SPATIAL_FLORA_BY_ID } from '../../data/spatialFlora';
import type { SpatialFloraRuntimeState, SpatialInsectRuntimeState } from '../../types/spatialEcologySimulation';
import type { GeneratedSpatialWorld } from './worldGeneration';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface SpatialInsectFunctionSignal {
  pollination: number;
  decomposition: number;
  herbivory: number;
  predatoryControl: number;
  aquaticExportKg: number;
}

export function getSpatialInsectFunctionSignals(
  insects: SpatialInsectRuntimeState,
  world: GeneratedSpatialWorld,
): Readonly<Record<string, SpatialInsectFunctionSignal>> {
  const raw: Record<string, { biomass: number; pollination: number; decomposition: number; herbivory: number; predatory: number; aquatic: number }> = {};
  for (const patch of world.habitatPatches) raw[patch.id] = { biomass: 0, pollination: 0, decomposition: 0, herbivory: 0, predatory: 0, aquatic: 0 };
  for (const speciesState of insects.species) {
    const def = SPATIAL_INSECT_BY_ID[speciesState.speciesId];
    if (!def) continue;
    for (const [patchId, state] of Object.entries(speciesState.patches)) {
      const biomass = state[0];
      const target = raw[patchId];
      if (!target || biomass <= 0) continue;
      target.biomass += biomass;
      target.pollination += biomass * def.pollinationValue;
      target.decomposition += biomass * def.decompositionValue;
      target.herbivory += biomass * def.herbivoryValue;
      target.predatory += biomass * def.predationValue;
      target.aquatic += biomass * def.aquaticExportValue * .0025;
    }
  }
  const result: Record<string, SpatialInsectFunctionSignal> = {};
  for (const patch of world.habitatPatches) {
    const value = raw[patch.id];
    const biomassScale = Math.max(1, patch.areaKm2 * 2500);
    result[patch.id] = {
      pollination: clamp01(.3 + Math.log1p(value.pollination) / Math.log(2200) * .7),
      decomposition: clamp01(value.decomposition / biomassScale),
      herbivory: clamp01(value.herbivory / biomassScale),
      predatoryControl: clamp01(value.predatory / biomassScale),
      aquaticExportKg: value.aquatic,
    };
  }
  return result;
}

/**
 * Insects act on vegetation after their daily recruitment. Predatory insect
 * biomass damps herbivore-insect damage; decomposers improve flora condition
 * and propagule establishment. Effects are area-scaled and intentionally slow.
 */
export function applySpatialInsectPlantEffects(
  flora: SpatialFloraRuntimeState,
  insects: SpatialInsectRuntimeState,
  world: GeneratedSpatialWorld,
): Readonly<Record<string, SpatialInsectFunctionSignal>> {
  const signals = getSpatialInsectFunctionSignals(insects, world);
  for (const speciesState of flora.species) {
    const def = SPATIAL_FLORA_BY_ID[speciesState.speciesId];
    if (!def) continue;
    for (const [patchId, state] of Object.entries(speciesState.patches)) {
      const signal = signals[patchId];
      if (!signal || state[0] <= 0) continue;
      const hostExposure = def.roles.includes('insect_host') ? 1 : def.stratum === 'groundcover' || def.stratum === 'herb' ? .82 : .56;
      const controlledHerbivory = signal.herbivory * (1 - signal.predatoryControl * .48);
      const dailyLossFraction = Math.min(.0035, controlledHerbivory * hostExposure * .0022);
      state[0] = Math.max(0, Math.round(state[0] * (1 - dailyLossFraction) * 1000) / 1000);
      state[2] = clamp01(state[2] - controlledHerbivory * hostExposure * .0014 + signal.decomposition * .0011);
      state[1] = clamp01(state[1] + signal.decomposition * .0009);
    }
  }
  return signals;
}
