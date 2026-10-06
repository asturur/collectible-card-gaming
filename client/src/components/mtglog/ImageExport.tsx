import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { toCanvas } from 'html-to-image';
import Button from '../ui/Button';
import { cx, HEADING_SECTION, TEXT_MINI } from '../ui/styles';

/**
 * Esportazione in immagine (JPG) delle schermate di statistiche, con lo
 * stesso meccanismo di "Esporta Risultati" nelle partite salvate: la scheda
 * da esportare è una COPIA nascosta fuori schermo, di larghezza fissa
 * (stessa resa su ogni telefono), disegnata con html-to-image.
 */

/** Piccolo badge "JPG", per far capire a colpo d'occhio il formato. */
export function JpgBadge() {
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" className="mr-1 inline-block align-[-4px]" aria-hidden="true">
      <rect x="0.5" y="0.5" width="27" height="17" rx="3.5" fill="#E8CA7E" stroke="#9E7A31" strokeWidth="1" />
      <text
        x="14"
        y="12.5"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        fill="#5B4310"
      >
        JPG
      </text>
    </svg>
  );
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nome file sicuro: niente spazi né simboli strani. */
export function safeFileName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

interface ExportRequest {
  fileName: string;
  shareTitle: string;
  shareText: string;
}

export function useImageExport() {
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const replaceImage = useCallback((url: string | null) => {
    if (imageRef.current) URL.revokeObjectURL(imageRef.current);
    imageRef.current = url;
    setImage(url);
  }, []);

  useEffect(
    () => () => {
      if (imageRef.current) URL.revokeObjectURL(imageRef.current);
    },
    []
  );

  async function exportImage(req: ExportRequest) {
    if (!cardRef.current) return;
    setExporting(true);
    setError('');
    try {
      const canvas = await toCanvas(cardRef.current, {
        backgroundColor: '#1e293b',
        pixelRatio: 2,
        cacheBust: true,
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        setError("Non sono riuscito a generare l'immagine: riprova.");
        return;
      }
      const file = new File([blob], req.fileName, { type: 'image/jpeg' });
      // Condivisione nativa quando c'è; l'anteprima da salvare a mano resta
      // sempre (su iPhone la condivisione può essere rifiutata in silenzio).
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: req.shareTitle, text: req.shareText }).catch(() => {});
      }
      replaceImage(URL.createObjectURL(blob));
    } catch {
      setError("Non sono riuscito a generare l'immagine: riprova.");
    } finally {
      setExporting(false);
    }
  }

  /** Toglie anteprima ed errori (es. quando si cambia schermata). */
  function reset() {
    replaceImage(null);
    setError('');
  }

  return { cardRef, image, exporting, error, exportImage, reset };
}

export function ExportButton({ exporting, onClick }: { exporting: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={exporting}>
      {exporting ? (
        'Genero immagine…'
      ) : (
        <>
          <JpgBadge />
          Esporta Immagine
        </>
      )}
    </Button>
  );
}

export function ExportedImage({ image, error, alt }: { image: string | null; error: string; alt: string }) {
  return (
    <>
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {image && (
        <div className="mt-3.5 rounded-lg border border-zaff-border bg-zaff-bg p-3">
          <p className={cx('mb-2', TEXT_MINI)}>
            Tieni premuto sull&apos;immagine qui sotto e scegli &quot;Salva immagine&quot; (o condividila da lì) — più
            affidabile del tasto, che su alcuni iPhone non riesce ad aprire da solo il foglio di condivisione.
          </p>
          <img src={image} alt={alt} className="w-full rounded-lg border border-zaff-border" />
        </div>
      )}
    </>
  );
}

/** Copia nascosta e fuori schermo da cui si genera l'immagine. */
export function ExportCardHost({ cardRef, children }: { cardRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden="true">
      <div ref={cardRef} className="w-[440px] bg-zaff-surface p-5 text-zaff-text">
        {children}
      </div>
    </div>
  );
}

export function ExportHeader({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-3.5">
      <p className="mb-0.5 text-[11px] uppercase tracking-[0.06em] text-zaff-muted">Registro partite di Magic</p>
      <h2 className={HEADING_SECTION}>{title}</h2>
      {subtitle && <p className={TEXT_MINI}>{subtitle}</p>}
    </div>
  );
}
