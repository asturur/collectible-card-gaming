import Button from './Button';
import ChipRow from './ChipRow';

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

/** Fila di filtri: quello attivo è pieno. Selettore a larghezza uguale o riga che scorre (vedi `ChipRow`). */
export default function FilterTabs({ options, value, onChange, className }: FilterTabsProps) {
  return (
    <ChipRow className={className}>
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
    </ChipRow>
  );
}
