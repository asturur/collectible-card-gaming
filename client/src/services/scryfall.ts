/** Scryfall display cache backed by the shared exact lookup/scheduler. */
import { cacheVerifiedCard, requestScryfall, resolveScryfallNames, rawNames, type RawCard, type RawFaceImages } from './scryfallLookup';

export interface ScryFace { small: string; normal: string; art: string }
export interface ScryCard {
  name: string;
  scryfallId: string;
  oracleId: string | null;
  exactMatch: true;
  faces: ScryFace[];
  colors: string[];
  typeLine: string;
  cmc: number;
  manaCost: string;
  produced: string[];
  tokens: { id: string; name: string }[];
}
export interface ScryToken {
  id: string; name: string; typeLine: string; power: string; toughness: string;
  colors: string[]; oracle: string; art: string; normal: string;
}

// v5 did not retain IDs or exact-vs-fuzzy provenance; it cannot establish identity.
const STORAGE_KEY = 'mtg-scryfall-cache-v6';
const TOKEN_KEY = 'mtg-scryfall-tokens-v1';
const found = new Map<string, ScryCard>();
const byId = new Map<string, ScryCard>();
const missing = new Set<string>();
const pendingNames = new Set<string>();
const pendingIds = new Set<string>();
const tokensFound = new Map<string, ScryToken>();
const tokensMissing = new Set<string>();
const tokensPending = new Set<string>();
const listeners = new Set<() => void>();
let loaded = false;
let loadedTokens = false;
export const cardKey = (name: string): string => name.trim().toLowerCase();
const notify = () => listeners.forEach(l => l());

function loadStorage() {
  if (loaded) return;
  loaded = true;
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as [string, ScryCard][];
    for (const [key, card] of entries) {
      if (card.exactMatch === true && typeof card.scryfallId === 'string' &&
        Array.isArray(card.faces) && card.faces[0]?.normal && Array.isArray(card.tokens) &&
        Array.isArray(card.colors) && Array.isArray(card.produced) && typeof card.typeLine === 'string') {
        found.set(key, card); byId.set(card.scryfallId, card);
      }
    }
  } catch { /* A corrupt/blocked cache is replaceable. */ }
}
function saveStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...found.entries()].slice(-3000))); }
  catch { /* Private/full storage does not prevent lookup. */ }
}
function toFaces(raw: RawCard): ScryFace[] {
  const images = raw.image_uris ? [raw.image_uris] : (raw.card_faces ?? []).map(f => f.image_uris);
  return images.filter((u): u is RawFaceImages => !!u?.normal)
    .map(u => ({ small: u.small ?? u.normal!, normal: u.normal!, art: u.art_crop ?? u.small ?? u.normal! }));
}
function remember(raw: RawCard, requestedName?: string): ScryCard | undefined {
  const faces = toFaces(raw);
  if (!raw.id || !faces.length) return;
  const front = raw.card_faces?.[0];
  const card: ScryCard = {
    name: raw.name, scryfallId: raw.id, oracleId: raw.oracle_id ?? front?.oracle_id ?? null,
    exactMatch: true, faces, colors: raw.colors ?? front?.colors ?? [],
    typeLine: (raw.type_line ?? front?.type_line ?? '').split('//')[0].trim(),
    cmc: raw.cmc ?? 0, manaCost: raw.mana_cost || front?.mana_cost || '',
    produced: raw.produced_mana ?? [...new Set((raw.card_faces ?? []).flatMap(f => f.produced_mana ?? []))],
    tokens: (raw.all_parts ?? []).filter(p => p.component === 'token').map(p => ({ id: p.id, name: p.name })),
  };
  byId.set(raw.id, card);
  for (const name of [...rawNames(raw), ...(requestedName ? [requestedName] : [])]) {
    if (!found.has(cardKey(name))) found.set(cardKey(name), card);
    missing.delete(cardKey(name));
  }
  cacheVerifiedCard(raw, requestedName);
  return card;
}

export async function searchScryfall(query: string): Promise<ScryCard[]> {
  loadStorage();
  const result = await requestScryfall<{ data?: RawCard[] }>(
    `/cards/search?unique=cards&order=name&q=${encodeURIComponent(query + ' game:paper')}`);
  const cards = (result.data.data ?? []).slice(0, 60).map(raw => remember(raw)).filter((c): c is ScryCard => !!c);
  saveStorage(); notify();
  return cards;
}
export async function autocompleteCards(query: string): Promise<string[]> {
  const result = await requestScryfall<{ data?: string[] }>(`/cards/autocomplete?q=${encodeURIComponent(query)}`);
  return result.data.data ?? [];
}

