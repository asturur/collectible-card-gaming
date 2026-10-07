import type { MouseEvent } from 'react';

/** Paths are relative to the Vite base; React Router supplies the basename. */
export const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
export const paths = {
  home: '/',
  zaff: '/zaff',
  games: '/games',
  newGame: '/games/new',
  game: (id: string) => `/games/${encodeURIComponent(id)}`,
  editGame: (id: string) => `/games/${encodeURIComponent(id)}/edit`,
  rematch: (id: string) => `/games/${encodeURIComponent(id)}/rematch`,
  decks: '/decks',
  newDeck: '/decks/new',
  deck: (id: string) => `/decks/${encodeURIComponent(id)}`,
  savedDeckStats: (id: string) => `/decks/${encodeURIComponent(id)}/stats`,
  editDeck: (id: string) => `/decks/${encodeURIComponent(id)}/edit`,
  stats: '/stats',
  deckStats: '/stats/decks',
  playerStats: '/stats/players',
  player: (name: string) => `/stats/players/${encodeURIComponent(name)}`,
  matchups: '/stats/matchups',
  matchup: (names: readonly string[]) => `/stats/matchups/${names.map(encodeURIComponent).join('/vs/')}`,
  more: '/more',
  players: '/players',
} as const;

/** Decode each name once, before interpreting it as app data. Keeping the raw
 * path here preserves names containing slashes, "vs", or literal "%2F" text. */
function decodeStatsNames(pathname: string, base: string, separator: string): string[] | null {
  if (!pathname.toLowerCase().startsWith(`${base}/`)) return null;
  const segments = pathname.slice(base.length + 1).replace(/\/+$/, '').split(separator);
  if (segments.some(name => !name || name.includes('/'))) return null;
  try { return segments.map(name => decodeURIComponent(name)); }
  catch { return null; }
}

export function playerNameFromPath(pathname: string): string | null {
  const names = decodeStatsNames(pathname, paths.playerStats, '/');
  return names?.length === 1 ? names[0] : null;
}

export function matchupNamesFromPath(pathname: string): string[] | null {
  const names = decodeStatsNames(pathname, paths.matchups, '/vs/');
  return names && names.length >= 2 && names.every(name => name.trim()) && new Set(names.map(name => name.trim())).size === names.length ? names : null;
}

/** Absolute hrefs for share links and screens usable outside a router. */
export function hrefFor(route: 'home' | 'zaff'): string {
  return appHref(paths[route]);
}

export function appHref(path: string): string {
  return `${ROUTER_BASE === '/' ? '' : ROUTER_BASE}${path}`;
}

/**
 * Props per un `<a>` che porta a un'altra pagina dell'app: resta un link vero
 * (apribile in una scheda nuova, copiabile), ma il click normale non ricarica.
 */
export function navLinkProps(route: 'home' | 'zaff', onNavigate: () => void) {
  return {
    href: hrefFor(route),
    onClick(e: MouseEvent<HTMLAnchorElement>) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onNavigate();
    },
  };
}
