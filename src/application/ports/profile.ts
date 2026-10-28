import type { AccountProfile } from '@/domain/entities/profile';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface ProfileGateway {
  /** The signed-in account with its usage. An expired session is an `unauthenticated` error. */
  get(): Promise<Result<AccountProfile, AppError>>;
}
