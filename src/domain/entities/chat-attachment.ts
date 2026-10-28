import type { AttachmentKind } from './attachment';

/** QUEUED then READING then READY, or FAILED with a reason. Reading runs on a worker. */
export type AttachmentState = 'queued' | 'reading' | 'ready' | 'failed';

/** A file uploaded into a conversation, with what the backend read from it. */
export interface ChatAttachment {
  readonly id: string;
  readonly name: string;
  readonly kind: AttachmentKind;
  readonly sizeBytes: number;
  readonly state: AttachmentState;
  /** What the assistant actually saw. Shown so a misread can be noticed and corrected. */
  readonly extractedText: string;
  /** Reading failed. Raw backend text: never show it, only that it failed. */
  readonly failed: boolean;
}

/** Still being read. A question that references one is rejected by the backend. */
export function isReading(attachment: Pick<ChatAttachment, 'state'>): boolean {
  return attachment.state === 'queued' || attachment.state === 'reading';
}

/**
 * Safe to send with a question. A file that failed to read still goes through: the model is
 * told it could not be read rather than the question silently ignoring it.
 */
export function isSettled(attachment: Pick<ChatAttachment, 'state'>): boolean {
  return !isReading(attachment);
}
