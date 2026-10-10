import { useEffect, useState } from 'react';
import {
  canEdit,
  MAX_PLAYER_NAME_LENGTH,
  sameName,
  suggestAlternativeNames,
  supabase,
  TABLE_GAMES,
  TABLE_PLAYERS,
} from '../../services/supabase';
import Button, { ButtonRouteLink } from '../ui/Button';
import Modal from '../ui/Modal';
import CharCount from '../ui/CharCount';
import { cx, FIELD_CONTROL_SM, STICKY_BELOW_TITLE } from '../ui/styles';
import { paths } from '../../router';
import type { Game } from './GameList';

interface PlayersRosterProps {
  userId: string;
  /** Partite del registro, per contare quante ne ha giocate il giocatore aperto. */
  games?: Game[];
}

interface RosterEntry {
  name: string;
  createdBy: string | null;
}

/** Nome digitato che somiglia (a parte maiuscole/spazi) a uno già in elenco:
 *  prima di aggiungere o rinominare, si chiede se è la stessa persona.
 *  `wantsDifferent: true` = l'utente ha già risposto "no, è un'altra
 *  persona": si mostra l'avviso "scegli un nome diverso" con suggerimenti,
 *  finché il nome non cambia davvero (non solo le maiuscole). */
interface NameConflict {
  typed: string;
  existing: string;
  wantsDifferent?: boolean;
}

/** Riga di `partite.players` (JSON) rilevante per la rinomina. */
interface GamePlayer {
  name: string;
  [key: string]: unknown;
}

/** Rubrica giocatori condivisa: lista, aggiungi, rinomina (con propagazione), elimina.
 *  Va mostrata dentro un `Modal` (titolo e chiusura li mette il riquadro). */
