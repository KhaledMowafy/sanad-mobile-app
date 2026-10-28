import type { UsageLimitName, UsageSnapshot } from '@/domain/entities/usage';
import { DomainError } from '@/domain/errors/domain-error';

/**
 * What use cases report to presentation. Presentation maps each kind to a localised message.
 * Field codes in "validation" are stable machine codes such as "invalid_email".
 */
export type AppError =
  | {
      readonly kind: 'validation';
      readonly fields: Readonly<Record<string, string>>;
      /** Every reason the server gave per field, as stable codes (a field can fail several rules). */
      readonly details?: Readonly<Record<string, readonly string[]>>;
    }
  | { readonly kind: 'unauthenticated' }
  | {
      readonly kind: 'forbidden';
      /**
       * Why, when the backend says. "email_not_verified" routes to the code screen,
       * "account_locked" carries the minutes left, "account_inactive" needs support.
       */
      readonly code?: 'email_not_verified' | 'account_inactive' | 'account_locked' | undefined;
      readonly minutes?: number | undefined;
    }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'conflict'; readonly code: string }
  | { readonly kind: 'rate_limited' }
  | {
      /** A usage limit is spent. Not the request throttle: that is "rate_limited". */
      readonly kind: 'quota';
      readonly limit: UsageLimitName;
      readonly usage: UsageSnapshot | null;
    }
  | { readonly kind: 'network' }
  | { readonly kind: 'unknown'; readonly message: string | null };

/** Collects field errors so a form can show all of them in one pass. */
export class FieldValidator {
  private readonly errors: Record<string, string> = {};

  /** Runs a value-object constructor; a DomainError becomes a field error, anything else rethrows. */
  run<T>(field: string, build: () => T): T | undefined {
    try {
      return build();
    } catch (error) {
      if (error instanceof DomainError) {
        this.errors[field] = error.code;
        return undefined;
      }
      throw error;
    }
  }

  fail(field: string, code: string): void {
    this.errors[field] = code;
  }

  get hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  toError(): AppError {
    return { kind: 'validation', fields: { ...this.errors } };
  }
}
