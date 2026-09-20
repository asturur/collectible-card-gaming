import { useEffect, useState } from 'react';
import { subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES, TABLE_PLAYERS } from '../../services/supabase';
import type { Game } from './GameList';
import LifeCounter from './LifeCounter';
import { ManaPips } from './ManaIcon';
import Button from '../ui/Button';
import NumberStepper from '../ui/NumberStepper';
import { TextAreaField, TextField } from '../ui/Field';
import { cx, FIELD_CONTROL_SM, FIELD_LABEL, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

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

/** Form "Nuova partita"/"Modifica partita": giocatori dinamici, select mazzo/nome,
 *  punti vita, vincitore, note. Salva (insert) o aggiorna (update) su `partite`.
 *  Va mostrato dentro un `Modal` (titolo e chiusura li mette il riquadro). */
export default function GameForm({ editingGame, onBack, onSaved }: GameFormProps) {
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState('');
  const [notes, setNotes] = useState('');
  const [startLife, setStartLife] = useState(20);
  const [players, setPlayers] = useState<PlayerRow[]>([emptyPlayerRow(), emptyPlayerRow()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lifeCounterOpen, setLifeCounterOpen] = useState(false);
  /** Indice della riga giocatore il cui elenco suggerimenti nomi è aperto (solo uno alla volta). */
  const [nameSuggestFor, setNameSuggestFor] = useState<number | null>(null);
  const [formatSuggestOpen, setFormatSuggestOpen] = useState(false);

  async function loadOptions(): Promise<DeckOption[]> {
    if (!supabase) return [];
    const [playersRes, decksRes] = await Promise.all([
      supabase.from(TABLE_PLAYERS).select('name').order('name'),
      supabase.from(TABLE_DECKS).select('name, colors').order('name'),
    ]);
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

    // Se un altro dispositivo aggiunge/rinomina giocatori o mazzi
    // mentre questo form è aperto, le liste si aggiornano da sole.
    const unsubPlayers = subscribeToTable(TABLE_PLAYERS, loadOptions);
    const unsubDecks = subscribeToTable(TABLE_DECKS, loadOptions);
    return () => {
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

  function selectPlayerName(index: number, name: string) {
    updatePlayer(index, { name });
    setNameSuggestFor(null);
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
    setDate(new Date().toISOString().slice(0, 10));
    setFormat('');
    setNotes('');
    setPlayers([emptyPlayerRow(), emptyPlayerRow()]);
  }

  if (loading) {
    return <p className={TEXT_MUTED}>Caricamento…</p>;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          id="date"
          label="Data"
          density="compact"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="mb-4">
          <label className={FIELD_LABEL} htmlFor="fmt">
            Formato
          </label>
          <div className="relative">
            <input
              id="fmt"
              type="text"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              onFocus={() => setFormatSuggestOpen(true)}
              onBlur={() => setFormatSuggestOpen(false)}
              placeholder="Commander"
              autoComplete="off"
              className={FIELD_CONTROL_SM}
            />
            {formatSuggestOpen &&
              (() => {
                const q = format.trim().toLowerCase();
                const matches = FORMATS.filter((f) => !q || f.toLowerCase().includes(q));
                if (matches.length === 0) return null;
                return (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-zaff-border bg-zaff-surface shadow-lg">
                    {matches.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormat(f);
                          setFormatSuggestOpen(false);
                        }}
                        className="block w-full px-2.5 py-1.5 text-left text-sm text-zaff-text transition hover:bg-zaff-bg"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                );
              })()}
          </div>
        </div>
      </div>

      <span className={FIELD_LABEL}>Giocatori</span>
      <div>
        {players.map((p, i) => (
          <div
            key={i}
            className={`mb-3 rounded-lg border bg-zaff-bg p-3 ${p.winner ? 'border-zaff-highlight' : 'border-zaff-border'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePlayer(i, { name: e.target.value })}
                  onFocus={() => setNameSuggestFor(i)}
                  onBlur={() => setNameSuggestFor((cur) => (cur === i ? null : cur))}
                  placeholder={`Giocatore ${i + 1}`}
                  autoComplete="off"
                  className={cx(FIELD_CONTROL_SM, 'w-full')}
                />
                {nameSuggestFor === i &&
                  (() => {
                    const q = p.name.trim().toLowerCase();
                    const matches = playerNames.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 8);
                    if (matches.length === 0) return null;
                    return (
                      <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-zaff-border bg-zaff-surface shadow-lg">
                        {matches.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectPlayerName(i, n);
                            }}
                            className="block w-full px-2.5 py-1.5 text-left text-sm text-zaff-text transition hover:bg-zaff-bg"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
              </div>
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
                  className={cx(FIELD_CONTROL_SM, 'min-w-0 flex-1')}
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
                  className={cx(FIELD_CONTROL_SM, 'min-w-0 flex-1')}
                />
              )}
              <Button
                variant="link"
                size="sm"
                onClick={() =>
                  updatePlayer(i, {
                    deckMode: p.deckMode === 'select' ? 'manual' : 'select',
                    deckSelect: '',
                    deckManual: '',
                  })
                }
                className="shrink-0"
              >
                {p.deckMode === 'select' ? 'Scrivi a mano' : 'Scegli dai mazzi salvati'}
              </Button>
            </div>

            <input
              type="text"
              value={p.desc}
              onChange={(e) => updatePlayer(i, { desc: e.target.value })}
              placeholder="Com'è fatto il mazzo, strategia, note"
              className={cx(FIELD_CONTROL_SM, 'mb-2')}
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

                <NumberStepper
                  value={p.life}
                  onChange={(next) => updatePlayer(i, { life: next })}
                  placeholder="PV"
                  aria-label="Punti vita"
                  className="w-[104px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="link" size="sm" onClick={addPlayer}>
        + Aggiungi giocatore
      </Button>

      <div className="mt-3.5">
        <label className={FIELD_LABEL} htmlFor="startLife">
          Punti vita iniziali
        </label>
        <NumberStepper
          value={String(startLife)}
          min={1}
          onChange={(next) => setStartLife(Math.max(1, parseInt(next, 10) || 1))}
          className="max-w-[140px]"
        />
      </div>

      <Button
        onClick={handleOpenLifeCounter}
        size="lg"
        fullWidth
        className="mt-4 py-3.5 text-lg"
      >
        <span className="text-xl leading-none">▶</span> Avvia partita
      </Button>

      <TextAreaField
        id="notes"
        label="Appunti"
        density="compact"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Combo assurde, alleanze tradite, mulligan sfortunati…"
        fieldClassName="mt-4"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <Button onClick={handleSaveClick} disabled={saving}>
          {editingGame ? 'Salva modifiche' : 'Salva partita'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Annulla
        </Button>
      </div>

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className={cx('mt-2.5', TEXT_MINI)}>
        I pallini sotto ogni nome sono i colori del mazzo: bianco, blu, nero, rosso, verde.
      </p>
    </>
  );
}
