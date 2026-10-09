import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import DeckCardsView from './DeckCards';
import { getCard } from '../../services/scryfall';
vi.mock('../../services/scryfall', () => ({ getCard: vi.fn(), isMissing: (name: string) => name === 'Unknown', getToken: () => undefined }));
vi.mock('./useDeckImages', () => ({ useDeckImages: () => {}, useTokenImages: () => {} }));
const card = { name: 'Delver', scryfallId: 'pinned', oracleId: 'oracle', exactMatch: true, colors: ['U'], typeLine: 'Creature', cmc: 1, manaCost: '{U}', produced: [], tokens: [],
  faces: [{ small: 'front-small.jpg', normal: 'front.jpg', art: 'front-art.jpg' }, { small: 'back-small.jpg', normal: 'back.jpg', art: 'back-art.jpg' }] };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.mocked(getCard).mockImplementation(name => name === 'Delver' ? card as never : undefined); });
describe('Registro card controls with pinned identities', () => {
  it('keeps grid/list and color/type controls, front/back viewing and statistics working', async () => {
    const user = userEvent.setup(); render(<MemoryRouter><DeckCardsView cards={[{ name: 'Delver', qty: 2, scryfallId: 'pinned' }]} /></MemoryRouter>);
    expect(getCard).toHaveBeenCalledWith('Delver', 'pinned');
    await user.click(screen.getByRole('button', { name: /Lista/ }));
    await user.click(screen.getByRole('button', { name: /Tipo/ }));
    await user.click(screen.getByRole('button', { name: '2× Delver' }));
    const viewer = screen.getByRole('dialog', { name: 'Delver' });
    await user.click(within(viewer).getByRole('button', { name: /Gira la carta/ }));
    expect(within(viewer).getByRole('img', { name: 'Delver' })).toHaveAttribute('src', 'back.jpg');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps correction and quantity actions available for unresolved groups', async () => {
    const user = userEvent.setup(); const fix = vi.fn(); const qty = vi.fn();
    render(<DeckCardsView cards={[{ name: 'Unknown', qty: 1 }]} editable={{ onFix: fix, onChangeQty: qty }} />);
    await user.click(screen.getByRole('button', { name: /Carta non riconosciuta: Unknown/ })); expect(fix).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Togli Unknown/ })); expect(qty).toHaveBeenCalledWith(expect.objectContaining({ name: 'Unknown' }), -1);
  });
});
