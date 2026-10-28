import type { Conversation } from '../entities/conversation';

export type RecencyBucket = 'today' | 'yesterday' | 'last7days' | 'older';

export interface RecencyGroup<T> {
  readonly bucket: RecencyBucket;
  readonly items: readonly T[];
}

export const DEFAULT_TIME_ZONE = 'Africa/Cairo';

const BUCKET_ORDER: readonly RecencyBucket[] = ['today', 'yesterday', 'last7days', 'older'];

/** Calendar day number in the given zone, so "today" follows the user's wall clock. */
function dayNumber(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.floor(Date.UTC(pick('year'), pick('month') - 1, pick('day')) / 86_400_000);
}

export function recencyBucketOf(
  date: Date,
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): RecencyBucket {
  const age = dayNumber(now, timeZone) - dayNumber(date, timeZone);
  if (age <= 0) return 'today';
  if (age === 1) return 'yesterday';
  if (age < 7) return 'last7days';
  return 'older';
}

/**
 * Newest first inside each bucket. Empty buckets are omitted.
 * Takes "now" as a value so it is pure and testable.
 */
export function groupConversationsByRecency(
  conversations: readonly Conversation[],
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): RecencyGroup<Conversation>[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const buckets = new Map<RecencyBucket, Conversation[]>();
  for (const conversation of sorted) {
    const bucket = recencyBucketOf(conversation.updatedAt, now, timeZone);
    const list = buckets.get(bucket) ?? [];
    list.push(conversation);
    buckets.set(bucket, list);
  }
  return BUCKET_ORDER.flatMap((bucket) => {
    const items = buckets.get(bucket);
    return items ? [{ bucket, items }] : [];
  });
}
