import { useMemo, useState } from 'react';
import { checkInNet, pointAt, type DashboardModel } from '../data/dashboard';
import { laneItems, layoutLane, type LaneItem } from '../data/timeline';
import type { AppData, Plan } from '../data/types';
import { monthLabel, money, moneyShort, toIdx } from '../engine';
import { TimeChart, W, areaPath, linePath, type Scale, type TipRow } from './TimeChart';

type Key = 'loan' | 'offset' | 'net' | 'bank';

const LEGEND: { key: Key; label: string; cls: string }[] = [
  { key: 'loan', label: 'Loan balance', cls: 's-loan' },
  { key: 'offset', label: 'Offset', cls: 's-offset' },
  { key: 'net', label: 'Net debt (loan minus offset)', cls: 's-net' },
  { key: 'bank', label: 'Bank’s schedule, minimum repayments only', cls: 's-bank' },
];

/** Life changes as chips under the chart, stacked so none overlap, with a plain list for screen readers. */
function Lane({ items, d0, s }: { items: LaneItem[]; d0: number; s: Scale }) {
  if (!items.length) return <p className="lane-empty muted small">No life changes yet. Add guesses in the plan, or record what really happens.</p>;
  // As many rows as it takes, so chips never overlap on a narrow screen.
  const placed = layoutLane(items, (i) => (s.x(Math.max(d0, i)) / W) * s.width, items.length);
  const rows = Math.max(...placed.map((p) => p.row)) + 1;
  return (
    <div className="lane" style={{ height: rows * 30 }}>
      <ul className="sr-only" aria-label="Life changes on this timeline">
        {placed.map((p) => <li key={p.id}>{p.description}</li>)}
      </ul>
      {placed.map((p) => (
        <span key={p.id} aria-hidden="true" title={p.description}
          className={`chip-lane ${p.recorded ? 'recorded' : 'guess'} ${p.end !== undefined ? 'ranged' : ''}`}
          style={{ left: p.x, width: p.w, top: p.row * 30 }}>
          {p.label}
        </span>
      ))}
    </div>
  );
}

/**
 * The whole loan at a glance: the balance coming down, the offset rising to meet it, and the month they cross,
 * which is when the loan is effectively paid off. Life changes sit in a lane underneath.
 */
