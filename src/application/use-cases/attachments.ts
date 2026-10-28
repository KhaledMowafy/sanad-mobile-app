import { assertAttachmentAllowed } from '@/domain/entities/attachment';
import type { ChatAttachment } from '@/domain/entities/chat-attachment';
import { ConversationTitle } from '@/domain/value-objects/conversation-title';
import { FieldValidator, type AppError } from '../errors';
import type { ChatAttachmentDto, ConversationSummaryDto } from '../dto/dto';
import { toChatAttachmentDto, toConversationSummaryDto } from '../dto/mappers';
import type { AttachmentGateway, UploadFile } from '../ports/attachments';
import type { ConversationRepository } from '../ports/repositories';
import { err, ok, type Result } from '../result';

function blank(id: string): AppError | null {
  return id.trim().length === 0 ? { kind: 'not_found' } : null;
}

export class StartConversation {
  constructor(private readonly conversations: ConversationRepository) {}

  /** Untitled: the backend names it from the first question. */
  async execute(input: { title?: string } = {}): Promise<Result<ConversationSummaryDto, AppError>> {
    let title: ConversationTitle | null = null;
    if (input.title && input.title.trim().length > 0) {
      const validator = new FieldValidator();
      title = validator.run('title', () => ConversationTitle.create(input.title ?? '')) ?? null;
      if (!title) return err(validator.toError());
    }
    const created = await this.conversations.create(title);
    return created.ok ? ok(toConversationSummaryDto(created.value)) : created;
  }
}

export class ListAttachments {
  constructor(private readonly attachments: AttachmentGateway) {}

  async execute(conversationId: string): Promise<Result<ChatAttachmentDto[], AppError>> {
    const invalid = blank(conversationId);
    if (invalid) return err(invalid);
    const result = await this.attachments.list(conversationId);
    return result.ok ? ok(result.value.map(toChatAttachmentDto)) : result;
  }
}

export class UploadAttachment {
  constructor(
    private readonly attachments: AttachmentGateway,
    private readonly conversations: ConversationRepository,
  ) {}

  /**
   * Uploads into a conversation, starting one first when there is none yet: a file can only
   * be attached to a conversation that exists.
   */
  async execute(input: {
    conversationId: string | null;
    file: UploadFile;
  }): Promise<Result<{ conversationId: string; attachment: ChatAttachmentDto }, AppError>> {
    const validator = new FieldValidator();
    validator.run('file', () =>
      assertAttachmentAllowed({ name: input.file.name, sizeBytes: input.file.size }),
    );
    if (validator.hasErrors) return err(validator.toError());

    let conversationId = input.conversationId;
    if (conversationId === null) {
      const created = await this.conversations.create(null);
      if (!created.ok) return created;
      conversationId = created.value.id;
    }

    const uploaded: Result<ChatAttachment, AppError> = await this.attachments.upload(
      conversationId,
      input.file,
    );
    if (!uploaded.ok) return uploaded;
    return ok({ conversationId, attachment: toChatAttachmentDto(uploaded.value) });
  }
}
