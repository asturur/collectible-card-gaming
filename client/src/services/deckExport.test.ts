import { describe, expect, it } from 'vitest';
import { parseDeckText } from './deckCards';
import { deckFileName, formatDeckText } from './deckExport';

describe('deck export', () => {
  const cards = [
    { name: 'Island', qty: 2, section: 'main' as const },
    { name: 'Lightning Bolt', qty: 4, section: 'main' as const },
    { name: 'Forest', qty: 1, section: 'side' as const },
  ];

  it('writes Deck and Sideboard sections with one "<copie> <nome>" line per card', () => {
    expect(formatDeckText(cards)).toBe('Deck\n2 Island\n4 Lightning Bolt\n\nSideboard\n1 Forest\n');
  });

  it('omits the Sideboard section when there is none, and treats a missing section as main deck', () => {
    expect(formatDeckText([{ name: 'Island', qty: 3 }])).toBe('Deck\n3 Island\n');
  });

  it('can be read back by the importer without losing cards or sections', () => {
    expect(parseDeckText(formatDeckText(cards))).toEqual(cards);
  });

  it('builds a safe file name from the deck name', () => {
    expect(deckFileName('Elfi / Verdi: "Top"?')).toBe('Elfi Verdi Top.txt');
    expect(deckFileName('   ')).toBe('mazzo.txt');
  });
  it('scrive espansione e numero quando ci sono e li rilegge con lo stesso formato', () => {
    const cards = [{ name: 'Forest', qty: 2, section: 'main' as const, setCode: 'mh3', collectorNumber: '123' }, { name: 'Island', qty: 1, section: 'side' as const }];
    expect(formatDeckText(cards)).toBe('Deck\n2 Forest (MH3) 123\n\nSideboard\n1 Island\n');
    expect(parseDeckText(formatDeckText(cards))).toEqual(cards);
  });
});
