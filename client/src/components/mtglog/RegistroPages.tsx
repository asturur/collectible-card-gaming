import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, type RouteObject } from 'react-router';
import { useRegistro } from '../MtgLog';
import HomeOverview from './HomeOverview';
import PlayersRoster from './PlayersRoster';
import DeckList from './DeckList';
import DeckEditor from './DeckEditor';
import DeckViewContents from './DeckView';
import DeckStatsContents from './DeckStats';
import { useSavedDeck } from './useSavedDeck';
import { DeckActionsPanel, DeckExportDialog, DeckSummaryBar, DeckTabs, deckLink } from './DeckDetailActions';
import GameForm from './GameForm';
import GameList, { type Game } from './GameList';
import GameStats from './GameStats';
import Standings, { PlayerStatsDetail } from './Standings';
import MatchupStats, { MatchupStatsDetail } from './MatchupStats';
import { computeMatchups, computeTally, matchupKey, rowToGame } from './stats';
import SectionPage from '../ui/SectionPage';
import Button, { ButtonRouteLink } from '../ui/Button';
import { CrossedSwordsIcon, GridTile, PodiumIcon, StatsRingIcon, TILE_GRID } from '../ui/Tile';
import { HEADING_PAGE, TEXT_MUTED } from '../ui/styles';
import { useLeaveGuard } from '../ui/useLeaveGuard';
import { canEdit, supabase, TABLE_GAMES } from '../../services/supabase';
import { deleteSavedDeck, type SavedDeck } from '../../services/savedDecks';
import type { DeckEntry } from '../../services/deckCards';
import { matchupNamesFromPath, paths, playerNameFromPath } from '../../router';

const DECKS_CRUMB = { label: 'Mazzi', to: paths.decks };
const GAMES_CRUMB = { label: 'Partite', to: paths.games };
const STATS_CRUMB = { label: 'Statistiche', to: paths.stats };

/** All game statistics use the already mounted Registro query and subscription. */
function GameStatisticsData({ children }: { children: ReactNode }) {
  const { gamesLoading, gamesError } = useRegistro();
  if (gamesLoading) return <p className={TEXT_MUTED}>Caricamento…</p>;
  if (gamesError) return <p role="alert">{gamesError}</p>;
  return children;
}

function RegistroHome() {
  const { games, deckCount, gamesError } = useRegistro();
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-5 sm:pt-7">
      <header className="border-b-2 border-zaff-text pb-4 sm:pb-[18px]">
        <h1 className={HEADING_PAGE}>Registro partite di Magic</h1>
        <p className="text-sm text-zaff-muted">Chi gioca, con che mazzo, come è finita. Condiviso con tutto il gruppo.</p>
        <div className="mtg-sep" />
        {gamesError && <p role="alert">{gamesError}</p>}
        <HomeOverview games={games} deckCount={deckCount} />
      </header>
    </main>
  );
}

function GamesPage() {
  const { userId } = useRegistro();
  const { gameId } = useParams();
  const navigate = useNavigate();
  return (
    <SectionPage title={gameId ? 'Dettaglio Partita' : 'Partite Salvate'} wide xl={Boolean(gameId)} ancestors={gameId ? [GAMES_CRUMB] : []}>
      <GameList userId={userId} onEdit={(game) => { void navigate(paths.editGame(game.id)); }} onRematch={(game) => { void navigate(paths.rematch(game.id)); }} />
    </SectionPage>
  );
}

function GameEditorPage({ rematch = false }: { rematch?: boolean }) {
  const { gameId } = useParams();
  return <GameEditorSession key={`${gameId ?? 'new'}:${rematch}`} gameId={gameId} rematch={rematch} />;
}

