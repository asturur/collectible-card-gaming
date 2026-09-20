import { useState } from 'react';
import { supabase } from '../../services/supabase';
import { navLinkProps } from '../../router';
import Button from '../ui/Button';
import CenteredPanel from '../ui/Panel';
import { TextField } from '../ui/Field';

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

  async function handleSubmit() {
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
    <CenteredPanel
      onSubmit={handleSubmit}
      title="Registro partite"
      subtitle={mode === 'signin' ? 'Accedi con il tuo account per continuare' : 'Crea un account per iniziare'}
    >
      <TextField
        id="auth-email"
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nome@esempio.it"
        autoComplete="username"
        required
      />

      <TextField
        id="auth-password"
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="La tua password"
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        required
      />

      <Button type="submit" size="lg" fullWidth disabled={loading}>
        {mode === 'signin' ? 'Accedi' : 'Crea account'}
      </Button>

      <Button variant="ghost" size="lg" fullWidth className="mt-3" onClick={toggleMode}>
        {mode === 'signin' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
      </Button>

      {error && (
        <p className="mt-3 text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {message && <p className="mt-3 text-center text-sm text-green-400">{message}</p>}

      <a
        {...navLinkProps('zaff', onOpenZaff)}
        className="mt-4 block w-full text-center text-sm text-zaff-muted transition-colors hover:text-zaff-primary"
      >
        Vai a ZAFF, la piattaforma di gioco →
      </a>
    </CenteredPanel>
  );
}
