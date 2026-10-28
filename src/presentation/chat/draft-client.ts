import type { DraftDto, UsageSnapshotDto } from '@/application/dto/dto';
import { problemOf, loadUseCases } from './backend';

export type CreateDraftOutcome =
  | { ok: true; conversationId: string; draft: DraftDto }
  | { ok: false; code: string; usage?: UsageSnapshotDto | null | undefined };

/** Defence memos and catalogue documents, built in the background. */
export interface DraftApi {
  create(input: {
    conversationId: string | null;
    prompt: string;
    attachmentIds: readonly string[];
    /** A template's code. Omit it for a defence memo. */
    templateCode?: string | undefined;
  }): Promise<CreateDraftOutcome>;
  /** One document with its text once done, or null when it could not be read. */
  get(id: string): Promise<DraftDto | null>;
  /** The documents asked from a conversation, or null when they could not be read. */
  list(conversationId: string): Promise<DraftDto[] | null>;
}

export const draftApi: DraftApi = {
  async create(input) {
    const result = await (await loadUseCases()).createDraft.execute(input);
    return result.ok ? { ok: true, ...result.value } : { ok: false, ...problemOf(result.error) };
  },

  async get(id) {
    const result = await (await loadUseCases()).getDraft.execute(id);
    return result.ok ? result.value : null;
  },

  async list(conversationId) {
    const result = await (await loadUseCases()).listDrafts.execute(conversationId);
    return result.ok ? result.value : null;
  },
};