export default function PlayersRoster({ userId, games = [] }: PlayersRosterProps) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [newName, setNewName] = useState('');
  /** Giocatore aperto (scheda con riepilogo e azioni). */
  const [selected, setSelected] = useState<string | null>(null);
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

  /** `forcedName`, quando passato (dal bottone di un suggerimento), è usato
   *  al posto del contenuto del campo: permette di aggiungere subito il
   *  nome proposto con un click, senza doverlo prima scrivere a mano. */
  async function handleAdd(forcedName?: string) {
    const name = (forcedName ?? newName).trim();
    if (!name || !supabase) return;
    if (name.length > MAX_PLAYER_NAME_LENGTH) {
      setError(`Il nome può avere al massimo ${MAX_PLAYER_NAME_LENGTH} caratteri.`);
      return;
    }

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

  async function renamePlayerEverywhere(oldName: string, newNameValue: string): Promise<string | null> {
    if (!supabase) return 'Supabase non configurato.';

    // Se il nuovo nome coincide (a parte maiuscole/spazi) con uno già in
    // elenco ed è davvero la stessa persona, fondo i due usando la grafia
    // già esistente invece di creare un doppione tipo "Andrea"/"andrea".
    // Escludo la riga stessa che sto rinominando: altrimenti correggere solo
    // le maiuscole (es. "andrea" -> "Andrea") sembrerebbe un doppione con se stessa.
    // (A questo punto una somiglianza residua è già stata chiesta e risolta
    // da confirmRename/renameTo, quindi qui non ne resta nessuna da trattare
    // come "stessa persona" a meno che l'utente l'abbia davvero confermato.)
    const existingMatch = roster.find((r) => r.name !== oldName && sameName(r.name, newNameValue));
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

  async function applyRename(oldName: string, newNameValue: string) {
    setRenaming(null);
    setRenameConflict(null);
    const renameError = await renamePlayerEverywhere(oldName, newNameValue);
    if (renameError) {
      setError('Rinomina non riuscita: ' + renameError);
      return;
    }
    setSelected(null);
    await loadRoster();
  }

  /** `forcedValue`, quando passato (dal bottone di un suggerimento), è usato
   *  al posto del contenuto del campo rinomina. */
  async function confirmRename(oldName: string, forcedValue?: string) {
    const trimmed = (forcedValue ?? renameValue).trim();
    if (!trimmed || trimmed === oldName) {
      setRenaming(null);
      return;
    }
    // Un nome salvato prima del limite si può tenere, ma per cambiarlo va accorciato.
    if (trimmed.length > MAX_PLAYER_NAME_LENGTH) {
      setError(`Il nome può avere al massimo ${MAX_PLAYER_NAME_LENGTH} caratteri.`);
      return;
    }
    // Come per "Aggiungi": una somiglianza (non un'identità esatta, impossibile
    // tra due righe della rubrica) va chiesta, non decisa in automatico.
    const nearMatch = roster.find((r) => r.name !== oldName && sameName(r.name, trimmed));
    if (nearMatch) {
      setRenameConflict({ oldName, typed: trimmed, existing: nearMatch.name });
      return;
    }
    await applyRename(oldName, trimmed);
  }

  async function handleDelete(name: string) {
    if (!supabase) return;
    if (!confirm(`Cancellare "${name}" dall'elenco giocatori? Le partite già salvate continueranno a mostrare il suo nome.`)) return;
    const { error: deleteError } = await supabase.from(TABLE_PLAYERS).delete().eq('name', name);
    if (deleteError) {
      setError('Cancellazione non riuscita: ' + deleteError.message);
      return;
    }
    setSelected(null);
    await loadRoster();
  }

  const selectedEntry = roster.find((r) => r.name === selected) ?? null;
  const gamesPlayed = selectedEntry
    ? games.filter((g) => g.players.some((p) => p.name === selectedEntry.name)).length
    : 0;

  function closeProfile() {
    setSelected(null);
    setRenaming(null);
    setRenameConflict(null);
    setError('');
  }

  function renderRenameConflict(conflict: NameConflict & { oldName: string }) {
    if (conflict.wantsDifferent) {
      const [s1, s2] = suggestAlternativeNames(conflict.existing);
      return (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-2.5 text-sm text-zaff-text">
          <p className="mb-2 text-red-400">
            Allora scegli un nome diverso da "{conflict.existing}": cambiare solo maiuscole o spazi non basta a
            distinguerli. Ad esempio:
          </p>
          <div className="flex flex-wrap gap-2">
            {[s1, s2].map((suggestion) => (
              <Button
                key={suggestion}
                size="sm"
                onClick={() => {
                  setRenameValue(suggestion);
                  confirmRename(conflict.oldName, suggestion);
                }}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-sm text-zaff-text">
        <p className="mb-2">Esiste già un giocatore chiamato "{conflict.existing}". È la stessa persona?</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => applyRename(conflict.oldName, conflict.typed)}>
            Sì, è lui/lei
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRenameConflict((c) => (c ? { ...c, wantsDifferent: true } : c))}
          >
            No, è un'altra persona
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cx(STICKY_BELOW_TITLE, 'sticky z-10 -mx-1 mb-2 flex gap-2 bg-zaff-surface px-1 py-1')}>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setAddConflict(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nome nuovo giocatore"
            maxLength={MAX_PLAYER_NAME_LENGTH}
            aria-describedby="new-player-name-count"
            className={cx(FIELD_CONTROL_SM, 'w-full')}
          />
          <CharCount id="new-player-name-count" value={newName} max={MAX_PLAYER_NAME_LENGTH} />
        </div>
        <Button onClick={() => handleAdd()} className="shrink-0 self-start">
          Aggiungi
        </Button>
      </div>

      {addConflict &&
        (addConflict.wantsDifferent ? (
          (() => {
            const [s1, s2] = suggestAlternativeNames(addConflict.existing);
            return (
              <div className="mb-4 rounded-lg border border-red-400/40 bg-red-400/10 p-2.5 text-sm text-zaff-text">
                <p className="mb-2 text-red-400">
                  Allora scegli un nome diverso da "{addConflict.existing}": cambiare solo maiuscole o spazi non
                  basta a distinguerli. Ad esempio:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleAdd(s1)}>
                    {s1}
                  </Button>
                  <Button size="sm" onClick={() => handleAdd(s2)}>
                    {s2}
                  </Button>
                </div>
              </div>
            );
          })()
        ) : (
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddConflict((c) => (c ? { ...c, wantsDifferent: true } : c))}
              >
                No, è un'altra persona
              </Button>
            </div>
          </div>
        ))}

      {loading ? (
        <p className="text-zaff-muted">Caricamento…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-zaff-muted">Ancora nessun giocatore in elenco.</p>
      ) : (
        <ul>
          {roster.map((r) => (
            <li key={r.name}>
              {/* Una sola azione per riga: tutta la riga apre la scheda del giocatore. */}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSelected(r.name);
                }}
                title={r.name}
                className="mb-2 flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-zaff-border bg-zaff-bg py-3 pl-3.5 pr-2 text-left transition hover:border-zaff-primary active:border-zaff-primary"
              >
                <span className="min-w-0 truncate text-[15px] text-zaff-text">{r.name}</span>
                <span className="ml-auto shrink-0 pl-2 text-2xl leading-none text-zaff-muted" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedEntry && (
        <Modal level={2} title={selectedEntry.name} onClose={closeProfile}>
          {renaming === selectedEntry.name ? (
            <>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  setRenameConflict(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && confirmRename(selectedEntry.name)}
                maxLength={MAX_PLAYER_NAME_LENGTH}
                aria-label="Nuovo nome del giocatore"
                aria-describedby="rename-player-count"
                autoFocus
                className={FIELD_CONTROL_SM}
              />
              <CharCount id="rename-player-count" value={renameValue} max={MAX_PLAYER_NAME_LENGTH} />
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Button fullWidth onClick={() => confirmRename(selectedEntry.name)}>
                  Salva
                </Button>
                <Button
                  fullWidth
                  variant="ghost"
                  onClick={() => {
                    setRenaming(null);
                    setRenameConflict(null);
                  }}
                >
                  Annulla
                </Button>
              </div>
              {renameConflict && renameConflict.oldName === selectedEntry.name && (
                <div className="mt-3">{renderRenameConflict(renameConflict)}</div>
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-[15px] text-zaff-text">
                <span className="text-2xl font-bold">{gamesPlayed}</span>{' '}
                {gamesPlayed === 1 ? 'partita giocata' : 'partite giocate'}
              </p>
              <ButtonRouteLink to={paths.player(selectedEntry.name)} size="lg" fullWidth className="mb-2.5">
                📊 Statistiche giocatore
              </ButtonRouteLink>
              {canEdit(selectedEntry.createdBy, userId) && (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button variant="ghost" fullWidth onClick={() => startRename(selectedEntry.name)}>
                    ✏️ Modifica
                  </Button>
                  <Button variant="danger" fullWidth onClick={() => handleDelete(selectedEntry.name)}>
                    🗑️ Cancella
                  </Button>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
