import { useMemo } from 'react';
import { Link } from 'react-router';
import { paths } from '../../router';
import type { Game } from './GameList';
import { makeDeckResolver, type DeckRef } from './deckRefs';
import type { TallyRow } from './stats';
import { PIE_COLORS, pieSlicePath } from './stats';
import GlossyPie from './GlossyPie';
import {
  ShareBar,
  ExportCardHost,
  ExportedImage,
  ExportHeader,
  safeFileName,
  todayIso,
  todayLabel,
  useImageExport,
} from './ImageExport';
import { cx, HEADING_SECTION, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface StandingsProps {
  rows: TallyRow[];
  /** La torta compare solo quando si guarda un gruppo preciso, come nell'originale. */
  showPie: boolean;
}

const WIN_COLOR = '#f5c451'; // zaff-gold
const LOSS_COLOR = '#334155'; // zaff-border

/** Mini-torta vinte/perse per la riga di un giocatore nell'elenco: stessi
 *  due colori (oro = vinte, grigio = perse) della torta grande nel suo
 *  dettaglio, per restare coerenti anche in piccolo. */
function MiniWinLossPie({ pct }: { pct: number }) {
  const slice = pct > 0 ? pieSlicePath(15, 15, 13, 0, Math.min(pct * 3.6, 359.9)) : '';
  return (
    <svg viewBox="0 0 30 30" width="30" height="30" className="shrink-0" aria-hidden="true">
      <circle cx="15" cy="15" r="13" fill="none" stroke={LOSS_COLOR} strokeWidth="2" />
      {slice && <path d={slice} fill={WIN_COLOR} />}
    </svg>
  );
}

/** Torta di gruppo (come si dividono tutte le vittorie) con la sua legenda. */
function GroupPieSection({ rows, idSuffix }: { rows: TallyRow[]; idSuffix: string }) {
  const winners = rows.filter((t) => t.w > 0);
  const totalWins = rows.reduce((sum, t) => sum + t.w, 0);
  if (totalWins === 0) return null;

  let angle = 0;
  const slices = winners.map((t, i) => {
    const share = (t.w / totalWins) * 360;
    const path = pieSlicePath(70, 70, 68, angle, angle + share);
    angle += share;
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], name: t.name, w: t.w, key: t.name };
  });

  return (
    <div>
      <p className="mb-2 text-xs text-zaff-muted">
        Come si dividono tutte le {totalWins} vittorie registrate, tra i giocatori:
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <GlossyPie slices={slices} idSuffix={idSuffix} />
        <div className="flex min-w-0 max-w-full flex-col gap-1.5 text-sm text-zaff-muted [overflow-wrap:anywhere]">
          {slices.map((s) => (
            <div key={s.name} className="text-zaff-text">
              <span
                className="mr-1.5 inline-block h-[11px] w-[11px] rounded-full align-[-1px]"
                style={{ background: s.color }}
              />
              {s.name} — {Math.round((s.w / totalWins) * 100)}% delle vittorie totali ({s.w} di {totalWins})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Player links keep the existing rows and mini charts. Exports use static rows. */
function PlayerRows({
  rows,
  interactive = false,
  tight = false,
}: {
  rows: TallyRow[];
  interactive?: boolean;
  /** Senza il margine sopra (quando sopra c'è già una scritta). */
  tight?: boolean;
}) {
  return (
    <ul className={tight ? '' : 'mt-4'}>
      {/* Più partite giocate in alto; a parità, % di vittorie più alta. */}
      {[...rows]
        .sort((a, b) => b.g - a.g || (b.g ? b.w / b.g : 0) - (a.g ? a.w / a.g : 0) || a.name.localeCompare(b.name, 'it'))
        .map((t) => {
        const pct = t.g ? (t.w / t.g) * 100 : 0;
        const content = (
          <>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-zaff-text">{t.name}</span>
            <MiniWinLossPie pct={pct} />
          </>
        );
        return (
          <li key={t.name}>
            {interactive ? (
              // Riquadro con bordo, come le righe di "Partite Salvate": si vede
              // che è un link e si illumina al passaggio/tocco. La freccia
              // a destra dice che si apre il dettaglio.
              <Link
                to={paths.player(t.name)}
                className="mb-2 flex w-full items-center gap-3 rounded-lg border border-zaff-border bg-zaff-bg px-3.5 py-3 text-left transition hover:border-zaff-primary active:border-zaff-primary"
              >
                {content}
                <span className="shrink-0 text-xl leading-none text-zaff-muted" aria-hidden="true">
                  ›
                </span>
              </Link>
            ) : (
              <div className="mb-2 flex w-full items-center gap-3 rounded-lg border border-zaff-border bg-zaff-bg px-3.5 py-3">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** La schermata "Statistiche Giocatori" com'è, ma statica: è questa che
 *  finisce nell'immagine esportata. */
function PlayersStatsCard({ rows, showPie }: { rows: TallyRow[]; showPie: boolean }) {
  return (
    <>
      <ExportHeader title="Statistiche Giocatori" subtitle={`Aggiornato al ${todayLabel()}`} />
      {showPie && <GroupPieSection rows={rows} idSuffix="group-export" />}
      <PlayerRows rows={rows} />
    </>
  );
}

interface PlayerDeckStat {
  deck: string;
  g: number;
  w: number;
  pct: number;
}

/** Dettaglio di un giocatore (torta personale, partite giocate/vinte, mazzi
 *  usati con percentuale SUA): lo stesso, identico, a schermo e nell'immagine
 *  esportata. `idSuffix` tiene distinti gli id dei gradienti della torta. */
function PlayerDetail({
  row,
  deckStats,
  idSuffix,
}: {
  row: TallyRow;
  deckStats: PlayerDeckStat[];
  idSuffix: string;
}) {
  const pct = row.g ? Math.round((row.w / row.g) * 100) : 0;
  const slices = row.g
    ? [
        row.w > 0 ? { path: pieSlicePath(60, 60, 58, 0, Math.min(pct * 3.6, 359.9)), color: WIN_COLOR, key: 'w' } : null,
        row.w < row.g
          ? { path: pieSlicePath(60, 60, 58, Math.min(pct * 3.6, 359.9), 360), color: LOSS_COLOR, key: 'l' }
          : null,
      ].filter((s): s is { path: string; color: string; key: string } => s !== null)
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-5">
        <GlossyPie slices={slices} size={120} idSuffix={idSuffix} />
        <div className="text-sm text-zaff-muted">
          <p className={HEADING_SECTION}>{pct}%</p>
          <p>
            {row.g} partite giocate · {row.w} vinte
          </p>
        </div>
      </div>

      <p className={cx('mb-1.5 mt-5', TEXT_MINI)}>Mazzi usati</p>
      {deckStats.length === 0 ? (
        <p className={TEXT_MUTED}>Nessun mazzo indicato nelle sue partite.</p>
      ) : (
        <div>
          {deckStats.map((d) => (
            <div key={d.deck} className="border-b border-zaff-border py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2.5">
                <b className="min-w-0 truncate text-[15px] font-semibold text-zaff-text">{d.deck}</b>
                <span className="shrink-0 whitespace-nowrap text-[13px] text-zaff-muted">
                  {d.g} partite · {d.w} vinte · {d.pct}%
                </span>
              </div>
              <div className="mt-1.5 h-[7px] overflow-hidden rounded bg-zaff-bg">
                <div className="h-full rounded bg-zaff-gold" style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Routed player detail reuses the same personal charts and image export. */
export function PlayerStatsDetail({
  row,
  games,
  decks = [],
}: {
  row: TallyRow;
  games: Game[];
  /** Mazzi salvati: il nome mostrato è quello attuale, anche se il mazzo è stato rinominato. */
  decks?: DeckRef[];
}) {
  /** Mazzi usati dal giocatore aperto, solo le SUE partite: stesso identico
   *  calcolo di `computeDeckStats` in GameStats.tsx ma filtrato su un solo
   *  giocatore, così un mazzo condiviso col gruppo mostra qui solo quanto è
   *  andato bene a lui, non il suo risultato complessivo. */
  const deckStats = useMemo(() => {
    const resolve = makeDeckResolver(decks);
    const tally = new Map<string, { deck: string; g: number; w: number }>();
    games.forEach((g) => {
      g.players.forEach((p) => {
        if (p.name !== row.name) return;
        const found = resolve(p);
        const key = found?.key ?? 'none';
        const entry = tally.get(key) ?? { deck: found?.name ?? 'Mazzo non indicato', g: 0, w: 0 };
        entry.g++;
        if (p.winner) entry.w++;
        tally.set(key, entry);
      });
    });
    return [...tally.values()]
      .map((t) => ({ deck: t.deck, g: t.g, w: t.w, pct: t.g ? Math.round((t.w / t.g) * 100) : 0 }))
      .sort((a, b) => b.g - a.g || b.pct - a.pct);
  }, [row.name, games, decks]);
  const exporter = useImageExport();
  return (
    <>
      <PlayerDetail row={row} deckStats={deckStats} idSuffix="player" />

      <ExportedImage image={exporter.image} error={exporter.error} alt={`Statistiche di ${row.name}, da salvare`} />
      <ShareBar
        exporting={exporter.exporting}
        shareTitle={row.name}
        onExport={() =>
          exporter.exportImage({
            fileName: `giocatore_${safeFileName(row.name) || 'magic'}_${todayIso()}.jpg`,
            shareTitle: row.name,
            shareText: 'Statistiche di ' + row.name,
          })
        }
      />

      <ExportCardHost cardRef={exporter.cardRef}>
        <ExportHeader title={row.name} subtitle={`Statistiche Giocatore · aggiornato al ${todayLabel()}`} />
        <PlayerDetail row={row} deckStats={deckStats} idSuffix="player-export" />
      </ExportCardHost>
    </>
  );
}

/**
 * Statistiche giocatori: in cima la torta di gruppo (come si dividono tutte
 * le vittorie), poi l'elenco dei giocatori — una riga ciascuno, solo nome e
 * mini-torta vinte/perse — e cliccando su un giocatore si apre il suo
 * dettaglio: torta personale, partite giocate/vinte, mazzi usati con
 * percentuale di vittoria propria (quella SUA con quel mazzo, non quella
 * del mazzo in generale se lo hanno usato anche altri).
 */
export default function Standings({ rows, showPie }: StandingsProps) {
  const exporter = useImageExport();

  if (rows.length === 0) {
    return <p className={cx('mt-4', TEXT_MUTED)}>Ancora nessuna partita qui: la classifica compare da qui.</p>;
  }

  return (
    <>
      {showPie && <GroupPieSection rows={rows} idSuffix="group" />}

      <div className="mt-4" />
      <PlayerRows rows={rows} interactive tight />

      <ExportedImage image={exporter.image} error={exporter.error} alt="Statistiche giocatori, da salvare" />
      <ShareBar
        exporting={exporter.exporting}
        shareTitle="Statistiche Giocatori"
        onExport={() =>
          exporter.exportImage({
            fileName: `statistiche_giocatori_${todayIso()}.jpg`,
            shareTitle: 'Statistiche Giocatori',
            shareText: 'Statistiche giocatori del registro partite di Magic',
          })
        }
      />
      <ExportCardHost cardRef={exporter.cardRef}>
        <PlayersStatsCard rows={rows} showPie={showPie} />
      </ExportCardHost>
    </>
  );
}
