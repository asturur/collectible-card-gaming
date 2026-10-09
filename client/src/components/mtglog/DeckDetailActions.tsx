import { useState, type ReactNode } from 'react';
import Button, { ButtonRouteLink } from '../ui/Button';
import Modal from '../ui/Modal';
import { BarsIcon, CardsIcon, DotsIcon } from '../ui/NavIcons';
import { cx, FIELD_CONTROL_SM, TEXT_MINI } from '../ui/styles';
import { appHref, paths } from '../../router';
import { deckFileName, formatDeckText } from '../../services/deckExport';
import type { DeckEntry } from '../../services/deckCards';

/** Indirizzo che riapre l'app direttamente su questo mazzo (serve il login, come per tutto il registro). */
export function deckLink(deckId: string): string {
  return `${window.location.origin}${appHref(paths.deck(deckId))}`;
}

const TAB_CLASS = 'w-full gap-1.5 px-1';
const TAB_ICON = 'size-5 shrink-0';

interface DeckTabsProps {
  /** Pagina in cui ci si trova: quel tasto è quello pieno (finché il pannello azioni è chiuso). */
  active: 'deck' | 'stats';
  deckTo: string;
  statsTo: string;
  actionsOpen: boolean;
  onShowPage: () => void;
  onToggleActions: () => void;
}

/**
 * Tre tasti affiancati, fissi in cima alle pagine del mazzo (Deck e Stats):
 * Deck (carte), Stats (statistiche) e Azioni (modifica, condividi, esporta, cancella).
 */
export function DeckTabs({ active, deckTo, statsTo, actionsOpen, onShowPage, onToggleActions }: DeckTabsProps) {
  const variantFor = (tab: 'deck' | 'stats') => (!actionsOpen && active === tab ? 'primary' : 'ghost');
  const tab = (id: 'deck' | 'stats', to: string, icon: ReactNode, label: string) =>
    active === id ? (
      <Button variant={variantFor(id)} className={TAB_CLASS} aria-current={actionsOpen ? undefined : 'page'} onClick={onShowPage}>
        {icon}
        {label}
      </Button>
    ) : (
      <ButtonRouteLink to={to} variant={variantFor(id)} className={TAB_CLASS} onClick={onShowPage}>
        {icon}
        {label}
      </ButtonRouteLink>
    );
  return (
    <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-1 mb-2 grid grid-cols-3 gap-2 bg-zaff-surface px-1 pb-2 pt-1">
      {tab('deck', deckTo, <CardsIcon className={TAB_ICON} />, 'Deck')}
      {tab('stats', statsTo, <BarsIcon className={TAB_ICON} />, 'Stats')}
      <Button
        variant={actionsOpen ? 'primary' : 'ghost'}
        className={TAB_CLASS}
        aria-expanded={actionsOpen}
        onClick={onToggleActions}
      >
        <DotsIcon className={TAB_ICON} />
        Azioni
      </Button>
    </div>
  );
}

interface DeckSummaryBarProps {
  title: string;
  main: number;
  side: number;
  /** Sezione che si sta guardando scorrendo le carte (null: nessuna in evidenza). */
  highlight: 'main' | 'side' | null;
}

/**
 * Barra fissa sotto i tre tasti: nome del mazzo e totali. Resta uguale in Deck,
 * Stats e Azioni, che sono tre contenuti della stessa pagina.
 */
export function DeckSummaryBar({ title, main, side, highlight }: DeckSummaryBarProps) {
  const tone = (section: 'main' | 'side') => (highlight === section ? 'text-zaff-accent' : 'text-zaff-muted');
  return (
    <div className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-10 -mx-1 mb-3 rounded-lg border border-zaff-primary bg-zaff-surface px-3 py-2 text-sm font-semibold shadow-lg">
      <p className="mb-1 truncate text-base font-bold text-zaff-text" title={title}>{title}</p>
      <div className="flex items-center justify-between gap-2">
        <span aria-current={highlight === 'main' ? 'true' : undefined} className={tone('main')}>Main Deck {main}</span>
        <span aria-current={highlight === 'side' ? 'true' : undefined} className={tone('side')}>Sideboard {side}</span>
        <span className="text-zaff-muted">Totale {main + side}</span>
      </div>
    </div>
  );
}

interface DeckActionsPanelProps {
  /** Solo per i mazzi propri: modifica e cancellazione. */
  editTo: string | null;
  deleting: boolean;
  onDelete: () => void;
  onShare: () => void;
  onExport: () => void;
  notice: string;
}

export function DeckActionsPanel({ editTo, deleting, onDelete, onShare, onExport, notice }: DeckActionsPanelProps) {
  return (
    <div className="mb-3 rounded-lg border border-zaff-border bg-zaff-bg p-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {editTo &&
          (deleting ? (
            <Button variant="ghost" fullWidth disabled>
              ✏️ Modifica
            </Button>
          ) : (
            <ButtonRouteLink to={editTo} variant="ghost" fullWidth>
              ✏️ Modifica
            </ButtonRouteLink>
          ))}
        <Button variant="ghost" fullWidth onClick={onShare}>
          🔗 Condividi
        </Button>
        <Button variant="ghost" fullWidth onClick={onExport}>
          ⬇️ Esporta
        </Button>
        {editTo && (
          <Button variant="danger" fullWidth disabled={deleting} onClick={onDelete}>
            {deleting ? 'Cancellazione…' : '🗑️ Cancella'}
          </Button>
        )}
      </div>
      {notice && (
        <p className={cx('mt-2 break-all', TEXT_MINI)} role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

interface DeckExportDialogProps {
  deckName: string;
  cards: DeckEntry[];
  onClose: () => void;
}

/** Scelta tra file di testo e copia negli appunti: stesso testo, leggibile da ManaBox e dalle app simili. */
export function DeckExportDialog({ deckName, cards, onClose }: DeckExportDialogProps) {
  const text = formatDeckText(cards);
  const [notice, setNotice] = useState('');
  /** Se gli appunti non sono disponibili, il testo si mostra qui da copiare a mano. */
  const [manualCopy, setManualCopy] = useState(false);

  function handleDownload() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = deckFileName(deckName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNotice('File preparato: ' + deckFileName(deckName));
    setManualCopy(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Elenco copiato negli appunti: ora puoi incollarlo in un’altra app.');
      setManualCopy(false);
    } catch {
      setNotice('Non riesco a usare gli appunti: copia il testo qui sotto.');
      setManualCopy(true);
    }
  }

  return (
    <Modal level={2} title="Esporta mazzo" subtitle={deckName} onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <Button size="lg" fullWidth className="py-3.5" onClick={handleDownload}>
          📄 Scarica file di testo (.txt)
        </Button>
        <Button variant="ghost" size="lg" fullWidth className="py-3.5" onClick={handleCopy}>
          📋 Copia negli appunti
        </Button>
      </div>
      {notice && (
        <p className={cx('mt-3', TEXT_MINI)} role="status">
          {notice}
        </p>
      )}
      {manualCopy && (
        <textarea
          readOnly
          value={text}
          rows={8}
          aria-label="Elenco del mazzo"
          onFocus={(e) => e.currentTarget.select()}
          className={cx(FIELD_CONTROL_SM, 'mt-2 w-full')}
        />
      )}
    </Modal>
  );
}
