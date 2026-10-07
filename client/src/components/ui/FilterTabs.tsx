import { cx } from './styles';
import Button from './Button';

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
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? 'primary' : 'ghost'}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
