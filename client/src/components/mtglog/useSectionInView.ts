import { useEffect, useState } from 'react';

/** Sezione del mazzo in vista mentre si scorrono le carte. */
export type DeckSection = 'main' | 'side';

/**
 * Scorrendo le carte, dice se si sta guardando il Main Deck o la Sideboard: la
 * Sideboard si "accende" quando il suo titolo (`#deck-sideboard`, in `DeckCards`)
 * sale sotto la barra fissa dei totali, o in fondo alla pagina.
 * `watch` sono i dati che cambiano l'altezza della lista (es. le carte in modifica).
 */
export function useSectionInView(enabled: boolean, watch?: unknown): DeckSection {
  const [section, setSection] = useState<DeckSection>('main');
  useEffect(() => {
    if (!enabled) return;
    function update() {
      const el = document.getElementById('deck-sideboard');
      if (!el) { setSection('main'); return; }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setSection(el.getBoundingClientRect().top <= 150 || atBottom ? 'side' : 'main');
    }
    update();
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [enabled, watch]);
  return section;
}
