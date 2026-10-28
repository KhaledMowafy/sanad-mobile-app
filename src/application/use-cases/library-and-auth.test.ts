import { describe, expect, it } from 'vitest';
import { citation, conversation, message, user } from '@/test-support/builders';
import {
  FakeAuthService,
  FakeChatGateway,
  FakeConversationRepository,
  FakeLegalTextRepository,
  FixedClock,
} from '@/test-support/fakes';
import type { AppError } from '../errors';
import { err, mapResult, ok } from '../result';
import { GetArticle, SubmitFeedback } from './articles-and-feedback';
import {
  GetCurrentUser,
  RequestPasswordReset,
  ResendVerification,
  ResetPassword,
  SignIn,
  SignOut,
  SignUp,
  VerifyEmail,
  type SignUpInput,
} from './auth';
import {
  DeleteConversation,
  ExportConversation,
  GetConversation,
  ListConversations,
  RenameConversation,
  SearchConversations,
} from './conversations';

const clock = new FixedClock(new Date('2026-10-15T10:00:00Z'));

describe('Result helpers', () => {
  it('maps ok values and leaves errors alone', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual({ ok: true, value: 4 });
    const failure = err({ kind: 'network' } as const);
    expect(mapResult(failure, () => 1)).toBe(failure);
  });
});

