import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithClockSkewRetry } from './supabase';

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
