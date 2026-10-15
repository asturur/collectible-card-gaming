import { describe, expect, it } from 'vitest';
import { computeMatchups, decidedGames, matchupKey } from './stats';
import type { Game } from './GameList';

describe('decidedGames', () => {
  it('keeps only games with a winner for the statistics', () => {
    const base = { date: '2026-10-01', format: '', notes: '', group: '', createdBy: null, startedAt: null, endedAt: null };
    const player = (name: string, winner: boolean) => ({ name, deck: '', desc: '', life: 0, winner, colors: [] });
    const won = { ...base, id: 'a', players: [player('Anna', true), player('Bea', false)] };
    const open = { ...base, id: 'b', players: [player('Anna', false), player('Bea', false)] };
    expect(decidedGames([won, open]).map((g) => g.id)).toEqual(['a']);
  });
});

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
