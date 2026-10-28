import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { ApiClient, forbiddenReason, type TokenProvider } from './api-client';

const make = (fetchImpl: typeof fetch, tokens?: TokenProvider, timeoutMs = 1000) =>
  new ApiClient({
    baseUrl: 'http://api.test/api',
    timeoutMs,
    fetch: fetchImpl,
    ...(tokens ? { tokens } : {}),
  });

const schema = z.object({ id: z.number() });

describe('ApiClient.request', () => {
  it('unwraps the envelope data', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope({ id: 7 }))]);
    const result = await make(fetch).request({ path: '/users/me', schema });
    expect(result).toEqual({ ok: true, value: { id: 7 } });
    expect(calls[0]?.url.toString()).toBe('http://api.test/api/users/me');
  });

  it('sends JSON bodies and the bearer token', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope({ id: 1 }))]);
    const tokens: TokenProvider = { accessToken: async () => 'tok', refresh: async () => null };
    await make(fetch, tokens).request({
      method: 'POST',
      path: '/conversations',
      body: { title: 'x' },
      schema,
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers.Authorization).toBe('Bearer tok');
    expect(calls[0]?.headers['Content-Type']).toBe('application/json');
    expect(calls[0]?.body).toEqual({ title: 'x' });
  });

  it('omits the token when auth is false', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope({ id: 1 }))]);
    const tokens: TokenProvider = { accessToken: async () => 'tok', refresh: async () => null };
    await make(fetch, tokens).request({ path: '/auth/login', schema, auth: false });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('adds query parameters and skips undefined ones', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope({ id: 1 }))]);
    await make(fetch).request({ path: '/x', query: { page: 2, q: undefined }, schema });
    expect(calls[0]?.url.search).toBe('?page=2');
  });

  it.each([
    [401, { kind: 'unauthenticated' }],
    [403, { kind: 'forbidden' }],
    [404, { kind: 'not_found' }],
    [409, { kind: 'conflict', code: 'conflict' }],
    [429, { kind: 'rate_limited' }],
  ])('maps HTTP %i', async (status, expected) => {
    const { fetch } = fakeFetch([json(status, { status_code: status, message: 'x', data: null })]);
    const result = await make(fetch).request({ method: 'POST', path: '/x', schema });
    expect(result).toEqual({ ok: false, error: expected });
  });

  it('maps validation errors with field names and a plain string body', async () => {
    const withFields = fakeFetch([
      json(400, {
        status_code: 400,
        message: 'A validation error occurred.',
        data: { email: ['bad'] },
      }),
    ]);
    expect(await make(withFields.fetch).request({ method: 'POST', path: '/x', schema })).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        fields: { email: 'invalid' },
        details: { email: ['bad'] },
      },
    });

    const plain = fakeFetch([
      json(400, { status_code: 400, message: 'A validation error occurred.', data: 'string' }),
    ]);
    expect(await make(plain.fetch).request({ method: 'POST', path: '/x', schema })).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { _form: 'invalid' } },
    });
  });

  it('reports 5xx as unknown with the backend message', async () => {
    const { fetch } = fakeFetch([json(500, { status_code: 500, message: 'boom', data: null })]);
    expect(await make(fetch).request({ method: 'POST', path: '/x', schema })).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'boom' },
    });
  });

  it('survives non-JSON error bodies', async () => {
    const { fetch } = fakeFetch([new Response('<html>Bad gateway</html>', { status: 502 })]);
    expect(await make(fetch).request({ method: 'POST', path: '/x', schema })).toEqual({
      ok: false,
      error: { kind: 'unknown', message: null },
    });
  });

  it('rejects data that does not match the schema', async () => {
    const { fetch } = fakeFetch([json(200, envelope({ id: 'nope' }))]);
    const result = await make(fetch).request({ path: '/x', schema });
    expect(result).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });

  it('accepts an empty success body', async () => {
    const { fetch } = fakeFetch([new Response(null, { status: 204 })]);
    const result = await make(fetch).request({ method: 'DELETE', path: '/x', schema: z.unknown() });
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('retries a GET once on a network failure', async () => {
    let n = 0;
    const { fetch, calls } = fakeFetch(() => {
      n += 1;
      if (n === 1) throw new TypeError('fetch failed');
      return json(200, envelope({ id: 2 }));
    });
    expect(await make(fetch).request({ path: '/x', schema })).toEqual({
      ok: true,
      value: { id: 2 },
    });
    expect(calls).toHaveLength(2);
  });

  it('retries a GET once on 5xx but never a POST', async () => {
    const get = fakeFetch([
      json(503, { status_code: 503, data: null }),
      json(200, envelope({ id: 3 })),
    ]);
    expect(await make(get.fetch).request({ path: '/x', schema })).toEqual({
      ok: true,
      value: { id: 3 },
    });

    const post = fakeFetch([json(503, { status_code: 503, data: null })]);
    const result = await make(post.fetch).request({ method: 'POST', path: '/x', schema });
    expect(result.ok).toBe(false);
    expect(post.calls).toHaveLength(1);
  });

  it('returns a network error after retries are used up', async () => {
    const { fetch, calls } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    expect(await make(fetch).request({ path: '/x', schema })).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
    expect(calls).toHaveLength(2);
  });

  it('does not retry when the caller aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetch, calls } = fakeFetch(() => {
      throw new DOMException('aborted', 'AbortError');
    });
    const result = await make(fetch).request({ path: '/x', schema, signal: controller.signal });
    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(calls).toHaveLength(1);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    let current = 'old';
    const tokens: TokenProvider = {
      accessToken: async () => current,
      refresh: async () => {
        current = 'new';
        return 'new';
      },
    };
    const { fetch, calls } = fakeFetch([
      json(401, { status_code: 401, data: null }),
      json(200, envelope({ id: 9 })),
    ]);
    const result = await make(fetch, tokens).request({ path: '/users/me', schema });
    expect(result).toEqual({ ok: true, value: { id: 9 } });
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer old', 'Bearer new']);
  });

  it('surfaces 401 when refresh is not possible', async () => {
    const tokens: TokenProvider = { accessToken: async () => 'old', refresh: async () => null };
    const { fetch, calls } = fakeFetch([json(401, { status_code: 401, data: null })]);
    const result = await make(fetch, tokens).request({ path: '/users/me', schema });
    expect(result).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
    expect(calls).toHaveLength(1);
  });

  it('does not try to refresh a failed login', async () => {
    let refreshes = 0;
    const tokens: TokenProvider = {
      accessToken: async () => null,
      refresh: async () => {
        refreshes += 1;
        return 'x';
      },
    };
    const { fetch } = fakeFetch([
      json(401, { status_code: 401, message: 'Incorrect credentials.', data: null }),
    ]);
    const result = await make(fetch, tokens).request({
      method: 'POST',
      path: '/auth/login',
      schema,
      auth: false,
    });
    expect(result).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
    expect(refreshes).toBe(0);
  });
});

