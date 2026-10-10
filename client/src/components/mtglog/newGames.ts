import type { Game } from './GameList';

/** ID delle partite già viste nella pagina Partite, salvati su questo telefono. */
const SEEN_KEY = 'mtglog:seenGames';
const MAX_SEEN = 1000;

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return null;
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) ? new Set(ids.filter((id): id is string => typeof id === 'string')) : null;
  } catch {
    return null;
  }
}

/** Segna come viste tutte le partite attuali (si chiama quando si apre l'elenco Partite). */
export function markGamesSeen(games: readonly Game[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(games.map((g) => g.id).slice(-MAX_SEEN)));
  } catch {
    /* storage non disponibile: pazienza */
  }
}

/**
 * Quante partite registrate da altri non sono ancora state viste. Al primo avvio
 * (niente elenco salvato) non c'è nulla da segnalare: si parte da quelle esistenti.
 */
export function countNewGames(games: readonly Game[], userId: string): number {
  const seen = readSeen();
  if (!seen) {
    markGamesSeen(games);
    return 0;
  }
  return games.filter((g) => !seen.has(g.id) && g.createdBy !== userId).length;
}
