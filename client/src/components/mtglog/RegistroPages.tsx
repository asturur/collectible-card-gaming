import { useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from '../../i18n';
import { useSectionInView } from './useSectionInView';
import { APP_NAME } from '../../appName';
import { Navigate, useLocation, useNavigate, useParams, type RouteObject } from 'react-router';
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
import { readGameDraft } from './gameDraft';
import GameList, { type Game } from './GameList';
import GameStats from './GameStats';
import Standings, { PlayerStatsDetail } from './Standings';
import MatchupStats, { MatchupStatsDetail } from './MatchupStats';
import { computeMatchups, computeTally, decidedGames, matchupKey, rowToGame } from './stats';
import SectionPage from '../ui/SectionPage';
import TrendsStats from './TrendsStats';
import CardStats from './CardStats';
import { countNewGames, markGamesSeen } from './newGames';
import { cx, HEADING_PAGE, STICKY_BELOW_TITLE, TEXT_MUTED } from '../ui/styles';
import { useLeaveGuard } from '../ui/useLeaveGuard';
import { canEdit, supabase, TABLE_GAMES } from '../../services/supabase';
import { deleteSavedDeck, type SavedDeck } from '../../services/savedDecks';
import type { DeckEntry } from '../../services/deckCards';
import { matchupNamesFromPath, paths, playerNameFromPath } from '../../router';
import Faq from './Faq';
import AccountPanel from './AccountPanel';

/** Briciole di pane: il testo si traduce quando la pagina si mostra. */
const DECKS_CRUMB = () => ({ label: i18n.t('mazzi'), to: paths.decks });
const GAMES_CRUMB = () => ({ label: i18n.t('partite'), to: paths.games });

/** All game statistics use the already mounted Registro query and subscription. */
/** Le partite delle statistiche: solo quelle con un vincitore segnato (vedi `decidedGames`). */
function useStatsGames() {
  const { games } = useRegistro();
  return useMemo(() => decidedGames(games), [games]);
}

function GameStatisticsData({ children }: { children: ReactNode }) {
  const { gamesLoading, gamesError } = useRegistro();
  if (gamesLoading) return <p className={TEXT_MUTED}>{i18n.t('caricamento')}</p>;
  if (gamesError) return <p role="alert">{gamesError}</p>;
  return children;
}

function RegistroHome() {
  const { userId, games, gamesLoading, deckCount, decks, gamesError } = useRegistro();
  const newGames = gamesLoading ? 0 : countNewGames(games, userId);
  const location = useLocation();
  const gameSaved = Boolean((location.state as { gameSaved?: boolean } | null)?.gameSaved);
  // Letta all'apertura della Home: la partita in corso si aggiorna solo dentro la pagina della partita.
  const [draft] = useState(readGameDraft);
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-5 sm:pt-7">
      <header className="border-b-2 border-zaff-text pb-4 sm:pb-[18px]">
        <h1 className={HEADING_PAGE}>{APP_NAME}</h1>
        <div className="mtg-sep" />
        {gamesError && <p role="alert">{gamesError}</p>}
        <HomeOverview games={games} deckCount={deckCount} decks={decks} newGames={newGames} gameSaved={gameSaved} draft={draft} />
      </header>
    </main>
  );
}

function GamesPage() {
  const { userId, games, gamesLoading, gamesError, reloadGames } = useRegistro();
  // Aprire l'elenco Partite significa averle viste: sparisce il segno "nuove" della Home.
  useEffect(() => { if (!gamesLoading) markGamesSeen(games); }, [games, gamesLoading]);
  const { gameId } = useParams();
  const navigate = useNavigate();
  return (
    <SectionPage title={gameId ? i18n.t('dettaglio_partita') : i18n.t('partite_salvate')} stickyTitle wide xl={Boolean(gameId)} ancestors={gameId ? [GAMES_CRUMB()] : []}>
      <GameList userId={userId} games={games} loading={gamesLoading} loadError={gamesError} reloadGames={reloadGames} onEdit={(game) => { void navigate(paths.editGame(game.id)); }} onRematch={(game) => { void navigate(paths.rematch(game.id)); }} />
    </SectionPage>
  );
}

function GameEditorPage({ rematch = false }: { rematch?: boolean }) {
  const { gameId } = useParams();
  return <GameEditorSession key={`${gameId ?? 'new'}:${rematch}`} gameId={gameId} rematch={rematch} />;
}

