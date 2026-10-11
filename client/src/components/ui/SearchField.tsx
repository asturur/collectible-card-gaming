import { cx, FIELD_CONTROL } from './styles';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nome accessibile del campo (non c'è un'etichetta visibile). */
  label: string;
  className?: string;
}

/** Campo di ricerca testuale degli elenchi (partite, sfide, statistiche). */
export default function SearchField({ value, onChange, placeholder, label, className }: SearchFieldProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
      enterKeyHint="search"
      className={cx(FIELD_CONTROL, 'w-full', className)}
    />
  );
}

/** Vero se `text` contiene la ricerca, ignorando maiuscole e spazi ai bordi (ricerca vuota: tutto). */
export function matchesSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || text.toLowerCase().includes(q);
}
