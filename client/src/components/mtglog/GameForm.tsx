import { useEffect, useRef, useState } from 'react';
import {
  findCanonicalName,
  MAX_PLAYER_NAME_LENGTH,
  sameName,
  subscribeToTable,
  suggestAlternativeNames,
  supabase,
  TABLE_DECKS,
  TABLE_GAMES,
  TABLE_PLAYERS,
} from '../../services/supabase';
import type { Game } from './GameList';
import { rowToGame } from './stats';
import LifeCounter, { type CommanderCount, type LifeCounterResume } from './LifeCounter';
import { rekeyCommander } from './commanderKeys';
import type { LossCause } from './GameList';
import { ManaPips } from './ManaIcon';
import ColorFilter from './ColorFilter';
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
  onSavingChange?: (saving: boolean) => void;
}

const FORMATS = ['Commander', 'Standard', 'Modern', 'Pauper', 'Draft', 'Two-Headed Giant', 'Amichevole'];

interface DeckOption {
  id: string;
  name: string;
  colors: string[];
}

interface PlayerRow {
  /** Identità della riga, stabile anche se il nome cambia (non si salva). */
  rowId: string;
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
  /** Tassa e danni da comandante dal segna-punti (danni per `rowId` di chi li ha inflitti).
   *  Servono solo a "Riprendi Partita": non si salvano con la partita. */
  commander?: CommanderCount;
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

/** Parti della partita che contano per accorgersi di una modifica altrui. */
function gameFingerprint(g: Game): string {
  return JSON.stringify([g.date, g.format, g.notes, g.startedAt, g.players]);
}

/** Ultima partita nuova salvata su questo dispositivo: formato, punti vita
 *  iniziali e giocatori (non i mazzi, che cambiano quasi sempre) vengono
 *  riproposti nella prossima "Nuova partita". Mai bloccante. */
const LAST_GAME_KEY = 'mtglog:lastNewGame';

interface LastGame {
  format: string;
  startLife: number;
  names: string[];
}

function readLastGame(): LastGame | null {
  try {
    const raw = localStorage.getItem(LAST_GAME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastGame>;
    if (!Array.isArray(v.names)) return null;
    return {
      format: typeof v.format === 'string' ? v.format : '',
      startLife: typeof v.startLife === 'number' && v.startLife >= 1 ? v.startLife : 20,
      names: v.names.filter((n): n is string => typeof n === 'string' && n.trim() !== ''),
    };
  } catch {
    return null;
  }
}

function rememberLastGame(value: LastGame) {
  try {
    localStorage.setItem(LAST_GAME_KEY, JSON.stringify(value));
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

let lastRowId = 0;
function newRowId(): string {
  lastRowId += 1;
  return 'r' + lastRowId;
}

function emptyPlayerRow(): PlayerRow {
  return {
    rowId: newRowId(),
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
 *  La pagina gestisce titolo, navigazione e protezione durante il salvataggio. */
export default function GameForm({ editingGame, rematchFrom, onBack, onSaved, onSavingChange }: GameFormProps) {
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  /** Nomi in elenco appena letti (lo stato si aggiorna solo al render dopo). */
  const loadedNames = useRef<string[]>([]);
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
  /** Filtro per colore nella scelta del mazzo (si azzera a ogni apertura). */
  const [deckColorFilter, setDeckColorFilter] = useState<Set<string>>(new Set());

  async function loadOptions(): Promise<DeckOption[]> {
    if (!supabase) return [];
    const [playersRes, decksRes] = await Promise.all([
      supabase.from(TABLE_PLAYERS).select('name').order('name'),
      supabase.from(TABLE_DECKS).select('id, name, colors').order('name'),
    ]);
    loadedNames.current = (playersRes.data ?? []).map((r) => r.name);
    setPlayerNames(loadedNames.current);
    const deckList = (decksRes.data ?? []).map((r) => ({ id: String(r.id), name: r.name, colors: r.colors ?? [] }));
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
            // Per ID (resta valido se il mazzo è stato rinominato), poi per nome.
            const saved = deckList.find((d) => d.id === p.deckId) ?? deckList.find((d) => d.name === p.deck);
            const manual = Boolean(p.deck) && !saved;
            return {
              rowId: newRowId(),
              name: p.name,
              deckMode: manual ? 'manual' : 'select',
              deckSelect: saved ? saved.name : '',
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
            const saved = deckList.find((d) => d.id === p.deckId) ?? deckList.find((d) => d.name === p.deck);
            const manual = Boolean(p.deck) && !saved;
            return {
              rowId: newRowId(),
              name: p.name,
              deckMode: manual ? 'manual' : 'select',
              deckSelect: saved ? saved.name : '',
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
      } else {
        // Partita nuova: riparto da formato, punti vita e giocatori dell'ultima
        // partita salvata (solo i giocatori ancora presenti in elenco).
        const last = readLastGame();
        if (last) {
          setFormat(last.format);
          setStartLife(last.startLife);
          const known = last.names.filter((n) => loadedNames.current.some((x) => sameName(x, n)));
          if (known.length >= 2) {
            setPlayers(known.map((n) => ({ ...emptyPlayerRow(), name: loadedNames.current.find((x) => sameName(x, n)) ?? n })));
          }
        }
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

  useEffect(() => { setDeckColorFilter(new Set()); }, [deckPickerFor]);
  const visibleDeckOptions = decks.filter((d) => [...deckColorFilter].every((c) => d.colors.includes(c)));

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

  /** Comandante dal segna-punti (danni per nome) alla riga dell'editor (danni per `rowId`). */
  function commanderForRow(rows: PlayerRow[], commanders: Record<string, CommanderCount>, key: string) {
    const count = commanders[key];
    return count && rekeyCommander(count, new Map(rows.map((r) => [r.name.trim(), r.rowId])));
  }

  function handleLifeCounterFinish(
    lives: Record<string, number>,
    causes: Record<string, LossCause[]>,
    poisons: Record<string, number>,
    commanders: Record<string, CommanderCount>
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
          commander: commanderForRow(prev, commanders, key),
          winner: survivors.length === 1 ? survivors[0] === key : p.winner,
        };
      })
    );
    setLifeCounterOpen(false);
  }

  /** "Modifica Partita" dal segna-punti: riporta nell'editor i punteggi raggiunti
   *  (senza chiudere la partita né scegliere un vincitore), così si può correggere
   *  un nome o un mazzo e poi "Riprendi Partita" da dove si era. */
  function handleLifeCounterBackToEdit(
    lives: Record<string, number>,
    causes: Record<string, LossCause[]>,
    poisons: Record<string, number>,
    commanders: Record<string, CommanderCount>
  ) {
    setPlayers((prev) =>
      prev.map((p) => {
        const key = p.name.trim();
        if (!(key in lives)) return p;
        return {
          ...p,
          life: String(lives[key]),
          loss: causes[key] ?? [],
          poison: poisons[key] ?? 0,
          commander: commanderForRow(prev, commanders, key),
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
        // Mazzo scelto dai salvati: ne ricordo l'ID, così la partita resta collegata anche se lo rinomini.
        const deckId = p.deckMode === 'select' && p.deckSelect ? decks.find((d) => d.name === p.deckSelect)?.id : undefined;
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
          ...(deckId ? { deckId } : {}),
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

    // Modifica di una partita salvata: se nel frattempo qualcun altro l'ha
    // cambiata (o cancellata) lo dico prima di sovrascrivere.
    if (editingGame) {
      const { data: currentRow } = await supabase.from(TABLE_GAMES).select('*').eq('id', gameId).maybeSingle();
      if (!currentRow) {
        setError('Questa partita non esiste più: è stata cancellata da qualcun altro.');
        return;
      }
      if (
        gameFingerprint(rowToGame(currentRow)) !== gameFingerprint(editingGame) &&
        !window.confirm(
          'Qualcun altro ha modificato questa partita mentre la stavi modificando.\n\nOK = sovrascrivi con le tue modifiche\nAnnulla = torna indietro (poi chiudi e riapri la partita per vedere la versione aggiornata)'
        )
      ) {
        return;
      }
    }

    setSaving(true);
    onSavingChange?.(true);
    try {
      const { error: saveError } = editingGame
        ? await supabase.from(TABLE_GAMES).update(row).eq('id', gameId)
        : await supabase.from(TABLE_GAMES).insert({ id: gameId, ...row });
      if (saveError) throw saveError;
    } catch (err) {
      setError('Salvataggio partita non riuscito: ' + (err as { message: string }).message);
      return;
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
    rememberStartLife(gameId, startLife);
    if (!editingGame) {
      rememberLastGame({
        format: format.trim(),
        startLife,
        names: readPlayers.map((p) => p.name).filter((n) => !/^Giocatore \d+$/.test(n)),
      });
    }

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
  const nameByRow = new Map(players.filter((p) => p.name.trim()).map((p) => [p.rowId, p.name.trim()]));
  players.forEach((p) => {
    const key = p.name.trim();
    if (key && p.life !== '' && !Number.isNaN(Number(p.life))) {
      resumeData[key] = {
        life: Number(p.life),
        loss: p.loss,
        poison: p.poison,
        ...(p.commander ? { commander: rekeyCommander(p.commander, nameByRow) } : {}),
      };
    }
  });

  /** "Riprendi Partita" serve se la partita è già salvata o se c'è già un punteggio nell'editor. */
  const canResume = Boolean(editingGame) || Object.keys(resumeData).length > 0;

  if (lifeCounterOpen) {
    return (
      <LifeCounter
        players={players.map((p) => p.name.trim()).filter(Boolean)}
        startLife={startLife}
        resume={resumeCounter ? resumeData : undefined}
        onEdit={handleLifeCounterBackToEdit}
        onFinish={handleLifeCounterFinish}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3">
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
                    className="h-16 w-full text-base leading-tight"
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
                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-zaff-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-16 w-full text-base leading-tight"
                    onClick={() => {
                      setFormat('');
                      setFormatPickerOpen(false);
                    }}
                  >
                    Nessun formato
                  </Button>
                </div>
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
            <div className="mb-2 flex items-start gap-2">
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
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-zaff-border text-xl leading-none text-zaff-muted transition hover:border-red-400 hover:text-red-400 active:scale-95"
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
          <div className="mb-3 rounded-lg border border-zaff-border bg-zaff-surface p-2.5">
            <ColorFilter
              colors={deckColorFilter}
              onToggle={(c) =>
                setDeckColorFilter((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(c)) next.add(c);
                  return next;
                })
              }
              onClear={() => setDeckColorFilter(new Set())}
            />
          </div>
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
            {decks.length > 0 && visibleDeckOptions.length === 0 && (
              <p className={TEXT_MUTED}>Nessun mazzo con questi colori.</p>
            )}
            {visibleDeckOptions.map((d) => (
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

      {/* Data e ora separate invece di un unico <input type="datetime-local">:
          quel riquadro combinato ha una larghezza minima che su iPhone resta
          più larga dello schermo anche dentro una colonna ristretta; data e
          ora separate restano invece entrambe strette a sufficienza.
          Il campo orario nativo, però, ha anche lui una larghezza minima
          che Safari su iPhone non rispetta se il box è troppo stretto (la
          disegna comunque, sbordando fuori): per questo i due campi sono
          impilati invece che affiancati sugli schermi stretti, dove c'è
          tutta la larghezza del modulo a disposizione per ciascuno; da
          tablet in su, con più spazio, tornano affiancati.
          Stanno in fondo, prima degli appunti: di solito restano i valori di default. */}
      <div className="mt-4 min-w-0">
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

      <TextAreaField
        id="notes"
        label="Appunti"
        density="compact"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Combo assurde, alleanze tradite, mulligan sfortunati…"
        fieldClassName="mt-4"
      />

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className={cx('mt-2.5', TEXT_MINI)}>
        I pallini sotto ogni nome sono i colori del mazzo: bianco, blu, nero, rosso, verde.
      </p>

      {/* Barra sempre in vista in fondo allo schermo (sopra la barra di
          navigazione): avvio del segna-punti e salvataggio sono raggiungibili
          senza scorrere. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 flex flex-col gap-2.5 border-t border-zaff-border bg-zaff-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <div className={canResume ? 'grid grid-cols-2 gap-2.5' : undefined}>
          <Button onClick={() => handleOpenLifeCounter(false)} size="lg" fullWidth className="py-3.5 text-lg">
            <span className="text-xl leading-none">▶</span> Avvia Partita
          </Button>
          {/* Riparte dai punteggi registrati (partita salvata, o punteggio portato dal segna-punti). */}
          {canResume && (
            <Button onClick={() => handleOpenLifeCounter(true)} size="lg" fullWidth className="py-3.5 text-lg">
              <span className="text-xl leading-none">⏯</span> Riprendi Partita
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Button fullWidth size="lg" onClick={handleSaveClick} disabled={saving}>
            {editingGame ? 'Salva Modifiche' : 'Salva Partita'}
          </Button>
          <Button fullWidth size="lg" variant="ghost" onClick={onBack}>
            Annulla
          </Button>
        </div>
      </div>
    </>
  );
}
