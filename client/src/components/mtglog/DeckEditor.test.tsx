import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckEditor from './DeckEditor';
import { getSavedDeck, saveSavedDeck, findDeckWithSameName, DeckConflictError, UnresolvedCardsError } from '../../services/savedDecks';
vi.mock('../../services/savedDecks', () => ({ getSavedDeck: vi.fn(), saveSavedDeck: vi.fn(), findDeckWithSameName: vi.fn(),
  DeckConflictError: class extends Error { constructor() { super('Changed'); } }, UnresolvedCardsError: class extends Error { constructor(names: string[]) { super(names.join(', ')); } } }));
vi.mock('../../services/scryfall', () => ({ autocompleteCards: vi.fn(async () => []) }));
vi.mock('./DeckStats', () => ({ DeckStatsButton: () => null }));
vi.mock('./DeckCards', () => ({ useDeckImages: () => {}, default: ({ cards, editable }: { cards: { name: string; qty: number }[]; editable: { onChangeQty: (card: unknown, delta: number) => void } }) => <div>{cards.map(c => <button key={c.name} onClick={() => editable.onChangeQty(c, -1)}>Remove {c.name} ({c.qty})</button>)}</div> }));
const deck = { id: 'deck', name: 'Saved', source: 'brew', format: 'Modern', colors: ['U'], revision: 4,
  cards: [{ name: 'Island', qty: 2, section: 'main', scryfallId: 'original-id', oracleId: 'original-oracle' }, { name: 'Forest', qty: 1, section: 'side' }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSavedDeck).mockResolvedValue(deck as never); vi.mocked(saveSavedDeck).mockResolvedValue(); vi.mocked(findDeckWithSameName).mockResolvedValue(null); });
