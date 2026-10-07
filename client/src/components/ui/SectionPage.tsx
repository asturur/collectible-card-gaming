import { useEffect, useRef, type ReactNode } from 'react';
import Breadcrumbs, { type BreadcrumbLink } from './Breadcrumbs';
import { paths } from '../../router';
import { cx, HEADING_SECTION, TEXT_MINI } from './styles';

interface SectionPageProps {
  title: string;
  subtitle?: string;
  ancestors?: readonly BreadcrumbLink[];
  wide?: boolean;
  xl?: boolean;
  children: ReactNode;
}

/** The former section panels keep their mobile widths, with normal page scroll. */
export default function SectionPage({ title, subtitle, ancestors = [], wide, xl, children }: SectionPageProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);

  return (
    <main className="px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-4 sm:pt-10">
      <div className={cx('mx-auto w-full', xl ? 'max-w-[900px]' : wide ? 'max-w-[680px]' : 'max-w-[560px]')}>
        <Breadcrumbs ancestors={[{ label: 'Home', to: paths.home }, ...ancestors]} current={title} />
        <section className="rounded-xl border border-zaff-border bg-zaff-surface p-4 sm:p-6">
          <h1 ref={heading} tabIndex={-1} className={cx(HEADING_SECTION, 'mb-3 border-b border-zaff-border pb-1.5 outline-none [overflow-wrap:anywhere]')}>
            {title}
          </h1>
          {subtitle && <p className={cx('-mt-1 mb-3', TEXT_MINI)}>{subtitle}</p>}
          {children}
        </section>
      </div>
    </main>
  );
}
