import { z } from 'zod';
import type { KindUsage, UsageBreakdown } from '@/domain/entities/profile';
import type {
  ConversationUsage,
  TokenCount,
  UsageSnapshot,
  UsageState,
  UserPeriodUsage,
} from '@/domain/entities/usage';

/**
 * The usage blocks the API attaches to the answer stream, the message history, /users/me and
 * quota refusals. Parsed defensively: a counter that cannot be read must never break an answer,
 * so every mapper returns null instead of throwing.
 */

const nullableNumber = z.number().nullish();
const stateSchema = z.enum(['ok', 'warning', 'exhausted']);

const tokensSchema = z.looseObject({
  prompt: z.number(),
  completion: z.number(),
  total: z.number(),
});

const conversationSchema = z.looseObject({
  used: z.number(),
  limit: nullableNumber,
  remaining: nullableNumber,
  messages: z.number(),
  max_messages: nullableNumber,
  state: stateSchema,
  tokens_state: stateSchema.nullish(),
  messages_state: stateSchema.nullish(),
});

const userPeriodSchema = z.looseObject({
  used: z.number(),
  limit: nullableNumber,
  remaining: nullableNumber,
  period_start: z.string(),
  /** Null for a top-up-only period, which does not reset. */
  resets_at: z.string().nullish(),
  state: stateSchema,
  pages: z
    .looseObject({
      used: z.number(),
      limit: nullableNumber,
      remaining: nullableNumber,
      state: stateSchema,
    })
    .nullish(),
  billing: z.boolean().nullish(),
  plan: z.looseObject({ code: z.string(), name: z.string() }).nullish(),
  subscription: z.string().nullish(),
});

export function toTokenCount(raw: unknown): TokenCount | null {
  const parsed = tokensSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { prompt, completion, total } = parsed.data;
  return { prompt, completion, total };
}

export function toConversationUsage(raw: unknown): ConversationUsage | null {
  const parsed = conversationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  const state: UsageState = c.state;
  return {
    used: c.used,
    limit: c.limit ?? null,
    remaining: c.remaining ?? null,
    messages: c.messages,
    maxMessages: c.max_messages ?? null,
    state,
    tokensState: c.tokens_state ?? state,
    messagesState: c.messages_state ?? state,
  };
}

function toSubscriptionStatus(value: string | null | undefined) {
  const status = value?.toUpperCase();
  return status === 'TRIAL' || status === 'ACTIVE' || status === 'PAST_DUE' || status === 'CANCELED'
    ? status
    : null;
}

export function toUserPeriodUsage(raw: unknown): UserPeriodUsage | null {
  const parsed = userPeriodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const u = parsed.data;
  return {
    used: u.used,
    limit: u.limit ?? null,
    remaining: u.remaining ?? null,
    periodStart: u.period_start,
    resetsAt: u.resets_at ?? null,
    state: u.state,
    pages: u.pages
      ? {
          used: u.pages.used,
          limit: u.pages.limit ?? null,
          remaining: u.pages.remaining ?? null,
          state: u.pages.state,
        }
      : null,
    billing: u.billing ?? false,
    plan: u.plan ? { code: u.plan.code, name: u.plan.name } : null,
    subscription: toSubscriptionStatus(u.subscription),
  };
}

/** `{conversation, user}` as sent on a message page, in a refusal and (with `answer`) on `done`. */
export function toUsageSnapshot(raw: unknown): UsageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const conversation = toConversationUsage(record.conversation);
  const user = toUserPeriodUsage(record.user);
  return conversation || user ? { conversation, user } : null;
}

/** The `done` event's block: this answer's tokens plus where things stand now. */
export function toAnswerUsage(
  raw: unknown,
): { answer: TokenCount; snapshot: UsageSnapshot } | null {
  if (!raw || typeof raw !== 'object') return null;
  const answer = toTokenCount((raw as Record<string, unknown>).answer);
  const snapshot = toUsageSnapshot(raw);
  return answer && snapshot ? { answer, snapshot } : null;
}

const kindSchema = z.looseObject({
  prompt: z.number(),
  completion: z.number(),
  total: z.number(),
  calls: z.number(),
});

/** `usage` on GET /users/me: the month against the quota, all time, and this month by kind. */
export function toUsageBreakdown(raw: unknown): UsageBreakdown | null {
  const period = toUserPeriodUsage(raw);
  if (!period || !raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const thisPeriod = toTokenCount(record.this_period);
  const allTime = toTokenCount(record.all_time);
  if (!thisPeriod || !allTime) return null;

  const byKind: Record<string, KindUsage> = {};
  const kinds = record.by_kind;
  if (kinds && typeof kinds === 'object') {
    for (const [kind, value] of Object.entries(kinds)) {
      const parsed = kindSchema.safeParse(value);
      if (parsed.success) {
        const { prompt, completion, total, calls } = parsed.data;
        byKind[kind] = { prompt, completion, total, calls };
      }
    }
  }
  return { period, thisPeriod, allTime, byKind };
}
