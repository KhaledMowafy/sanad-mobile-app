import { describe, expect, it } from 'vitest';
import type { ChatEvent, StreamAnswerRequest } from '@/application/ports/chat-gateway';
import { FixedClock, SequentialIds } from '@/test-support/fakes';
import { StreamAnswer } from '@/application/use-cases/stream-answer';
import { ApiClient } from '@/infrastructure/http/api-client';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { HttpChatGateway, NEW_CONVERSATION_TITLE, codeForError } from './http-chat-gateway';

const request = (over: Partial<StreamAnswerRequest> = {}): StreamAnswerRequest => ({
  conversationId: '135',
  content: 'ما نص المادة 147؟',
  attachments: [],
  scope: 'egyptian_legislation',
  locale: 'ar',
  reviewContract: false,
  regenerateMessageId: null,
  ...over,
});

function sse(events: unknown[], chunkSize = 17): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const gatewayFor = (fetchImpl: typeof fetch) =>
  new HttpChatGateway(
    new ApiClient({
      baseUrl: 'http://api.test/api',
      timeoutMs: 1000,
      fetch: fetchImpl,
      tokens: { accessToken: async () => 'tok', refresh: async () => null },
    }),
  );

async function collect(iterable: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const event of iterable) out.push(event);
  return out;
}

