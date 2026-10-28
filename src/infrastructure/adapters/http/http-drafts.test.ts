import { describe, expect, it } from 'vitest';
import { CreateDraft, DownloadDraft, ListDrafts } from '@/application/use-cases/drafts';
import { ApiClient } from '@/infrastructure/http/api-client';
import { envelope, fakeFetch, json } from '@/test-support/http';
import { HttpConversationRepository } from './http-conversation-repository';
import { HttpDraftGateway } from './http-draft-gateway';
import { HttpLimitsGateway } from './http-limits-gateway';
import { HttpTemplateGateway } from './http-template-gateway';
import { ListTemplates, StartContractWizard } from '@/application/use-cases/templates';
import { parseReferences, toMessage } from './mappers';

const clientFor = (fetchImpl: typeof fetch) =>
  new ApiClient({
    baseUrl: 'http://api.test/api',
    timeoutMs: 1000,
    fetch: fetchImpl,
    tokens: { accessToken: async () => 'tok', refresh: async () => null },
  });

const rawDraft = (over: Record<string, unknown> = {}) => ({
  id: 31,
  conversation: 9,
  prompt: 'وقائع القضية',
  status: 'QUEUED',
  error: '',
  facts: null,
  created_at: '2026-10-15T10:00:00Z',
  finished_at: null,
  ...over,
});

describe('HttpDraftGateway', () => {
  it('asks for a memo as multipart with the chat files and no template', async () => {
    const { fetch, calls } = fakeFetch([json(202, envelope(rawDraft()))]);
    const gateway = new HttpDraftGateway(clientFor(fetch));
    const result = await gateway.create({
      conversationId: '9',
      prompt: 'وقائع القضية',
      attachmentIds: ['7', '8'],
    });

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url.pathname).toBe('/api/drafts');
    expect(calls[0]?.headers['Content-Type']).toBeUndefined();
    const form = calls[0]?.form;
    expect(form?.get('prompt')).toBe('وقائع القضية');
    expect(form?.get('conversation')).toBe('9');
    expect(form?.getAll('attachments')).toEqual(['7', '8']);
    expect(form?.has('template')).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { id: '31', status: 'queued' } });
  });

  it.each([
    ['QUEUED', 'queued'],
    ['READING', 'reading'],
    ['GENERATING', 'generating'],
    ['DONE', 'done'],
    ['FAILED', 'failed'],
    ['SOMETHING_NEW', 'generating'],
  ])('maps the status %s to %s', async (api, expected) => {
    const { fetch } = fakeFetch([json(200, envelope(rawDraft({ status: api })))]);
    const result = await new HttpDraftGateway(clientFor(fetch)).get('31');
    expect(result).toMatchObject({ ok: true, value: { status: expected } });
  });

  it('reads the memo, the warning inside facts, and the error', async () => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope(
          rawDraft({
            status: 'DONE',
            output: 'نص المذكرة [يُملأ: رقم الدعوى]',
            facts: { warning: 'مواد غير موثقة: 999', attachments: [] },
            finished_at: '2026-10-15T10:02:00Z',
          }),
        ),
      ),
    ]);
    const result = await new HttpDraftGateway(clientFor(fetch)).get('31');
    expect(result).toMatchObject({
      ok: true,
      value: {
        output: 'نص المذكرة [يُملأ: رقم الدعوى]',
        warning: 'مواد غير موثقة: 999',
        error: null,
      },
    });
  });

  it('lists the memos of one conversation from the paginated envelope', async () => {
    const { fetch, calls } = fakeFetch([
      json(200, envelope([rawDraft(), rawDraft({ id: 30 })], { next: null, previous: null })),
    ]);
    const result = await new ListDrafts(new HttpDraftGateway(clientFor(fetch))).execute('9');
    expect(calls[0]?.url.pathname).toBe('/api/drafts');
    expect(calls[0]?.url.searchParams.get('conversation')).toBe('9');
    expect(result.ok && result.value.map((d) => d.id)).toEqual(['31', '30']);
  });

  it('downloads the Word file with the token and keeps the bytes', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4]);
    const { fetch, calls } = fakeFetch([
      new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="draft-31.docx"',
        },
      }),
    ]);
    const result = await new DownloadDraft(new HttpDraftGateway(clientFor(fetch))).execute('31');
    expect(calls[0]?.url.pathname).toBe('/api/drafts/31/download');
    expect(calls[0]?.headers.Authorization).toBe('Bearer tok');
    expect(result).toMatchObject({ ok: true, value: { filename: 'draft-31.docx' } });
    expect(result.ok && Array.from(result.value.bytes)).toEqual([80, 75, 3, 4]);
  });

  it('says not found while the memo has no document yet', async () => {
    const { fetch } = fakeFetch([
      json(404, { status_code: 404, message: 'That draft has no document yet.', data: null }),
    ]);
    const result = await new DownloadDraft(new HttpDraftGateway(clientFor(fetch))).execute('31');
    expect(result).toEqual({ ok: false, error: { kind: 'not_found' } });
  });

  it('starts a conversation first, titled from what was typed, when there is none', async () => {
    const { fetch, calls } = fakeFetch([
      json(
        201,
        envelope({
          id: 9,
          title: 'وقائع القضية',
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        }),
      ),
      json(202, envelope(rawDraft())),
    ]);
    const client = clientFor(fetch);
    const result = await new CreateDraft(
      new HttpDraftGateway(client),
      new HttpConversationRepository(client),
    ).execute({ conversationId: null, prompt: 'وقائع القضية', attachmentIds: [] });

    expect(calls[0]?.url.pathname).toBe('/api/conversations');
    expect(calls[0]?.body).toEqual({ title: 'وقائع القضية' });
    expect(calls[1]?.form?.get('conversation')).toBe('9');
    expect(result).toMatchObject({ ok: true, value: { conversationId: '9' } });
  });

  it('refuses nothing to draft from before calling the backend', async () => {
    const { fetch, calls } = fakeFetch([]);
    const client = clientFor(fetch);
    const result = await new CreateDraft(
      new HttpDraftGateway(client),
      new HttpConversationRepository(client),
    ).execute({ conversationId: null, prompt: '  ', attachmentIds: [] });
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
    expect(calls).toHaveLength(0);
  });
});

