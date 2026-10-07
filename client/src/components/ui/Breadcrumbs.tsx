import { Link } from 'react-router';

export interface BreadcrumbLink {
  label: string;
  to: string;
}

/** A page hierarchy, independent of the user's browser history. */
export default function Breadcrumbs({ ancestors, current }: { ancestors: readonly BreadcrumbLink[]; current: string }) {
  return (
    <nav aria-label="Percorso di navigazione" className="breadcrumbs mb-3 text-sm text-zaff-muted">
      <ol className="flex-wrap gap-y-1 whitespace-normal [&>li+li::before]:shrink-0">
        {ancestors.map(({ label, to }) => (
          <li key={to} className="min-w-0 max-w-full">
            <Link to={to} className="min-h-9 min-w-0 rounded px-1 text-primary" title={label}>
              <span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
        <li className="min-w-0 max-w-full">
          <span aria-current="page" title={current} className="min-h-9 min-w-0 cursor-default font-medium text-base-content hover:no-underline">
            <span className="truncate">{current}</span>
          </span>
        </li>
      </ol>
    </nav>
  );
}
