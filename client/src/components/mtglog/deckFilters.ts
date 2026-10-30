import type { ScryCard } from '../../services/scryfall';

/** Filtri della lista mazzi oltre ai colori: vuoto = non attivo. */
export interface DeckFilters {
  /** Parte del nome di una carta (es. "sol ring"). */
  card: string;
  /** Parole chiave di Scryfall, in inglese (es. "Madness"). */
  keywords: string[];
  /** Con più parole chiave: il mazzo deve averle tutte, o almeno una. */
  keywordMode: KeywordMode;
  /** Parte del testo delle regole, in inglese (es. "draw a card"). */
  text: string;
}

export type KeywordMode = 'all' | 'any';

export const NO_DECK_FILTERS: DeckFilters = { card: '', keywords: [], keywordMode: 'all', text: '' };

/** Carta di un mazzo salvato, quanto basta per filtrare. */
export interface FilterCard {
  name: string;
  scryfallId?: string | null;
}

export type CardLookup = (name: string, scryfallId?: string | null) => ScryCard | undefined;

const norm = (s: string) => s.trim().toLowerCase();

/** Un filtro per ogni chip in pagina: nome carta, ogni parola chiave, testo. */
export const activeFilterCount = (f: DeckFilters) => [f.card, f.text].filter((v) => v.trim()).length + f.keywords.length;

/** Parola chiave e testo servono i dati Scryfall delle carte; il nome carta no. */
export const needsCardData = (f: DeckFilters) => Boolean(f.keywords.length || f.text.trim());

/** Una riga per carta, anche se il mazzo la elenca più volte (Main e Side, stampe diverse). */
function uniqueCards(cards: FilterCard[]): FilterCard[] {
  const seen = new Map<string, FilterCard>();
  for (const c of cards) if (!seen.has(norm(c.name))) seen.set(norm(c.name), c);
  return [...seen.values()];
}

export interface DeckMatch {
  ok: boolean;
  /** Perché il mazzo è nella lista, una voce per filtro attivo (es. "Madness ×3"). */
  notes: string[];
}

/**
 * Il mazzo resta se soddisfa TUTTI i filtri attivi. Le carte non ancora arrivate da
 * Scryfall non contano per parola chiave e testo (risultati parziali finché caricano).
 */
export function matchDeck(cards: FilterCard[], filters: DeckFilters, lookup: CardLookup): DeckMatch {
  const list = uniqueCards(cards);
  const notes: string[] = [];
  const card = norm(filters.card);
  if (card) {
    const hits = list.filter((c) => norm(c.name).includes(card));
    if (!hits.length) return { ok: false, notes: [] };
    notes.push(hits.length === 1 ? hits[0].name : `${hits[0].name} +${hits.length - 1}`);
  }
  if (filters.keywords.length) {
    const counts = filters.keywords.map((keyword) => ({
      keyword,
      n: list.filter((c) => lookup(c.name, c.scryfallId)?.keywords?.some((k) => norm(k) === norm(keyword))).length,
    }));
    const found = counts.filter((k) => k.n > 0);
    const ok = filters.keywordMode === 'all' ? found.length === counts.length : found.length > 0;
    if (!ok) return { ok: false, notes: [] };
    notes.push(...found.map((k) => `${k.keyword} ×${k.n}`));
  }
  const text = norm(filters.text);
  if (text) {
    const n = list.filter((c) => norm(lookup(c.name, c.scryfallId)?.oracle ?? '').includes(text)).length;
    if (!n) return { ok: false, notes: [] };
    notes.push(`«${filters.text.trim()}» in ${n} ${n === 1 ? 'carta' : 'carte'}`);
  }
  return { ok: true, notes };
}

/** Nomi delle carte di tutti i mazzi, per i suggerimenti del campo "Nome carta". */
export function allCardNames(decks: FilterCard[][]): string[] {
  return uniqueCards(decks.flat()).map((c) => c.name).sort((a, b) => a.localeCompare(b, 'en'));
}

/** Parole chiave presenti nei mazzi, con in quanti mazzi compaiono. */
export function keywordsInDecks(decks: FilterCard[][], lookup: CardLookup): { keyword: string; decks: number }[] {
  const tally = new Map<string, { keyword: string; decks: number }>();
  for (const deck of decks) {
    const inDeck = new Map<string, string>();
    for (const c of uniqueCards(deck)) for (const k of lookup(c.name, c.scryfallId)?.keywords ?? []) inDeck.set(norm(k), k);
    for (const [key, k] of inDeck) {
      const t = tally.get(key) ?? { keyword: k, decks: 0 };
      t.decks++;
      tally.set(key, t);
    }
  }
  return [...tally.values()].sort((a, b) => a.keyword.localeCompare(b.keyword, 'en'));
}

/** Quante carte diverse dei mazzi hanno già i dati Scryfall (per mostrare l'avanzamento). */
export function cardDataProgress(decks: FilterCard[][], lookup: CardLookup, isMissing: (name: string) => boolean): { ready: number; total: number } {
  const list = uniqueCards(decks.flat());
  return { ready: list.filter((c) => lookup(c.name, c.scryfallId)?.oracle !== undefined || isMissing(c.name)).length, total: list.length };
}
