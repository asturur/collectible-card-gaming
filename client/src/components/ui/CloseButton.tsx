import type { ButtonHTMLAttributes } from 'react';
import Button from './Button';
import { cx } from './styles';

interface CloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type' | 'aria-label' | 'title'> {
  label?: string;
  /** Image overlays need a solid background for contrast over card artwork. */
  surface?: 'panel' | 'image';
}

/** Shared square daisyUI close control for task dialogs and card previews. */
export default function CloseButton({ label = 'Chiudi', surface = 'panel', className, ...props }: CloseButtonProps) {
  return (
    <Button {...props} variant={surface === 'image' ? 'neutral' : 'subtle'} size="lg" shape="square"
      className={cx('shrink-0', className)} title={label} aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </Button>
  );
}
