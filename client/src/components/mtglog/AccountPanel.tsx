import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ChoiceField, TextField } from '../ui/Field';
import { cx, HEADING_SECTION, SURFACE, TEXT_MINI, TEXT_MUTED } from '../ui/styles';
import { deleteMyAccount, signOut } from '../../services/account';
import { useSavedDeckList } from './useSavedDeck';
import type { Game } from './GameList';


type DeckChoice = 'keep' | 'delete';

/**
 * Pagina Account: con chi si è entrati, "Esci" e la cancellazione dell'account.
 * Chi se ne va sceglie se eliminare anche i suoi mazzi; le partite restano sempre,
 * perché coinvolgono anche gli altri giocatori.
 */
export default function AccountPanel({ userId, email, games }: { userId: string; email: string | undefined; games: Game[] }) {
  const { t } = useTranslation();
  /** Parola da scrivere per confermare la cancellazione, nella lingua in uso (ELIMINA / DELETE). */
  const confirmWord = t('parola_conferma');
  const { decks, loading: decksLoading } = useSavedDeckList();
  const myDecks = decks.filter((d) => d.createdBy === userId).length;
  const myGames = games.filter((g) => g.createdBy === userId).length;

  const [open, setOpen] = useState(false);
  const [deckChoice, setDeckChoice] = useState<DeckChoice>('keep');
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim().toUpperCase() === confirmWord;

  function close() {
    // Mentre la cancellazione è in corso il riquadro resta aperto.
    if (deleting) return;
    setOpen(false);
    setError('');
  }

  async function confirmDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError('');
    try {
      // Se riesce, la sessione si chiude e l'app torna alla schermata di accesso.
      await deleteMyAccount({ deleteDecks: deckChoice === 'delete' });
    } catch (err) {
      setError(t('non_sono_riuscito_eliminare_account', { error: (err as Error).message }));
      setDeleting(false);
    }
  }

  return (
    <>
      <section className={cx(SURFACE, 'mb-6 p-4')}>
        <p className={TEXT_MUTED}>{t('accesso_con')}</p>
        <p className="mb-4 break-all text-base text-zaff-text">{email ?? '—'}</p>
        <Button variant="ghost" onClick={() => { void signOut(); }}>{t('esci')}</Button>
      </section>

      <section className={cx(SURFACE, 'p-4')}>
        <h2 className={cx(HEADING_SECTION, 'mb-2')}>{t('elimina_account')}</h2>
        <p className={cx('mb-4', TEXT_MUTED)}>
          {t('account_sua_email_vengono_cancellati')}
        </p>
        <Button variant="danger" onClick={() => setOpen(true)}>{t('elimina_account_dialogo')}</Button>
      </section>

      {open && (
        <Modal title={t('eliminare_account')} onClose={close}>
          <ChoiceField<DeckChoice>
            legend={decksLoading ? t('tuoi_mazzi') : t('tuoi_mazzi_count', { count: myDecks })}
            value={deckChoice}
            onChange={setDeckChoice}
            disabled={deleting}
            options={[
              {
                value: 'keep',
                label: t('lasciali_al_gruppo'),
                hint: t('restano_nell_elenco_nelle_statistiche'),
              },
              {
                value: 'delete',
                label: t('eliminali'),
                hint: t('spariscono_dall_elenco_dalle_statistiche'),
              },
            ]}
          />
          <p className={cx('mb-4 rounded-lg border border-zaff-border px-3 py-2', TEXT_MINI)}>
            {t('partite_che_hai_salvato', { count: myGames })}
          </p>
          <TextField
            label={t('per_confermare_scrivi', { word: confirmWord })}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            disabled={deleting}
            error={error}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={deleting}>{t('annulla')}</Button>
            <Button variant="danger" onClick={() => { void confirmDelete(); }} disabled={!confirmed || deleting}>
              {deleting ? t('eliminazione') : t('elimina_definitivamente')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
