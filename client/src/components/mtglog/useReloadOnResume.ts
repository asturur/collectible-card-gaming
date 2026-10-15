import { useEffect, useRef } from 'react';

/**
 * Rilegge i dati quando l'app torna in primo piano. Sul telefono, con l'app in
 * secondo piano, la connessione in tempo reale si interrompe e gli avvisi
 * arrivati nel frattempo vanno persi: senza questa rilettura servirebbe
 * chiudere e riaprire l'app per vedere una partita salvata altrove.
 */
export function useReloadOnResume(reload: () => void, enabled = true) {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => { if (document.visibilityState === 'visible') latest.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled]);
}
