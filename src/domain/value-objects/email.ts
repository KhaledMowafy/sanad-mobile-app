import { InvalidEmailError } from '../errors/domain-error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) throw new InvalidEmailError(`Invalid email: ${raw}`);
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
