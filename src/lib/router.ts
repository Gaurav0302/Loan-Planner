import { useEffect, useState } from 'react';

/** Screens, addressed by hash (#/plans) so the app works from any folder on GitHub Pages. */
export const ROUTES = ['dashboard', 'plans', 'edit', 'record', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'dashboard';
}

export function href(route: Route): string {
  return `#/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
