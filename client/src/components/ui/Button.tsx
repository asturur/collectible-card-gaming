import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './styles';

export type ButtonVariant = 'primary' | 'ghost' | 'link' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zaff-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zaff-surface disabled:cursor-not-allowed disabled:opacity-50';

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
};

const VARIANTS: Record<ButtonVariant, string> = {
  /** Azione principale: il gradiente viola→ciano dell'app. */
  primary: 'bg-gradient-to-r from-zaff-primary to-zaff-accent text-zaff-bg hover:brightness-110 active:brightness-95',
  /** Azione secondaria: solo bordo. */
  ghost: 'border border-zaff-border bg-transparent text-zaff-muted hover:border-zaff-muted hover:text-zaff-text',
  /** Azione minore dentro liste e schede. */
  link: 'border border-zaff-border bg-zaff-bg font-normal text-zaff-text hover:border-zaff-gold hover:text-zaff-gold',
  /** Come `link`, ma per cancellare. */
  danger: 'border border-zaff-border bg-zaff-bg font-normal text-zaff-muted hover:border-red-400 hover:text-red-400',
};

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Classi del bottone, per i casi in cui serve applicarle a un altro elemento. */
export function buttonClass({ variant = 'primary', size = 'md', fullWidth, className }: ButtonStyleProps = {}): string {
  return cx(BASE, SIZES[size], VARIANTS[variant], fullWidth && 'w-full', className);
}

type ButtonProps = ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export default function Button({ variant, size, fullWidth, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, fullWidth, className })} {...rest} />;
}

type ButtonLinkProps = ButtonStyleProps & AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

/** Stesso aspetto del bottone, ma è un link vero (apribile in una scheda nuova). */
export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <a className={buttonClass({ variant, size, fullWidth, className })} {...rest} />;
}
