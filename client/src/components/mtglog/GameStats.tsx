import { useEffect, useMemo, useState } from 'react';
import { subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES } from '../../services/supabase';
import type { Game } from './GameList';
import { rowToGame } from './stats';
import Badge from '../ui/Badge';
import {
  ExportButton,
  ExportCardHost,
  ExportedImage,
  ExportHeader,
  todayIso,
  todayLabel,
  useImageExport,
} from './ImageExport';
import { cx, FIELD_LABEL, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface DeckSourceRow {
  name: string;
  source: string;
}

interface DeckStatRow {
  deck: string;
  g: number;
  w: number;
  pct: number;
  source: string;
}

/** Percentuale di vittoria per mazzo, volutamente su TUTTE le partite di tutti
 *  i gruppi: le statistiche di un mazzo non dipendono da con chi l'hai giocato. */
function computeDeckStats(games: Game[], decks: DeckSourceRow[]): DeckStatRow[] {
  const sourceByName = new Map(decks.map((d) => [d.name, d.source || '']));
  const tally: Record<string, { g: number; w: number }> = {};
  games.forEach((g) =>
    g.players.forEach((p) => {
      const deck = (p.deck || '').trim();
      if (!deck) return;
      tally[deck] = tally[deck] || { g: 0, w: 0 };
      tally[deck].g++;
      if (p.winner) tally[deck].w++;
    })
  );
  return Object.entries(tally).map(([deck, t]) => ({
    deck,
    g: t.g,
    w: t.w,
    pct: t.g ? Math.round((t.w / t.g) * 100) : 0,
    source: sourceByName.get(deck) || '',
  }));
}

type DeckSort = 'winrate' | 'games';

const SORT_OPTIONS: { value: DeckSort; label: string }[] = [
  { value: 'winrate', label: '% di vittoria' },
  { value: 'games', label: 'Partite giocate' },
];

/** Barra della percentuale di vittoria: sfumatura rosso → verde che copre
 *  tutta la scala (rosso puro = 0%, verde puro = 100%); la parte riempita
 *  mostra solo il tratto fino alla percentuale del mazzo, quindi il colore
 *  in punta dice a colpo d'occhio se il mazzo va bene. */
const WIN_GRADIENT = 'linear-gradient(to right, #ef4444, #facc15, #22c55e)';

function WinRateBar({ pct }: { pct: number }) {
  return (
    <div className="h-[9px] overflow-hidden rounded bg-zaff-bg">
      <div
        className="h-full rounded"
        style={{
          width: `${pct}%`,
          backgroundImage: WIN_GRADIENT,
          backgroundSize: `${pct > 0 ? 10000 / pct : 100}% 100%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

/** Un mazzo, su tre righe: nome / origine + partite, vittorie, % / barra. */
function DeckRow({ r }: { r: DeckStatRow }) {
  return (
    <div className="border-b border-zaff-border py-3 last:border-b-0">
      <b className="block break-words text-[16px] font-semibold text-zaff-text">{r.deck}</b>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-zaff-muted">
        {r.source && <Badge tone={r.source === 'brew' ? 'brew' : 'precon'}>{r.source === 'brew' ? 'Homebrew' : 'Precon'}</Badge>}
        <span>
          {r.g} partite · {r.w} vittorie · {r.pct}%
        </span>
      </div>
      <div className="mt-2">
        <WinRateBar pct={r.pct} />
      </div>
    </div>
  );
}

/** Elenco mazzi: lo stesso identico a schermo e nell'immagine esportata. */
function DeckStatsList({ rows }: { rows: DeckStatRow[] }) {
  if (rows.length === 0) return <p className={TEXT_MINI}>Nessun mazzo con partite registrate.</p>;
  return (
    <div>
      {rows.map((r) => (
        <DeckRow key={r.deck} r={r} />
      ))}
    </div>
  );
}

/**
 * Statistiche mazzi: due tasti per l'ordinamento (percentuale di vittoria o
 * partite giocate) e l'elenco dei mazzi con la barra della percentuale di
 * vittoria; esportabile in immagine.
 * Va mostrata dentro un `Modal` (la classifica giocatori ha la sua schermata).
 */
export default function GameStats() {
  const [games, setGames] = useState<Game[]>([]);
  const [decks, setDecks] = useState<DeckSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<DeckSort>('winrate');
  const exporter = useImageExport();

  async function loadData() {
    if (!supabase) return;
    const [{ data: gameRows, error: gameError }, { data: deckRows, error: deckError }] = await Promise.all([
      supabase.from(TABLE_GAMES).select('*'),
      supabase.from(TABLE_DECKS).select('name, source'),
    ]);
    if (gameError || deckError) {
      setError('Non riesco a leggere le statistiche: ' + (gameError?.message || deckError?.message));
      return;
    }
    setGames((gameRows ?? []).map(rowToGame));
    setDecks((deckRows ?? []).map((row) => ({ name: row.name, source: row.source ?? '' })));
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadData().finally(() => setLoading(false));
    const unsubGames = subscribeToTable(TABLE_GAMES, loadData);
    const unsubDecks = subscribeToTable(TABLE_DECKS, loadData);
    return () => {
      unsubGames();
      unsubDecks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deckStats = useMemo(() => computeDeckStats(games, decks), [games, decks]);

  const rows = [...deckStats].sort((a, b) =>
    sort === 'games' ? b.g - a.g || b.pct - a.pct : b.pct - a.pct || b.g - a.g
  );

  if (loading) {
    return <p className={TEXT_MUTED}>Caricamento…</p>;
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '';

  return (
    <>
      <span className={cx(FIELD_LABEL, 'mt-3.5')}>Ordina per</span>
      <div className="mb-3.5 grid grid-cols-2 gap-2.5">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setSort(o.value)}
            aria-pressed={sort === o.value}
            className={cx(
              'rounded-lg border py-3.5 text-[15px] font-semibold transition',
              sort === o.value
                ? 'border-zaff-text bg-zaff-text text-zaff-bg'
                : 'border-zaff-border bg-transparent text-zaff-muted active:border-zaff-muted active:text-zaff-text'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <DeckStatsList rows={rows} />

      <div className="mt-4">
        <ExportButton
          exporting={exporter.exporting}
          onClick={() =>
            exporter.exportImage({
              fileName: `statistiche_mazzi_${todayIso()}.jpg`,
              shareTitle: 'Statistiche Mazzi',
              shareText: 'Statistiche mazzi del registro partite di Magic',
            })
          }
        />
      </div>
      <ExportedImage image={exporter.image} error={exporter.error} alt="Statistiche mazzi, da salvare" />

      <ExportCardHost cardRef={exporter.cardRef}>
        <ExportHeader
          title="Statistiche Mazzi"
          subtitle={`Percentuale di vittoria di ogni mazzo · ordinati per ${sortLabel.toLowerCase()} · aggiornato al ${todayLabel()}`}
        />
        <DeckStatsList rows={rows} />
      </ExportCardHost>

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
