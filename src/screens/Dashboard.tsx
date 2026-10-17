import { useMemo } from 'react';
import { NetDebtChart } from '../components/NetDebtChart';
import { PageHeader } from '../components/PageHeader';
import { Stat } from '../components/Stat';
import { dashboardModel, type DashboardModel } from '../data/dashboard';
import { useStore } from '../data/store';
import type { Plan } from '../data/types';
import { duration, monthLabel, monthLabelLong, money, moneyShort, toIdx, yearRows, years } from '../engine';
import { href } from '../lib/router';
import { currentMonthIdx } from '../lib/today';

const STATUS_TEXT = { ahead: 'Ahead of plan', behind: 'Behind plan', on: 'On track', none: '' } as const;

export function Dashboard() {
  const { data, activePlan, dispatch } = useStore();
  const todayIdx = currentMonthIdx();
  const m = useMemo(() => dashboardModel(data, activePlan, todayIdx), [data, activePlan, todayIdx]);
  const otherPlans = data.plans.length - 1;

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Today · ${monthLabelLong(todayIdx)}`}
        title="How you're doing"
        sub={<>Your real balances compared with <a href={href('plans')}>{activePlan.name}</a>.</>}
        actions={
          <div className="actions">
            <a className="btn" href={href('record', 'balances')}>Check in balances</a>
            <a className="btn primary" href={href('record')}>Record a change</a>
          </div>
        }
      />

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

      {!m.started && (
        <p className="notice">Your loan starts in {monthLabel(toIdx(activePlan.setup.start))}. Until then everything here follows {activePlan.name}; once repayments begin, check in your statement balances each month to see how you're really doing.</p>
      )}

      <div className="grid-2">
        <LoanCard m={m} plan={activePlan} />
        <CollegeCard m={m} plan={activePlan} />
      </div>

      <section className="card" aria-labelledby="saving-title">
        <div className="card-head">
          <h2 className="card-title" id="saving-title">What your approach is saving</h2>
          <span className="muted small">Compared with paying only the bank's minimum repayment for {activePlan.setup.term} years</span>
        </div>
        <div className="grid-4">
          <Stat tone="good" label="Time saved" value={years(m.savings.timeSaved)} sub={`Paid off ${monthLabel(m.now.res.paidIdx)} instead of ${monthLabel(m.now.bank.paidIdx)}`} />
          <Stat tone="good" label="Interest saved" value={moneyShort(m.savings.interestSaved)} sub={<>You pay {moneyShort(m.savings.interest)} instead of {moneyShort(m.savings.bankInterest)}<CompareBar part={m.savings.interest} whole={m.savings.bankInterest} /></>} />
          <Stat label="Interest avoided so far" value={money(m.savings.avoidedSoFar)} sub={m.started ? `Cancelled by the offset, ${monthLabel(m.now.res.startIdx)} to ${monthLabel(m.asOfIdx)}` : 'Starts with your first repayment'} />
          <Stat label="Offset growth" value={money(m.savings.offsetGrowth)} sub={m.started ? `Added since settlement, ${m.latest ? 'from your balances' : 'on plan'} to ${monthLabel(m.asOfIdx)}` : 'Starts with your first repayment'} />
        </div>
      </section>

      <NetDebtChart model={m} plan={activePlan} data={data} />

      <div className="grid-3">
        <MoneyCard m={m} />
        <section className="card" aria-labelledby="upcoming-title">
          <div className="card-head"><h2 className="card-title" id="upcoming-title">Coming up</h2><a className="small" href={href('edit', activePlan.id)}>Edit plan</a></div>
          {m.upcoming.length === 0 ? <p className="muted small">Nothing changes in the next two years.</p> : (
            <ul className="event-list">
              {m.upcoming.map((u, i) => <li key={i}><span className="mono muted">{monthLabel(u.idx)}</span><span>{u.text}</span></li>)}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="balances-title">
          <div className="card-head"><h2 className="card-title" id="balances-title">Your balances</h2><a className="small" href={href('record', 'balances')}>Check in</a></div>
          {m.recent.length === 0 ? <p className="muted small">{m.started ? 'No check-ins yet. Add your statement balances to see how you are really doing.' : 'Check-ins open after the first repayment.'}</p> : (
            <ul className="event-list">
              {m.recent.map((r) => (
                <li key={r.month}>
                  <span className="mono muted">{monthLabel(toIdx(r.month))}</span>
                  <span className={Math.abs(r.diff) < 50 ? '' : r.diff > 0 ? 'good' : 'bad'}>{Math.abs(r.diff) < 50 ? 'On plan' : `${money(Math.abs(r.diff))} ${r.diff > 0 ? 'ahead' : 'behind'}`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <YearByYear m={m} plan={activePlan} />
    </div>
  );
}

function CompareBar({ part, whole }: { part: number; whole: number }) {
  return (
    <span className="compare-bar" aria-hidden="true">
      <span className="cb-whole" />
      <span className="cb-part" style={{ width: `${Math.min(100, (part / Math.max(1, whole)) * 100)}%` }} />
    </span>
  );
}

function StatusPill({ status }: { status: keyof typeof STATUS_TEXT }) {
  if (status === 'none') return null;
  return <span className={`pill ${status}`}>{status === 'ahead' ? '▲ ' : status === 'behind' ? '▼ ' : '● '}{STATUS_TEXT[status]}</span>;
}

function LoanCard({ m, plan }: { m: DashboardModel; plan: Plan }) {
  const dm = m.now.res.paidMonth - m.planned.res.paidMonth;
  const fromStart = m.now.res.paidMonth - m.original.paidMonth;
  return (
    <section className="card" aria-labelledby="loan-title">
      <div className="card-head"><h2 className="card-title" id="loan-title">Home loan</h2><StatusPill status={m.loan.status} /></div>
      <div className="hero">
        <span className="muted small">{m.latest ? 'On your real balances, paid off' : 'On this plan, paid off'}</span>
        <strong>{monthLabel(m.now.res.paidIdx)}</strong>
        <span className="muted small">
          {m.latest
            ? (m.loan.status === 'on' ? 'Right where the plan expected at your last check-in.' : `${money(Math.abs(m.loan.diff))} ${m.loan.diff > 0 ? 'ahead of' : 'behind'} the plan at ${monthLabel(toIdx(m.latest.month))}${dm ? `, so ${duration(dm)} ${dm < 0 ? 'sooner' : 'later'}` : ''}.`)
            : m.started ? 'Check in your balances to see how you are really doing.' : `${years(m.now.res.paidMonth)} of repayments from ${monthLabel(m.now.res.startIdx)}.`}
        </span>
      </div>
      {fromStart !== 0 && (
        <div className="since-start">
          <span className="muted">When you started</span><strong>{monthLabel(m.original.paidIdx)}</strong>
          <span aria-hidden="true">→</span>
          <span className="muted">now</span><strong>{monthLabel(m.now.res.paidIdx)}</strong>
          <span className={fromStart < 0 ? 'good' : 'bad'}>{duration(fromStart)} {fromStart < 0 ? 'sooner' : 'later'}</span>
        </div>
      )}
      <div className="progress" role="img" aria-label={`${Math.round(m.loan.cancelled * 100)}% of the loan cancelled`}>
        <span style={{ width: `${(m.loan.cancelled * 100).toFixed(1)}%` }} />
      </div>
      <div className="progress-labels muted small"><span>{Math.round(m.loan.cancelled * 100)}% of {moneyShort(plan.setup.loan)} cancelled</span><span>{money(m.loan.net)} net debt</span></div>
    </section>
  );
}

function CollegeCard({ m, plan }: { m: DashboardModel; plan: Plan }) {
  if (plan.setup.kids.length === 0) {
    return (
      <section className="card" aria-labelledby="college-title">
        <h2 className="card-title" id="college-title">College funds</h2>
        <p className="muted">No children in this plan yet. <a href={href('edit', plan.id)}>Add one in the plan</a> to track a college fund alongside the loan.</p>
      </section>
    );
  }
  const diff = m.college.now - m.college.expected;
  return (
    <section className="card" aria-labelledby="college-title">
      <div className="card-head"><h2 className="card-title" id="college-title">College funds</h2><StatusPill status={m.college.status} /></div>
      <div className="hero">
        <span className="muted small">{m.latest ? `Saved at ${monthLabel(toIdx(m.latest.month))}` : m.started ? 'Saved so far, on plan' : 'Saving starts with the loan'}</span>
        <strong>{money(m.college.now)}</strong>
        {m.latest && <span className="muted small">{Math.abs(diff) < 100 ? 'Right on plan.' : `${money(Math.abs(diff))} ${diff > 0 ? 'ahead of' : 'behind'} plan.`}</span>}
      </div>
      <ul className="kid-list">
        {m.college.kids.map((k) => {
          const pct = k.goal > 0 ? Math.min(1, k.atUni / k.goal) : null;
          return (
            <li key={k.name}>
              <div className="kid-line">
                <span><strong>{k.name}</strong> <span className="muted small">· uni {k.uni}</span></span>
                <span className={pct === null ? 'muted small' : pct >= 1 ? 'good small' : 'bad small'}>
                  {moneyShort(k.atUni)} when uni starts{k.goal > 0 ? (pct! >= 1 ? ' · goal met' : ` · ${moneyShort(k.goal - k.atUni)} short of ${moneyShort(k.goal)}`) : ''}
                </span>
              </div>
              {pct !== null && <div className="progress kids" role="img" aria-label={`${Math.round(pct * 100)}% of the goal`}><span style={{ width: `${(pct * 100).toFixed(1)}%` }} /></div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MoneyCard({ m }: { m: DashboardModel }) {
  const p = m.month.point;
  const take = Math.max(1, p.takeHome);
  const rows = [
    { label: 'Loan repayment', value: p.paidOut, cls: 'seg-loan' },
    { label: 'Living costs', value: p.living, cls: 'seg-living' },
    { label: 'College saving', value: p.kidsSaving, cls: 'seg-kids' },
    { label: 'Extra into the offset', value: p.extra, cls: 'seg-extra' },
  ];
  const short = p.spare < 0;
  return (
    <section className="card" aria-labelledby="money-title">
      <div className="card-head">
        <h2 className="card-title" id="money-title">Money in {monthLabel(p.idx)}</h2>
        <span className={short ? 'bad small strong' : 'good small strong'}>{short ? `${money(-p.spare)} short` : `${money(p.unallocated)} not allocated`}</span>
      </div>
      <div className="stack-bar" role="img" aria-label="How take-home pay is split this month">
        {rows.map((r) => <span key={r.label} className={r.cls} style={{ width: `${Math.max(0, (r.value / take) * 100).toFixed(1)}%` }} />)}
      </div>
      <dl className="money-rows">
        <div><dt>Take-home pay</dt><dd>{money(p.takeHome)}</dd></div>
        {rows.map((r) => <div key={r.label}><dt><span className={`swatch ${r.cls}`} aria-hidden="true" />{r.label}</dt><dd>{money(r.value)}</dd></div>)}
      </dl>
      <p className="muted small">
        On the larger income alone you would have {m.month.largerIncomeOnly < 0 ? `a shortfall of ${money(-m.month.largerIncomeOnly)}` : `${money(m.month.largerIncomeOnly)} spare`} a month.
        The offset covers {m.month.offsetCovers.toFixed(1)} months of repayments and living costs.
        {p.unallocated > 0 && !short ? ' Money not allocated is not counted as going into the offset; put it there or turn on "all spare money" in the plan.' : ''}
      </p>
    </section>
  );
}

function YearByYear({ m, plan }: { m: DashboardModel; plan: Plan }) {
  const rows = useMemo(() => yearRows(m.now.res), [m.now.res]);
  return (
    <details className="card year-table">
      <summary><h2 className="card-title">Year by year</h2><span className="muted small">Balances at the end of each year, from your latest real balances</span></summary>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col" className="left">Year</th><th scope="col">Rate</th><th scope="col">Repayment</th><th scope="col">Loan</th><th scope="col">Offset</th><th scope="col">Net debt</th>
              {plan.setup.kids.length > 0 && <th scope="col">College funds</th>}<th scope="col">Interest that year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ year, point, interest }) => (
              <tr key={year} className={point.net <= 0 ? 'paid' : undefined}>
                <th scope="row">{year}</th>
                <td>{point.rate.toFixed(2)}%</td>
                <td>{money(point.paidOut || point.repayment)}</td>
                <td>{money(point.loan)}</td>
                <td>{money(point.offset)}</td>
                <td>{point.net <= 0 ? 'Paid off' : money(point.net)}</td>
                {plan.setup.kids.length > 0 && <td>{money(point.kids.reduce((a, b) => a + b, 0))}</td>}
                <td>{money(interest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
