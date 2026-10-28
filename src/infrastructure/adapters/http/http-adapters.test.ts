import { describe, expect, it } from 'vitest';
import type { Session, SessionStore } from '@/application/ports/auth';
import { ConversationTitle } from '@/domain/value-objects/conversation-title';
import { Email } from '@/domain/value-objects/email';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { ApiClient } from '@/infrastructure/http/api-client';
import { HttpAuthService } from './http-auth-service';
import { HttpConversationRepository } from './http-conversation-repository';
import { toUser } from './mappers';

class MemorySession implements SessionStore {
  constructor(public session: Session | null = null) {}
  async read() {
    return this.session;
  }
  async write(session: Session) {
    this.session = session;
  }
  async clear() {
    this.session = null;
  }
}

const apiUser = {
  id: 12,
  first_name: 'منى',
  last_name: 'الشربيني',
  email: 'mona@example.com',
  role: 'USER',
  extra_field_we_ignore: true,
};

const client = (fetchImpl: typeof fetch, session: SessionStore) =>
  new ApiClient({
    baseUrl: 'http://api.test/api',
    timeoutMs: 1000,
    fetch: fetchImpl,
    tokens: {
      accessToken: async () => (await session.read())?.accessToken ?? null,
      refresh: async () => null,
    },
  });

describe('toUser', () => {
  it('joins first and last name and stringifies the id', () => {
    expect(toUser(apiUser as never)).toMatchObject({
      id: '12',
      name: 'منى الشربيني',
      email: 'mona@example.com',
    });
  });

  it('falls back to the email when the name is blank', () => {
    const user = toUser({ id: 1, first_name: ' ', last_name: null, email: 'a@b.co' });
    expect(user.name).toBe('a@b.co');
  });
});

describe('HttpAuthService', () => {
  it('logs in, stores both tokens, then loads the profile', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([
      json(200, envelope({ access: 'A', refresh: 'R' })),
      json(200, envelope(apiUser)),
    ]);
    const auth = new HttpAuthService(client(fetch, session), session);

    const result = await auth.signIn(Email.create('Mona@Example.com'), 'secret');

    expect(result).toMatchObject({ ok: true, value: { id: '12', name: 'منى الشربيني' } });
    expect(session.session).toEqual({ accessToken: 'A', refreshToken: 'R' });
    expect(calls[0]?.url.pathname).toBe('/api/auth/login');
    expect(calls[0]?.body).toEqual({ email: 'mona@example.com', password: 'secret' });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
    expect(calls[1]?.headers.Authorization).toBe('Bearer A');
  });

  it('keeps the session empty on wrong credentials', async () => {
    const session = new MemorySession();
    const { fetch } = fakeFetch([
      json(401, { status_code: 401, status: 0, message: 'Incorrect credentials.', data: null }),
    ]);
    const auth = new HttpAuthService(client(fetch, session), session);
    expect(await auth.signIn(Email.create('a@b.co'), 'bad')).toEqual({
      ok: false,
      error: { kind: 'unauthenticated' },
    });
    expect(session.session).toBeNull();
  });

  it('treats a missing session as signed out without calling the API', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([]);
    const auth = new HttpAuthService(client(fetch, session), session);
    expect(await auth.currentUser()).toEqual({ ok: true, value: null });
    expect(calls).toHaveLength(0);
  });

  it('treats a rejected token as signed out', async () => {
    const session = new MemorySession({ accessToken: 'expired', refreshToken: null });
    const { fetch } = fakeFetch([json(401, { status_code: 401, data: null })]);
    const auth = new HttpAuthService(client(fetch, session), session);
    expect(await auth.currentUser()).toEqual({ ok: true, value: null });
  });

  it('returns the profile for a valid token and passes other failures through', async () => {
    const session = new MemorySession({ accessToken: 'ok', refreshToken: null });
    const good = fakeFetch([json(200, envelope(apiUser))]);
    const result = await new HttpAuthService(client(good.fetch, session), session).currentUser();
    expect(result).toMatchObject({ ok: true, value: { email: 'mona@example.com' } });

    const down = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    expect(await new HttpAuthService(client(down.fetch, session), session).currentUser()).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
  });

  it('clears the session on sign-out even if the API call fails', async () => {
    const session = new MemorySession({ accessToken: 'a', refreshToken: 'r' });
    const { fetch } = fakeFetch([json(500, { status_code: 500, data: null })]);
    const auth = new HttpAuthService(client(fetch, session), session);
    expect(await auth.signOut()).toEqual({ ok: true, value: undefined });
    expect(session.session).toBeNull();
  });
});

