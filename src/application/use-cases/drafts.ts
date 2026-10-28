import { ConversationTitle } from '@/domain/value-objects/conversation-title';
import type { DraftDto } from '../dto/dto';
import { toDraftDto } from '../dto/mappers';
import { FieldValidator, type AppError } from '../errors';
import type { DraftDownload, DraftGateway } from '../ports/drafts';
import type { ConversationRepository } from '../ports/repositories';
import { err, ok, type Result } from '../result';

const BLANK: AppError = { kind: 'not_found' };

export class CreateDraft {
  constructor(
    private readonly drafts: DraftGateway,
    private readonly conversations: ConversationRepository,
  ) {}

  /**
   * Asks for a defence memo. Without a conversation one is started first, titled from what was
   * typed: a memo does not go through /ask, so the backend would never name it.
   */
  async execute(input: {
    conversationId: string | null;
    prompt: string;
    attachmentIds: readonly string[];
    /** A template's code. Omit it for a defence memo. */
    templateCode?: string | undefined;
  }): Promise<Result<{ conversationId: string; draft: DraftDto }, AppError>> {
    const prompt = input.prompt.trim();
    const validator = new FieldValidator();
    // The backend needs something to draft from: text, a file, or an earlier message.
    if (prompt.length === 0 && input.attachmentIds.length === 0 && input.conversationId === null) {
      validator.fail('prompt', 'message_empty');
      return err(validator.toError());
    }

    let conversationId = input.conversationId;
    if (conversationId === null) {
      let title: ConversationTitle | null = null;
      try {
        title = prompt ? ConversationTitle.fromFirstMessage(prompt) : null;
      } catch {
        title = null;
      }
      const created = await this.conversations.create(title);
      if (!created.ok) return created;
      conversationId = created.value.id;
    }

    const draft = await this.drafts.create({
      conversationId,
      prompt,
      attachmentIds: input.attachmentIds,
      ...(input.templateCode ? { templateCode: input.templateCode } : {}),
    });
    return draft.ok ? ok({ conversationId, draft: toDraftDto(draft.value) }) : draft;
  }
}

export class GetDraft {
  constructor(private readonly drafts: DraftGateway) {}

  async execute(id: string): Promise<Result<DraftDto, AppError>> {
    if (id.trim().length === 0) return err(BLANK);
    const result = await this.drafts.get(id);
    return result.ok ? ok(toDraftDto(result.value)) : result;
  }
}

export class ListDrafts {
  constructor(private readonly drafts: DraftGateway) {}

  async execute(conversationId: string): Promise<Result<DraftDto[], AppError>> {
    if (conversationId.trim().length === 0) return err(BLANK);
    const result = await this.drafts.list(conversationId);
    return result.ok ? ok(result.value.map(toDraftDto)) : result;
  }
}

export class DownloadDraft {
  constructor(private readonly drafts: DraftGateway) {}

  async execute(id: string): Promise<Result<DraftDownload, AppError>> {
    if (id.trim().length === 0) return err(BLANK);
    return this.drafts.download(id);
  }
}
