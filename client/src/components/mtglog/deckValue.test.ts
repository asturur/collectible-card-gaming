import { describe, expect, it } from 'vitest';
import { computeDeckValue, formatEur, formatUsd } from './deckValue';

const price = (eur: number | null, usd: number | null, at = 100) => ({ eur, usd, cardmarket: null, at });

describe('computeDeckValue', () => {
  it('sums price × copies for Main Deck and Sideboard, and lists the 3 cards worth most', () => {
    const value = computeDeckValue([
      { name: 'Craterhoof Behemoth', qty: 1, scryfallId: 'hoof', price: price(38.9, 44.1, 300) },
      { name: 'Elvish Archdruid', qty: 4, scryfallId: 'arch', price: price(3.7, 4) },
      { name: 'Elvish Archdruid', qty: 1, section: 'side', scryfallId: 'arch', price: price(3.7, 4) },
      { name: "Gaea's Cradle", qty: 1, scryfallId: 'cradle', price: price(31.5, 35, 200) },
      { name: 'Forest', qty: 10, scryfallId: 'forest', price: price(0.1, 0.2) },
      { name: 'Senza prezzo', qty: 2, scryfallId: 'x', price: price(null, 1) },
      { name: 'Non trovata', qty: 1 },
    ]);
    expect(value.eur).toEqual({ main: 86.2, side: 3.7, total: 89.9 });
    expect(value.usd).toEqual({ main: 99.1, side: 4, total: 103.1 });
    expect(value.top.map((c) => [c.name, c.qty, c.unit, c.total])).toEqual([
      ['Craterhoof Behemoth', 1, 38.9, 38.9],
      ["Gaea's Cradle", 1, 31.5, 31.5],
      ['Elvish Archdruid', 5, 3.7, 18.5],
    ]);
    expect(value.unpriced).toBe(3);
    expect(value.oldest).toBe(100);
  });

  it('formats money the Italian way', () => {
    expect(formatEur(1234.5)).toBe('€ 1.234,50');
    expect(formatEur(12345.5)).toBe('€ 12.345,50');
    expect(formatEur(1234567.891)).toBe('€ 1.234.567,89');
    expect(formatEur(184.6)).toBe('€ 184,60');
    expect(formatEur(0)).toBe('€ 0,00');
    expect(formatUsd(0.2)).toBe('$ 0,20');
  });
});
