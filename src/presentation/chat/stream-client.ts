import type { StreamSnapshot } from '@/application/use-cases/stream-answer';
import { loadUseCases } from './backend';
import type { ChatStreamEvent, ChatStreamRequest } from './stream-events';

export type ChatStreamFn = (
  request: ChatStreamRequest,
  signal: AbortSignal,
) => AsyncIterable<ChatStreamEvent>;

/** Thrown for failures before any event arrives (bad request, signed out, server down). */
export class ChatStreamError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/**
 * Turns the use case's snapshots into compact events. Content only ever grows, so the delta is
 * the part of the text the screen has not seen; citations and references are sent once each.
 */
function diff(
  previous: { length: number; citations: number; references: number },
  snapshot: StreamSnapshot,
): ChatStreamEvent[] {
  const { message } = snapshot;
  const events: ChatStreamEvent[] = [];
  if (message.content.length > previous.length) {
    events.push({ type: 'delta', text: message.content.slice(previous.length) });
  }
  for (const citation of message.citations.slice(previous.citations)) {
    events.push({ type: 'citation', citation });
  }
  for (const reference of message.references.slice(previous.references)) {
    events.push({ type: 'reference', reference });
  }
  previous.length = message.content.length;
  previous.citations = message.citations.length;
  previous.references = message.references.length;
  return events;
}

/** Asks the backend directly and yields the answer's events as they arrive. */
export async function* streamChat(
  request: ChatStreamRequest,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const { sendMessage, streamAnswer } = await loadUseCases();

  const prepared = sendMessage.execute({
    conversationId: request.conversationId,
    text: request.text,
    attachmentIds: request.attachmentIds,
    locale: request.locale,
    reviewContract: request.reviewContract,
  });
  if (!prepared.ok) {
    const fields = prepared.error.kind === 'validation' ? prepared.error.fields : {};
    throw new ChatStreamError(Object.values(fields)[0] ?? 'invalid_request');
  }

  const seen = { length: 0, citations: 0, references: 0 };
  yield { type: 'start', conversationId: request.conversationId };

  for await (const snapshot of streamAnswer.execute(prepared.value.request, signal)) {
    for (const event of diff(seen, snapshot)) yield event;

    const { message } = snapshot;
    if (message.status !== 'streaming') {
      yield {
        type: 'end',
        status: message.status,
        errorCode: message.errorCode,
        warning: message.warning,
        messageId: /^\d+$/.test(message.id) ? message.id : null,
        conversationId: snapshot.conversationId,
        usage: message.usage,
        snapshot: snapshot.usage,
        draftRequestId: snapshot.draftRequestId,
      };
    }
  }
}
