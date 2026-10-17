import { describe, expect, it } from 'vitest';
import { describeChange, monthlyForGoal } from './describe';
import { starterData } from './load';
import { duplicatePlan, presetStart, presets, removeKid, runPlan, summarizeRun, whatIfs } from './plans';
import { reducer } from './store';
import type { Plan } from './types';

const plan = (): Plan => structuredClone(starterData().plans[0]);

describe('plan actions', () => {
  it('makes a plan active, saves edits and clears the draft', () => {
    let s = starterData();
    const copy = duplicatePlan(s.plans[0], s.plans);
    s = reducer(s, { type: 'addPlan', plan: copy });
    s = reducer(s, { type: 'setActive', id: copy.id });
    expect(s.activePlanId).toBe(copy.id);
    s = reducer(s, { type: 'setDraft', plan: { ...copy, name: 'Edited' } });
    expect(s.drafts?.[copy.id].name).toBe('Edited');
    s = reducer(s, { type: 'savePlan', plan: s.drafts![copy.id] });
    expect(s.plans.find((p) => p.id === copy.id)!.name).toBe('Edited');
    expect(s.drafts).toBeUndefined();
  });

  it('moves the active plan when the active one is deleted, and never deletes the last plan', () => {
    let s = starterData();
    const copy = duplicatePlan(s.plans[0], s.plans);
    s = reducer(reducer(s, { type: 'addPlan', plan: copy }), { type: 'setActive', id: copy.id });
    s = reducer(s, { type: 'deletePlan', id: copy.id });
    expect(s.plans).toHaveLength(1);
    expect(s.activePlanId).toBe(s.plans[0].id);
    expect(reducer(s, { type: 'deletePlan', id: s.plans[0].id }).plans).toHaveLength(1);
  });

  it('names copies so they can be told apart', () => {
    const s = starterData();
    const a = duplicatePlan(s.plans[0], s.plans);
    const b = duplicatePlan(s.plans[0], [...s.plans, a]);
    expect([a.name, b.name]).toEqual(['My plan copy', 'My plan copy 2']);
    expect(a.id).not.toBe(s.plans[0].id);
  });
});

describe('removing a child', () => {
  it('drops that child’s changes and renumbers the others', () => {
    const p = plan();
    p.setup.kids.push({ name: 'Third', monthly: 100, start: '2026-12', uni: 2042, goal: 0 });
    p.changes = [
      { id: 'a', month: '2028-01', type: 'kid0', value: 400 },
      { id: 'b', month: '2028-01', type: 'kid1', value: 500 },
      { id: 'c', month: '2028-01', type: 'kid2', value: 600 },
      { id: 'd', month: '2028-01', type: 'extra', value: 2500 },
    ];
    const after = removeKid(p, 1);
    expect(after.setup.kids.map((k) => k.name)).toEqual(['Greesha', 'Third']);
    expect(after.changes.map((c) => `${c.id}:${c.type}`)).toEqual(['a:kid0', 'c:kid1', 'd:extra']);
  });
});

describe('results for a plan', () => {
  it('applies recorded facts to every plan and compares with the bank on the same rates', () => {
    const p = plan();
    const facts = [{ id: 'f', month: '2027-03', type: 'rate' as const, value: 5.95 }];
    const run = runPlan({ facts, factLumps: [] }, p);
    expect(run.res.points.find((x) => x.idx === 2027 * 12 + 2)!.rate).toBe(5.95);
    expect(run.bank.points.find((x) => x.idx === 2027 * 12 + 2)!.rate).toBe(5.95);
    const sum = summarizeRun(p, run);
    expect(sum.timeSaved).toBeGreaterThan(0);
    expect(sum.interestSaved).toBeGreaterThan(0);
  });

  it('counts months where costs exceed pay', () => {
    const p = plan();
    p.changes = [{ id: 'x', month: '2028-07', until: '2029-06', type: 'inc2', value: 0 }];
    const sum = summarizeRun(p, runPlan({ facts: [], factLumps: [] }, p));
    expect(sum.shortMonths).toBe(12);
    expect(sum.drawn).toBeGreaterThan(0);
  });

  it('lists what happens when one thing changes', () => {
    const p = plan();
    const base = runPlan({ facts: [], factLumps: [] }, p);
    const tests = whatIfs({ facts: [], factLumps: [] }, p, base);
    expect(tests).toHaveLength(8);
    const more = tests.find((t) => t.label.startsWith('$500 a month more'))!;
    expect(more.months).toBeLessThan(0);
    expect(more.interest).toBeLessThan(0);
    const higher = tests.find((t) => t.label === 'Rates 1% higher throughout')!;
    expect(higher.interest).toBeGreaterThan(0);
  });
});

describe('presets and wording', () => {
  it('dates presets from next month, or from the first repayment if the loan has not started', () => {
    const p = plan();
    expect(presetStart(p, new Date(2026, 9, 18))).toBe('2026-12');
    expect(presetStart(p, new Date(2027, 5, 10))).toBe('2027-07');
    const leave = presets(p, '2027-07', 6.2).find((x) => x.label === 'A year on one income')!;
    expect(leave.changes).toEqual([{ month: '2028-07', until: '2029-06', type: 'inc2', value: 0 }]);
  });

  it('describes changes in plain words', () => {
    const kids = plan().setup.kids;
    expect(describeChange({ id: 'a', month: '2028-07', until: '2029-06', type: 'inc2', value: 0 }, kids))
      .toBe('From Jul 2028 to Jun 2029, partner’s take-home becomes $0 a month, then goes back.');
    expect(describeChange({ id: 'b', month: '2027-03', type: 'rate', value: 5.95, keepPaying: 6762 }, kids))
      .toBe('From Mar 2027, the rate becomes 5.95%, and you keep paying $6,762.');
    expect(describeChange({ id: 'c', month: '2028-01', type: 'kid0', value: 400 }, kids))
      .toBe('From Jan 2028, Greesha’s college saving becomes $400 a month.');
  });

  it('works out the monthly amount that reaches a goal', () => {
    const p = plan();
    p.setup.kidsInOffset = false;
    const kid = { ...p.setup.kids[0], goal: 25000 };
    const need = monthlyForGoal(p.setup, kid);
    p.setup.kids[0] = { ...kid, monthly: need };
    const res = runPlan({ facts: [], factLumps: [] }, p).res;
    expect(res.kidsAtUni[0]).toBeCloseTo(25000, 0);
  });
});
