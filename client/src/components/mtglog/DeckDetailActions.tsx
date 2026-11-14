import { useState, type ReactNode } from 'react';
import i18n from '../../i18n';
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
    <div className="grid grid-cols-3 gap-2">
      {tab('deck', deckTo, <CardsIcon className={TAB_ICON} />, i18n.t('scheda_deck'))}
      {tab('stats', statsTo, <BarsIcon className={TAB_ICON} />, i18n.t('scheda_stats'))}
      <Button
        variant={actionsOpen ? 'primary' : 'ghost'}
        className={TAB_CLASS}
        aria-expanded={actionsOpen}
        onClick={onToggleActions}
      >
        <DotsIcon className={TAB_ICON} />
        {i18n.t('azioni')}
      </Button>
    </div>
  );
}

interface DeckSummaryBarProps {
  main: number;
  side: number;
  /** Sezione che si sta guardando scorrendo le carte (null: nessuna in evidenza). */
  highlight: 'main' | 'side' | null;
}

/**
 * Barra sotto i tre tasti (nello stesso blocco fisso, vedi `DeckPageFrame`): totali (il nome è il titolo fisso della pagina). Resta uguale in Deck,
 * Stats e Azioni, che sono tre contenuti della stessa pagina.
 */
/** Colore di "Main Deck"/"Sideboard" nelle barre dei totali: acceso sulla sezione in vista. */
export function sectionTone(highlight: 'main' | 'side' | null, section: 'main' | 'side'): string {
  return highlight === section ? 'text-zaff-accent' : 'text-zaff-muted';
}

export function DeckSummaryBar({ main, side, highlight }: DeckSummaryBarProps) {
  const tone = (section: 'main' | 'side') => sectionTone(highlight, section);
  return (
    <div className="mt-2 rounded-lg border border-zaff-primary bg-zaff-surface px-3 py-2 text-sm font-semibold shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <span aria-current={highlight === 'main' ? 'true' : undefined} className={tone('main')}>Main Deck {main}</span>
        <span aria-current={highlight === 'side' ? 'true' : undefined} className={tone('side')}>Sideboard {side}</span>
        <span className="text-zaff-muted">{i18n.t('totale_n', { n: main + side })}</span>
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
              {i18n.t('modifica_icona')}
            </Button>
          ) : (
            <ButtonRouteLink to={editTo} variant="ghost" fullWidth>
              {i18n.t('modifica_icona')}
            </ButtonRouteLink>
          ))}
        <Button variant="ghost" fullWidth onClick={onShare}>
          {i18n.t('condividi_icona')}
        </Button>
        <Button variant="ghost" fullWidth onClick={onExport}>
          {i18n.t('esporta_icona')}
        </Button>
        {editTo && (
          <Button variant="danger" fullWidth disabled={deleting} onClick={onDelete}>
            {deleting ? i18n.t('cancellazione') : i18n.t('cancella_icona')}
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
    setNotice(i18n.t('file_preparato', { name: deckFileName(deckName) }));
    setManualCopy(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(i18n.t('elenco_copiato_negli_appunti_ora'));
      setManualCopy(false);
    } catch {
      setNotice(i18n.t('non_riesco_usare_appunti_copia'));
      setManualCopy(true);
    }
  }

  return (
    <Modal level={2} title={i18n.t('esporta_mazzo')} subtitle={deckName} onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <Button size="lg" fullWidth className="py-3.5" onClick={handleDownload}>
          {i18n.t('scarica_file_di_testo_txt')}
        </Button>
        <Button variant="ghost" size="lg" fullWidth className="py-3.5" onClick={handleCopy}>
          {i18n.t('copia_negli_appunti')}
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
          aria-label={i18n.t('elenco_del_mazzo')}
          onFocus={(e) => e.currentTarget.select()}
          className={cx(FIELD_CONTROL_SM, 'mt-2 w-full')}
        />
      )}
    </Modal>
  );
}
