import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES } from '../services/supabase';
import AuthScreen from './mtglog/AuthScreen';
import PlayersRoster from './mtglog/PlayersRoster';
import DeckList from './mtglog/DeckList';
import DeckEditor from './mtglog/DeckEditor';
import GameForm from './mtglog/GameForm';
import GameList, { type Game } from './mtglog/GameList';
import GameStats from './mtglog/GameStats';
import Standings from './mtglog/Standings';
import MatchupStats from './mtglog/MatchupStats';
import { computeTally, rowToGame } from './mtglog/stats';
import HomeOverview from './mtglog/HomeOverview';
import BottomNav, { type NavTab } from './mtglog/BottomNav';
import Modal from './ui/Modal';
import Button, { ButtonLink } from './ui/Button';
import { CrossedSwordsIcon, GridTile, PodiumIcon, StatsRingIcon, TILE_GRID } from './ui/Tile';
import { cx, HEADING_PAGE, PANEL, TEXT_MUTED } from './ui/styles';
import { navLinkProps } from '../router';

interface MtgLogProps {
  /** Porta alla piattaforma di gioco ZAFF (/zaff). */
  onOpenZaff: () => void;
}

/** Si arriva dal link "recupera password" dell'email: Supabase mette nell'indirizzo
 *  `type=recovery`. Lo leggo subito (prima che il client lo ripulisca), perché
 *  l'evento PASSWORD_RECOVERY può partire prima che questa pagina lo ascolti. */
const OPENED_FROM_RECOVERY_LINK =
  typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search);

/** Il link dell'email è già stato usato o è scaduto: Supabase lo scrive nell'indirizzo
 *  come `error_code=otp_expired` / `error=access_denied`. */
const LINK_ERROR_IN_URL =
  typeof window !== 'undefined' && /error_code=|error=access_denied/.test(window.location.hash + window.location.search);

/** Link condiviso "…/?partita=ID": dopo il login apre quella partita. Letto subito,
 *  all'avvio, e tolto dall'indirizzo una volta usato. */
const SHARED_GAME_ID =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('partita') : null;

type MtgLogModal =
  | null
  | 'players'
  | 'decks'
  | 'newGame'
  | 'games'
  | 'stats'
  | 'playerStats'
  | 'matchups'
  | 'statsMenu'
  | 'more';

/** Quale voce della barra in basso è accesa per il riquadro aperto. */
function tabFor(modal: MtgLogModal): NavTab | null {
  switch (modal) {
    case 'games':
      return 'games';
    case 'decks':
      return 'decks';
    case 'newGame':
      return 'new';
    case 'stats':
    case 'playerStats':
    case 'matchups':
    case 'statsMenu':
      return 'stats';
    case 'players':
    case 'more':
      return 'more';
    default:
      return null;
  }
}

/**
 * Registro Partite MTG (vedi plans/PLAN_5_MTG_LOG_PORTING.md): autenticazione,
 * rubrica giocatori, mazzi (editor + import), partite (form + storico +
 * export immagine), statistiche/classifica (generale e per sfida tra
 * giocatori), contatore punti vita a tutto schermo.
 *
 * Impaginazione ripresa dall'app HTML originale: pagina larga con testata,
 * classifica sempre in vista e tutto il resto in riquadri sovrapposti.
 * È la home dell'app; ZAFF si raggiunge dal link in testata.
 */
