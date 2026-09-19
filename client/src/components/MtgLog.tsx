import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import AuthScreen from './mtglog/AuthScreen';
import PlayersRoster from './mtglog/PlayersRoster';
import GroupsRoster from './mtglog/GroupsRoster';

interface MtgLogProps {
  onBack: () => void;
}

type MtgLogView = 'home' | 'players' | 'groups';

/**
 * Registro Partite MTG — porting in corso (vedi plans/PLAN_5_MTG_LOG_PORTING.md).
 * Step 1: autenticazione. Le funzionalità del registro vengono aggiunte
 * negli step successivi.
 */
export default function MtgLog({ onBack }: MtgLogProps) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [view, setView] = useState<MtgLogView>('home');

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

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 text-center shadow-xl">
          <p className="text-red-400">
            Supabase non configurato (variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti).
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
          >
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  if (session === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <p className="text-zaff-muted">Caricamento…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onBack={onBack} />;
  }

  if (view === 'players') {
    return <PlayersRoster userId={session.user.id} onBack={() => setView('home')} />;
  }

  if (view === 'groups') {
    return <GroupsRoster userId={session.user.id} onBack={() => setView('home')} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-zaff-primary">
          Registro Partite
        </h1>
        <p className="mb-8 text-center text-zaff-muted">Accesso come {session.user.email}</p>

        <button
          type="button"
          onClick={() => setView('players')}
          className="w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover"
        >
          👤 Gestisci giocatori
        </button>

        <button
          type="button"
          onClick={() => setView('groups')}
          className="mt-3 w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover"
        >
          🏷️ Gestisci gruppi
        </button>

        <button
          type="button"
          onClick={() => supabase?.auth.signOut()}
          className="mt-3 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Esci
        </button>

        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full text-center text-sm text-zaff-muted transition-colors hover:text-zaff-primary"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
