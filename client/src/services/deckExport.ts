import type { DeckEntry } from './deckCards';

/**
 * Testo di un mazzo nel formato "standard" che leggono ManaBox, MTG Arena,
 * Moxfield, Archidekt e il nostro stesso importatore: una riga per carta
 * ("<copie> <nome carta>"), con le intestazioni "Deck" e "Sideboard".
 * Se la carta ha espansione e numero di collezione si scrive anche "(SET) 123",
 * come fa ManaBox; altrimenti le altre app scelgono da sole la stampa.
 */
export function formatDeckText(cards: Pick<DeckEntry, 'name' | 'qty' | 'section' | 'setCode' | 'collectorNumber'>[]): string {
  const line = (c: Pick<DeckEntry, 'name' | 'qty' | 'setCode' | 'collectorNumber'>) =>
    `${c.qty} ${c.name}` + (c.setCode && c.collectorNumber ? ` (${c.setCode.toUpperCase()}) ${c.collectorNumber}` : '');
  const main = cards.filter((c) => c.section !== 'side').map(line);
  const side = cards.filter((c) => c.section === 'side').map(line);
  return ['Deck', ...main, ...(side.length ? ['', 'Sideboard', ...side] : [])].join('\n') + '\n';
}

/** Nome del file di esportazione: il nome del mazzo senza caratteri non ammessi nei file. */
export function deckFileName(deckName: string): string {
  const base = deckName
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'mazzo'}.txt`;
}
