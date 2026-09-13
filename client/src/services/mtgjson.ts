/**
 * MTGJSON API client for fetching deck lists and individual decks.
 * See https://mtgjson.com/api/v5/ for documentation.
 */

// --- Types ---

/** Entry from the DeckList.json index */
export interface DeckListEntry {
  code: string;
  fileName: string;
  name: string;
  releaseDate: string;
  source: string;
  type: string;
}

/** A card within an MTGJSON deck */
export interface MtgJsonCard {
  name: string;
  count: number;
  type: string;
  manaCost?: string;
  colors: string[];
  rarity: string;
  identifiers: {
    scryfallId?: string;
    [key: string]: string | undefined;
  };
}

/** An individual MTGJSON deck (from /decks/{fileName}.json) */
export interface MtgJsonDeck {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  mainBoard: MtgJsonCard[];
  sideBoard: MtgJsonCard[];
  commander: MtgJsonCard[];
}

// --- API functions ---

const MTGJSON_BASE = 'https://mtgjson.com/api/v5';

/**
 * Fetches the deck list index from MTGJSON.
 * Returns all available deck entries (~500KB JSON).
 */
export async function fetchDeckList(): Promise<DeckListEntry[]> {
  const res = await fetch(`${MTGJSON_BASE}/DeckList.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch deck list: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  // MTGJSON wraps the list in { meta: {...}, data: [...] }
  const entries = json.data ?? json;
  return entries as DeckListEntry[];
}

/**
 * Fetches a single deck by its file name.
 * The fileName comes from DeckListEntry.fileName.
 */
export async function fetchDeck(fileName: string): Promise<MtgJsonDeck> {
  const res = await fetch(`${MTGJSON_BASE}/decks/${fileName}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch deck "${fileName}": ${res.status} ${res.statusText}`);
  }
  const wrapper = await res.json();
  // MTGJSON wraps the deck in a { data: { ... } } envelope
  return (wrapper.data ?? wrapper) as MtgJsonDeck;
}

/**
 * Extracts unique deck types from a deck list and sorts them alphabetically.
 */
export function extractDeckTypes(entries: DeckListEntry[]): string[] {
  const types = new Set(entries.map((e) => e.type));
  return [...types].sort((a, b) => a.localeCompare(b));
}

/**
 * Filters deck entries by type and sorts by name.
 */
export function filterDecksByType(entries: DeckListEntry[], type: string): DeckListEntry[] {
  return entries
    .filter((e) => e.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Constructs a Scryfall image URL from a scryfallId.
 * Format: https://cards.scryfall.io/normal/front/{id[0]}/{id[1]}/{id}.jpg
 */
export function scryfallImageUrl(scryfallId: string): string {
  return `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}

/**
 * Combines all card boards from a deck into a single array,
 * deduplicating by scryfallId and summing counts.
 */
export function getAllCards(deck: MtgJsonDeck): MtgJsonCard[] {
  const all = [...deck.mainBoard, ...deck.sideBoard, ...deck.commander];
  // Deduplicate by scryfallId, summing counts
  const byId = new Map<string, MtgJsonCard>();
  for (const card of all) {
    const id = card.identifiers.scryfallId;
    if (!id) continue;
    const existing = byId.get(id);
    if (existing) {
      existing.count += card.count;
    } else {
      byId.set(id, { ...card });
    }
  }
  return [...byId.values()];
}
