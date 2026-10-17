import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Stat } from '../components/Stat';
import { runPlan } from '../data/plans';
import { useStore } from '../data/store';
import { monthLabel, money, moneyShort, years } from '../engine';

export function Dashboard() {
  const { data, activePlan, dispatch } = useStore();
  const { res: plan, bank } = useMemo(() => runPlan(data, activePlan), [data.facts, data.factLumps, data.checkIns, activePlan]);
  const first = plan.points[0];
  const otherPlans = data.plans.length - 1;

  return (
    <div className="page">
      <PageHeader eyebrow="Dashboard" title="How you're doing" sub={<>Your real balances compared with <strong>{activePlan.name}</strong>.</>} />

      {data.importedFromClassic && !data.importNoticeSeen && (
        <section className="callout" role="status">
          <div>
            <h2 className="card-title">Your settings came across from the previous version</h2>
            <p className="muted">
              {activePlan.name} is your active plan{otherPlans > 0 ? `, and ${otherPlans} saved ${otherPlans === 1 ? 'plan' : 'plans'} came with it` : ''}.
              The previous version still works and keeps its own copy.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'dismissImportNotice' })}>Got it</button>
        </section>
      )}

      <section className="card" aria-labelledby="engine-check">
        <h2 className="card-title" id="engine-check">{activePlan.name}</h2>
        <div className="grid-4">
          <Stat label="Paid off" value={monthLabel(plan.paidIdx)} sub={`${years(plan.paidMonth)} of repayments`} />
          <Stat tone="good" label="Time saved" value={years(bank.paidMonth - plan.paidMonth)} sub={`The bank's schedule ends ${monthLabel(bank.paidIdx)}`} />
          <Stat tone="good" label="Interest saved" value={moneyShort(bank.totalInterest - plan.totalInterest)} sub={`You pay ${moneyShort(plan.totalInterest)} instead of ${moneyShort(bank.totalInterest)}`} />
          <Stat label="Repayment" value={money(first.repayment)} sub={`${money(first.unallocated)} a month not allocated`} />
        </div>
      </section>

      <p className="notice">The full dashboard (status cards, savings, chart, college funds, this month's money and your balances) arrives in phase 5.</p>
    </div>
  );
}
