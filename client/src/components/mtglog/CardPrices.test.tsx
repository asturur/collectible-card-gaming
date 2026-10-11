import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardPriceBox } from './CardPrices';
import { getPrice, isPriceFailed, requestPrices } from '../../services/cardPrices';

vi.mock('../../services/cardPrices', () => ({
  getPrice: vi.fn(), isPriceFailed: vi.fn(() => false), requestPrices: vi.fn(), subscribePrices: () => () => {},
}));
vi.mock('../../services/scryfall', () => ({ getCard: () => undefined }));

beforeEach(() => { vi.clearAllMocks(); vi.mocked(isPriceFailed).mockReturnValue(false); });

describe('CardPriceBox', () => {
  it('shows one copy in euro and dollars with a Cardmarket link for the saved printing', () => {
    vi.mocked(getPrice).mockReturnValue({ eur: 38.9, usd: 44.1, cardmarket: 'https://www.cardmarket.com/x', at: new Date(2026, 9, 11).getTime() });
    render(<CardPriceBox name="Craterhoof Behemoth" scryfallId="hoof" />);
    expect(requestPrices).toHaveBeenCalledWith(['hoof']);
    expect(screen.getByText('€ 38,90')).toBeInTheDocument();
    expect(screen.getByText('$ 44,10')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Cardmarket/ });
    expect(link).toHaveAttribute('href', 'https://www.cardmarket.com/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Prezzo di una copia · Scryfall, 11/10/2026')).toBeInTheDocument();
  });

  it('says when the price is loading, failed or missing', () => {
    vi.mocked(getPrice).mockReturnValue(undefined);
    const { rerender } = render(<CardPriceBox name="A" scryfallId="a" />);
    expect(screen.getByText('Carico il prezzo…')).toBeInTheDocument();

    vi.mocked(isPriceFailed).mockReturnValue(true);
    rerender(<CardPriceBox name="A" scryfallId="b" />);
    expect(screen.getByText('Prezzo non disponibile ora: riprova più tardi.')).toBeInTheDocument();

    vi.mocked(getPrice).mockReturnValue({ eur: null, usd: null, cardmarket: null, at: 1 });
    rerender(<CardPriceBox name="A" scryfallId="c" />);
    expect(screen.getByText('Nessun prezzo su Scryfall per questa stampa.')).toBeInTheDocument();
  });
});
