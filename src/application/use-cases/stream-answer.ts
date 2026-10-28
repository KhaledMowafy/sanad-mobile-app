import type { UsageSnapshot } from '@/domain/entities/usage';
import {
  addCitation,
  addReference,
  appendToken,
  completeMessage,
  failMessage,
  startAssistantMessage,
  stopMessage,
  withId,
  withUsage,
  withWarning,
  type Message,
} from '@/domain/entities/message';
import type { MessageDto } from '../dto/dto';
import { toMessageDto } from '../dto/mappers';
import type { ChatGateway, StreamAnswerRequest } from '../ports/chat-gateway';
import type { Clock, IdGenerator } from '../ports/platform';

export interface StreamSnapshot {
  /** The assistant message so far. Replace the previous snapshot with it. */
  readonly message: MessageDto;
  /** Known once the backend confirms it; needed to navigate to /chat/[id]. */
  readonly conversationId: string | null;
  /** Set once the backend reports where the conversation and the month stand. */
  readonly usage: UsageSnapshot | null;
  /** Set on the turn that finishes a contract wizard. */
  readonly draftRequestId: string | null;
}

export const STREAM_CLOSED_ERROR = 'stream_closed';
export const STREAM_FAILED_ERROR = 'stream_failed';

/**
 * Folds gateway events into assistant-message snapshots.
 * Never throws: failures become a message with status "error", an abort becomes "stopped".
 */
export class StreamAnswer {
  constructor(
    private readonly gateway: ChatGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async *execute(
    request: StreamAnswerRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamSnapshot> {
    let message: Message = startAssistantMessage({
      id: this.ids.next(),
      createdAt: this.clock.now(),
    });
    let conversationId = request.conversationId;
    let usage: UsageSnapshot | null = null;
    let draftRequestId: string | null = null;
    const snapshot = (): StreamSnapshot => ({
      message: toMessageDto(message),
      conversationId,
      usage,
      draftRequestId,
    });

    yield snapshot();

    try {
      for await (const event of this.gateway.streamAnswer(request, signal)) {
        if (signal?.aborted) break;
        switch (event.type) {
          case 'token':
            message = appendToken(message, event.text);
            break;
          case 'citation':
            message = addCitation(message, event.citation);
            break;
          case 'reference':
            message = addReference(message, event.reference);
            break;
          case 'done':
            conversationId = event.conversationId;
            message = completeMessage(withWarning(message, event.warning));
            draftRequestId = event.draftRequestId;
            if (event.usage) {
              message = withUsage(message, event.usage.answer);
              usage = event.usage.snapshot;
            }
            if (event.messageId) message = withId(message, event.messageId);
            break;
          case 'error':
            message = failMessage(message, event.code);
            if (event.usage) usage = event.usage;
            break;
        }
        yield snapshot();
        if (message.status !== 'streaming') return;
      }
    } catch {
      message = signal?.aborted ? stopMessage(message) : failMessage(message, STREAM_FAILED_ERROR);
      yield snapshot();
      return;
    }

    // The stream ended without "done" or "error".
    message = signal?.aborted ? stopMessage(message) : failMessage(message, STREAM_CLOSED_ERROR);
    yield snapshot();
  }
}
