import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckList from './DeckList';
import { MemoryRouter } from 'react-router';
import { listSavedDecks } from '../../services/savedDecks';
vi.mock('../../services/savedDecks', () => ({ listSavedDecks: vi.fn(), subscribeSavedDecks: () => () => {} }));
vi.mock('./DeckEditor', () => ({ DECK_FORMATS: ['Modern', 'Commander'] }));
vi.mock('./DeckCards', () => ({ default: () => null }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listSavedDecks).mockResolvedValue([]); });
const props = () => ({ onCreate: vi.fn(), onImportFile: vi.fn() });
describe('Registro import and list controls', () => {
  it('opens manual entry from the shared creation dialog', async () => {
    const p = props(); const user = userEvent.setup(); render(<MemoryRouter><DeckList {...p} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /Crea Nuovo Mazzo/ }));
    await user.click(screen.getByRole('button', { name: /Inserimento manuale/ })); expect(p.onCreate).toHaveBeenCalled();
  });
  it('imports pasted sections and merges duplicate groups before editing', async () => {
    const p = props(); const user = userEvent.setup(); render(<MemoryRouter><DeckList {...p} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /Crea Nuovo Mazzo/ })); await user.click(screen.getByRole('button', { name: /Incolla Elenco da Testo/ }));
    await user.type(screen.getByRole('textbox'), 'Deck\n2 Island\n1 Island\nSideboard\n1 Forest');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    expect(p.onImportFile).toHaveBeenCalledWith('', [{ name: 'Island', qty: 3, section: 'main' }, { name: 'Forest', qty: 1, section: 'side' }]);
  });
  it('imports a ManaBox file and keeps set and collector number', async () => {
    const p = props(); const user = userEvent.setup(); const { container } = render(<MemoryRouter><DeckList {...p} /></MemoryRouter>);
    await user.upload(container.querySelector('input[type="file"]')!, new File(['2 Island (SET) 123\nSideboard\n1 Forest'], 'Test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(p.onImportFile).toHaveBeenCalledWith('Test', [{ name: 'Island', qty: 2, section: 'main', setCode: 'set', collectorNumber: '123' }, { name: 'Forest', qty: 1, section: 'side' }]));
  });
  it('preserves filters and links directly to the saved deck without opening a dialog', async () => {
    const rows = [{ id: 'own', name: 'Own', createdBy: 'own', colors: ['U'], format: 'Modern' }, { id: 'other', name: 'Other', createdBy: 'other', colors: ['G'], format: 'Commander' }]
      .map(d => ({ ...d, source: 'brew', cards: [{ name: 'Island', qty: 1 }], cardRows: [], revision: 0 }));
    vi.mocked(listSavedDecks).mockResolvedValue(rows as never);
    const user = userEvent.setup(); render(<MemoryRouter><DeckList {...props()} /></MemoryRouter>); await screen.findByRole('link', { name: /Other/ });
    await user.click(screen.getByRole('button', { name: 'U' }));
    expect(screen.queryByRole('link', { name: /Other/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Own/ })).toHaveAttribute('href', '/decks/own');
    await user.click(screen.getByRole('button', { name: 'Nessun filtro' }));
    await user.click(screen.getByRole('button', { name: 'G' }));
    expect(screen.queryByRole('link', { name: /Own/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Other/ })).toHaveAttribute('href', '/decks/other');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
