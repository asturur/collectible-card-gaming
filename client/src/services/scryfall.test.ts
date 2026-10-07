import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const raw = (id: string) => ({ id, oracle_id: 'oracle', name: 'Delver of Secrets // Insectile Aberration', type_line: 'Creature // Creature', cmc: 1,
  card_faces: [{ name: 'Delver of Secrets', type_line: 'Creature', mana_cost: '{U}', colors: ['U'], image_uris: { normal: `https://cards.scryfall.io/${id}/front` } },
    { name: 'Insectile Aberration', image_uris: { normal: `https://cards.scryfall.io/${id}/back` } }], all_parts: [{ id: 'token', name: 'Token', component: 'token' }] });
const reply = (cards: unknown[]) => new Response(JSON.stringify({ data: cards }), { headers: { 'Content-Type': 'application/json' } });
describe('Scryfall display and identity cache', () => {
  it('ignores v5 metadata when assigning identity', async () => {
    localStorage.setItem('mtg-scryfall-cache-v5', JSON.stringify([['island', { name: 'Island', faces: [{ normal: 'old' }] }]]));
    const api = await import('./scryfall'); expect(api.getCard('Island')).toBeUndefined();
  });
  it('hydrates saved printings by ID and keeps faces, mana and tokens after discovery', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply([raw('saved')])).mockResolvedValueOnce(reply([raw('later')])); vi.stubGlobal('fetch', fetch);
    const api = await import('./scryfall'); const cards = [{ name: 'Delver of Secrets', scryfallId: 'saved' }];
    api.requestCards(cards.map(c => c.name), cards); api.requestCards(cards.map(c => c.name), cards);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(api.getCard(cards[0].name, 'saved')).toMatchObject({ scryfallId: 'saved', oracleId: 'oracle', manaCost: '{U}', cmc: 1, colors: ['U'], tokens: [{ id: 'token', name: 'Token' }] });
    const search = api.searchScryfall('Delver'); await vi.runAllTimersAsync(); await search;
    expect(api.getCard(cards[0].name, 'saved')?.faces).toHaveLength(2);
    expect(api.getCard(cards[0].name)?.scryfallId).toBe('saved');
  });
  it('hydrates different assigned printings of the same name in main and side', async () => {
    const fetch = vi.fn().mockResolvedValue(reply([raw('main'), raw('side')])); vi.stubGlobal('fetch', fetch);
    const api = await import('./scryfall');
    api.requestCards(['Delver', 'Delver'], [{ name: 'Delver', scryfallId: 'main' }, { name: 'Delver', scryfallId: 'side' }]);
    await vi.runAllTimersAsync();
    expect(JSON.parse(fetch.mock.calls[0][1].body).identifiers).toEqual([{ id: 'main' }, { id: 'side' }]);
    expect(api.getCard('Delver', 'main')?.scryfallId).toBe('main');
    expect(api.getCard('Delver', 'side')?.scryfallId).toBe('side');
  });

});
