/** Browser-independent lookup core, shared with the off-browser backfill. */
export interface RawFaceImages { small?: string; normal?: string; art_crop?: string }
export interface RawCard {
  id: string;
  set?: string;
  collector_number?: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  flavor_name?: string;
  image_uris?: RawFaceImages;
  colors?: string[];
  type_line?: string;
  cmc?: number;
  mana_cost?: string;
  produced_mana?: string[];
  power?: string;
  toughness?: string;
  oracle_text?: string;
  all_parts?: { id: string; component: string; name: string }[];
  card_faces?: {
    name?: string; printed_name?: string; flavor_name?: string; oracle_id?: string;
    image_uris?: RawFaceImages; colors?: string[]; type_line?: string;
    mana_cost?: string; produced_mana?: string[]; power?: string; toughness?: string; oracle_text?: string;
  }[];
}

const key = (name: string) => name.trim().toLowerCase();
// Verified by the user-provided Card Kingdom page and Scryfall /cards/sld/441.
// This maps a card name, not a preferred printing; normal first-result policy applies.
export const VERIFIED_ALIASES: Readonly<Record<string, string>> = { 'shrinking storm': 'Wrath of God' };
const cache = new Map<string, RawCard>();
const pending = new Map<string, Promise<RawCard | undefined>>();
let queue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0;
let userAgent: string | undefined;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function configureScryfallClient(options: { userAgent: string }) { userAgent = options.userAgent; }

/** One scheduler for collection, named, search, autocomplete, and token calls. */
export function requestScryfall<T>(path: string, options: RequestInit = {}): Promise<{ status: number; data: T }> {
  const task = async () => {
    for (let attempt = 0; ; attempt++) {
      await sleep(Math.max(0, nextRequestAt - Date.now()));
      nextRequestAt = Date.now() + 550;
      const headers = new Headers(options.headers);
      headers.set('Accept', 'application/json');
      if (userAgent) headers.set('User-Agent', userAgent);
      const response = await fetch(`https://api.scryfall.com${path}`, {
        ...options, headers, signal: AbortSignal.timeout(15000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retry = Number(response.headers.get('Retry-After'));
        nextRequestAt = Date.now() + (retry > 0 ? retry * 1000 : 1000 * (attempt + 1));
        continue;
      }
      if (!response.ok && response.status !== 404) throw new Error(`Scryfall: HTTP ${response.status}`);
      return { status: response.status, data: await response.json() as T };
    }
  };
  const result = queue.then(task);
  queue = result.catch(() => undefined);
  return result;
}

export function rawNames(card: RawCard): string[] {
  return [card.name, card.printed_name, card.flavor_name,
    ...(card.card_faces ?? []).flatMap(f => [f.name, f.printed_name, f.flavor_name])]
    .filter((name): name is string => !!name);
}

export function matchesName(card: RawCard, name: string): boolean {
  const wanted = key(VERIFIED_ALIASES[key(name)] ?? name);
  return rawNames(card).some(n => key(n) === wanted);
}

export function cacheVerifiedCard(card: RawCard, requestedName?: string) {
  if (!card.id || !firstImage(card) || !card.type_line) return;
  for (const name of rawNames(card)) if (!cache.has(key(name))) cache.set(key(name), card);
  if (requestedName && matchesName(card, requestedName) && !cache.has(key(requestedName))) {
    cache.set(key(requestedName), card);
  }
}

export function cachedScryfallCard(name: string): RawCard | undefined { return cache.get(key(name)); }

export function firstImage(card: RawCard): string | undefined {
  return card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
}

export function cardIdentity(card: RawCard) {
  if (!card.id || !firstImage(card) || !card.type_line) throw new Error(`Carta senza dati completi: ${card.name}`);
  return { scryfallId: card.id, oracleId: card.oracle_id ?? card.card_faces?.[0]?.oracle_id ?? null,
    imageUrl: firstImage(card)!, typeLine: card.type_line,
    setCode: card.set ?? null, collectorNumber: card.collector_number ?? null };
}

/** Espansione e numero di stampe già note per id Scryfall (una richiesta ogni 75 carte). */
export async function fetchCardsById(ids: string[]): Promise<Map<string, RawCard>> {
  const found = new Map<string, RawCard>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 75) {
    const response = await requestScryfall<{ data?: RawCard[] }>('/cards/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: unique.slice(i, i + 75).map(id => ({ id })) }),
    });
    for (const card of response.data.data ?? []) found.set(card.id, card);
  }
  return found;
}

