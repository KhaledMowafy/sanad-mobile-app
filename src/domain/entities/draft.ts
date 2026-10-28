export type DraftStatus = 'queued' | 'reading' | 'generating' | 'done' | 'failed';

/** A defence memo built in the background from a conversation's facts and files. */
export interface Draft {
  readonly id: string;
  readonly conversationId: string | null;
  /** The template it was asked with, or null for a defence memo. */
  readonly templateCode: string | null;
  /** The document's Arabic name, for the card's title. */
  readonly templateName: string | null;
  /** What the person typed. It is not a chat message, so the draft carries it. */
  readonly prompt: string;
  readonly status: DraftStatus;
  /** Why it failed, when it did. */
  readonly error: string | null;
  /** Unverified article numbers, or a note that part could not be written. */
  readonly warning: string | null;
  /** The memo text. Only the detail view has it. */
  readonly output: string | null;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
}

export function isDraftSettled(draft: Pick<Draft, 'status'>): boolean {
  return draft.status === 'done' || draft.status === 'failed';
}
