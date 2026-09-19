import { useState, type FormEvent } from 'react';
import { supabase } from '../../services/supabase';

type AuthMode = 'signin' | 'signup';

interface AuthScreenProps {
  onBack: () => void;
}

/** Login/registrazione con Supabase Auth (email + password). */
export default function AuthScreen({ onBack }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError('');
    setMessage('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Inserisci email e password.');
      return;
    }
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      setLoading(false);
      if (signInError) setError('Accesso non riuscito: ' + signInError.message);
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      setLoading(false);
      if (signUpError) {
        setError('Registrazione non riuscita: ' + signUpError.message);
      } else if (!data.session) {
        setMessage('Account creato. Controlla la tua email per confermarlo, poi accedi.');
        setMode('signin');
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-zaff-primary">
          Registro Partite
        </h1>
        <p className="mb-8 text-center text-zaff-muted">Accedi con il tuo account per continuare</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="username"
            required
            className="mb-3 w-full rounded-lg border border-zaff-border bg-zaff-bg px-4 py-3 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="mb-3 w-full rounded-lg border border-zaff-border bg-zaff-bg px-4 py-3 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover focus:outline-none focus:ring-2 focus:ring-zaff-primary focus:ring-offset-2 focus:ring-offset-zaff-surface disabled:opacity-60"
          >
            {mode === 'signin' ? 'Accedi' : 'Crea account'}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          className="mt-3 w-full rounded-lg border border-zaff-border px-4 py-3 text-sm text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          {mode === 'signin' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>

        {error && (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {message && <p className="mt-3 text-center text-sm text-green-400">{message}</p>}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full text-center text-sm text-zaff-muted transition-colors hover:text-zaff-primary"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
