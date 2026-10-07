import { supabase, TABLE_DECKS, TABLE_DECK_CARDS, subscribeToTable } from './supabase';
import { entryKey, nameKey, normalizeEntries, serializeEntry, type DeckEntry } from './deckCards';
import { cachedScryfallCard, cardIdentity, resolveScryfallNames } from './scryfallLookup';
import { getCard } from './scryfall';

export interface SavedDeck {
  id: string; name: string; source: string; format: string; colors: string[];
  createdBy: string | null; revision: number;
  /** Compatibility reader: JSON names/quantities enriched with assigned row identities. */
  cards: DeckEntry[];
  /** Gameplay reads the new table directly. */
  cardRows: DeckEntry[];
}
interface CardRow {
  id: string; name: string; qty: number; section: 'main' | 'side'; position: number;
  scryfall_id: string | null; oracle_id: string | null; image_url: string | null; type_line: string | null;
}
interface DeckRow {
  id: string; name: string; source: string | null; format: string; colors: string[];
  created_by: string | null; revision: number; cards: DeckEntry[]; card_rows: CardRow[];
}
// Embedding the FK relation reads header/JSON/children from one database snapshot.
const SELECT = 'id,name,source,format,colors,created_by,revision,cards,card_rows:mazzi-cards(id,name,qty,section,position,scryfall_id,oracle_id,image_url,type_line)';
function client() {
  if (!supabase) throw new Error('Supabase non configurato.');
  return supabase;
}
function fromRow(row: DeckRow): SavedDeck {
  const cardRows = [...row.card_rows].sort((a, b) => a.position - b.position).map(c => ({
    id: c.id, name: c.name, qty: c.qty, section: c.section,
    scryfallId: c.scryfall_id, oracleId: c.oracle_id, imageUrl: c.image_url, typeLine: c.type_line,
  }));
  const identities = new Map(cardRows.map(c => [entryKey(c), c]));
  const jsonCards = normalizeEntries(row.cards);
  if (jsonCards.length !== cardRows.length || jsonCards.some((c, i) =>
    entryKey(c) !== entryKey(cardRows[i]) || c.qty !== cardRows[i].qty)) {
    throw new Error('Le carte del mazzo non sono sincronizzate. Riprova a caricarlo.');
  }
  return { id: row.id, name: row.name, source: row.source ?? '', format: row.format ?? '',
    colors: row.colors ?? [], createdBy: row.created_by, revision: row.revision, cardRows,
    cards: jsonCards.map(c => ({ ...identities.get(entryKey(c)), ...c })),
  };
}
export async function listSavedDecks(): Promise<SavedDeck[]> {
  const rows: DeckRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client().from(TABLE_DECKS).select(SELECT).order('id').range(offset, offset + 99);
    if (error) throw error;
    rows.push(...(data as unknown as DeckRow[]));
    if (data.length < 100) break;
  }
  return rows.map(fromRow).sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
}
export async function getSavedDeck(id: string): Promise<SavedDeck> {
  const { data, error } = await client().from(TABLE_DECKS).select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Questo mazzo non esiste più: è stato cancellato.');
  return fromRow(data as unknown as DeckRow);
}
export class DeckConflictError extends Error {
  constructor() { super('Qualcun altro ha modificato il mazzo. Le tue modifiche sono ancora qui.'); }
}
export class UnresolvedCardsError extends Error {
  constructor(public names: string[]) {
    super('Scryfall non riconosce: ' + names.join(', ') + '. Correggi i nomi oppure salva solo per il registro.');
  }
}
export class CardLookupError extends UnresolvedCardsError {
  constructor(names: string[]) {
    super(names);
    this.message = 'Non riesco a verificare le carte su Scryfall. Riprova oppure salva solo per il registro.';
  }
}
export interface SaveDeckInput {
  id: string; name: string; source: string; format: string; colors: string[];
  cards: DeckEntry[]; expectedRevision: number | null;
}
export async function saveSavedDeck(input: SaveDeckInput, options: {
  allowUnresolved?: boolean; signal?: AbortSignal; onPersisting?: () => void;
} = {}): Promise<void> {
  const entries = normalizeEntries(input.cards);
  // Existing groups always keep their stored printing, even if a new lookup returns another one.
  const previous = input.expectedRevision === null ? [] : (await getSavedDeck(input.id)).cardRows;
  const assigned = new Map(previous.filter(c => c.scryfallId).map(c => [entryKey(c), c]));
  const cards = entries.map(c => {
    const stored = assigned.get(entryKey(c));
    if (stored) return { ...c, scryfallId: stored.scryfallId, oracleId: stored.oracleId,
      imageUrl: stored.imageUrl, typeLine: stored.typeLine };
    // IDs carried in a removed/re-added draft are not a new user-selectable identity.
    const cachedRaw = cachedScryfallCard(c.name);
    if (cachedRaw) return { ...c, ...cardIdentity(cachedRaw) };
    const cached = getCard(c.name);
    return { ...c, scryfallId: cached?.scryfallId ?? null, oracleId: cached?.oracleId ?? null,
      imageUrl: cached?.faces[0]?.normal ?? null, typeLine: cached?.typeLine ?? null };
  });
  const names = cards.filter(c => !c.scryfallId).map(c => c.name);
  if (names.length && !options.allowUnresolved) {
    let resolved;
    try { resolved = await resolveScryfallNames(names, options.signal); }
    catch (err) {
      if (options.signal?.aborted) throw err;
      throw new CardLookupError(names);
    }
    for (const card of cards) {
      if (card.scryfallId) continue;
      const raw = resolved.get(nameKey(card.name));
      const identity = raw && cardIdentity(raw);
      if (identity) Object.assign(card, identity);
    }
  }
  const unknown = cards.filter(c => !c.scryfallId || !c.imageUrl || !c.typeLine).map(c => c.name);
  if (unknown.length && !options.allowUnresolved) throw new UnresolvedCardsError(unknown);
  options.signal?.throwIfAborted();
  options.onPersisting?.();
  const { error } = await client().rpc('save_deck', {
    p_deck_id: input.id, p_name: input.name, p_source: input.source, p_format: input.format,
    p_colors: input.colors, p_cards: cards.map(serializeEntry),
    p_expected_revision: input.expectedRevision, p_allow_unresolved: !!options.allowUnresolved,
  });
  if (error?.code === '40001') throw new DeckConflictError();
  if (error) throw error;
  notifySavedDecks();
}
export async function deleteSavedDeck(id: string): Promise<void> {
  const { data, error } = await client().from(TABLE_DECKS).delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('Il mazzo è stato cancellato oppure non hai il permesso di modificarlo.');
  notifySavedDecks();
}
const listeners = new Set<() => void>();
function notifySavedDecks() { listeners.forEach(fn => fn()); }
export function subscribeSavedDecks(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const changed = () => { clearTimeout(timer); timer = setTimeout(onChange, 100); };
  listeners.add(changed);
  const stopHeaders = subscribeToTable(TABLE_DECKS, changed);
  const stopCards = subscribeToTable(TABLE_DECK_CARDS, changed);
  return () => { clearTimeout(timer); listeners.delete(changed); stopHeaders(); stopCards(); };
}
