import type { ReactNode } from 'react';
import { cx } from './styles';

export type BadgeTone = 'neutral' | 'brew' | 'precon';

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-zaff-border text-zaff-muted',
  brew: 'border-green-400 text-green-400',
  precon: 'border-cyan-400 text-cyan-400',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

/** Pillola sottile: origine del mazzo, conteggi, etichette brevi. */
export default function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span className={cx('shrink-0 rounded-full border px-2 py-px text-[11px] whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}
