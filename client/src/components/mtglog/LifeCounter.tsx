import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Button from '../ui/Button';
import { PIE_COLORS } from './stats';
import { cx, HEADING_SECTION, NO_SCROLLBAR } from '../ui/styles';
import type { LossCause } from './GameList';

/** Tassa del comandante e danni da comandante subiti (per nome di chi li ha inflitti). */
export interface CommanderCount {
  tax: number;
  damage: Record<string, number>;
}

/** Stato salvato di un giocatore, per riprendere una partita già registrata. */
export interface LifeCounterResume {
  life: number;
  loss: LossCause[];
  poison: number;
  /** Presente se il Comandante era acceso: non si salva con la partita, vive solo nell'editor. */
  commander?: CommanderCount;
}

interface LifeCounterProps {
  players: string[];
  startLife: number;
  /** Se presente, il conteggio riparte da questi valori (per nome giocatore). */
  resume?: Record<string, LifeCounterResume>;
  /** "Modifica Partita": torna all'editor portando con sé i punteggi raggiunti
   *  (per correggere un nome o un mazzo senza perdere il conteggio). */
  onEdit: LifeCounterResult;
  onFinish: LifeCounterResult;
}

type LifeCounterResult = (
  lives: Record<string, number>,
  causes: Record<string, LossCause[]>,
  poisons: Record<string, number>,
  /** Solo i giocatori con il Comandante acceso. */
  commanders: Record<string, CommanderCount>,
  /** Nomi nell'ordine dei posti sullo schermo (dopo "Cambia posti"). */
  seating: string[]
) => void;

interface LcPlayer {
  name: string;
  life: number;
  kill: boolean;
  mill: boolean;
  /** Il contatore veleno compare solo se acceso dalle opzioni del giocatore. */
  poisonOn: boolean;
  poison: number;
  /** Il Comandante (tassa e danno da comandante) compare solo se acceso dalle opzioni del giocatore. */
  cmdrOn: boolean;
  /** Mana extra pagato per rilanciare il comandante (+2 a ogni rilancio). */
  tax: number;
  /** Danno da comandante subito, per giocatore che lo ha inflitto. */
  cmdr: Record<string, number>;
}

/** Cosa si può contare: ogni cambio finisce nella cronologia e si può annullare. */
type CounterField = 'life' | 'poison' | 'tax' | 'cmdr';

interface HistoryEntry {
  id: number;
  /** Istante dell'ultimo tocco unito a questa voce. */
  t: number;
  index: number;
  name: string;
  field: CounterField;
  /** Per il danno da comandante: chi lo ha inflitto. */
  source?: string;
  delta: number;
  from: number;
  to: number;
}

/** Tocchi ravvicinati sullo stesso contatore diventano una sola voce (altrimenti 40 righe di +1).
 *  Lo stesso intervallo decide quanto resta visibile il totale accanto ai punti vita. */
const MERGE_WINDOW_MS = 4000;
const MAX_HISTORY = 500;
/** Con 21 danni da un solo comandante si perde. */
const CMDR_LIMIT = 21;
/** Ogni rilancio del comandante costa 2 mana in più. */
const TAX_STEP = 2;

function readField(p: LcPlayer, field: CounterField, source?: string): number {
  if (field === 'life') return p.life;
  if (field === 'poison') return p.poison;
  if (field === 'tax') return p.tax;
  return p.cmdr[source ?? ''] ?? 0;
}

function writeField(p: LcPlayer, field: CounterField, source: string | undefined, value: number): LcPlayer {
  if (field === 'life') return { ...p, life: value };
  if (field === 'poison') return { ...p, poison: value };
  if (field === 'tax') return { ...p, tax: value };
  return { ...p, cmdr: { ...p.cmdr, [source ?? '']: value } };
}

function maxCommanderDamage(p: LcPlayer): number {
  return Math.max(0, ...Object.values(p.cmdr));
}

/** Punti vita cambiati con i tocchi ravvicinati di un giocatore (come in Lotus). */
interface LifeBurst {
  delta: number;
  /** Cresce a ogni tocco: fa ripartire il piccolo "battito". */
  taps: number;
  /** Falso quando il gruppo di tocchi è finito: il numero sfuma e il prossimo tocco riparte da zero. */
  visible: boolean;
}

function historyLabel(e: HistoryEntry): string {
  const range = `${e.from} → ${e.to}`;
  if (e.field === 'life') return `Vita ${range}`;
  if (e.field === 'poison') return `Veleno ${range}`;
  if (e.field === 'tax') return `Tassa comandante ${range}`;
  return `Danno da comandante di ${e.source}: ${range}`;
}

/**
 * Tiene lo schermo acceso finché il segna-punti è aperto (Screen Wake Lock).
 * Il blocco salta da solo quando la pagina va in secondo piano: lo richiedo
 * di nuovo al ritorno. Se il browser non lo supporta, o lo rifiuta (es.
 * risparmio energia), non succede nulla: lo schermo si comporta come prima.
 */