export function LoanChart({ model, plan, data }: { model: DashboardModel; plan: Plan; data: AppData }) {
  const [range, setRange] = useState<'whole' | 'near'>('whole');
  const [hidden, setHidden] = useState<Set<Key>>(new Set(['net']));
  const { now, original } = model;
  const res = now.res;
  const startIdx = toIdx(plan.setup.start);
  const whole = range === 'whole';

  const d0 = whole ? startIdx : Math.max(startIdx, model.todayIdx - 6);
  const d1 = whole ? Math.min(now.bank.paidIdx, Math.max(res.paidIdx, original.paidIdx) + 24) : d0 + 30;
  const inRange = (i: number) => i >= d0 && i <= d1;
  const kidsInOffset = plan.setup.kidsInOffset;

  const series = useMemo(() => {
    const active = res.points.filter((p) => (p.loanActive || p.m === res.paidMonth) && inRange(p.idx));
    return {
      loan: active.map((p) => ({ idx: p.idx, v: p.loan })),
      offset: active.map((p) => ({ idx: p.idx, v: p.offset })),
      net: active.map((p) => ({ idx: p.idx, v: p.net })),
      bank: now.bank.points.filter((p) => p.loanActive && inRange(p.idx)).map((p) => ({ idx: p.idx, v: p.loan })),
      firstNet: original.points.filter((p) => (p.loanActive || p.m === original.paidMonth) && inRange(p.idx)).map((p) => ({ idx: p.idx, v: p.net })),
    };
    // inRange depends only on d0 and d1.
  }, [res, now.bank, original, d0, d1]);

  const checkIns = data.checkIns.filter((c) => c.month >= plan.setup.start && inRange(toIdx(c.month)));
  const actualNet = checkIns.map((c) => ({ idx: toIdx(c.month), v: checkInNet(plan, c) }));
  const hasHistory = data.facts.length + data.factLumps.length > 0 || checkIns.length > 0;

  // Two years of a long loan barely moves on a zero-based axis, so the near view zooms in on net debt.
  let nearMin = 0, nearMax = 1;
  if (!whole) {
    const vals = [...series.net, ...(hasHistory ? series.firstNet : []), ...actualNet].map((p) => p.v);
    const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max(2000, (hi - lo) * 0.12);
    nearMin = Math.max(0, lo - pad);
    nearMax = hi + pad;
  }
  const items = useMemo(() => laneItems(data.facts, data.factLumps, plan.changes, plan.lumps, plan.setup.kids).filter((it) => it.start <= d1 && (it.end ?? it.start) >= d0), [data.facts, data.factLumps, plan, d0, d1]);

  const yMax = Math.max(plan.setup.loan, ...series.offset.map((p) => p.v)) * 1.04;
  const step = whole ? 2 : 1;
  const paidInView = inRange(res.paidIdx);
  const showOriginal = original.paidIdx !== res.paidIdx && inRange(original.paidIdx);
  const paidPoint = pointAt(res, res.paidIdx);
  const bankEnd = series.bank[series.bank.length - 1];

  const toggle = (k: Key) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const tooltip = (idx: number) => {
    const p = pointAt(res, idx);
    const b = pointAt(now.bank, idx);
    const rows: TipRow[] = [];
    if (idx <= res.paidIdx) {
      if (!hidden.has('loan')) rows.push({ key: 'loan', cls: 's-loan', value: money(p.loan), label: 'Loan balance' });
      if (!hidden.has('offset')) rows.push({ key: 'offset', cls: 's-offset', value: money(p.offset), label: 'Offset' });
      rows.push({ key: 'net', cls: 's-net', value: money(p.net), label: 'Net debt' });
    } else {
      rows.push({ key: 'paid', cls: 's-loan', value: 'Paid off', label: `since ${monthLabel(res.paidIdx)}` });
    }
    if (!hidden.has('bank') && b.loanActive) rows.push({ key: 'bank', cls: 's-bank', value: money(b.loan), label: 'Bank’s schedule' });
    const c = data.checkIns.find((x) => toIdx(x.month) === idx);
    if (c) rows.push({ key: 'actual', cls: 's-actual', value: money(checkInNet(plan, c)), label: 'Your statements: net debt' });
    return { rows, meta: p.loanActive ? `Rate ${p.rate.toFixed(2)}% · repayment ${money(p.paidOut)}` : undefined };
  };

  return (
    <section className="card" aria-labelledby="loanchart-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="loanchart-title">Your loan over time</h2>
          <p className="muted small">The offset grows until it matches the loan. From that month no interest is charged: the loan is effectively paid off.</p>
        </div>
        <div className="segmented" role="group" aria-label="Chart range">
          <button type="button" aria-pressed={whole} onClick={() => setRange('whole')}>Whole loan</button>
          <button type="button" aria-pressed={!whole} onClick={() => setRange('near')}>Next 2 years</button>
        </div>
      </div>

      {whole ? (
        <div className="legend" role="group" aria-label="Lines shown">
          {LEGEND.map((l) => (
            <button key={l.key} type="button" aria-pressed={!hidden.has(l.key)} onClick={() => toggle(l.key)}>
              <span className={`key ${l.cls}`} aria-hidden="true" />{l.label}
            </button>
          ))}
          {checkIns.length > 0 && <span className="legend-note"><span className="key s-actual dotkey" aria-hidden="true" />Your check-ins</span>}
        </div>
      ) : (
        <div className="legend" aria-label="Lines shown">
          <span className="legend-note solid"><span className="key s-loan" aria-hidden="true" />Net debt, projected</span>
          {hasHistory && <span className="legend-note solid"><span className="key s-first" aria-hidden="true" />The plan as first set</span>}
          <span className="legend-note solid"><span className="key s-actual" aria-hidden="true" />Your statements</span>
          <span className="legend-note">Zoomed in: the axis does not start at $0</span>
        </div>
      )}

      {!whole ? (
        <TimeChart
          d0={d0}
          d1={d1}
          yMin={nearMin}
          yMax={nearMax}
          height={300}
          label="Net debt over the next two years, zoomed in"
          todayIdx={model.started ? model.todayIdx : undefined}
          tooltip={(idx) => {
            const p = pointAt(res, idx);
            const rows: TipRow[] = [{ key: 'net', cls: 's-loan', value: money(p.net), label: 'Net debt, projected' }];
            if (hasHistory) rows.push({ key: 'first', cls: 's-first', value: money(pointAt(original, idx).net), label: 'The plan as first set' });
            const a = actualNet.find((x) => x.idx === idx);
            if (a) rows.push({ key: 'actual', cls: 's-actual', value: money(a.v), label: 'Your statements' });
            return { rows, meta: p.loanActive ? `Rate ${p.rate.toFixed(2)}% · repayment ${money(p.paidOut)}` : undefined };
          }}
          svg={(s) => (
            <>
              {hasHistory && <path className="line s-first" d={linePath(s, series.firstNet)} />}
              <path className="line s-loan" d={linePath(s, series.net)} />
              {actualNet.length > 1 && <path className="line s-actual" d={linePath(s, actualNet)} />}
            </>
          )}
          overlay={(s) => (
            <>
              {actualNet.map((a) => <span key={a.idx} className="dot ring s-actual-dot" style={{ left: s.left(a.idx), top: s.top(a.v) }} />)}
              {!model.started && <span className="flag original">Your loan starts {monthLabel(startIdx)}</span>}
            </>
          )}
          below={(s) => <Lane items={items} d0={d0} s={s} />}
        />
      ) : (
      <TimeChart
        d0={d0}
        d1={d1}
        yMax={yMax}
        height={300}
        label="Loan balance and offset over time"
        todayIdx={model.started ? model.todayIdx : undefined}
        tooltip={tooltip}
        svg={(s) => (
          <>
            {!hidden.has('offset') && <path className="area-offset" d={areaPath(s, series.offset, step)} />}
            {!hidden.has('bank') && <path className="line s-bank" d={linePath(s, series.bank, step)} />}
            {!hidden.has('net') && <path className="line s-net" d={linePath(s, series.net, step)} />}
            {!hidden.has('offset') && <path className="line s-offset" d={linePath(s, series.offset, step)} />}
            {!hidden.has('loan') && <path className="line s-loan" d={linePath(s, series.loan, step)} />}
            {showOriginal && <path className="marker-original" d={`M${s.x(original.paidIdx).toFixed(1)} 0V${s.height}`} />}
            {paidInView && <path className="marker-paid" d={`M${s.x(res.paidIdx).toFixed(1)} 0V${s.height}`} />}
          </>
        )}
        overlay={(s) => (
          <>
            {paidInView && (
              <>
                <span className="cross-dot" style={{ left: s.left(res.paidIdx), top: s.top(paidPoint.loan) }} />
                <span className={s.x(res.paidIdx) > W * 0.7 ? 'flag paid left' : 'flag paid'} style={{ left: s.left(res.paidIdx) }}>Debt-free {monthLabel(res.paidIdx)}</span>
              </>
            )}
            {showOriginal && (
              <span className={s.x(original.paidIdx) > W * 0.7 ? 'flag original left' : 'flag original'} style={{ left: s.left(original.paidIdx) }}>
                First plan: {monthLabel(original.paidIdx)}
              </span>
            )}
            {!hidden.has('bank') && bankEnd && whole && (
              <span className="end-label" style={{ top: s.top(bankEnd.v) }}>Bank: {moneyShort(bankEnd.v)} still owed in {monthLabel(bankEnd.idx)}</span>
            )}
            {checkIns.map((c) => (
              <span key={c.month}>
                <span className="dot ring s-loan-dot" style={{ left: s.left(toIdx(c.month)), top: s.top(c.loan) }} />
                <span className="dot s-offset-dot" style={{ left: s.left(toIdx(c.month)), top: s.top(c.offset - (kidsInOffset ? c.kids.reduce((a, b) => a + b, 0) : 0)) }} />
              </span>
            ))}
          </>
        )}
        below={(s) => <Lane items={items} d0={d0} s={s} />}
      />
      )}
      <div className="lane-key muted small">
        <span><span className="chip-swatch recorded" aria-hidden="true" />Recorded</span>
        <span><span className="chip-swatch guess" aria-hidden="true" />Guess in {plan.name}</span>
      </div>
    </section>
  );
}
