import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from './styles';

export type ButtonVariant = 'primary' | 'ghost' | 'link' | 'danger' | 'text' | 'subtle' | 'neutral';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonShape = 'square' | 'circle';

const SIZES: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  /** Azione secondaria: solo bordo. */
  ghost: 'btn-outline',
  /** Nome storico: un'azione secondaria, non un link di navigazione. */
  link: 'btn-soft btn-neutral',
  danger: 'btn-outline btn-error',
  /** Azione discreta con aspetto di collegamento. */
  text: 'btn-link',
  subtle: 'btn-ghost',
  neutral: 'btn-neutral',
};

const SHAPES: Record<ButtonShape, string> = { square: 'btn-square', circle: 'btn-circle' };

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  className?: string;
}

/** Classi del bottone, per i casi in cui serve applicarle a un altro elemento. */
export function buttonClass({ variant = 'primary', size = 'md', shape, fullWidth, className }: ButtonStyleProps = {}): string {
  // Full-width actions can wrap on phones while keeping the daisyUI minimum.
  return cx('btn', SIZES[size], VARIANTS[variant], shape && SHAPES[shape], fullWidth && 'btn-block h-auto min-h-(--size) py-1', className);
}

type ButtonProps = ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export default function Button({ variant, size, shape, fullWidth, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, shape, fullWidth, className })} {...rest} />;
}

type ButtonLinkProps = ButtonStyleProps & AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode };

/** Stesso aspetto del bottone, ma è un link vero (apribile in una scheda nuova). */
export function ButtonLink({ variant, size, shape, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <a className={buttonClass({ variant, size, shape, fullWidth, className })} {...rest} />;
}

/** Internal navigation uses React Router while sharing the same button styles. */
export function ButtonRouteLink({ variant, size, shape, fullWidth, className, ...rest }: ButtonStyleProps & LinkProps) {
  return <Link className={buttonClass({ variant, size, shape, fullWidth, className })} {...rest} />;
}
