import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES } from '../services/supabase';
import AuthScreen from './mtglog/AuthScreen';
import type { Game } from './mtglog/GameList';
import { rowToGame } from './mtglog/stats';
import BottomNav from './mtglog/BottomNav';
import { ButtonLink } from './ui/Button';
import { cx, PANEL, TEXT_MUTED } from './ui/styles';
import { navLinkProps, paths } from '../router';

export interface RegistroContext {
  userId: string;
  email: string | undefined;
  games: Game[];
  gamesLoading: boolean;
  gamesError: string;
  deckCount: number;
}

export const useRegistro = () => useOutletContext<RegistroContext>();

/** Si arriva dal link "recupera password" dell'email: Supabase mette nell'indirizzo
 *  `type=recovery`. Lo leggo subito (prima che il client lo ripulisca), perché
 *  l'evento PASSWORD_RECOVERY può partire prima che questa pagina lo ascolti. */
const OPENED_FROM_RECOVERY_LINK =
  typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search);

/** Il link dell'email è già stato usato o è scaduto: Supabase lo scrive nell'indirizzo
 *  come `error_code=otp_expired` / `error=access_denied`. */
const LINK_ERROR_IN_URL =
  typeof window !== 'undefined' && /error_code=|error=access_denied/.test(window.location.hash + window.location.search);

/** Authentication and shared data remain mounted while Registro pages change. */
export default function MtgLog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState('');
  const [deckCount, setDeckCount] = useState(0);
  const [recovering, setRecovering] = useState(OPENED_FROM_RECOVERY_LINK);
  const [linkExpired, setLinkExpired] = useState(LINK_ERROR_IN_URL);
  const onOpenZaff = () => { void navigate(paths.zaff); };

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

  useEffect(() => {
    if (!loggedIn || !supabase) return;
    let cancelled = false;
    async function loadGames() {
      if (!supabase) return;
      const { data, error } = await supabase.from(TABLE_GAMES).select('*');
      if (cancelled) return;
      setGamesError(error ? 'Non riesco a leggere il registro condiviso: ' + error.message : '');
      if (!error) setGames((data ?? []).map(rowToGame));
      setGamesLoading(false);
    }
    void loadGames();
    const unsubscribe = subscribeToTable(TABLE_GAMES, loadGames);
    return () => { cancelled = true; unsubscribe(); };
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

  // Older shared links still open the corresponding refreshable game page.
  const sharedGameId = searchParams.get('partita');
  if (sharedGameId) return <Navigate to={paths.game(sharedGameId)} replace />;

  return (
    <div className="min-h-screen bg-zaff-bg text-zaff-text">
      <Outlet context={{ userId: session.user.id, email: session.user.email, games, gamesLoading, gamesError, deckCount } satisfies RegistroContext} />
      <BottomNav />
    </div>
  );
}
