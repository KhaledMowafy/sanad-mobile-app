import { describe, expect, it, vi } from 'vitest';
import type { CitationDto } from '@/application/dto/dto';
import type { ChatAttachmentDto, DraftDto } from '@/application/dto/dto';
import { DEFAULT_LIMITS } from '@/domain/entities/limits';
import type { DraftApi } from './draft-client';
import type { TemplateApi } from './template-client';
import type { AttachmentApi, PickedFile } from './attachment-client';
import { createChatStore } from './chat-store';
import { ChatStreamError, type ChatStreamFn } from './stream-client';
import type { ChatStreamEvent } from './stream-events';

const citation = (id: string): CitationDto => ({
  id,
  lawName: 'القانون المدني',
  lawNumber: 131,
  lawYear: 1948,
  article: '157',
  status: 'in_force',
  text: null,
  bookLabel: null,
});

async function* events(list: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  for (const event of list) yield event;
}

const make = (stream: ChatStreamFn, over: { conversationId?: string | null } = {}) => {
  const created = vi.fn();
  const settled = vi.fn();
  const store = createChatStore({
    conversationId: over.conversationId ?? null,
    messages: [],
    locale: 'ar',
    stream,
    onConversationCreated: created,
    onSettled: settled,
    now: () => new Date('2026-10-15T10:00:00Z'),
  });
  return { store, created, settled };
};

describe('chat store', () => {
  it('appends the question and streams the answer into one message', async () => {
    const { store, created, settled } = make(() =>
      events([
        { type: 'start', conversationId: null },
        { type: 'delta', text: 'الأصل ' },
        { type: 'delta', text: 'أن' },
        { type: 'citation', citation: citation('c1') },
        { type: 'citation', citation: citation('c1') },
        {
          type: 'end',
          usage: null,
          snapshot: null,
          draftRequestId: null,
          status: 'complete',
          errorCode: null,
          warning: 'راجع النص',
          messageId: '501',
          conversationId: '77',
        },
      ]),
    );

    await store.getState().send('  ما نص المادة؟  ');

    const { messages, phase, conversationId } = store.getState();
    expect(phase).toBe('idle');
    expect(conversationId).toBe('77');
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'ما نص المادة؟'],
      ['assistant', 'الأصل أن'],
    ]);
    expect(messages[1]).toMatchObject({
      id: '501',
      status: 'complete',
      warning: 'راجع النص',
    });
    expect(messages[1]?.citations).toHaveLength(1);
    expect(created).toHaveBeenCalledWith('77');
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('ignores empty input and sends while an answer is streaming', async () => {
    const stream = vi.fn(() => events([]));
    const { store } = make(stream);
    await store.getState().send('   ');
    expect(stream).not.toHaveBeenCalled();
    expect(store.getState().messages).toHaveLength(0);
  });

  it('sends the existing conversation id and does not report a creation', async () => {
    const stream = vi.fn((_request: unknown) =>
      events([
        {
          type: 'end',
          usage: null,
          snapshot: null,
          draftRequestId: null,
          status: 'complete',
          errorCode: null,
          warning: null,
          messageId: null,
          conversationId: '9',
        },
      ]),
    );
    const { store, created } = make(stream, { conversationId: '9' });
    await store.getState().send('سؤال');
    expect(stream.mock.calls[0]?.[0]).toEqual({
      conversationId: '9',
      text: 'سؤال',
      locale: 'ar',
      reviewContract: false,
      attachmentIds: [],
    });
    expect(created).not.toHaveBeenCalled();
  });

  it('shows the backend error code on the answer', async () => {
    const { store } = make(() =>
      events([
        { type: 'delta', text: 'جزء' },
        {
          type: 'end',
          usage: null,
          snapshot: null,
          draftRequestId: null,
          status: 'error',
          errorCode: 'generation_failed',
          warning: null,
          messageId: null,
          conversationId: '3',
        },
      ]),
    );
    await store.getState().send('سؤال');
    expect(store.getState().messages[1]).toMatchObject({
      status: 'error',
      errorCode: 'generation_failed',
      content: 'جزء',
    });
  });

  it('keeps the error code for failures before the stream opens', async () => {
    const { store } = make(async function* () {
      throw new ChatStreamError('unauthenticated');
      yield undefined as never;
    });
    await store.getState().send('سؤال');
    expect(store.getState().messages[1]).toMatchObject({
      status: 'error',
      errorCode: 'unauthenticated',
    });
    expect(store.getState().phase).toBe('idle');
  });

  it('treats an unexpected exception as a network error', async () => {
    const { store } = make(async function* () {
      throw new Error('boom');
      yield undefined as never;
    });
    await store.getState().send('سؤال');
    expect(store.getState().messages[1]).toMatchObject({ status: 'error', errorCode: 'network' });
  });

  it('marks a stream that ends without an "end" frame as closed', async () => {
    const { store } = make(() => events([{ type: 'delta', text: 'نص' }]));
    await store.getState().send('سؤال');
    expect(store.getState().messages[1]).toMatchObject({
      status: 'error',
      errorCode: 'stream_closed',
      content: 'نص',
    });
  });

  it('stops: the partial answer stays and is marked stopped', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { store, settled } = make(async function* (_request, signal) {
      yield { type: 'delta', text: 'بداية' } as const;
      await gate;
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    });

    const pending = store.getState().send('سؤال');
    await vi.waitFor(() => expect(store.getState().messages[1]?.content).toBe('بداية'));
    expect(store.getState().phase).toBe('streaming');

    store.getState().stop();
    release();
    await pending;

    expect(store.getState().messages[1]).toMatchObject({
      status: 'stopped',
      content: 'بداية',
      errorCode: null,
    });
    expect(store.getState().phase).toBe('idle');
    expect(settled).toHaveBeenCalled();
  });

  it('does not start a second answer while one is streaming', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const stream = vi.fn(async function* () {
      await gate;
      yield {
        type: 'end',
        usage: null,
        snapshot: null,
        status: 'complete',
        errorCode: null,
        warning: null,
        messageId: null,
        conversationId: '1',
        draftRequestId: null,
      } as const;
    });
    const { store } = make(stream);
    const first = store.getState().send('أول');
    await store.getState().send('ثان');
    expect(stream).toHaveBeenCalledTimes(1);
    release();
    await first;
    expect(store.getState().messages).toHaveLength(2);
  });
});

