/**
 * Stili condivisi dall'intera app (ZAFF e registro partite): un posto solo per
 * campi, testi e riquadri, così le due metà restano coerenti.
 *
 * Font: il corpo del testo usa Inter (`font-sans`, quello di ZAFF); Cinzel
 * (`font-serif`) è riservato ai titoli — vedi HEADING_*.
 */

/** Unisce classi ignorando i valori vuoti. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Illustrazione di sfondo delle maschere di accesso (ZAFF e registro). */
export const LOGIN_BACKGROUND = `${import.meta.env.BASE_URL}zabov.jpg`;

/** Riquadro centrato a tutto schermo (maschere di accesso, scelta mazzo…). */
export const PANEL = 'w-full rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl';

/** Superficie di una scheda dentro una pagina (riga giocatore, tessera…). */
export const SURFACE = 'rounded-lg border border-zaff-border bg-zaff-bg';

export const HEADING_PAGE = 'font-serif text-2xl tracking-wide text-zaff-text sm:text-[26px]';
export const HEADING_PANEL = 'font-serif text-2xl text-zaff-text';
export const HEADING_SECTION = 'font-serif text-lg text-zaff-text sm:text-xl';

export const FIELD_LABEL = 'mb-2 block text-sm font-medium text-zaff-text';
export const FIELD_CONTROL =
  'w-full rounded-lg border border-zaff-border bg-zaff-bg px-4 py-3 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary';
/** Variante compatta, per le righe fitte dei moduli del registro. */
export const FIELD_CONTROL_SM =
  'w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary';

export const TEXT_MUTED = 'text-zaff-muted';
export const TEXT_MINI = 'text-xs text-zaff-muted';
export const TEXT_ERROR = 'text-sm text-red-400';
