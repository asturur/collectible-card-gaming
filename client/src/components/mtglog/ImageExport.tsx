import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { toCanvas } from 'html-to-image';
import { useLocation } from 'react-router';
import { appHref } from '../../router';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { cx, HEADING_SECTION, TEXT_MINI } from '../ui/styles';

/**
 * Esportazione in immagine (JPG) delle schermate di statistiche, con lo
 * stesso meccanismo di "Esporta Risultati" nelle partite salvate: la scheda
 * da esportare è una COPIA nascosta fuori schermo, di larghezza fissa
 * (stessa resa su ogni telefono), disegnata con html-to-image.
 */

/** Piccolo badge "JPG", per far capire a colpo d'occhio il formato. */
export function JpgBadge() {
  return <Badge tone="warning" aria-hidden="true">JPG</Badge>;
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

/**
 * Barra fissa in fondo, sopra la barra di navigazione: "Esporta" (JPG) e "Link" affiancati, stessa larghezza e altezza.
 * Resta sempre visibile mentre si scorre; il distanziatore in fondo alla pagina evita che copra l'ultima riga.
 * Il link è quello della pagina in cui ci si trova (serve il login, come per tutto il registro).
 */
export function ShareBar({ exporting, onExport, shareTitle, shareText }: { exporting: boolean; onExport: () => void; shareTitle: string; shareText?: string }) {
  const { pathname } = useLocation();
  const [notice, setNotice] = useState('');

  async function handleLink() {
    const url = `${window.location.origin}${appHref(pathname)}`;
    setNotice('');
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, ...(shareText ? { text: shareText } : {}), url });
        return;
      } catch {
        // Annullato o non disponibile: si prova a copiarlo.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copiato negli appunti.');
    } catch {
      setNotice(url);
    }
  }

  return (
    <>
      <div className="h-16" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-[24] border-t border-zaff-border bg-zaff-surface">
        <div className="mx-auto max-w-[680px] px-3 py-2">
          {notice && <p className={cx('mb-1.5 break-all', TEXT_MINI)} role="status">{notice}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button fullWidth onClick={onExport} disabled={exporting}>
              {exporting ? (
                'Genero…'
              ) : (
                <>
                  <JpgBadge />
                  Esporta
                </>
              )}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => { void handleLink(); }}>
              🔗 Link
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ExportedImage({ image, error, alt }: { image: string | null; error: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Con i tasti fissi in basso l'anteprima comparirebbe fuori vista: ci si porta lo schermo.
  useEffect(() => { if (image) box.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); }, [image]);
  return (
    <>
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {image && (
        <div ref={box} className="mt-3.5 rounded-lg border border-zaff-border bg-zaff-bg p-3">
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