export default function MtgLog({ onOpenZaff }: MtgLogProps) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [openModal, setOpenModal] = useState<MtgLogModal>(null);
  const deckPersisting = useRef(false);
  const [deckEditor, setDeckEditor] = useState<
    null | {
      deckId: string | null;
      draft: { name: string; cards: { name: string; qty: number; section?: 'main' | 'side' }[] } | null;
    }
  >(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  /** Partita da cui ripartire con "Rivincita" (stessi giocatori e mazzi). */
  const [rematchFrom, setRematchFrom] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  /** True finché non è stata scelta la nuova password (link di recupero). */
  const [deckCount, setDeckCount] = useState(0);
  const [sharedGameId, setSharedGameId] = useState<string | null>(SHARED_GAME_ID);
  const [recovering, setRecovering] = useState(OPENED_FROM_RECOVERY_LINK);
  const [linkExpired, setLinkExpired] = useState(LINK_ERROR_IN_URL);

  // Arrivato dal link ma, dopo qualche secondo, nessuna sessione: link non valido.
  useEffect(() => {
    if (!OPENED_FROM_RECOVERY_LINK || LINK_ERROR_IN_URL) return;
    const t = setTimeout(() => setLinkExpired(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true);
        setLinkExpired(false);
      }
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loggedIn = session !== null && session !== 'loading';

  // Appena dentro, un link a una partita apre l'elenco con quella partita.
  useEffect(() => {
    if (!loggedIn || !sharedGameId) return;
    setOpenModal('games');
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, [loggedIn, sharedGameId]);

  useEffect(() => {
    if (!loggedIn || !supabase) return;

    async function loadGames() {
      if (!supabase) return;
      const { data } = await supabase.from(TABLE_GAMES).select('*');
      setGames((data ?? []).map(rowToGame));
    }

    loadGames();
    return subscribeToTable(TABLE_GAMES, loadGames);
  }, [loggedIn]);

  // Numero di mazzi salvati, per la pagina iniziale.
  useEffect(() => {
    if (!loggedIn || !supabase) return;
    async function loadDeckCount() {
      if (!supabase) return;
      const { count } = await supabase.from(TABLE_DECKS).select('id', { count: 'exact', head: true });
      setDeckCount(count ?? 0);
    }
    loadDeckCount();
    return subscribeToTable(TABLE_DECKS, loadDeckCount);
  }, [loggedIn]);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <div className={cx(PANEL, 'max-w-md text-center')}>
          <p className="text-red-400">
            Supabase non configurato (variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti).
          </p>
          <ButtonLink
            {...navLinkProps('zaff', onOpenZaff)}
            variant="ghost"
            size="lg"
            fullWidth
            className="mt-6"
          >
            Vai a ZAFF →
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (session === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <p className={TEXT_MUTED}>Caricamento…</p>
      </div>
    );
  }

  if (!session || recovering) {
    return (
      <AuthScreen
        onOpenZaff={onOpenZaff}
        // Senza sessione non c'è niente da recuperare (link scaduto o già usato).
        recovery={recovering && Boolean(session)}
        linkExpired={linkExpired && !session}
        onRecovered={() => setRecovering(false)}
      />
    );
  }

  const userId = session.user.id;
  const standings = computeTally(games);

  function closeModal() {
    setOpenModal(null);
    setEditingGame(null);
    setRematchFrom(null);
  }

  function selectTab(tab: NavTab) {
    const current = tabFor(openModal);
    const root: MtgLogModal =
      tab === 'new' ? 'newGame' : tab === 'stats' ? 'statsMenu' : tab === 'more' ? 'more' : tab;
    // Toccare la voce già aperta: dentro un dettaglio (es. una statistica) torna
    // al menu della sezione, già al menu riporta alla pagina iniziale.
    const target: MtgLogModal = tab === current && openModal === root ? null : root;
    if (
      openModal === 'newGame' &&
      target !== 'newGame' &&
      !window.confirm('Uscire dalla partita? Quello che non hai salvato andrà perso.')
    ) {
      return;
    }
    setEditingGame(null);
    setRematchFrom(null);
    setOpenModal(target);
  }

  return (
    <div className="min-h-screen bg-zaff-bg text-zaff-text">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-5 sm:pt-7">
        <header className="border-b-2 border-zaff-text pb-4 sm:pb-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className={HEADING_PAGE}>Registro partite di Magic</h1>
              <p className="text-sm text-zaff-muted">
                Chi gioca, con che mazzo, come è finita. Condiviso con tutto il gruppo.
              </p>
            </div>
          </div>

          <div className="mtg-sep" />

          {/* Pagina iniziale: tasto Nuova Partita, tre numeri e anteprime di
              partite, mazzi e classifica (ognuna è un solo tasto verso la
              sezione completa). Il resto è nella barra in basso. */}
          <HomeOverview
            games={games}
            deckCount={deckCount}
            onNewGame={() => {
              setEditingGame(null);
              setRematchFrom(null);
              setOpenModal('newGame');
            }}
            onOpenGames={() => setOpenModal('games')}
            onOpenDecks={() => setOpenModal('decks')}
            onOpenPlayerStats={() => setOpenModal('playerStats')}
          />
        </header>
      </div>

      {openModal === 'newGame' && (
        <Modal wide title={editingGame ? 'Modifica Partita' : 'Nuova Partita'} onClose={closeModal}>
          <GameForm
            editingGame={editingGame}
            rematchFrom={rematchFrom}
            onBack={closeModal}
            onSaved={() => {
              setEditingGame(null);
              setRematchFrom(null);
              setOpenModal('games');
            }}
          />
        </Modal>
      )}

      {openModal === 'games' && (
        <Modal wide title="Partite Salvate" onClose={closeModal}>
          <GameList
            userId={userId}
            initialGameId={sharedGameId}
            onInitialOpened={() => setSharedGameId(null)}
            onEdit={(game) => {
              setEditingGame(game);
              setRematchFrom(null);
              setOpenModal('newGame');
            }}
            onRematch={(game) => {
              setEditingGame(null);
              setRematchFrom(game);
              setOpenModal('newGame');
            }}
          />
        </Modal>
      )}

      {openModal === 'stats' && (
        <Modal
          wide
          title="Statistiche Mazzi"
          subtitle="Percentuale di vittoria di ogni mazzo, su tutte le partite."
          onClose={closeModal}
        >
          <GameStats />
        </Modal>
      )}

      {openModal === 'playerStats' && (
        <Modal
          wide
          title="Statistiche Giocatori"
          subtitle="Classifica generale: partite vinte da ciascuno e come si dividono tutte le vittorie."
          onClose={closeModal}
        >
          <Standings rows={standings} games={games} showPie />
        </Modal>
      )}

      {openModal === 'matchups' && (
        <Modal wide title="Statistiche per Sfida" onClose={closeModal}>
          <MatchupStats games={games} />
        </Modal>
      )}

      {openModal === 'statsMenu' && (
        <Modal title="Statistiche" onClose={closeModal}>
          <div className={TILE_GRID}>
            <GridTile graphic={<StatsRingIcon />} label="Mazzi" onClick={() => setOpenModal('stats')} />
            <GridTile graphic={<PodiumIcon />} label="Giocatori" onClick={() => setOpenModal('playerStats')} />
            <GridTile graphic={<CrossedSwordsIcon />} label="Per Sfida" onClick={() => setOpenModal('matchups')} />
          </div>
        </Modal>
      )}

      {openModal === 'more' && (
        <Modal title="Altro" onClose={closeModal}>
          <p className="mb-3 truncate text-sm text-zaff-muted">{session.user.email}</p>
          <div className="flex flex-col gap-2.5">
            <Button variant="ghost" size="lg" fullWidth className="py-3.5" onClick={() => setOpenModal('players')}>
              Gestisci Giocatori
            </Button>
            <ButtonLink {...navLinkProps('zaff', onOpenZaff)} variant="ghost" size="lg" fullWidth className="py-3.5">
              Vai a ZAFF →
            </ButtonLink>
            <Button variant="ghost" size="lg" fullWidth className="py-3.5" onClick={() => supabase?.auth.signOut()}>
              Esci
            </Button>
          </div>
        </Modal>
      )}

      {openModal === 'players' && (
        <Modal
          title="Giocatori"
          subtitle="Rinomina o cancella i nomi in elenco. Le partite già salvate mantengono comunque il nome che avevano."
          onClose={closeModal}
        >
          <PlayersRoster userId={userId} />
        </Modal>
      )}

      {openModal === 'decks' && (
        <Modal title="Mazzi Salvati" onClose={closeModal}>
          <DeckList
            userId={userId}
            onCreate={() => setDeckEditor({ deckId: null, draft: null })}
            onEdit={(id) => setDeckEditor({ deckId: id, draft: null })}
            onImportFile={(name, cards) => setDeckEditor({ deckId: null, draft: { name, cards } })}
          />
        </Modal>
      )}

      {deckEditor && (
        <Modal
          level={2}
          title={deckEditor.deckId ? 'Modifica Mazzo' : 'Nuovo Mazzo'}
          onClose={() => { if (!deckPersisting.current) setDeckEditor(null); }}
        >
          <DeckEditor
            deckId={deckEditor.deckId}
            initialDraft={deckEditor.draft}
            onPersistingChange={(busy) => { deckPersisting.current = busy; }}
            onBack={() => { if (!deckPersisting.current) setDeckEditor(null); }}
            onSaved={() => setDeckEditor(null)}
          />
        </Modal>
      )}

      <BottomNav active={tabFor(openModal)} onSelect={selectTab} />
    </div>
  );
}
