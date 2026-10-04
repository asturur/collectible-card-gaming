import { useEffect, useState } from 'react';
import { canEdit, sameName, supabase, TABLE_GAMES, TABLE_PLAYERS } from '../../services/supabase';
import Button from '../ui/Button';
import { FIELD_CONTROL_SM } from '../ui/styles';

interface PlayersRosterProps {
  userId: string;
}

interface RosterEntry {
  name: string;
  createdBy: string | null;
}

/** Nome digitato che somiglia (a parte maiuscole/spazi) a uno già in elenco:
 *  prima di aggiungere o rinominare, si chiede se è la stessa persona. */
interface NameConflict {
  typed: string;
  existing: string;
}

/** Riga di `partite.players` (JSON) rilevante per la rinomina. */
interface GamePlayer {
  name: string;
  [key: string]: unknown;
}

/** Rubrica giocatori condivisa: lista, aggiungi, rinomina (con propagazione), elimina.
 *  Va mostrata dentro un `Modal` (titolo e chiusura li mette il riquadro). */
export default function PlayersRoster({ userId }: PlayersRosterProps) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [addConflict, setAddConflict] = useState<NameConflict | null>(null);
  const [renameConflict, setRenameConflict] = useState<(NameConflict & { oldName: string }) | null>(null);

  async function loadRoster() {
    if (!supabase) return;
    const { data, error: loadError } = await supabase.from(TABLE_PLAYERS).select('name, created_by').order('name');
    if (loadError) {
      setError('Non riesco a leggere la rubrica: ' + loadError.message);
      return;
    }
    setRoster((data ?? []).map((r) => ({ name: r.name, createdBy: r.created_by })));
  }

  useEffect(() => {
    loadRoster().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** `treatAsDifferent` arriva true solo dopo che l'utente ha già risposto
   *  "no, è un'altra persona" all'avviso di omonimia: salta il controllo e
   *  aggiunge comunque il nome digitato, senza richiederlo di nuovo. */
  async function handleAdd(treatAsDifferent = false) {
    const name = newName.trim();
    if (!name || !supabase) return;

    if (!treatAsDifferent) {
      if (roster.some((r) => r.name === name)) {
        setNewName('');
        setError('');
        setAddConflict(null);
        return;
      }
      // Somiglia (a parte maiuscole/spazi) a uno già in elenco: non si sa se
      // è un errore di battitura o un omonimo, quindi si chiede all'utente
      // invece di decidere da soli.
      const nearMatch = roster.find((r) => sameName(r.name, name));
      if (nearMatch) {
        setAddConflict({ typed: name, existing: nearMatch.name });
        return;
      }
    }

    const { error: insertError } = await supabase.from(TABLE_PLAYERS).insert({ name });
    if (insertError && insertError.code !== '23505') {
      setError('Non sono riuscito ad aggiungere il giocatore: ' + insertError.message);
      return;
    }
    setNewName('');
    setError('');
    setAddConflict(null);
    await loadRoster();
  }

  /** `treatAsDifferent` true = l'utente ha confermato che non è la stessa
   *  persona: si rinomina senza fondere con l'omonimo trovato. */
  async function renamePlayerEverywhere(
    oldName: string,
    newNameValue: string,
    treatAsDifferent = false
  ): Promise<string | null> {
    if (!supabase) return 'Supabase non configurato.';

    // Se il nuovo nome coincide (a parte maiuscole/spazi) con uno già in
    // elenco ed è davvero la stessa persona, fondo i due usando la grafia
    // già esistente invece di creare un doppione tipo "Andrea"/"andrea".
    // Escludo la riga stessa che sto rinominando: altrimenti correggere solo
    // le maiuscole (es. "andrea" -> "Andrea") sembrerebbe un doppione con se stessa.
    const existingMatch = treatAsDifferent
      ? undefined
      : roster.find((r) => r.name !== oldName && sameName(r.name, newNameValue));
    const finalName = existingMatch ? existingMatch.name : newNameValue;

    if (existingMatch) {
      const { error: deleteError } = await supabase.from(TABLE_PLAYERS).delete().eq('name', oldName);
      if (deleteError) return deleteError.message;
    } else {
      const { error: updateError } = await supabase.from(TABLE_PLAYERS).update({ name: finalName }).eq('name', oldName);
      if (updateError) return updateError.message;
    }

    const { data: gamesData, error: gamesError } = await supabase.from(TABLE_GAMES).select('id, players');
    if (gamesError) return gamesError.message;

    const affected = (gamesData ?? []).filter((g) =>
      ((g.players ?? []) as GamePlayer[]).some((p) => p.name === oldName)
    );
    for (const g of affected) {
      const updatedPlayers = ((g.players ?? []) as GamePlayer[]).map((p) =>
        p.name === oldName ? { ...p, name: finalName } : p
      );
      const { error: gameUpdateError } = await supabase.from(TABLE_GAMES).update({ players: updatedPlayers }).eq('id', g.id);
      if (gameUpdateError) return gameUpdateError.message;
    }

    return null;
  }

  function startRename(name: string) {
    setRenaming(name);
    setRenameValue(name);
    setError('');
    setRenameConflict(null);
  }

  async function applyRename(oldName: string, newNameValue: string, treatAsDifferent: boolean) {
    setRenaming(null);
    setRenameConflict(null);
    const renameError = await renamePlayerEverywhere(oldName, newNameValue, treatAsDifferent);
    if (renameError) {
      setError('Rinomina non riuscita: ' + renameError);
      return;
    }
    await loadRoster();
  }

  async function confirmRename(oldName: string) {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === oldName) {
      setRenaming(null);
      return;
    }
    // Come per "Aggiungi": una somiglianza (non un'identità esatta, impossibile
    // tra due righe della rubrica) va chiesta, non decisa in automatico.
    const nearMatch = roster.find((r) => r.name !== oldName && sameName(r.name, trimmed));
    if (nearMatch) {
      setRenameConflict({ oldName, typed: trimmed, existing: nearMatch.name });
      return;
    }
    await applyRename(oldName, trimmed, false);
  }

  async function handleDelete(name: string) {
    if (!supabase) return;
    if (!confirm(`Cancellare "${name}" dall'elenco giocatori? Le partite già salvate continueranno a mostrare il suo nome.`)) return;
    const { error: deleteError } = await supabase.from(TABLE_PLAYERS).delete().eq('name', name);
    if (deleteError) {
      setError('Cancellazione non riuscita: ' + deleteError.message);
      return;
    }
    await loadRoster();
  }

  return (
    <>
      <div className="mb-2 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setAddConflict(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nome nuovo giocatore"
          className={FIELD_CONTROL_SM}
        />
        <Button onClick={() => handleAdd()} className="shrink-0">
          Aggiungi
        </Button>
      </div>

      {addConflict && (
        <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-sm text-zaff-text">
          <p className="mb-2">Esiste già un giocatore chiamato "{addConflict.existing}". È la stessa persona?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setNewName('');
                setAddConflict(null);
              }}
            >
              Sì, non aggiungere
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleAdd(true)}>
              No, è un'altra persona
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zaff-muted">Caricamento…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-zaff-muted">Ancora nessun giocatore in elenco.</p>
      ) : (
        <ul className="divide-y divide-zaff-border">
          {roster.map((r) => (
            <li key={r.name} className="flex flex-col gap-2 py-2">
              <div className="flex items-center justify-between gap-2">
                {renaming === r.name ? (
                  <>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => {
                        setRenameValue(e.target.value);
                        setRenameConflict(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && confirmRename(r.name)}
                      autoFocus
                      className={FIELD_CONTROL_SM}
                    />
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="link" size="sm" onClick={() => confirmRename(r.name)}>
                        Salva
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRenaming(null);
                          setRenameConflict(null);
                        }}
                      >
                        Annulla
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-zaff-text">{r.name}</span>
                    {canEdit(r.createdBy, userId) && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button variant="link" size="sm" onClick={() => startRename(r.name)}>
                          Rinomina
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(r.name)}>
                          Cancella
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {renaming === r.name && renameConflict && renameConflict.oldName === r.name && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-sm text-zaff-text">
                  <p className="mb-2">Esiste già un giocatore chiamato "{renameConflict.existing}". È la stessa persona?</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => applyRename(renameConflict.oldName, renameConflict.typed, false)}
                    >
                      Sì, è lui/lei
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyRename(renameConflict.oldName, renameConflict.typed, true)}
                    >
                      No, è un'altra persona
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
