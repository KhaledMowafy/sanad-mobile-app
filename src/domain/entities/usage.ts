/** Tokens spent. Completion includes the model's hidden reasoning. */
export interface TokenCount {
  readonly prompt: number;
  readonly completion: number;
  readonly total: number;
}

export type UsageState = 'ok' | 'warning' | 'exhausted';

/** One conversation against its limits. A null limit means there is none. */
export interface ConversationUsage {
  readonly used: number;
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly messages: number;
  readonly maxMessages: number | null;
  /** The worse of the token and question limits. */
  readonly state: UsageState;
  readonly tokensState: UsageState;
  readonly messagesState: UsageState;
}

/** The signed-in person's calendar month against their quota. */
/** Page reads (images and PDF pages) against the plan's page allowance. */
export interface PagesUsage {
  readonly used: number;
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly state: UsageState;
}

/** The signed-in person's current period against its allowance. With billing, the period is the plan's. */
export interface UserPeriodUsage {
  readonly used: number;
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly periodStart: string;
  /** Null for a top-up-only period, which does not reset. */
  readonly resetsAt: string | null;
  readonly state: UsageState;
  readonly pages: PagesUsage | null;
  /** These figures come from a billing plan. */
  readonly billing: boolean;
  readonly plan: { readonly code: string; readonly name: string } | null;
  readonly subscription: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | null;
}

/** What a conversation screen needs to draw its bars and decide whether Send is allowed. */
export interface UsageSnapshot {
  readonly conversation: ConversationUsage | null;
  readonly user: UserPeriodUsage | null;
}

export type UsageLimitName =
  | 'conversation_tokens'
  | 'conversation_messages'
  | 'monthly_tokens'
  /** With billing: the plan's tokens, plus top-ups, are spent. */
  | 'plan_tokens'
  /** With billing: no plan, trial or top-up tokens. */
  | 'no_plan'
  /** With billing: the period's page reads are spent. */
  | 'pages';

export function isUsageLimitName(value: unknown): value is UsageLimitName {
  return (
    value === 'conversation_tokens' ||
    value === 'conversation_messages' ||
    value === 'monthly_tokens' ||
    value === 'plan_tokens' ||
    value === 'no_plan' ||
    value === 'pages'
  );
}

/**
 * The limit that blocks the next request, or null. The month comes first: a new conversation
 * does not help with that one. A defence memo is checked against the month only, because the
 * conversation limits protect a chat the model is losing track of and a memo is built once from
 * the facts.
 */
export function blockingLimit(
  usage: UsageSnapshot | null,
  options: { readonly memo?: boolean } = {},
): UsageLimitName | null {
  const user = usage?.user;
  if (user?.state === 'exhausted') {
    if (!user.billing) return 'monthly_tokens';
    // With billing the cure is a plan or a top-up, not waiting for the calendar.
    return user.plan === null && user.subscription === null ? 'no_plan' : 'plan_tokens';
  }
  if (options.memo) return null;
  if (usage?.conversation?.tokensState === 'exhausted') return 'conversation_tokens';
  if (usage?.conversation?.messagesState === 'exhausted') return 'conversation_messages';
  return null;
}
