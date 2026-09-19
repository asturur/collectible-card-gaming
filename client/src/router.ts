import { useCallback, useEffect, useState, type MouseEvent } from 'react';

/**
 * Router minimale: l'app ha due pagine e l'indirizzo le distingue, così un
 * refresh (o un link condiviso) riapre la pagina giusta.
 *
 *   /collectible-card-gaming/       → registro partite (home)
 *   /collectible-card-gaming/zaff   → piattaforma di gioco ZAFF
 *
 * Su GitHub Pages l'indirizzo profondo funziona grazie al 404.html generato
 * dalla build (vedi vite.config.ts), che è una copia di index.html.
 */
export type Route = 'home' | 'zaff';

/** `import.meta.env.BASE_URL` è '/collectible-card-gaming/' in build, '/' nei test. */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function routeFromPath(pathname: string = window.location.pathname): Route {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return rest.replace(/^\/+|\/+$/g, '') === 'zaff' ? 'zaff' : 'home';
}

export function hrefFor(route: Route): string {
  return route === 'zaff' ? `${BASE}/zaff` : `${BASE}/`;
}

/** Pagina corrente + funzione per cambiarla (aggiorna anche la cronologia). */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => routeFromPath());

  useEffect(() => {
    function onPopState() {
      setRoute(routeFromPath());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (routeFromPath() !== next) window.history.pushState(null, '', hrefFor(next));
    setRoute(next);
  }, []);

  return [route, navigate];
}

/**
 * Props per un `<a>` che porta a un'altra pagina dell'app: resta un link vero
 * (apribile in una scheda nuova, copiabile), ma il click normale non ricarica.
 */
export function navLinkProps(route: Route, onNavigate: () => void) {
  return {
    href: hrefFor(route),
    onClick(e: MouseEvent<HTMLAnchorElement>) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onNavigate();
    },
  };
}
