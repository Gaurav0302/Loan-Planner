import { describe, expect, it } from 'vitest';
import { CLASSIC_DEFAULTS, classicRun } from '../engine/classic.fixture';
import { simulate } from '../engine';
import { backupJson, parseBackup } from './backup';
import { CLASSIC_KEYS, importClassic } from './classic';
import { DATA_KEY, loadData, starterData } from './load';
import { normalizeChange, normalizeData, normalizeSetup } from './normalize';

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const storage = (items: Record<string, unknown>) => (key: string) => (key in items ? (typeof items[key] === 'string' ? (items[key] as string) : JSON.stringify(items[key])) : null);

const myState = () => {
  const s = clone(CLASSIC_DEFAULTS);
  s.extra = 2500;
  s.bonus = 6000;
  s.bonusM = 12;
  s.events = [{ month: '2027-06', type: 'rate', value: 5.95 }, { month: '2028-07', until: '2029-06', type: 'inc2', value: 0 }];
  s.oneoffs = [{ amount: 20000, month: '2028-07' }];
  return s;
};

describe('bringing data over from the previous site', () => {
  it('makes the current settings the active plan and keeps every saved plan by name', () => {
    const saved = [{ name: 'Plan A', state: clone(CLASSIC_DEFAULTS) }, { name: 'Plan B', state: { ...clone(CLASSIC_DEFAULTS), sweep: true } }];
    const data = importClassic(storage({ [CLASSIC_KEYS.state]: myState(), [CLASSIC_KEYS.saved]: saved }))!;
    expect(data.plans.map((p) => p.name)).toEqual(['My plan', 'Plan A', 'Plan B']);
    expect(data.activePlanId).toBe(data.plans[0].id);
    expect(data.importedFromClassic).toBeTruthy();
    const mine = data.plans[0];
    expect(mine.setup.extra).toBe(2500);
    expect(mine.setup.bonusMonth).toBe(12);
    expect(mine.changes).toHaveLength(2);
    expect(mine.changes[1]).toMatchObject({ type: 'inc2', month: '2028-07', until: '2029-06', value: 0 });
    expect(mine.lumps).toEqual([expect.objectContaining({ month: '2028-07', amount: 20000 })]);
    expect(data.plans[2].setup.sweep).toBe(true);
  });

  it('gives exactly the numbers the previous site gave for the imported plan', () => {
    const state = myState();
    const plan = importClassic(storage({ [CLASSIC_KEYS.state]: state }))!.plans[0];
    const old = classicRun(state, true);
    const now = simulate(plan.setup, plan.changes, plan.lumps, { drawShortfall: false });
    expect(now.paidMonth).toBe(old.paidMonth);
    expect(now.totalInterest).toBeCloseTo(old.totalInt, 4);
  });

  it('brings saved defaults over only when they differ from the current settings', () => {
    const same = importClassic(storage({ [CLASSIC_KEYS.state]: myState(), [CLASSIC_KEYS.defaults]: myState() }))!;
    expect(same.plans).toHaveLength(1);
    const different = importClassic(storage({ [CLASSIC_KEYS.state]: myState(), [CLASSIC_KEYS.defaults]: clone(CLASSIC_DEFAULTS) }))!;
    expect(different.plans.map((p) => p.name)).toEqual(['My plan', 'My saved defaults']);
  });

  it('returns nothing when the previous site left nothing usable', () => {
    expect(importClassic(storage({}))).toBeNull();
    expect(importClassic(storage({ [CLASSIC_KEYS.state]: 'not json', [CLASSIC_KEYS.saved]: '[1,2]' }))).toBeNull();
  });
});

