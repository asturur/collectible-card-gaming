import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fitBreadcrumbLabels } from './breadcrumbLayout';

export interface BreadcrumbLink {
  label: string;
  to: string;
}

const ROW = 'flex-nowrap whitespace-nowrap p-0 [&>li]:shrink-0 [&>li+li::before]:shrink-0';
const LINK = 'min-h-8 rounded px-1 text-primary';
const CURRENT = 'min-h-8 cursor-default font-medium text-base-content hover:no-underline';

/** A page hierarchy, independent of the user's browser history. */
export default function Breadcrumbs({ ancestors, current }: { ancestors: readonly BreadcrumbLink[]; current: string }) {
  const nav = useRef<HTMLElement>(null);
  const measurement = useRef<HTMLOListElement>(null);
  const labels = useMemo(() => [...ancestors.map(ancestor => ancestor.label), current], [ancestors, current]);
  const [fit, setFit] = useState<{ source: readonly string[]; labels: string[] } | null>(null);
  const visible = fit?.source === labels ? fit.labels : labels;

  useLayoutEffect(() => {
    const container = nav.current;
    const probe = measurement.current;
    if (!container || !probe) return;
    const text = [...probe.querySelectorAll<HTMLElement>('[data-breadcrumb-label]')];
    let disposed = false;

    function resize() {
      if (disposed || !container || !probe || !container.clientWidth) return;
      const next = fitBreadcrumbLabels(labels, container.clientWidth, candidates => {
        candidates.forEach((label, index) => { text[index].textContent = label; });
        return probe.getBoundingClientRect().width;
      });
      // The probe has no text between measurements, including for DOM/text queries.
      text.forEach(node => { node.textContent = ''; });
      setFit(previous => previous?.source === labels && previous.labels.every((label, index) => label === next[index])
        ? previous : { source: labels, labels: next });
    }

    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(container);
    window.addEventListener('resize', resize);
    document.fonts?.addEventListener('loadingdone', resize);
    void document.fonts?.ready.then(resize);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.fonts?.removeEventListener('loadingdone', resize);
    };
  }, [labels]);

  return (
    <nav ref={nav} aria-label="Percorso di navigazione" className="breadcrumbs relative m-0 mb-2 py-0 text-sm text-zaff-muted">
      <ol className={ROW}>
        {ancestors.map(({ label, to }, index) => (
          <li key={to}>
            <Link to={to} className={LINK} title={label} aria-label={label}>
              {visible[index]}
            </Link>
          </li>
        ))}
        <li>
          <span aria-current="page" title={current} className={CURRENT}>
            <span aria-hidden={visible[ancestors.length] !== current || undefined}>{visible[ancestors.length]}</span>
            {visible[ancestors.length] !== current && <span className="sr-only">{current}</span>}
          </span>
        </li>
      </ol>
      <ol ref={measurement} aria-hidden="true" className={`${ROW} pointer-events-none invisible absolute left-0 top-0 w-max`}>
        {labels.map((_, index) => (
          <li key={index}>
            <span className={index < ancestors.length ? LINK : CURRENT}><span data-breadcrumb-label /></span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
