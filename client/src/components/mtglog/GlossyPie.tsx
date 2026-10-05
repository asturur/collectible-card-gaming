/**
 * Torta "da app" (ombra sotto, lucentezza e ombreggiatura sopra le fette):
 * stessa resa sia per la torta di gruppo che per quella personale del
 * singolo giocatore, `idSuffix` tiene distinti gli id dei gradienti quando
 * compaiono insieme in pagina (es. dietro al riquadro di dettaglio aperto).
 */
export default function GlossyPie({
  slices,
  size = 140,
  idSuffix,
}: {
  slices: { path: string; color: string; key: string }[];
  size?: number;
  idSuffix: string;
}) {
  const c = size / 2;
  const r = c - 2;
  const gloss = `pieGloss-${idSuffix}`;
  const shade = `pieShade-${idSuffix}`;
  const clip = `pieClip-${idSuffix}`;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]">
      <defs>
        <radialGradient id={gloss} cx="34%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={shade} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx={c} cy={c} r={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {slices.map((s) => (
          <path key={s.key} d={s.path} fill={s.color} stroke="#1e293b" strokeWidth="1.5" />
        ))}
        {/* rilievo: più scuro verso il bordo, lucido in alto a sinistra */}
        <circle cx={c} cy={c} r={r} fill={`url(#${shade})`} />
        <circle cx={c} cy={c} r={r} fill={`url(#${gloss})`} />
      </g>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#120E20" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}
