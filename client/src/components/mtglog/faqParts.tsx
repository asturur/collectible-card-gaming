import type { ReactNode } from 'react';
import { cx, SURFACE } from '../ui/styles';

/** Un argomento della FAQ: una statistica, spiegata. */
export interface FaqTopic {
  id: string;
  label: string;
  body: ReactNode;
}

/** Una sezione della FAQ, come le voci del menu Statistiche. */
export interface FaqSection {
  id: string;
  label: string;
  topics: FaqTopic[];
}

/* Mattoncini del testo, comuni alla FAQ italiana e a quella inglese: tutti gli argomenti seguono lo stesso schema. */

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zaff-muted">{title}</h3>
      <div className="space-y-2.5 text-[15px] leading-relaxed text-zaff-text">{children}</div>
    </section>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <p className={cx(SURFACE, 'px-3 py-2.5 text-center font-semibold')}>{children}</p>;
}

export function Example({ children }: { children: ReactNode }) {
  return <div className={cx(SURFACE, 'space-y-2 border-l-4 border-l-zaff-primary px-3 py-2.5')}>{children}</div>;
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
