import { templateGroupOf, type Template, type TemplateGroup } from '@/domain/entities/template';
import { ConversationTitle } from '@/domain/value-objects/conversation-title';
import type { MessageDto } from '../dto/dto';
import { toMessageDto } from '../dto/mappers';
import type { AppError } from '../errors';
import type { DraftGateway } from '../ports/drafts';
import type { ConversationRepository } from '../ports/repositories';
import type { TemplateGateway } from '../ports/templates';
import { err, ok, type Result } from '../result';

export class ListTemplates {
  constructor(private readonly templates: TemplateGateway) {}

  /** Active templates, optionally only those a use case card offers. */
  async execute(group?: TemplateGroup): Promise<Result<Template[], AppError>> {
    const result = await this.templates.list();
    if (!result.ok) return result;
    const wanted = result.value.filter((t) => {
      const own = templateGroupOf(t);
      return own !== null && (group === undefined || own === group);
    });
    return ok(wanted);
  }
}

export class StartContractWizard {
  constructor(
    private readonly drafts: DraftGateway,
    private readonly conversations: ConversationRepository,
  ) {}

  /**
   * Opens the question-by-question wizard for a template. Without a conversation one is started
   * first, titled with the document's name. The first question comes back as the assistant
   * message already stored in the conversation; every answer after it is an ordinary question.
   */
  async execute(input: {
    conversationId: string | null;
    templateCode: string;
    title: string;
  }): Promise<Result<{ conversationId: string; message: MessageDto }, AppError>> {
    if (input.templateCode.trim().length === 0) return err({ kind: 'not_found' });

    let conversationId = input.conversationId;
    if (conversationId === null) {
      let title: ConversationTitle | null = null;
      try {
        title = input.title.trim() ? ConversationTitle.create(input.title) : null;
      } catch {
        title = null;
      }
      const created = await this.conversations.create(title);
      if (!created.ok) return created;
      conversationId = created.value.id;
    }

    const started = await this.drafts.startContract({
      conversationId,
      templateCode: input.templateCode,
    });
    return started.ok ? ok({ conversationId, message: toMessageDto(started.value) }) : started;
  }
}
