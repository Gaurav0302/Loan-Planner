import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { checkInNet, pointAt, type DashboardModel } from '../data/dashboard';
import type { AppData, Plan } from '../data/types';
import { monthLabel, money, moneyShort, toIdx } from '../engine';

type SeriesKey = 'actual' | 'projection' | 'original' | 'bank';

interface Series {
  key: SeriesKey;
  label: string;
  /** CSS class that sets the stroke. */
  cls: string;
  values: Map<number, number>;
}

const W = 1000;
const H = 240;

/** Net debt (loan minus offset) over time: your check-ins, the projection, the plan as first set and the bank's schedule. */
export function NetDebtChart({ model, plan, data }: { model: DashboardModel; plan: Plan; data: AppData }) {
  const [range, setRange] = useState<'near' | 'full'>('near');
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const [cursor, setCursor] = useState<number | null>(null);
  const tipId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(800);
  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const startIdx = toIdx(plan.setup.start);
  const { now, original } = model;
  const hasHistory = data.facts.length + data.factLumps.length > 0 || !!model.latest;

  const series = useMemo<Series[]>(() => {
    const map = (pts: { idx: number; net: number }[]) => new Map(pts.map((p) => [p.idx, p.net]));
    const list: Series[] = [];
    const checkIns = data.checkIns.filter((c) => c.month >= plan.setup.start);
    if (checkIns.length) list.push({ key: 'actual', label: 'Your balances', cls: 's-actual', values: new Map(checkIns.map((c) => [toIdx(c.month), checkInNet(plan, c)])) });
    list.push({ key: 'projection', label: model.latest ? 'Projection from your latest balances' : plan.name, cls: 's-projection', values: map(now.res.points.filter((p) => p.loanActive || p.m === now.res.paidMonth)) });
    if (hasHistory) list.push({ key: 'original', label: 'The plan as first set', cls: 's-original', values: map(original.points.filter((p) => p.loanActive || p.m === original.paidMonth)) });
    list.push({ key: 'bank', label: 'Bank’s schedule, nothing extra', cls: 's-bank', values: map(now.bank.points.filter((p) => p.loanActive)) });
    return list;
  }, [data.checkIns, plan, now, original, model.latest, hasHistory]);

  const near = range === 'near';
  const d0 = near ? Math.max(startIdx, model.todayIdx - 12) : startIdx;
  const d1 = near ? Math.max(d0 + 18, model.todayIdx + 18) : Math.max(now.res.paidIdx, original.paidIdx) + 12;
  const visible = series.filter((s) => !hidden.has(s.key));

  let yMin = 0;
  let yMax = plan.setup.loan;
  if (near) {
    const vals: number[] = [];
    for (const s of visible) for (const [i, v] of s.values) if (i >= d0 && i <= d1) vals.push(v);
    if (vals.length) {
      const lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max(5000, (hi - lo) * 0.08);
      yMin = Math.max(0, lo - pad);
      yMax = hi + pad;
    }
  }
  const x = (idx: number) => ((idx - d0) / (d1 - d0)) * W;
  const y = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H;

  const pathFor = (s: Series) => {
    let d = '';
    const step = near ? 1 : 2;
    for (let i = d0; i <= d1; i += step) {
      const v = s.values.get(i);
      if (v === undefined) continue;
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    }
    return d;
  };

  // As many axis labels as fit the plot's real width without touching.
  const maxTicks = Math.max(2, Math.floor(plotWidth / (near ? 78 : 48)));
  const ticks: { idx: number; label: string }[] = [];
  if (near) {
    const step = [3, 6, 12].find((s) => (d1 - d0) / s <= maxTicks) ?? 12;
    for (let i = d0; i <= d1; i += step) ticks.push({ idx: i, label: monthLabel(i) });
  } else {
    const every = [1, 2, 4, 5, 10].find((s) => (d1 - d0) / 12 / s <= maxTicks) ?? 10;
    for (let yr = Math.ceil(d0 / 12); yr * 12 <= d1; yr += every) ticks.push({ idx: yr * 12, label: String(yr) });
  }

  const factIdx = [...data.facts.map((f) => toIdx(f.month)), ...data.factLumps.map((l) => toIdx(l.month))].filter((i) => i >= d0 && i <= d1);
  const today = Math.min(Math.max(model.todayIdx, d0), d1);

  const moveTo = (idx: number) => setCursor(Math.min(d1, Math.max(d0, idx)));
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    moveTo(Math.round(d0 + ((e.clientX - r.left) / r.width) * (d1 - d0)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const base = cursor ?? model.todayIdx;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12 };
    if (e.key in steps) { e.preventDefault(); moveTo(base + steps[e.key]); }
    if (e.key === 'Escape') setCursor(null);
  };

  const tip = cursor === null ? null : (() => {
    const p = pointAt(now.res, cursor);
    const rows = visible.map((s) => ({ s, v: s.values.get(cursor) })).filter((r) => r.v !== undefined) as { s: Series; v: number }[];
    return { p, rows };
  })();
  const tipLeft = cursor === null ? 0 : (x(cursor) / W) * 100;

  return (
    <section className="card" aria-labelledby="chart-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="chart-title">Net debt: plan and actual</h2>
          <p className="muted small">Loan balance minus the offset. Hover, or focus the chart and use the arrow keys, to read any month.</p>
        </div>
        <div className="segmented" role="group" aria-label="Chart range">
          <button type="button" aria-pressed={near} onClick={() => setRange('near')}>Around now</button>
          <button type="button" aria-pressed={!near} onClick={() => setRange('full')}>Whole loan</button>
        </div>
      </div>

      <div className="legend" role="group" aria-label="Lines shown">
        {series.map((s) => (
          <button key={s.key} type="button" aria-pressed={!hidden.has(s.key)} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}>
            <span className={`key ${s.cls}`} aria-hidden="true" />{s.label}
          </button>
        ))}
        {factIdx.length > 0 && <span className="legend-note"><span className="key s-fact" aria-hidden="true" />A recorded change</span>}
      </div>

      <div className="chart-grid">
        <div className="y-axis" aria-hidden="true">
          <span style={{ top: 0 }}>{moneyShort(yMax)}</span>
          <span style={{ top: '50%' }}>{moneyShort((yMax + yMin) / 2)}</span>
          <span style={{ bottom: 0 }}>{moneyShort(yMin)}</span>
        </div>
        <div
          ref={plotRef}
          className="plot"
          tabIndex={0}
          role="group"
          aria-label={`Net debt chart from ${monthLabel(d0)} to ${monthLabel(d1)}. Use the arrow keys to move month by month, Page Up and Page Down for a year.`}
          aria-describedby={tip ? tipId : undefined}
          onPointerMove={onPointer}
          onPointerLeave={() => setCursor(null)}
          onKeyDown={onKey}
          onBlur={() => setCursor(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <path className="grid" d={`M0 0.5H${W}M0 ${H / 2}H${W}M0 ${H - 0.5}H${W}`} />
            {factIdx.map((i) => <path key={i} className="s-fact" d={`M${x(i).toFixed(1)} 0V${H}`} />)}
            {model.started && <path className="today" d={`M${x(today).toFixed(1)} 0V${H}`} />}
            {visible.filter((s) => s.key !== 'actual').map((s) => <path key={s.key} className={`line ${s.cls}`} d={pathFor(s)} />)}
            {visible.filter((s) => s.key === 'actual').map((s) => <path key={s.key} className={`line ${s.cls}`} d={pathFor(s)} />)}
            {cursor !== null && <path className="crosshair" d={`M${x(cursor).toFixed(1)} 0V${H}`} />}
          </svg>
          {visible.filter((s) => s.key === 'actual').flatMap((s) => [...s.values].filter(([i]) => i >= d0 && i <= d1).map(([i, v]) => (
            <span key={i} className="dot" style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%` }} />
          )))}
          {model.started && <span className="today-label" style={{ left: `${(x(today) / W) * 100}%` }}>Today</span>}
          {tip && (
            <div id={tipId} className={tipLeft > 60 ? 'tooltip left' : 'tooltip'} style={{ left: `${tipLeft}%` }} role="status">
              <strong className="tip-title">{monthLabel(cursor!)}</strong>
              {tip.rows.map(({ s, v }) => (
                <span key={s.key} className="tip-row"><span className={`key ${s.cls}`} aria-hidden="true" /><b>{money(v)}</b><span>{s.label}</span></span>
              ))}
              {tip.p.loanActive && <span className="tip-meta">Rate {tip.p.rate.toFixed(2)}% · repayment {money(tip.p.paidOut)}</span>}
            </div>
          )}
        </div>
        <div />
        <div className="x-axis" aria-hidden="true">
          {ticks.map((t) => <span key={t.idx} style={{ left: `${(x(t.idx) / W) * 100}%` }}>{t.label}</span>)}
        </div>
      </div>
    </section>
  );
}
