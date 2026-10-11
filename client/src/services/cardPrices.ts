/** Prezzi delle carte da Scryfall: euro (Cardmarket) e dollari (TCGplayer), per stampa. */
import { requestScryfall, type RawCard } from './scryfallLookup';

export interface CardPrice {
  /** Prezzo di una copia in euro, null se Scryfall non lo conosce. */
  eur: number | null;
  usd: number | null;
  /** Pagina della carta su Cardmarket, se Scryfall la fornisce. */
  cardmarket: string | null;
  /** Quando il prezzo è stato letto (millisecondi). */
  at: number;
}

const STORAGE_KEY = 'mtg-scryfall-prices-v1';
/** Scryfall aggiorna i prezzi una volta al giorno: oltre, si rileggono. */
export const PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const prices = new Map<string, CardPrice>();
const pending = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let loaded = false;
const notify = () => listeners.forEach((l) => l());

function amount(value: string | null | undefined): number | null {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Prezzo della stampa normale (non foil). Solo se la stampa esiste unicamente
 * foil o etched, quello è il suo unico prezzo e si usa quello.
 */
export function priceFromRaw(raw: Pick<RawCard, 'prices' | 'finishes' | 'purchase_uris'>, at: number): CardPrice {
  const p = raw.prices ?? {};
  const foilOnly = raw.finishes !== undefined && !raw.finishes.includes('nonfoil');
  return {
    eur: foilOnly ? amount(p.eur_foil) : amount(p.eur),
    usd: foilOnly ? amount(p.usd_foil) ?? amount(p.usd_etched) : amount(p.usd),
    cardmarket: raw.purchase_uris?.cardmarket ?? null,
    at,
  };
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as [string, CardPrice][];
    for (const [id, price] of entries) if (typeof price?.at === 'number') prices.set(id, price);
  } catch { /* Una cache rovinata si ricostruisce. */ }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...prices.entries()].slice(-3000))); }
  catch { /* Storage pieno o privato: i prezzi si rileggono. */ }
}

const isFresh = (price: CardPrice | undefined, now: number) => !!price && now - price.at < PRICE_MAX_AGE_MS;

/** Registra il prezzo di una carta appena letta da Scryfall (anche da altre richieste). */
export function rememberPrice(raw: RawCard, at = Date.now()) {
  load();
  prices.set(raw.id, priceFromRaw(raw, at));
  failed.delete(raw.id);
}

/** Prezzo noto e non più vecchio di un giorno, se c'è. */
export function getPrice(scryfallId: string, now = Date.now()): CardPrice | undefined {
  load();
  const price = prices.get(scryfallId);
  return isFresh(price, now) ? price : undefined;
}

export const isPricePending = (scryfallId: string) => pending.has(scryfallId);
/** La lettura del prezzo non è riuscita (rete, Scryfall): si riprova alla prossima richiesta. */
export const isPriceFailed = (scryfallId: string) => failed.has(scryfallId);

/** Chiede a Scryfall i prezzi mancanti o vecchi, 75 carte per richiesta (limite di /cards/collection). */
export function requestPrices(scryfallIds: string[], now = Date.now()): void {
  load();
  const todo = [...new Set(scryfallIds)].filter((id) => id && !pending.has(id) && !isFresh(prices.get(id), now));
  if (!todo.length) return;
  for (let i = 0; i < todo.length; i += 75) {
    const chunk = todo.slice(i, i + 75);
    chunk.forEach((id) => { pending.add(id); failed.delete(id); });
    void requestScryfall<{ data?: RawCard[] }>('/cards/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
    }).then((result) => {
      const at = Date.now();
      (result.data.data ?? []).forEach((raw) => rememberPrice(raw, at));
      // Una stampa che Scryfall non restituisce non ha prezzo: lo si ricorda come "senza prezzo".
      chunk.filter((id) => !isFresh(prices.get(id), at)).forEach((id) => prices.set(id, { eur: null, usd: null, cardmarket: null, at }));
      save();
    }).catch(() => { chunk.forEach((id) => failed.add(id)); })
      .finally(() => { chunk.forEach((id) => pending.delete(id)); notify(); });
  }
  notify();
}

export function subscribePrices(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
