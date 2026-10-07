import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardPicker from './CardPicker';
import { searchScryfall } from '../../services/scryfall';
vi.mock('../../services/scryfall', () => ({ searchScryfall: vi.fn() }));
const card = { name: 'Delver', scryfallId: 'first', oracleId: 'oracle', exactMatch: true, colors: ['U'], typeLine: 'Creature', cmc: 1, manaCost: '{U}', produced: [], tokens: [],
  faces: [{ small: 'front-small.jpg', normal: 'front.jpg', art: 'front-art.jpg' }, { small: 'back-small.jpg', normal: 'back.jpg', art: 'back-art.jpg' }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(searchScryfall).mockResolvedValue([card] as never); });
describe('image card picker', () => {
  it('supports Main/Side, face viewing and adding by name', async () => {
    const pick = vi.fn(); const section = vi.fn(); const user = userEvent.setup();
    render(<CardPicker mode="add" initialQuery="Delver" section="main" onSectionChange={section} countOf={() => 0} onPick={pick} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Sideboard' })); expect(section).toHaveBeenCalledWith('side');
    await user.click(await screen.findByRole('button', { name: 'Delver' }));
    const viewer = screen.getByRole('dialog', { name: 'Delver' });
    await user.click(within(viewer).getByRole('button', { name: /Gira la carta/ }));
    expect(within(viewer).getByRole('img', { name: 'Delver' })).toHaveAttribute('src', 'back.jpg');
    await user.click(within(viewer).getByRole('button', { name: '+1 Aggiungi' })); expect(pick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Delver' }));
  });
  it('does not restore obsolete results after clearing a pending search', async () => {
    let finish: (cards: never[]) => void = () => {};
    vi.mocked(searchScryfall).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup(); render(<CardPicker mode="replace" initialQuery="Delver" countOf={() => 0} onPick={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(searchScryfall).toHaveBeenCalled());
    await user.clear(screen.getByRole('textbox')); finish([card] as never);
    await waitFor(() => expect(screen.getByText(/Scrivi almeno 2 lettere/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delver' })).not.toBeInTheDocument();
  });
});
