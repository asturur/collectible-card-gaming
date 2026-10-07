import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckList from './DeckList';
import { listSavedDecks, deleteSavedDeck } from '../../services/savedDecks';
vi.mock('../../services/savedDecks', () => ({ listSavedDecks: vi.fn(), deleteSavedDeck: vi.fn(), subscribeSavedDecks: () => () => {} }));
vi.mock('./DeckEditor', () => ({ DECK_FORMATS: ['Modern', 'Commander'] }));
vi.mock('./DeckCards', () => ({ default: () => null }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listSavedDecks).mockResolvedValue([]); });
const props = () => ({ userId: 'own', onCreate: vi.fn(), onEdit: vi.fn(), onImportFile: vi.fn() });
describe('Registro import and list controls', () => {
  it('opens manual entry from the shared creation dialog', async () => {
    const p = props(); const user = userEvent.setup(); render(<DeckList {...p} />);
    await user.click(screen.getByRole('button', { name: /Crea Nuovo Mazzo/ }));
    await user.click(screen.getByRole('button', { name: /Inserimento manuale/ })); expect(p.onCreate).toHaveBeenCalled();
  });
  it('imports pasted sections and merges duplicate groups before editing', async () => {
    const p = props(); const user = userEvent.setup(); render(<DeckList {...p} />);
    await user.click(screen.getByRole('button', { name: /Crea Nuovo Mazzo/ })); await user.click(screen.getByRole('button', { name: /Incolla elenco/ }));
    await user.type(screen.getByRole('textbox'), 'Deck\n2 Island\n1 Island\nSideboard\n1 Forest');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(p.onImportFile).toHaveBeenCalledWith('', [{ name: 'Island', qty: 3, section: 'main' }, { name: 'Forest', qty: 1, section: 'side' }]);
  });
  it('imports a ManaBox file and ignores printing hints', async () => {
    const p = props(); const user = userEvent.setup(); const { container } = render(<DeckList {...p} />);
    await user.upload(container.querySelector('input[type="file"]')!, new File(['2 Island (SET) 123\nSideboard\n1 Forest'], 'Test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(p.onImportFile).toHaveBeenCalledWith('Test', [{ name: 'Island', qty: 2, section: 'main' }, { name: 'Forest', qty: 1, section: 'side' }]));
  });
  it('preserves format/color filters and allows deleting only own or legacy decks', async () => {
    const rows = [{ id: 'own', name: 'Own', createdBy: 'own', colors: ['U'], format: 'Modern' }, { id: 'other', name: 'Other', createdBy: 'other', colors: ['G'], format: 'Commander' }]
      .map(d => ({ ...d, source: 'brew', cards: [{ name: 'Island', qty: 1 }], cardRows: [], revision: 0 }));
    vi.mocked(listSavedDecks).mockResolvedValue(rows as never); vi.mocked(deleteSavedDeck).mockResolvedValue(); vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup(); render(<DeckList {...props()} />); await screen.findByRole('button', { name: /Other/ });
    await user.click(screen.getByRole('button', { name: 'Modern' }));
    expect(screen.queryByRole('button', { name: /Other/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Own/ })); await user.click(screen.getByRole('button', { name: /Cancella/ }));
    expect(deleteSavedDeck).toHaveBeenCalledWith('own');
  });
});
