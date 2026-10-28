import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FilterTabs from './FilterTabs';

const options = (labels: string[]) => labels.map((label) => ({ value: label, label }));

/** jsdom non calcola il layout: righe larghe `rowWidth`, voci larghe `itemWidth`. */
function fakeLayout(rowWidth: number, itemWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.layout ? rowWidth : itemWidth;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.layout ? this.children.length * (itemWidth + 8) : itemWidth;
  });
}

describe('FilterTabs layout (ChipRow)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses an equal-width selector when a few options fit', () => {
    fakeLayout(340, 90);
    render(<FilterTabs options={options(['Tutte', '30 giorni', "Quest'anno"])} value="Tutte" onChange={() => {}} />);
    const row = screen.getByRole('button', { name: 'Tutte' }).parentElement!;
    expect(row).toHaveAttribute('data-layout', 'segmented');
    expect(row.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('falls back to one scrolling row when the options would not fit or are many', () => {
    fakeLayout(300, 120);
    const { unmount } = render(<FilterTabs options={options(['Classifica', 'Torta del gruppo', 'Dettaglio giocatore'])} value="Classifica" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Classifica' }).parentElement).toHaveAttribute('data-layout', 'scroll');
    unmount();
    render(<FilterTabs options={options(['A', 'B', 'C', 'D', 'E'])} value="A" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'A' }).parentElement).toHaveAttribute('data-layout', 'scroll');
  });

  it('keeps pressed-button semantics and reports the chosen option', async () => {
    const onChange = vi.fn();
    render(<FilterTabs options={options(['Più giocate', 'Maledette'])} value="Più giocate" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Più giocate' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Maledette' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Maledette' }));
    expect(onChange).toHaveBeenCalledWith('Maledette');
  });
});
