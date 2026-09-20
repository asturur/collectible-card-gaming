import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx, FIELD_CONTROL, FIELD_CONTROL_SM, FIELD_LABEL, TEXT_ERROR, TEXT_MINI } from './styles';

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
    <div className={cx('mb-4', className)}>
      {label && (
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
      )}
      {children}
      {hint && <p className={cx('mt-1', TEXT_MINI)}>{hint}</p>}
      {error && (
        <p className={cx('mt-1', TEXT_ERROR)} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Density = 'comfortable' | 'compact';

function controlClass(density: Density, className?: string) {
  return cx(density === 'compact' ? FIELD_CONTROL_SM : FIELD_CONTROL, className);
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

export function TextField({ label, hint, error, density = 'comfortable', fieldClassName, className, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <input id={fieldId} className={controlClass(density, className)} {...rest} />
    </FieldShell>
  );
}

type SelectFieldProps = CommonProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };

export function SelectField({ label, hint, error, density = 'comfortable', fieldClassName, className, id, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <select id={fieldId} className={controlClass(density, className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({ label, hint, error, density = 'comfortable', fieldClassName, className, id, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={fieldClassName}>
      <textarea id={fieldId} className={controlClass(density, cx('min-h-[70px] resize-y', className))} {...rest} />
    </FieldShell>
  );
}
