import { InvalidVerificationCodeError } from '../errors/domain-error';
import { toWesternDigits } from './digits';

/** The six-digit code emailed after registration. */
export class VerificationCode {
  private constructor(readonly value: string) {}

  static create(raw: string): VerificationCode {
    const value = toWesternDigits(raw).replace(/[\s-]/g, '');
    if (!/^\d{6}$/.test(value)) {
      throw new InvalidVerificationCodeError('The code must be six digits');
    }
    return new VerificationCode(value);
  }
}
