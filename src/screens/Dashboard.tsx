import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Stat } from '../components/Stat';
import { DEFAULT_SETUP, monthLabel, money, moneyShort, simulate, years } from '../engine';

export function Dashboard() {
  const { plan, bank } = useMemo(
    () => ({ plan: simulate(DEFAULT_SETUP, [], []), bank: simulate(DEFAULT_SETUP, [], [], { extras: false }) }),
    [],
  );
  const first = plan.points[0];

  return (
    <div className="page">
      <PageHeader eyebrow="Dashboard" title="How you're doing" sub="Your real balances compared with the active plan." />

      <section className="card" aria-labelledby="engine-check">
        <h2 className="card-title" id="engine-check">Calculation check, built-in starting values</h2>
        <div className="grid-4">
          <Stat label="Paid off" value={monthLabel(plan.paidIdx)} sub={`${years(plan.paidMonth)} of repayments`} />
          <Stat tone="good" label="Time saved" value={years(bank.paidMonth - plan.paidMonth)} sub={`The bank's schedule ends ${monthLabel(bank.paidIdx)}`} />
          <Stat tone="good" label="Interest saved" value={moneyShort(bank.totalInterest - plan.totalInterest)} sub={`You pay ${moneyShort(plan.totalInterest)} instead of ${moneyShort(bank.totalInterest)}`} />
          <Stat label="Repayment" value={money(first.repayment)} sub={`${money(first.unallocated)} a month not allocated`} />
        </div>
      </section>

      <p className="notice">The full dashboard (status cards, savings, chart, college funds, this month's money and your balances) arrives in phase 5. Your own figures are imported in phase 2.</p>
    </div>
  );
}
