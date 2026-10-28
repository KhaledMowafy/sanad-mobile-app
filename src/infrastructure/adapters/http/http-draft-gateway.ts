import { z } from 'zod';
import type { AppError } from '@/application/errors';
import type { DraftDownload, DraftGateway } from '@/application/ports/drafts';
import { ok, type Result } from '@/application/result';
import type { Draft, DraftStatus } from '@/domain/entities/draft';
import type { Message } from '@/domain/entities/message';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { apiMessageSchema } from '@/infrastructure/http/api-schemas';
import { toMessage } from './mappers';

const apiDraftSchema = z.looseObject({
  id: z.number(),
  conversation: z.number().nullish(),
  template_code: z.string().nullish(),
  template_name: z.string().nullish(),
  prompt: z.string().nullish(),
  status: z.string(),
  error: z.string().nullish(),
  /** `warning` lives in here: unverified article numbers, or "could not be written". */
  facts: z.unknown().optional(),
  /** Only the detail view carries it. */
  output: z.string().nullish(),
  created_at: z.string(),
  finished_at: z.string().nullish(),
});
type ApiDraft = z.infer<typeof apiDraftSchema>;

const wizardStartSchema = z.looseObject({
  session_id: z.number(),
  message: apiMessageSchema,
});

const STATUSES: Record<string, DraftStatus> = {
  QUEUED: 'queued',
  READING: 'reading',
  GENERATING: 'generating',
  DONE: 'done',
  FAILED: 'failed',
};

function warningOf(facts: unknown): string | null {
  if (!facts || typeof facts !== 'object') return null;
  const warning = (facts as Record<string, unknown>).warning;
  return typeof warning === 'string' && warning.trim() ? warning.trim() : null;
}

export function toDraft(api: ApiDraft): Draft {
  return {
    id: String(api.id),
    conversationId: api.conversation == null ? null : String(api.conversation),
    templateCode: api.template_code?.trim() || null,
    templateName: api.template_name?.trim() || null,
    prompt: api.prompt ?? '',
    // An unknown status is treated as still working: the card keeps polling, never wrongly done.
    status: STATUSES[api.status.toUpperCase()] ?? 'generating',
    error: api.error?.trim() || null,
    warning: warningOf(api.facts),
    output: api.output?.trim() ? api.output : null,
    createdAt: new Date(api.created_at),
    finishedAt: api.finished_at ? new Date(api.finished_at) : null,
  };
}

export class HttpDraftGateway implements DraftGateway {
  constructor(private readonly client: ApiClient) {}

  async create(input: {
    conversationId: string;
    prompt: string;
    attachmentIds: readonly string[];
    templateCode?: string | undefined;
  }): Promise<Result<Draft, AppError>> {
    const form = new FormData();
    // No "template" is what makes it a defence memo rather than a template draft.
    if (input.templateCode) form.append('template', input.templateCode);
    if (input.prompt) form.append('prompt', input.prompt);
    form.append('conversation', input.conversationId);
    for (const id of input.attachmentIds) form.append('attachments', id);

    const result = await this.client.request({
      method: 'POST',
      path: '/drafts',
      body: form,
      schema: apiDraftSchema,
    });
    return result.ok ? ok(toDraft(result.value)) : result;
  }

  async startContract(input: {
    conversationId: string;
    templateCode: string;
  }): Promise<Result<Message, AppError>> {
    const result = await this.client.request({
      method: 'POST',
      path: '/drafts/contract-wizard',
      body: { conversation: Number(input.conversationId), template: input.templateCode },
      schema: wizardStartSchema,
    });
    if (!result.ok) return result;
    const message = toMessage(result.value.message);
    return message
      ? ok(message)
      : { ok: false, error: { kind: 'unknown', message: 'No first question' } };
  }

  async get(id: string): Promise<Result<Draft, AppError>> {
    const result = await this.client.request({
      path: `/drafts/${encodeURIComponent(id)}`,
      schema: apiDraftSchema,
    });
    return result.ok ? ok(toDraft(result.value)) : result;
  }

  async list(conversationId: string): Promise<Result<readonly Draft[], AppError>> {
    const result = await this.client.requestPage({
      path: '/drafts',
      query: { conversation: conversationId },
      schema: apiDraftSchema,
    });
    return result.ok ? ok(result.value.items.map(toDraft)) : result;
  }

  async download(id: string): Promise<Result<DraftDownload, AppError>> {
    const result = await this.client.requestBinary({
      path: `/drafts/${encodeURIComponent(id)}/download`,
    });
    if (!result.ok) return result;
    return ok({
      bytes: result.value.bytes,
      contentType: result.value.contentType,
      filename: result.value.filename ?? `memo-${id}.docx`,
    });
  }
}
