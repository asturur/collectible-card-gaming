import type { TallyRow } from './stats';
import { PIE_COLORS, pctColor, pieSlicePath } from './stats';
import { TILE_GRID } from '../ui/Tile';

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
      <div className={`mt-4 ${TILE_GRID}`}>
        {rows.map((t, i) => {
          const color = pctColor(pcts[i], minPct, maxPct);
          const slice = pcts[i] > 0 ? pieSlicePath(15, 15, 13, 0, Math.min(pcts[i] * 3.6, 359.9)) : '';
          return (
            <div
              key={t.name}
              className={`flex items-center justify-between gap-2.5 rounded-lg border bg-zaff-surface px-3 py-2 ${
                t.w === top && top > 0 ? 'border-zaff-highlight' : 'border-zaff-border'
              }`}
            >
              <div className="min-w-0">
                <b className="block break-words text-[13px] font-semibold text-zaff-text sm:text-[15px]">{t.name}</b>
                <span className="text-[13px] tabular-nums text-zaff-muted">
                  {t.w} vinte su {t.g} · {Math.round(pcts[i])}%
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
        <div className="mt-4">
          <p className="mb-2 text-xs text-zaff-muted">
            Come si dividono tutte le {totalWins} vittorie registrate, tra i giocatori:
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {/* Ombra sotto il cerchio (elevazione) + lucentezza e ombreggiatura
                sopra le fette (rilievo), per un aspetto più "da app" invece
                che piatto. Le torte piccole nelle tessere restano come sono. */}
            <svg
              viewBox="0 0 140 140"
              width="140"
              height="140"
              className="shrink-0 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
            >
              <defs>
                <radialGradient id="pieGloss" cx="34%" cy="26%" r="80%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
                  <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="pieShade" cx="50%" cy="50%" r="50%">
                  <stop offset="70%" stopColor="#000000" stopOpacity="0" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
                </radialGradient>
                <clipPath id="pieClip">
                  <circle cx="70" cy="70" r="68" />
                </clipPath>
              </defs>
              <g clipPath="url(#pieClip)">
                {slices.map((s) => (
                  <path key={s.name} d={s.path} fill={s.color} stroke="#1e293b" strokeWidth="1.5" />
                ))}
                {/* rilievo: più scuro verso il bordo, lucido in alto a sinistra */}
                <circle cx="70" cy="70" r="68" fill="url(#pieShade)" />
                <circle cx="70" cy="70" r="68" fill="url(#pieGloss)" />
              </g>
              <circle cx="70" cy="70" r="68" fill="none" stroke="#120E20" strokeWidth="1.5" opacity="0.5" />
            </svg>
            <div className="flex flex-col gap-1.5 text-sm text-zaff-muted">
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
      )}
    </>
  );
}
