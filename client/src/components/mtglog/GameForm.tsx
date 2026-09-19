import { useEffect, useState } from 'react';
import { subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES, TABLE_GROUPS, TABLE_PLAYERS } from '../../services/supabase';
import type { Game } from './GameList';
import LifeCounter from './LifeCounter';
import { ManaPips } from './ManaIcon';
import { BTN_GHOST, BTN_LINK, BTN_PRIMARY, INPUT, LABEL, MINI } from './ui';

interface GameFormProps {
  editingGame?: Game | null;
  onBack: () => void;
  onSaved?: () => void;
}

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

/** Stepper punti vita: − / campo numerico / +, come nell'app originale. */
function LifeStepper({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  function step(delta: number) {
    const current = value === '' ? 0 : Number(value) || 0;
    onChange(String(current + delta));
  }
  return (
    <div className={`flex overflow-hidden rounded-lg border border-zaff-border ${className}`}>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Meno uno"
        className="w-[30px] shrink-0 bg-zaff-bg text-base leading-none text-zaff-text transition hover:bg-zaff-gold hover:text-zaff-bg"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mtg-life-input w-11 min-w-0 flex-1 border-0 bg-zaff-bg px-0.5 py-2 text-center tabular-nums text-zaff-text placeholder:text-zaff-muted focus:outline-none"
      />
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Più uno"
        className="w-[30px] shrink-0 bg-zaff-bg text-base leading-none text-zaff-text transition hover:bg-zaff-gold hover:text-zaff-bg"
      >
        +
      </button>
    </div>
  );
}

/** Form "Nuova partita"/"Modifica partita": giocatori dinamici, select mazzo/nome,
 *  punti vita, vincitore, note. Salva (insert) o aggiorna (update) su `partite`.
 *  Va mostrato dentro un `Modal` (titolo e chiusura li mette il riquadro). */
export default function GameForm({ editingGame, onBack, onSaved }: GameFormProps) {
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
  const [lifeCounterOpen, setLifeCounterOpen] = useState(false);

  async function loadOptions(): Promise<DeckOption[]> {
    if (!supabase) return [];
    const [groupsRes, playersRes, decksRes] = await Promise.all([
      supabase.from(TABLE_GROUPS).select('name').order('name'),
      supabase.from(TABLE_PLAYERS).select('name').order('name'),
      supabase.from(TABLE_DECKS).select('name, colors').order('name'),
    ]);
    setGroups((groupsRes.data ?? []).map((r) => r.name));
    setPlayerNames((playersRes.data ?? []).map((r) => r.name));
    const deckList = (decksRes.data ?? []).map((r) => ({ name: r.name, colors: r.colors ?? [] }));
    setDecks(deckList);
    return deckList;
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadOptions().then((deckList) => {
      if (editingGame) {
        setDate(editingGame.date);
        setFormat(editingGame.format);
        setNotes(editingGame.notes);
        setGroup(editingGame.group === 'Generale' ? '' : editingGame.group);
        setPlayers(
          editingGame.players.map((p) => {
            const manual = Boolean(p.deck) && !deckList.some((d) => d.name === p.deck);
            return {
              name: p.name,
              deckMode: manual ? 'manual' : 'select',
              deckSelect: manual ? '' : p.deck || '',
              deckManual: manual ? p.deck || '' : '',
              desc: p.desc || '',
              life: p.life === null || p.life === undefined ? '' : String(p.life),
              winner: Boolean(p.winner),
              colors: new Set(p.colors || []),
            };
          })
        );
      }
      setLoading(false);
    });

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

  function handleOpenLifeCounter() {
    setError('');
    const names = players.map((p) => p.name.trim()).filter(Boolean);
    if (!names.length) {
      setError('Scegli almeno un giocatore prima di avviare il conteggio.');
      return;
    }
    setLifeCounterOpen(true);
  }

  function handleLifeCounterFinish(lives: Record<string, number>) {
    setPlayers((prev) => prev.map((p) => (p.name.trim() in lives ? { ...p, life: String(lives[p.name.trim()]) } : p)));
    setLifeCounterOpen(false);
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
      date,
      format: format.trim(),
      notes: notes.trim(),
      players: readPlayers,
      gruppo: group.trim() || 'Generale',
    };

    setSaving(true);
    const { error: saveError } = editingGame
      ? await supabase.from(TABLE_GAMES).update(row).eq('id', editingGame.id)
      : await supabase
          .from(TABLE_GAMES)
          .insert({ id: 'g' + Date.now() + Math.random().toString(36).slice(2, 7), ...row });
    setSaving(false);
    if (saveError) {
      setError('Salvataggio partita non riuscito: ' + saveError.message);
      return;
    }

    if (onSaved) {
      onSaved();
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
    return <p className="text-zaff-muted">Caricamento…</p>;
  }

  if (lifeCounterOpen) {
    return (
      <LifeCounter
        players={players.map((p) => p.name.trim()).filter(Boolean)}
        startLife={startLife}
        onCancel={() => setLifeCounterOpen(false)}
        onFinish={handleLifeCounterFinish}
      />
    );
  }

  return (
    <>
      <div className="mb-3.5">
        <label className={LABEL} htmlFor="group">
          Gruppo
        </label>
        <select id="group" value={group} onChange={(e) => setGroup(e.target.value)} className={INPUT}>
          <option value="">Generale</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="date">
            Data
          </label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="fmt">
            Formato
          </label>
          <input
            id="fmt"
            type="text"
            list="fmts"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="Commander"
            className={INPUT}
          />
          <datalist id="fmts">
            {FORMATS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>

      <label className={LABEL}>Giocatori</label>
      <div>
        {players.map((p, i) => (
          <div
            key={i}
            className={`mb-3 rounded-lg border bg-zaff-bg p-3 ${p.winner ? 'border-zaff-highlight' : 'border-zaff-border'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                list={`playerNames-${i}`}
                value={p.name}
                onChange={(e) => updatePlayer(i, { name: e.target.value })}
                placeholder={`Giocatore ${i + 1}`}
                className={`${INPUT} min-w-0 flex-1 font-serif text-base`}
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
                  className="h-7 w-7 shrink-0 rounded-lg border border-zaff-border text-base leading-none text-zaff-muted transition hover:border-red-400 hover:text-red-400"
                >
                  ×
                </button>
              )}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2">
              {p.deckMode === 'select' ? (
                <select
                  value={p.deckSelect}
                  onChange={(e) => handleDeckSelectChange(i, e.target.value)}
                  className={`${INPUT} min-w-0 flex-1`}
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
                  className={`${INPUT} min-w-0 flex-1`}
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
                className={`${BTN_LINK} shrink-0 text-xs`}
              >
                {p.deckMode === 'select' ? 'Scrivi a mano' : 'Scegli dai mazzi salvati'}
              </button>
            </div>

            <input
              type="text"
              value={p.desc}
              onChange={(e) => updatePlayer(i, { desc: e.target.value })}
              placeholder="Com'è fatto il mazzo, strategia, note"
              className={`${INPUT} mb-2`}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <ManaPips colors={p.colors} onToggle={(c) => toggleColor(i, c)} />

              <div className="flex items-center gap-2.5">
                <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[13px] text-zaff-muted">
                  <input
                    type="checkbox"
                    checked={p.winner}
                    onChange={() => toggleWinner(i)}
                    className="mtg-switch-input absolute h-0 w-0 opacity-0"
                  />
                  <span className="mtg-switch" />
                  Vincitore
                </label>

                <LifeStepper
                  value={p.life}
                  onChange={(next) => updatePlayer(i, { life: next })}
                  placeholder="PV"
                  className="w-[104px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addPlayer} className={BTN_LINK}>
        + Aggiungi giocatore
      </button>

      <div className="mt-3.5">
        <label className={LABEL} htmlFor="startLife">
          Punti vita iniziali
        </label>
        <LifeStepper
          value={String(startLife)}
          onChange={(next) => setStartLife(Math.max(1, parseInt(next, 10) || 1))}
          className="max-w-[140px]"
        />
      </div>

      <button
        type="button"
        onClick={handleOpenLifeCounter}
        className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-zaff-primary to-zaff-accent px-4 py-3.5 font-serif text-lg font-bold tracking-wide text-zaff-bg transition hover:brightness-110 active:brightness-95"
      >
        <span className="text-xl leading-none">▶</span> Avvia partita
      </button>

      <div className="mt-4">
        <label className={LABEL} htmlFor="notes">
          Appunti
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Combo assurde, alleanze tradite, mulligan sfortunati…"
          className={`${INPUT} min-h-[70px] resize-y`}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <button type="button" onClick={handleSaveClick} disabled={saving} className={BTN_PRIMARY}>
          {editingGame ? 'Salva modifiche' : 'Salva partita'}
        </button>
        <button type="button" onClick={onBack} className={BTN_GHOST}>
          Annulla
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className={`mt-2.5 ${MINI}`}>
        I pallini sotto ogni nome sono i colori del mazzo: bianco, blu, nero, rosso, verde.
      </p>
    </>
  );
}
