import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Button from '../ui/Button';
import { PIE_COLORS } from './stats';
import { cx, HEADING_SECTION } from '../ui/styles';
import type { LossCause } from './GameList';

/** Stato salvato di un giocatore, per riprendere una partita già registrata. */
export interface LifeCounterResume {
  life: number;
  loss: LossCause[];
  poison: number;
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
  poisons: Record<string, number>
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

/** Tocchi ravvicinati sullo stesso contatore diventano una sola voce (altrimenti 40 righe di +1). */
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

/** Disposizione dei segna-punti con 4 giocatori. */
type CounterLayout = 'rows' | 'cross' | 'sides';

const LAYOUTS: CounterLayout[] = ['rows', 'cross', 'sides'];
const LAYOUT_LABELS: Record<CounterLayout, string> = {
  rows: 'Due per lato',
  cross: 'A croce',
  sides: 'Ai lati',
};
const LAYOUT_KEY = 'mtglog:counterLayout';

function readLayout(): CounterLayout {
  try {
    const value = localStorage.getItem(LAYOUT_KEY);
    return LAYOUTS.find((l) => l === value) ?? 'rows';
  } catch {
    return 'rows';
  }
}

function rememberLayout(value: CounterLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, value);
  } catch {
    /* storage non disponibile: pazienza */
  }
}

interface Placement {
  /** Posizione nella griglia (solo per la disposizione a croce). */
  cell: CSSProperties;
  /** Gradi di rotazione: chi siede da quel lato legge dritto. */
  rotation: 0 | 90 | 180 | -90;
}

/** Dove va la scheda `i` e di quanto è ruotata. Giocatori in senso orario dal basso. */
function placementFor(layout: CounterLayout, i: number, cols: number, rows: number): Placement {
  if (layout === 'cross') {
    return [
      { cell: { gridColumn: '1 / span 2', gridRow: 3 }, rotation: 0 as const },
      { cell: { gridColumn: 1, gridRow: 2 }, rotation: 90 as const },
      { cell: { gridColumn: '1 / span 2', gridRow: 1 }, rotation: 180 as const },
      { cell: { gridColumn: 2, gridRow: 2 }, rotation: -90 as const },
    ][i];
  }
  if (layout === 'sides') return { cell: {}, rotation: i % 2 === 0 ? 90 : -90 };
  return { cell: {}, rotation: shouldRotate(i, cols, rows) ? 180 : 0 };
}

