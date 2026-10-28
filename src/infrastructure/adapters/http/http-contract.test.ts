import { describe, expect, it } from 'vitest';
import type { Session, SessionStore } from '@/application/ports/auth';
import { ArticleReference } from '@/domain/value-objects/article-reference';
import { Email } from '@/domain/value-objects/email';
import { EgyptianPhoneNumber } from '@/domain/value-objects/egyptian-phone-number';
import { Password } from '@/domain/value-objects/password';
import { ApiClient } from '@/infrastructure/http/api-client';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { HttpAuthService, passwordReasonCode, splitName } from './http-auth-service';
import { HttpConversationRepository } from './http-conversation-repository';
import { HttpLegalTextRepository } from './http-pending-adapters';
import { parseCitations, toArticleStatus, toMessage } from './mappers';

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

const summary = {
  id: 7,
  title: 'فسخ عقد',
  created_at: '2026-10-15T02:26:45.727Z',
  updated_at: '2026-10-15T02:26:45.727Z',
  last_message: 'x',
  message_count: 2,
};

const apiUser = {
  id: 3,
  first_name: 'منى',
  last_name: 'الشربيني',
  email: 'mona@example.com',
  role: 'USER',
};

describe('messages', () => {
  const msg = (id: number, role: string, at: string, extra: Record<string, unknown> = {}) => ({
    id,
    conversation: 7,
    role,
    content: `m${id}`,
    citations: '',
    warning: null,
    created_at: at,
    ...extra,
  });
  const session = new MemorySession({ accessToken: 't', refreshToken: null });

  it('loads the summary and messages, oldest first, skipping unknown roles', async () => {
    const { fetch, calls } = fakeFetch([
      json(200, envelope(summary)),
      json(
        200,
        envelope({
          messages: [
            msg(3, 'assistant', '2026-10-15T10:02:00Z', { warning: 'راجع النص الرسمي' }),
            msg(2, 'user', '2026-10-15T10:01:00Z'),
            msg(9, 'system', '2026-10-15T10:00:00Z'),
          ],
          next_cursor: null,
          has_more: false,
        }),
      ),
    ]);
    const result = await new HttpConversationRepository(client(fetch, session)).get('7');
    expect(result.ok && result.value.messages.map((m) => [m.id, m.role])).toEqual([
      ['2', 'user'],
      ['3', 'assistant'],
    ]);
    expect(result.ok && result.value.messages[1]?.warning).toBe('راجع النص الرسمي');
    expect(calls[1]?.url.pathname).toBe('/api/conversations/7/messages');
    expect(calls[1]?.url.searchParams.get('limit')).toBe('100');
    expect(calls[1]?.url.searchParams.has('cursor')).toBe(false);
  });

  it('follows next_cursor until has_more is false', async () => {
    const { fetch, calls } = fakeFetch([
      json(200, envelope(summary)),
      json(
        200,
        envelope({
          messages: [msg(2, 'assistant', '2026-10-15T10:02:00Z')],
          next_cursor: 'abc',
          has_more: true,
        }),
      ),
      json(
        200,
        envelope({
          messages: [msg(1, 'user', '2026-10-15T10:01:00Z')],
          next_cursor: null,
          has_more: false,
        }),
      ),
    ]);
    const result = await new HttpConversationRepository(client(fetch, session)).get('7');
    expect(result.ok && result.value.messages.map((m) => m.id)).toEqual(['1', '2']);
    expect(calls[2]?.url.searchParams.get('cursor')).toBe('abc');
  });

  it('passes a malformed-cursor 400 through', async () => {
    const { fetch } = fakeFetch([
      json(200, envelope(summary)),
      json(400, { status_code: 400, message: 'A validation error occurred.', data: 'cursor' }),
    ]);
    const result = await new HttpConversationRepository(client(fetch, session)).get('7');
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { _form: 'invalid' } },
    });
  });

  it('keeps user messages free of citations', () => {
    const message = toMessage({
      id: 1,
      role: 'user',
      content: 'q',
      citations: [{ article_number: 1 }],
      created_at: '2026-10-15T10:00:00Z',
    });
    expect(message?.citations).toEqual([]);
  });
});

