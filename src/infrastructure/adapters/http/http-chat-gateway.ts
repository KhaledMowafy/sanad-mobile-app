import { z } from 'zod';
import type { AppError } from '@/application/errors';
import type { ChatEvent, ChatGateway, StreamAnswerRequest } from '@/application/ports/chat-gateway';
import { ok, type Result } from '@/application/result';
import type { Feedback } from '@/domain/value-objects/feedback';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { apiConversationSchema } from '@/infrastructure/http/api-schemas';
import { readSse } from '@/infrastructure/http/sse';
import { toAnswerUsage } from '@/infrastructure/http/usage-mappers';
import { parseCitations, parseReferences } from './mappers';

/** The backend titles a conversation from its first question when it still has this name. */
export const NEW_CONVERSATION_TITLE = 'محادثة جديدة';

/**
 * Events on POST /conversations/<id>/ask. The route is the one place that does not use the
 * {status_code, data} envelope: the body is text/event-stream, one JSON object per event.
 */
const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({
    type: z.literal('error'),
    message: z.string().nullish(),
    detail: z.string().nullish(),
  }),
  z.object({
    type: z.literal('done'),
    message_id: z.number().nullish(),
    citations: z.unknown().optional(),
    warning: z.string().nullish(),
    /** {answer, conversation, user}, or null when the counters could not be read. */
    usage: z.unknown().optional(),
    /** Set only on the turn that finishes a contract wizard. */
    draft_request_id: z.number().nullish(),
  }),
]);

/** Stable codes for failures before the stream opens. Presentation maps them to messages. */
export function codeForError(error: AppError): string {
  switch (error.kind) {
    case 'unauthenticated':
      return 'unauthenticated';
    case 'forbidden':
      return error.code ?? 'forbidden';
    case 'not_found':
      return 'conversation_not_found';
    case 'validation':
      // Includes asking while an attachment is still being read, or an unverified account.
      return 'invalid_request';
    case 'quota':
      // Which limit decides what the person is offered: a new conversation, or the reset date.
      return `limit_${error.limit}`;
    case 'rate_limited':
      return 'rate_limited';
    case 'network':
      return 'network';
    default:
      return 'server_error';
  }
}

function errorEvent(error: AppError): ChatEvent {
  return {
    type: 'error',
    code: codeForError(error),
    ...(error.kind === 'quota' && error.usage ? { usage: error.usage } : {}),
  };
}

export class HttpChatGateway implements ChatGateway {
  constructor(private readonly client: ApiClient) {}

  async *streamAnswer(
    request: StreamAnswerRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    // TODO: attachments need POST /conversations/<id>/attachments first (upload contract not
    // shared yet) and must be READY. Only ids already issued by the backend can be sent.
    const attachmentIds = request.attachments.map((a) => Number(a.id));
    if (attachmentIds.some((id) => !Number.isInteger(id))) {
      yield { type: 'error', code: 'attachment_not_uploaded' };
      return;
    }

    let conversationId = request.conversationId;
    if (conversationId === null) {
      const created = await this.client.request({
        method: 'POST',
        path: '/conversations',
        body: { title: NEW_CONVERSATION_TITLE },
        schema: apiConversationSchema,
        ...(signal ? { signal } : {}),
      });
      if (!created.ok) {
        yield errorEvent(created.error);
        return;
      }
      conversationId = String(created.value.id);
    }

    const opened = await this.client.openStream({
      path: `/conversations/${encodeURIComponent(conversationId)}/ask`,
      body: {
        text: request.content,
        attachments: attachmentIds,
        use_rag: true,
        // Sent only when asked: the backend defaults it to false and refuses it with a memo.
        ...(request.reviewContract ? { review_contract: true } : {}),
      },
      ...(signal ? { signal } : {}),
    });
    if (!opened.ok) {
      yield errorEvent(opened.error);
      return;
    }

    // Safe: openStream only returns responses that have a body.
    for await (const payload of readSse(opened.value.body!)) {
      let json: unknown;
      try {
        json = JSON.parse(payload);
      } catch {
        continue; // a malformed event must not kill the answer
      }
      const parsed = streamEventSchema.safeParse(json);
      if (!parsed.success) continue; // unknown event types are ignored for forward compatibility

      const event = parsed.data;
      if (event.type === 'token') {
        yield { type: 'token', text: event.text };
      } else if (event.type === 'error') {
        // The terminating "done" still follows; StreamAnswer stops reading at the error.
        yield { type: 'error', code: 'generation_failed' };
      } else {
        const messageId = event.message_id == null ? null : String(event.message_id);
        for (const citation of parseCitations(event.citations, messageId ?? 'answer')) {
          yield { type: 'citation', citation };
        }
        for (const reference of parseReferences(event.citations, messageId ?? 'answer')) {
          yield { type: 'reference', reference };
        }
        yield {
          type: 'done',
          conversationId,
          messageId,
          warning: event.warning?.trim() || null,
          usage: toAnswerUsage(event.usage),
          draftRequestId: event.draft_request_id == null ? null : String(event.draft_request_id),
        };
        return;
      }
    }
  }

  submitFeedback(_input: {
    conversationId: string;
    messageId: string;
    feedback: Feedback | null;
  }): Promise<Result<void, AppError>> {
    // The API route list has no feedback endpoint, so this is a deliberate no-op.
    return Promise.resolve(ok(undefined));
  }
}
