import { useMemo, useState, type ReactNode } from 'react';
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
  { value: 'played', label: 'Più giocate' },
  { value: 'winners', label: 'Più vincenti' },
  { value: 'losers', label: 'Meno vincenti' },
];
const EXTRAS: { value: View; label: string }[] = [
  { value: 'staples', label: 'Di base' },
  { value: 'signature', label: 'Firme' },
  { value: 'colors', label: 'Colori' },
  { value: 'cursed', label: 'Maledette' },
];
const VIEW_LABEL = Object.fromEntries([...RANKINGS, ...EXTRAS].map((v) => [v.value, v.label])) as Record<View, string>;
const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Sempre' },
  { value: '30', label: 'Ultimi 30 giorni' },
  { value: 'year', label: "Quest'anno" },
];
const COLOR_NAMES = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde' } as const;

/** "1 vittoria su 5 partite", "4 vittorie su 6 partite". */
const record = (wins: number, games: number) =>
  `${wins} ${wins === 1 ? 'vittoria' : 'vittorie'} su ${games} ${games === 1 ? 'partita' : 'partite'}`;

/** Una cifra decimale, con la virgola: 5,1. */
const oneDecimal = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
      Media del gruppo: <b>{average}%</b> <span className={TEXT_MINI}>· {note}</span>
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

  if (loading) return <p className={TEXT_MUTED}>Caricamento…</p>;
  if (error) return <p role="alert" className="text-sm text-red-400">{error}</p>;

  const filterLabel = `${format || 'Tutti i formati'} · ${PERIODS.find((p) => p.value === period)!.label}`;

  /** Contenuto della vista scelta: `interactive` a schermo, statico per l'immagine. */
  function renderView(interactive: boolean) {
    const open = (card: CardRow) => (interactive ? () => setOpenCard(card) : undefined);
    const empty = (text: string) => <p className={TEXT_MUTED}>{text}</p>;
    const fewGames = `Nessuna carta con almeno ${MIN_GAMES} partite in questo filtro.`;
    switch (view) {
      case 'played':
        return stats.played.length === 0 ? empty('Nessuna carta in questo filtro.') : (
          <ol>{stats.played.map((c, i) => (
            <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)} detail={`${c.copies} copie in ${c.games} ${c.games === 1 ? 'partita' : 'partite'}`} />
          ))}</ol>
        );
      case 'winners':
      case 'losers': {
        const list = view === 'winners' ? stats.winners : stats.losers;
        return list.length === 0 ? empty(fewGames) : (
          <>
            <Average average={stats.average} note={`sopra questa percentuale una carta vince più del normale. Almeno ${MIN_GAMES} partite.`} />
            <ol>{list.map((c, i) => (
              <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)} detail={record(c.wins, c.games)}
                value={<Pct pct={c.pct} average={stats.average} />} />
            ))}</ol>
          </>
        );
      }
      case 'staples':
        return stats.staples.length === 0 ? empty('Nessuna carta presente in più mazzi in questo filtro.') : (
          <ol>{stats.staples.map((c, i) => (
            <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)} detail={`in ${c.decks} mazzi · ${c.games} partite`} />
          ))}</ol>
        );
      case 'cursed':
        return stats.cursed.length === 0 ? empty(`Nessuna carta con almeno ${MIN_GAMES} partite sotto la media… per ora.`) : (
          <>
            <Average average={stats.average} note={`le carte che hanno mancato più vittorie rispetto a questa media. Almeno ${MIN_GAMES} partite.`} />
            <ol>{stats.cursed.map((c, i) => (
              <CardLine key={c.key} card={c} rank={i + 1} onOpen={open(c)}
                detail={`${record(c.wins, c.games)} · attese ${oneDecimal(c.wins + c.missed)}`}
                value={<span className="shrink-0 text-base font-bold tabular-nums text-error" title="Vittorie mancate rispetto alla media">−{oneDecimal(c.missed)}</span>} />
            ))}</ol>
          </>
        );
      case 'signature':
        return stats.signatures.length === 0 ? empty(`Servono almeno ${SIGNATURE_MIN_GAMES} partite con mazzi salvati per giocatore.`) : (
          <>
            <p className={cx('mb-3', TEXT_MINI)}>La carta che ogni giocatore usa più spesso, rispetto a quanto la usano gli altri.</p>
            <ul>{stats.signatures.map((s) => (
              <CardLine key={s.player} card={s.card} heading={s.player} onOpen={open(s.card)}
                detail={`in ${s.games} delle sue ${s.playerGames} partite · negli altri ${s.othersPct}%`} />
            ))}</ul>
          </>
        );
      case 'colors':
        return stats.colors.length === 0 ? empty('Nessuna partita con i colori dei mazzi segnati.') : (
          <>
            <Average average={stats.colorsAverage} note="dei giocatori con i colori del mazzo segnati: sopra questa percentuale un colore vince più del normale." />
            <ul>{stats.colors.map((c) => (
              <li key={c.color} className={ROW}>
                <ManaIcons colors={[c.color]} className="shrink-0 text-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-zaff-text">{COLOR_NAMES[c.color]}</span>
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
        <SelectField label="Formato" density="compact" fieldClassName="mb-0" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Tutti i formati</option>
          {formats.map((f) => <option key={f} value={f}>{f}</option>)}
        </SelectField>
        <SelectField label="Periodo" density="compact" fieldClassName="mb-0" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </SelectField>
      </div>
      <FilterTabs options={RANKINGS} value={view} onChange={(v) => setView(v as View)} className="mb-2" />
      <FilterTabs options={EXTRAS} value={view} onChange={(v) => setView(v as View)} className="mb-3" />
      <p className={cx('mb-3', TEXT_MINI)}>
        In base alle liste attuali dei mazzi · {stats.gamesWithLists} partite su {stats.games} con lista carte · solo Main Deck, terre escluse.
        {view === 'colors' && ' I colori vengono da tutte le partite del filtro.'}
      </p>
      <HowItWorks to={paths.faqTopic('cards', view)} className="-mt-2" />

      {renderView(true)}

      {openCard && (
        <CardViewer items={[{ name: openCard.name, scryfallId: openCard.scryfallId, qty: 1 }]} startIndex={0} onClose={() => setOpenCard(null)} />
      )}

      <ExportedImage image={exporter.image} error={exporter.error} alt="Statistiche carte, da salvare" />
      <ShareBar
        exporting={exporter.exporting}
        shareTitle="Statistiche Carte"
        onExport={() =>
          exporter.exportImage({
            fileName: `statistiche_carte_${view}_${todayIso()}.jpg`,
            shareTitle: 'Statistiche Carte',
            shareText: `Statistiche carte del registro partite di Magic: ${VIEW_LABEL[view]}`,
          })
        }
      />
      <ExportCardHost cardRef={exporter.cardRef}>
        <ExportHeader title={`Statistiche Carte · ${VIEW_LABEL[view]}`} subtitle={`${filterLabel} · aggiornato al ${todayLabel()}`} />
        {renderView(false)}
      </ExportCardHost>
    </>
  );
}
