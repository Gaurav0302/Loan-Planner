import { DEFAULT_SETUP } from '../engine';
import { readItem, writeItem } from '../lib/storage';
import { importClassic } from './classic';
import { newId, normalizeData } from './normalize';
import { DATA_VERSION, PLAN_COLORS, type AppData } from './types';

export const DATA_KEY = 'timbertop:data';

export function starterData(): AppData {
  const id = newId('p-');
  return {
    version: DATA_VERSION,
    plans: [{ id, name: 'My plan', color: PLAN_COLORS[0], setup: structuredClone(DEFAULT_SETUP), changes: [], lumps: [], editedAt: new Date().toISOString() }],
    activePlanId: id,
    facts: [],
    factLumps: [],
    checkIns: [],
  };
}

/** Saved data, else data brought over from the previous site, else the built-in starting values. */
export function loadData(read: (key: string) => string | null = readItem): AppData {
  const saved = read(DATA_KEY);
  if (saved) {
    try {
      const data = normalizeData(JSON.parse(saved));
      if (data) return data;
    } catch {
      // Unreadable saved data falls through to a fresh start rather than a broken app.
    }
  }
  return importClassic(read) ?? starterData();
}

export function saveData(data: AppData): boolean {
  return writeItem(DATA_KEY, JSON.stringify(data));
}
