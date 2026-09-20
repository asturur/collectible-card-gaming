import { useState } from 'react';
import Button from '../ui/Button';
import { HEADING_SECTION } from '../ui/styles';

interface LifeCounterProps {
  players: string[];
  startLife: number;
  onCancel: () => void;
  onFinish: (lives: Record<string, number>) => void;
}

interface LcPlayer {
  name: string;
  life: number;
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

/** Contatore punti vita a tutto schermo: griglia con stepper a 4 zone d'angolo
 *  (-5/+5/-1/+1) per giocatore, più High Roll (d20) per decidere chi inizia. */
export default function LifeCounter({ players, startLife, onCancel, onFinish }: LifeCounterProps) {
  const [lives, setLives] = useState<LcPlayer[]>(players.map((name) => ({ name, life: startLife })));
  const [highRollOpen, setHighRollOpen] = useState(false);
  const [rolls, setRolls] = useState<RollResult[]>([]);

  const cols = gridColumns(lives.length);

  function adjust(index: number, delta: number) {
    setLives((prev) => prev.map((p, i) => (i === index ? { ...p, life: p.life + delta } : p)));
  }

  function openHighRoll() {
    setRolls(rollHighRoll(lives.map((p) => p.name)));
    setHighRollOpen(true);
  }

  const topRoll = rolls.length ? Math.max(...rolls.map((r) => r.roll)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zaff-bg p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
        <Button variant="ghost" onClick={openHighRoll}>
          🎲 High Roll
        </Button>
        <Button onClick={() => onFinish(Object.fromEntries(lives.map((p) => [p.name, p.life])))}>
          Fine partita
        </Button>
      </div>

      <div
        className="grid flex-1 gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${Math.ceil(lives.length / cols)}, 1fr)` }}
      >
        {lives.map((p, i) => (
          <div key={p.name + i} className="relative overflow-hidden rounded-xl border border-zaff-border bg-zaff-surface">
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <button
                type="button"
                onClick={() => adjust(i, -5)}
                className="border-b border-r border-zaff-border text-[clamp(16px,3vw,24px)] text-zaff-muted transition-colors active:bg-zaff-gold/25 active:text-zaff-gold"
              >
                −5
              </button>
              <button
                type="button"
                onClick={() => adjust(i, 5)}
                className="border-b border-zaff-border text-[clamp(16px,3vw,24px)] text-zaff-muted transition-colors active:bg-zaff-gold/25 active:text-zaff-gold"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => adjust(i, -1)}
                className="border-r border-zaff-border text-[clamp(16px,3vw,24px)] text-zaff-muted transition-colors active:bg-zaff-gold/25 active:text-zaff-gold"
              >
                −1
              </button>
              <button
                type="button"
                onClick={() => adjust(i, 1)}
                className="text-[clamp(16px,3vw,24px)] text-zaff-muted transition-colors active:bg-zaff-gold/25 active:text-zaff-gold"
              >
                +1
              </button>
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="mb-0.5 text-[clamp(13px,2vw,17px)] text-zaff-muted">{p.name}</p>
              <p className="text-[clamp(34px,8vw,72px)] font-semibold leading-none tabular-nums text-zaff-text">{p.life}</p>
            </div>
          </div>
        ))}
      </div>

      {highRollOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-zaff-border bg-zaff-surface p-6 shadow-xl">
            <h2 className={HEADING_SECTION}>🎲 High Roll</h2>
            <p className="mb-3 text-xs text-zaff-muted">Tiro 1–20: il numero più alto inizia.</p>
            <ul className="mb-4 space-y-1">
              {rolls.map((r) => (
                <li key={r.name} className="flex items-center justify-between text-sm text-zaff-text">
                  <span>
                    {r.name}
                    {r.roll === topRoll ? ' 🏆' : ''}
                  </span>
                  <span>{r.roll}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setRolls(rollHighRoll(lives.map((p) => p.name)))}>
                Tira di nuovo
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
