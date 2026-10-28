import type { UsageLimits } from '@/domain/entities/limits';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface LimitsGateway {
  get(): Promise<Result<UsageLimits, AppError>>;
}
