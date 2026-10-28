import { InvalidPasswordError } from '../errors/domain-error';

export const PASSWORD_MIN_LENGTH = 8;

/** 0 to 4, shown as the four-bar meter on the sign-up form. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(raw: string): PasswordStrength {
  if (raw.length === 0) return 0;
  let score = 0;
  if (raw.length >= PASSWORD_MIN_LENGTH) score++;
  if (/\d/.test(raw)) score++;
  if (/[a-z]/.test(raw) && /[A-Z]/.test(raw)) score++;
  if (raw.length >= 12 || /[^A-Za-z0-9]/.test(raw)) score++;
  return score as PasswordStrength;
}

export interface PasswordRequirements {
  readonly minLength: boolean;
  readonly uppercase: boolean;
  readonly special: boolean;
}

/** Which of the known rules a candidate already meets, for a live checklist. */
export function passwordRequirements(raw: string): PasswordRequirements {
  return {
    minLength: raw.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(raw),
    special: /[^A-Za-z0-9]/.test(raw),
  };
}

export class Password {
  private constructor(readonly value: string) {}

  /**
   * The rules the backend reports: at least 8 characters, an uppercase letter and a special
   * character. The server also rejects very common passwords, which only it can judge.
   * Only used when choosing a password; sign-in must not enforce rules on existing ones.
   */
  static create(raw: string): Password {
    if (raw.length < PASSWORD_MIN_LENGTH) throw new InvalidPasswordError('too_short');
    if (!/[A-Z]/.test(raw)) throw new InvalidPasswordError('needs_uppercase');
    if (!/[^A-Za-z0-9]/.test(raw)) throw new InvalidPasswordError('needs_special');
    return new Password(raw);
  }
}
