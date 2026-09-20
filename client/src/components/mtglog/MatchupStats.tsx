import { useMemo, useState } from 'react';
import type { Game } from './GameList';
import { computeMatchups, PIE_COLORS, pieSlicePath } from './stats';
import Modal from '../ui/Modal';
import { cx, FIELD_LABEL, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface MatchupStatsProps {
  games: Game[];
}

/**
 * Statistiche per ogni combinazione di giocatori che si è davvero sfidata
 * (2 o più, esattamente quella formazione): un bottone per combinazione,
 * che apre il dettaglio con partite totali, vittorie di ciascuno e torta.
 * Le combinazioni mai giocate non compaiono: derivano solo dalle partite salvate.
 */
export default function MatchupStats({ games }: MatchupStatsProps) {
  const matchups = useMemo(() => computeMatchups(games), [games]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const selected = matchups.find((m) => m.key === openKey) ?? null;

  if (matchups.length === 0) return null;

  const totalWins = selected ? selected.players.reduce((sum, p) => sum + p.w, 0) : 0;
  let angle = 0;
  const slices = selected
    ? selected.players
        .filter((p) => p.w > 0)
        .map((p, i) => {
          const share = (p.w / totalWins) * 360;
          const path = pieSlicePath(70, 70, 68, angle, angle + share);
          angle += share;
          return { path, color: PIE_COLORS[i % PIE_COLORS.length], name: p.name, w: p.w };
        })
    : [];

  return (
    <div className="mt-5">
      <span className={FIELD_LABEL}>Statistiche per sfida</span>
      <div className="flex flex-wrap gap-2">
        {matchups.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setOpenKey(m.key)}
            className="rounded-lg border border-zaff-border bg-zaff-surface px-3 py-1.5 text-[13px] text-zaff-muted transition hover:border-zaff-primary hover:text-zaff-text"
          >
            {m.label} <span className="opacity-70">· {m.games}</span>
          </button>
        ))}
      </div>

      {selected && (
        <Modal level={2} title={selected.label} onClose={() => setOpenKey(null)}>
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
                  <span className="flex items-center gap-2 text-[15px] text-zaff-text">
                    <span
                      className="inline-block h-[11px] w-[11px] shrink-0 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {p.name}
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
              <svg viewBox="0 0 140 140" width="140" height="140" className="shrink-0">
                {slices.map((s) => (
                  <path key={s.name} d={s.path} fill={s.color} />
                ))}
              </svg>
              <div className="flex flex-col gap-1.5 text-sm text-zaff-muted">
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
        </Modal>
      )}
    </div>
  );
}
