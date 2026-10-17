import { useMemo, useState } from 'react';
import { MonthStepper, Segmented, ValueInput } from '../components/fields';
import { PageHeader } from '../components/PageHeader';
import { checkInNet, expectedAt } from '../data/dashboard';
import { changeKinds, describeChange, formatChangeValue } from '../data/describe';
import { newId } from '../data/normalize';
import { estimateRepayment, latestCheckIn, runPlan } from '../data/plans';
import { useStore } from '../data/store';
import type { CheckIn, Plan } from '../data/types';
import {
  addMonths, duration, monthLabel, money, moneyShort, toIdx, toYM,
  type Change, type ChangeType, type MonthPoint, type SimResult, type YM,
} from '../engine';
import { href } from '../lib/router';
import { currentMonthIdx } from '../lib/today';

type Kind = ChangeType | 'lump';

export function Record({ tab }: { tab?: string }) {
  const balances = tab === 'balances';
  return (
    <div className="page">
      <PageHeader
        title="Record"
        sub="Tell the app what really happened. Months before a change stay exactly as they were; everything after is worked out again, for every plan."
        actions={
          <nav className="segmented" aria-label="What to record">
            <a className="seg-link" href={href('record')} aria-current={!balances ? 'page' : undefined}>A change</a>
            <a className="seg-link" href={href('record', 'balances')} aria-current={balances ? 'page' : undefined}>Balances</a>
          </nav>
        }
      />
      {balances ? <CheckIns /> : <RecordChange />}
    </div>
  );
}

/** The setting in effect in the month before `idx`, read off the projection (or the plan's start if earlier). */
function valueBefore(plan: Plan, res: SimResult, kind: Kind, idx: number): number {
  const p: MonthPoint | undefined = res.points.find((x) => x.idx === idx - 1);
  const s = plan.setup;
  if (!p) {
    if (kind === 'rate') return s.rate;
    if (kind === 'sweep') return s.sweep ? 1 : 0;
    if (kind === 'lump') return 0;
    if (kind.startsWith('kid')) return s.kids[Number(kind.slice(3))]?.monthly ?? 0;
    return s[kind as 'extra' | 'inc1' | 'inc2' | 'living' | 'bonus'];
  }
  switch (kind) {
    case 'rate': return p.rate;
    case 'extra': return p.settings.extra;
    case 'sweep': return p.settings.sweep ? 1 : 0;
    case 'inc1': return p.settings.inc1;
    case 'inc2': return p.settings.inc2;
    case 'living': return p.settings.living;
    case 'bonus': return p.settings.bonus;
    case 'lump': return 0;
    default: return p.settings.kidMonthly[Number(kind.slice(3))] ?? 0;
  }
}