function GameEditorSession({ gameId, rematch }: { gameId?: string; rematch: boolean }) {
  const { userId, games, gamesLoading, gamesError } = useRegistro();
  const navigate = useNavigate();
  // The form's original record is also its conflict baseline. Realtime updates
  // must not replace it or discard a draft if someone deletes the record.
  const [game, setGame] = useState<Game | null>(null);
  // L'elenco condiviso può non avere ancora una partita appena salvata (l'aggiornamento
  // in tempo reale arriva dopo): in quel caso la leggo direttamente per id.
  const [fetched, setFetched] = useState<Game | null>(null);
  const [fetchDone, setFetchDone] = useState(false);
  const inList = gameId ? games.find((g) => g.id === gameId) : null;
  const candidate = gameId ? inList ?? fetched : null;
  useEffect(() => {
    if (!gameId || game || inList || gamesLoading || gamesError || fetchDone || !supabase) return;
    let cancelled = false;
    void supabase.from(TABLE_GAMES).select('*').eq('id', gameId).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      if (data) setFetched(rowToGame(data));
      setFetchDone(true);
    });
    return () => { cancelled = true; };
  }, [gameId, game, inList, gamesLoading, gamesError, fetchDone]);
  const forbidden = Boolean(candidate && !rematch && !canEdit(candidate.createdBy, userId));
  useEffect(() => {
    if (!game && candidate && !forbidden && !gamesError) setGame(candidate);
  }, [game, candidate, forbidden, gamesError]);
  const ready = !gameId || Boolean(game);
  const waiting = gameId && !game && (gamesLoading || (candidate && !forbidden && !gamesError) || (!candidate && !fetchDone && !gamesError && Boolean(supabase)));
  const guard = useLeaveGuard(ready ? 'Uscire dalla partita? Quello che non hai salvato andrà perso.' : undefined);
  const backTo = gameId ? paths.game(gameId) : paths.games;
  return (
    <SectionPage title={rematch ? 'Rivincita' : gameId ? 'Modifica Partita' : 'Nuova Partita'} wide stickyTitle ancestors={[
      GAMES_CRUMB, ...(gameId ? [{ label: 'Dettaglio Partita', to: paths.game(gameId) }] : []),
    ]}>
      {waiting ? <p className={TEXT_MUTED}>Caricamento…</p> : !ready ? <p role="alert">{gamesError || (forbidden ? 'Puoi modificare solo le partite che hai salvato.' : 'Partita non trovata.')}</p> : (
        <GameForm
          key={gameId ?? 'new'}
          editingGame={rematch ? null : game}
          rematchFrom={rematch ? game : null}
          onSavingChange={guard.onPersistingChange}
          onBack={() => { void navigate(backTo); }}
          onSaved={() => guard.onSaved(paths.games)}
        />
      )}
    </SectionPage>
  );
}

function DecksPage() {
  const navigate = useNavigate();
  return (
    <SectionPage title="Mazzi Salvati">
      <DeckList
        onCreate={() => { void navigate(paths.newDeck); }}
        onImportFile={(name, cards) => { void navigate(paths.newDeck, { state: { draft: { name, cards } } }); }}
      />
    </SectionPage>
  );
}

/** Deck e Stats sono due indirizzi della stessa pagina: titolo, tasti e barra dei totali restano, cambia il contenuto. */
function DeckDetailPage() {
  const { deckId } = useParams();
  const { pathname } = useLocation();
  const active = /\/stats\/?$/.test(pathname) ? 'stats' : 'deck';
  return <DeckDetailSession key={deckId} deckId={deckId!} active={active} />;
}

