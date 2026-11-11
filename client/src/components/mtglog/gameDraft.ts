import type { LossCause } from './GameList';
import type { CommanderCount } from './LifeCounter';

/**
 * Copia della partita nuova in corso, solo su questo dispositivo: se l'app si chiude
 * prima del salvataggio, la partita si riprende da qui ("Partita non salvata").
 * Nasce quando parte il segna-punti e sparisce al salvataggio o quando si esce
 * scegliendo di non salvare. Mai bloccante: senza storage semplicemente non c'è.
 */
const DRAFT_KEY = 'mtglog:gameDraft';

export interface DraftPlayer {
  name: string;
  deckMode: 'select' | 'manual';
  deckSelect: string;
  deckManual: string;
  desc: string;
  life: string;
  winner: boolean;
  colors: string[];
  loss: LossCause[];
  poison: number;
  /** Danni da comandante per NOME di chi li ha inflitti (nell'editor sono per riga). */
  commander?: CommanderCount;
}

export interface GameDraft {
  /** Quando è stata aggiornata l'ultima volta (millisecondi). */
  savedAt: number;
  startedAt: string;
  format: string;
  notes: string;
  startLife: number;
  players: DraftPlayer[];
  /** Il segna-punti era aperto: riprendendo si riapre da dove era. */
  counterOpen: boolean;
}

const isString = (v: unknown): v is string => typeof v === 'string';

function readPlayer(v: unknown): DraftPlayer | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (!isString(p.name)) return null;
  const commander = p.commander as CommanderCount | undefined;
  return {
    name: p.name,
    deckMode: p.deckMode === 'manual' ? 'manual' : 'select',
    deckSelect: isString(p.deckSelect) ? p.deckSelect : '',
    deckManual: isString(p.deckManual) ? p.deckManual : '',
    desc: isString(p.desc) ? p.desc : '',
    life: isString(p.life) ? p.life : '',
    winner: p.winner === true,
    colors: Array.isArray(p.colors) ? p.colors.filter(isString) : [],
    loss: Array.isArray(p.loss) ? p.loss.filter((c): c is LossCause => c === 'kill' || c === 'mill') : [],
    poison: typeof p.poison === 'number' && p.poison > 0 ? p.poison : 0,
    ...(commander && typeof commander.tax === 'number' && commander.damage && typeof commander.damage === 'object'
      ? { commander: { tax: commander.tax, damage: { ...commander.damage } } }
      : {}),
  };
}

export function readGameDraft(): GameDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<GameDraft>;
    const players = Array.isArray(v.players) ? v.players.map(readPlayer) : [];
    if (!players.length || players.some((p) => !p) || typeof v.savedAt !== 'number' || !isString(v.startedAt)) return null;
    return {
      savedAt: v.savedAt,
      startedAt: v.startedAt,
      format: isString(v.format) ? v.format : '',
      notes: isString(v.notes) ? v.notes : '',
      startLife: typeof v.startLife === 'number' && v.startLife >= 1 ? v.startLife : 20,
      players: players as DraftPlayer[],
      counterOpen: v.counterOpen === true,
    };
  } catch {
    return null;
  }
}

export function writeGameDraft(draft: GameDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage non disponibile o pieno: pazienza */
  }
}

export function clearGameDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage non disponibile: pazienza */
  }
}

/** Nomi dei giocatori della copia, per riconoscerla ("Anna, Marco e Luca"). */
export function draftPlayerNames(draft: GameDraft): string[] {
  return draft.players.map((p) => p.name.trim()).filter(Boolean);
}
