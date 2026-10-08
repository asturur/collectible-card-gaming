/**
 * Supabase client for the MTG game log feature (registro partite).
 * Independent from the live game server: this talks directly to Supabase
 * (Postgres + Auth + Realtime), no Go/WebSocket involved.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Attese (ms) prima di ogni nuovo tentativo quando Supabase risponde "JWT issued at future". */
const CLOCK_SKEW_RETRY_DELAYS_MS = [800, 1600, 2400];

/**
 * Supabase a volte rifiuta un token appena emesso con 401 "JWT issued at future":
 * gli orologi dei suoi server hanno uno scarto di pochi secondi e passa da solo.
 * Invece di mostrare l'errore, la richiesta viene ripetuta qualche volta a breve
 * distanza. Si ripete solo quel preciso errore (la richiesta è stata rifiutata
 * prima di essere eseguita, quindi riprovarla è sicuro anche per scritture).
 */
export async function fetchWithClockSkewRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  delaysMs: number[] = CLOCK_SKEW_RETRY_DELAYS_MS
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(input, init);
    if (response.status !== 401 || attempt >= delaysMs.length) return response;
    const body = await response.clone().text().catch(() => '');
    if (!body.includes('JWT issued at future')) return response;
    await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
  }
}

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: fetchWithClockSkewRetry } })
    : null;

// Table names in the shared Supabase project (see registro-partite-mtg.html)
export const TABLE_GAMES = 'partite';
export const TABLE_PLAYERS = 'giocatori';
export const TABLE_DECKS = 'mazzi';
export const TABLE_DECK_CARDS = 'mazzi-cards';

/** Lunghezza massima di un nome giocatore: generosa per qualunque nome vero
 *  (nome e cognome, o un suffisso tipo "_B" per distinguere un omonimo). */
export const MAX_PLAYER_NAME_LENGTH = 40;

/**
 * Lunghezza massima del nome di un mazzo. Verificato sul catalogo pubblico
 * usato dall'app per importare i precon Commander (stesso filtro di
 * DeckEditor): il nome più lungo tra i 208 mazzi Commander disponibili è di
 * 59 caratteri ("Scions & Spellcraft Collector's Edition (FINAL FANTASY
 * XIV)"); 80 lascia margine anche per future uscite più verbose.
 */
export const MAX_DECK_NAME_LENGTH = 80;

/** A row is editable by its owner; legacy rows without an owner are editable by anyone. */
export function canEdit(createdBy: string | null | undefined, currentUserId: string | undefined): boolean {
  return !createdBy || createdBy === currentUserId;
}

/**
 * Confronta due nomi giocatore ignorando maiuscole/minuscole e spazi
 * iniziali/finali. Il vincolo di unicità del database su `giocatori.name`
 * è invece sensibile alle maiuscole, quindi senza questo controllo
 * "Andrea" e "andrea" potrebbero finire per sbaglio come due giocatori
 * diversi: va sempre usato prima di salvare o confrontare un nome nuovo
 * con quelli già in elenco.
 */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Nome già in elenco che corrisponde a `name` ignorando maiuscole/spazi, se c'è. */
export function findCanonicalName(existing: string[], name: string): string | undefined {
  return existing.find((n) => sameName(n, name));
}

/**
 * Due esempi di nome distinto da proporre quando due persone diverse
 * vogliono davvero chiamarsi allo stesso modo: cambiare solo
 * maiuscole/minuscole o spazi non li distingue (sameName li considera
 * ancora uguali), quindi suggerisco un suffisso vero e proprio. Se il nome
 * di base è già al limite di lunghezza, lo accorcio per lasciare posto al
 * suffisso, così il suggerimento resta sempre digitabile per intero.
 */
export function suggestAlternativeNames(base: string, maxLength: number = MAX_PLAYER_NAME_LENGTH): [string, string] {
  return (['_2', '_B'] as const).map((suffix) => {
    const room = Math.max(0, maxLength - suffix.length);
    return base.slice(0, room) + suffix;
  }) as [string, string];
}

/** Supabase rifiuta due canali con lo stesso nome: ogni sottoscrizione ne chiede uno suo. */
let channelSeq = 0;

/**
 * Sottoscrive un canale Realtime alle modifiche di una tabella e richiama
 * `onChange` per ogni evento (insert/update/delete), così più dispositivi
 * restano sincronizzati. Restituisce una funzione di cleanup.
 */
export function subscribeToTable(table: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  channelSeq += 1;
  const channel = supabase
    .channel(table + '-live-' + channelSeq)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
