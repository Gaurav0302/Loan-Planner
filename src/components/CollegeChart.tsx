import { useMemo } from 'react';
import { pointAt, type DashboardModel } from '../data/dashboard';
import type { AppData, Plan } from '../data/types';
import { money, moneyShort, toIdx } from '../engine';
import { TimeChart, W, areaPath, linePath, type TipRow } from './TimeChart';

const KID_CLASSES = ['s-kid0', 's-kid1'];
const kidClass = (i: number) => KID_CLASSES[i % KID_CLASSES.length];

/** Each child's fund growing towards its goal, the years at university when it is drawn down, and real check-ins. */
export function CollegeChart({ model, plan, data }: { model: DashboardModel; plan: Plan; data: AppData }) {
  const kids = plan.setup.kids;
  const res = model.now.res;
  const s0 = toIdx(plan.setup.start);
  const uniYears = plan.setup.uniYears;
  const d1 = Math.max(s0 + 24, ...kids.map((k) => (k.uni + uniYears) * 12 + 3));

  const series = useMemo(
    () => kids.map((_, i) => res.points.filter((p) => p.idx <= d1).map((p) => ({ idx: p.idx, v: p.kids[i] ?? 0 }))),
    [res, kids, d1],
  );
  if (!kids.length) return null;

  const peak = Math.max(1000, ...series.flat().map((p) => p.v), ...kids.map((k) => k.goal));
  const yMax = peak * 1.12;
  const checkIns = data.checkIns.filter((c) => c.month >= plan.setup.start);

  const tooltip = (idx: number) => {
    const p = pointAt(res, idx);
    const rows: TipRow[] = kids.map((k, i) => {
      const uni = k.uni * 12 + 1;
      const stage = idx < toIdx(k.start) ? 'not started' : idx < uni ? 'saving' : idx < uni + uniYears * 12 ? 'at university' : 'finished';
      return { key: k.name + i, cls: kidClass(i), value: money(p.kids[i] ?? 0), label: `${k.name}, ${stage}` };
    });
    const c = checkIns.find((x) => toIdx(x.month) === idx);
    if (c) kids.forEach((k, i) => rows.push({ key: `c${i}`, cls: 's-actual', value: money(c.kids[i] ?? 0), label: `${k.name}, your statement` }));
    return { rows };
  };

  return (
    <section className="card" aria-labelledby="college-chart-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="college-chart-title">College funds over time</h2>
          <p className="muted small">Each fund grows until university starts, then is drawn down evenly over {uniYears} {uniYears === 1 ? 'year' : 'years'}. Dashed lines are the goals.</p>
        </div>
      </div>
      <div className="legend" aria-label="Children">
        {kids.map((k, i) => (
          <span key={i} className="legend-note solid"><span className={`key ${kidClass(i)}`} aria-hidden="true" />{k.name}: {moneyShort(res.kidsAtUni[i] ?? 0)} when uni starts{k.goal > 0 ? ` · goal ${moneyShort(k.goal)}` : ''}</span>
        ))}
      </div>
      <TimeChart
        d0={s0}
        d1={d1}
        yMax={yMax}
        height={220}
        label="College funds over time"
        todayIdx={model.started ? model.todayIdx : undefined}
        tooltip={tooltip}
        svg={(s) => (
          <>
            {kids.map((k, i) => {
              const uni = k.uni * 12 + 1;
              return <rect key={`band${i}`} className={`uni-band ${kidClass(i)}`} x={s.x(uni)} y={0} width={Math.max(0, s.x(uni + uniYears * 12) - s.x(uni))} height={s.height} />;
            })}
            {series.map((pts, i) => <path key={`a${i}`} className={`area-kid ${kidClass(i)}`} d={areaPath(s, pts, 2)} />)}
            {kids.map((k, i) => k.goal > 0 && (
              <path key={`g${i}`} className={`goal-line ${kidClass(i)}`} d={`M${s.x(toIdx(k.start)).toFixed(1)} ${s.y(k.goal).toFixed(1)}H${s.x(k.uni * 12 + 1).toFixed(1)}`} />
            ))}
            {series.map((pts, i) => <path key={`l${i}`} className={`line ${kidClass(i)}`} d={linePath(s, pts, 2)} />)}
          </>
        )}
        overlay={(s) => (
          <>
            {kids.map((k, i) => {
              const uni = k.uni * 12 + 1;
              const v = res.kidsAtUni[i] ?? 0;
              const bandPx = ((s.x(uni + uniYears * 12) - s.x(uni)) / W) * s.width;
              return (
                <span key={`p${i}`}>
                  <span className={`band-label ${kidClass(i)}`} style={{ left: s.left(uni), maxWidth: Math.max(0, bandPx - 10) }}>{k.name} at uni</span>
                  <span className={`dot ${kidClass(i)}-dot`} style={{ left: s.left(uni), top: s.top(v) }} />
                  <span className={s.x(uni) > W * 0.8 ? 'value-label left' : 'value-label'} style={{ left: s.left(uni), top: s.top(v) }}>{moneyShort(v)}</span>
                  {k.goal > 0 && <span className="goal-label" style={{ left: s.left(toIdx(k.start)), top: s.top(k.goal) }}>{k.name}’s goal {moneyShort(k.goal)}</span>}
                </span>
              );
            })}
            {checkIns.flatMap((c) => kids.map((k, i) => (
              <span key={`${c.month}-${i}`} className="dot ring s-actual-dot" style={{ left: s.left(toIdx(c.month)), top: s.top(c.kids[i] ?? 0) }} title={`${k.name}: ${money(c.kids[i] ?? 0)}`} />
            )))}
          </>
        )}
      />
    </section>
  );
}
