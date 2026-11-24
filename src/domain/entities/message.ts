import { EmptyMessageError } from '../errors/domain-error';
import type { Feedback } from '../value-objects/feedback';
import type { Attachment } from './attachment';
import type { Citation } from './citation';
import type { LibraryReference } from './library-reference';
import type { TokenCount } from './usage';

export type MessageRole = 'user' | 'assistant';
export type MessageStatus = 'streaming' | 'complete' | 'stopped' | 'error';

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly citations: readonly Citation[];
  /** Rulings and books beside the statute articles. */
  readonly references: readonly LibraryReference[];
  readonly attachments: readonly Attachment[];
  readonly status: MessageStatus;
  /** Machine code when status is "error". */
  readonly errorCode: string | null;
  readonly createdAt: Date;
  readonly feedback: Feedback | null;
  /** Caveat the backend attached to an answer, shown beneath it. */
  readonly warning: string | null;
  /** What this answer cost. Null on a question, or on a reply from before usage was recorded. */
  readonly usage: TokenCount | null;
  /**
   * While an answer is prepared and before its first word: the step it is at, in Arabic
   * («جارٍ تحليل وقائع القضية…»). Gone once text arrives or the answer ends.
   */
  readonly stage?: string | null;
  /** Sentences corrected against the articles' text before the answer was sent. */
  readonly corrected?: number;
}

export function createUserMessage(input: {
  id: string;
  content: string;
  attachments: readonly Attachment[];
  createdAt: Date;
}): Message {
  const content = input.content.trim();
  if (content.length === 0) throw new EmptyMessageError('Message is empty');
  return {
    id: input.id,
    role: 'user',
    content,
    citations: [],
    references: [],
    attachments: input.attachments,
    status: 'complete',
    errorCode: null,
    createdAt: input.createdAt,
    feedback: null,
    warning: null,
    usage: null,
  };
}

export function startAssistantMessage(input: { id: string; createdAt: Date }): Message {
  return {
    id: input.id,
    role: 'assistant',
    content: '',
    citations: [],
    references: [],
    attachments: [],
    status: 'streaming',
    errorCode: null,
    createdAt: input.createdAt,
    feedback: null,
    warning: null,
    usage: null,
  };
}

export function appendToken(message: Message, text: string): Message {
  return { ...message, content: message.content + text, stage: null };
}

/** The step the answer is at, shown until its first word arrives. */
export function withStage(message: Message, stage: string): Message {
  return { ...message, stage };
}

export function withCorrected(message: Message, corrected: number): Message {
  return { ...message, corrected };
}

/** Same article cited twice in one answer collapses to one chip. */
export function addCitation(message: Message, citation: Citation): Message {
  if (message.citations.some((c) => c.reference.equals(citation.reference))) return message;
  return { ...message, citations: [...message.citations, citation] };
}

/** The same ruling or book twice in one answer collapses to one card; a used one wins. */
export function addReference(message: Message, reference: LibraryReference): Message {
  const existing = message.references.find((r) => r.id === reference.id);
  if (!existing) return { ...message, references: [...message.references, reference] };
  if (existing.used || !reference.used) return message;
  return {
    ...message,
    references: message.references.map((r) => (r.id === reference.id ? reference : r)),
  };
}

export function withUsage(message: Message, usage: TokenCount | null): Message {
  return { ...message, usage };
}

export function withWarning(message: Message, warning: string | null): Message {
  return { ...message, warning };
}

/** Swaps the local id for the persisted one once the backend confirms it. */
export function withId(message: Message, id: string): Message {
  return { ...message, id };
}

export function completeMessage(message: Message): Message {
  return { ...message, status: 'complete', errorCode: null, stage: null };
}

export function stopMessage(message: Message): Message {
  return { ...message, status: 'stopped', stage: null };
}

export function failMessage(message: Message, errorCode: string): Message {
  return { ...message, status: 'error', errorCode, stage: null };
}

export function withFeedback(message: Message, feedback: Feedback | null): Message {
  return { ...message, feedback };
}

export function isInFlight(message: Message): boolean {
  return message.status === 'streaming';
}
