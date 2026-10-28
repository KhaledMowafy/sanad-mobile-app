import type { ChatAttachment } from '@/domain/entities/chat-attachment';
import type { Citation } from '@/domain/entities/citation';
import type { LibraryReference } from '@/domain/entities/library-reference';
import type { AccountProfile } from '@/domain/entities/profile';
import type { Conversation } from '@/domain/entities/conversation';
import type { ArticleStatus, LegalArticle } from '@/domain/entities/legal-article';
import type { Message } from '@/domain/entities/message';
import type { User } from '@/domain/entities/user';
import { ArticleReference } from '@/domain/value-objects/article-reference';
import type {
  ApiArticle,
  ApiAttachment,
  ApiConversation,
  ApiMessage,
  ApiUser,
} from '@/infrastructure/http/api-schemas';
import {
  toTokenCount,
  toUsageBreakdown,
  toUserPeriodUsage,
} from '@/infrastructure/http/usage-mappers';

export function toUser(api: ApiUser): User {
  const name = [api.first_name, api.last_name]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
  return {
    id: String(api.id),
    name: name || api.email,
    email: api.email,
    // The API stores no phone, account kind, bar number or title for a user.
    phone: null,
    // TODO: confirm. /users/me has only "role"; its values other than SUPERUSER are unknown.
    accountKind: 'lawyer',
    barRegistrationNumber: null,
    professionalTitle: null,
    usage: toUserPeriodUsage(api.usage) ?? undefined,
  };
}

const optionalDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** GET /users/me as the profile page shows it: the account, and what it has spent. */
export function toProfile(api: ApiUser): AccountProfile {
  return {
    user: toUser(api),
    role: api.role?.trim() || null,
    provider: api.provider?.trim() || null,
    isVerified: api.is_verified ?? null,
    isActive: api.is_active ?? null,
    createdAt: optionalDate(api.created_at),
    lastLogin: optionalDate(api.last_login),
    usage: toUsageBreakdown(api.usage),
  };
}

/** The list and detail endpoints return a summary. Messages come from /conversations/<id>/messages. */
export function toConversationSummary(api: ApiConversation): Conversation {
  return {
    id: String(api.id),
    title: api.title?.trim() || String(api.id),
    messages: [],
    createdAt: new Date(api.created_at),
    updatedAt: new Date(api.updated_at),
  };
}

/**
 * Backend article statuses seen so far: "DRAFT". The other values are not documented yet, so
 * this errs towards what the record itself says: superseded or expired text is not "in force".
 */
export function toArticleStatus(
  api: Pick<ApiArticle, 'status' | 'superseded_by' | 'valid_to'>,
  now = new Date(),
): ArticleStatus {
  const status = api.status.toUpperCase();
  if (['REPEALED', 'ABROGATED', 'WITHDRAWN', 'EXPIRED'].includes(status)) return 'repealed';
  if (api.valid_to && new Date(api.valid_to) < now) return 'repealed';
  if (['SUPERSEDED', 'AMENDED'].includes(status) || api.superseded_by) return 'amended';
  return 'in_force';
}

export function articleLabel(api: Pick<ApiArticle, 'number' | 'is_bis' | 'bis_label'>): string {
  const suffix = api.is_bis ? ` ${api.bis_label?.trim() || 'مكرر'}` : '';
  return `${api.number}${suffix}`;
}

