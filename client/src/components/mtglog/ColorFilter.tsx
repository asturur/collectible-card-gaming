import { ManaPips } from './ManaIcon';
import { cx, TEXT_MINI } from '../ui/styles';

interface ColorFilterProps {
  colors: Set<string>;
  onToggle: (color: string) => void;
  onClear: () => void;
}

/** Filtro per colore dei mazzi: i cinque simboli mana e "Nessun filtro". Lo stesso in Mazzi Salvati e nella scelta del mazzo. */
export default function ColorFilter({ colors, onToggle, onClear }: ColorFilterProps) {
  return (
    <>
      <span className={cx('mb-1.5 block', TEXT_MINI)}>Colore</span>
      <div className="flex flex-wrap items-center gap-2">
        <ManaPips colors={colors} onToggle={onToggle} />
        <button
          type="button"
          onClick={onClear}
          aria-pressed={colors.size === 0}
          className={cx(
            'rounded-lg border px-3 py-1.5 text-[13px] transition',
            colors.size === 0
              ? 'border-transparent bg-gradient-to-r from-zaff-primary to-zaff-accent font-semibold text-zaff-bg'
              : 'border-zaff-border bg-zaff-surface text-zaff-muted hover:text-zaff-text'
          )}
        >
          Nessun filtro
        </button>
      </div>
    </>
  );
}
