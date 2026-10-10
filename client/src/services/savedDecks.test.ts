import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), resolve: vi.fn(), cached: vi.fn(), getCard: vi.fn() }));
vi.mock('./supabase', () => ({ sameName: (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase(), supabase: { rpc: mocks.rpc, from: mocks.from }, TABLE_DECKS: 'mazzi', TABLE_DECK_CARDS: 'mazzi-cards', subscribeToTable: () => () => {} }));
vi.mock('./scryfall', () => ({ getCard: mocks.getCard }));
vi.mock('./scryfallLookup', async original => ({ ...await original<object>(), resolveScryfallNames: mocks.resolve, cachedScryfallCard: mocks.cached }));
import { saveSavedDeck, getSavedDeck, findDeckWithSameName, DeckConflictError, UnresolvedCardsError, CardLookupError } from './savedDecks';
const raw = { name: 'Forest', id: 'new-id', oracle_id: 'new-oracle', image_uris: { normal: 'https://cards.scryfall.io/new' }, type_line: 'Land' };
const stored = { id: 'row', name: 'Island', qty: 1, section: 'main', position: 0, scryfall_id: 'stored-id', oracle_id: 'stored-oracle', image_url: 'https://cards.scryfall.io/stored', type_line: 'Land' };
const row = { id: 'deck', name: 'Deck', cards: [{ name: 'Island', qty: 1 }], card_rows: [stored], revision: 4, created_by: 'user' };
const input = { id: 'deck', name: 'New name', source: 'brew', format: 'Modern', colors: ['U'], cards: [{ name: 'Island', qty: 3, scryfallId: 'wrong' }, { name: 'Forest', qty: 2, section: 'side' as const }], expectedRevision: 4 };
beforeEach(() => {
  vi.clearAllMocks(); mocks.getCard.mockReturnValue(undefined); mocks.cached.mockReturnValue(undefined);
  mocks.rpc.mockResolvedValue({ error: null }); mocks.resolve.mockResolvedValue(new Map([['forest', raw]]));
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) });
});
describe('deck name uniqueness', () => {
  it('finds another deck with the same name, ignoring case, spaces and the deck itself', async () => {
    mocks.from.mockReturnValue({ select: async () => ({ data: [{ id: 'a', name: 'Mono Black' }, { id: 'b', name: 'Elfi' }], error: null }) });
    await expect(findDeckWithSameName(' mono BLACK ', 'b')).resolves.toBe('Mono Black');
    await expect(findDeckWithSameName('Mono Black', 'a')).resolves.toBeNull();
    await expect(findDeckWithSameName('mono_black', 'b')).resolves.toBeNull();
  });
});
describe('atomic saved deck service', () => {
  it('keeps assigned identity, resolves new groups only, and submits revision plus all metadata', async () => {
    await saveSavedDeck(input);
    expect(mocks.resolve).toHaveBeenCalledWith(['Forest'], undefined);
    expect(mocks.rpc).toHaveBeenCalledWith('save_deck', expect.objectContaining({ p_expected_revision: 4, p_format: 'Modern', p_source: 'brew', p_colors: ['U'], p_cards: [
      expect.objectContaining({ name: 'Island', qty: 3, scryfall_id: 'stored-id', oracle_id: 'stored-oracle' }),
      expect.objectContaining({ name: 'Forest', qty: 2, section: 'side', scryfall_id: 'new-id' }),
    ] }));
  });
  it('does not write on unresolved lookup unless explicitly permitted', async () => {
    mocks.resolve.mockResolvedValue(new Map()); await expect(saveSavedDeck(input)).rejects.toBeInstanceOf(UnresolvedCardsError);
    expect(mocks.rpc).not.toHaveBeenCalled(); await saveSavedDeck(input, { allowUnresolved: true });
    expect(mocks.rpc).toHaveBeenCalledWith('save_deck', expect.objectContaining({ p_allow_unresolved: true }));
  });
  it('reuses a verified lookup cached during a failed strict save for the explicit unresolved save', async () => {
    mocks.cached.mockImplementation(name => name === 'Forest' ? raw : undefined);
    await saveSavedDeck(input, { allowUnresolved: true });
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].p_cards[1].scryfall_id).toBe('new-id');
  });
  it('surfaces stale transaction rejection and never silently retries', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '40001', message: 'DECK_CONFLICT' } });
    await expect(saveSavedDeck(input)).rejects.toBeInstanceOf(DeckConflictError); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('cancellation before persistence causes no database write', async () => {
    const abort = new AbortController(); abort.abort();
    await expect(saveSavedDeck(input, { signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuses truncated or inconsistent child data', async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...row, card_rows: [] }, error: null }) }) }) });
    await expect(getSavedDeck('deck')).rejects.toThrow('sincronizzate');
  });
  it('offers an explicit log-only save after a network failure without caching a miss', async () => {
    mocks.resolve.mockRejectedValue(new Error('Scryfall: HTTP 503'));
    await expect(saveSavedDeck(input)).rejects.toBeInstanceOf(CardLookupError);
    expect(mocks.rpc).not.toHaveBeenCalled();
    await saveSavedDeck(input, { allowUnresolved: true });
    expect(mocks.rpc.mock.calls[0][1].p_allow_unresolved).toBe(true);
  });

});