describe('HttpChatGateway', () => {
  it('posts the documented body with the bearer token and streams tokens to done', async () => {
    const { fetch, calls } = fakeFetch([
      sse([
        { type: 'token', text: 'المادة ' },
        { type: 'token', text: '147' },
        { type: 'done', message_id: 901, citations: [], warning: null },
      ]),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));

    expect(events).toEqual([
      { type: 'token', text: 'المادة ' },
      { type: 'token', text: '147' },
      {
        type: 'done',
        conversationId: '135',
        messageId: '901',
        warning: null,
        usage: null,
        draftRequestId: null,
      },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.pathname).toBe('/api/conversations/135/ask');
    expect(calls[0]?.headers.Authorization).toBe('Bearer tok');
    expect(calls[0]?.headers.Accept).toContain('text/event-stream');
    expect(calls[0]?.body).toEqual({
      text: 'ما نص المادة 147؟',
      attachments: [],
      use_rag: true,
    });
  });

  it('sends review_contract true only when asked, and reads the wizard draft id', async () => {
    const { fetch, calls } = fakeFetch([
      sse([{ type: 'done', message_id: 1, citations: [], warning: null, draft_request_id: 55 }]),
      sse([{ type: 'done', message_id: 2, citations: [], warning: null }]),
    ]);
    const gateway = gatewayFor(fetch);
    const reviewed = await collect(gateway.streamAnswer(request({ reviewContract: true })));
    await collect(gateway.streamAnswer(request()));
    expect(calls[0]?.body).toMatchObject({ review_contract: true });
    expect(calls[1]?.body).not.toHaveProperty('review_contract');
    expect(reviewed.at(-1)).toMatchObject({ type: 'done', draftRequestId: '55' });
  });

  it('never sends defence_memo or a mode: a memo goes through the drafts API', async () => {
    const { fetch, calls } = fakeFetch([
      sse([{ type: 'done', message_id: 1, citations: [], warning: null }]),
    ]);
    await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(calls[0]?.body).not.toHaveProperty('defence_memo');
    expect(calls[0]?.body).not.toHaveProperty('mode');
  });

  it('reads library references and token usage from the done event', async () => {
    const usage = {
      answer: { prompt: 10, completion: 20, total: 30 },
      conversation: {
        used: 30,
        limit: 1000,
        remaining: 970,
        messages: 1,
        max_messages: 20,
        state: 'ok',
        tokens_state: 'ok',
        messages_state: 'ok',
      },
      user: {
        used: 30,
        limit: 5000,
        remaining: 4970,
        period_start: '2026-10-01T00:00:00+03:00',
        resets_at: '2026-11-01T00:00:00+03:00',
        state: 'warning',
      },
    };
    const { fetch } = fakeFetch([
      sse([
        { type: 'token', text: 'نص' },
        {
          type: 'done',
          message_id: 7,
          warning: null,
          usage,
          citations: [
            {
              source: 'corpus',
              lawName: 'القانون المدني',
              articleNumber: 147,
              isBis: false,
              status: 'ACTIVE',
            },
            {
              source: 'library',
              used: false,
              kind: 'commentary',
              authority: 20,
              label: 'السنهوري، ص 905',
              title: 'الوسيط',
              author: 'السنهوري',
              page: 905,
            },
            { lawName: 'قانون العقوبات', articleNumber: 10, isBis: false, status: 'ACTIVE' },
          ],
        },
      ]),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events.filter((e) => e.type === 'citation')).toHaveLength(2);
    const reference = events.find((e) => e.type === 'reference');
    expect(reference).toMatchObject({
      reference: {
        used: false,
        kind: 'COMMENTARY',
        authority: 20,
        label: 'السنهوري، ص 905',
        page: 905,
      },
    });
    const done = events.at(-1);
    expect(done).toMatchObject({
      type: 'done',
      usage: {
        answer: { prompt: 10, completion: 20, total: 30 },
        snapshot: { conversation: { maxMessages: 20 }, user: { state: 'warning' } },
      },
    });
  });

  it('turns a spent usage limit into a code the screen can act on', async () => {
    const { fetch } = fakeFetch([
      json(429, {
        status_code: 429,
        message: 'Usage limit reached.',
        data: {
          limit: 'monthly_tokens',
          usage: {
            user: {
              used: 5000,
              limit: 5000,
              remaining: 0,
              period_start: '2026-10-01T00:00:00+03:00',
              resets_at: '2026-11-01T00:00:00+03:00',
              state: 'exhausted',
            },
          },
        },
      }),
    ]);
    const events = await collect(
      gatewayFor(fetch).streamAnswer(request({ conversationId: '135' })),
    );
    expect(events).toEqual([
      {
        type: 'error',
        code: 'limit_monthly_tokens',
        usage: {
          conversation: null,
          user: expect.objectContaining({
            state: 'exhausted',
            resetsAt: '2026-11-01T00:00:00+03:00',
            pages: null,
            billing: false,
            plan: null,
            subscription: null,
          }),
        },
      },
    ]);
  });

  it('keeps the request throttle apart from a usage limit', async () => {
    const { fetch } = fakeFetch([
      json(429, { status_code: 429, message: 'Throttled', data: null }),
    ]);
    const events = await collect(
      gatewayFor(fetch).streamAnswer(request({ conversationId: '135' })),
    );
    expect(events).toEqual([{ type: 'error', code: 'rate_limited' }]);
  });

  it('creates the conversation first when there is none', async () => {
    const { fetch, calls } = fakeFetch([
      json(
        200,
        envelope({
          id: 140,
          title: NEW_CONVERSATION_TITLE,
          created_at: '2026-10-15T02:26:45.727Z',
          updated_at: '2026-10-15T02:26:45.727Z',
        }),
      ),
      sse([{ type: 'done', message_id: 1, citations: [], warning: null }]),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request({ conversationId: null })));

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url.pathname).toBe('/api/conversations');
    expect(calls[0]?.body).toEqual({ title: 'محادثة جديدة' });
    expect(calls[1]?.url.pathname).toBe('/api/conversations/140/ask');
    expect(events).toEqual([
      {
        type: 'done',
        conversationId: '140',
        messageId: '1',
        warning: null,
        usage: null,
        draftRequestId: null,
      },
    ]);
  });

  it('surfaces citations from the done event before it', async () => {
    const { fetch } = fakeFetch([
      sse([
        { type: 'token', text: 'نص' },
        {
          type: 'done',
          message_id: 5,
          citations: [{ article_number: 147, law_number: 131, law_year: 1948 }],
          warning: '  تنبيه  ',
        },
      ]),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events.map((e) => e.type)).toEqual(['token', 'citation', 'done']);
    expect(events[1]).toMatchObject({
      type: 'citation',
      citation: { reference: { article: '147' } },
    });
    expect(events[2]).toMatchObject({ warning: 'تنبيه' });
  });

  it('reports a mid-stream error and ends at the terminating done', async () => {
    const { fetch } = fakeFetch([
      sse([
        { type: 'token', text: 'جزء' },
        { type: 'error', message: 'model failed', detail: 'timeout' },
        { type: 'done', message_id: 7, citations: [], warning: null },
      ]),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events.map((e) => e.type)).toEqual(['token', 'error', 'done']);
    expect(events[1]).toEqual({ type: 'error', code: 'generation_failed' });
  });

  it('ignores malformed and unknown events', async () => {
    const body = [
      'data: not json\n\n',
      'data: {"type":"ping"}\n\n',
      'data: {"type":"token","text":"x"}\n\n',
      'data: {"type":"done","message_id":null,"citations":[],"warning":null}\n\n',
    ].join('');
    const { fetch } = fakeFetch([
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events).toEqual([
      { type: 'token', text: 'x' },
      {
        type: 'done',
        conversationId: '135',
        messageId: null,
        warning: null,
        usage: null,
        draftRequestId: null,
      },
    ]);
  });

  it.each([
    [400, 'A validation error occurred.', 'invalid_request'],
    [401, 'x', 'unauthenticated'],
    [403, 'x', 'forbidden'],
    [404, 'x', 'conversation_not_found'],
    [429, 'x', 'rate_limited'],
    [500, 'x', 'server_error'],
  ])('maps a pre-stream enveloped HTTP %i to %s', async (status, message, code) => {
    const { fetch } = fakeFetch([
      json(status, { status_code: status, status: 0, message, data: null }),
    ]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events).toEqual([{ type: 'error', code }]);
  });

  it('treats a 200 that is not an event stream as a failure', async () => {
    const { fetch } = fakeFetch([json(200, envelope({ ok: true }))]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events).toEqual([{ type: 'error', code: 'server_error' }]);
  });

  it('reports a network failure', async () => {
    const { fetch } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const events = await collect(gatewayFor(fetch).streamAnswer(request()));
    expect(events).toEqual([{ type: 'error', code: 'network' }]);
  });

  it('stops before asking when conversation creation fails', async () => {
    const { fetch, calls } = fakeFetch([json(403, { status_code: 403, data: null })]);
    const events = await collect(gatewayFor(fetch).streamAnswer(request({ conversationId: null })));
    expect(events).toEqual([{ type: 'error', code: 'forbidden' }]);
    expect(calls).toHaveLength(1);
  });

  it('sends numeric attachment ids and refuses ids it never uploaded', async () => {
    const attachment = (id: string) => ({
      id,
      name: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 5,
    });
    const ok = fakeFetch([sse([{ type: 'done', message_id: 1, citations: [], warning: null }])]);
    await collect(gatewayFor(ok.fetch).streamAnswer(request({ attachments: [attachment('44')] })));
    expect(ok.calls[0]?.body).toMatchObject({ attachments: [44] });

    const bad = fakeFetch([]);
    const events = await collect(
      gatewayFor(bad.fetch).streamAnswer(request({ attachments: [attachment('3f2c-local-uuid')] })),
    );
    expect(events).toEqual([{ type: 'error', code: 'attachment_not_uploaded' }]);
    expect(bad.calls).toHaveLength(0);
  });

  it('aborts the request when the caller aborts', async () => {
    const controller = new AbortController();
    let aborted = false;
    const { fetch } = fakeFetch((call) => {
      void call;
      return sse(
        [
          { type: 'token', text: 'a' },
          { type: 'token', text: 'b' },
        ],
        5,
      );
    });
    const events: ChatEvent[] = [];
    for await (const event of gatewayFor(fetch).streamAnswer(request(), controller.signal)) {
      events.push(event);
      controller.abort();
      aborted = true;
      break;
    }
    expect(aborted).toBe(true);
    expect(events).toHaveLength(1);
  });

  it('accepts feedback as a no-op', async () => {
    const { fetch } = fakeFetch([]);
    expect(
      await gatewayFor(fetch).submitFeedback({
        conversationId: '1',
        messageId: '2',
        feedback: 'up',
      }),
    ).toEqual({ ok: true, value: undefined });
  });
});

describe('codeForError', () => {
  it('covers conflict and unknown as server errors', () => {
    expect(codeForError({ kind: 'conflict', code: 'x' })).toBe('server_error');
    expect(codeForError({ kind: 'unknown', message: null })).toBe('server_error');
  });
});

describe('end to end with StreamAnswer', () => {
  it('produces a complete assistant message with the server id and warning', async () => {
    const { fetch } = fakeFetch([
      sse([
        { type: 'token', text: 'الأصل ' },
        { type: 'token', text: 'أن العقد شريعة المتعاقدين.' },
        {
          type: 'done',
          message_id: 321,
          citations: [{ article_number: 147, law_name: 'القانون المدني' }],
          warning: 'راجع النصوص الرسمية',
        },
      ]),
    ]);
    const streamAnswer = new StreamAnswer(gatewayFor(fetch), new FixedClock(), new SequentialIds());
    let last;
    for await (const snapshot of streamAnswer.execute(request())) last = snapshot;

    expect(last?.message).toMatchObject({
      id: '321',
      status: 'complete',
      content: 'الأصل أن العقد شريعة المتعاقدين.',
      warning: 'راجع النصوص الرسمية',
    });
    expect(last?.message.citations).toHaveLength(1);
    expect(last?.conversationId).toBe('135');
  });

  it('shows a stable error code when the backend rejects the question', async () => {
    const { fetch } = fakeFetch([
      json(400, {
        status_code: 400,
        status: 0,
        message: 'A validation error occurred.',
        data: 'x',
      }),
    ]);
    const streamAnswer = new StreamAnswer(gatewayFor(fetch), new FixedClock(), new SequentialIds());
    let last;
    for await (const snapshot of streamAnswer.execute(request())) last = snapshot;
    expect(last?.message).toMatchObject({ status: 'error', errorCode: 'invalid_request' });
  });
});
