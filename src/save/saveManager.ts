import { GameState } from '../types';
import { INITIAL_GAME_STATE } from '../simulation/simEngine';
import { createBuildingSimulationState } from '../simulation/buildGridSystem';
import { LATEST_SAVE_VERSION, migrateGameState } from './migrations';

const SAVE_KEY_PREFIX = 'canopy_save_slot_';
const AUTOSAVE_KEY = 'canopy_autosave';

export interface SaveMetadata {
  slot: number;
  campName: string;
  day: number;
  timeStr: string;
  survivorCount: number;
  timestamp: number;
  version: number;
}

function parseAndMigrate(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.survivors || !parsed.gameTime || !parsed.inventory) return null;
    return migrateGameState(parsed);
  } catch (e) {
    console.error('Failed to parse/migrate save data', e);
    return null;
  }
}

export const saveManager = {
  saveToSlot(slot: number, state: GameState): boolean {
    try {
      const dataToSave = {
        ...state,
        saveVersion: LATEST_SAVE_VERSION,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${SAVE_KEY_PREFIX}${slot}`, JSON.stringify(dataToSave));
      return true;
    } catch (e) {
      console.error('Failed to save to slot', slot, e);
      return false;
    }
  },

  loadFromSlot(slot: number): GameState | null {
    try {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${slot}`);
      if (!raw) return null;
      return parseAndMigrate(raw);
    } catch (e) {
      console.error('Failed to load from slot', slot, e);
      return null;
    }
  },

  deleteSlot(slot: number): void {
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${slot}`);
  },

  listSlots(): Array<SaveMetadata | null> {
    const slots: Array<SaveMetadata | null> = [null, null, null];
    for (let i = 1; i <= 3; i++) {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${i}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const hours = Math.floor(parsed.gameTime.minuteOfDay / 60) % 24;
          const mins = Math.floor(parsed.gameTime.minuteOfDay % 60);
          const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          slots[i - 1] = {
            slot: i,
            campName: parsed.campName || 'Camp',
            day: parsed.gameTime?.day || 1,
            timeStr,
            survivorCount: parsed.survivors?.length || 0,
            timestamp: parsed.timestamp || Date.now(),
            version: parsed.saveVersion || 1,
          };
        } catch {
          slots[i - 1] = null;
        }
      }
    }
    return slots;
  },

  autoSave(state: GameState): void {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        ...state,
        saveVersion: LATEST_SAVE_VERSION,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Autosave skipped', e);
    }
  },

  loadAutoSave(): GameState | null {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      return parseAndMigrate(raw);
    } catch (e) {
      console.warn('Failed to load autosave', e);
      return null;
    }
  },

  exportSaveJSON(state: GameState): void {
    const exportState = { ...state, saveVersion: LATEST_SAVE_VERSION };
    const jsonStr = JSON.stringify(exportState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canopy_save_day${state.gameTime.day}_v${LATEST_SAVE_VERSION}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importSaveJSON(fileContent: string): GameState | null {
    try {
      const parsed = JSON.parse(fileContent) as GameState;
      if (!parsed.survivors || !parsed.gameTime || !parsed.inventory) {
        throw new Error('Invalid save file structure');
      }
      return migrateGameState(parsed);
    } catch (e) {
      console.error('Failed to parse save file JSON', e);
      return null;
    }
  },

  clearAutoSave(): void {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch (e) {
      console.warn('Failed to clear autosave', e);
    }
  },

  clearAllData(): void {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      for (let i = 1; i <= 10; i++) {
        localStorage.removeItem(`${SAVE_KEY_PREFIX}${i}`);
      }
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('canopy_')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Failed to clear all save data', e);
    }
  },

  resetGame(): GameState {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch (e) {
      console.warn('Failed to clear autosave during reset', e);
    }
    const fresh: GameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    // INITIAL_GAME_STATE is created once when the module is loaded. A reset must
    // not clone its old spatial seed, otherwise a "new run" would reproduce the
    // exact same hidden POI build grids inside the same browser session.
    fresh.buildingSimulation = createBuildingSimulationState();
    return migrateGameState(fresh);
  },
};