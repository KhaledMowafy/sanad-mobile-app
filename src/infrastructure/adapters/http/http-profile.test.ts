import { describe, expect, it } from 'vitest';
import { GetProfile } from '@/application/use-cases/profile';
import { ApiClient } from '@/infrastructure/http/api-client';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { HttpProfileGateway } from './http-profile-gateway';

const clientFor = (fetchImpl: typeof fetch) =>
  new ApiClient({
    baseUrl: 'http://api.test/api',
    timeoutMs: 1000,
    fetch: fetchImpl,
    tokens: { accessToken: async () => 'tok', refresh: async () => null },
  });

const me = (over: Record<string, unknown> = {}) => ({
  id: 1,
  first_name: 'منى',
  last_name: 'الشربيني',
  email: 'mona@example.com',
  role: 'USER',
  provider: 'LOCAL',
  is_active: true,
  is_verified: true,
  created_at: '2026-08-02T09:30:00Z',
  last_login: '2026-10-15T08:00:00Z',
  token_quota: null,
  usage: {
    used: 410000,
    limit: 2000000,
    remaining: 1590000,
    period_start: '2026-10-01T00:00:00+03:00',
    resets_at: '2026-11-01T00:00:00+03:00',
    state: 'ok',
    this_period: { prompt: 150000, completion: 260000, total: 410000 },
    all_time: { prompt: 610000, completion: 980000, total: 1590000 },
    by_kind: {
      QA: { prompt: 90000, completion: 150000, total: 240000, calls: 61 },
      DRAFT: { prompt: 20000, completion: 30000, total: 50000, calls: 3 },
    },
  },
  ...over,
});

describe('profile from GET /users/me', () => {
  it('reads the account and the whole usage breakdown', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope(me()))]);
    const result = await new GetProfile(new HttpProfileGateway(clientFor(fetch))).execute();

    expect(calls[0]?.url.pathname).toBe('/api/users/me');
    expect(result).toMatchObject({
      ok: true,
      value: {
        user: { name: 'منى الشربيني', email: 'mona@example.com', initial: 'م' },
        role: 'USER',
        provider: 'LOCAL',
        isVerified: true,
        isActive: true,
        createdAt: '2026-08-02T09:30:00.000Z',
        lastLogin: '2026-10-15T08:00:00.000Z',
        usage: {
          period: { used: 410000, limit: 2000000, remaining: 1590000, state: 'ok' },
          thisPeriod: { total: 410000 },
          allTime: { total: 1590000 },
          byKind: { QA: { calls: 61, total: 240000 }, DRAFT: { calls: 3 } },
        },
      },
    });
  });

  it('shows no quota as null, not as zero left', async () => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope(
          me({
            usage: {
              used: 5,
              limit: null,
              remaining: null,
              period_start: '2026-10-01T00:00:00+03:00',
              resets_at: '2026-11-01T00:00:00+03:00',
              state: 'ok',
              this_period: { prompt: 2, completion: 3, total: 5 },
              all_time: { prompt: 2, completion: 3, total: 5 },
              by_kind: {},
            },
          }),
        ),
      ),
    ]);
    const result = await new GetProfile(new HttpProfileGateway(clientFor(fetch))).execute();
    expect(result.ok && result.value.usage?.period).toMatchObject({ limit: null, remaining: null });
    expect(result.ok && result.value.usage?.byKind).toEqual({});
  });

  it('still shows the account when the usage block is missing or unreadable', async () => {
    const { fetch } = fakeFetch([json(200, envelope(me({ usage: { used: 'lots' } })))]);
    const result = await new GetProfile(new HttpProfileGateway(clientFor(fetch))).execute();
    expect(result).toMatchObject({ ok: true, value: { usage: null, role: 'USER' } });
  });

  it('reports an expired session as unauthenticated', async () => {
    const { fetch } = fakeFetch([
      json(401, { status_code: 401, message: 'Token expired', data: null }),
    ]);
    const result = await new GetProfile(new HttpProfileGateway(clientFor(fetch))).execute();
    expect(result).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
  });
});
