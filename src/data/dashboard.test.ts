import { describe, expect, it } from 'vitest';
import { toIdx } from '../engine';
import { dashboardModel, expectedAt } from './dashboard';
import { starterData } from './load';
import { runPlan } from './plans';

const june2027 = toIdx('2027-06');

describe('dashboard figures', () => {
  it('before the loan starts: nothing so far, projections only', () => {
    const s = starterData();
    const m = dashboardModel(s, s.plans[0], toIdx('2026-10'));
    expect(m.started).toBe(false);
    expect(m.loan.status).toBe('none');
    expect(m.savings.avoidedSoFar).toBe(0);
    expect(m.savings.offsetGrowth).toBe(0);
    expect(m.month.point.idx).toBe(toIdx('2026-12'));
    expect(m.savings.timeSaved).toBeGreaterThan(0);
  });

  it('without check-ins: measures "so far" from the plan up to today', () => {
    const s = starterData();
    const m = dashboardModel(s, s.plans[0], june2027);
    expect(m.asOfIdx).toBe(june2027);
    expect(m.savings.avoidedSoFar).toBeGreaterThan(0);
    expect(m.savings.offsetGrowth).toBeGreaterThan(0);
    expect(m.loan.status).toBe('none');
  });

  it('with a check-in ahead of plan: says so and projects from it', () => {
    const s = starterData();
    const plan = s.plans[0];
    const exp = expectedAt(s, plan, '2027-05');
    s.checkIns = [{ month: '2027-05', loan: Math.round(exp.loan), offset: Math.round(exp.offset) + 8000, kids: exp.kids.map((k) => Math.round(k)) }];
    const m = dashboardModel(s, plan, june2027);
    expect(m.loan.status).toBe('ahead');
    expect(Math.round(m.loan.diff / 1000)).toBe(8);
    expect(m.asOfIdx).toBe(toIdx('2027-05'));
    expect(m.now.res.paidMonth).toBeLessThanOrEqual(m.planned.res.paidMonth);
    expect(m.recent).toHaveLength(1);
    expect(Math.round(m.recent[0].diff / 1000)).toBe(8);
    expect(m.college.status).toBe('on');
  });

  it('compares with the plan as first set when facts have been recorded', () => {
    const s = starterData();
    s.facts = [{ id: 'f', month: '2027-03', type: 'rate', value: 5.95, keepPaying: 6762 }];
    const m = dashboardModel(s, s.plans[0], june2027);
    expect(m.now.res.paidMonth).toBeLessThan(m.original.paidMonth);
    expect(runPlan(s, s.plans[0]).res.paidMonth).toBe(m.now.res.paidMonth);
  });

  it('lists what is coming up in the next two years', () => {
    const s = starterData();
    s.plans[0].changes = [{ id: 'g', month: '2028-07', until: '2029-06', type: 'inc2', value: 0 }, { id: 'h', month: '2031-01', type: 'living', value: 7000 }];
    const m = dashboardModel(s, s.plans[0], june2027);
    expect(m.upcoming.map((u) => u.text)).toEqual(['From Jul 2028 to Jun 2029, partner’s take-home becomes $0 a month, then goes back.']);
  });
});
