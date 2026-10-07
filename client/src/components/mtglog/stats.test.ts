import { describe, expect, it } from 'vitest';
import { computeMatchups, matchupKey } from './stats';
import type { Game } from './GameList';

describe('Exact matchup identities', () => {
  it('keeps names containing the old delimiter in separate formations', () => {
    const games = [
      { players: [{ name: 'Alice|Bob', winner: true }, { name: 'Carol', winner: false }] },
      { players: [{ name: 'Alice', winner: false }, { name: 'Bob|Carol', winner: true }] },
    ] as Game[];
    const rows = computeMatchups(games);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.games)).toEqual([1, 1]);
    expect(rows.map(row => row.players.map(player => player.name))).toEqual(expect.arrayContaining([
      ['Alice|Bob', 'Carol'], ['Alice', 'Bob|Carol'],
    ]));
  });

  it('matches reordered names while distinguishing larger formations', () => {
    expect(matchupKey(['Bob', ' Alice '])).toBe(matchupKey(['Alice', 'Bob']));
    expect(matchupKey(['Alice', 'Bob', 'Carol'])).not.toBe(matchupKey(['Alice', 'Bob']));
  });
});