describe('HttpLimitsGateway', () => {
  it('reads the numbers the server states', async () => {
    const { fetch } = fakeFetch([
      json(
        200,
        envelope({
          conversation_tokens: 200000,
          conversation_messages: 40,
          monthly_tokens: null,
          warn_at: 0.8,
          question_max_chars: 8000,
          attachments: {
            per_conversation: 10,
            per_draft: 10,
            max_bytes: 10485760,
            pages_read: 10,
            suffixes: ['.pdf', '.png'],
          },
        }),
      ),
    ]);
    const result = await new HttpLimitsGateway(clientFor(fetch)).get();
    expect(result).toEqual({
      ok: true,
      value: {
        conversationTokens: 200000,
        conversationMessages: 40,
        monthlyTokens: null,
        warnAt: 0.8,
        questionMaxChars: 8000,
        attachments: {
          perConversation: 10,
          perDraft: 10,
          maxBytes: 10485760,
          pagesRead: 10,
          suffixes: ['.pdf', '.png'],
        },
      },
    });
  });
});

describe('library references and usage on messages', () => {
  const entries = [
    {
      source: 'corpus',
      lawName: 'القانون المدني',
      articleNumber: 147,
      isBis: false,
      status: 'ACTIVE',
    },
    {
      source: 'library',
      used: true,
      kind: 'CASSATION',
      authority: 30,
      label: 'الطعن رقم 12 لسنة 80 ق',
      title: 'مجموعة النقض',
      author: '',
      page: 3,
      appealNumber: 12,
      appealYear: 80,
      citable: true,
    },
    {
      source: 'library',
      used: false,
      kind: 'COMMENTARY',
      authority: 20,
      label: 'السنهوري',
      title: 'الوسيط',
      author: 'السنهوري',
      page: 9,
    },
  ];

  it('tells statute articles from library entries by source', () => {
    const references = parseReferences(entries, '5');
    expect(references.map((r) => [r.used, r.kind, r.authority])).toEqual([
      [true, 'CASSATION', 30],
      [false, 'COMMENTARY', 20],
    ]);
    expect(references[0]).toMatchObject({ appealNumber: 12, appealYear: 80, citable: true });
  });

  it('treats an old message without source as a statute and reads its usage', () => {
    const message = toMessage({
      id: 5,
      role: 'assistant',
      content: 'نص',
      citations: JSON.stringify([...entries, { lawName: 'قانون العقوبات', articleNumber: 10 }]),
      created_at: '2026-10-15T10:00:00Z',
      usage: { prompt: 5, completion: 7, total: 12 },
    });
    expect(message?.citations.map((c) => c.reference.article)).toEqual(['147', '10']);
    expect(message?.references).toHaveLength(2);
    expect(message?.usage).toEqual({ prompt: 5, completion: 7, total: 12 });
  });

  it('has no usage on a question', () => {
    const message = toMessage({
      id: 4,
      role: 'user',
      content: 'سؤال',
      created_at: '2026-10-15T10:00:00Z',
      usage: null,
    });
    expect(message?.usage).toBeNull();
    expect(message?.references).toEqual([]);
  });

  it('carries the usage of the newest message page onto the conversation', async () => {
    const block = {
      conversation: {
        used: 500,
        limit: 1000,
        remaining: 500,
        messages: 2,
        max_messages: 10,
        state: 'warning',
        tokens_state: 'warning',
        messages_state: 'ok',
      },
      user: {
        used: 500,
        limit: 9000,
        remaining: 8500,
        period_start: '2026-10-01T00:00:00+03:00',
        resets_at: '2026-11-01T00:00:00+03:00',
        state: 'ok',
      },
    };
    const { fetch } = fakeFetch((call) =>
      call.url.pathname.endsWith('/messages')
        ? json(200, envelope({ messages: [], next_cursor: null, has_more: false, usage: block }))
        : json(
            200,
            envelope({
              id: 9,
              title: 'محادثة',
              created_at: '2026-10-15T10:00:00Z',
              updated_at: '2026-10-15T10:00:00Z',
            }),
          ),
    );
    const result = await new HttpConversationRepository(clientFor(fetch)).get('9');
    expect(result.ok && result.value.usage).toMatchObject({
      conversation: { used: 500, state: 'warning', tokensState: 'warning', maxMessages: 10 },
      user: { limit: 9000, resetsAt: '2026-11-01T00:00:00+03:00' },
    });
  });
});

