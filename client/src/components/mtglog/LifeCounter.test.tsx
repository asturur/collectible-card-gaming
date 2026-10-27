import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LifeCounter from './LifeCounter';

function setup() {
  const onFinish = vi.fn();
  render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={vi.fn()} onFinish={onFinish} onQuit={vi.fn()} />);
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

  it('asks before quitting without saving, and only quits from the confirmation', async () => {
    const onQuit = vi.fn();
    const onFinish = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={onEdit} onFinish={onFinish} onQuit={onQuit} />);
    await user.click(screen.getByRole('button', { name: 'Alice: aggiungi 1 punto vita' }));

    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Esci senza salvare' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Uscire senza salvare?' });
    expect(dialog).toHaveTextContent('I punteggi di questa partita andranno persi.');
    expect(within(dialog).getByRole('button', { name: 'Torna al gioco' })).toHaveFocus();
    expect(onQuit).not.toHaveBeenCalled();

    // "Torna al gioco": la partita continua com'era.
    await user.click(within(dialog).getByRole('button', { name: 'Torna al gioco' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(onQuit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Esci senza salvare' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Esci senza salvare' }));
    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('tells that a saved game stays as it was when quitting its edit', async () => {
    const user = userEvent.setup();
    render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} editingSaved />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Esci senza salvare' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent("la partita salvata resta com'era");
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
      { Alice: 0, Bob: 0 },
      { Alice: { tax: 0, damage: { Bob: 21 } } },
      ['Alice', 'Bob']
    );
  });

  it('hands commander tax and damage to "Modifica Partita" and restores them on resume', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<LifeCounter players={['Alice', 'Bob']} startLife={40} onEdit={onEdit} onFinish={vi.fn()} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Alice: opzioni' }));
    await user.click(screen.getByRole('checkbox', { name: 'COMMANDER' }));
    await user.click(screen.getByRole('button', { name: 'Alice: aggiungi 2 alla tassa del comandante' }));
    const plus = screen.getByRole('button', { name: 'Alice: aggiungi 1 danno da comandante di Bob' });
    for (let i = 0; i < 5; i++) await user.click(plus);
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Modifica Partita' }));
    expect(onEdit).toHaveBeenCalledWith(
      { Alice: 40, Bob: 40 },
      { Alice: [], Bob: [] },
      { Alice: 0, Bob: 0 },
      { Alice: { tax: 2, damage: { Bob: 5 } } },
      ['Alice', 'Bob']
    );
    unmount();

    const [lives, causes, poisons, commanders] = onEdit.mock.calls[0];
    const resume = Object.fromEntries(
      Object.keys(lives).map((name) => [name, { life: lives[name], loss: causes[name], poison: poisons[name], commander: commanders[name] }])
    );
    render(<LifeCounter players={['Alice', 'Bob']} startLife={40} resume={resume} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
    expect(screen.getByText('CMD 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alice: opzioni' }));
    expect(screen.getByRole('checkbox', { name: 'COMMANDER' })).toBeChecked();
    expect(screen.getByLabelText('Tassa del comandante')).toHaveTextContent('+2');
    expect(screen.getByText('5/21')).toBeInTheDocument();
  });

  it('does not turn lethal commander damage into a manual KILL on resume', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    const resume = {
      Alice: { life: 30, loss: ['kill' as const], poison: 0, commander: { tax: 0, damage: { Bob: 21 } } },
      Bob: { life: 40, loss: [], poison: 0 },
    };
    render(<LifeCounter players={['Alice', 'Bob']} startLife={40} resume={resume} onEdit={vi.fn()} onFinish={onFinish} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Alice: opzioni' }));
    await user.click(screen.getByRole('button', { name: 'Alice: togli 1 danno da comandante di Bob' }));
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Fine Partita' }));
    expect(onFinish.mock.calls[0][1]).toEqual({ Alice: [], Bob: [] });
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
    const { unmount } = render(<LifeCounter players={['A', 'B', 'C', 'D']} startLife={40} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent('passa a A croce');
    await user.click(screen.getByRole('button', { name: /Disposizione/ }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent('passa a Due per lato');
    unmount();

    render(<LifeCounter players={['A', 'B', 'C', 'D']} startLife={40} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent('passa a Due per lato');
    localStorage.removeItem('mtglog:counterLayout:4');
  });

  it('hides the layout choice with fewer than four players', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.queryByRole('button', { name: /Disposizione/ })).not.toBeInTheDocument();
  });

  it.each([
    [5, 'Tre e due per lato', 'Due per lato, uno a capotavola'],
    [6, 'Tre per lato', 'Due per lato e i capotavola'],
  ])('offers two layouts with %i players', async (n, first, second) => {
    localStorage.removeItem(`mtglog:counterLayout:${n}`);
    const user = userEvent.setup();
    const names = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
    render(<LifeCounter players={names} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent(`passa a ${second}`);
    await user.click(screen.getByRole('button', { name: /Disposizione/ }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.getByRole('button', { name: /Disposizione/ })).toHaveTextContent(`passa a ${first}`);
    localStorage.removeItem(`mtglog:counterLayout:${n}`);
  });

  it('shows the net total of quick life taps on the side of the change, then fades it', () => {
    vi.useFakeTimers();
    try {
      render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
      const minus = screen.getByRole('button', { name: 'Alice: togli 1 punto vita' });
      const plus = screen.getByRole('button', { name: 'Alice: aggiungi 1 punto vita' });
      const delta = () => screen.getByTestId('life-delta');
      for (let i = 0; i < 3; i++) fireEvent.click(minus);
      expect(delta()).toHaveTextContent('−3');
      expect(delta()).toHaveClass('right-full', 'opacity-100');
      fireEvent.click(plus);
      expect(delta()).toHaveTextContent('−2');
      act(() => { vi.advanceTimersByTime(3900); });
      fireEvent.click(minus);
      expect(delta()).toHaveTextContent('−3');
      act(() => { vi.advanceTimersByTime(4000); });
      expect(delta()).toHaveClass('opacity-0');
      fireEvent.click(plus);
      expect(delta()).toHaveTextContent('+1');
      expect(delta()).toHaveClass('left-full', 'opacity-100');
      fireEvent.click(minus);
      expect(delta()).toHaveClass('opacity-0');
      expect(screen.getByText('17')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('composes the coin word letter by letter when motion is allowed', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      render(<LifeCounter players={['Alice', 'Bob']} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
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
    render(<LifeCounter players={['A', 'B', 'C']} startLife={20} onEdit={vi.fn()} onFinish={vi.fn()} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    expect(screen.queryByRole('button', { name: /Disposizione/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A: aggiungi 1 punto vita' })).toBeInTheDocument();
  });

  it('swaps two seats with "Cambia posti", blocking life changes until "Fatto"', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<LifeCounter players={['Alice', 'Bob', 'Carla']} startLife={20} onEdit={vi.fn()} onFinish={onFinish} onQuit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Cambia posti' }));
    expect(screen.queryByRole('button', { name: 'Opzioni di gioco' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Tocca il primo giocatore')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Bob: aggiungi 1 punto vita' }));
    expect(screen.getAllByText('20')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Scegli Alice' }));
    expect(screen.getByRole('button', { name: 'Annulla la scelta di Alice' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Scambia con Carla' }));
    await user.click(screen.getByRole('button', { name: 'Fatto' }));

    // Ordine dei riquadri sullo schermo: Carla dove era Alice e viceversa; i punti restano a ciascuno.
    const names = screen.getAllByRole('button', { name: /: opzioni$/ }).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Carla: opzioni', 'Bob: opzioni', 'Alice: opzioni']);
    await user.click(screen.getByRole('button', { name: 'Alice: aggiungi 1 punto vita' }));
    await user.click(screen.getByRole('button', { name: 'Opzioni di gioco' }));
    await user.click(screen.getByRole('button', { name: 'Fine Partita' }));
    expect(onFinish.mock.calls[0][0]).toEqual({ Alice: 21, Bob: 20, Carla: 20 });
    expect(onFinish.mock.calls[0][4]).toEqual(['Carla', 'Bob', 'Alice']);
  });
});
