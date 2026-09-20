/** Calcoli e utilità condivise fra classifica in testata, storico e statistiche. */

import type { Game } from './GameList';

export interface TallyRow {
  name: string;
  g: number;
  w: number;
}

export const PIE_COLORS = ['#9E7A31', '#2C6FA8', '#AF3A2C', '#2E7A4E', '#4B3F57', '#8B857A', '#6B4E9E', '#C9762E'];

/** Partite giocate e vinte per ciascun giocatore, dalle più vinte in giù. */
export function computeTally(list: Game[]): TallyRow[] {
  const tally: Record<string, TallyRow> = {};
  list.forEach((game) =>
    game.players.forEach((p) => {
      tally[p.name] = tally[p.name] || { name: p.name, g: 0, w: 0 };
      tally[p.name].g++;
      if (p.winner) tally[p.name].w++;
    })
  );
  return Object.values(tally).sort((a, b) => b.w - a.w || b.g - a.g);
}

/** Dal rosso (peggior percentuale del gruppo) al verde (la migliore). */
export function pctColor(pct: number, min: number, max: number): string {
  const t = max === min ? 1 : (pct - min) / (max - min);
  return `hsl(${Math.round(t * 120)}, 65%, 45%)`;
}

export function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toXY = (deg: number): [number, number] => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startDeg);
  const [x2, y2] = toXY(endDeg);
  const big = endDeg - startDeg > 180 ? 1 : 0;
  if (endDeg - startDeg >= 359.9) {
    return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
  }
  return `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${big},1 ${x2},${y2} Z`;
}

export function dateLabel(iso: string): string {
  if (!iso) return 'Senza data';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export interface MatchupPlayerRow {
  name: string;
  w: number;
}

export interface MatchupRow {
  /** Chiave stabile per React/selezione: nomi ordinati e uniti da "|". */
  key: string;
  /** Etichetta da mostrare: nomi uniti da " vs ", nello stesso ordine della chiave. */
  label: string;
  games: number;
  players: MatchupPlayerRow[];
}

/**
 * Raggruppa le partite per combinazione esatta di giocatori che vi hanno preso
 * parte (2 o più, l'ordine non conta), e calcola partite totali e vittorie per
 * ciascuno. Una combinazione compare solo se è stata davvero giocata: niente
 * voci a zero per accoppiamenti mai avvenuti.
 */
export function computeMatchups(list: Game[]): MatchupRow[] {
  const byKey = new Map<string, { names: string[]; games: number; wins: Record<string, number> }>();

  list.forEach((game) => {
    const names = [...new Set(game.players.map((p) => p.name.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    if (names.length < 2) return;

    const key = names.join('|');
    const entry = byKey.get(key) ?? { names, games: 0, wins: {} };
    entry.games += 1;
    game.players.forEach((p) => {
      const name = p.name.trim();
      if (name && p.winner) entry.wins[name] = (entry.wins[name] ?? 0) + 1;
    });
    byKey.set(key, entry);
  });

  return [...byKey.values()]
    .map((entry) => ({
      key: entry.names.join('|'),
      label: entry.names.join(' vs '),
      games: entry.games,
      players: entry.names.map((name) => ({ name, w: entry.wins[name] ?? 0 })),
    }))
    .sort((a, b) => b.games - a.games || a.label.localeCompare(b.label));
}

/** Riga di una partita letta da Supabase, normalizzata nel tipo `Game`. */
export function rowToGame(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    date: (row.date as string) ?? '',
    format: (row.format as string) ?? '',
    notes: (row.notes as string) ?? '',
    players: (row.players as Game['players']) ?? [],
    group: (row.gruppo as string) ?? 'Generale',
    createdBy: (row.created_by as string) ?? null,
  };
}
