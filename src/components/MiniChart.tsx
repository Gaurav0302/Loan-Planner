import type { SimResult } from '../engine';

/** Net debt over time for one projection, with an optional faint comparison line behind it. */
export function MiniChart({ result, compare, label, height = 80 }: { result: SimResult; compare?: SimResult; label: string; height?: number }) {
  const span = Math.max(result.paidMonth, compare?.paidMonth ?? 0) + 6;
  const top = Math.max(result.points[0]?.loan ?? 1, compare?.points[0]?.loan ?? 1);
  const path = (r: SimResult) => {
    let d = '';
    for (let i = 0; i < r.points.length && r.points[i].m <= span; i += 3) {
      const p = r.points[i];
      d += `${d ? 'L' : 'M'}${((p.m / span) * 300).toFixed(1)} ${(height - 2 - (p.net / top) * (height - 4)).toFixed(1)} `;
    }
    return d;
  };
  return (
    <svg className="mini-chart" viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" role="img" aria-label={label} style={{ height }}>
      {compare && <path d={path(compare)} className="mini-compare" />}
      <path d={path(result)} className="mini-line" />
    </svg>
  );
}
