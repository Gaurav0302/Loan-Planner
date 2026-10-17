import { useEffect, useRef } from 'react';
import { useStore } from './data/store';
import { useRoute } from './lib/router';
import { useTheme } from './lib/theme';
import { Dashboard } from './screens/Dashboard';
import { Placeholder } from './screens/Placeholder';
import { Settings } from './screens/Settings';
import { Shell } from './shell/Shell';

const TITLES = { dashboard: 'Dashboard', plans: 'Plans', edit: 'Edit plan', record: 'Record', settings: 'Settings' } as const;

export function App() {
  const route = useRoute();
  const [theme, setTheme] = useTheme();
  const { saved } = useStore();
  const firstRender = useRef(true);

  // Name the screen in the tab title, and move focus to the content after navigating.
  useEffect(() => {
    document.title = `${TITLES[route]} · Timbertop`;
    if (firstRender.current) { firstRender.current = false; return; }
    const main = document.getElementById('main');
    main?.scrollTo(0, 0);
    main?.querySelector<HTMLElement>('h1')?.focus();
  }, [route]);

  return (
    <Shell route={route} theme={theme} onTheme={setTheme}>
      {!saved && <p className="banner" role="alert">This browser is not letting the app save. Changes will be lost when you close the page. Use Settings to save a backup file.</p>}
      {route === 'dashboard' && <Dashboard />}
      {route === 'plans' && <Placeholder title="Plans" sub="One plan is active at a time. Edit any plan, duplicate it, or make another one active." phase={3} coming="plan cards, make active, duplicate, side-by-side comparison and the 'what if one thing changed' list." />}
      {route === 'edit' && <Placeholder title="Edit plan" sub="Loan, household, paying it down, life changes and college funds, with the result updating as you type." phase={3} coming="every setting from the current planner, with the live result panel and savings against the bank." />}
      {route === 'record' && <Placeholder title="Record" sub="Tell the app what really happened: rate changes and your statement balances." phase={4} coming="recording a change from a given month, and monthly balance check-ins that the projection restarts from." />}
      {route === 'settings' && <Settings theme={theme} onTheme={setTheme} />}
    </Shell>
  );
}
