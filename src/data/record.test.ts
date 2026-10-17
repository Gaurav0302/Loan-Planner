import { describe, expect, it } from 'vitest';
import { monthLabel, toIdx } from '../engine';
import { starterData } from './load';
import { estimateRepayment, latestCheckIn, runPlan } from './plans';
import { reducer } from './store';

describe('recorded changes', () => {
  it('are added, apply to every plan and can be undone', () => {
    let s = starterData();
    s = reducer(s, { type: 'addFact', change: { id: 'f1', month: '2027-03', type: 'rate', value: 5.95, repayment: 6578 } });
    s = reducer(s, { type: 'addFactLump', lump: { id: 'l1', month: '2027-09', amount: 15000 } });
    const run = runPlan(s, s.plans[0]);
    const march = run.res.points.find((p) => p.idx === toIdx('2027-03'))!;
    expect(march.rate).toBe(5.95);
    expect(march.repayment).toBe(6578);
    s = reducer(s, { type: 'removeFact', id: 'f1' });
    s = reducer(s, { type: 'removeFactLump', id: 'l1' });
    expect(s.facts).toEqual([]);
    expect(s.factLumps).toEqual([]);
  });

  it('estimates the bank’s new repayment from the balance at the time', () => {
    const s = starterData();
    const { res } = runPlan(s, s.plans[0]);
    expect(Math.round(estimateRepayment(res, '2027-03', 5.95))).toBe(6578);
    // At the same rate it comes out a little lower than today's repayment, because the offset makes the
    // balance fall faster than the bank's schedule.
    const same = estimateRepayment(res, '2027-03', 6.2);
    expect(same).toBeLessThan(6762);
    expect(same).toBeGreaterThan(6740);
  });
});

describe('check-ins', () => {
  it('keep one entry per month, in order', () => {
    let s = starterData();
    s = reducer(s, { type: 'saveCheckIn', checkIn: { month: '2027-05', loan: 1, offset: 1, kids: [] } });
    s = reducer(s, { type: 'saveCheckIn', checkIn: { month: '2027-02', loan: 1, offset: 1, kids: [] } });
    s = reducer(s, { type: 'saveCheckIn', checkIn: { month: '2027-05', loan: 2, offset: 2, kids: [] } });
    expect(s.checkIns.map((c) => `${c.month}:${c.loan}`)).toEqual(['2027-02:1', '2027-05:2']);
    s = reducer(s, { type: 'removeCheckIn', month: '2027-02' });
    expect(s.checkIns).toHaveLength(1);
  });

  it('restart every plan from the latest real balances', () => {
    let s = starterData();
    const plain = runPlan(s, s.plans[0]);
    const may = plain.res.points.find((p) => p.idx === toIdx('2027-05'))!;
    const kidsTotal = may.kids.reduce((a, b) => a + b, 0);
    s = reducer(s, { type: 'saveCheckIn', checkIn: { month: '2027-02', loan: 1, offset: 1, kids: [] } });
    s = reducer(s, { type: 'saveCheckIn', checkIn: { month: '2027-05', loan: Math.round(may.loan), offset: Math.round(may.offset + kidsTotal) + 25000, kids: may.kids } });
    const anchored = runPlan(s, s.plans[0]);
    expect(anchored.anchor?.month).toBe('2027-05');
    expect(anchored.res.paidMonth).toBeLessThan(plain.res.paidMonth);
    // Only check-ins before a month are used when asking what the plan expected for that month.
    expect(runPlan(s, s.plans[0], { beforeMonth: '2027-05' }).anchor?.month).toBe('2027-02');
    expect(monthLabel(runPlan(s, s.plans[0], { anchored: false }).res.paidIdx)).toBe(monthLabel(plain.res.paidIdx));
  });

  it('ignore check-ins from before the loan started', () => {
    const s = starterData();
    s.checkIns = [{ month: '2026-06', loan: 1, offset: 1, kids: [] }];
    expect(latestCheckIn(s.checkIns, s.plans[0])).toBeUndefined();
  });
});
