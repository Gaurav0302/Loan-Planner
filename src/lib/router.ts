import { useEffect, useState } from 'react';

/** Screens, addressed by hash (#/plans, #/edit/<plan id>) so the app works from any folder on GitHub Pages. */
export const ROUTES = ['dashboard', 'plans', 'edit', 'record', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

export interface Location {
  route: Route;
  /** Second path segment, e.g. the plan id in #/edit/<id>. */
  param?: string;
}

function parse(hash: string): Location {
  const [name, param] = hash.replace(/^#\/?/, '').split('?')[0].split('/');
  const route = (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'dashboard';
  return param ? { route, param: decodeURIComponent(param) } : { route };
}

export function href(route: Route, param?: string): string {
  return param ? `#/${route}/${encodeURIComponent(param)}` : `#/${route}`;
}

export function navigate(route: Route, param?: string): void {
  window.location.hash = href(route, param);
}

export function useLocation(): Location {
  const [loc, setLoc] = useState<Location>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setLoc(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return loc;
}
