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
 * L'illustrazione è alta quanto è larga (1231×1278): sul telefono la mostriamo
 * a tutta larghezza, quindi occupa i primi ~104vw della pagina. Il riquadro
 * parte sotto il volto e le orbite, e una sfumatura chiude il bordo basso del
 * disegno sul fondo scuro.
 */
const PHONE_ART_TOP = 'pt-[57vw]';
const PHONE_ART_FADE =
  'linear-gradient(to bottom, rgba(15,23,42,0) 30vw, rgba(15,23,42,0.72) 72vw, var(--color-zaff-bg) 104vw)';

/**
 * Maschera centrata a tutto schermo — accesso ZAFF, accesso al registro,
 * scelta del mazzo: stesso riquadro, stessi margini, stessa gerarchia.
 *
 * Con un'illustrazione di sfondo il riquadro scende (di 10vh sul desktop, sotto
 * il disegno sul telefono) per lasciare in vista volto e orbite.
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
    // sul desktop scende un po': l'illustrazione ha il volto in alto
    background && 'sm:mt-[10vh]',
    className
  );

  const containerClass = cx(
    'relative flex min-h-screen justify-center bg-zaff-bg px-4',
    background ? `items-start pb-10 ${PHONE_ART_TOP} sm:items-center sm:py-10 sm:pt-10` : 'items-center py-10'
  );

  return (
    <div className={containerClass}>
      {background && (
        <>
          <div
            aria-hidden="true"
            // telefono: a tutta larghezza in cima; desktop: riempie lo schermo, un po' sopra il centro
            className="absolute inset-0 bg-[length:100%_auto] bg-top bg-no-repeat sm:bg-[position:center_35%] sm:bg-cover"
            style={{ backgroundImage: `url(${background})` }}
          />
          {/* telefono: sfumatura che porta il bordo basso del disegno nel fondo scuro */}
          <div aria-hidden="true" className="absolute inset-0 sm:hidden" style={{ background: PHONE_ART_FADE }} />
          {/* desktop: velo uniforme, il riquadro ci sta sopra */}
          <div aria-hidden="true" className="absolute inset-0 hidden bg-zaff-bg/60 sm:block" />
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
