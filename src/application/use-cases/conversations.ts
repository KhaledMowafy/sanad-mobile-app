import { groupConversationsByRecency } from '@/domain/services/group-conversations-by-recency';
import { formatConversationAsText } from '@/domain/services/conversation-export';
import { ConversationTitle } from '@/domain/value-objects/conversation-title';
import type { Locale } from '@/domain/value-objects/locale';
import type { Conversation } from '@/domain/entities/conversation';
import { FieldValidator, type AppError } from '../errors';
import type { ConversationDto, ConversationGroupDto } from '../dto/dto';
import { toConversationDto, toConversationSummaryDto } from '../dto/mappers';
import type { Clock } from '../ports/platform';
import type { ConversationRepository } from '../ports/repositories';
import { err, ok, type Result } from '../result';

function group(
  conversations: readonly Conversation[],
  clock: Clock,
  timeZone: string | undefined,
): ConversationGroupDto[] {
  return groupConversationsByRecency(conversations, clock.now(), timeZone).map((g) => ({
    bucket: g.bucket,
    items: g.items.map(toConversationSummaryDto),
  }));
}

function blankId(id: string): AppError | null {
  return id.trim().length === 0 ? { kind: 'not_found' } : null;
}

export class ListConversations {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly clock: Clock,
    private readonly timeZone?: string,
  ) {}

  async execute(): Promise<Result<ConversationGroupDto[], AppError>> {
    const result = await this.repository.list();
    return result.ok ? ok(group(result.value, this.clock, this.timeZone)) : result;
  }
}

export class SearchConversations {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly clock: Clock,
    private readonly timeZone?: string,
  ) {}

  /** An empty query behaves like the plain list. */
  async execute(query: string): Promise<Result<ConversationGroupDto[], AppError>> {
    const trimmed = query.trim();
    const result =
      trimmed.length === 0 ? await this.repository.list() : await this.repository.search(trimmed);
    return result.ok ? ok(group(result.value, this.clock, this.timeZone)) : result;
  }
}

export class GetConversation {
  constructor(private readonly repository: ConversationRepository) {}

  async execute(id: string): Promise<Result<ConversationDto, AppError>> {
    const invalid = blankId(id);
    if (invalid) return err(invalid);
    const result = await this.repository.get(id);
    return result.ok ? ok(toConversationDto(result.value)) : result;
  }
}

export class RenameConversation {
  constructor(private readonly repository: ConversationRepository) {}

  async execute(input: {
    id: string;
    title: string;
  }): Promise<Result<{ title: string }, AppError>> {
    const invalid = blankId(input.id);
    if (invalid) return err(invalid);

    const validator = new FieldValidator();
    const title = validator.run('title', () => ConversationTitle.create(input.title));
    if (!title) return err(validator.toError());

    const result = await this.repository.rename(input.id, title);
    return result.ok ? ok({ title: title.value }) : result;
  }
}

export class DeleteConversation {
  constructor(private readonly repository: ConversationRepository) {}

  async execute(id: string): Promise<Result<void, AppError>> {
    const invalid = blankId(id);
    if (invalid) return err(invalid);
    return this.repository.remove(id);
  }
}

export class ExportConversation {
  constructor(private readonly repository: ConversationRepository) {}

  async execute(input: {
    id: string;
    locale: Locale;
  }): Promise<Result<{ filename: string; text: string }, AppError>> {
    const invalid = blankId(input.id);
    if (invalid) return err(invalid);
    const result = await this.repository.get(input.id);
    if (!result.ok) return result;
    return ok({
      filename: `${result.value.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'conversation'}.txt`,
      text: formatConversationAsText(result.value, input.locale),
    });
  }
}
