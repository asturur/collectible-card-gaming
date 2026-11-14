import { useMemo, useState, type ReactNode } from 'react';
import i18n from '../../i18n';
import type { Game } from './GameList';
import { computeCardStats, inPeriod, MIN_GAMES, SIGNATURE_MIN_GAMES, type CardRow, type Period } from './cardStatsMath';
import { useSavedDeckList } from './useSavedDeck';
import { useDeckImages } from './useDeckImages';
import { CardViewer } from './DeckCards';
import { ManaIcons } from './ManaIcon';
import { getCard } from '../../services/scryfall';
import FilterTabs from '../ui/FilterTabs';
import { SelectField } from '../ui/Field';
import { cx, TEXT_MINI, TEXT_MUTED } from '../ui/styles';
import { ExportCardHost, ExportedImage, ExportHeader, ShareBar, todayIso, todayLabel, useImageExport } from './ImageExport';
import { HowItWorks } from './Faq';
import { paths } from '../../router';

type View = 'played' | 'winners' | 'losers' | 'staples' | 'signature' | 'colors' | 'cursed';

const RANKINGS: { value: View; label: string }[] = [
  { value: 'played', label: 'piu_giocate' },
  { value: 'winners', label: 'piu_vincenti' },
  { value: 'losers', label: 'meno_vincenti' },
];
const EXTRAS: { value: View; label: string }[] = [
  { value: 'staples', label: 'di_base' },
  { value: 'signature', label: 'firme' },
  { value: 'colors', label: 'colori' },
  { value: 'cursed', label: 'maledette' },
];
const VIEW_LABEL = Object.fromEntries([...RANKINGS, ...EXTRAS].map((v) => [v.value, v.label])) as Record<View, string>;
const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'sempre' },
  { value: '30', label: 'ultimi_30_giorni' },
  { value: 'year', label: 'quest_anno' },
];
const COLOR_NAMES = { W: 'bianco', U: 'blu', B: 'nero', R: 'rosso', G: 'verde' } as const;

/** "1 vittoria su 5 partite", "4 vittorie su 6 partite". */
const record = (wins: number, games: number) =>
  `${i18n.t('vittorie_count', { count: wins })} ${i18n.t('su_partite_count', { count: games })}`;

/** Una cifra decimale, con la virgola: 5,1. */
const oneDecimal = (n: number) => n.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const ROW = 'mb-2 flex w-full items-center gap-3 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-left';

/** Percentuale in verde sopra la media del gruppo, in rosso sotto (la media è scritta sopra l'elenco). */
function Pct({ pct, average }: { pct: number; average: number }) {
  return <span className={cx('shrink-0 text-base font-bold tabular-nums', pct >= average ? 'text-success' : 'text-error')}>{pct}%</span>;
}

function Thumb({ card }: { card: CardRow }) {
  const art = getCard(card.name, card.scryfallId)?.faces[0]?.art;
  return art
    ? <img src={art} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded object-cover" />
    : <span className="h-14 w-14 shrink-0 rounded border border-zaff-border bg-zaff-surface" aria-hidden="true" />;
}

/** Riga di una carta: tocco per vederla grande (a schermo); statica nell'immagine esportata. */
function CardLine({ card, rank, heading, detail, value, onOpen }: {
  card: CardRow; rank?: number;
  /** Titolo sopra il nome della carta (in Firme: il giocatore). */
  heading?: string;
  detail: string; value?: ReactNode; onOpen?: () => void;
}) {
  const inner = (
    <>
      {rank !== undefined && <span className="w-5 shrink-0 text-center text-sm font-bold text-zaff-muted">{rank}</span>}
      {onOpen && <Thumb card={card} />}
      <span className="min-w-0 flex-1">
        {heading && <span className="block truncate text-[15px] font-semibold text-zaff-text">{heading}</span>}
        <span className={cx('block truncate text-zaff-text', heading ? 'text-sm' : 'text-[15px]')}>{card.name}</span>
        <span className={cx('block', TEXT_MINI)}>{detail}</span>
      </span>
      {value}
    </>
  );
  return <li>{onOpen ? <button type="button" onClick={onOpen} className={ROW}>{inner}</button> : <div className={ROW}>{inner}</div>}</li>;
}

