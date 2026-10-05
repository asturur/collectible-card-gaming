import { useState } from 'react';
import Button from '../ui/Button';
import { PIE_COLORS } from './stats';
import { HEADING_SECTION } from '../ui/styles';
import type { LossCause } from './GameList';

interface LifeCounterProps {
  players: string[];
  startLife: number;
  onCancel: () => void;
  onFinish: (lives: Record<string, number>, causes: Record<string, LossCause[]>) => void;
}

interface LcPlayer {
  name: string;
  life: number;
  kill: boolean;
  mill: boolean;
  /** Il contatore veleno compare solo se acceso dalle opzioni del giocatore. */
  poisonOn: boolean;
  poison: number;
}

/** Con 10 o più segnalini veleno si perde. */
const POISON_LIMIT = 10;

/** Come ha perso, da salvare con la partita: il veleno conta come KILL. */
function lossCauses(p: LcPlayer): LossCause[] {
  const causes: LossCause[] = [];
  if (p.kill || (p.poisonOn && p.poison >= POISON_LIMIT)) causes.push('kill');
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
export default function LifeCounter({ players, startLife, onCancel, onFinish }: LifeCounterProps) {
  const [lives, setLives] = useState<LcPlayer[]>(
    players.map((name) => ({ name, life: startLife, kill: false, mill: false, poisonOn: false, poison: 0 }))
  );
  /** Scheda di cui è aperto il pannello opzioni (una alla volta). */
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  const [highRollOpen, setHighRollOpen] = useState(false);
  const [rolls, setRolls] = useState<RollResult[]>([]);

  const cols = gridColumns(lives.length);
  const rows = Math.ceil(lives.length / cols);

  function adjust(index: number, delta: number) {
    setLives((prev) => prev.map((p, i) => (i === index ? { ...p, life: p.life + delta } : p)));
  }

  function patchPlayer(index: number, patch: Partial<LcPlayer>) {
    setLives((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function openHighRoll() {
    setRolls(rollHighRoll(lives.map((p) => p.name)));
    setHighRollOpen(true);
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
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
        <Button variant="ghost" onClick={openHighRoll}>
          🎲 High Roll
        </Button>
        <Button
          onClick={() =>
            onFinish(
              Object.fromEntries(lives.map((p) => [p.name, p.life])),
              Object.fromEntries(lives.map((p) => [p.name, lossCauses(p)]))
            )
          }
        >
          Fine Partita
        </Button>
      </div>

      <div
        className="grid flex-1 gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {lives.map((p, i) => {
          const color = PIE_COLORS[i % PIE_COLORS.length];
          const rotated = shouldRotate(i, cols, rows);
          return (
            <div
              key={p.name + i}
              className="relative overflow-hidden rounded-2xl"
              style={{ background: color, transform: rotated ? 'rotate(180deg)' : undefined }}
            >
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
                className="absolute bottom-2 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 select-none items-center justify-center rounded-full bg-black/25 text-lg text-white/85 active:bg-black/45"
              >
                ⚙️
              </button>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p
                  className="mb-0.5 max-w-[85%] truncate text-[clamp(18px,3.4vw,28px)] font-semibold text-white/90"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,.4)' }}
                >
                  {p.name}
                </p>
                {(p.kill || p.mill || p.poisonOn) && (
                  <p
                    className="mb-1 flex flex-wrap justify-center gap-x-2.5 text-[clamp(12px,2.6vw,17px)] font-bold uppercase tracking-wider text-white"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
                  >
                    {p.kill && <span>KILL</span>}
                    {p.mill && <span>MILL</span>}
                    {p.poisonOn && <span>POISON {p.poison}</span>}
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
                <div className="absolute inset-0 z-20 flex flex-col justify-center gap-2 bg-black/85 px-4 py-3 text-white">
                  <label className="flex items-center justify-between gap-3 text-[15px] font-bold tracking-wider">
                    <span>KILL</span>
                    <span className="relative">
                      <input
                        type="checkbox"
                        checked={p.kill}
                        onChange={(e) => patchPlayer(i, { kill: e.target.checked })}
                        className="mtg-switch-input absolute h-0 w-0 opacity-0"
                      />
                      <span className="mtg-switch" />
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-[15px] font-bold tracking-wider">
                    <span>MILL</span>
                    <span className="relative">
                      <input
                        type="checkbox"
                        checked={p.mill}
                        onChange={(e) => patchPlayer(i, { mill: e.target.checked })}
                        className="mtg-switch-input absolute h-0 w-0 opacity-0"
                      />
                      <span className="mtg-switch" />
                    </span>
                  </label>
                  <label className="flex items-center justify-between gap-3 text-[15px] font-bold tracking-wider">
                    <span>VELENO</span>
                    <span className="relative">
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
                        onClick={() => patchPlayer(i, { poison: Math.max(0, p.poison - 1) })}
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
                        onClick={() => patchPlayer(i, { poison: p.poison + 1 })}
                        aria-label={`${p.name}: aggiungi 1 segnalino veleno`}
                        className="h-10 w-10 rounded-lg border border-white/30 text-xl active:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setOptionsFor(null)}
                    className="mt-1 rounded-lg border border-white/30 py-2 text-sm font-semibold active:bg-white/20"
                  >
                    Chiudi
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