describe('Registro save controls', () => {
  it('shows a missing-deck error without offering an empty editor', async () => {
    vi.mocked(getSavedDeck).mockRejectedValueOnce(new Error('Questo mazzo non esiste più.'));
    render(<DeckEditor deckId="missing" userId="u1" onBack={() => {}} onSaved={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Questo mazzo non esiste più.');
    expect(screen.queryByLabelText('Nome mazzo')).not.toBeInTheDocument();
    expect(saveSavedDeck).not.toHaveBeenCalled();
  });
  it('prevents editing a saved deck owned by another user', async () => {
    vi.mocked(getSavedDeck).mockResolvedValueOnce({ ...deck, createdBy: 'u2' } as never);
    render(<DeckEditor deckId="deck" userId="u1" onBack={() => {}} onSaved={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Puoi modificare solo i mazzi che hai salvato.');
    expect(screen.queryByRole('button', { name: 'Salva Modifiche' })).not.toBeInTheDocument();
  });
  it('preserves IDs/format/colors and removes a group at zero copies', async () => {
    const user = userEvent.setup(); const saved = vi.fn(); render(<DeckEditor deckId="deck" onBack={() => {}} onSaved={saved} />);
    await screen.findByDisplayValue('Saved'); await user.click(screen.getByRole('button', { name: 'Remove Forest (1)' }));
    await user.click(screen.getByRole('button', { name: 'Remove Island (2)' }));
    await user.click(screen.getByRole('button', { name: 'Salva Modifiche' }));
    expect(saveSavedDeck).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 4, format: 'Modern', colors: ['U'], cards: [expect.objectContaining({ qty: 1, scryfallId: 'original-id', oracleId: 'original-oracle' })] }), expect.anything());
    expect(saved).toHaveBeenCalledWith('deck');
  });
  it('keeps the draft on failure and offers an explicit unresolved save', async () => {
    vi.mocked(saveSavedDeck).mockRejectedValueOnce(new UnresolvedCardsError(['Unknown']));
    const user = userEvent.setup(); render(<DeckEditor deckId={null} initialDraft={{ name: 'Draft', cards: [{ name: 'Unknown', qty: 1 }] }} onBack={() => {}} onSaved={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Salva Mazzo' }));
    expect(screen.getByLabelText('Nome mazzo')).toHaveValue('Draft');
    await user.click(await screen.findByRole('button', { name: /Salva solo per il registro/ }));
    expect(saveSavedDeck).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Draft' }), expect.objectContaining({ allowUnresolved: true }));
  });
  it('confirms overwrite using the fresh revision and rejects a second conflict', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(getSavedDeck).mockResolvedValueOnce(deck as never).mockResolvedValueOnce({ ...deck, revision: 5 } as never);
    vi.mocked(saveSavedDeck).mockRejectedValue(new DeckConflictError());
    const user = userEvent.setup(); const saved = vi.fn(); render(<DeckEditor deckId="deck" onBack={() => {}} onSaved={saved} />);
    await screen.findByDisplayValue('Saved'); await user.click(screen.getByRole('button', { name: 'Salva Modifiche' }));
    await waitFor(() => expect(saveSavedDeck).toHaveBeenCalledTimes(2));
    expect(saveSavedDeck).toHaveBeenLastCalledWith(expect.objectContaining({ expectedRevision: 5 }), expect.anything());
    expect(saved).not.toHaveBeenCalled(); expect(await screen.findByRole('alert')).toHaveTextContent('Changed');
  });
  it('allows cancel during lookup and locks it during the atomic write', async () => {
    let done: () => void = () => {};
    vi.mocked(saveSavedDeck).mockImplementation(async (_input, options) => { options?.onPersisting?.(); await new Promise<void>(resolve => { done = resolve; }); });
    const user = userEvent.setup(); const busy = vi.fn(); render(<DeckEditor deckId={null} initialDraft={{ name: 'Draft', cards: [{ name: 'Island', qty: 1 }] }} onBack={() => {}} onSaved={() => {}} onPersistingChange={busy} />);
    await user.click(screen.getByRole('button', { name: 'Salva Mazzo' }));
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled(); expect(busy).toHaveBeenCalledWith(true);
    done(); await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
  });
  it('routes Commander precon import through the same atomic save', async () => {
    localStorage.removeItem('mtg:precon-cache');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ name: 'Commander Test', commander: [{ name: 'Commander', count: 1 }], cards: [{ name: 'Island', count: 2 }, { name: 'Island', count: 1 }] }]))));
    const user = userEvent.setup(); render(<DeckEditor deckId={null} onBack={() => {}} onSaved={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Importa un mazzo precon Commander/ }));
    await user.type(screen.getByPlaceholderText(/Cerca il nome del precon/), 'Commander');
    await user.click(await screen.findByRole('button', { name: /Commander Test/ }));
    await user.click(screen.getByRole('button', { name: 'Salva Mazzo' }));
    expect(saveSavedDeck).toHaveBeenCalledWith(expect.objectContaining({ name: 'Commander Test', source: 'precon', cards: [{ name: 'Commander', qty: 1, section: 'main' }, { name: 'Island', qty: 3, section: 'main' }] }), expect.anything());
    vi.unstubAllGlobals();
  });
  it('asks to shorten a saved name longer than the limit instead of cutting it', async () => {
    vi.mocked(getSavedDeck).mockResolvedValueOnce({ ...deck, name: 'mono_black_devotion_pauper_meta_2026' } as never);
    const user = userEvent.setup(); render(<DeckEditor deckId="deck" onBack={() => {}} onSaved={() => {}} />);
    await screen.findByDisplayValue('mono_black_devotion_pauper_meta_2026');
    expect(screen.getByText('36/30')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva Modifiche' }));
    expect(screen.getByText('Il nome del mazzo ha 36 caratteri: il massimo è 30. Accorcialo prima di salvare.')).toBeInTheDocument();
    expect(saveSavedDeck).not.toHaveBeenCalled();
  });
  it('refuses a name already used by another deck, ignoring case and spaces', async () => {
    vi.mocked(findDeckWithSameName).mockResolvedValueOnce('Mono Black');
    const user = userEvent.setup(); render(<DeckEditor deckId={null} initialDraft={{ name: ' mono black ', cards: [{ name: 'Swamp', qty: 1 }] }} onBack={() => {}} onSaved={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Salva Mazzo' }));
    expect(await screen.findByText('Esiste già un mazzo chiamato "Mono Black": scegli un nome diverso.')).toBeInTheDocument();
    expect(findDeckWithSameName).toHaveBeenCalledWith('mono black', expect.any(String));
    expect(saveSavedDeck).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome mazzo')).toHaveValue(' mono black ');
  });

});