/** Il contenuto della scheda ruota dentro la scheda: di 90° scambia larghezza e altezza (unità del contenitore). */
function innerStyle(rotation: Placement['rotation']): CSSProperties {
  if (rotation === 0) return { left: 0, top: 0, width: '100%', height: '100%' };
  if (rotation === 180) return { left: 0, top: 0, width: '100%', height: '100%', transform: 'rotate(180deg)' };
  return { left: '50%', top: '50%', width: '100cqh', height: '100cqw', transform: `translate(-50%, -50%) rotate(${rotation}deg)` };
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
 * Contatore punti vita a tutto schermo. Scheda a colore pieno per ciascun
 * giocatore (come nei contatori punti vita dedicati): zona centrale grande
 * divisa a metà: sinistra −1, destra +1 (come in Lotus). Chi siede dal lato opposto del tavolo vede la propria scheda ruotata
 * di 180°, così legge dritto senza girare il telefono. High Roll (d20) per
 * decidere chi inizia.
 */
export default function LifeCounter({ players, startLife, resume, onEdit, onFinish }: LifeCounterProps) {
  useKeepScreenAwake();

  const [lives, setLives] = useState<LcPlayer[]>(
    players.map((name) => {
      const saved = resume?.[name];
      if (!saved) return { name, life: startLife, kill: false, mill: false, poisonOn: false, poison: 0, cmdrOn: false, tax: 0, cmdr: {} };
      // Il veleno letale è già contato come KILL nelle cause: non lo accendo due volte.
      return {
        name,
        life: saved.life,
        kill: saved.loss.includes('kill') && saved.poison < POISON_LIMIT,
        mill: saved.loss.includes('mill'),
        poisonOn: saved.poison > 0,
        poison: saved.poison,
        cmdrOn: false,
        tax: 0,
        cmdr: {},
      };
    })
  );
  /** Scheda di cui è aperto il pannello opzioni (una alla volta). */
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  /** Popup delle opzioni di gioco (Modifica Partita, High Roll, Fine Partita). */
  const [menuOpen, setMenuOpen] = useState(false);
  const [highRollOpen, setHighRollOpen] = useState(false);
  const [rolls, setRolls] = useState<RollResult[]>([]);
  /** Esito dell'ultimo lancio della moneta (null: popup chiuso). */
  const [coin, setCoin] = useState<'Testa' | 'Croce' | null>(null);
  /** Cronologia dei cambi: vive solo durante la partita, non si salva. */
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const nextEntryId = useRef(1);

  const four = lives.length === 4;
  const [layoutChoice, setLayoutChoice] = useState<CounterLayout>(readLayout);
  const layout: CounterLayout = four ? layoutChoice : 'rows';
  const cols = layout === 'rows' ? gridColumns(lives.length) : 2;
  const rows = layout === 'cross' ? 3 : Math.ceil(lives.length / cols);

  function nextLayout() {
    const next = LAYOUTS[(LAYOUTS.indexOf(layoutChoice) + 1) % LAYOUTS.length];
    setLayoutChoice(next);
    rememberLayout(next);
  }

  /** Cambia un contatore e lo scrive nella cronologia (unendo i tocchi ravvicinati). */
  function change(index: number, field: CounterField, delta: number, source?: string) {
    const player = lives[index];
    const from = readField(player, field, source);
    const to = field === 'life' ? from + delta : Math.max(0, from + delta);
    const real = to - from;
    if (real === 0) return;
    setLives((prev) => prev.map((p, i) => (i === index ? writeField(p, field, source, to) : p)));
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
  }

  function patchPlayer(index: number, patch: Partial<LcPlayer>) {
    setLives((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function flipCoin() {
    setCoin(Math.random() < 0.5 ? 'Testa' : 'Croce');
  }

  function openHighRoll() {
    setRolls(rollHighRoll(lives.map((p) => p.name)));
    setHighRollOpen(true);
  }

  /** Punteggi, cause di sconfitta e veleno di ogni giocatore, per nome. */
  function snapshot(): Parameters<LifeCounterResult> {
    return [
      Object.fromEntries(lives.map((p) => [p.name, p.life])),
      Object.fromEntries(lives.map((p) => [p.name, lossCauses(p)])),
      Object.fromEntries(lives.map((p) => [p.name, p.poisonOn ? p.poison : 0])),
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
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: layout === 'cross' ? '1fr 1.35fr 1fr' : `repeat(${rows}, 1fr)` }}
      >
        {lives.map((p, i) => {
          const color = PIE_COLORS[i % PIE_COLORS.length];
          const place = placementFor(layout, i, cols, rows);
          return (
            <div
              key={p.name + i}
              className="relative overflow-hidden rounded-2xl"
              style={{ background: color, containerType: 'size', ...place.cell }}
            >
              <div className="absolute" style={innerStyle(place.rotation)}>
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
                className="absolute bottom-2 left-1/2 z-10 flex h-[60px] w-[60px] -translate-x-1/2 select-none items-center justify-center rounded-full bg-black/25 text-[27px] leading-none text-white/85 active:bg-black/45"
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
                <p
                  className="text-[clamp(40px,9vw,80px)] font-bold leading-none tabular-nums text-white"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,.4)' }}
                >
                  {p.life}
                </p>
              </div>

              {optionsFor === i && (
                <div className="absolute inset-0 z-20 flex flex-col bg-black/85 px-4 pb-3 pt-3 text-white">
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <div className="my-auto flex flex-col gap-3">
                  <label className="flex items-center justify-between gap-3 text-[18px] font-bold tracking-wider">
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
                  <label className="flex items-center justify-between gap-3 text-[18px] font-bold tracking-wider">
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
                  <label className="flex items-center justify-between gap-3 text-[18px] font-bold tracking-wider">
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
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => change(i, 'poison', -1)}
                        aria-label={`${p.name}: togli 1 segnalino veleno`}
                        className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                      >
                        −
                      </button>
                      <span className="text-lg font-bold tabular-nums">
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
                    </div>
                  )}
                  <label className="flex items-center justify-between gap-3 text-[18px] font-bold tracking-wider">
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
                        <span className="text-sm font-bold uppercase tracking-wider">Tassa +{p.tax}</span>
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => change(i, 'tax', -TAX_STEP)}
                            aria-label={`${p.name}: togli 2 alla tassa del comandante`}
                            className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                          >
                            −
                          </button>
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
                            <span className="min-w-0 truncate text-sm">Danno da {src.name}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => change(i, 'cmdr', -1, src.name)}
                                aria-label={`${p.name}: togli 1 danno da comandante di ${src.name}`}
                                className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                              >
                                −
                              </button>
                              <span className="w-10 text-center text-lg font-bold tabular-nums">
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
                    size="lg"
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

      {/* Opzioni di gioco: un solo tasto al centro del tavolo, senza testo,
          così si capisce da qualunque lato lo si guardi. Tra le schede (ogni
          giocatore ha la sua), non copre punteggi né nomi. */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        style={TAP_HIGHLIGHT_OFF}
        aria-label="Opzioni di gioco"
        className={`absolute z-30 flex h-[84px] w-[84px] select-none items-center justify-center rounded-full border border-white/30 bg-black/75 text-[40px] shadow-lg active:bg-black ${
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
            {four && (
              <Button
                variant="ghost"
                className="flex h-16 flex-col gap-0 text-base"
                onClick={() => { nextLayout(); setMenuOpen(false); }}
              >
                Disposizione
                <span className="text-xs font-normal opacity-70">{LAYOUT_LABELS[layoutChoice]}</span>
              </Button>
            )}
            <Button variant="ghost" className="flex h-16 text-base" onClick={() => onEdit(...snapshot())}>
              Modifica Partita
            </Button>
            <Button className="flex h-16 text-base" onClick={() => onFinish(...snapshot())}>
              Fine Partita
            </Button>
            <Button variant="ghost" className={cx('flex h-16 text-base', !four && 'col-span-2')} onClick={() => setMenuOpen(false)}>
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
            <p className="my-5 text-5xl font-bold text-zaff-text" role="status">{coin}</p>
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
          <div className="w-full max-w-xs rounded-2xl border border-zaff-border bg-zaff-surface p-6 shadow-xl">
            <h2 className={HEADING_SECTION}>🎲 High Roll</h2>
            <p className="mb-3 text-xs text-zaff-muted">Tiro 1–20: il numero più alto inizia.</p>
            <ul className="mb-4 space-y-1">
              {rolls.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-2 text-sm text-zaff-text">
                  <span className="min-w-0 truncate">
                    {r.name}
                    {r.roll === topRoll ? ' 🏆' : ''}
                  </span>
                  <span className="shrink-0">{r.roll}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setRolls(rollHighRoll(lives.map((p) => p.name)))}>
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
