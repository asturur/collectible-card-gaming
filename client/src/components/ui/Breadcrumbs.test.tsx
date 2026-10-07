import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Breadcrumbs from './Breadcrumbs';
import { fitBreadcrumbLabels } from './breadcrumbLayout';

// A deterministic text measurement lets these cases describe the fitting policy.
const measure = (labels: readonly string[]) => labels.reduce((width, label) => width + label.length * 10, 0) + (labels.length - 1) * 20;

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('breadcrumb fitting', () => {
  const labels = ['Home', 'Statistiche', 'Giocatori', 'Alice'];

  it('keeps every label when the trail fits', () => {
    expect(fitBreadcrumbLabels(labels, measure(labels), measure)).toEqual(labels);
  });

  it('collapses the earliest ancestor before touching later labels', () => {
    expect(fitBreadcrumbLabels(labels, 260, measure)).toEqual(['Home', '…', 'Giocatori', 'Alice']);
    expect(fitBreadcrumbLabels(labels, 200, measure)).toEqual(['Home', '…', '…', 'Alice']);
  });

  it('removes complete words from a multiword ancestor', () => {
    const expected = ['Home', 'Statistiche per i …', 'Partite'];
    expect(fitBreadcrumbLabels(['Home', 'Statistiche per i giocatori', 'Partite'], measure(expected), measure)).toEqual(expected);
  });

  it('shortens the current page last and keeps only complete words', () => {
    const expected = ['Home', '…', '…', 'Statistiche …'];
    expect(fitBreadcrumbLabels(['Home', 'Mazzi', 'Elfi', 'Statistiche del mazzo'], measure(expected), measure)).toEqual(expected);
  });

  it('replaces an unbroken word entirely and always preserves Home', () => {
    expect(fitBreadcrumbLabels(labels, 140, measure)).toEqual(['Home', '…', '…', '…']);
    expect(fitBreadcrumbLabels(labels, 10, measure)).toEqual(['Home', '…', '…', '…']);
  });

  it('preserves accessible names and destinations, and restores labels on resize', () => {
    let width = 200;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { width: measure([...this.querySelectorAll('[data-breadcrumb-label]')].map(node => node.textContent ?? '')) } as DOMRect;
    });
    render(<MemoryRouter><Breadcrumbs ancestors={[
      { label: 'Home', to: '/' }, { label: 'Statistiche', to: '/stats' }, { label: 'Giocatori', to: '/stats/players' },
    ]} current="Alice" /></MemoryRouter>);

    const trail = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(trail).getByRole('link', { name: 'Home' })).toHaveTextContent('Home');
    const stats = within(trail).getByRole('link', { name: 'Statistiche' });
    expect(stats).toHaveTextContent('…');
    expect(stats).toHaveAttribute('title', 'Statistiche');
    expect(stats).toHaveAttribute('href', '/stats');
    expect(within(trail).getByRole('link', { name: 'Giocatori' })).toHaveTextContent('…');
    expect(within(trail).getAllByRole('listitem')).toHaveLength(4);

    width = 140;
    act(() => { window.dispatchEvent(new Event('resize')); });
    const current = trail.querySelector('[aria-current="page"]');
    expect(current?.querySelector('[aria-hidden="true"]')).toHaveTextContent('…');
    expect(current?.querySelector('.sr-only')).toHaveTextContent('Alice');

    width = 400;
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(stats).toHaveTextContent('Statistiche');
    expect(within(trail).getByRole('link', { name: 'Giocatori' })).toHaveTextContent('Giocatori');
    expect(current).toHaveTextContent('Alice');
    expect(current?.querySelector('.sr-only')).toBeNull();
  });
});
