import type { User, AccountKind } from '@/domain/entities/user';
import type { BarRegistrationNumber } from '@/domain/value-objects/bar-registration-number';
import type { Email } from '@/domain/value-objects/email';
import type { EgyptianPhoneNumber } from '@/domain/value-objects/egyptian-phone-number';
import type { Password } from '@/domain/value-objects/password';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface SignUpData {
  readonly name: string;
  readonly email: Email;
  readonly password: Password;
  /** Collected by the product but not stored by the backend yet, so the form does not ask. */
  readonly accountKind: AccountKind | null;
  readonly phone: EgyptianPhoneNumber | null;
  readonly barRegistrationNumber: BarRegistrationNumber | null;
}

export interface AuthService {
  signIn(email: Email, password: string): Promise<Result<User, AppError>>;
  /** Creates the account. It cannot sign in until the emailed code is verified. */
  signUp(data: SignUpData): Promise<Result<void, AppError>>;
  verifyEmail(email: Email, code: string): Promise<Result<void, AppError>>;
  resendVerification(email: Email): Promise<Result<void, AppError>>;
  /** Emails a code. The backend answers 200 whether or not the account exists. */
  requestPasswordReset(email: Email): Promise<Result<void, AppError>>;
  /** Verifies the emailed code, then sets the new password. */
  resetPassword(email: Email, code: string, password: Password): Promise<Result<void, AppError>>;
  signOut(): Promise<Result<void, AppError>>;
  /** Null when there is no valid session. Not an error. */
  currentUser(): Promise<Result<User | null, AppError>>;
}

export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string | null;
}

/** Server-side storage of the session between requests (httpOnly cookies in the web app). */
export interface SessionStore {
  read(): Promise<Session | null>;
  write(session: Session): Promise<void>;
  clear(): Promise<void>;
}
