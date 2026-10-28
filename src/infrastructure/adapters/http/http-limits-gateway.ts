import { z } from 'zod';
import type { AppError } from '@/application/errors';
import type { LimitsGateway } from '@/application/ports/limits';
import { ok, type Result } from '@/application/result';
import type { UsageLimits } from '@/domain/entities/limits';
import type { ApiClient } from '@/infrastructure/http/api-client';

const nullableNumber = z.number().nullish();

const apiLimitsSchema = z.looseObject({
  conversation_tokens: nullableNumber,
  conversation_messages: nullableNumber,
  monthly_tokens: nullableNumber,
  warn_at: z.number(),
  question_max_chars: z.number(),
  attachments: z.looseObject({
    per_conversation: z.number(),
    per_draft: z.number().nullish(),
    max_bytes: z.number(),
    pages_read: z.number(),
    suffixes: z.array(z.string()),
  }),
});

export class HttpLimitsGateway implements LimitsGateway {
  constructor(private readonly client: ApiClient) {}

  async get(): Promise<Result<UsageLimits, AppError>> {
    const result = await this.client.request({ path: '/limits', schema: apiLimitsSchema });
    if (!result.ok) return result;
    const l = result.value;
    return ok({
      conversationTokens: l.conversation_tokens ?? null,
      conversationMessages: l.conversation_messages ?? null,
      monthlyTokens: l.monthly_tokens ?? null,
      warnAt: l.warn_at,
      questionMaxChars: l.question_max_chars,
      attachments: {
        perConversation: l.attachments.per_conversation,
        perDraft: l.attachments.per_draft ?? l.attachments.per_conversation,
        maxBytes: l.attachments.max_bytes,
        pagesRead: l.attachments.pages_read,
        suffixes: l.attachments.suffixes,
      },
    });
  }
}
