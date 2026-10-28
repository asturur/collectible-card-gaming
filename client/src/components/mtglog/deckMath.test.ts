import { describe, expect, it } from 'vitest';
import { computeDeckStats } from './deckMath';
import { manaAmounts, type ScryCard } from '../../services/scryfall';

const make = (name: string, typeLine: string, manaCost: string, produced: string[], oracle = ''): ScryCard => ({
  name, scryfallId: name, oracleId: null, exactMatch: true, faces: [], colors: [], typeLine, cmc: 0, manaCost,
  produced, manaAmounts: manaAmounts(oracle, produced), tokens: [],
});
const CARDS: Record<string, ScryCard> = Object.fromEntries([
  make('Plains', 'Basic Land — Plains', '', ['W'], '({T}: Add {W}.)'),
  make('Hallowed Fountain', 'Land — Plains Island', '', ['W', 'U'], '({T}: Add {W} or {U}.)'),
  make('Command Tower', 'Land', '', ['W', 'U', 'B', 'R', 'G'], "{T}: Add one mana of any color in your commander's color identity."),
  make('Sol Ring', 'Artifact', '{1}', ['C'], '{T}: Add {C}{C}.'),
  make('Swamp', 'Basic Land — Swamp', '', ['B'], '({T}: Add {B}.)'),
  make('Dark Ritual', 'Instant', '{B}', ['B'], 'Add {B}{B}{B}.'),
].map((c) => [c.name, c]));
const production = (names: string[]) => Object.fromEntries(
  computeDeckStats(names.map((name) => ({ name, qty: 1 })), (name) => CARDS[name]).productionPie.map((s) => [s.key, s.value])
);

describe('mana production (like ManaBox)', () => {
  it('counts every colour a source can make, with the mana it adds', () => {
    // La prova fatta in ManaBox: W 3, U 2, B 1, R 1, G 1; con Sol Ring anche 2 incolore.
    expect(production(['Plains', 'Hallowed Fountain', 'Command Tower'])).toEqual({ W: 3, U: 2, B: 1, R: 1, G: 1 });
    expect(production(['Plains', 'Hallowed Fountain', 'Command Tower', 'Sol Ring'])).toEqual({ W: 3, U: 2, B: 1, R: 1, G: 1, C: 2 });
  });

  it('limits sources of any colour to the colours the deck casts', () => {
    // Mazzo mono-nero: Command Tower produce solo nero.
    expect(production(['Swamp', 'Command Tower', 'Dark Ritual'])).toEqual({ B: 1 + 1 + 3 });
  });
});

describe('manaAmounts', () => {
  it('reads how much mana of each colour a card adds at once', () => {
    expect(manaAmounts('{T}: Add {C}{C}.', ['C'])).toEqual({ C: 2 });
    expect(manaAmounts('({T}: Add {W} or {U}.)', ['W', 'U'])).toEqual({ W: 1, U: 1 });
    expect(manaAmounts('{T}: Add three mana of any one color.', ['W', 'U', 'B', 'R', 'G'])).toEqual({ W: 3, U: 3, B: 3, R: 3, G: 3 });
    expect(manaAmounts('{T}: Add {C}.\n{T}, Pay 1 life: Add {R} or {G}.', ['C', 'R', 'G'])).toEqual({ C: 1, R: 1, G: 1 });
    expect(manaAmounts('', ['G'])).toEqual({ G: 1 });
  });
});
