import { addMonths, simulate, toIdx, toYM, type Change, type SimResult, type YM } from '../engine';
import { newId } from './normalize';
import { PLAN_COLORS, type AppData, type Plan } from './types';

/** A plan's projection with every recorded fact applied, and the bank's schedule on the same rates for comparison. */
export interface PlanRun {
  res: SimResult;
  bank: SimResult;
}

export function runPlan(data: Pick<AppData, 'facts' | 'factLumps'>, plan: Plan): PlanRun {
  const changes = [...data.facts, ...plan.changes];
  return {
    res: simulate(plan.setup, changes, [...data.factLumps, ...plan.lumps]),
    // Minimum repayments only, but on the same rate path, so the comparison is about your approach, not the rates.
    bank: simulate(plan.setup, changes, [], { extras: false }),
  };
}

export interface PlanSummary {
  paidIdx: number;
  paidMonth: number;
  interest: number;
  timeSaved: number;
  interestSaved: number;
  kidsAtUni: number[];
  collegeTotal: number;
  goalsMet: number;
  goalsSet: number;
  /** Months where costs are more than pay while the loan runs. */
  shortMonths: number;
  drawn: number;
  unfunded: number;
}

export function summarizeRun(plan: Plan, { res, bank }: PlanRun): PlanSummary {
  let shortMonths = 0, drawn = 0, unfunded = 0;
  for (const p of res.points) {
    if (!p.loanActive) break;
    if (p.spare < 0) shortMonths++;
    drawn += p.drawn;
    unfunded += p.unfunded;
  }
  const goals = plan.setup.kids.map((k, i) => (k.goal > 0 ? res.kidsAtUni[i] >= k.goal : null));
  return {
    paidIdx: res.paidIdx,
    paidMonth: res.paidMonth,
    interest: res.totalInterest,
    timeSaved: bank.paidMonth - res.paidMonth,
    interestSaved: bank.totalInterest - res.totalInterest,
    kidsAtUni: res.kidsAtUni,
    collegeTotal: res.kidsAtUni.reduce((a, b) => a + b, 0),
    goalsMet: goals.filter((g) => g === true).length,
    goalsSet: goals.filter((g) => g !== null).length,
    shortMonths,
    drawn,
    unfunded,
  };
}

export function duplicatePlan(plan: Plan, existing: Plan[]): Plan {
  const copy: Plan = structuredClone(plan);
  copy.id = newId('p-');
  const base = plan.name.replace(/ copy( \d+)?$/, '');
  let name = `${base} copy`;
  for (let n = 2; existing.some((p) => p.name === name); n++) name = `${base} copy ${n}`;
  copy.name = name.slice(0, 60);
  copy.color = PLAN_COLORS[existing.length % PLAN_COLORS.length];
  copy.editedAt = new Date().toISOString();
  return copy;
}

/** Remove a child and keep every per-child change pointing at the right child. */
export function removeKid(plan: Plan, index: number): Plan {
  const kids = plan.setup.kids.filter((_, i) => i !== index);
  const changes: Change[] = [];
  for (const c of plan.changes) {
    if (!c.type.startsWith('kid')) { changes.push(c); continue; }
    const i = Number(c.type.slice(3));
    if (i === index) continue;
    changes.push(i > index ? { ...c, type: `kid${i - 1}` } : c);
  }
  return { ...plan, setup: { ...plan.setup, kids }, changes };
}

/** The month presets start from: next month, or the first repayment if the loan has not started yet. */
export function presetStart(plan: Plan, today: Date = new Date()): YM {
  const next = toYM(today.getFullYear() * 12 + today.getMonth() + 1);
  return toIdx(next) > toIdx(plan.setup.start) ? next : plan.setup.start;
}

/** The previous site's quick presets, now dated from `from`. `rate` is the rate in effect then. */
export function presets(plan: Plan, from: YM, rate: number): { label: string; changes: Omit<Change, 'id'>[] }[] {
  const at = (months: number) => addMonths(from, months);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const s = plan.setup;
  return [
    { label: 'Rate falls 0.25% every 6 months for 2 years', changes: [1, 2, 3, 4].map((k) => ({ month: at(6 * (k - 1)), type: 'rate', value: r2(rate - 0.25 * k) })) },
    { label: 'Rate rises 0.25% every 6 months for 2 years', changes: [1, 2, 3, 4].map((k) => ({ month: at(6 * (k - 1)), type: 'rate', value: r2(rate + 0.25 * k) })) },
    { label: 'Rates up 1.5% over 3 years, then back down', changes: [
      ...[1, 2, 3, 4, 5, 6].map((k) => ({ month: at(6 * (k - 1)), type: 'rate' as const, value: r2(rate + 0.25 * k) })),
      ...[1, 2, 3, 4, 5, 6].map((k) => ({ month: at(36 + 6 * (k - 1)), type: 'rate' as const, value: r2(rate + 1.5 - 0.25 * k) })),
    ] },
    { label: 'A year on one income', changes: [{ month: at(12), until: at(23), type: 'inc2', value: 0 }] },
    { label: 'Your pay rises $1,000 a month', changes: [{ month: at(6), type: 'inc1', value: s.inc1 + 1000 }] },
    { label: 'Living costs rise $1,000 a month', changes: [{ month: at(12), type: 'living', value: s.living + 1000 }] },
    { label: 'Pause the extra for 6 months', changes: [{ month: at(6), until: at(11), type: 'extra', value: 0 }] },
  ];
}

export interface WhatIf {
  label: string;
  paidIdx: number;
  months: number;
  interest: number;
}

/** "What if one thing changed": each line changes one thing and keeps everything else, as the previous site did. */
export function whatIfs(data: Pick<AppData, 'facts' | 'factLumps'>, plan: Plan, base: PlanRun): WhatIf[] {
  const first = base.res.points[0];
  const vary = (label: string, fn: (p: Plan) => void): WhatIf => {
    const p: Plan = structuredClone(plan);
    fn(p);
    const { res } = runPlan(data, p);
    return { label, paidIdx: res.paidIdx, months: res.paidMonth - base.res.paidMonth, interest: res.totalInterest - base.res.totalInterest };
  };
  const shiftRates = (p: Plan, by: number) => {
    p.setup.rate += by;
    p.changes = p.changes.map((c) => (c.type === 'rate' ? { ...c, value: c.value + by } : c));
  };
  const fixedExtra = (p: Plan, value: number) => {
    p.setup.sweep = false;
    p.setup.extra = Math.max(0, value);
    p.changes = p.changes.filter((c) => c.type !== 'extra' && c.type !== 'sweep');
  };
  return [
    vary('Rates 1% higher throughout', (p) => shiftRates(p, 1)),
    vary('Rates 1% lower throughout', (p) => shiftRates(p, -1)),
    vary('$500 a month less into the offset', (p) => fixedExtra(p, first.extra - 500)),
    vary('$500 a month more into the offset', (p) => fixedExtra(p, first.extra + 500)),
    vary('None of this plan’s life changes', (p) => { p.changes = []; p.lumps = []; }),
    vary(plan.setup.kidsInOffset ? 'College funds invested instead' : 'College funds kept in the offset', (p) => { p.setup.kidsInOffset = !p.setup.kidsInOffset; }),
    vary('No college saving at all', (p) => { p.setup.kids = p.setup.kids.map((k) => ({ ...k, monthly: 0 })); p.changes = p.changes.filter((c) => !c.type.startsWith('kid')); }),
    vary('$50,000 less in the offset at the start', (p) => { p.setup.offset0 = Math.max(0, p.setup.offset0 - 50000); }),
  ];
}
