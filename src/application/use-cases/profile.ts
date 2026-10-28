import type { ProfileDto } from '../dto/dto';
import { toProfileDto } from '../dto/mappers';
import type { AppError } from '../errors';
import type { ProfileGateway } from '../ports/profile';
import { ok, type Result } from '../result';

export class GetProfile {
  constructor(private readonly profile: ProfileGateway) {}

  async execute(): Promise<Result<ProfileDto, AppError>> {
    const result = await this.profile.get();
    return result.ok ? ok(toProfileDto(result.value)) : result;
  }
}
