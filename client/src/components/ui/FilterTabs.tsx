import { cx } from './styles';

export interface FilterTabOption {
  value: string;
  label: string;
}

interface FilterTabsProps {
  options: FilterTabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Fila di filtri (gruppi, origine mazzo): quello attivo è pieno. */
export default function FilterTabs({ options, value, onChange, className }: FilterTabsProps) {
  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cx(
            'rounded-lg border px-3 py-1.5 text-[13px] transition',
            value === option.value
              ? 'border-zaff-text bg-zaff-text text-zaff-bg'
              : 'border-zaff-border bg-zaff-surface text-zaff-muted hover:text-zaff-text'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