function RecordChange() {
  const { data, activePlan, dispatch } = useStore();
  const kids = activePlan.setup.kids;
  const nowIdx = currentMonthIdx();
  const startIdx = toIdx(activePlan.setup.start);
  const [kind, setKind] = useState<Kind>('rate');
  const [month, setMonth] = useState<YM>(toYM(Math.max(nowIdx, startIdx)));
  const [value, setValue] = useState<number | null>(null);
  const [until, setUntil] = useState<YM | null>(null);
  const [bank, setBank] = useState<'bank' | 'keep'>('bank');
  const [bankPay, setBankPay] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const base = useMemo(() => runPlan(data, activePlan), [data, activePlan]);
  const idx = toIdx(month);
  const before = valueBefore(activePlan, base.res, kind, idx);
  const v = value ?? (kind === 'sweep' ? (before ? 0 : 1) : kind === 'lump' ? 10000 : before);
  const prev = base.res.points.find((p) => p.idx === idx - 1);
  const oldPay = prev?.paidOut ?? base.res.points[0].repayment;
  const estimate = estimateRepayment(base.res, month, v);
  const pay = bankPay ?? Math.round(estimate);

  const change: Change | null = kind === 'lump' ? null : {
    id: newId('f-'), month, type: kind, value: v,
    ...(until && kind !== 'rate' ? { until } : {}),
    ...(kind === 'rate' ? (bank === 'keep' ? { keepPaying: Math.round(oldPay) } : { repayment: pay }) : {}),
  };
  const preview = useMemo(() => {
    const withIt = kind === 'lump'
      ? { ...data, factLumps: [...data.factLumps, { id: 'preview', month, amount: v }] }
      : { ...data, facts: [...data.facts, change!] };
    return runPlan(withIt, activePlan);
    // `change` is rebuilt every render, so its inputs are the dependencies.
  }, [data, activePlan, kind, month, v, until, bank, pay, oldPay]);
  const dm = preview.res.paidMonth - base.res.paidMonth;
  const di = preview.res.totalInterest - base.res.totalInterest;

  const reset = () => { setValue(null); setUntil(null); setBankPay(null); setBank('bank'); };
  const pick = (k: Kind) => { setKind(k); reset(); setDone(null); };
  const save = () => {
    if (kind === 'lump') dispatch({ type: 'addFactLump', lump: { id: newId('fl-'), month, amount: v } });
    else dispatch({ type: 'addFact', change: change! });
    setDone(`Recorded. Every plan now uses this from ${monthLabel(idx)}.`);
    reset();
  };

  const kinds: { type: Kind; label: string }[] = [...changeKinds(kids), { type: 'lump', label: 'Lump sum into the offset' }];
  const valueLabel = kind === 'rate' ? 'New rate (%)' : kind === 'lump' ? 'Amount' : kind === 'bonus' ? 'New bonus a year' : 'New amount a month';
  const recorded = [
    ...data.facts.map((c) => ({ id: c.id, month: c.month, text: describeChange(c, kids), undo: () => dispatch({ type: 'removeFact', id: c.id }) })),
    ...data.factLumps.map((l) => ({ id: l.id, month: l.month, text: `In ${monthLabel(toIdx(l.month))}, ${money(l.amount)} went into the offset.`, undo: () => dispatch({ type: 'removeFactLump', id: l.id }) })),
  ].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="record">
      <section className="card" aria-labelledby="change-title">
        <h2 className="card-title" id="change-title">Record a change</h2>

        <fieldset className="kinds">
          <legend className="step-label">1 · What changed</legend>
          <div className="kind-grid">
            {kinds.map((k) => (
              <button key={k.type} type="button" aria-pressed={k.type === kind} onClick={() => pick(k.type)}>{k.label}</button>
            ))}
          </div>
        </fieldset>

        <div>
          <span className="step-label">2 · From which month</span>
          <MonthStepper label={kind === 'lump' ? 'Month it went in' : 'Applies from'} value={month} onChange={(m) => { setMonth(m); setBankPay(null); if (until && toIdx(until) < toIdx(m)) setUntil(m); }} />
          {idx > nowIdx + 1 && <p className="field-hint bad">That month has not happened yet. If this is a guess, add it to a plan's life changes instead.</p>}
          {kind !== 'rate' && kind !== 'lump' && (
            <>
              <div className="stepper-row">
                <span className="stepper-label">How long</span>
                <Segmented label="How long" value={until ? 'temp' : 'perm'} options={[{ value: 'perm', label: 'From then on' }, { value: 'temp', label: 'For a while' }]}
                  onChange={(x) => setUntil(x === 'temp' ? addMonths(month, 11) : null)} />
              </div>
              {until && <MonthStepper label="Until" value={until} min={month} onChange={setUntil} />}
            </>
          )}
        </div>

        <div>
          <span className="step-label">3 · {kind === 'sweep' ? 'Sweep' : valueLabel}</span>
          {kind === 'sweep'
            ? <div className="stepper-row"><span className="stepper-label">Put all spare money in</span><Segmented label="Sweep" value={v ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(x) => setValue(x === 'on' ? 1 : 0)} /></div>
            : <ValueInput label={valueLabel} value={v} step={kind === 'rate' ? 0.05 : 50} onChange={setValue} />}
          {kind !== 'lump' && <p className="field-hint">Up to {monthLabel(idx - 1)} this was {formatChangeValue(kind, before)}{kind === 'rate' ? ` and the repayment was ${money(oldPay)}` : ''}. Those months stay as they were.</p>}
        </div>

        {kind === 'rate' && (
          <fieldset className="choice">
            <legend className="step-label">4 · What happened to your repayment?</legend>
            <label className={bank === 'bank' ? 'choice-item on' : 'choice-item'}>
              <input type="radio" name="repayment" checked={bank === 'bank'} onChange={() => setBank('bank')} />
              <span><strong>The bank changed it</strong><span className="field-hint">Use the figure on their letter. Estimated from your balance: {money(estimate)}.</span></span>
            </label>
            {bank === 'bank' && <ValueInput label="New repayment" value={pay} step={1} onChange={setBankPay} />}
            <label className={bank === 'keep' ? 'choice-item on' : 'choice-item'}>
              <input type="radio" name="repayment" checked={bank === 'keep'} onChange={() => setBank('keep')} />
              <span><strong>I kept paying {money(oldPay)}</strong><span className="field-hint">Anything above the bank's new repayment goes into the offset.</span></span>
            </label>
          </fieldset>
        )}

        <div className={dm < 0 ? 'preview good' : dm > 0 ? 'preview bad' : 'preview'} role="status" aria-live="polite">
          <span className="eyebrow-caps">If you record this</span>
          <strong>Paid off {monthLabel(preview.res.paidIdx)}{dm === 0 ? ', no change to the date' : `, ${duration(dm)} ${dm < 0 ? 'sooner' : 'later'}`}</strong>
          <span>Interest over the loan {Math.abs(di) < 500 ? 'stays about the same' : di < 0 ? `falls by ${moneyShort(-di)}` : `rises by ${moneyShort(di)}`}. Applies to all {data.plans.length} {data.plans.length === 1 ? 'plan' : 'plans'}; shown for {activePlan.name}.</span>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={save}>Record this change</button>
        </div>
        {done && <p className="status-ok" role="status">{done}</p>}
      </section>

      <section className="card" aria-labelledby="recorded-title">
        <h2 className="card-title" id="recorded-title">Recorded so far</h2>
        <p className="muted small">Facts apply to every plan. They can be undone but not edited; record a new change instead.</p>
        {recorded.length === 0 && <p className="empty">Nothing recorded yet.</p>}
        <ul className="recorded">
          {recorded.map((r) => (
            <li key={r.id}>
              <span>{r.text}</span>
              <button type="button" className="link-btn danger" onClick={r.undo}>Undo</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CheckIns() {
  const { data, activePlan, dispatch } = useStore();
  const nowIdx = currentMonthIdx();
  const start = activePlan.setup.start;
  const startIdx = toIdx(start);
  const kids = activePlan.setup.kids;
  const latestAllowed = toYM(Math.max(startIdx, nowIdx));
  const [month, setMonth] = useState<YM>(toYM(Math.min(Math.max(startIdx, nowIdx - 1), toIdx(latestAllowed))));
  const [draft, setDraft] = useState<CheckIn | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const expected = useMemo(() => expectedAt(data, activePlan, month), [data, activePlan, month]);
  const existing = data.checkIns.find((c) => c.month === month);
  const entry: CheckIn = draft && draft.month === month ? draft
    : existing ? existing
    : { month, loan: Math.round(expected.loan), offset: Math.round(expected.offset), kids: expected.kids.map((k) => Math.round(k)) };
  const set = (patch: Partial<CheckIn>) => { setDraft({ ...entry, ...patch }); setDone(null); };

  const withEntry = useMemo(() => runPlan({ ...data, checkIns: [...data.checkIns.filter((c) => c.month !== month), entry] }, activePlan), [data, activePlan, month, entry]);
  const withoutEntry = useMemo(() => runPlan(data, activePlan, { beforeMonth: month }), [data, activePlan, month]);
  const net = checkInNet(activePlan, entry);
  const ahead = expected.net - net;
  const dm = withEntry.res.paidMonth - withoutEntry.res.paidMonth;
  const isLatest = !latestCheckIn(data.checkIns, activePlan) || month >= latestCheckIn(data.checkIns, activePlan)!.month;

  if (nowIdx < startIdx) {
    return <p className="notice">Your loan starts in {monthLabel(startIdx)}. Check-ins open once the first repayment has gone through; until then everything follows {activePlan.name}.</p>;
  }

  const history = [...data.checkIns].filter((c) => c.month >= start).sort((a, b) => b.month.localeCompare(a.month)).map((c) => {
    const n = checkInNet(activePlan, c);
    return { c, n, diff: expectedAt(data, activePlan, c.month).net - n, college: c.kids.reduce((a, b) => a + b, 0) };
  });

  return (
    <div className="record">
      <section className="card" aria-labelledby="checkin-title">
        <h2 className="card-title" id="checkin-title">Check in your balances</h2>
        <p className="muted small">Copy the closing balances from your statements. From the latest check-in, every plan works forward from these real figures.</p>
        <MonthStepper label="Balances at the end of" value={month} min={start} max={latestAllowed} onChange={(m) => { setMonth(m); setDraft(null); setDone(null); }} />
        <ValueInput label="Loan balance" value={entry.loan} step={100} onChange={(v) => set({ loan: v })} hint={`${activePlan.name} expects ${money(expected.loan)}`} />
        <ValueInput label="Offset balance" value={entry.offset} step={100} onChange={(v) => set({ offset: v })} hint={`Expected ${money(expected.offset)}${activePlan.setup.kidsInOffset && kids.length ? ', including college money held there' : ''}`} />
        {kids.map((k, i) => (
          <ValueInput key={i} label={`${k.name}’s college fund`} value={entry.kids[i] ?? 0} step={50} onChange={(v) => set({ kids: kids.map((_, j) => (j === i ? v : entry.kids[j] ?? 0)) })} hint={`Expected ${money(expected.kids[i] ?? 0)}`} />
        ))}
        <div className={ahead >= 0 ? 'preview good' : 'preview bad'} role="status" aria-live="polite">
          <strong>{Math.abs(ahead) < 50 ? 'Right on plan' : ahead > 0 ? `${money(ahead)} ahead of plan` : `${money(-ahead)} behind plan`}</strong>
          <span>
            {isLatest
              ? `From here every plan works forward from these balances: ${activePlan.name} is paid off ${monthLabel(withEntry.res.paidIdx)}${dm === 0 ? '' : `, ${duration(dm)} ${dm < 0 ? 'sooner' : 'later'} than expected`}.`
              : 'A later check-in exists, so the projection keeps starting from that one.'}
          </span>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => { dispatch({ type: 'saveCheckIn', checkIn: entry }); setDraft(null); setDone(`Saved balances for ${monthLabel(toIdx(month))}.`); }}>
            {existing ? `Update ${monthLabel(toIdx(month))}` : `Save ${monthLabel(toIdx(month))}`}
          </button>
        </div>
        {done && <p className="status-ok" role="status">{done}</p>}
      </section>

      <section className="card" aria-labelledby="history-title">
        <h2 className="card-title" id="history-title">Check-in history</h2>
        {history.length === 0 ? <p className="empty">No check-ins yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col" className="left">Month</th><th scope="col">Net debt</th><th scope="col">Against plan</th><th scope="col">College</th><td /></tr>
              </thead>
              <tbody>
                {history.map(({ c, n, diff, college }) => (
                  <tr key={c.month}>
                    <th scope="row">{monthLabel(toIdx(c.month))}</th>
                    <td>{money(n)}</td>
                    <td className={Math.abs(diff) < 50 ? undefined : diff > 0 ? 'good' : 'bad'}>{Math.abs(diff) < 50 ? 'on plan' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`}</td>
                    <td>{money(college)}</td>
                    <td><button type="button" className="link-btn danger" onClick={() => dispatch({ type: 'removeCheckIn', month: c.month })} aria-label={`Remove the ${monthLabel(toIdx(c.month))} check-in`}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">"Against plan" compares with what {activePlan.name} expected for that month, working forward from the check-in before it.</p>
      </section>
    </div>
  );
}
