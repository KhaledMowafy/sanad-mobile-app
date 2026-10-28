import type { AppError } from '@/application/errors';
import type { ProfileGateway } from '@/application/ports/profile';
import { ok, type Result } from '@/application/result';
import type { AccountProfile } from '@/domain/entities/profile';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { apiUserSchema } from '@/infrastructure/http/api-schemas';
import { toProfile } from './mappers';

export class HttpProfileGateway implements ProfileGateway {
  constructor(private readonly client: ApiClient) {}

  async get(): Promise<Result<AccountProfile, AppError>> {
    const me = await this.client.request({ path: '/users/me', schema: apiUserSchema });
    return me.ok ? ok(toProfile(me.value)) : me;
  }
}
