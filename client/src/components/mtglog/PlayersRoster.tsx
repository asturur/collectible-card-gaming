import { useEffect, useState } from 'react';
import { canEdit, supabase, TABLE_GAMES, TABLE_PLAYERS } from '../../services/supabase';
import { BTN_DANGER_LINK, BTN_LINK, BTN_PRIMARY, INPUT } from './ui';

interface PlayersRosterProps {
  userId: string;
}

interface RosterEntry {
  name: string;
  createdBy: string | null;
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

  async function handleAdd() {
    const name = newName.trim();
    if (!name || !supabase) return;
    if (roster.some((r) => r.name === name)) {
      setNewName('');
      return;
    }
    const { error: insertError } = await supabase.from(TABLE_PLAYERS).insert({ name });
    if (insertError && insertError.code !== '23505') {
      setError('Non sono riuscito ad aggiungere il giocatore: ' + insertError.message);
      return;
    }
    setNewName('');
    setError('');
    await loadRoster();
  }

  async function renamePlayerEverywhere(oldName: string, newNameValue: string): Promise<string | null> {
    if (!supabase) return 'Supabase non configurato.';

    if (roster.some((r) => r.name === newNameValue)) {
      const { error: deleteError } = await supabase.from(TABLE_PLAYERS).delete().eq('name', oldName);
      if (deleteError) return deleteError.message;
    } else {
      const { error: updateError } = await supabase.from(TABLE_PLAYERS).update({ name: newNameValue }).eq('name', oldName);
      if (updateError) return updateError.message;
    }

    const { data: gamesData, error: gamesError } = await supabase.from(TABLE_GAMES).select('id, players');
    if (gamesError) return gamesError.message;

    const affected = (gamesData ?? []).filter((g) =>
      ((g.players ?? []) as GamePlayer[]).some((p) => p.name === oldName)
    );
    for (const g of affected) {
      const updatedPlayers = ((g.players ?? []) as GamePlayer[]).map((p) =>
        p.name === oldName ? { ...p, name: newNameValue } : p
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
  }

  async function confirmRename(oldName: string) {
    const trimmed = renameValue.trim();
    setRenaming(null);
    if (!trimmed || trimmed === oldName) return;
    const renameError = await renamePlayerEverywhere(oldName, trimmed);
    if (renameError) {
      setError('Rinomina non riuscita: ' + renameError);
      return;
    }
    await loadRoster();
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
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nome nuovo giocatore"
          className={INPUT}
        />
        <button type="button" onClick={handleAdd} className={`shrink-0 ${BTN_PRIMARY}`}>
          Aggiungi
        </button>
      </div>

      {loading ? (
        <p className="text-zaff-muted">Caricamento…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-zaff-muted">Ancora nessun giocatore in elenco.</p>
      ) : (
        <ul className="divide-y divide-zaff-border">
          {roster.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-2 py-2">
              {renaming === r.name ? (
                <>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmRename(r.name)}
                    autoFocus
                    className={INPUT}
                  />
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => confirmRename(r.name)} className={BTN_LINK}>
                      Salva
                    </button>
                    <button type="button" onClick={() => setRenaming(null)} className={BTN_DANGER_LINK}>
                      Annulla
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate font-serif text-[15px] text-zaff-text">{r.name}</span>
                  {canEdit(r.createdBy, userId) && (
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => startRename(r.name)} className={BTN_LINK}>
                        Rinomina
                      </button>
                      <button type="button" onClick={() => handleDelete(r.name)} className={BTN_DANGER_LINK}>
                        Cancella
                      </button>
                    </div>
                  )}
                </>
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