function useKeepScreenAwake() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (cancelled || sentinel || document.visibilityState !== 'visible') return;
      if (!('wakeLock' in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        /* rifiutato: pazienza */
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Alcuni browser accettano la richiesta solo dopo un tocco: se la prima
    // non è andata a buon fine, riprovo al primo tocco sullo schermo.
    document.addEventListener('pointerdown', acquire);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('pointerdown', acquire);
      if (sentinel) void sentinel.release();
      sentinel = null;
    };
  }, []);
}

/** Con 10 o più segnalini veleno si perde. */
const POISON_LIMIT = 10;

/** Come ha perso, da salvare con la partita: il veleno conta come KILL. */
function lossCauses(p: LcPlayer): LossCause[] {
  const causes: LossCause[] = [];
  if (p.kill || (p.poisonOn && p.poison >= POISON_LIMIT) || (p.cmdrOn && maxCommanderDamage(p) >= CMDR_LIMIT)) causes.push('kill');
  if (p.mill) causes.push('mill');
  return causes;
}

interface RollResult {
  name: string;
  roll: number;
}

function gridColumns(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 1; // due giocatori: uno sopra l'altro, riquadri più grandi
  return Math.ceil(Math.sqrt(n));
}

/** Le righe della metà superiore vanno capovolte: chi è seduto dal lato
 *  opposto del tavolo legge il proprio nome/punti vita dritti, non a testa in giù. */
function shouldRotate(index: number, cols: number, rows: number): boolean {
  if (rows < 2) return false;
  const rowIndex = Math.floor(index / cols);
  return rowIndex < Math.floor(rows / 2);
}

type Rotation = 0 | 90 | 180 | -90;

interface Placement {
  /** Posizione nella griglia (vuota: segue l'ordine di lettura). */
  cell: CSSProperties;
  /** Gradi di rotazione: chi siede da quel lato legge dritto. */
  rotation: Rotation;
}

/** Una disposizione possibile: griglia e posto di ogni giocatore. */
interface LayoutSpec {
  label: string;
  columns: string;
  rows: string;
  places: Placement[];
  /** Altezza del tasto opzioni, se il punto d'incontro dei riquadri non è a metà schermo.
   *  Tiene conto dello spazio tra le righe (gap-2.5 = 10px). */
  hubTop?: string;
}

/** Posto in griglia: colonna e riga (con eventuali estensioni) e rotazione. */
function at(column: string | number, row: string | number, rotation: Rotation): Placement {
  return { cell: { gridColumn: column, gridRow: row }, rotation };
}

/**
 * Disposizioni per numero di giocatori (3, 4, 5, 6); con più di una, il tasto "Disposizione" le alterna.
 * Chi siede da un lato legge dritto: capovolto in alto, ruotato di 90° ai lati del telefono.
 */
const LAYOUT_OPTIONS: Record<number, LayoutSpec[]> = {
  3: [
    {
      // Due riquadri affiancati in alto, ruotati verso i lati lunghi, e uno a tutta larghezza in basso.
      label: 'Due in alto, uno in basso',
      columns: '1fr 1fr',
      rows: '1.35fr 1fr',
      places: [at('1 / span 2', 2, 0), at(1, 1, 90), at(2, 1, -90)],
      // Dove si incontrano i tre riquadri: fine della prima riga (1.35 su 2.35) più metà spazio.
      hubTop: 'calc((100% - 10px) * 1.35 / 2.35 + 5px)',
    },
  ],
  4: [
    {
      // Due sul lato lungo sinistro e due su quello destro, in senso orario dal basso a sinistra.
      label: 'Due per lato',
      columns: '1fr 1fr',
      rows: '1fr 1fr',
      places: [at(1, 2, 90), at(1, 1, 90), at(2, 1, -90), at(2, 2, -90)],
    },
    {
      // In senso orario dal basso.
      label: 'A croce',
      columns: '1fr 1fr',
      rows: '1fr 1.35fr 1fr',
      places: [at('1 / span 2', 3, 0), at(1, 2, 90), at('1 / span 2', 1, 180), at(2, 2, -90)],
    },
  ],
  5: [
    {
      // Tre sul lato lungo sinistro e due su quello destro (ogni riquadro a destra occupa tre sesti dell'altezza).
      // In senso orario dal basso a sinistra.
      label: 'Tre e due per lato',
      columns: '1fr 1fr',
      rows: 'repeat(6, 1fr)',
      places: [at(1, '5 / span 2', 90), at(1, '3 / span 2', 90), at(1, '1 / span 2', 90), at(2, '1 / span 3', -90), at(2, '4 / span 3', -90)],
    },
    {
      // Due per lato lungo e uno a capotavola, in basso a tutta larghezza.
      // In senso orario dal capotavola.
      label: 'Due per lato, uno a capotavola',
      columns: '1fr 1fr',
      rows: '1fr 1fr 0.8fr',
      places: [at('1 / span 2', 3, 0), at(1, 2, 90), at(1, 1, 90), at(2, 1, -90), at(2, 2, -90)],
      // All'incrocio dei quattro riquadri laterali (fine della prima riga, 1 su 2.8).
      hubTop: 'calc((100% - 20px) / 2.8 + 5px)',
    },
  ],
  6: [
    {
      // Tre sul lato lungo sinistro e tre su quello destro: ogni riquadro è largo quasi metà schermo.
      // In senso orario dal basso a sinistra.
      label: 'Tre per lato',
      columns: '1fr 1fr',
      rows: 'repeat(3, 1fr)',
      places: [at(1, 3, 90), at(1, 2, 90), at(1, 1, 90), at(2, 1, -90), at(2, 2, -90), at(2, 3, -90)],
    },
    {
      // Come a 5: due per lato lungo e uno a ogni capotavola, a tutta larghezza
      // (niente colonne strette e alte). In senso orario dal capotavola in basso.
      label: 'Due per lato e i capotavola',
      columns: '1fr 1fr',
      rows: '0.8fr 1fr 1fr 0.8fr',
      places: [at('1 / span 2', 4, 0), at(1, 3, 90), at(1, 2, 90), at('1 / span 2', 1, 180), at(2, 2, -90), at(2, 3, -90)],
    },
  ],
};