describe('conversation use cases', () => {
  const today = conversation({
    id: 'c1',
    title: 'فسخ عقد شقة',
    updatedAt: new Date('2026-10-15T08:00:00Z'),
    messages: [message({ id: 'q', content: 'ما الخيارات؟' })],
  });
  const older = conversation({
    id: 'c2',
    title: 'نفقة الصغار',
    updatedAt: new Date('2026-10-01T08:00:00Z'),
  });
  const repo = () => new FakeConversationRepository([older, today]);

  it('lists grouped by recency', async () => {
    const result = await new ListConversations(repo(), clock).execute();
    expect(result).toMatchObject({
      ok: true,
      value: [
        { bucket: 'today', items: [{ id: 'c1', title: 'فسخ عقد شقة' }] },
        { bucket: 'older', items: [{ id: 'c2' }] },
      ],
    });
  });

  it('passes list failures through', async () => {
    const r = repo();
    r.failWith = { kind: 'network' };
    expect(await new ListConversations(r, clock).execute()).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
    expect(await new SearchConversations(r, clock).execute('x')).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
  });

  it('searches with a trimmed query and falls back to the list when blank', async () => {
    const r = repo();
    const search = new SearchConversations(r, clock);
    const hit = await search.execute('  نفقة ');
    expect(r.searched).toEqual(['نفقة']);
    expect(hit).toMatchObject({ ok: true, value: [{ bucket: 'older' }] });

    const all = await search.execute('   ');
    expect(r.searched).toEqual(['نفقة']);
    expect(all.ok && all.value.flatMap((g) => g.items)).toHaveLength(2);
  });

  it('honours the configured time zone', async () => {
    const edge = conversation({ id: 'e', updatedAt: new Date('2026-10-14T22:30:00Z') });
    const r = new FakeConversationRepository([edge]);
    const utc = await new ListConversations(r, clock, 'UTC').execute();
    const cairo = await new ListConversations(r, clock).execute();
    expect(utc.ok && utc.value[0]?.bucket).toBe('yesterday');
    expect(cairo.ok && cairo.value[0]?.bucket).toBe('today');
  });

  it('gets one conversation as a DTO', async () => {
    const result = await new GetConversation(repo()).execute('c1');
    expect(result).toMatchObject({
      ok: true,
      value: { id: 'c1', messages: [{ id: 'q', createdAt: '2026-10-15T10:00:00.000Z' }] },
    });
    expect(await new GetConversation(repo()).execute('missing')).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    expect(await new GetConversation(repo()).execute('  ')).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('renames with validation', async () => {
    const r = repo();
    const useCase = new RenameConversation(r);
    expect(await useCase.execute({ id: 'c1', title: '  عنوان   جديد ' })).toEqual({
      ok: true,
      value: { title: 'عنوان جديد' },
    });
    expect(r.renamed).toEqual([{ id: 'c1', title: 'عنوان جديد' }]);

    expect(await useCase.execute({ id: 'c1', title: '  ' })).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { title: 'invalid_conversation_title' } },
    });
    expect(await useCase.execute({ id: '', title: 'x' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    expect(r.renamed).toHaveLength(1);

    r.failWith = { kind: 'forbidden' };
    expect(await useCase.execute({ id: 'c1', title: 'x' })).toEqual({
      ok: false,
      error: { kind: 'forbidden' },
    });
  });

  it('deletes', async () => {
    const r = repo();
    expect(await new DeleteConversation(r).execute('c1')).toEqual({ ok: true, value: undefined });
    expect(r.removed).toEqual(['c1']);
    expect(await new DeleteConversation(r).execute(' ')).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('exports text with a safe filename', async () => {
    const withCitation = conversation({
      id: 'c3',
      title: 'عقد: بيع/إيجار?',
      messages: [
        message({ id: 'a', role: 'assistant', content: 'نعم', citations: [citation('147')] }),
      ],
    });
    const useCase = new ExportConversation(new FakeConversationRepository([withCitation]));
    const result = await useCase.execute({ id: 'c3', locale: 'ar' });
    expect(result).toMatchObject({ ok: true, value: { filename: 'عقد بيعإيجار.txt' } });
    expect(result.ok && result.value.text).toContain('م. 147');

    expect(await useCase.execute({ id: 'nope', locale: 'ar' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
    expect(await useCase.execute({ id: '', locale: 'ar' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    });
  });

  it('falls back to a generic filename', async () => {
    const odd = conversation({ id: 'c4', title: '???' });
    const result = await new ExportConversation(new FakeConversationRepository([odd])).execute({
      id: 'c4',
      locale: 'en',
    });
    expect(result).toMatchObject({ ok: true, value: { filename: 'conversation.txt' } });
  });
});

describe('articles and feedback', () => {
  const article = {
    reference: citation('157').reference,
    text: 'في العقود الملزمة للجانبين',
    status: 'in_force' as const,
    bookLabel: 'الكتاب الأول',
  };

  it('loads an article by reference', async () => {
    const useCase = new GetArticle(new FakeLegalTextRepository([article]));
    expect(
      await useCase.execute({
        lawName: 'القانون المدني',
        lawNumber: 131,
        lawYear: 1948,
        article: '١٥٧',
      }),
    ).toEqual({
      ok: true,
      value: {
        lawName: 'القانون المدني',
        lawNumber: 131,
        lawYear: 1948,
        article: '157',
        status: 'in_force',
        text: 'في العقود الملزمة للجانبين',
        bookLabel: 'الكتاب الأول',
      },
    });
  });

  it('validates the reference and reports unknown articles', async () => {
    const useCase = new GetArticle(new FakeLegalTextRepository([article]));
    expect(
      await useCase.execute({ lawName: '', lawNumber: null, lawYear: null, article: '1' }),
    ).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { article: 'invalid_article_reference' } },
    });
    expect(
      await useCase.execute({
        lawName: 'القانون المدني',
        lawNumber: 131,
        lawYear: 1948,
        article: '999',
      }),
    ).toEqual({ ok: false, error: { kind: 'not_found' } });
  });

  it('forwards feedback to the gateway', async () => {
    const gateway = new FakeChatGateway();
    const result = await new SubmitFeedback(gateway).execute({
      conversationId: 'c1',
      messageId: 'm1',
      feedback: 'up',
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(gateway.feedback).toEqual([{ conversationId: 'c1', messageId: 'm1', feedback: 'up' }]);
  });
});

describe('auth use cases', () => {
  const validSignUp: SignUpInput = {
    name: '  منى   الشربيني ',
    email: 'Mona.Elsherbiny@Example.com',
    password: 'Sanadak2026!',
    acceptedTerms: true,
  };

  it('signs in with a normalised email', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new SignIn(auth).execute({ email: ' Mona@Example.com ', password: 'x' });
    expect(auth.signInCalls).toEqual([{ email: 'mona@example.com', password: 'x' }]);
    expect(result).toMatchObject({
      ok: true,
      value: { id: 'u1', firstName: 'منى', initial: 'م', professionalTitle: 'محامية بالنقض' },
    });
  });

  it('does not apply sign-up password rules at sign-in', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new SignIn(auth).execute({ email: 'a@b.co', password: 'old' });
    expect(result.ok).toBe(true);
  });

  it('validates sign-in fields and passes backend errors through', async () => {
    const auth = new FakeAuthService(err({ kind: 'unauthenticated' }));
    const bad = await new SignIn(auth).execute({ email: 'nope', password: '' });
    expect(bad).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        fields: { email: 'invalid_email', password: 'password_required' },
      },
    });
    expect(auth.signInCalls).toHaveLength(0);

    const rejected = await new SignIn(auth).execute({ email: 'a@b.co', password: 'x' });
    expect(rejected).toEqual({ ok: false, error: { kind: 'unauthenticated' } });
  });

  it('registers with value objects and returns the address to verify', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new SignUp(auth).execute(validSignUp);
    expect(result).toEqual({ ok: true, value: { email: 'mona.elsherbiny@example.com' } });
    const call = auth.signUpCalls[0];
    expect(call?.name).toBe('منى الشربيني');
    expect(call?.email.value).toBe('mona.elsherbiny@example.com');
    expect(call?.password.value).toBe('Sanadak2026!');
    expect(call).toMatchObject({ phone: null, accountKind: null, barRegistrationNumber: null });
  });

  it('still validates and passes the optional fields when they are given', async () => {
    const auth = new FakeAuthService(ok(user()));
    await new SignUp(auth).execute({
      ...validSignUp,
      accountKind: 'lawyer',
      phone: '010 1234 5678',
      barRegistrationNumber: '12345',
    });
    const call = auth.signUpCalls[0];
    expect(call?.phone?.e164).toBe('+201012345678');
    expect(call?.accountKind).toBe('lawyer');
    expect(call?.barRegistrationNumber?.value).toBe('12345');
  });

  it('treats blank optional fields as absent', async () => {
    const auth = new FakeAuthService(ok(user()));
    await new SignUp(auth).execute({ ...validSignUp, barRegistrationNumber: '   ', phone: '' });
    expect(auth.signUpCalls[0]).toMatchObject({ phone: null, barRegistrationNumber: null });
  });

  it('reports every invalid field at once', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new SignUp(auth).execute({
      name: '  ',
      accountKind: 'individual',
      email: 'bad',
      phone: '123',
      barRegistrationNumber: 'abc',
      password: 'short',
      acceptedTerms: false,
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        fields: {
          name: 'name_required',
          email: 'invalid_email',
          phone: 'invalid_phone',
          password: 'password_too_short',
          barRegistrationNumber: 'invalid_bar_number',
          acceptedTerms: 'terms_required',
        },
      },
    });
    expect(auth.signUpCalls).toHaveLength(0);
  });

  it('surfaces an already-registered email from the backend', async () => {
    const conflict: AppError = { kind: 'conflict', code: 'email_registered' };
    const auth = new FakeAuthService(ok(user()));
    auth.signUpResult = err(conflict);
    expect(await new SignUp(auth).execute(validSignUp)).toEqual({ ok: false, error: conflict });
  });

  it('reports each password rule that fails, one at a time', async () => {
    const auth = new FakeAuthService(ok(user()));
    const code = async (password: string) => {
      const result = await new SignUp(auth).execute({ ...validSignUp, password });
      return !result.ok && result.error.kind === 'validation' ? result.error.fields.password : null;
    };
    expect(await code('Ab1!')).toBe('password_too_short');
    expect(await code('sanadak2026!')).toBe('password_needs_uppercase');
    expect(await code('Sanadak2026')).toBe('password_needs_special');
    expect(await code('Sanadak2026!')).toBeNull();
  });

  it('verifies an email with a normalised six-digit code', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new VerifyEmail(auth).execute({
      email: 'Mona@Example.com',
      code: ' ١٢٣ ٤٥٦ ',
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(auth.verifyCalls).toEqual([{ email: 'mona@example.com', code: '123456' }]);
  });

  it('rejects a malformed code before calling the backend', async () => {
    const auth = new FakeAuthService(ok(user()));
    for (const code of ['', '12345', '1234567', 'abcdef']) {
      const result = await new VerifyEmail(auth).execute({ email: 'a@b.co', code });
      expect(result).toEqual({
        ok: false,
        error: { kind: 'validation', fields: { code: 'invalid_verification_code' } },
      });
    }
    const badEmail = await new VerifyEmail(auth).execute({ email: 'nope', code: '123456' });
    expect(badEmail).toMatchObject({ ok: false, error: { fields: { email: 'invalid_email' } } });
    expect(auth.verifyCalls).toHaveLength(0);
  });

  it('passes a rejected code through', async () => {
    const auth = new FakeAuthService(ok(user()));
    auth.verifyResult = err({ kind: 'validation', fields: { code: 'code_rejected' } });
    const result = await new VerifyEmail(auth).execute({ email: 'a@b.co', code: '123456' });
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { code: 'code_rejected' } },
    });
  });

  it('resends a verification email and validates the address', async () => {
    const auth = new FakeAuthService(ok(user()));
    expect(await new ResendVerification(auth).execute({ email: ' A@B.co ' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(auth.resendCalls).toEqual(['a@b.co']);
    expect(await new ResendVerification(auth).execute({ email: 'nope' })).toMatchObject({
      ok: false,
      error: { kind: 'validation' },
    });
  });

  it('requests a password reset for a normalised address', async () => {
    const auth = new FakeAuthService(ok(user()));
    expect(await new RequestPasswordReset(auth).execute({ email: ' Mona@Example.com ' })).toEqual({
      ok: true,
      value: { email: 'mona@example.com' },
    });
    expect(auth.resetRequests).toEqual(['mona@example.com']);
    expect(await new RequestPasswordReset(auth).execute({ email: 'nope' })).toMatchObject({
      ok: false,
      error: { kind: 'validation', fields: { email: 'invalid_email' } },
    });
  });

  it('resets a password with a code and a password that meets the rules', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new ResetPassword(auth).execute({
      email: 'mona@example.com',
      code: '123 456',
      password: 'Sanadak2026!',
    });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(auth.resetCalls).toEqual([
      { email: 'mona@example.com', code: '123456', password: 'Sanadak2026!' },
    ]);
  });

  it('reports every invalid reset field and does not call the backend', async () => {
    const auth = new FakeAuthService(ok(user()));
    const result = await new ResetPassword(auth).execute({
      email: 'bad',
      code: '12',
      password: 'weak',
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        fields: {
          email: 'invalid_email',
          code: 'invalid_verification_code',
          password: 'password_too_short',
        },
      },
    });
    expect(auth.resetCalls).toHaveLength(0);
  });

  it('signs out', async () => {
    const auth = new FakeAuthService(ok(user()));
    await new SignOut(auth).execute();
    expect(auth.signedOut).toBe(1);
  });

  it('returns the current user, null, or an error', async () => {
    const withUser = new FakeAuthService(ok(user()), ok(user()));
    expect(await new GetCurrentUser(withUser).execute()).toMatchObject({
      ok: true,
      value: { id: 'u1' },
    });
    expect(await new GetCurrentUser(new FakeAuthService(ok(user()))).execute()).toEqual({
      ok: true,
      value: null,
    });
    const failing = new FakeAuthService(ok(user()), err({ kind: 'network' }));
    expect(await new GetCurrentUser(failing).execute()).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
  });
});
