import type { Template } from '@/domain/entities/template';
import type { AppError } from '../errors';
import type { Result } from '../result';

export interface TemplateGateway {
  /** Every active template, across the backend's pages. */
  list(): Promise<Result<readonly Template[], AppError>>;
}
