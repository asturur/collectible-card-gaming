import { describe, expect, it } from 'vitest';
import type { Game } from './GameList';
import { computeFavoriteDecks, computeMonthly, computeStreaks, monthLabel, monthSummary } from './trends';

function game(id: string, date: string, players: [string, boolean, string?][]): Game {
  return {
    id, date, format: '', notes: '', group: '', createdBy: null, startedAt: null, endedAt: null,
    players: players.map(([name, winner, deck]) => ({ name, winner, deck: deck ?? '', desc: '', life: null, colors: [] })),
  };
}

describe('trends', () => {
  const games = [
    game('1', '2026-08-03', [['Alice', true, 'Elfi'], ['Bob', false, 'Goblin']]),
    game('2', '2026-08-20', [['Alice', true, 'Elfi'], ['Bob', false, 'Goblin']]),
    game('3', '2026-10-01', [['Alice', false, 'Elfi'], ['Bob', true, 'Goblin']]),
    game('4', '2026-10-05', [['Alice', false, 'Zombie'], ['Bob', true, 'Goblin']]),
  ];

  it('builds one row per month, filling the empty ones', () => {
    const rows = computeMonthly(games, new Date(2026, 9, 10));
    expect(rows.map((r) => [r.month, r.games])).toEqual([['2026-08', 2], ['2026-09', 0], ['2026-10', 2]]);
    expect(rows[0].wins).toEqual({ Alice: 2 });
    expect(rows[2].wins).toEqual({ Bob: 2 });
  });

  it('extends the range up to the current month and handles no games', () => {
    expect(computeMonthly([], new Date(2026, 9, 10))).toEqual([]);
    expect(computeMonthly(games, new Date(2026, 11, 1)).map((r) => r.month).slice(-2)).toEqual(['2026-11', '2026-12']);
  });

  it('computes current and best win streaks in date order', () => {
    const shuffled = [games[3], games[0], games[2], games[1]];
    expect(computeStreaks(shuffled)).toEqual([
      { name: 'Bob', current: 2, best: 2 },
      { name: 'Alice', current: 0, best: 2 },
    ]);
  });

  it('picks the most played deck per player, merging renamed saved decks', () => {
    const favorites = computeFavoriteDecks(games, [{ id: 'd1', name: 'Elfi' }]);
    expect(favorites).toEqual([
      { name: 'Alice', deck: 'Elfi', games: 3, wins: 2 },
      { name: 'Bob', deck: 'Goblin', games: 4, wins: 2 },
    ].sort((a, b) => b.games - a.games));
  });

  it('writes a month summary', () => {
    expect(monthLabel('2026-10')).toBe('Ottobre 2026');
    expect(monthSummary(computeMonthly(games, new Date(2026, 9, 10)))).toBe('Ottobre 2026: 2 partite, più vittorie: Bob (2).');
    expect(monthSummary(computeMonthly(games, new Date(2026, 10, 1)))).toBe('Novembre 2026: ancora nessuna partita.');
    expect(monthSummary([])).toBe('');
  });
});