/** Disposizione di riserva (1, 2 o più di 6 giocatori): griglia quadrata, metà alta capovolta. */
function defaultLayout(n: number): LayoutSpec {
  const cols = gridColumns(n);
  const rows = Math.ceil(n / cols);
  return {
    label: '',
    columns: `repeat(${cols}, 1fr)`,
    rows: `repeat(${rows}, 1fr)`,
    places: Array.from({ length: n }, (_, i) => ({ cell: {}, rotation: shouldRotate(i, cols, rows) ? 180 : 0 })),
  };
}

function layoutKey(n: number) {
  return `mtglog:counterLayout:${n}`;
}

function readLayoutIndex(n: number): number {
  const count = LAYOUT_OPTIONS[n]?.length ?? 1;
  try {
    const value = Number(localStorage.getItem(layoutKey(n)));
    return Number.isInteger(value) && value >= 0 && value < count ? value : 0;
  } catch {
    return 0;
  }
}

function rememberLayoutIndex(n: number, index: number) {
  try {
    localStorage.setItem(layoutKey(n), String(index));
  } catch {
    /* storage non disponibile: pazienza */
  }
}

/** Il contenuto della scheda ruota dentro la scheda: di 90° scambia larghezza e altezza (unità del contenitore). */
function innerStyle(rotation: Rotation): CSSProperties {
  if (rotation === 0) return { left: 0, top: 0, width: '100%', height: '100%' };
  if (rotation === 180) return { left: 0, top: 0, width: '100%', height: '100%', transform: 'rotate(180deg)' };
  return { left: '50%', top: '50%', width: '100cqh', height: '100cqw', transform: `translate(-50%, -50%) rotate(${rotation}deg)` };
}

/** Caratteri che "piovono" prima che la parola si componga, in stile Matrix. */
const MATRIX_CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789';
/** Le lettere si fissano da sinistra a destra: la prima dopo RESOLVE_START, poi una ogni RESOLVE_STEP. */
const RESOLVE_START_MS = 500;
const RESOLVE_STEP_MS = 220;
const FRAME_MS = 60;

interface MatrixLetter {
  ch: string;
  done: boolean;
}

/** Carattere "a caso" ma deterministico (niente Math.random: serve solo a variare l'aspetto). */
function matrixChar(position: number, frame: number): string {
  const hash = (Math.imul(position + 1, 2654435761) ^ Math.imul(frame + 1, 40503)) >>> 0;
  return MATRIX_CHARS[hash % MATRIX_CHARS.length];
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Un testo (la parola della moneta, il nome di un giocatore) che si compone lettera per lettera
 * da caratteri che cambiano, come nella pioggia di Matrix. Con "riduci animazioni" attivo compare subito.
 * Il risultato è già deciso: l'animazione è solo scena (il testo per gli screen reader va messo a parte).
 */
function MatrixText({ text, uppercase = false, className }: { text: string; uppercase?: boolean; className?: string }) {
  const target = uppercase ? text.toUpperCase() : text;
  const [letters, setLetters] = useState<MatrixLetter[]>(() =>
    [...target].map((ch, i) => (ch === ' ' || prefersReducedMotion() ? { ch, done: true } : { ch: matrixChar(i, 0), done: false }))
  );

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // Nomi lunghi: le lettere si fissano più in fretta, così l'effetto dura sempre circa lo stesso.
    const step = Math.min(RESOLVE_STEP_MS, 900 / Math.max(1, target.length));
    const start = Date.now();
    let frame = 0;
    const timer = window.setInterval(() => {
      frame++;
      const elapsed = Date.now() - start;
      const next = [...target].map((ch, i): MatrixLetter =>
        ch === ' ' || elapsed >= RESOLVE_START_MS + i * step ? { ch, done: true } : { ch: matrixChar(i, frame), done: false }
      );
      setLetters(next);
      if (next.every((l) => l.done)) window.clearInterval(timer);
    }, FRAME_MS);
    return () => window.clearInterval(timer);
  }, [target]);

  return (
    <span aria-hidden="true" className={className}>
      {letters.map((l, i) => (
        <span
          key={i}
          className={cx('inline-block text-center transition-colors', l.ch === ' ' ? 'w-[0.6ch]' : 'w-[1.1ch]', l.done ? 'text-zaff-text' : 'text-emerald-400/80')}
        >
          {l.ch === ' ' ? '\u00A0' : l.ch}
        </span>
      ))}
    </span>
  );
}