function Average({ average, note }: { average: number; note: string }) {
  return (
    <p className="mb-3 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-sm text-zaff-text">
      {i18n.t('media_del_gruppo')} <b>{average}%</b> <span className={TEXT_MINI}>· {note}</span>
    </p>
  );
}

/**
 * Statistiche per carta: più giocate, più e meno vincenti, carte di base del gruppo,
 * carta-firma di ogni giocatore, colori e carte "maledette". Filtri per formato e periodo.
 */
export default function CardStats({ games }: { games: Game[] }) {
  const { decks, loading, error } = useSavedDeckList();
  const [format, setFormat] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [view, setView] = useState<View>('played');
  const [openCard, setOpenCard] = useState<CardRow | null>(null);
  const exporter = useImageExport();

  const formats = useMemo(() => [...new Set(games.map((g) => g.format.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')), [games]);
  const filtered = useMemo(() => games.filter((g) => (!format || g.format.trim() === format) && inPeriod(g.date, period)), [games, format, period]);
  const stats = useMemo(
    () => computeCardStats(filtered, decks.map((d) => ({ id: d.id, name: d.name, cards: d.cardRows }))),
    [filtered, decks]
  );

  const cardList: CardRow[] =
    view === 'played' ? stats.played
      : view === 'winners' ? stats.winners
        : view === 'losers' ? stats.losers
          : view === 'staples' ? stats.staples
            : view === 'cursed' ? stats.cursed
              : view === 'signature' ? stats.signatures.map((s) => s.card) : [];
  useDeckImages(cardList.map((c) => ({ name: c.name, scryfallId: c.scryfallId })));

  if (loading) return <p className={TEXT_MUTED}>{i18n.t('caricamento')}</p>;
  if (error) return <p role="alert" className="text-sm text-red-400">{error}</p>;

  const filterLabel = `${format || i18n.t('tutti_formati')} · ${i18n.t(PERIODS.find((p) => p.value === period)!.label)}`;

  /** Contenuto della vista scelta: `interactive` a schermo, statico per l'immagine. */
  function renderView(interactive: boolean) {
    const open = (card: CardRow) => (interactive ? () => setOpenCard(card) : undefined);
    const empty = (text: string) => <p className={TEXT_MUTED}>{text}</p>;
    const fewGames = i18n.t('nessuna_carta_con_almeno_partite', { min: MIN_GAMES });
    switch (view) {
      case 'played':
        return stats.played.length === 0 ? empty(i18n.t('nessuna_carta_in_questo_filtro')) : (
          <ol>{stats.played.map((c, i) => (
            <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)} detail={`${i18n.t('copie_count', { count: c.copies })} ${i18n.t('in_partite_count', { count: c.games })}`} />
          ))}</ol>
        );
      case 'winners':
      case 'losers': {
        const list = view === 'winners' ? stats.winners : stats.losers;
        return list.length === 0 ? empty(fewGames) : (
          <>
            <Average average={stats.average} note={i18n.t('nota_media_vincenti', { min: MIN_GAMES })} />
            <ol>{list.map((c, i) => (
              <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)} detail={record(c.wins, c.games)}
                value={<Pct pct={c.pct} average={stats.average} />} />
            ))}</ol>
          </>
        );
      }
      case 'staples':
        return stats.staples.length === 0 ? empty(i18n.t('nessuna_carta_presente_in_piu')) : (
          <ol>{stats.staples.map((c, i) => (
            <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)} detail={`${i18n.t('in_mazzi_count', { count: c.decks })} · ${i18n.t('partite_count', { count: c.games })}`} />
          ))}</ol>
        );
      case 'cursed':
        return stats.cursed.length === 0 ? empty(i18n.t('nessuna_carta_sotto_media', { min: MIN_GAMES })) : (
          <>
            <Average average={stats.average} note={i18n.t('nota_media_maledette', { min: MIN_GAMES })} />
            <ol>{stats.cursed.map((c, i) => (
              <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)}
                detail={`${record(c.wins, c.games)} · ${i18n.t('attese', { value: oneDecimal(c.wins + c.missed) })}`}
                value={<span className="shrink-0 text-base font-bold tabular-nums text-error" title={i18n.t('vittorie_mancate_rispetto_alla_media')}>−{oneDecimal(c.missed)}</span>} />
            ))}</ol>
          </>
        );
      case 'signature':
        return stats.signatures.length === 0 ? empty(i18n.t('servono_almeno_partite_con_mazzi', { min: SIGNATURE_MIN_GAMES })) : (
          <>
            <p className={cx('mb-3', TEXT_MINI)}>{i18n.t('carta_che_ogni_giocatore_usa')}</p>
            <ul>{stats.signatures.map((s) => (
              <CardLine key={s.player} card={s.card} heading={s.player} onOpen={open(s.card)}
                detail={i18n.t('firma_dettaglio', { games: s.games, total: s.playerGames, pct: s.othersPct })} />
            ))}</ul>
          </>
        );
      case 'colors':
        return stats.colors.length === 0 ? empty(i18n.t('nessuna_partita_con_colori_dei')) : (
          <>
            <Average average={stats.colorsAverage} note={i18n.t('nota_media_colori')} />
            <ul>{stats.colors.map((c) => (
              <li key={c.color} className={ROW}>
                <ManaIcons colors={[c.color]} className="shrink-0 text-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-zaff-text">{i18n.t(COLOR_NAMES[c.color])}</span>
                  <span className={cx('block', TEXT_MINI)}>{record(c.wins, c.games)}</span>
                  <span className="mt-1 block h-2 overflow-hidden rounded bg-black/40">
                    <span className="block h-full rounded bg-gradient-to-r from-zaff-primary to-zaff-accent" style={{ width: `${c.pct}%` }} />
                  </span>
                </span>
                <Pct pct={c.pct} average={stats.colorsAverage} />
              </li>
            ))}</ul>
          </>
        );
    }
  }

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <SelectField label={i18n.t('formato')} density="compact" fieldClassName="mb-0" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">{i18n.t('tutti_formati')}</option>
          {formats.map((f) => <option key={f} value={f}>{f}</option>)}
        </SelectField>
        <SelectField label={i18n.t('periodo')} density="compact" fieldClassName="mb-0" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{i18n.t(p.label)}</option>)}
        </SelectField>
      </div>
      <FilterTabs options={[...RANKINGS, ...EXTRAS].map((o) => ({ ...o, label: i18n.t(o.label) }))} value={view} onChange={(v) => setView(v as View)} className="mb-3" />
      <p className={cx('mb-3', TEXT_MINI)}>
        {i18n.t('in_base_alle_liste_attuali', { lists: stats.gamesWithLists, games: stats.games })}
        {view === 'colors' && ` ${i18n.t('colori_vengono_da_tutte_partite')}`}
      </p>
      <HowItWorks to={paths.faqTopic('cards', view)} className="-mt-2" />

      {renderView(true)}

      {openCard && (
        <CardViewer items={[{ name: openCard.name, scryfallId: openCard.scryfallId, qty: 1 }]} startIndex={0} onClose={() => setOpenCard(null)} />
      )}

      <ExportedImage image={exporter.image} error={exporter.error} alt={i18n.t('statistiche_carte_da_salvare')} />
      <ShareBar
        exporting={exporter.exporting}
        shareTitle={i18n.t('statistiche_carte')}
        onExport={() =>
          exporter.exportImage({
            fileName: `${i18n.t('file_statistiche_carte')}_${view}_${todayIso()}.jpg`,
            shareTitle: i18n.t('statistiche_carte'),
            shareText: i18n.t('statistiche_carte_di_mtg_tracker', { view: i18n.t(VIEW_LABEL[view]) }),
          })
        }
      />
      <ExportCardHost cardRef={exporter.cardRef}>
        <ExportHeader title={`${i18n.t('statistiche_carte')} · ${i18n.t(VIEW_LABEL[view])}`} subtitle={`${filterLabel} · ${i18n.t('aggiornato_al', { date: todayLabel() })}`} />
        {renderView(false)}
      </ExportCardHost>
    </>
  );
}
