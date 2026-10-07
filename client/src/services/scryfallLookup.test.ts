import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const card = (name: string, id = 'first', extra = {}) => ({ id, oracle_id: 'same-oracle', name,
  type_line: 'Creature', image_uris: { normal: 'https://cards.scryfall.io/' + id }, ...extra });
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function finish<T>(promise: Promise<T>): Promise<T> { await vi.runAllTimersAsync(); return promise; }

describe('exact Scryfall identity', () => {
  it('deduplicates pending requests and reuses the first verified printing', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ data: [card('Island')] })); vi.stubGlobal('fetch', fetch);
    const api = await import('./scryfallLookup');
    const a = api.resolveScryfallNames(['Island']); const b = api.resolveScryfallNames([' island ']);
    await finish(Promise.all([a, b]));
    api.cacheVerifiedCard(card('Island', 'later'));
    expect((await api.resolveScryfallNames(['Island'])).get('island')?.id).toBe('first');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('resolves exact localized printed names and the verified alternate name', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ data: [card('Wrath of God')] }))
      .mockResolvedValueOnce(reply({}, 404)).mockResolvedValueOnce(reply({ data: [card('Island', 'localized', { printed_name: 'Isola' })] }));
    vi.stubGlobal('fetch', fetch); const api = await import('./scryfallLookup');
    const result = await finish(api.resolveScryfallNames(['Shrinking Storm', 'Isola']));
    expect(result.get('shrinking storm')?.name).toBe('Wrath of God'); expect(result.get('isola')?.id).toBe('localized');
    expect(JSON.parse(fetch.mock.calls[0][1].body).identifiers[0]).toEqual({ name: 'Wrath of God' });
    expect(decodeURIComponent(fetch.mock.calls[2][0])).toContain('!"Isola"');
  });
  it('rejects a mismatched result rather than assigning a fuzzy identity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ data: [card('Island')] }))
      .mockResolvedValueOnce(reply({}, 404)).mockResolvedValueOnce(reply({}, 404)));
    const api = await import('./scryfallLookup');
    expect(await finish(api.resolveScryfallNames(['Islnd']))).toHaveProperty('size', 0);
  });
  it('rejects ambiguous printed names with different Oracle identities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ data: [] })).mockResolvedValueOnce(reply({}, 404))
      .mockResolvedValueOnce(reply({ data: [card('A', 'a', { printed_name: 'Alias' }), card('B', 'b', { printed_name: 'Alias', oracle_id: 'different' })] })));
    const api = await import('./scryfallLookup');
    expect(await finish(api.resolveScryfallNames(['Alias']))).toHaveProperty('size', 0);
  });
  it('queues discovery/autocomplete calls with at least 500ms between starts', async () => {
    const starts: number[] = []; vi.stubGlobal('fetch', vi.fn(async () => { starts.push(Date.now()); return reply({}); }));
    const api = await import('./scryfallLookup');
    await finish(Promise.all([api.requestScryfall('/cards/search'), api.requestScryfall('/cards/autocomplete'), api.requestScryfall('/cards/collection')]));
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(500); expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(500);
  });
  it('keeps a transient failure retryable and honors backoff', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({}, 503)).mockResolvedValueOnce(reply({}, 503)).mockResolvedValueOnce(reply({}, 503))
      .mockResolvedValueOnce(reply({ data: [card('Island')] })); vi.stubGlobal('fetch', fetch);
    const api = await import('./scryfallLookup');
    const failed = expect(api.resolveScryfallNames(['Island'])).rejects.toThrow('503'); await finish(failed);
    expect((await finish(api.resolveScryfallNames(['Island']))).get('island')?.id).toBe('first');
  });
  it('cancels an individual waiter without cancelling shared lookup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ data: [card('Island')] })));
    const api = await import('./scryfallLookup'); const abort = new AbortController();
    const a = api.resolveScryfallNames(['Island'], abort.signal); const b = api.resolveScryfallNames(['Island']);
    const cancelled = expect(a).rejects.toMatchObject({ name: 'AbortError' }); abort.abort();
    await finish(cancelled); expect((await b).get('island')?.id).toBe('first');
  });
});
