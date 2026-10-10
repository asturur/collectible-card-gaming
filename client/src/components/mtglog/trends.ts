/** Statistiche nel tempo: calcolate solo dalle partite già salvate. */

import type { Game } from './GameList';
import { makeDeckResolver, type DeckRef } from './deckRefs';

const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** "2026-10" → "Ottobre 2026". */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTH_NAMES[Number(month) - 1] ?? key} ${year}`;
}

/** "2026-10" → "Ott 26", per le etichette strette dei grafici. */
export function monthShortLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${(MONTH_NAMES[Number(month) - 1] ?? key).slice(0, 3)} ${year.slice(2)}`;
}

function monthOf(game: Game): string {
  return game.date.slice(0, 7);
}

/** Dalla più vecchia alla più recente: data, poi orario di inizio, poi id. */
function chronological(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.id.localeCompare(b.id)
  );
}

export interface MonthRow {
  /** "AAAA-MM". */
  month: string;
  games: number;
  /** Vittorie di ogni giocatore in quel mese. */
  wins: Record<string, number>;
}

/** Un mese per riga, dal primo con partite fino a `now`; i mesi vuoti restano a zero. */
export function computeMonthly(games: Game[], now: Date = new Date()): MonthRow[] {
  const dated = games.filter((g) => /^\d{4}-\d{2}/.test(g.date));
  if (dated.length === 0) return [];
  const rows = new Map<string, MonthRow>();
  for (const g of dated) {
    const key = monthOf(g);
    const row = rows.get(key) ?? { month: key, games: 0, wins: {} };
    row.games++;
    for (const p of g.players) if (p.winner) row.wins[p.name] = (row.wins[p.name] ?? 0) + 1;
    rows.set(key, row);
  }
  const keys = [...rows.keys()].sort();
  const last = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const end = keys[keys.length - 1] > last ? keys[keys.length - 1] : last;
  const result: MonthRow[] = [];
  let [year, month] = keys[0].split('-').map(Number);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    result.push(rows.get(key) ?? { month: key, games: 0, wins: {} });
    if (key >= end) break;
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}

export interface StreakRow {
  name: string;
  /** Vittorie consecutive in corso (0 se l'ultima partita è persa). */
  current: number;
  /** La serie più lunga di sempre. */
  best: number;
}

/** Serie di vittorie consecutive per giocatore, contando solo le partite a cui ha partecipato. */
export function computeStreaks(games: Game[]): StreakRow[] {
  const rows = new Map<string, StreakRow>();
  for (const g of chronological(games)) {
    for (const p of g.players) {
      const row = rows.get(p.name) ?? { name: p.name, current: 0, best: 0 };
      row.current = p.winner ? row.current + 1 : 0;
      row.best = Math.max(row.best, row.current);
      rows.set(p.name, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.best - a.best || b.current - a.current || a.name.localeCompare(b.name));
}

export interface FavoriteDeckRow {
  name: string;
  deck: string;
  games: number;
  wins: number;
}

/** Il mazzo più giocato da ciascun giocatore (a parità, quello con più vittorie). */
export function computeFavoriteDecks(games: Game[], decks: readonly DeckRef[]): FavoriteDeckRow[] {
  const resolve = makeDeckResolver(decks);
  const perPlayer = new Map<string, Map<string, FavoriteDeckRow>>();
  for (const g of games) {
    for (const p of g.players) {
      const deck = resolve(p);
      if (!deck) continue;
      const mine = perPlayer.get(p.name) ?? new Map<string, FavoriteDeckRow>();
      const row = mine.get(deck.key) ?? { name: p.name, deck: deck.name, games: 0, wins: 0 };
      row.games++;
      if (p.winner) row.wins++;
      mine.set(deck.key, row);
      perPlayer.set(p.name, mine);
    }
  }
  return [...perPlayer.values()]
    .map((mine) => [...mine.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || a.deck.localeCompare(b.deck))[0])
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
}

/** Riga di sintesi del mese in corso (o dell'ultimo mese con partite), da leggere in cima alla pagina. */
export function monthSummary(rows: MonthRow[]): string {
  const current = rows[rows.length - 1];
  if (!current) return '';
  const label = monthLabel(current.month);
  if (current.games === 0) return `${label}: ancora nessuna partita.`;
  const games = `${current.games} ${current.games === 1 ? 'partita' : 'partite'}`;
  const best = Math.max(0, ...Object.values(current.wins));
  if (best === 0) return `${label}: ${games}.`;
  const leaders = Object.entries(current.wins).filter(([, w]) => w === best).map(([n]) => n).sort();
  return `${label}: ${games}, più vittorie: ${leaders.join(' e ')} (${best}).`;
}
