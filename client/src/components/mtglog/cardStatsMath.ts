import type { Game } from './GameList';
import { makeDeckResolver } from './deckRefs';
import { MIN_GAMES } from './stats';

export { MIN_GAMES };
/** Quante righe mostrare in ogni classifica. */
export const TOP = 10;
/** Firme: partite minime del giocatore (con mazzo salvato) e quota minima delle sue partite con la carta. */
export const SIGNATURE_MIN_GAMES = 3;
export const SIGNATURE_MIN_SHARE = 0.5;

export type Period = 'all' | '30' | 'year';

/** Partita dentro il periodo scelto (stessa regola di Partite Salvate). */
export function inPeriod(date: string, period: Period, now = new Date()): boolean {
  if (period === '30') return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (period === 'year') return date >= `${now.getFullYear()}-01-01`;
  return true;
}

/** Una carta di un mazzo salvato, quanto basta per le statistiche. */
export interface StatsCard {
  name: string;
  qty: number;
  section?: string;
  typeLine?: string | null;
  scryfallId?: string | null;
}
export interface StatsDeck {
  id: string;
  name: string;
  cards: StatsCard[];
}

export interface CardRow {
  /** Nome normalizzato: stampe diverse della stessa carta sono la stessa riga. */
  key: string;
  name: string;
  scryfallId: string | null;
  /** Copie giocate in tutto (copie × partite) e partite in cui c'era. */
  copies: number;
  games: number;
  wins: number;
  /** Mazzi diversi che la contengono. */
  decks: number;
  pct: number;
}

/** Carta "maledetta": quante vittorie le mancano rispetto alla media del gruppo. */
export interface CursedRow extends CardRow {
  /** Vittorie attese con la media del gruppo (presenze × media) meno vittorie reali. */
  missed: number;
}

export interface SignatureRow {
  player: string;
  card: CardRow;
  /** Partite del giocatore con quella carta, partite del giocatore con lista carte. */
  games: number;
  playerGames: number;
  /** Percentuale delle partite degli altri giocatori in cui c'era la stessa carta. */
  othersPct: number;
}

export interface ColorRow {
  color: 'W' | 'U' | 'B' | 'R' | 'G';
  games: number;
  wins: number;
  pct: number;
}

export interface CardStats {
  /** Partite nel filtro e quante di queste hanno almeno un mazzo con lista carte. */
  games: number;
  gamesWithLists: number;
  /** Percentuale di vittoria media di una presenza (1 su N giocatori). */
  average: number;
  /** Stessa media, ma sulle presenze con i colori del mazzo segnati: il riferimento di Colori. */
  colorsAverage: number;
  played: CardRow[];
  winners: CardRow[];
  losers: CardRow[];
  staples: CardRow[];
  cursed: CursedRow[];
  signatures: SignatureRow[];
  colors: ColorRow[];
}

const cardKey = (name: string) => name.trim().toLowerCase();
const pct = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0);
/** Le terre (anche quelle speciali) non contano: solo la faccia davanti decide. */
const isLand = (c: StatsCard) => /\bLand\b/.test((c.typeLine ?? '').split('//')[0]);

/**
 * Statistiche per carta sulle partite già filtrate: solo Main Deck, niente terre,
 * stampe unite per nome. Le carte vengono dalle liste ATTUALI dei mazzi salvati.
 * "Più giocate" conta le copie; vittorie e sconfitte contano la presenza.
 */