describe('loading', () => {
  it('prefers the app’s own saved data', () => {
    const own = starterData();
    own.plans[0].name = 'Saved here';
    const data = loadData(storage({ [DATA_KEY]: own, [CLASSIC_KEYS.state]: myState() }));
    expect(data.plans[0].name).toBe('Saved here');
    expect(data.importedFromClassic).toBeUndefined();
  });

  it('falls back to the previous site’s data when saved data is damaged', () => {
    const data = loadData(storage({ [DATA_KEY]: '{broken', [CLASSIC_KEYS.state]: myState() }));
    expect(data.plans[0].name).toBe('My plan');
    expect(data.plans[0].setup.extra).toBe(2500);
  });

  it('starts from the built-in values on a first visit', () => {
    const data = loadData(storage({}));
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].setup.loan).toBe(1104000);
  });
});

describe('cleaning up what is read', () => {
  it('fills missing settings and replaces numbers that are not numbers', () => {
    const s = normalizeSetup({ loan: 'abc', rate: '5.5', kids: [{ name: '', monthly: -5 }] });
    expect(s.loan).toBe(1104000);
    expect(s.rate).toBe(5.5);
    expect(s.kids).toEqual([{ name: 'Child 1', monthly: 0, start: '2026-12', uni: 2040, goal: 0 }]);
    expect(s.term).toBe(30);
  });

  it('drops changes it cannot use and keeps the repayment choice on rate changes', () => {
    expect(normalizeChange({ type: 'nope', month: '2027-01', value: 1 })).toBeNull();
    expect(normalizeChange({ type: 'rate', month: '2027-13', value: 5 })).toBeNull();
    expect(normalizeChange({ type: 'rate', month: '2027-03', value: 5.95, keepPaying: 6762, id: 'x' })).toEqual({ id: 'x', type: 'rate', month: '2027-03', value: 5.95, keepPaying: 6762 });
    expect(normalizeChange({ type: 'extra', month: '2027-03', until: '2026-01', value: 0, id: 'y' })).toEqual({ id: 'y', type: 'extra', month: '2027-03', value: 0 });
  });

  it('repairs duplicate plan ids, a missing active plan and repeated check-ins', () => {
    const base = starterData();
    const plan = base.plans[0];
    const raw = {
      ...base,
      plans: [plan, { ...plan, name: 'Copy' }],
      activePlanId: 'gone',
      checkIns: [{ month: '2027-02', loan: 1, offset: 1, kids: [] }, { month: '2027-01', loan: 1, offset: 1, kids: [] }, { month: '2027-02', loan: 2, offset: 2, kids: [] }],
    };
    const data = normalizeData(raw)!;
    expect(new Set(data.plans.map((p) => p.id)).size).toBe(2);
    expect(data.activePlanId).toBe(data.plans[0].id);
    expect(data.checkIns.map((c) => c.month)).toEqual(['2027-01', '2027-02']);
  });
});

describe('backup files', () => {
  it('restores exactly what was saved', () => {
    const data = importClassic(storage({ [CLASSIC_KEYS.state]: myState() }))!;
    data.checkIns = [{ month: '2027-05', loan: 1090000, offset: 85000, kids: [1500, 1500] }];
    data.facts = [{ id: 'f', month: '2027-03', type: 'rate', value: 5.95 }];
    const parsed = parseBackup(backupJson(data));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual(data);
      expect(parsed.summary).toEqual({ plans: 1, facts: 1, checkIns: 1, activePlanName: 'My plan' });
    }
  });

  it('accepts a settings block copied from the previous site', () => {
    const parsed = parseBackup(JSON.stringify(myState()));
    expect(parsed.ok && parsed.fromClassic && parsed.data.plans[0].setup.extra).toBe(2500);
  });

  it('refuses files it cannot use, without changing anything', () => {
    expect(parseBackup('hello').ok).toBe(false);
    expect(parseBackup('{"version":3,"plans":[]}').ok).toBe(false);
    expect(parseBackup('{"version":99,"plans":[{}]}')).toMatchObject({ ok: false, error: expect.stringContaining('newer version') });
    expect(parseBackup('[1,2,3]').ok).toBe(false);
  });
});
