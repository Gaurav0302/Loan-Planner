import { readItem } from '../lib/storage';
import { normalizeChange, normalizeLump, normalizeSetup, newId } from './normalize';
import { DATA_VERSION, PLAN_COLORS, type AppData, type Plan } from './types';

// The previous single-page site (now at /classic/) kept its data in localStorage under these keys.
// This site has the same address, so the data is still there and can be brought over on first run.
export const CLASSIC_KEYS = { state: 'ttp-state2', saved: 'ttp-scen', defaults: 'ttp-defaults' } as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** True for an object in the previous site's settings shape. */
export function looksClassic(raw: unknown): raw is Obj {
  return isObj(raw) && Array.isArray(raw.kids) && 'loan' in raw && !('version' in raw);
}

/** One of the previous site's settings objects (current state, a saved plan or the defaults) as a plan. */
export function classicToPlan(raw: Obj, name: string, index: number): Plan {
  let n = 0;
  return {
    id: newId('p-'),
    name,
    color: PLAN_COLORS[index % PLAN_COLORS.length],
    setup: normalizeSetup(raw),
    // The previous site had no recorded facts: every timeline entry was a guess about the future.
    changes: (Array.isArray(raw.events) ? raw.events : [])
      .map((e) => normalizeChange(isObj(e) ? { ...e, id: `c-${++n}` } : e))
      .filter((c): c is NonNullable<typeof c> => c !== null),
    lumps: (Array.isArray(raw.oneoffs) ? raw.oneoffs : [])
      .map((o) => normalizeLump(isObj(o) ? { ...o, id: `l-${++n}` } : o))
      .filter((l): l is NonNullable<typeof l> => l !== null),
    editedAt: new Date().toISOString(),
  };
}

function parse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const sameSettings = (a: Obj, b: Obj) => JSON.stringify(normalizeSetup(a)) === JSON.stringify(normalizeSetup(b))
  && JSON.stringify(a.events ?? []) === JSON.stringify(b.events ?? []) && JSON.stringify(a.oneoffs ?? []) === JSON.stringify(b.oneoffs ?? []);

/**
 * Build app data from whatever the previous site left behind: the current settings become the active plan,
 * each saved plan comes over with its name, and saved defaults come over if they differ from the current settings.
 * Returns null when there is nothing to bring over.
 */
export function importClassic(read: (key: string) => string | null = readItem): AppData | null {
  const state = parse(read(CLASSIC_KEYS.state));
  const saved = parse(read(CLASSIC_KEYS.saved));
  const defaults = parse(read(CLASSIC_KEYS.defaults));

  const plans: Plan[] = [];
  if (looksClassic(state)) plans.push(classicToPlan(state, 'My plan', 0));
  if (Array.isArray(saved)) {
    for (const s of saved.slice(0, 10)) {
      if (isObj(s) && looksClassic(s.state)) {
        const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 60) : `Saved plan ${plans.length}`;
        plans.push(classicToPlan(s.state, name, plans.length));
      }
    }
  }
  if (looksClassic(defaults) && !(looksClassic(state) && sameSettings(state, defaults))) {
    plans.push(classicToPlan(defaults, 'My saved defaults', plans.length));
  }
  if (plans.length === 0) return null;

  return {
    version: DATA_VERSION,
    plans,
    activePlanId: plans[0].id,
    facts: [],
    factLumps: [],
    checkIns: [],
    importedFromClassic: new Date().toISOString(),
  };
}
