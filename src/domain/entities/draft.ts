export type DraftStatus = 'queued' | 'reading' | 'generating' | 'done' | 'failed';

/** A defence memo built in the background from a conversation's facts and files. */
export interface Draft {
  readonly id: string;
  readonly conversationId: string | null;
  /** The template it was asked with, or null for a defence memo. */
  readonly templateCode: string | null;
  /** The template's Arabic name. */
  readonly templateName: string | null;
  /**
   * The paper's own name, «عقد مقاولة», for one the person described in words («عقد آخر»,
   * «صحيفة دعوى», «أخرى»). The card shows it rather than the template's name.
   */
  readonly title: string | null;
  /** While it is being written: the step it is at, in Arabic. */
  readonly stage: string | null;
  /** What the review found and the revision changed, as Markdown, on a described paper. */
  readonly review: string | null;
  /** Citations corrected against the articles' text before the document was produced. */
  readonly corrected: number;
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
