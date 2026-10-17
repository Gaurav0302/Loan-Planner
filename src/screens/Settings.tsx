import { PageHeader } from '../components/PageHeader';
import type { Theme } from '../lib/theme';

interface Props {
  theme: Theme;
  onTheme: (t: Theme) => void;
}

export function Settings({ theme, onTheme }: Props) {
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
        <p className="muted">Everything stays in this browser. Backup to a file and restore from one arrive in phase 2.</p>
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
