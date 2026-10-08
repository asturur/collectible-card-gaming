import { useEffect } from 'react';
import { getSavedDeck, deleteSavedDeck, type SavedDeck } from './services/savedDecks';
import { transferableAbortController } from 'node:util';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { appRoutes } from './App';
import { appHref, paths } from './router';
import { gameLink, type Game } from './components/mtglog/GameList';

const mock = vi.hoisted(() => ({
  session: { user: { id: 'u1', email: 'test@example.com' } } as unknown,
  authListener: (_event: string, _session: unknown) => {},
  rows: [] as Record<string, unknown>[],
  /** Id che l'elenco condiviso non restituisce ancora (ma la lettura per id sì). */
  hiddenFromList: [] as string[],
  gamesError: null as { message: string } | null,
  subscribers: new Map<string, Set<() => void>>(),
}));

vi.mock('./services/supabase', () => ({
  isSupabaseConfigured: true,
  TABLE_GAMES: 'partite', TABLE_DECKS: 'mazzi',
  canEdit: (owner: string | null, user: string) => !owner || owner === user,
  subscribeToTable: (table: string, onChange: () => void) => {
    const subscribers = mock.subscribers.get(table) ?? new Set();
    subscribers.add(onChange);
    mock.subscribers.set(table, subscribers);
    return () => { subscribers.delete(onChange); };
  },
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: mock.session } }),
      onAuthStateChange: (listener: typeof mock.authListener) => {
        mock.authListener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: vi.fn(),
    },
    from: (table: string) => {
      let wantedId: unknown = null;
      const query = {
        select: () => query,
        order: () => query,
        eq: (_column: string, value: unknown) => { wantedId = value; return query; },
        maybeSingle: () => Promise.resolve({
          data: (table === 'partite' ? mock.rows : []).find((r) => r.id === wantedId) ?? null,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'partite' ? mock.rows.filter((r) => !mock.hiddenFromList.includes(String(r.id))) : [], count: 2, error: table === 'partite' ? mock.gamesError : null }).then(resolve),
      };
      return query;
    },
  },
}));

vi.mock('./services/savedDecks', () => ({
  getSavedDeck: vi.fn(), deleteSavedDeck: vi.fn(), listSavedDecks: vi.fn(async () => []),
  subscribeSavedDecks: (onChange: () => void) => {
    const subscribers = mock.subscribers.get('saved-decks') ?? new Set();
    subscribers.add(onChange);
    mock.subscribers.set('saved-decks', subscribers);
    return () => { subscribers.delete(onChange); };
  },
}));
vi.mock('./components/mtglog/DeckCards', () => ({ default: ({ cards, statsTo }: { cards: { name: string; qty: number }[]; statsTo?: string }) => <>
  <p>{cards.map(c => `${c.qty} ${c.name}`).join(', ')}</p>
  {statsTo && <Link to={statsTo}>Statistiche del mazzo</Link>}
</> }));
vi.mock('./components/mtglog/useDeckImages', () => ({ useDeckImages: () => {}, useTokenImages: () => {} }));

vi.mock('./components/mtglog/AuthScreen', () => ({ default: () => <h1>Accedi al registro</h1> }));
vi.mock('./components/mtglog/PlayersRoster', () => ({ default: () => <p>Rubrica</p> }));
vi.mock('./components/mtglog/GameStats', () => ({ default: () => <p>Grafici mazzi</p> }));
vi.mock('./components/mtglog/DeckList', () => ({ default: ({ onCreate, onImportFile }: {
  onCreate: () => void;
  onImportFile: (name: string, cards: { name: string; qty: number }[]) => void;
}) => <>
  <button onClick={onCreate}>Crea mazzo</button>
  <button onClick={() => onImportFile('Importato', [{ name: 'Island', qty: 2 }])}>Importa mazzo</button>
</> }));
vi.mock('./components/mtglog/DeckEditor', () => ({ default: ({ deckId, initialDraft, onSaved, onLoaded, onBack, onPersistingChange }: {
  deckId: string | null; initialDraft?: { name: string }; onSaved: (id: string) => void;
  onLoaded: (name: string) => void; onBack: () => void; onPersistingChange: (busy: boolean) => void;
}) => {
  useEffect(() => { if (deckId) onLoaded('Elfi'); }, [deckId, onLoaded]);
  return <>
    <p>Editor mazzo: {deckId ?? initialDraft?.name ?? 'nuovo'}</p>
    <button onClick={() => onPersistingChange(true)}>Inizia salvataggio mazzo</button>
    <button onClick={() => onPersistingChange(false)}>Termina salvataggio mazzo</button>
    <button onClick={() => onSaved(deckId ?? 'new-id')}>Salva mazzo</button>
    <button onClick={onBack}>Annulla mazzo</button>
  </>;
} }));
vi.mock('./components/mtglog/GameForm', () => ({ default: ({ editingGame, rematchFrom, onSaved, onSavingChange }: {
  editingGame?: Game | null; rematchFrom?: Game | null;
  onSaved: () => void; onSavingChange: (busy: boolean) => void;
}) => <>
  <p>Form partita: {editingGame?.id ?? (rematchFrom ? `rivincita ${rematchFrom.id}` : 'nuova')}</p>
  <p>Note iniziali: {editingGame?.notes ?? ''}</p>
  <button onClick={() => onSavingChange(true)}>Inizia salvataggio partita</button>
  <button onClick={onSaved}>Salva partita</button>
</> }));