/** Tasti fissi Deck / Stats / Azioni (con modifica, condividi, esporta, cancella) comuni alle pagine del mazzo. */
function DeckPageFrame({ deckId, deck, active, children }: { deckId: string; deck: SavedDeck | null; active: 'deck' | 'stats'; children: ReactNode }) {
  const { userId } = useRegistro();
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [section, setSection] = useState<'main' | 'side'>('main');
  const guard = useLeaveGuard();
  const mainTotal = deck ? deck.cards.filter((c) => c.section !== 'side').reduce((sum, c) => sum + c.qty, 0) : 0;
  const sideTotal = deck ? deck.cards.filter((c) => c.section === 'side').reduce((sum, c) => sum + c.qty, 0) : 0;
  const showingCards = active === 'deck' && !actionsOpen;

  // Scorrendo le carte, la barra illumina Main Deck o Sideboard: la Sideboard si
  // "accende" quando il suo titolo sale sotto la barra, o in fondo alla pagina.
  useEffect(() => {
    if (!showingCards || !deck) return;
    function update() {
      const el = document.getElementById('deck-sideboard');
      if (!el) { setSection('main'); return; }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setSection(el.getBoundingClientRect().top <= 150 || atBottom ? 'side' : 'main');
    }
    update();
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [showingCards, deck]);

  async function handleShare() {
    if (!deck) return;
    const url = deckLink(deckId);
    setShareNotice('');
    if (navigator.share) {
      try {
        await navigator.share({ title: deck.name, text: 'Mazzo di Magic: ' + deck.name, url });
        return;
      } catch {
        // Annullato dall'utente o non disponibile: si prova a copiarlo.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice('Link copiato negli appunti.');
    } catch {
      setShareNotice(url);
    }
  }

  async function handleDelete() {
    if (!deck || deleting || !canEdit(deck.createdBy, userId)) return;
    if (!window.confirm('Cancellare questo mazzo? Le partite che lo usano già continueranno a mostrarne solo il nome.')) return;
    setDeleteError('');
    setDeleting(true);
    guard.onPersistingChange(true);
    try {
      await deleteSavedDeck(deckId);
      guard.onSaved(paths.decks);
    } catch (err) {
      setDeleteError('Cancellazione mazzo non riuscita: ' + (err as Error).message);
    } finally {
      setDeleting(false);
      guard.onPersistingChange(false);
    }
  }

  return (
    <>
      {deck && (
        <>
          <DeckTabs
            active={active}
            deckTo={paths.deck(deckId)}
            statsTo={paths.savedDeckStats(deckId)}
            actionsOpen={actionsOpen}
            onShowPage={() => setActionsOpen(false)}
            onToggleActions={() => setActionsOpen((open) => !open)}
          />
          <DeckSummaryBar title={deck.name} main={mainTotal} side={sideTotal} highlight={showingCards ? section : null} />
          {actionsOpen && (
            <DeckActionsPanel
              editTo={canEdit(deck.createdBy, userId) ? paths.editDeck(deckId) : null}
              deleting={deleting}
              onDelete={handleDelete}
              onShare={handleShare}
              onExport={() => setExportOpen(true)}
              notice={shareNotice}
            />
          )}
        </>
      )}
      {/* Il contenuto di Deck o Stats resta in memoria (nascosto) mentre sono aperte le Azioni. */}
      <div hidden={actionsOpen}>{children}</div>
      {deck && exportOpen && <DeckExportDialog deckName={deck.name} cards={deck.cards} onClose={() => setExportOpen(false)} />}
      {deleteError && <p className="mt-3 text-sm text-error" role="alert">{deleteError}</p>}
    </>
  );
}

function DeckDetailSession({ deckId, active }: { deckId: string; active: 'deck' | 'stats' }) {
  const { deck, loading, error } = useSavedDeck(deckId);
  return (
    <SectionPage title={deck?.name ?? 'Dettaglio Mazzo'} ancestors={[DECKS_CRUMB]}>
      <DeckPageFrame deckId={deckId} deck={deck} active={active}>
        {loading ? <p className={TEXT_MUTED}>Caricamento…</p> : deck && (active === 'stats'
          ? <DeckStatsContents key={deckId} cards={deck.cards} />
          : <DeckViewContents source={deck.source} colors={deck.colors} cards={deck.cards.map(c => ({ ...c, section: c.section ?? 'main' }))} />)}
        {error && <p className="mt-3 text-sm text-error" role="alert">{error}</p>}
      </DeckPageFrame>
    </SectionPage>
  );
}

function DeckEditorPage() {
  const { deckId } = useParams();
  const location = useLocation();
  return <DeckEditorSession key={deckId ?? location.key} deckId={deckId} />;
}

function DeckEditorSession({ deckId }: { deckId?: string }) {
  const { userId } = useRegistro();
  const location = useLocation();
  const navigate = useNavigate();
  const [deckName, setDeckName] = useState('Dettaglio Mazzo');
  const guard = useLeaveGuard();
  const backTo = deckId ? paths.deck(deckId) : paths.decks;
  const state = location.state as { draft?: { name: string; cards: DeckEntry[] } } | null;
  return (
    <SectionPage title={deckId ? 'Modifica Mazzo' : 'Nuovo Mazzo'} ancestors={[
      DECKS_CRUMB, ...(deckId ? [{ label: deckName, to: paths.deck(deckId) }] : []),
    ]}>
      <DeckEditor
        deckId={deckId ?? null}
        userId={userId}
        initialDraft={state?.draft}
        onPersistingChange={guard.onPersistingChange}
        onLoaded={setDeckName}
        onBack={() => { void navigate(backTo); }}
        onSaved={(id) => guard.onSaved(paths.deck(id))}
      />
    </SectionPage>
  );
}

function StatsMenuPage() {
  return (
    <SectionPage title="Statistiche">
      <div className={TILE_GRID}>
        <GridTile graphic={<StatsRingIcon />} label="Mazzi" to={paths.deckStats} />
        <GridTile graphic={<PodiumIcon />} label="Giocatori" to={paths.playerStats} />
        <GridTile graphic={<CrossedSwordsIcon />} label="Per Sfida" to={paths.matchups} />
      </div>
    </SectionPage>
  );
}

function PlayerStatsPage() {
  const { games } = useRegistro();
  return (
    <SectionPage title="Statistiche Giocatori" subtitle="Classifica generale: partite vinte da ciascuno e come si dividono tutte le vittorie." wide ancestors={[STATS_CRUMB]}>
      <GameStatisticsData><Standings rows={computeTally(games)} showPie /></GameStatisticsData>
    </SectionPage>
  );
}

function PlayerDetailPage() {
  const { games } = useRegistro();
  const { pathname } = useLocation();
  const playerName = playerNameFromPath(pathname);
  const row = computeTally(games).find(player => player.name === playerName);
  return (
    <SectionPage title={playerName ?? 'Statistiche Giocatore'} subtitle="Statistiche Giocatore" ancestors={[
      STATS_CRUMB, { label: 'Giocatori', to: paths.playerStats },
    ]}>
      <GameStatisticsData>
        {row ? <PlayerStatsDetail key={row.name} row={row} games={games} />
          : <p role="alert">Nessuna partita registrata per questo giocatore.</p>}
      </GameStatisticsData>
    </SectionPage>
  );
}

function MatchupsPage() {
  const { games } = useRegistro();
  return <SectionPage title="Statistiche per Sfida" wide ancestors={[STATS_CRUMB]}><GameStatisticsData><MatchupStats games={games} /></GameStatisticsData></SectionPage>;
}

function MatchupDetailPage() {
  const { games } = useRegistro();
  const { pathname } = useLocation();
  const names = matchupNamesFromPath(pathname);
  const selected = names ? computeMatchups(games).find(matchup => matchup.key === matchupKey(names)) : undefined;
  return (
    <SectionPage title={selected?.label ?? names?.join(' vs ') ?? 'Dettaglio Sfida'} subtitle="Statistiche per Sfida" ancestors={[
      STATS_CRUMB, { label: 'Sfide', to: paths.matchups },
    ]}>
      <GameStatisticsData>
        {selected ? <MatchupStatsDetail key={selected.key} selected={selected} />
          : <p role="alert">{names ? 'Nessuna partita registrata con questa formazione.' : 'Indirizzo della sfida non valido.'}</p>}
      </GameStatisticsData>
    </SectionPage>
  );
}

function MorePage() {
  const { email } = useRegistro();
  return (
    <SectionPage title="Altro">
      <p className="mb-3 truncate text-sm text-zaff-muted">{email}</p>
      <div className="flex flex-col gap-2.5">
        <ButtonRouteLink to={paths.players} variant="ghost" size="lg" fullWidth>Gestisci Giocatori</ButtonRouteLink>
        <ButtonRouteLink to={paths.zaff} variant="ghost" size="lg" fullWidth>Vai a ZAFF →</ButtonRouteLink>
        <Button variant="ghost" size="lg" fullWidth onClick={() => supabase?.auth.signOut()}>Esci</Button>
      </div>
    </SectionPage>
  );
}

function PlayersPage() {
  const { userId, games } = useRegistro();
  return (
    <SectionPage title="Giocatori" subtitle="Tocca un nome per vedere le partite giocate e le statistiche, o per rinominarlo o cancellarlo. Le partite già salvate mantengono comunque il nome che avevano." ancestors={[{ label: 'Altro', to: paths.more }]}>
      <PlayersRoster userId={userId} games={games} />
    </SectionPage>
  );
}

function NotFoundPage() {
  return <SectionPage title="Pagina non trovata"><p className={TEXT_MUTED}>Questo indirizzo non corrisponde a una sezione del registro.</p></SectionPage>;
}

export const registroRoutes: RouteObject[] = [
  { index: true, element: <RegistroHome /> },
  { path: 'games', element: <GamesPage /> },
  { path: 'games/new', element: <GameEditorPage /> },
  { path: 'games/:gameId', element: <GamesPage /> },
  { path: 'games/:gameId/edit', element: <GameEditorPage /> },
  { path: 'games/:gameId/rematch', element: <GameEditorPage rematch /> },
  { path: 'decks', element: <DecksPage /> },
  { path: 'decks/new', element: <DeckEditorPage /> },
  { path: 'decks/:deckId', element: <DeckDetailPage /> },
  { path: 'decks/:deckId/stats', element: <DeckDetailPage /> },
  { path: 'decks/:deckId/edit', element: <DeckEditorPage /> },
  { path: 'stats', element: <StatsMenuPage /> },
  { path: 'stats/decks', element: <SectionPage title="Statistiche Mazzi" subtitle="Percentuale di vittoria di ogni mazzo, su tutte le partite." wide ancestors={[STATS_CRUMB]}><GameStats /></SectionPage> },
  { path: 'stats/players', element: <PlayerStatsPage /> },
  { path: 'stats/players/:playerName', element: <PlayerDetailPage /> },
  { path: 'stats/matchups', element: <MatchupsPage /> },
  { path: 'stats/matchups/*', element: <MatchupDetailPage /> },
  { path: 'more', element: <MorePage /> },
  { path: 'players', element: <PlayersPage /> },
  { path: '*', element: <NotFoundPage /> },
];
