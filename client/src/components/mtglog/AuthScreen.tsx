import { useState, type FormEvent } from 'react';
import { supabase } from '../../services/supabase';
import { BTN_LINK, BTN_PRIMARY, INPUT } from './ui';
import { navLinkProps } from '../../router';

type AuthMode = 'signin' | 'signup';

interface AuthScreenProps {
  /** Porta alla piattaforma di gioco ZAFF (/zaff). */
  onOpenZaff: () => void;
}

/** Login/registrazione con Supabase Auth (email + password): il riquadro
 *  centrato che nell'app originale copriva la pagina finché non entravi. */
export default function AuthScreen({ onOpenZaff }: AuthScreenProps) {
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
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-5">
      <div className="w-full max-w-[320px] rounded-lg border border-zaff-border bg-zaff-surface px-6 py-7 text-center">
        <h1 className="mb-1.5 font-serif text-xl text-zaff-text">Registro partite</h1>
        <p className="mb-4 text-sm text-zaff-muted">
          {mode === 'signin' ? 'Accedi con il tuo account per continuare' : 'Crea un account per iniziare'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="username"
            required
            className={`${INPUT} mb-2.5 text-center`}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className={`${INPUT} mb-2.5 text-center`}
          />
          <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full py-2.5`}>
            {mode === 'signin' ? 'Accedi' : 'Crea account'}
          </button>
        </form>

        <button type="button" onClick={toggleMode} className={`${BTN_LINK} mt-2 w-full`}>
          {mode === 'signin' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>

        {error && (
          <p className="mt-2 min-h-[18px] text-[13px] text-red-400" role="alert">
            {error}
          </p>
        )}
        {message && <p className="mt-2 text-[13px] text-green-400">{message}</p>}

        <a
          {...navLinkProps('zaff', onOpenZaff)}
          className="mt-4 block w-full text-center text-xs text-zaff-muted transition hover:text-zaff-gold"
        >
          Vai a ZAFF, la piattaforma di gioco →
        </a>
      </div>
    </div>
  );
}
