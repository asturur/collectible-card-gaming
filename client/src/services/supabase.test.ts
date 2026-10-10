import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithClockSkewRetry, MAX_DECK_NAME_LENGTH, shortenName, suggestAlternativeNames } from './supabase';

const futureJwt = () =>
  new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), { status: 401 });

describe('fetchWithClockSkewRetry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('riprova quando Supabase risponde "JWT issued at future"', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(futureJwt()).mockResolvedValueOnce(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await fetchWithClockSkewRetry('https://x.test/rest/v1/partite', undefined, [0, 0]);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('non riprova gli altri errori 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"JWT expired"}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await fetchWithClockSkewRetry('https://x.test/rest/v1/partite', undefined, [0, 0]);
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si ferma dopo i tentativi previsti', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(futureJwt()));
    vi.stubGlobal('fetch', fetchMock);
    const response = await fetchWithClockSkewRetry('https://x.test/rest/v1/partite', undefined, [0, 0]);
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('shortenName', () => {
  it('lascia com\'è un nome che sta nel limite', () => {
    expect(shortenName('  Elfi  ', 30)).toBe('Elfi');
  });

  it('accorcia a parole intere, senza separatori o parentesi in fondo', () => {
    const precon = "Scions & Spellcraft Collector's Edition (FINAL FANTASY XIV)";
    const short = shortenName(precon, MAX_DECK_NAME_LENGTH);
    expect(short).toBe("Scions & Spellcraft");
    expect(short.length).toBeLessThanOrEqual(MAX_DECK_NAME_LENGTH);
    expect(shortenName('mono_black_devotion_pauper_meta_2026', 30)).toBe('mono_black_devotion_pauper');
  });

  it('taglia la prima parola solo se è già più lunga del limite', () => {
    expect(shortenName('Supercalifragilistichespiralidoso', 10)).toBe('Supercalif');
  });
});

describe('suggestAlternativeNames', () => {
  it('propone nomi entro il limite anche partendo da un nome salvato più lungo', () => {
    for (const name of suggestAlternativeNames('Giovanni Battista Rossi')) expect(name.length).toBeLessThanOrEqual(20);
  });
});
