import { useEffect, useState } from 'react';
import { subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES, TABLE_GROUPS, TABLE_PLAYERS } from '../../services/supabase';

interface GameFormProps {
  onBack: () => void;
}

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const FORMATS = ['Commander', 'Standard', 'Modern', 'Pauper', 'Draft', 'Two-Headed Giant', 'Amichevole'];

interface DeckOption {
  name: string;
  colors: string[];
}

interface PlayerRow {
  name: string;
  deckMode: 'select' | 'manual';
  deckSelect: string;
  deckManual: string;
  desc: string;
  life: string;
  winner: boolean;
  colors: Set<string>;
}

function emptyPlayerRow(): PlayerRow {
  return {
    name: '',
    deckMode: 'select',
    deckSelect: '',
    deckManual: '',
    desc: '',
    life: '',
    winner: false,
    colors: new Set(),
  };
}

/** Form "Nuova partita": giocatori dinamici, select mazzo/nome, punti vita,
 *  vincitore, note. Solo UI in questo step: il salvataggio arriva allo Step 8. */
export default function GameForm({ onBack }: GameFormProps) {
  const [groups, setGroups] = useState<string[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [group, setGroup] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState('');
  const [notes, setNotes] = useState('');
  const [startLife, setStartLife] = useState(20);
  const [players, setPlayers] = useState<PlayerRow[]>([emptyPlayerRow(), emptyPlayerRow()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadOptions() {
    if (!supabase) return;
    const [groupsRes, playersRes, decksRes] = await Promise.all([
      supabase.from(TABLE_GROUPS).select('name').order('name'),
      supabase.from(TABLE_PLAYERS).select('name').order('name'),
      supabase.from(TABLE_DECKS).select('name, colors').order('name'),
    ]);
    setGroups((groupsRes.data ?? []).map((r) => r.name));
    setPlayerNames((playersRes.data ?? []).map((r) => r.name));
    setDecks((decksRes.data ?? []).map((r) => ({ name: r.name, colors: r.colors ?? [] })));
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadOptions().finally(() => setLoading(false));

    // Se un altro dispositivo aggiunge/rinomina giocatori, mazzi o gruppi
    // mentre questo form è aperto, le liste si aggiornano da sole.
    const unsubGroups = subscribeToTable(TABLE_GROUPS, loadOptions);
    const unsubPlayers = subscribeToTable(TABLE_PLAYERS, loadOptions);
    const unsubDecks = subscribeToTable(TABLE_DECKS, loadOptions);
    return () => {
      unsubGroups();
      unsubPlayers();
      unsubDecks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updatePlayer(index: number, patch: Partial<PlayerRow>) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPlayer() {
    setPlayers((prev) => [...prev, emptyPlayerRow()]);
  }

  function removePlayer(index: number) {
    setPlayers((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function toggleWinner(index: number) {
    setPlayers((prev) => prev.map((p, i) => ({ ...p, winner: i === index ? !p.winner : false })));
  }

  function toggleColor(index: number, c: string) {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const next = new Set(p.colors);
        if (next.has(c)) next.delete(c);
        else next.add(c);
        return { ...p, colors: next };
      })
    );
  }

  function handleDeckSelectChange(index: number, value: string) {
    const chosen = decks.find((d) => d.name === value);
    updatePlayer(index, { deckSelect: value, colors: chosen ? new Set(chosen.colors) : players[index].colors });
  }

  async function handleSaveClick() {
    setMessage('');
    setError('');
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }

    const readPlayers = players
      .map((p, i) => {
        const deckVal = p.deckMode === 'manual' ? p.deckManual.trim() : p.deckSelect;
        return {
          name: p.name.trim(),
          deck: deckVal,
          desc: p.desc.trim(),
          life: p.life === '' ? null : Number(p.life),
          winner: p.winner,
          colors: [...p.colors],
          seat: i + 1,
        };
      })
      .filter((p) => p.name || p.deck || p.desc || p.life !== null || p.colors.length)
      .map((p) => ({ ...p, name: p.name || 'Giocatore ' + p.seat }));

    const row = {
      id: 'g' + Date.now() + Math.random().toString(36).slice(2, 7),
      date,
      format: format.trim(),
      notes: notes.trim(),
      players: readPlayers,
      gruppo: group.trim() || 'Generale',
    };

    setSaving(true);
    const { error: insertError } = await supabase.from(TABLE_GAMES).insert(row);
    setSaving(false);
    if (insertError) {
      setError('Salvataggio partita non riuscito: ' + insertError.message);
      return;
    }

    setMessage('Partita salvata.');
    setGroup('');
    setDate(new Date().toISOString().slice(0, 10));
    setFormat('');
    setNotes('');
    setPlayers([emptyPlayerRow(), emptyPlayerRow()]);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <p className="text-zaff-muted">Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-zaff-primary">Nuova partita</h1>

        <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="group">
          Gruppo
        </label>
        <select
          id="group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        >
          <option value="">Generale</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="date">
              Data
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="fmt">
              Formato
            </label>
            <input
              id="fmt"
              type="text"
              list="fmts"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Commander"
              className="w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
            />
            <datalist id="fmts">
              {FORMATS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
        </div>

        <p className="mb-1 text-sm font-semibold text-zaff-text">Giocatori</p>
        <div className="mb-2 space-y-4">
          {players.map((p, i) => (
            <div key={i} className={`rounded-lg border p-3 ${p.winner ? 'border-zaff-primary' : 'border-zaff-border'}`}>
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  list={`playerNames-${i}`}
                  value={p.name}
                  onChange={(e) => updatePlayer(i, { name: e.target.value })}
                  placeholder={`Giocatore ${i + 1}`}
                  className="flex-1 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
                />
                <datalist id={`playerNames-${i}`}>
                  {playerNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                {players.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlayer(i)}
                    title="Togli giocatore"
                    className="shrink-0 text-red-400 hover:underline"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="mb-2 flex items-center gap-2">
                {p.deckMode === 'select' ? (
                  <select
                    value={p.deckSelect}
                    onChange={(e) => handleDeckSelectChange(i, e.target.value)}
                    className="flex-1 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
                  >
                    <option value="">Nessun mazzo</option>
                    {decks.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={p.deckManual}
                    onChange={(e) => updatePlayer(i, { deckManual: e.target.value })}
                    placeholder="Nome mazzo libero"
                    className="flex-1 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    updatePlayer(i, {
                      deckMode: p.deckMode === 'select' ? 'manual' : 'select',
                      deckSelect: '',
                      deckManual: '',
                    })
                  }
                  className="shrink-0 text-sm text-zaff-primary hover:underline"
                >
                  {p.deckMode === 'select' ? 'Scrivi a mano' : 'Scegli dai mazzi salvati'}
                </button>
              </div>

              <input
                type="text"
                value={p.desc}
                onChange={(e) => updatePlayer(i, { desc: e.target.value })}
                placeholder="Com'è fatto il mazzo, strategia, note"
                className="mb-2 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleColor(i, c)}
                      aria-pressed={p.colors.has(c)}
                      className={`h-7 w-7 rounded-full border text-xs font-bold transition-colors ${
                        p.colors.has(c)
                          ? 'border-zaff-primary bg-zaff-primary text-white'
                          : 'border-zaff-border bg-zaff-bg text-zaff-muted'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1 text-sm text-zaff-text">
                  <input type="checkbox" checked={p.winner} onChange={() => toggleWinner(i)} />
                  Vincitore
                </label>

                <input
                  type="number"
                  inputMode="numeric"
                  value={p.life}
                  onChange={(e) => updatePlayer(i, { life: e.target.value })}
                  placeholder="PV"
                  className="w-16 rounded-lg border border-zaff-border bg-zaff-bg px-2 py-1 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addPlayer}
          className="mb-4 w-full rounded-lg border border-zaff-border px-4 py-2 text-sm font-semibold text-zaff-primary transition-colors hover:bg-zaff-bg"
        >
          + Aggiungi giocatore
        </button>

        <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="startLife">
          Punti vita iniziali
        </label>
        <input
          id="startLife"
          type="number"
          min={1}
          value={startLife}
          onChange={(e) => setStartLife(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="mb-4 w-32 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        />

        <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="notes">
          Appunti
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Combo assurde, alleanze tradite, mulligan sfortunati…"
          className="mb-4 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        />

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={saving}
          className="w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover disabled:opacity-60"
        >
          Salva partita
        </button>

        {message && <p className="mt-3 text-center text-sm text-green-400">{message}</p>}
        {error && (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