/** Cerca le stampe esatte (espansione + numero) con una sola richiesta; chiave del risultato: "set|numero". */
export async function fetchPrintings(hints: { setCode: string; collectorNumber: string }[]): Promise<Map<string, RawCard>> {
  const found = new Map<string, RawCard>();
  const unique = [...new Map(hints.map(h => [`${h.setCode}|${h.collectorNumber}`, h])).values()];
  for (let i = 0; i < unique.length; i += 75) {
    const batch = unique.slice(i, i + 75);
    const response = await requestScryfall<{ data?: RawCard[] }>('/cards/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: batch.map(h => ({ set: h.setCode, collector_number: h.collectorNumber })) }),
    });
    for (const card of response.data.data ?? []) {
      if (card.set && card.collector_number) found.set(`${card.set}|${card.collector_number}`, card);
    }
  }
  return found;
}

async function resolveBatch(names: string[]): Promise<Map<string, RawCard>> {
  const result = new Map<string, RawCard>();
  const candidates = new Map<string, RawCard[]>();
  const accept = (card: RawCard) => {
    if (!card.id || !firstImage(card) || !card.type_line) return;
    for (const name of names) if (matchesName(card, name)) {
      const previous = candidates.get(key(name)) ?? [];
      previous.push(card); candidates.set(key(name), previous);
    }
  };
  const collection = await requestScryfall<{ data?: RawCard[] }>('/cards/collection', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers: names.map(name => ({ name: VERIFIED_ALIASES[key(name)] ?? name })) }),
  });
  (collection.data.data ?? []).forEach(accept);
  for (const name of names.filter(n => !candidates.has(key(n)))) {
    const exact = await requestScryfall<RawCard>(`/cards/named?exact=${encodeURIComponent(VERIFIED_ALIASES[key(name)] ?? name)}`);
    if (exact.status !== 404) accept(exact.data);
  }
  // Exact multilingual search. Keep queries below the documented 1,000-character maximum.
  const missing = names.filter(n => !candidates.has(key(n)));
  const literal = (n: string) => `!"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const batches: string[][] = [];
  let chunk: string[] = [];
  for (const name of missing) {
    if ([...chunk, name].map(literal).join(' or ').length > 900) { batches.push(chunk); chunk = []; }
    chunk.push(name);
  }
  if (chunk.length) batches.push(chunk);
  for (const batch of batches) {
    const query = `(${batch.map(literal).join(' or ')}) lang:any game:paper`;
    let path: string | undefined = `/cards/search?unique=cards&q=${encodeURIComponent(query)}`;
    while (path) {
      const response: { status: number; data: { data?: RawCard[]; next_page?: string; has_more?: boolean } } =
        await requestScryfall(path);
      (response.data.data ?? []).forEach(accept);
      path = response.data.has_more && response.data.next_page
        ? new URL(response.data.next_page).pathname + new URL(response.data.next_page).search : undefined;
    }
  }
  for (const name of names) {
    const choices = candidates.get(key(name)) ?? [];
    const identities = new Set(choices.map(c => c.oracle_id ?? c.card_faces?.[0]?.oracle_id ?? c.id));
    if (choices.length && identities.size === 1) {
      result.set(key(name), choices[0]); cacheVerifiedCard(choices[0], name);
    }
  }
  return result;
}

export async function resolveScryfallNames(names: string[], signal?: AbortSignal): Promise<Map<string, RawCard>> {
  const unique = [...new Map(names.filter(n => n.trim()).map(n => [key(n), n.trim()])).values()];
  const todo = unique.filter(n => !cache.has(key(n)) && !pending.has(key(n)));
  for (let i = 0; i < todo.length; i += 75) {
    const batch = todo.slice(i, i + 75);
    const task = resolveBatch(batch);
    for (const name of batch) {
      const promise = task.then(result => result.get(key(name)));
      pending.set(key(name), promise);
      void promise.finally(() => pending.delete(key(name))).catch(() => undefined);
    }
  }
  const task = Promise.all(unique.map(async name => {
    const card = cache.get(key(name)) ?? await pending.get(key(name));
    return [key(name), card] as const;
  })).then(entries => new Map(entries.filter((e): e is readonly [string, RawCard] => !!e[1])));
  if (!signal) return task;
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
