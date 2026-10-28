import type { AppError } from '@/application/errors';

/** What a form shows after the backend said no: per-field codes, and one line for the form. */
export interface FormFailure {
  fieldErrors: Record<string, string>;
  details: Record<string, readonly string[]>;
  formError: string | null;
  formParams: Record<string, string | number>;
}

/**
 * Reduces a failure to stable codes the screens translate. An unverified account is handled before
 * this (it goes to the code screen), so it never arrives as a message.
 */
export function failureOf(error: AppError, unauthenticatedAs = 'invalid_credentials'): FormFailure {
  const empty: FormFailure = { fieldErrors: {}, details: {}, formError: null, formParams: {} };
  switch (error.kind) {
    case 'validation':
      return {
        ...empty,
        fieldErrors: error.fields,
        details: error.details ?? {},
        formError: error.fields._form ? 'unavailable' : null,
      };
    case 'conflict':
      return { ...empty, fieldErrors: { email: error.code } };
    case 'unauthenticated':
      return { ...empty, formError: unauthenticatedAs };
    case 'rate_limited':
      return { ...empty, formError: 'rate_limited' };
    case 'forbidden':
      return {
        ...empty,
        formError: error.code ?? 'forbidden',
        formParams: error.minutes === undefined ? {} : { minutes: error.minutes },
      };
    default:
      return { ...empty, formError: 'unavailable' };
  }
}
