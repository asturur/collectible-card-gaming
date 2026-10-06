/**
 * Client minimale di Scryfall (https://scryfall.com/docs/api) per mostrare le
 * immagini delle carte dei mazzi. Solo carte in inglese (il default di
 * Scryfall). Regole rispettate: intestazioni User-Agent/Accept, una richiesta
 * alla volta con pausa di 100 ms (limite ~10 al secondo), immagini non
 * modificate. I risultati si ricordano in memoria e nel browser (localStorage),
 * così riaprire un mazzo non rifà alcuna chiamata.
 */

export interface ScryFace {
  small: string;
  normal: string;
}

export interface ScryCard {
  name: string;
  /** Una faccia per le carte normali, due per quelle a doppia faccia. */
  faces: ScryFace[];
  /** Colori della carta (W U B R G): vuoto per incolori e terre. Per le
   *  doppie facce conta la faccia davanti. */
  colors: string[];
  /** Riga dei tipi della faccia davanti, es. "Legendary Creature — Elf". */
  typeLine: string;
}

const STORAGE_KEY = 'mtg-scryfall-cache-v2';
const MAX_STORED = 3000;
const BATCH = 75;
const PAUSE_MS = 110;

const found = new Map<string, ScryCard>();
/** Nomi non trovati in questa sessione (non salvati: se il nome viene
 *  corretto o Scryfall cambia, al prossimo avvio si riprova). */
const missing = new Set<string>();
const listeners = new Set<() => void>();
let loadedStorage = false;

export function cardKey(name: string): string {
  return name.trim().toLowerCase();
}

function loadStorage() {
  if (loadedStorage) return;
  loadedStorage = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as [string, ScryCard][];
    entries.forEach(([k, v]) => {
      if (v && Array.isArray(v.faces) && v.faces.length > 0 && Array.isArray(v.colors) && typeof v.typeLine === 'string') {
        found.set(k, v);
      }
    });
  } catch {
    /* cache assente o rovinata: si riparte da vuoto */
  }
}

function saveStorage() {
  try {
    const entries = [...found.entries()].slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* spazio finito o storage bloccato (navigazione privata): pazienza */
  }
}

interface RawFaceImages {
  small?: string;
  normal?: string;
}

interface RawCard {
  name: string;
  image_uris?: RawFaceImages;
  colors?: string[];
  type_line?: string;
  card_faces?: { name?: string; image_uris?: RawFaceImages; colors?: string[]; type_line?: string }[];
}

function toFaces(raw: RawCard): ScryFace[] {
  // Carte normali (e split/aftermath/adventure): immagine unica in cima.
  if (raw.image_uris?.small && raw.image_uris?.normal) {
    return [{ small: raw.image_uris.small, normal: raw.image_uris.normal }];
  }
  // Doppia faccia (transform, modal DFC…): un'immagine per faccia.
  return (raw.card_faces ?? [])
    .map((f) => f.image_uris)
    .filter((u): u is RawFaceImages => !!u?.small && !!u?.normal)
    .map((u) => ({ small: u.small as string, normal: u.normal as string }));
}

function toCard(raw: RawCard): ScryCard | null {
  const faces = toFaces(raw);
  if (faces.length === 0) return null;
  const front = raw.card_faces?.[0];
  return {
    name: raw.name,
    faces,
    colors: raw.colors ?? front?.colors ?? [],
    typeLine: (raw.type_line ?? front?.type_line ?? '').split('//')[0].trim(),
  };
}

/** Le chiavi sotto cui una carta risolta può essere cercata: nome completo
 *  ("Fire // Ice") e nome di ogni faccia ("Fire", "Ice"). */
function keysFor(raw: RawCard): string[] {
  const keys = [cardKey(raw.name)];
  raw.name.split('//').forEach((part) => keys.push(cardKey(part)));
  (raw.card_faces ?? []).forEach((f) => f.name && keys.push(cardKey(f.name)));
  return [...new Set(keys)];
}

let chain: Promise<void> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MAX_FUZZY = 25;

async function fetchFuzzy(name: string): Promise<RawCard | null> {
  try {
    const res = await fetch('https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(name), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as RawCard;
  } catch {
    return null;
  }
}

/** Ricerca per nome (anche parziale) per il selettore carte con immagini.
 *  Passa dalla stessa coda delle altre richieste, quindi rispetta il limite. */
export function searchScryfall(query: string): Promise<ScryCard[]> {
  loadStorage();
  const task = async (): Promise<ScryCard[]> => {
    try {
      const url =
        'https://api.scryfall.com/cards/search?unique=cards&order=name&q=' + encodeURIComponent(query + ' game:paper');
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 404) return []; // nessun risultato
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = (await res.json()) as { data?: RawCard[] };
      const out: ScryCard[] = [];
      (json.data ?? []).slice(0, 60).forEach((raw) => {
        const card = toCard(raw);
        if (!card) return;
        keysFor(raw).forEach((k) => found.set(k, card));
        out.push(card);
      });
      saveStorage();
      return out;
    } finally {
      await sleep(PAUSE_MS);
    }
  };
  const result = chain.then(task);
  chain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function fetchBatch(names: string[]): Promise<void> {
  try {
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: names.map((name) => ({ name })) }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = (await res.json()) as { data?: RawCard[] };
    (json.data ?? []).forEach((raw) => {
      const card = toCard(raw);
      if (!card) return;
      keysFor(raw).forEach((k) => found.set(k, card));
    });
    // Quello che non è tornato indietro: si riprova una per una con la
    // ricerca "approssimata" di Scryfall (accetta piccoli errori di
    // battitura, accenti, "Fire/Ice"…); se nemmeno lei lo trova, è un nome
    // sbagliato.
    const notFound = names.filter((n) => !found.has(cardKey(n)));
    for (const n of notFound.slice(0, MAX_FUZZY)) {
      await sleep(PAUSE_MS);
      const raw = await fetchFuzzy(n);
      const card = raw ? toCard(raw) : null;
      if (raw && card) {
        keysFor(raw).forEach((k) => found.set(k, card));
        found.set(cardKey(n), card);
      }
    }
    names.forEach((n) => {
      if (!found.has(cardKey(n))) missing.add(cardKey(n));
    });
    saveStorage();
  } catch {
    // Errore di rete o limite: niente "non trovato", si riproverà alla
    // prossima apertura (le carte restano grigie nel frattempo).
  }
}

/** Chiede a Scryfall le carte che non conosciamo ancora (a gruppi di 75, in
 *  coda, con pausa tra una richiesta e l'altra) e avvisa chi ascolta. */
export function requestCards(names: string[]): void {
  loadStorage();
  const todo = [...new Set(names.map(cardKey))].filter((k) => k && !found.has(k) && !missing.has(k));
  if (todo.length === 0) return;

  // Per la richiesta serve il nome com'è scritto, non la chiave minuscola.
  const original = new Map<string, string>();
  names.forEach((n) => original.set(cardKey(n), n.trim()));

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH).map((k) => original.get(k) ?? k);
    chain = chain.then(async () => {
      await fetchBatch(chunk);
      listeners.forEach((l) => l());
      await sleep(PAUSE_MS);
    });
  }
}

export function getCard(name: string): ScryCard | undefined {
  loadStorage();
  return found.get(cardKey(name));
}

export function isMissing(name: string): boolean {
  return missing.has(cardKey(name));
}

export function subscribeCards(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
