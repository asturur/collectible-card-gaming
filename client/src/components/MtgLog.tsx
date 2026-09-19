import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';

interface MtgLogProps {
  onBack: () => void;
}

type ConnectionStatus = 'checking' | 'ok' | 'error';

/**
 * Registro Partite MTG — placeholder screen (Step 0 of the porting plan).
 * Verifies the Supabase connection; real features are added in later steps.
 * See plans/PLAN_5_MTG_LOG_PORTING.md
 */
export default function MtgLog({ onBack }: MtgLogProps) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('error');
      setErrorMessage('Supabase non configurato (variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti).');
      return;
    }

    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
      } else {
        setStatus('ok');
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold tracking-tight text-zaff-primary">
          Registro Partite
        </h1>

        {status === 'checking' && <p className="text-center text-zaff-muted">Connessione a Supabase in corso…</p>}
        {status === 'ok' && <p className="text-center text-green-400">✓ Connesso a Supabase</p>}
        {status === 'error' && <p className="text-center text-red-400">Errore: {errorMessage}</p>}

        <button
          type="button"
          onClick={onBack}
          className="mt-8 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
