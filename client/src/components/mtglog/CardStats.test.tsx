import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import CardStats from './CardStats';
import type { Game } from './GameList';

const card = (name: string, qty: number, typeLine = 'Instant') => ({ name, qty, typeLine, section: 'main', scryfallId: name + '-id' });
vi.mock('./useSavedDeck', () => ({
  useSavedDeckList: () => ({ loading: false, error: '', decks: [
    { id: 'A', name: 'Blu', cardRows: [card('Counterspell', 2), card('Island', 30, 'Basic Land — Island')] },
    { id: 'B', name: 'Rosso', cardRows: [card('Lightning Bolt', 4)] },
  ] }),
}));
vi.mock('./useDeckImages', () => ({ useDeckImages: () => {} }));
vi.mock('../../services/scryfall', () => ({ getCard: () => undefined }));
vi.mock('./CardPrices', () => ({ CardPriceBox: () => null }));

let n = 0;
const game = (format: string, winner: 'Andrea' | 'Carlo'): Game => ({
  id: 'g' + n++, date: new Date().toISOString().slice(0, 10), format, notes: '', group: '', createdBy: null, startedAt: null, endedAt: null,
  players: [
    { name: 'Andrea', deck: 'Blu', deckId: 'A', desc: '', life: 0, winner: winner === 'Andrea', colors: ['U'] },
    { name: 'Carlo', deck: 'Rosso', deckId: 'B', desc: '', life: 0, winner: winner === 'Carlo', colors: ['R'] },
  ],
});
const games = [...Array.from({ length: 4 }, () => game('Pauper', 'Andrea')), game('Pauper', 'Carlo'), game('Commander', 'Carlo')];

describe('CardStats', () => {
  it('lists cursed cards by the wins they missed against the group average', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CardStats games={games} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Maledette' }));
    // Media 6 vittorie su 12 presenze: Lightning Bolt (2 su 6) ne attendeva 3, ne ha mancata 1.
    // La lista compare anche nella copia nascosta usata per l'immagine esportata.
    const row = screen.getAllByText('Lightning Bolt')[0].closest('li')!;
    expect(row).toHaveTextContent('2 vittorie su 6 partite · attese 3,0');
    expect(row).toHaveTextContent('−1,0');
    expect(screen.queryByText('Counterspell')).not.toBeInTheDocument();
  });

  it('shows most played cards by copies, without lands, and switches to win rates', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CardStats games={games} /></MemoryRouter>);
    const list = () => within(screen.getAllByRole('list')[0]);
    expect(list().getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Lightning Bolt24 copie in 6 partite'),
      expect.stringContaining('Counterspell12 copie in 6 partite'),
    ]);
    expect(screen.queryByText(/Island/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Più vincenti' }));
    expect(screen.getAllByText(/Media del gruppo/)[0]).toHaveTextContent('Media del gruppo: 50%');
    expect(list().getAllByRole('listitem')[0]).toHaveTextContent('Counterspell4 vittorie su 6 partite67%');
    expect(screen.getByRole('link', { name: /Come si calcola/ })).toHaveAttribute('href', '/faq/cards/winners');

    await user.selectOptions(screen.getByLabelText('Formato'), 'Commander');
    expect(screen.getAllByText('Nessuna carta con almeno 5 partite in questo filtro.')[0]).toBeInTheDocument();
    expect(screen.getByText(/1 partite su 1 con lista carte/)).toBeInTheDocument();
  });
});