function rollHighRoll(names: string[]): RollResult[] {
  const n = names.length;
  const maxVal = Math.max(20, n);
  const pool = Array.from({ length: maxVal }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const rolls = names.map((name, i) => ({ name, roll: pool[i] }));
  rolls.sort((a, b) => b.roll - a.roll);
  return rolls;
}

/** Zona di tocco (metà scheda, ±1). Niente
 *  evidenziazione al tocco di sistema (iOS la mostra come un flash grigio
 *  posizionato male sotto transform); il feedback è tutto nostro. */
function tapClass(extra = '') {
  return `relative flex select-none items-center justify-center text-white/90 transition active:bg-white/20 active:text-white ${extra}`;
}

const TAP_HIGHLIGHT_OFF = { WebkitTapHighlightColor: 'transparent' } as const;

/**
 * Totale dei tocchi ravvicinati, piccolo e semitrasparente accanto al punteggio:
 * dal lato del − se si tolgono punti, dal lato del + se si aggiungono.
 * Le dimensioni seguono il punteggio (em del contenitore). Solo scena: i tasti hanno già le loro etichette.
 */
function LifeDelta({ burst }: { burst?: LifeBurst }) {
  const ref = useRef<HTMLSpanElement>(null);
  const taps = burst?.visible ? burst.taps : 0;

  useEffect(() => {
    const el = ref.current;
    if (!taps || !el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    el.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
  }, [taps]);

  if (!burst) return null;
  const gain = burst.delta > 0;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-testid="life-delta"
      className={cx(
        'absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.4em] font-bold leading-none tabular-nums text-white/70 transition-opacity duration-500',
        gain ? 'left-full ml-[0.35em] origin-left' : 'right-full mr-[0.35em] origin-right',
        burst.visible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ textShadow: '0 1px 4px rgba(0,0,0,.35)' }}
    >
      {gain ? '+' : '−'}
      {Math.abs(burst.delta)}
    </span>
  );
}

/**
 * Contatore punti vita a tutto schermo. Scheda a colore pieno per ciascun
 * giocatore (come nei contatori punti vita dedicati): zona centrale grande
 * divisa a metà: sinistra −1, destra +1 (come in Lotus). Ogni scheda è ruotata verso chi siede da quel lato
 * (180° di fronte, 90° ai lati lunghi), così legge dritto senza girare il telefono. High Roll (d20) per
 * decidere chi inizia.
 */
export default function LifeCounter({ players, startLife, resume, onEdit, onFinish }: LifeCounterProps) {
  useKeepScreenAwake();

  const [lives, setLives] = useState<LcPlayer[]>(
    players.map((name) => {
      const saved = resume?.[name];
      if (!saved) return { name, life: startLife, kill: false, mill: false, poisonOn: false, poison: 0, cmdrOn: false, tax: 0, cmdr: {} };
      const cmdr = { ...saved.commander?.damage };
      // Veleno o danno da comandante letali sono già contati come KILL nelle cause:
      // non accendo anche il KILL manuale, altrimenti resterebbe acceso dopo un annullamento.
      const lethalCmdr = Boolean(saved.commander) && Math.max(0, ...Object.values(cmdr)) >= CMDR_LIMIT;
      return {
        name,
        life: saved.life,
        kill: saved.loss.includes('kill') && saved.poison < POISON_LIMIT && !lethalCmdr,
        mill: saved.loss.includes('mill'),
        poisonOn: saved.poison > 0,
        poison: saved.poison,
        cmdrOn: Boolean(saved.commander),
        tax: saved.commander?.tax ?? 0,
        cmdr,
      };
    })
  );
  /** Scheda di cui è aperto il pannello opzioni (una alla volta). */
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  /** Popup delle opzioni di gioco (Modifica Partita, High Roll, Fine Partita). */
  const [menuOpen, setMenuOpen] = useState(false);
  const [highRollOpen, setHighRollOpen] = useState(false);
  const [rolls, setRolls] = useState<RollResult[]>([]);
  /** Cambia a ogni tiro, così i nomi si ricompongono anche con lo stesso esito. */
  const [rollId, setRollId] = useState(0);
  /** Esito dell'ultimo lancio della moneta (null: popup chiuso). */
  const [coin, setCoin] = useState<{ id: number; result: 'Testa' | 'Croce' } | null>(null);
  /** Cronologia dei cambi: vive solo durante la partita, non si salva. */
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const nextEntryId = useRef(1);
  /** Totale dei tocchi ravvicinati sui punti vita, per giocatore (indice in `lives`). */
  const [bursts, setBursts] = useState<Record<number, LifeBurst>>({});
  const burstTimers = useRef(new Map<number, number>());

  useEffect(() => {
    const timers = burstTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  /** Il totale sfuma: il prossimo tocco su questo giocatore parte da zero. */
  function endBurst(index: number) {
    window.clearTimeout(burstTimers.current.get(index));
    burstTimers.current.delete(index);
    setBursts((prev) => (prev[index]?.visible ? { ...prev, [index]: { ...prev[index], visible: false } } : prev));
  }

  function trackBurst(index: number, real: number) {
    setBursts((prev) => {
      const cur = prev[index];
      const delta = (cur?.visible ? cur.delta : 0) + real;
      // Tornati al punto di partenza: come in cronologia, il gruppo sparisce.
      if (delta === 0) return cur ? { ...prev, [index]: { ...cur, visible: false } } : prev;
      return { ...prev, [index]: { delta, taps: (cur?.taps ?? 0) + 1, visible: true } };
    });
    window.clearTimeout(burstTimers.current.get(index));
    burstTimers.current.set(index, window.setTimeout(() => endBurst(index), MERGE_WINDOW_MS));
  }

  /** Posto sullo schermo → giocatore (indice in `lives`): "Cambia posti" scambia due posti. */
  const [seats, setSeats] = useState(() => players.map((_, i) => i));
  /** Modalità "Cambia posti": i tocchi scelgono i riquadri invece di cambiare i punti. */
  const [swapping, setSwapping] = useState(false);
  const [swapFirst, setSwapFirst] = useState<number | null>(null);

  function pickSeat(seat: number) {
    if (swapFirst === null) {
      setSwapFirst(seat);
      return;
    }
    if (swapFirst !== seat) {
      setSeats((prev) => {
        const next = [...prev];
        [next[swapFirst], next[seat]] = [next[seat], next[swapFirst]];
        return next;
      });
    }
    setSwapFirst(null);
  }

  const count = lives.length;
  const options = LAYOUT_OPTIONS[count];
  const [layoutIndex, setLayoutIndex] = useState(() => readLayoutIndex(count));
  const layout = options ? options[layoutIndex] : defaultLayout(count);
  /** Il tasto opzioni (e "Fatto") sta dove si incontrano i riquadri, anche fuori dal centro. */
  const hubStyle: CSSProperties = layout.hubTop ? { top: layout.hubTop } : {};

  function nextLayout() {
    if (!options) return;
    const next = (layoutIndex + 1) % options.length;
    setLayoutIndex(next);
    rememberLayoutIndex(count, next);
  }

  /** Cambia un contatore e lo scrive nella cronologia (unendo i tocchi ravvicinati). */
  function change(index: number, field: CounterField, delta: number, source?: string) {
    // Durante "Cambia posti" i tocchi scelgono i posti, non cambiano i punti.
    if (swapping) return;
    const player = lives[index];
    const from = readField(player, field, source);
    const to = field === 'life' ? from + delta : Math.max(0, from + delta);
    const real = to - from;
    if (real === 0) return;
    setLives((prev) => prev.map((p, i) => (i === index ? writeField(p, field, source, to) : p)));
    if (field === 'life') trackBurst(index, real);
    const now = Date.now();
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.index === index && last.field === field && last.source === source && now - last.t < MERGE_WINDOW_MS) {
        const total = last.delta + real;
        return total === 0 ? prev.slice(0, -1) : [...prev.slice(0, -1), { ...last, t: now, delta: total, to }];
      }
      const entry: HistoryEntry = { id: nextEntryId.current++, t: now, index, name: player.name, field, source, delta: real, from, to };
      return [...prev.slice(-(MAX_HISTORY - 1)), entry];
    });
  }

  function adjust(index: number, delta: number) {
    change(index, 'life', delta);
  }

  /** Annulla l'ultima voce della cronologia, riportando il contatore com'era. */
  function undoLast() {
    const last = history[history.length - 1];
    if (!last) return;
    setLives((prev) =>
      prev.map((p, i) => (i === last.index ? writeField(p, last.field, last.source, last.from) : p))
    );
    setHistory((prev) => prev.slice(0, -1));
    if (last.field === 'life') endBurst(last.index);
  }

  function patchPlayer(index: number, patch: Partial<LcPlayer>) {
    setLives((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function flipCoin() {
    setCoin((prev) => ({ id: (prev?.id ?? 0) + 1, result: Math.random() < 0.5 ? 'Testa' : 'Croce' }));
  }

  function openHighRoll() {
    setRolls(rollHighRoll(lives.map((p) => p.name)));
    setRollId((id) => id + 1);
    setHighRollOpen(true);
  }

  /** Punteggi, cause di sconfitta, veleno e Comandante di ogni giocatore, per nome. */
  function snapshot(): Parameters<LifeCounterResult> {
    return [
      Object.fromEntries(lives.map((p) => [p.name, p.life])),
      Object.fromEntries(lives.map((p) => [p.name, lossCauses(p)])),
      Object.fromEntries(lives.map((p) => [p.name, p.poisonOn ? p.poison : 0])),
      Object.fromEntries(lives.filter((p) => p.cmdrOn).map((p) => [p.name, { tax: p.tax, damage: { ...p.cmdr } }])),
      seats.map((i) => lives[i].name),
    ];
  }

  const topRoll = rolls.length ? Math.max(...rolls.map((r) => r.roll)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="grid flex-1 gap-2.5"
        style={{ gridTemplateColumns: layout.columns, gridTemplateRows: layout.rows }}
      >
        {seats.map((i, seat) => {
          const p = lives[i];
          // Il colore segue il giocatore, la posizione e la rotazione seguono il posto.
          const color = PIE_COLORS[i % PIE_COLORS.length];
          const place = layout.places[seat];
          return (
            <div
              key={p.name + i}
              className="relative overflow-hidden rounded-2xl"
              style={{ background: color, containerType: 'size', ...place.cell }}
            >
              <div className="absolute" style={innerStyle(place.rotation)}>
              {swapping && (
                // Copre −/+ e opzioni: durante lo scambio i tocchi scelgono solo i posti.
                <button
                  type="button"
                  onClick={() => pickSeat(seat)}
                  style={TAP_HIGHLIGHT_OFF}
                  aria-label={swapFirst === null ? `Scegli ${p.name}` : swapFirst === seat ? `Annulla la scelta di ${p.name}` : `Scambia con ${p.name}`}
                  aria-pressed={swapFirst === seat}
                  className={cx(
                    'absolute inset-0 z-40 flex items-start justify-center rounded-2xl pt-[6%] text-[clamp(13px,2.8vw,17px)] font-semibold text-white',
                    swapFirst === seat ? 'border-4 border-white bg-black/35' : 'border-2 border-dashed border-white/70 bg-black/20'
                  )}
                >
                  <span className="rounded-full bg-black/55 px-3 py-1">
                    {swapFirst === null ? 'Tocca il primo giocatore' : swapFirst === seat ? 'Scelto: tocca con chi scambiarlo' : 'Tocca per scambiare'}
                  </span>
                </button>
              )}
              {/* Come in Lotus: metà sinistra = −1, metà destra = +1, su tutta
                  la scheda. Il simbolo sta vicino al bordo, il punteggio al centro. */}
              <div className="absolute inset-0 flex">
                <button
                  type="button"
                  onClick={() => adjust(i, -1)}
                  style={TAP_HIGHLIGHT_OFF}
                  aria-label={`${p.name}: togli 1 punto vita`}
                  className={tapClass('flex-1 justify-start pl-[8%] text-[clamp(28px,6vw,44px)] font-light')}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => adjust(i, 1)}
                  style={TAP_HIGHLIGHT_OFF}
                  aria-label={`${p.name}: aggiungi 1 punto vita`}
                  className={tapClass('flex-1 justify-end pr-[8%] text-[clamp(28px,6vw,44px)] font-light')}
                >
                  +
                </button>
              </div>

              {/* Opzioni giocatore (KILL / MILL / veleno): tasto in basso al centro,
                  sopra le due metà −1/+1. Il pannello sta DENTRO la scheda, quindi
                  ruota insieme a lei per chi siede dall'altra parte. */}
              <button
                type="button"
                onClick={() => setOptionsFor(i)}
                style={TAP_HIGHLIGHT_OFF}
                aria-label={`${p.name}: opzioni`}
                className="absolute bottom-2 left-1/2 z-10 flex h-[54px] w-[54px] -translate-x-1/2 select-none items-center justify-center rounded-full bg-black/25 text-[25px] leading-none text-white/85 active:bg-black/45"
              >
                ⋯
              </button>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p
                  className="mb-0.5 max-w-[85%] truncate text-[clamp(18px,3.4vw,28px)] font-semibold text-white/90"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,.4)' }}
                >
                  {p.name}
                </p>
                {(p.kill || p.mill || p.poisonOn || (p.cmdrOn && (p.tax > 0 || maxCommanderDamage(p) > 0))) && (
                  <p
                    className="mb-1 flex flex-wrap justify-center gap-x-2.5 text-[clamp(12px,2.6vw,17px)] font-bold uppercase tracking-wider text-white"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
                  >
                    {p.kill && <span>KILL</span>}
                    {p.mill && <span>MILL</span>}
                    {p.poisonOn && <span>POISON {p.poison}</span>}
                    {p.cmdrOn && p.tax > 0 && <span>TAX {p.tax}</span>}
                    {p.cmdrOn && maxCommanderDamage(p) > 0 && <span>CMD {maxCommanderDamage(p)}</span>}
                  </p>
                )}
                <div className="relative text-[clamp(40px,9vw,80px)]">
                  <p
                    className="text-[1em] font-bold leading-none tabular-nums text-white"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,.4)' }}
                  >
                    {p.life}
                  </p>
                  <LifeDelta burst={bursts[i]} />
                </div>
              </div>

              {optionsFor === i && (
                <div className="absolute inset-0 z-20 flex flex-col bg-black/85 px-4 pb-3 pt-3 text-white">
                  <div className={cx('flex min-h-0 flex-1 flex-col overflow-y-auto', NO_SCROLLBAR)}>
                  <div className="my-auto flex flex-col gap-2.5">
                  <label className="flex items-center justify-between gap-3 text-[13px] font-bold tracking-wider">
                    <span>KILL</span>
                    <span className="relative origin-right scale-[1.2]">
                      <input
                        type="checkbox"
                        checked={p.kill}
                        onChange={(e) => patchPlayer(i, { kill: e.target.checked })}
                        className="mtg-switch-input absolute h-0 w-0 opacity-0"
                      />
                      <span className="mtg-switch" />
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-[13px] font-bold tracking-wider">
                    <span>MILL</span>
                    <span className="relative origin-right scale-[1.2]">
                      <input
                        type="checkbox"
                        checked={p.mill}
                        onChange={(e) => patchPlayer(i, { mill: e.target.checked })}
                        className="mtg-switch-input absolute h-0 w-0 opacity-0"
                      />
                      <span className="mtg-switch" />
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-[13px] font-bold tracking-wider">
                    <span>POISON</span>
                    <span className="relative origin-right scale-[1.2]">
                      <input
                        type="checkbox"
                        checked={p.poisonOn}
                        onChange={(e) => patchPlayer(i, { poisonOn: e.target.checked })}
                        className="mtg-switch-input absolute h-0 w-0 opacity-0"
                      />
                      <span className="mtg-switch" />
                    </span>
                  </label>
                  {p.poisonOn && (
                    <div className="flex items-center justify-end">
                      <span className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => change(i, 'poison', -1)}
                          aria-label={`${p.name}: togli 1 segnalino veleno`}
                          className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-bold tabular-nums">
                          {p.poison}/{POISON_LIMIT}
                        </span>
                        <button
                          type="button"
                          onClick={() => change(i, 'poison', 1)}
                          aria-label={`${p.name}: aggiungi 1 segnalino veleno`}
                          className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                        >
                          +
                        </button>
                      </span>
                    </div>
                  )}
                  <label className="flex items-center justify-between gap-3 text-[13px] font-bold tracking-wider">
                    <span>COMMANDER</span>
                    <span className="relative origin-right scale-[1.2]">
                      <input
                        type="checkbox"
                        checked={p.cmdrOn}
                        onChange={(e) => patchPlayer(i, { cmdrOn: e.target.checked })}
                        className="mtg-switch-input absolute h-0 w-0 opacity-0"
                      />
                      <span className="mtg-switch" />
                    </span>
                  </label>
                  {p.cmdrOn && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 text-xs font-bold uppercase leading-tight tracking-wider">Tassa</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => change(i, 'tax', -TAX_STEP)}
                            aria-label={`${p.name}: togli 2 alla tassa del comandante`}
                            className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                          >
                            −
                          </button>
                          <span className="w-10 text-center text-sm font-bold tabular-nums" aria-label="Tassa del comandante">+{p.tax}</span>
                          <button
                            type="button"
                            onClick={() => change(i, 'tax', TAX_STEP)}
                            aria-label={`${p.name}: aggiungi 2 alla tassa del comandante`}
                            className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                          >
                            +
                          </button>
                        </span>
                      </div>
                      {lives.map((src, si) =>
                        si === i ? null : (
                          <div key={src.name + si} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 text-xs leading-tight">
                              <span className="block">Danno da</span>
                              <span className="block truncate font-bold">{src.name}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => change(i, 'cmdr', -1, src.name)}
                                aria-label={`${p.name}: togli 1 danno da comandante di ${src.name}`}
                                className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                              >
                                −
                              </button>
                              <span className="w-10 text-center text-sm font-bold tabular-nums">
                                {p.cmdr[src.name] ?? 0}/{CMDR_LIMIT}
                              </span>
                              <button
                                type="button"
                                onClick={() => change(i, 'cmdr', 1, src.name)}
                                aria-label={`${p.name}: aggiungi 1 danno da comandante di ${src.name}`}
                                className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                              >
                                +
                              </button>
                            </span>
                          </div>
                        )
                      )}
                    </>
                  )}
                  </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    onClick={() => setOptionsFor(null)}
                    className="mt-2"
                  >
                    Chiudi
                  </Button>
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Opzioni di gioco: un solo tasto al centro del tavolo (dove si incontrano i riquadri), senza testo,
          così si capisce da qualunque lato lo si guardi. Tra le schede (ogni
          giocatore ha la sua), non copre punteggi né nomi. */}
      {swapping && (
        <button
          type="button"
          onClick={() => { setSwapping(false); setSwapFirst(null); }}
          style={{ ...TAP_HIGHLIGHT_OFF, ...hubStyle }}
          className="absolute left-1/2 top-1/2 z-50 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-full border-2 border-white bg-black/85 text-base font-bold text-white shadow-lg active:bg-black"
        >
          Fatto
        </button>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        hidden={swapping}
        style={lives.length === 1 ? TAP_HIGHLIGHT_OFF : { ...TAP_HIGHLIGHT_OFF, ...hubStyle }}
        aria-label="Opzioni di gioco"
        className={`absolute z-30 flex h-[76px] w-[76px] select-none items-center justify-center rounded-full border border-white/30 bg-black/75 text-[40px] shadow-lg active:bg-black ${
          lives.length === 1
            ? 'bottom-3 left-1/2 -translate-x-1/2'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
      >
        ⚙️
      </button>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="grid max-h-[90vh] w-full max-w-sm grid-cols-2 gap-3 overflow-y-auto rounded-2xl border border-zaff-border bg-zaff-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tasti grandi e uguali, facili da toccare; l'ultimo occupa tutta la riga. */}
            <Button
              variant="ghost"
              className="flex h-16 flex-col gap-0.5 text-base"
              onClick={() => {
                setMenuOpen(false);
                openHighRoll();
              }}
            >
              <span className="text-2xl leading-none">🎲</span>
              High Roll
            </Button>
            <Button
              variant="ghost"
              className="flex h-16 flex-col gap-0.5 text-base"
              onClick={() => {
                setMenuOpen(false);
                flipCoin();
              }}
            >
              <span className="text-2xl leading-none">🪙</span>
              Moneta
            </Button>
            <Button variant="ghost" className="flex h-16 text-base" onClick={() => { setMenuOpen(false); setHistoryOpen(true); }}>
              Cronologia
            </Button>
            <Button variant="ghost" className="flex h-16 text-base" disabled={history.length === 0} onClick={() => { undoLast(); setMenuOpen(false); }}>
              Annulla Ultimo
            </Button>
            {options && options.length > 1 && (
              <Button
                variant="ghost"
                className="flex h-16 flex-col gap-0 text-base"
                onClick={() => { nextLayout(); setMenuOpen(false); }}
              >
                Disposizione
                {/* Cosa succede premendo: passa all'altra disposizione (quella attuale si vede già). */}
                <span className="text-xs font-normal opacity-70">passa a {options[(layoutIndex + 1) % options.length].label}</span>
              </Button>
            )}
            {lives.length > 1 && (
              <Button variant="ghost" className="flex h-16 text-base" onClick={() => { setMenuOpen(false); setOptionsFor(null); setSwapping(true); }}>
                Cambia posti
              </Button>
            )}
            <Button variant="ghost" className="flex h-16 text-base" onClick={() => onEdit(...snapshot())}>
              Modifica Partita
            </Button>
            <Button className="flex h-16 text-base" onClick={() => onFinish(...snapshot())}>
              Fine Partita
            </Button>
            {/* "Torna al Gioco" occupa tutta la riga quando i tasti sono dispari. */}
            <Button
              variant="ghost"
              className={cx('flex h-16 text-base', (7 + (options && options.length > 1 ? 1 : 0) + (lives.length > 1 ? 1 : 0)) % 2 === 1 && 'col-span-2')}
              onClick={() => setMenuOpen(false)}
            >
              Torna al Gioco
            </Button>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl border border-zaff-border bg-zaff-surface p-5 shadow-xl">
            <h2 className={HEADING_SECTION}>Cronologia</h2>
            <p className="mb-3 text-xs text-zaff-muted">Solo durante questa partita: non viene salvata.</p>
            {history.length === 0 ? (
              <p className="mb-4 text-sm text-zaff-muted">Ancora nessun cambio.</p>
            ) : (
              <ul className="mb-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {[...history].reverse().map((e) => (
                  <li key={e.id} className="text-sm text-zaff-text">
                    <span className="text-zaff-muted">
                      {new Date(e.t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>{' '}
                    <b>{e.name}</b> · {historyLabel(e)}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" disabled={history.length === 0} onClick={undoLast}>
                Annulla Ultimo
              </Button>
              <Button className="flex-1" onClick={() => setHistoryOpen(false)}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}

      {coin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-zaff-border bg-zaff-surface p-6 text-center shadow-xl">
            <h2 className={HEADING_SECTION}>🪙 Moneta</h2>
            <p className="my-5" role="status">
              <span className="sr-only">{coin.result}</span>
              <MatrixText key={coin.id} text={coin.result} uppercase className="flex justify-center gap-1.5 font-mono text-5xl font-bold" />
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={flipCoin}>
                Lancia di Nuovo
              </Button>
              <Button className="flex-1" onClick={() => setCoin(null)}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}

      {highRollOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zaff-border bg-zaff-surface p-6 shadow-xl">
            <h2 className={HEADING_SECTION}>🎲 High Roll</h2>
            <p className="mb-3 text-xs text-zaff-muted">Tiro 1–20: il numero più alto inizia.</p>
            <ul className="mb-4 space-y-1">
              {rolls.map((r) => (
                <li key={`${rollId}-${r.name}`} className="flex items-center justify-between gap-2 text-base text-zaff-text">
                  <span className="min-w-0 truncate">
                    <span className="sr-only">{r.name}</span>
                    <MatrixText text={r.name} className="font-mono" />
                    {r.roll === topRoll ? ' 🏆' : ''}
                  </span>
                  <span className="shrink-0 text-lg font-bold">{r.roll}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => { setRolls(rollHighRoll(lives.map((p) => p.name))); setRollId((id) => id + 1); }}>
                Tira di Nuovo
              </Button>
              <Button className="flex-1" onClick={() => setHighRollOpen(false)}>
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
