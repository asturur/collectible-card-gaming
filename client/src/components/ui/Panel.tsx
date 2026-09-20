import type { ReactNode } from 'react';
import { cx, HEADING_PANEL, PANEL, TEXT_MUTED } from './styles';

interface CenteredPanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Illustrazione a tutta pagina dietro al riquadro (vedi LOGIN_BACKGROUND). */
  background?: string;
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
  background,
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

  const boxClass = cx(
    PANEL,
    'relative z-10',
    width === 'sm' ? 'max-w-sm' : 'max-w-md',
    // sopra l'illustrazione il riquadro si fa più denso, così il testo resta leggibile
    background && 'bg-zaff-surface/85 backdrop-blur-md',
    className
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zaff-bg px-4 py-10">
      {background && (
        <>
          <div
            aria-hidden="true"
            // poco sopra il centro: il volto resta sopra il riquadro, il modulo cade sull'area sfumata
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${background})`, backgroundPosition: 'center 35%' }}
          />
          {/* velo scuro: tiene il contrasto del modulo sopra qualsiasi illustrazione */}
          <div aria-hidden="true" className="absolute inset-0 bg-zaff-bg/60" />
        </>
      )}

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
