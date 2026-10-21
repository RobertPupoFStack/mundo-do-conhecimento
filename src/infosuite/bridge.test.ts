import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InfoSuiteBridgeError,
  invokeInfoSuite,
  normalizeFunctionsBaseUrl,
} from './bridge';

describe('InfoSuite bridge contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes the functions URL without changing its origin or path', () => {
    expect(normalizeFunctionsBaseUrl('https://base44.app/api/functions/')).toBe(
      'https://base44.app/api/functions',
    );
  });

  it('rejects insecure integration endpoints', () => {
    expect(() => normalizeFunctionsBaseUrl('http://base44.app/api/functions')).toThrow(
      'deve usar HTTPS',
    );
  });

  it('posts the signed ticket to launchSession as JSON', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'access', resume_token: 'resume' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await invokeInfoSuite<{ access_token: string }>('launchSession', {
      ticket: 'single-use-signed-ticket',
    });

    expect(result.access_token).toBe('access');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/launchSession$/);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ ticket: 'single-use-signed-ticket' });
  });

  it('returns a useful status and message for rejected tickets', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Ticket expirado.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(invokeInfoSuite('launchSession', { ticket: 'expired' })).rejects.toMatchObject({
      name: 'InfoSuiteBridgeError',
      message: 'Ticket expirado.',
      status: 401,
    });
    expect(() => {
      throw new InfoSuiteBridgeError('Sessão inválida.', 409);
    }).toThrow('Sessão inválida.');
  });
});