describe('parseCitations', () => {
  it('reads a JSON string of article refs', () => {
    const raw = JSON.stringify([
      { article_number: 157, law_number: 131, law_year: 1948 },
      { article_number: '158', law_name: 'القانون المدني', text: 'نص' },
    ]);
    const result = parseCitations(raw, 'm1');
    expect(result.map((c) => [c.id, c.reference.law.name, c.reference.article])).toEqual([
      ['m1-0', 'قانون رقم 131 لسنة 1948', '157'],
      ['m1-1', 'القانون المدني', '158'],
    ]);
    expect(result[0]?.reference.law).toMatchObject({ number: 131, year: 1948 });
    expect(result[1]?.text).toBe('نص');
  });

  it('accepts an already-parsed array', () => {
    expect(parseCitations([{ article_number: 1, law_number: 5 }], 'm')).toHaveLength(1);
  });

  it('drops anything it cannot read instead of inventing it', () => {
    expect(parseCitations('', 'm')).toEqual([]);
    expect(parseCitations('not json', 'm')).toEqual([]);
    expect(parseCitations('{"a":1}', 'm')).toEqual([]);
    expect(parseCitations(null, 'm')).toEqual([]);
    expect(parseCitations([null, 'x', { law_number: 1 }, { article_number: 3 }], 'm')).toEqual([]);
  });
});

describe('toArticleStatus', () => {
  const now = new Date('2026-10-15T00:00:00Z');
  it('derives a status from the record', () => {
    expect(toArticleStatus({ status: 'PUBLISHED', superseded_by: null, valid_to: null }, now)).toBe(
      'in_force',
    );
    expect(toArticleStatus({ status: 'repealed', superseded_by: null, valid_to: null }, now)).toBe(
      'repealed',
    );
    expect(
      toArticleStatus(
        { status: 'PUBLISHED', superseded_by: null, valid_to: '2020-01-01T00:00:00Z' },
        now,
      ),
    ).toBe('repealed');
    expect(toArticleStatus({ status: 'PUBLISHED', superseded_by: 44, valid_to: null }, now)).toBe(
      'amended',
    );
    expect(toArticleStatus({ status: 'AMENDED', superseded_by: null, valid_to: null }, now)).toBe(
      'amended',
    );
  });
});

