import { describe, expect, it } from 'vitest';
import { citation, conversation, message } from '@/test-support/builders';
import { formatConversationAsText } from './conversation-export';
import { groupConversationsByRecency, recencyBucketOf } from './group-conversations-by-recency';

// 2026-10-15 13:00 in Cairo (UTC+3 in October)
const now = new Date('2026-10-15T10:00:00Z');

describe('recencyBucketOf', () => {
  it('buckets by Cairo calendar day', () => {
    expect(recencyBucketOf(new Date('2026-10-15T00:30:00Z'), now)).toBe('today');
    expect(recencyBucketOf(new Date('2026-10-14T12:00:00Z'), now)).toBe('yesterday');
    expect(recencyBucketOf(new Date('2026-10-12T12:00:00Z'), now)).toBe('last7days');
    expect(recencyBucketOf(new Date('2026-10-09T12:00:00Z'), now)).toBe('last7days');
    expect(recencyBucketOf(new Date('2026-10-08T12:00:00Z'), now)).toBe('older');
  });

  it('follows local midnight, not UTC midnight', () => {
    const justAfterCairoMidnight = new Date('2026-10-14T21:30:00Z'); // 00:30 on the 15th
    expect(recencyBucketOf(new Date('2026-10-14T20:30:00Z'), justAfterCairoMidnight)).toBe(
      'yesterday',
    );
    expect(recencyBucketOf(new Date('2026-10-14T21:10:00Z'), justAfterCairoMidnight)).toBe('today');
  });

  it('treats future dates as today', () => {
    expect(recencyBucketOf(new Date('2026-10-20T00:00:00Z'), now)).toBe('today');
  });

  it('honours an explicit time zone', () => {
    const date = new Date('2026-10-14T22:30:00Z');
    // 22:30Z on the 14th is already 01:30 on the 15th in Cairo, but still the 14th in UTC.
    expect(recencyBucketOf(date, now, 'UTC')).toBe('yesterday');
    expect(recencyBucketOf(date, now, 'Africa/Cairo')).toBe('today');
  });
});

describe('groupConversationsByRecency', () => {
  const at = (id: string, iso: string) => conversation({ id, updatedAt: new Date(iso) });

  it('groups, orders buckets and sorts newest first', () => {
    const groups = groupConversationsByRecency(
      [
        at('old', '2026-09-01T10:00:00Z'),
        at('week', '2026-10-11T10:00:00Z'),
        at('today-early', '2026-10-15T06:00:00Z'),
        at('yesterday', '2026-10-14T10:00:00Z'),
        at('today-late', '2026-10-15T09:00:00Z'),
      ],
      now,
    );
    expect(groups.map((g) => g.bucket)).toEqual(['today', 'yesterday', 'last7days', 'older']);
    expect(groups[0]?.items.map((c) => c.id)).toEqual(['today-late', 'today-early']);
  });

  it('omits empty buckets', () => {
    const groups = groupConversationsByRecency([at('a', '2026-10-15T09:00:00Z')], now);
    expect(groups.map((g) => g.bucket)).toEqual(['today']);
  });

  it('returns nothing for no conversations and does not mutate input', () => {
    expect(groupConversationsByRecency([], now)).toEqual([]);
    const input = [at('a', '2026-10-10T00:00:00Z'), at('b', '2026-10-15T00:00:00Z')];
    groupConversationsByRecency(input, now);
    expect(input.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('formatConversationAsText', () => {
  const convo = conversation({
    title: 'فسخ عقد',
    messages: [
      message({ id: 'q', role: 'user', content: 'ما الخيارات؟' }),
      message({
        id: 'a',
        role: 'assistant',
        content: 'التنفيذ أو الفسخ.',
        citations: [citation('157')],
      }),
    ],
  });

  it('writes Arabic labels and sources', () => {
    const text = formatConversationAsText(convo, 'ar');
    expect(text).toContain('فسخ عقد');
    expect(text).toContain('أنت:\nما الخيارات؟');
    expect(text).toContain('سندك:\nالتنفيذ أو الفسخ.');
    expect(text).toContain('المراجع:\n- القانون المدني, م. 157');
  });

  it('writes English labels', () => {
    const text = formatConversationAsText(convo, 'en');
    expect(text).toContain('You:\nما الخيارات؟');
    expect(text).toContain('Sanadak:');
    expect(text).toContain('Sources:\n- القانون المدني, Art. 157');
  });

  it('omits the sources block without citations', () => {
    const text = formatConversationAsText(conversation({ messages: [message()] }), 'en');
    expect(text).not.toContain('Sources');
  });
});
