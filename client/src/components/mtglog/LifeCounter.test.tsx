import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LifeCounter from './LifeCounter';

function setup() {
  const onFinish = vi.fn();
  render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={vi.fn()} onFinish={onFinish} />);
  return { onFinish, user: userEvent.setup() };
}

describe('LifeCounter', () => {
  it('merges quick taps into one history entry and undoes it as a whole', async () => {
    const { user } = setup();
    const plus = screen.getByRole('button', { name: 'Alice: aggiungi 1 punto vita' });
    await user.click(plus);
    await user.click(plus);
    await user.click(plus);
    expect(screen.getByText('23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Cronologia' }));
    expect(screen.getByText(/Vita 20 → 23/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annulla Ultimo' }));
    expect(screen.getByText('Ancora nessun cambio.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByText('23')).not.toBeInTheDocument();
    expect(screen.getAllByText('20')).toHaveLength(2);
  });

  it('keeps the undo button disabled until something changes', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: 'Annulla Ultimo' })).toBeDisabled();
  });

  it('tracks commander tax in steps of 2 once Commander is switched on', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Alice: opzioni' }));
    expect(screen.queryByRole('button', { name: /tassa del comandante/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'COMMANDER' }));
    await user.click(screen.getByRole('button', { name: 'Alice: aggiungi 2 alla tassa del comandante' }));
    await user.click(screen.getByRole('button', { name: 'Alice: aggiungi 2 alla tassa del comandante' }));
    expect(screen.getByLabelText('Tassa del comandante')).toHaveTextContent('+4');
    await user.click(screen.getByRole('button', { name: 'Alice: togli 2 alla tassa del comandante' }));
    await user.click(screen.getByRole('button', { name: 'Alice: togli 2 alla tassa del comandante' }));
    await user.click(screen.getByRole('button', { name: 'Alice: togli 2 alla tassa del comandante' }));
    expect(screen.getByLabelText('Tassa del comandante')).toHaveTextContent('+0');
  });

  it('counts 21 commander damage from one player as a KILL', async () => {
    const { user, onFinish } = setup();
    await user.click(screen.getByRole('button', { name: 'Alice: opzioni' }));
    await user.click(screen.getByRole('checkbox', { name: 'COMMANDER' }));
    const plus = screen.getByRole('button', { name: 'Alice: aggiungi 1 danno da comandante di Bob' });
    for (let i = 0; i < 21; i++) await user.click(plus);
    expect(screen.getByText('21/21')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Fine Partita' }));
    expect(onFinish).toHaveBeenCalledWith(
      { Alice: 20, Bob: 20 },
      { Alice: ['kill'], Bob: [] },
      { Alice: 0, Bob: 0 }
    );
  });

  it('flips a coin from the game menu', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { user } = setup();
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: /Moneta/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Testa');
    await user.click(screen.getByRole('button', { name: 'Lancia di Nuovo' }));
    expect(screen.getByRole('status')).toHaveTextContent('Croce');
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    random.mockRestore();
    vi.unstubAllGlobals();
  });

  it('offers the table layout only with four players and remembers the choice', async () => {
    localStorage.removeItem('mtglog:counterLayout:4');
    const user = userEvent.setup();
    const { unmount } = render(<LifeCounter players={['A', 'B', 'C', 'D']} startLife={40} onEdit={vi.fn()} onFinish={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent('Due per lato');
    await user.click(screen.getByRole('button', { name: /Disposizione/ }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent('A croce');
    unmount();

    render(<LifeCounter players={['A', 'B', 'C', 'D']} startLife={40} onEdit={vi.fn()} onFinish={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent('A croce');
    localStorage.removeItem('mtglog:counterLayout:4');
  });

  it('hides the layout choice with fewer than four players', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.queryByRole('button', { name: /Disposizione/ })).not.toBeInTheDocument();
  });

  it.each([
    [5, 'Uno a lato', 'Due sopra, tre sotto'],
    [6, 'Tre per lato', 'Uno per lato'],
  ])('offers two layouts with %i players', async (n, first, second) => {
    localStorage.removeItem(`mtglog:counterLayout:${n}`);
    const user = userEvent.setup();
    const names = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
    render(<LifeCounter players={names} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent(first);
    await user.click(screen.getByRole('button', { name: /Disposizione/ }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent(second);
    localStorage.removeItem(`mtglog:counterLayout:${n}`);
  });

  it('composes the coin word letter by letter when motion is allowed', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
      fireEvent.click(screen.getByRole('button', { name: /Moneta/ }));
      const word = () => screen.getByRole('status').querySelector('[aria-hidden="true"]')!.textContent;
      expect(word()).not.toBe('TESTA');
      act(() => { vi.advanceTimersByTime(3000); });
      expect(word()).toBe('TESTA');
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('lists every player in the high roll, composing the names unless motion is reduced', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: /High Roll/ }));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items.map((li) => li.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Alice'), expect.stringContaining('Bob')]));
    vi.unstubAllGlobals();
  });

  it('has a fixed layout with three players, so no layout button', async () => {
    const user = userEvent.setup();
    render(<LifeCounter players={['A', 'B', 'C']} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.queryByRole('button', { name: /Disposizione/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A: aggiungi 1 punto vita' })).toBeInTheDocument();
  });
});