describe('ApiClient.requestPage', () => {
  it('returns items with pagination metadata', async () => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope([{ id: 1 }, { id: 2 }], {
          total_page_count: 3,
          next: 'http://internal/api/conversations?page=2',
          previous: null,
        }),
      ),
    ]);
    const result = await make(fetch).requestPage({ path: '/conversations', schema });
    expect(result).toEqual({
      ok: true,
      value: {
        items: [{ id: 1 }, { id: 2 }],
        next: 'http://internal/api/conversations?page=2',
        previous: null,
        totalPages: 3,
      },
    });
  });

  it('fails when an item is malformed', async () => {
    const { fetch } = fakeFetch([json(200, envelope([{ id: 'x' }]))]);
    const result = await make(fetch).requestPage({ path: '/conversations', schema });
    expect(result).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });
});

describe('403 reasons', () => {
  it.each([
    ['Your email address is not verified.', { kind: 'forbidden', code: 'email_not_verified' }],
    ['Please Verify Your Email to Continue', { kind: 'forbidden', code: 'email_not_verified' }],
    ['This account is inactive.', { kind: 'forbidden', code: 'account_inactive' }],
    [
      'Account locked. Try again in 12 minutes.',
      { kind: 'forbidden', code: 'account_locked', minutes: 12 },
    ],
    ['Account locked.', { kind: 'forbidden', code: 'account_locked' }],
    ['You do not have permission to perform this action.', { kind: 'forbidden' }],
    [null, { kind: 'forbidden' }],
  ])('maps %s', (message, expected) => {
    expect(forbiddenReason(message)).toEqual(expected);
  });

  it('is applied to real 403 responses', async () => {
    const { fetch } = fakeFetch([
      json(403, {
        status_code: 403,
        status: 0,
        message: 'Your email address is not verified.',
        data: null,
      }),
    ]);
    const result = await make(fetch).request({
      method: 'POST',
      path: '/auth/login',
      schema: z.unknown(),
      auth: false,
    });
    expect(result).toEqual({ ok: false, error: { kind: 'forbidden', code: 'email_not_verified' } });
  });
});
