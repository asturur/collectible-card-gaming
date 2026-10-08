import { describe, expect, it } from 'vitest';
import { parseDeckText, normalizeEntries } from './deckCards';
import { fromSavedDeck, expandPlayableDeck, dedupePlayableCards } from './playableDeck';
import type { SavedDeck } from './savedDecks';

const row = { name: 'Isola', qty: 2, section: 'main' as const, scryfallId: 'printing', oracleId: 'oracle', imageUrl: 'https://cards.scryfall.io/front.jpg', typeLine: 'Basic Land — Island' };
describe('deck data and gameplay', () => {
  it('parses file/paste printing hints, merges within sections and preserves labels', () => {
    expect(parseDeckText('Deck 3\n2 Isola (SET) 23\n1 isola\n0 ignored\nSideboard 1\n1 Isola\nMain Deck - 1\n1 Shrinking Storm')).toEqual([
      { name: 'Isola', qty: 3, section: 'main', setCode: 'set', collectorNumber: '23' }, { name: 'Isola', qty: 1, section: 'side' }, { name: 'Shrinking Storm', qty: 1, section: 'main' },
    ]);
  });
  it('keeps the first group identity when aggregating quantities', () => {
    expect(normalizeEntries([row, { ...row, name: 'isola', scryfallId: 'other' }])[0]).toMatchObject({ qty: 4, scryfallId: 'printing' });
    expect(() => normalizeEntries([{ name: 'Island', qty: 0 }])).toThrow();
  });
  it('loads row identities and includes every main/side copy', () => {
    const deck = { id: 'deck', name: 'Saved', revision: 2, format: '', cards: [], cardRows: [row, { ...row, qty: 1, section: 'side' }] } as unknown as SavedDeck;
    expect(expandPlayableDeck(fromSavedDeck(deck))).toEqual(Array.from({ length: 3 }, () => ({ cardId: 'printing', imageUrl: row.imageUrl })));
  });
  it('refuses the entire deck if one card is unresolved, and keeps it in previews', () => {
    const deck = fromSavedDeck({ cardRows: [row, { name: 'Unknown', qty: 1 }], id: 'x' } as SavedDeck);
    expect(() => expandPlayableDeck(deck)).toThrow('Unknown');
    expect(dedupePlayableCards(deck.mainBoard)).toHaveLength(2);
    expect(() => expandPlayableDeck({ ...deck, mainBoard: [], sideBoard: [] })).toThrow('empty');
  });
});
