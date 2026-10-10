import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import GameList, { type Game } from './GameList';

vi.mock('../../services/supabase', () => ({
  canEdit: () => true,
  supabase: { from: vi.fn(() => { throw new Error('GameList must not query the database itself'); }) },
  TABLE_GAMES: 'partite',
}));

function game(id: string, date: string, winner: string): Game {
  return {
    id, date, format: '', notes: '', group: '', createdBy: null, startedAt: null, endedAt: null,
    players: [
      { name: winner, deck: 'Mazzo ' + winner, desc: '', winner: true, life: 20, colors: [] },
      { name: 'Zeta', deck: 'Altro', desc: '', winner: false, life: 0, colors: [] },
    ],
  };
}

describe('GameList', () => {
  it('shows the shared games newest first without loading them again', () => {
    const games = [game('g1', '2026-09-01', 'Anna'), game('g3', '2026-10-05', 'Carlo'), game('g2', '2026-10-05', 'Bea')];
    render(
      <MemoryRouter initialEntries={['/games']}>
        <Routes>
          <Route path="/games" element={<GameList userId="u" games={games} loading={false} loadError="" reloadGames={vi.fn()} onEdit={vi.fn()} onRematch={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('3 partite')).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => ['Anna', 'Bea', 'Carlo'].find((n) => li.textContent?.includes(n)))).toEqual(['Carlo', 'Bea', 'Anna']);
  });

  it('shows the shared loading error', () => {
    render(
      <MemoryRouter initialEntries={['/games']}>
        <Routes>
          <Route path="/games" element={<GameList userId="u" games={[]} loading={false} loadError="Non riesco a leggere il registro condiviso: offline" reloadGames={vi.fn()} onEdit={vi.fn()} onRematch={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('offline');
  });
});
