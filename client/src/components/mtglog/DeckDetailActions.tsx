import { useState } from 'react';
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

const TAB_CLASS = 'h-16 min-h-16 w-full flex-col gap-0.5 px-1 text-xs';

interface DeckTabsProps {
  statsTo: string;
  actionsOpen: boolean;
  onShowDeck: () => void;
  onToggleActions: () => void;
}

/** Tre tasti affiancati in cima al mazzo: Deck (carte), Stats (statistiche) e Azioni (modifica, condividi, esporta, cancella). */
export function DeckTabs({ statsTo, actionsOpen, onShowDeck, onToggleActions }: DeckTabsProps) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      <Button variant={actionsOpen ? 'ghost' : 'primary'} className={TAB_CLASS} aria-current="page" onClick={onShowDeck}>
        <CardsIcon />
        Deck
      </Button>
      <ButtonRouteLink to={statsTo} variant="ghost" className={TAB_CLASS}>
        <BarsIcon />
        Stats
      </ButtonRouteLink>
      <Button
        variant={actionsOpen ? 'primary' : 'ghost'}
        className={TAB_CLASS}
        aria-expanded={actionsOpen}
        onClick={onToggleActions}
      >
        <DotsIcon />
        Azioni
      </Button>
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
