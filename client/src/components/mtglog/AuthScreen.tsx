import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { navLinkProps } from '../../router';
import Button from '../ui/Button';
import CenteredPanel from '../ui/Panel';
import { TextField } from '../ui/Field';
import { LOGIN_BACKGROUND } from '../ui/styles';

type AuthMode = 'signin' | 'signup' | 'forgot';

const MIN_PASSWORD_LENGTH = 6;

interface AuthScreenProps {
  /** Porta alla piattaforma di gioco ZAFF (/zaff). */
  onOpenZaff: () => void;
  /** True quando si arriva dal link "recupera password" ricevuto per email:
   *  invece del login si chiede di scegliere la nuova password. */
  recovery?: boolean;
  /** Il link dell'email era scaduto o già usato: si parte dalla richiesta di un nuovo link. */
  linkExpired?: boolean;
  /** Chiamata dopo aver salvato la nuova password. */
  onRecovered?: () => void;
}

/** Login/registrazione con Supabase Auth (email + password): il riquadro
 *  centrato che nell'app originale copriva la pagina finché non entravi. */
export default function AuthScreen({ onOpenZaff, recovery = false, linkExpired = false, onRecovered }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(linkExpired ? 'forgot' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState(
    linkExpired ? 'Il link è scaduto o è già stato usato. Inserisci l’email per riceverne uno nuovo.' : ''
  );
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Se il link risulta scaduto dopo che la schermata è già comparsa.
  useEffect(() => {
    if (!linkExpired) return;
    setMode('forgot');
    setError('Il link è scaduto o è già stato usato. Inserisci l’email per riceverne uno nuovo.');
  }, [linkExpired]);

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError('');
    setMessage('');
  }

  function goTo(next: AuthMode) {
    setMode(next);
    setError('');
    setMessage('');
  }

  /** Scelta della nuova password dopo il link ricevuto per email. */
  async function handleNewPassword() {
    setError('');
    setMessage('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
      return;
    }
    if (password !== password2) {
      setError('Le due password non coincidono.');
      return;
    }
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError('Non sono riuscito a cambiare la password: ' + updateError.message);
      return;
    }
    setPassword('');
    setPassword2('');
    onRecovered?.();
  }

  /** Invio dell'email con il link per scegliere una nuova password. Il
   *  messaggio è sempre lo stesso, esista o no l'indirizzo, così nessuno può
   *  scoprire quali email sono registrate. */
  async function handleForgot() {
    setError('');
    setMessage('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Inserisci la tua email.');
      return;
    }
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      // Stesso indirizzo di partenza della registrazione (va autorizzato nei
      // "Redirect URLs" di Supabase).
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    });
    setLoading(false);
    if (resetError && /rate|too many|seconds/i.test(resetError.message)) {
      setError('Troppe richieste ravvicinate: aspetta un minuto e riprova.');
      return;
    }
    setMessage('Se l\u2019indirizzo è registrato, riceverai a breve un\u2019email con il link per scegliere una nuova password. Controlla anche la cartella spam.');
  }

  async function handleSubmit() {
    if (recovery) return handleNewPassword();
    if (mode === 'forgot') return handleForgot();
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
        options: {
          // Indirizzo da cui parte davvero questa registrazione, non uno
          // fisso scritto a mano: così il link nell'email di conferma porta
          // sempre al sito giusto, anche se in futuro cambia ancora indirizzo.
          // Va comunque autorizzato una volta nelle impostazioni di Supabase
          // ("Redirect URLs"), altrimenti Supabase lo ignora e usa il suo
          // indirizzo di default.
          emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        },
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
      background={LOGIN_BACKGROUND}
      title={recovery ? 'Nuova password' : 'Registro partite'}
      subtitle={
        recovery
          ? 'Scegli la nuova password per il tuo account'
          : mode === 'signin'
            ? 'Accedi con il tuo account per continuare'
            : mode === 'signup'
              ? 'Crea un account per iniziare'
              : 'Ti mando un link per scegliere una nuova password'
      }
    >
      {!recovery && (
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
      )}

      {(recovery || mode !== 'forgot') && (
        <TextField
          id="auth-password"
          type="password"
          label={recovery ? 'Nuova password' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={recovery ? `Almeno ${MIN_PASSWORD_LENGTH} caratteri` : 'La tua password'}
          autoComplete={mode === 'signin' && !recovery ? 'current-password' : 'new-password'}
          required
        />
      )}

      {recovery && (
        <TextField
          id="auth-password2"
          type="password"
          label="Ripeti la nuova password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Scrivila ancora una volta"
          autoComplete="new-password"
          required
        />
      )}

      <Button type="submit" size="lg" fullWidth disabled={loading}>
        {recovery
          ? 'Salva la nuova password'
          : mode === 'signin'
            ? 'Accedi'
            : mode === 'signup'
              ? 'Crea account'
              : 'Invia il link di recupero'}
      </Button>

      {!recovery && mode === 'signin' && (
        <button
          type="button"
          onClick={() => goTo('forgot')}
          className="mt-3 block w-full py-1 text-center text-sm text-zaff-muted underline transition-colors hover:text-zaff-primary"
        >
          Password dimenticata?
        </button>
      )}

      {!recovery && mode !== 'forgot' && (
        <Button variant="ghost" size="lg" fullWidth className="mt-3" onClick={toggleMode}>
          {mode === 'signin' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </Button>
      )}

      {!recovery && mode === 'forgot' && (
        <Button variant="ghost" size="lg" fullWidth className="mt-3" onClick={() => goTo('signin')}>
          Torna all&apos;accesso
        </Button>
      )}

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