export function computeCardStats(games: Game[], decks: StatsDeck[]): CardStats {
  const resolve = makeDeckResolver(decks);
  const byId = new Map(decks.map((d) => [d.id, d]));
  const rows = new Map<string, CardRow & { deckIds: Set<string> }>();
  /** Per le firme: giocatore → partite con lista e partite per carta. */
  const perPlayer = new Map<string, { games: number; cards: Map<string, number> }>();
  const colorTally = new Map<ColorRow['color'], { games: number; wins: number }>();
  let participations = 0;
  let wins = 0;
  let colorParticipations = 0;
  let colorWins = 0;
  let gamesWithLists = 0;

  for (const game of games) {
    let withList = false;
    for (const p of game.players) {
      // La media di Colori conta ogni giocatore una volta, anche se il mazzo ha più colori.
      if ((p.colors ?? []).some((color) => ['W', 'U', 'B', 'R', 'G'].includes(color))) {
        colorParticipations++;
        if (p.winner) colorWins++;
      }
      for (const color of p.colors ?? []) {
        if (!['W', 'U', 'B', 'R', 'G'].includes(color)) continue;
        const t = colorTally.get(color as ColorRow['color']) ?? { games: 0, wins: 0 };
        t.games++;
        if (p.winner) t.wins++;
        colorTally.set(color as ColorRow['color'], t);
      }
      const ref = resolve(p);
      const deck = ref?.id ? byId.get(ref.id) : undefined;
      if (!deck) continue;
      withList = true;
      participations++;
      if (p.winner) wins++;
      const player = perPlayer.get(p.name) ?? { games: 0, cards: new Map<string, number>() };
      player.games++;
      perPlayer.set(p.name, player);
      // Una riga per carta anche se il mazzo la elenca più volte (stampe diverse).
      const inDeck = new Map<string, { card: StatsCard; qty: number }>();
      for (const c of deck.cards) {
        if (c.section === 'side' || isLand(c)) continue;
        const key = cardKey(c.name);
        const entry = inDeck.get(key) ?? { card: c, qty: 0 };
        entry.qty += c.qty;
        inDeck.set(key, entry);
      }
      for (const [key, { card, qty }] of inDeck) {
        const row = rows.get(key) ?? {
          key, name: card.name, scryfallId: card.scryfallId ?? null,
          copies: 0, games: 0, wins: 0, decks: 0, pct: 0, deckIds: new Set<string>(),
        };
        row.copies += qty;
        row.games++;
        if (p.winner) row.wins++;
        row.deckIds.add(deck.id);
        rows.set(key, row);
        player.cards.set(key, (player.cards.get(key) ?? 0) + 1);
      }
    }
    if (withList) gamesWithLists++;
  }

  const all: CardRow[] = [...rows.values()].map(({ deckIds, ...r }) => ({ ...r, decks: deckIds.size, pct: pct(r.wins, r.games) }));
  const byName = (a: CardRow, b: CardRow) => a.name.localeCompare(b.name, 'it');
  const ranked = all.filter((r) => r.games >= MIN_GAMES);
  // Maledette: le vittorie che mancano rispetto alla media, solo le carte sotto la media.
  // Il confronto sul numeratore intero evita che una carta esattamente nella media entri per arrotondamento.
  const cursed: CursedRow[] = participations === 0 ? [] : ranked
    .filter((r) => r.games * wins > r.wins * participations)
    .map((r) => ({ ...r, missed: (r.games * wins) / participations - r.wins }));

  const signatures: SignatureRow[] = [];
  for (const [player, mine] of perPlayer) {
    if (mine.games < SIGNATURE_MIN_GAMES) continue;
    const othersGames = participations - mine.games;
    let best: SignatureRow | null = null;
    let bestScore = -Infinity;
    for (const [key, count] of mine.cards) {
      const row = rows.get(key)!;
      const othersCount = row.games - count;
      const myShare = count / mine.games;
      const othersShare = othersGames ? othersCount / othersGames : 0;
      // La carta che usa spesso e che gli altri usano poco (Sol Ring, che usano tutti, non la caratterizza).
      const score = myShare - othersShare;
      if (myShare >= SIGNATURE_MIN_SHARE && (score > bestScore || (score === bestScore && best && row.name.localeCompare(best.card.name, 'it') < 0))) {
        bestScore = score;
        best = { player, card: all.find((r) => r.key === key)!, games: count, playerGames: mine.games, othersPct: Math.round(othersShare * 100) };
      }
    }
    if (best) signatures.push(best);
  }

  return {
    games: games.length,
    gamesWithLists,
    average: pct(wins, participations),
    colorsAverage: pct(colorWins, colorParticipations),
    played: [...all].sort((a, b) => b.copies - a.copies || b.games - a.games || byName(a, b)).slice(0, TOP),
    winners: [...ranked].sort((a, b) => b.pct - a.pct || b.games - a.games || byName(a, b)).slice(0, TOP),
    losers: [...ranked].sort((a, b) => a.pct - b.pct || b.games - a.games || byName(a, b)).slice(0, TOP),
    staples: all.filter((r) => r.decks >= 2).sort((a, b) => b.decks - a.decks || b.games - a.games || byName(a, b)).slice(0, TOP),
    cursed: cursed.sort((a, b) => b.missed - a.missed || b.games - a.games || byName(a, b)).slice(0, TOP),
    signatures: signatures.sort((a, b) => a.player.localeCompare(b.player, 'it')),
    colors: [...colorTally].map(([color, t]) => ({ color, games: t.games, wins: t.wins, pct: pct(t.wins, t.games) }))
      .sort((a, b) => b.pct - a.pct || b.games - a.games),
  };
}