function GameEditorSession({ gameId, rematch }: { gameId?: string; rematch: boolean }) {
  const { userId, games, gamesLoading, gamesError, reloadGames } = useRegistro();
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
  const guard = useLeaveGuard(ready ? i18n.t('uscire_dalla_partita') : undefined);
  const backTo = gameId ? paths.game(gameId) : paths.games;
  return (
    <SectionPage title={rematch ? i18n.t('rivincita') : gameId ? i18n.t('modifica_partita') : i18n.t('nuova_partita')} wide stickyTitle ancestors={[
      GAMES_CRUMB(), ...(gameId ? [{ label: i18n.t('dettaglio_partita'), to: paths.game(gameId) }] : []),
    ]}>
      {waiting ? <p className={TEXT_MUTED}>{i18n.t('caricamento')}</p> : !ready ? <p role="alert">{gamesError || (forbidden ? i18n.t('puoi_modificare_solo_partite') : i18n.t('partita_non_trovata'))}</p> : (
        <GameForm
          key={gameId ?? 'new'}
          editingGame={rematch ? null : game}
          rematchFrom={rematch ? game : null}
          onSavingChange={guard.onPersistingChange}
          onBack={() => { void navigate(backTo); }}
          // Il segna-punti ha già chiesto conferma: niente seconda domanda all'uscita.
          onDiscard={() => guard.leave(backTo)}
          // Rilegge subito l'elenco: la partita appena salvata compare senza aspettare il tempo reale.
          // Dopo il salvataggio si torna sempre alla Home, che lo conferma.
          onSaved={() => { void reloadGames(); guard.onSaved(paths.home, { gameSaved: true }); }}
        />
      )}
    </SectionPage>
  );
}

