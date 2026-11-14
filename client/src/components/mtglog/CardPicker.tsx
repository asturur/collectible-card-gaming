import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchScryfall, type ScryCard } from '../../services/scryfall';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import CloseButton from '../ui/CloseButton';
import { cx, TEXT_MINI } from '../ui/styles';

interface CardPickerProps {
  /** `add`: ogni scelta aggiunge una copia, il selettore resta aperto.
   *  `replace`: la scelta sostituisce una carta non riconosciuta e chiude. */
  mode: 'add' | 'replace';
  /** Testo con cui parte la ricerca (nome sbagliato da correggere). */
  initialQuery?: string;
  /** Solo in modalità `add`: dove finiscono le carte aggiunte. */
  section?: 'main' | 'side';
  onSectionChange?: (s: 'main' | 'side') => void;
  /** Quante copie di quella carta ci sono già nel mazzo. */
  countOf: (name: string) => number;
  /** Totali del mazzo, sempre in vista mentre si aggiungono carte. */
  totals?: { main: number; side: number };
  onPick: (card: ScryCard) => void;
  onClose: () => void;
}

/** Anteprima grande di una carta trovata. Tocco sull'immagine = scelta
 *  (+1 in modalità aggiungi); la X (o "Non è questa") chiude senza scegliere. */
function Preview({
  card,
  mode,
  count,
  onChoose,
  onClose,
}: {
  card: ScryCard;
  mode: 'add' | 'replace';
  count: number;
  onChoose: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [face, setFace] = useState(0);
  const [flash, setFlash] = useState(0);
  const flashTimer = useRef<number | undefined>(undefined);
  const image = card.faces[Math.min(face, card.faces.length - 1)];

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function choose() {
    onChoose();
    if (mode === 'add') {
      setFlash((n) => n + 1);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(0), 700);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/90 px-4 py-4"
      onClick={onClose}
      role="dialog"
      aria-label={card.name}
    >
      <CloseButton onClick={onClose} label={t('chiudi_senza_scegliere')} surface="image"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))]" />

      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={choose} className="relative max-h-full max-w-full" aria-label={t('aggiungi_nome', { name: card.name })}>
          <img
            src={image.normal}
            alt={card.name}
            className="max-h-full max-w-full rounded-xl object-contain"
            style={{ aspectRatio: '488 / 680', maxHeight: '62vh' }}
          />
          {flash > 0 && (
            <span
              key={flash}
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-5xl font-extrabold text-white"
            >
              +1
            </span>
          )}
        </button>
      </div>

      <div className="w-full max-w-sm text-center text-white" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold">{card.name}</div>
        <div className="text-xs text-white/70">
          {mode === 'add'
            ? t('nel_mazzo_tocca_carta', { count })
            : t('tocca_carta_per_usarla_al')}
        </div>
        {card.faces.length > 1 && (
          <button
            type="button"
            onClick={() => setFace((f) => (f + 1) % card.faces.length)}
            className="mt-2 rounded-lg border-2 border-white/60 bg-black/50 px-4 py-1.5 text-sm font-semibold text-white"
          >
            {t('gira_carta')}
          </button>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Button size="lg" fullWidth onClick={choose}>
            {mode === 'add' ? t('aggiungi_uno') : t('usa_questa')}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            {t('non_questa')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Ricerca carte con immagini (Scryfall): scrivi il nome, tocca una carta per
 *  vederla grande, tocca ancora la carta per aggiungerla (o la X per scartarla). */
export default function CardPicker({
  mode,
  initialQuery = '',
  section,
  onSectionChange,
  countOf,
  totals,
  onPick,
  onClose,
}: CardPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ScryCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<ScryCard | null>(null);
  const token = useRef(0);

  useEffect(() => {
    const mine = ++token.current;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchScryfall(q);
        if (mine !== token.current) return;
        setResults(found);
        setFailed(false);
      } catch {
        if (mine !== token.current) return;
        setResults([]);
        setFailed(true);
      } finally {
        if (mine === token.current) setSearching(false);
      }
    }, 350);
    return () => { token.current++; window.clearTimeout(timer); };
  }, [query]);

  function choose(card: ScryCard) {
    onPick(card);
    if (mode === 'replace') onClose();
  }

  const sectionBtn = (s: 'main' | 'side', label: string) => (
    <button
      type="button"
      onClick={() => onSectionChange?.(s)}
      aria-pressed={section === s}
      className={cx(
        'rounded-lg border px-4 py-2 text-sm font-semibold transition',
        section === s ? 'border-transparent bg-gradient-to-r from-zaff-primary to-zaff-accent text-zaff-bg' : 'border-zaff-border text-zaff-muted'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zaff-bg text-zaff-text">
      <div className="flex items-center justify-between gap-3 border-b border-zaff-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{mode === 'add' ? t('aggiungi_carte') : t('trova_carta_giusta')}</h2>
          {totals && (
            <p className="text-sm font-semibold text-zaff-muted">
              {t('main_side_totale', { main: totals.main, side: totals.side, total: totals.main + totals.side })}
            </p>
          )}
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-4 pt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoFocus
          placeholder={t('scrivi_nome_della_carta_in')}
          className="w-full rounded-lg border border-zaff-border bg-zaff-surface px-3 py-3 text-base text-zaff-text placeholder:text-zaff-muted"
        />
        {mode === 'add' && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {sectionBtn('main', 'Main Deck')}
            {sectionBtn('side', 'Sideboard')}
          </div>
        )}
        <p className={cx('mt-2', TEXT_MINI)}>
          {searching
            ? t('cerco')
            : failed
              ? t('ricerca_non_riuscita_controlla_connessione')
              : query.trim().length < 2
                ? t('scrivi_almeno_lettere_tocca_una')
                : results.length === 0
                  ? t('nessuna_carta_trovata_con_questo')
                  : `${t('carte_trovate', { count: results.length })}${results.length >= 60 ? ` ${t('mostro_prime_affina_nome', { max: 60 })}` : ''}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        <div className="grid grid-cols-3 gap-2 min-[560px]:grid-cols-4 min-[800px]:grid-cols-5">
          {results.map((c) => {
            const n = countOf(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setPreview(c)}
                className="relative block w-full"
                style={{ aspectRatio: '488 / 680' }}
                aria-label={c.name}
              >
                <img
                  src={c.faces[0].small}
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full rounded-md object-cover"
                />
                {n > 0 && (
                  <Badge tone="count" className="absolute right-1 top-1">
                    ×{n}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {preview && (
        <Preview
          card={preview}
          mode={mode}
          count={countOf(preview.name)}
          onChoose={() => choose(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
