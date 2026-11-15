import { useMemo } from 'react';
import i18n from '../../i18n';
import {
  ExportCardHost,
  ExportedImage,
  ExportHeader,
  ShareBar,
  todayIso,
  todayLabel,
  useImageExport,
} from './ImageExport';
import type { Game } from './GameList';
import type { DeckRef } from './deckRefs';
import { HowItWorks } from './Faq';
import { paths } from '../../router';
import { computeTally, PIE_COLORS } from './stats';
import { computeFavoriteDecks, computeMonthly, computeStreaks, monthLabel, monthShortLabel, monthSummary, SHOWN_MONTHS } from './trends';
import { cx, TEXT_MINI, TEXT_MUTED } from '../ui/styles';


const SECTION_TITLE = 'mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-zaff-muted';
const ROW = 'mb-2 flex items-center gap-3 rounded-lg border border-zaff-border bg-zaff-bg px-3.5 py-2.5';

/** Colonne di un grafico a barre: altezza proporzionale al valore più alto, etichetta del mese sotto. */
function Bars({ values, labels, max, color, label }: { values: number[]; labels?: string[]; max: number; color?: string; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-20 items-end gap-1">
        {values.map((v, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            {v > 0 && <span className="mb-0.5 text-[10px] leading-none text-zaff-muted">{v}</span>}
            <div
              className={cx('w-full rounded-t', !color && 'bg-gradient-to-t from-zaff-primary to-zaff-accent')}
              style={{ height: `${max > 0 ? Math.max(v > 0 ? 6 : 2, (v / max) * 100) : 2}%`, background: color, opacity: v > 0 ? 1 : 0.25 }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex gap-1">
          {labels.map((l, i) => (
            <span key={i} className="min-w-0 flex-1 text-center text-[10px] leading-none text-zaff-muted">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Contenuto della pagina: lo stesso a schermo e nell'immagine esportata. */
function TrendsContent({ games, decks }: { games: Game[]; decks: readonly DeckRef[] }) {
  const months = useMemo(() => computeMonthly(games).slice(-SHOWN_MONTHS), [games]);
  const allMonths = useMemo(() => computeMonthly(games), [games]);
  const streaks = useMemo(() => computeStreaks(games), [games]);
  const favorites = useMemo(() => computeFavoriteDecks(games, decks), [games, decks]);
  const players = useMemo(() => computeTally(games).map((r) => r.name), [games]);
  const shortLabels = months.map((m) => monthShortLabel(m.month).slice(0, 3));
  const maxGames = Math.max(0, ...months.map((m) => m.games));
  const maxWins = Math.max(0, ...months.flatMap((m) => Object.values(m.wins)));

  return (
    <>
      <p className="font-semibold text-zaff-text">{monthSummary(allMonths)}</p>

      <h2 className={SECTION_TITLE}>{i18n.t('partite_per_mese')}</h2>
      <Bars
        values={months.map((m) => m.games)}
        labels={shortLabels}
        max={maxGames}
        label={i18n.t('partite_per_mese_da_a', { from: monthLabel(months[0].month), to: monthLabel(months[months.length - 1].month) })}
      />

      <h2 className={SECTION_TITLE}>{i18n.t('vittorie_per_mese')}</h2>
      {players.map((name, i) => (
        <div key={name} className="mb-3">
          <p className="mb-1 flex items-center gap-2 text-sm text-zaff-text">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden="true" />
            <span className="min-w-0 truncate">{name}</span>
          </p>
          <Bars
            values={months.map((m) => m.wins[name] ?? 0)}
            max={maxWins}
            color={PIE_COLORS[i % PIE_COLORS.length]}
            label={i18n.t('vittorie_per_mese_di', { name })}
          />
        </div>
      ))}
      <p className={TEXT_MINI}>{i18n.t('ultimi_mesi_a_partire_da', { count: Math.min(SHOWN_MONTHS, months.length), from: monthLabel(months[0].month) })}</p>

      <h2 className={SECTION_TITLE}>{i18n.t('serie_di_vittorie')}</h2>
      {streaks.map((s) => (
        <div key={s.name} className={ROW}>
          <span className="min-w-0 flex-1 truncate text-[15px] text-zaff-text">{s.name}</span>
          <span className="shrink-0 whitespace-nowrap text-sm text-zaff-muted">
            {i18n.t('in_corso_record', { current: s.current, best: s.best })}
          </span>
        </div>
      ))}

      <h2 className={SECTION_TITLE}>{i18n.t('mazzo_preferito')}</h2>
      {favorites.length === 0 ? (
        <p className={TEXT_MUTED}>{i18n.t('nessuna_partita_con_un_mazzo')}</p>
      ) : (
        favorites.map((f) => (
          <div key={f.name} className={ROW}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-zaff-text">{f.name}</span>
              <span className={cx('block truncate', TEXT_MINI)}>{f.deck}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm text-zaff-muted">
              {i18n.t('partite_count', { count: f.games })} · {i18n.t('vinte_count', { count: f.wins })}
            </span>
          </div>
        ))
      )}
    </>
  );
}

/** Andamento nel tempo: partite e vittorie per mese, serie di vittorie, mazzo preferito. Esportabile in immagine. */
export default function TrendsStats({ games, decks }: { games: Game[]; decks: readonly DeckRef[] }) {
  const exporter = useImageExport();

  if (games.length === 0) {
    return <p className={TEXT_MUTED}>{i18n.t('ancora_nessuna_partita_registrata_andamento')}</p>;
  }

  return (
    <>
      <HowItWorks to={paths.faqTopic('trends')} />
      <TrendsContent games={games} decks={decks} />

      <ExportedImage image={exporter.image} error={exporter.error} alt={i18n.t('andamento_nel_tempo_da_salvare')} />
      <ShareBar
        exporting={exporter.exporting}
        shareTitle={i18n.t('andamento')}
        onExport={() =>
          exporter.exportImage({
            fileName: `${i18n.t('file_andamento')}_${todayIso()}.jpg`,
            shareTitle: i18n.t('andamento'),
            shareText: i18n.t('andamento_nel_tempo_di_mtg_tracker'),
          })
        }
      />

      <ExportCardHost cardRef={exporter.cardRef}>
        <ExportHeader title={i18n.t('andamento')} subtitle={`${i18n.t('statistiche_nel_tempo')} · ${i18n.t('aggiornato_al', { date: todayLabel() })}`} />
        <TrendsContent games={games} decks={decks} />
      </ExportCardHost>
    </>
  );
}
