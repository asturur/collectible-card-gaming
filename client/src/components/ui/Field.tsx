import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from './styles';

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cx('fieldset mb-4 min-w-0', className)}>
      {label && (
        <label htmlFor={id} className="label whitespace-normal text-sm font-medium text-base-content">
          {label}
        </label>
      )}
      {children}
      {hint && <p id={`${id}-hint`} className="label whitespace-normal text-xs">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Density = 'comfortable' | 'compact';

const CONTROLS = {
  input: { base: 'input', comfortable: 'input-lg', compact: 'input-md', error: 'input-error' },
  select: { base: 'select', comfortable: 'select-lg', compact: 'select-md', error: 'select-error' },
  textarea: { base: 'textarea', comfortable: 'textarea-lg', compact: 'textarea-md', error: 'textarea-error' },
};

function controlClass(kind: keyof typeof CONTROLS, density: Density, error?: string, className?: string) {
  const classes = CONTROLS[kind];
  return cx(classes.base, classes[density], 'w-full', error && classes.error, className);
}

function describedBy(id: string, hint: ReactNode, error?: string, existing?: string) {
  return [existing, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

interface CommonProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** `compact` per le righe fitte dei moduli; `comfortable` per le maschere. */
  density?: Density;
  fieldClassName?: string;
}

type TextFieldProps = CommonProps & InputHTMLAttributes<HTMLInputElement> & {
  /** Suggerimenti mentre si scrive (datalist nativo del browser). */
  suggestions?: readonly string[];
};

export function TextField({ label, hint, error, density = 'comfortable', fieldClassName, className, id, suggestions,
  'aria-describedby': description, 'aria-invalid': invalid, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = suggestions?.length ? `${fieldId}-suggestions` : undefined;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <input id={fieldId} className={controlClass('input', density, error, className)} list={listId}
        aria-describedby={describedBy(fieldId, hint, error, description)} aria-invalid={error ? true : invalid} {...rest} />
      {listId && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
    </FieldShell>
  );
}

type SelectFieldProps = CommonProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };

export function SelectField({ label, hint, error, density = 'comfortable', fieldClassName, className, id, children,
  'aria-describedby': description, 'aria-invalid': invalid, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <select id={fieldId} className={controlClass('select', density, error, className)}
        aria-describedby={describedBy(fieldId, hint, error, description)} aria-invalid={error ? true : invalid} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({ label, hint, error, density = 'comfortable', fieldClassName, className, id,
  'aria-describedby': description, 'aria-invalid': invalid, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <textarea id={fieldId} className={controlClass('textarea', density, error, cx('resize-y', className))}
        aria-describedby={describedBy(fieldId, hint, error, description)} aria-invalid={error ? true : invalid} {...rest} />
    </FieldShell>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Conseguenze della scelta, sotto l'etichetta. */
  hint?: ReactNode;
}

interface ChoiceFieldProps<T extends string> {
  legend: ReactNode;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

/** Scelta tra poche opzioni che si escludono (radio daisyUI), ognuna con la sua spiegazione. */
export function ChoiceField<T extends string>({ legend, value, options, onChange, disabled, className }: ChoiceFieldProps<T>) {
  const name = useId();
  return (
    <fieldset className={cx('fieldset mb-4 min-w-0', className)} disabled={disabled}>
      <legend className="fieldset-legend text-sm font-medium text-base-content">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="label cursor-pointer items-start gap-3 whitespace-normal py-1.5 text-sm text-base-content">
          <input type="radio" className="radio radio-sm mt-0.5 shrink-0" name={name} value={option.value}
            checked={value === option.value} onChange={() => onChange(option.value)} />
          <span>
            {option.label}
            {option.hint && <span className="mt-0.5 block text-xs text-base-content/70">{option.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

interface CheckboxListFieldProps {
  legend: ReactNode;
  options: readonly ChoiceOption<string>[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** Campo per restringere la lista mentre si scrive (liste lunghe). */
  searchLabel?: string;
  hint?: ReactNode;
  className?: string;
}

/**
 * Scelta multipla (checkbox daisyUI) in una lista che scorre, con le voci scelte in cima
 * e, se serve, un campo per cercare tra le voci.
 */
export function CheckboxListField({ legend, options, values, onChange, searchLabel, hint, className }: CheckboxListFieldProps) {
  const [query, setQuery] = useState('');
  const hintId = useId();
  const chosen = new Set(values);
  const q = query.trim().toLowerCase();
  const visible = options
    .filter((o) => chosen.has(o.value) || !q || o.value.toLowerCase().includes(q))
    .sort((a, b) => Number(chosen.has(b.value)) - Number(chosen.has(a.value)));
  const toggle = (value: string) => onChange(chosen.has(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <fieldset className={cx('fieldset mb-4 min-w-0', className)} aria-describedby={hint ? hintId : undefined}>
      <legend className="fieldset-legend text-sm font-medium text-base-content">{legend}</legend>
      {searchLabel && (
        <input type="search" className="input input-md w-full" placeholder={searchLabel} aria-label={searchLabel}
          value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {/* Una voce per riga: l'etichetta daisyUI è in linea, qui va a capo. */}
      <div className="flex max-h-56 flex-col overflow-y-auto overscroll-contain rounded-field border border-base-content/20 px-3 py-1">
        {visible.length === 0 && <p className="py-2 text-sm text-base-content/70">Nessuna voce.</p>}
        {visible.map((option) => (
          <label key={option.value} className="label flex w-full shrink-0 cursor-pointer items-start gap-3 whitespace-normal py-1.5 text-sm text-base-content">
            <input type="checkbox" className="checkbox checkbox-sm mt-0.5 shrink-0" checked={chosen.has(option.value)} onChange={() => toggle(option.value)} />
            <span>
              {option.label}
              {option.hint && <span className="ml-1 text-xs text-base-content/70">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {hint && <p id={hintId} className="label whitespace-normal text-xs">{hint}</p>}
    </fieldset>
  );
}
