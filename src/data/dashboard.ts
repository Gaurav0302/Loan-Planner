import { toIdx, type MonthPoint, type SimResult, type YM } from '../engine';
import { describeChange } from './describe';
import { runPlan, type PlanRun } from './plans';
import type { AppData, CheckIn, Plan } from './types';

type Status = 'ahead' | 'behind' | 'on' | 'none';

export function pointAt(res: SimResult, idx: number): MonthPoint {
  return res.points.find((p) => p.idx === idx) ?? (idx < res.startIdx ? res.points[0] : res.points[res.points.length - 1]);
}

const kidsInOffset = (plan: Plan, kids: number[]) => (plan.setup.kidsInOffset ? kids.reduce((a, b) => a + b, 0) : 0);

/** What the plan expected at the end of `month`, working forward from the check-in before it. Offset as a statement shows it. */
export function expectedAt(data: AppData, plan: Plan, month: YM) {
  const run = runPlan(data, plan, { beforeMonth: month });
  const p = pointAt(run.res, toIdx(month));
  return { loan: p.loan, offset: p.offset + kidsInOffset(plan, p.kids), kids: p.kids, net: p.net };
}

/** Net debt for a check-in: loan minus offset, not counting college money held in the offset. */
export function checkInNet(plan: Plan, c: CheckIn): number {
  return c.loan - (c.offset - kidsInOffset(plan, c.kids));
}

export interface DashboardModel {
  todayIdx: number;
  started: boolean;
  /** Projection from the latest real balances. */
  now: PlanRun;
  /** What the plan expected before the latest check-in arrived. */
  planned: PlanRun;
  /** The plan as set, with no recorded changes and no check-ins. */
  original: SimResult;
  latest?: CheckIn;
  /** Month the "so far" figures are measured to. */
  asOfIdx: number;
  loan: { status: Status; diff: number; net: number; cancelled: number };
  college: { status: Status; now: number; expected: number; kids: { name: string; uni: number; atUni: number; goal: number }[] };
  savings: { timeSaved: number; interestSaved: number; interest: number; bankInterest: number; avoidedSoFar: number; offsetGrowth: number };
  month: { point: MonthPoint; largerIncomeOnly: number; offsetCovers: number };
  upcoming: { idx: number; text: string }[];
  recent: { month: YM; net: number; diff: number }[];
}

export function dashboardModel(data: AppData, plan: Plan, todayIdx: number): DashboardModel {
  const s = plan.setup;
  const startIdx = toIdx(s.start);
  const started = todayIdx >= startIdx;
  const now = runPlan(data, plan);
  const latest = now.anchor;
  const planned = latest ? runPlan(data, plan, { beforeMonth: latest.month }) : now;
  const original = runPlan({ facts: [], factLumps: [] }, plan, { anchored: false }).res;
  const nowIdx = Math.min(Math.max(todayIdx, startIdx), now.res.paidIdx);
  const asOfIdx = latest ? toIdx(latest.month) : nowIdx;

  // How the latest check-in compares with what the plan expected for that month.
  let loanStatus: Status = 'none', loanDiff = 0, kidsStatus: Status = 'none', kidsNow: number, kidsExpected: number;
  const asOf = pointAt(now.res, asOfIdx);
  if (latest) {
    const exp = pointAt(planned.res, asOfIdx);
    loanDiff = exp.net - checkInNet(plan, latest);
    loanStatus = loanDiff > 500 ? 'ahead' : loanDiff < -500 ? 'behind' : 'on';
    kidsNow = latest.kids.slice(0, s.kids.length).reduce((a, b) => a + b, 0);
    kidsExpected = exp.kids.reduce((a, b) => a + b, 0);
    if (s.kids.length) kidsStatus = kidsNow - kidsExpected > 100 ? 'ahead' : kidsNow - kidsExpected < -100 ? 'behind' : 'on';
  } else {
    kidsNow = started ? asOf.kids.reduce((a, b) => a + b, 0) : 0;
    kidsExpected = kidsNow;
  }
  const net = latest ? checkInNet(plan, latest) : started ? asOf.net : s.loan - s.offset0;

  const bankAsOf = pointAt(now.bank, asOfIdx);
  const offsetNow = latest ? latest.offset - kidsInOffset(plan, latest.kids) : asOf.offset;

  const monthPoint = pointAt(now.res, nowIdx);
  const sacCost = (s.sac1 + s.sac2) * (1 - s.tax / 100);
  const larger = Math.max(monthPoint.settings.inc1, monthPoint.settings.inc2) - sacCost - monthPoint.paidOut - monthPoint.living - monthPoint.kidsSaving;

  const horizon = todayIdx + 24;
  const upcoming = [...data.facts, ...plan.changes]
    .filter((c) => toIdx(c.month) > todayIdx && toIdx(c.month) <= horizon)
    .map((c) => ({ idx: toIdx(c.month), text: describeChange(c, s.kids) }));
  s.kids.forEach((k) => {
    const u = k.uni * 12 + 1;
    if (u > todayIdx && u <= horizon) upcoming.push({ idx: u, text: `${k.name} starts university.` });
  });
  upcoming.sort((a, b) => a.idx - b.idx);

  const recent = data.checkIns
    .filter((c) => c.month >= s.start)
    .slice(-4)
    .reverse()
    .map((c) => ({ month: c.month, net: checkInNet(plan, c), diff: expectedAt(data, plan, c.month).net - checkInNet(plan, c) }));

  return {
    todayIdx, started, now, planned, original, latest, asOfIdx,
    loan: { status: loanStatus, diff: loanDiff, net, cancelled: Math.max(0, Math.min(1, 1 - net / s.loan)) },
    college: {
      status: kidsStatus, now: kidsNow, expected: kidsExpected,
      kids: s.kids.map((k, i) => ({ name: k.name, uni: k.uni, atUni: now.res.kidsAtUni[i] ?? 0, goal: k.goal })),
    },
    savings: {
      timeSaved: now.bank.paidMonth - now.res.paidMonth,
      interestSaved: now.bank.totalInterest - now.res.totalInterest,
      interest: now.res.totalInterest,
      bankInterest: now.bank.totalInterest,
      avoidedSoFar: started ? Math.max(0, bankAsOf.cumInterest - asOf.cumInterest) : 0,
      offsetGrowth: started ? offsetNow - s.offset0 : 0,
    },
    month: { point: monthPoint, largerIncomeOnly: larger, offsetCovers: offsetNow / Math.max(1, monthPoint.paidOut + monthPoint.living) },
    upcoming: upcoming.slice(0, 5),
    recent,
  };
}
