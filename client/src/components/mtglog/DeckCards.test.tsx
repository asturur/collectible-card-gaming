import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import DeckCardsView from './DeckCards';
import { getCard } from '../../services/scryfall';
vi.mock('../../services/scryfall', () => ({ getCard: vi.fn(), isMissing: (name: string) => name === 'Unknown', getToken: () => undefined }));
vi.mock('./useDeckImages', () => ({ useDeckImages: () => {}, useTokenImages: () => {} }));
vi.mock('./CardPrices', () => ({ CardPriceBox: () => null }));
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
    render(<DeckCardsView cards={[{ name: 'Unknown', qty: 1 }]} editable={{ onFix: fix, onChangeQty: qty, onMove: vi.fn() }} />);
    await user.click(screen.getByRole('button', { name: /Carta non riconosciuta: Unknown/ })); expect(fix).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Togli Unknown/ })); expect(qty).toHaveBeenCalledWith(expect.objectContaining({ name: 'Unknown' }), -1);
  });
  it('offers "→ Sideboard" / "→ Main Deck" under every card in both views', async () => {
    const user = userEvent.setup(); const move = vi.fn();
    const editable = { onFix: vi.fn(), onChangeQty: vi.fn(), onMove: move };
    render(<DeckCardsView cards={[{ name: 'Delver', qty: 4 }, { name: 'Delver', qty: 1, section: 'side' }]} editable={editable} />);
    await user.click(screen.getByRole('button', { name: 'Sposta una copia di Delver in Sideboard' }));
    expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Delver', qty: 4 }));
    await user.click(screen.getByRole('button', { name: 'Sposta una copia di Delver nel Main Deck' }));
    expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Delver', section: 'side' }));
    await user.click(screen.getByRole('button', { name: /Lista/ }));
    expect(screen.getAllByRole('button', { name: /Sposta una copia di Delver/ })).toHaveLength(2);
  });
  it('moves a copy from the card viewer in the editor and keeps showing the same card', async () => {
    const user = userEvent.setup(); const move = vi.fn();
    render(<DeckCardsView cards={[{ name: 'Delver', qty: 2 }]} editable={{ onFix: vi.fn(), onChangeQty: vi.fn(), onMove: move }} />);
    await user.click(screen.getByRole('button', { name: 'Delver' }));
    const viewer = screen.getByRole('dialog', { name: 'Delver' });
    await user.click(within(viewer).getByRole('button', { name: 'Sposta 1 copia in Sideboard' }));
    expect(move).toHaveBeenCalledWith(expect.objectContaining({ name: 'Delver', qty: 2 }));
    expect(screen.getByRole('dialog', { name: 'Delver' })).toBeInTheDocument();
  });
  it('has no move action in the read-only viewer', async () => {
    const user = userEvent.setup();
    render(<DeckCardsView cards={[{ name: 'Delver', qty: 2 }]} />);
    await user.click(screen.getByRole('button', { name: 'Delver' }));
    expect(screen.queryByRole('button', { name: /Sposta 1 copia/ })).not.toBeInTheDocument();
  });
});
