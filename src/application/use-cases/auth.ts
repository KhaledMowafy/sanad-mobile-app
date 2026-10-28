import type { AccountKind } from '@/domain/entities/user';
import { BarRegistrationNumber } from '@/domain/value-objects/bar-registration-number';
import { Email } from '@/domain/value-objects/email';
import { EgyptianPhoneNumber } from '@/domain/value-objects/egyptian-phone-number';
import { Password } from '@/domain/value-objects/password';
import { VerificationCode } from '@/domain/value-objects/verification-code';
import { FieldValidator, type AppError } from '../errors';
import type { UserDto } from '../dto/dto';
import { toUserDto } from '../dto/mappers';
import type { AuthService } from '../ports/auth';
import { err, ok, type Result } from '../result';

export class SignIn {
  constructor(private readonly auth: AuthService) {}

  async execute(input: { email: string; password: string }): Promise<Result<UserDto, AppError>> {
    const validator = new FieldValidator();
    const email = validator.run('email', () => Email.create(input.email));
    // Existing passwords are not re-validated against the sign-up rules.
    if (input.password.length === 0) validator.fail('password', 'password_required');
    if (!email || validator.hasErrors) return err(validator.toError());

    const result = await this.auth.signIn(email, input.password);
    return result.ok ? ok(toUserDto(result.value)) : result;
  }
}

export interface SignUpInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly acceptedTerms: boolean;
  /** Not stored by the backend yet. Validated only when provided. */
  readonly accountKind?: AccountKind | undefined;
  readonly phone?: string | null | undefined;
  readonly barRegistrationNumber?: string | null | undefined;
}

export interface RegistrationDto {
  /** The normalised address the code was sent to. */
  readonly email: string;
}

export class SignUp {
  constructor(private readonly auth: AuthService) {}

  async execute(input: SignUpInput): Promise<Result<RegistrationDto, AppError>> {
    const validator = new FieldValidator();

    const name = input.name.replace(/\s+/g, ' ').trim();
    if (name.length === 0) validator.fail('name', 'name_required');

    const email = validator.run('email', () => Email.create(input.email));
    const password = validator.run('password', () => Password.create(input.password));

    const phoneRaw = input.phone?.trim() ?? '';
    const phone =
      phoneRaw.length === 0
        ? null
        : (validator.run('phone', () => EgyptianPhoneNumber.create(phoneRaw)) ?? null);

    const barRaw = input.barRegistrationNumber?.trim() ?? '';
    const bar =
      barRaw.length === 0
        ? null
        : (validator.run('barRegistrationNumber', () => BarRegistrationNumber.create(barRaw)) ??
          null);

    if (!input.acceptedTerms) validator.fail('acceptedTerms', 'terms_required');
    if (validator.hasErrors || !email || !password) return err(validator.toError());

    const result = await this.auth.signUp({
      name,
      email,
      password,
      accountKind: input.accountKind ?? null,
      phone,
      barRegistrationNumber: bar,
    });
    return result.ok ? ok({ email: email.value }) : result;
  }
}

export class VerifyEmail {
  constructor(private readonly auth: AuthService) {}

  async execute(input: { email: string; code: string }): Promise<Result<void, AppError>> {
    const validator = new FieldValidator();
    const email = validator.run('email', () => Email.create(input.email));
    const code = validator.run('code', () => VerificationCode.create(input.code));
    if (!email || !code) return err(validator.toError());
    return this.auth.verifyEmail(email, code.value);
  }
}

export class ResendVerification {
  constructor(private readonly auth: AuthService) {}

  async execute(input: { email: string }): Promise<Result<void, AppError>> {
    const validator = new FieldValidator();
    const email = validator.run('email', () => Email.create(input.email));
    if (!email) return err(validator.toError());
    return this.auth.resendVerification(email);
  }
}

export class RequestPasswordReset {
  constructor(private readonly auth: AuthService) {}

  async execute(input: { email: string }): Promise<Result<RegistrationDto, AppError>> {
    const validator = new FieldValidator();
    const email = validator.run('email', () => Email.create(input.email));
    if (!email) return err(validator.toError());

    const result = await this.auth.requestPasswordReset(email);
    return result.ok ? ok({ email: email.value }) : result;
  }
}

export class ResetPassword {
  constructor(private readonly auth: AuthService) {}

  async execute(input: {
    email: string;
    code: string;
    password: string;
  }): Promise<Result<void, AppError>> {
    const validator = new FieldValidator();
    const email = validator.run('email', () => Email.create(input.email));
    const code = validator.run('code', () => VerificationCode.create(input.code));
    const password = validator.run('password', () => Password.create(input.password));
    if (!email || !code || !password) return err(validator.toError());

    return this.auth.resetPassword(email, code.value, password);
  }
}

export class SignOut {
  constructor(private readonly auth: AuthService) {}

  execute(): Promise<Result<void, AppError>> {
    return this.auth.signOut();
  }
}

export class GetCurrentUser {
  constructor(private readonly auth: AuthService) {}

  async execute(): Promise<Result<UserDto | null, AppError>> {
    const result = await this.auth.currentUser();
    if (!result.ok) return result;
    return ok(result.value ? toUserDto(result.value) : null);
  }
}
