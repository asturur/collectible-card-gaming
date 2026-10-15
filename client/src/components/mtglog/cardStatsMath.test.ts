import { describe, expect, it } from 'vitest';
import { computeCardStats, inPeriod, type StatsDeck } from './cardStatsMath';
import type { Game } from './GameList';

const deck = (id: string, cards: [string, number, string?, string?][]): StatsDeck => ({
  id, name: 'Mazzo ' + id,
  cards: cards.map(([name, qty, typeLine = 'Instant', section]) => ({ name, qty, typeLine, section, scryfallId: name + '-id' })),
});
const decks = [
  deck('A', [['Sol Ring', 1, 'Artifact'], ['Rhystic Study', 1, 'Enchantment'], ['Forest', 30, 'Basic Land — Forest'], ['Command Tower', 1, 'Land'], ['Counterspell', 2]]),
  deck('B', [['Sol Ring', 1, 'Artifact'], ['Llanowar Elves', 4, 'Creature — Elf Druid'], ['Counterspell', 1, 'Instant', 'side']]),
  deck('C', [['Sol Ring', 1, 'Artifact'], ['Lightning Bolt', 4]]),
];
let n = 0;
const game = (winner: string, players: [string, string][], colors: Record<string, string[]> = {}): Game => ({
  id: 'g' + n++, date: '2026-10-01', format: 'Commander', notes: '', group: '', createdBy: null, startedAt: null, endedAt: null,
  players: players.map(([name, deckId]) => ({ name, deck: 'Mazzo ' + deckId, deckId, desc: '', life: 0, winner: name === winner, colors: colors[name] ?? [] })),
});
const table: [string, string][] = [['Andrea', 'A'], ['Bea', 'B'], ['Carlo', 'C']];
const games = [
  ...Array.from({ length: 4 }, () => game('Andrea', table, { Andrea: ['U'], Bea: ['G'], Carlo: ['R'] })),
  ...Array.from({ length: 2 }, () => game('Bea', table, { Andrea: ['U'], Bea: ['G'], Carlo: ['R'] })),
  game('Carlo', [['Carlo', 'C'], ['Dario', 'senza-lista']]),
];

describe('computeCardStats', () => {
  const s = computeCardStats(games, decks);

  it('counts copies for "most played", only Main Deck and never lands', () => {
    expect(s.played.map((r) => [r.name, r.copies, r.games])).toEqual([
      ['Lightning Bolt', 28, 7], ['Llanowar Elves', 24, 6], ['Counterspell', 12, 6], ['Sol Ring', 19, 19], ['Rhystic Study', 6, 6],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)));
    expect(s.played.some((r) => r.name === 'Forest' || r.name === 'Command Tower')).toBe(false);
  });

  it('ranks win rate by presence, with at least 5 games, against the group average', () => {
    expect(s.average).toBe(Math.round((7 / 19) * 100));
    expect(s.winners[0]).toMatchObject({ name: 'Counterspell', wins: 4, games: 6, pct: 67 });
    expect(s.losers[0]).toMatchObject({ name: 'Lightning Bolt', wins: 1, games: 7, pct: 14 });
    expect(s.cursed).toEqual([]);
  });

  it('finds group staples by number of decks and each player signature card', () => {
    expect(s.staples.map((r) => [r.name, r.decks])).toEqual([['Sol Ring', 3]]);
    expect(s.signatures.map((r) => [r.player, r.card.name, r.games, r.playerGames, r.othersPct])).toEqual([
      ['Andrea', 'Counterspell', 6, 6, 0],
      ['Bea', 'Llanowar Elves', 6, 6, 0],
      ['Carlo', 'Lightning Bolt', 7, 7, 0],
    ]);
  });

  it('reports games with card lists and win rate per deck color', () => {
    expect(s.games).toBe(7);
    expect(s.gamesWithLists).toBe(7);
    expect(s.colors.map((c) => [c.color, c.wins, c.games])).toEqual([['U', 4, 6], ['G', 2, 6], ['R', 0, 6]]);
  });

  it('compares colors with an average that counts each colored player once', () => {
    const two: [string, string][] = [['Andrea', 'A'], ['Bea', 'B']];
    const three: [string, string][] = [...two, ['Carlo', 'C']];
    const multi = computeCardStats([
      game('Andrea', two, { Andrea: ['W', 'U'], Bea: ['G'] }),
      game('Bea', three, { Andrea: ['W', 'U'], Bea: ['G'] }),
    ], decks);
    // Colori: 2 vittorie su 4 giocatori con colori (Carlo non ne ha); carte: 2 su 5 presenze.
    expect(multi.colorsAverage).toBe(50);
    expect(multi.average).toBe(40);
    expect(multi.colors.find((c) => c.color === 'W')).toMatchObject({ wins: 1, games: 2 });
    expect(s.colorsAverage).toBe(Math.round((6 / 18) * 100));
  });

  it('marks cards played at least 5 times without a win as cursed', () => {
    const cursed = computeCardStats(games.slice(0, 6), decks).cursed;
    expect(cursed.map((r) => r.name)).toEqual(['Lightning Bolt']);
  });
});

describe('inPeriod', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  it('filters the last 30 days and the current year', () => {
    expect(inPeriod('2026-09-20', '30', now)).toBe(true);
    expect(inPeriod('2026-09-01', '30', now)).toBe(false);
    expect(inPeriod('2026-01-01', 'year', now)).toBe(true);
    expect(inPeriod('2025-12-31', 'year', now)).toBe(false);
    expect(inPeriod('2001-01-01', 'all', now)).toBe(true);
  });
});