describe('templates and contracts', () => {
  const rawTemplate = (code: string, category: string, over: Record<string, unknown> = {}) => ({
    id: Math.abs(code.length * 7),
    code,
    name: `اسم ${code}`,
    description: '',
    category,
    is_active: true,
    ...over,
  });

  it('lists every page of active templates and groups them for the cards', async () => {
    const { fetch, calls } = fakeFetch([
      json(
        200,
        envelope(
          [rawTemplate('rental_contract', 'CONTRACT'), rawTemplate('defense_memo', 'PLEADING')],
          {
            next: 'http://api.test/api/templates?page=2',
            previous: null,
          },
        ),
      ),
      json(
        200,
        envelope(
          [
            rawTemplate('bail_reduction_request', 'PETITION'),
            rawTemplate('old_notice', 'NOTICE', { is_active: false }),
            rawTemplate('no_appeal_certificate', 'WHATEVER'),
          ],
          { next: null, previous: null },
        ),
      ),
    ]);
    const useCase = new ListTemplates(new HttpTemplateGateway(clientFor(fetch)));
    const contracts = await useCase.execute('contract');
    expect(calls[1]?.url.searchParams.get('page')).toBe('2');
    expect(contracts.ok && contracts.value.map((t) => t.code)).toEqual(['rental_contract']);

    const { fetch: again } = fakeFetch([
      json(
        200,
        envelope(
          [rawTemplate('rental_contract', 'CONTRACT'), rawTemplate('defense_memo', 'PLEADING')],
          { next: 'http://api.test/api/templates?page=2', previous: null },
        ),
      ),
      json(
        200,
        envelope(
          [
            rawTemplate('bail_reduction_request', 'PETITION'),
            rawTemplate('old_notice', 'NOTICE', { is_active: false }),
            rawTemplate('no_appeal_certificate', 'WHATEVER'),
          ],
          { next: null, previous: null },
        ),
      ),
    ]);
    const paperwork = await new ListTemplates(new HttpTemplateGateway(clientFor(again))).execute(
      'paperwork',
    );
    // The memo has its own card, an inactive template is hidden, an unknown category is paperwork.
    expect(paperwork.ok && paperwork.value.map((t) => t.code)).toEqual([
      'bail_reduction_request',
      'no_appeal_certificate',
    ]);
  });

  it('asks for a catalogue document with its code and no memo flag', async () => {
    const { fetch, calls } = fakeFetch([
      json(
        202,
        envelope(
          rawDraft({ template_code: 'bail_reduction_request', template_name: 'طلب تخفيض كفالة' }),
        ),
      ),
    ]);
    const result = await new HttpDraftGateway(clientFor(fetch)).create({
      conversationId: '9',
      prompt: 'بيانات',
      attachmentIds: [],
      templateCode: 'bail_reduction_request',
    });
    expect(calls[0]?.form?.get('template')).toBe('bail_reduction_request');
    expect(result).toMatchObject({
      ok: true,
      value: { templateCode: 'bail_reduction_request', templateName: 'طلب تخفيض كفالة' },
    });
  });

  it('starts the wizard on a new conversation and returns the first question', async () => {
    const { fetch, calls } = fakeFetch([
      json(
        201,
        envelope({
          id: 12,
          title: 'عقد إيجار',
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        }),
      ),
      json(
        201,
        envelope({
          session_id: 3,
          message: {
            id: 77,
            conversation: 12,
            role: 'assistant',
            content: 'من فضلك أدخل اسم المؤجر.',
            citations: null,
            warning: '',
            usage: null,
            created_at: '2026-10-15T10:00:01Z',
          },
        }),
      ),
    ]);
    const client = clientFor(fetch);
    const result = await new StartContractWizard(
      new HttpDraftGateway(client),
      new HttpConversationRepository(client),
    ).execute({ conversationId: null, templateCode: 'rental_contract', title: 'عقد إيجار' });

    expect(calls[0]?.body).toEqual({ title: 'عقد إيجار' });
    expect(calls[1]?.url.pathname).toBe('/api/drafts/contract-wizard');
    expect(calls[1]?.body).toEqual({ conversation: 12, template: 'rental_contract' });
    expect(result).toMatchObject({
      ok: true,
      value: { conversationId: '12', message: { id: '77', content: 'من فضلك أدخل اسم المؤجر.' } },
    });
  });
});
