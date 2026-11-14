import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../services/supabase';
import { navLinkProps } from '../../router';
import Button from '../ui/Button';
import CenteredPanel from '../ui/Panel';
import { TextField } from '../ui/Field';
import { LOGIN_BACKGROUND } from '../ui/styles';
import { APP_NAME } from '../../appName';

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
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>(linkExpired ? 'forgot' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState(
    linkExpired ? t('link_scaduto_gia_stato_usato') : ''
  );
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Se il link risulta scaduto dopo che la schermata è già comparsa.
  useEffect(() => {
    if (!linkExpired) return;
    setMode('forgot');
    setError(t('link_scaduto_gia_stato_usato'));
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
      setError(t('password_deve_avere_almeno', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== password2) {
      setError(t('due_password_non_coincidono'));
      return;
    }
    if (!supabase) {
      setError(t('supabase_non_configurato'));
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(t('non_sono_riuscito_cambiare_password', { error: updateError.message }));
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
      setError(t('inserisci_tua_email'));
      return;
    }
    if (!supabase) {
      setError(t('supabase_non_configurato'));
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
      setError(t('troppe_richieste_ravvicinate_aspetta_un'));
      return;
    }
    setMessage(t('se_indirizzo_registrato_riceverai_breve'));
  }

  async function handleSubmit() {
    if (recovery) return handleNewPassword();
    if (mode === 'forgot') return handleForgot();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(t('inserisci_email_password'));
      return;
    }
    if (!supabase) {
      setError(t('supabase_non_configurato'));
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      setLoading(false);
      if (signInError) setError(t('accesso_non_riuscito', { error: signInError.message }));
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
        setError(t('registrazione_non_riuscita', { error: signUpError.message }));
      } else if (!data.session) {
        setMessage(t('account_creato_controlla_tua_email'));
        setMode('signin');
      }
    }
  }

  return (
    <CenteredPanel
      onSubmit={handleSubmit}
      background={LOGIN_BACKGROUND}
      title={recovery ? t('nuova_password') : APP_NAME}
      subtitle={
        recovery
          ? t('scegli_nuova_password_per_tuo')
          : mode === 'signin'
            ? t('accedi_con_tuo_account_per')
            : mode === 'signup'
              ? t('crea_un_account_per_iniziare')
              : t('ti_mando_un_link_per')
      }
    >
      {!recovery && (
        <TextField
          id="auth-email"
          name="username"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          label={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('nome_esempio_it')}
          autoComplete="username"
          required
        />
      )}

      {(recovery || mode !== 'forgot') && (
        <TextField
          // key: cambia con la modalità, così il browser rivaluta il campo
          // (password esistente nel login, password nuova nella registrazione).
          key={recovery ? 'recovery' : mode}
          id="auth-password"
          name={mode === 'signin' && !recovery ? 'password' : 'new-password'}
          type="password"
          label={recovery ? t('nuova_password') : t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={recovery ? t('almeno_caratteri', { min: MIN_PASSWORD_LENGTH }) : t('tua_password')}
          autoComplete={mode === 'signin' && !recovery ? 'current-password' : 'new-password'}
          required
        />
      )}

      {recovery && (
        <TextField
          id="auth-password2"
          name="new-password-confirm"
          type="password"
          label={t('ripeti_nuova_password')}
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder={t('scrivila_ancora_una_volta')}
          autoComplete="new-password"
          required
        />
      )}

      <Button type="submit" size="lg" fullWidth disabled={loading}>
        {recovery
          ? t('salva_nuova_password')
          : mode === 'signin'
            ? t('accedi')
            : mode === 'signup'
              ? t('crea_account')
              : t('invia_link_di_recupero')}
      </Button>

      {!recovery && mode === 'signin' && (
        <Button
          variant="text"
          size="sm"
          fullWidth
          onClick={() => goTo('forgot')}
          className="mt-3"
        >
          {t('password_dimenticata')}
        </Button>
      )}

      {!recovery && mode !== 'forgot' && (
        <Button variant="ghost" size="lg" fullWidth className="mt-3" onClick={toggleMode}>
          {mode === 'signin' ? t('non_hai_un_account_registrati') : t('hai_gia_un_account_accedi')}
        </Button>
      )}

      {!recovery && mode === 'forgot' && (
        <Button variant="ghost" size="lg" fullWidth className="mt-3" onClick={() => goTo('signin')}>
          {t('torna_all_accesso')}
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
        {t('vai_zaff_piattaforma_di_gioco')}
      </a>
    </CenteredPanel>
  );
}
