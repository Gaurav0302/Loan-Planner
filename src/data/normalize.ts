import { DEFAULT_SETUP, type Change, type ChangeType, type Kid, type Lump, type Setup } from '../engine';
import { DATA_VERSION, PLAN_COLORS, type AppData, type CheckIn, type Plan } from './types';

// Everything read from storage or a backup file goes through here, so a damaged or hand-edited
// file can never put the app into a state the engine cannot handle.

const YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function newId(prefix = ''): string {
  const c = globalThis.crypto;
  const raw = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return prefix + raw;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function ym(v: unknown, fallback: string): string {
  return typeof v === 'string' && YM_PATTERN.test(v) ? v : fallback;
}

function optionalYm(v: unknown): string | undefined {
  return typeof v === 'string' && YM_PATTERN.test(v) ? v : undefined;
}

function text(v: unknown, fallback: string, maxLength = 60): string {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, maxLength) : fallback;
}

export function normalizeKid(raw: unknown, i: number, start: string): Kid {
  const k = isObj(raw) ? raw : {};
  return {
    name: text(k.name, `Child ${i + 1}`, 40),
    monthly: num(k.monthly, 0, 0),
    start: ym(k.start, start),
    uni: Math.round(num(k.uni, 2040, 1990, 2100)),
    goal: num(k.goal, 0, 0),
  };
}

/** Any object with setup-like fields becomes a complete Setup. Accepts the previous site's `bonusM`. */
export function normalizeSetup(raw: unknown): Setup {
  const s = isObj(raw) ? raw : {};
  const d = DEFAULT_SETUP;
  const start = ym(s.start, d.start);
  return {
    loan: num(s.loan, d.loan, 0),
    rate: num(s.rate, d.rate, 0, 30),
    term: Math.round(num(s.term, d.term, 1, 50)),
    start,
    offset0: num(s.offset0, d.offset0, 0),
    inc1: num(s.inc1, d.inc1, 0),
    inc2: num(s.inc2, d.inc2, 0),
    living: num(s.living, d.living, 0),
    sac1: num(s.sac1, d.sac1, 0),
    sac2: num(s.sac2, d.sac2, 0),
    tax: num(s.tax, d.tax, 0, 100),
    growth: num(s.growth, d.growth, -10, 20),
    extra: num(s.extra, d.extra, 0),
    sweep: typeof s.sweep === 'boolean' ? s.sweep : d.sweep,
    bonus: num(s.bonus, d.bonus, 0),
    bonusMonth: Math.round(num(s.bonusMonth ?? s.bonusM, d.bonusMonth, 1, 12)),
    kids: Array.isArray(s.kids) ? s.kids.slice(0, 8).map((k, i) => normalizeKid(k, i, start)) : d.kids.map((k) => ({ ...k })),
    kidsInOffset: typeof s.kidsInOffset === 'boolean' ? s.kidsInOffset : d.kidsInOffset,
    eduRate: num(s.eduRate, d.eduRate, -20, 30),
    uniYears: Math.round(num(s.uniYears, d.uniYears, 1, 10)),
  };
}

const PLAIN_TYPES: ChangeType[] = ['rate', 'inc1', 'inc2', 'living', 'extra', 'bonus', 'sweep'];
function changeType(v: unknown): ChangeType | null {
  if (typeof v !== 'string') return null;
  if ((PLAIN_TYPES as string[]).includes(v)) return v as ChangeType;
  return /^kid\d$/.test(v) ? (v as ChangeType) : null;
}

/** Returns null for entries that cannot be used, so callers can drop them. */
export function normalizeChange(raw: unknown): Change | null {
  if (!isObj(raw)) return null;
  const type = changeType(raw.type);
  const month = optionalYm(raw.month);
  if (!type || !month) return null;
  const value = num(raw.value, NaN);
  if (!Number.isFinite(value)) return null;
  const c: Change = { id: text(raw.id, newId('c-'), 80), month, type, value: type === 'sweep' ? (value ? 1 : 0) : value };
  const until = optionalYm(raw.until);
  if (until && until >= month) c.until = until;
  if (type === 'rate') {
    const repayment = num(raw.repayment, NaN, 0);
    const keepPaying = num(raw.keepPaying, NaN, 0);
    if (Number.isFinite(keepPaying) && keepPaying > 0) c.keepPaying = keepPaying;
    else if (Number.isFinite(repayment) && repayment > 0) c.repayment = repayment;
  }
  return c;
}

export function normalizeLump(raw: unknown): Lump | null {
  if (!isObj(raw)) return null;
  const month = optionalYm(raw.month);
  const amount = num(raw.amount, NaN);
  if (!month || !Number.isFinite(amount)) return null;
  return { id: text(raw.id, newId('l-'), 80), month, amount };
}

const list = <T,>(v: unknown, fn: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.map(fn).filter((x): x is T => x !== null) : []);

export function normalizePlan(raw: unknown, i: number): Plan {
  const p = isObj(raw) ? raw : {};
  return {
    id: text(p.id, newId('p-'), 80),
    name: text(p.name, `Plan ${i + 1}`),
    color: typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : PLAN_COLORS[i % PLAN_COLORS.length],
    setup: normalizeSetup(p.setup),
    changes: list(p.changes, normalizeChange),
    lumps: list(p.lumps, normalizeLump),
    editedAt: typeof p.editedAt === 'string' ? p.editedAt : new Date().toISOString(),
  };
}

function normalizeCheckIn(raw: unknown): CheckIn | null {
  if (!isObj(raw)) return null;
  const month = optionalYm(raw.month);
  if (!month) return null;
  const loan = num(raw.loan, NaN, 0);
  const offset = num(raw.offset, NaN, 0);
  if (!Number.isFinite(loan) || !Number.isFinite(offset)) return null;
  return { month, loan, offset, kids: Array.isArray(raw.kids) ? raw.kids.map((k) => num(k, 0, 0)) : [] };
}

/** A full app data object in the current format, or null if `raw` is not one. */
export function normalizeData(raw: unknown): AppData | null {
  if (!isObj(raw) || raw.version !== DATA_VERSION || !Array.isArray(raw.plans) || raw.plans.length === 0) return null;
  const plans = raw.plans.slice(0, 50).map(normalizePlan);
  // Ids must be unique for the editor and the active-plan pointer to work.
  const seen = new Set<string>();
  for (const p of plans) { if (seen.has(p.id)) p.id = newId('p-'); seen.add(p.id); }
  const activePlanId = typeof raw.activePlanId === 'string' && plans.some((p) => p.id === raw.activePlanId) ? raw.activePlanId : plans[0].id;
  const checkIns = list(raw.checkIns, normalizeCheckIn).sort((a, b) => a.month.localeCompare(b.month));
  const data: AppData = {
    version: DATA_VERSION,
    plans,
    activePlanId,
    facts: list(raw.facts, normalizeChange),
    factLumps: list(raw.factLumps, normalizeLump),
    checkIns: checkIns.filter((c, i) => i === 0 || c.month !== checkIns[i - 1].month),
  };
  if (typeof raw.importedFromClassic === 'string') data.importedFromClassic = raw.importedFromClassic;
  if (raw.importNoticeSeen === true) data.importNoticeSeen = true;
  return data;
}
