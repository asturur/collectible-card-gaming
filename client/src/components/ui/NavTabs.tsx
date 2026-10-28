import { ButtonRouteLink, type ButtonSize } from './Button';
import ChipRow from './ChipRow';

export interface NavTabOption {
  value: string;
  label: string;
  /** Pagina della voce: ogni voce è un link vero del router. */
  to: string;
}

interface NavTabsProps {
  /** Nome accessibile della fila (es. "Argomenti"). */
  label: string;
  options: readonly NavTabOption[];
  value: string;
  size?: ButtonSize;
  className?: string;
}

/**
 * Fila di sotto-pagine con lo stesso aspetto di `FilterTabs` (vedi `ChipRow`), ma fatta di link:
 * l'indirizzo dice quale voce è aperta (ricaricabile, condivisibile).
 * Passare da una voce all'altra sostituisce la cronologia, così Indietro torna
 * alla pagina da cui si è arrivati e non ripercorre ogni voce toccata.
 */
export default function NavTabs({ label, options, value, size = 'sm', className }: NavTabsProps) {
  return (
    <ChipRow as="nav" label={label} className={className}>
      {options.map((option) => (
        <ButtonRouteLink
          key={option.value}
          to={option.to}
          replace
          size={size}
          variant={value === option.value ? 'primary' : 'ghost'}
          aria-current={value === option.value ? 'page' : undefined}
        >
          {option.label}
        </ButtonRouteLink>
      ))}
    </ChipRow>
  );
}
