import { useEffect, useId, useState, type ReactNode } from 'react';
import { addMonths, monthLabel, toIdx, type YM } from '../engine';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** Shown beside the label when the value differs from the saved one, e.g. "was $2,000". */
  was?: string;
  hint?: ReactNode;
}

/** A slider for quick changes and a box for an exact figure. The box accepts values beyond the slider's range. */
export function NumberField({ label, value, onChange, min, max, step, was, hint }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const fromText = (t: string) => {
    setText(t);
    const n = Number(t);
    if (t.trim() !== '' && Number.isFinite(n) && n >= 0) onChange(n);
  };

  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        {was && <span className="field-was">{was}</span>}
      </div>
      <div className="field-ctl">
        <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label}, slider`} />
        <input id={id} type="number" inputMode="decimal" min={0} step={step} value={text} onChange={(e) => fromText(e.target.value)} onBlur={() => setText(String(value))} />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/** A plain number box that only reports valid numbers, for values inside lists and forms. */
export function ValueInput({ label, value, step, onChange, hint }: { label: string; value: number; step: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <span className="value-input">
      <span className="value-input-text">
        <label htmlFor={id}>{label}</label>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input id={id} type="number" inputMode="decimal" step={step} min={0} value={text}
        onChange={(e) => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= 0) onChange(n); }}
        onBlur={() => setText(String(value))} />
    </span>
  );
}

interface StepperProps {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  canDec?: boolean;
  canInc?: boolean;
}

export function Stepper({ label, display, onDec, onInc, decLabel, incLabel, canDec = true, canInc = true }: StepperProps) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <span className="stepper" role="group" aria-label={label}>
        <button type="button" aria-label={decLabel} onClick={onDec} disabled={!canDec}>‹</button>
        <output aria-live="polite">{display}</output>
        <button type="button" aria-label={incLabel} onClick={onInc} disabled={!canInc}>›</button>
      </span>
    </div>
  );
}

export function MonthStepper({ label, value, onChange, min, max }: { label: string; value: YM; onChange: (v: YM) => void; min?: YM; max?: YM }) {
  return (
    <Stepper
      label={label}
      display={monthLabel(toIdx(value))}
      onDec={() => onChange(addMonths(value, -1))}
      onInc={() => onChange(addMonths(value, 1))}
      decLabel={`${label}: a month earlier`}
      incLabel={`${label}: a month later`}
      canDec={!min || toIdx(value) > toIdx(min)}
      canInc={!max || toIdx(value) < toIdx(max)}
    />
  );
}

export function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="toggle" onClick={() => onChange(!checked)}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description && <span className="field-hint">{description}</span>}
      </span>
      <span className="toggle-track" aria-hidden="true"><span className="toggle-knob" /></span>
    </button>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
