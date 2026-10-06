import { useMemo, useState } from 'react';
import type { Game } from './GameList';
import type { TallyRow } from './stats';
import { PIE_COLORS, pieSlicePath } from './stats';
import GlossyPie from './GlossyPie';
import {
  ExportButton,
  ExportCardHost,
  ExportedImage,
  ExportHeader,
  todayIso,
  todayLabel,
  useImageExport,
} from './ImageExport';
import Modal from '../ui/Modal';
import { cx, HEADING_SECTION, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface StandingsProps {
  rows: TallyRow[];
  /** Serve a calcolare, per il giocatore aperto nel dettaglio, quali mazzi ha
   *  usato lui — solo le sue partite, non quelle giocate da altri con lo
   *  stesso mazzo. */
  games: Game[];
  /** La torta compare solo quando si guarda un gruppo preciso, come nell'originale. */
  showPie: boolean;
}

const WIN_COLOR = '#f5c451'; // zaff-gold
const LOSS_COLOR = '#334155'; // zaff-border

/** Mini-torta vinte/perse per la riga di un giocatore nell'elenco: stessi
 *  due colori (oro = vinte, grigio = perse) della torta grande nel suo
 *  dettaglio, per restare coerenti anche in piccolo. */
function MiniWinLossPie({ pct }: { pct: number }) {
  const slice = pct > 0 ? pieSlicePath(15, 15, 13, 0, Math.min(pct * 3.6, 359.9)) : '';
  return (
    <svg viewBox="0 0 30 30" width="30" height="30" className="shrink-0" aria-hidden="true">
      <circle cx="15" cy="15" r="13" fill="none" stroke={LOSS_COLOR} strokeWidth="2" />
      {slice && <path d={slice} fill={WIN_COLOR} />}
    </svg>
  );
}

/** Torta di gruppo (come si dividono tutte le vittorie) con la sua legenda. */
function GroupPieSection({ rows, idSuffix }: { rows: TallyRow[]; idSuffix: string }) {
  const winners = rows.filter((t) => t.w > 0);
  const totalWins = rows.reduce((sum, t) => sum + t.w, 0);
  if (totalWins === 0) return null;

  let angle = 0;
  const slices = winners.map((t, i) => {
    const share = (t.w / totalWins) * 360;
    const path = pieSlicePath(70, 70, 68, angle, angle + share);
    angle += share;
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], name: t.name, w: t.w, key: t.name };
  });

  return (
    <div>
      <p className="mb-2 text-xs text-zaff-muted">
        Come si dividono tutte le {totalWins} vittorie registrate, tra i giocatori:
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <GlossyPie slices={slices} idSuffix={idSuffix} />
        <div className="flex flex-col gap-1.5 text-sm text-zaff-muted">
          {slices.map((s) => (
            <div key={s.name} className="text-zaff-text">
              <span
                className="mr-1.5 inline-block h-[11px] w-[11px] rounded-full align-[-1px]"
                style={{ background: s.color }}
              />
              {s.name} — {Math.round((s.w / totalWins) * 100)}% delle vittorie totali ({s.w} di {totalWins})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Elenco giocatori: una riga ciascuno, solo nome e mini-torta. Con `onSelect`
 *  le righe sono toccabili (apre il dettaglio); senza, è la versione statica
 *  per l'immagine esportata. */
function PlayerRows({ rows, onSelect }: { rows: TallyRow[]; onSelect?: (name: string) => void }) {
  return (
    <ul className="mt-4">
      {rows.map((t) => {
        const pct = t.g ? (t.w / t.g) * 100 : 0;
        const content = (
          <>
            <span className="min-w-0 truncate text-[15px] font-medium text-zaff-text">{t.name}</span>
            <MiniWinLossPie pct={pct} />
          </>
        );
        return (
          <li key={t.name}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(t.name)}
                className="flex w-full items-center justify-between gap-3 border-b border-zaff-border py-2.5 text-left transition last:border-b-0 hover:border-zaff-primary"
              >
                {content}
              </button>
            ) : (
              <div className="flex w-full items-center justify-between gap-3 border-b border-zaff-border py-2.5 last:border-b-0">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** La schermata "Statistiche Giocatori" com'è, ma statica: è questa che
 *  finisce nell'immagine esportata. */
function PlayersStatsCard({ rows, showPie }: { rows: TallyRow[]; showPie: boolean }) {
  return (
    <>
      <ExportHeader title="Statistiche Giocatori" subtitle={`Aggiornato al ${todayLabel()}`} />
      {showPie && <GroupPieSection rows={rows} idSuffix="group-export" />}
      <PlayerRows rows={rows} />
    </>
  );
}

/**
 * Statistiche giocatori: in cima la torta di gruppo (come si dividono tutte
 * le vittorie), poi l'elenco dei giocatori — una riga ciascuno, solo nome e
 * mini-torta vinte/perse — e cliccando su un giocatore si apre il suo
 * dettaglio: torta personale, partite giocate/vinte, mazzi usati con
 * percentuale di vittoria propria (quella SUA con quel mazzo, non quella
 * del mazzo in generale se lo hanno usato anche altri).
 */
export default function Standings({ rows, games, showPie }: StandingsProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const exporter = useImageExport();

  const selectedRow = rows.find((r) => r.name === selectedName) ?? null;
  const selectedPct = selectedRow && selectedRow.g ? Math.round((selectedRow.w / selectedRow.g) * 100) : 0;
  const selectedSlices =
    selectedRow && selectedRow.g
      ? [
          selectedRow.w > 0
            ? { path: pieSlicePath(60, 60, 58, 0, Math.min(selectedPct * 3.6, 359.9)), color: WIN_COLOR, key: 'w' }
            : null,
          selectedRow.w < selectedRow.g
            ? { path: pieSlicePath(60, 60, 58, Math.min(selectedPct * 3.6, 359.9), 360), color: LOSS_COLOR, key: 'l' }
            : null,
        ].filter((s): s is { path: string; color: string; key: string } => s !== null)
      : [];

  /** Mazzi usati dal giocatore aperto, solo le SUE partite: stesso identico
   *  calcolo di `computeDeckStats` in GameStats.tsx ma filtrato su un solo
   *  giocatore, così un mazzo condiviso col gruppo mostra qui solo quanto è
   *  andato bene a lui, non il suo risultato complessivo. */
  const selectedDeckStats = useMemo(() => {
    if (!selectedName) return [];
    const tally: Record<string, { g: number; w: number }> = {};
    games.forEach((g) => {
      g.players.forEach((p) => {
        if (p.name !== selectedName) return;
        const deck = (p.deck || '').trim() || 'Mazzo non indicato';
        tally[deck] = tally[deck] || { g: 0, w: 0 };
        tally[deck].g++;
        if (p.winner) tally[deck].w++;
      });
    });
    return Object.entries(tally)
      .map(([deck, t]) => ({ deck, g: t.g, w: t.w, pct: t.g ? Math.round((t.w / t.g) * 100) : 0 }))
      .sort((a, b) => b.g - a.g || b.pct - a.pct);
  }, [selectedName, games]);

  if (rows.length === 0) {
    return <p className={cx('mt-4', TEXT_MUTED)}>Ancora nessuna partita qui: la classifica compare da qui.</p>;
  }

  return (
    <>
      {showPie && <GroupPieSection rows={rows} idSuffix="group" />}

      <PlayerRows rows={rows} onSelect={setSelectedName} />

      <div className="mt-4">
        <ExportButton
          exporting={exporter.exporting}
          onClick={() =>
            exporter.exportImage({
              fileName: `statistiche_giocatori_${todayIso()}.jpg`,
              shareTitle: 'Statistiche Giocatori',
              shareText: 'Statistiche giocatori del registro partite di Magic',
            })
          }
        />
      </div>
      <ExportedImage image={exporter.image} error={exporter.error} alt="Statistiche giocatori, da salvare" />
      <ExportCardHost cardRef={exporter.cardRef}>
        <PlayersStatsCard rows={rows} showPie={showPie} />
      </ExportCardHost>

      {selectedRow && (
        <Modal level={2} title={selectedRow.name} onClose={() => setSelectedName(null)}>
          <div className="flex flex-wrap items-center gap-5">
            <GlossyPie slices={selectedSlices} size={120} idSuffix="player" />
            <div className="text-sm text-zaff-muted">
              <p className={HEADING_SECTION}>{selectedPct}%</p>
              <p>
                {selectedRow.g} partite giocate · {selectedRow.w} vinte
              </p>
            </div>
          </div>

          <p className={cx('mb-1.5 mt-5', TEXT_MINI)}>Mazzi usati</p>
          {selectedDeckStats.length === 0 ? (
            <p className={TEXT_MUTED}>Nessun mazzo indicato nelle sue partite.</p>
          ) : (
            <div>
              {selectedDeckStats.map((d) => (
                <div key={d.deck} className="border-b border-zaff-border py-2.5 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <b className="min-w-0 truncate text-[15px] font-semibold text-zaff-text">{d.deck}</b>
                    <span className="shrink-0 whitespace-nowrap text-[13px] text-zaff-muted">
                      {d.g} partite · {d.w} vinte · {d.pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-[7px] overflow-hidden rounded bg-zaff-bg">
                    <div className="h-full rounded bg-zaff-gold" style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
