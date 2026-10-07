import { useEffect, useState } from 'react';
import {
  findCanonicalName,
  MAX_PLAYER_NAME_LENGTH,
  subscribeToTable,
  suggestAlternativeNames,
  supabase,
  TABLE_DECKS,
  TABLE_GAMES,
  TABLE_PLAYERS,
} from '../../services/supabase';
import type { Game } from './GameList';
import LifeCounter, { type LifeCounterResume } from './LifeCounter';
import type { LossCause } from './GameList';
import { ManaPips } from './ManaIcon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NumberStepper from '../ui/NumberStepper';
import { TextAreaField } from '../ui/Field';
import { cx, FIELD_CONTROL_SM, FIELD_LABEL, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface GameFormProps {
  editingGame?: Game | null;
  /** "Rivincita": parte con gli stessi giocatori, mazzi e formato di questa
   *  partita (senza vita, vincitore e note) e apre subito il segna-punti. */
  rematchFrom?: Game | null;
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
  /** KILL/MILL segnati dal segna-punti (vuoto se non indicato). */
  loss: LossCause[];
  /** Contatori veleno a fine partita (0 se non usato). */
  poison: number;
  /** True dopo aver cliccato "No, è un'altra persona": finché il nome resta
   *  identico (a parte maiuscole/spazi) a uno già in elenco, mostra l'avviso
   *  "scegli un nome diverso" invece della domanda "è la stessa persona?". */
  rejectingMatch?: boolean;
  /** True quando il nome si scrive a mano (nuovo giocatore) invece di sceglierlo dall'elenco. */
  nameTyping?: boolean;
}

/** I punti vita iniziali non fanno parte dei dati della partita su Supabase:
 *  li ricordo solo su questo dispositivo, per partita, così "Rivincita" può
 *  riproporre lo stesso valore (es. 40 a Commander). Mai bloccante: se lo
 *  storage non c'è o è vuoto si torna al valore di default. */
const startLifeKey = (gameId: string) => `mtglog:startLife:${gameId}`;

function readStartLife(gameId: string): number | null {
  try {
    const n = Number(localStorage.getItem(startLifeKey(gameId)));
    return Number.isFinite(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
}

function rememberStartLife(gameId: string, value: number) {
  try {
    localStorage.setItem(startLifeKey(gameId), String(value));
  } catch {
    /* storage non disponibile: pazienza */
  }
}

/** Valore per un `<input type="datetime-local">`, in ora locale (non UTC:
 *  `toISOString()` darebbe l'ora sbagliata a chi non è su fuso UTC). */
function toLocalDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    loss: [],
    poison: 0,
  };
}

/** Form "Nuova partita"/"Modifica partita": giocatori dinamici, select mazzo/nome,
 *  punti vita, vincitore, note. Salva (insert) o aggiorna (update) su `partite`.
 *  Va mostrato dentro un `Modal` (titolo e chiusura li mette il riquadro). */
export default function GameForm({ editingGame, rematchFrom, onBack, onSaved }: GameFormProps) {
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Data E ORA di inizio partita: precompilata con "adesso", modificabile per
  // registrare partite passate. L'orario di fine si registra da solo al
  // salvataggio (vedi handleSaveClick), non va chiesto qui.
  const [startedAt, setStartedAt] = useState(toLocalDateTimeValue(new Date()));
  const [format, setFormat] = useState('');
  const [notes, setNotes] = useState('');
  const [startLife, setStartLife] = useState(20);
  const [players, setPlayers] = useState<PlayerRow[]>([emptyPlayerRow(), emptyPlayerRow()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lifeCounterOpen, setLifeCounterOpen] = useState(false);
  /** True quando il segna-punti si apre da "Riprendi Partita" (parte dai punteggi salvati). */
  const [resumeCounter, setResumeCounter] = useState(false);
  /** Indice della riga giocatore il cui elenco suggerimenti nomi è aperto (solo uno alla volta). */
  const [playerPickerFor, setPlayerPickerFor] = useState<number | null>(null);
  const [deckPickerFor, setDeckPickerFor] = useState<number | null>(null);
  const [formatPickerOpen, setFormatPickerOpen] = useState(false);

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
        // Partite salvate prima di `started_at` non hanno un orario preciso:
        // uso mezzogiorno della data che avevano come punto di partenza neutro.
        setStartedAt(
          editingGame.startedAt
            ? toLocalDateTimeValue(new Date(editingGame.startedAt))
            : editingGame.date
              ? `${editingGame.date}T12:00`
              : toLocalDateTimeValue(new Date())
        );
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
              loss: p.loss ?? [],
              poison: p.poison ?? 0,
            };
          })
        );
      } else if (rematchFrom) {
        setFormat(rematchFrom.format);
        const previousStartLife = readStartLife(rematchFrom.id);
        if (previousStartLife) setStartLife(previousStartLife);
        setPlayers(
          rematchFrom.players.map((p) => {
            const manual = Boolean(p.deck) && !deckList.some((d) => d.name === p.deck);
            return {
              name: p.name,
              deckMode: manual ? 'manual' : 'select',
              deckSelect: manual ? '' : p.deck || '',
              deckManual: manual ? p.deck || '' : '',
              desc: p.desc || '',
              life: '',
              winner: false,
              colors: new Set(p.colors || []),
              loss: [],
              poison: 0,
            };
          })
        );
        // Un solo tap: il segna-punti parte subito. Se lo si chiude resta il
        // modulo già compilato.
        setLifeCounterOpen(true);
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
    updatePlayer(index, { name, rejectingMatch: false, nameTyping: false });
  }

  /** Nome di un giocatore già in elenco che somiglia a quello digitato (a parte
   *  maiuscole/spazi) ma non coincide esattamente. `null` quando non c'è
   *  nessuna somiglianza da segnalare. */
  function matchingExistingName(p: PlayerRow): string | null {
    const trimmed = p.name.trim();
    if (!trimmed) return null;
    const match = findCanonicalName(playerNames, trimmed);
    if (!match || match === trimmed) return null;
    return match;
  }

  /** `true` quando c'è ancora qualcosa da chiedere o da correggere sul nome:
   *  o la domanda "è la stessa persona?" non ha ancora risposta, oppure
   *  l'utente ha detto "è un'altra persona" ma il nome somiglia ancora a
   *  quello esistente (serve un nome davvero distinto, non solo le maiuscole). */
  function hasUnresolvedNameConflict(): boolean {
    return players.some((p) => matchingExistingName(p) !== null);
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

  function handleOpenLifeCounter(resume = false) {
    setResumeCounter(resume);
    setError('');
    if (hasUnresolvedNameConflict()) {
      setError('Rispondi alla domanda sul nome del giocatore prima di procedere.');
      return;
    }
    const names = players.map((p) => p.name.trim()).filter(Boolean);
    if (!names.length) {
      setError('Scegli almeno un giocatore prima di avviare il conteggio.');
      return;
    }
    setLifeCounterOpen(true);
  }

  function handleLifeCounterFinish(
    lives: Record<string, number>,
    causes: Record<string, LossCause[]>,
    poisons: Record<string, number>
  ) {
    // Se un solo giocatore non ha KILL, MILL né veleno letale, è lui il
    // vincitore: lo preseleziono. Con più candidati non scelgo nessuno.
    const survivors = Object.keys(lives).filter((k) => (causes[k] ?? []).length === 0);
    setPlayers((prev) =>
      prev.map((p) => {
        const key = p.name.trim();
        if (!(key in lives)) return p;
        return {
          ...p,
          life: String(lives[key]),
          loss: causes[key] ?? [],
          poison: poisons[key] ?? 0,
          winner: survivors.length === 1 ? survivors[0] === key : p.winner,
        };
      })
    );
    setLifeCounterOpen(false);
  }

  async function handleSaveClick() {
    setMessage('');
    setError('');
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }
    if (hasUnresolvedNameConflict()) {
      setError('Rispondi alla domanda sul nome del giocatore prima di salvare.');
      return;
    }

    const readPlayers = players
      .map((p, i) => {
        const deckVal = p.deckMode === 'manual' ? p.deckManual.trim() : p.deckSelect;
        // .slice come rete di sicurezza: il campo ha già maxLength, ma un
        // nome scelto dal suggerimento o già in elenco potrebbe in teoria
        // arrivare da un'altra fonte (altro dispositivo, dato più vecchio).
        const typedName = p.name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
        // A questo punto il nome non è più ambiguo (il salvataggio è
        // bloccato finché lo è): se coincide esattamente con uno già in
        // elenco uso quella grafia, altrimenti è un nome nuovo o già chiarito.
        const name = findCanonicalName(playerNames, typedName) ?? typedName;
        return {
          name,
          deck: deckVal,
          desc: p.desc.trim(),
          life: p.life === '' ? null : Number(p.life),
          winner: p.winner,
          colors: [...p.colors],
          seat: i + 1,
          ...(p.loss.length ? { loss: p.loss } : {}),
          ...(p.poison > 0 ? { poison: p.poison } : {}),
        };
      })
      .filter((p) => p.name || p.deck || p.desc || p.life !== null || p.colors.length)
      .map((p) => ({ ...p, name: p.name || 'Giocatore ' + p.seat }));

    // `startedAt` è "YYYY-MM-DDTHH:mm" in ora locale: new Date(...) lo legge
    // come locale, .toISOString() lo converte nel timestamp UTC da salvare.
    // `date` (solo giorno) resta per l'ordinamento/etichetta già in uso altrove.
    const startedAtIso = new Date(startedAt).toISOString();

    const row = {
      date: startedAt.slice(0, 10),
      format: format.trim(),
      notes: notes.trim(),
      players: readPlayers,
      started_at: startedAtIso,
      // L'orario di fine si registra da solo al momento del salvataggio, solo
      // per una partita nuova: modificare una partita già salvata in seguito
      // non deve spostare quando "è davvero finita".
      ...(editingGame ? {} : { ended_at: new Date().toISOString() }),
    };

    const gameId = editingGame ? editingGame.id : 'g' + Date.now() + Math.random().toString(36).slice(2, 7);
    setSaving(true);
    const { error: saveError } = editingGame
      ? await supabase.from(TABLE_GAMES).update(row).eq('id', gameId)
      : await supabase.from(TABLE_GAMES).insert({ id: gameId, ...row });
    setSaving(false);
    if (saveError) {
      setError('Salvataggio partita non riuscito: ' + saveError.message);
      return;
    }
    rememberStartLife(gameId, startLife);

    if (onSaved) {
      onSaved();
      return;
    }

    setMessage('Partita salvata.');
    setStartedAt(toLocalDateTimeValue(new Date()));
    setFormat('');
    setNotes('');
    setPlayers([emptyPlayerRow(), emptyPlayerRow()]);
  }

  if (loading) {
    return <p className={TEXT_MUTED}>Caricamento…</p>;
  }

  /** Punteggi già salvati di ogni giocatore (solo quelli con una vita registrata). */
  const resumeData: Record<string, LifeCounterResume> = {};
  players.forEach((p) => {
    const key = p.name.trim();
    if (key && p.life !== '' && !Number.isNaN(Number(p.life))) {
      resumeData[key] = { life: Number(p.life), loss: p.loss, poison: p.poison };
    }
  });

  if (lifeCounterOpen) {
    return (
      <LifeCounter
        players={players.map((p) => p.name.trim()).filter(Boolean)}
        startLife={startLife}
        resume={resumeCounter ? resumeData : undefined}
        onCancel={() => setLifeCounterOpen(false)}
        onFinish={handleLifeCounterFinish}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Data e ora separate invece di un unico <input type="datetime-local">:
            quel riquadro combinato ha una larghezza minima che su iPhone resta
            più larga dello schermo anche dentro una colonna ristretta; data e
            ora separate restano invece entrambe strette a sufficienza.
            Il campo orario nativo, però, ha anche lui una larghezza minima
            che Safari su iPhone non rispetta se il box è troppo stretto (la
            disegna comunque, sbordando fuori): per questo i due campi sono
            impilati invece che affiancati sugli schermi stretti, dove c'è
            tutta la larghezza del modulo a disposizione per ciascuno; da
            tablet in su, con più spazio, tornano affiancati. */}
        <div className="mb-4 min-w-0">
          <span className={FIELD_LABEL}>Data e ora di inizio</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={startedAt.slice(0, 10)}
              onChange={(e) => setStartedAt(`${e.target.value}T${startedAt.slice(11, 16) || '00:00'}`)}
              className={cx(FIELD_CONTROL_SM, 'min-w-0 mtg-datetime-input')}
            />
            <input
              type="time"
              value={startedAt.slice(11, 16)}
              onChange={(e) => setStartedAt(`${startedAt.slice(0, 10)}T${e.target.value || '00:00'}`)}
              className={cx(FIELD_CONTROL_SM, 'min-w-0 mtg-datetime-input')}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className={FIELD_LABEL} htmlFor="fmt">
            Formato
          </label>
          <button
            id="fmt"
            type="button"
            onClick={() => setFormatPickerOpen(true)}
            className={cx(FIELD_CONTROL_SM, 'flex w-full items-center justify-between gap-2 text-left')}
          >
            <span className={cx('min-w-0 truncate', format ? undefined : 'text-zaff-muted')}>
              {format || 'Scegli il formato'}
            </span>
            <span className="shrink-0 text-xl leading-none text-zaff-muted" aria-hidden="true">
              ›
            </span>
          </button>
          {formatPickerOpen && (
            <Modal level={2} title="Formato" onClose={() => setFormatPickerOpen(false)}>
              <div className="grid grid-cols-2 gap-2.5">
                {(format && !FORMATS.includes(format) ? [format, ...FORMATS] : FORMATS).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={format === f ? 'primary' : 'ghost'}
                    size="lg"
                    fullWidth
                    className="min-h-[64px] py-4 text-lg"
                    onClick={() => {
                      setFormat(f);
                      setFormatPickerOpen(false);
                    }}
                  >
                    {f}
                  </Button>
                ))}
              </div>
              {format && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setFormat('');
                    setFormatPickerOpen(false);
                  }}
                >
                  Nessun formato
                </Button>
              )}
            </Modal>
          )}
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
              <div className="min-w-0 flex-1">
                {p.nameTyping || (p.name !== '' && !playerNames.includes(p.name)) ? (
                  <>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePlayer(i, { name: e.target.value, nameTyping: true })}
                      placeholder={`Nome del giocatore ${i + 1}`}
                      maxLength={MAX_PLAYER_NAME_LENGTH}
                      autoComplete="off"
                      className={cx(FIELD_CONTROL_SM, 'w-full')}
                    />
                    {playerNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => updatePlayer(i, { name: '', nameTyping: false, rejectingMatch: false })}
                        className="mt-1 text-xs text-zaff-muted underline"
                      >
                        Scegli dall&apos;elenco giocatori
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlayerPickerFor(i)}
                    className={cx(FIELD_CONTROL_SM, 'flex w-full items-center justify-between gap-2 text-left')}
                  >
                    <span className={cx('min-w-0 truncate', p.name ? undefined : 'text-zaff-muted')}>
                      {p.name || `Scegli il giocatore ${i + 1}`}
                    </span>
                    <span className="shrink-0 text-xl leading-none text-zaff-muted" aria-hidden="true">
                      ›
                    </span>
                  </button>
                )}
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

            {(() => {
              const match = matchingExistingName(p);
              if (!match) return null;

              if (p.rejectingMatch) {
                const [s1, s2] = suggestAlternativeNames(match);
                return (
                  <div className="mb-2 rounded-lg border border-red-400/40 bg-red-400/10 p-2.5 text-sm text-zaff-text">
                    <p className="mb-2 text-red-400">
                      Allora scegli un nome diverso da "{match}": cambiare solo maiuscole o spazi non basta a
                      distinguerli. Ad esempio:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => updatePlayer(i, { name: s1, rejectingMatch: false })}>
                        {s1}
                      </Button>
                      <Button size="sm" onClick={() => updatePlayer(i, { name: s2, rejectingMatch: false })}>
                        {s2}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="mb-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-sm text-zaff-text">
                  <p className="mb-2">Esiste già un giocatore chiamato "{match}". È la stessa persona?</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => updatePlayer(i, { name: match, rejectingMatch: false })}>
                      Sì, è lui/lei
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updatePlayer(i, { rejectingMatch: true })}>
                      No, è un'altra persona
                    </Button>
                  </div>
                </div>
              );
            })()}

            <div className="mb-2 flex flex-wrap items-center gap-2">
              {p.deckMode === 'select' ? (
                <button
                  type="button"
                  onClick={() => setDeckPickerFor(i)}
                  className={cx(FIELD_CONTROL_SM, 'flex min-w-0 flex-1 items-center justify-between gap-2 text-left')}
                >
                  <span className={cx('min-w-0 truncate', p.deckSelect ? undefined : 'text-zaff-muted')}>
                    {p.deckSelect || 'Scegli il mazzo'}
                  </span>
                  <span className="shrink-0 text-xl leading-none text-zaff-muted" aria-hidden="true">
                    ›
                  </span>
                </button>
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
                {p.deckMode === 'select' ? 'Scrivi a Mano' : 'Scegli dai Mazzi Salvati'}
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
                  <span className="mtg-switch mtg-switch-lg" />
                  Vincitore
                </label>

                <NumberStepper
                  value={p.life}
                  onChange={(next) => updatePlayer(i, { life: next })}
                  placeholder="PV"
                  aria-label="Punti vita"
                  className="w-[176px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {playerPickerFor !== null && (
        <Modal level={2} title={`Giocatore ${playerPickerFor + 1}`} onClose={() => setPlayerPickerFor(null)}>
          <div className="grid grid-cols-2 gap-2.5">
            {playerNames.map((n) => {
              const usedElsewhere = players.some((q, qi) => qi !== playerPickerFor && q.name.trim() === n);
              return (
                <Button
                  key={n}
                  variant={players[playerPickerFor]?.name === n ? 'primary' : 'ghost'}
                  size="lg"
                  fullWidth
                  disabled={usedElsewhere}
                  className="min-h-[64px] py-4 text-lg"
                  onClick={() => {
                    selectPlayerName(playerPickerFor, n);
                    setPlayerPickerFor(null);
                  }}
                >
                  <span className="min-w-0 truncate">{n}</span>
                </Button>
              );
            })}
          </div>
          <Button
            variant="link"
            size="lg"
            fullWidth
            className="mt-3"
            onClick={() => {
              updatePlayer(playerPickerFor, { name: '', nameTyping: true, rejectingMatch: false });
              setPlayerPickerFor(null);
            }}
          >
            + Nuovo giocatore (scrivi il nome)
          </Button>
        </Modal>
      )}

      {deckPickerFor !== null && (
        <Modal level={2} title="Mazzo" onClose={() => setDeckPickerFor(null)}>
          <div className="flex flex-col gap-2.5">
            <Button
              variant={!players[deckPickerFor]?.deckSelect ? 'primary' : 'ghost'}
              size="lg"
              fullWidth
              className="py-3.5 text-base"
              onClick={() => {
                handleDeckSelectChange(deckPickerFor, '');
                setDeckPickerFor(null);
              }}
            >
              Nessun mazzo
            </Button>
            {decks.map((d) => (
              <Button
                key={d.name}
                variant={players[deckPickerFor]?.deckSelect === d.name ? 'primary' : 'ghost'}
                size="lg"
                fullWidth
                className="py-3.5 text-base"
                onClick={() => {
                  handleDeckSelectChange(deckPickerFor, d.name);
                  setDeckPickerFor(null);
                }}
              >
                <span className="min-w-0 truncate">{d.name}</span>
              </Button>
            ))}
          </div>
        </Modal>
      )}

      <Button variant="link" size="xl" onClick={addPlayer}>
        + Aggiungi Giocatore
      </Button>

      <div className="mt-3.5">
        <label className={FIELD_LABEL} htmlFor="startLife">
          Punti vita iniziali
        </label>
        <NumberStepper
          value={String(startLife)}
          min={1}
          onChange={(next) => setStartLife(Math.max(1, parseInt(next, 10) || 1))}
          className="max-w-[190px]"
        />
      </div>

      <div className={editingGame ? 'mt-4 grid grid-cols-2 gap-3' : 'mt-4'}>
        <Button onClick={() => handleOpenLifeCounter(false)} size="lg" fullWidth className="py-3.5 text-lg">
          <span className="text-xl leading-none">▶</span> Avvia Partita
        </Button>
        {/* Solo per una partita già salvata: riparte dai punteggi registrati. */}
        {editingGame && (
          <Button onClick={() => handleOpenLifeCounter(true)} size="lg" fullWidth className="py-3.5 text-lg">
            <span className="text-xl leading-none">⏯</span> Riprendi Partita
          </Button>
        )}
      </div>

      <TextAreaField
        id="notes"
        label="Appunti"
        density="compact"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Combo assurde, alleanze tradite, mulligan sfortunati…"
        fieldClassName="mt-4"
      />

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Button fullWidth onClick={handleSaveClick} disabled={saving}>
          {editingGame ? 'Salva Modifiche' : 'Salva Partita'}
        </Button>
        <Button fullWidth variant="ghost" onClick={onBack}>
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
