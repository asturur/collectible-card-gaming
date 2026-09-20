import type { ReactNode } from 'react';
import { cx, HEADING_PANEL, PANEL, TEXT_MUTED } from './styles';

interface CenteredPanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Larghezza del riquadro: `md` è la maschera standard dell'app. */
  width?: 'sm' | 'md';
  /** Il riquadro è un modulo: il contenuto viene avvolto in un `<form>`. */
  onSubmit?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Maschera centrata a tutto schermo — accesso ZAFF, accesso al registro,
 * scelta del mazzo: stesso riquadro, stessi margini, stessa gerarchia.
 */
export default function CenteredPanel({
  title,
  subtitle,
  width = 'md',
  onSubmit,
  className,
  children,
}: CenteredPanelProps) {
  const inner = (
    <>
      {title && <h1 className={cx(HEADING_PANEL, 'mb-2 text-center')}>{title}</h1>}
      {subtitle && <p className={cx('mb-8 text-center', TEXT_MUTED)}>{subtitle}</p>}
      {children}
    </>
  );

  const boxClass = cx(PANEL, width === 'sm' ? 'max-w-sm' : 'max-w-md', className);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      {onSubmit ? (
        <form
          className={boxClass}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {inner}
        </form>
      ) : (
        <div className={boxClass}>{inner}</div>
      )}
    </div>
  );
}
