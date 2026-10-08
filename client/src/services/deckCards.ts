export type DeckSection = 'main' | 'side';

export interface DeckEntry {
  id?: string;
  name: string;
  qty: number;
  section?: DeckSection;
  scryfallId?: string | null;
  oracleId?: string | null;
  imageUrl?: string | null;
  typeLine?: string | null;
  /** Espansione (codice Scryfall, minuscolo) e numero di collezione della stampa. */
  setCode?: string | null;
  collectorNumber?: string | null;
}

export const nameKey = (name: string): string => name.trim().toLowerCase();
export const entryKey = (card: Pick<DeckEntry, 'name' | 'section'>): string =>
  `${card.section === 'side' ? 'side' : 'main'}|${nameKey(card.name)}`;

export function normalizeEntries(cards: DeckEntry[]): DeckEntry[] {
  const groups = new Map<string, DeckEntry>();
  for (const card of cards) {
    if (!card.name.trim() || !Number.isSafeInteger(card.qty) || card.qty < 1) {
      throw new Error('Ogni carta deve avere un nome e un numero intero di copie maggiore di zero.');
    }
    const key = entryKey(card);
    const previous = groups.get(key);
    if (previous) previous.qty += card.qty;
    else groups.set(key, { ...card, name: card.name.trim(), section: card.section === 'side' ? 'side' : 'main' });
  }
  return [...groups.values()];
}

/** Le righe tipo "1 Forest (MH3) 123" conservano espansione e numero: servono a trovare la stampa esatta. */
export function parseDeckText(text: string, recognizeSections = true): DeckEntry[] {
  const cards: DeckEntry[] = [];
  let section: DeckSection = 'main';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (recognizeSections && /^(main\s*deck|mainboard|deck)\b/i.test(line)) { section = 'main'; continue; }
    if (recognizeSections && /^sideboard\b/i.test(line)) { section = 'side'; continue; }
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const qty = Number(match[1]);
    const printing = match[2].match(/^(.*?)\s+\(([A-Za-z0-9]{2,6})\)\s+(\S+)$/);
    const name = (printing ? printing[1] : match[2].replace(/\s+\([^)]+\)\s+\S+$/, '')).trim();
    if (name && Number.isSafeInteger(qty) && qty > 0) {
      cards.push(printing ? { name, qty, section, setCode: printing[2].toLowerCase(), collectorNumber: printing[3] } : { name, qty, section });
    }
  }
  return normalizeEntries(cards);
}

export function isPlayableEntry(card: DeckEntry): boolean {
  return !!(card.scryfallId && card.imageUrl && card.typeLine && Number.isSafeInteger(card.qty) && card.qty > 0);
}

export function serializeEntry(card: DeckEntry) {
  return {
    name: card.name, qty: card.qty, section: card.section ?? 'main',
    scryfall_id: card.scryfallId ?? null, oracle_id: card.oracleId ?? null,
    image_url: card.imageUrl ?? null, type_line: card.typeLine ?? null,
    set_code: card.setCode ?? null, collector_number: card.collectorNumber ?? null,
  };
}
