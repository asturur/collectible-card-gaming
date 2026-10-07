import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getCard, getToken, type ScryToken } from '../../services/scryfall';
import { useDeckImages, useTokenImages } from './useDeckImages';
import GlossyPie from './GlossyPie';
import { computeDeckStats, computeTokens, MANA_COLORS, MANA_LABELS, type CurveKey, type Slice } from './deckMath';
import { pieSlicePath } from './stats';
import Button, { ButtonRouteLink } from '../ui/Button';
import Modal from '../ui/Modal';
import CloseButton from '../ui/CloseButton';
import { cx, TEXT_MINI } from '../ui/styles';

interface DeckStatsItem {
  name: string;
  scryfallId?: string | null;
  qty: number;
  section?: string;
}

function ChartTitle({ children, note }: { children: string; note?: string }) {
  return (
    <div className="mb-3 mt-9 border-b border-zaff-border pb-1">
      <h3 className="text-[15px] font-bold text-zaff-text">{children}</h3>
      {note && <p className={TEXT_MINI}>{note}</p>}
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

/** Torta con legenda (colore, nome, percentuale e valore). */
function PieChart({ slices, idSuffix, unit }: { slices: Slice[]; idSuffix: string; unit: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className={TEXT_MINI}>Nessun dato.</p>;
  let angle = 0;
  const paths = slices.map((s) => {
    const share = (s.value / total) * 360;
    const path = pieSlicePath(70, 70, 68, angle, angle + share);
    angle += share;
    return { path, color: s.color, key: s.key };
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <GlossyPie slices={paths} idSuffix={idSuffix} />
      <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-zaff-text">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-white/30"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 whitespace-nowrap text-zaff-muted">
              {Math.round((s.value / total) * 100)}% · {fmt(s.value)} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CURVE_HEIGHT = 150;

export default function DeckStatsContents({ cards }: { cards: DeckStatsItem[] }) {
  useDeckImages(cards);
  const stats = computeDeckStats(cards, getCard);
  const [openToken, setOpenToken] = useState<ScryToken | null>(null);
  // Come in ManaBox: con l'interruttore acceso, il mana generico dei costi
  // ({1}, {2}…) entra nella torta come fetta grigia "Incolore".
  const [countColorless, setCountColorless] = useState(false);
  const costSlices: Slice[] = !countColorless || stats.genericCost === 0
    ? stats.costPie
    : (() => {
        const hasC = stats.costPie.some((x) => x.key === 'C');
        const merged = stats.costPie.map((x) => (x.key === 'C' ? { ...x, value: x.value + stats.genericCost } : x));
        return hasC
          ? merged
          : [...merged, { key: 'C', label: MANA_LABELS.C, value: stats.genericCost, color: MANA_COLORS.C }];
      })();

  // I token si chiedono dopo le carte: servono prima gli id che le carte dichiarano.
  const tokenIds = cards
    .filter((c) => c.section !== 'side')
    .flatMap((c) => getCard(c.name, c.scryfallId)?.tokens.map((t) => t.id) ?? []);
  useTokenImages(tokenIds);
  const tokens = computeTokens(cards, getCard, getToken);
  const maxToken = Math.max(1, ...tokens.groups.map((g) => g.count));

  const maxBar = Math.max(1, ...stats.curve.map((b) => b.total));
  const usedKeys = new Set<CurveKey>();
  stats.curve.forEach((b) => b.segments.forEach((s) => usedKeys.add(s.key)));
  const legendKeys = (['W', 'U', 'B', 'R', 'G', 'M', 'C'] as CurveKey[]).filter((k) => usedKeys.has(k));

  return (
    <>
      <p className={cx('mb-3', TEXT_MINI)}>
        Solo Main Deck · {stats.total} carte
        {stats.unknown > 0 && ` (${stats.unknown} non ancora riconosciute da Scryfall: non sono contate)`}
      </p>

      <ChartTitle note="Terre escluse. Le carte multicolore hanno il segmento oro.">Valore di mana</ChartTitle>
      <div className="flex items-end justify-between gap-1.5" style={{ height: CURVE_HEIGHT + 22 }}>
        {stats.curve.map((b) => (
          <div key={b.value} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-0.5 text-xs font-bold text-zaff-text">{b.total > 0 ? b.total : ''}</span>
            <div
              className="flex w-full flex-col-reverse overflow-hidden rounded-t"
              style={{ height: (b.total / maxBar) * CURVE_HEIGHT }}
            >
              {b.segments.map((s) => (
                <div
                  key={s.key}
                  style={{ flexGrow: s.n, background: MANA_COLORS[s.key], flexBasis: 0 }}
                  className="border-t border-black/30 first:border-t-0"
                  title={`${MANA_LABELS[s.key]}: ${s.n}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-1.5 border-t border-zaff-border pt-1">
        {stats.curve.map((b) => (
          <span key={b.value} className="min-w-0 flex-1 text-center text-xs font-semibold text-zaff-muted">
            {b.value === stats.curve.length - 1 ? `${b.value}+` : b.value}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zaff-muted">
        {legendKeys.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-white/30" style={{ background: MANA_COLORS[k] }} />
            {MANA_LABELS[k]}
          </span>
        ))}
      </div>

      <ChartTitle
        note={
          countColorless
            ? 'Simboli colorati nei costi (GG = 2 verde; {W/U} = ½ + ½) più il mana incolore/generico ({1}, {2}…).'
            : 'Simboli colorati nei costi (GG = 2 verde; {W/U} = ½ + ½). Il mana generico non conta.'
        }
      >
        Costi di mana
      </ChartTitle>
      <PieChart slices={costSlices} idSuffix="deckstats-cost" unit="simboli" />
      <button
        type="button"
        role="switch"
        aria-checked={countColorless}
        onClick={() => setCountColorless((v) => !v)}
        className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-zaff-border px-3 text-left text-sm text-zaff-text transition active:scale-[0.99]"
      >
        <span>Conta il mana incolore</span>
        <span
          className={cx(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            countColorless ? 'bg-gradient-to-r from-zaff-primary to-zaff-accent' : 'bg-zaff-border'
          )}
        >
          <span
            className={cx(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
              countColorless ? 'left-[22px]' : 'left-0.5'
            )}
          />
        </span>
      </button>

      <ChartTitle note="Ogni fonte vale 1, divisa tra i colori che può fare (terra doppia ½ + ½, tripla ⅓ ciascuno).">
        Produzione di mana
      </ChartTitle>
      <PieChart slices={stats.productionPie} idSuffix="deckstats-prod" unit="fonti" />

      <ChartTitle>Tipi di carte</ChartTitle>
      <PieChart slices={stats.typePie} idSuffix="deckstats-types" unit="carte" />

      {stats.subtypes.map((chart) => {
        const max = Math.max(1, ...chart.rows.map((r) => r.n));
        return (
          <div key={chart.title}>
            <ChartTitle>{`Sottotipi · ${chart.title}`}</ChartTitle>
            <div className="flex flex-col gap-2">
              {chart.rows.map((r) => (
                <div key={r.name} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate text-zaff-text">{r.name}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-black/30">
                    <div
                      className="h-full rounded bg-gradient-to-r from-zaff-primary to-zaff-accent"
                      style={{ width: `${(r.n / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right font-bold text-zaff-text">{r.n}</span>
                </div>
              ))}
            </div>
            {chart.hidden > 0 && <p className={cx('mt-1.5', TEXT_MINI)}>+ altri {chart.hidden} sottotipi meno frequenti</p>}
          </div>
        );
      })}

      {(tokens.groups.length > 0 || tokens.pending > 0) && (
        <>
          <ChartTitle note="Token che le carte del Main Deck possono creare. Tocca l'immagine per vedere tutto il token.">
            Token
          </ChartTitle>
          <div className="flex flex-col gap-3">
            {tokens.groups.map((g) => (
              <div key={g.key} className="flex items-start gap-3 rounded-lg border border-zaff-border bg-zaff-bg p-2.5">
                <button
                  type="button"
                  onClick={() => setOpenToken(g.token)}
                  aria-label={`Mostra il token ${g.label}`}
                  className="shrink-0"
                >
                  <img
                    src={g.token.art}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 rounded object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-bold text-zaff-text">Token {g.label}</span>
                    <span className="shrink-0 font-bold text-zaff-text">{g.count}</span>
                  </div>
                  <div className="mt-1 h-4 overflow-hidden rounded bg-black/30">
                    <div
                      className="h-full rounded bg-gradient-to-r from-zaff-primary to-zaff-accent"
                      style={{ width: `${(g.count / maxToken) * 100}%` }}
                    />
                  </div>
                  {g.text && <p className={cx('mt-1 line-clamp-2', TEXT_MINI)}>{g.text}</p>}
                  <p className="mt-1 text-xs leading-snug text-zaff-muted">
                    {g.cards.map((c) => (c.qty > 1 ? `${c.name} ×${c.qty}` : c.name)).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {tokens.pending > 0 && <p className={cx('mt-2', TEXT_MINI)}>Carico altri token…</p>}
        </>
      )}

      {openToken && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenToken(null)}
          role="dialog"
          aria-label={openToken.name}
        >
          <CloseButton onClick={() => setOpenToken(null)} surface="image"
            className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))]" />
          <img
            src={openToken.normal}
            alt={openToken.name}
            className="max-h-full max-w-full rounded-xl object-contain"
            style={{ aspectRatio: '488 / 680' }}
          />
        </div>
      )}
    </>
  );
}

function HistogramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="12" width="4.5" height="9" rx="1" />
      <rect x="9.75" y="4" width="4.5" height="17" rx="1" />
      <rect x="16.5" y="9" width="4.5" height="12" rx="1" />
    </svg>
  );
}

/** Saved-deck statistics have a refreshable page. */
export function DeckStatsLink({ to }: { to: string }) {
  return (
    <ButtonRouteLink to={to} size="lg" fullWidth>
      <HistogramIcon />
      Statistiche del mazzo
    </ButtonRouteLink>
  );
}

/** Local editor preview computes statistics from the current unsaved draft. */
export function DeckStatsButton({ cards, deckName }: { cards: DeckStatsItem[]; deckName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" fullWidth onClick={() => setOpen(true)} aria-label="Statistiche del mazzo">
        <HistogramIcon />
        Statistiche del mazzo
      </Button>
      {open &&
        createPortal(
          <Modal level={2} title="Statistiche mazzo" subtitle={deckName} onClose={() => setOpen(false)}>
            <DeckStatsContents cards={cards} />
          </Modal>,
          document.body
        )}
    </>
  );
}
