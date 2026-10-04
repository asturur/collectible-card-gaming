import { useEffect, useRef, type ReactNode } from 'react';
import { cx, HEADING_SECTION, TEXT_MINI } from './styles';

/** Riquadri aperti, dal più in basso al più in alto: Esc chiude solo quello in cima. */
const openModals: object[] = [];

interface ModalProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Riquadro largo (storico partite, nuova partita, statistiche). */
  wide?: boolean;
  /** Livello di sovrapposizione: i riquadri annidati stanno sopra ai loro genitori. */
  level?: 1 | 2;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Riquadro sovrapposto alla pagina, come i `.modal-overlay` dell'app HTML
 * originale: si chiude con la ✕, con Esc o toccando fuori dal riquadro.
 */
export default function Modal({ title, subtitle, wide = false, level = 1, onClose, children }: ModalProps) {
  const token = useRef({});
  // `onClose` quasi sempre è una funzione creata di nuovo a ogni render del
  // genitore (es. `onClose={() => setOpenModal(null)}`): tenerla qui con un
  // ref, invece che nelle dipendenze dell'effetto sotto, evita di rifare il
  // blocco/sblocco dello scroll della pagina a ogni aggiornamento mentre il
  // popup è aperto (es. mentre carica l'elenco mazzi/giocatori). Senza
  // questo, con due popup uno sopra l'altro il blocco poteva restare attivo
  // anche dopo aver chiuso tutto, impedendo di scorrere la pagina col dito.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const self = token.current;
    openModals.push(self);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === self) onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      const index = openModals.indexOf(self);
      if (index >= 0) openModals.splice(index, 1);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // Solo apertura/chiusura vera del popup: vedi commento sopra su onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-4 sm:px-4 sm:py-10 ${
        level === 2 ? 'z-30' : 'z-20'
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full rounded-xl border border-zaff-border bg-zaff-surface p-4 shadow-2xl sm:p-6 ${
          wide ? 'max-w-[680px]' : 'max-w-[560px]'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          title="Chiudi"
          aria-label="Chiudi"
          className="absolute right-2.5 top-2.5 rounded px-2 py-1 text-xl leading-none text-zaff-muted transition hover:text-red-400"
        >
          ×
        </button>

        {title && (
          <h2 className={cx(HEADING_SECTION, 'mb-3 truncate border-b border-zaff-border pb-1.5 pr-8')} title={typeof title === 'string' ? title : undefined}>
            {title}
          </h2>
        )}
        {subtitle && <p className={cx('-mt-1 mb-3', TEXT_MINI)}>{subtitle}</p>}

        {children}
      </div>
    </div>
  );
}
