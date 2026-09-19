import { useEffect, useState } from 'react';
import { canEdit, supabase, TABLE_GAMES, TABLE_PLAYERS } from '../../services/supabase';

interface PlayersRosterProps {
  userId: string;
  onBack: () => void;
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

/** Rubrica giocatori condivisa: lista, aggiungi, rinomina (con propagazione), elimina. */
export default function PlayersRoster({ userId, onBack }: PlayersRosterProps) {
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
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-zaff-primary">Giocatori</h1>
        <p className="mb-6 text-center text-sm text-zaff-muted">
          Rinomina o cancella i nomi in elenco. Le partite già salvate mantengono comunque il nome che avevano.
        </p>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nome nuovo giocatore"
            className="flex-1 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-zaff-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-zaff-primary-hover"
          >
            Aggiungi
          </button>
        </div>

        {loading ? (
          <p className="text-center text-zaff-muted">Caricamento…</p>
        ) : roster.length === 0 ? (
          <p className="text-center text-sm text-zaff-muted">Ancora nessun giocatore in elenco.</p>
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
                      className="flex-1 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
                    />
                    <button type="button" onClick={() => confirmRename(r.name)} className="text-sm text-zaff-primary hover:underline">
                      Salva
                    </button>
                    <button type="button" onClick={() => setRenaming(null)} className="text-sm text-zaff-muted hover:underline">
                      Annulla
                    </button>
                  </>
                ) : (
                  <>
                    <span className="truncate text-zaff-text">{r.name}</span>
                    {canEdit(r.createdBy, userId) && (
                      <div className="flex shrink-0 gap-3">
                        <button type="button" onClick={() => startRename(r.name)} className="text-sm text-zaff-primary hover:underline">
                          Rinomina
                        </button>
                        <button type="button" onClick={() => handleDelete(r.name)} className="text-sm text-red-400 hover:underline">
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
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
