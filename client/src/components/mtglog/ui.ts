/**
 * Classi condivise del registro partite, ricalcate sui componenti dell'app
 * HTML originale (.btn / .btn.ghost / .btn.link / input / .gtab / .mini).
 * Tenerle qui evita che ogni schermata reinventi bottoni e campi.
 */

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-zaff-primary to-zaff-accent px-4 py-2 text-sm font-semibold text-zaff-bg transition hover:brightness-110 active:brightness-95 disabled:opacity-60';

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zaff-border bg-transparent px-4 py-2 text-sm font-semibold text-zaff-muted transition hover:border-zaff-muted hover:text-zaff-text disabled:opacity-60';

export const BTN_LINK =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-sm text-zaff-text transition hover:border-zaff-gold hover:text-zaff-gold';

export const BTN_DANGER_LINK =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-zaff-border bg-zaff-bg px-3 py-1.5 text-sm text-zaff-muted transition hover:border-red-400 hover:text-red-400';

export const INPUT =
  'w-full rounded-lg border border-zaff-border bg-zaff-bg px-2.5 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary';

export const LABEL = 'mb-1 block text-xs text-zaff-muted';

export const MINI = 'text-xs text-zaff-muted';

export const CARD = 'rounded-lg border border-zaff-border bg-zaff-surface';

export const H2 = 'mb-3.5 border-b border-zaff-border pb-1.5 font-serif text-lg text-zaff-text';

/** Tab in stile .gtab dell'originale (gruppi, filtri origine mazzo). */
export function tabClass(active: boolean): string {
  return [
    'rounded-lg border px-3 py-1.5 text-[13px] transition',
    active
      ? 'border-zaff-text bg-zaff-text text-zaff-bg'
      : 'border-zaff-border bg-zaff-surface text-zaff-muted hover:text-zaff-text',
  ].join(' ');
}
