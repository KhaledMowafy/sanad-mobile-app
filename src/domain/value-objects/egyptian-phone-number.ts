import { InvalidPhoneNumberError } from '../errors/domain-error';
import { toWesternDigits } from './digits';

/** Egyptian mobile numbers: operator prefix 10, 11, 12 or 15, then 8 digits. */
const NATIONAL_PATTERN = /^1[0125]\d{8}$/;

export class EgyptianPhoneNumber {
  private constructor(
    /** 10 digits without the leading 0 or country code, e.g. 1012345678 */
    readonly national: string,
  ) {}

  static create(raw: string): EgyptianPhoneNumber {
    let digits = toWesternDigits(raw).replace(/[\s\-().]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (digits.startsWith('0020')) digits = digits.slice(4);
    else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);

    if (!NATIONAL_PATTERN.test(digits)) {
      throw new InvalidPhoneNumberError(`Invalid Egyptian mobile number: ${raw}`);
    }
    return new EgyptianPhoneNumber(digits);
  }

  get e164(): string {
    return `+20${this.national}`;
  }
}
