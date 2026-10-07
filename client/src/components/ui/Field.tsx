import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
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

type TextFieldProps = CommonProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, hint, error, density = 'comfortable', fieldClassName, className, id,
  'aria-describedby': description, 'aria-invalid': invalid, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <input id={fieldId} className={controlClass('input', density, error, className)}
        aria-describedby={describedBy(fieldId, hint, error, description)} aria-invalid={error ? true : invalid} {...rest} />
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
