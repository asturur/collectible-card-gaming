/**
 * Icone mana ufficiali (mana-font, caricato in index.html): `ms ms-w ms-cost`.
 * Sostituiscono le lettere W/U/B/R/G usate durante il porting.
 */

interface ManaIconProps {
  color: string;
  className?: string;
}

export default function ManaIcon({ color, className = '' }: ManaIconProps) {
  return <i className={`ms ms-${color.toLowerCase()} ms-cost ${className}`} title={color} aria-hidden="true" />;
}

interface ManaIconsProps {
  colors: string[] | undefined;
  className?: string;
}

/** Fila compatta di icone mana (es. accanto al nome di un mazzo o giocatore). */
export function ManaIcons({ colors, className = '' }: ManaIconsProps) {
  if (!colors || colors.length === 0) return null;
  return (
    <span className={`whitespace-nowrap leading-none ${className}`}>
      {colors.map((c) => (
        <ManaIcon key={c} color={c} className="ml-0.5 align-[-2px]" />
      ))}
    </span>
  );
}

interface ManaPipsProps {
  colors: Set<string> | string[];
  onToggle?: (color: string) => void;
  small?: boolean;
}

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;

/** Cinque pip selezionabili (bianco, blu, nero, rosso, verde). */
export function ManaPips({ colors, onToggle, small = false }: ManaPipsProps) {
  const active = colors instanceof Set ? colors : new Set(colors);
  return (
    <div className="flex gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-pressed={active.has(c)}
          disabled={!onToggle}
          onClick={() => onToggle?.(c)}
          className={`mtg-pip ${small ? 'mtg-pip-sm' : ''} ${onToggle ? '' : 'cursor-default'}`}
        >
          <ManaIcon color={c} />
        </button>
      ))}
    </div>
  );
}
