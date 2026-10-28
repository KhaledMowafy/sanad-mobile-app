import { describe, expect, it } from 'vitest';
import { conversation, citation, message, user } from '@/test-support/builders';
import { EmptyMessageError, InvalidAttachmentError } from '../errors/domain-error';
import {
  assertAttachmentAllowed,
  attachmentKindOf,
  byNaturalName,
  MAX_ATTACHMENT_BYTES,
  pastedTextName,
  pastedTextNumber,
} from './attachment';
import { isReading, isSettled } from './chat-attachment';
import {
  appendMessage,
  renameConversation,
  replaceMessage,
  userMessageBefore,
} from './conversation';
import {
  addCitation,
  appendToken,
  completeMessage,
  createUserMessage,
  failMessage,
  isInFlight,
  startAssistantMessage,
  stopMessage,
  withFeedback,
} from './message';
import { avatarInitial, firstName } from './user';

describe('attachments', () => {
  const ok = { name: 'عقد.pdf', sizeBytes: 1024 };

  it.each([
    'عقد.pdf',
    'محضر.JPG',
    'scan.jpeg',
    'photo.PNG',
    'page.webp',
    'a.tif',
    'a.tiff',
    'a.bmp',
    'مذكرة.docx',
    'نموذج.dotx',
    'ملاحظات.txt',
    'readme.md',
    'data.csv',
  ])('accepts %s', (name) => {
    expect(() => assertAttachmentAllowed({ name, sizeBytes: 10 })).not.toThrow();
    expect(attachmentKindOf(name)).not.toBeNull();
  });

  it.each(['legacy.doc', 'archive.zip', 'run.exe', 'noextension', 'a.pdf.exe'])(
    'rejects %s',
    (name) => {
      expect(() => assertAttachmentAllowed({ name, sizeBytes: 10 })).toThrowError(
        expect.objectContaining({ code: 'attachment_type_not_allowed' }),
      );
    },
  );

  it('rejects empty and oversized files', () => {
    expect(() => assertAttachmentAllowed({ ...ok, sizeBytes: 0 })).toThrowError(
      expect.objectContaining({ code: 'attachment_empty' }),
    );
    expect(() =>
      assertAttachmentAllowed({ ...ok, sizeBytes: MAX_ATTACHMENT_BYTES + 1 }),
    ).toThrowError(expect.objectContaining({ code: 'attachment_too_large' }));
    expect(() => assertAttachmentAllowed({ ...ok, sizeBytes: MAX_ATTACHMENT_BYTES })).not.toThrow();
    expect(() => assertAttachmentAllowed({ ...ok, sizeBytes: 0 })).toThrow(InvalidAttachmentError);
  });

  it('groups files by the kind the reader uses', () => {
    expect(attachmentKindOf('a.png')).toBe('image');
    expect(attachmentKindOf('a.pdf')).toBe('pdf');
    expect(attachmentKindOf('a.docx')).toBe('word');
    expect(attachmentKindOf('a.txt')).toBe('text');
  });
});

describe('chat attachments', () => {
  const base = {
    id: '1',
    name: 'a.png',
    kind: 'image' as const,
    sizeBytes: 5,
    extractedText: '',
    failed: false,
  };

  it('treats queued and reading as still being read', () => {
    expect(isReading({ ...base, state: 'queued' })).toBe(true);
    expect(isReading({ ...base, state: 'reading' })).toBe(true);
    expect(isReading({ ...base, state: 'ready' })).toBe(false);
  });

  it('lets a failed read through, as the backend does', () => {
    expect(isSettled({ state: 'failed' })).toBe(true);
    expect(isSettled({ ...base, state: 'reading' })).toBe(false);
  });
});