describe('chat store attachments', () => {
  const file = (name: string) => ({ uri: `file:///${name}`, name, size: 3, mimeType: 'image/png' });
  const dto = (state: ChatAttachmentDto['state']): ChatAttachmentDto => ({
    id: '5',
    name: 'a.pdf',
    kind: 'pdf',
    sizeBytes: 3,
    state,
    extractedText: '',
    failed: state === 'failed',
  });
  const done = () =>
    events([
      { type: 'start', conversationId: '7' },
      {
        type: 'end',
        usage: null,
        snapshot: null,
        status: 'complete',
        errorCode: null,
        warning: null,
        messageId: null,
        conversationId: '7',
      },
    ] as ChatStreamEvent[]);

  it('uploads, polls until read, then sends the ids and clears them', async () => {
    const api: AttachmentApi = {
      upload: vi.fn(async () => ({
        ok: true as const,
        conversationId: '7',
        attachment: dto('queued'),
      })),
      list: vi.fn(async () => [dto('ready')]),
    };
    const stream = vi.fn((_r: unknown) => done());
    const created = vi.fn();
    const store = createChatStore({
      conversationId: null,
      messages: [],
      locale: 'ar',
      stream,
      attachmentApi: api,
      onConversationCreated: created,
      pollMs: 5,
    });

    await store.getState().attach([file('a.pdf')]);
    expect(created).toHaveBeenCalledWith('7');

    await store.getState().send('سؤال');
    expect(store.getState().attachmentError).toBe('attachments_pending');
    expect(stream).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(store.getState().attachments[0]?.state).toBe('ready'));
    await store.getState().send('سؤال');
    expect(stream.mock.calls[0]?.[0]).toMatchObject({ conversationId: '7', attachmentIds: ['5'] });
    expect(store.getState().attachments).toEqual([]);
    store.getState().dispose();
  });

  it('refuses files the backend would reject and a fourth file', async () => {
    const api: AttachmentApi = { upload: vi.fn(), list: vi.fn() };
    const store = createChatStore({
      conversationId: '1',
      messages: [],
      locale: 'ar',
      stream: () => done(),
      attachmentApi: api,
    });
    await store.getState().attach([file('run.exe')]);
    expect(store.getState().attachmentError).toBe('attachment_type_not_allowed');
    expect(api.upload).not.toHaveBeenCalled();
  });
});

