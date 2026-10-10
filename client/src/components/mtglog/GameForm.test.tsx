import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameForm from './GameForm';

const insert = vi.fn();

vi.mock('../../services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supabase')>();
  const rows: Record<string, unknown[]> = {
    giocatori: [{ name: 'Andrea' }, { name: 'Bea' }],
    mazzi: [],
  };
  return {
    ...actual,
    subscribeToTable: () => () => {},
    supabase: {
      from: (table: string) => ({
        select: () => ({ order: () => Promise.resolve({ data: rows[table] ?? [], error: null }) }),
        insert: (...args: unknown[]) => {
          insert(...args);
          return Promise.resolve({ error: null });
        },
      }),
    },
  };
});

async function renderForm() {
  const user = userEvent.setup();
  render(<GameForm onBack={vi.fn()} />);
  await screen.findByRole('button', { name: /Scegli il giocatore 1/ });
  return user;
}

describe('GameForm', () => {
  beforeEach(() => {
    localStorage.clear();
    insert.mockClear();
  });

  it('does not offer a player already chosen in another row', async () => {
    const user = await renderForm();
    await user.click(screen.getByRole('button', { name: /Scegli il giocatore 1/ }));
    await user.click(screen.getByRole('button', { name: 'Andrea' }));
    await user.click(screen.getByRole('button', { name: /Scegli il giocatore 2/ }));
    const picker = within(screen.getByRole('dialog'));
    expect(picker.getByRole('button', { name: 'Andrea' })).toBeDisabled();
    expect(picker.getByRole('button', { name: 'Bea' })).toBeEnabled();
  });

  it('blocks the counter and saving when the same player is typed twice', async () => {
    const user = await renderForm();
    await user.click(screen.getByRole('button', { name: /Scegli il giocatore 1/ }));
    await user.click(screen.getByRole('button', { name: 'Andrea' }));
    await user.click(screen.getByRole('button', { name: /Scegli il giocatore 2/ }));
    await user.click(screen.getByRole('button', { name: /Nuovo giocatore/ }));
    await user.type(screen.getByPlaceholderText('Nome del giocatore 2'), ' andrea ');

    expect(screen.getAllByText(/è già in questa partita/)).toHaveLength(2);
    expect(screen.queryByText(/È la stessa persona/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Avvia Partita/ }));
    expect(screen.getByText('Lo stesso giocatore compare due volte: cambia uno dei due nomi.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Opzioni di gioco' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salva Partita' }));
    expect(insert).not.toHaveBeenCalled();
  });
});