describe('HttpConversationRepository', () => {
  const row = (id: number, title: string) => ({
    id,
    title,
    created_at: '2026-10-15T02:16:50.052Z',
    updated_at: '2026-10-15T03:00:00.000Z',
    last_message: 'x',
    message_count: 2,
  });
  const session = new MemorySession({ accessToken: 't', refreshToken: null });

  it('lists and maps summaries', async () => {
    const { fetch } = fakeFetch([json(200, envelope([row(1, 'فسخ عقد'), row(2, 'نفقة')]))]);
    const result = await new HttpConversationRepository(client(fetch, session)).list();
    expect(result.ok && result.value.map((c) => [c.id, c.title])).toEqual([
      ['1', 'فسخ عقد'],
      ['2', 'نفقة'],
    ]);
    expect(result.ok && result.value[0]?.updatedAt.toISOString()).toBe('2026-10-15T03:00:00.000Z');
  });

  it('follows "next" by path only, never by host', async () => {
    const { fetch, calls } = fakeFetch([
      json(200, envelope([row(1, 'a')], { next: 'http://10.0.0.5:8000/api/conversations?page=2' })),
      json(200, envelope([row(2, 'b')], { next: null })),
    ]);
    const result = await new HttpConversationRepository(client(fetch, session)).list();
    expect(result.ok && result.value).toHaveLength(2);
    expect(calls[1]?.url.toString()).toBe('http://api.test/api/conversations?page=2');
  });

  it('stops after three pages', async () => {
    const page = () =>
      json(200, envelope([row(1, 'a')], { next: 'http://x/api/conversations?page=9' }));
    const { fetch, calls } = fakeFetch([page(), page(), page(), page()]);
    await new HttpConversationRepository(client(fetch, session)).list();
    expect(calls).toHaveLength(3);
  });

  it('uses the id as a title when the backend sends none', async () => {
    const { fetch } = fakeFetch([json(200, envelope([{ ...row(5, ''), title: null }]))]);
    const result = await new HttpConversationRepository(client(fetch, session)).list();
    expect(result.ok && result.value[0]?.title).toBe('5');
  });

  it('searches titles locally, case-insensitively', async () => {
    const { fetch } = fakeFetch([json(200, envelope([row(1, 'Lease dispute'), row(2, 'نفقة')]))]);
    const result = await new HttpConversationRepository(client(fetch, session)).search('LEASE');
    expect(result.ok && result.value.map((c) => c.id)).toEqual(['1']);
  });

  it('renames with PATCH and deletes with DELETE', async () => {
    const { fetch, calls } = fakeFetch([
      json(200, envelope(row(3, 'جديد'))),
      new Response(null, { status: 204 }),
    ]);
    const repo = new HttpConversationRepository(client(fetch, session));
    expect(await repo.rename('3', ConversationTitle.create('جديد'))).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await repo.remove('3')).toEqual({ ok: true, value: undefined });
    expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
      ['PATCH', '/api/conversations/3'],
      ['DELETE', '/api/conversations/3'],
    ]);
    expect(calls[0]?.body).toEqual({ title: 'جديد' });
  });

  it('passes errors through from list, rename and remove', async () => {
    const fail = () => json(404, { status_code: 404, data: null });
    const repo = new HttpConversationRepository(client(fakeFetch(() => fail()).fetch, session));
    expect(await repo.list()).toEqual({ ok: false, error: { kind: 'not_found' } });
    expect(await repo.get('1')).toEqual({ ok: false, error: { kind: 'not_found' } });
    expect(await repo.search('x')).toEqual({ ok: false, error: { kind: 'not_found' } });
    expect(await repo.rename('1', ConversationTitle.create('x'))).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    expect(await repo.remove('1')).toEqual({ ok: false, error: { kind: 'not_found' } });
  });
});
