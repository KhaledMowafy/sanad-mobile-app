import type {
  CitationDto,
  ReferenceDto,
  TokenCountDto,
  UsageSnapshotDto,
} from '@/application/dto/dto';

/**
 * What /api/chat/stream sends the browser, one JSON object per SSE event.
 * Deltas, not full snapshots, so a long answer is not re-sent on every token.
 */
export type ChatStreamEvent =
  | { readonly type: 'start'; readonly conversationId: string | null }
  | { readonly type: 'delta'; readonly text: string }
  /** The step the answer is at before its first word; null once it is past them. */
  | { readonly type: 'stage'; readonly text: string | null }
  | { readonly type: 'citation'; readonly citation: CitationDto }
  | { readonly type: 'reference'; readonly reference: ReferenceDto }
  | {
      readonly type: 'end';
      readonly status: 'complete' | 'stopped' | 'error';
      readonly errorCode: string | null;
      readonly warning: string | null;
      /** The persisted id, when the backend reported one. */
      readonly messageId: string | null;
      readonly conversationId: string | null;
      /** What this answer cost. */
      readonly usage: TokenCountDto | null;
      /** Where the conversation and the month stand now (also sent with a refusal). */
      readonly snapshot: UsageSnapshotDto | null;
      /** Set on the turn that finishes a contract wizard: the contract is being drafted. */
      readonly draftRequestId: string | null;
      /** Sentences corrected against the articles' text before the answer was sent. */
      readonly corrected: number;
    };

export interface ChatStreamRequest {
  readonly conversationId: string | null;
  readonly text: string;
  readonly locale: 'ar' | 'en';
  /** Review the contract in the text or the files instead of answering. */
  readonly reviewContract: boolean;
  /** Uploaded files that are no longer being read. */
  readonly attachmentIds: readonly string[];
}