export function toLegalArticle(api: ApiArticle, now = new Date()): LegalArticle {
  return {
    // The API knows the law by name only, so number and year stay unknown.
    reference: ArticleReference.create(
      { name: api.law_name, number: null, year: null },
      articleLabel(api),
    ),
    text: (api.text_clean?.trim() || api.text_ocr?.trim() || '').trim(),
    status: toArticleStatus(api, now),
    bookLabel: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  const raw = firstString(record, keys);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Citation objects on messages and in the "done" event. Confirmed shape:
 * {isBis, status: "ACTIVE", lawName, articleNumber}. The snake_case keys used by reference
 * passages (article_number, law_number, law_year, law_name) are accepted too.
 * Anything unrecognised is dropped, never invented.
 */
export function parseCitations(raw: unknown, messageId: string): Citation[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const citations: Citation[] = [];
  value.forEach((entry, index) => {
    const record = asRecord(entry);
    // Library entries (rulings and books) have their own parser; old messages have no `source`.
    if (!record || record.source === 'library') return;
    const number = firstString(record, ['articleNumber', 'article_number', 'article', 'number']);
    if (!number) return;
    const isBis = record.isBis === true || record.is_bis === true;
    const article = isBis
      ? `${number} ${firstString(record, ['bisLabel', 'bis_label']) ?? 'مكرر'}`
      : number;

    const lawNumber = firstNumber(record, ['lawNumber', 'law_number']);
    const lawYear = firstNumber(record, ['lawYear', 'law_year']);
    const lawName =
      firstString(record, ['lawName', 'law_name', 'law', 'title']) ??
      (lawNumber !== null
        ? `قانون رقم ${lawNumber}${lawYear !== null ? ` لسنة ${lawYear}` : ''}`
        : null);
    if (!lawName) return;

    const status = firstString(record, ['status']);
    citations.push({
      id: firstString(record, ['id']) ?? `${messageId}-${index}`,
      reference: ArticleReference.create(
        { name: lawName, number: lawNumber, year: lawYear },
        article,
      ),
      status: toArticleStatus({ status: status ?? 'ACTIVE', superseded_by: null, valid_to: null }),
      text: firstString(record, ['text', 'text_clean']),
      bookLabel: null,
    });
  });
  return citations;
}

function parseJsonArray(raw: unknown): unknown[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

/**
 * The rulings and books in `citations`: entries with source "library". `used: false` means
 * related but not relied on. Anything unrecognised is dropped, never invented.
 */
export function parseReferences(raw: unknown, messageId: string): LibraryReference[] {
  const references: LibraryReference[] = [];
  parseJsonArray(raw).forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record || record.source !== 'library') return;
    const label = firstString(record, ['label']) ?? firstString(record, ['title']);
    if (!label) return;
    const title = firstString(record, ['title']) ?? label;
    const page = firstNumber(record, ['page']);
    references.push({
      id: `${messageId}-ref-${index}`,
      used: record.used !== false,
      kind: (firstString(record, ['kind']) ?? 'OTHER').toUpperCase(),
      authority: firstNumber(record, ['authority']) ?? 10,
      label,
      title,
      author: firstString(record, ['author']) ?? '',
      page,
      appealNumber: firstNumber(record, ['appealNumber', 'appeal_number']),
      appealYear: firstNumber(record, ['appealYear', 'appeal_year']),
      citable: typeof record.citable === 'boolean' ? record.citable : null,
    });
  });
  return references;
}

const ATTACHMENT_STATES = {
  QUEUED: 'queued',
  READING: 'reading',
  READY: 'ready',
  FAILED: 'failed',
} as const;

export function toChatAttachment(api: ApiAttachment): ChatAttachment {
  const state = ATTACHMENT_STATES[api.state.toUpperCase() as keyof typeof ATTACHMENT_STATES];
  const kind = api.kind.toLowerCase();
  return {
    id: String(api.id),
    name: api.filename,
    kind:
      kind === 'image' || kind === 'pdf' || kind === 'text'
        ? kind
        : kind === 'docx'
          ? 'word'
          : 'text',
    sizeBytes: api.size_bytes ?? 0,
    // An unrecognised state is treated as still reading: sending is blocked, never wrong.
    state: state ?? 'reading',
    extractedText: api.extracted_text ?? '',
    failed: (state ?? 'reading') === 'failed',
  };
}

export function toMessage(api: ApiMessage): Message | null {
  // The API stores lowercase roles but documents uppercase, so accept either.
  const role = api.role.toLowerCase();
  if (role !== 'user' && role !== 'assistant') return null;
  const id = String(api.id);
  return {
    id,
    role,
    content: api.content ?? '',
    citations: role === 'assistant' ? parseCitations(api.citations, id) : [],
    references: role === 'assistant' ? parseReferences(api.citations, id) : [],
    attachments: [],
    status: 'complete',
    errorCode: null,
    createdAt: new Date(api.created_at),
    feedback: null,
    warning: api.warning?.trim() || null,
    usage: role === 'assistant' ? toTokenCount(api.usage) : null,
  };
}