describe('registration and verification', () => {
  const data = (name = 'منى محمد الشربيني') => ({
    name,
    email: Email.create('mona@example.com'),
    password: Password.create('Sanadak2026!'),
    accountKind: null,
    phone: null,
    barRegistrationNumber: null,
  });

  it('splits a full name', () => {
    expect(splitName('منى محمد الشربيني')).toEqual({ first: 'منى', last: 'محمد الشربيني' });
    expect(splitName('  منى ')).toEqual({ first: 'منى', last: '' });
  });

  it('registers with the documented body and does not sign in', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([json(200, envelope(apiUser))]);
    const result = await new HttpAuthService(client(fetch, session), session).signUp(data());
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/auth/register');
    expect(calls[0]?.body).toEqual({
      first_name: 'منى',
      last_name: 'محمد الشربيني',
      email: 'mona@example.com',
      password: 'Sanadak2026!',
      password2: 'Sanadak2026!',
    });
    expect(session.session).toBeNull();
  });

  it('sends the optional fields nowhere, because the backend does not store them', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([json(200, envelope(apiUser))]);
    await new HttpAuthService(client(fetch, session), session).signUp({
      ...data(),
      accountKind: 'lawyer',
      phone: EgyptianPhoneNumber.create('01012345678'),
    });
    expect(Object.keys(calls[0]?.body as object).sort()).toEqual([
      'email',
      'first_name',
      'last_name',
      'password',
      'password2',
    ]);
  });

  it('turns a server-side email error into "already registered"', async () => {
    const session = new MemorySession();
    const { fetch } = fakeFetch([
      json(400, { status_code: 400, message: 'x', data: { email: ['exists'] } }),
    ]);
    const result = await new HttpAuthService(client(fetch, session), session).signUp(data());
    expect(result).toEqual({ ok: false, error: { kind: 'conflict', code: 'email_registered' } });
  });

  it('maps the backend password reasons to codes', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([
      json(400, {
        status_code: 400,
        message: 'A validation error occurred.',
        data: {
          password: [
            'This password is too common.',
            'The password must be at least 8 characters long.',
            "The password must contain at least one uppercase letter, 'A-Z'.",
            'The password must contain at least one special character.',
          ],
        },
      }),
    ]);
    const result = await new HttpAuthService(client(fetch, session), session).signUp(data());
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        fields: { password: 'password_too_common' },
        details: {
          password: [
            'password_too_common',
            'password_too_short',
            'password_needs_uppercase',
            'password_needs_special',
          ],
        },
      },
    });
    expect(calls[0]?.headers['Accept-Language']).toBe('en');
  });

  it('keeps unrecognised password messages as the generic code', () => {
    expect(passwordReasonCode('Something new the backend invented.')).toBe('invalid');
    expect(passwordReasonCode('This password is entirely numeric.')).toBe('invalid');
  });

  it('maps other backend field names to the form fields', async () => {
    const session = new MemorySession();
    const { fetch } = fakeFetch([
      json(400, {
        status_code: 400,
        message: 'x',
        data: { last_name: ['required'], password2: ['mismatch'], unknown_field: ['x'] },
      }),
    ]);
    const result = await new HttpAuthService(client(fetch, session), session).signUp(data('منى'));
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'validation',
        fields: { name: 'invalid', password: 'invalid', unknown_field: 'invalid' },
      },
    });
  });

  it('passes non-validation register errors through', async () => {
    const session = new MemorySession();
    const { fetch } = fakeFetch([json(429, { status_code: 429, data: null })]);
    const result = await new HttpAuthService(client(fetch, session), session).signUp(data());
    expect(result).toEqual({ ok: false, error: { kind: 'rate_limited' } });
  });

  it('verifies the email with {email, code}', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([json(200, envelope(apiUser))]);
    const result = await new HttpAuthService(client(fetch, session), session).verifyEmail(
      Email.create('mona@example.com'),
      '123456',
    );
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url.pathname).toBe('/api/auth/verify-email');
    expect(calls[0]?.body).toEqual({ email: 'mona@example.com', code: '123456' });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('reports a wrong or expired code as code_rejected and passes throttling through', async () => {
    const session = new MemorySession();
    const wrong = fakeFetch([
      json(400, { status_code: 400, message: 'x', data: { code: ['invalid'] } }),
    ]);
    const auth = new HttpAuthService(client(wrong.fetch, session), session);
    expect(await auth.verifyEmail(Email.create('a@b.co'), '000000')).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { code: 'code_rejected' } },
    });

    const throttled = fakeFetch([json(429, { status_code: 429, data: null })]);
    const limited = new HttpAuthService(client(throttled.fetch, session), session);
    expect(await limited.verifyEmail(Email.create('a@b.co'), '000000')).toEqual({
      ok: false,
      error: { kind: 'rate_limited' },
    });
  });

  it('resends the code with {email} and accepts an empty 200', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([new Response(null, { status: 200 })]);
    const result = await new HttpAuthService(client(fetch, session), session).resendVerification(
      Email.create('mona@example.com'),
    );
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url.pathname).toBe('/api/auth/verify-email/resend');
    expect(calls[0]?.body).toEqual({ email: 'mona@example.com' });
  });

  it('passes resend throttling through', async () => {
    const session = new MemorySession();
    const { fetch } = fakeFetch([json(429, { status_code: 429, data: null })]);
    const result = await new HttpAuthService(client(fetch, session), session).resendVerification(
      Email.create('a@b.co'),
    );
    expect(result).toEqual({ ok: false, error: { kind: 'rate_limited' } });
  });

  it('logs out with the refresh token in the body', async () => {
    const session = new MemorySession({ accessToken: 'a', refreshToken: 'r-1' });
    const { fetch, calls } = fakeFetch([new Response(null, { status: 204 })]);
    await new HttpAuthService(client(fetch, session), session).signOut();
    expect(calls[0]?.url.pathname).toBe('/api/auth/logout');
    expect(calls[0]?.body).toEqual({ refresh: 'r-1' });
    expect(session.session).toBeNull();
  });

  it('skips the logout call when there is no session', async () => {
    const session = new MemorySession();
    const { fetch, calls } = fakeFetch([]);
    await new HttpAuthService(client(fetch, session), session).signOut();
    expect(calls).toHaveLength(0);
  });
});