function openApp(path: string, basename = '/') {
  const router = createMemoryRouter(appRoutes, { basename, initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}

const savedDeck: SavedDeck = {
  id: 'd1', name: 'Elfi', source: 'brew', colors: ['G'], format: 'Commander',
  createdBy: 'u1', revision: 1, cardRows: [], cards: [{ name: 'Forest', qty: 30 }],
};

beforeEach(() => {
  vi.mocked(getSavedDeck).mockReset().mockResolvedValue(savedDeck);
  vi.mocked(deleteSavedDeck).mockReset().mockResolvedValue();
  // React Router uses Node's Request in jsdom, which needs a matching AbortSignal.
  vi.stubGlobal('AbortController', transferableAbortController().constructor);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mock.session = { user: { id: 'u1', email: 'test@example.com' } };
  mock.subscribers.clear();
  mock.gamesError = null;
  mock.hiddenFromList = [];
  mock.rows = [{ id: 'g1', date: '2026-10-07', format: 'Commander', created_by: 'u1', players: [
    { name: 'Alice', deck: 'Draghi', colors: ['R'], life: 20, winner: true },
    { name: 'Bob', deck: 'Elfi', colors: ['G'], life: 0, winner: false },
  ] }];
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Registro routes', () => {
  it('opens a player from standings as a page, preserving personal deck totals and static export', async () => {
    mock.rows.push({ ...mock.rows[0], id: 'g2', players: [
      { name: 'Alice', deck: 'Draghi', winner: false }, { name: 'Bob', deck: 'Draghi', winner: true },
    ] }, { ...mock.rows[0], id: 'g3', players: [{ name: 'Bob', deck: 'Draghi', winner: true }] });
    const user = userEvent.setup();
    const { router } = openApp('/stats/players');
    const link = await screen.findByRole('link', { name: 'Alice' });
    expect(link).toHaveAttribute('href', '/stats/players/Alice');
    await user.click(link);
    expect(await screen.findByRole('heading', { name: 'Alice', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/stats/players/Alice');
    expect(screen.getAllByText('2 partite giocate · 1 vinte')).toHaveLength(2);
    expect(screen.getAllByText('2 partite · 1 vinte · 50%')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Esporta Immagine' })).toBeInTheDocument();
    const breadcrumbs = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(breadcrumbs).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Home', 'Statistiche', 'Giocatori', 'Alice']);
    expect(document.querySelector('[aria-hidden="true"] h2')?.closest('[aria-hidden="true"]')?.querySelector('a')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole('heading', { name: 'Statistiche Giocatori', level: 1 })).toBeInTheDocument();
    await act(async () => { await router.navigate(1); });
    expect(await screen.findByRole('heading', { name: 'Alice', level: 1 })).toBeInTheDocument();
  });

  it.each(['/stats/players/Alice', '/stats/matchups/Bob/vs/Alice/'])('restores %s after a fresh mount', async path => {
    const first = openApp(path);
    expect(await screen.findByRole('button', { name: 'Esporta Immagine' })).toBeInTheDocument();
    first.unmount();
    openApp(path);
    expect(await screen.findByRole('button', { name: 'Esporta Immagine' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it.each(['Andrea Rossi', 'Zoë/vs/50% + #1', 'Literal %2F'])('round-trips the player name %s without decoding it twice', async name => {
    (mock.rows[0].players as { name: string }[])[0].name = name;
    openApp(paths.player(name));
    expect(await screen.findByRole('heading', { name, level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Esporta Immagine' })).toBeInTheDocument();
  });

  it('keeps two-player statistics separate from multiplayer formations and ignores URL order', async () => {
    mock.rows.push({ ...mock.rows[0], id: 'g2', players: [
      { name: 'Bob', winner: true }, { name: 'Alice', winner: false },
    ] }, { ...mock.rows[0], id: 'g3', players: [
      { name: 'Alice', winner: true }, { name: 'Bob', winner: false }, { name: 'Carol', winner: false },
    ] });
    const user = userEvent.setup();
    const { router } = openApp('/stats/matchups');
    const link = await screen.findByRole('link', { name: 'Alice vs Bob 2 partite' });
    expect(link).toHaveAttribute('href', '/stats/matchups/Alice/vs/Bob');
    await user.click(link);
    expect(await screen.findByRole('heading', { name: 'Alice vs Bob', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('2 partite giocate tra queste formazioni')).toHaveLength(2);
    expect(screen.getAllByText('1 vittorie · 1 sconfitte · 50%')).toHaveLength(4);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const breadcrumbs = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(breadcrumbs).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Home', 'Statistiche', 'Sfide', 'Alice vs Bob']);
    await user.click(within(breadcrumbs).getByRole('link', { name: 'Sfide' }));
    await user.click(await screen.findByRole('link', { name: 'Alice vs Bob vs Carol 1 partita' }));
    expect(await screen.findByRole('heading', { name: 'Alice vs Bob vs Carol', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/stats/matchups/Alice/vs/Bob/vs/Carol');
    expect(screen.getAllByText('1 partite giocate tra queste formazioni')).toHaveLength(2);
    await act(async () => { await router.navigate('/stats/matchups/Bob/vs/Alice'); });
    expect(await screen.findByRole('heading', { name: 'Alice vs Bob', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('2 partite giocate tra queste formazioni')).toHaveLength(2);
  });

  it.each([
    ['Zoë/vs/50% + #1', 'Literal %2F'],
    ['Alice|Bob', 'Carol'],
  ])('preserves special names in matchup URLs: %s and %s', async (first, second) => {
    (mock.rows[0].players as { name: string }[])[0].name = first;
    (mock.rows[0].players as { name: string }[])[1].name = second;
    const names = [first, second].sort((a, b) => a.localeCompare(b));
    openApp(paths.matchup(names));
    expect(await screen.findByRole('heading', { name: names.join(' vs '), level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Esporta Immagine' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['/stats/players/missing', 'Nessuna partita registrata per questo giocatore.'],
    ['/stats/matchups/Alice/vs/Carol', 'Nessuna partita registrata con questa formazione.'],
    ['/stats/matchups/Alice', 'Indirizzo della sfida non valido.'],
    ['/stats/matchups/Alice/vs/Alice', 'Indirizzo della sfida non valido.'],
    ['/stats/matchups/Alice/vs/', 'Indirizzo della sfida non valido.'],
  ])('handles an unavailable or invalid statistics URL at %s', async (path, message) => {
    openApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(within(screen.getByRole('navigation', { name: 'Percorso di navigazione' })).getByRole('link', { name: 'Statistiche' })).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('button', { name: 'Esporta Immagine' })).not.toBeInTheDocument();
  });

  it.each(['/stats/players/Alice', '/stats/matchups/Alice/vs/Bob'])('keeps %s through login and updates when games disappear', async path => {
    mock.session = null;
    const { router } = openApp(path);
    expect(await screen.findByRole('heading', { name: 'Accedi al registro' })).toBeInTheDocument();
    await act(async () => { mock.authListener('SIGNED_IN', { user: { id: 'u1' } }); });
    expect(await screen.findByRole('button', { name: 'Esporta Immagine' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    mock.rows = [];
    await act(async () => { mock.subscribers.get('partite')?.forEach(onChange => onChange()); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nessuna partita registrata');
  });

  it.each(['/stats/players/Alice', '/stats/matchups/Alice/vs/Bob'])('shows shared-data failures at %s without a false empty state', async path => {
    mock.gamesError = { message: 'Riprova.' };
    openApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Non riesco a leggere il registro condiviso: Riprova.');
    expect(screen.queryByText(/Nessuna partita registrata/)).not.toBeInTheDocument();
  });

  it.each(['/stats/players', '/stats/matchups'])('builds drill-down links under the deployment base from %s', async path => {
    openApp('/collectible-card-gaming' + path, '/collectible-card-gaming');
    const link = await screen.findByRole('link', { name: path === '/stats/players' ? 'Alice' : 'Alice vs Bob 1 partita' });
    expect(link).toHaveAttribute('href', '/collectible-card-gaming' + (path === '/stats/players' ? paths.player('Alice') : paths.matchup(['Alice', 'Bob'])));
  });

  it('shows the full hierarchy with linked ancestors and a nonlinked current page', async () => {
    openApp('/stats/players');
    const breadcrumbs = await screen.findByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(breadcrumbs).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Home', 'Statistiche', 'Statistiche Giocatori']);
    expect(within(breadcrumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(breadcrumbs).getByRole('link', { name: 'Statistiche' })).toHaveAttribute('href', '/stats');
    expect(within(breadcrumbs).getByText('Statistiche Giocatori').closest('[aria-current="page"]')).toBeInTheDocument();
    expect(within(breadcrumbs).queryByRole('link', { name: 'Statistiche Giocatori' })).not.toBeInTheDocument();
  });

  it('restores a saved deck from a direct URL and navigates through its breadcrumbs', async () => {
    const user = userEvent.setup();
    const first = openApp('/decks/d1');
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
    expect(screen.getByText('30 Forest')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const currentURL = first.router.state.location.pathname;
    first.unmount();
    const { router } = openApp(currentURL);
    await screen.findByRole('heading', { name: 'Elfi' });
    const breadcrumbs = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(breadcrumbs).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Home', 'Mazzi', 'Elfi']);
    await user.click(within(breadcrumbs).getByRole('link', { name: 'Mazzi' }));
    expect(router.state.location.pathname).toBe('/decks');
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
  });

  it.each([['u1', true], [null, true], ['u2', false]])('preserves saved-deck action permissions for owner %s', async (owner, editable) => {
    vi.mocked(getSavedDeck).mockResolvedValue({ ...savedDeck, createdBy: owner });
    openApp('/decks/d1');
    await screen.findByRole('heading', { name: 'Elfi' });
    expect(Boolean(screen.queryByRole('link', { name: /Modifica/ }))).toBe(editable);
    expect(Boolean(screen.queryByRole('button', { name: /Cancella/ }))).toBe(editable);
  });

  it('uses the deck name in editor breadcrumbs and returns cancel/save to the detail', async () => {
    const user = userEvent.setup();
    const { router } = openApp('/decks/d1/edit');
    const breadcrumbs = await screen.findByRole('navigation', { name: 'Percorso di navigazione' });
    await within(breadcrumbs).findByRole('link', { name: 'Elfi' });
    expect(within(breadcrumbs).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Home', 'Mazzi', 'Elfi', 'Modifica Mazzo']);
    await user.click(screen.getByRole('button', { name: 'Annulla mazzo' }));
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Modifica/ }));
    await user.click(await screen.findByRole('button', { name: 'Salva mazzo' }));
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/decks/d1');
  });

  it('opens the newly created deck after saving', async () => {
    vi.mocked(getSavedDeck).mockResolvedValue({ ...savedDeck, id: 'new-id' });
    const user = userEvent.setup();
    const { router } = openApp('/decks/new');
    await user.click(await screen.findByRole('button', { name: 'Salva mazzo' }));
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/decks/new-id');
    expect(getSavedDeck).toHaveBeenCalledWith('new-id');
  });

  it.each(['/decks/missing', '/decks/missing/stats'])('handles a missing deck at %s while keeping parent navigation available', async (path) => {
    vi.mocked(getSavedDeck).mockRejectedValue(new Error('Questo mazzo non esiste più.'));
    openApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Questo mazzo non esiste più.');
    expect(screen.queryByRole('button', { name: /Cancella/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Percorso di navigazione' })).getByRole('link', { name: 'Mazzi' })).toHaveAttribute('href', '/decks');
  });

  it('preserves a deck after cancelled or failed deletion', async () => {
    const user = userEvent.setup();
    openApp('/decks/d1');
    vi.mocked(window.confirm).mockReturnValue(false);
    await user.click(await screen.findByRole('button', { name: /Cancella/ }));
    expect(deleteSavedDeck).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    vi.mocked(deleteSavedDeck).mockRejectedValue(new Error('Riprova.'));
    await user.click(screen.getByRole('button', { name: /Cancella/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellazione mazzo non riuscita: Riprova.');
    expect(screen.getByText('30 Forest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancella/ })).toBeEnabled();
  });

  it('blocks leaving or deleting twice during deletion, then returns to the list', async () => {
    let done: () => void = () => {};
    vi.mocked(deleteSavedDeck).mockImplementation(() => new Promise<void>(resolve => { done = resolve; }));
    const user = userEvent.setup();
    const { router } = openApp('/decks/d1');
    await user.click(await screen.findByRole('button', { name: /Cancella/ }));
    expect(screen.getByRole('button', { name: 'Cancellazione…' })).toBeDisabled();
    await user.click(within(screen.getByRole('navigation', { name: 'Percorso di navigazione' })).getByRole('link', { name: 'Home' }));
    await waitFor(() => expect(router.state.blockers.values().next().value?.state).toBe('unblocked'));
    expect(router.state.location.pathname).toBe('/decks/d1');
    expect(deleteSavedDeck).toHaveBeenCalledTimes(1);
    expect(deleteSavedDeck).toHaveBeenCalledWith('d1');
    await act(async () => { done(); });
    expect(await screen.findByRole('heading', { name: 'Mazzi Salvati' })).toBeInTheDocument();
  });

  it('refreshes a deck after changes and cleans up its subscription', async () => {
    const view = openApp('/decks/d1');
    await screen.findByRole('heading', { name: 'Elfi' });
    vi.mocked(getSavedDeck).mockResolvedValue({ ...savedDeck, name: 'Elfi aggiornati' });
    await act(async () => { mock.subscribers.get('saved-decks')?.forEach(onChange => onChange()); });
    expect(await screen.findByRole('heading', { name: 'Elfi aggiornati' })).toBeInTheDocument();
    vi.mocked(getSavedDeck).mockRejectedValue(new Error('Mazzo cancellato.'));
    await act(async () => { mock.subscribers.get('saved-decks')?.forEach(onChange => onChange()); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Mazzo cancellato.');
    expect(screen.queryByRole('link', { name: /Modifica/ })).not.toBeInTheDocument();
    view.unmount();
    expect(mock.subscribers.get('saved-decks')?.size).toBe(0);
  });

  it('loads deck statistics from a fresh URL with charts and the full breadcrumb hierarchy', async () => {
    const user = userEvent.setup();
    const first = openApp('/decks/d1/stats');
    expect(await screen.findByText(/Solo Main Deck · 30 carte/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Valore di mana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Produzione di mana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tipi di carte' })).toBeInTheDocument();
    const breadcrumbs = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(breadcrumbs).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Home', 'Mazzi', 'Elfi', 'Statistiche Mazzo']);
    expect(within(breadcrumbs).getByRole('link', { name: 'Elfi' })).toHaveAttribute('href', '/decks/d1');
    await user.click(screen.getByRole('switch', { name: 'Conta il mana incolore' }));
    expect(screen.getByRole('switch', { name: 'Conta il mana incolore' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    const currentURL = first.router.state.location.pathname;
    first.unmount();
    openApp(currentURL);
    expect(await screen.findByText(/Solo Main Deck · 30 carte/)).toBeInTheDocument();
  });

  it('uses a real deck-statistics link under the deployment base and supports history', async () => {
    const user = userEvent.setup();
    const { router } = openApp('/collectible-card-gaming/decks/d1', '/collectible-card-gaming');
    const link = await screen.findByRole('link', { name: 'Statistiche del mazzo' });
    expect(link).toHaveAttribute('href', '/collectible-card-gaming/decks/d1/stats');
    await user.click(link);
    expect(await screen.findByText(/Solo Main Deck · 30 carte/)).toBeInTheDocument();
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
    await act(async () => { await router.navigate(1); });
    expect(await screen.findByText(/Solo Main Deck · 30 carte/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('navigation', { name: 'Percorso di navigazione' })).getByRole('link', { name: 'Elfi' }));
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
  });

  it('preserves the saved-deck statistics URL through login', async () => {
    mock.session = null;
    const { router } = openApp('/decks/d1/stats');
    expect(await screen.findByRole('heading', { name: 'Accedi al registro' })).toBeInTheDocument();
    await act(async () => { mock.authListener('SIGNED_IN', { user: { id: 'u1' } }); });
    expect(await screen.findByText(/Solo Main Deck · 30 carte/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/decks/d1/stats');
  });

  it('ignores a stale deck response when navigating directly between statistics pages', async () => {
    let resolveFirst: (deck: SavedDeck) => void = () => {};
    vi.mocked(getSavedDeck).mockImplementationOnce(() => new Promise<SavedDeck>(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ...savedDeck, id: 'd2', name: 'Altro mazzo', cards: [{ name: 'Forest', qty: 5 }, { name: 'Island', qty: 15, section: 'side' }] });
    const { router } = openApp('/decks/d1/stats');
    await waitFor(() => expect(getSavedDeck).toHaveBeenCalledWith('d1'));
    await act(async () => { await router.navigate('/decks/d2/stats'); });
    expect(await screen.findByText(/Solo Main Deck · 5 carte/)).toBeInTheDocument();
    await act(async () => { resolveFirst(savedDeck); });
    const breadcrumbs = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(breadcrumbs).getByRole('link', { name: 'Altro mazzo' })).toHaveAttribute('href', '/decks/d2');
    expect(screen.queryByText(/Solo Main Deck · 30 carte/)).not.toBeInTheDocument();
    expect(mock.subscribers.get('saved-decks')?.size).toBe(1);
  });

  it.each([
    ['/games', 'Partite Salvate', 'Partite'],
    ['/games/new', 'Nuova Partita', 'Nuova partita'],
    ['/games/new/', 'Nuova Partita', 'Nuova partita'],
    ['/decks', 'Mazzi Salvati', 'Mazzi'],
    ['/decks/new', 'Nuovo Mazzo', 'Mazzi'],
    ['/stats', 'Statistiche', 'Statistiche'],
    ['/stats/decks', 'Statistiche Mazzi', 'Statistiche'],
    ['/stats/players', 'Statistiche Giocatori', 'Statistiche'],
    ['/stats/matchups', 'Statistiche per Sfida', 'Statistiche'],
    ['/more', 'Altro', 'Altro'],
    ['/players', 'Giocatori', 'Altro'],
  ])('opens %s directly as a page', async (path, title, tab) => {
    openApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Navigazione principale' });
    expect(within(navigation).getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('navigates to statistics and back with history, keeping repeated tab clicks on the page', async () => {
    const user = userEvent.setup();
    const { router } = openApp('/stats');
    await screen.findByRole('heading', { name: 'Statistiche' });
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Mazzi' }));
    expect(await screen.findByRole('heading', { name: 'Statistiche Mazzi' })).toBeInTheDocument();
    await act(async () => { await router.navigate(-1); });
    expect(screen.getByRole('heading', { name: 'Statistiche' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('navigation', { name: 'Navigazione principale' })).getByRole('link', { name: 'Statistiche' }));
    expect(router.state.location.pathname).toBe('/stats');
  });

  it('renders a shared game detail on a direct URL with its existing export controls', async () => {
    openApp('/games/g1');
    expect(await screen.findByRole('button', { name: /Esporta Risultati/ })).toBeInTheDocument();
    expect(screen.getAllByText('🎉 Alice')).toHaveLength(2);
    expect(screen.getAllByText(/^vincitore — /)).toHaveLength(2);
    expect(screen.queryByLabelText('Cerca nelle partite')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gameLink('g1')).toBe(`${window.location.origin}${appHref(paths.game('g1'))}`);
  });

  it('supports old shared game links', async () => {
    const { router } = openApp('/?partita=g1');
    expect(await screen.findByRole('button', { name: /Esporta Risultati/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/games/g1');
    expect(router.state.location.search).toBe('');
  });

  it.each([
    ['/games/g1/edit', 'Form partita: g1'],
    ['/games/g1/rematch', 'Form partita: rivincita g1'],
    ['/decks/d1/edit', 'Editor mazzo: d1'],
  ])('restores the editor record from %s after a fresh mount', async (path, content) => {
    const first = openApp(path);
    expect(await screen.findByText(content)).toBeInTheDocument();
    const currentURL = first.router.state.location.pathname;
    first.unmount();
    openApp(currentURL);
    expect(await screen.findByText(content)).toBeInTheDocument();
  });

  it('opens imported deck content on the new-deck route', async () => {
    const user = userEvent.setup();
    const { router } = openApp('/decks');
    await user.click(await screen.findByRole('button', { name: 'Importa mazzo' }));
    expect(await screen.findByText('Editor mazzo: Importato')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/decks/new');
  });

  it('keeps a deep link through login', async () => {
    mock.session = null;
    const { router } = openApp('/stats/players');
    expect(await screen.findByRole('heading', { name: 'Accedi al registro' })).toBeInTheDocument();
    await act(async () => { mock.authListener('SIGNED_IN', { user: { id: 'u1' } }); });
    expect(await screen.findByRole('heading', { name: 'Statistiche Giocatori' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/stats/players');
  });

  it('asks before leaving a game form with browser Back and allows a completed save', async () => {
    const user = userEvent.setup();
    const { router } = openApp('/games');
    await user.click(await screen.findByRole('link', { name: 'Nuova partita' }));
    await screen.findByText('Form partita: nuova');
    vi.mocked(window.confirm).mockReturnValue(false);
    await act(async () => { await router.navigate(-1); });
    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(router.state.location.pathname).toBe('/games/new');
    await user.click(screen.getByRole('button', { name: 'Salva partita' }));
    expect(await screen.findByRole('heading', { name: 'Partite Salvate' })).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it('blocks section navigation during deck persistence and returns after saving', async () => {
    const user = userEvent.setup();
    const { router } = openApp('/decks/d1/edit');
    await user.click(await screen.findByRole('button', { name: 'Inizia salvataggio mazzo' }));
    await user.click(screen.getByRole('link', { name: 'Partite' }));
    await waitFor(() => expect(router.state.blockers.values().next().value?.state).toBe('unblocked'));
    expect(router.state.location.pathname).toBe('/decks/d1/edit');
    await user.click(screen.getByRole('button', { name: 'Salva mazzo' }));
    expect(await screen.findByRole('heading', { name: 'Elfi' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/decks/d1');
  });

  it('rejects an editor URL for another user’s game', async () => {
    mock.rows[0].created_by = 'u2';
    openApp('/games/g1/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('Puoi modificare solo le partite che hai salvato.');
    expect(screen.queryByText('Form partita: g1')).not.toBeInTheDocument();
  });

  it('keeps the opened game as the editing baseline when realtime data changes or disappears', async () => {
    mock.rows[0].notes = 'Originale';
    openApp('/games/g1/edit');
    expect(await screen.findByText('Note iniziali: Originale')).toBeInTheDocument();
    mock.rows = [{ ...mock.rows[0], notes: 'Modificata da un altro dispositivo' }];
    await act(async () => { mock.subscribers.get('partite')?.forEach((onChange) => onChange()); });
    expect(screen.getByText('Note iniziali: Originale')).toBeInTheDocument();
    mock.rows = [];
    await act(async () => { mock.subscribers.get('partite')?.forEach((onChange) => onChange()); });
    expect(screen.getByText('Note iniziali: Originale')).toBeInTheDocument();
  });

  it('opens a game for editing even if the shared list does not have it yet', async () => {
    mock.rows[0].notes = 'Appena salvata';
    mock.hiddenFromList = ['g1'];
    openApp('/games/g1/edit');
    expect(await screen.findByText('Note iniziali: Appena salvata')).toBeInTheDocument();
    expect(screen.queryByText('Partita non trovata.')).not.toBeInTheDocument();
  });

  it.each(['/games/missing', '/games/missing/edit'])('handles a missing record at %s', async (path) => {
    openApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Partita non trovata.');
  });

  it('generates internal links under the deployed basename', async () => {
    openApp('/collectible-card-gaming/more', '/collectible-card-gaming');
    expect(await screen.findByRole('link', { name: 'Gestisci Giocatori' })).toHaveAttribute('href', '/collectible-card-gaming/players');
    expect(screen.getByRole('link', { name: /Vai a ZAFF/ })).toHaveAttribute('href', '/collectible-card-gaming/zaff');
  });

  it('shows an unknown-route page with a link home', async () => {
    openApp('/unknown');
    expect(await screen.findByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(screen.getByRole('navigation', { name: 'Navigazione principale' })).queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('keeps the ZAFF route and title working with a trailing slash', async () => {
    openApp('/zaff/');
    expect(await screen.findByRole('heading', { name: 'ZAFF' })).toBeInTheDocument();
    expect(document.title).toBe('ZAFF — Collectible Card Gaming');
  });
});