describe('chat store defence memo', () => {
  const draft = (status: DraftDto['status'], output: string | null = null): DraftDto => ({
    id: '31',
    conversationId: '9',
    templateCode: null,
    templateName: null,
    prompt: 'وقائع',
    status,
    error: null,
    warning: null,
    output,
    createdAt: '2026-10-15T10:00:00.000Z',
    finishedAt: null,
  });

  it('asks for a memo instead of streaming, then follows it until it is done', async () => {
    const stream = vi.fn((_r: unknown) => events([]));
    const api: DraftApi = {
      create: vi.fn(async () => ({
        ok: true as const,
        conversationId: '9',
        draft: draft('queued'),
      })),
      get: vi
        .fn()
        .mockResolvedValueOnce(draft('generating'))
        .mockResolvedValue(draft('done', 'نص المذكرة')),
      list: vi.fn(),
    };
    const created = vi.fn();
    const store = createChatStore({
      conversationId: null,
      messages: [],
      locale: 'ar',
      stream,
      draftApi: api,
      onConversationCreated: created,
      draftPollMs: 5,
    });

    await store.getState().send('وقائع', { mode: { kind: 'memo' } });
    expect(api.create).toHaveBeenCalledWith({
      conversationId: null,
      prompt: 'وقائع',
      attachmentIds: [],
    });
    // Not a chat message: nothing was streamed and no bubble was added.
    expect(stream).not.toHaveBeenCalled();
    expect(store.getState().messages).toEqual([]);
    expect(created).toHaveBeenCalledWith('9');
    expect(store.getState().drafts.map((d) => d.status)).toEqual(['queued']);

    await vi.waitFor(() => expect(store.getState().drafts[0]?.status).toBe('done'));
    expect(store.getState().drafts[0]?.output).toBe('نص المذكرة');
    store.getState().dispose();
  });

  it('holds a memo back only for the month, not for a full conversation', async () => {
    const user = {
      used: 5000,
      limit: 5000,
      remaining: 0,
      periodStart: '2026-10-01T00:00:00Z',
      resetsAt: '2026-11-01T00:00:00Z',
      pages: null,
      billing: false,
      plan: null,
      subscription: null,
      state: 'exhausted' as const,
    };
    const conversation = {
      used: 100,
      limit: 100,
      remaining: 0,
      messages: 5,
      maxMessages: 5,
      state: 'exhausted' as const,
      tokensState: 'exhausted' as const,
      messagesState: 'exhausted' as const,
    };
    const api: DraftApi = {
      create: vi.fn(async () => ({
        ok: true as const,
        conversationId: '9',
        draft: draft('queued'),
      })),
      get: vi.fn(async () => draft('queued')),
      list: vi.fn(),
    };
    const stream = vi.fn((_r: unknown) => events([]));
    const full = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream,
      draftApi: api,
      usage: { conversation, user: { ...user, state: 'ok', used: 1 } },
    });
    await full.getState().send('سؤال');
    expect(stream).not.toHaveBeenCalled();
    expect(full.getState().attachmentError).toBe('limit_conversation_tokens');
    await full.getState().send('وقائع', { mode: { kind: 'memo' } });
    expect(api.create).toHaveBeenCalledTimes(1);
    full.getState().dispose();

    const spent = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream,
      draftApi: api,
      usage: { conversation: null, user },
    });
    await spent.getState().send('وقائع', { mode: { kind: 'memo' } });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(spent.getState().draftError).toBe('limit_monthly_tokens');
  });

  it('keeps what the backend says about a refused memo and updates the figures', async () => {
    const user = {
      used: 5000,
      limit: 5000,
      remaining: 0,
      periodStart: '2026-10-01T00:00:00Z',
      resetsAt: '2026-11-01T00:00:00Z',
      pages: null,
      billing: false,
      plan: null,
      subscription: null,
      state: 'exhausted' as const,
    };
    const api: DraftApi = {
      create: vi.fn(async () => ({
        ok: false as const,
        code: 'limit_monthly_tokens',
        usage: { conversation: null, user },
      })),
      get: vi.fn(),
      list: vi.fn(),
    };
    const store = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      draftApi: api,
    });
    await store.getState().send('وقائع', { mode: { kind: 'memo' } });
    expect(store.getState().draftError).toBe('limit_monthly_tokens');
    expect(store.getState().usage?.user?.state).toBe('exhausted');
    expect(store.getState().drafts).toEqual([]);
  });
});

