import type { CardPrice } from '../../services/cardPrices';

export interface PricedItem {
  name: string;
  qty: number;
  section?: string;
  /** Stampa della carta (salvata o risolta per nome). */
  scryfallId?: string | null;
  /** Prezzo letto; undefined se non c'è (ancora). */
  price?: CardPrice;
}

export interface ValueTotals { main: number; side: number; total: number }

export interface TopCard {
  key: string;
  name: string;
  scryfallId: string | null;
  qty: number;
  /** Euro di una copia e di tutte le copie nel mazzo. */
  unit: number;
  total: number;
}

export interface DeckValue {
  eur: ValueTotals;
  usd: ValueTotals;
  /** Carte che valgono di più nel mazzo (prezzo × copie, Main e Sideboard insieme). */
  top: TopCard[];
  /** Copie senza prezzo in euro: non entrano nel totale. */
  unpriced: number;
  /** Data del prezzo più vecchio usato (millisecondi), null se nessuno. */
  oldest: number | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Valore del mazzo: somma prezzo × copie, separando Main Deck e Sideboard. */
export function computeDeckValue(items: PricedItem[], topCount = 3): DeckValue {
  const eur = { main: 0, side: 0, total: 0 };
  const usd = { main: 0, side: 0, total: 0 };
  const byCard = new Map<string, TopCard>();
  let unpriced = 0;
  let oldest: number | null = null;
  for (const item of items) {
    const where = item.section === 'side' ? 'side' : 'main';
    const p = item.price;
    if (p) oldest = oldest === null ? p.at : Math.min(oldest, p.at);
    if (p?.usd != null) usd[where] += p.usd * item.qty;
    if (p?.eur == null) {
      unpriced += item.qty;
      continue;
    }
    eur[where] += p.eur * item.qty;
    const key = item.scryfallId || item.name.trim().toLowerCase();
    const row = byCard.get(key) ?? { key, name: item.name, scryfallId: item.scryfallId ?? null, qty: 0, unit: p.eur, total: 0 };
    row.qty += item.qty;
    row.total = round(row.unit * row.qty);
    byCard.set(key, row);
  }
  const totals = (t: typeof eur): ValueTotals => ({ main: round(t.main), side: round(t.side), total: round(t.main + t.side) });
  return {
    eur: totals(eur),
    usd: totals(usd),
    top: [...byCard.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it')).slice(0, topCount),
    unpriced,
    oldest,
  };
}

/** "1.234,50": due decimali e punto delle migliaia sempre, anche con quattro cifre
 *  (la formattazione italiana del browser lo omette sotto le 10.000). */
function money(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}
export const formatEur = (n: number) => `€ ${money(n)}`;
export const formatUsd = (n: number) => `$ ${money(n)}`;
export const formatPriceDate = (at: number) => new Date(at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
