import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import CharCount from '../ui/CharCount';
import { clearGameDraft, draftPlayerNames, readGameDraft, writeGameDraft, type DraftPlayer, type GameDraft } from './gameDraft';

interface GameFormProps {
  editingGame?: Game | null;
  /** "Rivincita": parte con gli stessi giocatori, mazzi e formato di questa
   *  partita (senza vita, vincitore e note) e apre subito il segna-punti. */
  rematchFrom?: Game | null;
  onBack: () => void;
  /** Uscita confermata dal segna-punti senza salvare (senza una seconda domanda); se manca, onBack. */
  onDiscard?: () => void;
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

/** Righe nell'ordine dei posti scelto nel segna-punti ("Cambia posti"); le righe senza nome restano in fondo.
 *  L'ordine si salva con la partita (seat), quindi vale anche per "Riprendi Partita" e per la rivincita. */
function seatRows(rows: PlayerRow[], seating: string[]): PlayerRow[] {
  const seat = new Map(seating.map((name, i) => [name, i]));
  return [...rows].sort((a, b) => (seat.get(a.name.trim()) ?? seating.length) - (seat.get(b.name.trim()) ?? seating.length));
}

type CounterResult = [
  lives: Record<string, number>,
  causes: Record<string, LossCause[]>,
  poisons: Record<string, number>,
  commanders: Record<string, CommanderCount>,
  seating: string[],
];

/** Righe dell'editor con i punteggi del segna-punti (vita, cause, veleno, Comandante e posti). */
function withCounter(rows: PlayerRow[], [lives, causes, poisons, commanders, seating]: CounterResult): PlayerRow[] {
  const rowByName = new Map(rows.map((r) => [r.name.trim(), r.rowId]));
  return seatRows(rows, seating).map((p) => {
    const key = p.name.trim();
    if (!(key in lives)) return p;
    const count = commanders[key];
    return {
      ...p,
      life: String(lives[key]),
      loss: causes[key] ?? [],
      poison: poisons[key] ?? 0,
      commander: count && rekeyCommander(count, rowByName),
    };
  });
}

/** Righe → copia della partita in corso (danni da comandante per nome, colori come elenco). */
function toDraftPlayers(rows: PlayerRow[]): DraftPlayer[] {
  const nameByRow = new Map(rows.filter((r) => r.name.trim()).map((r) => [r.rowId, r.name.trim()]));
  return rows.map((r) => ({
    name: r.name,
    deckMode: r.deckMode,
    deckSelect: r.deckSelect,
    deckManual: r.deckManual,
    desc: r.desc,
    life: r.life,
    winner: r.winner,
    colors: [...r.colors],
    loss: r.loss,
    poison: r.poison,
    ...(r.commander ? { commander: rekeyCommander(r.commander, nameByRow) } : {}),
  }));
}

function fromDraftPlayers(players: DraftPlayer[]): PlayerRow[] {
  const rows = players.map(({ commander: _commander, colors, ...p }) => ({ ...p, rowId: newRowId(), colors: new Set(colors) }));
  const rowByName = new Map(rows.filter((r) => r.name.trim()).map((r) => [r.name.trim(), r.rowId]));
  return rows.map((r, i) => {
    const count = players[i].commander;
    return count ? { ...r, commander: rekeyCommander(count, rowByName) } : r;
  });
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
export default function GameForm({ editingGame, rematchFrom, onBack, onDiscard, onSaved, onSavingChange }: GameFormProps) {
  const { t, i18n } = useTranslation();
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
  /** Partita nuova rimasta senza salvataggio su questo dispositivo: si chiede se riprenderla. */
  const [draftOffer, setDraftOffer] = useState<GameDraft | null>(null);
  /** Rivincita in attesa della risposta su "Partita non salvata", prima di aprire il segna-punti. */
  const rematchWaiting = useRef(false);
  /** La copia della partita in corso è attiva (dopo l'avvio del segna-punti). Solo per partite nuove. */
  const draftActive = useRef(false);
  /** Ultimo stato del segna-punti aperto (null quando è chiuso: i punteggi sono già nelle righe). */
  const counterState = useRef<CounterResult | null>(null);

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
        // modulo già compilato. Con un nome oltre il limite resta sul modulo,
        // che spiega dove accorciarlo.
        if (rematchFrom.players.every((p) => p.name.trim().length <= MAX_PLAYER_NAME_LENGTH)) {
          if (readGameDraft()) rematchWaiting.current = true;
          else startCounter(false);
        }
      } else {
        // Partita nuova: riparto da formato, punti vita e giocatori dell'ultima
        // partita salvata (solo i giocatori ancora presenti in elenco).
        const last = readLastGame();
        if (last) {
          setFormat(last.format);
          setStartLife(last.startLife);
          // Solo i giocatori ancora in elenco e con un nome entro il limite.
          const known = last.names.filter((n) => n.length <= MAX_PLAYER_NAME_LENGTH && loadedNames.current.some((x) => sameName(x, n)));
          if (known.length >= 2) {
            setPlayers(known.map((n) => ({ ...emptyPlayerRow(), name: loadedNames.current.find((x) => sameName(x, n)) ?? n })));
          }
        }
      }
      // Partita nuova: se l'ultima non è mai stata salvata, si chiede se riprenderla.
      if (!editingGame) setDraftOffer(readGameDraft());
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

  /** Aggiorna la copia della partita in corso (solo partite nuove, dopo l'avvio del segna-punti). */
  function persistDraft() {
    if (!draftActive.current) return;
    const rows = counterState.current ? withCounter(players, counterState.current) : players;
    writeGameDraft({
      savedAt: Date.now(),
      startedAt,
      format,
      notes,
      startLife,
      players: toDraftPlayers(rows),
      counterOpen: lifeCounterOpen,
    });
  }
  const persistRef = useRef(persistDraft);
  persistRef.current = persistDraft;
  useEffect(() => { persistRef.current(); }, [players, startedAt, format, notes, startLife, lifeCounterOpen]);

  // Uscire dalla pagina (dopo la conferma, o dopo il salvataggio) chiude la partita in corso:
  // la copia serve solo se l'app si chiude senza passare da qui.
  useEffect(() => () => {
    if (draftActive.current) clearGameDraft();
  }, []);
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

  /** Posizione di un'altra riga con lo stesso giocatore (a parte maiuscole/spazi), o -1:
   *  in una partita ogni giocatore compare una volta sola. */
  function duplicateRowOf(index: number): number {
    const name = players[index].name.trim();
    if (!name) return -1;
    return players.findIndex((q, qi) => qi !== index && sameName(q.name, name));
  }

  function hasDuplicatePlayer(): boolean {
    return players.some((_, i) => duplicateRowOf(i) !== -1);
  }

  const DUPLICATE_PLAYER_ERROR = t('stesso_giocatore_compare_due_volte');

  /** Spiegazione per un nome oltre il limite, o null. Un nome lungo salvato prima del limite
   *  non si taglia qui (diventerebbe un altro giocatore nelle statistiche): si accorcia una
   *  volta in Gestisci Giocatori, che lo cambia anche nelle partite già salvate. */
  function tooLongNameMessage(name: string): string | null {
    const trimmed = name.trim();
    if (trimmed.length <= MAX_PLAYER_NAME_LENGTH) return null;
    return findCanonicalName(playerNames, trimmed)
      ? t('supera_caratteri_accorcialo_in_gestisci', { name: trimmed, max: MAX_PLAYER_NAME_LENGTH })
      : t('nome_troppo_lungo', { name: trimmed, max: MAX_PLAYER_NAME_LENGTH });
  }

  function checkNames(action: 'procedere' | 'salvare'): string | null {
    // Prima i doppioni: finché un giocatore è ripetuto, la domanda sul nome non compare.
    if (hasDuplicatePlayer()) return DUPLICATE_PLAYER_ERROR;
    if (hasUnresolvedNameConflict()) return t(action === 'salvare' ? 'rispondi_domanda_nome_prima_salvare' : 'rispondi_domanda_nome_prima_procedere');
    for (const p of players) {
      const message = tooLongNameMessage(p.name);
      if (message) return message;
    }
    return null;
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
    const nameProblem = checkNames('procedere');
    if (nameProblem) {
      setError(nameProblem);
      return;
    }
    const names = players.map((p) => p.name.trim()).filter(Boolean);
    if (!names.length) {
      setError(t('scegli_almeno_un_giocatore_prima'));
      return;
    }
    startCounter(resume);
  }

  /** Apre il segna-punti; per una partita nuova da qui parte la copia della partita in corso. */
  function startCounter(resume: boolean) {
    setResumeCounter(resume);
    counterState.current = null;
    if (!editingGame) draftActive.current = true;
    setLifeCounterOpen(true);
  }

  /** "Riprendi" la partita non salvata: righe e impostazioni della copia, segna-punti riaperto se lo era. */
  function resumeDraft(draft: GameDraft) {
    setDraftOffer(null);
    rematchWaiting.current = false;
    setStartedAt(draft.startedAt);
    setFormat(draft.format);
    setNotes(draft.notes);
    setStartLife(draft.startLife);
    setPlayers(fromDraftPlayers(draft.players));
    draftActive.current = true;
    if (draft.counterOpen) startCounter(true);
  }

  /** "Scarta": la partita non salvata sparisce; una rivincita in attesa parte ora. */
  function discardDraft() {
    clearGameDraft();
    setDraftOffer(null);
    if (rematchWaiting.current) {
      rematchWaiting.current = false;
      startCounter(false);
    }
  }

  /** "Fine Partita". Partita nuova: il segna-punti ha già deciso il vincitore (`winner`, anche null)
   *  e la partita si salva subito. Partita salvata: si torna all'editor, con il vincitore preselezionato
   *  solo se è rimasto in gioco un solo giocatore (senza KILL, MILL né veleno letale). */
  function handleLifeCounterFinish(...[lives, causes, poisons, commanders, seating, winner]: [...CounterResult, (string | null)?]) {
    const counted = withCounter(players, [lives, causes, poisons, commanders, seating]);
    const survivors = Object.keys(lives).filter((k) => (causes[k] ?? []).length === 0);
    const decided = winner !== undefined ? winner : survivors.length === 1 ? survivors[0] : undefined;
    const rows = counted.map((p) => (p.name.trim() in lives && decided !== undefined ? { ...p, winner: p.name.trim() === decided } : p));
    counterState.current = null;
    setPlayers(rows);
    setLifeCounterOpen(false);
    if (winner !== undefined) void handleSaveClick(rows);
  }

  /** "Modifica Partita" dal segna-punti: riporta nell'editor i punteggi raggiunti
   *  (senza chiudere la partita né scegliere un vincitore), così si può correggere
   *  un nome o un mazzo e poi "Riprendi Partita" da dove si era. */
  function handleLifeCounterBackToEdit(...result: CounterResult) {
    counterState.current = null;
    setPlayers(withCounter(players, result));
    setLifeCounterOpen(false);
  }

  /** Salva la partita; `rows` quando le righe sono appena cambiate (lo stato non è ancora aggiornato). */
  async function handleSaveClick(rows: PlayerRow[] = players) {
    setMessage('');
    setError('');
    if (!supabase) {
      setError(t('supabase_non_configurato'));
      return;
    }
    const nameProblem = checkNames('salvare');
    if (nameProblem) {
      setError(nameProblem);
      return;
    }

    const readPlayers = rows
      .map((p, i) => {
        const deckVal = p.deckMode === 'manual' ? p.deckManual.trim() : p.deckSelect;
        // Mazzo scelto dai salvati: ne ricordo l'ID, così la partita resta collegata anche se lo rinomini.
        const deckId = p.deckMode === 'select' && p.deckSelect ? decks.find((d) => d.name === p.deckSelect)?.id : undefined;
        // Niente taglio: i nomi oltre il limite sono già stati fermati da checkNames.
        const typedName = p.name.trim();
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
        setError(t('questa_partita_non_esiste_piu'));
        return;
      }
      if (
        gameFingerprint(rowToGame(currentRow)) !== gameFingerprint(editingGame) &&
        !window.confirm(
          t('qualcun_altro_ha_modificato_partita')
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
      setError(t('salvataggio_partita_non_riuscito', { error: (err as { message: string }).message }));
      return;
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
    rememberStartLife(gameId, startLife);
    // Salvata: la copia della partita in corso non serve più.
    if (!editingGame) {
      draftActive.current = false;
      clearGameDraft();
    }
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

    setMessage(t('partita_salvata'));
    setStartedAt(toLocalDateTimeValue(new Date()));
    setFormat('');
    setNotes('');
    setPlayers([emptyPlayerRow(), emptyPlayerRow()]);
  }

  if (loading) {
    return <p className={TEXT_MUTED}>{t('caricamento')}</p>;
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
        askWinner={!editingGame}
        onProgress={editingGame ? undefined : (...result) => {
          counterState.current = [result[0], result[1], result[2], result[3], result[4]];
          persistRef.current();
        }}
        onQuit={onDiscard ?? onBack}
        editingSaved={Boolean(editingGame)}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        <div className="mb-4">
          <label className={FIELD_LABEL} htmlFor="fmt">
            {t('formato')}
          </label>
          <button
            id="fmt"
            type="button"
            onClick={() => setFormatPickerOpen(true)}
            className={cx(FIELD_CONTROL_SM, 'flex w-full items-center justify-between gap-2 text-left')}
          >
            <span className={cx('min-w-0 truncate', format ? undefined : 'text-zaff-muted')}>
              {format || t('scegli_formato')}
            </span>
            <span className="shrink-0 text-xl leading-none text-zaff-muted" aria-hidden="true">
              ›
            </span>
          </button>
          {formatPickerOpen && (
            <Modal level={2} title={t('formato')} onClose={() => setFormatPickerOpen(false)}>
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
                    {t('nessun_formato')}
                  </Button>
                </div>
              )}
            </Modal>
          )}
        </div>
      </div>

      <span className={FIELD_LABEL}>{t('giocatori')}</span>
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
                      placeholder={t('nome_del_giocatore_n', { n: i + 1 })}
                      maxLength={MAX_PLAYER_NAME_LENGTH}
                      autoComplete="off"
                      aria-describedby={`player-name-count-${i}`}
                      className={cx(FIELD_CONTROL_SM, 'w-full')}
                    />
                    <CharCount id={`player-name-count-${i}`} value={p.name} max={MAX_PLAYER_NAME_LENGTH} />
                    {playerNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => updatePlayer(i, { name: '', nameTyping: false, rejectingMatch: false })}
                        className="mt-1 text-xs text-zaff-muted underline"
                      >
                        {t('scegli_dall_elenco_giocatori')}
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
                      {p.name || t('scegli_giocatore_n', { n: i + 1 })}
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
                  title={t('togli_giocatore')}
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-zaff-border text-xl leading-none text-zaff-muted transition hover:border-red-400 hover:text-red-400 active:scale-95"
                >
                  ×
                </button>
              )}
            </div>

            {(() => {
              const duplicate = duplicateRowOf(i);
              if (duplicate !== -1) {
                return (
                  <p role="alert" className="mb-2 rounded-lg border border-red-400/40 bg-red-400/10 p-2.5 text-sm text-red-400">
                    {t('gia_in_questa_partita', { name: p.name.trim(), n: duplicate + 1 })}
                  </p>
                );
              }

              const tooLong = tooLongNameMessage(p.name);
              if (tooLong) {
                return (
                  <p role="alert" className="mb-2 rounded-lg border border-red-400/40 bg-red-400/10 p-2.5 text-sm text-red-400">
                    {tooLong}
                  </p>
                );
              }

              const match = matchingExistingName(p);
              if (!match) return null;

              if (p.rejectingMatch) {
                const [s1, s2] = suggestAlternativeNames(match);
                return (
                  <div className="mb-2 rounded-lg border border-red-400/40 bg-red-400/10 p-2.5 text-sm text-zaff-text">
                    <p className="mb-2 text-red-400">
                      {t('allora_scegli_un_nome_diverso', { name: match })}
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
                  <p className="mb-2">{t('esiste_gia_un_giocatore_chiamato', { name: match })}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => updatePlayer(i, { name: match, rejectingMatch: false })}>
                      {t('si_lui_lei')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updatePlayer(i, { rejectingMatch: true })}>
                      {t('no_un_altra_persona')}
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
                    {p.deckSelect || t('scegli_mazzo')}
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
                  placeholder={t('nome_mazzo_libero')}
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
                {p.deckMode === 'select' ? t('scrivi_mano') : t('scegli_dai_mazzi_salvati')}
              </Button>
            </div>

            <input
              type="text"
              value={p.desc}
              onChange={(e) => updatePlayer(i, { desc: e.target.value })}
              placeholder={t('com_fatto_mazzo_strategia_note')}
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
                  {t('vincitore')}
                </label>

                <NumberStepper
                  value={p.life}
                  onChange={(next) => updatePlayer(i, { life: next })}
                  placeholder="PV"
                  aria-label={t('punti_vita')}
                  className="w-[176px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {playerPickerFor !== null && (
        <Modal level={2} title={t('giocatore_n', { n: playerPickerFor + 1 })} onClose={() => setPlayerPickerFor(null)}>
          <div className="grid grid-cols-2 gap-2.5">
            {playerNames.map((n) => {
              const usedElsewhere = players.some((q, qi) => qi !== playerPickerFor && sameName(q.name, n));
              const tooLong = n.length > MAX_PLAYER_NAME_LENGTH;
              return (
                <Button
                  key={n}
                  variant={players[playerPickerFor]?.name === n ? 'primary' : 'ghost'}
                  size="lg"
                  fullWidth
                  disabled={usedElsewhere || tooLong}
                  title={tooLong ? t('oltre_caratteri_accorcialo', { max: MAX_PLAYER_NAME_LENGTH }) : undefined}
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
          {playerNames.some((n) => n.length > MAX_PLAYER_NAME_LENGTH) && (
            <p className={cx(TEXT_MINI, 'mt-2')}>
              {t('nomi_oltre_caratteri_non_si', { max: MAX_PLAYER_NAME_LENGTH })}
            </p>
          )}
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
            {t('nuovo_giocatore_scrivi_nome')}
          </Button>
        </Modal>
      )}

      {deckPickerFor !== null && (
        <Modal level={2} title={t('mazzo')} onClose={() => setDeckPickerFor(null)}>
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
              {t('nessun_mazzo')}
            </Button>
            {decks.length > 0 && visibleDeckOptions.length === 0 && (
              <p className={TEXT_MUTED}>{t('nessun_mazzo_con_questi_colori')}</p>
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
        {t('aggiungi_giocatore')}
      </Button>

      <div className="mt-3.5">
        <label className={FIELD_LABEL} htmlFor="startLife">
          {t('punti_vita_iniziali')}
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
        <span className={FIELD_LABEL}>{t('data_ora_di_inizio')}</span>
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
        label={t('appunti')}
        density="compact"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('combo_assurde_alleanze_tradite')}
        fieldClassName="mt-4"
      />

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className={cx('mt-2.5', TEXT_MINI)}>
        {t('pallini_sotto_ogni_nome')}
      </p>

      {/* Barra sempre in vista in fondo allo schermo (sopra la barra di
          navigazione): avvio del segna-punti e salvataggio sono raggiungibili
          senza scorrere. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 flex flex-col gap-2.5 border-t border-zaff-border bg-zaff-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <div className={canResume ? 'grid grid-cols-2 gap-2.5' : undefined}>
          <Button onClick={() => handleOpenLifeCounter(false)} size="lg" fullWidth className="py-3.5 text-lg">
            <span className="text-xl leading-none">▶</span> {t('avvia_partita')}
          </Button>
          {/* Riparte dai punteggi registrati (partita salvata, o punteggio portato dal segna-punti). */}
          {canResume && (
            <Button onClick={() => handleOpenLifeCounter(true)} size="lg" fullWidth className="py-3.5 text-lg">
              <span className="text-xl leading-none">⏯</span> {t('riprendi_partita')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Button fullWidth size="lg" onClick={() => { void handleSaveClick(); }} disabled={saving}>
            {editingGame ? t('salva_modifiche') : t('salva_partita')}
          </Button>
          <Button fullWidth size="lg" variant="ghost" onClick={onBack}>
            {t('annulla')}
          </Button>
        </div>
      </div>

      {draftOffer && (
        <Modal title={t('partita_non_salvata')} onClose={() => setDraftOffer(null)}>
          <p className="mb-4 text-[15px] text-zaff-text">
            {t('hai_una_partita_iniziata_date', {
              date: new Date(draftOffer.startedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' }),
              time: new Date(draftOffer.startedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
              players: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(draftPlayerNames(draftOffer)),
            })}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="lg" onClick={discardDraft}>{t('scarta')}</Button>
            <Button size="lg" autoFocus onClick={() => resumeDraft(draftOffer)}>{t('riprendi')}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
