import { beforeEach, describe, expect, it } from 'vitest';
import type { Game } from './GameList';
import { countNewGames, markGamesSeen } from './newGames';

function game(id: string, createdBy: string | null): Game {
  return { id, date: '2026-10-01', format: '', notes: '', group: '', createdBy, startedAt: null, endedAt: null, players: [] };
}

describe('countNewGames', () => {
  beforeEach(() => localStorage.clear());

  it('starts from the existing games on first use', () => {
    expect(countNewGames([game('a', 'friend'), game('b', 'friend')], 'me')).toBe(0);
    expect(countNewGames([game('a', 'friend'), game('b', 'friend'), game('c', 'friend')], 'me')).toBe(1);
  });

  it('ignores my own games and clears once the list is opened', () => {
    markGamesSeen([game('a', 'friend')]);
    const games = [game('a', 'friend'), game('b', 'me'), game('c', 'friend'), game('d', 'friend')];
    expect(countNewGames(games, 'me')).toBe(2);
    markGamesSeen(games);
    expect(countNewGames(games, 'me')).toBe(0);
  });

  it('survives unreadable storage content', () => {
    localStorage.setItem('mtglog:seenGames', '{oops');
    expect(countNewGames([game('a', 'friend')], 'me')).toBe(0);
  });
});
