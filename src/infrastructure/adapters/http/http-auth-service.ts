import type { AppError } from '@/application/errors';
import type { AuthService, SessionStore, SignUpData } from '@/application/ports/auth';
import { err, ok, type Result } from '@/application/result';
import type { User } from '@/domain/entities/user';
import type { Email } from '@/domain/value-objects/email';
import type { Password } from '@/domain/value-objects/password';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { anySchema, apiUserSchema, loginDataSchema } from '@/infrastructure/http/api-schemas';
import { toUser } from './mappers';

/** The API takes first_name and last_name; the form has one "full name" field. */
export function splitName(full: string): { first: string; last: string } {
  const [first = '', ...rest] = full.trim().split(/\s+/);
  return { first, last: rest.join(' ') };
}

/** Backend field names to the names the sign-up form uses. */
const REGISTER_FIELD_MAP: Record<string, string> = {
  first_name: 'name',
  last_name: 'name',
  email: 'email',
  password: 'password',
  password2: 'password',
  new_password: 'password',
};

/**
 * The backend's password validators report English sentences (the client asks for English).
 * Anything unrecognised becomes the generic "invalid".
 */
const PASSWORD_REASONS: readonly (readonly [RegExp, string])[] = [
  [/too common/i, 'password_too_common'],
  [/at least \d+ characters|too short/i, 'password_too_short'],
  [/uppercase/i, 'password_needs_uppercase'],
  [/special character/i, 'password_needs_special'],
];

export function passwordReasonCode(message: string): string {
  return PASSWORD_REASONS.find(([pattern]) => pattern.test(message))?.[1] ?? 'invalid';
}

export function remapPasswordFormErrors(error: AppError): AppError {
  if (error.kind !== 'validation') return error;
  const fields: Record<string, string> = {};
  for (const [key, code] of Object.entries(error.fields)) {
    fields[REGISTER_FIELD_MAP[key] ?? key] = code;
  }

  const details: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(error.details ?? {})) {
    const field = REGISTER_FIELD_MAP[key] ?? key;
    const codes = field === 'password' ? messages.map(passwordReasonCode) : ['invalid'];
    details[field] = [...new Set([...(details[field] ?? []), ...codes])];
  }
  const firstPasswordCode = details.password?.find((code) => code !== 'invalid');
  if (firstPasswordCode) fields.password = firstPasswordCode;

  return {
    kind: 'validation',
    fields,
    ...(Object.keys(details).length > 0 ? { details } : {}),
  };
}

export class HttpAuthService implements AuthService {
  constructor(
    private readonly client: ApiClient,
    private readonly session: SessionStore,
  ) {}

  async signIn(email: Email, password: string): Promise<Result<User, AppError>> {
    const login = await this.client.request({
      method: 'POST',
      path: '/auth/login',
      body: { email: email.value, password },
      schema: loginDataSchema,
      auth: false,
    });
    if (!login.ok) return login;

    await this.session.write({
      accessToken: login.value.access,
      refreshToken: login.value.refresh,
    });
    return this.fetchMe();
  }

  async signUp(data: SignUpData): Promise<Result<void, AppError>> {
    // The API accepts only name, email and password. Phone, account kind and bar number are not
    // stored by the backend yet, so they are not sent.
    const { first, last } = splitName(data.name);
    const registered = await this.client.request({
      method: 'POST',
      path: '/auth/register',
      body: {
        first_name: first,
        last_name: last,
        email: data.email.value,
        password: data.password.value,
        password2: data.password.value,
      },
      schema: apiUserSchema,
      auth: false,
    });
    if (!registered.ok) {
      const mapped = remapPasswordFormErrors(registered.error);
      // A server-side email error after client-side format validation almost always means the
      // address is taken. TODO: confirm the exact backend message.
      if (mapped.kind === 'validation' && 'email' in mapped.fields) {
        return err({ kind: 'conflict', code: 'email_registered' });
      }
      return err(mapped);
    }

    // The account cannot sign in until the emailed code is verified, so no session is started.
    return ok(undefined);
  }

  async verifyEmail(email: Email, code: string): Promise<Result<void, AppError>> {
    const result = await this.client.request({
      method: 'POST',
      path: '/auth/verify-email',
      body: { email: email.value, code },
      schema: anySchema,
      auth: false,
    });
    if (result.ok) return ok(undefined);
    // A wrong or expired code is reported by the server as a validation error.
    if (result.error.kind === 'validation') {
      return err({ kind: 'validation', fields: { code: 'code_rejected' } });
    }
    return result;
  }

  async resendVerification(email: Email): Promise<Result<void, AppError>> {
    // 200 with no body. Throttled by the server (10 per hour), which arrives as rate_limited.
    const result = await this.client.request({
      method: 'POST',
      path: '/auth/verify-email/resend',
      body: { email: email.value },
      schema: anySchema,
      auth: false,
    });
    return result.ok ? ok(undefined) : result;
  }

  async requestPasswordReset(email: Email): Promise<Result<void, AppError>> {
    const result = await this.client.request({
      method: 'POST',
      path: '/auth/password/reset',
      body: { email: email.value },
      schema: anySchema,
      auth: false,
    });
    return result.ok ? ok(undefined) : result;
  }

  async resetPassword(
    email: Email,
    code: string,
    password: Password,
  ): Promise<Result<void, AppError>> {
    // The backend requires the code to be verified before the password can be confirmed.
    const verified = await this.client.request({
      method: 'POST',
      path: '/auth/password/reset/verify',
      body: { email: email.value, code },
      schema: anySchema,
      auth: false,
    });
    if (!verified.ok) {
      if (verified.error.kind === 'validation') {
        return err({ kind: 'validation', fields: { code: 'code_rejected' } });
      }
      return verified;
    }

    const confirmed = await this.client.request({
      method: 'POST',
      path: '/auth/password/reset/confirm',
      body: { email: email.value, code, new_password: password.value },
      schema: anySchema,
      auth: false,
    });
    if (confirmed.ok) return ok(undefined);
    return err(remapPasswordFormErrors(confirmed.error));
  }

  async signOut(): Promise<Result<void, AppError>> {
    const session = await this.session.read();
    if (session?.refreshToken) {
      // Best effort: the local session is cleared whatever the server says.
      await this.client.request({
        method: 'POST',
        path: '/auth/logout',
        body: { refresh: session.refreshToken },
        schema: anySchema,
      });
    }
    await this.session.clear();
    return ok(undefined);
  }

  async currentUser(): Promise<Result<User | null, AppError>> {
    if (!(await this.session.read())) return ok(null);
    const me = await this.fetchMe();
    if (me.ok) return me;
    // An expired or revoked token is "signed out", not a failure.
    if (me.error.kind === 'unauthenticated') return ok(null);
    return me;
  }

  private async fetchMe(): Promise<Result<User, AppError>> {
    const me = await this.client.request({ path: '/users/me', schema: apiUserSchema });
    return me.ok ? ok(toUser(me.value)) : me;
  }
}
