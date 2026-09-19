import type { TallyRow } from './stats';
import { PIE_COLORS, pctColor, pieSlicePath } from './stats';

interface StandingsProps {
  rows: TallyRow[];
  /** La torta compare solo quando si guarda un gruppo preciso, come nell'originale. */
  showPie: boolean;
}

/**
 * Classifica in testata: una tessera per giocatore con partite vinte e
 * mini-torta della percentuale di vittorie, più la torta grande di gruppo.
 */
export default function Standings({ rows, showPie }: StandingsProps) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-zaff-muted">Ancora nessuna partita qui: la classifica compare da qui.</p>;
  }

  const top = rows[0].w;
  const pcts = rows.map((t) => (t.g ? (t.w / t.g) * 100 : 0));
  const minPct = Math.min(...pcts);
  const maxPct = Math.max(...pcts);

  const winners = rows.filter((t) => t.w > 0);
  const totalWins = rows.reduce((sum, t) => sum + t.w, 0);

  let angle = 0;
  const slices = winners.map((t, i) => {
    const share = (t.w / totalWins) * 360;
    const path = pieSlicePath(70, 70, 68, angle, angle + share);
    angle += share;
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], name: t.name, w: t.w };
  });

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {rows.map((t, i) => {
          const color = pctColor(pcts[i], minPct, maxPct);
          const slice = pcts[i] > 0 ? pieSlicePath(15, 15, 13, 0, Math.min(pcts[i] * 3.6, 359.9)) : '';
          return (
            <div
              key={t.name}
              className={`flex min-w-[150px] flex-1 items-center justify-between gap-2.5 rounded-lg border bg-zaff-surface px-3 py-2 sm:flex-none ${
                t.w === top && top > 0 ? 'border-zaff-highlight' : 'border-zaff-border'
              }`}
            >
              <div className="min-w-0">
                <b className="block break-words font-serif text-[13px] font-semibold sm:text-[15px] text-zaff-text">{t.name}</b>
                <span className="text-[13px] tabular-nums text-zaff-muted">
                  {t.w} vinte su {t.g}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <svg viewBox="0 0 30 30" width="30" height="30">
                  <circle cx="15" cy="15" r="13" fill="none" stroke={color} strokeWidth="2" />
                  {slice && <path d={slice} fill={color} />}
                </svg>
                <span className="text-[11px] text-zaff-muted">Win rate</span>
              </div>
            </div>
          );
        })}
      </div>

      {showPie && totalWins > 0 && (
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
      )}
    </>
  );
}
