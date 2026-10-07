import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './styles';

export type BadgeTone = 'neutral' | 'brew' | 'precon' | 'count' | 'primary' | 'warning';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const TONES: Record<BadgeTone, string> = {
  neutral: 'badge-outline',
  brew: 'badge-outline badge-success',
  precon: 'badge-outline badge-info',
  count: 'badge-neutral',
  primary: 'badge-primary',
  warning: 'badge-warning',
};

const SIZES: Record<BadgeSize, string> = { xs: 'badge-xs', sm: 'badge-sm', md: 'badge-md', lg: 'badge-lg', xl: 'badge-xl' };

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  children: ReactNode;
}

/** Pillola sottile: origine del mazzo, conteggi, etichette brevi. */
export default function Badge({ tone = 'neutral', size = 'sm', className, children, ...props }: BadgeProps) {
  return (
    <span {...props} className={cx('badge shrink-0 whitespace-nowrap', SIZES[size], TONES[tone], className)}>
      {children}
    </span>
  );
}
