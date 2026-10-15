import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import GameStats from './GameStats';
import Standings from './Standings';
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
    ...[3, 4, 5, 6].map((n) => ({ id: 'g' + n, date: '2026-10-09', players: [
      { name: 'Alice', deck: 'Elfi', winner: false }, { name: 'Bob', deck: 'Vecchio nome', deckId: 'd2', winner: true },
    ] })),
    // Senza vincitore: non conta nelle statistiche.
    { id: 'g7', date: '2026-10-10', players: [
      { name: 'Alice', deck: 'Partita interrotta', winner: false }, { name: 'Bob', deck: 'Elfi', winner: false },
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

  it('filters the deck list by name while the export keeps every deck', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><GameStats /></MemoryRouter>);
    await screen.findByRole('link', { name: /Elfi/ });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle statistiche dei mazzi' }), ' goblin ');
    expect(screen.getByRole('link', { name: /Goblin Rinominati/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Elfi/ })).not.toBeInTheDocument();
    const exportCard = screen.getByRole('heading', { name: 'Statistiche Mazzi', hidden: true }).closest('[aria-hidden="true"]') as HTMLElement;
    expect(exportCard).toHaveTextContent('Elfi');

    await user.clear(screen.getByRole('searchbox', { name: 'Cerca nelle statistiche dei mazzi' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle statistiche dei mazzi' }), 'zzz');
    expect(screen.getByText('Nessun mazzo corrisponde alla ricerca.')).toBeInTheDocument();
  });
});

describe('Deck statistics ranking', () => {
  it('ranks win rate only from 5 games and leaves the others below, without games lacking a winner', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><GameStats /></MemoryRouter>);
    await screen.findByRole('link', { name: /Elfi/ });
    expect(screen.queryByText('Partita interrotta')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Elfi/ })).toHaveTextContent('6 partite · 1 vittorie · 17%');
    await user.click(screen.getByRole('button', { name: '% di vittoria' }));
    const note = screen.getAllByText(/^Meno di 5 partite: fuori dalla classifica/)[0];
    const order = [screen.getByRole('link', { name: /Goblin Rinominati/ }), screen.getByRole('link', { name: /Elfi/ }), note, screen.getAllByText('Mazzo cancellato')[0]];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('Player statistics search', () => {
  it('filters the player list by name, ignoring case', async () => {
    const user = userEvent.setup();
    const rows = [{ name: 'Alice', g: 3, w: 2 }, { name: 'Bob', g: 2, w: 1 }];
    render(<MemoryRouter><Standings rows={rows} showPie={false} /></MemoryRouter>);
    const list = () => within(screen.getByRole('list'));
    expect(list().getAllByRole('link')).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle statistiche dei giocatori' }), 'BOB');
    expect(list().getAllByRole('link')).toHaveLength(1);
    expect(list().getByRole('link', { name: /Bob/ })).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Cerca nelle statistiche dei giocatori' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca nelle statistiche dei giocatori' }), 'zzz');
    expect(screen.getByText('Nessun giocatore corrisponde alla ricerca.')).toBeInTheDocument();
  });
});
