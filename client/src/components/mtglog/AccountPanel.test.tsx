import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPanel from './AccountPanel';
import type { Game } from './GameList';

const deleteMyAccount = vi.fn();
vi.mock('../../services/account', () => ({
  deleteMyAccount: (...args: unknown[]) => deleteMyAccount(...args),
  signOut: vi.fn(),
}));
vi.mock('./useSavedDeck', () => ({
  useSavedDeckList: () => ({ loading: false, error: '', decks: [
    { id: 'd1', name: 'Vampiri', createdBy: 'me' },
    { id: 'd2', name: 'Elfi', createdBy: 'me' },
    { id: 'd3', name: 'Draghi', createdBy: 'other' },
  ] }),
}));

const game = (createdBy: string) => ({ id: createdBy + Math.random(), createdBy }) as unknown as Game;

async function openDialog() {
  const user = userEvent.setup();
  render(<AccountPanel userId="me" email="io@example.com" games={[game('me'), game('me'), game('me'), game('other')]} />);
  await user.click(screen.getByRole('button', { name: 'Elimina account…' }));
  return user;
}

describe('AccountPanel', () => {
  beforeEach(() => { deleteMyAccount.mockReset(); });

  it('shows what stays and what the user can choose, with their own counts', async () => {
    await openDialog();
    expect(screen.getByRole('group', { name: 'I tuoi mazzi (2)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Lasciali al gruppo/ })).toBeChecked();
    expect(screen.getByText(/Le partite che hai salvato \(3 partite\) restano/)).toBeInTheDocument();
    expect(screen.getByText(/esportali prima dalla pagina di ogni mazzo/)).toBeInTheDocument();
  });

  it('deletes only after typing the confirmation word, passing the deck choice', async () => {
    deleteMyAccount.mockResolvedValue(undefined);
    const user = await openDialog();
    const confirm = screen.getByRole('button', { name: 'Elimina definitivamente' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Per confermare scrivi ELIMINA'), 'elimina');
    await user.click(screen.getByRole('radio', { name: /Eliminali/ }));
    await user.click(confirm);
    expect(deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(deleteMyAccount).toHaveBeenCalledWith({ deleteDecks: true });
  });

  it('keeps the dialog and the typed word on failure, and blocks double submissions while deleting', async () => {
    let fail!: (err: Error) => void;
    deleteMyAccount.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
    const user = await openDialog();
    await user.type(screen.getByLabelText('Per confermare scrivi ELIMINA'), 'ELIMINA');
    await user.click(screen.getByRole('button', { name: 'Elimina definitivamente' }));
    expect(screen.getByRole('button', { name: 'Eliminazione…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
    await act(async () => fail(new Error('rete assente')));
    expect(await screen.findByText(/Non sono riuscito a eliminare l’account: rete assente/)).toBeInTheDocument();
    expect(screen.getByLabelText('Per confermare scrivi ELIMINA')).toHaveValue('ELIMINA');
    expect(deleteMyAccount).toHaveBeenCalledWith({ deleteDecks: false });
  });
});
