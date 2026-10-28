import { describe, expect, it } from 'vitest';
import { citation, conversation, message } from '@/test-support/builders';
import {
  FakeChatGateway,
  FakeConversationRepository,
  FixedClock,
  SequentialIds,
  toStream,
} from '@/test-support/fakes';
import type { ChatEvent, StreamAnswerRequest } from '../ports/chat-gateway';
import { RegenerateAnswer } from './regenerate-answer';
import { SendMessage } from './send-message';
import { StopGeneration } from './stop-generation';
import {
  STREAM_CLOSED_ERROR,
  STREAM_FAILED_ERROR,
  StreamAnswer,
  type StreamSnapshot,
} from './stream-answer';

const request: StreamAnswerRequest = {
  conversationId: null,
  content: 'سؤال',
  attachments: [],
  scope: 'egyptian_legislation',
  locale: 'ar',
  reviewContract: false,
  regenerateMessageId: null,
};

async function collect(iterable: AsyncIterable<StreamSnapshot>): Promise<StreamSnapshot[]> {
  const out: StreamSnapshot[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe('SendMessage', () => {
  const useCase = () => new SendMessage(new FixedClock(), new SequentialIds());

  it('prepares the user turn and the stream request', () => {
    const result = useCase().execute({
      conversationId: 'c1',
      text: '  هل يجوز الفسخ؟ ',
      attachmentIds: ['44'],
      locale: 'ar',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.userMessage).toMatchObject({
      role: 'user',
      content: 'هل يجوز الفسخ؟',
      status: 'complete',
      createdAt: '2026-10-15T10:00:00.000Z',
    });
    expect(result.value.request.attachments.map((a) => a.id)).toEqual(['44']);
    expect(result.value.request).toMatchObject({
      conversationId: 'c1',
      content: 'هل يجوز الفسخ؟',
      scope: 'egyptian_legislation',
      locale: 'ar',
      reviewContract: false,
      regenerateMessageId: null,
    });
  });

  it('rejects an empty message', () => {
    const result = useCase().execute({
      conversationId: null,
      text: '   ',
      locale: 'ar',
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', fields: { text: 'message_empty' } },
    });
  });
});

describe('StreamAnswer', () => {
  it('carries references and what the answer cost', async () => {
    const usage = {
      conversation: null,
      user: {
        used: 10,
        limit: 100,
        remaining: 90,
        periodStart: '2026-10-01T00:00:00Z',
        resetsAt: '2026-11-01T00:00:00Z',
        pages: null,
        billing: false,
        plan: null,
        subscription: null,
        state: 'ok' as const,
      },
    };
    const reference = {
      id: 'r1',
      used: true,
      kind: 'CASSATION',
      authority: 30,
      label: 'الطعن رقم 1',
      title: 't',
      author: '',
      page: null,
      appealNumber: 1,
      appealYear: 80,
      citable: true,
    };
    const useCase = new StreamAnswer(
      new FakeChatGateway(() =>
        toStream([
          { type: 'token', text: 'نص' },
          { type: 'reference', reference },
          { type: 'reference', reference: { ...reference, used: false } },
          {
            type: 'done',
            conversationId: 'c1',
            messageId: '5',
            warning: null,
            usage: { answer: { prompt: 1, completion: 2, total: 3 }, snapshot: usage },
            draftRequestId: null,
          },
        ]),
      ),
      new FixedClock(),
      new SequentialIds(),
    );
    const last = (await collect(useCase.execute(request))).at(-1);
    // The same card twice collapses, and the one the answer relied on wins.
    expect(last?.message.references).toEqual([reference]);
    expect(last?.message.usage).toEqual({ prompt: 1, completion: 2, total: 3 });
    expect(last?.usage).toEqual(usage);
  });

  const make = (events: () => AsyncIterable<ChatEvent>) =>
    new StreamAnswer(new FakeChatGateway(events), new FixedClock(), new SequentialIds());

  it('folds tokens and citations into snapshots and completes', async () => {
    const useCase = make(() =>
      toStream([
        { type: 'token', text: 'الأصل ' },
        { type: 'citation', citation: citation('147') },
        { type: 'token', text: 'أن' },
        {
          type: 'done',
          conversationId: 'c9',
          messageId: 'srv-1',
          warning: 'راجع النص الرسمي',
          usage: null,
          draftRequestId: null,
        },
      ]),
    );
    const snapshots = await collect(useCase.execute(request));
    const last = snapshots.at(-1);
    expect(snapshots[0]?.message.status).toBe('streaming');
    expect(snapshots[0]?.conversationId).toBeNull();
    expect(last?.message.status).toBe('complete');
    expect(last?.message.content).toBe('الأصل أن');
    expect(last?.message.citations).toHaveLength(1);
    expect(last?.conversationId).toBe('c9');
    expect(last?.message.id).toBe('srv-1');
    expect(last?.message.warning).toBe('راجع النص الرسمي');
    expect(snapshots).toHaveLength(5);
  });

  it('turns a backend error event into an error message and stops reading', async () => {
    const useCase = make(() =>
      toStream([
        { type: 'token', text: 'جزء' },
        { type: 'error', code: 'model_unavailable' },
        { type: 'token', text: 'ignored' },
      ]),
    );
    const last = (await collect(useCase.execute(request))).at(-1);
    expect(last?.message).toMatchObject({
      status: 'error',
      errorCode: 'model_unavailable',
      content: 'جزء',
    });
  });

  it('marks a stream that ends silently as closed', async () => {
    const useCase = make(() => toStream([{ type: 'token', text: 'نص' }]));
    const last = (await collect(useCase.execute(request))).at(-1);
    expect(last?.message).toMatchObject({ status: 'error', errorCode: STREAM_CLOSED_ERROR });
  });

  it('converts a thrown transport failure into an error message', async () => {
    const useCase = make(() => {
      return (async function* () {
        throw new Error('socket hang up');
      })();
    });
    const last = (await collect(useCase.execute(request))).at(-1);
    expect(last?.message).toMatchObject({ status: 'error', errorCode: STREAM_FAILED_ERROR });
  });

  it('marks the message stopped when the caller aborts mid-stream', async () => {
    const controller = new AbortController();
    const useCase = make(() =>
      (async function* () {
        yield { type: 'token', text: 'بداية' } as const;
        controller.abort();
        yield { type: 'token', text: 'لن تظهر' } as const;
      })(),
    );
    const last = (await collect(useCase.execute(request, controller.signal))).at(-1);
    expect(last?.message).toMatchObject({ status: 'stopped', content: 'بداية' });
  });

  it('marks stopped when the transport throws after an abort', async () => {
    const controller = new AbortController();
    const useCase = make(() =>
      (async function* () {
        controller.abort();
        throw new DOMException('aborted', 'AbortError');
        yield { type: 'token', text: '' } as const;
      })(),
    );
    const last = (await collect(useCase.execute(request, controller.signal))).at(-1);
    expect(last?.message.status).toBe('stopped');
  });

  it('keeps the request conversation id until the backend confirms one', async () => {
    const useCase = make(() => toStream([{ type: 'error', code: 'x' }]));
    const snapshots = await collect(useCase.execute({ ...request, conversationId: 'c1' }));
    expect(snapshots.at(-1)?.conversationId).toBe('c1');
  });
});

describe('StopGeneration', () => {
  it('aborts the controller', () => {
    const controller = new AbortController();
    new StopGeneration().execute(controller);
    expect(controller.signal.aborted).toBe(true);
  });
});

describe('RegenerateAnswer', () => {
  const convo = conversation({
    id: 'c1',
    messages: [
      message({ id: 'q1', role: 'user', content: 'السؤال الأول' }),
      message({ id: 'a1', role: 'assistant', content: 'الإجابة' }),
    ],
  });
  const useCase = (repo = new FakeConversationRepository([convo])) => new RegenerateAnswer(repo);

  it('replays the user turn', async () => {
    const result = await useCase().execute({
      conversationId: 'c1',
      assistantMessageId: 'a1',
      locale: 'ar',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        conversationId: 'c1',
        content: 'السؤال الأول',
        attachments: [],
        scope: 'egyptian_legislation',
        locale: 'ar',
        reviewContract: false,
        regenerateMessageId: 'a1',
      },
    });
  });

  it('refuses to regenerate a user message or an unknown one', async () => {
    const notFound = { ok: false, error: { kind: 'not_found' } };
    expect(
      await useCase().execute({ conversationId: 'c1', assistantMessageId: 'q1', locale: 'ar' }),
    ).toEqual(notFound);
    expect(
      await useCase().execute({ conversationId: 'c1', assistantMessageId: 'zzz', locale: 'ar' }),
    ).toEqual(notFound);
  });

  it('reports not found when no user turn precedes the answer', async () => {
    const orphan = conversation({
      id: 'c2',
      messages: [message({ id: 'a1', role: 'assistant' })],
    });
    const result = await useCase(new FakeConversationRepository([orphan])).execute({
      conversationId: 'c2',
      assistantMessageId: 'a1',
      locale: 'ar',
    });
    expect(result).toEqual({ ok: false, error: { kind: 'not_found' } });
  });

  it('passes repository failures through', async () => {
    const result = await useCase(new FakeConversationRepository([])).execute({
      conversationId: 'nope',
      assistantMessageId: 'a1',
      locale: 'ar',
    });
    expect(result).toEqual({ ok: false, error: { kind: 'not_found' } });
  });
});
