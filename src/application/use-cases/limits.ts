import type { UsageLimits } from '@/domain/entities/limits';
import type { AppError } from '../errors';
import type { LimitsGateway } from '../ports/limits';
import type { Result } from '../result';

export class GetLimits {
  constructor(private readonly limits: LimitsGateway) {}

  execute(): Promise<Result<UsageLimits, AppError>> {
    return this.limits.get();
  }
}
