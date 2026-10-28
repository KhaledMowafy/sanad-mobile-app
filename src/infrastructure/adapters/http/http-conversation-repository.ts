import type { AppError } from '@/application/errors';
import type { ConversationRepository } from '@/application/ports/repositories';
import { ok, type Result } from '@/application/result';
import type { Conversation } from '@/domain/entities/conversation';
import type { Message } from '@/domain/entities/message';
import type { ConversationTitle } from '@/domain/value-objects/conversation-title';
import type { UsageSnapshot } from '@/domain/entities/usage';
import type { ApiClient } from '@/infrastructure/http/api-client';
import { toUsageSnapshot } from '@/infrastructure/http/usage-mappers';
import {
  anySchema,
  apiConversationSchema,
  apiMessagesPageSchema,
} from '@/infrastructure/http/api-schemas';
import { toConversationSummary, toMessage } from './mappers';

/** Pages fetched for the sidebar history before stopping. */
const MAX_LIST_PAGES = 3;
/** Message pages per conversation; the API caps a page at 100. */
const MAX_MESSAGE_PAGES = 5;
const MESSAGE_PAGE_SIZE = 100;

/** "next" is an absolute URL on the backend's own host; only its path and query are reused. */
function localPathOf(next: string): { path: string; query: Record<string, string> } | null {
  try {
    const url = new URL(next);
    const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
    return { path, query: Object.fromEntries(url.searchParams) };
  } catch {
    return null;
  }
}

function byCreatedAt(a: Message, b: Message): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || Number(a.id) - Number(b.id);
}

export class HttpConversationRepository implements ConversationRepository {
  constructor(private readonly client: ApiClient) {}

  async list(): Promise<Result<readonly Conversation[], AppError>> {
    const all: Conversation[] = [];
    let path = '/conversations';
    let query: Record<string, string> = {};

    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const result = await this.client.requestPage({
        path,
        query,
        schema: apiConversationSchema,
      });
      if (!result.ok) return result;
      all.push(...result.value.items.map(toConversationSummary));

      const next = result.value.next ? localPathOf(result.value.next) : null;
      if (!next) break;
      ({ path, query } = next);
    }
    return ok(all);
  }

  async get(id: string): Promise<Result<Conversation, AppError>> {
    const encoded = encodeURIComponent(id);
    const summary = await this.client.request({
      path: `/conversations/${encoded}`,
      schema: apiConversationSchema,
    });
    if (!summary.ok) return summary;

    const messages: Message[] = [];
    let usage: UsageSnapshot | undefined;
    let cursor: string | undefined;
    for (let page = 0; page < MAX_MESSAGE_PAGES; page++) {
      const result = await this.client.request({
        path: `/conversations/${encoded}/messages`,
        query: { limit: MESSAGE_PAGE_SIZE, cursor },
        schema: apiMessagesPageSchema,
      });
      if (!result.ok) return result;

      // The first page is the newest, so its usage is where the conversation stands now.
      if (page === 0) usage = toUsageSnapshot(result.value.usage) ?? undefined;
      for (const raw of result.value.messages) {
        const message = toMessage(raw);
        if (message) messages.push(message);
      }
      if (!result.value.has_more || !result.value.next_cursor) break;
      cursor = result.value.next_cursor;
    }

    return ok({
      ...toConversationSummary(summary.value),
      messages: messages.sort(byCreatedAt),
      usage,
    });
  }

  async search(query: string): Promise<Result<readonly Conversation[], AppError>> {
    // The API has no conversation search (POST /search queries the legal corpus), so filter locally.
    const all = await this.list();
    if (!all.ok) return all;
    const needle = query.toLocaleLowerCase();
    return ok(all.value.filter((c) => c.title.toLocaleLowerCase().includes(needle)));
  }

  async rename(id: string, title: ConversationTitle): Promise<Result<void, AppError>> {
    const result = await this.client.request({
      method: 'PATCH',
      path: `/conversations/${encodeURIComponent(id)}`,
      body: { title: title.value },
      schema: anySchema,
    });
    return result.ok ? ok(undefined) : result;
  }

  async create(title: ConversationTitle | null): Promise<Result<Conversation, AppError>> {
    const result = await this.client.request({
      method: 'POST',
      path: '/conversations',
      // Omitted on purpose when there is none: the first question becomes the title.
      body: title ? { title: title.value } : {},
      schema: apiConversationSchema,
    });
    return result.ok ? ok(toConversationSummary(result.value)) : result;
  }

  async remove(id: string): Promise<Result<void, AppError>> {
    const result = await this.client.request({
      method: 'DELETE',
      path: `/conversations/${encodeURIComponent(id)}`,
      schema: anySchema,
    });
    return result.ok ? ok(undefined) : result;
  }
}
