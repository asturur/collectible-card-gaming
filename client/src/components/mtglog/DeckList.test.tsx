import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckList from './DeckList';
import { MemoryRouter } from 'react-router';
import { listSavedDecks } from '../../services/savedDecks';
vi.mock('../../services/savedDecks', () => ({ listSavedDecks: vi.fn(), subscribeSavedDecks: () => () => {} }));
vi.mock('./DeckEditor', () => ({ DECK_FORMATS: ['Modern', 'Commander'] }));
vi.mock('./DeckCards', () => ({ default: () => null }));
const cardData: Record<string, { keywords: string[]; oracle: string }> = {
  'Fiery Temper': { keywords: ['Madness'], oracle: 'Madness {R}' },
  Opt: { keywords: ['Scry'], oracle: 'Scry 1. Draw a card.' },
};
vi.mock('../../services/scryfall', () => ({ getCard: (name: string) => cardData[name], isMissing: () => false }));
vi.mock('./useDeckImages', () => ({ useDeckImages: () => {} }));
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
    // I colori stanno nel pannello Filtri, come gli altri filtri.
    expect(screen.queryByRole('button', { name: 'U' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filtri/ }));
    await user.click(screen.getByRole('button', { name: 'U' }));
    expect(screen.queryByRole('link', { name: /Other/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Own/ })).toHaveAttribute('href', '/decks/own');
    await user.click(screen.getByRole('button', { name: 'Nessun filtro' }));
    await user.click(screen.getByRole('button', { name: 'G' }));
    expect(screen.queryByRole('link', { name: /Own/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Other/ })).toHaveAttribute('href', '/decks/other');
    await user.click(screen.getByRole('button', { name: 'Mostra 1 mazzo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Il colore scelto resta visibile in cima e si toglie con un tocco.
    await user.click(screen.getByRole('button', { name: 'Togli il filtro Colore' }));
    expect(screen.getByRole('link', { name: /Own/ })).toBeInTheDocument();
  });
  it('filters by card name, keyword and rules text from the Filtri panel, and shows why a deck matches', async () => {
    const deck = (id: string, cards: string[]) => ({ id, name: id, createdBy: 'me', colors: [], format: '', source: 'brew', cards: [], revision: 0,
      cardRows: cards.map((name) => ({ name, qty: 1, section: 'main', scryfallId: null })) });
    vi.mocked(listSavedDecks).mockResolvedValue([deck('Rosso', ['Fiery Temper', 'Sol Ring']), deck('Blu', ['Opt'])] as never);
    const user = userEvent.setup(); render(<MemoryRouter><DeckList {...props()} /></MemoryRouter>); await screen.findByRole('link', { name: /Blu/ });

    await user.click(screen.getByRole('button', { name: /Filtri/ }));
    await user.selectOptions(screen.getByLabelText('Parola chiave'), 'Madness');
    expect(screen.getByRole('option', { name: 'Madness (1 mazzo)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostra 1 mazzo' }));
    expect(screen.queryByRole('link', { name: /Blu/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rosso/ })).toHaveTextContent('Madness ×1');

    // Il filtro attivo resta visibile e si toglie con un tocco.
    await user.click(screen.getByRole('button', { name: 'Togli il filtro Parola chiave: Madness' }));
    expect(screen.getByRole('link', { name: /Blu/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filtri/ }));
    await user.type(screen.getByLabelText('Testo della carta'), 'draw');
    await user.type(screen.getByLabelText('Nome carta'), 'op');
    await user.click(screen.getByRole('button', { name: 'Mostra 1 mazzo' }));
    expect(screen.getByRole('link', { name: /Blu/ })).toHaveTextContent('Opt · «draw» in 1 carta');
    expect(screen.queryByRole('link', { name: /Rosso/ })).not.toBeInTheDocument();
  });
});
