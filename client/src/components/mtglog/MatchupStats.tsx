import { useMemo } from 'react';
import { Link } from 'react-router';
import { paths } from '../../router';
import type { Game } from './GameList';
import GlossyPie from './GlossyPie';
import {
  ExportButton,
  ExportCardHost,
  ExportedImage,
  ExportHeader,
  safeFileName,
  todayIso,
  todayLabel,
  useImageExport,
} from './ImageExport';
import { computeMatchups, PIE_COLORS, pieSlicePath, type MatchupRow } from './stats';
import { cx, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface MatchupStatsProps {
  games: Game[];
}

/** Contenuto del dettaglio di una sfida (partite, vittorie di ciascuno, torta):
 *  lo stesso, identico, sia nel riquadro a schermo che nell'immagine esportata.
 *  `idSuffix` tiene distinti gli id dei gradienti della torta tra le due copie. */
function MatchupDetail({ selected, idSuffix }: { selected: MatchupRow; idSuffix: string }) {
  const totalWins = selected.players.reduce((sum, p) => sum + p.w, 0);
  // Il colore di ogni giocatore dipende dalla sua posizione nell'elenco
  // completo (come il pallino nella lista), non da quella tra i soli
  // vincitori: altrimenti, se qualcuno ha 0 vittorie, i colori slittano.
  let angle = 0;
  const slices = selected.players
    .map((p, i) => ({ p, color: PIE_COLORS[i % PIE_COLORS.length] }))
    .filter(({ p }) => p.w > 0)
    .map(({ p, color }) => {
      const share = (p.w / totalWins) * 360;
      const path = pieSlicePath(70, 70, 68, angle, angle + share);
      angle += share;
      return { path, color, name: p.name, w: p.w, key: p.name };
    });

  return (
    <>
      <p className={TEXT_MINI}>{selected.games} partite giocate tra queste formazioni</p>

      <div className="mt-3.5">
        {selected.players.map((p, i) => {
          const losses = selected.games - p.w;
          const pct = selected.games ? Math.round((p.w / selected.games) * 100) : 0;
          return (
            <div
              key={p.name}
              className="flex items-center justify-between gap-2.5 border-b border-zaff-border py-2 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px] text-zaff-text">
                <span
                  className="inline-block h-[11px] w-[11px] shrink-0 rounded-full"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
              </span>
              <span className={cx('shrink-0 whitespace-nowrap', TEXT_MINI)}>
                {p.w} vittorie · {losses} sconfitte · {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {totalWins > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <GlossyPie slices={slices} idSuffix={idSuffix} />
          <div className="flex min-w-0 max-w-full flex-col gap-1.5 text-sm text-zaff-muted [overflow-wrap:anywhere]">
            {slices.map((s) => (
              <div key={s.name} className="text-zaff-text">
                <span
                  className="mr-1.5 inline-block h-[11px] w-[11px] rounded-full align-[-1px]"
                  style={{ background: s.color }}
                />
                {s.name} — {Math.round((s.w / totalWins) * 100)}% ({s.w}/{totalWins})
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={cx('mt-3.5', TEXT_MUTED)}>Nessuna partita ha ancora un vincitore segnato.</p>
      )}
    </>
  );
}

/** Exact formations link to their refreshable statistics page. */
export default function MatchupStats({ games }: MatchupStatsProps) {
  const matchups = useMemo(() => computeMatchups(games), [games]);

  if (matchups.length === 0) {
    return (
      <p className={TEXT_MUTED}>
        Ancora nessuna sfida tra più giocatori registrata: compare qui appena ci sono partite salvate.
      </p>
    );
  }

  return (
    <>
      <p className={cx('mb-2', TEXT_MINI)}>Tocca una sfida per vederne le statistiche.</p>
      <ul>
        {matchups.map((m) => (
          <li key={m.key}>
            <Link
              to={paths.matchup(m.players.map(player => player.name))}
              className="mb-2 flex w-full items-center gap-3 rounded-lg border border-zaff-border bg-zaff-bg px-3.5 py-3 text-left transition hover:border-zaff-primary active:border-zaff-primary"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-zaff-text" title={m.label}>
                  {m.label}
                </span>
                <span className={cx('block', TEXT_MINI)}>
                  {m.games} {m.games === 1 ? 'partita' : 'partite'}
                </span>
              </span>
              <span className="shrink-0 text-2xl leading-none text-zaff-muted" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The existing detail and export share one presentation on the routed page. */
export function MatchupStatsDetail({ selected }: { selected: MatchupRow }) {
  const exporter = useImageExport();
  return (
    <>
      <MatchupDetail selected={selected} idSuffix="matchup" />

      <div className="mt-4">
        <ExportButton
          exporting={exporter.exporting}
          onClick={() =>
            exporter.exportImage({
              fileName: `sfida_${safeFileName(selected.label) || 'magic'}_${todayIso()}.jpg`,
              shareTitle: selected.label,
              shareText: 'Statistiche della sfida ' + selected.label,
            })
          }
        />
      </div>
      <ExportedImage image={exporter.image} error={exporter.error} alt={`Statistiche della sfida ${selected.label}`} />

      <ExportCardHost cardRef={exporter.cardRef}>
        <ExportHeader title={selected.label} subtitle={`Statistiche per Sfida · aggiornato al ${todayLabel()}`} />
        <MatchupDetail selected={selected} idSuffix="matchup-export" />
      </ExportCardHost>
    </>
  );
}
