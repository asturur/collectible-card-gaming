import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Tassa +4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alice: togli 2 alla tassa del comandante' }));
    await user.click(screen.getByRole('button', { name: 'Alice: togli 2 alla tassa del comandante' }));
    await user.click(screen.getByRole('button', { name: 'Alice: togli 2 alla tassa del comandante' }));
    expect(screen.getByText('Tassa +0')).toBeInTheDocument();
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
  });
});
