import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, subscribeToTable, supabase, TABLE_GAMES } from '../services/supabase';
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
import Modal from './ui/Modal';
import Button, { ButtonLink } from './ui/Button';
import { DeckBackArt, GridTile, OpenBookIcon, PlayersIcon, StatsRingIcon, SwordShieldIcon, TILE_GRID } from './ui/Tile';
import { cx, HEADING_PAGE, PANEL, TEXT_MUTED } from './ui/styles';
import { navLinkProps } from '../router';

interface MtgLogProps {
  /** Porta alla piattaforma di gioco ZAFF (/zaff). */
  onOpenZaff: () => void;
}

type MtgLogModal = null | 'players' | 'decks' | 'newGame' | 'games' | 'stats';

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
  const [deckEditor, setDeckEditor] = useState<
    null | {
      deckId: string | null;
      draft: { name: string; cards: { name: string; qty: number; section?: 'main' | 'side' }[] } | null;
    }
  >(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));

    return () => subscription.unsubscribe();
  }, []);

  const loggedIn = session !== null && session !== 'loading';

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

  if (!session) {
    return <AuthScreen onOpenZaff={onOpenZaff} />;
  }

  const userId = session.user.id;
  const standings = computeTally(games);

  function closeModal() {
    setOpenModal(null);
    setEditingGame(null);
  }

  return (
    <div className="min-h-screen bg-zaff-bg text-zaff-text">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-6 sm:px-5 sm:pt-7">
        <header className="border-b-2 border-zaff-text pb-4 sm:pb-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className={HEADING_PAGE}>Registro partite di Magic</h1>
              <p className="text-sm text-zaff-muted">
                Chi gioca, con che mazzo, come è finita. Condiviso con tutto il gruppo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="truncate text-xs text-zaff-muted">{session.user.email}</span>
              <Button variant="ghost" onClick={() => supabase?.auth.signOut()}>
                Esci
              </Button>
              <ButtonLink {...navLinkProps('zaff', onOpenZaff)} variant="ghost">
                Vai a ZAFF →
              </ButtonLink>
            </div>
          </div>

          <div className="mtg-sep" />

          {/* 5 tasti principali: stessa misura e forma per tutti (a prescindere dal
              testo), come le tessere delle statistiche qui sotto — più facili da
              individuare e "toccare" col dito su schermo piccolo. */}
          <div className={TILE_GRID}>
            <GridTile
              graphic={<SwordShieldIcon />}
              label="Nuova Partita"
              onClick={() => {
                setEditingGame(null);
                setOpenModal('newGame');
              }}
            />
            <GridTile graphic={<OpenBookIcon />} label="Partite Salvate" onClick={() => setOpenModal('games')} />
            <GridTile graphic={<StatsRingIcon />} label="Statistiche Mazzi" onClick={() => setOpenModal('stats')} />
            <GridTile graphic={<PlayersIcon />} label="Gestisci Giocatori" onClick={() => setOpenModal('players')} />
            <GridTile graphic={<DeckBackArt />} label="Gestisci Mazzi" onClick={() => setOpenModal('decks')} />
          </div>

          <div className="mtg-sep" />

          <Standings rows={standings} showPie />
          <MatchupStats games={games} />
        </header>
      </div>

      {openModal === 'newGame' && (
        <Modal wide title={editingGame ? 'Modifica Partita' : 'Nuova Partita'} onClose={closeModal}>
          <GameForm
            editingGame={editingGame}
            onBack={closeModal}
            onSaved={() => {
              setEditingGame(null);
              setOpenModal('games');
            }}
          />
        </Modal>
      )}

      {openModal === 'games' && (
        <Modal wide title="Partite Salvate" onClose={closeModal}>
          <GameList
            userId={userId}
            onEdit={(game) => {
              setEditingGame(game);
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
          onClose={() => setDeckEditor(null)}
        >
          <DeckEditor
            deckId={deckEditor.deckId}
            initialDraft={deckEditor.draft}
            onBack={() => setDeckEditor(null)}
            onSaved={() => setDeckEditor(null)}
          />
        </Modal>
      )}
    </div>
  );
}
