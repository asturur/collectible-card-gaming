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
import { computeTally, rowToGame } from './mtglog/stats';
import Modal from './ui/Modal';
import Button, { ButtonLink } from './ui/Button';
import { cx, HEADING_PAGE, PANEL, TEXT_MUTED } from './ui/styles';
import { navLinkProps } from '../router';

interface MtgLogProps {
  /** Porta alla piattaforma di gioco ZAFF (/zaff). */
  onOpenZaff: () => void;
}

type MtgLogModal = null | 'players' | 'decks' | 'newGame' | 'games' | 'stats';

/** Icona "mazzo di carte" del bottone Gestisci mazzi, come nell'app originale. */
function DeckIcon() {
  return (
    <svg width="14" height="19" viewBox="0 0 14 19" className="-mb-0.5" aria-hidden="true">
      <rect x="0.5" y="0.5" width="13" height="18" rx="2.2" fill="#0B0B0C" stroke="#0B0B0C" />
      <rect x="1.8" y="1.8" width="10.4" height="15.4" rx="1.4" fill="#3B2A6B" />
      <ellipse cx="7" cy="9.5" rx="3.6" ry="5.2" fill="#CBB994" />
    </svg>
  );
}

/**
 * Registro Partite MTG (vedi plans/PLAN_5_MTG_LOG_PORTING.md): autenticazione,
 * rubriche giocatori/gruppi, mazzi (editor + import), partite (form + storico +
 * export immagine), statistiche/classifica, contatore punti vita a tutto schermo.
 *
 * Impaginazione ripresa dall'app HTML originale: pagina larga con testata,
 * classifica sempre in vista e tutto il resto in riquadri sovrapposti.
 * È la home dell'app; ZAFF si raggiunge dal link in testata.
 */
export default function MtgLog({ onOpenZaff }: MtgLogProps) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [openModal, setOpenModal] = useState<MtgLogModal>(null);
  const [deckEditor, setDeckEditor] = useState<
    null | { deckId: string | null; draft: { name: string; cards: { name: string; qty: number }[] } | null }
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

            <div className="flex w-full flex-col items-stretch gap-0.5 sm:w-auto sm:items-end">
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <span className="truncate text-xs text-zaff-muted">{session.user.email}</span>
                <Button variant="ghost" onClick={() => supabase?.auth.signOut()}>
                  Esci
                </Button>
                <ButtonLink {...navLinkProps('zaff', onOpenZaff)} variant="ghost">
                  Vai a ZAFF →
                </ButtonLink>
              </div>

              <div className="mtg-sep" />

              <div className="flex flex-wrap gap-2.5 sm:justify-end">
                <Button
                  onClick={() => {
                    setEditingGame(null);
                    setOpenModal('newGame');
                  }}
                >
                  ➕ Nuova partita
                </Button>
                <Button onClick={() => setOpenModal('games')}>📜 Partite salvate</Button>
                <Button onClick={() => setOpenModal('stats')}>📊 Statistiche mazzi</Button>
              </div>

              <div className="mtg-sep" />

              <div className="flex flex-wrap gap-2.5 sm:justify-end">
                <Button onClick={() => setOpenModal('players')}>👤 Gestisci giocatori</Button>
                <Button onClick={() => setOpenModal('decks')}>
                  <DeckIcon /> Gestisci mazzi
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="inline-block rounded-lg border border-zaff-text bg-zaff-text px-3 py-1.5 text-[13px] text-zaff-bg">
              Tutte le partite
            </span>
          </div>

          <Standings rows={standings} showPie />
        </header>
      </div>

      {openModal === 'newGame' && (
        <Modal wide title={editingGame ? 'Modifica partita' : 'Nuova partita'} onClose={closeModal}>
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
        <Modal wide title="Partite salvate" onClose={closeModal}>
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
          title="Statistiche mazzi"
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
        <Modal title="Mazzi salvati" onClose={closeModal}>
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
          title={deckEditor.deckId ? 'Modifica mazzo' : 'Nuovo mazzo'}
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