describe('HttpLegalTextRepository', () => {
  const session = new MemorySession({ accessToken: 't', refreshToken: null });
  const row = (over: Record<string, unknown>) => ({
    id: 1,
    document: 2,
    law_name: 'القانون المدني',
    number: 147,
    is_bis: false,
    bis_label: null,
    text_ocr: 'نص ocr',
    text_clean: 'العقد شريعة المتعاقدين',
    status: 'PUBLISHED',
    valid_to: null,
    superseded_by: null,
    ...over,
  });
  const ref = (article: string) =>
    ArticleReference.create({ name: 'القانون المدني', number: 131, year: 1948 }, article);
  const repo = (rows: unknown[]) => {
    const { fetch, calls } = fakeFetch([json(200, envelope(rows, { next: null }))]);
    return { repo: new HttpLegalTextRepository(client(fetch, session)), calls };
  };

  it('looks up by law name and number and prefers non-draft text', async () => {
    const { repo: r, calls } = repo([
      row({ id: 1, status: 'DRAFT', text_clean: 'مسودة' }),
      row({ id: 2, status: 'PUBLISHED' }),
    ]);
    const result = await r.getArticle(ref('147'));
    expect(result).toMatchObject({
      ok: true,
      value: { text: 'العقد شريعة المتعاقدين', status: 'in_force' },
    });
    expect(calls[0]?.url.pathname).toBe('/api/articles');
    expect(calls[0]?.url.searchParams.get('law_name')).toBe('القانون المدني');
    expect(calls[0]?.url.searchParams.get('number')).toBe('147');
  });

  it('falls back to a draft when nothing else exists', async () => {
    const { repo: r } = repo([row({ status: 'DRAFT', text_clean: 'مسودة' })]);
    const result = await r.getArticle(ref('147'));
    expect(result).toMatchObject({ ok: true, value: { text: 'مسودة' } });
  });

  it('uses OCR text when the clean text is empty', async () => {
    const { repo: r } = repo([row({ text_clean: '' })]);
    const result = await r.getArticle(ref('147'));
    expect(result).toMatchObject({ ok: true, value: { text: 'نص ocr' } });
  });

  it('matches suffixed articles by label', async () => {
    const { repo: r } = repo([
      row({ id: 1, is_bis: false }),
      row({ id: 2, is_bis: true, bis_label: 'مكرر', text_clean: 'نص مكرر' }),
    ]);
    const result = await r.getArticle(ref('147 مكرر'));
    expect(result).toMatchObject({ ok: true, value: { text: 'نص مكرر' } });
  });

  it('reports not found for no match or a non-numeric article', async () => {
    expect(await repo([]).repo.getArticle(ref('999'))).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    const { repo: r, calls } = repo([]);
    expect(await r.getArticle(ref('مكرر'))).toEqual({ ok: false, error: { kind: 'not_found' } });
    expect(calls).toHaveLength(0);
  });

  it('passes backend failures through', async () => {
    const { fetch } = fakeFetch([json(403, { status_code: 403, data: null })]);
    const r = new HttpLegalTextRepository(client(fetch, session));
    expect(await r.getArticle(ref('147'))).toEqual({ ok: false, error: { kind: 'forbidden' } });
  });
});

