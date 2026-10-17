import type { MouseEvent, ReactNode } from 'react';
import { href, type Route } from '../lib/router';
import type { Theme } from '../lib/theme';
import { Icon } from './icons';

const NAV: { route: Route; label: string; short: string }[] = [
  { route: 'dashboard', label: 'Dashboard', short: 'Today' },
  { route: 'plans', label: 'Plans', short: 'Plans' },
  { route: 'edit', label: 'Edit plan', short: 'Edit' },
  { route: 'record', label: 'Record', short: 'Record' },
  { route: 'settings', label: 'Settings', short: 'Settings' },
];

interface Props {
  route: Route;
  theme: Theme;
  onTheme: (t: Theme) => void;
  children: ReactNode;
}

export function Shell({ route, theme, onTheme, children }: Props) {
  // Navigation uses the address hash, so the skip link moves focus itself instead of linking to #main.
  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('main')?.querySelector<HTMLElement>('h1')?.focus();
  };

  return (
    <div className="shell">
      <a className="skip-link" href={href(route)} onClick={skip}>Skip to content</a>
      <nav className="side" aria-label="Main">
        <a className="brand" href={href('dashboard')} aria-label="Timbertop, go to dashboard">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span className="brand-text lbl">
            <strong>Timbertop</strong>
            <span>Loan and college</span>
          </span>
        </a>
        {NAV.map((n) => (
          <a key={n.route} className="nav-link" href={href(n.route)} aria-current={route === n.route ? 'page' : undefined} aria-label={n.label}>
            <Icon name={n.route} />
            <span className="lbl">{n.label}</span>
          </a>
        ))}
        <div className="side-spacer" />
        <span className="side-note lbl">Your data stays on this device</span>
        <div className="theme-switch" role="group" aria-label="Theme">
          <button type="button" aria-pressed={theme === 'light'} aria-label="Light theme" onClick={() => onTheme('light')}>
            <Icon name="sun" size={16} />
            <span className="lbl">Light</span>
          </button>
          <button type="button" aria-pressed={theme === 'dark'} aria-label="Dark theme" onClick={() => onTheme('dark')}>
            <Icon name="moon" size={16} />
            <span className="lbl">Dark</span>
          </button>
        </div>
      </nav>

      <main className="main" id="main">
        {children}
      </main>

      <nav className="bottomnav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.route} className="tab-link" href={href(n.route)} aria-current={route === n.route ? 'page' : undefined}>
            <Icon name={n.route} size={22} />
            {n.short}
          </a>
        ))}
      </nav>
    </div>
  );
}