describe('chat store usage', () => {
  it('records what an answer cost and where the conversation now stands', async () => {
    const snapshot = {
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
    const { store } = make(() =>
      events([
        { type: 'delta', text: 'نص' },
        {
          type: 'end',
          status: 'complete',
          errorCode: null,
          warning: null,
          messageId: '5',
          conversationId: '9',
          usage: { prompt: 1, completion: 2, total: 3 },
          snapshot,
          draftRequestId: null,
        },
      ]),
    );
    await store.getState().send('سؤال');
    expect(store.getState().messages.at(-1)?.usage).toEqual({ prompt: 1, completion: 2, total: 3 });
    expect(store.getState().usage).toEqual(snapshot);
  });
});

describe('chat store modes', () => {
  const end = (over: Record<string, unknown> = {}): ChatStreamEvent =>
    ({
      type: 'end',
      status: 'complete',
      errorCode: null,
      warning: null,
      messageId: '5',
      conversationId: '9',
      usage: null,
      snapshot: null,
      draftRequestId: null,
      ...over,
    }) as ChatStreamEvent;

  it('asks the backend to review a contract only in review mode', async () => {
    const stream = vi.fn((_r: unknown) => events([end()]));
    const { store } = make(stream, { conversationId: '9' });
    await store.getState().send('عقد', { mode: { kind: 'review' } });
    await store.getState().send('سؤال');
    expect(
      stream.mock.calls.map((c) => (c[0] as { reviewContract: boolean }).reviewContract),
    ).toEqual([true, false]);
  });

  it('asks for a catalogue document with its code instead of streaming', async () => {
    const api: DraftApi = {
      create: vi.fn(async () => ({
        ok: true as const,
        conversationId: '9',
        draft: {
          id: '40',
          conversationId: '9',
          templateCode: 'bail_reduction_request',
          templateName: 'طلب تخفيض كفالة',
          prompt: 'بيانات',
          status: 'queued' as const,
          error: null,
          warning: null,
          output: null,
          createdAt: '2026-10-15T10:00:00.000Z',
          finishedAt: null,
        },
      })),
      get: vi.fn(async () => null),
      list: vi.fn(),
    };
    const stream = vi.fn((_r: unknown) => events([]));
    const store = createChatStore({
      conversationId: null,
      messages: [],
      locale: 'ar',
      stream,
      draftApi: api,
      draftPollMs: 60_000,
    });
    const template = {
      code: 'bail_reduction_request',
      name: 'طلب تخفيض كفالة',
      description: '',
      category: 'PETITION' as const,
    };
    await store.getState().send('بيانات', { mode: { kind: 'template', template } });
    expect(api.create).toHaveBeenCalledWith({
      conversationId: null,
      prompt: 'بيانات',
      attachmentIds: [],
      templateCode: 'bail_reduction_request',
    });
    expect(stream).not.toHaveBeenCalled();
    expect(store.getState().drafts[0]?.templateName).toBe('طلب تخفيض كفالة');
    store.getState().dispose();
  });

  it('opens the contract wizard and shows its first question as a message', async () => {
    const templates: TemplateApi = {
      list: vi.fn(),
      startContract: vi.fn(async () => ({
        ok: true as const,
        conversationId: '12',
        message: {
          id: '77',
          role: 'assistant' as const,
          content: 'من فضلك أدخل اسم المؤجر.',
          citations: [],
          references: [],
          attachments: [],
          status: 'complete' as const,
          errorCode: null,
          createdAt: '2026-10-15T10:00:00.000Z',
          feedback: null,
          warning: null,
          usage: null,
        },
      })),
    };
    const created = vi.fn();
    const store = createChatStore({
      conversationId: null,
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      templateApi: templates,
      onConversationCreated: created,
    });
    await store.getState().startContract({
      code: 'rental_contract',
      name: 'عقد إيجار',
      description: '',
      category: 'CONTRACT',
    });
    expect(templates.startContract).toHaveBeenCalledWith({
      conversationId: null,
      templateCode: 'rental_contract',
      title: 'عقد إيجار',
    });
    expect(store.getState().messages.map((m) => m.content)).toEqual(['من فضلك أدخل اسم المؤجر.']);
    expect(created).toHaveBeenCalledWith('12');
  });

  it('follows the contract the wizard drafts once its last answer arrives', async () => {
    const api: DraftApi = {
      create: vi.fn(),
      get: vi.fn(async () => ({
        id: '55',
        conversationId: '9',
        templateCode: 'rental_contract',
        templateName: 'عقد إيجار',
        prompt: '',
        status: 'done' as const,
        error: null,
        warning: null,
        output: 'نص العقد',
        createdAt: '2026-10-15T10:00:00.000Z',
        finishedAt: '2026-10-15T10:02:00.000Z',
      })),
      list: vi.fn(),
    };
    const store = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream: () => events([end({ draftRequestId: '55' })]),
      draftApi: api,
    });
    await store.getState().send('01/06/2026');
    await vi.waitFor(() => expect(store.getState().drafts.map((d) => d.id)).toEqual(['55']));
    expect(api.get).toHaveBeenCalledWith('55');
    store.getState().dispose();
  });
});