describe('confirmed message and citation shape', () => {
  // Trimmed from a real response. Note the sample repeats the "citations" key; the last wins.
  const raw = String.raw`{
    "status_code": 200, "status": 1, "message": null,
    "data": {
      "messages": [
        {"id": 177, "conversation": 69, "role": "user", "content": "ما نص المادة 85؟",
         "citations": null, "warning": "", "created_at": "2026-09-25T14:41:59.958630+03:00"},
        {"id": 178, "conversation": 69, "role": "assistant",
         "content": "المادة 85 ...\n\n---\nالمصادر:\n• 280_قانون المحاماه — المادة 85\n",
         "citations": null,
         "citations": [
           {"isBis": false, "status": "ACTIVE", "lawName": "280_قانون المحاماه", "articleNumber": 85},
           {"isBis": true, "status": "ACTIVE", "lawName": "قانون العقوبات", "articleNumber": 309}
         ],
         "warning": "", "created_at": "2026-09-25T14:42:09.218839+03:00"}
      ],
      "next_cursor": null, "has_more": false
    }
  }`;
  const session = new MemorySession({ accessToken: 't', refreshToken: null });

  it('maps camelCase citations, blank warnings and +03:00 timestamps', async () => {
    const { fetch } = fakeFetch([
      json(200, envelope(summary)),
      new Response(raw, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ]);
    const result = await new HttpConversationRepository(client(fetch, session)).get('69');
    if (!result.ok) throw new Error('expected ok');

    const [user, assistant] = result.value.messages;
    expect(user).toMatchObject({ role: 'user', citations: [], warning: null });
    expect(user?.createdAt.toISOString()).toBe('2026-09-25T11:41:59.958Z');
    expect(assistant?.warning).toBeNull();
    expect(
      assistant?.citations.map((c) => [c.reference.law.name, c.reference.article, c.status]),
    ).toEqual([
      ['280_قانون المحاماه', '85', 'in_force'],
      ['قانون العقوبات', '309 مكرر', 'in_force'],
    ]);
  });

  it('maps a non-active citation status', () => {
    const [c] = parseCitations(
      [{ isBis: false, status: 'REPEALED', lawName: 'قانون', articleNumber: 1 }],
      'm',
    );
    expect(c?.status).toBe('repealed');
  });
});

describe('message roles', () => {
  const base = { id: 1, content: 'x', created_at: '2026-10-15T10:00:00Z' };

  it('accepts uppercase, lowercase and mixed case', () => {
    expect(toMessage({ ...base, role: 'USER' })?.role).toBe('user');
    expect(toMessage({ ...base, role: 'assistant' })?.role).toBe('assistant');
    expect(toMessage({ ...base, role: 'Assistant' })?.role).toBe('assistant');
  });

  it('skips system turns', () => {
    expect(toMessage({ ...base, role: 'system' })).toBeNull();
    expect(toMessage({ ...base, role: 'SYSTEM' })).toBeNull();
  });
});

describe('password reset', () => {
  const session = new MemorySession();
  const email = Email.create('mona@example.com');

  it('requests a code with {email}', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope(null))]);
    const result = await new HttpAuthService(client(fetch, session), session).requestPasswordReset(
      email,
    );
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url.pathname).toBe('/api/auth/password/reset');
    expect(calls[0]?.body).toEqual({ email: 'mona@example.com' });
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('verifies the code, then confirms with new_password', async () => {
    const { fetch, calls } = fakeFetch([json(200, envelope(null)), json(200, envelope(null))]);
    const result = await new HttpAuthService(client(fetch, session), session).resetPassword(
      email,
      '123456',
      Password.create('Sanadak2026!'),
    );
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls.map((c) => c.url.pathname)).toEqual([
      '/api/auth/password/reset/verify',
      '/api/auth/password/reset/confirm',
    ]);
    expect(calls[0]?.body).toEqual({ email: 'mona@example.com', code: '123456' });
    expect(calls[1]?.body).toEqual({
      email: 'mona@example.com',
      code: '123456',
      new_password: 'Sanadak2026!',
    });
  });

  it('stops at a rejected code without trying to set the password', async () => {
    const { fetch, calls } = fakeFetch([
      json(400, { status_code: 400, message: 'x', data: { code: ['invalid'] } }),
    ]);
    const result = await new HttpAuthService(client(fetch, session), session).resetPassword(
      email,
      '000000',
      Password.create('Sanadak2026!'),
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { code: 'code_rejected' } },
    });
    expect(calls).toHaveLength(1);
  });

  it('maps backend password reasons from new_password onto the form field', async () => {
    const { fetch } = fakeFetch([
      json(200, envelope(null)),
      json(400, {
        status_code: 400,
        message: 'x',
        data: { new_password: ['This password is too common.'] },
      }),
    ]);
    const result = await new HttpAuthService(client(fetch, session), session).resetPassword(
      email,
      '123456',
      Password.create('Sanadak2026!'),
    );
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        fields: { password: 'password_too_common' },
        details: { password: ['password_too_common'] },
      },
    });
  });

  it('passes throttling through', async () => {
    const { fetch } = fakeFetch([json(429, { status_code: 429, data: null })]);
    const result = await new HttpAuthService(client(fetch, session), session).requestPasswordReset(
      email,
    );
    expect(result).toEqual({ ok: false, error: { kind: 'rate_limited' } });
  });
});

describe('sign in outcomes the app routes on', () => {
  const session = new MemorySession();
  const attempt = async (status: number, message: string) => {
    const { fetch } = fakeFetch([
      json(status, { status_code: status, status: 0, message, data: null }),
    ]);
    return new HttpAuthService(client(fetch, session), session).signIn(Email.create('a@b.co'), 'x');
  };

  it('tells an unverified account apart', async () => {
    expect(await attempt(403, 'Your email address is not verified.')).toEqual({
      ok: false,
      error: { kind: 'forbidden', code: 'email_not_verified' },
    });
  });

  it('tells an inactive account apart', async () => {
    expect(await attempt(403, 'This account is inactive.')).toEqual({
      ok: false,
      error: { kind: 'forbidden', code: 'account_inactive' },
    });
  });

  it('reports how long a lockout lasts', async () => {
    expect(await attempt(403, 'Account locked. Try again in 7 minutes.')).toEqual({
      ok: false,
      error: { kind: 'forbidden', code: 'account_locked', minutes: 7 },
    });
  });

  it('keeps wrong credentials as unauthenticated', async () => {
    expect(await attempt(401, 'Incorrect credentials.')).toEqual({
      ok: false,
      error: { kind: 'unauthenticated' },
    });
  });
});
