import type { Attachment } from '@/domain/entities/attachment';
import type { Citation } from '@/domain/entities/citation';
import type { LibraryReference } from '@/domain/entities/library-reference';
import type { TokenCount, UsageSnapshot } from '@/domain/entities/usage';
import type { Feedback } from '@/domain/value-objects/feedback';
import type { Locale } from '@/domain/value-objects/locale';
import type { AppError } from '../errors';
import type { Result } from '../result';

export type ChatScope = 'egyptian_legislation';

export interface StreamAnswerRequest {
  /** Null starts a new conversation. */
  readonly conversationId: string | null;
  readonly content: string;
  readonly attachments: readonly Attachment[];
  readonly scope: ChatScope;
  readonly locale: Locale;
  /**
   * Review the contract in the text or the attachments clause by clause instead of answering a
   * question. The caller decides; it cannot be combined with a defence memo.
   */
  readonly reviewContract: boolean;
  /** Set when regenerating: the assistant message being replaced. */
  readonly regenerateMessageId: string | null;
}

export type ChatEvent =
  | { readonly type: 'token'; readonly text: string }
  | { readonly type: 'citation'; readonly citation: Citation }
  | { readonly type: 'reference'; readonly reference: LibraryReference }
  | {
      readonly type: 'done';
      readonly conversationId: string;
      /** The persisted id of the assistant message, when the backend reports one. */
      readonly messageId: string | null;
      readonly warning: string | null;
      /** What the answer cost and where the conversation and the month now stand. */
      readonly usage: { readonly answer: TokenCount; readonly snapshot: UsageSnapshot } | null;
      /** Set only on the turn that finishes a contract wizard: the contract is being drafted. */
      readonly draftRequestId: string | null;
    }
  | {
      readonly type: 'error';
      readonly code: string;
      /** The figures behind a refusal for a spent limit. */
      readonly usage?: UsageSnapshot | undefined;
    };

export interface ChatGateway {
  /**
   * Streams an answer. Implementations stop and clean up when the signal aborts.
   * Transport failures may throw; StreamAnswer turns them into an error message.
   */
  streamAnswer(request: StreamAnswerRequest, signal?: AbortSignal): AsyncIterable<ChatEvent>;

  submitFeedback(input: {
    readonly conversationId: string;
    readonly messageId: string;
    readonly feedback: Feedback | null;
  }): Promise<Result<void, AppError>>;
}