describe('message', () => {
  const createdAt = new Date('2026-10-15T10:00:00Z');

  it('creates a trimmed user message', () => {
    const m = createUserMessage({ id: 'u', content: '  سؤال  ', attachments: [], createdAt });
    expect(m.content).toBe('سؤال');
    expect(m.role).toBe('user');
    expect(m.status).toBe('complete');
  });

  it('rejects an empty user message', () => {
    expect(() => createUserMessage({ id: 'u', content: '  ', attachments: [], createdAt })).toThrow(
      EmptyMessageError,
    );
  });

  it('streams tokens and citations into an assistant message', () => {
    let m = startAssistantMessage({ id: 'a', createdAt });
    expect(isInFlight(m)).toBe(true);
    m = appendToken(appendToken(m, 'الأصل '), 'أن');
    m = addCitation(m, citation('157'));
    m = addCitation(m, citation('157', { id: 'dup' }));
    m = addCitation(m, citation('158'));
    expect(m.content).toBe('الأصل أن');
    expect(m.citations.map((c) => c.reference.article)).toEqual(['157', '158']);
  });

  it('transitions status', () => {
    const base = startAssistantMessage({ id: 'a', createdAt });
    expect(completeMessage(failMessage(base, 'x')).errorCode).toBeNull();
    expect(stopMessage(base).status).toBe('stopped');
    expect(isInFlight(stopMessage(base))).toBe(false);
    const failed = failMessage(base, 'stream_failed');
    expect(failed.status).toBe('error');
    expect(failed.errorCode).toBe('stream_failed');
  });

  it('records feedback without mutating', () => {
    const base = message({ role: 'assistant' });
    const rated = withFeedback(base, 'up');
    expect(rated.feedback).toBe('up');
    expect(base.feedback).toBeNull();
  });
});

describe('conversation', () => {
  const q1 = message({ id: 'q1', role: 'user' });
  const a1 = message({ id: 'a1', role: 'assistant' });
  const q2 = message({ id: 'q2', role: 'user' });
  const a2 = message({ id: 'a2', role: 'assistant' });
  const convo = conversation({ messages: [q1, a1, q2, a2] });

  it('renames', () => {
    expect(renameConversation(convo, 'جديد').title).toBe('جديد');
  });

  it('appends and bumps updatedAt', () => {
    const now = new Date('2026-10-16T00:00:00Z');
    const next = appendMessage(convo, message({ id: 'q3' }), now);
    expect(next.messages).toHaveLength(5);
    expect(next.updatedAt).toEqual(now);
    expect(convo.messages).toHaveLength(4);
  });

  it('replaces a message by id', () => {
    const next = replaceMessage(convo, { ...a1, content: 'معدلة' });
    expect(next.messages[1]?.content).toBe('معدلة');
    expect(next.messages[3]?.content).toBe(a2.content);
  });

  it('finds the user turn behind an answer', () => {
    expect(userMessageBefore(convo, 'a2')?.id).toBe('q2');
    expect(userMessageBefore(convo, 'a1')?.id).toBe('q1');
  });

  it('returns null when there is no preceding user turn', () => {
    expect(userMessageBefore(convo, 'q1')).toBeNull();
    expect(userMessageBefore(convo, 'missing')).toBeNull();
    expect(userMessageBefore(conversation({ messages: [a1] }), 'a1')).toBeNull();
  });
});

describe('user helpers', () => {
  it('takes the first letter and first name', () => {
    expect(avatarInitial(user())).toBe('م');
    expect(firstName(user())).toBe('منى');
    expect(avatarInitial(user({ name: '  Mona Elsherbiny' }))).toBe('M');
  });

  it('handles an empty name', () => {
    expect(avatarInitial({ name: '   ' })).toBe('');
    expect(firstName({ name: '' })).toBe('');
  });
});

describe('pasted text and page order', () => {
  it('numbers pasted text files and reads the number back', () => {
    expect(pastedTextName(3)).toBe('pasted-text-3.txt');
    expect(pastedTextNumber('pasted-text-3.txt')).toBe(3);
    expect(pastedTextNumber('notes.txt')).toBeNull();
  });

  it('sorts page-2 before page-10', () => {
    const names = ['page-10.jpg', 'page-2.jpg', 'page-1.jpg'].map((name) => ({ name }));
    expect(names.sort(byNaturalName).map((n) => n.name)).toEqual([
      'page-1.jpg',
      'page-2.jpg',
      'page-10.jpg',
    ]);
  });
});
