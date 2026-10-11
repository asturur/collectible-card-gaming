import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./scryfallLookup', () => ({ requestScryfall: mocks.request }));

type Prices = typeof import('./cardPrices');
let prices: Prices;

const raw = (id: string, p: Record<string, string | null>, finishes = ['nonfoil', 'foil']) => ({
  id, name: id, prices: p, finishes, purchase_uris: { cardmarket: `https://cardmarket.test/${id}` },
});

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  mocks.request.mockReset();
  prices = await import('./cardPrices');
});

describe('priceFromRaw', () => {
  it('uses the non-foil price, and the foil one only for foil-only printings', () => {
    expect(prices.priceFromRaw(raw('a', { eur: '1.50', eur_foil: '9', usd: '2.10', usd_foil: '12' }), 1)).toEqual({ eur: 1.5, usd: 2.1, cardmarket: 'https://cardmarket.test/a', at: 1 });
    expect(prices.priceFromRaw(raw('b', { eur: null, eur_foil: '7.25', usd: null, usd_foil: null, usd_etched: '8' }, ['foil', 'etched']), 1))
      .toMatchObject({ eur: 7.25, usd: 8 });
    expect(prices.priceFromRaw(raw('c', { eur: null, usd: null }), 1)).toMatchObject({ eur: null, usd: null });
  });
});

describe('requestPrices', () => {
  it('reads missing prices in batches of 75, caches them and refreshes after a day', async () => {
    const ids = Array.from({ length: 80 }, (_, i) => `id${i}`);
    mocks.request.mockImplementation(async (_path: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { identifiers: { id: string }[] };
      return { status: 200, data: { data: body.identifiers.map(({ id }) => raw(id, { eur: '1', usd: '2' })) } };
    });
    prices.requestPrices(ids);
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(mocks.request.mock.calls[0][1].body)).identifiers).toHaveLength(75);
    await vi.waitFor(() => expect(prices.getPrice('id79')?.eur).toBe(1));

    prices.requestPrices(ids);
    expect(mocks.request).toHaveBeenCalledTimes(2);

    const tomorrow = Date.now() + prices.PRICE_MAX_AGE_MS + 1000;
    expect(prices.getPrice('id0', tomorrow)).toBeUndefined();
    prices.requestPrices(['id0'], tomorrow);
    expect(mocks.request).toHaveBeenCalledTimes(3);
  });

  it('remembers printings without a price and marks failed reads for a later retry', async () => {
    mocks.request.mockResolvedValueOnce({ status: 200, data: { data: [] } });
    prices.requestPrices(['gone']);
    await vi.waitFor(() => expect(prices.getPrice('gone')).toMatchObject({ eur: null, usd: null }));

    mocks.request.mockRejectedValueOnce(new Error('offline'));
    prices.requestPrices(['later']);
    await vi.waitFor(() => expect(prices.isPriceFailed('later')).toBe(true));
    expect(prices.getPrice('later')).toBeUndefined();
  });
});
