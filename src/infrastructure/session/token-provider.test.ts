import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionStore } from '@/application/ports/auth';
import { SessionTokens, secondsUntilExpiry } from './token-provider';

/** A JWT whose payload says it expires `seconds` from now. Only the payload is read. */
function jwt(seconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `h.${payload}.s`;
}

class MemorySession implements SessionStore {
  constructor(public current: Session | null) {}
  read = async () => this.current;
  write = async (session: Session) => {
    this.current = session;
  };
  clear = async () => {
    this.current = null;
  };
}

const envelope = (data: unknown) => ({ status_code: 200, status: 0, message: 'ok', data });
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('secondsUntilExpiry', () => {
  it('reads the expiry from the payload', () => {
    expect(secondsUntilExpiry(jwt(120))).toBeGreaterThan(115);
    expect(secondsUntilExpiry(jwt(-30))).toBeLessThan(0);
  });

  it('is null for something that is not a token', () => {
    expect(secondsUntilExpiry('nonsense')).toBeNull();
    expect(secondsUntilExpiry('a.!!!.c')).toBeNull();
  });
});

describe('SessionTokens', () => {
  it('hands out a token that has time left without calling the backend', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const access = jwt(600);
    const tokens = new SessionTokens(new MemorySession({ accessToken: access, refreshToken: 'r' }), 'http://api.test/api', 1000);
    expect(await tokens.accessToken()).toBe(access);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renews a token that is about to die, and keeps the rotated refresh token', async () => {
    const fresh = jwt(900);
    const fetchSpy = vi.fn(async () => reply(200, envelope({ access: fresh, refresh: 'r2' })));
    vi.stubGlobal('fetch', fetchSpy);
    const session = new MemorySession({ accessToken: jwt(5), refreshToken: 'r1' });
    const tokens = new SessionTokens(session, 'http://api.test/api', 1000);

    expect(await tokens.accessToken()).toBe(fresh);
    expect(session.current).toEqual({ accessToken: fresh, refreshToken: 'r2' });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/auth/refresh');
    expect(JSON.parse(String(init.body))).toEqual({ refresh: 'r1' });
  });

  it('shares one refresh between requests, because the backend rotates the token', async () => {
    const fetchSpy = vi.fn(async () => reply(200, envelope({ access: jwt(900), refresh: 'r2' })));
    vi.stubGlobal('fetch', fetchSpy);
    const tokens = new SessionTokens(new MemorySession({ accessToken: jwt(1), refreshToken: 'r1' }), 'http://api.test/api', 1000);
    await Promise.all([tokens.accessToken(), tokens.accessToken(), tokens.refresh()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the refresh token is refused, and says so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(401, { status_code: 401, data: null })));
    const session = new MemorySession({ accessToken: jwt(1), refreshToken: 'dead' });
    const expired = vi.fn();
    const tokens = new SessionTokens(session, 'http://api.test/api', 1000, expired);
    expect(await tokens.refresh()).toBeNull();
    expect(session.current).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });

  it('keeps the session through a server error or no connection', async () => {
    const session = new MemorySession({ accessToken: jwt(1), refreshToken: 'r' });
    const expired = vi.fn();
    const tokens = new SessionTokens(session, 'http://api.test/api', 1000, expired);
    vi.stubGlobal('fetch', vi.fn(async () => reply(503, {})));
    expect(await tokens.refresh()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await tokens.refresh()).toBeNull();
    expect(session.current).not.toBeNull();
    expect(expired).not.toHaveBeenCalled();
  });

  it('cannot refresh without a refresh token', async () => {
    const tokens = new SessionTokens(new MemorySession({ accessToken: jwt(1), refreshToken: null }), 'http://api.test/api', 1000);
    expect(await tokens.refresh()).toBeNull();
  });
});
