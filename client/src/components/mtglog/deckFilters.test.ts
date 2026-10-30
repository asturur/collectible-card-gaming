import { describe, expect, it } from 'vitest';
import { allCardNames, cardDataProgress, keywordsInDecks, matchDeck, NO_DECK_FILTERS } from './deckFilters';
import type { ScryCard } from '../../services/scryfall';

const data: Record<string, Partial<ScryCard>> = {
  'Fiery Temper': { keywords: ['Madness'], oracle: 'Fiery Temper deals 3 damage to any target.\nMadness {R}' },
  'Faithless Looting': { keywords: [], oracle: 'Draw two cards, then discard two cards.' },
  'Sol Ring': { keywords: [], oracle: '{T}: Add {C}{C}.' },
  'Opt': { keywords: ['Scry'], oracle: 'Scry 1.\nDraw a card.' },
};
const lookup = (name: string) => data[name] as ScryCard | undefined;
const red = [{ name: 'Fiery Temper' }, { name: 'Faithless Looting' }, { name: 'Sol Ring' }, { name: 'Sol Ring' }];
const blue = [{ name: 'Opt' }, { name: 'Sol Ring' }, { name: 'Island' }];

describe('deck filters', () => {
  it('keeps every deck without filters', () => {
    expect(matchDeck(red, NO_DECK_FILTERS, lookup)).toEqual({ ok: true, notes: [] });
  });

  it('matches part of a card name, ignoring case, and says which card', () => {
    expect(matchDeck(red, { ...NO_DECK_FILTERS, card: 'sol' }, lookup)).toEqual({ ok: true, notes: ['Sol Ring'] });
    expect(matchDeck(red, { ...NO_DECK_FILTERS, card: 'opt' }, lookup).ok).toBe(false);
  });

  it('matches a keyword and the rules text, counting distinct cards', () => {
    expect(matchDeck(red, { ...NO_DECK_FILTERS, keyword: 'Madness' }, lookup)).toEqual({ ok: true, notes: ['Madness ×1'] });
    expect(matchDeck(blue, { ...NO_DECK_FILTERS, keyword: 'Madness' }, lookup).ok).toBe(false);
    expect(matchDeck(blue, { ...NO_DECK_FILTERS, text: 'DRAW' }, lookup)).toEqual({ ok: true, notes: ['«DRAW» in 1 carta'] });
    expect(matchDeck(red, { ...NO_DECK_FILTERS, text: 'draw' }, lookup).notes).toEqual(['«draw» in 1 carta']);
  });

  it('needs every active filter at once', () => {
    expect(matchDeck(red, { card: 'sol', keyword: 'Madness', text: 'draw' }, lookup).notes).toEqual(['Sol Ring', 'Madness ×1', '«draw» in 1 carta']);
    expect(matchDeck(red, { card: 'sol', keyword: 'Scry', text: '' }, lookup).ok).toBe(false);
  });

  it('lists card names, keywords with their deck counts, and how much card data has arrived', () => {
    expect(allCardNames([red, blue])).toEqual(['Faithless Looting', 'Fiery Temper', 'Island', 'Opt', 'Sol Ring']);
    expect(keywordsInDecks([red, blue], lookup)).toEqual([{ keyword: 'Madness', decks: 1 }, { keyword: 'Scry', decks: 1 }]);
    expect(cardDataProgress([red, blue], lookup, (n) => n === 'Island')).toEqual({ ready: 5, total: 5 });
    expect(cardDataProgress([red, blue], lookup, () => false)).toEqual({ ready: 4, total: 5 });
  });
});