describe('chat store uploading several files', () => {
  const file = (name: string) => ({ uri: `file:///${name}`, name, size: 3, mimeType: 'image/png' });
  const upload = (names: string[]) =>
    vi.fn(async (_conversationId: string | null, f: PickedFile) => {
      names.push(f.name);
      return {
        ok: true as const,
        conversationId: '9',
        attachment: {
          id: String(names.length),
          name: f.name,
          kind: 'image' as const,
          sizeBytes: 3,
          state: 'ready' as const,
          extractedText: '',
          failed: false,
        },
      };
    });
  const limits = (perConversation: number) => ({
    ...DEFAULT_LIMITS,
    attachments: { ...DEFAULT_LIMITS.attachments, perConversation },
  });

  it('uploads the pages of a case in numeric name order, one at a time', async () => {
    const order: string[] = [];
    const api: AttachmentApi = { upload: upload(order), list: vi.fn(async () => []) };
    const store = createChatStore({
      conversationId: null,
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      attachmentApi: api,
    });
    await store
      .getState()
      .attach([file('page-10.jpg'), file('page-2.jpg'), file('page-1.jpg'), file('page-3.jpg')]);
    expect(order).toEqual(['page-1.jpg', 'page-2.jpg', 'page-3.jpg', 'page-10.jpg']);
    expect(store.getState().attachments).toHaveLength(4);
    expect(store.getState().conversationFiles).toBe(4);
    expect(store.getState().uploadProgress).toBeNull();
  });

  it('uploads nothing when the choice does not fit in the room left', async () => {
    const order: string[] = [];
    const api: AttachmentApi = { upload: upload(order), list: vi.fn(async () => []) };
    const store = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      attachmentApi: api,
      limits: limits(3),
    });
    await store.getState().attach([file('a.png'), file('b.png')]);
    await store.getState().attach([file('c.png'), file('d.png')]);
    expect(order).toEqual(['a.png', 'b.png']);
    expect(store.getState().attachmentError).toBe('too_many_attachments');
  });

  it('counts the files of earlier questions against the conversation', async () => {
    const order: string[] = [];
    const api: AttachmentApi = {
      upload: upload(order),
      list: vi.fn(async () =>
        [1, 2].map((n) => ({
          id: String(n),
          name: `old-${n}.png`,
          kind: 'image' as const,
          sizeBytes: 3,
          state: 'ready' as const,
          extractedText: '',
          failed: false,
        })),
      ),
    };
    const store = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      attachmentApi: api,
      limits: limits(3),
    });
    await store.getState().loadFileCount();
    expect(store.getState().conversationFiles).toBe(2);
    await store.getState().attach([file('x.png'), file('y.png')]);
    expect(order).toEqual([]);
    expect(store.getState().attachmentError).toBe('too_many_attachments');
  });

  it('refuses the whole batch when one file is not allowed', async () => {
    const order: string[] = [];
    const api: AttachmentApi = { upload: upload(order), list: vi.fn(async () => []) };
    const store = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      attachmentApi: api,
    });
    await store.getState().attach([file('a.png'), file('virus.exe')]);
    expect(order).toEqual([]);
    expect(store.getState().attachmentError).toBe('attachment_type_not_allowed');
  });

  it('stops at a refused upload and keeps the ones already in', async () => {
    let calls = 0;
    const api: AttachmentApi = {
      list: vi.fn(async () => []),
      upload: vi.fn(async (_c: string | null, f: PickedFile) => {
        calls += 1;
        if (calls === 2) return { ok: false as const, code: 'limit_conversation_tokens' };
        return {
          ok: true as const,
          conversationId: '9',
          attachment: {
            id: String(calls),
            name: f.name,
            kind: 'image' as const,
            sizeBytes: 3,
            state: 'ready' as const,
            extractedText: '',
            failed: false,
          },
        };
      }),
    };
    const store = createChatStore({
      conversationId: '9',
      messages: [],
      locale: 'ar',
      stream: () => events([]),
      attachmentApi: api,
    });
    await store.getState().attach([file('a.png'), file('b.png'), file('c.png')]);
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(store.getState().attachments.map((a) => a.name)).toEqual(['a.png']);
    expect(store.getState().attachmentError).toBe('limit_conversation_tokens');
  });
});
