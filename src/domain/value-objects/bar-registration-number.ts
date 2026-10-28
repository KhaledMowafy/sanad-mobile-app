import { InvalidBarNumberError } from '../errors/domain-error';
import { toWesternDigits } from './digits';

// TODO: confirm the exact syndicate number format with the product owner. Digits only for now.
const BAR_PATTERN = /^\d{1,10}$/;

export class BarRegistrationNumber {
  private constructor(readonly value: string) {}

  static create(raw: string): BarRegistrationNumber {
    const value = toWesternDigits(raw).trim();
    if (!BAR_PATTERN.test(value)) throw new InvalidBarNumberError(`Invalid bar number: ${raw}`);
    return new BarRegistrationNumber(value);
  }
}
