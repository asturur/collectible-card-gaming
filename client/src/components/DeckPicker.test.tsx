import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckPicker from './DeckPicker';
import { fetchDeckList, fetchDeck } from '../services/mtgjson';
import { listSavedDecks, getSavedDeck } from '../services/savedDecks';
import type { SavedDeck } from '../services/savedDecks';
vi.mock('../services/mtgjson', async original => ({ ...await original<object>(), fetchDeckList: vi.fn(), fetchDeck: vi.fn() }));
vi.mock('../services/savedDecks', () => ({ listSavedDecks: vi.fn(), getSavedDeck: vi.fn(), subscribeSavedDecks: () => () => {} }));
const row = { name: 'Island', qty: 2, section: 'main' as const, scryfallId: 'id', imageUrl: 'front.jpg', typeLine: 'Land' };
const decks = [{ id: 'own-a', name: 'Duplicate', createdBy: 'own' }, { id: 'other-b', name: 'Duplicate', createdBy: 'other' }, { id: 'legacy', name: 'Legacy', createdBy: null }]
  .map(d => ({ ...d, format: '', source: 'brew', revision: 0, cards: [row], cardRows: [row] })) as SavedDeck[];
beforeEach(() => {
  vi.mocked(listSavedDecks).mockResolvedValue(decks); vi.mocked(getSavedDeck).mockImplementation(async id => decks.find(d => d.id === id)!);
  vi.mocked(fetchDeckList).mockResolvedValue([{ fileName: 'precon', name: 'Precon', type: 'Commander' }] as never);
  vi.mocked(fetchDeck).mockResolvedValue({ name: 'Precon', type: 'Commander', mainBoard: [{ name: 'Island', count: 3, type: 'Land', identifiers: { scryfallId: 'premade-id' } }], sideBoard: [], commander: [] } as never);
});
describe('saved and premade selection', () => {
  it('lists all creators and duplicate names; reads the chosen deck fresh', async () => {
    const user = userEvent.setup(); const selected = vi.fn(); render(<DeckPicker onDeckSelected={selected} />);
    const dropdown = screen.getByLabelText('Saved deck (Registro)');
    await waitFor(() => expect(dropdown).toBeEnabled());
    expect(screen.getByRole('option', { name: 'Duplicate · own-a' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Duplicate · ther-b' })).toBeInTheDocument();
    await user.selectOptions(dropdown, 'other-b'); await user.click(screen.getByRole('button', { name: 'Preview Deck' }));
    expect(getSavedDeck).toHaveBeenCalledWith('other-b'); expect(selected.mock.calls[0][0].source).toMatchObject({ kind: 'saved', id: 'other-b' });
  });
  it('allows saved decks when MTGJSON is unavailable', async () => {
    vi.mocked(fetchDeckList).mockRejectedValue(new Error('Offline'));
    const user = userEvent.setup(); const selected = vi.fn(); render(<DeckPicker onDeckSelected={selected} />);
    await waitFor(() => expect(screen.getByLabelText('Saved deck (Registro)')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Saved deck (Registro)'), 'legacy');
    await user.click(screen.getByRole('button', { name: 'Preview Deck' })); expect(selected).toHaveBeenCalled();
  });
  it('clears the other source selection and preserves MTGJSON counts', async () => {
    const user = userEvent.setup(); const selected = vi.fn(); render(<DeckPicker onDeckSelected={selected} />);
    await waitFor(() => expect(screen.getByLabelText('Saved deck (Registro)')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Saved deck (Registro)'), 'legacy');
    await user.selectOptions(screen.getByLabelText('MTGJSON deck type'), 'Commander');
    await user.selectOptions(screen.getByLabelText('Premade deck'), 'precon');
    expect(screen.getByLabelText('Saved deck (Registro)')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Preview Deck' }));
    expect(selected.mock.calls[0][0].mainBoard[0]).toMatchObject({ count: 3, scryfallId: 'premade-id' });
  });
});
