import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ChoiceField, TextField } from '../ui/Field';
import { cx, HEADING_SECTION, SURFACE, TEXT_MINI, TEXT_MUTED } from '../ui/styles';
import { deleteMyAccount, signOut } from '../../services/account';
import { useSavedDeckList } from './useSavedDeck';
import type { Game } from './GameList';

/** Parola da scrivere per confermare la cancellazione. */
export const CONFIRM_WORD = 'ELIMINA';

type DeckChoice = 'keep' | 'delete';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Pagina Account: con chi si è entrati, "Esci" e la cancellazione dell'account.
 * Chi se ne va sceglie se eliminare anche i suoi mazzi; le partite restano sempre,
 * perché coinvolgono anche gli altri giocatori.
 */
export default function AccountPanel({ userId, email, games }: { userId: string; email: string | undefined; games: Game[] }) {
  const { decks, loading: decksLoading } = useSavedDeckList();
  const myDecks = decks.filter((d) => d.createdBy === userId).length;
  const myGames = games.filter((g) => g.createdBy === userId).length;

  const [open, setOpen] = useState(false);
  const [deckChoice, setDeckChoice] = useState<DeckChoice>('keep');
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

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
      setError('Non sono riuscito a eliminare l’account: ' + (err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <>
      <section className={cx(SURFACE, 'mb-6 p-4')}>
        <p className={TEXT_MUTED}>Accesso con</p>
        <p className="mb-4 break-all text-base text-zaff-text">{email ?? '—'}</p>
        <Button variant="ghost" onClick={() => { void signOut(); }}>Esci</Button>
      </section>

      <section className={cx(SURFACE, 'p-4')}>
        <h2 className={cx(HEADING_SECTION, 'mb-2')}>Elimina account</h2>
        <p className={cx('mb-4', TEXT_MUTED)}>
          L’account e la sua email vengono cancellati per sempre. Le partite che hai salvato restano
          nello storico del gruppo; per i tuoi mazzi puoi scegliere.
        </p>
        <Button variant="danger" onClick={() => setOpen(true)}>Elimina account…</Button>
      </section>

      {open && (
        <Modal title="Eliminare l’account?" onClose={close}>
          <ChoiceField<DeckChoice>
            legend={decksLoading ? 'I tuoi mazzi' : `I tuoi mazzi (${myDecks})`}
            value={deckChoice}
            onChange={setDeckChoice}
            disabled={deleting}
            options={[
              {
                value: 'keep',
                label: 'Lasciali al gruppo',
                hint: 'Restano nell’elenco e nelle statistiche, senza proprietario: chiunque abbia un account potrà modificarli.',
              },
              {
                value: 'delete',
                label: 'Eliminali',
                hint: 'Spariscono dall’elenco e dalle statistiche delle carte di tutti. Le partite già giocate continuano a mostrarne il nome. Se vuoi conservarli, esportali prima dalla pagina di ogni mazzo.',
              },
            ]}
          />
          <p className={cx('mb-4 rounded-lg border border-zaff-border px-3 py-2', TEXT_MINI)}>
            Le partite che hai salvato ({plural(myGames, 'partita', 'partite')}) restano nello storico del gruppo,
            senza proprietario. Restano anche il tuo nome giocatore e i gruppi che hai creato.
          </p>
          <TextField
            label={`Per confermare scrivi ${CONFIRM_WORD}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            disabled={deleting}
            error={error}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close} disabled={deleting}>Annulla</Button>
            <Button variant="danger" onClick={() => { void confirmDelete(); }} disabled={!confirmed || deleting}>
              {deleting ? 'Eliminazione…' : 'Elimina definitivamente'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
