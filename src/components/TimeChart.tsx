import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { monthLabel, moneyShort } from '../engine';

export const W = 1000;

export interface Scale {
  /** Month index to SVG x (0..W). */
  x: (idx: number) => number;
  /** Money to SVG y (0..height). */
  y: (v: number) => number;
  /** The same positions as CSS percentages, for HTML labels and dots laid over the SVG. */
  left: (idx: number) => string;
  top: (v: number) => string;
  /** Rendered plot width in pixels. */
  width: number;
  height: number;
}

export interface TipRow {
  key: string;
  cls: string;
  value: string;
  label: string;
}

interface Props {
  d0: number;
  d1: number;
  yMax: number;
  /** Bottom of the money axis. Leave at 0 for areas; a zoomed line view can start higher. */
  yMin?: number;
  height?: number;
  label: string;
  todayIdx?: number;
  svg: (s: Scale) => ReactNode;
  overlay?: (s: Scale) => ReactNode;
  /** Rendered under the axis, aligned with the plot (e.g. the life-event lane). */
  below?: (s: Scale) => ReactNode;
  tooltip: (idx: number) => { rows: TipRow[]; meta?: string };
}

/** Plot frame for anything over time: axes, today line, crosshair and tooltip on hover or arrow keys. */
export function TimeChart({ d0, d1, yMax, yMin = 0, height = 280, label, todayIdx, svg, overlay, below, tooltip }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [cursor, setCursor] = useState<number | null>(null);
  const tipId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = height;
  const top = yMax > yMin ? yMax : yMin + 1;
  const frac = (v: number) => (Math.max(yMin, v) - yMin) / (top - yMin);
  const s: Scale = {
    x: (i) => ((i - d0) / (d1 - d0)) * W,
    y: (v) => H - frac(v) * H,
    left: (i) => `${(((i - d0) / (d1 - d0)) * 100).toFixed(2)}%`,
    top: (v) => `${((1 - frac(v)) * 100).toFixed(2)}%`,
    width,
    height: H,
  };

  // Year labels spaced to the width; months when the range is short.
  const ticks: { idx: number; label: string }[] = [];
  const span = d1 - d0;
  if (span <= 36) {
    const step = [3, 6, 12].find((st) => span / st <= width / 80) ?? 12;
    for (let i = Math.ceil(d0 / step) * step; i <= d1; i += step) ticks.push({ idx: i, label: monthLabel(i) });
  } else {
    const every = [1, 2, 3, 5, 10].find((e) => span / 12 / e <= width / 52) ?? 10;
    for (let yr = Math.ceil(d0 / 12); yr * 12 <= d1; yr++) if (yr % every === 0) ticks.push({ idx: yr * 12, label: String(yr) });
  }
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (top - yMin));

  const clampIdx = (i: number) => Math.min(d1, Math.max(d0, i));
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setCursor(clampIdx(Math.round(d0 + ((e.clientX - r.left) / r.width) * span)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -12, PageUp: 12, Home: -9999, End: 9999 };
    if (e.key in steps) { e.preventDefault(); setCursor(clampIdx((cursor ?? todayIdx ?? d0) + steps[e.key])); }
    if (e.key === 'Escape') setCursor(null);
  };
  const tip = cursor === null ? null : tooltip(cursor);
  const tipX = cursor === null ? 0 : ((cursor - d0) / span) * 100;
  const showToday = todayIdx !== undefined && todayIdx > d0 && todayIdx < d1;

  return (
    <div className="tchart">
      <div className="chart-grid">
        <div className="y-axis" aria-hidden="true" style={{ height: H }}>
          {gridValues.map((v, i) => <span key={i} style={{ top: s.top(v) }}>{moneyShort(v)}</span>)}
        </div>
        <div
          ref={ref}
          className="plot"
          style={{ height: H }}
          tabIndex={0}
          role="group"
          aria-label={`${label}, ${monthLabel(d0)} to ${monthLabel(d1)}. Arrow keys move a month, Page Up and Page Down a year.`}
          aria-describedby={tip ? tipId : undefined}
          onPointerMove={onPointer}
          onPointerLeave={() => setCursor(null)}
          onKeyDown={onKey}
          onBlur={() => setCursor(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {gridValues.map((v, i) => <path key={i} className="grid" d={`M0 ${s.y(v).toFixed(1)}H${W}`} />)}
            {svg(s)}
            {showToday && <path className="today" d={`M${s.x(todayIdx!).toFixed(1)} 0V${H}`} />}
            {cursor !== null && <path className="crosshair" d={`M${s.x(cursor).toFixed(1)} 0V${H}`} />}
          </svg>
          {overlay?.(s)}
          {showToday && <span className="today-label" style={{ left: s.left(todayIdx!) }}>Today</span>}
          {tip && (
            <div id={tipId} className={tipX > 58 ? 'tooltip left' : 'tooltip'} style={{ left: `${tipX}%` }} role="status">
              <strong className="tip-title">{monthLabel(cursor!)}</strong>
              {tip.rows.map((r) => (
                <span key={r.key} className="tip-row"><span className={`key ${r.cls}`} aria-hidden="true" /><b>{r.value}</b><span>{r.label}</span></span>
              ))}
              {tip.meta && <span className="tip-meta">{tip.meta}</span>}
            </div>
          )}
        </div>
        <div />
        <div className="x-axis" aria-hidden="true">
          {ticks.map((t) => <span key={t.idx} style={{ left: s.left(t.idx) }}>{t.label}</span>)}
        </div>
        {below && <><div /><div className="below">{below(s)}</div></>}
      </div>
    </div>
  );
}

/** "M x y L x y ..." for a series of (month, value) points, every `step` months. */
export function linePath(s: Scale, pts: { idx: number; v: number }[], step = 1): string {
  let d = '';
  pts.forEach((p, i) => {
    if (i % step !== 0 && i !== pts.length - 1) return;
    d += `${d ? 'L' : 'M'}${s.x(p.idx).toFixed(1)} ${s.y(p.v).toFixed(1)} `;
  });
  return d;
}

/** The same line closed down to zero, for a filled area. */
export function areaPath(s: Scale, pts: { idx: number; v: number }[], step = 1): string {
  if (!pts.length) return '';
  return `${linePath(s, pts, step)}L${s.x(pts[pts.length - 1].idx).toFixed(1)} ${s.y(0).toFixed(1)} L${s.x(pts[0].idx).toFixed(1)} ${s.y(0).toFixed(1)} Z`;
}
