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
