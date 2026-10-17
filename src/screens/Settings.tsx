import { useRef, useState, type ChangeEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { backupFileName, backupJson, parseBackup, summarize, type ParsedBackup } from '../data/backup';
import { useStore } from '../data/store';
import type { Theme } from '../lib/theme';

interface Props {
  theme: Theme;
  onTheme: (t: Theme) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Settings({ theme, onTheme }: Props) {
  const { data, dispatch, saved } = useStore();
  const summary = summarize(data);
  const [pending, setPending] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pasted, setPasted] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const download = () => {
    const url = URL.createObjectURL(new Blob([backupJson(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ ok: true, text: `Saved ${a.download} to your downloads.` });
  };

  const consider = (text: string) => {
    const result = parseBackup(text);
    if (result.ok) { setPending(result); setMessage(null); } else { setPending(null); setMessage({ ok: false, text: result.error }); }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) { setMessage({ ok: false, text: 'That file is too large to be a backup from this app.' }); return; }
    consider(await file.text());
  };

  const apply = () => {
    if (!pending) return;
    dispatch({ type: 'replaceAll', data: pending.data });
    setMessage({ ok: true, text: `Restored. ${pending.summary.activePlanName} is now your active plan.` });
    setPending(null);
    setPasted('');
  };

  return (
    <div className="page">
      <PageHeader title="Settings" sub="How the app looks, and where your data lives." />

      <section className="card" aria-labelledby="look">
        <h2 className="card-title" id="look">Theme</h2>
        <div className="segmented" role="group" aria-label="Theme">
          <button type="button" aria-pressed={theme === 'light'} onClick={() => onTheme('light')}>Light</button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => onTheme('dark')}>Dark</button>
        </div>
      </section>

      <section className="card" aria-labelledby="data">
        <h2 className="card-title" id="data">Your data</h2>
        <p className="muted">
          Everything stays in this browser on this device. Save a backup file to keep a copy, or to move your plans to another device or browser.
          {!saved && ' This browser is not letting the app save, so changes will be lost when you close the page.'}
        </p>
        <div className="facts">
          <div><strong>{summary.plans}</strong><span className="muted small">{summary.plans === 1 ? 'plan' : 'plans'}</span></div>
          <div><strong>{summary.facts}</strong><span className="muted small">recorded {summary.facts === 1 ? 'change' : 'changes'}</span></div>
          <div><strong>{summary.checkIns}</strong><span className="muted small">balance {summary.checkIns === 1 ? 'check-in' : 'check-ins'}</span></div>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={download}>Save a backup file</button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Restore from a backup file</button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />
        </div>

        <details>
          <summary className="small">Paste settings copied from the previous version</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <label className="small muted" htmlFor="paste">In the previous version, open Config, then Advanced, then Copy current settings, and paste here.</label>
            <textarea id="paste" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste a settings block" />
            <div><button type="button" className="btn" disabled={!pasted.trim()} onClick={() => consider(pasted)}>Check what's in it</button></div>
          </div>
        </details>

        {pending && (
          <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
            <strong id="confirm-title">Replace your data with this?</strong>
            <span className="muted small">
              {pending.fromClassic ? 'Settings from the previous version: ' : 'This backup has '}
              {plural(pending.summary.plans, 'plan', 'plans')}, {plural(pending.summary.facts, 'recorded change', 'recorded changes')} and {plural(pending.summary.checkIns, 'check-in', 'check-ins')}.
              Your current {plural(summary.plans, 'plan', 'plans')} will be replaced. Save a backup first if you might want them back.
            </span>
            <div className="actions">
              <button type="button" className="btn primary" onClick={apply}>Replace my data</button>
              <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
        {message && <p role="status" className={message.ok ? 'status-ok' : 'status-bad'}>{message.text}</p>}
      </section>

      <section className="card" aria-labelledby="reset">
        <h2 className="card-title" id="reset">Start again</h2>
        <p className="muted">Removes your plans, recorded changes and check-ins from this browser and starts from the built-in values. The previous version keeps its own copy.</p>
        {resetDone && !confirmReset && <p role="status" className="status-ok">Started again with the built-in values.</p>}
        {!confirmReset ? (
          <div><button type="button" className="btn danger" onClick={() => { setConfirmReset(true); setResetDone(false); }}>Start again</button></div>
        ) : (
          <div className="confirm" role="alertdialog" aria-labelledby="reset-title">
            <strong id="reset-title">Remove all your data from this browser?</strong>
            <span className="muted small">This cannot be undone unless you have a backup file.</span>
            <div className="actions">
              <button type="button" className="btn danger" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); setMessage(null); setPending(null); setResetDone(true); }}>Remove and start again</button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="classic">
        <h2 className="card-title" id="classic">The previous version</h2>
        <p className="muted">The original single-page planner stays available while the new app is finished.</p>
        <div>
          <a className="btn" href="classic/index.html">Open the previous version</a>
        </div>
      </section>
    </div>
  );
}
