import { InvalidAttachmentError } from '../errors/domain-error';

/** What the backend's reader accepts: images, PDF, Word and plain text. Not the legacy .doc. */
const IMAGE_SUFFIXES = ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp'] as const;
const WORD_SUFFIXES = ['.docx', '.dotx'] as const;
const TEXT_SUFFIXES = ['.txt', '.md', '.csv'] as const;
export const ATTACHMENT_SUFFIXES = [
  ...IMAGE_SUFFIXES,
  '.pdf',
  ...WORD_SUFFIXES,
  ...TEXT_SUFFIXES,
] as const;

/** Per conversation, enforced by the backend as well. */
export const MAX_ATTACHMENTS_PER_CONVERSATION = 10;

/** Text pasted past the message limit travels as `pasted-text-N.txt`, as a long paste does elsewhere. */
export const PASTED_TEXT_PREFIX = 'pasted-text-';

export function pastedTextName(n: number): string {
  return `${PASTED_TEXT_PREFIX}${n}.txt`;
}

/** The N of `pasted-text-N.txt`, or null for any other file. */
export function pastedTextNumber(name: string): number | null {
  const match = /^pasted-text-(\d+)\.txt$/.exec(name);
  return match ? Number(match[1]) : null;
}

/**
 * Page order: page-2 before page-10. A defence memo reads a conversation's files in the order
 * they were uploaded, so the pages of a case must go up in the order they are numbered.
 */
export function byNaturalName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
}
/** The backend allows 10 MB per file; GET /limits states the current number. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Only this many pages of a PDF are read; the rest is not seen. */
export const ATTACHMENT_PAGES_READ = 10;

export type AttachmentKind = 'image' | 'pdf' | 'word' | 'text';

export function attachmentKindOf(name: string): AttachmentKind | null {
  const lower = name.toLowerCase();
  if (IMAGE_SUFFIXES.some((s) => lower.endsWith(s))) return 'image';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (WORD_SUFFIXES.some((s) => lower.endsWith(s))) return 'word';
  if (TEXT_SUFFIXES.some((s) => lower.endsWith(s))) return 'text';
  return null;
}

/** A file as it is referenced when asking: only the id matters to the backend. */
export interface Attachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface AttachmentCandidate {
  readonly name: string;
  readonly sizeBytes: number;
  readonly mimeType?: string | undefined;
}

/** Checks a file before it is uploaded. Judged by name, as the backend does. */
export function assertAttachmentAllowed(
  file: AttachmentCandidate,
  maxBytes: number = MAX_ATTACHMENT_BYTES,
): void {
  if (file.sizeBytes <= 0) throw new InvalidAttachmentError('empty');
  if (file.sizeBytes > maxBytes) throw new InvalidAttachmentError('size');
  if (attachmentKindOf(file.name) === null) throw new InvalidAttachmentError('type');
}
