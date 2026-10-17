import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { duplicatePlan, runPlan, summarizeRun, whatIfs, type PlanSummary } from '../data/plans';
import { useStore } from '../data/store';
import type { Plan } from '../data/types';
import { duration, monthLabel, money, moneyShort, years } from '../engine';
import { href, navigate } from '../lib/router';
import { editedAgo } from '../lib/time';

export function Plans() {
  const { data, activePlan, dispatch } = useStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const rows = useMemo(
    () => data.plans.map((plan) => {
      const run = runPlan(data, plan);
      return { plan, run, sum: summarizeRun(plan, run) };
    }),
    [data],
  );
  const activeRow = rows.find((r) => r.plan.id === activePlan.id) ?? rows[0];
  const tests = useMemo(() => whatIfs(data, activeRow.plan, activeRow.run), [data, activeRow]);

  const duplicate = (plan: Plan) => {
    const copy = duplicatePlan(plan, data.plans);
    dispatch({ type: 'addPlan', plan: copy });
    navigate('edit', copy.id);
  };

  return (
    <div className="page">
      <PageHeader
        title="Plans"
        sub="One plan is active at a time and the dashboard measures your real balances against it. Recorded changes apply to every plan; each plan keeps its own guesses about the future."
        actions={<button type="button" className="btn primary" onClick={() => duplicate(activePlan)}>New plan from {activePlan.name}</button>}
      />

      <div className="plan-grid">
        {rows.map(({ plan, sum }) => {
          const isActive = plan.id === activePlan.id;
          const hasDraft = !!data.drafts?.[plan.id];
          return (
            <article key={plan.id} className={isActive ? 'plan-card active' : 'plan-card'} aria-label={plan.name}>
              <div className="plan-card-head">
                <span className="plan-name"><span className="dot" style={{ background: plan.color }} aria-hidden="true" /><h2>{plan.name}</h2></span>
                {isActive && <span className="badge">Active</span>}
              </div>
              <dl className="plan-metrics">
                <div><dt>Paid off</dt><dd>{monthLabel(sum.paidIdx)}</dd></div>
                <div><dt>Interest</dt><dd>{moneyShort(sum.interest)}</dd></div>
                <div><dt>College</dt><dd>{moneyShort(sum.collegeTotal)}</dd></div>
              </dl>
              <p className="saved-line">Saves {years(sum.timeSaved)} and {moneyShort(sum.interestSaved)} of interest against the bank's schedule</p>
              <ul className="tags" aria-label="Key settings">
                <li>{plan.setup.sweep ? 'Sweeps all spare money' : `${money(plan.setup.extra)} extra a month`}</li>
                <li>{plan.setup.kidsInOffset ? 'College funds in the offset' : 'College funds invested'}</li>
                <li>{plan.changes.length + plan.lumps.length} {plan.changes.length + plan.lumps.length === 1 ? 'guess' : 'guesses'}</li>
              </ul>
              {sum.unfunded > 0 && <p className="warn-line">Some months cost more than pay and the offset can cover.</p>}
              <p className="muted small">{hasDraft ? 'Has unsaved edits · ' : ''}{editedAgo(plan.editedAt)}</p>
              <div className="plan-actions">
                <a className="btn" href={href('edit', plan.id)}>Edit</a>
                <button type="button" className="btn" onClick={() => duplicate(plan)}>Duplicate</button>
                {isActive
                  ? <span className="btn ghost" aria-disabled="true">Active</span>
                  : <button type="button" className="btn primary" onClick={() => dispatch({ type: 'setActive', id: plan.id })}>Make active</button>}
              </div>
              {data.plans.length > 1 && (confirmDelete === plan.id ? (
                <div className="confirm" role="alertdialog" aria-label={`Delete ${plan.name}?`}>
                  <span className="small">Delete {plan.name}? This cannot be undone unless you have a backup file.</span>
                  <div className="actions">
                    <button type="button" className="btn danger" onClick={() => { dispatch({ type: 'deletePlan', id: plan.id }); setConfirmDelete(null); }}>Delete plan</button>
                    <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>Keep it</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(plan.id)}>Delete this plan</button>
              ))}
            </article>
          );
        })}
      </div>

      {rows.length > 1 && <Compare rows={rows} />}

      <section className="card" aria-labelledby="whatif">
        <div className="card-head">
          <h2 className="card-title" id="whatif">What if one thing changed?</h2>
          <span className="muted small">Starting from {activeRow.plan.name}: paid off {monthLabel(activeRow.sum.paidIdx)}, {moneyShort(activeRow.sum.interest)} interest</span>
        </div>
        <ul className="whatif-list">
          {tests.map((t) => (
            <li key={t.label}>
              <span>{t.label}</span>
              <span className="mono">{monthLabel(t.paidIdx)}</span>
              <span className={t.months < 0 ? 'mono good' : t.months > 0 ? 'mono bad' : 'mono muted'}>{t.months === 0 ? 'same date' : `${duration(t.months)} ${t.months < 0 ? 'sooner' : 'later'}`}</span>
              <span className={t.interest < -500 ? 'mono good' : t.interest > 500 ? 'mono bad' : 'mono muted'}>{Math.abs(t.interest) < 500 ? 'same interest' : `${t.interest < 0 ? '−' : '+'}${moneyShort(Math.abs(t.interest))} interest`}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">A higher rate can show an earlier date because the bank raises the required repayment. The interest figure is the true cost.</p>
      </section>
    </div>
  );
}

function Compare({ rows }: { rows: { plan: Plan; sum: PlanSummary }[] }) {
  const line = (label: string, fn: (r: { plan: Plan; sum: PlanSummary }) => string) => (
    <tr><th scope="row">{label}</th>{rows.map((r) => <td key={r.plan.id}>{fn(r)}</td>)}</tr>
  );
  return (
    <section className="card" aria-labelledby="compare">
      <h2 className="card-title" id="compare">Side by side</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><td />{rows.map((r) => <th key={r.plan.id} scope="col"><span className="dot" style={{ background: r.plan.color }} aria-hidden="true" /> {r.plan.name}</th>)}</tr>
          </thead>
          <tbody>
            {line('Loan paid off', (r) => monthLabel(r.sum.paidIdx))}
            {line('Time saved against the bank', (r) => years(r.sum.timeSaved))}
            {line('Interest paid', (r) => moneyShort(r.sum.interest))}
            {line('Interest saved against the bank', (r) => moneyShort(r.sum.interestSaved))}
            {line('College funds at uni', (r) => moneyShort(r.sum.collegeTotal))}
            {line('College goals met', (r) => (r.sum.goalsSet ? `${r.sum.goalsMet} of ${r.sum.goalsSet}` : 'no goals set'))}
            {line('Extra a month', (r) => (r.plan.setup.sweep ? 'all spare money' : money(r.plan.setup.extra)))}
            {line('Guesses about the future', (r) => String(r.plan.changes.length + r.plan.lumps.length))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
