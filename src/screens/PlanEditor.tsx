import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { MonthStepper, NumberField, Segmented, Stepper, Toggle } from '../components/fields';
import { MiniChart } from '../components/MiniChart';
import { PageHeader } from '../components/PageHeader';
import { changeKinds, describeChange, monthlyForGoal, startingValue } from '../data/describe';
import { newId } from '../data/normalize';
import { presetStart, presets, removeKid, runPlan, summarizeRun } from '../data/plans';
import { useStore } from '../data/store';
import type { Plan } from '../data/types';
import {
  addMonths, duration, monthLabel, monthName, money, moneyShort, percent, toIdx, years,
  type Change, type ChangeType, type Kid, type Setup,
} from '../engine';
import { href } from '../lib/router';

type Section = 'loan' | 'household' | 'paying' | 'changes' | 'college';

const MAX_KIDS = 8;

export function PlanEditor({ planId }: { planId?: string }) {
  const { data, activePlan, dispatch } = useStore();
  const saved = planId ? data.plans.find((p) => p.id === planId) : activePlan;
  const [section, setSection] = useState<Section>('loan');

  if (!saved) {
    return (
      <div className="page">
        <PageHeader title="Plan not found" sub="It may have been deleted." />
        <div><a className="btn" href={href('plans')}>See all plans</a></div>
      </div>
    );
  }
  return <Editor key={saved.id} saved={saved} section={section} setSection={setSection} isActive={saved.id === data.activePlanId} draft={data.drafts?.[saved.id] ?? saved} dispatch={dispatch} />;
}

interface EditorProps {
  saved: Plan;
  draft: Plan;
  isActive: boolean;
  section: Section;
  setSection: (s: Section) => void;
  dispatch: ReturnType<typeof useStore>['dispatch'];
}

