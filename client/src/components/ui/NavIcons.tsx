/** Icone a tratto della barra di navigazione, riusate anche dai tasti di sezione (es. pagina del mazzo). */
export const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Carte sovrapposte (Mazzi / Deck). */
export function CardsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="7" y="4" width="12" height="16" rx="2" />
      <path d="M4.5 7.5V17a2 2 0 0 0 1.5 1.9" />
    </svg>
  );
}

/** Istogramma (Statistiche / Stats). */
export function BarsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 20V11M12 20V4M19 20v-6" />
    </svg>
  );
}

/** Tre puntini (Altro / Azioni). */
export function DotsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