function DecksPage() {
  const navigate = useNavigate();
  return (
    <SectionPage title={i18n.t('mazzi_salvati_titolo')} stickyTitle>
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
  const guard = useLeaveGuard();
  const mainTotal = deck ? deck.cards.filter((c) => c.section !== 'side').reduce((sum, c) => sum + c.qty, 0) : 0;
  const sideTotal = deck ? deck.cards.filter((c) => c.section === 'side').reduce((sum, c) => sum + c.qty, 0) : 0;
  const showingCards = active === 'deck' && !actionsOpen;

  // Scorrendo le carte, la barra illumina Main Deck o Sideboard.
  const section = useSectionInView(showingCards && Boolean(deck), deck);

  async function handleShare() {
    if (!deck) return;
    const url = deckLink(deckId);
    setShareNotice('');
    if (navigator.share) {
      try {
        await navigator.share({ title: deck.name, text: i18n.t('mazzo_di_magic', { name: deck.name }), url });
        return;
      } catch {
        // Annullato dall'utente o non disponibile: si prova a copiarlo.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice(i18n.t('link_copiato_negli_appunti'));
    } catch {
      setShareNotice(url);
    }
  }

  async function handleDelete() {
    if (!deck || deleting || !canEdit(deck.createdBy, userId)) return;
    if (!window.confirm(i18n.t('cancellare_questo_mazzo'))) return;
    setDeleteError('');
    setDeleting(true);
    guard.onPersistingChange(true);
    try {
      await deleteSavedDeck(deckId);
      guard.onSaved(paths.decks);
    } catch (err) {
      setDeleteError(i18n.t('cancellazione_mazzo_non_riuscita', { error: (err as Error).message }));
    } finally {
      setDeleting(false);
      guard.onPersistingChange(false);
    }
  }

  return (
    <>
      {deck && (
        <>
          {/* Un solo blocco fisso in cima (tasti + barra dei totali): sopra le carte che scorrono, sempre tappabile. */}
          <div className={cx(STICKY_BELOW_TITLE, 'sticky z-20 -mx-1 mb-3 bg-zaff-surface px-1 pb-2 pt-1')}>
          <DeckTabs
            active={active}
            deckTo={paths.deck(deckId)}
            statsTo={paths.savedDeckStats(deckId)}
            actionsOpen={actionsOpen}
            onShowPage={() => setActionsOpen(false)}
            onToggleActions={() => setActionsOpen((open) => !open)}
          />
          <DeckSummaryBar main={mainTotal} side={sideTotal} highlight={showingCards ? section : null} />
          </div>
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
    <SectionPage title={deck?.name ?? i18n.t('dettaglio_mazzo')} stickyTitle ancestors={[DECKS_CRUMB()]}>
      <DeckPageFrame deckId={deckId} deck={deck} active={active}>
        {loading ? <p className={TEXT_MUTED}>Caricamento…</p> : deck && (active === 'stats'
          ? <DeckStatsContents key={deckId} cards={deck.cards} faqLinks />
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
  const [deckName, setDeckName] = useState(i18n.t('dettaglio_mazzo'));
  const guard = useLeaveGuard();
  const backTo = deckId ? paths.deck(deckId) : paths.decks;
  const state = location.state as { draft?: { name: string; cards: DeckEntry[] } } | null;
  return (
    <SectionPage title={deckId ? i18n.t('modifica_mazzo') : i18n.t('nuovo_mazzo_titolo')} ancestors={[
      DECKS_CRUMB(), ...(deckId ? [{ label: deckName, to: paths.deck(deckId) }] : []),
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

function PlayerStatsPage() {
  const games = useStatsGames();
  return (
    <SectionPage title={i18n.t('statistiche_giocatori')} stickyTitle wide>
      <GameStatisticsData><Standings rows={computeTally(games)} showPie /></GameStatisticsData>
    </SectionPage>
  );
}

function PlayerDetailPage() {
  const { decks } = useRegistro();
  const games = useStatsGames();
  const { pathname } = useLocation();
  const playerName = playerNameFromPath(pathname);
  const row = computeTally(games).find(player => player.name === playerName);
  return (
    <SectionPage title={playerName ?? i18n.t('statistiche_giocatore')} subtitle={i18n.t('statistiche_giocatore')} ancestors={[
      { label: i18n.t('giocatori'), to: paths.playerStats },
    ]}>
      <GameStatisticsData>
        {row ? <PlayerStatsDetail key={row.name} row={row} games={games} decks={decks} />
          : <p role="alert">{i18n.t('nessuna_partita_con_vincitore_giocatore')}</p>}
      </GameStatisticsData>
    </SectionPage>
  );
}

function CardStatsPage() {
  const games = useStatsGames();
  return <SectionPage title={i18n.t('statistiche_carte')} stickyTitle wide><GameStatisticsData><CardStats games={games} /></GameStatisticsData></SectionPage>;
}

function TrendsPage() {
  const { decks } = useRegistro();
  const games = useStatsGames();
  return <SectionPage title={i18n.t('andamento')} stickyTitle wide><GameStatisticsData><TrendsStats games={games} decks={decks} /></GameStatisticsData></SectionPage>;
}

function MatchupsPage() {
  const games = useStatsGames();
  return <SectionPage title={i18n.t('statistiche_per_sfida')} stickyTitle wide><GameStatisticsData><MatchupStats games={games} /></GameStatisticsData></SectionPage>;
}

function MatchupDetailPage() {
  const games = useStatsGames();
  const { pathname } = useLocation();
  const names = matchupNamesFromPath(pathname);
  const selected = names ? computeMatchups(games).find(matchup => matchup.key === matchupKey(names)) : undefined;
  return (
    <SectionPage title={selected?.label ?? names?.join(' vs ') ?? i18n.t('dettaglio_sfida')} subtitle={i18n.t('statistiche_per_sfida')} ancestors={[
      { label: i18n.t('sfide'), to: paths.matchups },
    ]}>
      <GameStatisticsData>
        {selected ? <MatchupStatsDetail key={selected.key} selected={selected} />
          : <p role="alert">{names ? i18n.t('nessuna_partita_con_vincitore_formazione') : i18n.t('indirizzo_sfida_non_valido')}</p>}
      </GameStatisticsData>
    </SectionPage>
  );
}

function PlayersPage() {
  const { userId, games } = useRegistro();
  return (
    <SectionPage title={i18n.t('giocatori')} stickyTitle subtitle={i18n.t('tocca_un_nome_per_vedere')}>
      <PlayersRoster userId={userId} games={games} />
    </SectionPage>
  );
}

function FaqPage() {
  const { section, topic } = useParams();
  return (
    <SectionPage title={i18n.t('faq_statistiche')} subtitle={i18n.t('come_si_calcola_ogni_statistica')} stickyTitle>
      <Faq sectionId={section} topicId={topic} />
    </SectionPage>
  );
}

function AccountPage() {
  const { userId, email, games } = useRegistro();
  return (
    <SectionPage title="Account">
      <AccountPanel userId={userId} email={email} games={games} />
    </SectionPage>
  );
}

function NotFoundPage() {
  return <SectionPage title={i18n.t('pagina_non_trovata')}><p className={TEXT_MUTED}>{i18n.t('indirizzo_non_corrisponde_sezione')}</p></SectionPage>;
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
  // Le vecchie pagine-menu non esistono più: i vecchi indirizzi portano alla destinazione utile.
  { path: 'stats', element: <Navigate to={paths.deckStats} replace /> },
  { path: 'stats/decks', element: <SectionPage title="Statistiche Mazzi" stickyTitle wide><GameStats /></SectionPage> },
  { path: 'stats/players', element: <PlayerStatsPage /> },
  { path: 'stats/players/:playerName', element: <PlayerDetailPage /> },
  { path: 'stats/trends', element: <TrendsPage /> },
  { path: 'stats/cards', element: <CardStatsPage /> },
  { path: 'stats/matchups', element: <MatchupsPage /> },
  { path: 'stats/matchups/*', element: <MatchupDetailPage /> },
  { path: 'more', element: <Navigate to={paths.players} replace /> },
  { path: 'players', element: <PlayersPage /> },
  { path: 'faq', element: <FaqPage /> },
  { path: 'faq/:section', element: <FaqPage /> },
  { path: 'faq/:section/:topic', element: <FaqPage /> },
  { path: 'account', element: <AccountPage /> },
  { path: '*', element: <NotFoundPage /> },
];