/** Saved rows are hydrated by ID; new/unsaved entries are resolved exactly by name. */
export function requestCards(names: string[], identities: { name: string; scryfallId?: string | null }[] = []): void {
  loadStorage();
  const pinned = new Set(identities.filter(c => c.scryfallId).map(c => cardKey(c.name)));
  const ids = [...new Set(identities.map(c => c.scryfallId).filter((id): id is string => !!id))]
    .filter(id => !byId.has(id) && !pendingIds.has(id));
  for (let i = 0; i < ids.length; i += 75) {
    const chunk = ids.slice(i, i + 75);
    chunk.forEach(id => pendingIds.add(id));
    void requestScryfall<{ data?: RawCard[] }>('/cards/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }),
    }).then(result => { (result.data.data ?? []).forEach(raw => remember(raw)); saveStorage(); })
      .catch(() => { /* Transient errors are not missing identities. */ })
      .finally(() => { chunk.forEach(id => pendingIds.delete(id)); notify(); });
  }
  const todo = [...new Set(names.map(cardKey))].filter(n => n && !pinned.has(n) && !found.has(n) && !missing.has(n) && !pendingNames.has(n));
  if (!todo.length) return;
  todo.forEach(n => pendingNames.add(n));
  void resolveScryfallNames(todo).then(result => {
    for (const name of todo) {
      const raw = result.get(name);
      if (raw) remember(raw, name); else missing.add(name);
    }
    saveStorage();
  }).catch(() => { /* Keep network errors retryable; never label them unknown cards. */ })
    .finally(() => { todo.forEach(n => pendingNames.delete(n)); notify(); });
}
export function getCard(name: string, scryfallId?: string | null): ScryCard | undefined {
  loadStorage();
  return scryfallId ? byId.get(scryfallId) : found.get(cardKey(name));
}
export const isMissing = (name: string): boolean => missing.has(cardKey(name));
export function subscribeCards(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}

function loadTokens() {
  if (loadedTokens) return;
  loadedTokens = true;
  try {
    const entries = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '[]') as [string, ScryToken][];
    for (const [id, token] of entries) if (token?.normal && token.name) tokensFound.set(id, token);
  } catch { /* Replaceable cache. */ }
}
function toToken(raw: RawCard): ScryToken | undefined {
  const front = raw.card_faces?.[0];
  const img = raw.image_uris ?? front?.image_uris;
  if (!raw.id || !img?.normal) return;
  return { id: raw.id, name: raw.name.split('//')[0].trim(),
    typeLine: (raw.type_line ?? front?.type_line ?? '').split('//')[0].trim(),
    power: raw.power ?? front?.power ?? '', toughness: raw.toughness ?? front?.toughness ?? '',
    colors: raw.colors ?? front?.colors ?? [], oracle: (raw.oracle_text ?? front?.oracle_text ?? '').trim(),
    art: img.art_crop ?? img.small ?? img.normal, normal: img.normal };
}
export function requestTokens(ids: string[]): void {
  loadTokens();
  const todo = [...new Set(ids)].filter(id => id && !tokensFound.has(id) && !tokensMissing.has(id) && !tokensPending.has(id));
  for (let i = 0; i < todo.length; i += 75) {
    const chunk = todo.slice(i, i + 75); chunk.forEach(id => tokensPending.add(id));
    void requestScryfall<{ data?: RawCard[] }>('/cards/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }),
    }).then(result => {
      for (const raw of result.data.data ?? []) { const token = toToken(raw); if (token) tokensFound.set(token.id, token); }
      chunk.forEach(id => { if (!tokensFound.has(id)) tokensMissing.add(id); });
      try { localStorage.setItem(TOKEN_KEY, JSON.stringify([...tokensFound.entries()].slice(-1500))); } catch { /* Optional cache. */ }
    }).catch(() => { /* Network errors remain retryable. */ })
      .finally(() => { chunk.forEach(id => tokensPending.delete(id)); notify(); });
  }
}
export function getToken(id: string): ScryToken | undefined { loadTokens(); return tokensFound.get(id); }