function Editor({ saved, draft, isActive, section, setSection, dispatch }: EditorProps) {
  const { data } = useStore();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (fn: (p: Plan) => Plan) => dispatch({ type: 'setDraft', plan: fn(draft) });
  const setSetup = (patch: Partial<Setup>) => update((p) => ({ ...p, setup: { ...p.setup, ...patch } }));

  const now = useMemo(() => runPlan(data, draft), [data.facts, data.factLumps, draft]);
  const before = useMemo(() => runPlan(data, saved), [data.facts, data.factLumps, saved]);
  const sum = summarizeRun(draft, now);
  const from = presetStart(draft);
  const fromPoint = now.res.points.find((p) => p.idx === toIdx(from) - 1) ?? now.res.points[0];
  const nowPoint = now.res.points.find((p) => p.idx === toIdx(from)) ?? now.res.points[0];

  const s = draft.setup, o = saved.setup;
  const was = <K extends keyof Setup>(key: K, fmt: (v: Setup[K]) => string) => (s[key] !== o[key] ? `was ${fmt(o[key])}` : undefined);
  const field = <K extends keyof Setup>(key: K, label: string, min: number, max: number, step: number, fmt: (v: number) => string, hint?: ReactNode) => (
    <NumberField label={label} value={s[key] as number} min={min} max={max} step={step} onChange={(v) => setSetup({ [key]: v } as Partial<Setup>)} was={was(key, (v) => fmt(v as number))} hint={hint} />
  );

  const sections: { id: Section; label: string; sum: string }[] = [
    { id: 'loan', label: 'Loan', sum: `${moneyShort(s.loan)} at ${percent(s.rate)}` },
    { id: 'household', label: 'Household', sum: `${money(s.inc1 + s.inc2)} a month in` },
    { id: 'paying', label: 'Paying it down', sum: s.sweep ? 'All spare money' : `${money(s.extra)} extra` },
    { id: 'changes', label: 'Life changes', sum: `${data.facts.length + data.factLumps.length} recorded · ${draft.changes.length + draft.lumps.length} guessed` },
    { id: 'college', label: 'College funds', sum: `${money(s.kids.reduce((a, k) => a + k.monthly, 0))} a month` },
  ];

  const d = sum.paidMonth - before.res.paidMonth;
  const chip = d === 0 ? (dirty ? 'Same date as saved' : `${years(sum.paidMonth)} of repayments`) : `${duration(d)} ${d < 0 ? 'sooner' : 'later'} than saved`;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-text editor-title">
          <a className="back-link" href={href('plans')}>‹ All plans</a>
          <div className="name-row">
            <span className="dot big" style={{ background: draft.color }} aria-hidden="true" />
            <h1 className="sr-only" tabIndex={-1}>Edit {draft.name}</h1>
            <input type="text" className="name-input" aria-label="Plan name" value={draft.name} maxLength={60} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} onBlur={() => { if (!draft.name.trim()) update((p) => ({ ...p, name: saved.name })); }} />
            {isActive ? <span className="badge">Active</span> : <button type="button" className="btn small-btn" onClick={() => dispatch({ type: 'setActive', id: saved.id })}>Make active</button>}
          </div>
        </div>
        <div className="actions align-center">
          <span className="muted small" role="status">{dirty ? 'Unsaved changes (kept if you leave this page)' : 'All changes saved'}</span>
          <button type="button" className="btn" disabled={!dirty} onClick={() => dispatch({ type: 'discardDraft', id: saved.id })}>Discard</button>
          <button type="button" className="btn primary" disabled={!dirty} onClick={() => dispatch({ type: 'savePlan', plan: { ...draft, name: draft.name.trim() || saved.name } })}>Save changes</button>
        </div>
      </header>

      <div className="out-bar" aria-hidden="true">
        <span>Paid off <strong>{monthLabel(sum.paidIdx)}</strong></span>
        <span className={d < 0 ? 'chip good' : d > 0 ? 'chip bad' : 'chip'}>{chip}</span>
      </div>

      <div className="editor">
        <nav className="editor-nav" aria-label="Plan sections">
          {sections.map((x) => (
            <button key={x.id} type="button" aria-current={x.id === section ? 'true' : undefined} onClick={() => setSection(x.id)}>
              <span className="editor-nav-label">{x.label}</span>
              <span className="editor-nav-sum">{x.sum}</span>
            </button>
          ))}
        </nav>

        <section className="card editor-form" aria-labelledby="section-title">
          {section === 'loan' && (
            <>
              <SectionHead title="The loan" intro="How the loan started. Rate changes that really happen go in Record; guesses about future rates go under Life changes." />
              {field('loan', 'Loan amount, including LMI', 300000, 2000000, 1000, money)}
              {field('rate', 'Starting interest rate (%)', 2, 12, 0.05, percent, 'Whenever the rate moves, the repayment is recalculated on the remaining term, as a lender does.')}
              {field('term', 'Term in years', 5, 40, 1, (v) => `${v} years`)}
              <MonthStepper label="First repayment" value={s.start} onChange={(v) => setSetup({ start: v })} />
              {field('offset0', 'Cash in the offset at settlement', 0, 300000, 1000, money, 'Emergency fund plus anything you sell. Money here cancels interest on the same amount of loan.')}
            </>
          )}

          {section === 'household' && (
            <>
              <SectionHead title="Money coming in and going out" intro="Starting monthly figures. A pay rise or a period on one income goes under Life changes, with a start month." />
              {field('inc1', 'Your take-home a month', 0, 30000, 100, money)}
              {field('inc2', 'Partner’s take-home a month', 0, 30000, 100, money)}
              {field('living', 'Living costs a month (everything but the loan)', 0, 20000, 100, money)}
              {field('sac1', 'Your salary sacrifice a month', 0, 3000, 50, money)}
              {field('sac2', 'Partner’s salary sacrifice a month', 0, 3000, 50, money)}
              {field('tax', 'Marginal tax rate on that pay (%)', 0, 47, 0.5, (v) => `${v}%`, 'Salary sacrifice comes out before tax, so it costs less take-home than it looks.')}
              {field('growth', 'Pay rises each year (%)', 0, 6, 0.5, (v) => `${v}%`, 'Grows take-home pay, living costs and the extra amount together.')}
            </>
          )}

          {section === 'paying' && (
            <>
              <SectionHead title="Paying the loan down faster" intro="Everything here goes into the offset, where it cancels interest." />
              {field('extra', 'Extra into the offset each month', 0, 10000, 50, money)}
              <Toggle label="Put all spare money in instead" description="Adjusts itself when pay, costs or the repayment change." checked={s.sweep} onChange={(v) => setSetup({ sweep: v })} />
              {field('bonus', 'Yearly bonus into the offset', 0, 60000, 500, money)}
              <Stepper label="Bonus is paid in" display={monthName(s.bonusMonth)} decLabel="Bonus a month earlier" incLabel="Bonus a month later"
                onDec={() => setSetup({ bonusMonth: s.bonusMonth === 1 ? 12 : s.bonusMonth - 1 })} onInc={() => setSetup({ bonusMonth: s.bonusMonth === 12 ? 1 : s.bonusMonth + 1 })} />
              <Lumps plan={draft} update={update} from={from} />
            </>
          )}

          {section === 'changes' && <LifeChanges plan={draft} update={update} from={from} rateThen={fromPoint.rate} />}

          {section === 'college' && <College plan={draft} saved={saved} update={update} setSetup={setSetup} kidsAtUni={now.res.kidsAtUni} />}
        </section>

        <aside className="card editor-out" aria-label="Results with these settings">
          <span className="eyebrow-caps">With these settings</span>
          <div className="out-hero">
            <span className="muted small">Loan paid off</span>
            <strong>{monthLabel(sum.paidIdx)}</strong>
            <span className={d < 0 ? 'chip good' : d > 0 ? 'chip bad' : 'chip'}>{chip}</span>
          </div>
          <MiniChart result={now.res} compare={dirty ? before.res : undefined} label="Net debt over time with these settings, and with the saved plan" />
          <dl className="out-rows">
            <div><dt>Time saved against the bank</dt><dd className="good">{years(sum.timeSaved)}</dd></div>
            <div><dt>Interest saved against the bank</dt><dd className="good">{moneyShort(sum.interestSaved)}</dd></div>
            <div><dt>Interest paid</dt><dd>{moneyShort(sum.interest)}</dd></div>
            <div><dt>Repayment in {monthLabel(nowPoint.idx)}</dt><dd>{money(nowPoint.paidOut)}</dd></div>
            <div><dt>Not allocated that month</dt><dd className={nowPoint.spare < 0 ? 'bad' : undefined}>{nowPoint.spare < 0 ? `${money(-nowPoint.spare)} short` : money(nowPoint.unallocated)}</dd></div>
          </dl>
          {sum.shortMonths > 0 && (
            <p className="warn-line">
              In {sum.shortMonths} {sum.shortMonths === 1 ? 'month' : 'months'} costs are more than pay. {moneyShort(sum.drawn)} comes out of the offset{sum.unfunded > 0 ? `, and ${moneyShort(sum.unfunded)} more is not covered at all` : ''}.
            </p>
          )}
          {s.kids.length > 0 && (
            <div className="out-kids">
              <span className="muted small">College funds when uni starts</span>
              {s.kids.map((k, i) => (
                <div key={i} className="out-kid">
                  <span>{k.name} · {k.uni}</span>
                  <span className={k.goal > 0 ? (sum.kidsAtUni[i] >= k.goal ? 'good' : 'bad') : undefined}>{moneyShort(sum.kidsAtUni[i])}{k.goal > 0 ? ` of ${moneyShort(k.goal)}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionHead({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="section-head">
      <h2 id="section-title">{title}</h2>
      <p className="muted">{intro}</p>
    </div>
  );
}

/** A plain number box that only reports valid numbers, for values inside lists. */
function ValueInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <span className="value-input">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" step={step} min={0} value={text}
        onChange={(e) => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= 0) onChange(n); }}
        onBlur={() => setText(String(value))} />
    </span>
  );
}

function Lumps({ plan, update, from }: { plan: Plan; update: (fn: (p: Plan) => Plan) => void; from: string }) {
  const set = (id: string, patch: Partial<Plan['lumps'][number]>) => update((p) => ({ ...p, lumps: p.lumps.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const sorted = [...plan.lumps].sort((a, b) => a.month.localeCompare(b.month));
  return (
    <div className="list-block">
      <h3>Planned lump sums</h3>
      <p className="field-hint">A tax refund, an inheritance or a sale you expect. Money that has already arrived goes in Record.</p>
      {sorted.length === 0 && <p className="empty">None yet.</p>}
      {sorted.map((l) => (
        <div key={l.id} className="list-item">
          <ValueInput label="Amount" value={l.amount} step={500} onChange={(v) => set(l.id, { amount: v })} />
          <MonthStepper label="Month" value={l.month} onChange={(v) => set(l.id, { month: v })} />
          <button type="button" className="link-btn danger" onClick={() => update((p) => ({ ...p, lumps: p.lumps.filter((x) => x.id !== l.id) }))}>Remove</button>
        </div>
      ))}
      <div><button type="button" className="btn" onClick={() => update((p) => ({ ...p, lumps: [...p.lumps, { id: newId('l-'), month: addMonths(from, 6), amount: 10000 }] }))}>Add a lump sum</button></div>
    </div>
  );
}

function LifeChanges({ plan, update, from, rateThen }: { plan: Plan; update: (fn: (p: Plan) => Plan) => void; from: string; rateThen: number }) {
  const { data } = useStore();
  const kinds = changeKinds(plan.setup.kids);
  const [kind, setKind] = useState<ChangeType>('rate');
  const selectId = useId();
  const set = (id: string, patch: Partial<Change>) => update((p) => ({ ...p, changes: p.changes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const add = (list: Omit<Change, 'id'>[]) => update((p) => ({ ...p, changes: [...p.changes, ...list.map((c) => ({ ...c, id: newId('c-') }))] }));
  const sorted = [...plan.changes].sort((a, b) => a.month.localeCompare(b.month));
  const facts = [...data.facts].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <>
      <SectionHead title="Life changes" intro="Recorded changes really happened and apply to every plan. Guesses belong to this plan only and stay editable." />

      <div className="list-block">
        <div className="list-head"><h3>Recorded</h3><a href={href('record')}>Record a change</a></div>
        {facts.length === 0 && data.factLumps.length === 0 && <p className="empty">Nothing recorded yet. When the rate or your payments really change, record it so every plan uses it.</p>}
        {facts.map((c) => <p key={c.id} className="fact-item"><span className="lock" aria-label="Recorded, locked">●</span>{describeChange(c, plan.setup.kids)}</p>)}
        {data.factLumps.map((l) => <p key={l.id} className="fact-item"><span className="lock" aria-label="Recorded, locked">●</span>{money(l.amount)} went into the offset in {monthLabel(toIdx(l.month))}.</p>)}
      </div>

      <div className="list-block">
        <h3>This plan's guesses</h3>
        {sorted.length === 0 && <p className="empty">No guesses yet. Everything stays as set on the other sections for the whole loan.</p>}
        {sorted.map((c) => {
          const temporary = !!c.until;
          return (
            <div key={c.id} className="change-item">
              <p className="change-text">{describeChange(c, plan.setup.kids)}</p>
              <div className="change-controls">
                <MonthStepper label="From" value={c.month} onChange={(v) => set(c.id, { month: v, until: c.until ? addMonths(c.until, toIdx(v) - toIdx(c.month)) : undefined })} />
                {c.type === 'sweep'
                  ? <Segmented label="Sweep" value={c.value ? 'on' : 'off'} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} onChange={(v) => set(c.id, { value: v === 'on' ? 1 : 0 })} />
                  : <ValueInput label={c.type === 'rate' ? 'New rate (%)' : c.type === 'bonus' ? 'New bonus a year' : 'New amount a month'} value={c.value} step={c.type === 'rate' ? 0.05 : 50} onChange={(v) => set(c.id, { value: v })} />}
                {c.type !== 'rate' && (
                  <Segmented label="How long" value={temporary ? 'temp' : 'perm'} options={[{ value: 'perm', label: 'From then on' }, { value: 'temp', label: 'For a while' }]}
                    onChange={(v) => set(c.id, { until: v === 'temp' ? addMonths(c.month, 11) : undefined })} />
                )}
                {temporary && <MonthStepper label="Until" value={c.until!} min={c.month} onChange={(v) => set(c.id, { until: v })} />}
              </div>
              <button type="button" className="link-btn danger" onClick={() => update((p) => ({ ...p, changes: p.changes.filter((x) => x.id !== c.id) }))}>Remove</button>
            </div>
          );
        })}
        <div className="add-row">
          <label htmlFor={selectId} className="small">Add a guess</label>
          <select id={selectId} value={kind} onChange={(e) => setKind(e.target.value as ChangeType)}>
            {kinds.map((k) => <option key={k.type} value={k.type}>{k.label}</option>)}
          </select>
          <button type="button" className="btn" onClick={() => add([{ month: from, type: kind, value: kind === 'rate' ? rateThen : startingValue(plan.setup, kind) }])}>Add</button>
        </div>
        <div className="preset-block">
          <span className="small muted">Or start from a common one, dated from {monthLabel(toIdx(from))}:</span>
          <div className="chips">
            {presets(plan, from, rateThen).map((p) => <button key={p.label} type="button" className="chip-btn" onClick={() => add(p.changes)}>{p.label}</button>)}
          </div>
        </div>
      </div>
    </>
  );
}

function College({ plan, saved, update, setSetup, kidsAtUni }: { plan: Plan; saved: Plan; update: (fn: (p: Plan) => Plan) => void; setSetup: (patch: Partial<Setup>) => void; kidsAtUni: number[] }) {
  const s = plan.setup;
  const setKid = (i: number, patch: Partial<Kid>) => setSetup({ kids: s.kids.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const startYear = Math.floor(toIdx(s.start) / 12);

  return (
    <>
      <SectionHead title="College funds" intro="Saved alongside the loan. Set a goal for each child to see whether you are on track." />
      <div className="field">
        <span className="field-head"><span className="stepper-label">Where the funds are kept</span></span>
        <Segmented label="Where the funds are kept" value={s.kidsInOffset ? 'offset' : 'invest'} options={[{ value: 'invest', label: 'Invest them' }, { value: 'offset', label: 'Keep in the offset' }]} onChange={(v) => setSetup({ kidsInOffset: v === 'offset' })} />
        <p className="field-hint">{s.kidsInOffset ? 'In the offset each fund grows at the loan rate, tax-free, by cancelling interest. When university starts the money leaves the offset, so interest goes back up.' : 'Invested separately, the funds grow at the return you expect and do not touch the loan.'}</p>
      </div>
      {!s.kidsInOffset && (
        <NumberField label="Expected return a year, after fees and tax (%)" value={s.eduRate} min={0} max={12} step={0.25} onChange={(v) => setSetup({ eduRate: v })}
          was={s.eduRate !== saved.setup.eduRate ? `was ${percent(saved.setup.eduRate)}` : undefined} hint="Your own assumption. The app does not recommend a product or a return." />
      )}
      <NumberField label="Years at university (each fund is drawn evenly)" value={s.uniYears} min={1} max={6} step={1} onChange={(v) => setSetup({ uniYears: Math.max(1, Math.round(v)) })} />

      {s.kids.map((k, i) => {
        const was0 = saved.setup.kids[i];
        const atUni = kidsAtUni[i] ?? 0;
        const need = k.goal > 0 ? monthlyForGoal(s, k) : 0;
        return (
          <div key={i} className="kid-card">
            <div className="kid-head">
              <label className="sr-only" htmlFor={`kid-name-${i}`}>Child {i + 1} name</label>
              <input id={`kid-name-${i}`} type="text" className="kid-name" value={k.name} maxLength={40} onChange={(e) => setKid(i, { name: e.target.value })} onBlur={() => { if (!k.name.trim()) setKid(i, { name: `Child ${i + 1}` }); }} />
              <button type="button" className="link-btn danger" onClick={() => update((p) => removeKid(p, i))}>Remove child</button>
            </div>
            <Stepper label="University starts" display={String(k.uni)} decLabel="A year earlier" incLabel="A year later" onDec={() => setKid(i, { uni: k.uni - 1 })} onInc={() => setKid(i, { uni: k.uni + 1 })} canDec={k.uni > startYear} />
            <NumberField label="Put in each month" value={k.monthly} min={0} max={2000} step={25} onChange={(v) => setKid(i, { monthly: v })} was={was0 && was0.monthly !== k.monthly ? `was ${money(was0.monthly)}` : undefined} />
            <NumberField label="Goal when university starts" value={k.goal} min={0} max={150000} step={1000} onChange={(v) => setKid(i, { goal: v })} was={was0 && was0.goal !== k.goal ? `was ${money(was0.goal)}` : undefined} hint="Leave at 0 for no goal. Living at home, $5,000 to $6,500 a year covers books, transport, a laptop and spending money; course fees can go on HECS-HELP." />
            <MonthStepper label="Saving from" value={k.start} onChange={(v) => setKid(i, { start: v })} />
            <p className="kid-status">
              Fund when uni starts: <strong>{money(atUni)}</strong>
              {k.goal > 0 && (atUni >= k.goal ? <span className="good"> · goal met</span> : <span className="bad"> · {money(k.goal - atUni)} short; about {money(need)} a month reaches it</span>)}
            </p>
          </div>
        );
      })}
      {s.kids.length < MAX_KIDS && (
        <div>
          <button type="button" className="btn" onClick={() => setSetup({ kids: [...s.kids, { name: `Child ${s.kids.length + 1}`, monthly: 0, start: s.start, uni: startYear + 15, goal: 0 }] })}>Add a child</button>
        </div>
      )}
    </>
  );
}
