import { cx } from './styles';

interface NumberStepperProps {
  value: string;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * − / campo / + per i numeri che si aggiustano a colpetti (punti vita).
 * Il valore resta una stringa perché il campo può essere vuoto.
 */
export default function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: NumberStepperProps) {
  function bump(delta: number) {
    const current = value === '' ? 0 : Number(value) || 0;
    const next = current + delta;
    onChange(String(min !== undefined ? Math.max(min, next) : next));
  }

  const buttonClass =
    'w-[30px] shrink-0 bg-zaff-bg text-base leading-none text-zaff-text transition hover:bg-zaff-gold hover:text-zaff-bg';

  return (
    <div className={cx('flex overflow-hidden rounded-lg border border-zaff-border', className)}>
      <button type="button" onClick={() => bump(-step)} aria-label="Diminuisci" className={buttonClass}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="mtg-life-input w-11 min-w-0 flex-1 border-0 bg-zaff-bg px-0.5 py-2 text-center tabular-nums text-zaff-text placeholder:text-zaff-muted focus:outline-none"
      />
      <button type="button" onClick={() => bump(step)} aria-label="Aumenta" className={buttonClass}>
        +
      </button>
    </div>
  );
}
