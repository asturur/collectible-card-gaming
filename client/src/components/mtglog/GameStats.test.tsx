import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import GameStats from './GameStats';
import { listSavedDecks } from '../../services/savedDecks';

vi.mock('../../services/supabase', () => ({
  TABLE_GAMES: 'partite', subscribeToTable: () => () => {},
  supabase: { from: () => ({ select: async () => ({ error: null, data: [
    { id: 'g1', date: '2026-10-07', players: [
      { name: 'Alice', deck: 'Elfi', winner: true }, { name: 'Bob', deck: 'Mazzo cancellato', winner: false },
    ] },
    { id: 'g2', date: '2026-10-08', players: [
      { name: 'Alice', deck: 'Elfi', winner: false }, { name: 'Bob', deck: 'Vecchio nome', deckId: 'd2', winner: true },
    ] },
  ] }) }) },
}));
vi.mock('../../services/savedDecks', () => ({ listSavedDecks: vi.fn(), subscribeSavedDecks: () => () => {} }));

beforeEach(() => {
  vi.mocked(listSavedDecks).mockResolvedValue([{ id: 'd1', name: 'Elfi', source: 'brew' }, { id: 'd2', name: 'Goblin Rinominati', source: 'brew' }] as never);
});

describe('Deck statistics navigation', () => {
  it('links saved decks to their detail URL and leaves historical decks readable without a dialog', async () => {
    render(<MemoryRouter><GameStats /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: /Elfi/ })).toHaveAttribute('href', '/decks/d1');
    expect(screen.queryByRole('link', { name: /Mazzo cancellato/ })).not.toBeInTheDocument();
    expect(screen.getByText('Lista carte non disponibile: mazzo non salvato o cancellato.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the exported chart free of navigation and unavailable-list messages', async () => {
    render(<MemoryRouter><GameStats /></MemoryRouter>);
    await screen.findByRole('link', { name: /Elfi/ });
    const exportCard = screen.getByRole('heading', { name: 'Statistiche Mazzi', hidden: true }).closest('[aria-hidden="true"]');
    expect(exportCard).toHaveTextContent('Mazzo cancellato');
    expect(exportCard?.querySelector('a')).toBeNull();
    expect(exportCard).not.toHaveTextContent('Lista carte non disponibile');
  });

  it('tiene unite le partite di un mazzo rinominato, mostrando il nome attuale', async () => {
    render(<MemoryRouter><GameStats /></MemoryRouter>);
    const renamed = await screen.findByRole('link', { name: /Goblin Rinominati/ });
    expect(renamed).toHaveAttribute('href', '/decks/d2');
    expect(screen.queryByText('Vecchio nome')).not.toBeInTheDocument();
  });
});
