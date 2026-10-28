import { userMessageBefore } from '@/domain/entities/conversation';
import type { Locale } from '@/domain/value-objects/locale';
import type { AppError } from '../errors';
import type { StreamAnswerRequest } from '../ports/chat-gateway';
import type { ConversationRepository } from '../ports/repositories';
import { err, ok, type Result } from '../result';

export class RegenerateAnswer {
  constructor(private readonly conversations: ConversationRepository) {}

  /** Builds the request that replays the user turn behind an assistant answer. */
  async execute(input: {
    conversationId: string;
    assistantMessageId: string;
    locale: Locale;
  }): Promise<Result<StreamAnswerRequest, AppError>> {
    const loaded = await this.conversations.get(input.conversationId);
    if (!loaded.ok) return loaded;

    const target = loaded.value.messages.find((m) => m.id === input.assistantMessageId);
    if (!target || target.role !== 'assistant') return err({ kind: 'not_found' });

    const userMessage = userMessageBefore(loaded.value, input.assistantMessageId);
    if (!userMessage) return err({ kind: 'not_found' });

    return ok({
      conversationId: input.conversationId,
      content: userMessage.content,
      attachments: userMessage.attachments,
      scope: 'egyptian_legislation',
      locale: input.locale,
      reviewContract: false,
      regenerateMessageId: input.assistantMessageId,
    });
  }
}
